/**
 * CoolTrack Pro - UI Module v3.3 (UX Premium Complete)
 * 
 * Melhorias implementadas:
 * - Toast Notification System (substituiu alert())
 * - Modal UX Premium (focus automático, ESC, Tab trap, animação scale)
 * - Theme Toggle (Dark/Light mode com localStorage)
 * - Validação Visual em Tempo Real (bordas coloridas + progress bar)
 * - Busca Inteligente (destaque mark, botão limpar, contador)
 * - View Transitions (fadeIn + translateX suaves)
 * - KPI Cards com Contexto (comparação mensal + sparklines)
 */

import { Utils, TIPO_ICON, STATUS_LABEL } from "./utils.js";
import { getState, findEquip, lastRegForEquip, regsForEquip, setState } from "./state.js";
import { Charts } from './charts.js';
import { PDFGenerator } from './pdf.js';
import { Toast } from './toast.js'; // ✅ NOVO: Toast System

function compressImage(file, maxWidth = 1200, quality = 0.7) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas"); let width = img.width; let height = img.height;
        if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth; }
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ════════════════════════════════════════════════════════
// MODAL (UX Premium - Focus Auto, ESC, Tab Trap, Scale Anim)
// ════════════════════════════════════════════════════════
export const Modal = {
  /**
   * Abre modal com UX Premium:
   * - Focus automático no primeiro input
   * - Esc fecha modal
   * - Tab trap (não sai do modal com Tab)
   * - Animação scale(0.95) → scale(1)
   */
  open(id) {
    const modalEl = Utils.getEl(id);
    if (!modalEl) return;

    // Adiciona classe de abertura
    modalEl.classList.add('is-open');
    
    // Remove estado de fechamento se existir
    const modalContent = modalEl.querySelector('.modal');
    if (modalContent) {
      modalContent.classList.remove('is-closing');
    }

    // Focus automático no primeiro input/select/textarea após animação
    setTimeout(() => {
      const firstInput = modalEl.querySelector('.form-control');
      if (firstInput) {
        firstInput.focus();
      }
    }, 100);

    // Tab Trap: previne sair do modal com Tab
    this._enableTabTrap(modalEl);
  },

  /**
   * Fecha modal com animação reversa
   */
  close(id) {
    const modalEl = Utils.getEl(id);
    if (!modalEl) return;

    const modalContent = modalEl.querySelector('.modal');
    
    // Adiciona animação de fechamento
    if (modalContent) {
      modalContent.classList.add('is-closing');
      
      // Remove is-open após animação completar
      setTimeout(() => {
        modalEl.classList.remove('is-open');
        modalContent.classList.remove('is-closing');
        this._disableTabTrap(modalEl);
      }, 200);
    } else {
      modalEl.classList.remove('is-open');
    }
  },

  init() {
    // Fecha ao clicar no backdrop
    document.querySelectorAll(".modal-overlay").forEach((el) => {
      el.addEventListener("click", (e) => {
        if (e.target === el) this.close(el.id);
      });

      // Fecha com tecla ESC
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && el.classList.contains('is-open')) {
          this.close(el.id);
        }
      });
    });
  },

  /**
   * Habilita Tab Trap: mantém foco dentro do modal
   */
  _enableTabTrap(modalEl) {
    const focusableElements = modalEl.querySelectorAll(
      'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-"])'
    );
    
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    this._tabTrapHandler = (e) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        // Shift + Tab: se está no primeiro, vai para o último
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: se está no último, vai para o primeiro
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    modalEl.addEventListener('keydown', this._tabTrapHandler);
  },

  /**
   * Desabilita Tab Trap
   */
  _disableTabTrap(modalEl) {
    if (this._tabTrapHandler) {
      modalEl.removeEventListener('keydown', this._tabTrapHandler);
      this._tabTrapHandler = null;
    }
  }
};

// ════════════════════════════════════════════════════════
// CUSTOM CONFIRM DIALOG
// ════════════════════════════════════════════════════════
export const CustomConfirm = {
  show(title, msg) {
    return new Promise((resolve) => {
      const modal = Utils.getEl('modal-confirm');
      Utils.getEl('confirm-title').textContent = title;
      Utils.getEl('confirm-msg').textContent = msg;
      modal.classList.add('is-open');
      const cleanup = (val) => { modal.classList.remove('is-open'); yesBtn.removeEventListener('click', onYes); noBtn.removeEventListener('click', onNo); resolve(val); };
      const onYes = () => cleanup(true); const onNo = () => cleanup(false);
      const yesBtn = Utils.getEl('confirm-yes'); const noBtn = Utils.getEl('confirm-no');
      yesBtn.addEventListener('click', onYes); noBtn.addEventListener('click', onNo);
    });
  }
};

