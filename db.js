const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

let db;

function dbPath() {
  if (process.env.SYLLA_DB_PATH) return process.env.SYLLA_DB_PATH;
  const { app } = require('electron');
  return path.join(app.getPath('userData'), 'sylla.db');
}

function init() {
  const file = dbPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  db = new Database(file);
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      teacher TEXT,
      total_hours REAL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS course_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      weekday INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS lessons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      start_time TEXT,
      end_time TEXT,
      status TEXT NOT NULL DEFAULT 'programmata',
      topic TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      recording_link TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS lesson_materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      url TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
  return db;
}

function getDb() {
  if (!db) init();
  return db;
}

function closeDb() {
  if (db) {
    db.close();
    db = undefined;
  }
}

// ---- courses ----

function listCourses(status) {
  const rows = getDb()
    .prepare('SELECT * FROM courses WHERE status = ? ORDER BY name COLLATE NOCASE')
    .all(status);
  return rows.map(withSlots);
}

function withSlots(course) {
  const slots = getDb()
    .prepare('SELECT * FROM course_slots WHERE course_id = ? ORDER BY weekday, start_time')
    .all(course.id);
  return { ...course, slots };
}

function getCourse(id) {
  const course = getDb().prepare('SELECT * FROM courses WHERE id = ?').get(id);
  return course ? withSlots(course) : null;
}

function findOverlappingSlot(slots, excludeCourseId) {
  const others = getDb()
    .prepare(
      `SELECT cs.* FROM course_slots cs
       JOIN courses c ON c.id = cs.course_id
       WHERE c.status = 'active' AND c.id != ?`
    )
    .all(excludeCourseId || -1);
  for (const slot of slots) {
    for (const other of others) {
      if (
        Number(other.weekday) === Number(slot.weekday) &&
        slot.start_time < other.end_time &&
        other.start_time < slot.end_time
      ) {
        return { slot, other };
      }
    }
  }
  return null;
}

function insertSlots(courseId, slots) {
  const stmt = getDb().prepare(
    'INSERT INTO course_slots (course_id, weekday, start_time, end_time) VALUES (?, ?, ?, ?)'
  );
  for (const s of slots || []) {
    stmt.run(courseId, s.weekday, s.start_time, s.end_time);
  }
}

function createCourse(input) {
  const overlap = findOverlappingSlot(input.slots || []);
  const info = getDb()
    .prepare(
      `INSERT INTO courses (name, teacher, total_hours, start_date, end_date, status)
       VALUES (?, ?, ?, ?, ?, 'active')`
    )
    .run(input.name, input.teacher || '', input.total_hours || null, input.start_date, input.end_date);
  insertSlots(info.lastInsertRowid, input.slots);
  generateLessons(info.lastInsertRowid);
  return { course: getCourse(info.lastInsertRowid), overlap: overlap ? overlap.slot : null };
}

function updateCourse(id, input) {
  const overlap = findOverlappingSlot(input.slots || [], id);
  getDb()
    .prepare(
      `UPDATE courses SET name = ?, teacher = ?, total_hours = ?, start_date = ?, end_date = ? WHERE id = ?`
    )
    .run(input.name, input.teacher || '', input.total_hours || null, input.start_date, input.end_date, id);
  getDb().prepare('DELETE FROM course_slots WHERE course_id = ?').run(id);
  insertSlots(id, input.slots);
  generateLessons(id);
  return { course: getCourse(id), overlap: overlap ? overlap.slot : null };
}

function archiveCourse(id) {
  getDb().prepare("UPDATE courses SET status = 'archived' WHERE id = ?").run(id);
  return getCourse(id);
}

function restoreCourse(id) {
  getDb().prepare("UPDATE courses SET status = 'active' WHERE id = ?").run(id);
  return getCourse(id);
}

function deleteCourseCascade(id) {
  getDb().prepare('DELETE FROM courses WHERE id = ?').run(id);
  return { deleted: true };
}

// ---- calendar generation ----

function toLocalISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function generateLessons(courseId) {
  const course = getDb().prepare('SELECT * FROM courses WHERE id = ?').get(courseId);
  if (!course) return;
  const slots = getDb().prepare('SELECT * FROM course_slots WHERE course_id = ?').all(courseId);

  getDb().prepare("DELETE FROM lessons WHERE course_id = ? AND status = 'programmata'").run(courseId);

  if (!slots.length) return;

  const start = new Date(course.start_date + 'T00:00:00');
  const end = new Date(course.end_date + 'T00:00:00');
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return;

  const insert = getDb().prepare(
    `INSERT INTO lessons (course_id, date, start_time, end_time, status) VALUES (?, ?, ?, ?, 'programmata')`
  );

  const cursor = new Date(start);
  while (cursor <= end) {
    const weekday = cursor.getDay(); // 0=domenica ... 6=sabato
    for (const slot of slots) {
      if (Number(slot.weekday) === weekday) {
        insert.run(courseId, toLocalISODate(cursor), slot.start_time, slot.end_time);
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
}

// ---- lessons ----

function listLessonsByCourse(courseId) {
  return getDb()
    .prepare('SELECT * FROM lessons WHERE course_id = ? ORDER BY date, start_time')
    .all(courseId)
    .map(withMaterials);
}

function listAllLessons(status) {
  let query = `SELECT l.* FROM lessons l JOIN courses c ON c.id = l.course_id WHERE c.status = 'active'`;
  const params = [];
  if (status) {
    query += ' AND l.status = ?';
    params.push(status);
  }
  query += ' ORDER BY l.date, l.start_time';
  return getDb().prepare(query).all(...params);
}

function withMaterials(lesson) {
  const materials = getDb()
    .prepare('SELECT * FROM lesson_materials WHERE lesson_id = ? ORDER BY id')
    .all(lesson.id);
  return { ...lesson, materials };
}

function getLesson(id) {
  const lesson = getDb().prepare('SELECT * FROM lessons WHERE id = ?').get(id);
  return lesson ? withMaterials(lesson) : null;
}

function updateLesson(id, input) {
  getDb()
    .prepare(
      `UPDATE lessons SET status = ?, topic = ?, notes = ?, recording_link = ? WHERE id = ?`
    )
    .run(input.status, input.topic || '', input.notes || '', input.recording_link || '', id);
  getDb().prepare('DELETE FROM lesson_materials WHERE lesson_id = ?').run(id);
  const stmt = getDb().prepare('INSERT INTO lesson_materials (lesson_id, label, url) VALUES (?, ?, ?)');
  for (const m of input.materials || []) {
    stmt.run(id, m.label, m.url || '');
  }
  return getLesson(id);
}

// ---- settings ----

function getSettings() {
  const rows = getDb().prepare('SELECT key, value FROM settings').all();
  const out = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

function setSetting(key, value) {
  getDb()
    .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, value);
  return getSettings();
}

// ---- backup ----

function exportBackup(destPath) {
  getDb().pragma('wal_checkpoint(FULL)');
  fs.copyFileSync(dbPath(), destPath);
  return { path: destPath };
}

function importBackup(srcPath) {
  closeDb();
  fs.copyFileSync(srcPath, dbPath());
  init();
  return { imported: true };
}

// ---- study-stats export ----

function slotMinutes(startTime, endTime) {
  if (!startTime || !endTime) return 0;
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

function exportStudyStats(destPath) {
  const courses = getDb().prepare('SELECT * FROM courses ORDER BY id').all();
  const data = {
    generated_at: new Date().toISOString(),
    courses: courses.map((course) => {
      const lessons = getDb()
        .prepare(
          `SELECT date, start_time, end_time, status FROM lessons
           WHERE course_id = ? AND status = 'svolta' ORDER BY date, start_time`
        )
        .all(course.id)
        .map((l) => ({ ...l, studied_minutes: slotMinutes(l.start_time, l.end_time) }));
      return {
        id: course.id,
        name: course.name,
        teacher: course.teacher,
        total_hours: course.total_hours,
        status: course.status,
        lessons,
      };
    }),
  };
  fs.writeFileSync(destPath, JSON.stringify(data, null, 2));
  return { path: destPath };
}

module.exports = {
  init,
  closeDb,
  dbPath,
  listCourses,
  getCourse,
  createCourse,
  updateCourse,
  archiveCourse,
  restoreCourse,
  deleteCourseCascade,
  generateLessons,
  listLessonsByCourse,
  listAllLessons,
  getLesson,
  updateLesson,
  getSettings,
  setSetting,
  exportBackup,
  importBackup,
  exportStudyStats,
};
