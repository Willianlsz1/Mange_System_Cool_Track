import { beforeEach, describe, expect, it, vi } from 'vitest';

const goTo = vi.fn();

vi.mock('../core/router.js', () => ({
  goTo,
}));

describe('ClientesPaywallModal', () => {
  beforeEach(() => {
    vi.resetModules();
    goTo.mockReset();
    document.body.innerHTML = '';
  });

  it('renderiza paywall visual com copy e benefícios obrigatórios', async () => {
    const { ClientesPaywallModal } = await import('../ui/components/clientesPaywallModal.js');

    ClientesPaywallModal.open();

    const overlay = document.getElementById('clientes-paywall-overlay');
    expect(overlay).toBeTruthy();
    expect(overlay.classList.contains('clientes-paywall-overlay')).toBe(true);
    expect(overlay.textContent).toContain('Clientes e setores');
    expect(overlay.textContent).toContain(
      'Organize clientes, setores e equipamentos em um só lugar.',
    );
    expect(overlay.textContent).toContain('Separe equipamentos por cliente');
    expect(overlay.textContent).toContain('Controle setores e locais');
    expect(overlay.textContent).toContain('Gere relatórios por cliente');
    expect(overlay.textContent).toContain('Ver planos');
    expect(overlay.textContent).toContain('Continuar no app');
  });

  it('CTA principal navega para pricing e CTA secundário volta para inicio', async () => {
    const { ClientesPaywallModal } = await import('../ui/components/clientesPaywallModal.js');

    ClientesPaywallModal.open();

    document.querySelector('[data-clientes-lock-action="pricing"]').click();
    expect(goTo).toHaveBeenCalledWith('pricing');

    ClientesPaywallModal.open();
    document.querySelector('[data-clientes-lock-action="continue"]').click();
    expect(goTo).toHaveBeenCalledWith('inicio');
  });
});
