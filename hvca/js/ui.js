import { Utils, TIPO_ICON, STATUS_LABEL } from "./utils.js";
import {
  getState,
  findEquip,
  lastRegForEquip,
  regsForEquip,
  setState,
} from "./state.js";
// ─── IMAGE COMPRESSION (Anti-LocalStorage Crash) ───
function compressImage(file, maxWidth = 1200, quality = 0.7) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Se a largura for maior que o máximo permitido, reduz proporcionalmente
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        // Desenha a imagem reduzida no canvas
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        // Exporta como JPEG com a qualidade definida (0.7 = 70%)
        const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(compressedDataUrl);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });
}
export const Modal = {
  open(id) {
    Utils.getEl(id)?.classList.add("is-open");
  },
  close(id) {
    Utils.getEl(id)?.classList.remove("is-open");
  },
  init() {
    document.querySelectorAll(".modal-overlay").forEach((el) => {
      el.addEventListener("click", (e) => {
        if (e.target === el) el.classList.remove("is-open");
      });
    });
  },
};
export const Photos = {
  pending: [],
  async add(input) {
    const files = Array.from(input.files || []);

    // Processa as fotos uma a uma
    for (const file of files) {
      try {
        const compressedFile = await compressImage(file);
        this.pending.push(compressedFile);
        this.render(); // Atualiza a preview na tela
      } catch (error) {
        console.error("Erro ao comprimir imagem:", error);
        alert("Erro ao processar uma das fotos. Tente novamente.");
      }
    }

    input.value = ""; // Limpa o input para permitir selecionar o mesmo arquivo de novo
  },
  remove(index) {
    this.pending.splice(index, 1);
    this.render();
  },
  clear() {
    this.pending = [];
    this.render();
  },
  openLightbox(src) {
    Utils.getEl("lightbox-img").src = src;
    Utils.getEl("lightbox").classList.add("is-open");
  },
  closeLightbox() {
    Utils.getEl("lightbox").classList.remove("is-open");
  },
  render() {
    const container = Utils.getEl("photo-preview");
    if (!container) return;
    container.innerHTML = "";
    const frag = document.createDocumentFragment();
    this.pending.forEach((src, i) => {
      const card = document.createElement("div");
      card.className = "photo-thumb";
      const img = document.createElement("img");
      img.src = src;
      img.addEventListener("click", () => this.openLightbox(src));
      const btn = document.createElement("button");
      btn.className = "photo-thumb__remove";
      btn.textContent = "✕";
      btn.addEventListener("click", () => this.remove(i));
      card.append(img, btn);
      frag.appendChild(card);
    });
    container.appendChild(frag);
  },
};
export const Alerts = {
  getAll() {
    const { registros, equipamentos } = getState();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in7 = new Date(today);
    in7.setDate(in7.getDate() + 7);
    const dueByEquip = new Map();
    registros.forEach((r) => {
      if (!r.proxima) return;
      const d = new Date(`${r.proxima}T00:00:00`);
      if (Number.isNaN(d.getTime())) return;
      const current = dueByEquip.get(r.equipId);
      if (!current || d < current.date)
        dueByEquip.set(r.equipId, { date: d, reg: r });
    });
    const list = [];
    dueByEquip.forEach(({ date, reg }) => {
      if (date < today) list.push({ kind: "overdue", reg });
      else if (date <= in7) list.push({ kind: "upcoming", reg });
    });
    equipamentos
      .filter((e) => e.status === "danger")
      .forEach((eq) => list.push({ kind: "critical", eq }));
    return list;
  },
};
function empty(icon, msg, sub = "") {
  return `<div class="empty-state"><div class="empty-state__icon">${icon}</div><div class="empty-state__title">${msg}</div>${sub ? `<div class="empty-state__sub">${sub}</div>` : ""}</div>`;
}
export function updateHeader() {
  const { equipamentos, registros } = getState();
  const today = new Date();
  const iniMes = new Date(today.getFullYear(), today.getMonth(), 1);
  const alertCount = Alerts.getAll().length;

  Utils.getEl("hdr-date").textContent = today
    .toLocaleDateString("pt-BR", {
      weekday: "short",
      day: "2-digit",
      month: "short",
    })
    .toUpperCase();

  // Calcula mês
  const mesCount = registros.filter((r) => new Date(r.data) >= iniMes).length;

  // 1. Atualiza o Header antigo (topo da tela) - usando "|| '—'" para esconder zeros
  Utils.getEl("hst-total").textContent = equipamentos.length || "—";
  Utils.getEl("hst-mes").textContent = mesCount || "—";
  Utils.getEl("hst-alert").textContent = alertCount || "—";

  // 2. Atualiza o Bento Grid Novo (lá embaixo no dashboard)
  Utils.getEl("hst-mes-bento").textContent = mesCount || "—";
  Utils.getEl("hst-alert-bento").textContent = alertCount || "—";

  // 3. Atualiza o Badge vermelho do menu lateral
  const badge = Utils.getEl("alerta-badge");
  badge.textContent = String(alertCount);
  badge.classList.toggle("is-visible", alertCount > 0);

  // 4. Chama o cálculo do Health Score (Passo 2)
  renderGlobalHealthScore();
}

