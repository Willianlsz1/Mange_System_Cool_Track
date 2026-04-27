import { registerRoute } from '../../core/router.js';
import { renderDashboard, updateHeader } from '../views/dashboard.js';
import { renderEquip, populateEquipSelects } from '../views/equipamentos.js';
import { renderHist, setHistClienteFilter, clearHistClienteFilter } from '../views/historico.js';
import { renderAlertas } from '../views/alertas.js';
import { renderRelatorio, populateRelatorioSelects } from '../views/relatorio.js';
import { initRegistro, loadRegistroForEdit } from '../views/registro.js';
import { renderPricing } from '../views/pricing.js';
import { renderClientes, setClientesSearch } from '../views/clientes.js';
import { ClientesPaywallModal } from '../components/clientesPaywallModal.js';
import { getCachedPlan } from '../../core/plans/planCache.js';
import { PLAN_CODE_PRO } from '../../core/plans/subscriptionPlans.js';
import { renderConta } from '../views/conta.js';
import { renderPrivacidade } from '../views/privacidade.js';
import { OnboardingChecklist } from '../components/onboarding/onboardingChecklist.js';

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
    // UX V2 audit fix: equipamento picker com search + group por setor.
    // Lazy import (carrega so quando entra em /registro).
    import('../components/registroEquipPicker.js').then((m) => {
      m.initRegistroEquipPicker?.();
    });
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
    OnboardingChecklist.markStep('relatorio');
  });

  registerRoute('pricing', (params = {}) => {
    renderPricing(params);
    updateHeader();
  });

  registerRoute('clientes', () => {
    // Pro-gate: Free/Plus veem paywall em vez de view. Cache eh sync; refresh
    // assincrono nao eh necessario aqui porque o paywall eh apenas teaser
    // (real billing check acontece no momento do upgrade no Stripe).
    const planCode = getCachedPlan() || 'free';
    if (planCode !== PLAN_CODE_PRO) {
      ClientesPaywallModal.open();
      return;
    }
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

  // V3 Instalação (abr/2026): orçamentos disponiveis em todos os planos
  // (Free com limite de 1/mês como porta de entrada).
  registerRoute('orcamentos', async () => {
    updateHeader();
    const { loadAndRenderOrcamentos } = await import('../views/orcamentos.js');
    await loadAndRenderOrcamentos();
  });
}
