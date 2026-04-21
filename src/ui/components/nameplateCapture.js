/**
 * CoolTrack Pro — Componente UI: captura de placa por foto.
 *
 * Gerencia o hero CTA no modal-add-eq + o overlay de scan que aparece enquanto
 * a IA processa a foto. Três responsabilidades:
 *
 *   1. `applyNameplateCtaGate(isPlusOrPro)` — toggle entre o estado "active"
 *      (Plus+ pode usar) e "locked" (Free vê upsell). Chamado no open-modal
 *      + quando o plano muda.
 *
 *   2. Listener `change` no input file escondido. Quando o user seleciona
 *      uma foto:
 *        - Mostra o overlay de scan com thumbnail + progress bar fake
 *          que sobe 0→85% enquanto o fetch roda (crescimento assintótico).
 *        - Quando a resposta chega, pula pra 100% e troca pro painel de
 *          resultado ("Detectei 14/16 campos — 87%").
 *        - Preenche TODOS os 16 campos no form, com placeholder "não
 *          detectado — toque pra preencher" nos que a IA não devolveu.
 *        - Abre o step 2 e faz scroll suave até Detalhes técnicos.
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
import { Modal } from '../../core/modal.js';
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
const ID_STEP_2 = 'eq-step-2';
const ID_EXPAND_BTN = 'eq-expand-details';

// IDs dos campos do form (ligados aos keys do retorno da API).
const ID_TIPO = 'eq-tipo';
const ID_FLUIDO = 'eq-fluido';
const ID_MODELO = 'eq-modelo';
const ID_NUMERO_SERIE = 'eq-numero-serie';
const ID_CAPACIDADE_BTU = 'eq-capacidade-btu';
const ID_TENSAO = 'eq-tensao';
const ID_FREQUENCIA = 'eq-frequencia';
const ID_FASE = 'eq-fase';
const ID_POTENCIA = 'eq-potencia';
const ID_CORRENTE_REFRIG = 'eq-corrente-refrig';
const ID_CORRENTE_AQUEC = 'eq-corrente-aquec';
const ID_PRESSAO_SUC = 'eq-pressao-suc';
const ID_PRESSAO_DESC = 'eq-pressao-desc';
const ID_GRAU_PROTECAO = 'eq-grau-protecao';
const ID_ANO_FABRICACAO = 'eq-ano-fabricacao';

// IDs do overlay de scan.
const ID_SCAN = 'nameplate-scan';
const ID_SCAN_IMG = 'nameplate-scan-img';
const ID_SCAN_STAGE_TEXT = 'nameplate-scan-stage-text';
const ID_SCAN_BAR = 'nameplate-scan-bar';
const ID_SCAN_BAR_FILL = 'nameplate-scan-bar-fill';
const ID_SCAN_PERCENT = 'nameplate-scan-percent';
const ID_SCAN_RESULT = 'nameplate-scan-result';
const ID_SCAN_DETECTED = 'nameplate-scan-detected';
const ID_SCAN_TOTAL = 'nameplate-scan-total';
const ID_SCAN_RESULT_PERCENT = 'nameplate-scan-result-percent';
const ID_SCAN_RESULT_SUB = 'nameplate-scan-result-sub';

const DEFAULT_SUB = 'A IA preenche tipo, fluido, marca/modelo e mais 13 campos pra você.';
const NOT_DETECTED_PLACEHOLDER = 'não detectado — toque pra preencher';

// Total de campos preenchíveis pela IA (usado pro "X/16").
const AI_FIELD_IDS = [
  ID_TIPO,
  ID_FLUIDO,
  ID_MODELO,
  ID_NUMERO_SERIE,
  ID_CAPACIDADE_BTU,
  ID_TENSAO,
  ID_FREQUENCIA,
  ID_FASE,
  ID_POTENCIA,
  ID_CORRENTE_REFRIG,
  ID_CORRENTE_AQUEC,
  ID_PRESSAO_SUC,
  ID_PRESSAO_DESC,
  ID_GRAU_PROTECAO,
  ID_ANO_FABRICACAO,
];
const AI_FIELD_TOTAL = AI_FIELD_IDS.length + 1; // +1 porque "marca" e "modelo" viram um string só, mas conceitualmente são 2 campos da etiqueta

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
  if (cta) {
    delete cta.dataset.ctaShown;
    if (cta.dataset.state === 'busy') cta.dataset.state = 'active';
    setSubtitle(DEFAULT_SUB);
  }
  const input = document.getElementById(ID_FILE_INPUT);
  if (input) {
    try {
      input.value = '';
    } catch (_) {
      /* IE legacy */
    }
  }
  hideScanOverlay();
  // Limpa placeholders "não detectado" que possam ter ficado de uma abertura anterior.
  clearNotDetectedMarks();
}

