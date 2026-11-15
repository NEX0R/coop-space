# Coop Space

Add-on per Minecraft Bedrock fatti in tre, con Claude Code e Codex. Nessuno di noi è programmatore: scriviamo cosa vogliamo nel gioco, l'assistente IA lo costruisce, un controllo automatico verifica che funzioni.

**Il sito del team: <https://nex0r.github.io/coop-space/>** (funziona anche da telefono). Mostra a che punto siamo (da `TASKS.md`), le proposte di modifica aperte con l'esito del controllo, i contenuti dell'add-on con cosa manca a ognuno, un visore 3D con le animazioni e il pulsante per scaricare l'ultima versione. Si aggiorna da solo: non va mai modificato a mano.

## Inizia qui (se sei nuovo)

Fai questi passi in ordine. Servono 15 minuti.

### 1. Fatti dare l'accesso

1. Crea un account gratuito su [github.com](https://github.com/signup), se non lo hai.
2. Manda a Nexor su WhatsApp il tuo **nome utente GitHub** (va bene anche l'email dell'account, ma il nome utente è più sicuro).
3. Quando Nexor ti invita, accetta da qui: <https://github.com/NEX0R/coop-space/invitations> (ti arriva anche un'email).

Senza l'invito puoi guardare il progetto, ma non modificarlo.

### 2. Collega il tuo assistente

**Se usi Claude Code** (telefono o PC):

1. Apri [claude.ai/code](https://claude.ai/code) oppure la scheda "Code" nell'app Claude.
2. Quando te lo chiede, collega il tuo account GitHub.
3. Scegli il repository `NEX0R/coop-space` e avvia una sessione.

**Se usi Codex** (ChatGPT):

1. Apri [chatgpt.com/codex](https://chatgpt.com/codex) oppure la sezione Codex nell'app ChatGPT.
2. Collega il tuo account GitHub.
3. Scegli il repository `NEX0R/coop-space`.

**Se il repository non compare nell'elenco:** avvisa Nexor. L'app GitHub dell'assistente deve essere installata dal proprietario del repository, e possono servire alcuni minuti prima che compaia. In alternativa, al PC: installa [Git](https://git-scm.com) e [Node.js](https://nodejs.org), poi nel terminale scrivi `git clone https://github.com/NEX0R/coop-space.git` e avvia il tuo assistente dentro quella cartella.

### 3. Fai la prima richiesta

Scrivi al tuo assistente, così com'è:

> Sono nuovo nel progetto. Leggi AGENTS.md e TASKS.md, poi spiegami in parole semplici come funziona e cosa posso fare per primo.

Le regole del progetto le legge da solo: non devi spiegargliele tu.

### 4. Prova l'add-on sul telefono

1. Dal telefono apri [l'ultima versione](https://github.com/NEX0R/coop-space/releases/tag/ultima-versione) e scarica `coop-space.mcaddon`.
2. Apri il file **con Minecraft chiuso**: lo importa da solo. Se il gioco è già aperto dentro un mondo, l'importazione non parte e non te lo dice.
3. Crea un **mondo nuovo** di prova (anche ogni volta che provi una versione nuova). Nelle impostazioni del mondo attiva "Coop Space" sia in **Pacchetti comportamento** sia in **Pacchetti risorse**.
4. In creativa cerca "Blocco di prova Coop" e piazzalo: deve comparire un messaggio in chat.

Scrivi sul gruppo se ha funzionato oppure no.

## Come lavoriamo

1. **Scegli un compito** in [`TASKS.md`](TASKS.md), scrivi il tuo nome accanto e avvisa sul gruppo. Due persone non lavorano sulla stessa cosa.
2. **Chiedi all'assistente.** Ti propone un piano; lo approvi oppure lo correggi; solo dopo scrive i file.
3. **L'assistente apre una "pull request"**: è una proposta di modifica. GitHub la controlla in automatico con il validatore ufficiale di Mojang.
4. **Prova sul telefono** il file `.mcaddon` che la pull request produce (te lo indica l'assistente).
5. **Se funziona, si approva** ("Merge") e la modifica entra nella versione di tutti.

Una pull request contiene una cosa sola (una spada, un mob, un blocco). Così, se qualcosa si rompe, si capisce subito dove.

## Come chiedere bene all'assistente

Una buona richiesta dice tre cose: **cosa deve succedere nel gioco**, **come si ottiene** e **come capisci che funziona**.

| Richiesta debole | Richiesta buona |
| --- | --- |
| "Fammi una spada forte" | "Voglio una spada di smeraldo: 9 di danno, dura il doppio di quella di diamante, si crea con 2 smeraldi e 1 bastone. Quando colpisce un mob lo incendia per 3 secondi." |
| "Non funziona" | "Ho piazzato il blocco ma non compare il messaggio in chat. Ecco cosa c'è scritto nel registro dei contenuti: ..." |

Altre abitudini utili:

- **Un compito per conversazione.** Finito un compito, apri una sessione nuova: l'assistente lavora meglio e consuma meno.
- **Chiedi il piano prima.** Se non capisci una proposta, scrivi "spiegamelo più semplice": è una richiesta normale.
- **Incolla gli errori così come sono**, senza riassumerli.
- **Non sai cosa scegliere?** Chiedi "quali sono le opzioni e quale consigli, e perché?".
- **Se sbaglia due volte la stessa cosa**, non insistere: apri una sessione nuova e riformula la richiesta con quello che hai capito.
- **Scegli il modello giusto** (Claude Code, comando `/model`): **Sonnet** per il lavoro normale (blocchi, oggetti, nomi, texture), **Opus** solo per i problemi difficili, come un errore che non si capisce dopo due tentativi. Opus consuma molto di più dei limiti del vostro abbonamento.

### Claude Code è già configurato

Il file `.claude/settings.json` vale per tutti, sul PC e nelle sessioni cloud:
- **Meno richieste di permesso**: i comandi sicuri del progetto (controllo, pacchetto, guide Mojang, stato di git) partono senza chiedere.
- **Comandi pericolosi bloccati**: `npm audit fix --force`, il cambio degli UUID, l'accettazione della EULA di Minecraft, il push diretto o forzato su `main`. Anche se l'assistente sbaglia, non può lanciarli.
- **Strumenti installati da soli**: all'avvio, se mancano o sono cambiati, Claude Code li installa (`npm ci`). Se è tutto a posto non fa niente e non consuma.
- **Server MCP di Mojang attivo senza conferme**: le sue descrizioni (circa 20.000 token) vengono caricate solo quando servono.

Chi usa **Codex** legge le stesse regole in `AGENTS.md`; i blocchi automatici però valgono solo per Claude Code.

## Strumenti

| Strumento | A cosa serve | Chi lo installa |
| --- | --- | --- |
| Claude Code o Codex | Scrive i file dell'add-on | Ognuno il suo |
| Minecraft Creator Tools (Mojang) | Validatore ufficiale, guide per gli assistenti, creazione del `.mcaddon` | Nessuno: è già nel progetto |
| GitHub | Tiene il progetto, controlla ogni modifica, pubblica il file per il telefono | Serve solo l'account |
| [Blockbench](https://www.blockbench.net) | Modelli 3D, texture e animazioni. È lo strumento indicato nella documentazione ufficiale di Minecraft; funziona anche dal browser su [web.blockbench.net](https://web.blockbench.net). Un modello esportato si può guardare animato nel sito del team ("Prova un tuo modello") prima di metterlo nell'add-on | Facoltativo, quando faremo mob o modelli |

## Dove imparare (fonti dirette)

Meglio leggere la fonte che il riassunto di qualcun altro. Puoi anche dare questi link al tuo assistente e chiedergli di spiegarteli.

- **Add-on Bedrock, documentazione ufficiale:** <https://learn.microsoft.com/minecraft/creator/>
- **Wiki della comunità Bedrock** (guide pratiche): <https://wiki.bedrock.dev>
- **Esempi ufficiali Mojang:** <https://github.com/microsoft/minecraft-samples>
- **Claude Code, documentazione:** <https://code.claude.com/docs>
- **Codex, documentazione:** <https://developers.openai.com/codex>

X (Twitter) e YouTube servono a scoprire le novità; per sapere come si fa davvero una cosa valgono le pagine qui sopra.

## Comandi (per gli assistenti o al PC)

```
npm install       installa gli strumenti
npm run verify    controlla l'add-on (deve dare 0 errori e 0 avvisi)
npm run package   crea dist/coop-space.mcaddon
```
