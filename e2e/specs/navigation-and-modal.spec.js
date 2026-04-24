import { expect, test } from '@playwright/test';

const OVERLAY_OPEN_SELECTOR = '.modal-overlay.is-open';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('cooltrack-guest-mode', '1');
    localStorage.setItem('cooltrack-tour-done', '1');
  });

  await page.goto('/');
  await expect(page.locator('#main-content')).toBeVisible();

  const overflowDismiss = page.locator('#dash-overflow-modal [data-action="dismiss"]');
  if (await overflowDismiss.isVisible().catch(() => false)) {
    await overflowDismiss.click();
    await expect(page.locator('#dash-overflow-modal')).toHaveCount(0);
  }
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

test('back apos fechar modal pela UI volta para a rota anterior real', async ({ page }) => {
  await page.click('#nav-equipamentos');
  await expect(page.locator('body')).toHaveAttribute('data-route', 'equipamentos');

  await page.click('[data-action="open-modal"][data-id="modal-add-eq"]');
  const addEquipModal = page.locator('#modal-add-eq');
  await expect(addEquipModal).toHaveClass(/is-open/);

  await page.click('[data-action="close-modal"][data-id="modal-add-eq"]');
  await expect(addEquipModal).not.toHaveClass(/is-open/);

  await page.goBack();
  await expect(page.locator('body')).toHaveAttribute('data-route', 'inicio');
  await expect(page.locator('#nav-inicio')).toHaveClass(/is-active/);
});
