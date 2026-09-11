const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./helpers');

test.describe('Shell e navigazione', () => {
  let ctx;

  test.beforeEach(async () => {
    ctx = await launchApp();
  });

  test.afterEach(async () => {
    await closeApp(ctx);
  });

  test('header e footer sono dentro <body> (HTML valido)', async () => {
    const { window } = ctx;
    const headerInsideBody = await window.evaluate(() => !!document.querySelector('body > div > header'));
    const footerInsideBody = await window.evaluate(() => !!document.querySelector('body > div > footer'));
    expect(headerInsideBody).toBe(true);
    expect(footerInsideBody).toBe(true);
  });

  test('naviga tra Dashboard, Archivio e Impostazioni sostituendo il contenuto centrale', async () => {
    const { window } = ctx;

    await expect(window.locator('[data-view="dashboard"]')).toBeVisible();

    await window.getByRole('button', { name: 'Archivio' }).click();
    await expect(window.locator('[data-view="archive"]')).toBeVisible();
    await expect(window.locator('[data-view="dashboard"]')).toHaveCount(0);

    await window.getByRole('button', { name: 'Impostazioni' }).click();
    await expect(window.locator('[data-view="settings"]')).toBeVisible();
    await expect(window.locator('[data-view="archive"]')).toHaveCount(0);

    await window.getByRole('button', { name: 'Dashboard' }).click();
    await expect(window.locator('[data-view="dashboard"]')).toBeVisible();
  });
});
