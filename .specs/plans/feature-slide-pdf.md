# Feature: Slide PDF della lezione

## Obiettivo

Allegare a ogni lezione un PDF di slide, aprirlo in una finestra separata e usarne il contenuto come contesto aggiuntivo per le note AI.

## Dipendenze

- Gestione lezioni
- Trascrizione e AI

## Stack

- `pdf-parse` v2 (estrazione del testo in locale)
- Electron `BrowserWindow` per il visualizzatore (`slides-viewer.html`, 900×700) e dialog di selezione file
- SQLite: colonna `lessons.slides_path` (solo il percorso, nessuna copia del file)

## Output atteso

- Nella finestra della lezione, "Allega slide (PDF)" apre un dialog; con l'allegato si vedono il nome del file, "Apri slide", "Cambia" e "Rimuovi"
- "Apri slide" mostra il PDF nel visualizzatore integrato; se il file non esiste più, compare un errore
- Alla generazione delle note, il testo del PDF (fino a 60.000 caratteri) è aggiunto al prompt dopo `CONTENUTO SLIDE`
- Se il PDF non ha testo (scansione, immagini), è inviato all'API come documento (fino a 100 pagine e 20 MB); oltre i limiti o se illeggibile, le note si generano dalla sola trascrizione con un avviso

## Status

[x] Completata

Completata il: 2026-10-07
Note: canali IPC `dialog:openFile`, `lessons:updateSlides`, `slides:open`. Il primo rilascio contava i marcatori di pagina di `pdf-parse` come testo, perciò le slide-immagine arrivavano all'AI come elenco di numeri senza avviso: corretto con l'invio del PDF come documento (vedi ADR 2). Test in `tests/slide-lezione.spec.js` con PDF di prova in `tests/fixtures/`.
