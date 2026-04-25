import { renderHist } from '../../views/historico.js';
import { renderRelatorio } from '../../views/relatorio.js';
import { updateHeader } from '../../views/dashboard.js';
import { renderEquip } from '../../views/equipamentos.js';
import { Photos } from '../../components/photos.js';
import { EquipmentPhotos } from '../../components/equipmentPhotos.js';
import { getSuggestedPreventiveDays } from '../../../domain/maintenance.js';
import { initOnlineStatus } from '../../../core/onlineStatus.js';
import { OfflineBanner } from '../../components/offlineBanner.js';

function resetRegistroEditingState() {
  sessionStorage.removeItem('cooltrack-editing-id');

  const saveBtn = document.querySelector('[data-action="save-registro"]');
  if (saveBtn) {
    // Preserva o SVG do ícone — só mexe no span (mesmo padrão de registro.js).
    const saveLabel = saveBtn.querySelector('span');
    if (saveLabel) saveLabel.textContent = 'Finalizar serviço';
    else saveBtn.textContent = 'Finalizar serviço';
    saveBtn.classList.remove('btn--editing');
  }

  const title = document.querySelector('#view-registro .section-title');
  if (title) title.textContent = 'O que foi feito hoje?';
}

function bindEquipDetailsToggle() {
  const expandBtn = document.getElementById('eq-expand-details');
  const expandPanel = document.getElementById('eq-step-2');
  if (!expandBtn || !expandPanel) return;

  expandBtn.addEventListener('click', () => {
    const isOpen = expandBtn.getAttribute('aria-expanded') === 'true';
    expandBtn.setAttribute('aria-expanded', String(!isOpen));
    expandPanel.classList.toggle('is-open', !isOpen);
    expandPanel.setAttribute('aria-hidden', String(isOpen));
  });
}

/**
 * Toggle dos "Mais campos da etiqueta" — progressive disclosure dos 8 campos
 * avançados (tensão, frequência, fase, potência, correntes, pressões, IP,
 * ano). Por default ficam escondidos; IA ou click do usuário revelam.
 * Também exposto via window.__expandEtiquetaMore pra nameplateCapture chamar
 * quando detecta qualquer valor nesses campos.
 */
function bindEtiquetaMoreToggle() {
  const toggleBtn = document.getElementById('eq-etiqueta-more-toggle');
  const panel = document.getElementById('eq-etiqueta-more');
  if (!toggleBtn || !panel) return;

  const setOpen = (open) => {
    toggleBtn.setAttribute('aria-expanded', String(Boolean(open)));
    if (open) {
      panel.hidden = false;
      panel.setAttribute('aria-hidden', 'false');
    } else {
      panel.hidden = true;
      panel.setAttribute('aria-hidden', 'true');
    }
  };

  toggleBtn.addEventListener('click', () => {
    const isOpen = toggleBtn.getAttribute('aria-expanded') === 'true';
    setOpen(!isOpen);
  });

  // Expõe pra nameplateCapture: quando a IA detecta qualquer valor nos
  // campos ocultos, auto-abre o painel pro usuário ver o que foi preenchido.
  window.__expandEtiquetaMoreIfNeeded = () => {
    const advancedIds = [
      'eq-tensao',
      'eq-frequencia',
      'eq-fase',
      'eq-potencia',
      'eq-corrente-refrig',
      'eq-corrente-aquec',
      'eq-pressao-suc',
      'eq-pressao-desc',
      'eq-grau-protecao',
      'eq-ano-fabricacao',
    ];
    const hasValue = advancedIds.some((id) => {
      const el = document.getElementById(id);
      if (!el) return false;
      const v = String(el.value || '').trim();
      return v !== '' && v !== '—';
    });
    if (hasValue) setOpen(true);
  };
}

/**
 * Colapsa o hero "Aponta a câmera pra etiqueta" pra um formato compacto
 * (só título + botão, sem subtitle/hint) quando o técnico começa a digitar
 * no primeiro campo. Libera espaço vertical no modal e reduz a sensação de
 * "muito pra ler" — mas o CTA de foto continua acessível.
 *
 * Expande automaticamente de volta se o campo ficar vazio (edge case de
 * apagar tudo e reconsiderar o fluxo).
 */
function bindNameplateHeroCollapse() {
  const hero = document.getElementById('nameplate-cta');
  const nome = document.getElementById('eq-nome');
  if (!hero || !nome) return;

  const setCompact = (compact) => {
    hero.classList.toggle('nameplate-cta--compact', Boolean(compact));
  };

  // Permite reabrir programaticamente (ex: nameplateCapture quando a análise
  // termina e o banner IA é mostrado — aí o user precisa ver o resultado).
  window.__expandNameplateHero = () => setCompact(false);

  nome.addEventListener('input', () => {
    const hasValue = String(nome.value || '').trim() !== '';
    setCompact(hasValue);
  });
}

