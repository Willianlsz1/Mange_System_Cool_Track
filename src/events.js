/**
 * CoolTrack Pro - Events Module v3.4
 * Importa de módulos separados: modal.js, photos.js
 */

import { Utils } from './utils.js';
import { goView, Equipamentos, Registro, Historico, renderEquip, renderHist, renderRelatorio } from './ui.js';
import { Modal, CustomConfirm } from './modal.js';
import { Photos } from './photos.js';
import { PDFGenerator } from './pdf.js';
import { Toast } from './toast.js';

function debounce(fn, delay) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), delay);
  };
}

export function bindEvents() {
  // ============================================================
  // DELEGAÇÃO PRINCIPAL DE CLICKS
  // ============================================================
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
      const confirmed = await CustomConfirm.show(
        'Excluir Equipamento',
        'Tem certeza que deseja excluir este equipamento e todos os seus registros de manutenção?'
      );
      if (confirmed) Equipamentos.delete(deleteEquip.dataset.id);
      return;
    }

    const saveReg = e.target.closest('[data-action="save-registro"]');
    if (saveReg) return Registro.save();

    const clearReg = e.target.closest('[data-action="clear-registro"]');
    if (clearReg) return Registro.clear(false);

    const deleteReg = e.target.closest('[data-action="delete-reg"]');
    if (deleteReg) {
      const confirmed = await CustomConfirm.show(
        'Excluir Registro',
        'Deseja apagar este registro de manutenção do histórico?'
      );
      if (confirmed) Historico.delete(deleteReg.dataset.id);
      return;
    }

    if (e.target.closest('.lightbox__close')) return Photos.closeLightbox();

    // Lightbox: fechar ao clicar no fundo (fix: lightbox não fechava no overlay)
    const lightbox = Utils.getEl('lightbox');
    if (lightbox && e.target === lightbox) return Photos.closeLightbox();
  });

  // ============================================================
  // INPUTS
  // ============================================================
  const inputFotos = Utils.getEl('input-fotos');
  if (inputFotos) inputFotos.addEventListener('change', e => Photos.add(e.target));

  const searchEquip = document.querySelector('#view-equipamentos .search-bar__input');
  if (searchEquip) {
    const debouncedSearch = debounce(value => renderEquip(value), 300);
    searchEquip.addEventListener('input', e => debouncedSearch(e.target.value));
  }

  const histBusca = Utils.getEl('hist-busca');
  if (histBusca) histBusca.addEventListener('input', renderHist);

  const histEquip = Utils.getEl('hist-equip');
  if (histEquip) histEquip.addEventListener('change', renderHist);

  const relEquip = Utils.getEl('rel-equip');
  if (relEquip) relEquip.addEventListener('change', renderRelatorio);

  const relDe = Utils.getEl('rel-de');
  if (relDe) relDe.addEventListener('change', renderRelatorio);

  const relAte = Utils.getEl('rel-ate');
  if (relAte) relAte.addEventListener('change', renderRelatorio);

  // ============================================================
  // BOTÃO EXPORTAR PDF
  // ============================================================
  const btnExportPdf = Utils.getEl('btn-export-pdf');
  if (btnExportPdf) {
    btnExportPdf.addEventListener('click', () => {
      const fileName = PDFGenerator.generateMaintenanceReport({
        filtEq: Utils.getVal('rel-equip'),
        de: Utils.getVal('rel-de'),
        ate: Utils.getVal('rel-ate')
      });
      if (fileName) {
        Toast.success(`PDF gerado: ${fileName}`);
      } else {
        Toast.error('Erro ao gerar PDF. Verifique o console (F12).');
      }
    });
  }
}