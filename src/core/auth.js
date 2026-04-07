import { supabase } from './supabase.js';
import { Toast }    from './toast.js';
import { AppError, ErrorCodes, handleError } from './errors.js';

export const Auth = {

  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
  },

  async getUser() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
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
        handleError(new AppError('Não foi possível criar sua conta.', ErrorCodes.AUTH_FAILED, 'warning', { action: 'signUp', detail: error.message }));
        return null;
      }

      // Cria o perfil junto
      if (data.user) {
        await supabase.from('profiles').insert({
          id:   data.user.id,
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
        handleError(new AppError('Email ou senha incorretos.', ErrorCodes.AUTH_FAILED, 'warning', { action: 'signIn', detail: error.message }));
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
    const normalized = String(email || '').trim().toLowerCase();
    if (!this.isValidEmail(normalized)) {
      return { ok: false, message: 'Digite um email válido para recuperar a senha.' };
    }

    const redirectTo = 'https://willianlsz1.github.io/Mange_System_Cool_Track/';
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalized, { redirectTo });
      if (error) {
        handleError(new AppError('Não foi possível enviar o email de recuperação.', ErrorCodes.NETWORK_ERROR, 'warning', { action: 'requestPasswordReset', detail: error.message }));
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

  async tryHandlePasswordRecovery() {
    const hash = window.location.hash || '';
    const isRecovery = /(?:^|[&#])type=recovery(?:&|$)/.test(hash);
    if (!isRecovery) return false;

    const newPassword = window.prompt('Digite sua nova senha (mínimo 6 caracteres):');
    if (!newPassword) return true;
    if (newPassword.length < 6) {
      Toast.error('Senha deve ter no mínimo 6 caracteres.');
      return true;
    }

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        handleError(new AppError('Não foi possível redefinir a senha. Tente novamente pelo link do email.', ErrorCodes.AUTH_FAILED, 'warning', { action: 'tryHandlePasswordRecovery', detail: error.message }));
        return true;
      }

      Toast.success('Senha atualizada com sucesso. Faça login com a nova senha.');
      history.replaceState(history.state, '', window.location.pathname + window.location.search);
      return true;
    } catch (error) {
      handleError(error, {
        code: ErrorCodes.AUTH_FAILED,
        message: 'Erro ao atualizar senha. Tente novamente.',
        context: { action: 'tryHandlePasswordRecovery' },
      });
      return true;
    }
  },

  onAuthChange(callback) {
    return supabase.auth.onAuthStateChange((_event, session) => {
      callback(session?.user ?? null);
    });
  },
};