// ════════════════════════════════════════════════════════
// PHOTOS MODULE
// ════════════════════════════════════════════════════════
export const Photos = {
  pending: [],
  async add(input) {
    const files = Array.from(input.files || []); if (!files.length) return;
    const dropText = Utils.getEl('photo-drop-text'); const dropZone = Utils.getEl('photo-drop-zone');
    if (dropZone) dropZone.style.pointerEvents = 'none';
    if (dropText) dropText.textContent = `Processando ${files.length} foto(s)...`;
    for (const file of files) { try { this.pending.push(await compressImage(file)); this.render(); } catch (e) { Toast.error("Erro ao processar foto."); } } // ✅ Toast em vez de alert
    if (dropText) dropText.textContent = 'Toque para adicionar fotos';
    if (dropZone) dropZone.style.pointerEvents = 'auto';
    input.value = "";
  },
  remove(i) { this.pending.splice(i, 1); this.render(); },
  clear() { this.pending = []; this.render(); },
  openLightbox(src) { Utils.getEl("lightbox-img").src = src; Utils.getEl("lightbox").classList.add("is-open"); },
  closeLightbox() { Utils.getEl("lightbox").classList.remove("is-open"); },
  render() {
    const c = Utils.getEl("photo-preview"); if (!c) return; c.innerHTML = "";
    const f = document.createDocumentFragment();
    this.pending.forEach((src, i) => {
      const card = document.createElement("div"); card.className = "photo-thumb";
      const img = document.createElement("img"); img.src = src; img.addEventListener("click", () => this.openLightbox(src));
      const btn = document.createElement("button"); btn.className = "photo-thumb__remove"; btn.textContent = "✕";
      btn.addEventListener("click", () => this.remove(i));
      card.append(img, btn); f.appendChild(card);
    });
    c.appendChild(f);
  },
};

// ════════════════════════════════════════════════════════
// ALERTS MODULE
// ════════════════════════════════════════════════════════
export const Alerts = {
  getAll() {
    const { registros, equipamentos } = getState(); const today = new Date(); today.setHours(0, 0, 0, 0);
    const in7 = new Date(today); in7.setDate(in7.getDate() + 7);
    const dueByEquip = new Map();
    registros.forEach((r) => { if (!r.proxima) return; const d = new Date(`${r.proxima}T00:00:00`); if (Number.isNaN(d.getTime())) return; const current = dueByEquip.get(r.equipId); if (!current || d < current.date) dueByEquip.set(r.equipId, { date: d, reg: r }); });
    const list = [];
    dueByEquip.forEach(({ date, reg }) => { if (date < today) list.push({ kind: "overdue", reg }); else if (date <= in7) list.push({ kind: "upcoming", reg }); });
    equipamentos.filter((e) => e.status === "danger").forEach((eq) => list.push({ kind: "critical", eq }));
    return list;
  },
};

function empty(icon, msg, sub = "") { return `<div class="empty-state"><div class="empty-state__icon">${icon}</div><div class="empty-state__title">${msg}</div>${sub ? `<div class="empty-state__sub">${sub}</div>` : ""}</div>`; }

function calcHealthScore(eqId) {
  const eq = findEquip(eqId); if (!eq) return 0; let score = 100; const lastReg = lastRegForEquip(eqId);
  if (eq.status === "warn") score -= 20; if (eq.status === "danger") score -= 50;
  if (lastReg) { const days = Utils.daysDiff(lastReg.data.slice(0, 10)) * -1; if (days > 90) score -= 25; else if (days > 60) score -= 15; else if (days > 30) score -= 10; } else score -= 30;
  if (lastReg?.proxima && Utils.daysDiff(lastReg.proxima) < 0) score -= 20;
  return Math.max(0, Math.min(100, score));
}
function getHealthClass(score) { return score >= 80 ? 'ok' : score >= 50 ? 'warn' : 'danger'; }

export function updateHeader() {
  const { equipamentos, registros } = getState(); const today = new Date(); const iniMes = new Date(today.getFullYear(), today.getMonth(), 1);
  const alertCount = Alerts.getAll().length; const mesCount = registros.filter((r) => new Date(r.data) >= iniMes).length;
  Utils.getEl("hdr-date").textContent = today.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" }).toUpperCase();
  Utils.getEl("hst-total").textContent = equipamentos.length || "—"; Utils.getEl("hst-mes").textContent = mesCount || "—"; Utils.getEl("hst-alert").textContent = alertCount || "—";
  Utils.getEl("hst-mes-bento").textContent = mesCount || "—"; Utils.getEl("hst-alert-bento").textContent = alertCount || "—";
  const badge = Utils.getEl("alerta-badge"); badge.textContent = String(alertCount); badge.classList.toggle("is-visible", alertCount > 0);
  renderGlobalHealthScore();
}

