const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./helpers');

function iso(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

test.describe('Generazione calendario lezioni', () => {
  let ctx;

  test.beforeEach(async () => {
    ctx = await launchApp();
  });

  test.afterEach(async () => {
    await closeApp(ctx);
  });

  test('genera una lezione per ogni occorrenza settimanale dello slot nel periodo scelto', async () => {
    const { window } = ctx;
    const start = new Date('2027-01-04T00:00:00'); // lunedì
    const end = new Date(start);
    end.setDate(start.getDate() + 21); // 3 settimane dopo, ancora lunedì -> 4 occorrenze

    await window.getByRole('button', { name: '+ Aggiungi corso' }).click();
    await window.locator('[data-view="addCourse"] input').first().fill('Corso Calendario');
    await window.locator('[data-view="addCourse"] input[type="date"]').first().fill(iso(start));
    await window.locator('[data-view="addCourse"] input[type="date"]').nth(1).fill(iso(end));
    await window.locator('[data-view="addCourse"] select').first().selectOption(String(start.getDay()));
    await window.getByRole('button', { name: 'Salva corso' }).click();

    await window.getByRole('button', { name: 'Lezioni' }).click();
    await expect(window.locator('[data-view="courseLessons"]')).toBeVisible();

    const boxes = window.locator('[data-view="courseLessons"] button');
    await expect(boxes).toHaveCount(4);

    const weekHeadings = window.locator('[data-view="courseLessons"] h4');
    await expect(weekHeadings).toHaveCount(4);
  });

  test('rigenera le lezioni programmate quando il periodo del corso cambia', async () => {
    const { window } = ctx;
    const start = new Date('2027-04-05T00:00:00'); // lunedì
    const end = new Date(start);
    end.setDate(start.getDate() + 7); // 2 occorrenze

    await window.getByRole('button', { name: '+ Aggiungi corso' }).click();
    await window.locator('[data-view="addCourse"] input').first().fill('Corso Rigenera');
    await window.locator('[data-view="addCourse"] input[type="date"]').first().fill(iso(start));
    await window.locator('[data-view="addCourse"] input[type="date"]').nth(1).fill(iso(end));
    await window.locator('[data-view="addCourse"] select').first().selectOption(String(start.getDay()));
    await window.getByRole('button', { name: 'Salva corso' }).click();

    await window.getByRole('button', { name: 'Modifica' }).click();
    const newEnd = new Date(start);
    newEnd.setDate(start.getDate() + 21); // ora 4 occorrenze
    const editForm = window.locator('[data-view="courseDetails"] form');
    await editForm.locator('input[type="date"]').nth(1).fill(iso(newEnd));
    await editForm.getByRole('button', { name: 'Salva' }).click();

    await window.getByRole('button', { name: 'Lezioni' }).click();
    await expect(window.locator('[data-view="courseLessons"] button')).toHaveCount(4);
  });

  test('rigenerando il calendario non duplica né cancella le lezioni già svolte', async () => {
    const { window } = ctx;
    const start = new Date('2027-04-05T00:00:00'); // lunedì
    const end = new Date(start);
    end.setDate(start.getDate() + 14); // 3 occorrenze

    await window.getByRole('button', { name: '+ Aggiungi corso' }).click();
    await window.locator('[data-view="addCourse"] input').first().fill('Corso Senza Doppioni');
    await window.locator('[data-view="addCourse"] input[type="date"]').first().fill(iso(start));
    await window.locator('[data-view="addCourse"] input[type="date"]').nth(1).fill(iso(end));
    await window.locator('[data-view="addCourse"] select').first().selectOption(String(start.getDay()));
    await window.getByRole('button', { name: 'Salva corso' }).click();

    await window.getByRole('button', { name: 'Lezioni' }).click();
    const boxes = window.locator('[data-view="courseLessons"] button');
    await expect(boxes).toHaveCount(3);
    await boxes.first().click();
    await window.getByLabel('Argomento / contenuti trattati').fill('Già svolta');
    await window.locator('.fixed input[type="checkbox"]').check();
    await window.getByRole('button', { name: 'Salva' }).last().click();
    await expect(boxes.first()).toHaveClass(/emerald/);

    // Modifica + Salva senza cambiare nulla: rigenera le lezioni programmate.
    await window.getByRole('button', { name: 'Dettagli' }).click();
    await window.getByRole('button', { name: 'Modifica' }).click();
    await window.locator('[data-view="courseDetails"] form').getByRole('button', { name: 'Salva' }).click();
    await expect(window.locator('[data-view="courseDetails"]')).toContainText('Corso Senza Doppioni');

    await window.getByRole('button', { name: 'Lezioni' }).click();
    await expect(boxes).toHaveCount(3);
    await expect(window.locator('[data-view="courseLessons"] button.bg-emerald-100')).toHaveCount(1);
    await boxes.first().click();
    await expect(window.getByLabel('Argomento / contenuti trattati')).toHaveValue('Già svolta');
  });
});