// ─── HEALTH SCORE CALCULATION ───
function calcHealthScore(eqId) {
  const eq = findEquip(eqId);
  if (!eq) return 0;

  let score = 100;
  const lastReg = lastRegForEquip(eqId);

  // 1. Penalidade pelo status atual
  if (eq.status === "warn") score -= 20;
  if (eq.status === "danger") score -= 50;

  // 2. Penalidade por tempo sem manutenção
  if (lastReg) {
    const daysSinceLast = Utils.daysDiff(lastReg.data.slice(0, 10)) * -1;
    if (daysSinceLast > 90) score -= 25;
    else if (daysSinceLast > 60) score -= 15;
    else if (daysSinceLast > 30) score -= 10;
  } else {
    score -= 30;
  }

  // 3. Penalidade se próxima manutenção venceu
  if (lastReg?.proxima) {
    const daysToNext = Utils.daysDiff(lastReg.proxima);
    if (daysToNext < 0) score -= 20;
  }

  return Math.max(0, Math.min(100, score));
}
function renderGlobalHealthScore() {
  const { equipamentos } = getState();
  const el = Utils.getEl("hst-health");
  const barEl = Utils.getEl("health-bar-fill");

  if (!equipamentos.length) {
    el.textContent = "—";
    if (barEl) barEl.style.width = "0%";
    return;
  }

  const totalScore = equipamentos.reduce(
    (acc, eq) => acc + calcHealthScore(eq.id),
    0,
  );
  const avgScore = Math.round(totalScore / equipamentos.length);

  el.textContent = avgScore;

  // Aplica classe de cor baseada no score (sem inline style)
  el.classList.remove(
    "bento-kpi__value--ok",
    "bento-kpi__value--warn",
    "bento-kpi__value--danger",
  );
  if (avgScore >= 80) el.classList.add("bento-kpi__value--ok");
  else if (avgScore >= 50) el.classList.add("bento-kpi__value--warn");
  else el.classList.add("bento-kpi__value--danger");

  if (barEl) {
    barEl.style.width = `${avgScore}%`; // width é dinâmico — não pode ser substituído por classe
    barEl.classList.remove(
      "health-bar__fill--ok",
      "health-bar__fill--warn",
      "health-bar__fill--danger",
    );
    if (avgScore >= 80) barEl.classList.add("health-bar__fill--ok");
    else if (avgScore >= 50) barEl.classList.add("health-bar__fill--warn");
    else barEl.classList.add("health-bar__fill--danger");
  }
}
export function populateSelects() {
  const { equipamentos } = getState();
  const opts = equipamentos
    .map(
      (e) =>
        `<option value="${e.id}">${Utils.escapeHtml(e.nome)} — ${Utils.escapeHtml(e.local)}</option>`,
    )
    .join("");
  const targets = [
    { id: "r-equip", prefix: '<option value="">Selecione...</option>' },
    {
      id: "hist-equip",
      prefix: '<option value="">Todos os equipamentos</option>',
    },
    { id: "rel-equip", prefix: '<option value="">Todos</option>' },
  ];
  targets.forEach(({ id, prefix }) => {
    const el = Utils.getEl(id);
    if (el) el.innerHTML = prefix + opts;
  });
}

