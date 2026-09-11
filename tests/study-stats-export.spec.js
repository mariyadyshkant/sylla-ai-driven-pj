const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { launchApp, closeApp } = require('./helpers');

function iso(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

test.describe('Export dati study-stats', () => {
  let ctx;

  test.beforeEach(async () => {
    ctx = await launchApp();
  });

  test.afterEach(async () => {
    await closeApp(ctx);
  });

  test('esporta corsi e lezioni svolte in un file JSON con i minuti studiati', async () => {
    const { app, window } = ctx;
    const exportPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sylla-export-')), 'study-stats.json');

    const start = new Date('2027-06-07T00:00:00'); // lunedì
    const end = new Date(start);
    end.setDate(start.getDate() + 7);

    await window.getByRole('button', { name: '+ Aggiungi corso' }).click();
    await window.locator('[data-view="addCourse"] input').first().fill('Corso Study Stats');
    await window.locator('[data-view="addCourse"] input[type="date"]').first().fill(iso(start));
    await window.locator('[data-view="addCourse"] input[type="date"]').nth(1).fill(iso(end));
    await window.locator('[data-view="addCourse"] select').first().selectOption(String(start.getDay()));
    await window.getByRole('button', { name: 'Salva corso' }).click();

    await window.getByRole('button', { name: 'Lezioni', exact: true }).click();
    const firstBox = window.locator('[data-view="courseLessons"] button').first();
    await firstBox.click();
    const modal = window.locator('.fixed');
    await modal.locator('input[type="checkbox"]').check();
    await modal.getByRole('button', { name: 'Salva' }).click();
    await expect(modal).toBeHidden();

    await window.getByRole('button', { name: 'Impostazioni' }).click();
    await window.getByRole('button', { name: 'Backup e dati' }).click();
    await app.evaluate(async ({ dialog }, dest) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: dest });
    }, exportPath);
    await window.getByRole('button', { name: 'Esporta dati per study-stats' }).click();
    await expect(window.getByText('Dati study-stats esportati in')).toBeVisible();

    expect(fs.existsSync(exportPath)).toBe(true);
    const data = JSON.parse(fs.readFileSync(exportPath, 'utf-8'));
    expect(data.courses).toHaveLength(1);
    const course = data.courses[0];
    expect(course.name).toBe('Corso Study Stats');
    expect(course.lessons).toHaveLength(1);
    expect(course.lessons[0].status).toBe('svolta');
    expect(course.lessons[0].studied_minutes).toBeGreaterThan(0);

    fs.rmSync(path.dirname(exportPath), { recursive: true, force: true });
  });
});
