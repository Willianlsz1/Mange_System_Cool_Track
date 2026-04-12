import { renderHist } from '../../views/historico.js';
import { renderRelatorio } from '../../views/relatorio.js';
import { updateHeader } from '../../views/dashboard.js';
import { renderEquip } from '../../views/equipamentos.js';
import { Photos } from '../../components/photos.js';
import { getSuggestedPreventiveDays } from '../../../domain/maintenance.js';

function resetRegistroEditingState() {
  sessionStorage.removeItem('cooltrack-editing-id');

  const saveBtn = document.querySelector('[data-action="save-registro"]');
  if (saveBtn) {
    saveBtn.textContent = 'Salvar registro';
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

function bindPreventiveSuggestion() {
  const tipo = document.getElementById('eq-tipo');
  const criticidade = document.getElementById('eq-criticidade');
  const periodicidade = document.getElementById('eq-periodicidade');
  const hint = document.getElementById('eq-periodicidade-hint');
  if (!tipo || !criticidade || !periodicidade) return;

  const updateHint = () => {
    const suggested = getSuggestedPreventiveDays(tipo.value, criticidade.value);
    if (hint) hint.textContent = `Sugestao para ${tipo.value}: ${suggested} dias.`;
    if (!periodicidade.value || periodicidade.dataset.manual !== '1') {
      periodicidade.value = String(suggested);
      periodicidade.dataset.manual = '0';
    }
  };

  periodicidade.addEventListener('input', () => {
    periodicidade.dataset.manual = periodicidade.value ? '1' : '0';
    if (!periodicidade.value) updateHint();
  });

  tipo.addEventListener('change', updateHint);
  criticidade.addEventListener('change', updateHint);
  updateHint();
}

function bindPhotoInput() {
  const inputFotos = document.getElementById('input-fotos');
  if (!inputFotos) return;
  inputFotos.addEventListener('change', (event) => Photos.add(event.target));
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

function initTheme() {
  const btn = document.getElementById('theme-toggle');
  const icon = document.getElementById('theme-icon');
  if (!btn || !icon) return;

  const applyTheme = (theme) => {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
      icon.textContent = '☀️';
    } else {
      document.documentElement.removeAttribute('data-theme');
      icon.textContent = '🌙';
    }
    localStorage.setItem('cooltrack-theme', theme);
  };

  const preferred =
    localStorage.getItem('cooltrack-theme') ||
    (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  applyTheme(preferred);
  btn.hidden = false;

  btn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    applyTheme(currentTheme === 'light' ? 'dark' : 'light');
  });
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
  bindPreventiveSuggestion();
  bindPhotoInput();
  bindEquipFilters();
  bindHistFilters();
  bindReportFilters();
  initTheme();
  bindSyncStatusUpdates();
}
