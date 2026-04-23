import { expect, test } from '@playwright/test';

const OVERLAY_OPEN_SELECTOR = '.modal-overlay.is-open';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('cooltrack-guest-mode', '1');
  });

  await page.goto('/');
  await expect(page.locator('#main-content')).toBeVisible();
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
  await expect(page.locator('#setor-save-btn')).toBeDisabled();

  await page.fill('#setor-nome', 'Teste');
  await expect(page.locator('#setor-nome-err')).toBeHidden();
  await expect(page.locator('#setor-save-btn')).toBeEnabled();

  await page.fill('#setor-nome', '   ');
  await expect(page.locator('#setor-nome-err')).toBeVisible();
  await expect(page.locator('#setor-save-btn')).toBeDisabled();

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

test('não confirma save de equipamento quando persistência local falha', async ({ page }) => {
  await page.click('#nav-equipamentos');

  await page.evaluate(() => {
    const originalSetItem = Storage.prototype.setItem;
    // Simula quota/storage failure apenas no write principal de estado.
    Storage.prototype.setItem = function patchedSetItem(key, value) {
      if (key === 'cooltrack_v3') {
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      }
      return originalSetItem.call(this, key, value);
    };
  });

  const addEquipBtn = page.locator('[data-action="open-modal"][data-id="modal-add-eq"]').first();
  await expect(addEquipBtn).toBeVisible();
  await addEquipBtn.click();

  await expect(page.locator('#modal-add-eq')).toHaveClass(/is-open/);
  await page.fill('#eq-nome', 'Equipamento Falha Persistência');
  await page.fill('#eq-local', 'Sala teste');

  await page.click('[data-action="save-equip"]');

  await expect(page.locator('#modal-add-eq')).toHaveClass(/is-open/);
  await expect(
    page.getByText(
      'Não foi possível salvar o equipamento localmente. Libere espaço e tente novamente.',
    ),
  ).toBeVisible();
});

test('back fecha overlays heterogêneos em cadeia mantendo contexto', async ({ page }) => {
  await page.click('#nav-equipamentos');

  const firstEquipCard = page.locator('[data-action="open-equip"]').first();
  await firstEquipCard.click();
  const detailModal = page.locator('#modal-eq-det');
  await expect(detailModal).toHaveClass(/is-open/);

  await page.evaluate(async () => {
    const { Photos } = await import('/src/ui/components/photos.js');
    Photos.openLightbox('data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==');
  });
  const lightbox = page.locator('#lightbox');
  await expect(lightbox).toHaveClass(/is-open/);

  await page.goBack();
  await expect(lightbox).not.toHaveClass(/is-open/);
  await expect(detailModal).toHaveClass(/is-open/);

  await page.evaluate(async () => {
    const { SignatureModal } = await import('/src/ui/components/signature/signature-modal.js');
    SignatureModal.request('reg-back-1', 'Split Teste');
  });
  const signatureOverlay = page.locator('#modal-signature-overlay');
  await expect(signatureOverlay).toHaveClass(/is-open/);

  await page.goBack();
  await expect(signatureOverlay).toHaveCount(0);
  await expect(detailModal).toHaveClass(/is-open/);

  await page.goBack();
  await expect(detailModal).not.toHaveClass(/is-open/);
  await expect(page.locator(OVERLAY_OPEN_SELECTOR)).toHaveCount(0);
});
