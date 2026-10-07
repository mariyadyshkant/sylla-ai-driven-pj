const { test, expect } = require('@playwright/test');
const http = require('http');
const { launchApp, closeApp, openLessonWindow, saveAndCloseLesson } = require('./helpers');

function iso(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const RAW = 'oggi parliamo di agenti ai un agente percepisce decide e agisce il loop e lorchestratore';

test.describe('Pulizia della trascrizione prima delle note AI', () => {
  let ctx;
  let aiServer;
  let cleanupRequests;
  let notesRequests;
  let cleanupBehavior; // 'ok' | 'error' | 'summary'

  async function openFirstLesson() {
    const { app, window } = ctx;
    const start = new Date('2027-05-03T00:00:00');
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    await window.getByRole('button', { name: '+ Aggiungi corso' }).click();
    await window.locator('[data-view="addCourse"] input').first().fill('Corso Pulizia');
    await window.locator('[data-view="addCourse"] input[type="date"]').first().fill(iso(start));
    await window.locator('[data-view="addCourse"] input[type="date"]').nth(1).fill(iso(end));
    await window.locator('[data-view="addCourse"] select').first().selectOption(String(start.getDay()));
    await window.getByRole('button', { name: 'Salva corso' }).click();
    await window.getByRole('button', { name: 'Lezioni', exact: true }).click();
    return openLessonWindow(app, window.locator('[data-view="courseLessons"] button').first());
  }

  test.beforeEach(async () => {
    cleanupRequests = [];
    notesRequests = [];
    cleanupBehavior = 'ok';
    aiServer = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        const parsed = JSON.parse(body);
        if (parsed.system.startsWith('Ripulisci')) {
          cleanupRequests.push(parsed);
          if (cleanupBehavior === 'error') {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: { message: 'overloaded' } }));
            return;
          }
          const text =
            cleanupBehavior === 'summary'
              ? 'Si parla di agenti.' // riassunto: molto più corto dell'originale
              : 'Oggi parliamo di agenti AI. Un agente percepisce, decide e agisce.\n\nIl loop e l\'orchestratore.';
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ content: [{ type: 'text', text }], stop_reason: 'end_turn' }));
          return;
        }
        notesRequests.push(parsed);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ content: [{ type: 'text', text: '## Note\n\n- punto' }] }));
      });
    });
    await new Promise((resolve) => aiServer.listen(0, '127.0.0.1', resolve));
    ctx = await launchApp({ SYLLA_AI_API_URL: `http://127.0.0.1:${aiServer.address().port}/v1/messages` });
    await ctx.window.evaluate(() => window.api.settings.set('ai_api_key', 'sk-test-123'));
  });

  test.afterEach(async () => {
    await closeApp(ctx);
    await new Promise((resolve) => aiServer.close(resolve));
  });

  test('ripulisce la trascrizione prima delle note, usa il testo pulito come contesto e non lo salva', async () => {
    const { app, window } = ctx;
    const lessonWin = await openFirstLesson();
    await lessonWin.getByLabel('Trascrizione').fill(RAW);
    await lessonWin.getByRole('button', { name: 'Elabora in note' }).click();

    const badge = lessonWin.getByTestId('ai-cleanup-badge');
    await expect(badge).toHaveText('✓ trascrizione migliorata');
    await expect(badge).toHaveAttribute('title', /non è stato modificato/);

    // chiamata di pulizia: modello veloce, trascrizione grezza in ingresso
    expect(cleanupRequests).toHaveLength(1);
    expect(cleanupRequests[0].model).toBe('claude-haiku-4-5-20251001');
    expect(cleanupRequests[0].messages[0].content).toBe(RAW);
    expect(cleanupRequests[0].system).toContain('Non riassumere');

    // le note sono generate dal testo pulito, non da quello grezzo
    expect(notesRequests).toHaveLength(1);
    const content = notesRequests[0].messages[0].content;
    expect(content).toContain('Oggi parliamo di agenti AI. Un agente percepisce, decide e agisce.');
    expect(content).not.toContain(RAW);

    // il testo pulito non finisce nella lezione: dopo il salvataggio la trascrizione è quella originale
    await saveAndCloseLesson(lessonWin);
    const reopened = await openLessonWindow(app, window.locator('[data-view="courseLessons"] button').first());
    await expect(reopened.getByLabel('Trascrizione')).toHaveValue(RAW);
    // il badge descrive l'ultima generazione: non c'è finché non se ne fa un'altra
    await expect(reopened.getByTestId('ai-cleanup-badge')).toHaveCount(0);
  });

  test('se la pulizia fallisce usa la trascrizione originale e lo segnala', async () => {
    cleanupBehavior = 'error';
    const lessonWin = await openFirstLesson();
    await lessonWin.getByLabel('Trascrizione').fill(RAW);
    await lessonWin.getByRole('button', { name: 'Elabora in note' }).click();

    await expect(lessonWin.getByLabel('Note elaborate (AI)')).toHaveValue('## Note\n\n- punto');
    await expect(lessonWin.getByTestId('ai-cleanup-badge')).toHaveText('trascrizione originale usata');
    expect(notesRequests).toHaveLength(1);
    expect(notesRequests[0].messages[0].content).toContain(RAW);
  });

  test('scarta una pulizia che riassume invece di ripulire', async () => {
    cleanupBehavior = 'summary';
    const lessonWin = await openFirstLesson();
    await lessonWin.getByLabel('Trascrizione').fill(RAW);
    await lessonWin.getByRole('button', { name: 'Elabora in note' }).click();

    await expect(lessonWin.getByTestId('ai-cleanup-badge')).toHaveText('trascrizione originale usata');
    expect(cleanupRequests).toHaveLength(1);
    expect(notesRequests[0].messages[0].content).toContain(RAW);
    expect(notesRequests[0].messages[0].content).not.toContain('Si parla di agenti.');
  });

  test('una trascrizione lunga viene ripulita a pezzi senza perdere testo né ordine', async () => {
    const { splitTranscript } = require('../ai-notes.js');
    const long = Array.from({ length: 900 }, (_, i) => `frase numero ${i} della lezione.`).join(' ');
    const chunks = splitTranscript(long);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(8000);
    expect(chunks.join(' ')).toBe(long);
  });
});
