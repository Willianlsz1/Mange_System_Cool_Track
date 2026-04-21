/**
 * PDF Quota Badge — mostra "X/Y PDFs este mês · restam Z" ao lado do botão
 * "Exportar PDF" na tela de relatório. Serve como "preview" da cota, pra o
 * usuário ver quantos PDFs ainda tem antes de clicar e ser surpreendido pelo
 * limite.
 *
 * Comportamento por plano:
 *  - Guest: não mostra (faz prompt de login ao clicar no botão)
 *  - Free:  "1/2 PDFs este mês" — tom warning quando >=80%, danger em 100%
 *  - Plus:  "12/30 PDFs este mês"
 *  - Pro:   esconde (ilimitado)
 *
 * O fetch é lazy — só dispara quando o usuário entra na view de relatório.
 * Falhas de rede são silenciosas (o badge simplesmente não aparece) pra não
 * bloquear o fluxo principal de gerar PDF.
 */

import { Auth } from '../../core/auth.js';
import { fetchMyProfileBilling } from '../../core/plans/monetization.js';
import {
  getEffectivePlan,
  PLAN_CODE_FREE,
  PLAN_CODE_PLUS,
  PLAN_CODE_PRO,
} from '../../core/plans/subscriptionPlans.js';
import {
  getMonthlyLimitForPlan,
  getMonthlyUsageSnapshot,
  USAGE_RESOURCE_PDF_EXPORT,
} from '../../core/usageLimits.js';

const BADGE_ID = 'pdf-quota-badge';

function buildLabel({ planCode, used, limit }) {
  const remaining = Math.max(0, limit - used);
  const planLabel = planCode === PLAN_CODE_PLUS ? 'Plus' : 'Free';
  if (remaining === 0) {
    return `Limite atingido: ${used}/${limit} PDFs (${planLabel})`;
  }
  return `${used}/${limit} PDFs este mês · restam ${remaining} (${planLabel})`;
}

function buildTone(used, limit) {
  if (!Number.isFinite(limit) || limit === 0) return '';
  const pct = used / limit;
  if (pct >= 1) return 'pdf-quota-badge--danger';
  if (pct >= 0.8) return 'pdf-quota-badge--warning';
  return '';
}

function getSlot() {
  // Preferência: slot fixo #pdf-quota-slot no toolbar do relatório. Permite que
  // o badge fique posicionado abaixo do botão (micro-hint) sem depender da
  // ordem dos nodes. Fallback: antes do botão "Exportar PDF" no mesmo parent,
  // pra compatibilidade com telas antigas ou outros pontos de entrada.
  const slot = document.getElementById('pdf-quota-slot');
  if (slot) return { mode: 'slot', el: slot };
  const exportBtn = document.querySelector('[data-action="export-pdf"]');
  if (exportBtn?.parentElement)
    return { mode: 'before', el: exportBtn.parentElement, ref: exportBtn };
  return null;
}

function removeBadge() {
  document.getElementById(BADGE_ID)?.remove();
}

function renderBadge({ planCode, used, limit }) {
  removeBadge();
  const target = getSlot();
  if (!target) return null;

  const badge = document.createElement('span');
  badge.id = BADGE_ID;
  badge.className = `pdf-quota-badge ${buildTone(used, limit)}`.trim();
  badge.setAttribute('role', 'status');
  badge.setAttribute('aria-live', 'polite');
  badge.textContent = buildLabel({ planCode, used, limit });

  if (target.mode === 'slot') {
    // Slot dedicado: limpa e insere dentro. O layout (coluna/linha) fica a
    // cargo do CSS do slot, não da lógica do badge.
    target.el.textContent = '';
    target.el.appendChild(badge);
  } else {
    // Fallback: insere antes do botão "Exportar PDF" no parent dele.
    target.el.insertBefore(badge, target.ref);
  }
  return badge;
}

async function fetchQuota() {
  const user = await Auth.getUser();
  if (!user) return null; // Guest: sem quota a mostrar

  const [{ profile }, usageSnapshot] = await Promise.all([
    fetchMyProfileBilling(),
    getMonthlyUsageSnapshot(user.id),
  ]);
  const planCode = getEffectivePlan(profile);

  // Pro = ilimitado → badge escondido.
  if (planCode === PLAN_CODE_PRO) return null;

  const limit = getMonthlyLimitForPlan(planCode, USAGE_RESOURCE_PDF_EXPORT);
  if (!Number.isFinite(limit)) return null;

  const used = usageSnapshot[USAGE_RESOURCE_PDF_EXPORT] || 0;
  return { planCode, used, limit };
}

export const PdfQuotaBadge = {
  /**
   * Atualiza o badge. Idempotente — pode ser chamado em cada entrada da view.
   * Em caso de erro (ex: offline), remove o badge e retorna silenciosamente.
   */
  async refresh() {
    try {
      const quota = await fetchQuota();
      if (!quota) {
        removeBadge();
        return null;
      }
      return renderBadge(quota);
    } catch {
      // Falha silenciosa: não bloqueia a view de relatório.
      removeBadge();
      return null;
    }
  },

  remove() {
    removeBadge();
  },

  // Exports internos para testes
  _internal: {
    buildLabel,
    buildTone,
    PLAN_CODE_FREE,
    PLAN_CODE_PLUS,
  },
};

export default PdfQuotaBadge;
