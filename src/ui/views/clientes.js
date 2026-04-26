/**
 * /clientes — View completa de clientes (abr/2026 redesign).
 *
 * Layout:
 *   1. Page header (titulo + Novo cliente CTA)
 *   2. KPI row (4 metricas: ativos, equipamentos, servicos no mes, manutencoes pendentes)
 *   3. Alert strip (clientes sem manutencao ha mais de 60 dias) — so aparece se houver
 *   4. Filter bar (search + Status + Cidade + Ordenar)
 *   5. Grid de cards (3 colunas em desktop) com:
 *      - Industry icon (heuristica pelo nome)
 *      - Nome + status pill (Ativo / Sem manutencao / Precisa atencao)
 *      - Endereco
 *      - 3 stats (equipamentos / servicos / ultima manutencao)
 *      - 3 acoes (Ver equipamentos / Ver servicos / Editar) + kebab
 *   6. Paginacao (6/pagina)
 *
 * Dados: state.clientes + state.equipamentos + state.registros.
 * Status derivado: 'ativo' default, 'sem_manutencao' se ultimo servico > 60 dias,
 * 'precisa_atencao' se > 90 dias OU sem registro nenhum.
 */

import { Utils } from '../../core/utils.js';
import { getState } from '../../core/state.js';
import { loadClientes, deleteCliente, formatCnpjOrCpf } from '../../core/clientes.js';
import { ClienteModal } from '../components/clienteModal.js';
import { Toast } from '../../core/toast.js';
import { CustomConfirm } from '../../core/modal.js';
import { handleError, ErrorCodes } from '../../core/errors.js';
import { goTo } from '../../core/router.js';

/* ─────────────────────── module state ──────────────────────────────── */

let _searchTerm = '';
let _statusFilter = 'todos';
let _cityFilter = 'todas';
let _sortBy = 'mais_ativos';
let _currentPage = 1;
let _pageSize = 6;
let _hydrated = false;
let _bound = false;

/* ─────────────────────── derivacao de dados ────────────────────────── */

const DAYS_60_MS = 60 * 24 * 60 * 60 * 1000;
const DAYS_90_MS = 90 * 24 * 60 * 60 * 1000;
const DAYS_30_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Constroi um indice cliente_id → { equipsCount, servicesCount, servicesThisMonth,
 * lastServiceTs, status, city, displayCity }.
 */
function _indexCliente(clientes, equipamentos, registros) {
  const idx = new Map();
  const equipsByCliente = new Map();
  const equipsById = new Map();
  equipamentos.forEach((eq) => {
    equipsById.set(eq.id, eq);
    if (eq.clienteId) {
      if (!equipsByCliente.has(eq.clienteId)) equipsByCliente.set(eq.clienteId, []);
      equipsByCliente.get(eq.clienteId).push(eq);
    }
  });

  // Mapa registro → cliente_id (via equipId)
  const regsByCliente = new Map();
  const now = Date.now();
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const startMonthMs = startOfMonth.getTime();

  registros.forEach((r) => {
    if (!r.equipId) return;
    const eq = equipsById.get(r.equipId);
    if (!eq?.clienteId) return;
    if (!regsByCliente.has(eq.clienteId)) regsByCliente.set(eq.clienteId, []);
    regsByCliente.get(eq.clienteId).push(r);
  });

  clientes.forEach((c) => {
    const equips = equipsByCliente.get(c.id) || [];
    const regs = regsByCliente.get(c.id) || [];
    let lastTs = 0;
    let monthCount = 0;
    regs.forEach((r) => {
      const ts = r.data ? new Date(r.data).getTime() : 0;
      if (ts > lastTs) lastTs = ts;
      if (ts >= startMonthMs) monthCount++;
    });

    const sinceLast = lastTs ? now - lastTs : Number.POSITIVE_INFINITY;
    let status = 'ativo';
    if (!lastTs && equips.length > 0) status = 'precisa_atencao';
    else if (sinceLast > DAYS_90_MS) status = 'precisa_atencao';
    else if (sinceLast > DAYS_60_MS) status = 'sem_manutencao';

    const displayCity = _extractCity(c.endereco);

    idx.set(c.id, {
      equipsCount: equips.length,
      servicesCount: regs.length,
      servicesThisMonth: monthCount,
      lastServiceTs: lastTs,
      sinceLast,
      status,
      displayCity,
    });
  });

  return idx;
}

