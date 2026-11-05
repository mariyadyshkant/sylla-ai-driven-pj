# Demo Day — Sylla (5 minuti)

Struttura in sei blocchi, con il tempo cumulato tra parentesi. **Dico** è il parlato, **Mostro** è cosa c'è sullo schermo.
Le decisioni (ADR) e i brief si raccontano mentre l'AI lavora, così non ci sono tempi morti.

| Blocco | Durata | Fino a |
|---|---|---|
| 1. Il problema e cos'è | 30 s | 0:30 |
| 2. La landing page | 40 s | 1:10 |
| 3. Demo live | 2 min 10 s | 3:20 |
| 4. La decisione chiave (ADR) | 40 s | 4:00 |
| 5. I brief più difficili | 40 s | 4:40 |
| 6. Cosa farei diversamente e chiusura | 20 s | 5:00 |

## Prima di iniziare (checklist, 2 minuti)
- Internet attivo: la landing e l'interfaccia dell'app (Tailwind e Alpine da CDN) ne hanno bisogno
- Tab del browser già aperto sulla landing page, e Sylla già avviata con il corso "Multistack AI Developer" caricato
- API key già inserita in Impostazioni → Trascrizione e AI
- Una clip audio **breve** (1-2 minuti) pronta sul desktop. Prima della demo: modello whisper `base` e lingua **uguale a quella dell'audio** (con la lingua sbagliata whisper scrive testo senza senso; con `medium` la trascrizione è molto più lenta)
- Un PDF di slide pronto sul desktop
- Una lezione con note già generate, come piano B se la rete è lenta

## 1. Il problema e cos'è (30 sec → 0:30)
**Dico:** «Quando segui un corso per mesi, perdi il filo: cosa abbiamo fatto, quando, con quali slide, cosa ha detto il docente. Sylla è la mia app desktop personale per non perderlo.
Imposti l'orario del corso e crea da sola tutte le lezioni. Poi ogni lezione la riempi con note, slide e la trascrizione della registrazione, che si fa in locale, sul computer, senza mandare l'audio a nessuno.
E, solo se lo chiedi, l'AI trasforma tutto in note di ripasso.»

## 2. La landing page (40 sec → 1:10)
**Mostro:** il tab con [sylla.mariyadyshkant.com](https://sylla.mariyadyshkant.com); scorrere fino al pulsante di download e aprire il modulo con l'email.
**Dico:** «Questa è la pagina di presentazione. Prima del download chiedo l'email con un modulo: l'ho fatto con Netlify Forms perché così non ho dovuto costruire nessun backend. Dopo l'invio il download parte da solo.
Il prodotto vero è questo, e ve lo faccio vedere in funzione.»
*(Il modulo email è descritto nell'ADR 4; se sul sito non è ancora attivo, saltare quella frase.)*

## 3. Demo live (2 min 10 sec → 3:20)
1. **Dashboard e calendario** (15 s). **Mostro:** calendario mensile e agenda settimanale. **Dico:** «Qui vedo tutti i corsi insieme, giorno per giorno.»
2. **Lezioni del corso** (20 s). **Mostro:** il corso "Multistack AI Developer" → "Lezioni". **Dico:** «Le lezioni sono già tutte generate dall'orario ricorrente. Ogni riquadro ha il numero, la data, l'argomento e un colore: verde svolta, ambra da compilare, grigio futura.»
3. **Finestra della lezione** (15 s). **Mostro:** cliccare un riquadro: si apre la finestra separata, stile blocco note. **Dico:** «Ogni lezione si apre in una finestra sua, come un blocco note: argomento, note, link, tutto in colonna.»
4. **Trascrizione locale** (35 s). **Mostro:** "Carica file audio/video", scegliere la clip. **Dico:** «Carico la registrazione: ffmpeg e whisper trascrivono in locale, gratis e offline. Subito dopo, un passaggio AI veloce aggiunge punteggiatura e paragrafi.»
   **Mostro:** il badge "✓ trascrizione migliorata" e il link "Ripristina originale". **Dico:** «L'originale non si perde: lo ripristino quando voglio.»
5. **Slide** (20 s). **Mostro:** "Allega slide (PDF)", poi "Apri slide". **Dico:** «Allego le slide: si aprono in una finestra a parte e il loro contenuto diventa contesto per le note.»
6. **Elabora in note** (5 s per partire). **Mostro:** clic su "Elabora in note". **Dico:** «Ora lancio l'AI.» → **passare subito al blocco 4**; le note arrivano mentre parlo (da pochi secondi a circa 25).
7. **Il risultato** (a fine blocco 4, 10 s). **Mostro:** le note formattate, con titoli ed elenchi. **Dico:** «Ecco le note di ripasso: generate da trascrizione migliorata e slide.»

## 4. La decisione chiave (40 sec → 4:00) — si dice mentre l'AI lavora
**Dico:** «La decisione di cui sono più convinta è doppia.
La prima: il core è locale. Trascrizione con whisper.cpp, dati su SQLite, nessun account. L'AI è opzionale: se non c'è la chiave, l'app funziona lo stesso.
La seconda: la pipeline AI a due passaggi separati. Prima si *formatta*: un passaggio veloce ed economico ripulisce la trascrizione, senza cambiarne il contenuto. Poi si *ragiona*: le note si generano dal testo migliorato e dalle slide.
Separare i task tiene i costi bassi e ogni passaggio è controllabile: se la pulizia fallisce o restituisce qualcosa di troppo diverso dall'originale, tengo la trascrizione grezza e le note partono comunque.»
*(Oggi entrambi i passaggi usano Claude Haiku; non dire "Sonnet" a meno di aver cambiato il modello delle note.)*

## 5. I brief più difficili (40 sec → 4:40)
**Dico:** «Tre brief mi hanno dato più filo da torcere.
Uno: la finestra lezione separata. Ha richiesto IPC e BrowserWindow: la finestra principale si aggiorna da sola quando salvo.
Due: la pipeline delle slide. Scelgo il file, salvo solo il percorso, estraggo il testo con pdf-parse e lo inserisco nel prompt. Se il PDF è fatto di immagini, lo mando intero all'AI.
Tre: la pulizia della trascrizione, a pezzi, con tutti i fallback: ogni errore ricade sul testo originale.»

## 6. Cosa farei diversamente e chiusura (20 sec → 5:00)
**Dico:** «Se ricominciassi: schema di migrazione del database fin dal primo commit, invece di aggiungere colonne con ALTER TABLE; e un processo separato per la pipeline AI, per isolare meglio gli errori.
Sylla è su GitHub e sul sito: grazie!»

## Se qualcosa va storto
- **AI lenta o rete assente:** aprire la lezione con le note già generate e dire «ecco il risultato che avevo generato prima».
- **Trascrizione troppo lenta o senza senso:** controllare modello e lingua in Impostazioni; in emergenza, mostrare una lezione con trascrizione già presente.
- **Landing page non carica:** saltare il blocco 2 e recuperare i 40 secondi dando più respiro alla demo.
