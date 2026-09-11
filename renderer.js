const WEEKDAYS = [
  { value: 1, label: 'Lunedì' },
  { value: 2, label: 'Martedì' },
  { value: 3, label: 'Mercoledì' },
  { value: 4, label: 'Giovedì' },
  { value: 5, label: 'Venerdì' },
  { value: 6, label: 'Sabato' },
  { value: 0, label: 'Domenica' },
];

function emptyCourseForm() {
  return {
    name: '',
    teacher: '',
    total_hours: '',
    start_date: '',
    end_date: '',
    slots: [{ weekday: 1, start_time: '10:00', end_time: '12:00' }],
  };
}

function emptyLessonBuffer() {
  return { id: null, date: '', start_time: '', end_time: '', status: 'programmata', topic: '', notes: '', recording_link: '', materials: [] };
}

function startOfWeek(date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // 0 = lunedì
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function appFactory() {
  return {
    weekdays: WEEKDAYS,
    view: 'dashboard',
    menu: 'dashboard',

    courses: [],
    archivedCourses: [],
    selectedCourse: null,
    submenuOpenId: null,

    lessons: [],
    allLessons: [],

    settings: { footer_text: '', header_image: '' },
    settingsTab: 'personalizzazione',
    footerDraft: '',
    backupMessage: '',

    courseForm: emptyCourseForm(),
    overlapWarning: null,
    courseEditing: false,
    courseEditForm: emptyCourseForm(),
    deleteStage: null,

    showLessonModal: false,
    editingLesson: emptyLessonBuffer(),

    calendarDate: new Date(),
    weekOffset: 0,

    async init() {
      this.settings = await window.api.settings.get();
      this.footerDraft = this.settings.footer_text || '';
      await this.refreshCourses();
      await this.refreshAllLessons();
    },

    async refreshCourses() {
      this.courses = await window.api.courses.list('active');
    },

    async refreshArchivedCourses() {
      this.archivedCourses = await window.api.courses.list('archived');
    },

    async refreshAllLessons() {
      this.allLessons = await window.api.lessons.listAll();
    },

    // ---- navigation ----

    goDashboard() {
      this.view = 'dashboard';
      this.menu = 'dashboard';
      this.selectedCourse = null;
      this.calendarDate = new Date();
    },

    async goArchive() {
      this.view = 'archive';
      this.menu = 'archive';
      this.selectedCourse = null;
      await this.refreshArchivedCourses();
    },

    goSettings() {
      this.view = 'settings';
      this.menu = 'settings';
      this.selectedCourse = null;
    },

    toggleSubmenu(course) {
      this.submenuOpenId = this.submenuOpenId === course.id ? null : course.id;
    },

    async selectCourse(course, subview) {
      this.selectedCourse = course;
      this.submenuOpenId = course.id;
      this.menu = 'dashboard';
      this.deleteStage = null;
      this.courseEditing = false;
      this.view = subview;
      if (subview === 'courseLessons' || subview === 'courseCalendar') {
        this.lessons = await window.api.lessons.listByCourse(course.id);
      }
      if (subview === 'courseCalendar') {
        this.calendarDate = new Date(course.start_date + 'T00:00:00');
      }
    },

    // ---- gestione corso ----

    openAddCourse() {
      this.courseForm = emptyCourseForm();
      this.overlapWarning = null;
      this.selectedCourse = null;
      this.submenuOpenId = null;
      this.menu = 'dashboard';
      this.view = 'addCourse';
    },

    addSlot(form) {
      form.slots.push({ weekday: 1, start_time: '10:00', end_time: '12:00' });
    },

    removeSlot(form, index) {
      form.slots.splice(index, 1);
    },

    async submitAddCourse() {
      const { course, overlap } = await window.api.courses.create(plain(this.courseForm));
      this.overlapWarning = overlap;
      await this.refreshCourses();
      await this.refreshAllLessons();
      await this.selectCourse(course, 'courseDetails');
    },

    startEditCourse() {
      this.courseEditForm = {
        name: this.selectedCourse.name,
        teacher: this.selectedCourse.teacher,
        total_hours: this.selectedCourse.total_hours,
        start_date: this.selectedCourse.start_date,
        end_date: this.selectedCourse.end_date,
        slots: this.selectedCourse.slots.map((s) => ({ ...s })),
      };
      this.courseEditing = true;
    },

    cancelEditCourse() {
      this.courseEditing = false;
    },

    async saveEditCourse() {
      const { course, overlap } = await window.api.courses.update(this.selectedCourse.id, plain(this.courseEditForm));
      this.overlapWarning = overlap;
      this.courseEditing = false;
      this.selectedCourse = course;
      await this.refreshCourses();
      await this.refreshAllLessons();
      const idx = this.courses.findIndex((c) => c.id === course.id);
      if (idx === -1) await this.refreshArchivedCourses();
    },

    hasCompletedLessons() {
      return this.lessons.some((l) => l.status === 'svolta');
    },

    async loadLessonsForSelected() {
      this.lessons = await window.api.lessons.listByCourse(this.selectedCourse.id);
    },

    async requestDeleteCourse() {
      await this.loadLessonsForSelected();
      this.deleteStage = this.hasCompletedLessons() ? 'choose' : 'confirm';
    },

    cancelDelete() {
      this.deleteStage = null;
    },

    async confirmDeleteCourse() {
      await window.api.courses.delete(this.selectedCourse.id);
      await this.afterCourseRemoved();
    },

    async archiveCourseAction() {
      await window.api.courses.archive(this.selectedCourse.id);
      await this.afterCourseRemoved();
    },

    async afterCourseRemoved() {
      this.deleteStage = null;
      await this.refreshCourses();
      await this.refreshAllLessons();
      this.goDashboard();
    },

    async restoreCourseAction(course) {
      await window.api.courses.restore(course.id);
      await this.refreshCourses();
      await this.refreshArchivedCourses();
      await this.refreshAllLessons();
    },

    async deleteArchivedCourse(course) {
      await window.api.courses.delete(course.id);
      await this.refreshArchivedCourses();
    },

    // ---- gestione lezioni ----

    weeksGrouped() {
      if (!this.selectedCourse) return [];
      const start = new Date(this.selectedCourse.start_date + 'T00:00:00');
      const groups = new Map();
      for (const lesson of this.lessons) {
        const d = new Date(lesson.date + 'T00:00:00');
        const diffDays = Math.floor((startOfWeek(d) - startOfWeek(start)) / (1000 * 60 * 60 * 24));
        const week = Math.floor(diffDays / 7) + 1;
        if (!groups.has(week)) groups.set(week, []);
        groups.get(week).push(lesson);
      }
      return [...groups.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([week, lessons]) => ({ week, lessons }));
    },

    lessonStatusClass(lesson) {
      if (lesson.status === 'svolta') return 'bg-emerald-100 border-emerald-300 text-emerald-800';
      const today = toISODate(new Date());
      if (lesson.date < today) return 'bg-amber-100 border-amber-300 text-amber-800';
      return 'bg-[#fbf9f3] border-slate-200 text-slate-600';
    },

    openLessonModal(lesson) {
      this.editingLesson = {
        id: lesson.id,
        date: lesson.date,
        start_time: lesson.start_time,
        end_time: lesson.end_time,
        status: lesson.status,
        topic: lesson.topic || '',
        notes: lesson.notes || '',
        recording_link: lesson.recording_link || '',
        materials: (lesson.materials || []).map((m) => ({ ...m })),
      };
      this.showLessonModal = true;
    },

    closeLessonModal() {
      this.showLessonModal = false;
    },

    addMaterial() {
      this.editingLesson.materials.push({ label: '', url: '' });
    },

    removeMaterial(index) {
      this.editingLesson.materials.splice(index, 1);
    },

    async saveLesson() {
      await window.api.lessons.update(this.editingLesson.id, plain(this.editingLesson));
      this.lessons = await window.api.lessons.listByCourse(this.selectedCourse.id);
      await this.refreshAllLessons();
      this.showLessonModal = false;
    },

    // ---- calendario ----

    calendarSource() {
      return this.view === 'courseCalendar' ? this.lessons : this.allLessons;
    },

    calendarMonthLabel() {
      return this.calendarDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
    },

    prevMonth() {
      const d = new Date(this.calendarDate);
      d.setMonth(d.getMonth() - 1);
      this.calendarDate = d;
    },

    nextMonth() {
      const d = new Date(this.calendarDate);
      d.setMonth(d.getMonth() + 1);
      this.calendarDate = d;
    },

    calendarDays() {
      const year = this.calendarDate.getFullYear();
      const month = this.calendarDate.getMonth();
      const first = new Date(year, month, 1);
      const startPad = (first.getDay() + 6) % 7; // lunedì = 0
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const lessonDates = new Set(this.calendarSource().map((l) => l.date));

      const days = [];
      for (let i = 0; i < startPad; i++) days.push(null);
      for (let day = 1; day <= daysInMonth; day++) {
        const iso = toISODate(new Date(year, month, day));
        days.push({ day, iso, hasLesson: lessonDates.has(iso) });
      }
      return days;
    },

    // ---- agenda settimanale ----

    weekRangeLabel() {
      const start = this.currentWeekStart();
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      const fmt = (d) => d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
      return `${fmt(start)} — ${fmt(end)}`;
    },

    currentWeekStart() {
      const base = startOfWeek(new Date());
      base.setDate(base.getDate() + this.weekOffset * 7);
      return base;
    },

    prevWeek() {
      this.weekOffset -= 1;
    },

    nextWeek() {
      this.weekOffset += 1;
    },

    currentWeekLessons() {
      const start = this.currentWeekStart();
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      const startIso = toISODate(start);
      const endIso = toISODate(end);
      return this.allLessons
        .filter((l) => l.date >= startIso && l.date < endIso)
        .sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time));
    },

    courseName(courseId) {
      const c = this.courses.find((c) => c.id === courseId);
      return c ? c.name : '';
    },

    // ---- impostazioni ----

    async saveFooter() {
      this.settings = await window.api.settings.set('footer_text', this.footerDraft);
    },

    onHeaderImageChange(event) {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        this.settings = await window.api.settings.set('header_image', reader.result);
      };
      reader.readAsDataURL(file);
    },

    async exportBackup() {
      const result = await window.api.backup.export();
      this.backupMessage = result.canceled ? '' : `Backup esportato in ${result.path}`;
    },

    async importBackup() {
      const result = await window.api.backup.import();
      if (!result.canceled) {
        this.backupMessage = 'Database importato correttamente.';
        this.settings = await window.api.settings.get();
        this.footerDraft = this.settings.footer_text || '';
        await this.refreshCourses();
        await this.refreshAllLessons();
      }
    },
  };
}

document.addEventListener('alpine:init', () => {
  Alpine.data('app', appFactory);
});
