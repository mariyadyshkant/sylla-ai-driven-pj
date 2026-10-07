// Elaborazione opzionale della trascrizione in note strutturate via API Claude.
// Invocata solo su richiesta esplicita dell'utente, con la sua API key personale.
const fs = require('fs');

const API_URL = process.env.SYLLA_AI_API_URL || 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';

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

// Ritorna { notes, slidesWarning, slidesNote }: se le slide non si leggono, le note si generano comunque dalla sola trascrizione.
async function generateNotes({ transcript, topic, apiKey, slidesPath }) {
  if (!apiKey) throw new Error('API key mancante: inseriscila in Impostazioni → Trascrizione e AI.');
  if (!transcript || !transcript.trim()) throw new Error('Nessuna trascrizione da elaborare.');

  const slides = await prepareSlides(slidesPath);
  const slidesPart = slides.text
    ? `\n\n---\nCONTENUTO SLIDE:\n${slides.text}`
    : slides.pdfBase64
      ? '\n\n---\nCONTENUTO SLIDE: sono nel documento PDF allegato.'
      : '';
  const text =
    (topic ? `Argomento dichiarato: ${topic}\n\n` : '') + `Trascrizione:\n${transcript}` + slidesPart;
  const userContent = slides.pdfBase64
    ? [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: slides.pdfBase64 } },
        { type: 'text', text },
      ]
    : text;
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
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
  const notes = (data.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
  return { notes, slidesWarning: slides.warning, slidesNote: slides.note };
}

module.exports = { generateNotes, extractSlidesText };
