// Elaborazione opzionale della trascrizione in note strutturate via API Claude.
// Invocata solo su richiesta esplicita dell'utente, con la sua API key personale.
const API_URL = process.env.SYLLA_AI_API_URL || 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';

const SYSTEM_PROMPT =
  'Sei un assistente che aiuta uno studente a ripassare. Dalla trascrizione di una lezione ' +
  'produci note strutturate in italiano: un breve riassunto, i concetti chiave come elenco puntato, ' +
  'eventuali definizioni o formule importanti, e le cose da approfondire. Non inventare contenuti ' +
  'assenti dalla trascrizione, che può contenere errori di riconoscimento vocale.';

async function generateNotes({ transcript, topic, apiKey }) {
  if (!apiKey) throw new Error('API key mancante: inseriscila in Impostazioni → Trascrizione e AI.');
  if (!transcript || !transcript.trim()) throw new Error('Nessuna trascrizione da elaborare.');

  const userContent = (topic ? `Argomento dichiarato: ${topic}\n\n` : '') + `Trascrizione:\n${transcript}`;
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
  return (data.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
}

module.exports = { generateNotes };
