import { expect, test } from '@playwright/test';
import { setupAuthedPage } from '../fixtures/authedSession.js';

/**
 * Critical-path E2E — só fluxos que, se quebrarem, impedem técnico de
 * usar o app em campo. Todos começam do zero (sem dados) e criam
 * dentro do próprio teste — evita flake por estado compartilhado.
 *
 * Asserts são behavior-based (data-route, overlay is-open) em vez de
 * classes CSS específicas, pra sobreviver a tweaks visuais. Selectors
 * críticos usam `data-testid` pra não competir com CTAs iguais em
 * contextos diferentes (ex.: #dash-hero-cta fica no DOM em outras rotas
 * e matchava `.first()` antes).
 */
test.describe('CoolTrack PRO — fluxos críticos', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthedPage(page);
    await page.goto('/');
    // Espera o bootstrap: quando a rota inicial está montada, body ganha
    // data-route="inicio" e #main-content fica visível.
    await expect(page.locator('#main-content')).toBeVisible();
    await expect(page.locator('body')).toHaveAttribute('data-route', 'inicio');
  });

  test('usuário sem equipamentos vê empty state acolhedor em Equipamentos', async ({ page }) => {
    await page.click('#nav-equipamentos');
    await expect(page.locator('body')).toHaveAttribute('data-route', 'equipamentos');

    // Comportamento: CTA de equipamento está visível na rota. Usamos o
    // testid estável pra não pegar o #dash-hero-cta que fica hidden
    // fora da rota dashboard mas continua no DOM.
    const cta = page.getByTestId('equipamentos-add-equipment');
    await expect(cta).toBeVisible();
  });

  test('abrir e fechar o modal "Novo equipamento" pela UI', async ({ page }) => {
    await page.click('#nav-equipamentos');
    await expect(page.locator('body')).toHaveAttribute('data-route', 'equipamentos');

    // Abre modal via CTA estável da rota equipamentos.
    await page.getByTestId('equipamentos-add-equipment').click();
    const modal = page.locator('#modal-add-eq');
    await expect(modal).toHaveClass(/is-open/);

    // Fecha modal pela UI (botão X). O close-modal é único dentro do
    // overlay aberto, então .first() aqui é seguro.
    await page.locator('#modal-add-eq [data-action="close-modal"]').first().click();
    await expect(modal).not.toHaveClass(/is-open/);

    // Nenhum overlay deve ficar aberto
    await expect(page.locator('.modal-overlay.is-open')).toHaveCount(0);
  });

  test('back do navegador fecha modal quando aberto, sem navegar de rota', async ({ page }) => {
    await page.click('#nav-equipamentos');
    await expect(page.locator('body')).toHaveAttribute('data-route', 'equipamentos');

    await page.getByTestId('equipamentos-add-equipment').click();
    const modal = page.locator('#modal-add-eq');
    await expect(modal).toHaveClass(/is-open/);

    // Primeiro back: fecha o modal, rota permanece em "equipamentos"
    await page.goBack();
    await expect(modal).not.toHaveClass(/is-open/);
    await expect(page.locator('body')).toHaveAttribute('data-route', 'equipamentos');

    // Segundo back: navega pra rota anterior (inicio)
    await page.goBack();
    await expect(page.locator('body')).toHaveAttribute('data-route', 'inicio');
  });
});