/**
 * Extrai a cidade do endereço (heurística): pega o ultimo segmento antes de UF
 * ou o segmento depois da ultima virgula. Funciona pra padrões comuns:
 *   "Rua das Flores, 123 - São Paulo, SP"  → "São Paulo"
 *   "Av. Beira Mar, 456 - Santos/SP"        → "Santos"
 *   "Rod. Anhanguera, km 22 - Jundiaí, SP"  → "Jundiaí"
 */
function _extractCity(endereco) {
  if (!endereco) return '';
  const str = String(endereco).trim();
  // Primeiro tenta padrao "Cidade/UF" ou "Cidade, UF" (UF = 2 letras)
  const mUf = str.match(/([A-Za-zÀ-ÿ\s.]+?)[\s,/-]+([A-Z]{2})\s*$/);
  if (mUf?.[1]) return mUf[1].trim().replace(/^[\s,-]+|[\s,-]+$/g, '');
  // Fallback: ultimo segmento separado por virgula
  const parts = str
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 2) return parts[parts.length - 1];
  return '';
}

function _formatRelativeDate(ts) {
  if (!ts) return 'Nunca';
  const diff = Date.now() - ts;
  if (diff < DAYS_30_MS) {
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    if (days === 0) return 'Hoje';
    if (days === 1) return 'Ontem';
    return `${days} dias atrás`;
  }
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  return `${days} dias atrás`;
}

/* ─────────────────────── icone por industria ───────────────────────── */

// Heuristica de palavra-chave → icone. Ordem importa (mais especifico primeiro).
const INDUSTRY_ICONS = [
  {
    keys: ['supermercado', 'mercado', 'atacadista', 'atacarejo'],
    name: 'cart',
    tint: 'orange',
  },
  { keys: ['hotel', 'pousada', 'resort', 'motel'], name: 'building', tint: 'blue' },
  {
    keys: ['restaurante', 'lanchonete', 'pizzaria', 'bar', 'churrascaria'],
    name: 'fork',
    tint: 'red',
  },
  {
    keys: [
      'clinica',
      'clínica',
      'hospital',
      'consultorio',
      'consultório',
      'odonto',
      'farmacia',
      'farmácia',
    ],
    name: 'cross',
    tint: 'teal',
  },
  {
    keys: [
      'industria',
      'indústria',
      'fabrica',
      'fábrica',
      'metalurgica',
      'metalúrgica',
      'manufatura',
    ],
    name: 'factory',
    tint: 'amber',
  },
  {
    keys: ['colegio', 'colégio', 'escola', 'faculdade', 'universidade', 'creche'],
    name: 'school',
    tint: 'violet',
  },
  { keys: ['academia', 'gym', 'fitness'], name: 'dumbbell', tint: 'cyan' },
  { keys: ['posto', 'gasolina'], name: 'fuel', tint: 'red' },
  { keys: ['loja', 'comercio', 'comércio', 'shopping'], name: 'shop', tint: 'cyan' },
];

const INDUSTRY_SVG = {
  cart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/><path d="M3 4h2l2.7 11.4a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.6L21 8H6.5"/></svg>`,
  building: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M9 8h.01M15 8h.01M9 12h.01M15 12h.01M9 16h.01M15 16h.01"/><path d="M10 21v-4h4v4"/></svg>`,
  fork: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 2v8a3 3 0 0 0 6 0V2M10 14v8M17 2c-2 0-3 2-3 5 0 2 1 3 2 3.5V22"/></svg>`,
  cross: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M12 8v8M8 12h8"/></svg>`,
  factory: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21V11l5 3V11l5 3V11l5 3v7H3z"/><path d="M7 17h.01M11 17h.01M15 17h.01"/></svg>`,
  school: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9l10-5 10 5-10 5L2 9z"/><path d="M6 11v5a6 6 0 0 0 12 0v-5"/></svg>`,
  dumbbell: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8v8M3 10v4M21 10v4M18 8v8M6 12h12"/></svg>`,
  fuel: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16M3 21h11M14 13l3-3v7a1.5 1.5 0 0 0 3 0V8l-3-3"/></svg>`,
  shop: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l1.5-5h15L21 9M3 9v10a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V9M3 9h18M9 14h6"/></svg>`,
};

function _industryFor(cliente) {
  const haystack = `${cliente.nome || ''} ${cliente.razaoSocial || ''}`.toLowerCase();
  for (const entry of INDUSTRY_ICONS) {
    if (entry.keys.some((k) => haystack.includes(k))) return entry;
  }
  return { name: 'building', tint: 'cyan' };
}

/* ─────────────────────── icones genericos ──────────────────────────── */

