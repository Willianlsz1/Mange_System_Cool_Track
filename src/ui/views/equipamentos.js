/**
 * CoolTrack Pro - Equipamentos View v5.0
 * Funções: renderEquip, saveEquip, viewEquip, deleteEquip, populateEquipSelects
 */

import { Utils, TIPO_ICON } from "../../core/utils.js";
import {
  getState,
  findEquip,
  setState,
  lastRegForEquip,
  regsForEquip,
} from "../../core/state.js";
import { Toast } from "../../core/toast.js";
import { OnboardingBanner } from "../components/onboarding.js";
import { Profile } from "../../features/profile.js";
import { calcHealthScore, getHealthClass, updateHeader } from "./dashboard.js";
import { ErrorCodes, handleError } from "../../core/errors.js";

const STATUS_TECH = { ok: "OPERANDO", warn: "ATENÇÃO", danger: "FALHA" };

function _empty(icon, msg, sub = "", cta = "") {
  return `<div class="empty-state">
    <div class="empty-state__icon">${icon}</div>
    <div class="empty-state__title">${msg}</div>
    ${sub ? `<div class="empty-state__sub">${sub}</div>` : ""}
    ${cta ? `<div style="margin-top:16px">${cta}</div>` : ""}
  </div>`;
}

export function equipCardHtml(eq, { showLocal = true } = {}) {
  const icon = TIPO_ICON[eq.tipo] ?? "⚙️";
  const last = lastRegForEquip(eq.id);
  const score = calcHealthScore(eq.id);
  const hcls = getHealthClass(score);
  const scls = eq.status;
  const barColor =
    hcls === "ok"
      ? "var(--success)"
      : hcls === "warn"
        ? "var(--warning)"
        : "var(--danger)";

  function recencia(data) {
    const diff = Math.round((new Date() - new Date(data)) / 86400000);
    if (diff === 0) return "Hoje";
    if (diff === 1) return "Ontem";
    if (diff < 30) return `Há ${diff} dias`;
    if (diff < 60) return "Há 1 mês";
    return `Há ${Math.floor(diff / 30)} meses`;
  }

  let proximaLabel = "—",
    proximaCls = "equip-card__metric-value--muted",
    proximaIcon = "";
  if (last?.proxima) {
    const diff = Utils.daysDiff(last.proxima);
    if (diff < 0) {
      proximaLabel = `Vencida há ${Math.abs(diff)}d`;
      proximaCls = "equip-card__metric-value--danger";
      proximaIcon = "🔴";
    } else if (diff === 0) {
      proximaLabel = "Hoje";
      proximaCls = "equip-card__metric-value--danger";
      proximaIcon = "🔴";
    } else if (diff <= 7) {
      proximaLabel = `Em ${diff} dia${diff > 1 ? "s" : ""}`;
      proximaCls = "equip-card__metric-value--warn";
      proximaIcon = "⚠️";
    } else {
      proximaLabel = `Em ${diff} dias`;
    }
  }

  let ctaLabel = "Registrar serviço →";
  if (scls === "danger") ctaLabel = "Registrar corretiva →";
  else if (last?.proxima && Utils.daysDiff(last.proxima) <= 7)
    ctaLabel = "Registrar preventiva →";
  else if (!last) ctaLabel = "Primeiro registro →";

  return `<div class="equip-card equip-card--${scls}" data-action="view-equip" data-id="${eq.id}" role="listitem" tabindex="0" aria-label="${Utils.escapeHtml(eq.nome)} — ${STATUS_TECH[scls]}">
    <div class="equip-card__header">
      <div class="equip-card__type-icon equip-card__type-icon--lg">${icon}</div>
      <div class="equip-card__meta">
        <div class="equip-card__name ${scls === "danger" ? "equip-card__name--danger" : ""}">${Utils.escapeHtml(eq.nome)}</div>
        <div class="equip-card__tag">${Utils.escapeHtml(eq.tag || "—")} · ${Utils.escapeHtml(eq.fluido || eq.tipo)}</div>
      </div>
      <span class="equip-card__status equip-card__status--${scls}"><span class="status-dot status-dot--${scls}"></span>${STATUS_TECH[scls]}</span>
      <div class="equip-card__actions">
        <button class="equip-card__delete" data-action="delete-equip" data-id="${eq.id}" aria-label="Excluir ${Utils.escapeHtml(eq.nome)}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
        </button>
      </div>
    </div>
    <div class="equip-card__health">
      <div class="equip-card__health-bar"><div class="equip-card__health-fill" style="width:${score}%;background:${barColor}"></div></div>
      <div class="equip-card__health-meta"><span class="equip-card__health-label">Eficiência</span><span class="equip-card__health-value" style="color:${barColor}">${score}%</span></div>
    </div>
    <div class="equip-card__metrics">
      <div class="equip-card__metric">
        <div class="equip-card__metric-label">Último serviço</div>
        <div class="equip-card__metric-value">${last ? Utils.escapeHtml(recencia(last.data)) : '<span style="color:var(--text-3)">Nenhum registro</span>'}</div>
        ${last ? `<div class="equip-card__metric-sub">${Utils.escapeHtml(Utils.truncate(last.tipo, 22))}</div>` : ""}
      </div>
      ${
        showLocal
          ? `<div class="equip-card__metric">
        <div class="equip-card__metric-label">Localização</div>
        <div class="equip-card__metric-value equip-card__metric-value--muted">${Utils.escapeHtml(Utils.truncate(eq.local, 24))}</div>
      </div>`
          : ""
      }
      <div class="equip-card__metric">
        <div class="equip-card__metric-label">Próxima prev.</div>
        <div class="equip-card__metric-value ${proximaCls}">${proximaIcon ? `<span>${proximaIcon}</span> ` : ""}${proximaLabel}</div>
      </div>
    </div>
    <div class="equip-card__footer">
      <span class="equip-card__footer-tecnico">${last?.tecnico ? `👷 ${Utils.escapeHtml(last.tecnico)}` : ""}</span>
      <button class="equip-card__cta" data-action="go-register-equip" data-id="${eq.id}">${ctaLabel}</button>
    </div>
  </div>`;
}

