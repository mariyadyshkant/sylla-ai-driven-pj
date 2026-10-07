# Demo Day — Sylla (5 minuti)

## 1. Cos'è (30 sec)
Sylla è un'app desktop personale per tracciare le lezioni dei corsi seguiti.
Gestisce corsi con orari ricorrenti, genera automaticamente il calendario lezioni,
permette di compilare ogni lezione con contenuti, materiali, note e slide in PDF,
e trascrive localmente le registrazioni audio/video senza nessun servizio cloud.
Su richiesta, trasforma la trascrizione in note strutturate con l'AI, usando anche le slide come contesto.

## 2. Demo live (2 min 30 sec)
- Aprire l'app → mostrare dashboard con calendario mensile e agenda settimanale
- Creare un corso con slot ricorrente → mostrare le lezioni generate automaticamente
- Aprire "Lezioni" del corso → riquadri numerati con data, argomento e stato a colori
- Aprire una lezione (si apre in una finestra separata, stile blocco note) → compilare argomento e note
- Mostrare la sezione trascrizione (upload file → whisper.cpp locale) → a fine trascrizione parte la pulizia automatica: badge "✓ trascrizione migliorata", testo con punteggiatura e paragrafi, e "Ripristina originale" per tornare all'output grezzo
- **Allegare le slide**: "Allega slide (PDF)" → "Apri slide" per mostrarle nella loro finestra
- Premere "Elabora in note" e, mentre lavora (circa 25 secondi), passare alla sezione ADR
- Tornare alla lezione: note formattate, generate da trascrizione migliorata e slide
- Mostrare Impostazioni → API key AI per elaborazione note

Consiglio: tenere pronta una lezione con note già generate, nel caso la rete sia lenta.

## 3. ADR — decisioni chiave (1 min)
Decisione principale: trascrizione locale con whisper.cpp + ffmpeg invece di un servizio cloud.
Motivo: l'app è single-user e i dati devono restare sulla macchina.
Un servizio cloud avrebbe richiesto autenticazione, costi per chiamata e connessione obbligatoria.
whisper.cpp gira offline, è gratuito e si integra direttamente nel processo Electron.

Due decisioni più recenti, sulla qualità delle note:
- **Pulizia della trascrizione con Haiku subito dopo whisper.** whisper restituisce testo senza punteggiatura e con errori;
  un passaggio veloce ed economico lo ripulisce senza cambiarne il contenuto, e le note partono da un testo migliore.
  L'output originale resta conservato e ripristinabile; se il passaggio fallisce o restituisce qualcosa di troppo diverso
  dall'originale (un riassunto, un troncamento), si tiene la trascrizione grezza: non può mai bloccare né trascrizione né note.
- **Slide con pdf-parse.** Il testo delle slide arricchisce il contesto delle note. pdf-parse è JavaScript
  e non richiede binari esterni da distribuire; se il PDF è fatto di immagini, viene inviato all'AI come documento.

## 4. Brief chiave (30 sec)
Il brief più complesso: feature-trascrizione-e-ai.
Ha richiesto di coordinare tre componenti separati (ffmpeg, whisper.cpp, API AI esterna)
mantenendo l'app responsiva durante la trascrizione in background.
Il vincolo principale era non bloccare la UI durante un'operazione potenzialmente lunga.
Le due estensioni successive (slide e pulizia) hanno aggiunto passaggi alla stessa catena
mantenendo la regola di fondo: ogni passaggio opzionale può fallire senza fermare gli altri.

## 5. Cosa farei diversamente (30 sec)
Partirei subito con un processo worker separato per la trascrizione invece di gestirla
nell'IPC bridge, per isolare meglio gli errori e migliorare il feedback di avanzamento.
Aggiungerei anche uno schema di migrazione SQLite fin dal primo commit,
invece di aggiungere colonne con ALTER TABLE in seguito.
Per le slide fatte di sole immagini userei un OCR locale prima di inviarle all'AI,
così i contenuti non lascerebbero la macchina.