const ICON_USERS = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
const ICON_MONITOR = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>`;
const ICON_WRENCH = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14.7 6.3 3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 0 3 3l6.91-6.91a6 6 0 0 0 7.94-7.94l-3.77 3.77-3-3Z"/></svg>`;
const ICON_CALENDAR = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>`;
const ICON_ALERT = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
const ICON_PIN = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`;
const ICON_CHEV_R = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 6 15 12 9 18"/></svg>`;
const ICON_CHEV_L = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 6 9 12 15 18"/></svg>`;
const ICON_KEBAB = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>`;
const ICON_PLUS = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
const ICON_SEARCH = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>`;
const ICON_FILTER = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="4" y1="6" x2="20" y2="6"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="10" y1="18" x2="14" y2="18"/></svg>`;
const ICON_MONITOR_SM = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>`;
const ICON_CLOCK_SM = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`;
const ICON_PEN = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4l6 6-11 11H3v-6L14 4z"/></svg>`;

/* ─────────────────────── KPIs ──────────────────────────────────────── */

function _renderKpis({ clientes, equipamentos, registros, indexed }) {
  const totalClientes = clientes.length;
  const ativos = Array.from(indexed.values()).filter((d) => d.status === 'ativo').length;
  const ativosPercent = totalClientes ? Math.round((ativos / totalClientes) * 100) : 0;
  const totalEquips = equipamentos.length;

  // Equipamentos cadastrados este mes
  const startMonth = new Date();
  startMonth.setDate(1);
  startMonth.setHours(0, 0, 0, 0);
  const equipsThisMonth = equipamentos.filter((e) => {
    const ts = e.criadoEm || e.createdAt || 0;
    return new Date(ts).getTime() >= startMonth.getTime();
  }).length;

  // Servicos este mes (todos os registros)
  const servicosMes = registros.filter((r) => {
    const ts = r.data ? new Date(r.data).getTime() : 0;
    return ts >= startMonth.getTime();
  }).length;

  // Servicos do mes anterior pra calcular variacao
  const startPrevMonth = new Date(startMonth);
  startPrevMonth.setMonth(startPrevMonth.getMonth() - 1);
  const servicosPrevMonth = registros.filter((r) => {
    const ts = r.data ? new Date(r.data).getTime() : 0;
    return ts >= startPrevMonth.getTime() && ts < startMonth.getTime();
  }).length;
  let trendLabel = '—';
  let trendTone = 'neutral';
  if (servicosPrevMonth === 0 && servicosMes > 0) {
    trendLabel = 'novo este mês';
    trendTone = 'up';
  } else if (servicosPrevMonth > 0) {
    const delta = Math.round(((servicosMes - servicosPrevMonth) / servicosPrevMonth) * 100);
    trendLabel = `${delta >= 0 ? '+' : ''}${delta}% vs mês anterior`;
    trendTone = delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral';
  }

  // Manutencoes pendentes = clientes com status sem_manutencao OU precisa_atencao
  const pendentes = Array.from(indexed.values()).filter((d) => d.status !== 'ativo').length;

  return `
    <div class="cli-kpis">
      <article class="cli-kpi cli-kpi--users">
        <span class="cli-kpi__icon" aria-hidden="true">${ICON_USERS}</span>
        <div class="cli-kpi__body">
          <div class="cli-kpi__label">Clientes ativos</div>
          <div class="cli-kpi__value">${ativos}</div>
          <div class="cli-kpi__sub cli-kpi__sub--ok">${ativosPercent}% ativos</div>
        </div>
      </article>
      <article class="cli-kpi cli-kpi--equips">
        <span class="cli-kpi__icon" aria-hidden="true">${ICON_MONITOR}</span>
        <div class="cli-kpi__body">
          <div class="cli-kpi__label">Equipamentos</div>
          <div class="cli-kpi__value">${totalEquips}</div>
          <div class="cli-kpi__sub">${equipsThisMonth > 0 ? `+${equipsThisMonth} este mês` : 'sem novos este mês'}</div>
        </div>
      </article>
      <article class="cli-kpi cli-kpi--services">
        <span class="cli-kpi__icon" aria-hidden="true">${ICON_WRENCH}</span>
        <div class="cli-kpi__body">
          <div class="cli-kpi__label">Serviços este mês</div>
          <div class="cli-kpi__value">${servicosMes}</div>
          <div class="cli-kpi__sub cli-kpi__sub--${trendTone}">${trendLabel}</div>
        </div>
      </article>
      <article class="cli-kpi cli-kpi--pending">
        <span class="cli-kpi__icon" aria-hidden="true">${ICON_CALENDAR}</span>
        <div class="cli-kpi__body">
          <div class="cli-kpi__label">Manutenções pendentes</div>
          <div class="cli-kpi__value">${pendentes}</div>
          <div class="cli-kpi__sub cli-kpi__sub--${pendentes > 0 ? 'warn' : 'ok'}">${pendentes > 0 ? 'Requerem atenção' : 'Tudo em dia'}</div>
        </div>
      </article>
    </div>`;
}