function renderGlobalHealthScore() {
  const { equipamentos } = getState(); const el = Utils.getEl("hst-health"); const barEl = Utils.getEl("health-bar-fill");
  if (!equipamentos.length) { el.textContent = "—"; if (barEl) barEl.style.width = "0%"; return; }
  const avg = Math.round(equipamentos.reduce((acc, eq) => acc + calcHealthScore(eq.id), 0) / equipamentos.length); const cls = getHealthClass(avg);
  el.textContent = avg;
  el.className = `bento-kpi__value bento-kpi__value--${cls}`;
  if (barEl) { barEl.style.width = `${avg}%`; barEl.className = `health-bar__fill health-bar__fill--${cls}`; }
}

export function populateSelects() {
  const { equipamentos, tecnicos } = getState();
  const opts = equipamentos.map((e) => `<option value="${e.id}">${Utils.escapeHtml(e.nome)} — ${Utils.escapeHtml(e.local)}</option>`).join("");
  [{ id: "r-equip", prefix: '<option value="">Selecione...</option>' }, { id: "hist-equip", prefix: '<option value="">Todos os equipamentos</option>' }, { id: "rel-equip", prefix: '<option value="">Todos</option>' }]
    .forEach(({ id, prefix }) => { const el = Utils.getEl(id); if (el) el.innerHTML = prefix + opts; });
  const tecDatalist = Utils.getEl("lista-tecnicos");
  if (tecDatalist) tecDatalist.innerHTML = (tecnicos || []).map((t) => `<option value="${Utils.escapeHtml(t)}">`).join("");
}

function equipCardHtml(eq, { showLocal = true } = {}) {
  const icon = TIPO_ICON[eq.tipo] ?? "⚙️"; const last = lastRegForEquip(eq.id); const score = calcHealthScore(eq.id);
  const nameClass = eq.status === 'danger' ? 'equip-card__name equip-card__name--danger' : 'equip-card__name';
  return `<div class="equip-card equip-card--${eq.status}" data-action="view-equip" data-id="${eq.id}">
    <div class="equip-card__icon">${icon}</div>
    <div class="equip-card__body">
      <div class="${nameClass}">${Utils.escapeHtml(eq.nome)}</div>
      ${showLocal ? `<div class="equip-card__local">📍 ${Utils.escapeHtml(eq.local)}</div>` : ""}
      <div class="equip-card__tag">${Utils.escapeHtml(eq.tag || eq.tipo)} · ${Utils.escapeHtml(eq.fluido || "")}</div>
      ${last ? `<div class="equip-card__last">Últ: ${Utils.formatDatetime(last.data)}</div>` : ""}
      <div class="equip-health-mini"><div class="equip-health-mini__bar" style="width: ${score}%; background: var(--${getHealthClass(score)})"></div><span class="equip-health-mini__val">${score}%</span></div>
    </div>
    <div class="equip-card__actions"><button class="equip-card__delete" data-action="delete-equip" data-id="${eq.id}" title="Excluir equipamento" aria-label="Excluir equipamento"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg></button></div>
    <span class="badge badge--${eq.status}"><span class="status-dot status-dot--${eq.status}"></span>${STATUS_LABEL[eq.status]}</span>
  </div>`;
}

export function renderEquip(filtro = "") {
  const { equipamentos } = getState(); const q = filtro.toLowerCase();
  const list = equipamentos.filter((e) => !q || e.nome.toLowerCase().includes(q) || e.local.toLowerCase().includes(q));
  const el = Utils.getEl("lista-equip");
  if (!list.length) { el.innerHTML = empty("🔧", "Nenhum equipamento"); return; }
  el.innerHTML = list.map((eq) => equipCardHtml(eq)).join("");
}

function alertCardHtml({ kind, reg, eq }) {
  if (kind === "critical") return `<div class="alert-card alert-card--critical" data-nav="alertas"><span class="alert-card__icon">🚨</span><div><div class="alert-card__title">Equipamento fora de operação</div><div class="alert-card__sub">Requer intervenção imediata</div><div class="alert-card__equip">${Utils.escapeHtml(eq.nome)} · ${Utils.escapeHtml(eq.local)}</div></div></div>`;
  const equip = findEquip(reg.equipId);
  if (kind === "overdue") return `<div class="alert-card alert-card--critical" data-nav="alertas"><span class="alert-card__icon">🔴</span><div><div class="alert-card__title">Manutenção VENCIDA</div><div class="alert-card__sub">${Utils.escapeHtml(reg.tipo)}</div><div class="alert-card__equip">${Utils.escapeHtml(equip?.nome ?? "—")}</div></div></div>`;
  return `<div class="alert-card" data-nav="alertas"><span class="alert-card__icon">⚠️</span><div><div class="alert-card__title">Manutenção em ${Utils.daysDiff(reg.proxima)} dia(s)</div><div class="alert-card__sub">${Utils.escapeHtml(reg.tipo)}</div><div class="alert-card__equip">${Utils.escapeHtml(equip?.nome ?? "—")}</div></div></div>`;
}

