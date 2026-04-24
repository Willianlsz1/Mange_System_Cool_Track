import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('cooltrack-guest-mode', '1');
    localStorage.setItem('cooltrack-tour-done', '1');
    localStorage.setItem('ct-ftx-skipped:guest', '1');
  });

  await page.goto('/');
  await expect(page.locator('#main-content')).toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-route', 'inicio');

  const overflowDismiss = page.locator('#dash-overflow-modal [data-action="dismiss"]');
  if (await overflowDismiss.isVisible().catch(() => false)) {
    await overflowDismiss.click();
    await expect(page.locator('#dash-overflow-modal')).toHaveCount(0);
  }
});

test('back apos fechar modal pela UI volta para a rota anterior real', async ({ page }) => {
  await page.click('#nav-equipamentos');
  await expect(page.locator('body')).toHaveAttribute('data-route', 'equipamentos');

  await page.click('[data-action="open-modal"][data-id="modal-add-eq"]');
  const addEquipModal = page.locator('#modal-add-eq');
  await expect(addEquipModal).toHaveClass(/is-open/);

  await expect
    .poll(() => page.evaluate(() => window.history.state?.blockingLayer === true))
    .toBe(true);

  await page.click('[data-action="close-modal"][data-id="modal-add-eq"]');
  await expect(addEquipModal).not.toHaveClass(/is-open/);
  await expect(page.locator('.modal-overlay.is-open')).toHaveCount(0);

  await expect
    .poll(() => page.evaluate(() => window.history.state?.blockingLayer === true))
    .toBe(false);

  await page.goBack();
  await expect(page.locator('body')).toHaveAttribute('data-route', 'inicio');
  await expect(page.locator('#nav-inicio')).toHaveClass(/is-active/);
});
