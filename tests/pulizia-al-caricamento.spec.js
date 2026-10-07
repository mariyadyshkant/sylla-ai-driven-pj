const { test, expect } = require('@playwright/test');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { launchApp, closeApp, openLessonWindow, saveAndCloseLesson } = require('./helpers');

const RAW = 'oggi parliamo di agenti ai un agente percepisce decide e agisce';
const CLEAN = 'Oggi parliamo di agenti AI. Un agente percepisce, decide e agisce.';

function iso(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ffmpeg e whisper finti: whisper restituisce sempre RAW.
function makeFakeBinaries(dir) {
  const ffmpeg = path.join(dir, 'ffmpeg');
  fs.writeFileSync(ffmpeg, '#!/bin/sh\nfor last; do :; done\necho wav > "$last"\n', { mode: 0o755 });
  const whisper = path.join(dir, 'whisper-cli');
  fs.writeFileSync(
    whisper,
    `#!/bin/sh\nwhile [ $# -gt 0 ]; do [ "$1" = "-of" ] && of="$2"; shift; done\necho "${RAW}" > "$of.txt"\n`,
    { mode: 0o755 }
  );
  return { ffmpeg, whisper };
}

test.describe('Pulizia della trascrizione al caricamento', () => {
  let ctx;
  let tmp;
  let aiServer;
  let cleanupRequests;
  let notesRequests;
  let cleanupFails;

  async function openFirstLesson() {
    const { app, window } = ctx;
    const start = new Date('2027-05-03T00:00:00');
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    await window.getByRole('button', { name: '+ Aggiungi corso' }).click();
    await window.locator('[data-view="addCourse"] input').first().fill('Corso Caricamento');
    await window.locator('[data-view="addCourse"] input[type="date"]').first().fill(iso(start));
    await window.locator('[data-view="addCourse"] input[type="date"]').nth(1).fill(iso(end));
    await window.locator('[data-view="addCourse"] select').first().selectOption(String(start.getDay()));
    await window.getByRole('button', { name: 'Salva corso' }).click();
    await window.getByRole('button', { name: 'Lezioni', exact: true }).click();
    return openLessonWindow(app, window.locator('[data-view="courseLessons"] button').first());
  }

  async function upload(lessonWin) {
    const audio = path.join(tmp, 'lezione.mp3');
    fs.writeFileSync(audio, 'audio');
    await ctx.app.evaluate(async ({ dialog }, f) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [f] });
    }, audio);
    await lessonWin.getByRole('button', { name: 'Carica file audio/video' }).click();
  }

  async function launch({ withKey }) {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sylla-upload-'));
    const bins = makeFakeBinaries(tmp);
    cleanupRequests = [];
    notesRequests = [];
    cleanupFails = false;
    aiServer = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        const parsed = JSON.parse(body);
        if (parsed.system.startsWith('Ripulisci')) {
          cleanupRequests.push(parsed);
          if (cleanupFails) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: { message: 'overloaded' } }));
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ content: [{ type: 'text', text: CLEAN }], stop_reason: 'end_turn' }));
          return;
        }
        notesRequests.push(parsed);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ content: [{ type: 'text', text: 'Note' }] }));
      });
    });
    await new Promise((resolve) => aiServer.listen(0, '127.0.0.1', resolve));
    ctx = await launchApp({
      SYLLA_FFMPEG_PATH: bins.ffmpeg,
      SYLLA_WHISPER_PATH: bins.whisper,
      SYLLA_AI_API_URL: `http://127.0.0.1:${aiServer.address().port}/v1/messages`,
    });
    fs.mkdirSync(path.join(path.dirname(ctx.dbPath), 'models'), { recursive: true });
    fs.writeFileSync(path.join(path.dirname(ctx.dbPath), 'models', 'ggml-base.bin'), 'fake-model');
    if (withKey) await ctx.window.evaluate(() => window.api.settings.set('ai_api_key', 'sk-test-123'));
  }

  test.afterEach(async () => {
    await closeApp(ctx);
    await new Promise((resolve) => aiServer.close(resolve));
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  test('al caricamento la trascrizione viene ripulita, con badge, originale conservato e ripristinabile', async () => {
    await launch({ withKey: true });
    const { app, window } = ctx;
    const lessonWin = await openFirstLesson();
    await upload(lessonWin);

    await expect(lessonWin.getByLabel('Trascrizione')).toHaveValue(CLEAN);
    await expect(lessonWin.getByTestId('transcript-badge')).toHaveText('✓ trascrizione migliorata');
    expect(cleanupRequests).toHaveLength(1);
    expect(cleanupRequests[0].messages[0].content).toBe(RAW);

    // il badge è salvato con la trascrizione: resta riaprendo la lezione
    await saveAndCloseLesson(lessonWin);
    const reopened = await openLessonWindow(app, window.locator('[data-view="courseLessons"] button').first());
    await expect(reopened.getByLabel('Trascrizione')).toHaveValue(CLEAN);
    await expect(reopened.getByTestId('transcript-badge')).toHaveText('✓ trascrizione migliorata');

    // l'output grezzo di whisper è conservato e si può ripristinare
    await reopened.getByTestId('transcript-restore').click();
    await expect(reopened.getByLabel('Trascrizione')).toHaveValue(RAW);
    await expect(reopened.getByTestId('transcript-badge')).toHaveCount(0);
    await expect(reopened.getByTestId('transcript-restore')).toBeHidden();
    await saveAndCloseLesson(reopened);
    const again = await openLessonWindow(app, window.locator('[data-view="courseLessons"] button').first());
    await expect(again.getByLabel('Trascrizione')).toHaveValue(RAW);
    await expect(again.getByTestId('transcript-badge')).toHaveCount(0);
  });

  test('"Elabora in note" non ripulisce di nuovo una trascrizione già migliorata', async () => {
    await launch({ withKey: true });
    const lessonWin = await openFirstLesson();
    await upload(lessonWin);
    await expect(lessonWin.getByTestId('transcript-badge')).toBeVisible();
    expect(cleanupRequests).toHaveLength(1);

    await lessonWin.getByRole('button', { name: 'Elabora in note' }).click();
    await expect(lessonWin.getByLabel('Note elaborate (AI)')).toHaveValue('Note');
    expect(cleanupRequests).toHaveLength(1); // nessuna seconda pulizia
    expect(notesRequests).toHaveLength(1);
    expect(notesRequests[0].messages[0].content).toContain(CLEAN);
    await expect(lessonWin.getByTestId('ai-cleanup-badge')).toHaveText('✓ trascrizione migliorata');
  });

  test('senza API key la trascrizione resta quella grezza di whisper, senza chiamate esterne', async () => {
    await launch({ withKey: false });
    const lessonWin = await openFirstLesson();
    await upload(lessonWin);

    await expect(lessonWin.getByLabel('Trascrizione')).toHaveValue(RAW);
    await expect(lessonWin.getByTestId('transcript-badge')).toHaveCount(0);
    await expect(lessonWin.getByTestId('transcript-restore')).toBeHidden();
    expect(cleanupRequests).toHaveLength(0);
  });

  test('se la pulizia fallisce si tiene il testo grezzo, lo si segnala e le note riprovano la pulizia', async () => {
    await launch({ withKey: true });
    cleanupFails = true;
    const lessonWin = await openFirstLesson();
    await upload(lessonWin);

    await expect(lessonWin.getByLabel('Trascrizione')).toHaveValue(RAW);
    await expect(lessonWin.getByTestId('transcript-badge')).toHaveText('pulizia non riuscita');

    // non essendo migliorata, "Elabora in note" ritenta la pulizia (che qui fallisce ancora) e genera comunque le note
    await lessonWin.getByRole('button', { name: 'Elabora in note' }).click();
    await expect(lessonWin.getByLabel('Note elaborate (AI)')).toHaveValue('Note');
    expect(cleanupRequests.length).toBeGreaterThanOrEqual(2);
    expect(notesRequests[0].messages[0].content).toContain(RAW);
  });
});
