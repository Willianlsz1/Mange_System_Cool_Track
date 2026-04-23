import { expect, test } from '@playwright/test';

const OVERLAY_OPEN_SELECTOR = '.modal-overlay.is-open';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('cooltrack-guest-mode', '1');
  });

  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('#nav-equipamentos')).toBeVisible({ timeout: 10000 });
});

test('equipamentos → detalhe → editor de foto fecha em cadeia com back', async ({ page }) => {
  await page.click('#nav-equipamentos');

  const firstEquipCard = page.locator('[data-action="open-equip"]').first();
  await expect(firstEquipCard).toBeVisible();
  await firstEquipCard.click();

  const detailModal = page.locator('#modal-eq-det');
  await expect(detailModal).toHaveClass(/is-open/);

  const photoCta = detailModal.locator('[data-action="open-eq-photos-editor"]').first();
  await photoCta.click();

  const photoModal = page.locator('#modal-eq-photos');
  await expect(photoModal).toHaveClass(/is-open/);

  await page.goBack();
  await expect(photoModal).not.toHaveClass(/is-open/);
  await expect(detailModal).toHaveClass(/is-open/);

  await page.goBack();
  await expect(detailModal).not.toHaveClass(/is-open/);
  await expect(page.locator(OVERLAY_OPEN_SELECTOR)).toHaveCount(0);
});

test('modal de setor valida nome obrigatório e salva quando válido', async ({ page }) => {
  await page.click('#nav-equipamentos');

  await page.evaluate(() => {
    localStorage.setItem('cooltrack-dev-mode', 'true');
  });

  await page.evaluate(() => {
    document.dispatchEvent(
      new CustomEvent('app:route-changed', { detail: { route: 'equipamentos' } }),
    );
  });

  await page.evaluate(async () => {
    const [{ setCachedPlan }, { renderEquip }] = await Promise.all([
      import('/src/core/plans/planCache.js'),
      import('/src/ui/views/equipamentos.js'),
    ]);
    setCachedPlan('pro');
    await renderEquip('');
  });

  const openSetorButton = page.locator('[data-action="open-setor-modal"]').first();
  await expect(openSetorButton).toBeVisible();
  await openSetorButton.click();

  const setorModal = page.locator('#modal-add-setor');
  await expect(setorModal).toHaveClass(/is-open/);

  await page.click('#setor-save-btn');
  await expect(page.locator('#setor-nome-err')).toBeVisible();

  await page.fill('#setor-nome', 'UTI');
  await page.click('#setor-save-btn');
  await expect(setorModal).not.toHaveClass(/is-open/);

  await expect(page.locator('.setor-card__nome', { hasText: 'UTI' })).toBeVisible();
});

test('overlay de assinatura fecha com back', async ({ page }) => {
  await page.evaluate(async () => {
    const { SignatureModal } = await import('/src/ui/components/signature/signature-modal.js');
    SignatureModal.request('reg-1', 'Split Teste');
  });

  const signatureOverlay = page.locator('#modal-signature-overlay');
  await expect(signatureOverlay).toHaveClass(/is-open/);

  await page.goBack();
  await expect(signatureOverlay).toHaveCount(0);
});

test('contexto de quickfilter é preservado ao abrir/voltar detalhe', async ({ page }) => {
  await page.click('#nav-equipamentos');

  const semSetorFilter = page
    .locator('[data-action="equip-quickfilter"][data-id="sem-setor"]')
    .first();
  await expect(semSetorFilter).toBeVisible();
  await semSetorFilter.click();

  await expect(semSetorFilter).toHaveClass(/equip-filter--active/);

  const firstEquipCard = page.locator('[data-action="open-equip"]').first();
  await firstEquipCard.click();
  await expect(page.locator('#modal-eq-det')).toHaveClass(/is-open/);

  await page.goBack();
  await expect(page.locator('#modal-eq-det')).not.toHaveClass(/is-open/);

  await expect(
    page.locator('[data-action="equip-quickfilter"][data-id="sem-setor"].equip-filter--active'),
  ).toHaveCount(1);
});
