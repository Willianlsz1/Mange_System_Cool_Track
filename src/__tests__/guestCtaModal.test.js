vi.mock('../ui/components/authscreen.js', () => ({
  AuthScreen: { show: vi.fn() },
}));

import { GuestCtaModalInternal } from '../ui/components/onboarding/guestCtaModal.js';

describe('GuestCtaModalInternal', () => {
  it('retorna copy progressiva por faixa de ações', () => {
    expect(GuestCtaModalInternal.getGuestWarningMessage(7)).toContain(
      'Voce ja fez 7 acoes sem salvar. Crie sua conta para nao perder nada.',
    );
    expect(GuestCtaModalInternal.getGuestWarningMessage(12)).toContain(
      '⚠️ 12 acoes nao salvas. Seus dados vao desaparecer ao fechar o navegador.',
    );
    expect(GuestCtaModalInternal.getGuestWarningMessage(20)).toContain(
      '🚨 20 acoes perdidas em andamento. Ultima chance de salvar seu trabalho.',
    );
  });
});