/* ─────────────────────── alert strip ───────────────────────────────── */

function _renderAlertStrip({ indexed }) {
  const semManutencao = Array.from(indexed.values()).filter(
    (d) => d.status === 'sem_manutencao' || d.status === 'precisa_atencao',
  ).length;
  if (!semManutencao) return '';
  return `
    <div class="cli-alert" role="status">
      <span class="cli-alert__icon" aria-hidden="true">${ICON_ALERT}</span>
      <div class="cli-alert__body">
        <div class="cli-alert__title">${semManutencao} cliente${semManutencao !== 1 ? 's' : ''} sem manutenção há mais de 60 dias</div>
        <div class="cli-alert__desc">Mantenha a regularidade e evite falhas nos equipamentos.</div>
      </div>
      <button type="button" class="cli-alert__cta" data-cli-action="filter-pending">
        Ver clientes
        <span aria-hidden="true">${ICON_CHEV_R}</span>
      </button>
    </div>`;
}

/* ─────────────────────── filters bar ───────────────────────────────── */

function _renderFilters({ cities }) {
  const cityOptions = ['todas', ...Array.from(new Set(cities)).filter(Boolean).sort()];
  return `
    <div class="cli-filters">
      <label class="cli-search">
        <span class="cli-search__icon" aria-hidden="true">${ICON_SEARCH}</span>
        <input type="search" class="cli-search__input" id="cli-search-input"
          placeholder="Buscar por nome, CNPJ, endereço..."
          aria-label="Buscar cliente"
          value="${Utils.escapeAttr(_searchTerm)}" />
      </label>
      <label class="cli-select">
        <span class="cli-select__label">Status</span>
        <select id="cli-status-filter" class="cli-select__input" aria-label="Filtrar por status">
          <option value="todos" ${_statusFilter === 'todos' ? 'selected' : ''}>Todos</option>
          <option value="ativo" ${_statusFilter === 'ativo' ? 'selected' : ''}>Ativos</option>
          <option value="sem_manutencao" ${_statusFilter === 'sem_manutencao' ? 'selected' : ''}>Sem manutenção</option>
          <option value="precisa_atencao" ${_statusFilter === 'precisa_atencao' ? 'selected' : ''}>Precisa atenção</option>
        </select>
      </label>
      <label class="cli-select">
        <span class="cli-select__label">Cidade</span>
        <select id="cli-city-filter" class="cli-select__input" aria-label="Filtrar por cidade">
          ${cityOptions
            .map((c) => {
              const label = c === 'todas' ? 'Todas' : c;
              return `<option value="${Utils.escapeAttr(c)}" ${_cityFilter === c ? 'selected' : ''}>${Utils.escapeHtml(label)}</option>`;
            })
            .join('')}
        </select>
      </label>
      <label class="cli-select">
        <span class="cli-select__label">Ordenar por</span>
        <select id="cli-sort" class="cli-select__input" aria-label="Ordenar lista">
          <option value="mais_ativos" ${_sortBy === 'mais_ativos' ? 'selected' : ''}>Mais ativos</option>
          <option value="recente" ${_sortBy === 'recente' ? 'selected' : ''}>Manutenção recente</option>
          <option value="antigo" ${_sortBy === 'antigo' ? 'selected' : ''}>Manutenção antiga</option>
          <option value="nome" ${_sortBy === 'nome' ? 'selected' : ''}>Nome (A-Z)</option>
          <option value="equips" ${_sortBy === 'equips' ? 'selected' : ''}>Mais equipamentos</option>
        </select>
      </label>
      <button type="button" class="cli-filters__reset" data-cli-action="clear-filters"
        aria-label="Limpar filtros" title="Limpar filtros">${ICON_FILTER}</button>
    </div>`;
}

/* ─────────────────────── card de cliente ───────────────────────────── */

