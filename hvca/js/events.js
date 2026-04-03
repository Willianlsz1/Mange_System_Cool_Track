import { Utils } from './utils.js';
import { 
  goView, renderEquip, renderHist, renderRelatorio, 
  Modal, Photos, Equipamentos, Registro, Historico 
} from './ui.js';

export function bindEvents() {
  // ==========================================
  // 1. ROTEADOR (Navegação entre as telas)
  // ==========================================
  document.addEventListener('click', (e) => {
    const navBtn = e.target.closest('[data-nav]');
    if (navBtn) {
      e.preventDefault();
      goView(navBtn.dataset.nav);
      return; // Para por aqui, não verifica outras ações
    }

    // ==========================================
    // 2. AÇÕES GLOBAIS (Modais, Registro)
    // ==========================================
    const actionBtn = e.target.closest('[data-action]');
    if (!actionBtn) return; // Se não tem ação, ignora

    const { action, id } = actionBtn.dataset;

    switch (action) {
      case 'open-modal':
        Modal.open(id);
        break;
      case 'close-modal':
        Modal.close(id);
        break;
      case 'save-equip':
        Equipamentos.save();
        break;
      case 'save-registro':
        Registro.save();
        break;
      case 'clear-registro':
        Registro.clear();
        break;
      // As ações dinâmicas (view-equip, delete-reg) ainda vêm do ui.js inline, 
      // vamos capturá-las aqui no Passo 2 para não quebrar o app agora.
      case 'view-equip':
        Equipamentos.view(id);
        break;
            case 'delete-reg':
        if (confirm('Tem certeza que deseja excluir este registro de manutenção?')) {
          Historico.delete(id);
        }
        break;
            case 'delete-equip':
        e.stopPropagation(); // IMPEDIR que o clique "vole" para o card e abra o modal
        if (confirm('Excluir equipamento e todos os seus registros?')) {
          Equipamentos.delete(id);
        }
        break;
    }
  });

  // ==========================================
  // 3. INPUTS DE BUSCA E FILTRO (Já existiam, mantidos)
  // ==========================================
  Utils.getEl('hist-busca')?.addEventListener('input', () => renderHist());
  Utils.getEl('hist-equip')?.addEventListener('change', () => renderHist());
  Utils.getEl('rel-equip')?.addEventListener('change', () => renderRelatorio());
  Utils.getEl('rel-de')?.addEventListener('change', () => renderRelatorio());
  Utils.getEl('rel-ate')?.addEventListener('change', () => renderRelatorio());
  
  // Busca de equipamentos com Debounce simples inline
  let searchTimeout;
  const equipSearch = document.querySelector('#view-equipamentos .search-bar__input');
  equipSearch?.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => renderEquip(e.target.value), 150); // Debounce de 150ms
  });

    const upload = document.querySelector('.photo-drop input[type="file"]');
  if (upload) {
    upload.addEventListener('change', (e) => {
      e.stopPropagation(); // Impede qualquer confusão com a div mãe
      Photos.add(e.currentTarget); // Garante que pega o próprio input
    });
  }

  Utils.getEl('lightbox')?.addEventListener('click', () => Photos.closeLightbox());
}
