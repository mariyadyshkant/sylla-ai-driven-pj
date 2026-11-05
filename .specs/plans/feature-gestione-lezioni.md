# Feature: Gestione lezioni

## Obiettivo

Implementare l'elenco delle lezioni, lo stato programmata/svolta, la compilazione dei contenuti, i materiali, i link e le note.

## Dipendenze

- Generazione calendario lezioni
- Gestione corso

## Stack

- HTML/CSS/Tailwind
- Alpine.js
- SQLite (`better-sqlite3`)

## Output atteso

- Visualizzazione delle lezioni organizzate per settimana, con riquadri numerati (data, argomento, stato)
- Stato delle lezioni rappresentato con colori
- Finestra separata (stile blocco note) per compilare le informazioni della lezione
- Persistenza dei dati delle lezioni

## Status

[x] Completata

Completata il: 2026-09-11 (aggiornata il 2026-10-07)
Note: lezioni raggruppate per settimana, riquadri colorati per stato (programmata/passata non compilata/svolta) e compilazione (argomento, materiali, note, link registrazione, switch "segna come svolta"). Upload audio/video e note AI sono in feature-trascrizione-e-ai.md. Aggiornamenti del 2026-10-07: il modale è stato sostituito da una finestra Electron separata 800×700 (`lesson.html`, `lesson.js`) con intestazione e pulsanti Salva/Chiudi fissi; la finestra principale si aggiorna con l'evento `lessons:changed`. I riquadri (200×120) mostrano numero progressivo sul corso, data, argomento troncato a 2 righe (o "Lezione non ancora compilata") e stato con bordo e pallino colorati. Le note AI sono mostrate in anteprima Markdown con pulsante per modificarle. Allegato slide in feature-slide-pdf.md.
