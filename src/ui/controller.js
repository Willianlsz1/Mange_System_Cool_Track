/**
 * CoolTrack Pro - UI Controller v5.0
 * Orquestrador: registra rotas, conecta handlers de eventos às views.
 * REGRA: < 120 linhas. Só chama funções — nunca renderiza diretamente.
 */

// core/ — sobe 1 nível (ui/ → src/)
import { registerRoute, goTo } from "../core/router.js";
import { on } from "../core/events.js";
import { Modal, CustomConfirm } from "../core/modal.js";
import { Toast } from "../core/toast.js";
import { Auth } from "../core/auth.js";

// domain/ — sobe 1 nível
import { PDFGenerator } from "../domain/pdf.js";
import { WhatsAppExport } from "../domain/whatsapp.js";

// features/ — sobe 1 nível
import { Profile } from "../features/profile.js";
import { ClientMode } from "../features/clientmode.js";

// views/ — MESMO nível (./), pois views/ está dentro de ui/
import { renderDashboard, updateHeader } from "./views/dashboard.js";
import {
  renderEquip,
  saveEquip,
  viewEquip,
  deleteEquip,
  populateEquipSelects,
} from "./views/equipamentos.js";
import { initRegistro, saveRegistro, clearRegistro } from "./views/registro.js";
import { renderHist, deleteReg } from "./views/historico.js";
import { renderAlertas } from "./views/alertas.js";
import {
  renderRelatorio,
  populateRelatorioSelects,
} from "./views/relatorio.js";

// components/ — MESMO nível (./), pois components/ está dentro de ui/
import { Photos } from "./components/photos.js";
import {
  ProfileModal,
  OnboardingBanner,
  FirstTimeExperience,
} from "./components/onboarding.js";

export function initController() {
  // ── Rotas ───────────────────────────────────────────
  registerRoute("inicio", () => {
    updateHeader();
    renderDashboard();
  });

  registerRoute("equipamentos", () => {
    populateEquipSelects();
    renderEquip();
    updateHeader();
  });

  registerRoute("registro", () => {
    populateEquipSelects();
    initRegistro();
    updateHeader();
  });

  registerRoute("historico", () => {
    populateEquipSelects();
    renderHist();
    updateHeader();
  });

  registerRoute("alertas", () => {
    renderAlertas();
    updateHeader();
  });

  registerRoute("relatorio", () => {
    populateRelatorioSelects();
    renderRelatorio();
    updateHeader();
  });

  // ── Handlers de ação ────────────────────────────────
  on("open-modal", (el) => Modal.open(el.dataset.id));
  on("close-modal", (el) => Modal.close(el.dataset.id));

  on("save-equip", () => saveEquip());
  on("view-equip", (el) => viewEquip(el.dataset.id));
  on("delete-equip", async (el) => {
    const ok = await CustomConfirm.show(
      "Excluir Equipamento",
      "Todos os registros deste equipamento serão removidos. Confirmar?",
    );
    if (ok) deleteEquip(el.dataset.id);
  });

  on("go-register-equip", (el) => {
    Modal.close("modal-eq-det");
    goTo("registro", { equipId: el.dataset.id });
  });

  on("save-registro", () => saveRegistro());
  on("clear-registro", () => clearRegistro());

  on("delete-reg", async (el) => {
    const ok = await CustomConfirm.show(
      "Excluir Registro",
      "Remover este registro do histórico?",
    );
    if (ok) deleteReg(el.dataset.id);
  });

  on("open-profile", () => {
    const isGuest = localStorage.getItem("cooltrack-guest-mode") === "1";
    if (isGuest) {
      ProfileModal.open();
      return;
    }
    Auth.getUser().then((user) => {
      if (user) _showAccountModal(user);
      else ProfileModal.open();
    });
  });
  on("toggle-client-mode", () => ClientMode.toggle());

  on("export-pdf", (el) => {
    el.textContent = "Gerando...";
    el.disabled = true;
    setTimeout(() => {
      const fileName = PDFGenerator.generateMaintenanceReport({
        filtEq: document.getElementById("rel-equip")?.value || "",
        de: document.getElementById("rel-de")?.value || "",
        ate: document.getElementById("rel-ate")?.value || "",
      });
      el.textContent = "Exportar PDF";
      el.disabled = false;
      if (fileName) Toast.success(`PDF gerado: ${fileName}`);
      else Toast.error("Erro ao gerar PDF.");
    }, 60);
  });

  on("whatsapp-export", () => {
    const ok = WhatsAppExport.send({
      filtEq: document.getElementById("rel-equip")?.value || "",
      de: document.getElementById("rel-de")?.value || "",
      ate: document.getElementById("rel-ate")?.value || "",
    });
    if (!ok) Toast.warning("Nenhum registro para enviar.");
  });

  on("print", () => window.print());

  // Lightbox
  on("close-lightbox", () => Photos.closeLightbox());

  // Expand detalhes técnicos no modal de cadastro
  const expandBtn = document.getElementById("eq-expand-details");
  const expandPanel = document.getElementById("eq-step-2");

  if (expandBtn && expandPanel) {
    expandBtn.addEventListener("click", () => {
      const isOpen = expandBtn.getAttribute("aria-expanded") === "true";
      expandBtn.setAttribute("aria-expanded", String(!isOpen));
      expandPanel.classList.toggle("is-open", !isOpen);
    });
  }

  // Inputs de foto
  const inputFotos = document.getElementById("input-fotos");
  if (inputFotos)
    inputFotos.addEventListener("change", (e) => Photos.add(e.target));

  // Filtros do histórico (debounce)
  _bindHistFilters();

  // Filtros do relatório
  ["rel-equip", "rel-de", "rel-ate"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", renderRelatorio);
  });

  // Tema
  _initTheme();

  // ClientMode
  ClientMode.restore();
  ClientMode.initToggleButton?.();
}

