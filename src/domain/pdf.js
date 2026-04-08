/**
 * CoolTrack Pro - PDF Generator v7.0
 * Orquestrador de geração: filtra dados, monta contexto e delega para builders de seção.
 */

import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { getState } from '../core/state.js';
import { Profile } from '../features/profile.js';
import { getSignatureForRecord } from '../ui/components/signature.js';
import { fillPage } from './pdf/primitives.js';
import { buildReportFileName, filterRegistrosForReport } from './pdf/reportModel.js';
import { drawCover } from './pdf/sections/cover.js';
import { drawFooter } from './pdf/sections/footer.js';
import { drawServices } from './pdf/sections/services.js';
import { drawSignaturePages } from './pdf/sections/signatures.js';

const PAGE_MARGIN = 18;

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
  generateMaintenanceReport(options = {}) {
    try {
      const { registros, equipamentos } = getState();
      const { filtEq = '', de = '', ate = '' } = options;
      const profile = Profile.get();
      const filtered = filterRegistrosForReport(registros, { filtEq, de, ate });

      const doc = createPdfDocument();
      const { pageWidth, pageHeight } = getPdfDimensions(doc);

      this._drawCover(
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
      );

      if (filtered.length > 0) {
        doc.addPage();
        fillPage(doc, pageWidth, pageHeight);
        this._drawServicos(
          doc,
          pageWidth,
          pageHeight,
          PAGE_MARGIN,
          filtered,
          equipamentos,
          profile,
        );
        this._drawSignaturePages(
          doc,
          pageWidth,
          pageHeight,
          PAGE_MARGIN,
          filtered,
          equipamentos,
          profile,
        );
      }

      const fileName = buildReportFileName(profile);
      doc.save(fileName);
      return fileName;
    } catch (err) {
      console.error('[PDF v7]', err);
      return null;
    }
  },

  _drawCover(doc, pageWidth, pageHeight, margin, profile, filtEq, de, ate, filtered, equipamentos) {
    drawCover(
      doc,
      pageWidth,
      pageHeight,
      margin,
      profile,
      filtEq,
      de,
      ate,
      filtered,
      equipamentos,
      this._drawFooter.bind(this),
    );
  },

  _drawServicos(doc, pageWidth, pageHeight, margin, filtered, equipamentos, profile) {
    drawServices(
      doc,
      pageWidth,
      pageHeight,
      margin,
      filtered,
      equipamentos,
      profile,
      this._drawFooter.bind(this),
    );
  },

  _drawSignaturePages(doc, pageWidth, pageHeight, margin, filtered, equipamentos, profile) {
    drawSignaturePages(
      doc,
      pageWidth,
      pageHeight,
      margin,
      filtered,
      equipamentos,
      profile,
      getSignatureForRecord,
      this._drawFooter.bind(this),
    );
  },

  _drawFooter(doc, pageWidth, pageHeight, margin, profile, pageNum) {
    drawFooter(doc, pageWidth, pageHeight, margin, profile, pageNum);
  },
};

export default PDFGenerator;
