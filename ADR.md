# Architecture Decision Record

**Progetto:** Sylla
**Data:** 2026-06-25
**Autore:** 

## Decisione

Creare un'app desktop personale per tracciare le lezioni dei corsi seguiti, utilizzando Electron per l'interfaccia cross-platform, SQLite (`better-sqlite3`) per lo storage locale, Tailwind CSS per lo styling e Alpine.js per la reattività leggera. L'app deve gestire corsi, generare automaticamente il calendario delle lezioni, consentire la compilazione delle lezioni, supportare trascrizioni locali tramite `whisper.cpp` + `ffmpeg` e offrire un'elaborazione opzionale delle note tramite un'API AI esterna.

## Contesto

L'app è pensata per uso personale e single-user. Deve risolvere il problema di tenere traccia delle lezioni dei corsi seguiti, organizzare le lezioni programmate e svolte, memorizzare materiali e trascrizioni, e permettere una sintesi opzionale delle lezioni tramite AI esterna. Non è prevista autenticazione né condivisione multi-utente.

## Piattaforme scelte

- Frontend: Electron + HTML/CSS + Tailwind CSS + Alpine.js
- Backend: Electron main process / Node.js con accesso locale ai file
- Database: SQLite (`better-sqlite3`)
- Deploy: app desktop locale cross-platform (non definito cloud)

## Componenti principali

- Shell dell'app e navigazione: gestisce sidebar, dashboard generale, viste corso e impostazioni.
- Gestione corso: creazione, modifica, cancellazione, archiviazione e dettaglio dei corsi.
- Generazione calendario lezioni: calcola ricorrenze settimanali tra data inizio e data fine e genera lezioni programmate.
- Gestione lezioni: elenco lezioni, stato programmata/svolta, compilazione contenuti, materiali, link e note.
- Trascrizione e AI: upload file audio/video, estrazione audio con `ffmpeg`, trascrizione locale con `whisper.cpp`, e invio opzionale ad API AI esterna per note elaborate.
- Impostazioni e backup: configurazione modello whisper, lingua di trascrizione, API key AI, personalizzazione header/footer, export/import database.

## Decisioni architetturali

- Electron è stato scelto per permettere un'app desktop cross-platform riutilizzando HTML/CSS/JS invece di un framework nativo.
- Tailwind CSS è stato scelto come libreria di styling già familiare e per velocizzare lo sviluppo di UI con utility classes.
- Alpine.js è stato scelto come soluzione di reattività leggera per evitare framework pesanti come React o Vue.
- SQLite (`better-sqlite3`) è stato scelto per storage locale semplice e affidabile su file, adeguato all'uso single-user.
- `whisper.cpp` + `ffmpeg` sono stati scelti per garantire trascrizione offline e gratuita, evitando costi e dipendenza da servizi cloud esterni per l'elaborazione audio.
- Un'API AI esterna viene prevista solo per l'elaborazione opzionale delle note, mantenendo il core dell'app funzionante senza di essa.

## Vincoli

- Solo uso personale, dati locali, nessuna autenticazione.
- Storage locale su file con SQLite, no sync remoto.
- Nessun download automatico dalle piattaforme di registrazione.
- UX basata su una singola app desktop con interfaccia a tre zone e navigazione tramite sidebar.
- Il progetto deve restare leggero e non introdurre framework UI pesanti.

## Cosa NON è in scope

- Autenticazione multi-utente o account.
- Sincronizzazione remota o cloud storage.
- Download automatico dei contenuti dalle piattaforme di registrazione.
- Board/kanban per le lezioni.
- Funzionalità social o condivisione dei dati.

## Feature future pianificate


