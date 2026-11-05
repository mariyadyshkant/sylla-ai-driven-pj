# Brief di progetto — Sylla

> App desktop per il tracciamento delle lezioni dei corsi seguiti.
> Stato: documento vivo, allineato all'implementazione al 2026-10-07. Le sezioni 1-5 sono decisioni "blindate"; la sezione 6 descrive le schermate così come sono state realizzate.

## 1. Obiettivo

App desktop personale per tenere traccia delle lezioni dei corsi seguiti (attualmente due, estendibile a qualunque corso futuro). Nessuna autenticazione, uso single-user, dati locali.

## 2. Stack tecnologico

- **Electron** — UI desktop cross-platform, riuso di competenze HTML/CSS/JS
- **Tailwind CSS** — stessa libreria usata nel progetto piante
- **Alpine.js** — reattività leggera, niente framework pesanti
- **SQLite** (`better-sqlite3`) — storage locale su file
- **whisper.cpp** (modelli tiny, base, small o medium, scaricati al primo utilizzo) + **ffmpeg** — trascrizione locale offline, gratuita. I binari non sono inclusi nell'app: vengono cercati nel sistema (`PATH`, cartelle di Homebrew) o indicati con variabili d'ambiente
- **pdf-parse** — estrazione locale del testo dalle slide PDF allegate alle lezioni, in JavaScript e senza binari esterni
- Chiamata a un'API AI esterna (**Claude Haiku**) solo per la pulizia della trascrizione e per l'elaborazione opzionale in note — richiede una API key personale, costo minimo per chiamata

## 3. Modello dati

### Corso

| Campo                         | Note                                                     |
| ----------------------------- | -------------------------------------------------------- |
| nome                          |                                                          |
| docente                       |                                                          |
| durata                        | ore totali                                               |
| data inizio                   | usata per generare il calendario lezioni                 |
| data fine                     | usata per generare il calendario lezioni                 |
| orario settimanale ricorrente | uno o più slot: giorno della settimana + ora inizio/fine |
| stato                         | attivo / archiviato                                      |

CRUD completo: corsi aggiungibili/modificabili/eliminabili liberamente, in vista di corsi futuri. Un corso archiviato resta nel database (con le sue lezioni) ma non appare più nella sidebar/dashboard attiva — consultabile dalla sezione Archivio (vedi 6.2).

### Lezione

| Campo                        | Note                                                                  |
| ---------------------------- | --------------------------------------------------------------------- |
| corso di riferimento         |                                                                       |
| data/ora                     | derivata dallo slot ricorrente del corso                              |
| stato                        | _programmata_ (generata dal calendario, vuota) → _svolta_ (compilata) |
| argomento/contenuti trattati | testo libero                                                          |
| materiali e link             | slide, dispense — lista, non singolo campo                            |
| note libere                  | testo libero                                                          |
| link alla registrazione      | solo riferimento, non usato per download automatico                   |
| slide (PDF)                  | percorso di un PDF allegato, aperto in una finestra separata (vedi 5b) |
| trascrizione                 | generata localmente da file caricato, poi ripulita con Haiku (vedi 5) |
| note elaborate (AI)          | generate su richiesta dalla trascrizione e dalle slide                |

## 4. Generazione automatica del calendario

Alla creazione/modifica di un corso con orario ricorrente + date inizio/fine, l'app genera automaticamente tutte le occorrenze di Lezione nel periodo, in stato "programmata". Si "compilano" man mano che le lezioni si svolgono davvero.

## 5. Flusso trascrizione/elaborazione

Il download automatico dal link alla registrazione non è previsto (richiederebbe gestire il login delle piattaforme universitarie — troppo fragile). Flusso scelto:

