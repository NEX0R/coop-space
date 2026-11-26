# Prova automatica sul server (`npm run prova-server`)

Guida per gli assistenti. Leggila quando lanci la prova, quando non parte o quando la build la segnala.

Risponde senza aprire il gioco alla domanda "l'add-on si carica e i contenuti esistono?". Avvia il **Bedrock Dedicated Server** ufficiale di Mojang (un Minecraft senza schermo), con un mondo nuovo e senza esperimenti come sul telefono, e in circa 15 secondi controlla:

- gli **errori del registro dei contenuti** durante il caricamento: blocchi, oggetti e mob scartati, script che si fermano (con file e riga);
- che ogni **blocco, oggetto e mob `coop:`** dei behavior pack esista davvero nel gioco: è la prova `/give` fatta dalla console del server;
- le **prove degli script** scritte in `scripts/prove.js` (vedi "Pulsante di prova degli script" qui sotto) e gli errori degli script anche dopo l'avvio.

Cosa **non** controlla: la grafica (texture, modelli, nomi) e tutto quello che succede solo con un giocatore dentro (messaggi in chat, piazzare, usare). Quello si guarda nel gioco (`guide/prova-nel-gioco.md`).

- **Risultato**: `✓`/`✗` riga per riga. Codice 0 = superata, 1 = problemi nell'add-on (da correggere), 3 = la prova non è potuta partire (EULA mancante, download fallito, server non avviato): non è colpa dell'add-on. Il registro completo del server è in `out/prova-server.log`.
- **Sul PC** (Windows o Linux su processore x86, non sul telefono): serve l'EULA di Minecraft accettata dalla persona (`AGENTS.md`, regole tecniche). Il server si scarica da solo dal sito ufficiale la prima volta e a ogni versione nuova (circa 500 MB, in `%LOCALAPPDATA%\coop-space-server`; si può cancellare quando si vuole). Usa la porta 19432 e non compare tra i mondi in rete locale.
- **Su GitHub**: la build di ogni pull request lo lancia dopo `npm run package`, perché esiste la variabile del repository `EULA_MINECRAFT_ACCETTATA` = `true` (creata da Nexor, il proprietario). Senza variabile il passo viene saltato. Con codice 3 la build mostra un avviso e continua.
- **Dal telefono** (sessioni cloud, Ubuntu sul telefono) il comando non parte: guarda il riepilogo della build nella pull request.
- **Provare una copia**: `npm run prova-server -- --addon <cartella>` prova un'altra cartella che contiene `behavior_packs/` (utile per riprodurre un errore senza toccare `addon/`).
- Le **prove da giocatore** usano un giocatore simulato di Mojang (`@minecraft/server-gametest`) per controllare cose come usare un oggetto, consumare materiali e perdere durata. Il modulo è beta: il pack dedicato sta solo in `scripts/prove-giocatore/`, viene copiato nel server di prova e l'esperimento "Beta API" si accende solo nel suo mondo temporaneo. Non entra mai in `addon/` o nei mondi veri.
- Per aggiungere una prova: crea un file per funzione in `scripts/prove-giocatore/scripts/` (es. `scavo.js`), importa `prova` e gli aiuti da `aiuti.js` (crea giocatore con oggetto e modalità, prepara blocchi, conta blocchi e oggetti, durata in mano) e aggiungi il file agli import di `main.js`. Ogni prova prepara i suoi blocchi, fa le azioni del giocatore, controlla e lancia `throw new Error("cosa non è successo")` se qualcosa manca; il giocatore viene tolto anche se la prova fallisce. Ogni prova scrive una riga `COOP-GIOCATORE nome OK|FALLITO|SALTATO`, che entra nel riepilogo.
- **Mai attese fisse dopo un'azione**: usa `aspettaFinche(() => condizione)` di `aiuti.js`, che va avanti appena il risultato c'è (massimo 5 s). Su GitHub la macchina è lenta: un'attesa fissa può non bastare e la prova fallirebbe per caso.
- **Le proprietà del giocatore sono separate per pack** (scoperto il 26/11): il pack delle prove non può leggere né scrivere le scelte salvate dall'add-on (es. il menu dello scavo). Per impostarle, l'add-on offre un comando `scriptevent` (es. `/scriptevent coop:scavo_scelta {"vena":true}`) che la prova lancia con `giocatore.runCommand(...)`.
- **Durata degli attrezzi**: nel gioco un attrezzo si rompe quando il danno *supera* il massimo, non quando lo raggiunge (scoperto con le prove da giocatore).
- Se il server non supporta il giocatore simulato o il comando beta, la prova da giocatore viene segnata come **saltata** con il motivo; le altre verifiche continuano.
- Non usare `mct autotest`: con il server 1.26.65 resta appeso e non dice se la prova è passata.

## Pulsante di prova degli script

La logica (costruzioni, menu, macchine...) si prova senza giocatori.

- In `scripts/prove.js` del behavior pack ogni contenuto registra una prova con `prova("nome", async ({ dim, origine, aspetta }) => { ... })`: prepara i blocchi vicino a `origine`, chiama la funzione del contenuto e lancia un errore (`throw new Error("...")`) se il risultato non è quello atteso.
- `npm run prova-server` tiene caricata la zona di prova (`tickingarea`), manda `/scriptevent coop:autotest` e stampa una riga `✓`/`✗` per ogni prova.
- **Solo sul server di prova**: le prove svuotano la zona da 0,100,0 a 15,110,15, quindi `prove.js` parte solo se nel mondo non c'è nessun giocatore. Nel gioco vero il comando viene rifiutato con un messaggio giallo e non tocca niente. Non togliere questo controllo (regola "Codice di prova nei mondi veri" in `AGENTS.md`).
- Per provare la logica conviene scriverla come **funzione esportata** (per esempio `scavaVena(dimensione, posizione, piccone)`) che l'evento del giocatore chiama: così la prova la chiama direttamente.
- Trappola già vista: i menu di `@minecraft/server-ui` si creano dentro un evento, non all'avvio dello script.
