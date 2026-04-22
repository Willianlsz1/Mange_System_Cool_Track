import { on } from '../../../core/events.js';
import { Toast } from '../../../core/toast.js';
import { CustomConfirm } from '../../../core/modal.js';
import { ErrorCodes, handleError } from '../../../core/errors.js';
// PDFGenerator é dynamic-imported dentro do handler pra evitar bundlar
// jspdf + jspdf-autotable + pako (~150 KB gz) no chunk principal. Só baixa
// quando o usuário clica "Gerar PDF".
import { WhatsAppExport } from '../../../domain/whatsapp.js';
import { Auth } from '../../../core/auth.js';
import { trackEvent } from '../../../core/telemetry.js';
import { runAsyncAction } from '../../components/actionFeedback.js';
import { ShareSuccessToast } from '../../components/shareSuccessToast.js';
import { PdfSuccessToast } from '../../components/pdfSuccessToast.js';
import { PdfQuotaBadge } from '../../components/pdfQuotaBadge.js';
import { GuestConversionModal } from '../../components/guestConversionModal.js';
import {
  getEffectivePlan,
  getPlanCodeForUserId,
  PLAN_CODE_FREE,
  PLAN_CODE_PLUS,
} from '../../../core/plans/subscriptionPlans.js';
import { fetchMyProfileBilling } from '../../../core/plans/monetization.js';
import {
  getMonthlyLimitForPlan,
  getMonthlyUsageSnapshot,
  hasReachedMonthlyLimit,
  incrementMonthlyUsage,
  USAGE_RESOURCE_PDF_EXPORT,
  USAGE_RESOURCE_WHATSAPP_SHARE,
} from '../../../core/usageLimits.js';

export function buildReportFilters({ equipId = '', de = '', ate = '', filtEq = '' } = {}) {
  return {
    filtEq: String(filtEq || equipId || ''),
    de: String(de || ''),
    ate: String(ate || ''),
  };
}

function buildPdfPreview(filters) {
  return {
    title: 'Previa do relatorio',
    items: [
      { label: 'Equipamento', value: filters.filtEq || 'Todos os equipamentos' },
      { label: 'Periodo', value: `${filters.de || 'Inicio'} ate ${filters.ate || 'Hoje'}` },
      { label: 'Servico #1', value: '................' },
      { label: 'Servico #2', value: '................' },
      { label: 'Assinatura', value: '................' },
    ],
  };
}

function getReportFilters() {
  return buildReportFilters({
    filtEq: document.getElementById('rel-equip')?.value || '',
    de: document.getElementById('rel-de')?.value || '',
    ate: document.getElementById('rel-ate')?.value || '',
  });
}

async function resolvePlanAndUsage(userId) {
  const [planCode, usageSnapshot] = await Promise.all([
    getPlanCodeForUserId(userId),
    getMonthlyUsageSnapshot(userId),
  ]);

  return { planCode, usageSnapshot };
}

function buildPdfLimitMessage(planCode, pdfLimit) {
  if (planCode === PLAN_CODE_FREE) {
    return "No plano Free os relatórios saem com marca d'água. Faça upgrade para Plus (120/mês, sem marca d'água) ou Pro (ilimitado).";
  }
  if (planCode === PLAN_CODE_PLUS) {
    return `Você atingiu ${pdfLimit} PDFs este mês no plano Plus. O plano Pro tem PDFs ilimitados.`;
  }
  return `Você atingiu o limite mensal de ${pdfLimit} PDFs.`;
}

/**
 * ensureReportBudget
 * -------------------
 * Porta de entrada compartilhada por "Exportar PDF" e "Imprimir" — ambos
 * consomem a mesma quota mensal (USAGE_RESOURCE_PDF_EXPORT). Centraliza:
 *   1. Auth.getUser() + modal de conversão para convidados
 *   2. fetchMyProfileBilling() + getEffectivePlan() para o plano efetivo
 *   3. getMonthlyUsageSnapshot + hasReachedMonthlyLimit + modal de limite
 *   4. commit(): incremento condicional (apenas planos com limite finito)
 *
 * Retorna `{ ok: false }` quando bloqueia (guest ou limite) e o caller sai.
 * Retorna `{ ok: true, user, planCode, pdfUsed, pdfLimit, commit }` no happy path.
 */
