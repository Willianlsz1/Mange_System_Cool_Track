// Account Modal — implementação fiel ao V2Refined (Claude Design final).
// Hero card do plano com badge + nome grande + tagline + chips + bar/CTA,
// seguido de identity row e ações. Paleta e layout replicam o mockup
// aprovado; valores dinâmicos (count equipamentos, renova, nome, email)
// vêm do state + profile + user real.

import { Profile } from '../../features/profile.js';
import {
  getEffectivePlan,
  PLAN_CATALOG,
  PLAN_CODE_FREE,
  PLAN_CODE_PRO,
} from '../../core/subscriptionPlans.js';
import { goTo } from '../../core/router.js';
import { getState } from '../../core/state.js';

const ACCOUNT_MODAL_ID = 'account-modal-overlay';

// Preço do Plus hardcoded aqui — a fonte da verdade é pricing.js.
// Se mudar lá, lembrar de atualizar esta string. Copy vem do mockup.
const PLUS_MONTHLY_PRICE_LABEL = 'R$ 29/mês';

function getInitials(name) {
  return String(name || 'T')
    .split(' ')
    .map((part) => part[0] || '')
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// Ícones stroke consistentes com o design (Inter 1.6 / 1.8 weight).
const ICON_SPARK = `
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 3v3M12 18v3M5 12H2M22 12h-3M5.6 5.6l2 2M16.4 16.4l2 2M5.6 18.4l2-2M16.4 7.6l2-2"/>
  </svg>`;
const ICON_CROWN = `
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M3 7l4 4 5-7 5 7 4-4-2 12H5L3 7z"/>
  </svg>`;
const ICON_CHECK = `
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M4 12l5 5L20 6"/>
  </svg>`;
const ICON_BOLT = `
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>
  </svg>`;
const ICON_USER = `
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="8" r="4"/>
    <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>
  </svg>`;
const ICON_CARD = `
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="3" y="6" width="18" height="13" rx="2"/>
    <path d="M3 10h18M7 15h3"/>
  </svg>`;
const ICON_LOGOUT = `
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/>
    <path d="M10 17l-5-5 5-5M5 12h11"/>
  </svg>`;
const ICON_ARROW = `
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6"/>
  </svg>`;

// Ícone do badge do plano no header do hero.
function getPlanBadgeIconHtml(planCode) {
  if (planCode === PLAN_CODE_PRO) return ICON_CROWN;
  if (planCode === PLAN_CODE_FREE) return ICON_SPARK;
  // Plus: bolinha pulsante (sem SVG).
  return '<span class="account-modal__plan-pulse"></span>';
}

function getPlanBadgeLabel(planCode, planLabel) {
  if (planCode === PLAN_CODE_FREE) return 'PLANO ATUAL';
  return `${planLabel.toUpperCase()} · ATIVO`;
}

// Chips do plano. 'filled' = check preenchido no accent do plano (Plus/Pro).
// 'stroke' = outline ciano, aspiracional — usado no Free pra mostrar o que
// vem no upgrade sem dar a impressão de "já tenho isso".
function renderChips(chips, variant) {
  if (!Array.isArray(chips) || chips.length === 0) return '';
  const modifier =
    variant === 'stroke' ? 'account-modal__chip--stroke' : 'account-modal__chip--filled';
  return chips
    .map(
      (chip) => `
      <span class="account-modal__chip ${modifier}">
        <span class="account-modal__chip-icon">${ICON_CHECK}</span>
        ${chip}
      </span>`,
    )
    .join('');
}

// "12/MAI" a partir de ISO date. Retorna '' se inválido.
function formatRenewalShort(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  const months = [
    'JAN',
    'FEV',
    'MAR',
    'ABR',
    'MAI',
    'JUN',
    'JUL',
    'AGO',
    'SET',
    'OUT',
    'NOV',
    'DEZ',
  ];
  return `${d.getDate()}/${months[d.getMonth()]}`;
}

function getEquipmentCount() {
  try {
    const state = getState();
    return Array.isArray(state?.equipamentos) ? state.equipamentos.length : 0;
  } catch (_e) {
    return 0;
  }
}

// Renderiza a seção inferior do hero: CTA primário no Free, bar de uso
// no Plus/Pro. Plus mostra "count / 25", Pro mostra "count · ilimitado".
function renderHeroFooter(planCode, planData) {
  if (planCode === PLAN_CODE_FREE) {
    return `
      <button type="button" class="account-modal__hero-cta" id="btn-upgrade-plan">
        <span class="account-modal__hero-cta-icon">${ICON_BOLT}</span>
        <span>Fazer upgrade para Plus — ${PLUS_MONTHLY_PRICE_LABEL}</span>
      </button>`;
  }

  const count = getEquipmentCount();
  const limit = planData.limits.equipamentos;
  const isUnlimited = !Number.isFinite(limit);
  const valueLabel = isUnlimited ? `${count} · ilimitado` : `${count} / ${limit}`;
  // No Pro o fill é decorativo (shimmer), então width 100%. No Plus é real.
  const percent = isUnlimited ? 100 : Math.min(100, Math.max(4, Math.round((count / limit) * 100)));

  return `
    <div class="account-modal__usage">
      <div class="account-modal__usage-row">
        <span class="account-modal__usage-label">Equipamentos cadastrados</span>
        <span class="account-modal__usage-value">${valueLabel}</span>
      </div>
      <div class="account-modal__usage-bar">
        <div class="account-modal__usage-fill" style="width:${percent}%"></div>
      </div>
    </div>`;
}

export function closeAccountModal() {
  document.getElementById(ACCOUNT_MODAL_ID)?.remove();
}

export function openAccountModal(user, { onEditProfile, onSignOut } = {}) {
  closeAccountModal();

  const profile = Profile.get() || {};
  const name = profile.nome || 'Técnico';
  const email = user?.email || '';
  const initials = getInitials(name);

  const planCode = getEffectivePlan(profile);
  const planData = PLAN_CATALOG[planCode] || PLAN_CATALOG[PLAN_CODE_FREE];
  const isFree = planCode === PLAN_CODE_FREE;
  const chipsVariant = isFree ? 'stroke' : 'filled';

  const tierModifier = `account-modal--${planCode}`;
  const renewDate = !isFree ? formatRenewalShort(profile.subscription_current_period_end) : '';
  const manageLabel = isFree ? 'Ver planos' : 'Gerenciar assinatura';

  const overlay = document.createElement('div');
  overlay.id = ACCOUNT_MODAL_ID;
  overlay.className = 'modal-overlay is-open account-modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'Menu da conta');

  overlay.innerHTML = `
    <div class="modal account-modal ${tierModifier}" role="menu">
      <span class="account-modal__caret" aria-hidden="true"></span>

      <section class="account-modal__hero">
        <span class="account-modal__hero-orb account-modal__hero-orb--a" aria-hidden="true"></span>
        ${planCode === PLAN_CODE_PRO ? '<span class="account-modal__hero-orb account-modal__hero-orb--b" aria-hidden="true"></span>' : ''}

        <div class="account-modal__hero-top">
          <span class="account-modal__plan-badge">
            <span class="account-modal__plan-badge-icon">${getPlanBadgeIconHtml(planCode)}</span>
            ${getPlanBadgeLabel(planCode, planData.label)}
          </span>
          ${renewDate ? `<span class="account-modal__renew">Renova ${renewDate}</span>` : ''}
        </div>

        <div class="account-modal__plan-name">
          <span class="account-modal__plan-brand">CoolTrack</span>
          <span class="account-modal__plan-tier">${planData.label}</span>
        </div>

        <p class="account-modal__plan-tagline">${planData.accountTagline || ''}</p>

        <div class="account-modal__chips">
          ${renderChips(planData.accountChips, chipsVariant)}
        </div>

        ${renderHeroFooter(planCode, planData)}
      </section>

      <div class="account-modal__identity-row">
        <div class="account-modal__avatar"></div>
        <div class="account-modal__identity">
          <div class="account-modal__name"></div>
          <div class="account-modal__email"></div>
        </div>
      </div>

      <nav class="account-modal__actions">
        <button type="button" class="account-modal__action account-modal__action--neutral" id="btn-edit-profile">
          <span class="account-modal__action-icon">${ICON_USER}</span>
          <span class="account-modal__action-label">Editar perfil</span>
          <span class="account-modal__action-chev">${ICON_ARROW}</span>
        </button>
        <button type="button" class="account-modal__action account-modal__action--neutral" id="btn-manage-plan">
          <span class="account-modal__action-icon">${ICON_CARD}</span>
          <span class="account-modal__action-label">${manageLabel}</span>
          <span class="account-modal__action-chev">${ICON_ARROW}</span>
        </button>
        <div class="account-modal__action-separator" aria-hidden="true"></div>
        <button type="button" class="account-modal__action account-modal__action--danger" id="btn-signout">
          <span class="account-modal__action-icon">${ICON_LOGOUT}</span>
          <span class="account-modal__action-label">Sair da conta</span>
        </button>
      </nav>
    </div>
  `;

  // Preenche conteúdo dinâmico (textContent evita XSS em name/email vindos do user)
  const avatarEl = overlay.querySelector('.account-modal__avatar');
  const nameEl = overlay.querySelector('.account-modal__name');
  const emailEl = overlay.querySelector('.account-modal__email');
  if (avatarEl) avatarEl.textContent = initials;
  if (nameEl) nameEl.textContent = name;
  if (emailEl) emailEl.textContent = email;

  // Fechar ao clicar fora
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeAccountModal();
  });

  // Fechar com Escape
  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      closeAccountModal();
      document.removeEventListener('keydown', onKeyDown);
    }
  };
  document.addEventListener('keydown', onKeyDown);

  overlay.querySelector('#btn-edit-profile')?.addEventListener('click', () => {
    closeAccountModal();
    onEditProfile?.();
  });

  overlay.querySelector('#btn-upgrade-plan')?.addEventListener('click', () => {
    closeAccountModal();
    goTo('pricing');
  });

  overlay.querySelector('#btn-manage-plan')?.addEventListener('click', () => {
    closeAccountModal();
    goTo('pricing');
  });

  overlay.querySelector('#btn-signout')?.addEventListener('click', () => {
    closeAccountModal();
    onSignOut?.();
  });

  document.body.appendChild(overlay);
}