function _statusPill(status) {
  if (status === 'ativo') return `<span class="cli-card__pill cli-card__pill--ok">Ativo</span>`;
  if (status === 'sem_manutencao')
    return `<span class="cli-card__pill cli-card__pill--warn">Sem manutenção</span>`;
  return `<span class="cli-card__pill cli-card__pill--danger">Precisa atenção</span>`;
}

function _lastServiceClass(sinceLast) {
  if (!Number.isFinite(sinceLast)) return 'cli-stat__value--danger';
  if (sinceLast > DAYS_60_MS) return 'cli-stat__value--danger';
  if (sinceLast > DAYS_30_MS) return 'cli-stat__value--warn';
  return 'cli-stat__value--ok';
}

function _renderCard(cliente, data) {
  const safeId = Utils.escapeAttr(cliente.id);
  const nome = Utils.escapeHtml(cliente.nome || 'Cliente');
  const razao = cliente.razaoSocial ? Utils.escapeHtml(cliente.razaoSocial) : '';
  const cnpj = cliente.cnpj ? Utils.escapeHtml(formatCnpjOrCpf(cliente.cnpj)) : '';
  const subline = [razao, cnpj].filter(Boolean).join('  ·  ');

  const industry = _industryFor(cliente);
  const enderecoStr = cliente.endereco
    ? Utils.escapeHtml(cliente.endereco)
    : 'Endereço não informado';
  const cityStr = data.displayCity ? `<br>${Utils.escapeHtml(data.displayCity)}` : '';

  const equipsLabel = data.equipsCount;
  const servicesLabel = data.servicesCount;
  const lastLabel = _formatRelativeDate(data.lastServiceTs);
  const lastClass = _lastServiceClass(data.sinceLast);

  return `
    <article class="cli-card" data-id="${safeId}" role="listitem"
      tabindex="0" aria-label="Cliente ${nome}">
      <header class="cli-card__head">
        <span class="cli-card__icon cli-card__icon--${industry.tint}" aria-hidden="true">
          ${INDUSTRY_SVG[industry.name]}
        </span>
        <div class="cli-card__title-wrap">
          <h3 class="cli-card__name">${nome}</h3>
          ${subline ? `<div class="cli-card__sub">${subline}</div>` : ''}
        </div>
        ${_statusPill(data.status)}
        <button type="button" class="cli-card__kebab"
          data-cli-action="card-menu" data-id="${safeId}"
          aria-label="Mais ações para ${nome}" title="Mais ações">
          ${ICON_KEBAB}
        </button>
      </header>

      <div class="cli-card__address">
        <span class="cli-card__address-icon" aria-hidden="true">${ICON_PIN}</span>
        <span>${enderecoStr}${cityStr}</span>
      </div>

      <div class="cli-card__stats">
        <div class="cli-stat">
          <div class="cli-stat__value">${equipsLabel}</div>
          <div class="cli-stat__label">Equipamentos</div>
        </div>
        <div class="cli-stat">
          <div class="cli-stat__value">${servicesLabel}</div>
          <div class="cli-stat__label">Serviços</div>
        </div>
        <div class="cli-stat">
          <div class="cli-stat__value ${lastClass}">${lastLabel}</div>
          <div class="cli-stat__label">Última manutenção</div>
        </div>
      </div>

      <footer class="cli-card__actions">
        <button type="button" class="cli-card__action cli-card__action--primary"
          data-cli-action="ver-equipamentos" data-id="${safeId}">
          ${ICON_MONITOR_SM}<span>Ver equipamentos</span>
        </button>
        <button type="button" class="cli-card__action cli-card__action--secondary"
          data-cli-action="ver-servicos" data-id="${safeId}">
          ${ICON_CLOCK_SM}<span>Ver serviços</span>
        </button>
        <button type="button" class="cli-card__action cli-card__action--ghost"
          data-cli-action="edit" data-id="${safeId}">
          ${ICON_PEN}<span>Editar</span>
        </button>
      </footer>
    </article>`;
}

/* ─────────────────────── empty/loading ─────────────────────────────── */

function _emptyStateHtml() {
  return `
    <section class="cli-empty" aria-label="Nenhum cliente">
      <div class="cli-empty__art" aria-hidden="true">${ICON_USERS}</div>
      <h3 class="cli-empty__title">Nenhum cliente cadastrado</h3>
      <p class="cli-empty__sub">
        Cadastre clientes pra organizar os equipamentos por carteira e gerar
        relatórios PMOC formais.
      </p>
      <button type="button" class="cli-empty__cta"
        data-action="open-cliente-modal" data-mode="create">
        ${ICON_PLUS}<span>Cadastrar primeiro cliente</span>
      </button>
    </section>`;
}

