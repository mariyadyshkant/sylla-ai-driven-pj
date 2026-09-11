# Feature: Impostazioni e backup

## Obiettivo

Implementare le impostazioni dell'app, inclusi modello whisper, lingua di trascrizione, API key AI, personalizzazione header/footer e backup del database.

## Dipendenze

- Shell dell'app e navigazione
- Database SQLite

## Stack

- HTML/CSS/Tailwind
- Alpine.js
- SQLite (`better-sqlite3`)

## Output atteso

- Sezione Impostazioni con tab interne
- Configurazione delle preferenze di trascrizione e personalizzazione
- Possibilità di esportare/importare il database locale

## Status

[x] Completata (parziale)

Completata il: 2026-09-11
Note: implementate le tab Personalizzazione (frase footer, immagine header) e Backup e dati (esporta/importa database via dialog nativi). La tab Trascrizione e AI è presente come placeholder disabilitato — quella configurazione appartiene a feature-trascrizione-e-ai.md, esplicitamente esclusa da questo giro di lavoro.
