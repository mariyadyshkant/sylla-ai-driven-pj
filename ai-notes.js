// Elaborazione opzionale della trascrizione in note strutturate via API Claude.
// Invocata solo su richiesta esplicita dell'utente, con la sua API key personale.
const fs = require('fs');

const API_URL = process.env.SYLLA_AI_API_URL || 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';
// Pulizia della trascrizione: stesso modello veloce ed economico delle note.
const CLEANUP_MODEL = 'claude-haiku-4-5-20251001';

const SYSTEM_PROMPT =
  'Sei un assistente che aiuta uno studente a ripassare. Dalla trascrizione di una lezione (e, se presenti, dal testo delle slide) ' +
  'produci note strutturate in italiano: un breve riassunto, i concetti chiave come elenco puntato, ' +
  'eventuali definizioni o formule importanti, e le cose da approfondire. Non inventare contenuti ' +
  'assenti dalla trascrizione e dalle slide; la trascrizione può contenere errori di riconoscimento vocale.';

// Oltre questo limite il testo delle slide viene troncato, per tenere sotto controllo il costo della chiamata.
const MAX_SLIDES_CHARS = 60000;
// L'API accetta PDF fino a 32 MB (base64 incluso) e 100 pagine.
const MAX_PDF_BYTES = 20 * 1024 * 1024;
const MAX_PDF_PAGES = 100;

// Estrae il testo da un PDF. pdf-parse è caricato solo qui: serve unicamente se ci sono slide allegate.
// I marcatori di pagina "-- 1 of 11 --" aggiunti da pdf-parse non contano come testo: un PDF fatto
// di immagini (scansioni, esportazioni come foto) restituisce quindi testo vuoto.
async function extractSlidesText(slidesPath) {
  const { PDFParse } = require('pdf-parse');
  const parser = new PDFParse({ data: fs.readFileSync(slidesPath) });
  try {
    const { total } = await parser.getInfo();
    const { text } = await parser.getText();
    return { text: text.replace(/^-- \d+ of \d+ --$/gm, '').trim(), pages: total };
  } finally {
    await parser.destroy();
  }
}

// Prepara il contesto delle slide: testo se il PDF ne ha, altrimenti il PDF stesso come documento
// (l'API legge anche le immagini delle pagine). Se non si riesce, ritorna solo un avviso.
async function prepareSlides(slidesPath) {
  const out = { text: '', pdfBase64: '', warning: '', note: '' };
  if (!slidesPath) return out;
  try {
    const { text, pages } = await extractSlidesText(slidesPath);
    if (text) {
      out.text = text.length > MAX_SLIDES_CHARS ? text.slice(0, MAX_SLIDES_CHARS) : text;
      return out;
    }
    const size = fs.statSync(slidesPath).size;
    if (pages > MAX_PDF_PAGES || size > MAX_PDF_BYTES) {
      out.warning = `Le slide non contengono testo e sono troppo grandi per essere inviate (${pages} pagine, ${(size / 1048576).toFixed(1)} MB; massimo ${MAX_PDF_PAGES} pagine e ${MAX_PDF_BYTES / 1048576} MB): le note usano solo la trascrizione.`;
      return out;
    }
    out.pdfBase64 = fs.readFileSync(slidesPath).toString('base64');
    out.note = `Le slide non contengono testo selezionabile: il PDF (${pages} pagine) è stato inviato all'AI come immagini.`;
  } catch (err) {
    out.warning = `Impossibile leggere le slide allegate (${err.code === 'ENOENT' ? 'file non trovato' : err.message}): le note usano solo la trascrizione.`;
  }
  return out;
}

const CLEANUP_PROMPT =
  'Ripulisci la trascrizione automatica di una lezione. Aggiungi la punteggiatura, dividi il testo in paragrafi ' +
  'e correggi solo gli errori di riconoscimento vocale evidenti (parole storpiate, termini tecnici spezzati o ' +
  'scambiati per parole simili). Non riassumere, non tagliare, non aggiungere nulla e non cambiare il contenuto ' +
  'o l\'ordine di ciò che è stato detto. Mantieni la lingua originale senza tradurre. Rispondi solo con il ' +
  'testo ripulito, senza commenti né introduzioni.';

