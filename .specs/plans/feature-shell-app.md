# Feature: Shell dell'app e navigazione

## Obiettivo

Gestire la struttura principale dell'app desktop, inclusa la sidebar, la dashboard generale, le viste corso e le impostazioni.

## Dipendenze

- Architettura Electron base
- Styling con Tailwind CSS
- Reattività con Alpine.js

## Stack

- Electron
- HTML/CSS
- Tailwind CSS
- Alpine.js

## Output atteso

- Sidebar con elenco corsi e pulsanti Dashboard/Archivio/Impostazioni
- Vista centrale dinamica con contenuti sostituibili in base alla selezione
- Navigazione tra Dashboard generale, viste corso e Impostazioni

## Status

[x] Completata

Completata il: 2026-09-11
Note: sidebar con sottomenu Dettagli/Lezioni/Calendario per corso, header/footer personalizzabili da Impostazioni, router centrale unico su `view` (nessun contenuto renderizzato fuori da un `x-if`). Copre anche la vista Archivio richiesta dal brief.
