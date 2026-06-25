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

[ ] Non iniziata
