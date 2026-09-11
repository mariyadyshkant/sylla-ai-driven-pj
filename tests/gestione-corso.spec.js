const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./helpers');

function iso(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function fillAddCourseForm(window, { name, teacher, start, end, weekday }) {
  await window.getByRole('button', { name: '+ Aggiungi corso' }).click();
  await expect(window.locator('[data-view="addCourse"]')).toBeVisible();
  await window.locator('[data-view="addCourse"] input').first().fill(name);
  await window.locator('[data-view="addCourse"] input').nth(1).fill(teacher);
  await window.locator('[data-view="addCourse"] input[type="date"]').first().fill(iso(start));
  await window.locator('[data-view="addCourse"] input[type="date"]').nth(1).fill(iso(end));
  await window.locator('[data-view="addCourse"] select').first().selectOption(String(weekday));
  await window.getByRole('button', { name: 'Salva corso' }).click();
  await expect(window.locator('[data-view="courseDetails"]')).toBeVisible();
}

test.describe('Gestione corso', () => {
  let ctx;

  test.beforeEach(async () => {
    ctx = await launchApp();
  });

  test.afterEach(async () => {
    await closeApp(ctx);
  });

  test('crea, modifica ed elimina un corso senza lezioni svolte', async () => {
    const { window } = ctx;
    const start = new Date('2027-02-01T00:00:00');
    const end = new Date('2027-02-08T00:00:00');

    await fillAddCourseForm(window, { name: 'Corso Test A', teacher: 'Prof. Rossi', start, end, weekday: start.getDay() });
    await expect(window.locator('aside')).toContainText('Corso Test A');
    await expect(window.locator('[data-view="courseDetails"]')).toContainText('Prof. Rossi');

    await window.getByRole('button', { name: 'Modifica' }).click();
    const editForm = window.locator('[data-view="courseDetails"] form');
    await editForm.locator('input').nth(1).fill('Prof. Bianchi');
    await editForm.getByRole('button', { name: 'Salva' }).click();
    await expect(window.locator('[data-view="courseDetails"]')).toContainText('Prof. Bianchi');

    await window.getByRole('button', { name: 'Elimina corso' }).click();
    await window.getByRole('button', { name: 'Elimina definitivamente' }).click();
    await expect(window.locator('aside')).not.toContainText('Corso Test A');
  });

  test('archivia un corso con lezioni svolte e lo ripristina', async () => {
    const { window } = ctx;
    const start = new Date('2027-03-01T00:00:00');
    const end = new Date('2027-03-15T00:00:00');

    await fillAddCourseForm(window, { name: 'Corso Test B', teacher: 'Prof. Verdi', start, end, weekday: start.getDay() });

    await window.getByRole('button', { name: 'Lezioni' }).click();
    await expect(window.locator('[data-view="courseLessons"]')).toBeVisible();
    await window.locator('[data-view="courseLessons"] button', { hasText: '1' }).first().click();
    await window.locator('.fixed input[type="checkbox"]').check();
    await window.getByRole('button', { name: 'Salva' }).last().click();

    await window.getByRole('button', { name: 'Dettagli' }).click();
    await window.getByRole('button', { name: 'Elimina corso' }).click();
    await expect(window.getByText('lezioni svolte')).toBeVisible();
    await window.getByRole('button', { name: 'Archivia' }).click();
    await expect(window.locator('aside')).not.toContainText('Corso Test B');

    await window.getByRole('button', { name: 'Archivio' }).click();
    await expect(window.locator('[data-view="archive"]')).toContainText('Corso Test B');
    await window.getByRole('button', { name: 'Ripristina' }).click();
    await expect(window.locator('[data-view="archive"]')).not.toContainText('Corso Test B');

    await window.getByRole('button', { name: 'Dashboard' }).click();
    await expect(window.locator('aside')).toContainText('Corso Test B');
  });
});