// ── Interno ───────────────────────────────────────────────────────────────

let boundOnce = false;
let progressInterval = null;

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
  // Ordem importa: fecha o modal-add-eq ANTES do goTo pro pricing — senão
  // a rota muda mas o modal fica renderizado em cima, obrigando o user a
  // clicar em algo pra fechar o overlay.
  const lockedBtn = document.querySelector('[data-action="nameplate-upsell-cta"]');
  if (lockedBtn) {
    lockedBtn.addEventListener('click', () => {
      trackEvent('nameplate_upsell_clicked', { source: 'equip_modal' });
      try {
        Modal.close('modal-add-eq');
      } catch (_) {
        /* se o Modal não tá aberto por algum motivo, segue pro pricing mesmo */
      }
      goTo('pricing', { highlightPlan: 'plus', reason: 'nameplate_upsell' });
    });
  }

  // Botão "Ver campos preenchidos" do result panel: fecha o overlay e
  // rola a página até os campos preenchidos.
  const reviewBtn = document.getElementById('nameplate-scan-review');
  if (reviewBtn) {
    reviewBtn.addEventListener('click', () => {
      hideScanOverlay();
      scrollToDetails();
    });
  }

  boundOnce = true;
}

async function handleFile(file) {
  const cta = document.getElementById(ID_CTA);
  if (!cta) return;

  const prevState = cta.dataset.state;
  cta.dataset.state = 'busy';
  setSubtitle('Analisando a etiqueta…');

  // Mostra overlay com thumbnail + progresso fake subindo
  await showScanOverlay(file);
  startFakeProgress();

  const startedAt = performance.now();
  try {
    const fields = await analyzeNameplate(file);
    stopFakeProgress(100);

    const filledCount = countFilled(fields);
    const detectedPercent = Math.round((filledCount / AI_FIELD_TOTAL) * 100);
    const duration = Math.round(performance.now() - startedAt);

    // Transição visual: scanning → done
    setScanState('done');
    setScanStage('Análise completa');
    showScanResult(filledCount, detectedPercent);

    applyFieldsToForm(fields);

    trackEvent('nameplate_analyzed', {
      success: true,
      confidence: fields.confidence,
      fields_filled_count: filledCount,
      fields_total: AI_FIELD_TOTAL,
      detected_percent: detectedPercent,
      duration_ms: duration,
    });

    setSubtitle(
      filledCount > 0
        ? `Pronto — ${filledCount}/${AI_FIELD_TOTAL} campos preenchidos. Revise antes de salvar.`
        : 'Etiqueta lida, mas nenhum campo bateu. Confira a foto.',
    );
    cta.dataset.state = prevState === 'locked' ? 'locked' : 'active';

    if (filledCount > 0) {
      Toast.success(
        `IA detectou ${filledCount}/${AI_FIELD_TOTAL} campos (${detectedPercent}%). Revise antes de salvar.`,
      );
    } else {
      Toast.info('Etiqueta lida, mas campos não bateram com o form.');
    }
  } catch (err) {
    stopFakeProgress();
    setScanState('error');

    const isAppErr = err instanceof NameplateAnalysisError;
    const code = isAppErr ? err.code : 'UNKNOWN';
    const message = isAppErr ? err.message : 'Erro inesperado na análise.';

    trackEvent('nameplate_analyzed', {
      success: false,
      error_code: code,
      duration_ms: Math.round(performance.now() - startedAt),
    });

    let stageMsg = message;
    if (code === ERR_PLAN_GATE) {
      cta.dataset.state = 'locked';
      stageMsg = 'Feature exclusiva Plus+';
      setSubtitle('Feature exclusiva Plus+. Faça upgrade pra destravar.');
    } else if (code === ERR_NO_SESSION) {
      stageMsg = 'Sessão expirada';
      setSubtitle('Sessão expirada. Faça login e tente de novo.');
      cta.dataset.state = prevState === 'locked' ? 'locked' : 'active';
    } else if (code === ERR_NOT_IDENTIFIED) {
      stageMsg = 'Não consegui ler a etiqueta';
      setSubtitle('Tire outra foto com mais luz e enquadramento reto.');
      cta.dataset.state = prevState === 'locked' ? 'locked' : 'active';
    } else if (code === ERR_UPSTREAM_BUSY) {
      stageMsg = 'IA sobrecarregada';
      setSubtitle('Aguarde alguns segundos e tente de novo.');
      cta.dataset.state = prevState === 'locked' ? 'locked' : 'active';
    } else if (code === ERR_NETWORK) {
      stageMsg = 'Erro de rede';
      setSubtitle('Verifique a conexão.');
      cta.dataset.state = prevState === 'locked' ? 'locked' : 'active';
    } else if (code === ERR_FILE_TOO_LARGE || code === ERR_FILE_INVALID) {
      stageMsg = message;
      setSubtitle(message);
      cta.dataset.state = prevState === 'locked' ? 'locked' : 'active';
    } else {
      setSubtitle(message);
      cta.dataset.state = prevState === 'locked' ? 'locked' : 'active';
    }

    setScanStage(stageMsg);
    Toast.show(message, 'error');

    // Auto-close do overlay em erro (3s) pra não poluir a tela.
    setTimeout(() => hideScanOverlay(), 3000);
  }
}

