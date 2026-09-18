# Sylla

App desktop per il tracciamento delle lezioni dei corsi seguiti: calendario generato automaticamente dagli orari ricorrenti, trascrizione locale delle registrazioni ed elaborazione opzionale in note.

**Stato attuale: fase di progettazione.** Il modello dati, l'architettura e le scelte tecniche sono definiti in dettaglio nei documenti di questo repository; lo sviluppo del codice non è ancora iniziato. Una landing page di presentazione è disponibile su [sylla.mariyadyshkant.com](https://sylla.mariyadyshkant.com).

## Visione

Un'app desktop personale, single-user, senza autenticazione né sincronizzazione cloud, per non perdere il filo dei corsi seguiti nel tempo: cosa è stato trattato in ogni lezione, quando, con quali materiali — e, quando serve, riascoltare velocemente cosa è stato detto senza dover riguardare l'intera registrazione.

Punti fermi della visione:

- **Calendario automatico** — impostato l'orario ricorrente di un corso (es. lunedì 10-12, mercoledì 14-16) tra una data di inizio e una di fine, l'app genera da sola tutte le occorrenze delle lezioni, da compilare via via che si svolgono davvero
- **Trascrizione locale e gratuita** — whisper.cpp + ffmpeg in locale, offline, senza inviare le registrazioni a servizi terzi
- **Elaborazione in note opzionale** — un pulsante a scelta, non automatico, invia la trascrizione a un'API AI esterna per un riassunto strutturato (richiede una API key personale)
- **Deliberatamente fuori scope** — multi-utente, sincronizzazione cloud, download automatico delle registrazioni dalle piattaforme dei corsi, board/kanban

## Come funzionerebbe

Le sezioni sono descritte nel dettaglio in [`SYLLA-BRIEF.md`](SYLLA-BRIEF.md): modello dati di Corso e Lezione, generazione del calendario, flusso di trascrizione, e il layout a tre zone (sidebar corsi, area centrale con dashboard/calendario/agenda, header personalizzabile).

## Scelte tecniche

| Scelta | Perché |
|---|---|
| Electron | UI desktop cross-platform, riuso di competenze HTML/CSS/JS |
| Tailwind CSS + Alpine.js | Reattività leggera senza un framework pesante |
| SQLite (`better-sqlite3`) | Storage locale su file, coerente con un'app single-user senza server |
| whisper.cpp + ffmpeg | Trascrizione locale, gratuita, offline |

Le decisioni e le alternative valutate sono in [`ADR.md`](ADR.md); il flusso agente/documento in [`AGENT-FLOW.md`](AGENT-FLOW.md) e [`AGENT.md`](AGENT.md).

## Un secondo componente pianificato: statistiche di studio

Accanto all'app principale è pensato un microservizio indipendente, **[sylla-study-stats](https://github.com/mariyadyshkant/sylla-study-stats)**, che interrogherebbe un endpoint locale esposto da Sylla per calcolare quanto tempo è stato effettivamente dedicato allo studio, corso per corso, e mostrarlo in una dashboard dedicata. È il componente più avanzato lato implementazione (Python/FastAPI containerizzato), ma resta parte della stessa visione: prende senso solo una volta che l'app principale esiste ed espone i dati da cui leggere le statistiche.

## Stato attuale

Fase di progettazione: modello dati, architettura e scelte tecniche sono definite; lo sviluppo del codice dell'app principale deve ancora iniziare.

## Autrice

Mariya Dyshkant
[Portfolio](https://mariyadyshkant.com) · [LinkedIn](https://linkedin.com/in/mariya-dyshkant-45bb411ba)