function renderStatusChart() {
  setTimeout(() => {
    Charts.refreshAll();
  }, 50);
}

export function renderInicio() {
  Utils.getEl("dash-greeting").textContent = `👋 ${Utils.getGreeting()}!`;
  const { equipamentos, registros } = getState();
  if (equipamentos.length === 0) { Utils.getEl("dash-alertas-mini").innerHTML = ''; Utils.getEl("dash-criticos").innerHTML = ''; Utils.getEl("dash-recentes").innerHTML = ''; Utils.getEl("dash-chart-status").innerHTML = ''; document.querySelector('.dashboard-bento').innerHTML = empty("📦", "Nenhum equipamento cadastrado", `<button class="btn btn--primary" data-action="open-modal" data-id="modal-add-eq" style="width: auto; margin-top: 16px;">+ Cadastrar Primeiro</button>`); return; }
  Utils.getEl("dash-alertas-mini").innerHTML = Alerts.getAll().slice(0, 2).map((a) => alertCardHtml(a)).join("");
  const recent = [...registros].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 3);
  Utils.getEl("dash-recentes").innerHTML = recent.length ? recent.map((r) => { const eq = findEquip(r.equipId); return `<article class="card recent-card" data-nav="historico"><div class="recent-card__date">${Utils.formatDatetime(r.data)}</div><div class="recent-card__title">${Utils.escapeHtml(r.tipo)}</div><div class="recent-card__equip">${Utils.escapeHtml(eq?.nome ?? "—")}</div><div class="recent-card__obs">${Utils.escapeHtml(Utils.truncate(r.obs, 60))}</div></article>`; }).join("") : empty("📭", "Nenhum registro", "Faça seu primeiro lançamento");
  const critical = equipamentos.filter((e) => e.status !== "ok");
  Utils.getEl("dash-criticos").innerHTML = critical.length ? critical.map((eq) => equipCardHtml(eq, { showLocal: true })).join("") : empty("✅", "Todos normais");
  renderStatusChart();
}

export function renderHist() {
  const { registros } = getState(); const busca = Utils.getVal("hist-busca").toLowerCase(); const filtEq = Utils.getVal("hist-equip");
  let list = [...registros].sort((a, b) => b.data.localeCompare(a.data));
  if (filtEq) list = list.filter(r => r.equipId === filtEq);
  if (busca) list = list.filter((r) => { const eq = findEquip(r.equipId); return r.obs.toLowerCase().includes(busca) || r.tipo.toLowerCase().includes(busca) || (eq?.nome || "").toLowerCase().includes(busca); });
  const el = Utils.getEl("timeline");
  if (!list.length) { el.innerHTML = empty("📭", "Nenhum registro"); return; }
  el.innerHTML = `<div class="timeline">${list.map((r) => { const eq = findEquip(r.equipId); const dotMod = r.status !== "ok" ? `timeline__dot--${r.status}` : ""; return `<div class="timeline__item"><div class="timeline__dot ${dotMod}"></div><div class="timeline__item-inner"><div class="timeline__item-body"><div class="timeline__date">${Utils.formatDatetime(r.data)}</div><div class="timeline__title">${Utils.escapeHtml(r.tipo)}</div><div class="timeline__equip">📍 ${Utils.escapeHtml(eq?.name ?? "—")} · ${Utils.escapeHtml(eq?.local ?? "")}</div><div class="timeline__obs">${Utils.escapeHtml(r.obs)}</div>${r.pecas ? `<div class="timeline__parts">🔩 ${Utils.escapeHtml(r.pecas)}</div>` : ""}${r.tecnico ? `<div class="timeline__parts">👷 ${Utils.escapeHtml(r.tecnico)}</div>` : ""}${r.proxima ? `<div class="timeline__next">📅 Próxima: ${Utils.formatDate(r.proxima)}</div>` : ""}</div><button class="timeline__delete" data-action="delete-reg" data-id="${r.id}" aria-label="Excluir registro"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg></button></div></div>`; }).join("")}</div>`;
}