/**
 * Preenche os campos do step 2 com os valores da IA. Todos os 14 IDs
 * listados em AI_FIELD_IDS são tocados:
 *   - se `fields[key]` existe → seta o value
 *   - se não existe → aplica placeholder "não detectado — toque pra preencher"
 *     e classe .is-not-detected no input, sem setar value
 *
 * Expande o step 2 e faz scroll suave até Detalhes técnicos.
 */
function applyFieldsToForm(fields) {
  expandStep2();

  // Regra: sobrescreve sempre. A alternativa — respeitar user input — exige
  // dirty tracking que não existe nesses inputs. E o contrato pro user é
  // explícito: "IA preenche, você revisa antes de salvar".

  // Selects (têm enum fechado)
  setSelectIfHas(ID_TIPO, fields.tipo);
  setSelectIfHas(ID_FLUIDO, fields.fluido);
  setSelectIfHas(ID_TENSAO, fields.tensao ? String(fields.tensao) : null);
  setSelectIfHas(ID_FREQUENCIA, fields.frequenciaHz ? String(fields.frequenciaHz) : null);
  setSelectIfHas(ID_FASE, fields.fases ? String(fields.fases) : null);

  // Inputs texto/número (aceitam qualquer valor)
  setInput(ID_MODELO, fields.marcaModelo);
  setInput(ID_NUMERO_SERIE, fields.numeroSerie);
  setInput(ID_CAPACIDADE_BTU, fields.capacidadeBtu);
  setInput(ID_POTENCIA, fields.potenciaW);
  setInput(ID_CORRENTE_REFRIG, fields.correnteA);
  // Corrente aquec geralmente não vem da API; se vier separado em correnteAquecA, use.
  setInput(ID_CORRENTE_AQUEC, fields.correnteAquecA ?? null);
  setInput(ID_PRESSAO_SUC, fields.pressaoSuccaoMpa ?? null);
  setInput(ID_PRESSAO_DESC, fields.pressaoDescargaMpa ?? null);
  setInput(ID_GRAU_PROTECAO, fields.grauProtecao ?? null);
  setInput(ID_ANO_FABRICACAO, fields.anoFabricacao);

  // Scroll suave até a subseção "Dados da etiqueta" pro user ver o resultado
  requestAnimationFrame(() => scrollToDetails());
}

/** Seta value num select se houver uma option matching. Se não, marca not-detected. */
function setSelectIfHas(id, value) {
  const el = Utils.getEl(id);
  if (!el) return;
  if (value != null && value !== '' && selectHasValue(el, value)) {
    el.value = value;
    el.classList.remove('is-not-detected');
    el.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    markNotDetected(el);
  }
}

