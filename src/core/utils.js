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
    // Aceita tanto 'YYYY-MM-DD' quanto ISO datetime completo
    // ('YYYY-MM-DDTHH:mm:ss'). No segundo caso um split('-') cru vazava
    // o resto do ISO dentro de `day`, produzindo strings como
    // '19T21:24:04/04/2026' que o autoTable do PDF quebrava em duas
    // linhas ('19T21:24:0' / '4/2026'). slice(0, 10) isola a porção
    // de data antes do split — seguro para ambos os formatos.
    const [y, m, day] = iso.slice(0, 10).split('-');
    if (!y || !m || !day) return '—';
    return `${day}/${m}/${y}`;
  },

  daysDiff(isoDate) {
    if (!isoDate) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.ceil((new Date(`${isoDate}T00:00:00`) - today) / 86400000);
  },

  // ---- Relatório helpers (hero/kpis/record meta) ----
  // getRelativeTime(iso) → "hoje às HH:MM" / "ontem às HH:MM" / "há Nd" / "em DD/MM/YY"
  getRelativeTime(iso, now = new Date()) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    const HH = String(d.getHours()).padStart(2, '0');
    const MM = String(d.getMinutes()).padStart(2, '0');
    const startOfDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
    const diff = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
    if (diff === 0) return `hoje às ${HH}:${MM}`;
    if (diff === 1) return `ontem às ${HH}:${MM}`;
    if (diff > 1 && diff <= 30) return `há ${diff} dias`;
    const DD = String(d.getDate()).padStart(2, '0');
    const MO = String(d.getMonth() + 1).padStart(2, '0');
    const YY = String(d.getFullYear()).slice(-2);
    return `em ${DD}/${MO}/${YY}`;
  },

  // fmtDateTimeShort(iso) → "19/04 às 10:00"
  fmtDateTimeShort(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    const DD = String(d.getDate()).padStart(2, '0');
    const MO = String(d.getMonth() + 1).padStart(2, '0');
    const HH = String(d.getHours()).padStart(2, '0');
    const MM = String(d.getMinutes()).padStart(2, '0');
    return `${DD}/${MO} às ${HH}:${MM}`;
  },

  // daysUntil(iso) → signed days between today and iso (positive=future, negative=past)
  daysUntil(iso, now = new Date()) {
    if (!iso) return null;
    const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
    if (Number.isNaN(d.getTime())) return null;
    const startOfDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
    return Math.round((startOfDay(d) - startOfDay(now)) / 86400000);
  },

  // fmtDueRelative(iso) → "vence hoje" / "daqui Nd" / "atrasada Nd"
  fmtDueRelative(iso) {
    const n = Utils.daysUntil(iso);
    if (n == null) return '—';
    if (n === 0) return 'vence hoje';
    if (n > 0) return `daqui ${n}d`;
    return `atrasada ${-n}d`;
  },

  // fmtBRL(n) → "R$ 1.234,56"
  fmtBRL(n) {
    const num = Number(n) || 0;
    return `R$ ${num
      .toFixed(2)
      .replace('.', ',')
      .replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
  },

  // fmtShortDateRange("2026-03-14","2026-04-19") → "14 de mar a 19 de abr"
  // Fallbacks: only de → "desde 14 de mar" / only ate → "até 19 de abr" / none → "Todo período"
  fmtShortDateRange(de, ate) {
    const MONTHS_PT = [
      'jan',
      'fev',
      'mar',
      'abr',
      'mai',
      'jun',
      'jul',
      'ago',
      'set',
      'out',
      'nov',
      'dez',
    ];
    const parse = (iso) => {
      if (!iso || !iso.includes('-')) return null;
      const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
      if (!y || !m || !d) return null;
      return { d, m, y, label: `${d} de ${MONTHS_PT[m - 1]}` };
    };
    const a = parse(de);
    const b = parse(ate);
    if (!a && !b) return 'Todo período';
    if (a && !b) return `desde ${a.label}`;
    if (!a && b) return `até ${b.label}`;
    return `${a.label} a ${b.label}`;
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