export function renderAlertas() { const list = Alerts.getAll(); Utils.getEl("lista-alertas").innerHTML = list.length ? list.map(alertCardHtml).join("") : empty("✅", "Tudo em dia!", "Nenhuma manutenção pendente"); }

export function renderRelatorio() {
  const { registros } = getState(); const filtEq = Utils.getVal("rel-equip"); const de = Utils.getVal("rel-de"); const ate = Utils.getVal("rel-ate");
  let list = [...registros].sort((a, b) => b.data.localeCompare(a.data));
  if (filtEq) list = list.filter((r) => r.equipId === filtEq); if (de) list = list.filter((r) => r.data >= de); if (ate) list = list.filter((r) => r.data <= `${ate}T23:59`);
  const el = Utils.getEl("relatorio-corpo");
  if (!list.length) { el.innerHTML = empty("📭", "Sem registros no período"); return; }
  const today = new Date().toLocaleDateString("pt-BR");
  el.innerHTML = `<div class="card"><div class="report-header">RELATÓRIO DE MANUTENÇÃO</div><div class="report-meta">🏥 Hospital · Gerado em ${today} · ${list.length} registro(s)</div></div>${list.map((r) => { const eq = findEquip(r.equipId); return `<div class="card report-record"><div class="report-record__head"><div><div class="report-record__title">${Utils.escapeHtml(r.tipo)}</div><div class="report-record__date">${Utils.formatDatetime(r.data)}</div></div><span class="badge badge--${r.status}"><span class="status-dot status-dot--${r.status}"></span>${STATUS_LABEL[r.status]}</span></div><div class="info-list"><div class="info-row"><span class="info-row__label">Equipamento</span><span class="info-row__value">${Utils.escapeHtml(eq?.nome ?? '—')}</span></div><div class="info-row"><span class="info-row__label">TAG</span><span class="info-row__value">${Utils.escapeHtml(eq?.tag ?? '—')}</span></div><div class="info-row"><span class="info-row__label">Técnico</span><span class="info-row__value">${Utils.escapeHtml(r.tecnico ?? '—')}</span></div></div><div class="report-record__obs">${Utils.escapeHtml(r.obs)}</div></div>`; }).join("")}`;
}

// ════════════════════════════════════════════════════════
// EQUIPAMENTOS MODULE (com Toast em vez de alert)
// ════════════════════════════════════════════════════════
export const Equipamentos = {
  save() {
    const nome = Utils.getVal("eq-nome").trim(); 
    const local = Utils.getVal("eq-local").trim();
    
    if (!nome || !local) {
      Toast.warning("Preencha nome e localização."); // ✅ Toast em vez de alert
      return;
    }
    
    const rawTag = Utils.getVal("eq-tag").trim(); 
    const normalizedTag = rawTag.toUpperCase();
    const { equipamentos } = getState();
    
    if (normalizedTag && equipamentos.some((e) => (e.tag || "").toUpperCase() === normalizedTag)) {
      Toast.error("Já existe equipamento com esta TAG."); // ✅ Toast em vez de alert
      return;
    }
    
    setState((prev) => ({ ...prev, equipamentos: [...prev.equipamentos, { id: Utils.uid(), nome, local, status: "ok", tag: normalizedTag, tipo: Utils.getVal("eq-tipo"), modelo: Utils.getVal("eq-modelo").trim(), fluido: Utils.getVal("eq-fluido") }] }));
    Modal.close("modal-add-eq"); 
    Utils.clearVals("eq-nome", "eq-tag", "eq-local", "eq-modelo"); 
    renderEquip(); 
    updateHeader();
    Toast.success("✅ Equipamento cadastrado com sucesso!"); // ✅ Toast de sucesso
  },

  view(id) {
    const eq = findEquip(id); if (!eq) return;
    const regs = regsForEquip(id).sort((a, b) => b.data.localeCompare(a.data));
    const score = calcHealthScore(id); const scoreClass = getHealthClass(score);
    
    Utils.getEl("eq-det-corpo").innerHTML = `
      <div class="modal__title">${Utils.escapeHtml(eq.nome)}</div>
      <div class="eq-modal-health">
         <div class="eq-modal-health__circle eq-modal-health__circle--${scoreClass}">${score}%</div>
         <div class="eq-modal-health__text">
            <div class="eq-modal-health__label">Condição Geral</div>
            <div class="eq-modal-health__status">${scoreClass === 'ok' ? 'Saudável' : scoreClass === 'warn' ? 'Atenção' : 'Crítico'}</div>
         </div>
      </div>
      <div class="btn-group" style="margin-bottom:16px;">
        <button class="btn btn--outline" data-action="go-register-equip" data-id="${id}">+ Registrar</button>
        <button class="btn btn--danger" data-action="delete-equip" data-id="${id}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg> Excluir
        </button>
      </div>
      <div class="eq-modal-summary">${regs.length} registro(s)</div>
      ${regs.slice(0, 3).map((r) => `<div class='eq-modal-quick'>${Utils.escapeHtml(r.tipo)} · ${Utils.formatDatetime(r.data)}</div>`).join("")}`;
    Modal.open("modal-eq-det");
  },
  
  delete(id) { 
    setState((prev) => ({ ...prev, equipamentos: prev.equipamentos.filter((e) => e.id !== id), registros: prev.registros.filter((r) => r.equipId !== id) })); 
    Modal.close("modal-eq-det"); 
    renderEquip(); 
    updateHeader(); 
    Toast.info("Equipamento excluído."); // ✅ Toast informativo
  },
};

