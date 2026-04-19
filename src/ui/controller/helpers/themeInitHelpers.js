import { renderHist } from '../../views/historico.js';
import { renderRelatorio } from '../../views/relatorio.js';
import { updateHeader } from '../../views/dashboard.js';
import { renderEquip } from '../../views/equipamentos.js';
import { Photos } from '../../components/photos.js';
import { EquipmentPhotos } from '../../components/equipmentPhotos.js';
import { getSuggestedPreventiveDays } from '../../../domain/maintenance.js';
import { initHistScrollAutoHide } from './histScrollAutoHide.js';
import { initOnlineStatus } from '../../../core/onlineStatus.js';

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
    // Só sobrescreve o valor se o usuário ainda não editou manualmente.
    // Não usamos `!periodicidade.value` aqui porque isso impediria o usuário
    // de limpar o campo para redigitar outro número (bug: "fica fixo").
    if (periodicidade.dataset.manual !== '1') {
      periodicidade.value = String(suggested);
    }
  };

  periodicidade.addEventListener('input', () => {
    // Qualquer digitação direta = controle manual, inclusive limpar o campo.
    // Isso libera o usuário para apagar "90" e digitar "80" sem auto-reset.
    periodicidade.dataset.manual = '1';
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

// Fotos do equipamento (feature Plus+): dois inputs — câmera e galeria.
// Ambos delegam para EquipmentPhotos.add, que lida com limite e preview.
function bindEquipmentPhotoInputs() {
  ['equip-photo-camera', 'equip-photo-gallery'].forEach((id) => {
    const input = document.getElementById(id);
    if (!input) return;
    input.addEventListener('change', (event) => EquipmentPhotos.add(event.target));
  });
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
  bindPreventiveSuggestion();
  bindPhotoInput();
  bindEquipmentPhotoInputs();
  bindEquipFilters();
  bindHistFilters();
  bindReportFilters();
  initTheme();
  bindSyncStatusUpdates();
  initOnlineStatus();
  initHistScrollAutoHide();
}
