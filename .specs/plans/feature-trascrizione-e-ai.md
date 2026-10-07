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
- Eventuale integrazione API esterna

## Output atteso

- Upload file audio/video funzionante
- Estrazione audio e trascrizione locale in background
- Salvataggio della trascrizione nella lezione
- Pulsante per generare note AI opzionali

## Status

[x] Completata

Completata il: 2026-10-02
Note: `transcription.js` (ffmpeg → wav 16 kHz → whisper.cpp, progresso via `-pp`, modello scaricato al primo uso in `userData/models`) e `ai-notes.js` (API Claude, solo su richiesta). Binari cercati in PATH e cartelle brew, con override da env/impostazioni (`ffmpeg_path`, `whisper_path`). Job in background nel main process, avanzamento via evento `transcription:progress`. Colonne `transcript` e `ai_notes` su `lessons` (migrazione ALTER). Test con binari e server AI finti in `tests/trascrizione-e-ai.spec.js`; non verificata con ffmpeg/whisper.cpp reali. Packaging/bundling dei binari fuori scope.
