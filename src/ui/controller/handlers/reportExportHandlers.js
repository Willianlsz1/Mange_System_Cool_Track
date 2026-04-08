import { on } from '../../../core/events.js';
import { Toast } from '../../../core/toast.js';
import { PDFGenerator } from '../../../domain/pdf.js';
import { WhatsAppExport } from '../../../domain/whatsapp.js';

function getReportFilters() {
  return {
    filtEq: document.getElementById('rel-equip')?.value || '',
    de: document.getElementById('rel-de')?.value || '',
    ate: document.getElementById('rel-ate')?.value || '',
  };
}

function bindPdfExport() {
  on('export-pdf', (el) => {
    el.textContent = 'Gerando...';
    el.disabled = true;

    requestAnimationFrame(async () => {
      try {
        const fileName = await PDFGenerator.generateMaintenanceReport(getReportFilters());
        if (fileName) Toast.success(`PDF gerado: ${fileName}`);
        else Toast.error('Erro ao gerar PDF.');
      } finally {
        el.textContent = 'Exportar PDF';
        el.disabled = false;
      }
    });
  });
}

function bindWhatsAppExport() {
  on('whatsapp-export', () => {
    const ok = WhatsAppExport.send(getReportFilters());
    if (!ok) Toast.warning('Nenhum registro para enviar.');
  });
}

export function bindReportExportHandlers() {
  bindPdfExport();
  bindWhatsAppExport();
}
