import { test, expect } from '@playwright/test';

test('login renders a usable accessible form', async ({ page }) => {
  await page.goto('/login');
  await expect(page).toHaveTitle('Ingresar | W.E.A.F');
  await expect(page.getByRole('heading', { name: 'Ingresa a la forja' })).toBeVisible();
  await page.getByLabel('Correo electrónico').fill('survivor@example.com');
  await page.getByLabel('Contraseña').fill('correct-horse-battery');
  await page.getByRole('button', { name: 'Mostrar' }).click();
  await expect(page.getByLabel('Contraseña')).toHaveAttribute('type', 'text');
  await expect(page.getByRole('button', { name: 'Ingresar' })).toBeEnabled();
  await page.screenshot({ path: 'artifacts/browser-qa/login-desktop.png', fullPage: true });
});

test('registration captures profile, game and legal consent', async ({ page }) => {
  await page.goto('/register');
  await expect(page.getByRole('heading', { name: 'Crea tu cuenta' })).toBeVisible();

  await page.getByLabel('Nombre visible').fill('Nómada del Norte');
  await page.getByLabel('Correo electrónico').fill('nomada@example.com');
  await page.getByLabel('Contraseña').fill('a-secure-passphrase');
  await page.getByRole('radio', { name: /ASA/ }).check();
  await expect(page.getByRole('radio', { name: /ASA/ })).toBeChecked();
  await page.getByLabel(/Acepto los/).check();
  await expect(page.getByRole('button', { name: 'Crear cuenta' })).toBeEnabled();
});

test('onboarding is protected and sends guests to login', async ({ page }) => {
  await page.goto('/onboarding');
  await expect(page).toHaveURL(/\/login\?next=%2Fonboarding$/);
  await expect(page.getByRole('heading', { name: 'Ingresa a la forja' })).toBeVisible();
});

test('tribe dashboard is protected and preserves the requested destination', async ({ page }) => {
  await page.goto('/app?invite=one-time-token');
  await expect(page).toHaveURL(/\/login\?next=%2Fapp%3Finvite%3Done-time-token$/);
  await expect(page.getByRole('heading', { name: 'Ingresa a la forja' })).toBeVisible();
  await expect(page.locator('#main-content').getByRole('link', { name: 'Crear cuenta' })).toHaveAttribute('href', '/register?next=%2Fapp%3Finvite%3Done-time-token');
});

for (const path of ['/app/breeds', '/app/mutations', '/app/tribe-settings']) {
  test(`${path} protects the private tribe workspace`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path).replaceAll('%', '%')}$`));
    await expect(page.getByRole('heading', { name: 'Ingresa a la forja' })).toBeVisible();
  });
}

test('global administration is protected from guests', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin$/);
  await expect(page.getByRole('heading', { name: 'Ingresa a la forja' })).toBeVisible();
});

test('auth layouts remain contained on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/register');
  const dimensions = await page.evaluate(() => ({ body: document.body.scrollWidth, viewport: window.innerWidth }));
  expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport);
  await page.screenshot({ path: 'artifacts/browser-qa/register-mobile.png', fullPage: true });
});
