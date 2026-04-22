import { Utils } from '../../../core/utils.js';
import { setState } from '../../../core/state.js';
import { goTo } from '../../../core/router.js';
import { Profile } from '../../../features/profile.js';
import { trackEvent } from '../../../core/telemetry.js';
import { getOperationalStatus } from '../../../core/equipmentRules.js';
import { getSuggestedPreventiveDays } from '../../../domain/maintenance.js';
import './firstTimeExperience.css';

const FTX_KEY = 'cooltrack-ftx-done';
const FTX_SKIP_KEY = 'cooltrack-ftx-skipped';

function dismiss(overlay, { reason = 'completed', step = null } = {}) {
  if (!localStorage.getItem(FTX_KEY)) {
    if (reason === 'completed') {
      trackEvent('onboarding_completed', {});
    } else if (reason === 'skipped') {
      trackEvent('onboarding_skipped', { step });
    } else {
      trackEvent('onboarding_abandoned', { reason });
    }
  }

  if (reason === 'completed') {
    localStorage.setItem(FTX_KEY, '1');
    localStorage.removeItem(FTX_SKIP_KEY);
  } else if (reason === 'skipped') {
    localStorage.setItem(FTX_SKIP_KEY, '1');
  }

  overlay.remove();
}

function getTodayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  date.setDate(date.getDate() + days);
  return Utils.localDateString(date);
}

function buildInitialEquipment(nome) {
  return {
    id: Utils.uid(),
    nome,
    local: 'Local a definir',
    status: 'warn',
    statusDescricao: 'Sem manutenção recente ⚠️',
    tag: '',
    tipo: 'Split Hi-Wall',
    fluido: 'R-410A',
    modelo: '',
    onboardingStage: 'awaiting-first-maintenance',
  };
}

function buildBaselineRegistro(equipId, tecnico) {
  return {
    id: Utils.uid(),
    equipId,
    data: Utils.nowDatetime(),
    tipo: 'Linha de base inicial',
    pecas: '',
    obs: 'Equipamento criado no onboarding. Aguardando registro da última manutenção.',
    proxima: '',
    status: 'warn',
    fotos: [],
    tecnico,
  };
}

function buildFirstMaintenanceRegistro({ equipId, data, tipo, tecnico }) {
  const status = tipo === 'Manutenção Corretiva' ? 'warn' : 'ok';
  return {
    id: Utils.uid(),
    equipId,
    data: `${data}T09:00`,
    tipo,
    pecas: '',
    obs: `Última manutenção registrada durante o onboarding (${tipo.toLowerCase()}).`,
    proxima: '',
    status,
    fotos: [],
    tecnico,
  };
}

