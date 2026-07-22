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

test('INI filters, preview and download work', async ({ page }) => {
  await page.goto('/inis');
  await page.getByRole('button', { name: 'FPS Boost' }).click();
  await expect(page.locator('[data-preset-card]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Ver INI' }).click();
  await expect(page.locator('[data-ini-dialog]')).toHaveJSProperty('open', true);
  await expect(page.locator('[data-dialog-content]')).toContainText('r.ShadowQuality');
  await page.getByRole('button', { name: 'Cerrar' }).click();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('weaf-fps-balanced.ini');
});

test('boss checklist persists in local storage', async ({ page }) => {
  await page.goto('/maps-bosses');
  const firstItem = page.locator('.checklist-item').first();
  await firstItem.click();
  await expect(page.locator('[data-checklist-progress]')).toHaveText('1 de 3 listos');
  await page.reload();
  await expect(firstItem.locator('input')).toBeChecked();
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
  await page.goto('/servers/owners');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Publica con control');
  await expect(page.locator('.owner-plan')).toHaveCount(2);
});

test('all legal routes render a document', async ({ page }) => {
  const routes = [
    '/terms', '/privacy', '/cookies', '/disclaimer', '/refund-policy',
    '/server-listing-policy', '/report-content', '/contact',
  ];

  for (const route of routes) {
    await page.goto(route);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('.legal-notice')).toContainText('Revisión pendiente');
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
