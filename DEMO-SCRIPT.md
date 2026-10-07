# Demo Day — Sylla

## 1. Cos'è (30 sec)
Sylla è un'app desktop personale per tracciare le lezioni dei corsi seguiti.
Gestisce corsi con orari ricorrenti, genera automaticamente il calendario lezioni,
permette di compilare ogni lezione con contenuti, materiali e note,
e trascrive localmente le registrazioni audio/video senza nessun servizio cloud.

## 2. Demo live (2 min)
- Aprire l'app → mostrare dashboard con calendario mensile e agenda settimanale
- Creare un corso con slot ricorrente → mostrare le lezioni generate automaticamente
- Aprire una lezione → compilare argomento e note
- Mostrare la sezione trascrizione (upload file → whisper.cpp locale)
- Mostrare Impostazioni → API key AI per elaborazione note

## 3. ADR — decisione chiave (45 sec)
Scelta più importante: trascrizione locale con whisper.cpp + ffmpeg invece di un servizio cloud.
Motivo: l'app è single-user e i dati devono restare sulla macchina.
Un servizio cloud avrebbe richiesto autenticazione, costi per chiamata e connessione obbligatoria.
whisper.cpp gira offline, è gratuito e si integra direttamente nel processo Electron.

## 4. Brief chiave (30 sec)
Il brief più complesso: feature-trascrizione-e-ai.
Ha richiesto di coordinare tre componenti separati (ffmpeg, whisper.cpp, API AI esterna)
mantenendo l'app responsiva durante la trascrizione in background.
Il vincolo principale era non bloccare la UI durante un'operazione potenzialmente lunga.

## 5. Cosa farei diversamente (30 sec)
Partirei subito con un processo worker separato per la trascrizione invece di gestirla
nell'IPC bridge, per isolare meglio gli errori e migliorare il feedback di avanzamento.
Aggiungerei anche uno schema di migrazione SQLite fin dal primo commit,
invece di aggiungere colonne con ALTER TABLE in seguito.
