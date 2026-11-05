# Feature: Trascrizione e AI

## Obiettivo

Supportare l'upload di file audio/video, estrarre audio con `ffmpeg`, trascrivere localmente con `whisper.cpp` e inviare le trascrizioni a un'API AI esterna per note elaborate.

## Dipendenze

- Gestione lezioni
- Electron main process / accesso filesystem

## Stack

- whisper.cpp
- ffmpeg
- Node.js / Electron main process
- API Claude (Haiku 4.5) per le note

## Output atteso

- Upload file audio/video funzionante
- Estrazione audio e trascrizione locale in background
- Salvataggio della trascrizione nella lezione
- Pulsante per generare note AI opzionali, mostrate formattate (Markdown) e modificabili

## Status

[x] Completata

Completata il: 2026-10-02
Note: `transcription.js` (ffmpeg → wav 16 kHz → whisper.cpp, progresso via `-pp`, modello scaricato al primo uso in `userData/models`) e `ai-notes.js` (API Claude, solo su richiesta). Binari cercati in PATH e cartelle brew, con override da env (`SYLLA_FFMPEG_PATH`, `SYLLA_WHISPER_PATH`) o dalle chiavi `ffmpeg_path`/`whisper_path` nelle impostazioni (senza interfaccia). Job in background nel main process, avanzamento via evento `transcription:progress`. Colonne `transcript` e `ai_notes` su `lessons` (migrazione ALTER). Verificata con ffmpeg e whisper.cpp reali (2026-10-07); i test usano binari e server AI finti (`tests/trascrizione-e-ai.spec.js`). Packaging/bundling dei binari fuori scope. La pulizia della trascrizione con Haiku è in [feature-pulizia-trascrizione.md](feature-pulizia-trascrizione.md), il contesto delle slide in [feature-slide-pdf.md](feature-slide-pdf.md). L'handler `ai:generateNotes` genera le note dalla trascrizione migliorata e, se presenti, dalle slide.
