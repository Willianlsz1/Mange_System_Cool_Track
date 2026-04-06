import { supabase } from './supabase.js';
import { Toast }    from './toast.js';

export const Auth = {

  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
  },

  async getUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  },

  async signUp(email, password, nome) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) { Toast.error(error.message); return null; }

    // Cria o perfil junto
    if (data.user) {
      await supabase.from('profiles').insert({
        id:   data.user.id,
        nome,
      });
    }
    return data.user;
  },

  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { Toast.error('Email ou senha incorretos.'); return null; }
    return data.user;
  },

  async signOut() {
    await supabase.auth.signOut();
    window.location.reload();
  },

  async requestPasswordReset(email) {
    const normalized = String(email || '').trim().toLowerCase();
    if (!this.isValidEmail(normalized)) {
      return { ok: false, message: 'Digite um email válido para recuperar a senha.' };
    }

    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { error } = await supabase.auth.resetPasswordForEmail(normalized, { redirectTo });
    if (error) {
      return { ok: false, message: error.message || 'Erro ao enviar email de recuperação.' };
    }
    return { ok: true };
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

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      Toast.error('Não foi possível redefinir a senha. Tente novamente pelo link do email.');
      return true;
    }

    Toast.success('Senha atualizada com sucesso. Faça login com a nova senha.');
    history.replaceState(history.state, '', window.location.pathname + window.location.search);
    return true;
  },

  onAuthChange(callback) {
    supabase.auth.onAuthStateChange((_event, session) => {
      callback(session?.user ?? null);
    });
  },
};