function _emptyFilterHtml() {
  const term = Utils.escapeHtml(_searchTerm || '');
  const hint = term ? `para "${term}"` : 'com os filtros atuais';
  return `
    <div class="cli-empty cli-empty--filter">
      <p class="cli-empty__sub">Nenhum cliente encontrado ${hint}.</p>
      <button type="button" class="cli-empty__cta cli-empty__cta--ghost"
        data-cli-action="clear-filters">Limpar filtros</button>
    </div>`;
}

/* ─────────────────────── paginacao ─────────────────────────────────── */

function _renderPagination(filteredCount) {
  const totalPages = Math.max(1, Math.ceil(filteredCount / _pageSize));
  if (filteredCount === 0) return '';
  const from = (_currentPage - 1) * _pageSize + 1;
  const to = Math.min(filteredCount, _currentPage * _pageSize);

  const pageBtns = [];
  for (let p = 1; p <= totalPages; p++) {
    const active = p === _currentPage ? ' is-active' : '';
    pageBtns.push(
      `<button type="button" class="cli-pag__page${active}" data-cli-action="goto-page" data-page="${p}" aria-label="Pagina ${p}" aria-current="${p === _currentPage ? 'page' : 'false'}">${p}</button>`,
    );
  }

  const prevDisabled = _currentPage === 1 ? 'disabled' : '';
  const nextDisabled = _currentPage === totalPages ? 'disabled' : '';

  return `
    <div class="cli-pag">
      <div class="cli-pag__info">Mostrando ${from} a ${to} de ${filteredCount} cliente${filteredCount !== 1 ? 's' : ''}</div>
      <div class="cli-pag__controls">
        <button type="button" class="cli-pag__nav" data-cli-action="prev-page"
          aria-label="Pagina anterior" ${prevDisabled}>${ICON_CHEV_L}</button>
        ${pageBtns.join('')}
        <button type="button" class="cli-pag__nav" data-cli-action="next-page"
          aria-label="Proxima pagina" ${nextDisabled}>${ICON_CHEV_R}</button>
      </div>
      <label class="cli-pag__size">
        <span>Itens por página</span>
        <select id="cli-page-size">
          <option value="6" ${_pageSize === 6 ? 'selected' : ''}>6</option>
          <option value="12" ${_pageSize === 12 ? 'selected' : ''}>12</option>
          <option value="24" ${_pageSize === 24 ? 'selected' : ''}>24</option>
        </select>
      </label>
    </div>`;
}

/* ─────────────────────── filtragem + sort ──────────────────────────── */

