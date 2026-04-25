/**
 * PMOC Fase 5.F — Orquestrador do PDF PMOC formal.
 *
 * Junta as 4 seções (capa → cadastro → cronograma → termo) num PDF
 * monocromático A4 portrait. Numeração sequencial via localStorage
 * por user (PMOC YYYY/01, /02, ...) — incrementa só quando o PDF é
 * efetivamente salvo.
 *
 * Uso:
 *   import { generatePmocPdf } from '@/domain/pdf/pmoc/pmocReport.js';
 *   const fileName = await generatePmocPdf({
 *     ano: 2026,
 *     cliente: clienteObj,         // ou null pra PMOC sem vínculo
 *     equipamentos,                // state.equipamentos
 *     registros,                   // state.registros
 *     profile,                     // Profile.get()
 *     userId,                      // pra escopo de numeração
 *   });
 */

import { jsPDF } from 'jspdf';
import { drawPmocCover } from './sections/cover.js';
import { drawPmocRegistry } from './sections/registry.js';
import { drawPmocSchedule } from './sections/schedule.js';
import { drawPmocTermo } from './sections/termo.js';
import { stampPmocFooter } from './primitives.js';
import { PMOC_MARGINS } from './constants.js';

const NUMBERING_KEY_PREFIX = 'cooltrack-pmoc-num';

function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * Gera o próximo número sequencial PMOC para o ano + escopo do user.
 * Persiste em localStorage. Não é fonte da verdade definitiva (Supabase
 * teria mais robustez), mas o caso de uso é "documento gerado pelo
 * técnico no próprio device" — duplicação cross-device é aceita pra Fase 5.
 *
 * @param {string|null} userId — escopo da numeração
 * @param {number} ano
 * @param {boolean} commit — se true, incrementa e persiste; se false, só consulta
 * @returns {string} formatado: "PMOC YYYY/NN"
 */
export function nextPmocNumber(userId, ano, commit = false) {
  const scope = userId || 'anon';
  const key = `${NUMBERING_KEY_PREFIX}:${scope}:${ano}`;
  let current = 0;
  try {
    const stored = localStorage.getItem(key);
    current = stored ? parseInt(stored, 10) || 0 : 0;
  } catch (_e) {
    /* ambiente sem localStorage (SSR/test) — começa em 0 */
  }
  const next = current + 1;
  if (commit) {
    try {
      localStorage.setItem(key, String(next));
    } catch (_e) {
      /* no-op se localStorage indisponível */
    }
  }
  return `PMOC ${ano}/${pad2(next)}`;
}

function buildFileName(docNumber, cliente, ano) {
  const safeNumber = docNumber.replace(/[^A-Za-z0-9]+/g, '-');
  const clientPart = cliente?.nome
    ? `_${cliente.nome.replace(/[^A-Za-z0-9À-ÿ]+/g, '-').slice(0, 40)}`
    : '';
  return `${safeNumber}${clientPart}_${ano}.pdf`;
}

/**
 * Gera o PDF PMOC completo.
 * @param {Object} params
 * @param {number} params.ano
 * @param {Object|null} params.cliente
 * @param {Array} params.equipamentos
 * @param {Array} params.registros
 * @param {Object} params.profile
 * @param {string|null} [params.userId]
 * @param {boolean} [params.asBlob=false] — se true, retorna {fileName, blob}; senão salva direto
 * @returns {Promise<string|{fileName:string, blob:Blob}>}
 */
export async function generatePmocPdf({
  ano,
  cliente = null,
  equipamentos = [],
  registros = [],
  profile = {},
  userId = null,
  asBlob = false,
} = {}) {
  if (!ano || !Number.isFinite(Number(ano))) {
    throw new Error('Ano-base inválido para o PMOC.');
  }

  const docNumber = nextPmocNumber(userId, Number(ano), /* commit */ true);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const ctx = {
    ano: Number(ano),
    docNumber,
    cliente,
    equipamentos,
    registros,
    profile,
  };

  // 1) Capa institucional
  drawPmocCover(doc, pageWidth, pageHeight, PMOC_MARGINS, ctx);

  // 2) Cadastro técnico (cria nova página dentro do draw)
  drawPmocRegistry(doc, pageWidth, pageHeight, PMOC_MARGINS, ctx);

  // 3) Cronograma anual (nova página)
  drawPmocSchedule(doc, pageWidth, pageHeight, PMOC_MARGINS, ctx);

  // 4) Termo de RT (nova página)
  drawPmocTermo(doc, pageWidth, pageHeight, PMOC_MARGINS, ctx);

  // Footer global em todas as páginas (paginação + número PMOC + ano)
  stampPmocFooter(doc, pageWidth, pageHeight, PMOC_MARGINS.left, PMOC_MARGINS.right, {
    docNumber,
    ano: Number(ano),
  });

  const fileName = buildFileName(docNumber, cliente, ano);
  if (asBlob) {
    return { fileName, blob: doc.output('blob') };
  }
  doc.save(fileName);
  return fileName;
}
