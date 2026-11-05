# Architecture Decision Record

**Progetto:** Sylla
**Data:** 2026-06-25
**Autore:** Mariya Dyshkant
**Ultimo aggiornamento:** 2026-10-07

> Questo documento è l'ADR 1, la decisione iniziale di progetto. Le decisioni successive sono numerate in fondo (ADR 2, 3 e 4).

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
- Gestione lezioni: elenco lezioni, stato programmata/svolta, compilazione contenuti, materiali, link e note, più l'allegato opzionale delle slide in PDF (aperto in una finestra separata, vedi ADR 2).
- Trascrizione e AI: upload file audio/video, estrazione audio con `ffmpeg`, trascrizione locale con `whisper.cpp`, e invio opzionale ad API AI esterna per note elaborate. Dopo la trascrizione locale, se c'è una API key, il testo viene ripulito con un passaggio intermedio (vedi ADR 3); se la lezione ha slide allegate, il loro contenuto è aggiunto al contesto delle note.
- Impostazioni e backup: configurazione modello whisper, lingua di trascrizione, API key AI, personalizzazione header/footer, export/import database.

## Decisioni architetturali

- Electron è stato scelto per permettere un'app desktop cross-platform riutilizzando HTML/CSS/JS invece di un framework nativo.
- Tailwind CSS è stato scelto come libreria di styling già familiare e per velocizzare lo sviluppo di UI con utility classes.
- Alpine.js è stato scelto come soluzione di reattività leggera per evitare framework pesanti come React o Vue.
- SQLite (`better-sqlite3`) è stato scelto per storage locale semplice e affidabile su file, adeguato all'uso single-user.
- `whisper.cpp` + `ffmpeg` sono stati scelti per garantire trascrizione offline e gratuita, evitando costi e dipendenza da servizi cloud esterni per l'elaborazione audio.
- Un'API AI esterna viene prevista solo per l'elaborazione opzionale delle note (compresa la pulizia della trascrizione che le precede, ADR 3), mantenendo il core dell'app funzionante senza di essa.
- L'estrazione del testo dalle slide PDF usa `pdf-parse` in locale (ADR 2).

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

- Tentare il download automatico della registrazione dal link, valutato piattaforma per piattaforma (Teams, Panopto, Zoom)
- Supporto multi-lingua nell'interfaccia
- Sincronizzazione opzionale del database su cloud personale (es. Dropbox, iCloud Drive)

---

## ADR 2 — `pdf-parse` per l'estrazione del testo dalle slide

**Data:** 2026-10-07 · **Stato:** implementata

### Contesto

A ogni lezione si può allegare il PDF delle slide. Il suo contenuto serve come contesto aggiuntivo per le note AI: la trascrizione da sola è spesso incompleta e piena di errori sui termini tecnici, che le slide riportano scritti correttamente.

### Decisione

Il testo si estrae in locale con `pdf-parse` v2.4.5 (basato su `pdfjs-dist`).

- **Perché in locale e in JavaScript.** Non richiede binari esterni da installare e distribuire per ogni sistema operativo, a differenza di strumenti come `pdftotext` (poppler): sono gli stessi problemi di packaging già incontrati con ffmpeg e whisper.cpp. Le dipendenze native sono precompilate.
- **Limite di lunghezza.** Il testo è troncato a 60.000 caratteri, per tenere sotto controllo il costo della chiamata all'AI.
- **Nel database** si salva solo il percorso del file (`slides_path`), non una copia: spostare o cancellare il PDF rompe l'allegato, e l'app lo segnala con un avviso.
- **Visualizzazione.** "Apri slide" mostra il PDF in una finestra separata di 900×700 (`slides-viewer.html`), con il visualizzatore PDF integrato in Chromium.
- **Quando il PDF non ha testo.** `pdf-parse` legge solo il testo, non le immagini. Un PDF scansionato o esportato come immagini non ha testo estraibile: in quel caso il PDF viene inviato all'API Claude come documento (fino a 100 pagine e 20 MB), perché il modello ne legga le pagine; la finestra della lezione lo segnala con una nota. Se supera i limiti o non è leggibile, le note si generano dalla sola trascrizione e compare un avviso. I marcatori di pagina che `pdf-parse` inserisce ("-- 1 of 11 --") non contano come testo.

### Alternative valutate

- **PDF.js direttamente:** è la libreria su cui si basa `pdf-parse`; usarla senza wrapper avrebbe richiesto più codice per lo stesso risultato.
- **OCR in cloud:** aggiungerebbe un secondo servizio esterno e il relativo costo, per un caso (slide scansionate) già coperto dall'invio del PDF all'API Claude.
- **OCR locale:** scartato per ora; eviterebbe di inviare le immagini all'esterno, ma darebbe risultati peggiori su schemi e diagrammi. Resta una possibile evoluzione.

### Conseguenze

