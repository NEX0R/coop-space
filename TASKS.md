# Compiti

Prendi un compito scrivendo il tuo nome accanto, e avvisa sul gruppo WhatsApp. Quando è fatto, spostalo in "Fatto" con una riga su cosa è cambiato.

## Preamboli (prima di creare contenuti)

Si fanno in ordine. Le istruzioni passo per passo sono in `README.md`, sezione "Inizia qui".

**A. Accesso**
- [x] Amico 1 manda a Nexor il nome utente GitHub
- [ ] Amico 2 manda a Nexor il nome utente GitHub (o usa "Chiedi l'accesso" nel sito del team)
- [ ] Nexor invita entrambi (Settings → Collaborators → Add people) e loro accettano
  - Amico 1 invitato il 15/11: deve accettare da <https://github.com/NEX0R/coop-space/invitations> e attivare l'autenticazione a due fattori.
- [ ] Nexor installa sul proprio account GitHub l'app "ChatGPT Codex Connector" per `coop-space` (serve a chi usa Codex)

**B. Assistenti collegati**
- [ ] Ognuno collega il proprio assistente al repository e fa la prima richiesta scritta nel README. **Chi:** tutti

**C. Prova nel gioco**
- [ ] Provare `coop-space.mcaddon` sul telefono: importarlo, attivarlo in un mondo, piazzare il "Blocco di prova Coop" e controllare che compaia il messaggio in chat. **Chi:** almeno uno, meglio tutti
  - Provato su PC da Nexor: funziona dalla versione 0.1.1. Manca la prova sul telefono.

**D. Decisioni di gruppo**
- [ ] Chi si occupa di cosa (logica e script, oggetti e mob, grafica e texture)
- [ ] Il primo add-on vero: tema e 3-5 contenuti da creare
- [ ] Chi approva le pull request degli altri

## Da fare

- [ ] (Facoltativo) Provare Blockbench per modelli 3D e texture, quando faremo il primo mob. **Chi:** ?
- [ ] Aggiungere a `scripts/verify.mjs` un controllo per i blocchi senza `minecraft:geometry` (il validatore Mojang non lo segnala, il gioco scarta il blocco). **Chi:** ?

## In corso

## Fatto

- [x] Moduli per le richieste del team (accesso, idea, problema) con pulsanti nel sito e richieste aperte mostrate in diretta. `main` protetto: solo pull request con controllo passato, niente push forzati.
- [x] Sito del team su GitHub Pages (<https://nex0r.github.io/coop-space/>): progressi da `TASKS.md`, pull request e modifiche in diretta, contenuti con i controlli di base, visore 3D con animazioni (anche per modelli esportati da Blockbench), download dell'ultima versione.
- [x] Configurazione di Claude Code per tutti (`.claude/settings.json`): permessi per i comandi sicuri, blocco dei comandi pericolosi, installazione automatica degli strumenti all'avvio. Provata con una sessione di prova: l'hook installa, il blocco nega.
- [x] Sicurezza: forzate le versioni corrette di `axios`, `@modelcontextprotocol/sdk`, `@hono/node-server` e `zod` (0 vulnerabilità). Add-on, verifica, skill e server MCP provati: funzionano come prima. Da togliere al prossimo aggiornamento di `creator-tools` (vedi `AGENTS.md`).
- [x] Scritte in `AGENTS.md` e `README.md` le scoperte della prima prova nel gioco: forma obbligatoria dei blocchi, versione da alzare, importare a gioco chiuso, mondo nuovo, nomi italiani del registro dei contenuti, prova sul PC e divieto di `npm audit fix --force`.
- [x] Corretto il blocco di prova: mancava la forma (`minecraft:geometry`), il gioco lo scartava e non compariva nell'inventario. Versione dei pack 0.1.1.
- [x] Guida "Inizia qui" nel README, metodo di lavoro in AGENTS.md (piano prima dei file, confronto tra approcci, efficienza), script funzionanti anche su Windows.
- [x] Struttura del progetto, blocco di prova, verifica automatica con il validatore Mojang e build del `.mcaddon` su GitHub.
