const { test, expect } = require('@playwright/test');
const http = require('http');
const { launchApp, closeApp } = require('./helpers');

function iso(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => resolve({ status: res.statusCode, json: JSON.parse(body) }));
      })
      .on('error', reject);
  });
}

test.describe('API locale study-stats', () => {
  let ctx;

  test.beforeEach(async () => {
    ctx = await launchApp();
  });

  test.afterEach(async () => {
    await closeApp(ctx);
  });

  test('espone su localhost i corsi e le lezioni svolte, sempre aggiornati, senza export manuale', async () => {
    const { window } = ctx;
    const start = new Date('2027-07-05T00:00:00'); // lunedì
    const end = new Date(start);
    end.setDate(start.getDate() + 7);

    await window.getByRole('button', { name: '+ Aggiungi corso' }).click();
    await window.locator('[data-view="addCourse"] input').first().fill('Corso API');
    await window.locator('[data-view="addCourse"] input[type="date"]').first().fill(iso(start));
    await window.locator('[data-view="addCourse"] input[type="date"]').nth(1).fill(iso(end));
    await window.locator('[data-view="addCourse"] select').first().selectOption(String(start.getDay()));
    await window.getByRole('button', { name: 'Salva corso' }).click();

    // Ancora nessuna lezione svolta: l'endpoint deve già rispondere con il corso vuoto.
    let res = await getJson('http://127.0.0.1:4175/api/v1/study-stats');
    expect(res.status).toBe(200);
    expect(res.json.courses).toHaveLength(1);
    expect(res.json.courses[0].lessons).toHaveLength(0);

    await window.getByRole('button', { name: 'Lezioni', exact: true }).click();
    const firstBox = window.locator('[data-view="courseLessons"] button').first();
    await firstBox.click();
    const modal = window.locator('.fixed');
    await modal.locator('input[type="checkbox"]').check();
    await modal.getByRole('button', { name: 'Salva' }).click();
    await expect(modal).toBeHidden();

    // Nessuna azione di export: l'endpoint riflette subito la modifica.
    res = await getJson('http://127.0.0.1:4175/api/v1/study-stats');
    expect(res.json.courses[0].lessons).toHaveLength(1);
    expect(res.json.courses[0].lessons[0].status).toBe('svolta');
    expect(res.json.courses[0].lessons[0].studied_minutes).toBeGreaterThan(0);
  });

  test('risponde 404 su path non riconosciuti', async () => {
    const res = await getJson('http://127.0.0.1:4175/unknown');
    expect(res.status).toBe(404);
  });
});
