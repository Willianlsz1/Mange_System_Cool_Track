import { supabase } from './supabase.js';
import { Toast } from './toast.js';
import { AppError, ErrorCodes, handleError } from './errors.js';
import { trackEvent } from './telemetry.js';

const OAUTH_PENDING_KEY = 'cooltrack-oauth-pending-v1';

function getPasswordResetRedirectUrl() {
  const envRedirect = import.meta.env?.VITE_AUTH_REDIRECT_URL;
  if (typeof envRedirect === 'string' && envRedirect.trim()) return envRedirect.trim();

  return new URL(window.location.pathname, window.location.origin).toString();
}

function getOAuthRedirectUrl() {
  const envRedirect = import.meta.env?.VITE_AUTH_REDIRECT_URL;
  if (typeof envRedirect === 'string' && envRedirect.trim()) return envRedirect.trim();

  return new URL(
    window.location.pathname + window.location.search,
    window.location.origin,
  ).toString();
}

function hasOAuthParams(url) {
  const params = url.searchParams;
  return (
    params.has('code') ||
    params.has('state') ||
    params.has('error') ||
    params.has('error_description') ||
    params.has('provider_token') ||
    params.has('provider_refresh_token')
  );
}

function cleanOAuthUrl() {
  const url = new URL(window.location.href);
  if (!hasOAuthParams(url)) return;

  [
    'code',
    'state',
    'error',
    'error_description',
    'provider_token',
    'provider_refresh_token',
  ].forEach((key) => url.searchParams.delete(key));

  const query = url.searchParams.toString();
  const nextUrl = `${url.pathname}${query ? `?${query}` : ''}${url.hash || ''}`;
  history.replaceState(history.state, '', nextUrl);
}

function persistOAuthPending(payload = {}) {
  const safePayload = {
    provider: 'google',
    source: payload.source || 'unknown',
    wasGuest: payload.wasGuest === true,
    startedAt: new Date().toISOString(),
  };
  localStorage.setItem(OAUTH_PENDING_KEY, JSON.stringify(safePayload));
}

