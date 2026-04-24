/**
 * CoolTrack Pro — Share Report PDF (WhatsApp + Web Share API)
 *
 * Duas estratégias:
 *
 *  1. Mobile moderno — `navigator.share` com files support:
 *     compartilha o PDF diretamente via Web Share API. O usuário escolhe
 *     WhatsApp, Gmail, Drive, Telegram, o que quiser. PDF vai anexado.
 *
 *  2. Desktop/fallback — sem files support:
 *     faz upload do PDF pro Supabase Storage (bucket `relatorios` por padrão),
 *     pega signed URL com TTL longo, abre `wa.me/?text=...` com link incluso.
 *
 * Cancelamento pelo usuário no Web Share (AbortError) NÃO é erro — retorna
 * `{ ok: false, cancelled: true }` pra o caller decidir o que mostrar.
 *
 * Falha de upload cai num 3º fallback: download local do PDF (sempre salva
 * o relatório, mesmo que offline).
 */

import { supabase } from '../../core/supabase.js';
import { AppError, ErrorCodes, handleError } from '../../core/errors.js';

const DEFAULT_REPORTS_BUCKET = import.meta.env?.VITE_SUPABASE_REPORTS_BUCKET || 'relatorios';

// TTL padrão do signed URL pra share. 7 dias é tempo suficiente pro cliente
// baixar o PDF depois de receber o link sem expirar; curto o bastante pra
// não virar link eterno em caixa de entrada.
const DEFAULT_SIGNED_URL_TTL = 7 * 24 * 60 * 60;

const DEFAULT_WHATSAPP_PREFIX = 'Olá! Segue o relatório da manutenção realizada.';
const DEFAULT_WHATSAPP_SUFFIX = 'Qualquer dúvida estou à disposição.';

/**
 * Verifica se o browser suporta compartilhar arquivos via Web Share API.
 * Precisa de:
 *   - navigator.share (método)
 *   - navigator.canShare (feature detection)
 *   - canShare({ files: [...] }) === true (suporte a arquivos, não só text)
 */
export function canSharePdfFile(pdfBlob, fileName = 'relatorio.pdf') {
  try {
    if (typeof navigator === 'undefined') return false;
    if (typeof navigator.share !== 'function') return false;
    if (typeof navigator.canShare !== 'function') return false;
    if (typeof File !== 'function') return false;
    if (!pdfBlob) return false;
    const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
    return Boolean(navigator.canShare({ files: [file] }));
  } catch {
    return false;
  }
}

/**
 * Chama `navigator.share({ files })`. Retorna:
 *   { ok: true, channel: 'web-share' }       — sucesso
 *   { ok: false, cancelled: true }           — user clicou X/voltou
 *   { ok: false, error: <AppError> }         — erro real
 */
export async function sharePdfFileNative({ pdfBlob, fileName, title, text }) {
  try {
    const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
    await navigator.share({
      files: [file],
      title: title || fileName,
      text: text || '',
    });
    return { ok: true, channel: 'web-share' };
  } catch (err) {
    // User cancelou o share sheet — NÃO é erro. Retorna quiet.
    if (err && err.name === 'AbortError') {
      return { ok: false, cancelled: true };
    }
    return {
      ok: false,
      error: new AppError(
        'Falha ao compartilhar o PDF via Web Share.',
        ErrorCodes.NETWORK_ERROR,
        'warning',
        { action: 'shareReport.sharePdfFileNative', detail: err?.message },
      ),
    };
  }
}

/**
 * Sanitiza um segmento pra uso em path do storage. Só alphanum + hífen.
 */
