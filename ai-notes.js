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

// Estrae il testo da un PDF. pdf-parse è caricato solo qui: serve unicamente se ci sono slide allegate.
async function extractSlidesText(slidesPath) {
  const { PDFParse } = require('pdf-parse');
  const parser = new PDFParse({ data: fs.readFileSync(slidesPath) });
  try {
    const { text } = await parser.getText();
    return text.trim();
  } finally {
    await parser.destroy();
  }
}

// Ritorna { notes, slidesWarning }: se le slide non si leggono, le note si generano comunque dalla sola trascrizione.
async function generateNotes({ transcript, topic, apiKey, slidesPath }) {
  if (!apiKey) throw new Error('API key mancante: inseriscila in Impostazioni → Trascrizione e AI.');
  if (!transcript || !transcript.trim()) throw new Error('Nessuna trascrizione da elaborare.');

  let slidesText = '';
  let slidesWarning = '';
  if (slidesPath) {
    try {
      slidesText = await extractSlidesText(slidesPath);
      if (!slidesText) slidesWarning = 'Le slide allegate non contengono testo estraibile (forse sono immagini): le note usano solo la trascrizione.';
    } catch (err) {
      slidesWarning = `Impossibile leggere le slide allegate (${err.code === 'ENOENT' ? 'file non trovato' : err.message}): le note usano solo la trascrizione.`;
    }
  }
  if (slidesText.length > MAX_SLIDES_CHARS) slidesText = slidesText.slice(0, MAX_SLIDES_CHARS);

  const userContent =
    (topic ? `Argomento dichiarato: ${topic}\n\n` : '') +
    `Trascrizione:\n${transcript}` +
    (slidesText ? `\n\n---\nCONTENUTO SLIDE:\n${slidesText}` : '');
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
  return { notes, slidesWarning };
}

module.exports = { generateNotes, extractSlidesText };