/** Seta value num input se houver valor. Senão, marca not-detected. */
function setInput(id, value) {
  const el = Utils.getEl(id);
  if (!el) return;
  if (value != null && value !== '') {
    el.value = value;
    el.classList.remove('is-not-detected');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    markNotDetected(el);
  }
}

/**
 * Aplica visual "não detectado" no input: placeholder italicizado + classe.
 * Preserva o placeholder original em data-original-placeholder pra restaurar
 * quando o user focar o campo (onde ele já pode digitar valor manual).
 */
function markNotDetected(el) {
  if (!el) return;
  if (!el.dataset.originalPlaceholder) {
    el.dataset.originalPlaceholder = el.getAttribute('placeholder') ?? '';
  }
  el.value = '';
  el.classList.add('is-not-detected');
  if (el.tagName === 'INPUT') {
    el.setAttribute('placeholder', NOT_DETECTED_PLACEHOLDER);
    // Quando o user foca pra digitar, restaura o placeholder original
    // (ex: "Ex: 9000, 12000, 24000") pra ajudar no preenchimento manual.
    if (!el.dataset.notDetectedBound) {
      el.addEventListener(
        'focus',
        () => {
          el.classList.remove('is-not-detected');
          el.setAttribute('placeholder', el.dataset.originalPlaceholder ?? '');
        },
        { once: true },
      );
      el.dataset.notDetectedBound = '1';
    }
  }
}

