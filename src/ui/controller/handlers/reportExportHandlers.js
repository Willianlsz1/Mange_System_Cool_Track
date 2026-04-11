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

const PDF_MONTH_LIMIT_FREE = 3;
const WHATSAPP_MONTH_LIMIT_FREE = 10;

function getCurrentMonthKey(prefix) {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return `${prefix}-${month}`;
}

function getMonthlyCount(prefix) {
  const raw = localStorage.getItem(getCurrentMonthKey(prefix));
  const parsed = Number.parseInt(raw || '0', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function bumpMonthlyCount(prefix) {
  const key = getCurrentMonthKey(prefix);
  const next = getMonthlyCount(prefix) + 1;
  localStorage.setItem(key, String(next));
}

function getPlanFromStorage() {
  const plan = String(localStorage.getItem('cooltrack-plan') || 'free').toLowerCase();
  return plan === 'pro' ? 'pro' : 'free';
}

function buildPdfPreview(filters) {
  return {
    title: 'Prévia do relatório',
    items: [
      { label: 'Equipamento', value: filters.filtEq || 'Todos os equipamentos' },
      { label: 'Período', value: `${filters.de || 'Início'} até ${filters.ate || 'Hoje'}` },
      { label: 'Serviço #1', value: '••••••••••••••••' },
      { label: 'Serviço #2', value: '••••••••••••••••' },
      { label: 'Assinatura', value: '••••••••••••••••' },
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

function bindPdfExport() {
  on('export-pdf', async (el) => {
    const filters = getReportFilters();
    try {
      await runAsyncAction(el, { loadingLabel: 'Gerando PDF...' }, async () => {
        const user = await Auth.getUser();
        const isGuest = !user;
        const plan = isGuest ? 'guest' : getPlanFromStorage();
        trackEvent('pdf_export_attempted', { isGuest, plan });

        if (isGuest) {
          trackEvent('pdf_export_blocked', { reason: 'guest' });
          GuestConversionModal.open({
            reason: 'save_attempt',
            source: 'pdf_export_attempt',
            preview: buildPdfPreview(filters),
          });
          return;
        }

        if (plan === 'free' && getMonthlyCount('cooltrack-pdf-count') >= PDF_MONTH_LIMIT_FREE) {
          trackEvent('pdf_export_blocked', { reason: 'limit_reached' });
          GuestConversionModal.open({
            reason: 'limit_pdf',
            source: 'pdf_export_limit',
            message: 'Você gerou 3 relatórios este mês. O plano Pro tem relatórios ilimitados.',
          });
          return;
        }

        const fileName = await PDFGenerator.generateMaintenanceReport(filters);
        if (fileName) Toast.success(`PDF gerado: ${fileName}`);
        else {
          Toast.error('Erro ao gerar PDF.');
          return;
        }
        if (plan === 'free') bumpMonthlyCount('cooltrack-pdf-count');
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

        const plan = getPlanFromStorage();
        if (
          plan === 'free' &&
          getMonthlyCount('cooltrack-whatsapp-count') >= WHATSAPP_MONTH_LIMIT_FREE
        ) {
          trackEvent('whatsapp_share_blocked', { reason: 'limit_reached' });
          GuestConversionModal.open({
            reason: 'limit_whatsapp',
            source: 'whatsapp_share_limit',
            title: 'Limite do plano Free atingido',
            message:
              'Você atingiu 10 compartilhamentos este mês. O plano Pro tem compartilhamentos ilimitados.',
          });
          return;
        }

        const ok = WhatsAppExport.send(getReportFilters());
        if (!ok) {
          Toast.warning('Nenhum registro para enviar.');
          return;
        }
        ShareSuccessToast.show();
        if (plan === 'free') bumpMonthlyCount('cooltrack-whatsapp-count');
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