async function ensureReportBudget({
  attemptedEvent,
  blockedEvent,
  guestSource,
  guestPreview,
  limitSource,
}) {
  const user = await Auth.getUser();
  const isGuest = !user;
  if (isGuest) {
    trackEvent(attemptedEvent, { isGuest: true, plan: 'guest' });
    trackEvent(blockedEvent, { reason: 'guest' });
    GuestConversionModal.open({
      reason: 'save_attempt',
      source: guestSource,
      ...(guestPreview ? { preview: guestPreview } : {}),
    });
    return { ok: false };
  }

  const { profile } = await fetchMyProfileBilling();
  const planCode = getEffectivePlan(profile);
  trackEvent(attemptedEvent, { isGuest: false, plan: planCode });

  // ── Quota mensal: Free=ilimitado (com marca d'água), Plus=120, Pro=ilimitado ─
  const usageSnapshot = await getMonthlyUsageSnapshot(user.id);
  const pdfUsed = usageSnapshot[USAGE_RESOURCE_PDF_EXPORT];
  const pdfLimit = getMonthlyLimitForPlan(planCode, USAGE_RESOURCE_PDF_EXPORT);

  if (
    hasReachedMonthlyLimit({
      planCode,
      resource: USAGE_RESOURCE_PDF_EXPORT,
      usedCount: pdfUsed,
    })
  ) {
    trackEvent(blockedEvent, { reason: 'limit_reached', plan: planCode });
    GuestConversionModal.open({
      reason: 'limit_pdf',
      source: limitSource,
      title: 'Limite mensal atingido',
      message: buildPdfLimitMessage(planCode, pdfLimit),
    });
    return { ok: false };
  }

  return {
    ok: true,
    user,
    planCode,
    pdfUsed,
    pdfLimit,
    async commit() {
      // Incrementa contagem só se o plano tem limite finito (Free/Plus).
      // Pro (limit=Infinity) não consome quota.
      if (!Number.isFinite(pdfLimit)) return pdfUsed;
      return incrementMonthlyUsage(user.id, USAGE_RESOURCE_PDF_EXPORT);
    },
  };
}

function bindPdfExport() {
  on('export-pdf', async (el) => {
    try {
      await exportPdfFlow({
        filters: getReportFilters(),
        triggerEl: el,
      });
    } catch (error) {
      handleError(error, {
        code: ErrorCodes.NETWORK_ERROR,
        message: 'Nao foi possivel gerar o PDF agora.',
        context: { action: 'controller.export-pdf' },
      });
    }
  });
}

async function executePdfExport(filters) {
  const budget = await ensureReportBudget({
    attemptedEvent: 'pdf_export_attempted',
    blockedEvent: 'pdf_export_blocked',
    guestSource: 'pdf_export_attempt',
    guestPreview: buildPdfPreview(filters),
    limitSource: 'pdf_export_limit',
  });
  if (!budget.ok) return false;

  const { planCode, pdfLimit } = budget;

  // ── Gera o PDF (planCode controla marca d'água "CoolTrack Free") ──
  const { PDFGenerator } = await import('../../../domain/pdf.js');
  const fileName = await PDFGenerator.generateMaintenanceReport(filters, { planCode });
  if (!fileName) {
    Toast.error('Erro ao gerar PDF.');
    return false;
  }

  const newUsedCount = await budget.commit();

  // Toast enriquecido com contador "X/Y · restam Z" para Free/Plus.
  // Pro (limit=Infinity) fica com o subtítulo default ("Pronto para enviar").
  PdfSuccessToast.show(
    Number.isFinite(pdfLimit) ? { used: newUsedCount, limit: pdfLimit, fileName } : { fileName },
  );

  // Atualiza o badge inline na toolbar do relatório — assim o contador
  // já reflete o novo uso sem precisar o usuário sair e voltar da view.
  PdfQuotaBadge.refresh();
  return true;
}

