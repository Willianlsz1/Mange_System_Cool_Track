import { supabase } from './supabase.js';
import { Toast } from './toast.js';
import { AppError, ErrorCodes, handleError } from './errors.js';

function getPasswordResetRedirectUrl() {
  const envRedirect = import.meta.env?.VITE_AUTH_REDIRECT_URL;
  if (typeof envRedirect === 'string' && envRedirect.trim()) return envRedirect.trim();

  return new URL(window.location.pathname, window.location.origin).toString();
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

      // Cria o perfil junto
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
