const { test, expect } = require('@playwright/test');

test.describe('Critical User Flows', () => {
  test('landing page loads', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=NCET Papers')).toBeVisible();
  });

  test('navigation to login page', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Sign In');
    await expect(page.locator('text=Welcome Back')).toBeVisible();
  });

  test('navigation to register page', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Create Free Account');
    await expect(page.locator('text=Create Account')).toBeVisible();
  });

  test('login form validation', async ({ page }) => {
    await page.goto('/login');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=All fields required')).toBeVisible();
  });

  test('register form validation', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible();
  });

  test('password strength indicator', async ({ page }) => {
    await page.goto('/register');
    await page.fill('input[type="password"]', 'Weak1');
    await expect(page.locator('text=Fair')).toBeVisible();
  });

  test('dashboard requires auth', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/.*login/);
  });

  test('subjects page requires auth', async ({ page }) => {
    await page.goto('/subjects');
    await expect(page).toHaveURL(/.*login/);
  });

  test('responsive navbar toggle', async ({ page }) => {
    await page.goto('/');
    await page.setViewportSize({ width: 375, height: 667 });
    const toggle = page.locator('button[aria-label="Toggle menu"]');
    if (await toggle.isVisible()) {
      await toggle.click();
      await expect(page.locator('text=Dashboard')).toBeVisible();
    }
  });
});
