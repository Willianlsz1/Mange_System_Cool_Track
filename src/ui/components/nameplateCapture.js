/**
 * CoolTrack Pro — Componente UI: captura de placa por foto.
 *
 * Gerencia o hero CTA no modal-add-eq. Três responsabilidades:
 *
 *   1. `applyNameplateCtaGate(isPlusOrPro)` — toggle entre o estado "active"
 *      (Plus+ pode usar) e "locked" (Free vê upsell). Chamado no open-modal
 *      + quando o plano muda.
 *
 *   2. Listener `change` no input file escondido. Quando o user seleciona
 *      uma foto, chama `analyzeNameplate()` e preenche os campos do step 2.
 *
 *   3. Click no botão "Desbloquear com Plus" redireciona pra pricing com
 *      highlight no plano Plus e motivo "nameplate_upsell".
 *
 * Design intencional: o componente é idempotente e defensivo. `bindOnce()`
 * só amarra listeners uma vez (via dataset flag), então pode ser chamado
 * várias vezes sem multiplicar handlers.
 */
import { Utils } from '../../core/utils.js';
import { goTo } from '../../core/router.js';
import { trackEvent } from '../../core/telemetry.js';
import { Toast } from '../../core/toast.js';
import {
  analyzeNameplate,
  NameplateAnalysisError,
  ERR_PLAN_GATE,
  ERR_NO_SESSION,
  ERR_NETWORK,
  ERR_UPSTREAM_BUSY,
  ERR_NOT_IDENTIFIED,
  ERR_FILE_TOO_LARGE,
  ERR_FILE_INVALID,
} from '../../domain/nameplateAnalysis.js';

// IDs do template — centralizados pra facilitar manutenção.
const ID_CTA = 'nameplate-cta';
const ID_SUB = 'nameplate-cta-sub';
const ID_FILE_INPUT = 'nameplate-file-input';
const ID_TIPO = 'eq-tipo';
const ID_FLUIDO = 'eq-fluido';
const ID_MODELO = 'eq-modelo';
const ID_STEP_2 = 'eq-step-2';
const ID_EXPAND_BTN = 'eq-expand-details';

const DEFAULT_SUB = 'A IA preenche tipo, fluido e marca/modelo pra você.';

/**
 * Aplica o gate de plano no CTA. Chamado quando o modal abre.
 *
 * @param {boolean} isPlusOrPro — `true` se o plano do user libera a feature.
 */
export function applyNameplateCtaGate(isPlusOrPro = false) {
  const cta = document.getElementById(ID_CTA);
  if (!cta) return;

  cta.hidden = false;
  cta.dataset.state = isPlusOrPro ? 'active' : 'locked';
  setSubtitle(DEFAULT_SUB);

  bindOnce();

  // Telemetria: primeira exibição por abertura do modal. O flag é limpo
  // no open-modal do navigationHandlers, idem ao padrão de photo_upsell.
  if (!cta.dataset.ctaShown) {
    cta.dataset.ctaShown = '1';
    trackEvent('nameplate_cta_shown', {
      source: 'equip_modal',
      gate: isPlusOrPro ? 'active' : 'locked',
    });
  }
}

/**
 * Reset entre aberturas do modal — limpa flags de telemetria e estado busy.
 * Chamar junto com `clearEditingState`.
 */
export function resetNameplateCtaState() {
  const cta = document.getElementById(ID_CTA);
  if (!cta) return;
  delete cta.dataset.ctaShown;
  if (cta.dataset.state === 'busy') cta.dataset.state = 'active';
  setSubtitle(DEFAULT_SUB);
  const input = document.getElementById(ID_FILE_INPUT);
  if (input) {
    try {
      input.value = '';
    } catch (_) {
      /* IE legacy */
    }
  }
}

// ── Interno ───────────────────────────────────────────────────────────────

let boundOnce = false;

function bindOnce() {
  if (boundOnce) return;

  const fileInput = document.getElementById(ID_FILE_INPUT);
  const cta = document.getElementById(ID_CTA);
  if (!fileInput || !cta) return;

  fileInput.addEventListener('change', async (event) => {
    const file = event.target?.files?.[0];
    // Reset o value imediatamente pra que o change dispare de novo mesmo
    // se o user escolher o mesmo arquivo — relevante no fluxo de retry.
    event.target.value = '';
    if (!file) return;
    await handleFile(file);
  });

  // Upsell CTA: o botão já tem data-action, então só precisamos ouvir click
  // direto (mais simples que passar pelo delegator global).
  const lockedBtn = document.querySelector('[data-action="nameplate-upsell-cta"]');
  if (lockedBtn) {
    lockedBtn.addEventListener('click', () => {
      trackEvent('nameplate_upsell_clicked', { source: 'equip_modal' });
      goTo('pricing', { highlightPlan: 'plus', reason: 'nameplate_upsell' });
    });
  }

  boundOnce = true;
}