/** Remove marcas "não detectado" de todos os campos — usado no reset. */
function clearNotDetectedMarks() {
  AI_FIELD_IDS.forEach((id) => {
    const el = Utils.getEl(id);
    if (!el) return;
    el.classList.remove('is-not-detected');
    if (el.dataset.originalPlaceholder !== undefined && el.tagName === 'INPUT') {
      el.setAttribute('placeholder', el.dataset.originalPlaceholder);
    }
  });
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

function scrollToDetails() {
  const panel = document.getElementById(ID_STEP_2);
  if (!panel) return;
  // Rola dentro do container scrollável do modal (não a window).
  const scrollContainer = panel.closest('.modal__body--scroll') ?? panel.closest('.modal__body');
  if (scrollContainer && typeof scrollContainer.scrollTo === 'function') {
    const offsetTop = panel.offsetTop - 60; // deixa um respiro no topo
    try {
      scrollContainer.scrollTo({ top: offsetTop, behavior: 'smooth' });
    } catch (_) {
      scrollContainer.scrollTop = offsetTop;
    }
  } else if (typeof panel.scrollIntoView === 'function') {
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function setSubtitle(text) {
  const sub = document.getElementById(ID_SUB);
  if (sub) sub.textContent = text;
}

/** Conta quantos campos do retorno da API vieram preenchidos. */
function countFilled(fields) {
  if (!fields) return 0;
  const keys = [
    'tipo',
    'fluido',
    'marcaModelo',
    'numeroSerie',
    'capacidadeBtu',
    'tensao',
    'frequenciaHz',
    'fases',
    'potenciaW',
    'correnteA',
    'correnteAquecA',
    'pressaoSuccaoMpa',
    'pressaoDescargaMpa',
    'grauProtecao',
    'anoFabricacao',
  ];
  let count = 0;
  for (const k of keys) {
    const v = fields[k];
    if (v != null && v !== '') count++;
  }
  // marcaModelo conceitualmente conta como 2 (marca + modelo) — mas só se tiver
  // espaço separando, indicando que veio marca + modelo juntos.
  if (typeof fields.marcaModelo === 'string' && fields.marcaModelo.includes(' ')) {
    count++;
  }
  return count;
}

// ── Scan overlay helpers ──────────────────────────────────────────────────

/**
 * Mostra o overlay de scan com thumbnail da foto e estado inicial.
 * Retorna promise que resolve quando o thumbnail carregou (ou falhou).
 */
async function showScanOverlay(file) {
  const overlay = document.getElementById(ID_SCAN);
  if (!overlay) return;

  // Reset
  const resultPanel = document.getElementById(ID_SCAN_RESULT);
  if (resultPanel) resultPanel.hidden = true;

  overlay.hidden = false;
  overlay.dataset.state = 'scanning';
  setScanProgress(0);
  setScanStage('Carregando foto…');

  // Thumbnail: URL.createObjectURL pra mostrar rápido (não precisa ler
  // base64 só pra thumbnail).
  const img = document.getElementById(ID_SCAN_IMG);
  if (img) {
    const url = URL.createObjectURL(file);
    img.src = url;
    // revoke quando carregar pra não vazar memória
    const revoke = () => URL.revokeObjectURL(url);
    img.addEventListener('load', revoke, { once: true });
    img.addEventListener('error', revoke, { once: true });
  }

  // Pequeno delay cosmético pra o user ver o "Carregando foto" antes de
  // pular pra "Analisando" — evita flash.
  await new Promise((r) => setTimeout(r, 180));
  setScanStage('Enviando pra IA…');
}

function hideScanOverlay() {
  stopFakeProgress();
  const overlay = document.getElementById(ID_SCAN);
  if (!overlay) return;
  overlay.hidden = true;
  overlay.dataset.state = 'idle';
  const resultPanel = document.getElementById(ID_SCAN_RESULT);
  if (resultPanel) resultPanel.hidden = true;
}

function setScanState(state) {
  const overlay = document.getElementById(ID_SCAN);
  if (overlay) overlay.dataset.state = state;
}

function setScanStage(text) {
  const el = document.getElementById(ID_SCAN_STAGE_TEXT);
  if (el) el.textContent = text;
}

function setScanProgress(pct) {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  const fill = document.getElementById(ID_SCAN_BAR_FILL);
  const label = document.getElementById(ID_SCAN_PERCENT);
  const bar = document.getElementById(ID_SCAN_BAR);
  if (fill) fill.style.width = `${clamped}%`;
  if (label) label.textContent = `${clamped}%`;
  if (bar) bar.setAttribute('aria-valuenow', String(clamped));
}

/**
 * Progress "fake" que simula análise. Cresce assintóticamente 0→85%
 * durante ~4-5s (tempo típico de análise) e pára em 85 até o fetch real
 * completar, quando pulamos pra 100%.
 *
 * Curva: cada tick acrescenta (TARGET - atual) * 0.06, suavizando perto do
 * TARGET. Timer de 120ms = ~7 ticks por segundo.
 */
function startFakeProgress() {
  stopFakeProgress();
  const TARGET = 85;
  let current = 0;
  setScanStage('Analisando etiqueta…');

  progressInterval = setInterval(() => {
    current += (TARGET - current) * 0.06;
    if (current >= TARGET - 0.1) current = TARGET;
    setScanProgress(current);

    // Estágio vai mudando pra dar sensação de progresso real
    if (current > 15 && current < 40) setScanStage('Lendo texto da etiqueta…');
    else if (current >= 40 && current < 70) setScanStage('Identificando campos…');
    else if (current >= 70) setScanStage('Cruzando com base de modelos…');
  }, 120);
}

function stopFakeProgress(finalPct) {
  if (progressInterval) {
    clearInterval(progressInterval);
    progressInterval = null;
  }
  if (typeof finalPct === 'number') {
    setScanProgress(finalPct);
  }
}

function showScanResult(detected, percent) {
  const panel = document.getElementById(ID_SCAN_RESULT);
  const detectedEl = document.getElementById(ID_SCAN_DETECTED);
  const totalEl = document.getElementById(ID_SCAN_TOTAL);
  const percentEl = document.getElementById(ID_SCAN_RESULT_PERCENT);
  const subEl = document.getElementById(ID_SCAN_RESULT_SUB);

  if (detectedEl) detectedEl.textContent = String(detected);
  if (totalEl) totalEl.textContent = String(AI_FIELD_TOTAL);
  if (percentEl) percentEl.textContent = `${percent}%`;

  // Mensagem adaptativa ao % detectado
  if (subEl) {
    if (percent >= 80) {
      subEl.textContent = 'Excelente — etiqueta bem legível. Revise e salve.';
    } else if (percent >= 50) {
      subEl.textContent = 'Bom — preenchi a maioria. Complete os campos faltantes.';
    } else if (percent >= 20) {
      subEl.textContent = 'Etiqueta parcialmente legível. Complete os campos que faltaram.';
    } else {
      subEl.textContent = 'Etiqueta difícil. Tente outra foto ou preencha manual.';
    }
  }

  if (panel) panel.hidden = false;
}
