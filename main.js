const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const http = require('http');
const db = require('./db');
const transcription = require('./transcription');
const aiNotes = require('./ai-notes');

// Server locale in sola lettura (bind 127.0.0.1) usato dal microservizio esterno
// "Sylla study-stats" per leggere i dati sempre aggiornati senza export manuale.
// Non raggiungibile dalla rete esterna alla macchina: coerente col vincolo ADR
// "nessuna autenticazione / nessuna esposizione multi-utente" perché resta locale.
let studyStatsServer;

function startStudyStatsServer() {
  const port = Number(process.env.SYLLA_STUDY_STATS_PORT) || 4174;
  studyStatsServer = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/api/v1/study-stats') {
      const payload = db.buildStudyStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(payload));
      return;
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  });
  studyStatsServer.on('error', (err) => {
    console.error('study-stats server error:', err.message);
  });
  studyStatsServer.listen(port, '127.0.0.1');
}

function stopStudyStatsServer() {
  if (studyStatsServer) {
    studyStatsServer.close();
    studyStatsServer = undefined;
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile('index.html');

  if (process.env.NODE_ENV === 'development') {
    win.webContents.openDevTools({ mode: 'detach' });
  }
}

// Lavori di trascrizione in corso, per lezione: l'app resta usabile nel frattempo.
const transcriptionJobs = new Map();

// Finestre "blocco note" delle lezioni, una per lezione.
const lessonWindows = new Map();

function broadcast(channel, payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload);
  }
}