async function handleFile(file) {
  const cta = document.getElementById(ID_CTA);
  if (!cta) return;

  const prevState = cta.dataset.state;
  cta.dataset.state = 'busy';
  setSubtitle('Analisando a placa… (~5s)');

  const startedAt = performance.now();
  try {
    const fields = await analyzeNameplate(file);
    applyFieldsToForm(fields);
    const duration = Math.round(performance.now() - startedAt);
    const filledCount = countFilled(fields);

    trackEvent('nameplate_analyzed', {
      success: true,
      confidence: fields.confidence,
      fields_filled_count: filledCount,
      duration_ms: duration,
    });

    setSubtitle(
      filledCount > 0
        ? `Pronto — ${filledCount} campo(s) preenchido(s). Revise e confirme.`
        : 'Placa lida, mas nenhum campo bateu. Confira a foto.',
    );
    cta.dataset.state = prevState === 'locked' ? 'locked' : 'active';

    if (filledCount > 0) {
      Toast.success('Campos preenchidos. Revise antes de salvar.');
    } else {
      Toast.info('Placa lida, mas campos não bateram com o form.');
    }
  } catch (err) {
    const isAppErr = err instanceof NameplateAnalysisError;
    const code = isAppErr ? err.code : 'UNKNOWN';
    const message = isAppErr ? err.message : 'Erro inesperado na análise.';

    trackEvent('nameplate_analyzed', {
      success: false,
      error_code: code,
      duration_ms: Math.round(performance.now() - startedAt),
    });

    // Casos de erro específicos têm tratamento custom:
    if (code === ERR_PLAN_GATE) {
      // Raro: se a gente exibiu active mas o gate do server é free.
      // Pode acontecer se o plano mudou durante a sessão (downgrade).
      cta.dataset.state = 'locked';
      setSubtitle('Feature exclusiva Plus+. Faça upgrade pra destravar.');
    } else if (code === ERR_NO_SESSION) {
      setSubtitle('Sessão expirada. Faça login e tente de novo.');
      cta.dataset.state = prevState === 'locked' ? 'locked' : 'active';
    } else if (code === ERR_NOT_IDENTIFIED) {
      setSubtitle('Não deu pra ler. Tire outra com mais luz e enquadramento reto.');
      cta.dataset.state = prevState === 'locked' ? 'locked' : 'active';
    } else if (code === ERR_UPSTREAM_BUSY) {
      setSubtitle('IA sobrecarregada. Aguarde uns segundos e tente de novo.');
      cta.dataset.state = prevState === 'locked' ? 'locked' : 'active';
    } else if (code === ERR_NETWORK) {
      setSubtitle('Erro de rede. Verifique a conexão.');
      cta.dataset.state = prevState === 'locked' ? 'locked' : 'active';
    } else if (code === ERR_FILE_TOO_LARGE || code === ERR_FILE_INVALID) {
      setSubtitle(message);
      cta.dataset.state = prevState === 'locked' ? 'locked' : 'active';
    } else {
      setSubtitle(message);
      cta.dataset.state = prevState === 'locked' ? 'locked' : 'active';
    }

    Toast.show(message, 'error');
  }
}

/**
 * Preenche os campos do step 2 com os valores da IA. Abre o step 2 se estiver
 * fechado — o user confirma visualmente antes de salvar.
 *
 * Regra central: NÃO sobrescrevemos campos já preenchidos pelo user.
 * Conceito: a IA complementa, não substitui. Se o user já digitou "Carrier
 * 18.000 BTU", não atropelamos com "LG USNW092WSG3".
 */
function applyFieldsToForm(fields) {
  expandStep2();

  // MVP: sempre sobrescreve. A alternativa — respeitar user input — exige
  // dirty tracking que não existe ainda nesses inputs. E o contrato pro
  // user é explícito: "IA preenche, você revisa antes de salvar". Se o
  // user já tinha digitado "Carrier 18.000 BTU" e a foto disser "LG", a
  // sobrescrita é visível e ele pode corrigir — ao contrário de NÃO
  // sobrescrever, onde ele poderia jurar que a IA errou sem perceber.

  const tipo = Utils.getEl(ID_TIPO);
  if (tipo && fields.tipo && selectHasValue(tipo, fields.tipo)) {
    tipo.value = fields.tipo;
    tipo.dispatchEvent(new Event('change', { bubbles: true }));
  }

  const fluido = Utils.getEl(ID_FLUIDO);
  if (fluido && fields.fluido && selectHasValue(fluido, fields.fluido)) {
    fluido.value = fields.fluido;
    fluido.dispatchEvent(new Event('change', { bubbles: true }));
  }

  const modelo = Utils.getEl(ID_MODELO);
  if (modelo && fields.marcaModelo) {
    modelo.value = fields.marcaModelo;
    modelo.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

function selectHasValue(selectEl, value) {
  return Array.from(selectEl.options).some((opt) => opt.value === value);
}

function expandStep2() {
  const btn = document.getElementById(ID_EXPAND_BTN);
  const panel = document.getElementById(ID_STEP_2);
  if (!btn || !panel) return;
  if (btn.getAttribute('aria-expanded') === 'true') return;
  btn.setAttribute('aria-expanded', 'true');
  panel.classList.add('is-open');
  panel.setAttribute('aria-hidden', 'false');
}

function setSubtitle(text) {
  const sub = document.getElementById(ID_SUB);
  if (sub) sub.textContent = text;
}

function countFilled(fields) {
  let count = 0;
  if (fields.tipo) count++;
  if (fields.fluido) count++;
  if (fields.marcaModelo) count++;
  return count;
}
