vi.mock('../ui/components/authscreen.js', () => ({
  AuthScreen: { show: vi.fn() },
}));

import { GuestCtaModalInternal } from '../ui/components/onboarding/guestCtaModal.js';

describe('GuestCtaModalInternal', () => {
  it('retorna copy progressiva por faixa de ações', () => {
    expect(GuestCtaModalInternal.getGuestWarningMessage(7)).toContain(
      'Você já fez 7 ações sem salvar. Crie sua conta para não perder nada.',
    );
    expect(GuestCtaModalInternal.getGuestWarningMessage(12)).toContain(
      '⚠️ 12 ações não salvas. Seus dados vão desaparecer ao fechar o navegador.',
    );
    expect(GuestCtaModalInternal.getGuestWarningMessage(20)).toContain(
      '🚨 20 ações perdidas em andamento. Última chance de salvar seu trabalho.',
    );
  });
});
