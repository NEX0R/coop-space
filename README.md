# Coop Space

Add-on per Minecraft Bedrock fatti insieme da un gruppo di amici: **Nexor, Jowa, ReverendoLupo, Lepsy e Voltex**. Nessuno di noi è programmatore: scriviamo cosa vogliamo nel gioco, l'assistente IA (Claude Code o Codex) lo costruisce, i controlli automatici verificano che funzioni e noi lo proviamo giocando.

**Il sito del team: <https://nex0r.github.io/coop-space/>** (funziona anche da telefono). Mostra a che punto siamo, le proposte aperte, i contenuti dell'add-on, i **prototipi** da provare e il pulsante per scaricare l'ultima versione. Si aggiorna da solo.

> **Privacy.** Il progetto è pubblico: chiunque può leggerlo. Qui dentro usiamo **solo i soprannomi**. Non scrivere mai nomi veri, email, numeri di telefono o altri dati personali, né nei moduli del sito né nei messaggi. Gli assistenti lo sanno e lo rispettano.

## Cos'è un add-on

Un add-on aggiunge cose nuove a Minecraft Bedrock senza modificare il gioco: blocchi, oggetti, armi, cibo, mob, ricette, e comportamenti speciali (come le nostre bacchette che costruiscono muri). È fatto di due parti, che viaggiano sempre insieme:

- **la logica** ("behavior pack", in Minecraft si chiama **"Coop Space"**): cosa fanno le cose, quanto durano, come si fabbricano, cosa succede quando le usi;
- **la grafica** ("resource pack", in Minecraft **"Coop Space - grafica"**): come appaiono, cioè immagini, modelli 3D, nomi in italiano e inglese.

Funziona su telefono, PC e console, ed è lo stesso file per tutti.

## Glossario

Le parole che vedrai e che gli assistenti useranno con te.

| Parola | Cosa vuol dire |
| --- | --- |
| **Assistente** | L'IA che lavora per te sul progetto: Claude Code oppure Codex. Scrive i file, lancia i controlli, prepara le prove. |
| **Repository** | Il progetto su GitHub, con tutti i file e la loro storia: <https://github.com/NEX0R/coop-space>. |
| **Compito** | Una cosa da fare, scritta in `TASKS.md` (la vedi anche nel sito). |
| **Proposta** (in inglese *pull request*) | Una modifica pronta da provare: per esempio "aggiungi la spada di smeraldo". Ognuna ha un numero, come #31. |
| **Bozza** | Una proposta ancora in prova. Finché è in bozza non entra nel gioco di nessuno. Serve anche da **cartello "occupato"**: gli altri vedono che ci stai lavorando. |
| **Controlli automatici** | Prove che GitHub e l'assistente fanno da soli a ogni modifica: verde = va bene, rosso = c'è un errore da correggere. |
| **Anteprima** | Il file di prova di una proposta, aggiornato a ogni modifica. Sparisce quando la proposta si chiude. |
| **Mondo di prova** | Il mondo tutorial: piatto, in sopravvivenza, con l'add-on già attivo. Entrando si costruiscono da soli il tutorial dei vampiri e il quartiere Coop Space (bacchette e scavo). Da aprire sul telefono. |
| **Laboratorio** | Sul PC: il mondo "Coop Space - laboratorio", sempre lo stesso. A ogni prova l'assistente ci mette dentro la versione nuova e apre Minecraft; quello che hai costruito resta. |
| **Prototipo** | Una cosa nuova ancora in prova (in una proposta aperta). Nel sito ha un gruppo tutto suo. |
| **Come provarlo** | La lista di 4-6 controlli da fare nel gioco, scritta in ogni proposta (la vedi anche nel sito). |
| **Ready for review** | Il pulsante, nella pagina della proposta, che vuol dire "l'ho provata, va bene": la proposta entra da sola nella versione stabile. |
| **Versione stabile** | Quello che è già approvato. Nel sito: "Ultima versione". |
| **Revert** | Il pulsante per annullare una proposta già approvata. Niente si perde mai. |
| **Messaggio** | Un avviso per qualcuno del gruppo, scritto nel repository. Il tuo assistente te lo riferisce quando parte. |

## Inizia qui

### 1. Account e accesso