// Le trascrizioni lunghe si ripuliscono a pezzi: una risposta unica per ore di lezione sarebbe lentissima.
const CLEANUP_CHUNK_CHARS = 8000;
const CLEANUP_CONCURRENCY = 3;
// Un testo ripulito molto più corto o più lungo dell'originale è un riassunto o un troncamento: si scarta.
const CLEANUP_MIN_RATIO = 0.7;
const CLEANUP_MAX_RATIO = 1.4;

async function callClaude({ apiKey, model, system, content, maxTokens }) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content }],
    }),
  });

  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.json()).error?.message || '';
    } catch {}
    throw new Error(`Errore API AI (HTTP ${res.status})${detail ? `: ${detail}` : ''}`);
  }
  const data = await res.json();
  const text = (data.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
  return { text, stopReason: data.stop_reason };
}

// Divide il testo in pezzi di circa `size` caratteri, tagliando a fine frase o a uno spazio.
function splitTranscript(text, size = CLEANUP_CHUNK_CHARS) {
  const chunks = [];
  let rest = text.trim();
  while (rest.length > size) {
    const window = rest.slice(0, size);
    let cut = Math.max(window.lastIndexOf('. '), window.lastIndexOf('? '), window.lastIndexOf('! '), window.lastIndexOf('\n'));
    if (cut < size * 0.5) cut = window.lastIndexOf(' ');
    if (cut < size * 0.5) cut = size - 1;
    chunks.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

async function cleanChunk(chunk, apiKey) {
  const { text, stopReason } = await callClaude({
    apiKey,
    model: CLEANUP_MODEL,
    system: CLEANUP_PROMPT,
    content: chunk,
    maxTokens: Math.min(32000, Math.ceil(chunk.length / 2) + 512),
  });
  const ratio = text.length / chunk.length;
  if (stopReason === 'max_tokens') throw new Error('risposta troncata');
  if (ratio < CLEANUP_MIN_RATIO || ratio > CLEANUP_MAX_RATIO) throw new Error('il testo ripulito non corrisponde all\'originale');
  return text;
}

// Non lancia mai: per ogni pezzo che non si riesce a ripulire resta il testo originale.
// Ritorna { text, cleaned, total } con il numero di pezzi ripuliti sul totale.
async function cleanTranscript(transcript, apiKey) {
  const chunks = splitTranscript(transcript);
  const results = new Array(chunks.length);
  let cleaned = 0;
  let next = 0;
  async function worker() {
    while (next < chunks.length) {
      const i = next++;
      try {
        results[i] = await cleanChunk(chunks[i], apiKey);
        cleaned++;
      } catch {
        results[i] = chunks[i];
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CLEANUP_CONCURRENCY, chunks.length) }, worker));
  return { text: results.join('\n\n'), cleaned, total: chunks.length };
}

// Ritorna { notes, slidesWarning, slidesNote, transcriptCleanup }: se le slide non si leggono, le note si generano
// comunque dalla sola trascrizione. La trascrizione ripulita serve solo come contesto: non viene salvata.
// Se la trascrizione è già stata ripulita al caricamento (`knownCleanup`), non viene ripulita di nuovo.
async function generateNotes({ transcript, topic, apiKey, slidesPath, knownCleanup }) {
  if (!apiKey) throw new Error('API key mancante: inseriscila in Impostazioni → Trascrizione e AI.');
  if (!transcript || !transcript.trim()) throw new Error('Nessuna trascrizione da elaborare.');

  const cleanup = knownCleanup ? { text: transcript, ...knownCleanup } : await cleanTranscript(transcript, apiKey);
  const slides = await prepareSlides(slidesPath);
  const slidesPart = slides.text
    ? `\n\n---\nCONTENUTO SLIDE:\n${slides.text}`
    : slides.pdfBase64
      ? '\n\n---\nCONTENUTO SLIDE: sono nel documento PDF allegato.'
      : '';
  const text =
    (topic ? `Argomento dichiarato: ${topic}\n\n` : '') + `Trascrizione:\n${cleanup.text}` + slidesPart;
  const userContent = slides.pdfBase64
    ? [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: slides.pdfBase64 } },
        { type: 'text', text },
      ]
    : text;
  const { text: notes } = await callClaude({
    apiKey,
    model: MODEL,
    system: SYSTEM_PROMPT,
    content: userContent,
    maxTokens: 4096,
  });
  return {
    notes,
    slidesWarning: slides.warning,
    slidesNote: slides.note,
    transcriptCleanup: { cleaned: cleanup.cleaned, total: cleanup.total },
  };
}

module.exports = { generateNotes, extractSlidesText, cleanTranscript, splitTranscript };