// ════════════════════════════════════════════════════════
// REGISTRO MODULE (com Toast + Validação Visual)
// ════════════════════════════════════════════════════════
export const Registro = {
  save() {
    const equipId = Utils.getVal("r-equip"); 
    const data = Utils.getVal("r-data"); 
    const tipo = Utils.getVal("r-tipo"); 
    const obs = Utils.getVal("r-obs").trim(); 
    const tecnico = Utils.getVal("r-tecnico").trim();
    
    const missing = [];
    if (!equipId) missing.push("Equipamento"); 
    if (!data) missing.push("Data"); 
    if (!tipo) missing.push("Tipo de Serviço"); 
    if (!tecnico) missing.push("Técnico Responsável"); 
    if (!obs || obs.length < 10) missing.push("Observações (mín. 10 caracteres)");
    
    if (missing.length > 0) {
      Toast.warning(`Preencha os campos obrigatórios: ${missing.join(", ")}`); // ✅ Toast em vez de alert
      return;
    }
    
    const proxima = Utils.getVal("r-proxima");
    if (proxima && proxima < data.slice(0, 10)) {
      Toast.error("A próxima manutenção não pode ser anterior à data do serviço."); // ✅ Toast em vez de alert
      return;
    }
    
    const status = Utils.getVal("r-status");
    setState((prev) => {
      const currentTecnicos = prev.tecnicos || [];
      const updatedTecnicos = tecnico && !currentTecnicos.includes(tecnico) ? [...currentTecnicos, tecnico] : currentTecnicos;
      return { ...prev, tecnicos: updatedTecnicos, registros: [...prev.registros, { id: Utils.uid(), equipId, data, tipo, obs, status, pecas: Utils.getVal("r-pecas").trim(), proxima, fotos: [...Photos.pending], tecnico }], equipamentos: prev.equipamentos.map((e) => e.id === equipId ? { ...e, status } : e) };
    });
    this.clear(); 
    Toast.success("✅ Registro salvo com sucesso!"); // ✅ Toast de sucesso
    goView("historico");
  },
  
  clear(preserveEquip = false) {
    const toClear = ["r-tipo", "r-pecas", "r-obs", "r-proxima", "r-tecnico"];
    if (!preserveEquip) toClear.push("r-equip");
    Utils.clearVals(...toClear); 
    Utils.setVal("r-status", "ok"); 
    Utils.setVal("r-data", Utils.nowDatetime()); 
    Photos.clear();
    
    // Remove barra de progresso se existir
    const progressBar = document.getElementById('form-progress-bar');
    if (progressBar) progressBar.remove();
  },
};

// ════════════════════════════════════════════════════════
// HISTÓRICO MODULE
// ════════════════════════════════════════════════════════
export const Historico = {
  delete(id) {
    setState((prev) => {
      const regToDelete = prev.registros.find((r) => r.id === id); 
      const registros = prev.registros.filter((r) => r.id !== id);
      if (!regToDelete) return { ...prev, registros };
      const lastRemaining = registros.filter((r) => r.equipId === regToDelete.equipId).sort((a, b) => b.data.localeCompare(a.data))[0];
      const equipamentos = prev.equipamentos.map((eq) => eq.id === regToDelete.equipId ? { ...eq, status: lastRemaining?.status || "ok" } : eq);
      return { ...prev, registros, equipamentos };
    }); 
    renderHist(); 
    updateHeader();
    Toast.warning("Registro excluído do histórico."); // ✅ Toast informativo
  },
};