function _filterAndSort(clientes, indexed) {
  const term = _searchTerm.trim().toLowerCase();
  let list = clientes;
  if (term) {
    list = list.filter((c) => {
      const haystack = [c.nome, c.razaoSocial, c.cnpj, c.endereco, c.contato]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }
  if (_statusFilter !== 'todos') {
    list = list.filter((c) => indexed.get(c.id)?.status === _statusFilter);
  }
  if (_cityFilter !== 'todas') {
    list = list.filter((c) => indexed.get(c.id)?.displayCity === _cityFilter);
  }
  // Sort
  const dec = (a, b) => b - a;
  const asc = (a, b) => a - b;
  if (_sortBy === 'mais_ativos') {
    list = [...list].sort((a, b) =>
      dec(indexed.get(a.id)?.servicesCount || 0, indexed.get(b.id)?.servicesCount || 0),
    );
  } else if (_sortBy === 'recente') {
    list = [...list].sort((a, b) =>
      dec(indexed.get(a.id)?.lastServiceTs || 0, indexed.get(b.id)?.lastServiceTs || 0),
    );
  } else if (_sortBy === 'antigo') {
    list = [...list].sort((a, b) =>
      asc(indexed.get(a.id)?.lastServiceTs || 0, indexed.get(b.id)?.lastServiceTs || 0),
    );
  } else if (_sortBy === 'nome') {
    list = [...list].sort((a, b) =>
      String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'),
    );
  } else if (_sortBy === 'equips') {
    list = [...list].sort((a, b) =>
      dec(indexed.get(a.id)?.equipsCount || 0, indexed.get(b.id)?.equipsCount || 0),
    );
  }
  return list;
}

/* ─────────────────────── render principal ──────────────────────────── */

export async function renderClientes() {
  const root = document.getElementById('clientes-root');
  if (!root) return;

  // Hidrata clientes na primeira render
  if (!_hydrated) {
    _hydrated = true;
    try {
      await loadClientes();
    } catch (err) {
      console.warn('[clientes] hydrate falhou:', err?.message);
    }
  }

  const { clientes = [], equipamentos = [], registros = [] } = getState();
  const indexed = _indexCliente(clientes, equipamentos, registros);

  // Header sempre visível
  const headerHtml = `
    <header class="cli-page__header">
      <div>
        <h1 class="cli-page__title">Meus clientes</h1>
        <p class="cli-page__sub">Cadastre e gerencie seus clientes, organize equipamentos por carteira e gere relatórios PMOC formais.</p>
      </div>
      <button type="button" class="cli-page__cta"
        data-action="open-cliente-modal" data-mode="create">
        ${ICON_PLUS}<span>Novo cliente</span>
      </button>
    </header>`;

  // Empty inicial (sem clientes cadastrados)
  if (!clientes.length) {
    root.innerHTML = `
      <div class="cli-page">
        ${headerHtml}
        ${_emptyStateHtml()}
      </div>`;
    _bindOnce();
    return;
  }

  const filtered = _filterAndSort(clientes, indexed);
  // Clamp page se filtragem reduzir o total
  const totalPages = Math.max(1, Math.ceil(filtered.length / _pageSize));
  if (_currentPage > totalPages) _currentPage = totalPages;
  const start = (_currentPage - 1) * _pageSize;
  const pageItems = filtered.slice(start, start + _pageSize);

  const cities = clientes.map((c) => indexed.get(c.id)?.displayCity).filter(Boolean);

  const cardsHtml = pageItems.length
    ? pageItems.map((c) => _renderCard(c, indexed.get(c.id))).join('')
    : '';

  root.innerHTML = `
    <div class="cli-page">
      ${headerHtml}
      ${_renderKpis({ clientes, equipamentos, registros, indexed })}
      ${_renderAlertStrip({ indexed })}
      ${_renderFilters({ cities })}
      ${
        pageItems.length
          ? `<div class="cli-grid" role="list">${cardsHtml}</div>`
          : _emptyFilterHtml()
      }
      ${_renderPagination(filtered.length)}
    </div>`;

  _bindOnce();
}

/* ─────────────────────── interactions ──────────────────────────────── */

function _bindOnce() {
  if (_bound) return;
  _bound = true;
  const view = document.getElementById('view-clientes');
  if (!view) return;

  // Input + select changes (delegated)
  view.addEventListener('input', (event) => {
    const input = event.target.closest?.('#cli-search-input');
    if (input) {
      _searchTerm = input.value || '';
      _currentPage = 1;
      // Re-render preservando o foco no input
      const cursorPos = input.selectionStart;
      renderClientes().then(() => {
        const newInput = document.getElementById('cli-search-input');
        if (newInput) {
          newInput.focus();
          if (cursorPos != null) {
            try {
              newInput.setSelectionRange(cursorPos, cursorPos);
            } catch (_e) {
              /* old browser sem suporte */
            }
          }
        }
      });
    }
  });

  view.addEventListener('change', (event) => {
    const sel = event.target;
    if (sel.id === 'cli-status-filter') {
      _statusFilter = sel.value;
      _currentPage = 1;
      renderClientes();
    } else if (sel.id === 'cli-city-filter') {
      _cityFilter = sel.value;
      _currentPage = 1;
      renderClientes();
    } else if (sel.id === 'cli-sort') {
      _sortBy = sel.value;
      renderClientes();
    } else if (sel.id === 'cli-page-size') {
      _pageSize = parseInt(sel.value, 10) || 6;
      _currentPage = 1;
      renderClientes();
    }
  });

  view.addEventListener('click', async (event) => {
    const target = event.target.closest?.('[data-cli-action]');
    if (!target || !view.contains(target)) return;
    const action = target.getAttribute('data-cli-action');
    const id = target.getAttribute('data-id');
    switch (action) {
      case 'goto-page':
        _currentPage = parseInt(target.getAttribute('data-page'), 10) || 1;
        renderClientes();
        break;
      case 'prev-page':
        if (_currentPage > 1) {
          _currentPage--;
          renderClientes();
        }
        break;
      case 'next-page':
        _currentPage++;
        renderClientes();
        break;
      case 'clear-filters':
        _searchTerm = '';
        _statusFilter = 'todos';
        _cityFilter = 'todas';
        _sortBy = 'mais_ativos';
        _currentPage = 1;
        renderClientes();
        break;
      case 'filter-pending':
        _statusFilter = 'sem_manutencao';
        _currentPage = 1;
        renderClientes();
        break;
      case 'edit':
        openClienteModalForId(id);
        break;
      case 'card-menu':
        _openCardMenu(target, id);
        break;
      case 'ver-equipamentos':
        _navigateVerEquipamentos(id);
        break;
      case 'ver-servicos':
        _navigateVerServicos(id);
        break;
      default:
        break;
    }
  });
}

function _openCardMenu(triggerEl, id) {
  // Menu inline simples: usa CustomConfirm pra dar opção de Apagar.
  // Pra "Editar" o user já tem o botão dedicado no card, então o kebab
  // foca no destrutivo + atalhos secundários.
  const cliente = (getState().clientes || []).find((c) => c.id === id);
  if (!cliente) return;
  // Por simplicidade: kebab abre direto o flow de delete confirm.
  // Pode evoluir pra dropdown menu real depois se precisar de mais opções.
  void triggerEl;
  confirmDeleteCliente(id);
}

function _navigateVerEquipamentos(id) {
  const cliente = (getState().clientes || []).find((c) => c.id === id);
  if (!cliente) return;
  goTo('equipamentos', { equipCtx: { clienteId: id, clienteNome: cliente.nome } });
}

function _navigateVerServicos(id) {
  const cliente = (getState().clientes || []).find((c) => c.id === id);
  if (!cliente) return;
  goTo('historico', { clienteId: id, clienteNome: cliente.nome });
}

/* ─────────────────────── search public api ─────────────────────────── */

export function setClientesSearch(term) {
  _searchTerm = String(term || '');
  _currentPage = 1;
  renderClientes();
}

/* ─────────────────────── delete / select ───────────────────────────── */

export async function confirmDeleteCliente(id) {
  const cliente = (getState().clientes || []).find((c) => c.id === id);
  if (!cliente) return;
  const equipsCount = (getState().equipamentos || []).filter((e) => e.clienteId === id).length;

  const message = equipsCount
    ? `${equipsCount} equipamento${equipsCount !== 1 ? 's' : ''} vinculado${equipsCount !== 1 ? 's' : ''} a este cliente ficará${equipsCount !== 1 ? 'ão' : ''} sem cliente (não serão apagados). Continuar?`
    : 'Apagar este cliente? Esta ação não pode ser desfeita.';

  const ok = await CustomConfirm.show('Apagar cliente', message, {
    confirmLabel: 'Apagar',
    cancelLabel: 'Cancelar',
    tone: 'danger',
    focus: 'cancel',
  });
  if (!ok) return;

  try {
    await deleteCliente(id);
    Toast.success('Cliente apagado.');
    renderClientes();
  } catch (error) {
    handleError(error, {
      code: ErrorCodes.SYNC_FAILED,
      message: 'Não foi possível apagar o cliente.',
      context: { action: 'clientes.confirmDeleteCliente', id },
    });
  }
}

/**
 * Popula o select #eq-cliente do modal-add-eq. Esconde o wrapper inteiro
 * quando não há clientes cadastrados.
 */
export async function populateClienteSelect() {
  const wrapper = Utils.getEl('eq-cliente-wrapper');
  const select = Utils.getEl('eq-cliente');
  if (!wrapper || !select) return;

  if (!_hydrated) {
    _hydrated = true;
    try {
      await loadClientes();
    } catch (err) {
      console.warn('[clientes] populateClienteSelect hydrate falhou:', err?.message);
    }
  }

  const { clientes = [] } = getState();
  if (!clientes.length) {
    wrapper.style.display = 'none';
    return;
  }
  wrapper.style.display = '';
  const current = select.value;
  select.innerHTML = `
    <option value="">— Sem cliente vinculado —</option>
    ${clientes
      .map((c) => `<option value="${Utils.escapeAttr(c.id)}">${Utils.escapeHtml(c.nome)}</option>`)
      .join('')}`;
  if (current) select.value = current;
}

/**
 * Abre o ClienteModal em modo edicao para um cliente especifico (por id).
 * Usado pelo clienteHandlers (kebab menu, edit action) e pelo card "Editar"
 * dentro da view. Se o cliente nao existir mais, mostra Toast e cancela.
 */
export function openClienteModalForId(id) {
  const cliente = (getState().clientes || []).find((c) => c.id === id);
  if (!cliente) {
    Toast.warning('Cliente nao encontrado.');
    return;
  }
  ClienteModal.openEdit(cliente, { onSaved: () => renderClientes() });
}
