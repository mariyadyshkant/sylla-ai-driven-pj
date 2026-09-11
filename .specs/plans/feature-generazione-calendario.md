# Feature: Generazione calendario lezioni

## Obiettivo

Calcolare le ricorrenze settimanali tra data inizio e data fine e generare le lezioni programmate automaticamente.

## Dipendenze

- Gestione corso
- Database SQLite

## Stack

- Node.js / Electron main process
- SQLite (`better-sqlite3`)
- Javascript per la logica di calendario

## Output atteso

- Generazione automatica delle lezioni programmate quando un corso viene creato o modificato
- Stato "programmata" per tutte le lezioni iniziali
- Calcolo corretto delle occorrenze ricorrenti settimanali

## Status

[x] Completata

Completata il: 2026-09-11
Note: `db.js#generateLessons` calcola le occorrenze settimanali tra `start_date`/`end_date` per ogni slot ricorrente; invocata da `createCourse` e `updateCourse`. Le lezioni `programmata` vengono rigenerate ad ogni modifica del periodo/slot; le lezioni `svolta` non vengono mai toccate. Coperta dai test `tests/generazione-calendario.spec.js`.
