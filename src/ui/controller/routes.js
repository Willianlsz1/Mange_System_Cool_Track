import { registerRoute } from '../../core/router.js';
import { renderDashboard, updateHeader } from '../views/dashboard.js';
import { renderEquip, populateEquipSelects } from '../views/equipamentos.js';
import { renderHist, setHistClienteFilter, clearHistClienteFilter } from '../views/historico.js';
import { renderAlertas } from '../views/alertas.js';
import { renderRelatorio, populateRelatorioSelects } from '../views/relatorio.js';
import { initRegistro, loadRegistroForEdit } from '../views/registro.js';
import { renderPricing } from '../views/pricing.js';
import { renderClientes, setClientesSearch } from '../views/clientes.js';
import { renderConta } from '../views/conta.js';
import { renderPrivacidade } from '../views/privacidade.js';

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

  registerRoute('historico', (params = {}) => {
    populateEquipSelects();
    // Filtro por cliente vindo de /clientes -> "Ver servicos". Se nao tiver
    // clienteId nos params, limpa o filtro existente.
    if (params.clienteId) {
      setHistClienteFilter({ id: params.clienteId, nome: params.clienteNome || '' });
    } else {
      clearHistClienteFilter();
    }
    renderHist();
    updateHeader();
  });

  registerRoute('alertas', () => {
    renderAlertas();
    updateHeader();
  });

  registerRoute('relatorio', (params = {}) => {
    populateRelatorioSelects();
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
    const search = document.getElementById('clientes-busca');
    if (search && !search.dataset.bound) {
      search.dataset.bound = '1';
      search.addEventListener('input', (e) => {
        setClientesSearch(e.target.value || '');
      });
    }
  });

  registerRoute('conta', () => {
    renderConta();
    updateHeader();
  });

  registerRoute('privacidade', () => {
    renderPrivacidade();
    updateHeader();
  });
}
