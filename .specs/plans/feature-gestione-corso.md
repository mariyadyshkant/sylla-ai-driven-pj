# Feature: Gestione corso

## Obiettivo

Implementare la creazione, modifica, cancellazione, archiviazione e visualizzazione dei dettagli dei corsi.

## Dipendenze

- Shell dell'app e navigazione
- Database SQLite

## Stack

- Electron main process / Node.js
- SQLite (`better-sqlite3`)
- HTML/CSS/Tailwind
- Alpine.js

## Output atteso

- Form per aggiungere/modificare corsi
- Persistenza dei corsi in SQLite
- Possibilità di eliminare o archiviare un corso con conferme appropriate
- Visualizzazione dei campi del corso e stato attivo/archiviato

## Status

[x] Completata

Completata il: 2026-09-11
Note: CRUD completo su `db.js` (courses + course_slots) via IPC. Eliminazione con conferma; se il corso ha lezioni svolte offre la scelta Elimina/Archivia (altrimenti solo eliminazione), come da SYLLA-BRIEF.md §6.3. Archiviazione/ripristino gestiti dalla vista Archivio.
