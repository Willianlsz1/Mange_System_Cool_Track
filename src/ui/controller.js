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

// views/ — MESMO nível (./), pois views/ está dentro de ui/
import { renderDashboard, updateHeader } from "./views/dashboard.js";
import {
  renderEquip,
  saveEquip,
  viewEquip,
  deleteEquip,
  populateEquipSelects,
} from "./views/equipamentos.js";
import { renderHist, deleteReg } from "./views/historico.js";
import { renderAlertas } from "./views/alertas.js";
import {
  renderRelatorio,
  populateRelatorioSelects,
} from "./views/relatorio.js";
import {
  initRegistro,
  saveRegistro,
  clearRegistro,
  loadRegistroForEdit,
} from "./views/registro.js";

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
  sessionStorage.removeItem("cooltrack-editing-id");
  // restaura título e botão
  const btn = document.querySelector('[data-action="save-registro"]');
  if (btn) {
    btn.textContent = "Salvar registro";
    btn.style.background = "";
  }
  const title = document.querySelector("#view-registro .section-title");
  if (title) title.textContent = "O que foi feito hoje?";

  on("delete-reg", async (el) => {
    const ok = await CustomConfirm.show(
      "Excluir Registro",
      "Remover este registro do histórico?",
    );
    if (ok) deleteReg(el.dataset.id);
  });

  on("edit-reg", (el) => {
    goTo("registro");
    setTimeout(() => {
      populateEquipSelects();
      loadRegistroForEdit(el.dataset.id);
    }, 200);
  });

  on("open-profile", () => {
    const isGuest = localStorage.getItem("cooltrack-guest-mode") === "1";
    if (isGuest) {
      ProfileModal.open();
      return;
    }
    Auth.getUser()
      .then((user) => {
        console.log("[Profile] user:", user);
        if (user) _showAccountModal(user);
        else ProfileModal.open();
      })
      .catch((err) => {
        console.error("[Profile] error:", err);
        ProfileModal.open();
      });
  });

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
}

function _showAccountModal(user) {
  document.getElementById("account-modal-overlay")?.remove();

  const profile = Profile.get();
  const nome = profile?.nome || "Técnico";
  const iniciais = nome
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const email = user?.email || "";

  const overlay = document.createElement("div");
  overlay.id = "account-modal-overlay";
  overlay.className = "modal-overlay is-open";

  overlay.innerHTML = `
    <div class="modal" style="align-self:center;padding:0;overflow:hidden;max-width:420px;width:100%;border-radius:var(--premier-radius)">

      <!-- Header com avatar -->
      <div style="
        background:linear-gradient(135deg,rgba(0,212,255,0.12),rgba(0,212,255,0.03));
        border-bottom:1px solid rgba(255,255,255,0.07);
        padding:28px 28px 24px;
        display:flex;align-items:center;gap:14px
      ">
        <div style="
          width:48px;height:48px;border-radius:50%;
          background:rgba(0,212,255,0.15);
          border:1.5px solid rgba(0,212,255,0.3);
          display:flex;align-items:center;justify-content:center;
          font-size:17px;font-weight:700;color:#00D4FF;
          flex-shrink:0;letter-spacing:.02em
        " id="account-modal-avatar"></div>
        <div style="min-width:0">
          <div id="account-modal-name" style="font-size:15px;font-weight:600;color:#E8F2FA;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          </div>
          <div id="account-modal-email" style="font-size:12px;color:#4A6880;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          </div>
        </div>
      </div>

      <!-- Ações -->
      <div style="padding:16px">
        <button id="btn-edit-profile" style="
          width:100%;background:transparent;
          border:1px solid rgba(255,255,255,0.08);
          border-radius:8px;padding:14px 16px;
          display:flex;align-items:center;gap:10px;
          color:#8AAAC8;font-size:14px;font-family:inherit;
          cursor:pointer;transition:all .15s;margin-bottom:6px;
          text-align:left
        ">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <circle cx="7.5" cy="5" r="3" stroke="currentColor" stroke-width="1.2"/>
            <path d="M2 14c0-3 2.5-4.5 5.5-4.5S13 11 13 14" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
          </svg>
          Editar perfil
        </button>
        <button id="btn-signout" style="
          width:100%;background:rgba(255,68,102,0.08);
          border:1px solid rgba(255,68,102,0.18);
          border-radius:8px;padding:11px 14px;
          display:flex;align-items:center;gap:10px;
          color:#FF4466;font-size:14px;font-family:inherit;
          cursor:pointer;transition:all .15s;
          text-align:left
        ">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <path d="M6 2H3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
            <path d="M10 10l3-2.5L10 5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M13 7.5H6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
          </svg>
          Sair da conta
        </button>
      </div>
	    </div>`;

  const avatarEl = overlay.querySelector("#account-modal-avatar");
  const nameEl = overlay.querySelector("#account-modal-name");
  const emailEl = overlay.querySelector("#account-modal-email");
  if (avatarEl) avatarEl.textContent = iniciais;
  if (nameEl) nameEl.textContent = nome;
  if (emailEl) emailEl.textContent = email;

  document.body.appendChild(overlay);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });

  overlay
    .querySelector("#btn-edit-profile")
    .addEventListener("mouseenter", (e) => {
      e.target.style.borderColor = "rgba(255,255,255,0.16)";
      e.target.style.color = "#E8F2FA";
      e.target.style.background = "rgba(255,255,255,0.04)";
    });
  overlay
    .querySelector("#btn-edit-profile")
    .addEventListener("mouseleave", (e) => {
      e.target.style.borderColor = "rgba(255,255,255,0.08)";
      e.target.style.color = "#8AAAC8";
      e.target.style.background = "transparent";
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
