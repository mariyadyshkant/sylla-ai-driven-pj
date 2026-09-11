const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { launchApp, closeApp } = require('./helpers');

test.describe('Impostazioni e backup', () => {
  let ctx;

  test.beforeEach(async () => {
    ctx = await launchApp();
  });

  test.afterEach(async () => {
    await closeApp(ctx);
  });

  test('la frase del footer impostata viene salvata e mostrata nel footer', async () => {
    const { window } = ctx;
    await window.getByRole('button', { name: 'Impostazioni' }).click();
    await window.locator('#footer-text-input').fill('Piccoli passi ogni giorno');
    await window.locator('[data-view="settings"]').getByRole('button', { name: 'Salva' }).click();
    await expect(window.locator('footer')).toContainText('Piccoli passi ogni giorno');
  });

  test('esporta e reimporta il database preservando i dati salvati', async () => {
    const { app, window } = ctx;
    const backupPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sylla-backup-')), 'backup.db');

    await window.getByRole('button', { name: 'Impostazioni' }).click();
    await window.locator('#footer-text-input').fill('Frase originale');
    await window.locator('[data-view="settings"]').getByRole('button', { name: 'Salva' }).click();
    await expect(window.locator('footer')).toContainText('Frase originale');

    await window.getByRole('button', { name: 'Backup e dati' }).click();
    await app.evaluate(async ({ dialog }, dest) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: dest });
    }, backupPath);
    await window.getByRole('button', { name: 'Esporta database' }).click();
    await expect(window.getByText('Backup esportato in')).toBeVisible();
    expect(fs.existsSync(backupPath)).toBe(true);

    await window.getByRole('button', { name: 'Personalizzazione' }).click();
    await window.locator('#footer-text-input').fill('Frase modificata');
    await window.locator('[data-view="settings"]').getByRole('button', { name: 'Salva' }).click();
    await expect(window.locator('footer')).toContainText('Frase modificata');

    await window.getByRole('button', { name: 'Backup e dati' }).click();
    await app.evaluate(async ({ dialog }, src) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [src] });
    }, backupPath);
    await window.getByRole('button', { name: 'Importa database' }).click();
    await expect(window.getByText('Database importato correttamente.')).toBeVisible();
    await expect(window.locator('footer')).toContainText('Frase originale');

    fs.rmSync(path.dirname(backupPath), { recursive: true, force: true });
  });
});
