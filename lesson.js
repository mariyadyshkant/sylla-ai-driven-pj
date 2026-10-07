function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function inlineMarkdown(escaped) {
  return escaped
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
}

// Markdown minimale (titoli, elenchi, grassetto/corsivo, codice, separatori) per le note AI.
// Il testo viene escapato prima di qualsiasi sostituzione: l'output è sicuro per x-html.
function renderMarkdown(text) {
  const out = [];
  let list = null; // 'ul' | 'ol'
  let para = [];
  const flushPara = () => {
    if (para.length) out.push(`<p>${para.join('<br>')}</p>`);
    para = [];
  };
  const closeList = () => {
    if (list) out.push(`</${list}>`);
    list = null;
  };
  for (const raw of String(text || '').split('\n')) {
    const line = escapeHtml(raw.trimEnd());
    let m;
    if (!line.trim()) {
      flushPara();
      closeList();
    } else if ((m = line.match(/^(#{1,6})\s+(.*)$/))) {
      flushPara();
      closeList();
      out.push(`<h${m[1].length}>${inlineMarkdown(m[2])}</h${m[1].length}>`);
    } else if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flushPara();
      closeList();
      out.push('<hr>');
    } else if ((m = line.match(/^\s*[-*•]\s+(.*)$/))) {
      flushPara();
      if (list !== 'ul') {
        closeList();
        out.push('<ul>');
        list = 'ul';
      }
      out.push(`<li>${inlineMarkdown(m[1])}</li>`);
    } else if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) {
      flushPara();
      if (list !== 'ol') {
        closeList();
        out.push('<ol>');
        list = 'ol';
      }
      out.push(`<li>${inlineMarkdown(m[1])}</li>`);
    } else {
      closeList();
      para.push(inlineMarkdown(line));
    }
  }
  flushPara();
  closeList();
  return out.join('');
}

function lessonEditorFactory() {
  return {
    loaded: false,
    course: null,
    lesson: { id: null, date: '', start_time: '', end_time: '', status: 'programmata', topic: '', notes: '', recording_link: '', transcript: '', ai_notes: '', materials: [] },

    savedMessage: '',
    binaries: { ffmpeg: true, whisper: true },
    transcriptionJob: null, // { state, stage, percent, error }
    aiJob: { running: false, error: '', warning: '', note: '', cleanup: null },
    slidesPath: '',
    slidesError: '',
    aiEditing: false, // false = anteprima formattata (se ci sono note), true = testo Markdown modificabile

    async init() {
      const id = Number(new URLSearchParams(location.search).get('id'));
      const lesson = await window.api.lessons.get(id);
      this.course = await window.api.courses.get(lesson.course_id);
      this.lesson = {
        id: lesson.id,
        date: lesson.date,
        start_time: lesson.start_time || '',
        end_time: lesson.end_time || '',
        status: lesson.status,
        topic: lesson.topic || '',
        notes: lesson.notes || '',
        recording_link: lesson.recording_link || '',
        transcript: lesson.transcript || '',
        ai_notes: lesson.ai_notes || '',
        materials: (lesson.materials || []).map((m) => ({ ...m })),
      };
      this.slidesPath = lesson.slides_path || '';
      document.title = `Lezione ${lesson.date} — ${this.course ? this.course.name : ''}`;
      if (await window.api.transcription.isRunning(id)) {
        this.transcriptionJob = { state: 'running', stage: 'transcribing', percent: 0 };
      }
      window.api.transcription.onProgress((p) => this.onTranscriptionProgress(p));
      this.loaded = true;
    },

    headerLine() {
      const time = this.lesson.start_time ? `${this.lesson.start_time}–${this.lesson.end_time}` : '';
      return [this.lesson.date, time].filter(Boolean).join('  ·  ');
    },

    slidesName() {
      return this.slidesPath.split(/[\\/]/).pop();
    },

    // Il percorso viene salvato subito (non serve "Salva"): è un allegato, non un testo da rivedere.
    async attachSlides() {
      this.slidesError = '';
      const result = await window.api.dialog.openFile({
        title: 'Allega slide (PDF)',
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });
      if (result.canceled) return;
      await window.api.lessons.updateSlides(this.lesson.id, result.filePath);
      this.slidesPath = result.filePath;
    },

    async openSlides() {
      const result = await window.api.slides.open(this.lesson.id);
      this.slidesError = result.opened ? '' : result.error;
    },

    async removeSlides() {
      await window.api.lessons.updateSlides(this.lesson.id, null);
      this.slidesPath = '';
      this.slidesError = '';
    },

    // Indica se la trascrizione è stata ripulita prima di generare le note (il testo salvato non cambia).
    cleanupBadge() {
      const c = this.aiJob.cleanup;
      if (!c) return null;
      if (c.cleaned === c.total) {
        return { text: '✓ trascrizione migliorata', kind: 'ok', title: 'Prima di generare le note la trascrizione è stata ripulita (punteggiatura, paragrafi, errori di riconoscimento evidenti). Il testo salvato nella lezione non è stato modificato.' };
      }
      if (c.cleaned > 0) {
        return { text: `trascrizione migliorata in parte (${c.cleaned}/${c.total})`, kind: 'partial', title: 'Alcuni pezzi della trascrizione non si sono potuti ripulire e sono stati usati come registrati. Il testo salvato non è stato modificato.' };
      }
      return { text: 'trascrizione originale usata', kind: 'none', title: 'La pulizia della trascrizione non è riuscita: le note sono state generate dal testo originale.' };
    },

    aiPreviewHtml() {
      return renderMarkdown(this.lesson.ai_notes);
    },

    showAiPreview() {
      return !this.aiEditing && Boolean(this.lesson.ai_notes.trim());
    },

    addMaterial() {
      this.lesson.materials.push({ label: '', url: '' });
    },

    removeMaterial(index) {
      this.lesson.materials.splice(index, 1);
    },

    // Salva senza chiudere: la finestra principale riceve 'lessons:changed' dal main process.
    async save() {
      await window.api.lessons.update(this.lesson.id, plain(this.lesson));
      this.savedMessage = 'Salvato';
      setTimeout(() => (this.savedMessage = ''), 2500);
    },

    close() {
      window.api.lessonWindow.close();
    },

    // ---- trascrizione e AI ----

    transcriptionRunning() {
      return Boolean(this.transcriptionJob && this.transcriptionJob.state === 'running');
    },

    transcriptionLabel() {
      const job = this.transcriptionJob;
      if (!job) return '';
      if (job.state === 'error') return job.error;
      if (job.state !== 'running') return '';
      const stages = { model: 'Download del modello', audio: 'Estrazione audio', transcribing: 'Trascrizione' };
      return `${stages[job.stage] || 'Elaborazione'}… ${job.percent || 0}%`;
    },

    async startTranscription() {
      this.binaries = await window.api.transcription.check();
      const result = await window.api.transcription.start(this.lesson.id);
      if (result.canceled) return;
      this.transcriptionJob = { state: 'running', stage: 'model', percent: 0 };
    },

    onTranscriptionProgress(p) {
      if (p.lessonId !== this.lesson.id) return;
      this.transcriptionJob = { ...this.transcriptionJob, ...p };
      if (p.state === 'done') this.lesson.transcript = p.transcript;
    },

    async generateAiNotes() {
      this.aiJob = { running: true, error: '', warning: '', note: '', cleanup: null };
      try {
        const { ai_notes, slidesWarning, slidesNote, transcriptCleanup } = await window.api.ai.generateNotes({
          lessonId: this.lesson.id,
          transcript: this.lesson.transcript,
          topic: this.lesson.topic,
        });
        this.lesson.ai_notes = ai_notes;
        this.aiEditing = false;
        this.aiJob = { running: false, error: '', warning: slidesWarning || '', note: slidesNote || '', cleanup: transcriptCleanup || null };
      } catch (err) {
        this.aiJob = { running: false, error: String(err.message || err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '') };
      }
    },
  };
}

document.addEventListener('alpine:init', () => {
  Alpine.data('lessonEditor', lessonEditorFactory);
});
