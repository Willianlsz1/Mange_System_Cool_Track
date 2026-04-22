/**
 * CoolTrack Pro - PDF Services Section (card-based)
 *
 * Arquitetura antiga (removida):
 *   autoTable + minCellHeight inflado + didDrawCell capturando coordenadas
 *   + segundo passo desenhando detalhes por cima. Frágil: em registros com
 *   muita obs/foto os blocos de detalhe se sobrepunham aos seguintes porque
 *   estimateDetailsHeight e drawServiceDetails divergiam em alguns casos,
 *   e a v5 do jspdf-autotable não garante que `cell.y` permaneça coerente
 *   depois de page-breaks automáticos.
 *
 * Arquitetura nova:
 *   Cada registro é um "card" independente desenhado num loop linear. O
 *   loop mede o card ANTES de desenhar (computeCardHeight) e faz page-break
 *   explícito se o card não cabe no restante da página. Para os raros casos
 *   em que um card ultrapassa uma página inteira (muitas fotos), o desenho
 *   flui o grid de fotos para páginas seguintes preservando o cabeçalho.
 *
 * Preservado do layout anterior: paleta navy+teal do PDF_COLORS, cabeçalho
 * "DETALHES DOS SERVIÇOS" em cada página, 4 fotos no máximo por serviço
 * (2 por linha, 55mm de altura), status colorido por severidade.
 */

import { Utils } from '../../../core/utils.js';
import { resolvePhotoDataUrlForPdf } from '../../../core/photoStorage.js';
import { PDF_COLORS as C, PDF_TYPO as T, STATUS_CLIENTE } from '../constants.js';
import { sanitizeObservation, sanitizePublicText } from '../sanitizers.js';
import { accentLine, fillPage, fillRect, txt } from '../primitives.js';

// ---------- layout constants (mm) ----------

const BOTTOM_MARGIN = 22; // reservado para o rodapé (stampFooterTotals)
const FIRST_PAGE_CONTENT_Y = 30; // primeiro card da 1a página (após título)
const NEXT_PAGE_CONTENT_Y = 20; // primeiro card em páginas subsequentes

const CARD_INNER_PAD_X = 4;
const CARD_INNER_PAD_BOTTOM = 3.5;
const CARD_GAP = 3; // espaço entre cards

const HEADER_BAND_H = 7; // faixa colorida no topo do card (data + status)
const HEADER_BAND_ACCENT_W = 2; // stripe teal à esquerda da faixa

const GAP_SM = 1.5; // gap pequeno entre blocos do mesmo grupo
const GAP_MD = 3; // gap médio antes de fotos

// Alturas de linha (incluem line-height). Se alterar, confirmar que
// computeCardHeight e drawServiceCardAtomic permanecem coerentes — ambos
// usam EXATAMENTE estes valores para medir e posicionar.
const LINE_EQUIP = 5; // 10pt bold
const LINE_META = 4; // 8pt
const LINE_OBS = 4; // 8.5pt normal (multiline)
const LINE_MATERIAL = 4; // 8pt
const LINE_COST = 4.5; // 8.5pt bold

const PHOTO_LABEL_H = 4; // "Fotos anexadas" (7pt bold) + pequeno gap
const PHOTO_H = 55;
const PHOTO_ROW_GAP = 3;
const PHOTO_GAP_X = 4;

const HEADER_BAND_BG = [232, 245, 247]; // teal @ 8% — combina com C.accent

// ---------- helpers ----------

// Cabeçalho fixo que aparece no topo de cada página de serviço.
// Identifica produto + OS + empresa do técnico.
function drawServicesPageHeader(doc, pageWidth, margin, profile, context = {}) {
  fillRect(doc, 0, 0, pageWidth, 14, C.bg2);
  fillRect(doc, 0, 14, pageWidth, 0.3, C.borderStrong);
  fillRect(doc, 0, 0, pageWidth, 2, C.primary);

  txt(doc, 'COOLTRACK PRO', margin, 7.5, {
    size: 7,
    style: 'bold',
    color: C.primary,
  });

  const midParts = ['DETALHES DOS SERVIÇOS'];
  if (context.osNumber) midParts.push(`OS ${context.osNumber}`);
  txt(doc, midParts.join('  ·  '), margin + 40, 7.5, {
    size: 7,
    style: 'bold',
    color: C.text,
  });

  if (profile?.empresa) {
    txt(doc, profile.empresa, pageWidth - margin, 7.5, {
      size: 7,
      color: C.text3,
      align: 'right',
    });
  }
}

