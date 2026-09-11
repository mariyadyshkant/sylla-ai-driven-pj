const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./helpers');

function iso(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

test.describe('Gestione lezioni', () => {
  let ctx;

  test.beforeEach(async () => {
    ctx = await launchApp();
  });

  test.afterEach(async () => {
    await closeApp(ctx);
  });

  test('compila una lezione dal modale e la persiste come svolta', async () => {
    const { window } = ctx;
    const start = new Date('2027-05-03T00:00:00');
    const end = new Date(start);
    end.setDate(start.getDate() + 7);

    await window.getByRole('button', { name: '+ Aggiungi corso' }).click();
    await window.locator('[data-view="addCourse"] input').first().fill('Corso Lezioni');
    await window.locator('[data-view="addCourse"] input[type="date"]').first().fill(iso(start));
    await window.locator('[data-view="addCourse"] input[type="date"]').nth(1).fill(iso(end));
    await window.locator('[data-view="addCourse"] select').first().selectOption(String(start.getDay()));
    await window.getByRole('button', { name: 'Salva corso' }).click();

    await window.getByRole('button', { name: 'Lezioni', exact: true }).click();
    const firstBox = window.locator('[data-view="courseLessons"] button').first();
    await expect(firstBox).not.toHaveClass(/emerald/);
    await firstBox.click();

    const modal = window.locator('.fixed');
    await modal.getByLabel('Argomento / contenuti trattati').fill('Introduzione al corso');
    await modal.getByRole('button', { name: '+ Aggiungi materiale' }).click();
    await modal.locator('input[placeholder="Nome"]').fill('Slide 1');
    await modal.locator('input[placeholder="Link"]').fill('https://example.com/slide1');
    await modal.getByLabel('Note libere').fill('Prima lezione andata bene');
    await modal.locator('input[type="checkbox"]').check();
    await modal.getByRole('button', { name: 'Salva' }).click();

    await expect(modal).toBeHidden();
    await expect(firstBox).toHaveClass(/emerald/);

    await firstBox.click();
    await expect(modal.getByLabel('Argomento / contenuti trattati')).toHaveValue('Introduzione al corso');
    await expect(modal.locator('input[placeholder="Nome"]')).toHaveValue('Slide 1');
    await expect(modal.locator('input[type="checkbox"]')).toBeChecked();
  });
});