Con slide fatte di immagini, i contenuti delle pagine lasciano la macchina, ma solo su richiesta esplicita ("Elabora in note") e con la chiave personale dell'utente, come già per la trascrizione.

---

## ADR 3 — Claude Haiku per la pulizia della trascrizione

**Data:** 2026-10-07 · **Stato:** implementata

### Contesto

L'output di whisper.cpp è senza punteggiatura, privo di paragrafi e con errori di riconoscimento vocale. Questo rende la trascrizione faticosa da leggere e peggiora la qualità delle note generate.

### Decisione

La trascrizione grezza viene passata a `claude-haiku-4-5` (veloce ed economico) con l'istruzione di aggiungere punteggiatura, dividere in paragrafi e correggere solo gli errori evidenti, senza riassumere né cambiare il contenuto. La logica è in `ai-notes.js`. Lo stesso modello, Haiku 4.5, genera poi le note: non c'è una pipeline con due modelli diversi.

- **Chiamata separata.** Si è scelta una chiamata dedicata e non un'unica richiesta che pulisce e riassume insieme, perché così il risultato si può controllare e scartare: un testo ripulito molto più corto o più lungo dell'originale (meno del 70% o più del 140%) è considerato un riassunto o un troncamento e viene ignorato.
- **A pezzi.** Le trascrizioni lunghe sono ripulite a pezzi da circa 8.000 caratteri, fino a 3 in parallelo, per non attendere una risposta unica lunghissima.
- **Quando avviene.** Nella prima versione la pulizia partiva al clic su "Elabora in note" e il testo pulito non veniva salvato. È stata spostata **al caricamento del file audio/video**, subito dopo la trascrizione locale, perché è lì che si vuole vedere il testo migliorato, e perché così la si paga una volta sola. Avviene solo se è configurata una API key: senza chiave la trascrizione resta interamente locale e grezza.
- **Cosa si salva.** Il testo migliorato prende il posto di quello grezzo nel campo "Trascrizione" (che resta modificabile) e l'output originale di whisper è conservato in `transcript_raw`, ripristinabile con "Ripristina originale": la pulizia non fa perdere nulla. L'esito (pezzi ripuliti su totali) è in `transcript_cleanup` e un badge lo mostra accanto alla trascrizione.
- **Fallback.** Ogni errore ricade sul testo grezzo (per pezzo), quindi la pulizia non può mai bloccare né la trascrizione né le note. Se la trascrizione non risulta migliorata (nessuna chiave al caricamento, pulizia fallita, testo scritto a mano), "Elabora in note" la ripulisce al momento come contesto intermedio, senza salvarla; se è già migliorata non la ripulisce di nuovo.

### Alternative valutate

- **Una sola richiesta che pulisce e genera le note:** meno costosa, ma il passaggio non sarebbe controllabile né ripetibile, e la trascrizione migliorata non sarebbe disponibile da leggere.
- **Modello whisper più grande** (`small`, `medium`): migliora il riconoscimento ma non aggiunge punteggiatura né paragrafi, ed è più lento.
- **Un modello più potente per le note:** possibile evoluzione (un modello veloce per la forma, uno più capace per il ragionamento); oggi entrambi i passaggi usano Haiku.

### Conseguenze

Una chiamata in più per ogni trascrizione: circa 5-15 secondi in più su una trascrizione di qualche migliaio di caratteri, con costo contenuto grazie al modello scelto. Il testo trascritto viene inviato a un servizio esterno, ma solo se l'utente ha configurato la propria API key.

---

## ADR 4 — Netlify Forms per la raccolta delle email prima del download

**Data:** 2026-10-07 (decisione registrata) · **Stato:** decisione dell'autrice; riguarda la landing page, che vive in un repository separato non incluso qui

### Contesto

La landing page di presentazione ([sylla.mariyadyshkant.com](https://sylla.mariyadyshkant.com)) deve raccogliere l'indirizzo email di chi scarica l'app, senza costruire e mantenere un backend dedicato.

### Decisione

Prima del download si mostra un modal con un campo email; l'invio avviene con **Netlify Forms** e il download parte automaticamente dopo l'invio.

### Alternative valutate

- **Supabase:** richiederebbe un database, le relative regole di accesso e la gestione delle chiavi, cioè un backend da progettare e mantenere.
- **Formspree:** è un altro servizio esterno da configurare e tenere allineato, quando Netlify Forms è già disponibile per i siti ospitati su Netlify.

### Conseguenze

- Zero backend da gestire.
- Il piano gratuito prevede 100 invii al mese (limite da ricontrollare sul piano Netlify in uso, perché i piani possono cambiare); oltre quella soglia il modulo smette di raccogliere finché non si passa a un piano superiore.
- Le email restano nel servizio Netlify, fuori dall'app: Sylla stessa non raccoglie dati, coerentemente con il vincolo "dati locali, nessuna autenticazione".
