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
import { getPlanCodeForUserId } from '../../../core/subscriptionPlans.js';
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

        const { planCode, usageSnapshot } = await resolvePlanAndUsage(user.id);
        trackEvent('pdf_export_attempted', { isGuest: false, plan: planCode });

        const pdfUsed = usageSnapshot[USAGE_RESOURCE_PDF_EXPORT];
        const pdfLimit = getMonthlyLimitForPlan(planCode, USAGE_RESOURCE_PDF_EXPORT);

        if (
          hasReachedMonthlyLimit({
            planCode,
            resource: USAGE_RESOURCE_PDF_EXPORT,
            usedCount: pdfUsed,
          })
        ) {
          trackEvent('pdf_export_blocked', { reason: 'limit_reached' });
          GuestConversionModal.open({
            reason: 'limit_pdf',
            source: 'pdf_export_limit',
            message: `Voce gerou ${pdfLimit} relatorios este mes. O plano Pro tem relatorios ilimitados.`,
          });
          return;
        }

        const fileName = await PDFGenerator.generateMaintenanceReport(filters);
        if (!fileName) {
          Toast.error('Erro ao gerar PDF.');
          return;
        }

        Toast.success(`PDF gerado: ${fileName}`);

        if (Number.isFinite(pdfLimit)) {
          await incrementMonthlyUsage(user.id, USAGE_RESOURCE_PDF_EXPORT);
        }
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
          trackEvent('whatsapp_share_blocked', { reason: 'limit_reached' });
          GuestConversionModal.open({
            reason: 'limit_whatsapp',
            source: 'whatsapp_share_limit',
            title: 'Limite do plano Free atingido',
            message: `Voce atingiu ${whatsappLimit} compartilhamentos este mes. O plano Pro tem compartilhamentos ilimitados.`,
          });
          return;
        }

        const ok = WhatsAppExport.send(getReportFilters());
        if (!ok) {
          Toast.warning('Nenhum registro para enviar.');
          return;
        }

        ShareSuccessToast.show();

        if (Number.isFinite(whatsappLimit)) {
          await incrementMonthlyUsage(user.id, USAGE_RESOURCE_WHATSAPP_SHARE);
        }
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
