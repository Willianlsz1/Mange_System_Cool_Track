import { Utils } from './utils.js';
import { goView, Modal, Equipamentos, Registro, Historico, Photos, CustomConfirm, renderEquip, renderHist, renderRelatorio } from './ui.js';

function debounce(fn, delay) {
  let timeout;
  return function(...args) { clearTimeout(timeout); timeout = setTimeout(() => fn.apply(this, args), delay); };
}

export function bindEvents() {
  document.addEventListener('click', async (e) => {
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

    // FIX 5: Modal customizado para excluir equipamento
    const deleteEquip = e.target.closest('[data-action="delete-equip"]');
    if (deleteEquip) {
      const confirmed = await CustomConfirm.show('Excluir Equipamento', 'Tem certeza que deseja excluir este equipamento e todos os seus registros de manutenção?');
      if (confirmed) Equipamentos.delete(deleteEquip.dataset.id);
      return;
    }

    const saveReg = e.target.closest('[data-action="save-registro"]');
    if (saveReg) return Registro.save();

    // FIX 3: O botão "Limpar" agora reseta TUDO. O fluxo vindo do modal não usa mais o clear().
    const clearReg = e.target.closest('[data-action="clear-registro"]');
    if (clearReg) return Registro.clear(false);

    // FIX 5: Modal customizado para excluir registro
    const deleteReg = e.target.closest('[data-action="delete-reg"]');
    if (deleteReg) {
      const confirmed = await CustomConfirm.show('Excluir Registro', 'Deseja apagar este registro de manutenção do histórico?');
      if (confirmed) Historico.delete(deleteReg.dataset.id);
      return;
    }

    if (e.target.closest('.lightbox__close')) return Photos.closeLightbox();
  });

  const inputFotos = Utils.getEl('input-fotos');
  if (inputFotos) inputFotos.addEventListener('change', (e) => Photos.add(e.target));

  const searchEquip = document.querySelector('#view-equipamentos .search-bar__input');
  if (searchEquip) {
    const debouncedSearch = debounce((value) => renderEquip(value), 300);
    searchEquip.addEventListener('input', (e) => debouncedSearch(e.target.value));
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
}