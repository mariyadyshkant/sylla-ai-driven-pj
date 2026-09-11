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

- Visualizzazione delle lezioni organizzate per settimana
- Stato delle lezioni rappresentato con colori
- Modale per compilare le informazioni della lezione
- Persistenza dei dati delle lezioni

## Status

[x] Completata

Completata il: 2026-09-11
Note: lezioni raggruppate per settimana, riquadri colorati per stato (programmata/passata non compilata/svolta) e modale di compilazione (argomento, materiali, note, link registrazione, switch "segna come svolta"). Upload audio/video e note AI restano esplicitamente fuori scope (vedi feature-trascrizione-e-ai.md).
