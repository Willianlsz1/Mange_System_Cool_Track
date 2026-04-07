import { renderHist } from '../../views/historico.js';
import { renderRelatorio } from '../../views/relatorio.js';
import { Photos } from '../../components/photos.js';

function resetRegistroEditingState() {
  sessionStorage.removeItem('cooltrack-editing-id');

  const saveBtn = document.querySelector('[data-action="save-registro"]');
  if (saveBtn) {
    saveBtn.textContent = 'Salvar registro';
    saveBtn.style.background = '';
    saveBtn.style.color = '';
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
  });
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
  document.getElementById('hist-equip')?.addEventListener('change', renderHist);
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

  btn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    applyTheme(currentTheme === 'light' ? 'dark' : 'light');
  });
}

export function initControllerHelpers() {
  resetRegistroEditingState();
  bindEquipDetailsToggle();
  bindPhotoInput();
  bindHistFilters();
  bindReportFilters();
  initTheme();
}
