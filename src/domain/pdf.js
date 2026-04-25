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
import { resolveSignatureForRecord } from '../ui/components/signature.js';
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
import { PLAN_CODE_FREE } from '../core/plans/subscriptionPlans.js';

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
      const { filtEq = '', de = '', ate = '', registroId = '' } = options;
      const { planCode } = context;
      const profile = Profile.get();
      const filtered = filterRegistrosForReport(registros, { registroId, filtEq, de, ate });

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

        // Pré-resolve todas as assinaturas (Storage → localStorage) num Map
        // <registroId, dataUrl>. Zero mudança no pipeline de signatures.js:
        // passamos um getter sync que consulta o Map. Paralelizado via
        // Promise.all pra não serializar latência de rede quando há
        // múltiplas assinaturas no Storage.
        const signatureDataUrls = new Map();
        await Promise.all(
          filtered.map(async (registro) => {
            try {
              const dataUrl = await resolveSignatureForRecord(registro);
              if (dataUrl) signatureDataUrls.set(registro.id, dataUrl);
            } catch (_err) {
              /* signature falhou → trata como ausente no PDF */
            }
          }),
        );
        const getSignatureSync = (registroId) => signatureDataUrls.get(registroId) || null;

        drawSignaturePages(
          doc,
          pageWidth,
          pageHeight,
          PAGE_MARGIN,
          filtered,
          equipamentos,
          profile,
          getSignatureSync,
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

      // Novo modo pra share: retorna { fileName, blob } sem disparar o
      // download do browser. Permite upload/Web Share API sem acionar
      // duas ações no usuário (baixar + compartilhar).
      if (options.asBlob === true) {
        const blob = doc.output('blob');
        return { fileName, blob };
      }

      doc.save(fileName);
      return fileName;
    } catch (err) {
      console.error('[PDF v8]', err);
      return null;
    }
  },
};

export default PDFGenerator;