1. Caricamento manuale del file audio/video della lezione registrata
2. Estrazione audio (ffmpeg) e trascrizione locale (whisper.cpp) — gratis, offline
3. Pulizia con Claude Haiku (solo se è configurata una API key): aggiunge punteggiatura, divide in paragrafi e corregge gli errori di riconoscimento evidenti, senza cambiare il contenuto. Lavora a pezzi, scarta un risultato troppo diverso dall'originale (riassunto o troncamento) e, se fallisce, lascia il testo grezzo
4. Trascrizione salvata come testo nella lezione: il testo migliorato prende il posto di quello grezzo, un badge "trascrizione migliorata" lo segnala e l'output originale di whisper resta conservato ("Ripristina originale"). Senza API key resta il testo grezzo, interamente locale
5. Pulsante opzionale "Elabora in note": invia la trascrizione (e, se allegate, le slide — vedi 5b) a un'API AI per generare un riassunto strutturato (richiede API key propria, costo minimo). Se la trascrizione non risulta già migliorata, la pulizia avviene in quel momento, solo come contesto e senza salvarla

Eventuale miglioria futura: tentare il download automatico dal link, valutato piattaforma per piattaforma.

## 5b. Flusso slide PDF

Ogni lezione può avere un PDF di slide allegato. Flusso scelto:

1. Pulsante "Allega slide (PDF)" nella finestra della lezione: si sceglie il file con un dialog di sistema
2. Nel database si salva solo il percorso del file (`slides_path`), non una copia: la lezione mostra il nome del file con "Apri slide", "Cambia" e "Rimuovi"
3. "Apri slide" apre una finestra separata di 900×700 (`slides-viewer.html`) con il visualizzatore PDF integrato
4. Alla generazione delle note, il testo viene estratto in locale con `pdf-parse` (fino a 60.000 caratteri) e aggiunto al prompt dell'AI dopo la trascrizione, con il prefisso `CONTENUTO SLIDE`
5. Se il PDF è fatto di immagini e non ha testo (per esempio una scansione), viene inviato all'API come documento (fino a 100 pagine e 20 MB); se è troppo grande o non si riesce a leggere, le note si generano dalla sola trascrizione e compare un avviso. Se il file è stato spostato, "Apri slide" lo segnala

## 6. Schermate

### 6.1 Dashboard e navigazione — DEFINITA

Layout a tre zone, ispirato a un mockup Canva fornito da Mariya:

- **Sidebar sinistra**: in alto l'elenco corsi ("I miei corsi") + pulsante "+ Aggiungi corso". Cliccando su un corso si espande un sottomenu con 3 voci: **Dettagli**, **Lezioni**, **Calendario**. In basso, tre pulsanti fissi sempre visibili: **Dashboard**, **Archivio**, **Impostazioni**
- **Area centrale dinamica**: di default mostra la Dashboard generale (calendario mensile + agenda settimanale, tutti i corsi insieme). Cliccando una voce del sottomenu di un corso, il contenuto centrale viene **sostituito** dalla vista corrispondente (Dettagli / Lezioni / Calendario di quel corso); si torna alla vista generale tramite il pulsante "Dashboard" in basso nella sidebar
- **Calendario mensile** (vista generale): riquadri giorno compatti, numero grande centrato, indicatore visivo (punto/colore) sui giorni con lezioni programmate. Navigabile per mese con freccie ← →. Texture/decorazione nei riquadri da definire in fase di styling
- **Agenda settimanale** (vista generale, sotto il calendario): lista delle lezioni della settimana corrente, con scorrimento per passare da una settimana all'altra. Le settimane sono raggruppate per mese. Navigazione indipendente da quella del calendario sopra
- **Header**: include un'immagine di sfondo dietro al titolo dell'app "Sylla", personalizzabile dalle Impostazioni (sezione Personalizzazione); caricandone una nuova sostituisce la precedente
- **Calendario del singolo corso**: stesso layout di calendario mensile + agenda settimanale della vista generale, ma filtrato solo sulle lezioni di quel corso
- **Footer**: frase motivazionale impostata manualmente da Mariya dalle Impostazioni (sezione Personalizzazione) — non è una lista che ruota automaticamente, è un valore unico: scrivendone una nuova sostituisce quella precedente
- Rimossa la sezione board/kanban (Not Started/In Progress/Done) presente nel mockup originale, non rilevante per l'app