// ─── Componente de card de equipamento (unificado) ───
function equipCardHtml(eq, { showLocal = true } = {}) {
  const icon = TIPO_ICON[eq.tipo] ?? "⚙️";
  const last = lastRegForEquip(eq.id);
  return `<div class="equip-card equip-card--${eq.status}" data-action="view-equip" data-id="${eq.id}">
    <div class="equip-card__icon">${icon}</div>
    <div class="equip-card__body">
      <div class="equip-card__name">${Utils.escapeHtml(eq.nome)}</div>
      ${showLocal ? `<div class="equip-card__local">📍 ${Utils.escapeHtml(eq.local)}</div>` : ""}
      <div class="equip-card__tag">${Utils.escapeHtml(eq.tag || eq.tipo)} · ${Utils.escapeHtml(eq.fluido || "")}</div>
      ${last ? `<div class="equip-card__last">Últ: ${Utils.formatDatetime(last.data)}</div>` : ""}
    </div>
    <div class="equip-card__actions">
      <button class="equip-card__delete" data-action="delete-equip" data-id="${eq.id}" title="Excluir equipamento">
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>
  </svg>
</button>
    </div>
    <span class="badge badge--${eq.status}"><span class="status-dot status-dot--${eq.status}"></span>${STATUS_LABEL[eq.status]}</span>
  </div>`;
}

