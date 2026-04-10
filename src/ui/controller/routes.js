import { registerRoute } from '../../core/router.js';
import { renderDashboard, updateHeader } from '../views/dashboard.js';
import { renderEquip, populateEquipSelects } from '../views/equipamentos.js';
import { renderHist } from '../views/historico.js';
import { renderAlertas } from '../views/alertas.js';
import { renderRelatorio, populateRelatorioSelects } from '../views/relatorio.js';
import { initRegistro, loadRegistroForEdit } from '../views/registro.js';

export function registerAppRoutes() {
  registerRoute('inicio', () => {
    updateHeader();
    renderDashboard();
  });

  registerRoute('equipamentos', () => {
    populateEquipSelects();
    renderEquip();
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

  registerRoute('relatorio', () => {
    populateRelatorioSelects();
    renderRelatorio();
    updateHeader();
  });
}