// ════════════════════════════════════════════════════════
// VIEW TRANSITIONS (FadeIn + TranslateX Suaves)
// ════════════════════════════════════════════════════════
export function goView(name) {
  const activeView = document.querySelector('.view.active');
  const newView = Utils.getEl(`view-${name}`);
  
  // Se já está na view ativa, não faz nada
  if (activeView === newView) return;

  // Animação de saída da view atual (se existir)
  if (activeView) {
    activeView.classList.add('is-exiting');
    
    // Remove classes após animação de saída
    setTimeout(() => {
      activeView.classList.remove('active', 'is-exiting');
      
      // Ativa nova view com animação de entrada
      activateNewView(name);
    }, 200); // Duração do fade-out
  } else {
    // Se não há view ativa, ativa diretamente
    activateNewView(name);
  }
}

/**
 * Ativa a nova view com animação de entrada
 */
function activateNewView(name) {
  document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("is-active"));
  
  const newView = Utils.getEl(`view-${name}`);
  if (newView) {
    newView.classList.add("active"); // Trigger animação fadeIn + translateX
  }
  
  Utils.getEl(`nav-${name}`)?.classList.add("is-active");
  
  // Renderiza conteúdo específico da view
  if (name === "inicio") renderInicio(); 
  if (name === "equipamentos") renderEquip();
  if (name === "registro") { populateSelects(); Utils.setVal("r-data", Utils.nowDatetime()); }
  if (name === "historico") { populateSelects(); renderHist(); }
  if (name === "alertas") renderAlertas(); 
  if (name === "relatorio") { populateSelects(); renderRelatorio(); }
  
  updateHeader(); 
  window.scrollTo(0, 0);
}