export function renderEquip(filtro = "") {
  const { equipamentos } = getState();
  const q = filtro.toLowerCase();
  const list = equipamentos.filter(
    (e) =>
      !q ||
      e.nome.toLowerCase().includes(q) ||
      e.local.toLowerCase().includes(q),
  );
  const el = Utils.getEl("lista-equip");
  if (!list.length) {
    el.innerHTML = empty("🔧", "Nenhum equipamento");
    return;
  }
  el.innerHTML = list.map((eq) => equipCardHtml(eq)).join("");
}
export function renderInicio() {
  const { equipamentos, registros } = getState();
  const alertas = Alerts.getAll().slice(0, 2);
  Utils.getEl("dash-alertas-mini").innerHTML = alertas
    .map((a) => alertCardHtml(a))
    .join("");
  const recent = [...registros]
    .sort((a, b) => b.data.localeCompare(a.data))
    .slice(0, 3);
  Utils.getEl("dash-recentes").innerHTML = recent.length
    ? recent
        .map((r) => {
          const eq = findEquip(r.equipId);
          return `<article class="card recent-card" data-nav="historico">
      <div class="recent-card__date">${Utils.formatDatetime(r.data)}</div>
      <div class="recent-card__title">${Utils.escapeHtml(r.tipo)}</div>
      <div class="recent-card__equip">${Utils.escapeHtml(eq?.nome ?? "—")}</div>
      <div class="recent-card__obs">${Utils.escapeHtml(Utils.truncate(r.obs, 60))}</div>
    </article>`;
        })
        .join("")
    : empty("📭", "Nenhum registro", "Faça seu primeiro lançamento");
  const critical = equipamentos.filter((e) => e.status !== "ok");
  Utils.getEl("dash-criticos").innerHTML = critical.length
    ? critical.map((eq) => equipCardHtml(eq, { showLocal: true })).join("")
    : empty("✅", "Todos normais");
}
function alertCardHtml({ kind, reg, eq }) {
  if (kind === "critical") {
    return `<div class="alert-card alert-card--critical" data-nav="alertas"><span class="alert-card__icon">🚨</span><div><div class="alert-card__title">Equipamento fora de operação</div><div class="alert-card__sub">Requer intervenção imediata</div><div class="alert-card__equip">${Utils.escapeHtml(eq.nome)} · ${Utils.escapeHtml(eq.local)}</div></div></div>`;
  }
  const equip = findEquip(reg.equipId);
  if (kind === "overdue") {
    return `<div class="alert-card alert-card--critical" data-nav="alertas">
<span class="alert-card__icon">🔴</span><div><div class="alert-card__title">Manutenção VENCIDA</div><div class="alert-card__sub">${Utils.escapeHtml(reg.tipo)}</div><div class="alert-card__equip">${Utils.escapeHtml(equip?.nome ?? "—")}</div></div></div>`;
  }
  return `<div class="alert-card" data-nav="alertas"><span class="alert-card__icon">⚠️</span><div><div class="alert-card__title">Manutenção em ${Utils.daysDiff(reg.proxima)} dia(s)</div><div class="alert-card__sub">${Utils.escapeHtml(reg.tipo)}</div><div class="alert-card__equip">${Utils.escapeHtml(equip?.nome ?? "—")}</div></div></div>`;
}
export function renderHist() {
  const { registros } = getState();
  const busca = Utils.getVal("hist-busca").toLowerCase();
  const filtEq = Utils.getVal("hist-equip");
  let list = [...registros].sort((a, b) => b.data.localeCompare(a.data));
  const filtTecnico = Utils.getVal('hist-tecnico');
  if (filtEq) list = list.filter(r => r.equipId === filtEq);
  if (filtTecnico) list = list.filter(r => (r.tecnico || '').toLowerCase().includes(filtTecnico));
  if (busca)
    list = list.filter((r) => {
      const eq = findEquip(r.equipId);
      return (
        r.obs.toLowerCase().includes(busca) ||
        r.tipo.toLowerCase().includes(busca) ||
        (eq?.nome || "").toLowerCase().includes(busca)
      );
    });
  const el = Utils.getEl("timeline");
  if (!list.length) {
    el.innerHTML = empty("📭", "Nenhum registro");
    return;
  }
  el.innerHTML = `<div class="timeline">${list.map((r) => renderTimelineItem(r)).join("")}</div>`;
}
function renderTimelineItem(r) {
  const eq = findEquip(r.equipId);
  const dotMod = r.status !== "ok" ? `timeline__dot--${r.status}` : "";

  return `
    <div class="timeline__item">
      <div class="timeline__dot ${dotMod}"></div>
      <div class="timeline__item-inner">
        <div class="timeline__item-body">
          <div class="timeline__date">${Utils.formatDatetime(r.data)}</div>
          <div class="timeline__title">${Utils.escapeHtml(r.tipo)}</div>
          <div class="timeline__equip">📍 ${Utils.escapeHtml(eq?.nome ?? "—")} · ${Utils.escapeHtml(eq?.local ?? "")}</div>
          <div class="timeline__obs">${Utils.escapeHtml(r.obs)}</div>
          
          ${r.pecas ? `<div class="timeline__parts">🔩 ${Utils.escapeHtml(r.pecas)}</div>` : ""}
          ${r.tecnico ? `<div class="timeline__parts">👷 ${Utils.escapeHtml(r.tecnico)}</div>` : ""}
          ${r.proxima ? `<div class="timeline__next">📅 Próxima: ${Utils.formatDate(r.proxima)}</div>` : ""}
        </div>
        
        <button class="timeline__delete" data-action="delete-reg" data-id="${r.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18"/>
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
            <line x1="10" x2="10" y1="11" y2="17"/>
            <line x1="14" x2="14" y1="11" y2="17"/>
          </svg>
        </button>
      </div>
    </div>`;
}
export function renderAlertas() {
  const list = Alerts.getAll();
  Utils.getEl("lista-alertas").innerHTML = list.length
    ? list.map(alertCardHtml).join("")
    : empty("✅", "Tudo em dia!", "Nenhuma manutenção pendente");
}
export function renderRelatorio() {
  const { registros } = getState();
  const filtEq = Utils.getVal("rel-equip");
  const de = Utils.getVal("rel-de");
  const ate = Utils.getVal("rel-ate");
  let list = [...registros].sort((a, b) => b.data.localeCompare(a.data));
  if (filtEq) list = list.filter((r) => r.equipId === filtEq);
  if (de) list = list.filter((r) => r.data >= de);
  if (ate) list = list.filter((r) => r.data <= `${ate}T23:59`);
  const el = Utils.getEl("relatorio-corpo");
  if (!list.length) {
    el.innerHTML = empty("📭", "Sem registros no período");
    return;
  }
  const today = new Date().toLocaleDateString("pt-BR");
  el.innerHTML = `<div class="card"><div class="report-header">RELATÓRIO DE MANUTENÇÃO</div><div class="report-meta">🏥 Hospital · Gerado em ${today} · ${list.length} registro(s)</div></div>${list.map((r) => reportRecord(r)).join("")}`;
}
function reportRecord(r) {
  const eq = findEquip(r.equipId);
  return `
    <div class="card report-record">
      <div class="report-record__head">
        <div>
          <div class="report-record__title">${Utils.escapeHtml(r.tipo)}</div>
          <div class="report-record__date">${Utils.escapeHtml(r.data)}</div>
        </div>
        <span class="badge badge--${r.status}">
          <span class="status-dot status-dot--${r.status}"></span>
          ${STATUS_LABEL[r.status]}
        </span>
      </div>
      <div class="info-list">
        <div class="info-row">
          <span class="info-row__label">Equipamento</span>
          <span class="info-row__value">${Utils.escapeHtml(eq?.nome ?? '—')}</span>
        </div>
        <div class="info-row">
          <span class="info-row__label">TAG</span>
          <span class="info-row__value">${Utils.escapeHtml(eq?.tag ?? '—')}</span>
        </div>
      </div>
      <div class="info-row">
        <span class="info-row__label">TAG</span>
        <span class="info-row__value">${Utils.escapeHtml(eq?.tag ??  '—')}</span>
      </div>
      <div class="info-row">
        <span class="info-row__label">Técnico</span>
        <span class="info-row__value">${Utils.escapeHtml(r.tecnico ?? '—')}</span>
        </div>
      </div>
      <div class="report-record__obs">${Utils.escapeHtml(r.obs)}</div>
    </div>`;
}
export const Equipamentos = {
  save() {
    const nome = Utils.getVal("eq-nome").trim();
    const local = Utils.getVal("eq-local").trim();
    if (!nome || !local) {
      alert("Preencha nome e localização.");
      return;
    }
    const rawTag = Utils.getVal("eq-tag").trim();
    const normalizedTag = rawTag.toUpperCase();
    const { equipamentos } = getState();
    if (
      normalizedTag &&
      equipamentos.some((e) => (e.tag || "").toUpperCase() === normalizedTag)
    ) {
      alert("Já existe equipamento com esta TAG.");
      return;
    }
    setState((prev) => ({
      ...prev,
      equipamentos: [
        ...prev.equipamentos,
        {
          id: Utils.uid(),
          nome,
          local,
          status: "ok",
          tag: normalizedTag,
          tipo: Utils.getVal("eq-tipo"),
          modelo: Utils.getVal("eq-modelo").trim(),
          fluido: Utils.getVal("eq-fluido"),
        },
      ],
    }));
    Modal.close("modal-add-eq");
    Utils.clearVals("eq-nome", "eq-tag", "eq-local", "eq-modelo");
    renderEquip();
    updateHeader();
  },
  view(id) {
    const eq = findEquip(id);
    if (!eq) return;
    const regs = regsForEquip(id).sort((a, b) => b.data.localeCompare(a.data));
    Utils.getEl("eq-det-corpo").innerHTML =
      `<div class="modal__title">${Utils.escapeHtml(eq.nome)}</div>
      <div class="btn-group"><button class="btn btn--outline" data-action="go-register-equip" data-id="${id}">+ Registrar</button>
      <button class="btn btn--danger" data-action="delete-equip" data-id="${id}">
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg> Excluir
  </button></div>
      <div class="eq-modal-summary">${regs.length} registro(s)</div>${regs
        .slice(0, 3)
        .map(
          (r) =>
            `<div class='eq-modal-quick'>${Utils.escapeHtml(r.tipo)} · ${Utils.formatDatetime(r.data)}</div>`,
        )
        .join("")}`;
    Modal.open("modal-eq-det");
  },
  delete(id) {
    setState((prev) => ({
      ...prev,
      equipamentos: prev.equipamentos.filter((e) => e.id !== id),
      registros: prev.registros.filter((r) => r.equipId !== id),
    }));
    Modal.close("modal-eq-det");
    renderEquip();
    updateHeader();
  },
};
export const Registro = {
  save() {
    const equipId = Utils.getVal("r-equip");
    const data = Utils.getVal("r-data");
    const tipo = Utils.getVal("r-tipo");
    const obs = Utils.getVal("r-obs").trim();
    if (!equipId || !data || !tipo || !obs) {
      alert("Preencha os campos obrigatórios (*).");
      return;
    }
    const tecnico = Utils.getVal("r-tecnico").trim();
    if (!tecnico) {
      alert("Selecione o técnico responsável.");
      return;
    }
    if (obs.length < 10) {
      alert("Descreva o serviço com mais detalhes (mín. 10 caracteres).");
      return;
    }
    const proxima = Utils.getVal("r-proxima");
    if (proxima && proxima < data.slice(0, 10)) {
      alert("A próxima manutenção não pode ser anterior à data do serviço.");
      return;
    }
    const status = Utils.getVal("r-status");
    setState((prev) => ({
      ...prev,
      registros: [
        ...prev.registros,
        {
          id: Utils.uid(),
          equipId,
          data,
          tipo,
          obs,
          status,
          pecas: Utils.getVal("r-pecas").trim(),
          proxima,
          fotos: [...Photos.pending],
          tecnico: tecnico,
        },
      ],
      equipamentos: prev.equipamentos.map((e) =>
        e.id === equipId ? { ...e, status } : e,
      ),
    }));
    this.clear();
    alert("✅ Registro salvo!");
    goView("historico");
  },
  clear() {
    Utils.clearVals("r-equip", "r-tipo", "r-pecas", "r-obs", "r-proxima");
    Utils.setVal("r-status", "ok");
    Utils.setVal("r-data", Utils.nowDatetime());
    Photos.clear();
  },
};
export const Historico = {
  delete(id) {
    setState((prev) => {
      const regToDelete = prev.registros.find((r) => r.id === id);
      const registros = prev.registros.filter((r) => r.id !== id);
      if (!regToDelete) return { ...prev, registros };
      const lastRemaining = registros
        .filter((r) => r.equipId === regToDelete.equipId)
        .sort((a, b) => b.data.localeCompare(a.data))[0];
      const equipamentos = prev.equipamentos.map((eq) =>
        eq.id === regToDelete.equipId
          ? { ...eq, status: lastRemaining?.status || "ok" }
          : eq,
      );
      return { ...prev, registros, equipamentos };
    });
    renderHist();
    updateHeader();
  },
};
export function goView(name) {
  document
    .querySelectorAll(".view")
    .forEach((v) => v.classList.remove("active"));
  document
    .querySelectorAll(".nav-btn")
    .forEach((b) => b.classList.remove("is-active"));
  Utils.getEl(`view-${name}`)?.classList.add("active");
  Utils.getEl(`nav-${name}`)?.classList.add("is-active");
  if (name === "inicio") renderInicio();
  if (name === "equipamentos") renderEquip();
  if (name === "registro") {
    populateSelects();
    Utils.setVal("r-data", Utils.nowDatetime());
  }
  if (name === "historico") {
    populateSelects();
    renderHist();
  }
  if (name === "alertas") renderAlertas();
  if (name === "relatorio") {
    populateSelects();
    renderRelatorio();
  }
  updateHeader();
  window.scrollTo(0, 0);
}
