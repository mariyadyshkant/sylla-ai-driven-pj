const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const db = require('./db');

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
  ipcMain.handle('lessons:update', (_e, id, input) => db.updateLesson(id, input));

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