function safePathSegment(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

/**
 * Gera nome de arquivo seguro:
 *   relatorio-{registroId ou timestamp}.pdf
 */
export function buildSafeReportFileName({ registroId = null, fileName = null } = {}) {
  if (fileName && /\.pdf$/i.test(fileName)) {
    const safe = safePathSegment(fileName.replace(/\.pdf$/i, ''));
    if (safe) return `${safe}.pdf`;
  }
  const suffix = registroId ? safePathSegment(registroId) : String(Date.now());
  return `relatorio-${suffix || Date.now()}.pdf`;
}

/**
 * Faz upload do PDF pro Supabase Storage e devolve signed URL.
 *
 * Estrutura de paths:
 *   <userId>/<YYYY-MM>/relatorio-<registroId|timestamp>.pdf
 *
 * Mantém hierarquia por usuário pra o RLS do bucket funcionar (cada user
 * só vê/muta seus próprios PDFs); mês serve pra facilitar housekeeping.
 *
 * Retorna { url, path, bucket } em sucesso.
 */
export async function uploadReportPdf({
  pdfBlob,
  fileName,
  metadata = {},
  bucket = DEFAULT_REPORTS_BUCKET,
  ttlSeconds = DEFAULT_SIGNED_URL_TTL,
  supabaseClient = supabase,
} = {}) {
  if (!pdfBlob) {
    throw new AppError('Sem PDF pra enviar.', ErrorCodes.VALIDATION_ERROR, 'warning', {
      action: 'shareReport.uploadReportPdf',
    });
  }

  const { userId = 'anon', registroId = null } = metadata;
  const safeName = buildSafeReportFileName({ registroId, fileName });
  const yearMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const path = `${safePathSegment(userId) || 'anon'}/${yearMonth}/${safeName}`;

  const { error: uploadError } = await supabaseClient.storage.from(bucket).upload(path, pdfBlob, {
    upsert: true,
    contentType: 'application/pdf',
    cacheControl: '0', // relatórios não devem ficar cacheados num CDN
  });

  if (uploadError) {
    throw new AppError(
      'Não foi possível enviar o relatório para o armazenamento.',
      ErrorCodes.SYNC_FAILED,
      'warning',
      {
        action: 'shareReport.uploadReportPdf',
        bucket,
        path,
        detail: uploadError.message,
      },
    );
  }

  const { data: signed, error: signError } = await supabaseClient.storage
    .from(bucket)
    .createSignedUrl(path, ttlSeconds);

  if (signError || !signed?.signedUrl) {
    throw new AppError(
      'PDF enviado, mas não foi possível gerar o link de compartilhamento.',
      ErrorCodes.SYNC_FAILED,
      'warning',
      {
        action: 'shareReport.uploadReportPdf.sign',
        bucket,
        path,
        detail: signError?.message,
      },
    );
  }

  return { url: signed.signedUrl, path, bucket };
}

/**
 * Monta a mensagem padrão de WhatsApp com o link do PDF embedido.
 * Não envolve texto completo pré-existente — é uma mensagem curta.
 */
export function buildWhatsAppMessage({ pdfUrl, prefix, suffix } = {}) {
  const head = prefix || DEFAULT_WHATSAPP_PREFIX;
  const tail = suffix || DEFAULT_WHATSAPP_SUFFIX;
  return `${head}\n📄 Relatório completo:\n${pdfUrl}\n${tail}`;
}

/**
 * Abre WhatsApp (wa.me) com a mensagem + link. Preferimos wa.me ao
 * api.whatsapp.com/send porque funciona em desktop, mobile web e app
 * nativo sem redirects extras.
 */
export function openWhatsAppWithPdfLink({ pdfUrl, text } = {}) {
  if (!pdfUrl) return false;
  const message = text || buildWhatsAppMessage({ pdfUrl });
  const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
  if (typeof window === 'undefined' || typeof window.open !== 'function') {
    return false;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

/**
 * Baixa o PDF localmente (fallback quando o upload falha). Cria um <a>
 * temporário e dispara click — comportamento idêntico ao `doc.save()`
 * do jsPDF, mas a partir de um Blob já existente.
 */
export function downloadPdfLocally({ pdfBlob, fileName } = {}) {
  if (!pdfBlob || typeof document === 'undefined') return false;
  try {
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'relatorio.pdf';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
    return true;
  } catch {
    return false;
  }
}

/**
 * Orchestrator principal — usado pelo handler do controller.
 *
 * @param {{
 *   pdfBlob: Blob,
 *   fileName: string,
 *   whatsappText?: string,
 *   metadata?: { userId?: string, registroId?: string|null },
 *   supabaseClient?: object,
 * }} opts
 *
 * @returns {Promise<{
 *   ok: boolean,
 *   channel?: 'web-share' | 'wa-link' | 'download' | null,
 *   cancelled?: boolean,
 *   pdfUrl?: string,
 *   error?: Error,
 * }>}
 */
export async function shareReportPdf({
  pdfBlob,
  fileName,
  whatsappText,
  metadata = {},
  supabaseClient = supabase,
} = {}) {
  const safeName = buildSafeReportFileName({
    registroId: metadata.registroId,
    fileName,
  });

  // Rota 1: Web Share API com files (mobile moderno)
  if (canSharePdfFile(pdfBlob, safeName)) {
    const res = await sharePdfFileNative({
      pdfBlob,
      fileName: safeName,
      title: safeName,
      text: whatsappText || DEFAULT_WHATSAPP_PREFIX,
    });
    if (res.ok) return { ok: true, channel: 'web-share' };
    if (res.cancelled) return { ok: false, cancelled: true, channel: 'web-share' };
    // Erro não-cancel → cai pro fallback de link.
  }

  // Rota 2: upload + wa.me com link (desktop, iOS antigo, PWA sem share)
  try {
    const { url: pdfUrl } = await uploadReportPdf({
      pdfBlob,
      fileName: safeName,
      metadata,
      supabaseClient,
    });
    const message = buildWhatsAppMessage({ pdfUrl, prefix: whatsappText });
    const opened = openWhatsAppWithPdfLink({ pdfUrl, text: message });
    if (!opened) {
      return { ok: false, pdfUrl, channel: 'wa-link' };
    }
    return { ok: true, channel: 'wa-link', pdfUrl };
  } catch (error) {
    // Último recurso: baixar localmente pro técnico não perder o relatório.
    handleError(error, {
      code: ErrorCodes.SYNC_FAILED,
      severity: 'warning',
      message: 'Não foi possível compartilhar o PDF online. Tente baixar o relatório.',
      context: { action: 'shareReport.shareReportPdf.upload', fileName: safeName },
      showToast: false,
    });
    const downloaded = downloadPdfLocally({ pdfBlob, fileName: safeName });
    return {
      ok: downloaded,
      channel: downloaded ? 'download' : null,
      error,
    };
  }
}
