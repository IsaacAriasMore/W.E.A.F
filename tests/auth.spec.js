import { test, expect } from '@playwright/test';

test('login renders a usable form and explains missing Supabase configuration', async ({ page }) => {
  await page.goto('/login');
  await expect(page).toHaveTitle('Ingresar | W.E.A.F');
  await expect(page.getByRole('heading', { name: 'Ingresa a la forja' })).toBeVisible();
  await expect(page.getByText('Conexión pendiente')).toBeVisible();

  await page.getByLabel('Correo electrónico').fill('survivor@example.com');
  await page.getByLabel('Contraseña').fill('correct-horse-battery');
  await page.getByRole('button', { name: 'Mostrar' }).click();
  await expect(page.getByLabel('Contraseña')).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByRole('alert')).toContainText('Supabase aún no está conectado');
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
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page.getByRole('alert')).toContainText('Supabase aún no está conectado');
});

test('onboarding is protected and sends guests to login', async ({ page }) => {
  await page.goto('/onboarding');
  await expect(page).toHaveURL(/\/login\?next=%2Fonboarding$/);
  await expect(page.getByRole('heading', { name: 'Ingresa a la forja' })).toBeVisible();
});

test('auth layouts remain contained on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/register');
  const dimensions = await page.evaluate(() => ({ body: document.body.scrollWidth, viewport: window.innerWidth }));
  expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport);
  await page.screenshot({ path: 'artifacts/browser-qa/register-mobile.png', fullPage: true });
});
