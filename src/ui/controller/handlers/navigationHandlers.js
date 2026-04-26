import { on } from '../../../core/events.js';
import { Modal } from '../../../core/modal.js';
import { goTo } from '../../../core/router.js';
import { trackEvent } from '../../../core/telemetry.js';
import { Photos } from '../../components/photos.js';
import { SupportFeedbackModal } from '../../components/supportFeedbackModal.js';
import { Toast } from '../../../core/toast.js';
import { Tour } from '../../components/tour.js';
import { AuthScreen } from '../../components/authscreen.js';
import {
  clearEditingState as clearEquipEditingState,
  clearSetorEditingState,
  clearEquipPhotosEditingState,
} from '../../views/equipamentos.js';
import {
  applyNameplateCtaGate,
  resetNameplateCtaState,
} from '../../components/nameplateCapture.js';
import { isCachedPlanPlusOrHigher } from '../../../core/plans/planCache.js';
import { toggleTheme } from '../helpers/themeInitHelpers.js';

let isHelpOpen = false;

// Memoria do parent original do menu (.header-settings) pra restaurar quando
// fechar. Evita perder a posicao DOM-padrao quando reabrir do header (mobile).
let _menuOriginalParent = null;

function setHelpMenuState(open, anchorEl = null) {
  const menu = document.getElementById('header-help-menu');
  const headerTrigger = document.getElementById('header-help-btn');
  const sidenavTrigger = document.getElementById('sidenav-settings');
  if (!menu) return;
  isHelpOpen = Boolean(open);

  // Atualiza aria-expanded em ambos os triggers
  if (headerTrigger) {
    headerTrigger.setAttribute('aria-expanded', String(isHelpOpen));
    headerTrigger.classList.toggle('is-active', isHelpOpen);
  }
  if (sidenavTrigger) {
    sidenavTrigger.setAttribute('aria-expanded', String(isHelpOpen));
    sidenavTrigger.classList.toggle('is-active', isHelpOpen);
  }

  if (!isHelpOpen) {
    menu.hidden = true;
    menu.style.cssText = '';
    // Restaura ao parent original (caso tivermos movido pra body)
    if (_menuOriginalParent && menu.parentElement === document.body) {
      _menuOriginalParent.appendChild(menu);
    }
    return;
  }

  // Aberto via sidebar Configurações: move o menu pra ser filho direto do
  // body com position fixed perto do anchor. Isso evita problemas de
  // containing block / overflow / display:contents do parent original.
  if (anchorEl) {
    if (!_menuOriginalParent) _menuOriginalParent = menu.parentElement;
    if (menu.parentElement !== document.body) {
      document.body.appendChild(menu);
    }
    const rect = anchorEl.getBoundingClientRect();
    const menuWidth = 210;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - menuWidth - 8));
    const bottom = Math.max(8, window.innerHeight - rect.top + 8);
    menu.style.cssText = `position: fixed !important; left: ${left}px !important; bottom: ${bottom}px !important; right: auto !important; top: auto !important; z-index: 9999 !important; display: grid !important;`;
    menu.hidden = false;
  } else {
    // Aberto via header (mobile): restaura ao parent original e usa o
    // positioning padrao do CSS.
    if (_menuOriginalParent && menu.parentElement === document.body) {
      _menuOriginalParent.appendChild(menu);
    }
    menu.style.cssText = '';
    menu.hidden = false;
  }
}

