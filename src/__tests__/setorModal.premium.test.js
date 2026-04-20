/**
 * Testes do modal premium de Criar/Editar Setor (P1).
 *
 * Cobre:
 * - setorContrastWithWhite (helper WCAG exportado)
 * - openEditSetor populando descricao + responsavel + cor selecionada
 * - saveSetor persistindo descricao + responsavel em create/update
 * - Validação inline: saveSetor com nome vazio mostra erro + aria-invalid
 * - clearSetorEditingState resetando todos os 4 campos + picker
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks de state.js ────────────────────────────────────────────────────
const getState = vi.fn();
const regsForEquip = vi.fn(() => []);
const findSetor = vi.fn();
const setStateMock = vi.fn();
vi.mock('../core/state.js', () => ({
  getState,
  regsForEquip,
  findSetor,
  findEquip: vi.fn(),
  setState: setStateMock,
}));

// priorityEngine — stub mínimo, não interessa pro modal de setor.
vi.mock('../domain/priorityEngine.js', () => ({
  evaluateEquipmentPriority: vi.fn(() => ({ priorityLevel: 1, priorityLabel: 'mock' })),
}));

// alerts — só referenciado pra contagem de preventiva30d, não afeta saveSetor.
vi.mock('../domain/alerts.js', () => ({
  Alerts: { getAll: vi.fn(() => []) },
  getPreventivaDueEquipmentIds: vi.fn(() => []),
}));

// maintenance — mock básico pra não quebrar import.
vi.mock('../domain/maintenance.js', () => ({
  evaluateEquipmentHealth: vi.fn(() => ({ score: 80, context: { daysToNext: 30 } })),
  evaluateEquipmentRisk: vi.fn(() => ({ score: 50 })),
  evaluateEquipmentRiskTrend: vi.fn(() => ({ trend: 'stable', delta: 0 })),
  getEquipmentMaintenanceContext: vi.fn(() => ({
    ultimoRegistro: null,
    daysToNext: 30,
    equipamento: { criticidade: 'media', status: 'ok' },
    recentCorrectiveCount: 0,
  })),
  getSuggestedPreventiveDays: vi.fn(() => 30),
  normalizePeriodicidadePreventivaDias: vi.fn((d) => d ?? 30),
}));

// skeleton — pass-through pra testes síncronos.
vi.mock('../ui/components/skeleton.js', () => ({
  withSkeleton: (_el, _opts, renderFn) => renderFn(),
}));

// monetization + subscriptionPlans — ensureProForSetores precisa passar.
vi.mock('../core/monetization.js', () => ({
  fetchMyProfileBilling: vi.fn(async () => ({ profile: { plan_code: 'pro' } })),
}));
vi.mock('../core/subscriptionPlans.js', () => ({
  hasProAccess: () => true,
  PLAN_CODE_FREE: 'free',
  PLAN_CODE_PLUS: 'plus',
  PLAN_CODE_PRO: 'pro',
}));

// modal.js — dynamic import dentro de saveSetor/openEditSetor.
vi.mock('../core/modal.js', () => ({
  Modal: { open: vi.fn(), close: vi.fn() },
}));

// toast — silenciar + permitir asserts.
const toastMock = {
  success: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
};
vi.mock('../core/toast.js', () => ({ Toast: toastMock }));

// ── Helper: monta o DOM do modal minimamente fiel ao template real. ─────
function mountSetorModalDom() {
  document.body.innerHTML = `
    <div id="modal-add-setor">
      <h2 id="modal-add-setor-title">Novo setor</h2>
      <input id="setor-nome" type="text" aria-invalid="false" />
      <span id="setor-nome-counter">0/40</span>
      <div id="setor-nome-err" hidden>Digite um nome para o setor.</div>
      <span id="setor-color-name">Ciano</span>
      <span id="setor-color-hex">#00c8e8</span>
      <div id="setor-color-picker" role="radiogroup">
        <div class="setor-modal__swatch-cell setor-modal__swatch-cell--selected">
          <button class="setor-modal__swatch setor-modal__swatch--selected" data-cor="#00c8e8" aria-checked="true"></button>
        </div>
        <div class="setor-modal__swatch-cell">
          <button class="setor-modal__swatch" data-cor="#ff5252" aria-checked="false"></button>
        </div>
        <div class="setor-modal__swatch-cell">
          <button class="setor-modal__swatch" data-cor="#7c4dff" aria-checked="false"></button>
        </div>
      </div>
      <input id="setor-cor" type="hidden" value="#00c8e8" />
      <textarea id="setor-descricao"></textarea>
      <span id="setor-descricao-counter">0/120</span>
      <input id="setor-responsavel" type="text" />
      <span id="setor-contrast" data-aa="pass">AA ✓ · 14.1:1</span>
      <div id="setor-modal-preview-card" style="--setor-cor:#00c8e8">
        <div id="setor-modal-preview-name">Novo setor</div>
      </div>
      <button id="setor-save-btn"><span class="setor-modal__btn-label">Criar setor →</span></button>
    </div>
  `;
}

beforeEach(() => {
  vi.clearAllMocks();
  // Reset module cache entre testes pra não vazar _editingSetorId (module-level
  // state do equipamentos.js). Sem isso, um openEditSetor() num teste deixa o
  // próximo saveSetor() caindo no branch de "isEditing" em vez de criar.
  vi.resetModules();
  mountSetorModalDom();
  getState.mockReturnValue({ equipamentos: [], registros: [], setores: [] });
});

// ─────────────────────────────────────────────────────────────────────────
describe('setorContrastWithWhite', () => {
  it('retorna ratio alto pra cor escura (#000 → 21:1)', async () => {
    const { setorContrastWithWhite } = await import('../ui/views/equipamentos.js');
    const ratio = setorContrastWithWhite('#000000');
    expect(ratio).toBeGreaterThan(20);
  });

  it('retorna ratio baixo pra cor clara (branco ~1)', async () => {
    const { setorContrastWithWhite } = await import('../ui/views/equipamentos.js');
    const ratio = setorContrastWithWhite('#ffffff');
    expect(ratio).toBeLessThan(1.1);
  });

  it('retorna ratio intermediário pra ciano default', async () => {
    const { setorContrastWithWhite } = await import('../ui/views/equipamentos.js');
    const ratio = setorContrastWithWhite('#00c8e8');
    // Branco sobre ciano não passa AA (4.5), mas é > 1.5 < 4
    expect(ratio).toBeGreaterThan(1.5);
    expect(ratio).toBeLessThan(4.5);
  });

  it('tolera hex inválido (retorna número finito)', async () => {
    const { setorContrastWithWhite } = await import('../ui/views/equipamentos.js');
    const ratio = setorContrastWithWhite('not-a-hex');
    expect(Number.isFinite(ratio)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('openEditSetor', () => {
  it('popula todos os 4 campos do form (nome, cor, descricao, responsavel)', async () => {
    findSetor.mockReturnValue({
      id: 's1',
      nome: 'Cozinha industrial',
      cor: '#ff5252',
      descricao: 'Operação 24h, criticidade alta.',
      responsavel: 'Maria Silva',
    });

    const { openEditSetor } = await import('../ui/views/equipamentos.js');
    openEditSetor('s1');

    expect(document.getElementById('setor-nome').value).toBe('Cozinha industrial');
    expect(document.getElementById('setor-cor').value).toBe('#ff5252');
    expect(document.getElementById('setor-descricao').value).toBe(
      'Operação 24h, criticidade alta.',
    );
    expect(document.getElementById('setor-responsavel').value).toBe('Maria Silva');
  });

  it('marca o swatch correspondente à cor do setor com aria-checked=true', async () => {
    findSetor.mockReturnValue({
      id: 's1',
      nome: 'Estoque',
      cor: '#7c4dff',
      descricao: '',
      responsavel: '',
    });

    const { openEditSetor } = await import('../ui/views/equipamentos.js');
    openEditSetor('s1');

    const selected = document.querySelector('[data-cor="#7c4dff"]');
    expect(selected.getAttribute('aria-checked')).toBe('true');
    expect(selected.classList.contains('setor-modal__swatch--selected')).toBe(true);

    // O swatch default (ciano) deve ter sido desmarcado
    const unselected = document.querySelector('[data-cor="#00c8e8"]');
    expect(unselected.getAttribute('aria-checked')).toBe('false');
    expect(unselected.classList.contains('setor-modal__swatch--selected')).toBe(false);
  });

  it('atualiza título e label do botão pra modo edição', async () => {
    findSetor.mockReturnValue({
      id: 's1',
      nome: 'X',
      cor: '#00c8e8',
      descricao: '',
      responsavel: '',
    });

    const { openEditSetor } = await import('../ui/views/equipamentos.js');
    openEditSetor('s1');

    expect(document.getElementById('modal-add-setor-title').textContent).toBe('Editar setor');
    expect(document.querySelector('.setor-modal__btn-label').textContent).toBe('Salvar alterações');
  });

  it('avisa via toast quando id não é encontrado', async () => {
    findSetor.mockReturnValue(null);

    const { openEditSetor } = await import('../ui/views/equipamentos.js');
    openEditSetor('inexistente');

    expect(toastMock.warning).toHaveBeenCalledWith('Setor não encontrado.');
    // Não deve ter mudado o título
    expect(document.getElementById('modal-add-setor-title').textContent).toBe('Novo setor');
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('saveSetor (create)', () => {
  it('persiste descricao e responsavel junto com nome/cor', async () => {
    const { saveSetor } = await import('../ui/views/equipamentos.js');

    document.getElementById('setor-nome').value = 'Cozinha';
    document.getElementById('setor-cor').value = '#ff5252';
    document.getElementById('setor-descricao').value = 'Bloco A, térreo.';
    document.getElementById('setor-responsavel').value = 'João';

    const ok = await saveSetor();
    expect(ok).toBe(true);

    // setState foi chamado com um updater que adiciona o setor
    expect(setStateMock).toHaveBeenCalled();
    const updater = setStateMock.mock.calls[0][0];
    const next = updater({ setores: [] });

    expect(next.setores).toHaveLength(1);
    expect(next.setores[0]).toMatchObject({
      nome: 'Cozinha',
      cor: '#ff5252',
      descricao: 'Bloco A, térreo.',
      responsavel: 'João',
    });
    expect(next.setores[0].id).toBeTruthy();
  });

  it('trunca descrição em 120 chars', async () => {
    const { saveSetor } = await import('../ui/views/equipamentos.js');

    document.getElementById('setor-nome').value = 'X';
    document.getElementById('setor-descricao').value = 'a'.repeat(500);

    await saveSetor();
    const updater = setStateMock.mock.calls[0][0];
    const next = updater({ setores: [] });
    expect(next.setores[0].descricao.length).toBe(120);
  });

  it('mostra toast de sucesso com nome criado', async () => {
    const { saveSetor } = await import('../ui/views/equipamentos.js');
    document.getElementById('setor-nome').value = 'Almoxarifado';
    await saveSetor();
    expect(toastMock.success).toHaveBeenCalledWith(expect.stringContaining('Almoxarifado'));
    expect(toastMock.success).toHaveBeenCalledWith(expect.stringContaining('criado'));
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('saveSetor (update)', () => {
  it('preserva o ID e atualiza nome/cor/descricao/responsavel do setor existente', async () => {
    findSetor.mockReturnValue({
      id: 's-fixed',
      nome: 'Antigo',
      cor: '#00c8e8',
      descricao: 'velho',
      responsavel: 'velha',
    });

    const { openEditSetor, saveSetor } = await import('../ui/views/equipamentos.js');

    // Entra em modo edição
    openEditSetor('s-fixed');

    // Simula edits no form
    document.getElementById('setor-nome').value = 'Novo nome';
    document.getElementById('setor-cor').value = '#7c4dff';
    document.getElementById('setor-descricao').value = 'nova desc';
    document.getElementById('setor-responsavel').value = 'Novo resp';

    await saveSetor();

    // O último call de setState (saveSetor) aplica o map imutável
    const lastCall = setStateMock.mock.calls.at(-1)[0];
    const next = lastCall({
      setores: [
        { id: 's-fixed', nome: 'Antigo', cor: '#00c8e8', descricao: 'velho', responsavel: 'velha' },
        { id: 'other', nome: 'Outro', cor: '#ff5252' },
      ],
    });

    // Setor s-fixed foi atualizado, outro preservado
    expect(next.setores).toHaveLength(2);
    const updated = next.setores.find((s) => s.id === 's-fixed');
    expect(updated).toMatchObject({
      id: 's-fixed',
      nome: 'Novo nome',
      cor: '#7c4dff',
      descricao: 'nova desc',
      responsavel: 'Novo resp',
    });
    const untouched = next.setores.find((s) => s.id === 'other');
    expect(untouched.nome).toBe('Outro');
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('saveSetor validation (nome vazio)', () => {
  it('mostra erro inline, seta aria-invalid, focus no input, e retorna false', async () => {
    const { saveSetor } = await import('../ui/views/equipamentos.js');

    document.getElementById('setor-nome').value = '   '; // só whitespace

    const ok = await saveSetor();

    expect(ok).toBe(false);

    const err = document.getElementById('setor-nome-err');
    expect(err.hidden).toBe(false);

    const input = document.getElementById('setor-nome');
    expect(input.getAttribute('aria-invalid')).toBe('true');

    // Toast de warning disparado
    expect(toastMock.warning).toHaveBeenCalledWith(expect.stringMatching(/nome/i));

    // setState NÃO foi chamado (não persiste)
    expect(setStateMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe('clearSetorEditingState', () => {
  it('limpa os 4 campos e retorna título/CTA pra modo criação', async () => {
    findSetor.mockReturnValue({
      id: 's1',
      nome: 'Setor X',
      cor: '#ff5252',
      descricao: 'desc',
      responsavel: 'resp',
    });

    const { openEditSetor, clearSetorEditingState, getEditingSetorId } =
      await import('../ui/views/equipamentos.js');

    // Entra em edição
    openEditSetor('s1');
    expect(getEditingSetorId()).toBe('s1');

    // Limpa
    clearSetorEditingState();

    expect(getEditingSetorId()).toBeNull();
    expect(document.getElementById('setor-nome').value).toBe('');
    expect(document.getElementById('setor-descricao').value).toBe('');
    expect(document.getElementById('setor-responsavel').value).toBe('');
    expect(document.getElementById('setor-cor').value).toBe('#00c8e8');
    expect(document.getElementById('modal-add-setor-title').textContent).toBe('Novo setor');
    expect(document.querySelector('.setor-modal__btn-label').textContent).toBe('Criar setor →');

    // Erro inline escondido
    expect(document.getElementById('setor-nome-err').hidden).toBe(true);
    expect(document.getElementById('setor-nome').getAttribute('aria-invalid')).toBe('false');
  });
});