function drawSectionTitle(doc, pageWidth, margin, total) {
  const titleY = 22;
  txt(doc, 'REGISTROS DE SERVIÇO', margin, titleY, {
    size: T.h1.size,
    style: T.h1.style,
    color: C.primary,
  });
  txt(
    doc,
    `${total} ${total === 1 ? 'registro' : 'registros'} no período`,
    pageWidth - margin,
    titleY,
    { size: 8, color: C.text3, align: 'right' },
  );
  accentLine(doc, margin, titleY + 2, pageWidth - margin, C.border);
}

function getRecordPhotos(registro) {
  return Array.isArray(registro.fotos) ? registro.fotos.filter(Boolean).slice(0, 4) : [];
}

function getImageFormat(dataUrl) {
  const formatRaw = dataUrl?.match(/^data:image\/(png|jpe?g|webp);/i)?.[1]?.toLowerCase();
  if (!formatRaw) return 'JPEG';
  if (formatRaw === 'jpg') return 'JPEG';
  return formatRaw.toUpperCase();
}

// Carrega a imagem para descobrir as dimensões naturais. Preserva a
// proporção ao desenhar no box (caso contrário fotos 4:3 ficam esticadas).
function loadImageDimensions(dataUrl) {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined') {
      resolve(null);
      return;
    }
    const img = new Image();
    img.onload = () =>
      resolve({
        width: img.naturalWidth || img.width || 0,
        height: img.naturalHeight || img.height || 0,
      });
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

// Centraliza a imagem no box preservando a proporção (contain).
function fitImageInBox(imgDims, boxWidth, boxHeight) {
  if (!imgDims || imgDims.width <= 0 || imgDims.height <= 0) {
    return { drawW: boxWidth, drawH: boxHeight, offsetX: 0, offsetY: 0 };
  }
  const boxRatio = boxWidth / boxHeight;
  const imgRatio = imgDims.width / imgDims.height;
  if (imgRatio > boxRatio) {
    const drawH = boxWidth / imgRatio;
    return { drawW: boxWidth, drawH, offsetX: 0, offsetY: (boxHeight - drawH) / 2 };
  }
  const drawW = boxHeight * imgRatio;
  return { drawW, drawH: boxHeight, offsetX: (boxWidth - drawW) / 2, offsetY: 0 };
}

// ---------- card sizing ----------

function splitObsLines(doc, text, width) {
  if (!text) return [];
  const prevSize = doc.internal.getFontSize();
  doc.setFontSize(8.5);
  const lines = doc.splitTextToSize(text, width);
  doc.setFontSize(prevSize);
  return lines;
}

/**
 * Mede a altura de um card em milímetros. IMPORTANTE: a aritmética aqui
 * precisa espelhar exatamente drawServiceCardAtomic — caso contrário o
 * loop reserva espaço errado e cards se sobrepõem (o bug original).
 *
 * Retorna um objeto com:
 *  - total: altura total (incluindo bottom padding)
 *  - textBlock: altura do bloco de texto (até antes das fotos), útil para
 *    cards oversize onde precisamos quebrar entre texto e fotos.
 *  - obsLines: linhas pré-quebradas da observação (reusadas no draw).
 *  - photoRows, photos: para o grid.
 */
