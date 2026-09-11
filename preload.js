const { contextBridge, ipcRenderer, shell } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  openExternal: (url) => shell.openExternal(url),
});

contextBridge.exposeInMainWorld('api', {
  courses: {
    list: (status) => ipcRenderer.invoke('courses:list', status),
    get: (id) => ipcRenderer.invoke('courses:get', id),
    create: (input) => ipcRenderer.invoke('courses:create', input),
    update: (id, input) => ipcRenderer.invoke('courses:update', id, input),
    archive: (id) => ipcRenderer.invoke('courses:archive', id),
    restore: (id) => ipcRenderer.invoke('courses:restore', id),
    delete: (id) => ipcRenderer.invoke('courses:delete', id),
  },
  lessons: {
    listByCourse: (courseId) => ipcRenderer.invoke('lessons:listByCourse', courseId),
    listAll: (status) => ipcRenderer.invoke('lessons:listAll', status),
    get: (id) => ipcRenderer.invoke('lessons:get', id),
    update: (id, input) => ipcRenderer.invoke('lessons:update', id, input),
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (key, value) => ipcRenderer.invoke('settings:set', key, value),
  },
  backup: {
    export: () => ipcRenderer.invoke('backup:export'),
    import: () => ipcRenderer.invoke('backup:import'),
  },
  studyStats: {
    export: () => ipcRenderer.invoke('data:exportStudyStats'),
  },
});
