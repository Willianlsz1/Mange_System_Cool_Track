import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Usa vi.hoisted pra expor os mocks às factories de vi.mock (que também são
// içadas ao topo). Sem isso, as factories rodam em TDZ das consts locais.
const mocks = vi.hoisted(() => ({
  profileGet: vi.fn(),
  profileSave: vi.fn(),
  toastSuccess: vi.fn(),
  toastWarning: vi.fn(),
  toastError: vi.fn(),
  customConfirmShow: vi.fn(),
  attachDialogA11y: vi.fn((_overlay, opts) => {
    // Guarda o onDismiss num slot global acessível pelos testes.
    globalThis.__lastDialogA11yOpts = opts;
    return () => {
      globalThis.__lastDialogA11yOpts = null;
    };
  }),
}));

vi.mock('../features/profile.js', () => ({
  Profile: { get: mocks.profileGet, save: mocks.profileSave },
}));

vi.mock('../core/toast.js', () => ({
  Toast: {
    success: mocks.toastSuccess,
    warning: mocks.toastWarning,
    error: mocks.toastError,
  },
}));

// CustomConfirm.show é a porta do dirty-check. Default: resolve `true`
// (descarta) — testes individuais podem mockar `false` pra checar cancel.
vi.mock('../core/modal.js', () => ({
  CustomConfirm: { show: mocks.customConfirmShow },
  // attachDialogA11y retorna cleanup fn; nos testes, o overlay já é removido
  // pelo hardClose(), então só precisamos capturar o onDismiss pra simular
  // Escape/a11y dismiss.
  attachDialogA11y: mocks.attachDialogA11y,
}));

import { ProfileModal } from '../ui/components/onboarding/profileModal.js';

function getOverlay() {
  return document.getElementById('modal-profile-overlay');
}

function setInputValue(id, value) {
  const input = document.getElementById(id);
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

describe('ProfileModal', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
    mocks.profileGet.mockReturnValue({
      nome: 'Carlos Figueiredo',
      crea: 'CREA-MG 123456/D',
      empresa: 'Frio Total Refrigeração',
      telefone: '(31) 99999-0000',
    });
    mocks.customConfirmShow.mockReset();
    mocks.customConfirmShow.mockResolvedValue(true);
    mocks.profileSave.mockClear();
    mocks.toastSuccess.mockClear();
    mocks.toastWarning.mockClear();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    globalThis.__lastDialogA11yOpts = null;
  });

  it('renderiza overlay com os campos carregados do Profile.get()', () => {
    ProfileModal.open();
    const overlay = getOverlay();
    expect(overlay).toBeTruthy();
    expect(overlay.querySelector('#prof-nome').value).toBe('Carlos Figueiredo');
    expect(overlay.querySelector('#prof-crea').value).toBe('CREA-MG 123456/D');
    expect(overlay.querySelector('#prof-empresa').value).toBe('Frio Total Refrigeração');
    expect(overlay.querySelector('#prof-telefone').value).toBe('(31) 99999-0000');
  });

  it('usa .profile-modal__* BEM (sem .pm-* legado)', () => {
    ProfileModal.open();
    const overlay = getOverlay();
    expect(overlay.querySelector('.profile-modal')).toBeTruthy();
    expect(overlay.querySelector('.profile-modal__hero')).toBeTruthy();
    expect(overlay.querySelector('.profile-modal__avatar')).toBeTruthy();
    expect(overlay.querySelector('.profile-modal__close')).toBeTruthy();
    expect(overlay.querySelector('.profile-modal__actions')).toBeTruthy();
    // garante que resíduos do .pm-* block não voltaram acidentalmente
    expect(overlay.querySelector('.pm-modal')).toBeNull();
    expect(overlay.querySelector('.pm-header')).toBeNull();
    expect(overlay.querySelector('.pm-avatar')).toBeNull();
  });

  describe('dirty-check no close', () => {
    it('Cancel sem alterações → fecha direto, não abre CustomConfirm', async () => {
      ProfileModal.open();
      getOverlay().querySelector('#prof-cancel').click();
      // Espera microtasks do requestClose async completarem
      await Promise.resolve();
      expect(mocks.customConfirmShow).not.toHaveBeenCalled();
      expect(getOverlay()).toBeNull();
    });

    it('Cancel com alterações → abre CustomConfirm', async () => {
      ProfileModal.open();
      setInputValue('prof-nome', 'Outro Nome');
      getOverlay().querySelector('#prof-cancel').click();
      // O requestClose aguarda a promise do CustomConfirm — precisamos flush.
      await Promise.resolve();
      await Promise.resolve();
      expect(mocks.customConfirmShow).toHaveBeenCalledTimes(1);
      const [title, msg, opts] = mocks.customConfirmShow.mock.calls[0];
      expect(title).toMatch(/descartar/i);
      expect(msg).toMatch(/perdidas|não foram salvas/i);
      expect(opts.tone).toBe('danger');
      expect(opts.focus).toBe('cancel');
      expect(opts.confirmLabel).toMatch(/descartar/i);
      expect(opts.cancelLabel).toMatch(/continuar editando/i);
    });

    it('CustomConfirm → "Descartar" (true) → remove overlay', async () => {
      mocks.customConfirmShow.mockResolvedValueOnce(true);
      ProfileModal.open();
      setInputValue('prof-crea', 'CREA-MG 999999/D');
      getOverlay().querySelector('#prof-cancel').click();
      // Espera o promise chain do requestClose resolver
      await vi.waitFor(() => {
        expect(getOverlay()).toBeNull();
      });
    });

    it('CustomConfirm → "Continuar editando" (false) → overlay permanece', async () => {
      mocks.customConfirmShow.mockResolvedValueOnce(false);
      ProfileModal.open();
      setInputValue('prof-empresa', 'Nova Empresa');
      getOverlay().querySelector('#prof-cancel').click();
      // Dá tempo pro chain resolver
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      expect(getOverlay()).toBeTruthy();
    });

    it('X (close button) usa mesmo gate de dirty-check', async () => {
      ProfileModal.open();
      setInputValue('prof-telefone', '(31) 98888-7777');
      getOverlay().querySelector('#prof-close').click();
      await Promise.resolve();
      await Promise.resolve();
      expect(mocks.customConfirmShow).toHaveBeenCalledTimes(1);
    });

    it('Backdrop click usa mesmo gate de dirty-check', async () => {
      ProfileModal.open();
      setInputValue('prof-nome', 'Nome Alterado');
      const overlay = getOverlay();
      // Dispara click cujo target é o próprio overlay (backdrop).
      overlay.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      await Promise.resolve();
      await Promise.resolve();
      expect(mocks.customConfirmShow).toHaveBeenCalledTimes(1);
    });

    it('attachDialogA11y.onDismiss (Escape) usa mesmo gate', async () => {
      ProfileModal.open();
      setInputValue('prof-crea', 'CREA-SP 222222/D');
      const opts = globalThis.__lastDialogA11yOpts;
      expect(opts).toBeTruthy();
      opts.onDismiss();
      await Promise.resolve();
      await Promise.resolve();
      expect(mocks.customConfirmShow).toHaveBeenCalledTimes(1);
    });
  });

  describe('save', () => {
    it('Save com nome vazio → Toast.warning e não chama Profile.save', () => {
      ProfileModal.open();
      setInputValue('prof-nome', '');
      getOverlay().querySelector('#prof-save').click();
      expect(mocks.toastWarning).toHaveBeenCalledTimes(1);
      expect(mocks.profileSave).not.toHaveBeenCalled();
      expect(getOverlay()).toBeTruthy();
    });

    it('Save com nome → chama Profile.save com trim, fecha sem CustomConfirm', () => {
      ProfileModal.open();
      setInputValue('prof-nome', '  Novo Nome  ');
      setInputValue('prof-crea', ' CREA-X ');
      setInputValue('prof-empresa', ' Empresa X ');
      setInputValue('prof-telefone', ' 31988887777 ');
      getOverlay().querySelector('#prof-save').click();
      expect(mocks.profileSave).toHaveBeenCalledTimes(1);
      expect(mocks.profileSave).toHaveBeenCalledWith({
        nome: 'Novo Nome',
        crea: 'CREA-X',
        empresa: 'Empresa X',
        telefone: '31988887777',
      });
      expect(mocks.toastSuccess).toHaveBeenCalledTimes(1);
      // Fechou direto, sem passar pelo dirty-check (CustomConfirm).
      expect(mocks.customConfirmShow).not.toHaveBeenCalled();
      expect(getOverlay()).toBeNull();
    });
  });
});
