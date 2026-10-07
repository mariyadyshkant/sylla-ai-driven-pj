const { test, expect } = require('@playwright/test');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { launchApp, closeApp, openLessonWindow, saveAndCloseLesson } = require('./helpers');

function iso(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ffmpeg e whisper finti: niente binari reali né download del modello nei test.
function makeFakeBinaries(dir) {
  const ffmpeg = path.join(dir, 'ffmpeg');
  fs.writeFileSync(ffmpeg, '#!/bin/sh\nfor last; do :; done\necho wav > "$last"\n', { mode: 0o755 });
  const whisper = path.join(dir, 'whisper-cli');
  fs.writeFileSync(
    whisper,
    '#!/bin/sh\nwhile [ $# -gt 0 ]; do [ "$1" = "-of" ] && of="$2"; shift; done\n' +
      'echo "whisper_print_progress_callback: progress =  50%" >&2\n' +
      'echo "whisper_print_progress_callback: progress = 100%" >&2\n' +
      'echo "Trascrizione di prova della lezione" > "$of.txt"\n',
    { mode: 0o755 }
  );
  return { ffmpeg, whisper };
}

async function createCourseAndOpenFirstLesson(app, window) {
  const start = new Date('2027-05-03T00:00:00');
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  await window.getByRole('button', { name: '+ Aggiungi corso' }).click();
  await window.locator('[data-view="addCourse"] input').first().fill('Corso Trascrizione');
  await window.locator('[data-view="addCourse"] input[type="date"]').first().fill(iso(start));
  await window.locator('[data-view="addCourse"] input[type="date"]').nth(1).fill(iso(end));
  await window.locator('[data-view="addCourse"] select').first().selectOption(String(start.getDay()));
  await window.getByRole('button', { name: 'Salva corso' }).click();
  await window.getByRole('button', { name: 'Lezioni', exact: true }).click();
  return openLessonWindow(app, window.locator('[data-view="courseLessons"] button').first());
}

test.describe('Trascrizione e AI', () => {
  let ctx;
  let tmp;
  let aiServer;
  let aiRequests;

  test.beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sylla-fake-'));
    const bins = makeFakeBinaries(tmp);
    aiRequests = [];
    aiServer = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        const parsed = JSON.parse(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        if (parsed.system.startsWith('Ripulisci')) {
          // passaggio di pulizia: restituisce il testo ricevuto (qui non serve verificarlo)
          res.end(JSON.stringify({ content: [{ type: 'text', text: `${parsed.messages[0].content} (pulita)` }], stop_reason: 'end_turn' }));
          return;
        }
        aiRequests.push({ headers: req.headers, body: parsed });
        res.end(JSON.stringify({ content: [{ type: 'text', text: 'Riassunto: lezione introduttiva' }] }));
      });
    });
    await new Promise((resolve) => aiServer.listen(0, '127.0.0.1', resolve));
    ctx = await launchApp({
      SYLLA_FFMPEG_PATH: bins.ffmpeg,
      SYLLA_WHISPER_PATH: bins.whisper,
      SYLLA_AI_API_URL: `http://127.0.0.1:${aiServer.address().port}/v1/messages`,
    });
  });

  test.afterEach(async () => {
    await closeApp(ctx);
    await new Promise((resolve) => aiServer.close(resolve));
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('carica un file, mostra la trascrizione e la persiste', async () => {
    const { app, window, dbPath } = ctx;
    // Il modello finto va nella cartella del db di test (userDataDir in modalità test).
    fs.mkdirSync(path.join(path.dirname(dbPath), 'models'), { recursive: true });
    fs.writeFileSync(path.join(path.dirname(dbPath), 'models', 'ggml-base.bin'), 'fake-model');
    const audio = path.join(tmp, 'lezione.mp3');
    fs.writeFileSync(audio, 'audio');
    await app.evaluate(async ({ dialog }, file) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
    }, audio);

    const lessonWin = await createCourseAndOpenFirstLesson(app, window);
    await lessonWin.getByRole('button', { name: 'Carica file audio/video' }).click();
    await expect(lessonWin.getByLabel('Trascrizione')).toHaveValue('Trascrizione di prova della lezione');

    await saveAndCloseLesson(lessonWin);
    const reopened = await openLessonWindow(app, window.locator('[data-view="courseLessons"] button').first());
    await expect(reopened.getByLabel('Trascrizione')).toHaveValue('Trascrizione di prova della lezione');
  });

  test('"Elabora in note" è disabilitato senza trascrizione e usa la API key salvata', async () => {
    const { app, window } = ctx;
    await window.getByRole('button', { name: 'Impostazioni' }).click();
    await window.getByRole('button', { name: 'Trascrizione e AI' }).click();
    await window.getByLabel('API key per l\'elaborazione AI').fill('sk-test-123');
    await window.locator('[data-view="settings"]').getByRole('button', { name: 'Salva' }).last().click();
    await expect(window.getByText('Impostazioni salvate.')).toBeVisible();

    await window.getByRole('button', { name: '+ Aggiungi corso' }).click();
    const modal = await createCourseAndOpenFirstLesson(app, window);
    const button = modal.getByRole('button', { name: 'Elabora in note' });
    await expect(button).toBeDisabled();

    await modal.getByLabel('Trascrizione').fill('Oggi abbiamo parlato di algoritmi.');
    await expect(button).toBeEnabled();
    await button.click();
    await expect(modal.getByLabel('Note elaborate (AI)')).toHaveValue('Riassunto: lezione introduttiva');
    expect(aiRequests).toHaveLength(1);
    expect(aiRequests[0].headers['x-api-key']).toBe('sk-test-123');
    expect(aiRequests[0].body.messages[0].content).toContain('algoritmi');
  });
});
