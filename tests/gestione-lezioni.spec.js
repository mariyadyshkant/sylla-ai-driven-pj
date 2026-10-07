const { test, expect } = require('@playwright/test');
const { launchApp, closeApp, openLessonWindow, saveAndCloseLesson } = require('./helpers');

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

  async function createCourse(window, name, start, end) {
    await window.getByRole('button', { name: '+ Aggiungi corso' }).click();
    await window.locator('[data-view="addCourse"] input').first().fill(name);
    await window.locator('[data-view="addCourse"] input[type="date"]').first().fill(iso(start));
    await window.locator('[data-view="addCourse"] input[type="date"]').nth(1).fill(iso(end));
    await window.locator('[data-view="addCourse"] select').first().selectOption(String(start.getDay()));
    await window.getByRole('button', { name: 'Salva corso' }).click();
  }

  test('la lezione si apre in una finestra separata 800x700 con intestazione fissa e campi in colonna', async () => {
    const { app, window } = ctx;
    const start = new Date('2027-05-03T00:00:00');
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    await createCourse(window, 'Corso Finestra', start, end);
    await window.getByRole('button', { name: 'Lezioni', exact: true }).click();

    const lessonWin = await openLessonWindow(app, window.locator('[data-view="courseLessons"] button').first());

    // finestra separata, la principale resta com'è (nessun modale sopra la lista)
    expect(app.windows()).toHaveLength(2);
    await expect(window.locator('.fixed')).toHaveCount(0);

    const handle = await app.browserWindow(lessonWin);
    expect(await handle.evaluate((w) => w.getSize())).toEqual([800, 700]);
    expect(await handle.evaluate((w) => w.isResizable())).toBe(true);
    // Su macOS la barra dei menu è del sistema (non per finestra): il controllo vale solo su Windows/Linux.
    if (process.platform !== 'darwin') {
      expect(await handle.evaluate((w) => w.isMenuBarVisible())).toBe(false);
    }

    await expect(lessonWin.getByTestId('lesson-course')).toHaveText('Corso Finestra');
    await expect(lessonWin.getByTestId('lesson-datetime')).toContainText('2027-05-03');

    // tutti i campi presenti, uno sotto l'altro a piena larghezza
    const labels = ['Argomento / contenuti trattati', 'Note libere', 'Link alla registrazione', 'Trascrizione', 'Note elaborate (AI)'];
    const boxes = [];
    for (const label of labels) boxes.push(await lessonWin.getByLabel(label).boundingBox());
    const width = await lessonWin.evaluate(() => document.querySelector('main').clientWidth);
    for (const box of boxes) expect(box.width).toBeGreaterThan(width * 0.8);
    for (let i = 1; i < boxes.length; i++) expect(boxes[i].y).toBeGreaterThan(boxes[i - 1].y);

    // pulsanti fissi in fondo: restano visibili anche con il contenuto scrollato
    await lessonWin.locator('main').evaluate((m) => (m.scrollTop = m.scrollHeight));
    await expect(lessonWin.getByRole('button', { name: 'Salva' })).toBeInViewport();
    await expect(lessonWin.getByRole('button', { name: 'Chiudi' })).toBeInViewport();

    // una seconda apertura della stessa lezione riusa la finestra esistente
    await window.locator('[data-view="courseLessons"] button').first().click();
    await window.waitForTimeout(300);
    expect(app.windows()).toHaveLength(2);
  });

  test('compila una lezione nella finestra, la salva e la lista della finestra principale si aggiorna', async () => {
    const { app, window } = ctx;
    const start = new Date('2027-05-03T00:00:00');
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    await createCourse(window, 'Corso Lezioni', start, end);

    await window.getByRole('button', { name: 'Lezioni', exact: true }).click();
    const firstBox = window.locator('[data-view="courseLessons"] button').first();
    await expect(firstBox).not.toHaveClass(/emerald/);

    const lessonWin = await openLessonWindow(app, firstBox);
    await lessonWin.getByLabel('Argomento / contenuti trattati').fill('Introduzione al corso');
    await lessonWin.getByRole('button', { name: '+ Aggiungi materiale' }).click();
    await lessonWin.locator('input[placeholder="Nome"]').fill('Slide 1');
    await lessonWin.locator('input[placeholder="Link"]').fill('https://example.com/slide1');
    await lessonWin.getByLabel('Note libere').fill('Prima lezione andata bene');
    await lessonWin.locator('input[type="checkbox"]').check();

    // chiudere senza salvare non cambia nulla
    await expect(firstBox).not.toHaveClass(/emerald/);

    // Salva: la finestra resta aperta e la lista principale si aggiorna subito
    await lessonWin.getByRole('button', { name: 'Salva' }).click();
    await expect(lessonWin.getByText('Salvato')).toBeVisible();
    await expect(firstBox).toHaveClass(/emerald/);
    expect(lessonWin.isClosed()).toBe(false);

    await Promise.all([lessonWin.waitForEvent('close'), lessonWin.getByRole('button', { name: 'Chiudi' }).click()]);
    await expect(firstBox).toHaveClass(/emerald/);

    const reopened = await openLessonWindow(app, firstBox);
    await expect(reopened.getByLabel('Argomento / contenuti trattati')).toHaveValue('Introduzione al corso');
    await expect(reopened.getByLabel('Note libere')).toHaveValue('Prima lezione andata bene');
    await expect(reopened.locator('input[placeholder="Nome"]')).toHaveValue('Slide 1');
    await expect(reopened.locator('input[type="checkbox"]')).toBeChecked();
  });

  test('chiudere la finestra senza salvare scarta le modifiche', async () => {
    const { app, window } = ctx;
    const start = new Date('2027-05-03T00:00:00');
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    await createCourse(window, 'Corso Scarta', start, end);
    await window.getByRole('button', { name: 'Lezioni', exact: true }).click();
    const firstBox = window.locator('[data-view="courseLessons"] button').first();

    const lessonWin = await openLessonWindow(app, firstBox);
    await lessonWin.getByLabel('Argomento / contenuti trattati').fill('Non salvato');
    await lessonWin.locator('input[type="checkbox"]').check();
    await Promise.all([lessonWin.waitForEvent('close'), lessonWin.getByRole('button', { name: 'Chiudi' }).click()]);
    await expect(firstBox).not.toHaveClass(/emerald/);

    const reopened = await openLessonWindow(app, firstBox);
    await expect(reopened.getByLabel('Argomento / contenuti trattati')).toHaveValue('');
  });

  test('le note AI in Markdown vengono mostrate formattate, senza simboli grezzi, e restano modificabili', async () => {
    const { app, window } = ctx;
    const start = new Date('2027-05-03T00:00:00');
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    await createCourse(window, 'Corso Markdown', start, end);
    await window.getByRole('button', { name: 'Lezioni', exact: true }).click();
    const firstBox = window.locator('[data-view="courseLessons"] button').first();

    const lessonWin = await openLessonWindow(app, firstBox);
    const markdown = '# Note\n\n## Concetti chiave\n\n- **Trasparenza**: valore *fondamentale*\n- Secondo punto\n\n---\n\n1. Primo\n2. Secondo\n\n<script>window.__xss = 1</script>';
    await lessonWin.getByLabel('Note elaborate (AI)').fill(markdown);
    await lessonWin.getByTestId('ai-toggle').click(); // "Anteprima"

    const preview = lessonWin.getByTestId('ai-preview');
    await expect(preview.locator('h1')).toHaveText('Note');
    await expect(preview.locator('h2')).toHaveText('Concetti chiave');
    await expect(preview.locator('strong')).toHaveText('Trasparenza');
    await expect(preview.locator('em')).toHaveText('fondamentale');
    await expect(preview.locator('ul li')).toHaveCount(2);
    await expect(preview.locator('ol li')).toHaveCount(2);
    await expect(preview.locator('hr')).toHaveCount(1);
    const text = await preview.innerText();
    expect(text).not.toContain('**');
    expect(text).not.toMatch(/^#/m);
    // l'HTML scritto nelle note non viene mai eseguito
    await expect(preview.locator('script')).toHaveCount(0);
    expect(await lessonWin.evaluate(() => window.__xss)).toBeUndefined();

    // dopo il salvataggio, riaprendo la lezione l'anteprima è quella predefinita; "Modifica" mostra il Markdown
    await saveAndCloseLesson(lessonWin);
    const reopened = await openLessonWindow(app, firstBox);
    await expect(reopened.getByTestId('ai-preview')).toBeVisible();
    await reopened.getByTestId('ai-toggle').click();
    await expect(reopened.getByLabel('Note elaborate (AI)')).toBeVisible();
    await expect(reopened.getByLabel('Note elaborate (AI)')).toHaveValue(markdown);
  });
});