function computeCardLayout(doc, pageWidth, margin, registro, equipamento) {
  const innerW = pageWidth - margin * 2 - CARD_INNER_PAD_X * 2;
  let h = HEADER_BAND_H + GAP_SM;

  // Equipamento
  h += LINE_EQUIP;

  // Meta (tipo · técnico · custo)
  h += LINE_META;

  // Obs (multiline)
  const obs = sanitizeObservation(registro.obs || '');
  const obsLines = obs ? splitObsLines(doc, obs, innerW) : [];
  if (obsLines.length) {
    h += GAP_SM;
    h += obsLines.length * LINE_OBS;
  }

  // Materiais
  if (registro.pecas?.trim()) {
    h += GAP_SM + LINE_MATERIAL;
  }

  // Custo (só mostra se > 0)
  const custo = parseFloat(registro.custoPecas || 0) + parseFloat(registro.custoMaoObra || 0);
  if (custo > 0) {
    h += GAP_SM + LINE_COST;
  }

  const textBlock = h;

  // Fotos
  const photos = getRecordPhotos(registro);
  let photoRows = 0;
  if (photos.length) {
    photoRows = Math.ceil(photos.length / 2);
    h += GAP_MD + PHOTO_LABEL_H;
    h += photoRows * PHOTO_H + (photoRows - 1) * PHOTO_ROW_GAP;
  }

  h += CARD_INNER_PAD_BOTTOM;

  return {
    total: h,
    textBlock,
    obsLines,
    photos,
    photoRows,
    innerW,
    custo,
    equipamento,
  };
}

// ---------- card drawing ----------

function drawCardChrome(doc, pageWidth, margin, startY, totalHeight) {
  const outerW = pageWidth - margin * 2;
  // Faixa colorida superior
  fillRect(doc, margin, startY, outerW, HEADER_BAND_H, HEADER_BAND_BG);
  // Stripe teal no canto esquerdo da faixa
  fillRect(doc, margin, startY, HEADER_BAND_ACCENT_W, HEADER_BAND_H, C.accent);
  // Linha divisória inferior (hairline)
  accentLine(doc, margin + 2, startY + totalHeight - 1.2, pageWidth - margin - 2, C.border);
}

function drawCardHeader(doc, pageWidth, margin, startY, registro) {
  const innerX = margin + CARD_INNER_PAD_X;
  const bandBaseline = startY + 4.8;
  txt(doc, Utils.formatDatetime(registro.data), innerX, bandBaseline, {
    size: 9,
    style: 'bold',
    color: C.primary,
  });
  const st = STATUS_CLIENTE[registro.status] || STATUS_CLIENTE.ok;
  txt(doc, `• ${st.label}`, pageWidth - margin - CARD_INNER_PAD_X, bandBaseline, {
    size: 9,
    style: 'bold',
    color: st.color,
    align: 'right',
  });
}

/**
 * Desenha o bloco de texto do card (header→custo). Retorna o y final
 * (logo abaixo do custo/materiais, antes das fotos).
 *
 * O avanço interno de `y` replica exatamente computeCardLayout — isso é
 * intencional: as duas funções operam em paralelo sobre as mesmas
 * constantes, então o bug de descompasso entre medir e desenhar que
 * existia na versão autoTable não volta.
 */
function drawCardTextBlock(doc, pageWidth, margin, startY, registro, profile, layout) {
  const innerX = margin + CARD_INNER_PAD_X;
  const { obsLines, custo, equipamento } = layout;

  let y = startY + HEADER_BAND_H + GAP_SM;

  // Equipamento (10pt bold)
  const equipText = equipamento
    ? `${sanitizePublicText(equipamento.nome)}${equipamento.local ? ` · ${sanitizePublicText(equipamento.local)}` : ''}`
    : 'Não informado';
  txt(doc, `Equipamento: ${equipText}`, innerX, y + 3.8, {
    size: 10,
    style: 'bold',
    color: C.text,
  });
  y += LINE_EQUIP;

  // Meta: tipo + técnico (8pt)
  const tipo = sanitizePublicText(registro.tipo);
  const tecnico = sanitizePublicText(registro.tecnico || profile?.nome);
  txt(doc, `Tipo de serviço: ${tipo} · Técnico: ${tecnico}`, innerX, y + 3, {
    size: 8,
    color: C.text3,
  });
  y += LINE_META;

  // Obs (multiline 8.5pt)
  y += GAP_SM;
  txt(doc, 'Descrição:', innerX, y + 3, {
    size: 8,
    style: 'bold',
    color: C.text3,
  });
  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...C.text2);
  doc.text(obsLines.length ? obsLines : [sanitizeObservation(registro.obs)], innerX, y + 3);
  y += (obsLines.length || 1) * LINE_OBS;

  // Materiais
  if (registro.pecas?.trim()) {
    y += GAP_SM;
    txt(doc, `Materiais: ${sanitizePublicText(registro.pecas.trim())}`, innerX, y + 3, {
      size: 8,
      color: C.text3,
    });
    y += LINE_MATERIAL;
  }

  // Custo
  if (custo > 0) {
    y += GAP_SM;
    txt(doc, `Custo do serviço: R$ ${custo.toFixed(2).replace('.', ',')}`, innerX, y + 3.2, {
      size: 8.5,
      style: 'bold',
      color: C.text,
    });
    y += LINE_COST;
  }

  return y;
}

