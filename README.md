# Sylla

App desktop per il tracciamento delle lezioni dei corsi seguiti: calendario generato automaticamente dagli orari ricorrenti, trascrizione locale delle registrazioni, slide PDF allegate alle lezioni ed elaborazione opzionale in note.

**Stato attuale: sviluppata e funzionante.** Corsi, calendario, lezioni, trascrizione, slide, note AI, impostazioni e backup sono implementati e coperti da test end-to-end; l'app si avvia da sorgente (non ci sono ancora installer). Il modello dati, l'architettura e le scelte tecniche sono documentati in questo repository. Una landing page di presentazione è disponibile su [sylla.mariyadyshkant.com](https://sylla.mariyadyshkant.com).

## Visione

Un'app desktop personale, single-user, senza autenticazione né sincronizzazione cloud, per non perdere il filo dei corsi seguiti nel tempo: cosa è stato trattato in ogni lezione, quando, con quali materiali — e, quando serve, riascoltare velocemente cosa è stato detto senza dover riguardare l'intera registrazione.

Punti fermi della visione:

- **Calendario automatico** — impostato l'orario ricorrente di un corso (es. lunedì 10-12, mercoledì 14-16) tra una data di inizio e una di fine, l'app genera da sola tutte le occorrenze delle lezioni, da compilare via via che si svolgono davvero
- **Trascrizione locale e gratuita** — whisper.cpp + ffmpeg in locale, offline, senza inviare le registrazioni a servizi terzi
- **Slide allegate** — a ogni lezione si può allegare il PDF delle slide, da aprire in una finestra separata e da usare come contesto aggiuntivo per le note
- **Elaborazione in note opzionale** — un pulsante a scelta, non automatico, invia la trascrizione (prima ripulita) a un'API AI esterna per un riassunto strutturato (richiede una API key personale)
- **Deliberatamente fuori scope** — multi-utente, sincronizzazione cloud, download automatico delle registrazioni dalle piattaforme dei corsi, board/kanban

## Funzionalità

Le sezioni sono descritte nel dettaglio in [`SYLLA-BRIEF.md`](SYLLA-BRIEF.md): modello dati di Corso e Lezione, generazione del calendario, flusso di trascrizione, e il layout a tre zone (sidebar corsi, area centrale con dashboard/calendario/agenda, header personalizzabile).

- **Corsi e calendario** — CRUD dei corsi con orario settimanale ricorrente; le lezioni programmate si generano da sole e, rigenerandole, le lezioni già svolte non vengono mai toccate né duplicate. Archivio per i corsi conclusi.
- **Lezioni** — vista per settimana con riquadri numerati (data, argomento e stato: programmata, passata da compilare, svolta). Ogni lezione si compila in una finestra separata stile blocco note: argomento, materiali, note, link alla registrazione, slide, trascrizione e note AI.
- **Trascrizione locale** — si carica un file audio/video; ffmpeg estrae l'audio e whisper.cpp trascrive in background, offline e senza costi. La trascrizione è modificabile.
- **Pulizia della trascrizione** — se è configurata una API key, subito dopo la trascrizione Claude Haiku ne migliora la punteggiatura, la divide in paragrafi e corregge gli errori di riconoscimento evidenti, senza cambiare il contenuto. Il testo migliorato prende il posto di quello grezzo, un badge "trascrizione migliorata" lo segnala e l'output originale di whisper resta conservato (pulsante "Ripristina originale"). Senza chiave, o se la pulizia fallisce, resta il testo grezzo.
- **Slide PDF allegate** — "Allega slide (PDF)" collega un PDF alla lezione (nel database resta solo il percorso del file) e "Apri slide" lo mostra in una finestra separata. Quando si generano le note, il testo delle slide (fino a 60.000 caratteri) viene aggiunto al contesto dell'AI. Se il PDF è fatto di immagini e non ha testo (per esempio una scansione), viene inviato all'AI come documento (fino a 100 pagine e 20 MB); se è troppo grande o non si riesce a leggere, le note si generano comunque dalla sola trascrizione e compare un avviso.
- **Note AI** — "Elabora in note" genera note strutturate dalla trascrizione (già migliorata) e dalle slide, se allegate. Se la trascrizione non è stata ripulita al caricamento (nessuna chiave in quel momento, pulizia fallita, testo scritto a mano), la pulizia avviene in quel momento, solo come contesto e senza modificare il testo salvato. Le note sono mostrate formattate e restano modificabili.
- **Impostazioni e backup** — modello whisper e lingua, API key, frase del footer e immagine dell'header, esportazione e importazione del database.

## Come installare

```bash
git clone https://github.com/mariyadyshkant/sylla-ai-driven-pj.git
cd sylla-ai-driven-pj
npm install     # dipendenze, compresi better-sqlite3 e pdf-parse (nessun setup aggiuntivo)
npm start       # avvia l'app
```

- **API key:** la chiave Anthropic **non** si legge da un file `.env`: si inserisce dentro l'app, in Impostazioni → Trascrizione e AI, e viene salvata nel database locale. Serve per la pulizia della trascrizione e per le note; senza chiave tutto il resto funziona.
- **Trascrizione:** servono `ffmpeg` e `whisper.cpp` (binario `whisper-cli`). L'app li cerca nel `PATH` e in `/opt/homebrew/bin`, `/usr/local/bin`; in alternativa si possono indicare con le variabili d'ambiente `SYLLA_FFMPEG_PATH` e `SYLLA_WHISPER_PATH`, oppure con le chiavi `ffmpeg_path` e `whisper_path` della tabella `settings` del database (non hanno un campo nell'interfaccia). Il modello whisper scelto in Impostazioni viene scaricato al primo utilizzo. Senza questi strumenti l'app funziona, ma la trascrizione non è disponibile.
- **Connessione:** Tailwind CSS e Alpine.js sono caricati da CDN, quindi l'interfaccia richiede una connessione internet all'avvio.
- **Test:** `npm test` esegue i test end-to-end con Playwright, con le finestre nascoste per non rubare il focus; per vederle si lancia `SYLLA_SHOW_WINDOWS=1 npm test`.

## Scelte tecniche

| Scelta                    | Perché                                                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Electron                  | UI desktop cross-platform, riuso di competenze HTML/CSS/JS                                                                           |
| Tailwind CSS + Alpine.js  | Reattività leggera senza un framework pesante                                                                                        |
| SQLite (`better-sqlite3`) | Storage locale su file, coerente con un'app single-user senza server                                                                 |
| whisper.cpp + ffmpeg      | Trascrizione locale, gratuita, offline                                                                                               |
| `pdf-parse`               | Estrazione locale del testo dalle slide PDF, in JavaScript e senza binari esterni                                                    |
| API Claude (Haiku 4.5)    | Pulizia della trascrizione e generazione delle note: un modello veloce ed economico per entrambi i passaggi, usato solo su richiesta |

Le decisioni e le alternative valutate sono in [`ADR.md`](ADR.md); il flusso agente/documento in [`AGENT-FLOW.md`](AGENT-FLOW.md) e [`AGENT.md`](AGENT.md).

## Struttura del repository

| File                                         | Contenuto                                                                                                    |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `main.js`                                    | Processo principale Electron: finestre, handler IPC, avvio della trascrizione, server locale per study-stats |
| `preload.js`                                 | Ponte sicuro (`window.api`) tra le finestre e il processo principale                                         |
| `db.js`                                      | Schema SQLite, migrazioni, accesso ai dati, generazione del calendario                                       |
| `transcription.js`                           | Pipeline ffmpeg → whisper.cpp, ricerca dei binari, download dei modelli                                      |
| `ai-notes.js`                                | Chiamate all'API Claude: pulizia della trascrizione, contesto delle slide, generazione delle note            |
| `index.html`, `renderer.js`                  | Finestra principale: sidebar, dashboard, corsi, lezioni, impostazioni                                        |
| `lesson.html`, `lesson.js`                   | Finestra di compilazione della lezione                                                                       |
| `slides-viewer.html`                         | Finestra che mostra il PDF delle slide                                                                       |
| `tests/`                                     | Test end-to-end Playwright, con helper e PDF di prova in `tests/fixtures/`                                   |
| `.specs/plans/`                              | Piani di feature con stato di avanzamento                                                                    |
| `SYLLA-BRIEF.md`, `ADR.md`, `DEMO-SCRIPT.md` | Brief di progetto, decisioni architetturali, scaletta per il Demo Day                                        |

## Prossimi sviluppi

**Pannello di ripasso** — uno spazio dedicato allo studio, in cui un modello AI genererebbe a partire dalle lezioni (trascrizione, note e slide) delle flashcard e delle domande a scelta multipla per ripassare gli argomenti di un corso. Come per le note, sarebbe un'azione a scelta e non automatica, basata sulla stessa API key personale.

## Autrice

Mariya Dyshkant
[Portfolio](https://mariyadyshkant.com) · [LinkedIn](https://linkedin.com/in/mariya-dyshkant/)
