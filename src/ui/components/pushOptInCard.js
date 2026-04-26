/**
 * PushOptInCard — card de opt-in pra notificações push.
 * ─────────────────────────────────────────────────────────────────
 * Renderizado dentro da view de Conta. Permite ao usuário ativar/
 * desativar notificações push (preventivas próximas do vencimento +
 * eventos como assinatura de orçamento).
 *
 * Estados visuais:
 *   - Permission default: mostra CTA "Ativar notificações"
 *   - Permission granted + subscription ativa: mostra toggle ON + texto
 *   - Permission denied: mostra mensagem explicando como reverter
 *   - Não suportado: card oculto (nada a oferecer)
 *
 * Persistência: a subscription vive no Supabase (push_subscriptions).
 * O state visual deriva do navigator.permissions + getSubscription().
 */

import { setupPushNotifications, teardownPushNotifications } from '../../core/pushNotifications.js';
import { Toast } from '../../core/toast.js';
import { trackEvent } from '../../core/telemetry.js';

const STATE = {
  UNSUPPORTED: 'unsupported',
  DEFAULT: 'default',
  GRANTED: 'granted',
  DENIED: 'denied',
};

function _isSupported() {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

async function _resolveState() {
  if (!_isSupported()) return STATE.UNSUPPORTED;
  return Notification.permission || STATE.DEFAULT;
}

async function _hasActiveSubscription() {
  if (!_isSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return Boolean(sub);
  } catch {
    return false;
  }
}

function _renderHtml({ state, hasSub }) {
  if (state === STATE.UNSUPPORTED) return ''; // não renderiza nada

  const heading = `
    <div class="push-card__head">
      <span class="push-card__icon" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
      </span>
      <div class="push-card__head-text">
        <h3 class="push-card__title">Notificações push</h3>
        <p class="push-card__sub">
          Avise sobre preventivas vencendo e clientes que assinaram orçamento.
        </p>
      </div>
    </div>`;

  if (state === STATE.DENIED) {
    return `
      <article class="push-card push-card--denied" role="region" aria-label="Notificações push">
        ${heading}
        <p class="push-card__hint">
          As notificações estão bloqueadas no navegador. Pra reverter, clique no
          ícone de cadeado da barra de endereços e permita "Notificações" pra
          este site.
        </p>
      </article>`;
  }

  if (state === STATE.GRANTED && hasSub) {
    return `
      <article class="push-card push-card--active" role="region" aria-label="Notificações push">
        ${heading}
        <div class="push-card__row">
          <span class="push-card__status">
            <span class="push-card__dot" aria-hidden="true"></span>
            Ativadas
          </span>
          <button type="button" class="btn btn--outline btn--sm" data-action="push-disable">
            Desativar
          </button>
        </div>
      </article>`;
  }

  // Default ou granted-sem-subscription: oferecer ativação
  return `
    <article class="push-card" role="region" aria-label="Notificações push">
      ${heading}
      <div class="push-card__row">
        <p class="push-card__hint">
          Recebe aviso no celular quando uma preventiva está perto de vencer ou
          um cliente assina um orçamento.
        </p>
        <button type="button" class="btn btn--primary btn--sm" data-action="push-enable">
          Ativar notificações
        </button>
      </div>
    </article>`;
}

let _currentUserId = null;

export const PushOptInCard = {
  init(userId) {
    _currentUserId = userId || null;
  },

  /**
   * Renderiza no host (elemento ou id). Idempotente — substitui card
   * existente. Async por causa do getSubscription().
   */
  async render(host) {
    const el = typeof host === 'string' ? document.getElementById(host) : host;
    if (!el) return false;

    const state = await _resolveState();
    if (state === STATE.UNSUPPORTED) {
      // Limpa qualquer card antigo (ex.: navegou pra outro device)
      const stale = el.querySelector('.push-card');
      if (stale) stale.remove();
      return false;
    }

    const hasSub = state === STATE.GRANTED ? await _hasActiveSubscription() : false;
    const stale = el.querySelector('.push-card');
    if (stale) stale.remove();
    el.insertAdjacentHTML('beforeend', _renderHtml({ state, hasSub }));
    return true;
  },

  async enable() {
    if (!_isSupported()) {
      Toast.warning('Seu navegador não suporta notificações push.');
      return false;
    }
    try {
      await setupPushNotifications(_currentUserId);
      const granted = (await _resolveState()) === STATE.GRANTED;
      if (granted) {
        Toast.success('Notificações ativadas.');
        trackEvent('push_optin_enabled', {});
      } else {
        Toast.info('Permissão negada. Você pode reverter nas configurações do navegador.');
        trackEvent('push_optin_denied', {});
      }
      return granted;
    } catch (err) {
      console.warn('[PushOptInCard] enable failed:', err);
      Toast.error('Não foi possível ativar as notificações.');
      return false;
    }
  },

  async disable() {
    try {
      await teardownPushNotifications(_currentUserId);
      Toast.info('Notificações desativadas.');
      trackEvent('push_optin_disabled', {});
      return true;
    } catch (err) {
      console.warn('[PushOptInCard] disable failed:', err);
      Toast.error('Não foi possível desativar as notificações.');
      return false;
    }
  },
};