export function renderEquip(filtro = "") {
  const { equipamentos } = getState();
  const q = filtro.toLowerCase();
  const list = equipamentos.filter(
    (e) =>
      !q ||
      e.nome.toLowerCase().includes(q) ||
      e.local.toLowerCase().includes(q) ||
      (e.tag || "").toLowerCase().includes(q),
  );
  const el = Utils.getEl("lista-equip");
  if (!el) return;
  el.innerHTML = list.length
    ? list.map((eq) => equipCardHtml(eq)).join("")
    : _empty(
        "🔧",
        "Nenhum equipamento encontrado",
        "Tente outro termo ou cadastre um novo.",
        `<button class="btn btn--primary btn--sm" data-action="open-modal" data-id="modal-add-eq" style="width:auto">+ Novo equipamento</button>`,
      );
}

export async function saveEquip() {
  if (localStorage.getItem("cooltrack-guest-mode") === "1") {
    Toast.info("Crie uma conta grátis para salvar equipamentos.");
    try {
      const { AuthScreen } = await import("../components/authscreen.js");
      AuthScreen.show();
    } catch (error) {
      handleError(error, {
        code: ErrorCodes.NETWORK_ERROR,
        message: "Não foi possível abrir a tela de login agora.",
        context: { action: "equipamentos.saveEquip.authscreen" },
      });
    }
    return;
  }
  const nome = Utils.getVal("eq-nome").trim();
  const local = Utils.getVal("eq-local").trim();
  if (!nome || !local) {
    Toast.warning("Preencha nome e localização.");
    return;
  }
  const rawTag = Utils.getVal("eq-tag").trim();
  const normalizedTag = rawTag.toUpperCase();
  const { equipamentos } = getState();
  if (
    normalizedTag &&
    equipamentos.some((e) => (e.tag || "").toUpperCase() === normalizedTag)
  ) {
    Toast.error("Já existe equipamento com esta TAG.");
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
  try {
    const { Modal: M } = await import("../../core/modal.js");
    M.close("modal-add-eq");
  } catch (error) {
    handleError(error, {
      code: ErrorCodes.NETWORK_ERROR,
      message: "Não foi possível fechar o modal de cadastro.",
      context: { action: "equipamentos.saveEquip.closeModal" },
      severity: "warning",
    });
  }
  Utils.clearVals("eq-nome", "eq-tag", "eq-local", "eq-modelo");
  OnboardingBanner.dismiss();
  OnboardingBanner.remove();
  try {
    const { renderDashboard } = await import("./dashboard.js");
    renderDashboard();
  } catch (error) {
    handleError(error, {
      code: ErrorCodes.NETWORK_ERROR,
      message: "Equipamento salvo, mas houve falha ao atualizar o painel.",
      context: { action: "equipamentos.saveEquip.renderDashboard" },
      severity: "warning",
    });
  }
  renderEquip();
  updateHeader();
  Toast.success("Equipamento cadastrado.");
}

export async function viewEquip(id) {
  const eq = findEquip(id);
  if (!eq) return;
  const regs = regsForEquip(id).sort((a, b) => b.data.localeCompare(a.data));
  const score = calcHealthScore(id);
  const cls = getHealthClass(score);

  Utils.getEl("eq-det-corpo").innerHTML = `
    <div class="modal__title" id="eq-det-title">${Utils.escapeHtml(eq.nome)}</div>
    <div class="eq-modal-health">
      <div class="eq-modal-health__circle eq-modal-health__circle--${cls}">${score}%</div>
      <div class="eq-modal-health__text">
        <div class="eq-modal-health__label">EFICIÊNCIA DO EQUIPAMENTO</div>
        <div class="eq-modal-health__status">${cls === "ok" ? "Operando bem" : cls === "warn" ? "Atenção requerida" : "Falha detectada"}</div>
      </div>
    </div>
    <div class="info-list" style="margin-bottom:var(--space-3)">
      <div class="info-row"><span class="info-row__label">TAG</span><span class="info-row__value" style="font-family:var(--font-mono)">${Utils.escapeHtml(eq.tag || "—")}</span></div>
      <div class="info-row"><span class="info-row__label">Tipo</span><span class="info-row__value">${Utils.escapeHtml(eq.tipo)}</span></div>
      <div class="info-row"><span class="info-row__label">Fluido</span><span class="info-row__value">${Utils.escapeHtml(eq.fluido || "—")}</span></div>
      <div class="info-row"><span class="info-row__label">Modelo</span><span class="info-row__value">${Utils.escapeHtml(eq.modelo || "—")}</span></div>
      <div class="info-row"><span class="info-row__label">Local</span><span class="info-row__value">${Utils.escapeHtml(eq.local)}</span></div>
    </div>
    <button class="btn btn--primary" data-action="go-register-equip" data-id="${id}" style="margin-bottom:var(--space-2)">+ Registrar Serviço</button>
    <div class="eq-modal-summary">${regs.length} serviço(s) registrado(s)</div>
    ${regs
      .slice(0, 3)
      .map(
        (r) =>
          `<div class="eq-modal-quick">${Utils.escapeHtml(r.tipo)} · ${Utils.formatDatetime(r.data)}</div>`,
      )
      .join("")}
    <div style="margin-top:var(--space-4);padding-top:var(--space-3);border-top:1px solid var(--border);text-align:center;">
      <button class="eq-delete-link" data-action="delete-equip" data-id="${id}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
        Excluir equipamento
      </button>
    </div>`;

  try {
    const { Modal: M } = await import("../../core/modal.js");
    M.open("modal-eq-det");
  } catch (error) {
    handleError(error, {
      code: ErrorCodes.NETWORK_ERROR,
      message: "Não foi possível abrir os detalhes do equipamento.",
      context: { action: "equipamentos.viewEquip.openModal", id },
    });
  }
}

export async function deleteEquip(id) {
  setState((prev) => ({
    ...prev,
    equipamentos: prev.equipamentos.filter((e) => e.id !== id),
    registros: prev.registros.filter((r) => r.equipId !== id),
  }));
  try {
    const { Modal: M } = await import("../../core/modal.js");
    M.close("modal-eq-det");
  } catch (error) {
    handleError(error, {
      code: ErrorCodes.NETWORK_ERROR,
      message: "Equipamento removido, mas não foi possível fechar o modal.",
      context: { action: "equipamentos.deleteEquip.closeModal", id },
      severity: "warning",
    });
  }
  renderEquip();
  updateHeader();
  Toast.info("Equipamento removido.");
}

export function populateEquipSelects() {
  const { equipamentos, tecnicos } = getState();
  const opts = equipamentos
    .map(
      (e) =>
        `<option value="${e.id}">${Utils.escapeHtml(e.nome)} — ${Utils.escapeHtml(e.local)}</option>`,
    )
    .join("");

  [
    {
      id: "r-equip",
      prefix: '<option value="">Selecione o equipamento...</option>',
    },
    {
      id: "hist-equip",
      prefix: '<option value="">Todos os equipamentos</option>',
    },
    { id: "rel-equip", prefix: '<option value="">Todos</option>' },
  ].forEach(({ id, prefix }) => {
    const el = Utils.getEl(id);
    if (el) el.innerHTML = prefix + opts;
  });

  const tecDatalist = Utils.getEl("lista-tecnicos");
  if (tecDatalist) {
    tecDatalist.innerHTML = (tecnicos || [])
      .map((t) => `<option value="${Utils.escapeHtml(t)}">`)
      .join("");
  }

  const rTecnico = Utils.getEl("r-tecnico");
  if (rTecnico && !rTecnico.value) {
    const def = Profile.getDefaultTecnico();
    if (def) rTecnico.value = def;
  }
}