async function drawPhotoRow(doc, margin, pageWidth, photoY, photos, rowIndex, innerW) {
  const innerX = margin + CARD_INNER_PAD_X;
  const photoW = (innerW - PHOTO_GAP_X) / 2;

  for (let col = 0; col < 2; col += 1) {
    const i = rowIndex * 2 + col;
    if (i >= photos.length) break;
    const px = innerX + col * (photoW + PHOTO_GAP_X);
    const py = photoY;
    doc.setDrawColor(...C.border);
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(px, py, photoW, PHOTO_H, 1.2, 1.2, 'FD');
    try {
      const imageData = await resolvePhotoDataUrlForPdf(photos[i]);
      if (!imageData) throw new Error('Foto indisponível');
      const format = getImageFormat(imageData);
      const imgDims = await loadImageDimensions(imageData);
      const boxInnerW = photoW - 2;
      const boxInnerH = PHOTO_H - 2;
      const { drawW, drawH, offsetX, offsetY } = fitImageInBox(imgDims, boxInnerW, boxInnerH);
      doc.addImage(imageData, format, px + 1 + offsetX, py + 1 + offsetY, drawW, drawH);
    } catch (_err) {
      txt(doc, 'Foto indisponível', px + photoW / 2, py + PHOTO_H / 2 + 1, {
        size: 7,
        color: C.text3,
        align: 'center',
      });
    }
  }
}

/**
 * Desenha um card que cabe inteiramente na página atual. Assume que quem
 * chama já fez o page-break check.
 */
async function drawServiceCardAtomic(doc, pageWidth, margin, startY, registro, profile, layout) {
  drawCardChrome(doc, pageWidth, margin, startY, layout.total);
  drawCardHeader(doc, pageWidth, margin, startY, registro);

  const textEndY = drawCardTextBlock(doc, pageWidth, margin, startY, registro, profile, layout);

  if (layout.photos.length) {
    const innerX = margin + CARD_INNER_PAD_X;
    let photoY = textEndY + GAP_MD;
    txt(doc, 'Fotos anexadas', innerX, photoY + 3, {
      size: 7,
      style: 'bold',
      color: C.text3,
    });
    photoY += PHOTO_LABEL_H;

    for (let r = 0; r < layout.photoRows; r += 1) {
      await drawPhotoRow(doc, margin, pageWidth, photoY, layout.photos, r, layout.innerW);
      photoY += PHOTO_H;
      if (r < layout.photoRows - 1) photoY += PHOTO_ROW_GAP;
    }
  }
}

/**
 * Desenha um card que não cabe em uma página inteira (raríssimo — exige
 * muitas linhas de obs + 4 fotos). Pinta o bloco de texto na página
 * atual e depois permite que as linhas de fotos fluam para páginas
 * subsequentes, redesenhando o header da página a cada quebra.
 *
 * Retorna { endPage, endY } para o loop principal continuar a partir daí.
 */
