# Sylla

App desktop per il tracciamento delle lezioni dei corsi seguiti: calendario generato automaticamente dagli orari ricorrenti, trascrizione locale delle registrazioni, slide PDF allegate alle lezioni ed elaborazione opzionale in note.

**Stato attuale: in sviluppo.** L'app desktop è funzionante (corsi, calendario, lezioni, trascrizione, slide, note AI, impostazioni e backup) ed è coperta da test end-to-end; il modello dati, l'architettura e le scelte tecniche sono documentati in questo repository. Una landing page di presentazione è disponibile su [sylla.mariyadyshkant.com](https://sylla.mariyadyshkant.com).

## Visione

Un'app desktop personale, single-user, senza autenticazione né sincronizzazione cloud, per non perdere il filo dei corsi seguiti nel tempo: cosa è stato trattato in ogni lezione, quando, con quali materiali — e, quando serve, riascoltare velocemente cosa è stato detto senza dover riguardare l'intera registrazione.

Punti fermi della visione:

- **Calendario automatico** — impostato l'orario ricorrente di un corso (es. lunedì 10-12, mercoledì 14-16) tra una data di inizio e una di fine, l'app genera da sola tutte le occorrenze delle lezioni, da compilare via via che si svolgono davvero
- **Trascrizione locale e gratuita** — whisper.cpp + ffmpeg in locale, offline, senza inviare le registrazioni a servizi terzi
- **Slide allegate** — a ogni lezione si può allegare il PDF delle slide, da aprire in una finestra separata e da usare come contesto aggiuntivo per le note
- **Elaborazione in note opzionale** — un pulsante a scelta, non automatico, invia la trascrizione (prima ripulita automaticamente) a un'API AI esterna per un riassunto strutturato (richiede una API key personale)
- **Deliberatamente fuori scope** — multi-utente, sincronizzazione cloud, download automatico delle registrazioni dalle piattaforme dei corsi, board/kanban

## Funzionalità

Le sezioni sono descritte nel dettaglio in [`SYLLA-BRIEF.md`](SYLLA-BRIEF.md): modello dati di Corso e Lezione, generazione del calendario, flusso di trascrizione, e il layout a tre zone (sidebar corsi, area centrale con dashboard/calendario/agenda, header personalizzabile).

- **Corsi e calendario** — CRUD dei corsi con orario settimanale ricorrente; le lezioni programmate si generano da sole e, rigenerandole, le lezioni già svolte non vengono mai toccate né duplicate. Archivio per i corsi conclusi.
- **Lezioni** — vista per settimana con riquadri numerati (data, argomento e stato: programmata, passata da compilare, svolta). Ogni lezione si compila in una finestra separata stile blocco note: argomento, materiali, note, link alla registrazione, trascrizione e note AI.
- **Trascrizione locale** — si carica un file audio/video; ffmpeg estrae l'audio e whisper.cpp trascrive in background, offline e senza costi. La trascrizione è modificabile. Se è configurata una API key, subito dopo la trascrizione viene ripulita in automatico da Claude Haiku (punteggiatura, paragrafi, errori di riconoscimento evidenti, senza cambiare il contenuto): il testo migliorato prende il posto di quello grezzo, un badge "trascrizione migliorata" lo segnala e l'output originale di whisper resta conservato, ripristinabile con "Ripristina originale". Senza chiave, o se la pulizia fallisce, resta il testo grezzo.
- **Slide PDF allegate** — il pulsante "Allega slide (PDF)" collega un PDF alla lezione (nel database resta solo il percorso del file) e "Apri slide" lo mostra in una finestra separata. Quando si generano le note, il testo delle slide (fino a 60.000 caratteri) viene aggiunto al contesto dell'AI. Se il PDF è fatto di immagini e non ha testo, viene inviato all'AI come documento (fino a 100 pagine e 20 MB); se è troppo grande o non si riesce a leggere, le note si generano comunque dalla sola trascrizione e compare un avviso.
- **Note AI** — "Elabora in note" genera note strutturate dalla trascrizione (già migliorata al caricamento) e dalle slide, se allegate. Se la trascrizione non è stata ripulita (nessuna chiave al momento del caricamento, pulizia fallita, testo scritto a mano), la pulizia avviene in quel momento, solo come contesto e senza modificare il testo salvato; se fallisce, si usa l'originale. Le note sono mostrate formattate e restano modificabili.
- **Impostazioni e backup** — modello whisper e lingua, API key, frase del footer e immagine dell'header, esportazione e importazione del database.
- **Statistiche di studio** — endpoint locale in sola lettura per il microservizio esterno (vedi sotto).

## Setup

```bash
npm install     # dipendenze, compresi better-sqlite3 e pdf-parse (nessun setup aggiuntivo)
npm start       # avvia l'app
npm test        # test end-to-end con Playwright
```

- **Trascrizione:** servono `ffmpeg` e `whisper.cpp` (binario `whisper-cli`). L'app li cerca nel `PATH` e in `/opt/homebrew/bin`, `/usr/local/bin`; in alternativa si possono indicare con le variabili d'ambiente `SYLLA_FFMPEG_PATH` e `SYLLA_WHISPER_PATH`. Il modello whisper scelto in Impostazioni viene scaricato al primo utilizzo. Senza questi strumenti l'app funziona, ma la trascrizione non è disponibile.
- **Note AI:** la API key Anthropic si inserisce in Impostazioni → Trascrizione e AI. Senza chiave tutto il resto funziona.
- **Connessione:** Tailwind CSS e Alpine.js sono caricati da CDN, quindi l'interfaccia richiede una connessione internet all'avvio.
- **Test:** girano con le finestre nascoste per non rubare il focus; per vederle si lancia `SYLLA_SHOW_WINDOWS=1 npm test`.

## Scelte tecniche

| Scelta | Perché |
|---|---|
| Electron | UI desktop cross-platform, riuso di competenze HTML/CSS/JS |
| Tailwind CSS + Alpine.js | Reattività leggera senza un framework pesante |
| SQLite (`better-sqlite3`) | Storage locale su file, coerente con un'app single-user senza server |
| whisper.cpp + ffmpeg | Trascrizione locale, gratuita, offline |
| pdf-parse | Estrazione del testo dalle slide PDF, in JavaScript e senza binari esterni |
| API Claude (Haiku 4.5) | Pulizia della trascrizione e generazione delle note, solo su richiesta |

Le decisioni e le alternative valutate sono in [`ADR.md`](ADR.md); il flusso agente/documento in [`AGENT-FLOW.md`](AGENT-FLOW.md) e [`AGENT.md`](AGENT.md).

## Un secondo componente: statistiche di studio

Accanto all'app principale c'è un microservizio indipendente, **[sylla-study-stats](https://github.com/mariyadyshkant/sylla-study-stats)**, che interroga l'endpoint locale esposto da Sylla (`GET /api/v1/study-stats` su `127.0.0.1:4174`, raggiungibile solo dalla stessa macchina) per calcolare quanto tempo è stato effettivamente dedicato allo studio, corso per corso, e mostrarlo in una dashboard dedicata (Python/FastAPI containerizzato).

## Stato attuale

In sviluppo: l'app principale è funzionante con tutte le sezioni descritte sopra. Restano fuori, per scelta, le voci elencate in [`ADR.md`](ADR.md) come non in scope o come funzionalità future.

## Autrice

Mariya Dyshkant
[Portfolio](https://mariyadyshkant.com) · [LinkedIn](https://linkedin.com/in/mariya-dyshkant-45bb411ba)
