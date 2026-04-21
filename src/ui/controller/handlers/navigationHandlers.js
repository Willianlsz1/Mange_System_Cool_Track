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

function setHelpMenuState(open) {
  const menu = document.getElementById('header-help-menu');
  const trigger = document.getElementById('header-help-btn');
  if (!menu || !trigger) return;
  isHelpOpen = Boolean(open);
  menu.hidden = !isHelpOpen;
  trigger.setAttribute('aria-expanded', String(isHelpOpen));
  trigger.classList.toggle('is-active', isHelpOpen);
}

export function bindNavigationHandlers() {
  if (!document.body.dataset.helpMenuBound) {
    document.body.dataset.helpMenuBound = '1';
    document.addEventListener('click', (event) => {
      // Considera clique "dentro" quando mira o trigger, o menu em si,
      // ou qualquer wrapper legado/novo (.header-help / .header-settings)
      const insideHelp = event.target.closest(
        '#header-help-btn, #header-help-menu, .header-help, .header-settings',
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
  on('toggle-help-menu', () => {
    setHelpMenuState(!isHelpOpen);
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

  on('go-equipamentos-preventiva-7d', () => {
    goTo('equipamentos', { statusFilter: 'preventiva-7d' });
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