function _showAccountModal(user) {
  document.getElementById("account-modal-overlay")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "account-modal-overlay";
  overlay.className = "modal-overlay is-open";

  overlay.innerHTML = `
  <div class="modal modal--sm" style="align-self:center">
    <div class="modal__handle"></div>
    <div class="modal__title">Minha conta</div>
    <div class="modal__text" style="margin-bottom:16px">${user.email}</div>
    <button class="btn btn--outline" id="btn-edit-profile" style="margin-bottom:10px">Editar perfil</button>
    <button class="btn btn--danger" id="btn-signout">Sair da conta</button>
  </div>`;

  document.body.appendChild(overlay);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });

  overlay.querySelector("#btn-edit-profile").addEventListener("click", () => {
    overlay.remove();
    ProfileModal.open();
  });

  overlay.querySelector("#btn-signout").addEventListener("click", () => {
    overlay.remove();
    localStorage.removeItem("cooltrack-guest-mode");
    localStorage.removeItem("cooltrack-ftx-done");
    Auth.signOut();
  });
}

function _bindHistFilters() {
  let t;
  const debounce =
    (fn) =>
    (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), 280);
    };
  document
    .getElementById("hist-busca")
    ?.addEventListener("input", debounce(renderHist));
  document.getElementById("hist-equip")?.addEventListener("change", renderHist);
}

function _initTheme() {
  const btn = document.getElementById("theme-toggle");
  const icon = document.getElementById("theme-icon");
  if (!btn || !icon) return;

  const apply = (theme) => {
    if (theme === "light") {
      document.documentElement.setAttribute("data-theme", "light");
      icon.textContent = "☀️";
    } else {
      document.documentElement.removeAttribute("data-theme");
      icon.textContent = "🌙";
    }
    localStorage.setItem("cooltrack-theme", theme);
  };

  const preferred =
    localStorage.getItem("cooltrack-theme") ||
    (window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark");
  apply(preferred);

  btn.addEventListener("click", () => {
    apply(
      document.documentElement.getAttribute("data-theme") === "light"
        ? "dark"
        : "light",
    );
  });
}
