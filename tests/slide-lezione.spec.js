const { test, expect } = require('@playwright/test');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { launchApp, closeApp, openLessonWindow, saveAndCloseLesson } = require('./helpers');

const FIXTURE_PDF = path.join(__dirname, 'fixtures', 'slides.pdf');

function iso(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

test.describe('Slide della lezione', () => {
  let ctx;
  let tmp;
  let aiServer;
  let aiRequests;

  async function openFirstLesson() {
    const { app, window } = ctx;
    const start = new Date('2027-05-03T00:00:00');
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    await window.getByRole('button', { name: '+ Aggiungi corso' }).click();
    await window.locator('[data-view="addCourse"] input').first().fill('Corso Slide');
    await window.locator('[data-view="addCourse"] input[type="date"]').first().fill(iso(start));
    await window.locator('[data-view="addCourse"] input[type="date"]').nth(1).fill(iso(end));
    await window.locator('[data-view="addCourse"] select').first().selectOption(String(start.getDay()));
    await window.getByRole('button', { name: 'Salva corso' }).click();
    await window.getByRole('button', { name: 'Lezioni', exact: true }).click();
    return openLessonWindow(app, window.locator('[data-view="courseLessons"] button').first());
  }

  async function pickFile(file) {
    await ctx.app.evaluate(async ({ dialog }, f) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [f] });
    }, file);
  }

  test.beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sylla-slides-'));
    aiRequests = [];
    aiServer = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        aiRequests.push(JSON.parse(body));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ content: [{ type: 'text', text: 'Note di prova' }] }));
      });
    });
    await new Promise((resolve) => aiServer.listen(0, '127.0.0.1', resolve));
    ctx = await launchApp({ SYLLA_AI_API_URL: `http://127.0.0.1:${aiServer.address().port}/v1/messages` });
    await ctx.window.evaluate(() => window.api.settings.set('ai_api_key', 'sk-test-123'));
  });

  test.afterEach(async () => {
    await closeApp(ctx);
    await new Promise((resolve) => aiServer.close(resolve));
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('allega un PDF, ne mostra il nome, lo conserva alla riapertura e si può rimuovere', async () => {
    const { app, window } = ctx;
    const lessonWin = await openFirstLesson();
    await expect(lessonWin.getByTestId('slides-attach')).toHaveText('Allega slide (PDF)');
    await expect(lessonWin.getByTestId('slides-open')).toHaveCount(0);

    await pickFile(FIXTURE_PDF);
    await lessonWin.getByTestId('slides-attach').click();
    await expect(lessonWin.getByTestId('slides-name')).toHaveText('slides.pdf');
    await expect(lessonWin.getByTestId('slides-open')).toBeVisible();

    // l'allegato è salvato subito e sopravvive alla chiusura, anche con "Salva" che riscrive il resto
    await saveAndCloseLesson(lessonWin);
    const reopened = await openLessonWindow(app, window.locator('[data-view="courseLessons"] button').first());
    await expect(reopened.getByTestId('slides-name')).toHaveText('slides.pdf');

    await reopened.getByRole('button', { name: 'Rimuovi' }).click();
    await expect(reopened.getByTestId('slides-attach')).toBeVisible();
  });

  test('"Apri slide" apre una finestra 900x700 con il PDF', async () => {
    const { app } = ctx;
    const lessonWin = await openFirstLesson();
    await pickFile(FIXTURE_PDF);
    await lessonWin.getByTestId('slides-attach').click();

    const [viewer] = await Promise.all([app.waitForEvent('window'), lessonWin.getByTestId('slides-open').click()]);
    await viewer.waitForSelector('#pdf');
    await expect(viewer.locator('#name')).toHaveText('slides.pdf');
    await expect(viewer.locator('#pdf')).toHaveAttribute('src', /^file:\/\/.*slides\.pdf$/);
    const handle = await app.browserWindow(viewer);
    expect(await handle.evaluate((w) => w.getSize())).toEqual([900, 700]);
  });

  test('le note AI includono il testo delle slide allegate', async () => {
    const lessonWin = await openFirstLesson();
    await lessonWin.getByLabel('Trascrizione').fill('Oggi abbiamo parlato di agenti.');

    // senza slide: nessun contenuto slide nella richiesta
    await lessonWin.getByRole('button', { name: 'Elabora in note' }).click();
    await expect(lessonWin.getByLabel('Note elaborate (AI)')).toHaveValue('Note di prova');
    expect(aiRequests).toHaveLength(1);
    expect(aiRequests[0].messages[0].content).not.toContain('CONTENUTO SLIDE');

    // con slide: il testo estratto dal PDF è accodato con il prefisso previsto
    await pickFile(FIXTURE_PDF);
    await lessonWin.getByTestId('slides-attach').click();
    await expect(lessonWin.getByTestId('slides-name')).toBeVisible();
    await lessonWin.getByRole('button', { name: 'Elabora in note' }).click();
    await expect.poll(() => aiRequests.length).toBe(2);
    const content = aiRequests[1].messages[0].content;
    expect(content).toContain('Oggi abbiamo parlato di agenti.');
    expect(content).toContain('\n\n---\nCONTENUTO SLIDE:\n');
    expect(content).toContain('ORCHESTRATORE');
    await expect(lessonWin.getByTestId('ai-warning')).toBeHidden();
  });

  test('se il PDF non esiste più, le note si generano comunque e compare un avviso', async () => {
    const lessonWin = await openFirstLesson();
    const copy = path.join(tmp, 'temporanee.pdf');
    fs.copyFileSync(FIXTURE_PDF, copy);
    await pickFile(copy);
    await lessonWin.getByTestId('slides-attach').click();
    await expect(lessonWin.getByTestId('slides-name')).toHaveText('temporanee.pdf');
    fs.rmSync(copy);

    await lessonWin.getByTestId('slides-open').click();
    await expect(lessonWin.getByTestId('slides-error')).toContainText('File non trovato');

    await lessonWin.getByLabel('Trascrizione').fill('Testo della lezione.');
    await lessonWin.getByRole('button', { name: 'Elabora in note' }).click();
    await expect(lessonWin.getByLabel('Note elaborate (AI)')).toHaveValue('Note di prova');
    await expect(lessonWin.getByTestId('ai-warning')).toContainText('file non trovato');
    expect(aiRequests[0].messages[0].content).not.toContain('CONTENUTO SLIDE');
  });
});