/**
 * Smart defaults por tipo de equipamento (#10 do refino UX).
 *
 * Quando o técnico escolhe o "Tipo de equipamento", pré-preenche fluido e
 * criticidade com valores razoáveis (baseados em conhecimento de domínio
 * HVAC-R). O usuário pode sobrescrever — o campo só é atualizado
 * automaticamente se ainda está no estado "não tocado manualmente" (mesmo
 * padrão usado pelo campo de periodicidade).
 *
 * Critério das sugestões:
 * - Fluido: o mais comum na indústria brasileira pra aquele tipo em 2024+.
 * - Criticidade: ponderada por impacto típico de falha (câmara fria = alta,
 *   split de sala = baixa, chiller/VRF que atende prédio = alta).
 *
 * NÃO é autoridade — é ponto de partida. Técnico ajusta conforme o caso.
 */
const TIPO_DEFAULTS = {
  'Split Hi-Wall': { fluido: 'R-410A', criticidade: 'baixa' },
  'Split Cassette': { fluido: 'R-410A', criticidade: 'media' },
  'Split Piso Teto': { fluido: 'R-410A', criticidade: 'media' },
  'VRF / VRV': { fluido: 'R-410A', criticidade: 'alta' },
  GHP: { fluido: 'R-410A', criticidade: 'alta' },
  'Fan Coil': { fluido: 'R-410A', criticidade: 'media' },
  Chiller: { fluido: 'R-134A', criticidade: 'alta' },
  'Self Contained': { fluido: 'R-410A', criticidade: 'media' },
  'Roof Top': { fluido: 'R-410A', criticidade: 'media' },
  'Câmara Fria': { fluido: 'R-404A', criticidade: 'alta' },
  'Balcão Frigorífico': { fluido: 'R-404A', criticidade: 'media' },
  Freezer: { fluido: 'R-134A', criticidade: 'baixa' },
  Geladeira: { fluido: 'R-134A', criticidade: 'baixa' },
  Bebedouro: { fluido: 'R-134A', criticidade: 'baixa' },
};

function bindPreventiveSuggestion() {
  const tipo = document.getElementById('eq-tipo');
  const criticidade = document.getElementById('eq-criticidade');
  const fluido = document.getElementById('eq-fluido');
  const periodicidade = document.getElementById('eq-periodicidade');
  const hint = document.getElementById('eq-periodicidade-hint');
  if (!tipo || !criticidade || !periodicidade) return;

  const updateHint = () => {
    const suggested = getSuggestedPreventiveDays(tipo.value, criticidade.value);
    if (hint) hint.textContent = `Sugestão para ${tipo.value}: ${suggested} dias.`;
    // Só sobrescreve o valor se o usuário ainda não editou manualmente.
    // Não usamos `!periodicidade.value` aqui porque isso impediria o usuário
    // de limpar o campo para redigitar outro número (bug: "fica fixo").
    if (periodicidade.dataset.manual !== '1') {
      periodicidade.value = String(suggested);
    }
  };

  const applyTipoDefaults = () => {
    const defaults = TIPO_DEFAULTS[tipo.value];
    if (!defaults) return;
    // Fluido: só sobrescreve se o técnico ainda não mexeu manualmente.
    if (fluido && fluido.dataset.manual !== '1') {
      const hasOption = Array.from(fluido.options).some((o) => o.value === defaults.fluido);
      if (hasOption) fluido.value = defaults.fluido;
    }
    // Criticidade: mesma regra.
    if (criticidade.dataset.manual !== '1') {
      criticidade.value = defaults.criticidade;
    }
  };

  periodicidade.addEventListener('input', () => {
    // Qualquer digitação direta = controle manual, inclusive limpar o campo.
    // Isso libera o usuário para apagar "90" e digitar "80" sem auto-reset.
    periodicidade.dataset.manual = '1';
  });

  if (fluido) {
    fluido.addEventListener('change', () => {
      fluido.dataset.manual = '1';
    });
  }
  criticidade.addEventListener('change', () => {
    criticidade.dataset.manual = '1';
    updateHint();
  });

  tipo.addEventListener('change', () => {
    applyTipoDefaults();
    updateHint();
  });

  // Tick inicial: aplica hint + defaults do tipo atualmente selecionado.
  applyTipoDefaults();
  updateHint();
}

function bindPhotoInput() {
  // Dois inputs no registro: "input-fotos" (drop zone clássica, multiple) e
  // "input-fotos-camera" (atalho mobile com capture="environment" que abre a
  // câmera direto). Ambos caem no mesmo handler Photos.add — a UI que separa.
  ['input-fotos', 'input-fotos-camera'].forEach((id) => {
    const input = document.getElementById(id);
    if (!input) return;
    input.addEventListener('change', (event) => Photos.add(event.target));
  });
}