export function bindNavigationHandlers() {
  if (!document.body.dataset.helpMenuBound) {
    document.body.dataset.helpMenuBound = '1';
    document.addEventListener('click', (event) => {
      // Considera clique "dentro" quando mira o trigger, o menu em si,
      // ou qualquer wrapper legado/novo (.header-help / .header-settings)
      const insideHelp = event.target.closest(
        '#header-help-btn, #header-help-menu, .header-help, .header-settings, #sidenav-settings, .app-sidebar__settings',
      );
      if (!insideHelp && isHelpOpen) setHelpMenuState(false);
    });

    document.addEventListener('app:route-changed', () => {
      if (isHelpOpen) setHelpMenuState(false);
    });
  }

  on('open-modal', (el) => {
    const id = el.dataset.id;
    // Ao abrir o modal de equipamento via "+ Novo", garante que não estamos em modo edição
    if (id === 'modal-add-eq') {
      clearEquipEditingState();
      // Sync visibilidade do select de componente (evap/cond) baseado no
      // tipo atual. Também bind one-time do change listener no tipo pra
      // re-sync quando user trocar.
      import('../../views/equipamentos.js').then((m) => {
        m.syncComponenteVisibility?.();
        const tipoEl = document.getElementById('eq-tipo');
        if (tipoEl && !tipoEl.dataset.componenteBound) {
          tipoEl.dataset.componenteBound = '1';
          tipoEl.addEventListener('change', () => m.syncComponenteVisibility?.());
        }
      });
      // Inicializa os custom dropdowns de Setor + Cliente (V2 redesign).
      // Idempotente: bind global so na primeira chamada; sync labels sempre.
      import('../../components/eqContextPicker.js').then((m) => {
        m.initEqContextPickers?.();
      });
      // PMOC Fase 2: popula select de clientes (lazy hydrate). Fire-and-forget;
      // se falhar, o wrapper fica hidden (default) e o campo simplesmente
      // não aparece — não quebra o cadastro.
      import('../../views/clientes.js')
        .then((m) => m.populateClienteSelect?.())
        .then(() => {
          // Bug fix #103: pre-preenche Setor + Cliente quando o "+ Novo
          // equipamento" foi clicado dentro do drill-down de um setor.
          // Lê data-setor-id e data-cliente-id do botao trigger.
          const setorId = el.dataset.setorId || '';
          const clienteId = el.dataset.clienteId || '';
          if (setorId) {
            const setorSelect = document.getElementById('eq-setor');
            if (setorSelect) {
              setorSelect.value = setorId;
              // Dispara change pra que o eqContextPicker sincronize o label
              // do dropdown custom (que mostra o nome do setor selecionado).
              setorSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }
          if (clienteId) {
            const clienteSelect = document.getElementById('eq-cliente');
            if (clienteSelect) {
              clienteSelect.value = clienteId;
              clienteSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }
        })
        .catch(() => {
          /* no-op: campo cliente é opcional */
        });
      // V4: o bloco de fotos saiu desse modal. O único gate síncrono que
      // resta aqui é o do hero CTA de análise de placa (Plus+).
      const isPlusOrPro = isCachedPlanPlusOrHigher();
      resetNameplateCtaState();
      // Estado inicial sincrono. Se Plus+, vai direto pra 'active'. Se Free,
      // deixa null como trialRemaining — o re-check async descobre quota.
      // Conservador: enquanto o fetch não volta, Free vê 'locked' (pior caso
      // é 200ms de flash até vir o state real; melhor que o inverso, que era
      // mostrar 'active' e falhar na hora do clique).
      applyNameplateCtaGate({ isPlusOrPro, trialRemaining: null });

      // Re-check async com o profile real do banco. Necessário porque o
      // cache local pode estar stale (cold start, nova aba, login recente,
      // TTL expirado) — nesses casos o cache volta como "free" e o user
      // paga vê o botão "Desbloquear com Plus" indevidamente. O recheck
      // corrige o gate assim que o profile chega.
      // Quando o plano é Free, também busca a quota mensal pra decidir
      // entre 'trial' (tem uso restante) e 'locked' (já usou). Silencia
      // erros: se fetch falhar (offline), estado do cache prevalece.
      (async () => {
        try {
          const { fetchMyProfileBilling } = await import('../../../core/plans/monetization.js');
          const { hasPlusAccess } = await import('../../../core/plans/subscriptionPlans.js');
          const { supabase } = await import('../../../core/supabase.js');
          const { profile } = await fetchMyProfileBilling();
          const realIsPlusOrPro = hasPlusAccess(profile);

          if (realIsPlusOrPro) {
            applyNameplateCtaGate({ isPlusOrPro: true, trialRemaining: null });
            return;
          }

          // Free: consulta quota do mês pro resource nameplate_analysis.
          // Se quota restante > 0 → state='trial', senão 'locked'.
          const [
            { getMonthlyUsageSnapshot, USAGE_RESOURCE_NAMEPLATE_ANALYSIS, getMonthlyLimitForPlan },
            userRes,
          ] = await Promise.all([import('../../../core/usageLimits.js'), supabase.auth.getUser()]);
          const userId = userRes?.data?.user?.id ?? null;
          if (!userId) {
            applyNameplateCtaGate({ isPlusOrPro: false, trialRemaining: null });
            return;
          }
          const snap = await getMonthlyUsageSnapshot(userId);
          const used = Number(snap?.[USAGE_RESOURCE_NAMEPLATE_ANALYSIS] ?? 0) || 0;
          const limit = getMonthlyLimitForPlan(
            profile?.plan_code ?? 'free',
            USAGE_RESOURCE_NAMEPLATE_ANALYSIS,
          );
          const remaining = Number.isFinite(limit) ? Math.max(0, limit - used) : 0;
          applyNameplateCtaGate({ isPlusOrPro: false, trialRemaining: remaining });
        } catch (_) {
          /* offline / sessão expirada — mantém o estado do cache */
        }
      })();
    }
    if (id === 'modal-add-setor') clearSetorEditingState();
    Modal.open(id);
  });
  on('close-modal', (el) => {
    const id = el.dataset.id;
    Modal.close(id);
    // Ao fechar modais de criação/edição via Cancelar, reseta estado de edição
    if (id === 'modal-add-eq') {
      clearEquipEditingState();
      resetNameplateCtaState();
    }
    if (id === 'modal-add-setor') clearSetorEditingState();
    // Fechar o editor de fotos sem salvar → limpa state interno (evita
    // vazar pending photos pra próxima abertura).
    if (id === 'modal-eq-photos') clearEquipPhotosEditingState();
  });
  on('toggle-help-menu', (el) => {
    // Se o trigger é o botao Configurações do sidebar, passa ele como anchor
    // pra o menu ser reposicionado pra cima dele em vez do gear do header.
    const anchor = el?.id === 'sidenav-settings' ? el : null;
    setHelpMenuState(!isHelpOpen, anchor);
  });
  on('help-open-tutorial', () => {
    setHelpMenuState(false);
    Tour.restart();
  });
  on('help-score-info', () => {
    setHelpMenuState(false);
    // setTimeout garante que o evento de clique terminou de propagar
    // antes de abrir o modal — necessário no mobile
    setTimeout(() => Modal.open('modal-score-info'), 80);
  });
  on('help-support', () => {
    setHelpMenuState(false);
    SupportFeedbackModal.open('suporte');
  });

  on('help-feedback', () => {
    setHelpMenuState(false);
    SupportFeedbackModal.open('feedback');
  });

  on('toggle-theme', () => {
    setHelpMenuState(false);
    toggleTheme();
  });

  on('go-register-equip', (el) => {
    Modal.close('modal-eq-det');
    goTo('registro', { equipId: el.dataset.id });
  });

  on('edit-reg', (el) => {
    goTo('registro', { editRegistroId: el.dataset.id });
  });

  on('go-alertas', () => {
    goTo('alertas');
  });

  // V2 (#127): atalho do menu mobile (engrenagem) — bottom nav já tem 5
  // slots, então Orçamentos vive no header help menu como item mobile-only.
  on('go-orcamentos', () => {
    goTo('orcamentos');
  });

  on('go-equipamentos-preventiva-7d', () => {
    goTo('equipamentos', { statusFilter: 'preventiva-7d' });
  });

  // Continue draft card no painel: navega pra /registro com o id pra recuperar
  on('continue-draft', (el) => {
    const id = el?.dataset?.id;
    if (id) {
      goTo('registro', { editRegistroId: id });
    } else {
      goTo('registro');
    }
  });

  // Descarta o rascunho via clique no X do continue card
  on('discard-draft', async () => {
    try {
      sessionStorage.removeItem('cooltrack-editing-id');
    } catch (_e) {
      /* sessionStorage indisponivel */
    }
    Toast.success('Rascunho descartado.');
    // Re-renderiza o dashboard pra remover o card
    const { renderDashboard } = await import('../../views/dashboard.js');
    renderDashboard?.();
  });

  // Click num card de alerta de cliente em /alertas → navega pra grade de
  // setores do cliente (mesmo flow do "Ver equipamentos" no card do cliente).
  on('go-cliente-equipamentos', (el) => {
    const clienteId = el?.dataset?.id;
    const clienteNome = el?.dataset?.clienteNome || '';
    if (!clienteId) return;
    goTo('equipamentos', {
      equipCtx: { clienteId, clienteNome },
    });
  });

  // O handler 'print' foi movido para reportExportHandlers.js.
  // Agora usa window.print() nativo + marca d'água CSS no plano Free, em vez
  // de delegar ao botão "Exportar PDF" (que baixava jsPDF e gerava um arquivo
  // em vez de abrir o diálogo nativo de impressão).
  on('close-lightbox', () => Photos.closeLightbox());
  on('open-upgrade', async (el, event) => {
    event?.preventDefault?.();
    const source = [
      'usage_meter',
      'upgrade_nudge',
      'dashboard',
      'overflow_banner',
      'overflow_modal',
      'equip_detail_photos',
    ].includes(el?.dataset?.upgradeSource)
      ? el.dataset.upgradeSource
      : 'dashboard';
    const rawHighlight = el?.dataset?.highlightPlan;
    const highlightPlan = rawHighlight === 'plus' || rawHighlight === 'pro' ? rawHighlight : 'pro';
    trackEvent('upgrade_cta_clicked', { source, highlight_plan: highlightPlan });

    // Fecha qualquer modal aberto antes de navegar — senão o overlay fica
    // por cima da view de pricing e o usuário fica preso (ex.: CTA upsell
    // dentro do modal-eq-det). Quando o clique vem de fora de um modal,
    // o querySelectorAll retorna vazio e isto é no-op.
    document.querySelectorAll('.modal-overlay.is-open').forEach((overlay) => {
      if (overlay.id) Modal.close(overlay.id);
    });

    const { goTo: dynamicGoTo } = await import('../../../core/router.js');
    dynamicGoTo('pricing', { highlightPlan });
  });
  on('start-checkout', async (el, event) => {
    event?.preventDefault?.();
    const ALLOWED_PLANS = ['plus', 'plus_annual', 'pro', 'pro_annual'];
    const rawPlan = el?.dataset?.plan;
    const plan = ALLOWED_PLANS.includes(rawPlan) ? rawPlan : 'pro';
    const source = el?.dataset?.upgradeSource || 'pricing';
    trackEvent('checkout_start_clicked', { source, plan });

    try {
      const { startCheckout } = await import('../../../core/plans/monetization.js');
      const url = await startCheckout({ plan });
      window.location.href = url;
    } catch (error) {
      if (error?.code === 'NO_SESSION') {
        Toast.warning('Faça login para assinar o plano Pro.');
        AuthScreen.show();
        return;
      }

      if (error?.code === 'INVALID_JWT') {
        Toast.warning('Sessão expirada. Faça login novamente.');
        AuthScreen.show();
        return;
      }

      Toast.error(error?.message || 'Não foi possível iniciar o checkout.');
    }
  });

  on('manage-subscription', async (el, event) => {
    event?.preventDefault?.();
    trackEvent('manage_subscription_clicked', {});

    const btn = el instanceof HTMLElement ? el : null;
    const originalText = btn?.textContent ?? '';
    if (btn) btn.textContent = 'Abrindo...';

    const tryOpenPortal = async () => {
      const { startBillingPortal } = await import('../../../core/plans/monetization.js');
      const url = await startBillingPortal();
      window.location.href = url;
    };

    try {
      await tryOpenPortal();
    } catch (firstError) {
      // Se a sessão está inválida, tenta um refresh silencioso e repete uma vez
      if (firstError?.code === 'NO_SESSION' || firstError?.code === 'INVALID_JWT') {
        try {
          const { supabase } = await import('../../../core/supabase.js');
          const { data } = await supabase.auth.refreshSession();
          if (data?.session) {
            // Sessão renovada — tenta abrir o portal novamente
            await tryOpenPortal();
            return;
          }
        } catch (_) {
          // refresh falhou — segue para o fluxo de login abaixo
        }

        // Refresh não resolveu: pede login explícito
        if (btn) btn.textContent = originalText;
        Toast.warning('Sua sessão expirou. Faça login novamente para gerenciar sua assinatura.');
        AuthScreen.show();
        return;
      }

      if (btn) btn.textContent = originalText;

      if (firstError?.code === 'NO_STRIPE_CUSTOMER') {
        Toast.warning(firstError.message || 'Nenhuma assinatura ativa encontrada.');
        return;
      }

      Toast.error(
        firstError?.message ||
          'Não foi possível abrir o portal. Tente novamente ou entre em contato com o suporte.',
      );
    }
  });
}
