# Feature: Export dati per Sylla study-stats

## Obiettivo

Esporre in modo stabile e strutturato i dati di corsi/lezioni necessari a un microservizio esterno containerizzato ("Sylla study-stats", pattern week-6: ingest → SQLite+FTS5 → API REST → dashboard) che calcoli statistiche "quanto ho studiato", senza violare i vincoli ADR (nessuna rete diretta verso il processo Electron, nessuna dipendenza cloud, app che resta leggera).

## Contesto

Oggi l'unico accesso ai dati (`courses`, `course_slots`, `lessons`, `lesson_materials`) avviene via IPC Electron, in-process, non raggiungibile da un container esterno. L'unico export esistente (`backup:export`) copia l'intero file `.db` in modo manuale e non è pensato per essere consumato da un altro servizio. Il microservizio esterno deve avere una propria fonte stabile da "ingerire", analoga a `sources.yaml` nell'esercitazione, non un accesso diretto al DB live di Electron.

## Dipendenze

- Gestione corso
- Gestione lezioni
- Generazione calendario lezioni
- Database SQLite (`db.js`)

## Stack

- Electron main process / Node.js (comando di export)
- SQLite (`better-sqlite3`) come sorgente di lettura
- JSON come formato di export (fonte "ingeribile" dal microservizio esterno, analogo a `sources.yaml`)
- Nessuna modifica allo stack del microservizio esterno (resta FastAPI + SQLite/FTS5 + dashboard, in repo/container separato)

## Design

- **Comando di export** (`data:exportStudyStats`, IPC + voce in Impostazioni): scrive un file JSON in un percorso configurabile (default: `app.getPath('userData')/exports/study-stats.json`), sovrascrivendolo ad ogni esecuzione.
- **Formato export** — array di corsi, ciascuno con le lezioni svolte:
  ```json
  {
    "generated_at": "2026-09-11T10:00:00Z",
    "courses": [
      {
        "id": 1,
        "name": "...",
        "teacher": "...",
        "total_hours": 40,
        "status": "active",
        "lessons": [
          { "date": "2026-09-08", "start_time": "09:00", "end_time": "11:00", "status": "svolta", "studied_minutes": 120 }
        ]
      }
    ]
  }
  ```
- **Campo `studied_minutes`**: calcolato da `start_time`/`end_time` per le lezioni con `status = 'svolta'` (nessuna nuova colonna richiesta in questa fase; se in futuro serve un tempo effettivo diverso dallo slot programmato, valutare una colonna dedicata su `lessons`).
- **Trigger**: esportazione manuale da Impostazioni (pulsante "Esporta dati per study-stats"), coerente con il vincolo "nessun processo automatico in background verso l'esterno".
- **Consumo lato microservizio**: uno script di ingest nel repo separato del microservizio legge questo file JSON (montato come volume Docker in sola lettura, es. `./study-stats-export.json:/data/export.json:ro`) e fa upsert nel proprio DB SQLite, esattamente come `ingest.py` fa upsert da `sources.yaml` — nessuna connessione di rete tra Electron e il container.
- **Non in scope in questa fase**: abilitare WAL mode o consentire lettura diretta del DB live di Electron da parte del container — si preferisce il file di export per mantenere il disaccoppiamento e non introdurre rischi di lock concorrente.

## Output atteso

- Comando/voce UI per generare l'export JSON in un percorso noto
- Formato dati documentato e stabile (corsi + lezioni svolte + minuti studiati)
- Percorso di export utilizzabile come volume Docker in sola lettura da un microservizio esterno
- Nessuna modifica ai vincoli ADR (no rete diretta, no auth, no cloud)

## Status

[x] Implementata (lato Electron): comando `data:exportStudyStats` (IPC + voce "Esporta dati per study-stats" in Impostazioni → Backup e dati), `db.exportStudyStats` in `db.js`, test in `tests/study-stats-export.spec.js`. Resta da creare il repo/container del microservizio esterno che ingerisce il file JSON prodotto.