### 6.2 Sotto-schermate da definire (una alla volta)

- [x] Calendario del corso — riusa il layout della dashboard generale, filtrato
- [x] Dettagli corso — vedi 6.3
- [x] Lezioni del corso — vedi 6.4
- [x] Form "+ Aggiungi corso" — vedi 6.5
- [x] Archivio — vedi 6.6
- [x] Impostazioni — vedi 6.7
- [x] Form compilazione lezione — vedi 6.8

### 6.3 Dettagli corso — DEFINITA

- Vista dei campi del corso (nome, docente, durata, date inizio/fine, orario settimanale ricorrente)
- Pulsante "Modifica" → rende tutti i campi editabili inline (poi Salva/Annulla)
- Nessun riepilogo o statistiche in questa schermata
- Pulsante "Elimina corso":
  1. Chiede conferma esplicita
  2. Se il corso ha lezioni "svolte" (compilate), chiede cosa farne:
     - **Elimina**: cancellazione definitiva di corso + tutte le lezioni (comprese quelle svolte)
     - **Archivia**: il corso passa a stato "archiviato" — sparisce da sidebar/dashboard attiva, ma resta nel database con le lezioni intatte, consultabile dall'Archivio
  3. Le lezioni "programmate" (ancora vuote) vengono sempre eliminate insieme al corso

### 6.4 Lezioni del corso — DEFINITA

- Lista organizzata per settimana: ogni settimana ha un'intestazione "Settimana N" con una linea sottostante
- Sotto ogni intestazione, riquadri di circa 200×120 px con angoli arrotondati, uno per lezione, in ordine di data. Ogni riquadro mostra: il **numero della lezione** (grande, in alto a sinistra, progressivo su tutto il corso e non per settimana), la **data** (es. "MER 16 SET"), l'**argomento** troncato a 2 righe con puntini di sospensione, oppure il testo grigio "Lezione non ancora compilata" se manca
- Lo stato è indicato da un bordo sinistro e da un pallino colorati, con uno sfondo leggermente tinto (passando il mouse compare la dicitura dello stato):
  - Programmata (futura, non ancora svolta) — grigio
  - Passata ma non compilata (la data è passata e la lezione non è stata segnata come svolta) — ambra, segnala che va compilata
  - Svolta e compilata — verde
- Cliccando un riquadro si apre il **form di compilazione lezione** in una finestra separata (vedi prossima sotto-schermata)

### 6.5 Form "+ Aggiungi corso" — DEFINITA

- Sostituisce l'area centrale (stessa logica di navigazione delle altre schermate), niente modale
- Campi: nome, docente, durata (ore totali), data inizio, data fine
- Orario settimanale ricorrente: pulsante "+ Aggiungi slot" per inserire più combinazioni giorno+orario (es. Lun 10-12 e Mer 14-16), dato che alcuni corsi si tengono più volte a settimana in giorni diversi
- Se uno slot orario si sovrappone con quello di un corso già esistente, viene mostrato un avviso ma è comunque possibile salvare (può succedere di seguire corsi in parallelo, es. tramite registrazione)
- Al salvataggio, generazione automatica di tutte le Lezioni "programmate" nel periodo (vedi sezione 4)

### 6.6 Archivio — DEFINITA

- Accessibile dal pulsante fisso "Archivio" in basso nella sidebar (insieme a Dashboard e Impostazioni)
- Mostra l'elenco dei corsi archiviati
- Cliccando un corso archiviato si accede allo stesso sottomenu Dettagli/Lezioni/Calendario di un corso attivo, con la stessa piena interattività (non limitata a sola consultazione)
- Azioni disponibili sul corso archiviato:
  - **Ripristina**: il corso torna attivo, riappare nella sidebar/dashboard principale
  - **Elimina definitivamente**: cancellazione permanente di corso + tutte le lezioni

