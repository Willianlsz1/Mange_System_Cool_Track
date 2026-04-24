import { expect, test } from '@playwright/test';
import { setupAuthedPage } from '../fixtures/authedSession.js';

/**
 * Critical-path E2E — só fluxos que, se quebrarem, impedem técnico de
 * usar o app em campo. Todos começam do zero (sem dados) e criam
 * dentro do próprio teste — evita flake por estado compartilhado.
 *
 * Asserts são behavior-based (data-route, overlay is-open) em vez de
 * classes CSS específicas, pra sobreviver a tweaks visuais.
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

    // Comportamento: empty state deve ter um CTA pra novo equipamento.
    const cta = page.locator('[data-action="open-modal"][data-id="modal-add-eq"]').first();
    await expect(cta).toBeVisible();
  });

  test('abrir e fechar o modal "Novo equipamento" pela UI', async ({ page }) => {
    await page.click('#nav-equipamentos');
    await expect(page.locator('body')).toHaveAttribute('data-route', 'equipamentos');

    // Abre modal
    await page.locator('[data-action="open-modal"][data-id="modal-add-eq"]').first().click();
    const modal = page.locator('#modal-add-eq');
    await expect(modal).toHaveClass(/is-open/);

    // Fecha modal pela UI (botão X)
    await page.locator('[data-action="close-modal"][data-id="modal-add-eq"]').first().click();
    await expect(modal).not.toHaveClass(/is-open/);

    // Nenhum overlay deve ficar aberto
    await expect(page.locator('.modal-overlay.is-open')).toHaveCount(0);
  });

  test('back do navegador fecha modal quando aberto, sem navegar de rota', async ({ page }) => {
    await page.click('#nav-equipamentos');
    await expect(page.locator('body')).toHaveAttribute('data-route', 'equipamentos');

    await page.locator('[data-action="open-modal"][data-id="modal-add-eq"]').first().click();
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
