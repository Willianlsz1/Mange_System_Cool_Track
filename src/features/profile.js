/**
 * CoolTrack Pro - Profile v1.0
 * Extraído de onboarding.js — perfil do técnico (puro, sem UI de modal)
 * O modal de perfil permanece em ui/components/onboarding.js
 */

const PROFILE_KEY   = 'cooltrack-profile';
const LAST_TEC_KEY  = 'cooltrack-last-tecnico';

export const Profile = {
  get() {
    try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null'); }
    catch (_) { return null; }
  },

  save(data) {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(data));
  },

  getDefaultTecnico() {
    return this.get()?.nome || localStorage.getItem(LAST_TEC_KEY) || '';
  },

  saveLastTecnico(nome) {
    if (nome) localStorage.setItem(LAST_TEC_KEY, nome);
  },
};