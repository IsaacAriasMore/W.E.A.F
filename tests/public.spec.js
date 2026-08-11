import { test, expect } from '@playwright/test';

test('home loads without errors and renders its primary actions', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto('/');
  await expect(page).toHaveTitle(/W\.E\.A\.F/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Convierte el progreso');
  await expect(page.getByRole('link', { name: 'Crear cuenta' }).first()).toBeVisible();
  await expect(page.locator('.vite-error-overlay')).toHaveCount(0);
  expect((await page.locator('body').innerText()).length).toBeGreaterThan(600);
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'artifacts/browser-qa/home-desktop.png', fullPage: true });
});

test('INI filters keep ASE and ASA presets reachable with simplified categories', async ({ page }) => {
  await page.goto('/inis');
  await expect(page.locator('[data-category]')).toHaveText(['Todas', 'General', 'PvP', 'Farmeo', 'Otros']);
  await expect(page.locator('[data-advanced-category]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Breeding', exact: true })).toHaveCount(0);
  await expect(page.locator('[data-preset-card]')).toHaveCount(2);
  await page.getByRole('button', { name: 'Otros', exact: true }).click();
  await expect(page.locator('[data-preset-card]')).toHaveCount(2);
  for (const category of ['General', 'PvP', 'Farmeo']) {
    await page.getByRole('button', { name: category, exact: true }).click();
    await expect(page.locator('.ini-empty')).toBeVisible();
  }
  await page.getByRole('button', { name: 'Todas', exact: true }).click();
  await expect(page.locator('[data-preset-card]')).toHaveCount(2);

  await page.getByRole('button', { name: 'ARK: Survival Ascended' }).click();
  await expect(page.locator('[data-preset-card]')).toHaveCount(3);
  await page.getByRole('button', { name: 'Otros', exact: true }).click();
  await expect(page.locator('[data-preset-card]')).toHaveCount(3);
  const asaFpsCard = page.locator('[data-preset-card]').filter({ hasText: 'FPS equilibrado ASA' });
  await asaFpsCard.getByRole('button', { name: 'Ver INI' }).click();
  await expect(page.locator('[data-ini-dialog]')).toHaveJSProperty('open', true);
  await expect(page.locator('[data-dialog-content]')).toContainText('r.Lumen.Reflections.Allow');
  await page.getByRole('button', { name: 'Cerrar' }).click();

  const downloadPromise = page.waitForEvent('download');
  await asaFpsCard.getByRole('button', { name: 'Descargar' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('weaf-asa-fps-balanced.ini');
});

test('boss checklist persists in local storage', async ({ page }) => {
  await page.goto('/maps-bosses');
  const firstItem = page.locator('[data-checklist-item]').first();
  await firstItem.click();
  await expect(page.locator('[data-checklist-progress]').first()).toContainText('1 / 3');
  await page.reload();
  await expect(firstItem.locator('input')).toBeChecked();
});

test('difficulty variants are scoped per boss card and pending encounters show no fake tabs', async ({ page }) => {
  await page.goto('/maps-bosses');
  const firstCard = page.locator('[data-boss-card="broodmother-lysrix"]');
  await expect(firstCard.getByRole('group', { name: 'Dificultad' }).getByRole('button')).toHaveCount(3);
  await expect(firstCard.locator('.boss-mission-meta')).toContainText('Nivel mínimo 30');
  await firstCard.getByRole('button', { name: 'Alpha', exact: true }).click();
  await expect(firstCard.locator('.boss-mission-meta')).toContainText('Nivel mínimo 70');
  await page.getByRole('button', { name: 'Genesis: Part 1' }).click();
  const moeder = page.locator('[data-boss-card="moeder"]');
  await expect(moeder).toBeVisible();
  await expect(moeder.getByRole('group', { name: 'Dificultad' })).toHaveCount(0);
  await expect(moeder).toContainText('Pendiente de verificación');
  await expect(moeder.locator('[data-reset-boss]')).toBeDisabled();
  const controller = page.locator('[data-boss-card="corrupted-master-controller"]');
  await expect(controller).toBeVisible();
  await expect(controller.getByRole('group', { name: 'Dificultad' }).getByRole('button')).toHaveCount(3);
  await controller.getByRole('button', { name: 'Gamma', exact: true }).click();
  await expect(controller.locator('.boss-notes').first()).toContainText('58 misiones');
  await controller.getByRole('button', { name: 'Beta', exact: true }).click();
  await expect(controller.locator('.boss-notes').first()).toContainText('116 misiones');
  await controller.getByRole('button', { name: 'Alpha', exact: true }).click();
  await expect(controller.locator('.boss-notes').first()).toContainText('168 misiones');
  await expect(controller.locator('.boss-mission-meta')).toContainText('Sin nivel mínimo publicado');
  await expect(controller).not.toContainText('Pendiente de verificación');
});

test('Valguero and Astraeos respect per-game rosters', async ({ page }) => {
  await page.goto('/maps-bosses');
  await page.getByRole('button', { name: 'Valguero' }).click();
  await expect(page.locator('[data-boss-card]')).toHaveCount(2);
  await expect(page.locator('[data-boss-card="grendel-valguero"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'ARK: Survival Ascended' }).click();
  await page.getByRole('button', { name: 'Valguero' }).click();
  await expect(page.locator('[data-boss-card]')).toHaveCount(1);
  await expect(page.locator('[data-boss-card="grendel-valguero"]')).toBeVisible();
  await page.getByRole('button', { name: 'Astraeos' }).click();
  await expect(page.locator('[data-boss-card]')).toHaveCount(8);
  await expect(page.locator('[data-boss-card="natrix"]')).toBeVisible();
  await expect(page.locator('[data-boss-card="minotarchos"]')).toContainText('Sin nivel mínimo publicado');
});

test('Lost Colony appears as the newest ASA map with its Red-Handed encounter', async ({ page }) => {
  await page.goto('/maps-bosses');
  await page.getByRole('button', { name: 'ARK: Survival Ascended' }).click();
  await page.getByRole('button', { name: 'Lost Colony' }).click();
  await expect(page.locator('[data-boss-card="red-handed"]')).toBeVisible();
});

test('creature filters show a matching result and an empty state', async ({ page }) => {
  await page.goto('/creatures');
  await page.getByLabel('Buscar criatura').fill('Rex');
  await expect(page.locator('.creature-card')).toHaveCount(1);
  await expect(page.locator('[data-creature-summary]')).toHaveText('1 criatura encontrada');
  await page.getByLabel('Buscar criatura').fill('No existe');
  await expect(page.locator('[data-empty-results]')).toBeVisible();
  await page.getByRole('button', { name: 'Limpiar filtros' }).click();
  await expect(page.locator('.creature-card')).toHaveCount(8);
});

test('server directory and owner plans are public and responsive', async ({ page }) => {
  await page.goto('/servers');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Encuentra un servidor');
  await expect(page.getByRole('heading', { name: 'Servidores disponibles' })).toBeVisible();
  await expect(page.locator('[data-server-empty]')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Publicar servidor' })).toHaveAttribute('href', '/servers/publish');
  await page.getByRole('link', { name: 'Ver cómo funciona' }).click();
  await expect(page).toHaveURL(/\/servers\/owners#owner-plans$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Publica con control');
  await expect(page.locator('.owner-plan')).toHaveCount(2);
  await expect(page.locator('.owner-plan').first()).toBeVisible();
  await expect(page.locator('.owner-plan').last()).toBeVisible();
  const plansLink = page.getByRole('link', { name: /Ver planes/ });
  await expect(plansLink).toBeVisible();
  const planTop = await page.locator('#owner-plans').evaluate((element) => element.getBoundingClientRect().top);
  expect(planTop).toBeLessThan(page.viewportSize().height);
  await plansLink.click();
  await expect(page).toHaveURL(/\/servers\/owners#owner-plans$/);
  await expect.poll(() => page.locator('#owner-plans').evaluate((element) => Math.round(element.getBoundingClientRect().top))).toBeLessThan(120);

  await page.goto('/servers/owners#owner-plans');
  await expect.poll(() => page.locator('#owner-plans').evaluate((element) => Math.round(element.getBoundingClientRect().top))).toBeLessThan(120);
});

test('all legal routes render a document', async ({ page }) => {
  const routes = [
    '/terms', '/privacy', '/cookies', '/disclaimer', '/refund-policy',
    '/server-listing-policy', '/report-content', '/contact',
  ];

  for (const route of routes) {
    await page.goto(route);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('.legal-notice')).toContainText('Pendiente de revisión profesional');
  }
});

test('mobile navigation opens without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  await expect(page.locator('#mobile-menu')).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport);
  await page.screenshot({ path: 'artifacts/browser-qa/home-mobile.png', fullPage: true });
});

test('no public anchor lacks a valid href', async ({ page }) => {
  const routes = ['/', '/inis', '/maps-bosses', '/creatures', '/servers', '/marketplace', '/ark-survival-ascended'];
  for (const route of routes) {
    await page.goto(route);
    const invalid = await page.evaluate(() =>
      [...document.querySelectorAll('a:not([hidden])')]
        .filter(a => !a.hasAttribute('href') || a.getAttribute('href') === '' || a.getAttribute('href') === '#')
        .map(a => a.outerHTML)
    );
    expect(invalid, `${route} has ${invalid.length} anchor(s) without valid href`).toEqual([]);
  }
});

test('INI dialog source link is created only when source_url exists', async ({ page }) => {
  await page.goto('/inis');
  await page.getByRole('button', { name: 'ARK: Survival Ascended' }).click();
  await page.getByRole('button', { name: 'Otros', exact: true }).click();
  const view = page.locator('[data-preset-card]').filter({ hasText: 'FPS equilibrado ASA' }).getByRole('button', { name: 'Ver INI' });
  await view.click();
  await expect(page.locator('[data-ini-dialog]')).toHaveJSProperty('open', true);
  const sourceLink = page.locator('[data-dialog-source-container] a');
  await expect(sourceLink).toBeVisible();
  await expect(sourceLink).toHaveAttribute('href', /^https?:\/\//);
  await expect(sourceLink).toHaveAttribute('target', '_blank');
  await expect(sourceLink).toHaveAttribute('rel', 'noreferrer');
  await expect(page.locator('[data-dialog-source-container] a[href="#"]')).toHaveCount(0);
});

test('INI category controls stay contained on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/inis');
  await expect(page.locator('[data-category]')).toHaveText(['Todas', 'General', 'PvP', 'Farmeo', 'Otros']);
  const dimensions = await page.evaluate(() => ({ body: document.body.scrollWidth, viewport: window.innerWidth }));
  expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport);
});

test('ARK Survival Ascended hub loads and links to every public tool', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto('/ark-survival-ascended');
  await expect(page).toHaveTitle(/ARK: Survival Ascended/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('ARK: Survival Ascended');
  await expect(page.locator('.vite-error-overlay')).toHaveCount(0);
  for (const href of ['/inis', '/maps-bosses', '/creatures', '/servers', '/marketplace']) {
    await expect(page.locator(`a[href="${href}"]`).first()).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('marketplace is public while publishing remains protected', async ({ page }) => {
  await page.goto('/marketplace');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Encuentra lo que tu tribu necesita');
  await expect(page.getByRole('heading', { name: 'Destacados', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Anuncios activos' })).toBeVisible();
  await expect(page.locator('.market-empty').first()).toBeVisible();
  await expect(page.locator('[data-market-game]')).toHaveCount(0);
  await page.goto('/marketplace/new');
  await expect(page).toHaveURL(/\/login\?next=%2Fmarketplace%2Fnew/);
});

test('marketplace payment cancellation explains the safe retry path without a mutation', async ({ page }) => {
  const mutations = [];
  page.on('request', (request) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) mutations.push(request.url());
  });
  await page.goto('/marketplace/payment/cancel?lang=es');
  await expect(page).toHaveURL(/\/marketplace\/payment\/cancel\?lang=es$/);
  await expect(page.getByRole('heading', { name: 'Pago cancelado.' })).toBeVisible();
  await expect(page.getByText('Puedes reintentarlo desde Mi Marketplace.')).toBeVisible();
  await expect(page.locator('.route-loading')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Mi Marketplace' })).toHaveAttribute('href', '/account/marketplace');
  expect(mutations).toEqual([]);
});

test('ASA marketplace stays contained at mobile and tablet widths', async ({ page }) => {
  for (const width of [390, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/marketplace');
    await expect(page.getByText('ARK: Survival Ascended · ASA')).toBeVisible();
    const dimensions = await page.evaluate(() => ({ body: document.body.scrollWidth, viewport: window.innerWidth }));
    expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport);
  }
});
