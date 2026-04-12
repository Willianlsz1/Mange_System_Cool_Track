/**
 * CoolTrack Pro - Utils v5.0
 * Movido para core/utils.js
 */
// SECURITY: sempre usar escapeHtml() ao inserir dados do usuário no DOM via innerHTML

export const STORAGE_KEY = 'cooltrack_v3';
export const MAX_PHOTOS_PER_RECORD = 5;
export const MAX_PHOTO_WIDTH = 1200;
export const PHOTO_QUALITY = 0.7;

export const TIPO_ICON = {
  // Climatização
  'Split Hi-Wall': '❄️',
  'Split Cassette': '🌀',
  'Split Piso Teto': '📐',
  'Fan Coil': '💨',
  Chiller: '🧊',
  'VRF / VRV': '🔁',
  GHP: '♨️',
  'Self Contained': '🏭',
  'Roof Top': '🏗️',
  // Refrigeração
  'Câmara Fria': '🏔️',
  'Balcão Frigorífico': '🛒',
  Freezer: '🌨️',
  Geladeira: '🚪',
  Bebedouro: '💧',
  // Geral
  Outro: '⚙️',
};

export const STATUS_LABEL = {
  ok: 'Normal',
  warn: 'Atenção',
  danger: 'Crítico',
};

export const FLUIDOS_VALIDOS = [
  'R-410A',
  'R-22',
  'R-32',
  'R-407C',
  'R-134A',
  'R-404A',
  'R-448A',
  'R-449A',
  'R-507A',
  'R-717',
  'R-744',
  'Outro',
];

export const Utils = {
  uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  },

  dateOffset(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  },

  datetimeOffset(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  },

  nowDatetime() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  },

  localDateString(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  },

  formatDatetime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return `${d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  },

  formatDate(iso) {
    if (!iso || !iso.includes('-')) return '—';
    const [y, m, day] = iso.split('-');
    return `${day}/${m}/${y}`;
  },

  daysDiff(isoDate) {
    if (!isoDate) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.ceil((new Date(`${isoDate}T00:00:00`) - today) / 86400000);
  },

  truncate(str = '', len = 80) {
    return str.length > len ? `${str.slice(0, len)}...` : str;
  },

  escapeHtml(value = '') {
    return String(value).replace(
      /[&<>"']/g,
      (c) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[c],
    );
  },

  escapeAttr(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  },

  safeStatus(value, fallback = 'ok') {
    return ['ok', 'warn', 'danger'].includes(value) ? value : fallback;
  },

  getEl(id) {
    return document.getElementById(id);
  },
  getVal(id) {
    return Utils.getEl(id)?.value ?? '';
  },
  setVal(id, value) {
    const el = Utils.getEl(id);
    if (el) el.value = value;
  },
  clearVals(...ids) {
    ids.forEach((id) => Utils.setVal(id, ''));
  },

  getStorageBytes() {
    try {
      let total = 0;
      for (const key of Object.keys(localStorage)) {
        total += (localStorage.getItem(key) || '').length * 2;
      }
      return total;
    } catch (_) {
      return 0;
    }
  },

  formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  },
};