1. Crea un account gratuito su [github.com](https://github.com/signup), se non lo hai, e attiva l'**autenticazione a due fattori** (Settings → Password and authentication).
2. Nel [sito del team](https://nex0r.github.io/coop-space/) premi **Chiedi l'accesso** e scrivi il tuo **soprannome**. Oppure manda a Nexor il tuo nome utente GitHub (mai l'email).
3. Quando Nexor ti invita, accetta da qui: <https://github.com/NEX0R/coop-space/invitations>.

### 2. Scegli la tua strada

| Strada | Per chi | Cosa ti serve |
| --- | --- | --- |
| **A. PC + Claude Code** | Nexor, Jowa | PC, abbonamento Claude |
| **B. Telefono + app Claude** | chi ha Claude e vuole lavorare dal telefono | app Claude |
| **C. PC + Codex** | ReverendoLupo, Voltex | PC, account ChatGPT (anche gratuito, con dei limiti) |
| **D. Telefono + Codex da Ubuntu** | Lepsy | telefono Android, account ChatGPT |

Su PC (strade A e C) il tuo assistente prepara anche Minecraft per le prove. Dal telefono (strade B e D) provi con il mondo di prova.

**A. PC + Claude Code**
1. Installa [Git](https://git-scm.com), [Node.js](https://nodejs.org) (versione LTS) e [Claude Code](https://code.claude.com/docs).
2. Apri il terminale e scrivi, una riga alla volta:
   ```
   git clone https://github.com/NEX0R/coop-space.git
   cd coop-space
   claude
   ```

**B. Telefono + app Claude**: nell'app Claude apri la scheda **Code**, collega GitHub quando te lo chiede, scegli `NEX0R/coop-space` e avvia una sessione. Non devi installare niente.

**C. PC + Codex**
1. Installa [Git](https://git-scm.com) e [Node.js](https://nodejs.org) (versione LTS).
2. Apri il terminale e scrivi, una riga alla volta:
   ```
   npm install -g @openai/codex
   git clone https://github.com/NEX0R/coop-space.git
   cd coop-space
   codex
   ```
3. La prima volta Codex ti chiede di entrare con il tuo account ChatGPT.

**D. Telefono + Codex da Ubuntu** (Android). È la strada più tecnica, ma i comandi sono da copiare così come sono.
1. Installa **Termux** da [F-Droid](https://f-droid.org/packages/com.termux/) (la versione del Play Store è vecchia e non funziona bene).
2. Apri Termux e scrivi, una riga alla volta (alcune ci mettono qualche minuto):
   ```
   pkg update && pkg upgrade -y
   pkg install -y proot-distro
   proot-distro install ubuntu
   proot-distro login ubuntu
   ```
3. Ora sei dentro Ubuntu. Scrivi:
   ```
   apt update && apt install -y git curl
   curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
   apt install -y nodejs
   npm install -g @openai/codex
   git clone https://github.com/NEX0R/coop-space.git
   cd coop-space
   codex
   ```
4. Le volte successive basta: apri Termux, `proot-distro login ubuntu`, `cd coop-space`, `codex`.

Non è una strada ufficiale di OpenAI, ma la usa la comunità. Se un passo dà errore, copia l'errore e mandalo al gruppo.

### 3. Saluta il tuo assistente

Scrivi: **"Ciao, sono <il tuo soprannome>, sono nuovo"**. Al resto pensa lui: controlla accesso e strumenti, sistema quello che manca, ti fa fare la prima prova nel gioco e ti spiega come lavoriamo. Ti chiede solo le cose che non può fare da solo.

Se fai già add-on per conto tuo, dillo: il tuo assistente confronta il tuo modo di lavorare con il nostro e lo racconta al gruppo, così prendiamo il meglio di tutti e due.

## Il giro di lavoro

1. **Scegli un compito** nel sito o in `TASKS.md`, o proponi un'idea, e dillo al tuo assistente.
2. **L'assistente ti propone un piano.** Lo approvi o lo correggi. Solo dopo scrive i file.
3. **Apre una proposta in bozza**: il cartello "occupato" che vedono tutti.
4. **Prova da solo** con i controlli automatici e prepara la lista "Come provarlo".
5. **Tu provi nel gioco**: sul PC trovi Minecraft già aperto con il laboratorio; dal telefono scarichi il mondo di prova dal sito, nel gruppo "Prototipi".
6. **Se va bene, premi "Ready for review"** nella pagina della proposta (o dillo al tuo assistente). La proposta entra da sola nella versione stabile. Se poi qualcosa non va, c'è "Revert".

Una proposta contiene **una cosa sola** (una spada, un mob, un blocco): se qualcosa si rompe, si capisce subito dove.

## Come chiedere bene all'assistente

Una buona richiesta dice tre cose: **cosa deve succedere nel gioco**, **come si ottiene** e **come capisci che funziona**.

| Richiesta debole | Richiesta buona |
| --- | --- |
| "Fammi una spada forte" | "Voglio una spada di smeraldo: 9 di danno, dura il doppio di quella di diamante, si crea con 2 smeraldi e 1 bastone. Quando colpisce un mob lo incendia per 3 secondi." |
| "Non funziona" | "Ho piazzato il blocco ma non compare il messaggio in chat. Ecco cosa c'è scritto nel registro dei contenuti: ..." |

- **Un compito per conversazione.** Finito un compito, apri una sessione nuova: l'assistente lavora meglio e consuma meno.
- **Se non capisci, scrivi "spiegamelo più semplice"**: è una richiesta normale.
- **Incolla gli errori così come sono**, senza riassumerli.
- **Non sai cosa scegliere?** Chiedi "quali sono le opzioni e quale consigli, e perché?".
- **Se sbaglia due volte la stessa cosa**, apri una sessione nuova e riformula la richiesta.
- **Claude Code**: usa **Sonnet** per il lavoro normale e **Opus** solo per i problemi difficili (comando `/model`): Opus consuma molto di più. **Codex gratuito** ha un limite d'uso: il comando `/status` ti dice quanto ne resta.

## Cosa vedrai e cosa vuol dire

- **"Coop Space <versione> attivo."** in chat, entrando in un mondo: l'add-on funziona.
- **Proposta con controllo rosso**: c'è un errore; il tuo assistente lo vede e lo corregge.
- **"Pacchetto doppio rilevato"** sul telefono: quella versione è già installata. Impostazioni → **Generale** → **Archiviazione** → **Pacchetti di comportamenti** (poi **Pacchetti di risorse**) → seleziona "Coop Space" → **Elimina**, poi scarica di nuovo.
- **Hai attivato solo "Coop Space - grafica"** in un tuo mondo: i blocchi non ci sono. Va attivato **"Coop Space"** nei **Pacchetti comportamento**: la grafica si aggiunge da sola.
- **Qualcosa non va nel gioco**: dillo al tuo assistente con parole tue; ti guida lui a leggere il registro degli errori di Minecraft.

## Per chi è curioso

- **Strumenti**: Claude Code o Codex (scrivono i file); Minecraft Creator Tools di Mojang (controlli e guide ufficiali, già nel progetto); GitHub (tiene il progetto e pubblica le prove); [Blockbench](https://www.blockbench.net), facoltativo, per modelli 3D e animazioni (funziona anche dal browser su [web.blockbench.net](https://web.blockbench.net)).
- **Claude Code è già configurato** (`.claude/settings.json`): niente richieste di permesso per i comandi sicuri, comandi pericolosi bloccati, strumenti installati da soli all'avvio. Codex legge le stesse regole in `AGENTS.md`, ma senza i blocchi automatici.
- **Le regole per gli assistenti** sono in `AGENTS.md`; le procedure lunghe nella cartella `guide/`, che gli assistenti leggono solo quando servono.
- **Dove imparare** (fonti dirette, puoi darle al tuo assistente e chiedergli di spiegartele): [documentazione ufficiale degli add-on](https://learn.microsoft.com/minecraft/creator/), [wiki della comunità Bedrock](https://wiki.bedrock.dev), [esempi ufficiali Mojang](https://github.com/microsoft/minecraft-samples), [Claude Code](https://code.claude.com/docs), [Codex](https://developers.openai.com/codex).
- **Comandi** (li lancia l'assistente): `npm run verify` (controllo, 0 errori e 0 avvisi), `npm run prova-mc` (Minecraft pronto sul PC), `npm run package` (crea i file da provare), `npm run prova-server` (prova sul server ufficiale, solo PC), `npm run sito -- --serve` (il sito in prova sul PC).
