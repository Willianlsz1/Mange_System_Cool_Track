import { supabase } from './supabase.js';
import { Toast }    from './toast.js';

export const Auth = {

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

  onAuthChange(callback) {
    supabase.auth.onAuthStateChange((_event, session) => {
      callback(session?.user ?? null);
    });
  },
};