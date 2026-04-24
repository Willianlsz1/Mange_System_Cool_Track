import { on } from '../../../core/events.js';
import { Toast } from '../../../core/toast.js';
import { ErrorCodes, handleError } from '../../../core/errors.js';
// PDFGenerator é dynamic-imported dentro do handler pra evitar bundlar
// jspdf + jspdf-autotable + pako (~150 KB gz) no chunk principal. Só baixa
// quando o usuário clica "Gerar PDF".
import { WhatsAppExport } from '../../../domain/whatsapp.js';
import { Auth } from '../../../core/auth.js';
import { goTo } from '../../../core/router.js';
import { trackEvent } from '../../../core/telemetry.js';
import { runAsyncAction } from '../../components/actionFeedback.js';
import { ShareSuccessToast } from '../../components/shareSuccessToast.js';
import { PdfSuccessToast } from '../../components/pdfSuccessToast.js';
import { PdfQuotaBadge } from '../../components/pdfQuotaBadge.js';
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

export function buildReportFilters({
  equipId = '',
  registroId = '',
  de = '',
  ate = '',
  filtEq = '',
} = {}) {
  return {
    registroId: String(registroId || ''),
    filtEq: String(filtEq || equipId || ''),
    de: String(de || ''),
    ate: String(ate || ''),
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
async function ensureReportBudget({ attemptedEvent, blockedEvent }) {
  const user = await Auth.getUser();
  if (!user) {
    // Defensivo: sem usuário autenticado, sem export. Na prática o bootstrap
    // já redireciona pra landing quando não há sessão, mas se por algum motivo
    // chegar aqui sem user, mostramos um aviso em vez de quebrar.
    trackEvent(blockedEvent, { reason: 'not_authenticated' });
    Toast.warning('Faça login para gerar o relatório.');
    return { ok: false };
  }

  const { profile } = await fetchMyProfileBilling();
  const planCode = getEffectivePlan(profile);
  trackEvent(attemptedEvent, { plan: planCode });

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
    Toast.warning(buildPdfLimitMessage(planCode, pdfLimit));
    goTo('pricing');
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
  trackEvent('whatsapp_share_attempted', {});

  if (!user) {
    // Defensivo: bootstrap já redireciona não-autenticados pra landing.
    trackEvent('whatsapp_share_blocked', { reason: 'not_authenticated' });
    Toast.warning('Faça login para compartilhar o relatório.');
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
    Toast.warning(upgradeMessage);
    goTo('pricing');
    return false;
  }

  // Gera o PDF como Blob (sem disparar download) e deixa o shareReport
  // decidir o canal: Web Share API (mobile) ou upload+wa.me (desktop/fallback).
  Toast.info?.('Gerando relatório...');
  const { PDFGenerator } = await import('../../../domain/pdf.js');
  const pdfResult = await PDFGenerator.generateMaintenanceReport(
    { ...filters, asBlob: true },
    { planCode },
  );
  if (!pdfResult || !pdfResult.blob) {
    trackEvent('whatsapp_share_blocked', { reason: 'pdf_generation_failed', plan: planCode });
    Toast.warning('Nenhum registro para enviar.');
    return false;
  }

  // Texto curto pro share — usa o prefixo canônico do WhatsAppExport quando
  // houver registros; fallback pra mensagem padrão do shareReport senão.
  const prefixText = WhatsAppExport.generateText(filters) || null;

  Toast.info?.('Preparando compartilhamento...');
  const { shareReportPdf } = await import('../../../domain/pdf/shareReport.js');
  const shareResult = await shareReportPdf({
    pdfBlob: pdfResult.blob,
    fileName: pdfResult.fileName,
    whatsappText: prefixText,
    metadata: { userId: user.id, registroId: filters?.registroId || null },
  });

  // Cancelamento do share sheet não conta como erro nem consome quota.
  if (!shareResult.ok && shareResult.cancelled) {
    return false;
  }

  if (!shareResult.ok) {
    Toast.warning('Não foi possível compartilhar o PDF. Tente baixar o relatório.');
    return false;
  }

  let newUsedCount = whatsappUsed;
  if (Number.isFinite(whatsappLimit)) {
    newUsedCount = await incrementMonthlyUsage(user.id, USAGE_RESOURCE_WHATSAPP_SHARE);
  }

  // Copy diferente por canal — web-share foi disparado com o arquivo real,
  // wa-link abre WhatsApp com link público, download é o fallback offline.
  const successCopy =
    shareResult.channel === 'web-share'
      ? { title: 'Relatório pronto para compartilhar' }
      : shareResult.channel === 'download'
        ? { title: 'Relatório baixado. Envie manualmente pelo WhatsApp.' }
        : { title: 'Relatório enviado para o WhatsApp' };

  trackEvent('whatsapp_share_completed', {
    channel: shareResult.channel,
    plan: planCode,
  });

  ShareSuccessToast.show({
    ...(Number.isFinite(whatsappLimit) ? { used: newUsedCount, limit: whatsappLimit } : {}),
    ...successCopy,
  });
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
