/**
 * CoolTrack Pro - Events Module v5.0 (SaaS)
 * + WhatsApp export
 * + Modal de perfil
 * + Client mode
 */

import { Utils }                                      from './utils.js';
import { goView, Equipamentos, Registro, Historico,
         renderEquip, renderHist, renderRelatorio }   from './ui.js';
import { Modal, CustomConfirm }                       from './modal.js';
import { Photos }                                     from './photos.js';
import { PDFGenerator }                               from './pdf.js';
import { Toast }                                      from './toast.js';
import { WhatsAppExport }                             from './whatsapp.js';
import { ProfileModal }                               from './onboarding.js';
import { ClientMode }                                 from './clientmode.js';

function _initEquipModal() {
  const btn = document.getElementById('eq-expand-details');
  const panel = document.getElementById('eq-step-2');
  const stepDot2 = document.getElementById('step-dot-2');
  if (!btn || !panel) return;

  btn.addEventListener('click', () => {
    const isOpen = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!isOpen));
    panel.setAttribute('aria-hidden', String(isOpen));
    panel.classList.toggle('is-open', !isOpen);
    if (!isOpen && stepDot2) stepDot2.classList.add('modal-step--active');
  });

  // Resetar estado ao fechar o modal
  document.getElementById('modal-add-eq')?.addEventListener('click', e => {
    if (e.target === document.getElementById('modal-add-eq')) _resetEquipModal();
  });

  document.querySelector('[data-action="close-modal"][data-id="modal-add-eq"]')
    ?.addEventListener('click', _resetEquipModal);
}

function _resetEquipModal() {
  const btn = document.getElementById('eq-expand-details');
  const panel = document.getElementById('eq-step-2');
  const stepDot2 = document.getElementById('step-dot-2');
  if (btn) btn.setAttribute('aria-expanded', 'false');
  if (panel) { panel.classList.remove('is-open'); panel.setAttribute('aria-hidden', 'true'); }
  if (stepDot2) stepDot2.classList.remove('modal-step--active');
}

function debounce(fn, delay) {
  let t;
  return function (...args) { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), delay); };
}

export function bindEvents() {

  // ── Modal progressivo de cadastro de equipamento ──────
  _initEquipModal();

  // ── Delegação principal ──────────────────────────────
  document.addEventListener('click', async e => {
    const navBtn = e.target.closest('[data-nav]');
    if (navBtn) return goView(navBtn.dataset.nav);

    const openModal = e.target.closest('[data-action="open-modal"]');
    if (openModal) return Modal.open(openModal.dataset.id);

    const closeModal = e.target.closest('[data-action="close-modal"]');
    if (closeModal) return Modal.close(closeModal.dataset.id);

    const saveEquip = e.target.closest('[data-action="save-equip"]');
    if (saveEquip) return Equipamentos.save();

    const viewEquip = e.target.closest('[data-action="view-equip"]');
    if (viewEquip) return Equipamentos.view(viewEquip.dataset.id);

    const deleteEquip = e.target.closest('[data-action="delete-equip"]');
    if (deleteEquip) {
      const ok = await CustomConfirm.show(
        'Excluir Equipamento',
        'Todos os registros deste equipamento serão removidos permanentemente. Confirmar?'
      );
      if (ok) Equipamentos.delete(deleteEquip.dataset.id);
      return;
    }

    const saveReg = e.target.closest('[data-action="save-registro"]');
    if (saveReg) return Registro.save();

    const clearReg = e.target.closest('[data-action="clear-registro"]');
    if (clearReg) return Registro.clear(false);

    const deleteReg = e.target.closest('[data-action="delete-reg"]');
    if (deleteReg) {
      const ok = await CustomConfirm.show('Excluir Registro', 'Deseja remover este registro do histórico?');
      if (ok) Historico.delete(deleteReg.dataset.id);
      return;
    }

    // Lightbox
    if (e.target.closest('.lightbox__close')) return Photos.closeLightbox();
    if (e.target === Utils.getEl('lightbox'))  return Photos.closeLightbox();

    // Perfil
    const profileBtn = e.target.closest('[data-action="open-profile"]');
    if (profileBtn) return ProfileModal.open();

    // Client mode
    const clientModeBtn = e.target.closest('[data-action="toggle-client-mode"]');
    if (clientModeBtn) return ClientMode.toggle();
  });

  // ── Escape fecha lightbox ────────────────────────────
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && Utils.getEl('lightbox')?.classList.contains('is-open')) Photos.closeLightbox();
  });

  // ── Enter em equip-card ──────────────────────────────
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('[data-action="view-equip"]');
    if (card) { e.preventDefault(); Equipamentos.view(card.dataset.id); }
  });

  // ── Inputs ───────────────────────────────────────────
  const inputFotos = Utils.getEl('input-fotos');
  if (inputFotos) inputFotos.addEventListener('change', e => Photos.add(e.target));

  const searchEquip = document.querySelector('#view-equipamentos .search-bar__input');
  if (searchEquip) searchEquip.addEventListener('input', debounce(e => renderEquip(e.target.value), 280));

  const histBusca = Utils.getEl('hist-busca');
  if (histBusca) histBusca.addEventListener('input', debounce(renderHist, 280));

  const histEquip = Utils.getEl('hist-equip');
  if (histEquip) histEquip.addEventListener('change', renderHist);

  ['rel-equip', 'rel-de', 'rel-ate'].forEach(id => {
    const el = Utils.getEl(id);
    if (el) el.addEventListener('change', renderRelatorio);
  });

  // ── PDF ──────────────────────────────────────────────
  const btnPdf = Utils.getEl('btn-export-pdf');
  if (btnPdf) {
    btnPdf.addEventListener('click', () => {
      const orig = btnPdf.textContent;
      btnPdf.textContent = 'Gerando...';
      btnPdf.disabled    = true;
      setTimeout(() => {
        const fileName = PDFGenerator.generateMaintenanceReport({
          filtEq: Utils.getVal('rel-equip'),
          de:     Utils.getVal('rel-de'),
          ate:    Utils.getVal('rel-ate'),
        });
        btnPdf.textContent = orig;
        btnPdf.disabled    = false;
        if (fileName) Toast.success(`PDF gerado: ${fileName}`);
        else          Toast.error('Erro ao gerar PDF. Verifique o console (F12).');
      }, 60);
    });
  }

  // ── Imprimir ─────────────────────────────────────────
  const btnPrint = Utils.getEl('btn-print');
  if (btnPrint) btnPrint.addEventListener('click', () => window.print());

  // ── WhatsApp (D5) ────────────────────────────────────
  const btnWa = Utils.getEl('btn-whatsapp');
  if (btnWa) {
    btnWa.addEventListener('click', () => {
      const ok = WhatsAppExport.send({
        filtEq: Utils.getVal('rel-equip'),
        de:     Utils.getVal('rel-de'),
        ate:    Utils.getVal('rel-ate'),
      });
      if (!ok) Toast.warning('Nenhum registro para enviar no período selecionado.');
    });
  }
}