export const FirstTimeExperience = {
  show(equipamentos) {
    if (equipamentos.length) return;
    if (localStorage.getItem(FTX_KEY)) return;
    if (localStorage.getItem(FTX_SKIP_KEY)) return;

    trackEvent('onboarding_started', {});

    document.getElementById('ftx-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'ftx-overlay';

    overlay.innerHTML = `
      <div id="ftx-card">
        <div class="ftx-steps">
          <div class="ftx-step-dot active" id="ftx-dot-0"></div>
          <div class="ftx-step-dot" id="ftx-dot-1"></div>
        </div>
        <div id="ftx-content"></div>
      </div>
    `;

    document.body.appendChild(overlay);

    let techName = Profile.get()?.nome || 'Técnico responsável';
    let equipData = null;
    const contentEl = overlay.querySelector('#ftx-content');

    const setDots = (current) => {
      [0, 1].forEach((i) => {
        const dot = overlay.querySelector(`#ftx-dot-${i}`);
        if (!dot) return;
        dot.className = 'ftx-step-dot' + (i === current ? ' active' : i < current ? ' done' : '');
      });
    };

    const renderStepCreateEquipment = () => {
      setDots(0);
      contentEl.innerHTML = `
        <div class="ftx-step">
          <div class="ftx-logo">
            <div class="ftx-logo-icon">
              <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <g stroke="#00C8E8" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none">
                  <g>
                    <line x1="8" y1="2" x2="8" y2="14"/>
                    <polyline points="6.5,3.2 8,2 9.5,3.2"/>
                    <polyline points="6.5,12.8 8,14 9.5,12.8"/>
                  </g>
                  <g transform="rotate(60 8 8)">
                    <line x1="8" y1="2" x2="8" y2="14"/>
                    <polyline points="6.5,3.2 8,2 9.5,3.2"/>
                    <polyline points="6.5,12.8 8,14 9.5,12.8"/>
                  </g>
                  <g transform="rotate(120 8 8)">
                    <line x1="8" y1="2" x2="8" y2="14"/>
                    <polyline points="6.5,3.2 8,2 9.5,3.2"/>
                    <polyline points="6.5,12.8 8,14 9.5,12.8"/>
                  </g>
                </g>
                <circle cx="8" cy="8" r="0.9" fill="#00C8E8"/>
              </svg>
            </div>
            <span class="ftx-logo-text">CoolTrack</span>
            <span class="ftx-logo-sub">PRO</span>
          </div>

          <div class="ftx-eyebrow">Primeiro uso</div>
          <div class="ftx-title">Qual equipamento você quer começar a controlar?</div>
          <div class="ftx-desc">Digite um nome simples. Ex.: Split recepção, Câmara fria estoque.</div>

          <label class="ftx-form-label">Nome do equipamento</label>
          <input class="ftx-input" id="ftx-eq-name" type="text"
            placeholder="Ex: Split recepção"
            autocomplete="off" />

          <button class="ftx-btn-primary" id="ftx-create-equip">
            Criar e começar &rarr;
          </button>
          <button class="ftx-btn-skip" id="ftx-skip-0" type="button">
            Agora não
          </button>
          <div class="ftx-hint">Leva menos de 2 minutos</div>
        </div>`;

      const input = overlay.querySelector('#ftx-eq-name');
      const btn = overlay.querySelector('#ftx-create-equip');
      input?.focus();

      input?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') btn.click();
      });
      input?.addEventListener('input', () => {
        input.classList.remove('ftx-input--error');
        input.placeholder = 'Ex: Split recepção';
      });

      btn.addEventListener('click', () => {
        const nomeEquipamento = input.value.trim();
        if (!nomeEquipamento) {
          input.classList.add('ftx-input--error');
          input.placeholder = 'Digite um equipamento para continuar';
          input.focus();
          return;
        }

        techName = Profile.get()?.nome || 'Técnico responsável';
        Profile.saveLastTecnico(techName);

        const createdEquipment = buildInitialEquipment(nomeEquipamento);
        const baselineRegistro = buildBaselineRegistro(createdEquipment.id, techName);

        setState((prev) => ({
          ...prev,
          equipamentos: [...prev.equipamentos, createdEquipment],
          registros: [...prev.registros, baselineRegistro],
          tecnicos: prev.tecnicos.includes(techName) ? prev.tecnicos : [...prev.tecnicos, techName],
        }));

        trackEvent('first_equipment_added', {
          source: 'onboarding',
          tipo: createdEquipment.tipo,
          fluido: createdEquipment.fluido,
        });

        equipData = createdEquipment;
        renderStepRegisterMaintenance();
      });

      overlay.querySelector('#ftx-skip-0')?.addEventListener('click', () => {
        dismiss(overlay, { reason: 'skipped', step: 0 });
      });
    };

    const renderStepRegisterMaintenance = () => {
      setDots(1);
      const todayDate = getTodayIsoDate();

      contentEl.innerHTML = `
        <div class="ftx-step">
          <div class="ftx-eyebrow">Equipamento ativo</div>
          <div class="ftx-title">${Utils.escapeHtml(equipData?.nome || 'Equipamento')} criado com status inicial</div>
          <div class="ftx-desc">Sem manutenção recente ⚠️<br>Registre só a última manutenção para atualizar o status agora.</div>

          <label class="ftx-form-label">Data da última manutenção *</label>
          <input class="ftx-input" id="ftx-maint-date" type="date" value="${Utils.escapeAttr(todayDate)}" />

          <label class="ftx-form-label">Tipo de manutenção *</label>
          <select class="ftx-select" id="ftx-maint-type">
            <option>Manutenção Preventiva</option>
            <option>Manutenção Corretiva</option>
          </select>

          <button class="ftx-btn-primary" id="ftx-save-maint">
            Registrar última manutenção
          </button>
          <button class="ftx-btn-skip" id="ftx-skip-1" type="button">
            Continuar depois
          </button>
          <div class="ftx-hint">Após salvar, o card é atualizado em tempo real</div>
        </div>`;

      const dateInput = overlay.querySelector('#ftx-maint-date');
      const typeInput = overlay.querySelector('#ftx-maint-type');
      const btn = overlay.querySelector('#ftx-save-maint');
      dateInput?.focus();

      dateInput?.addEventListener('input', () => dateInput.classList.remove('ftx-input--error'));

      overlay.querySelector('#ftx-skip-1')?.addEventListener('click', () => {
        dismiss(overlay, { reason: 'skipped', step: 1 });
      });

      btn.addEventListener('click', () => {
        const maintDate = dateInput.value.trim();
        if (!maintDate) {
          dateInput.classList.add('ftx-input--error');
          dateInput.focus();
          return;
        }

        const maintenanceType = typeInput.value;
        const registro = buildFirstMaintenanceRegistro({
          equipId: equipData.id,
          data: maintDate,
          tipo: maintenanceType,
          tecnico: techName,
        });

        setState((prev) => ({
          ...prev,
          registros: [...prev.registros, registro],
          equipamentos: prev.equipamentos.map((item) => {
            if (item.id !== equipData.id) return item;
            const op = getOperationalStatus({
              status: registro.status,
              lastStatus: registro.status,
              ultimoRegistro: { status: registro.status },
            });
            const proxima =
              maintenanceType === 'Manutenção Preventiva'
                ? addDays(maintDate, getSuggestedPreventiveDays(item))
                : '';
            return {
              ...item,
              status: op.uiStatus === 'unknown' ? item.status : op.uiStatus,
              statusDescricao: op.label,
              onboardingStage: null,
              ultimaManutencaoData: maintDate,
              ultimaManutencaoTipo: maintenanceType,
              proximaPreventivaOnboarding: proxima,
            };
          }),
        }));

        trackEvent('onboarding_activation_completed', {
          source: 'first-time-experience',
          maintenanceType,
        });

        dismiss(overlay, { reason: 'completed' });
        goTo('equipamentos');
      });
    };

    renderStepCreateEquipment();
  },

  reopen(equipamentos) {
    localStorage.removeItem(FTX_SKIP_KEY);
    this.show(equipamentos);
  },
};