async function drawServiceCardPaginated(
  doc,
  pageWidth,
  pageHeight,
  margin,
  startY,
  registro,
  profile,
  layout,
  redrawPageHeader,
) {
  // Bloco de texto: desenhamos na página atual mesmo que extrapole um
  // pouco — obs muito longa é o único caso em que o textBlock sozinho
  // pode passar da página. Nesse cenário raro aceitamos clipping leve
  // em vez de quebrar um parágrafo no meio.
  drawCardChrome(doc, pageWidth, margin, startY, layout.textBlock + GAP_MD);
  drawCardHeader(doc, pageWidth, margin, startY, registro);
  const textEndY = drawCardTextBlock(doc, pageWidth, margin, startY, registro, profile, layout);

  // Fotos fluem. Nova página, label + 2-per-row.
  if (!layout.photos.length) {
    return { endY: startY + layout.total };
  }

  const maxY = pageHeight - BOTTOM_MARGIN;
  const innerX = margin + CARD_INNER_PAD_X;
  let photoY = textEndY + GAP_MD;

  // Se não cabe nem a label, vai pra próxima página.
  if (photoY + PHOTO_LABEL_H + PHOTO_H > maxY) {
    doc.addPage();
    fillPage(doc, pageWidth, pageHeight);
    redrawPageHeader();
    photoY = NEXT_PAGE_CONTENT_Y;
  }

  txt(doc, 'Fotos anexadas', innerX, photoY + 3, {
    size: 7,
    style: 'bold',
    color: C.text3,
  });
  photoY += PHOTO_LABEL_H;

  for (let r = 0; r < layout.photoRows; r += 1) {
    if (photoY + PHOTO_H > maxY) {
      doc.addPage();
      fillPage(doc, pageWidth, pageHeight);
      redrawPageHeader();
      photoY = NEXT_PAGE_CONTENT_Y;
    }
    await drawPhotoRow(doc, margin, pageWidth, photoY, layout.photos, r, layout.innerW);
    photoY += PHOTO_H;
    if (r < layout.photoRows - 1) photoY += PHOTO_ROW_GAP;
  }

  return { endY: photoY + CARD_INNER_PAD_BOTTOM };
}

// ---------- entry point ----------

export async function drawServices(
  doc,
  pageWidth,
  pageHeight,
  margin,
  filtered,
  equipamentos,
  profile,
  _drawFooter, // compatibilidade — rodapé é aplicado por stampFooterTotals
  context = {},
) {
  if (!filtered.length) return;

  // A chamada externa (pdf.js) já fez addPage antes de chamar drawServices,
  // então estamos em uma página nova. Pinta fundo + header + título.
  fillPage(doc, pageWidth, pageHeight);
  drawServicesPageHeader(doc, pageWidth, margin, profile, context);
  drawSectionTitle(doc, pageWidth, margin, filtered.length);

  const redrawPageHeader = () => drawServicesPageHeader(doc, pageWidth, margin, profile, context);

  const maxY = pageHeight - BOTTOM_MARGIN;
  let y = FIRST_PAGE_CONTENT_Y;

  for (let i = 0; i < filtered.length; i += 1) {
    const registro = filtered[i];
    const equipamento = equipamentos.find((item) => item.id === registro.equipId);
    const layout = computeCardLayout(doc, pageWidth, margin, registro, equipamento);

    const needsGap = i > 0;
    const requiredSpace = layout.total + (needsGap ? CARD_GAP : 0);
    const pageBudget = maxY - y;

    // Card não cabe no restante da página? Tenta começar em uma nova.
    if (requiredSpace > pageBudget && y > NEXT_PAGE_CONTENT_Y + 0.1) {
      doc.addPage();
      fillPage(doc, pageWidth, pageHeight);
      redrawPageHeader();
      y = NEXT_PAGE_CONTENT_Y;
    } else if (needsGap) {
      y += CARD_GAP;
    }

    const fullPageBudget = maxY - NEXT_PAGE_CONTENT_Y;

    if (layout.total > fullPageBudget) {
      // Oversize: divide texto+fotos entre páginas.
      const { endY } = await drawServiceCardPaginated(
        doc,
        pageWidth,
        pageHeight,
        margin,
        y,
        registro,
        profile,
        layout,
        redrawPageHeader,
      );
      y = endY;
    } else {
      await drawServiceCardAtomic(doc, pageWidth, margin, y, registro, profile, layout);
      y += layout.total;
    }
  }
}
