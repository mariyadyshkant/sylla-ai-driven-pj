# Feature: Pulizia della trascrizione

## Obiettivo

Migliorare la trascrizione grezza di whisper.cpp (punteggiatura, paragrafi, errori di riconoscimento evidenti) con Claude Haiku, senza cambiarne il contenuto e senza mai bloccare né la trascrizione né le note.

## Dipendenze

- Trascrizione e AI
- API key Anthropic configurata nelle Impostazioni (senza chiave la pulizia non parte)

## Stack

- `ai-notes.js` (`cleanTranscript`, `splitTranscript`) con `claude-haiku-4-5`
- `main.js` (chiamata dopo la trascrizione), `db.js` (colonne `transcript_raw`, `transcript_cleanup`)
- `lesson.html` / `lesson.js` (badge e "Ripristina originale")

## Output atteso

- Subito dopo la trascrizione locale, se c'è una API key, il testo viene ripulito e sostituisce quello grezzo nel campo "Trascrizione"
- L'output originale di whisper resta in `transcript_raw` e si ripristina con "Ripristina originale"
- Un badge accanto alla trascrizione mostra l'esito (migliorata / in parte / pulizia non riuscita) e resta salvato con la lezione
- Le trascrizioni lunghe si ripuliscono a pezzi (~8.000 caratteri, fino a 3 in parallelo); un risultato fuori dal 70%-140% della lunghezza originale è scartato
- Ogni errore ricade sul testo grezzo, per pezzo
- "Elabora in note" non ripulisce di nuovo una trascrizione già migliorata; se non lo è, la ripulisce al momento solo come contesto, senza salvarla

## Status

[x] Completata

Completata il: 2026-10-07
Note: deviazione dal piano iniziale: la pulizia partiva al clic su "Elabora in note" e il testo pulito non veniva salvato; è stata spostata al caricamento del file, con l'originale conservato (vedi ADR 3). Test in `tests/pulizia-al-caricamento.spec.js` e `tests/pulizia-trascrizione.spec.js`, con server AI finto; verificata con whisper.cpp e API reali.
