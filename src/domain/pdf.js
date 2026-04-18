/**
 * CoolTrack Pro - PDF Generator v8.0
 * Orquestrador de geração: filtra dados, monta contexto (OS, cliente, emissão)
 * e delega para os builders de seção. O rodapé com paginação X/Y é carimbado
 * por último, depois de todas as páginas terem sido criadas.
 */

import { jsPDF } from 'jspdf';
// v5 do jspdf-autotable não anexa mais `doc.autoTable` por side-effect;
// a função é importada e chamada como autoTable(doc, options). As sections
// (cover, services) fazem esse import diretamente.
import { getState } from '../core/state.js';
import { Profile } from '../features/profile.js';
import { getSignatureForRecord } from '../ui/components/signature.js';
import { drawWatermarkAllPages } from './pdf/primitives.js';
import {
  buildOsNumber,
  buildReportFileName,
  extractClientBlock,
  filterRegistrosForReport,
} from './pdf/reportModel.js';
import { drawCover } from './pdf/sections/cover.js';
import { stampFooterTotals } from './pdf/sections/footer.js';
import { drawServices } from './pdf/sections/services.js';
import { drawSignaturePages } from './pdf/sections/signatures.js';
import { PLAN_CODE_FREE } from '../core/subscriptionPlans.js';

const PAGE_MARGIN = 15;

function createPdfDocument() {
  return new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
}

function getPdfDimensions(doc) {
  return {
    pageWidth: doc.internal.pageSize.getWidth(),
    pageHeight: doc.internal.pageSize.getHeight(),
  };
}

export const PDFGenerator = {
  async generateMaintenanceReport(options = {}, context = {}) {
    try {
      const { registros, equipamentos } = getState();
      const { filtEq = '', de = '', ate = '' } = options;
      const { planCode } = context;
      const profile = Profile.get();
      const filtered = filterRegistrosForReport(registros, { filtEq, de, ate });

      const now = new Date();
      const osNumber = buildOsNumber(now);
      const emitido = now.toLocaleDateString('pt-BR');
      const cliente = extractClientBlock(filtered);
      const reportContext = { osNumber, emitido, cliente };

      const doc = createPdfDocument();
      const { pageWidth, pageHeight } = getPdfDimensions(doc);

      drawCover(
        doc,
        pageWidth,
        pageHeight,
        PAGE_MARGIN,
        profile,
        filtEq,
        de,
        ate,
        filtered,
        equipamentos,
        null,
        reportContext,
      );

      if (filtered.length > 0) {
        doc.addPage();
        await drawServices(
          doc,
          pageWidth,
          pageHeight,
          PAGE_MARGIN,
          filtered,
          equipamentos,
          profile,
          null,
          reportContext,
        );
        drawSignaturePages(
          doc,
          pageWidth,
          pageHeight,
          PAGE_MARGIN,
          filtered,
          equipamentos,
          profile,
          getSignatureForRecord,
          null,
          reportContext,
        );
      }

      // Rodapé final com paginação X/Y. Tem que rodar depois de todas as
      // páginas estarem criadas (inclusive as de assinatura) pra que o total
      // seja correto em cada folha.
      stampFooterTotals(doc, pageWidth, pageHeight, PAGE_MARGIN, profile, {
        osNumber,
        emitido,
      });

      // Marca d'água "CoolTrack Free" por último. No plano Free aparece em
      // malha diagonal atrás de todo o conteúdo. Plus/Pro geram PDF limpo.
      if (planCode === PLAN_CODE_FREE) {
        drawWatermarkAllPages(doc, pageWidth, pageHeight);
      }

      const fileName = buildReportFileName(profile);
      doc.save(fileName);
      return fileName;
    } catch (err) {
      console.error('[PDF v8]', err);
      return null;
    }
  },
};

export default PDFGenerator;
