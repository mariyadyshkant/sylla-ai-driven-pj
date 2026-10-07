# Architecture Decision Record

**Progetto:** Sylla
**Data:** 2026-06-25
**Autore:** Mariya Dyshkant
**Ultimo aggiornamento:** 2026-10-07

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
- Gestione lezioni: elenco lezioni, stato programmata/svolta, compilazione contenuti, materiali, link e note, più l'allegato opzionale delle slide in PDF (aperto in una finestra separata).
- Trascrizione e AI: upload file audio/video, estrazione audio con `ffmpeg`, trascrizione locale con `whisper.cpp`, e invio opzionale ad API AI esterna per note elaborate. Prima delle note la trascrizione viene ripulita con un passaggio intermedio; se la lezione ha slide allegate, il loro contenuto è aggiunto al contesto.
- Impostazioni e backup: configurazione modello whisper, lingua di trascrizione, API key AI, personalizzazione header/footer, export/import database.

## Decisioni architetturali

- Electron è stato scelto per permettere un'app desktop cross-platform riutilizzando HTML/CSS/JS invece di un framework nativo.
- Tailwind CSS è stato scelto come libreria di styling già familiare e per velocizzare lo sviluppo di UI con utility classes.
- Alpine.js è stato scelto come soluzione di reattività leggera per evitare framework pesanti come React o Vue.
- SQLite (`better-sqlite3`) è stato scelto per storage locale semplice e affidabile su file, adeguato all'uso single-user.
- `whisper.cpp` + `ffmpeg` sono stati scelti per garantire trascrizione offline e gratuita, evitando costi e dipendenza da servizi cloud esterni per l'elaborazione audio.
- Un'API AI esterna viene prevista solo per l'elaborazione opzionale delle note (compresa la pulizia della trascrizione che le precede), mantenendo il core dell'app funzionante senza di essa.
- **Estrazione del testo dalle slide con `pdf-parse`** (aggiunta il 2026-10-07). Il testo del PDF allegato a una lezione serve come contesto aggiuntivo per le note AI. Si usa `pdf-parse` (basato su `pdfjs-dist`) perché è JavaScript puro con dipendenze native precompilate: non richiede binari esterni da installare e distribuire per ogni sistema operativo, a differenza di strumenti come `pdftotext` (poppler), con gli stessi problemi di packaging già incontrati per ffmpeg e whisper.cpp. Nel database si salva solo il percorso del file (`slides_path`), non una copia. Il testo è limitato a 60.000 caratteri per tenere sotto controllo il costo della chiamata. Il limite noto è che `pdf-parse` legge solo il testo, non le immagini: un PDF fatto di sole immagini (scansioni, slide esportate come foto) non ha testo estraibile e, in quel caso, il PDF viene inviato all'API come documento (fino a 100 pagine e 20 MB) perché il modello ne legga le pagine; se supera i limiti o non è leggibile le note si generano dalla sola trascrizione, con un avviso. L'alternativa scartata per ora è un OCR locale, che eviterebbe di inviare le immagini all'esterno ma darebbe risultati peggiori su schemi e diagrammi. Conseguenza sulla privacy: con slide-immagine i contenuti delle pagine lasciano la macchina, ma solo su richiesta esplicita e con la chiave personale dell'utente, come già per la trascrizione.
- **Passaggio di pulizia della trascrizione con Claude Haiku** (aggiunto il 2026-10-07). L'output di whisper.cpp è senza punteggiatura, privo di paragrafi e con errori di riconoscimento vocale, e questo peggiora la qualità delle note e la leggibilità del testo. La trascrizione grezza è passata a `claude-haiku-4-5` con l'istruzione di aggiungere punteggiatura, dividere in paragrafi e correggere solo gli errori evidenti, senza riassumere né cambiare il contenuto. Si è scelta una chiamata separata, e non un'unica richiesta che pulisce e riassume insieme, perché così il risultato si può controllare e scartare: un testo ripulito molto più corto o più lungo dell'originale (meno del 70% o più del 140%) è considerato un riassunto o un troncamento e viene ignorato. Le trascrizioni lunghe sono ripulite a pezzi da circa 8.000 caratteri, fino a 3 in parallelo, per non attendere una risposta unica lunghissima.
  - *Quando avviene.* Nella prima versione la pulizia partiva al clic su "Elabora in note" e il testo pulito non veniva salvato. È stata spostata **al caricamento del file audio/video**, subito dopo la trascrizione locale, perché è lì che l'utente si aspetta di vedere il testo migliorato, e perché così la si paga una volta sola invece che a ogni elaborazione delle note. Avviene solo se è configurata una API key: senza chiave la trascrizione resta interamente locale e grezza, coerentemente con il principio che l'AI esterna sia opzionale.
  - *Cosa si salva.* Il testo migliorato prende il posto di quello grezzo nel campo "Trascrizione" (che resta modificabile) e l'output originale di whisper è conservato in `transcript_raw`, ripristinabile con "Ripristina originale", così la pulizia non fa perdere nulla. L'esito (pezzi ripuliti su totali) è salvato in `transcript_cleanup` e mostrato con un badge accanto alla trascrizione.
  - *Fallback.* Ogni errore ricade sul testo grezzo (per pezzo), quindi la pulizia non può mai bloccare né la trascrizione né le note. Se la trascrizione non risulta migliorata (nessuna chiave al caricamento, pulizia fallita, testo scritto a mano), "Elabora in note" la ripulisce al momento come contesto intermedio, senza salvarla; se è già migliorata non la ripulisce di nuovo.
  - *Costo.* Una chiamata in più per ogni trascrizione, circa 5-15 secondi in più su una trascrizione di qualche migliaio di caratteri, con un modello veloce ed economico.

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
