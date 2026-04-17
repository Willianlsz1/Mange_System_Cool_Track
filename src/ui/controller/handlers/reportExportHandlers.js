import { on } from '../../../core/events.js';
import { Toast } from '../../../core/toast.js';
import { ErrorCodes, handleError } from '../../../core/errors.js';
import { PDFGenerator } from '../../../domain/pdf.js';
import { WhatsAppExport } from '../../../domain/whatsapp.js';
import { Auth } from '../../../core/auth.js';
import { trackEvent } from '../../../core/telemetry.js';
import { runAsyncAction } from '../../components/actionFeedback.js';
import { ShareSuccessToast } from '../../components/shareSuccessToast.js';
import { GuestConversionModal } from '../../components/guestConversionModal.js';
import {
  assertFeature,
  FEATURE_PDF_EXPORT,
  getEffectivePlan,
  getPlanCodeForUserId,
} from '../../../core/subscriptionPlans.js';
import { fetchMyProfileBilling } from '../../../core/monetization.js';
import {
  getMonthlyLimitForPlan,
  getMonthlyUsageSnapshot,
  hasReachedMonthlyLimit,
  incrementMonthlyUsage,
  USAGE_RESOURCE_PDF_EXPORT,
  USAGE_RESOURCE_WHATSAPP_SHARE,
} from '../../../core/usageLimits.js';

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
  return {
    filtEq: document.getElementById('rel-equip')?.value || '',
    de: document.getElementById('rel-de')?.value || '',
    ate: document.getElementById('rel-ate')?.value || '',
  };
}

async function resolvePlanAndUsage(userId) {
  const [planCode, usageSnapshot] = await Promise.all([
    getPlanCodeForUserId(userId),
    getMonthlyUsageSnapshot(userId),
  ]);

  return { planCode, usageSnapshot };
}

function bindPdfExport() {
  on('export-pdf', async (el) => {
    const filters = getReportFilters();
    try {
      await runAsyncAction(el, { loadingLabel: 'Gerando PDF...' }, async () => {
        const user = await Auth.getUser();
        const isGuest = !user;
        if (isGuest) {
          trackEvent('pdf_export_attempted', { isGuest: true, plan: 'guest' });
          trackEvent('pdf_export_blocked', { reason: 'guest' });
          GuestConversionModal.open({
            reason: 'save_attempt',
            source: 'pdf_export_attempt',
            preview: buildPdfPreview(filters),
          });
          return;
        }

        const { profile } = await fetchMyProfileBilling();
        const planCode = getEffectivePlan(profile);
        trackEvent('pdf_export_attempted', { isGuest: false, plan: planCode });

        // ── 1. Feature gate: Free bloqueado, Plus+Pro passam ────────────────
        try {
          assertFeature(profile, FEATURE_PDF_EXPORT);
        } catch (accessError) {
          trackEvent('pdf_export_blocked', { reason: 'feature_not_available' });
          GuestConversionModal.open({
            reason: 'premium_pdf',
            source: 'pdf_export_premium',
            title: 'Recurso disponível a partir do Plus',
            message:
              accessError?.message || 'A exportação em PDF está disponível a partir do plano Plus.',
          });
          return;
        }

        // ── 2. Quota mensal: Plus tem limite (100/mês), Pro é ilimitado ─────
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
          trackEvent('pdf_export_blocked', { reason: 'limit_reached', plan: planCode });
          GuestConversionModal.open({
            reason: 'limit_pdf',
            source: 'pdf_export_limit',
            title: 'Limite mensal atingido',
            message: `Você atingiu ${pdfLimit} PDFs este mês no plano Plus. O plano Pro tem PDFs ilimitados.`,
          });
          return;
        }

        // ── 3. Gera o PDF ─────────────────────────────────────────────────
        const fileName = await PDFGenerator.generateMaintenanceReport(filters);
        if (!fileName) {
          Toast.error('Erro ao gerar PDF.');
          return;
        }

        // ── 4. Incrementa contagem só se o plano tem limite finito (Plus) ─
        if (Number.isFinite(pdfLimit)) {
          await incrementMonthlyUsage(user.id, USAGE_RESOURCE_PDF_EXPORT);
        }

        Toast.success(`PDF gerado: ${fileName}`);
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

function bindWhatsAppExport() {
  on('whatsapp-export', async (el) => {
    try {
      await runAsyncAction(el, { loadingLabel: 'Preparando...' }, async () => {
        const user = await Auth.getUser();
        const isGuest = !user;
        trackEvent('whatsapp_share_attempted', { isGuest });

        if (isGuest) {
          trackEvent('whatsapp_share_blocked', { reason: 'guest' });
          GuestConversionModal.open({
            reason: 'save_attempt',
            source: 'whatsapp_share_attempt',
          });
          return;
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
          return;
        }

        const ok = WhatsAppExport.send(getReportFilters());
        if (!ok) {
          Toast.warning('Nenhum registro para enviar.');
          return;
        }

        let newUsedCount = whatsappUsed;
        if (Number.isFinite(whatsappLimit)) {
          newUsedCount = await incrementMonthlyUsage(user.id, USAGE_RESOURCE_WHATSAPP_SHARE);
        }

        ShareSuccessToast.show(
          Number.isFinite(whatsappLimit) ? { used: newUsedCount, limit: whatsappLimit } : {},
        );
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

export function bindReportExportHandlers() {
  bindPdfExport();
  bindWhatsAppExport();
}