// Fotos do equipamento (feature Plus+): bindings dos file inputs.
// V4: fotos são gerenciadas a partir do detail view via modal-eq-photos.
// Os IDs antigos (equip-photo-camera/-gallery, usados no modal-add-eq) podem
// não existir mais depois da remoção do bloco — mantemos fallback pra evitar
// erros silenciosos durante a transição. Novos IDs: eq-photos-camera/-gallery.
function bindEquipmentPhotoInputs() {
  ['equip-photo-camera', 'equip-photo-gallery', 'eq-photos-camera', 'eq-photos-gallery'].forEach(
    (id) => {
      const input = document.getElementById(id);
      if (!input) return;
      input.addEventListener('change', (event) => EquipmentPhotos.add(event.target));
    },
  );
}

function bindHistFilters() {
  let timeoutId;
  const debounce =
    (fn) =>
    (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), 280);
    };

  document.getElementById('hist-busca')?.addEventListener('input', debounce(renderHist));
  document.getElementById('hist-setor')?.addEventListener('change', () => {
    // Ao trocar o setor, resetar o filtro de equipamento
    const equipSel = document.getElementById('hist-equip');
    if (equipSel) equipSel.value = '';
    renderHist();
  });
  document.getElementById('hist-equip')?.addEventListener('change', renderHist);
}

/**
 * Toggle "Lista ⇄ Grade" na tela Equip. Lista = layout compacto. Grade =
 * cards maiores com foto grande. Estado persiste em localStorage.
 *
 * Aplica o estado inicial e expõe `setEquipViewMode(mode)` pra o handler
 * global do controller chamar (ver `equip-set-view-mode` em
 * equipmentHandlers.js). Ter um único ponto de mudança evita warning
 * "[Events] Sem handler para action=…" e centraliza a lógica.
 */
const VIEW_MODE_STORAGE_KEY = 'cooltrack-equip-view-mode';

function setEquipViewMode(mode) {
  const toggle = document.querySelector('.equip-view-toggle');
  const container = document.getElementById('lista-equip');
  if (!toggle || !container) return;
  const isGrid = mode === 'grid';
  container.classList.toggle('lista-equip--grid', isGrid);
  toggle.querySelectorAll('.equip-view-toggle__btn').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.dataset.mode === mode));
  });
  try {
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  } catch {
    /* storage bloqueado (safari private etc) — tolerante */
  }
}

// Exposto pro handler global do controller chamar.
window.__setEquipViewMode = setEquipViewMode;

function bindEquipViewModeToggle() {
  // Aplica estado inicial salvo. O click handler vive no delegator global
  // (registrado em equipmentHandlers.js como 'equip-set-view-mode').
  let initial = 'list';
  try {
    const stored = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    if (stored === 'grid' || stored === 'list') initial = stored;
  } catch {
    /* noop */
  }
  setEquipViewMode(initial);
}

function bindEquipFilters() {
  const input = document.getElementById('equip-busca');
  if (!input) return;

  let timeoutId;
  const applyFilter = () => {
    const value = (input.value || '').trim();
    renderEquip(value);
  };
  const debounceFilter = () => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(applyFilter, 220);
  };

  input.addEventListener('input', debounceFilter);
}

function bindReportFilters() {
  ['rel-equip', 'rel-de', 'rel-ate'].forEach((id) => {
    document.getElementById(id)?.addEventListener('change', renderRelatorio);
  });
}

/**
 * Aplica o tema (light/dark), persiste no storage e sincroniza o label do
 * item de menu da engrenagem. Não depende de nenhum botão dedicado no DOM.
 */
function applyThemeMode(theme) {
  const menuLabel = document.getElementById('header-theme-label');
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    if (menuLabel) menuLabel.textContent = '🌙 Tema escuro';
  } else {
    document.documentElement.removeAttribute('data-theme');
    if (menuLabel) menuLabel.textContent = '☀️ Tema claro';
  }
  localStorage.setItem('cooltrack-theme', theme);
}

export function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  applyThemeMode(current === 'light' ? 'dark' : 'light');
}

function initTheme() {
  const preferred =
    localStorage.getItem('cooltrack-theme') ||
    (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  applyThemeMode(preferred);
}

function bindSyncStatusUpdates() {
  if (window.__cooltrackSyncStatusBound) return;
  window.__cooltrackSyncStatusBound = '1';
  window.addEventListener('cooltrack:sync-status', () => {
    updateHeader();
  });
}

export function initControllerHelpers() {
  resetRegistroEditingState();
  bindEquipDetailsToggle();
  bindEtiquetaMoreToggle();
  bindNameplateHeroCollapse();
  bindEquipViewModeToggle();
  bindPreventiveSuggestion();
  bindPhotoInput();
  bindEquipmentPhotoInputs();
  bindEquipFilters();
  bindHistFilters();
  bindReportFilters();
  initTheme();
  bindSyncStatusUpdates();
  initOnlineStatus();
  OfflineBanner.mount();
}