function consumeOAuthPending() {
  const raw = localStorage.getItem(OAUTH_PENDING_KEY);
  if (!raw) return null;
  localStorage.removeItem(OAUTH_PENDING_KEY);
  try {
    return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
}

export const Auth = {
  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
  },

  async getUser() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return user;
    } catch (error) {
      handleError(error, {
        code: ErrorCodes.AUTH_FAILED,
        message: 'Não foi possível validar sua sessão.',
        context: { action: 'getUser' },
      });
      return null;
    }
  },

  async signUp(email, password, nome) {
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        handleError(
          new AppError('Não foi possível criar sua conta.', ErrorCodes.AUTH_FAILED, 'warning', {
            action: 'signUp',
            detail: error.message,
          }),
        );
        return null;
      }

      if (data.user) {
        await supabase.from('profiles').insert({
          id: data.user.id,
          nome,
        });
      }
      return data.user;
    } catch (error) {
      handleError(error, {
        code: ErrorCodes.AUTH_FAILED,
        message: 'Falha ao cadastrar usuário. Tente novamente.',
        context: { action: 'signUp' },
      });
      return null;
    }
  },

  async signIn(email, password) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        handleError(
          new AppError('Email ou senha incorretos.', ErrorCodes.AUTH_FAILED, 'warning', {
            action: 'signIn',
            detail: error.message,
          }),
        );
        return null;
      }
      return data.user;
    } catch (error) {
      handleError(error, {
        code: ErrorCodes.AUTH_FAILED,
        message: 'Falha ao realizar login. Tente novamente.',
        context: { action: 'signIn' },
      });
      return null;
    }
  },

  async signInWithGoogle({ source = 'auth-screen', wasGuest = false } = {}) {
    try {
      persistOAuthPending({ source, wasGuest });
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: getOAuthRedirectUrl(),
        },
      });

      if (error) {
        localStorage.removeItem(OAUTH_PENDING_KEY);
        handleError(
          new AppError(
            'Não foi possível iniciar o login com Google.',
            ErrorCodes.AUTH_FAILED,
            'warning',
            {
              action: 'signInWithGoogle',
              detail: error.message,
            },
          ),
        );
        return { ok: false, message: 'Não foi possível iniciar o login com Google.' };
      }

      return { ok: true };
    } catch (error) {
      localStorage.removeItem(OAUTH_PENDING_KEY);
      handleError(error, {
        code: ErrorCodes.AUTH_FAILED,
        message: 'Falha ao abrir login com Google. Tente novamente.',
        context: { action: 'signInWithGoogle' },
      });
      return { ok: false, message: 'Falha ao abrir login com Google. Tente novamente.' };
    }
  },

  finalizeOAuthRedirect(user) {
    const url = new URL(window.location.href);
    const oauthError = url.searchParams.get('error');
    const oauthErrorDescription = url.searchParams.get('error_description');
    const pending = consumeOAuthPending();
    const hasOAuthContext = Boolean(oauthError || pending || hasOAuthParams(url));

    if (!hasOAuthContext) return;

    if (oauthError) {
      trackEvent('auth_google_failed', {
        source: pending?.source || 'unknown',
        reason: oauthError,
      });
      Toast.error(
        oauthErrorDescription
          ? `Falha no login com Google: ${oauthErrorDescription}`
          : 'Falha no login com Google. Tente novamente.',
      );
      cleanOAuthUrl();
      return;
    }

    if (user && pending?.provider === 'google') {
      trackEvent('google_login_success', {
        source: pending.source,
        wasGuest: pending.wasGuest,
      });
      trackEvent('auth_google_completed', {
        source: pending.source,
        wasGuest: pending.wasGuest,
      });
      Toast.success('Seus dados foram salvos com segurança');
      if (pending.wasGuest) {
        trackEvent('guest_conversion_success', {
          method: 'google',
          source: pending.source,
        });
        Toast.success('Agora você pode acessar seus registros de qualquer lugar');
        trackEvent('guest_converted_to_account', {
          method: 'google',
          source: pending.source,
        });
      }
    }

    cleanOAuthUrl();
  },

  async signOut() {
    try {
      await supabase.auth.signOut();
      window.location.reload();
    } catch (error) {
      handleError(error, {
        code: ErrorCodes.AUTH_FAILED,
        message: 'Não foi possível encerrar sua sessão.',
        context: { action: 'signOut' },
      });
    }
  },

  async requestPasswordReset(email) {
    const normalized = String(email || '')
      .trim()
      .toLowerCase();
    if (!this.isValidEmail(normalized)) {
      return { ok: false, message: 'Digite um email válido para recuperar a senha.' };
    }

    const redirectTo = getPasswordResetRedirectUrl();
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalized, { redirectTo });
      if (error) {
        handleError(
          new AppError(
            'Não foi possível enviar o email de recuperação.',
            ErrorCodes.NETWORK_ERROR,
            'warning',
            { action: 'requestPasswordReset', detail: error.message },
          ),
        );
        return { ok: false, message: 'Não foi possível enviar o email de recuperação.' };
      }
      return { ok: true };
    } catch (error) {
      handleError(error, {
        code: ErrorCodes.NETWORK_ERROR,
        message: 'Falha de conexão ao solicitar recuperação de senha.',
        context: { action: 'requestPasswordReset' },
      });
      return { ok: false, message: 'Falha de conexão ao solicitar recuperação de senha.' };
    }
  },

  isPasswordRecoveryLink() {
    const hash = window.location.hash || '';
    return /(?:^|[&#])type=recovery(?:&|$)/.test(hash);
  },

  async updatePassword(newPassword) {
    if (!newPassword) return { ok: false, cancelled: true };
    if (newPassword.length < 6) {
      return { ok: false, message: 'Senha deve ter no mínimo 6 caracteres.' };
    }

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        handleError(
          new AppError(
            'Não foi possível redefinir a senha. Tente novamente pelo link do email.',
            ErrorCodes.AUTH_FAILED,
            'warning',
            { action: 'updatePassword', detail: error.message },
          ),
        );
        return {
          ok: false,
          message: 'Não foi possível redefinir a senha. Tente novamente pelo link do email.',
        };
      }

      history.replaceState(history.state, '', window.location.pathname + window.location.search);
      return { ok: true };
    } catch (error) {
      handleError(error, {
        code: ErrorCodes.AUTH_FAILED,
        message: 'Erro ao atualizar senha. Tente novamente.',
        context: { action: 'updatePassword' },
      });
      return { ok: false, message: 'Erro ao atualizar senha. Tente novamente.' };
    }
  },

  async tryHandlePasswordRecovery(getNewPassword) {
    if (!this.isPasswordRecoveryLink()) return false;
    if (!(getNewPassword instanceof Function)) return true;

    const newPassword = await getNewPassword();
    const result = await this.updatePassword(newPassword);

    if (result.cancelled) return true;
    if (!result.ok && result.message) Toast.error(result.message);
    if (result.ok) Toast.success('Senha atualizada com sucesso. Faça login com a nova senha.');

    return true;
  },

  onAuthChange(callback) {
    return supabase.auth.onAuthStateChange((_event, session) => {
      callback(session?.user ?? null);
    });
  },
};
