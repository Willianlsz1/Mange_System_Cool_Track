/**
 * CoolTrack Pro - Events Module v4.0
 * Delegação de eventos + bindings de inputs
 */

import { Utils }                                        from './utils.js';
import { goView, Equipamentos, Registro, Historico,
         renderEquip, renderHist, renderRelatorio }     from './ui.js';
import { Modal, CustomConfirm }                         from './modal.js';
import { Photos }                                       from './photos.js';
import { PDFGenerator }                                 from './pdf.js';
import { Toast }                                        from './toast.js';

function debounce(fn, delay) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), delay);
  };
}

export function bindEvents() {

  // ── Delegação principal ─────────────────────────
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
        'Todos os registros de manutenção deste equipamento serão removidos. Confirmar?'
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
      const ok = await CustomConfirm.show(
        'Excluir Registro',
        'Deseja remover este registro do histórico de manutenção?'
      );
      if (ok) Historico.delete(deleteReg.dataset.id);
      return;
    }

    // Lightbox — fechar no botão ou no overlay
    if (e.target.closest('.lightbox__close')) return Photos.closeLightbox();
    if (e.target === Utils.getEl('lightbox'))  return Photos.closeLightbox();
  });

  // ── Tecla Escape fecha lightbox ─────────────────
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const lb = Utils.getEl('lightbox');
      if (lb?.classList.contains('is-open')) Photos.closeLightbox();
    }
  });

  // ── Teclado em equip-card (acessibilidade) ──────
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('[data-action="view-equip"]');
    if (card) { e.preventDefault(); Equipamentos.view(card.dataset.id); }
  });

  // ── Inputs de fotos ─────────────────────────────
  const inputFotos = Utils.getEl('input-fotos');
  if (inputFotos) inputFotos.addEventListener('change', e => Photos.add(e.target));

  // ── Busca de equipamentos (debounce 280ms) ──────
  const searchEquip = document.querySelector('#view-equipamentos .search-bar__input');
  if (searchEquip) {
    const deb = debounce(val => renderEquip(val), 280);
    searchEquip.addEventListener('input', e => deb(e.target.value));
  }

  // ── Filtros do histórico ─────────────────────────
  const histBusca = Utils.getEl('hist-busca');
  if (histBusca) histBusca.addEventListener('input', debounce(renderHist, 280));

  const histEquip = Utils.getEl('hist-equip');
  if (histEquip) histEquip.addEventListener('change', renderHist);

  // ── Filtros do relatório ─────────────────────────
  ['rel-equip', 'rel-de', 'rel-ate'].forEach(id => {
    const el = Utils.getEl(id);
    if (el) el.addEventListener('change', renderRelatorio);
  });

  // ── Exportar PDF ─────────────────────────────────
  const btnPdf = Utils.getEl('btn-export-pdf');
  if (btnPdf) {
    btnPdf.addEventListener('click', () => {
      btnPdf.textContent = 'Gerando...';
      btnPdf.disabled    = true;

      // setTimeout garante que o botão re-renderiza antes do jsPDF bloquear a thread
      setTimeout(() => {
        const fileName = PDFGenerator.generateMaintenanceReport({
          filtEq: Utils.getVal('rel-equip'),
          de:     Utils.getVal('rel-de'),
          ate:    Utils.getVal('rel-ate'),
        });

        btnPdf.textContent = 'Exportar PDF';
        btnPdf.disabled    = false;

        if (fileName) Toast.success(`PDF gerado: ${fileName}`);
        else          Toast.error('Erro ao gerar PDF. Verifique o console (F12).');
      }, 60);
    });
  }

  // ── Imprimir ─────────────────────────────────────
  const btnPrint = Utils.getEl('btn-print');
  if (btnPrint) btnPrint.addEventListener('click', () => window.print());
}