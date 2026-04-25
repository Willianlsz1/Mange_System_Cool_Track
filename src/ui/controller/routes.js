import { registerRoute } from '../../core/router.js';
import { renderDashboard, updateHeader } from '../views/dashboard.js';
import { renderEquip, populateEquipSelects } from '../views/equipamentos.js';
import { renderHist } from '../views/historico.js';
import { renderAlertas } from '../views/alertas.js';
import { renderRelatorio, populateRelatorioSelects } from '../views/relatorio.js';
import { initRegistro, loadRegistroForEdit } from '../views/registro.js';
import { renderPricing } from '../views/pricing.js';
import { renderClientes, setClientesSearch } from '../views/clientes.js';

export function registerAppRoutes() {
  registerRoute('inicio', () => {
    updateHeader();
    renderDashboard();
  });

  registerRoute('equipamentos', (params = {}) => {
    populateEquipSelects();
    renderEquip('', params);
    updateHeader();
  });

  registerRoute('registro', (params = {}) => {
    populateEquipSelects();
    initRegistro(params);
    if (params.editRegistroId) loadRegistroForEdit(params.editRegistroId);
    updateHeader();
  });

  registerRoute('historico', () => {
    populateEquipSelects();
    renderHist();
    updateHeader();
  });

  registerRoute('alertas', () => {
    renderAlertas();
    updateHeader();
  });

  registerRoute('relatorio', (params = {}) => {
    populateRelatorioSelects();
    // Pré-filtro por equipamento (usado pelo PostSaveRegistroToast: usuário
    // acabou de salvar um serviço e clicou em "Gerar PDF do relatório" →
    // cai aqui com o select já apontando pro equipamento certo).
    if (params.equipId) {
      const select = document.getElementById('rel-equip');
      if (select) select.value = String(params.equipId);
    }
    renderRelatorio();
    updateHeader();
  });

  registerRoute('pricing', (params = {}) => {
    renderPricing(params);
    updateHeader();
  });

  registerRoute('clientes', () => {
    renderClientes();
    updateHeader();
    // Liga search input (idempotente — sempre o mesmo input do shell)
    const search = document.getElementById('clientes-busca');
    if (search && !search.dataset.bound) {
      search.dataset.bound = '1';
      search.addEventListener('input', (e) => {
        setClientesSearch(e.target.value || '');
      });
    }
  });
}
