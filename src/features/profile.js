/**
 * CoolTrack Pro - Profile v1.1
 * Extraído de onboarding.js — perfil do técnico (puro, sem UI de modal)
 * O modal de perfil permanece em ui/components/onboarding.js
 *
 * Notas:
 * - `LAST_TEC_KEY` lê/escreve via userStorage (escopo por user_id), com
 *   fallback de leitura pro valor global legado (compat retroativa).
 * - `PROFILE_KEY` também passou a ser user-scoped (audit §1.2 / 2026-04-24):
 *   antes o profile global vazava entre contas no mesmo navegador quando o
 *   usuário trocava sem signOut. Agora o write vai só na chave escopada e o
 *   read tem fallback pro legado. O parse é defensivo — JSON corrompido
 *   remove a chave em vez de servir `null` silenciosamente.
 */

import { userStorage } from '../core/userStorage.js';

const PROFILE_KEY = 'cooltrack-profile';
const LAST_TEC_KEY = 'cooltrack-last-tecnico';

function safeParseJSON(raw) {
  if (raw == null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export const Profile = {
  get() {
    // Ordem de leitura: escopado → global legado. Primeira leitura após
    // uma migração pode cair no legado; o próximo save reescreve no escopado.
    const scoped = safeParseJSON(userStorage.get(PROFILE_KEY));
    if (scoped) return scoped;

    const legacyRaw = localStorage.getItem(PROFILE_KEY);
    if (legacyRaw == null) return null;

    const legacy = safeParseJSON(legacyRaw);
    if (legacy === null) {
      // JSON corrompido no legado — limpa pra não repetir o problema
      // (audit §2.5).
      try {
        localStorage.removeItem(PROFILE_KEY);
      } catch {
        /* storage indisponível — no-op */
      }
      return null;
    }
    return legacy;
  },

  save(data) {
    // Write-path: só na chave escopada por usuário. A global não é mais
    // escrita — signOut pode limpá-la e novos dados ficam no escopo certo.
    userStorage.set(PROFILE_KEY, JSON.stringify(data));
  },

  getDefaultTecnico() {
    // Read-path com fallback: primeiro perfil (já via userStorage), depois
    // chave escopada de last-tecnico, depois chave global legada (pós-
    // migração deve estar vazia).
    return (
      this.get()?.nome || userStorage.get(LAST_TEC_KEY) || localStorage.getItem(LAST_TEC_KEY) || ''
    );
  },

  saveLastTecnico(nome) {
    if (!nome) return;
    // Write-path: só na chave escopada. A global é mantida stale pra não
    // vazar pra próximas contas no mesmo navegador.
    userStorage.set(LAST_TEC_KEY, nome);
  },
};