### 6.7 Impostazioni — DEFINITA

Organizzata con tab/menu interno in tre sezioni:

1. **Trascrizione e AI**
   - Dimensione modello whisper: tiny, base, small o medium (dal più veloce e meno preciso al più lento e preciso); il modello si scarica al primo utilizzo
   - Lingua di trascrizione predefinita: italiano, inglese o rilevamento automatico. Va scelta in base all'audio: con una lingua sbagliata whisper produce testo senza senso
   - API key per la pulizia della trascrizione e per le note AI (campo mascherato). È salvata in chiaro nel database locale, quindi finisce anche nei backup esportati
   - I percorsi di ffmpeg e whisper.cpp non hanno un campo: si indicano con variabili d'ambiente o con le chiavi `ffmpeg_path` e `whisper_path` del database
2. **Personalizzazione**
   - Frase del footer: campo testo modificabile manualmente — la nuova frase sostituisce quella precedente, nessuna rotazione automatica
   - Immagine di sfondo dell'header: upload di un'immagine mostrata dietro al titolo "Sylla" — caricandone una nuova sostituisce la precedente
3. **Backup e dati**
   - Esporta/importa una copia del database locale (dettagli implementativi da definire in fase di sviluppo)

### 6.8 Form di compilazione lezione — DEFINITA

Finestra Electron separata (800×700, ridimensionabile, stile blocco note: sfondo chiaro, campi in colonna a piena larghezza senza card né bordi, testo in serif o monospace) che si apre cliccando un riquadro lezione da "Lezioni del corso". Per ogni lezione c'è una sola finestra: cliccarla di nuovo porta in primo piano quella aperta.

- **Intestazione fissa**: nome del corso, data/ora della lezione, interruttore "Segna come svolta" (passaggio da _programmata_ a _svolta_ — manuale, non automatico)
- **Slide** (riga fissa sotto l'intestazione): "Allega slide (PDF)"; con un PDF allegato si vedono il nome del file, "Apri slide" (finestra separata 900×700, vedi 5b), "Cambia" e "Rimuovi". L'allegato si salva subito, senza premere "Salva"
- **Argomento/contenuti trattati**: testo libero
- **Materiali e link**: lista con pulsante "+ Aggiungi materiale" (stessa logica degli slot orari del corso)
- **Note libere**: testo libero
- **Link alla registrazione**: campo testo/URL, solo riferimento
- **Trascrizione**:
  - Pulsante "Carica file audio/video" → estrazione audio (ffmpeg) + trascrizione locale (whisper.cpp) in background, con indicatore di avanzamento (poi "Pulizia della trascrizione…" se c'è una API key) — si può continuare a usare l'app nel frattempo
  - Una volta pronta, il testo è mostrato in un campo editabile (per correggere eventuali errori del modello), con un badge che indica se è stato migliorato e, se sì, il link "Ripristina originale"
- **Note elaborate (AI)**:
  - Pulsante "Elabora in note" (attivo solo se esiste una trascrizione) → invia la trascrizione e, se allegate, le slide a un'API AI esterna per generare note strutturate; sotto compaiono eventuali avvisi o note sulle slide
  - Il risultato è mostrato formattato (titoli, elenchi, grassetti); il pulsante "Modifica" passa al testo Markdown editabile e "Anteprima" torna alla vista formattata
- Pulsanti fissi **Salva** (salva senza chiudere e aggiorna la lista nella finestra principale) e **Chiudi** (chiude scartando le modifiche non salvate)

---

## Brief completo

Tutte le schermate sono state definite e realizzate: l'app è funzionante e coperta da test end-to-end. Lo stato delle singole feature è nei piani in `.specs/plans/`, le decisioni nell'`ADR.md`.

_Sezione allineata all'implementazione al 2026-10-07._
