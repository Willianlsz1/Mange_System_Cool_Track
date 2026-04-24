/**
 * CoolTrack Pro — userData (LGPD art. 18 handlers)
 *
 * Wrappers client-side pras 2 edge functions:
 *   - POST /functions/v1/export-user-data → JSON dump do usuário (portabilidade)
 *   - POST /functions/v1/delete-user-account → remove tudo (eliminação)
 *
 * Segue o mesmo pattern de `startBillingPortal` em monetization.js:
 *   - refreshSession() → access_token fresco
 *   - fetch direto na edge function (evita token stale do SDK)
 *   - error handling padronizado com AppError
 *
 * Download do export: transforma a resposta em Blob e cria <a download>
 * programático — padrão navegador sem dependência externa.
 */

import { supabase } from '../core/supabase.js';
import { AppError, ErrorCodes, handleError } from '../core/errors.js';

const EXPORT_FN_PATH = '/functions/v1/export-user-data';
const DELETE_FN_PATH = '/functions/v1/delete-user-account';

/**
 * Pega um access_token fresco (tenta refresh via rede; fallback pro cache
 * local se ainda válido). Mesma lógica de monetization.js:startBillingPortal.
 *
 * @returns {Promise<string|null>}
 */
async function getFreshAccessToken() {
  let accessToken = null;

  try {
    const { data: refreshData } = await supabase.auth.refreshSession();
    accessToken = refreshData?.session?.access_token ?? null;
  } catch (_) {
    /* rede falhou — cai no fallback abaixo */
  }

  if (!accessToken) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token ?? null;
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const isValid = payload?.exp && payload.exp * 1000 > Date.now();
        if (isValid) accessToken = token;
      }
    } catch (_) {
      /* ignora */
    }
  }

  return accessToken;
}

function getSupabaseConfig() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_KEY;
  if (!url || !anonKey) {
    throw new AppError(
      'Configuração do Supabase ausente no cliente.',
      ErrorCodes.NETWORK_ERROR,
      'error',
      { action: 'userData.getSupabaseConfig' },
    );
  }
  return { url: url.replace(/\/$/, ''), anonKey };
}

/**
 * Baixa um Blob como arquivo no navegador. Usa URL.createObjectURL + <a>
 * com download attr. Revoga a URL após o click pra liberar memória.
 */
function triggerDownload(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // Libera memória depois de um tick pra dar tempo do browser iniciar download.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 100);
}

/**
 * Exporta todos os dados do usuário em JSON e dispara download.
 *
 * @returns {Promise<{ ok: boolean, filename?: string, message?: string }>}
 */
export async function exportUserData() {
  try {
    const accessToken = await getFreshAccessToken();
    if (!accessToken) {
      throw new AppError(
        'Faça login novamente para exportar seus dados.',
        ErrorCodes.AUTH_FAILED,
        'warning',
        { action: 'userData.exportUserData' },
      );
    }

    const { url, anonKey } = getSupabaseConfig();

    const response = await fetch(`${url}${EXPORT_FN_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      let errorBody = {};
      try {
        errorBody = await response.json();
      } catch (_) {
        /* sem body JSON — segue */
      }
      throw new AppError(
        errorBody?.message || `Falha ao exportar dados (HTTP ${response.status}).`,
        ErrorCodes.SYNC_FAILED,
        'warning',
        {
          action: 'userData.exportUserData',
          status: response.status,
          code: errorBody?.code,
        },
      );
    }

    // Extrai nome do arquivo do header Content-Disposition (fallback pra padrão)
    const disposition = response.headers.get('Content-Disposition') || '';
    const filenameMatch = /filename="([^"]+)"/.exec(disposition);
    const filename = filenameMatch?.[1] || `cooltrack-export-${Date.now()}.json`;

    const blob = await response.blob();
    triggerDownload(blob, filename);

    return { ok: true, filename };
  } catch (error) {
    handleError(error, {
      code: ErrorCodes.SYNC_FAILED,
      severity: 'warning',
      message: 'Não foi possível exportar seus dados. Tente novamente.',
      context: { action: 'userData.exportUserData' },
    });
    return {
      ok: false,
      message:
        error instanceof AppError
          ? error.message
          : 'Não foi possível exportar seus dados. Tente novamente.',
    };
  }
}

/**
 * Remove permanentemente a conta e todos os dados associados. Após sucesso,
 * faz signOut + reload pra forçar estado limpo.
 *
 * @returns {Promise<{ ok: boolean, message?: string }>}
 */
export async function deleteUserAccount() {
  try {
    const accessToken = await getFreshAccessToken();
    if (!accessToken) {
      throw new AppError(
        'Faça login novamente para excluir sua conta.',
        ErrorCodes.AUTH_FAILED,
        'warning',
        { action: 'userData.deleteUserAccount' },
      );
    }

    const { url, anonKey } = getSupabaseConfig();

    const response = await fetch(`${url}${DELETE_FN_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      let errorBody = {};
      try {
        errorBody = await response.json();
      } catch (_) {
        /* sem body JSON — segue */
      }
      throw new AppError(
        errorBody?.message || `Falha ao excluir conta (HTTP ${response.status}).`,
        ErrorCodes.SYNC_FAILED,
        'warning',
        {
          action: 'userData.deleteUserAccount',
          status: response.status,
          code: errorBody?.code,
          step: errorBody?.step,
        },
      );
    }

    // Server já deletou o auth.user — qualquer signOut agora é sanity local
    // (limpa localStorage, revoga refresh token que já não existe).
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (_) {
      /* session já inválida — segue */
    }

    return { ok: true };
  } catch (error) {
    handleError(error, {
      code: ErrorCodes.SYNC_FAILED,
      severity: 'warning',
      message: 'Não foi possível excluir sua conta. Tente novamente.',
      context: { action: 'userData.deleteUserAccount' },
    });
    return {
      ok: false,
      message:
        error instanceof AppError
          ? error.message
          : 'Não foi possível excluir sua conta. Tente novamente.',
    };
  }
}