function openLessonWindow(lessonId) {
  const existing = lessonWindows.get(lessonId);
  if (existing && !existing.isDestroyed()) {
    if (existing.isMinimized()) existing.restore();
    existing.focus();
    return;
  }
  const win = new BrowserWindow({
    width: 800,
    height: 700,
    minWidth: 520,
    minHeight: 420,
    resizable: true,
    backgroundColor: '#faf8f3',
    autoHideMenuBar: true,
    title: 'Lezione — Sylla',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.removeMenu();
  win.loadFile('lesson.html', { query: { id: String(lessonId) } });
  lessonWindows.set(lessonId, win);
  win.on('closed', () => {
    lessonWindows.delete(lessonId);
    broadcast('lessons:changed', { lessonId });
  });
}

// Visualizzatore PDF delle slide allegate a una lezione (una finestra per lezione).
const slidesWindows = new Map();

function openSlidesWindow(lessonId, slidesPath) {
  const existing = slidesWindows.get(lessonId);
  if (existing && !existing.isDestroyed()) {
    existing.focus();
    return;
  }
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 520,
    minHeight: 420,
    backgroundColor: '#faf8f3',
    autoHideMenuBar: true,
    title: `Slide — ${path.basename(slidesPath)}`,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.removeMenu();
  win.loadFile('slides-viewer.html', { query: { path: slidesPath } });
  slidesWindows.set(lessonId, win);
  win.on('closed', () => slidesWindows.delete(lessonId));
}

function emitTranscription(lessonId, payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('transcription:progress', { lessonId, ...payload });
  }
}

async function runTranscription(lessonId, inputPath) {
  try {
    const text = await transcription.transcribeFile({
      inputPath,
      settings: db.getSettings(),
      userDataDir: process.env.SYLLA_DB_PATH ? path.dirname(process.env.SYLLA_DB_PATH) : app.getPath('userData'),
      onProgress: (p) => emitTranscription(lessonId, { state: 'running', ...p }),
    });
    db.setLessonField(lessonId, 'transcript', text);
    emitTranscription(lessonId, { state: 'done', transcript: text });
    broadcast('lessons:changed', { lessonId });
  } catch (err) {
    emitTranscription(lessonId, { state: 'error', error: err.message });
  } finally {
    transcriptionJobs.delete(lessonId);
  }
}

function registerIpcHandlers() {
  ipcMain.handle('courses:list', (_e, status) => db.listCourses(status));
  ipcMain.handle('courses:get', (_e, id) => db.getCourse(id));
  ipcMain.handle('courses:create', (_e, input) => db.createCourse(input));
  ipcMain.handle('courses:update', (_e, id, input) => db.updateCourse(id, input));
  ipcMain.handle('courses:archive', (_e, id) => db.archiveCourse(id));
  ipcMain.handle('courses:restore', (_e, id) => db.restoreCourse(id));
  ipcMain.handle('courses:delete', (_e, id) => db.deleteCourseCascade(id));

  ipcMain.handle('lessons:listByCourse', (_e, courseId) => db.listLessonsByCourse(courseId));
  ipcMain.handle('lessons:listAll', (_e, status) => db.listAllLessons(status));
  ipcMain.handle('lessons:get', (_e, id) => db.getLesson(id));
  ipcMain.handle('lessons:update', (_e, id, input) => {
    const lesson = db.updateLesson(id, input);
    broadcast('lessons:changed', { lessonId: id });
    return lesson;
  });

  ipcMain.handle('lessonWindow:open', (_e, lessonId) => openLessonWindow(lessonId));
  ipcMain.handle('lessonWindow:close', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (win) win.close();
  });

  ipcMain.handle('transcription:check', () => {
    const { ffmpeg, whisper } = transcription.resolveBinaries(db.getSettings());
    return { ffmpeg: Boolean(ffmpeg), whisper: Boolean(whisper) };
  });

  ipcMain.handle('transcription:start', async (_e, lessonId) => {
    if (transcriptionJobs.has(lessonId)) return { canceled: true, running: true };
    const win = BrowserWindow.getFocusedWindow();
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Carica registrazione della lezione',
      filters: [{ name: 'Audio/Video', extensions: ['mp3', 'm4a', 'wav', 'ogg', 'flac', 'mp4', 'mov', 'mkv', 'webm'] }],
      properties: ['openFile'],
    });
    if (canceled || !filePaths.length) return { canceled: true };
    transcriptionJobs.set(lessonId, true);
    runTranscription(lessonId, filePaths[0]);
    return { canceled: false };
  });

  ipcMain.handle('transcription:isRunning', (_e, lessonId) => transcriptionJobs.has(lessonId));

  // Usa la trascrizione passata dalla finestra (può contenere correzioni non ancora salvate);
  // le slide, se allegate alla lezione, vengono lette dal database.
  ipcMain.handle('ai:generateNotes', async (_e, { lessonId, transcript, topic }) => {
    const lesson = lessonId ? db.getLesson(lessonId) : null;
    const { notes, slidesWarning } = await aiNotes.generateNotes({
      transcript,
      topic,
      apiKey: db.getSettings().ai_api_key,
      slidesPath: lesson && lesson.slides_path,
    });
    return { ai_notes: notes, slidesWarning };
  });

  ipcMain.handle('dialog:openFile', async (e, options = {}) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: options.title || 'Seleziona file',
      filters: options.filters,
      properties: ['openFile'],
    });
    return canceled || !filePaths.length ? { canceled: true } : { canceled: false, filePath: filePaths[0] };
  });

  // slidesPath = null rimuove l'allegato.
  ipcMain.handle('lessons:updateSlides', (_e, lessonId, slidesPath) => {
    const lesson = db.setLessonField(lessonId, 'slides_path', slidesPath || null);
    broadcast('lessons:changed', { lessonId });
    return lesson;
  });

  ipcMain.handle('slides:open', (_e, lessonId) => {
    const lesson = db.getLesson(lessonId);
    if (!lesson || !lesson.slides_path) return { opened: false, error: 'Nessuna slide allegata.' };
    if (!fs.existsSync(lesson.slides_path)) {
      return { opened: false, error: `File non trovato: ${lesson.slides_path}` };
    }
    openSlidesWindow(lessonId, lesson.slides_path);
    return { opened: true };
  });

  ipcMain.handle('settings:get', () => db.getSettings());
  ipcMain.handle('settings:set', (_e, key, value) => db.setSetting(key, value));

  ipcMain.handle('backup:export', async () => {
    const win = BrowserWindow.getFocusedWindow();
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: 'Esporta database Sylla',
      defaultPath: 'sylla-backup.db',
      filters: [{ name: 'SQLite database', extensions: ['db'] }],
    });
    if (canceled || !filePath) return { canceled: true };
    return { canceled: false, ...db.exportBackup(filePath) };
  });

  ipcMain.handle('backup:import', async () => {
    const win = BrowserWindow.getFocusedWindow();
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Importa database Sylla',
      filters: [{ name: 'SQLite database', extensions: ['db'] }],
      properties: ['openFile'],
    });
    if (canceled || !filePaths.length) return { canceled: true };
    return { canceled: false, ...db.importBackup(filePaths[0]) };
  });

  ipcMain.handle('data:exportStudyStats', async () => {
    const win = BrowserWindow.getFocusedWindow();
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: 'Esporta dati per Sylla study-stats',
      defaultPath: 'study-stats.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (canceled || !filePath) return { canceled: true };
    return { canceled: false, ...db.exportStudyStats(filePath) };
  });
}

app.whenReady().then(() => {
  db.init();
  registerIpcHandlers();
  startStudyStatsServer();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  stopStudyStatsServer();
});