// ════════════════════════════════════════════════════════
// ACTIONS MODULE (Theme Toggle + Validação + Busca)
// ════════════════════════════════════════════════════════
export const Actions = {
  init() {
    this.initThemeToggle();
    this.initFormValidation();
    this.initSmartSearch();
    
    const rEquipSelect = Utils.getEl('r-equip');
    if (rEquipSelect) {
      rEquipSelect.addEventListener('change', () => {
        const id = rEquipSelect.value;
        let warningDiv = Utils.getEl('reg-pending-warning');
        
        if (!id) {
          if (warningDiv) warningDiv.remove();
          return;
        }

        const lastReg = lastRegForEquip(id);
        const hasPending = lastReg && Utils.daysDiff(lastReg.proxima) >= 0;

        if (hasPending) {
          if (!warningDiv) {
            warningDiv = document.createElement('div');
            warningDiv.id = 'reg-pending-warning';
            warningDiv.className = 'form-label';
            warningDiv.style.color = 'var(--warning)';
            warningDiv.style.marginBottom = '12px';
            warningDiv.style.fontSize = '12px';
            warningDiv.style.lineHeight = '1.4';
            rEquipSelect.parentNode.parentNode.insertBefore(warningDiv, rEquipSelect.parentNode.nextSibling);
          }
          warningDiv.textContent = '⚠️ Atenção: Este equipamento já possui manutenção agendada. Registre apenas se for uma intervenção de emergência.';
        } else {
          if (warningDiv) warningDiv.remove();
        }
      });
    }

    document.addEventListener("click", (e) => {
      const btn = e.target.closest('[data-action="go-register-equip"]');
      if (!btn) return;
      const equipId = btn.dataset.id; 
      Modal.close("modal-eq-det"); 
      goView("registro");
      
      setTimeout(() => {
        Utils.setVal("r-equip", equipId);
        rEquipSelect?.dispatchEvent(new Event('change'));
      }, 50);
    });
  },

  initThemeToggle() {
    const toggleBtn = Utils.getEl('theme-toggle');
    const themeIcon = Utils.getEl('theme-icon');
    
    if (!toggleBtn || !themeIcon) return;

    function getPreferredTheme() {
      const savedTheme = localStorage.getItem('cooltrack-theme');
      if (savedTheme) return savedTheme;
      if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
      return 'dark';
    }

    function applyTheme(theme) {
      if (theme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
        themeIcon.textContent = '☀️';
        toggleBtn.setAttribute('aria-label', 'Mudar para modo escuro');
      } else {
        document.documentElement.removeAttribute('data-theme');
        themeIcon.textContent = '🌙';
        toggleBtn.setAttribute('aria-label', 'Mudar para modo claro');
      }
      localStorage.setItem('cooltrack-theme', theme);
    }

    applyTheme(getPreferredTheme());

    toggleBtn.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'light' ? 'dark' : 'light';
      applyTheme(newTheme);
      Toast.info(`Tema alterado para ${newTheme === 'light' ? 'Claro' : 'Escuro'}`);
    });

    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
      if (!localStorage.getItem('cooltrack-theme')) {
        applyTheme(e.matches ? 'light' : 'dark');
      }
    });
  },

  initFormValidation() {
    const formView = Utils.getEl('view-registro');
    if (!formView) return;

    const requiredFields = [
      { id: 'r-equip', label: 'Equipamento', validate: (v) => v !== '' },
      { id: 'r-data', label: 'Data e Hora', validate: (v) => v !== '' },
      { id: 'r-tipo', label: 'Tipo de Serviço', validate: (v) => v !== '' },
      { id: 'r-tecnico', label: 'Técnico Responsável', validate: (v) => v.trim() !== '' },
      { id: 'r-obs', label: 'Observações', validate: (v) => v.trim().length >= 10 }
    ];

    const PROGRESS_CONTAINER_ID = 'form-progress-container-unique-v333';
    
    function ensureProgressBarExists() {
      if (document.getElementById(PROGRESS_CONTAINER_ID)) return;

      const formCard = formView.querySelector('.card');
      if (!formCard) return;

      const progressContainer = document.createElement('div');
      progressContainer.id = PROGRESS_CONTAINER_ID;
      progressContainer.className = 'form-progress';
      progressContainer.innerHTML = `
        <div class="form-progress__text">
          <span>Campos preenchidos</span>
          <span id="form-progress-count">0/${requiredFields.length}</span>
        </div>
        <div class="form-progress__bar">
          <div class="form-progress__fill" id="form-progress-fill" style="width: 0%"></div>
        </div>
      `;
      
      formCard.insertBefore(progressContainer, formCard.firstChild);
    }

    function updateFieldStatus(fieldConfig) {
      const input = Utils.getEl(fieldConfig.id);
      if (!input) return;

      const value = input.value;
      const isValid = fieldConfig.validate(value);
      
      input.classList.remove('is-valid', 'is-invalid');
      
      const existingError = input.parentElement.querySelector('.form-error, .form-success');
      if (existingError) existingError.remove();

      if (value === '' || value.trim() === '') return;

      if (isValid) {
        input.classList.add('is-valid');
      } else {
        input.classList.add('is-invalid');
        const errorEl = document.createElement('div');
        errorEl.className = 'form-error';
        errorEl.textContent = fieldConfig.label + ' inválido';
        input.parentElement.appendChild(errorEl);
      }
    }

    function updateProgressBar() {
      ensureProgressBarExists();

      const filledCount = requiredFields.filter(f => {
        const input = Utils.getEl(f.id);
        return input && f.validate(input.value);
      }).length;
      
      const totalCount = requiredFields.length;
      const percentage = (filledCount / totalCount) * 100;
      
      const progressBar = document.getElementById('form-progress-fill');
      const countEl = document.getElementById('form-progress-count');
      
      if (progressBar) progressBar.style.width = `${percentage}%`;
      if (countEl) countEl.textContent = `${filledCount}/${totalCount}`;
    }

    requiredFields.forEach(field => {
      const input = Utils.getEl(field.id);
      if (input) {
        input.addEventListener('input', () => {
          updateFieldStatus(field);
          updateProgressBar();
        });
        
        input.addEventListener('blur', () => {
          updateFieldStatus(field);
        });
      }
    });

    updateProgressBar();
  },

  initSmartSearch() {
    const searchEquipWrapper = document.querySelector('#view-equipamentos .search-bar');
    const searchEquipInput = document.querySelector('#view-equipamentos .search-bar__input');
    
    if (searchEquipInput && searchEquipWrapper) {
      if (!searchEquipWrapper.querySelector('.search-bar__clear')) {
        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'search-bar__clear';
        clearBtn.innerHTML = '✕';
        clearBtn.setAttribute('aria-label', 'Limpar busca');
        searchEquipWrapper.classList.add('search-bar__wrapper');
        searchEquipWrapper.appendChild(clearBtn);
        searchEquipInput.classList.add('search-bar__input--with-clear');
        
        clearBtn.addEventListener('click', () => {
          searchEquipInput.value = '';
          searchEquipWrapper.classList.remove('search-bar__has-value');
          renderEquip('');
          searchEquipInput.focus();
          const counter = searchEquipWrapper.querySelector('.search-bar__counter');
          if (counter) counter.remove();
        });
      }
      
      searchEquipInput.addEventListener('input', () => {
        if (searchEquipInput.value.length > 0) {
          searchEquipWrapper.classList.add('search-bar__has-value');
        } else {
          searchEquipWrapper.classList.remove('search-bar__has-value');
        }
      });
    }
  }
};

export function highlightText(text, searchTerm) {
  if (!searchTerm || !text) return Utils.escapeHtml(text);
  
  const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedTerm})`, 'gi');
  const escapedText = Utils.escapeHtml(text);
  
  return escapedText.replace(regex, '<mark class="mark-highlight">$1</mark>');
}