export async function exportPdfFlow({ filters, triggerEl = null } = {}) {
  const safeFilters = buildReportFilters(filters);
  if (triggerEl) {
    let done = false;
    await runAsyncAction(triggerEl, { loadingLabel: 'Gerando PDF...' }, async () => {
      done = await executePdfExport(safeFilters);
    });
    return done;
  }
  return executePdfExport(safeFilters);
}

function bindWhatsAppExport() {
  on('whatsapp-export', async (el) => {
    try {
      await shareWhatsAppFlow({
        filters: getReportFilters(),
        triggerEl: el,
      });
    } catch (error) {
      handleError(error, {
        code: ErrorCodes.NETWORK_ERROR,
        message: 'Nao foi possivel preparar o envio para o WhatsApp.',
        context: { action: 'controller.whatsapp-export' },
      });
    }
  });
}

async function executeWhatsAppShare(filters) {
  const user = await Auth.getUser();
  const isGuest = !user;
  trackEvent('whatsapp_share_attempted', { isGuest });

  if (isGuest) {
    trackEvent('whatsapp_share_blocked', { reason: 'guest' });
    GuestConversionModal.open({
      reason: 'save_attempt',
      source: 'whatsapp_share_attempt',
    });
    return false;
  }

  const { planCode, usageSnapshot } = await resolvePlanAndUsage(user.id);
  const whatsappUsed = usageSnapshot[USAGE_RESOURCE_WHATSAPP_SHARE];
  const whatsappLimit = getMonthlyLimitForPlan(planCode, USAGE_RESOURCE_WHATSAPP_SHARE);

  if (
    hasReachedMonthlyLimit({
      planCode,
      resource: USAGE_RESOURCE_WHATSAPP_SHARE,
      usedCount: whatsappUsed,
    })
  ) {
    trackEvent('whatsapp_share_blocked', { reason: 'limit_reached', plan: planCode });
    const upgradeMessage =
      planCode === 'plus'
        ? `Voce atingiu ${whatsappLimit} compartilhamentos este mes no Plus. O Pro tem envios ilimitados.`
        : `Voce atingiu ${whatsappLimit} compartilhamentos este mes. Faca upgrade para Plus ou Pro.`;
    GuestConversionModal.open({
      reason: 'limit_whatsapp',
      source: 'whatsapp_share_limit',
      title: 'Limite mensal atingido',
      message: upgradeMessage,
    });
    return false;
  }

  // Confirmação explícita ANTES de abrir wa.me.
  const limitHint = Number.isFinite(whatsappLimit)
    ? ` Isso consumirá 1 de ${whatsappLimit} envios do seu plano este mês.`
    : '';
  const confirmed = await CustomConfirm.show(
    'Abrir WhatsApp?',
    `O WhatsApp será aberto em uma nova aba com o resumo pronto pra enviar.${limitHint}`,
    {
      confirmLabel: 'Abrir WhatsApp',
      cancelLabel: 'Cancelar',
      tone: 'primary',
      focus: 'confirm',
    },
  );

  if (!confirmed) {
    trackEvent('whatsapp_share_canceled', { plan: planCode });
    return false;
  }

  const ok = WhatsAppExport.send(filters);
  if (!ok) {
    Toast.warning('Nenhum registro para enviar.');
    return false;
  }

  let newUsedCount = whatsappUsed;
  if (Number.isFinite(whatsappLimit)) {
    newUsedCount = await incrementMonthlyUsage(user.id, USAGE_RESOURCE_WHATSAPP_SHARE);
  }

  ShareSuccessToast.show(
    Number.isFinite(whatsappLimit) ? { used: newUsedCount, limit: whatsappLimit } : {},
  );
  return true;
}

export async function shareWhatsAppFlow({ filters, triggerEl = null } = {}) {
  const safeFilters = buildReportFilters(filters);
  if (triggerEl) {
    let done = false;
    await runAsyncAction(triggerEl, { loadingLabel: 'Preparando...' }, async () => {
      done = await executeWhatsAppShare(safeFilters);
    });
    return done;
  }
  return executeWhatsAppShare(safeFilters);
}

export function bindReportExportHandlers() {
  bindPdfExport();
  bindWhatsAppExport();
}
