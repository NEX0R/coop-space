# Compiti

Prendi un compito scrivendo il tuo soprannome accanto (mai il nome vero: il progetto è pubblico), e avvisa sul gruppo WhatsApp. Quando è fatto, spostalo in "Fatto" con una riga su cosa è cambiato.

## Preamboli (prima di creare contenuti)

Si fanno in ordine. Le istruzioni passo per passo sono in `README.md`, sezione "Inizia qui".

**A. Accesso**
- [x] Jowa ha accettato l'invito (15/11, accesso in scrittura)
- [ ] ReverendoLupo, Lepsy e Voltex mandano a Nexor il nome utente GitHub (o usano "Chiedi l'accesso" nel sito) e accettano l'invito
- [x] Nexor installa sul proprio account GitHub l'app "ChatGPT Codex Connector" per `coop-space` (serve a chi usa Codex)
  - Installata il 15/11 solo su `coop-space`.

**B. Assistenti collegati**
- [ ] Ognuno fa l'accoglienza con il proprio assistente ("Inizia qui" nel README: scrive "Ciao, sono <soprannome>, sono nuovo"). **Chi:** Jowa, ReverendoLupo, Lepsy, Voltex
  - Jowa fa già add-on: durante l'accoglienza il suo assistente confronta il suo modo di lavorare con il nostro (messaggio #17).
  - Lepsy usa Codex da Ubuntu sul telefono (strada D): è la prima prova di questa strada.

**C. Prova nel gioco**
- [x] Provare `coop-space.mcaddon` sul telefono: importarlo, attivarlo in un mondo, piazzare il "Blocco di prova Coop" e controllare che compaia il messaggio in chat. **Chi:** almeno uno, meglio tutti
  - Funziona sul telefono di Nexor (16/11, con la versione automatica) e sul suo PC. Agli altri conviene rifarla una volta, durante l'accoglienza. Se compare "Pacchetto doppio rilevato": eliminare il vecchio pacchetto da Impostazioni → Generale → Archiviazione e scaricare di nuovo "Ultima versione".

**D. Decisioni di gruppo**
- [ ] Chi si occupa di cosa (logica e script, oggetti e mob, grafica e texture)
- [ ] Il primo add-on vero: tema e 3-5 contenuti da creare
- [x] Chi approva le pull request degli altri
  - Deciso il 16/11: chiunque del gruppo, dopo aver provato l'anteprima. Nessuna approvazione obbligatoria: se qualcosa va storto si torna indietro con "Revert" (vedi `guide/approvare-e-tornare-indietro.md`).

## Da fare

- [ ] (Facoltativo) Provare Blockbench per modelli 3D e texture, quando faremo il primo mob. **Chi:** ?

## In corso

- [ ] Attrezzi da scavo multiplo: picconi, asce e pale rompono più blocchi uguali (vena o forme), con menu da accovacciati **Chi:** Nexor

## Fatto

- [x] Pulsante di prova degli script: `npm run prova-server` preme `/scriptevent coop:autotest` e fa girare le prove della logica scritte in `scripts/prove.js` (senza giocatori; nei mondi veri il comando viene rifiutato e non tocca niente). Ora vede anche gli errori degli script dopo l'avvio, che prima ignorava.
- [x] Guida per tutti e privacy: solo soprannomi in file, sito, proposte e messaggi (Nexor, Jowa, ReverendoLupo, Lepsy, Voltex); `README.md` per chi non ha mai fatto add-on, con glossario e 4 strade (PC o telefono, Claude Code o Codex); `AGENTS.md` lungo un terzo, con privacy e linguaggio semplice, e procedure in `guide/` lette solo quando servono; accoglienza preparata dall'assistente per ogni strada; confronto delle tecniche per chi fa già add-on.
- [x] Prototipi sul sito: nella sezione "Contenuti" il gruppo "Prototipi: non ancora nella versione stabile" mostra, per ogni pull request aperta con l'anteprima, i contenuti nuovi (icona e nome), i pulsanti del mondo di prova e la lista "Come provarlo" da spuntare. Nuove regole: ogni pull request ha la sezione "## Come provarlo" (4-6 controlli nel gioco) e niente pull request che partono dal ramo di un'altra ancora aperta. Sul PC `npm run prova-mc -- <N>` installa add-on e mondo di prova della pull request #N e avvia Minecraft.
- [x] Potere delle bacchette, come la mod Building Gadgets: tocco su un blocco = costruisce; accovacciato + tocco (o tocco in aria) = menu con 9 modi (muro, pavimento, da X a Y, colonna verticale e orizzontale, fino a me, scale, superficie, blocco pieno), misure regolabili, scelta del blocco e "annulla l'ultima costruzione". Massimo per colpo: legno 4, pietra 9, ferro 27, oro 64, diamante 128, netherite 225 (dalle mod Construction Wand e Building Gadgets), lati fino a 15; anteprima con scintille verdi. In sopravvivenza consuma i blocchi dell'inventario e 1 punto di durata a colpo.
- [x] Bacchette da costruzione a 6 livelli (`coop:bacchetta_legno`, `_pietra`, `_ferro`, `_oro`, `_diamante`, `_netherite`): oggetti con texture, nomi italiano e inglese, durata come gli attrezzi di Minecraft, ricette al banco da lavoro (netherite al tavolo da forgiatura). Ancora senza il potere di costruire.
- [x] Prova automatica sul server ufficiale Bedrock (`npm run prova-server`): in circa 15 secondi, senza aprire il gioco, dice se il gioco segnala errori caricando l'add-on e se ogni blocco, oggetto e mob `coop:` esiste davvero. Gira anche nella build delle pull request, perché Nexor ha creato la variabile `EULA_MINECRAFT_ACCETTATA`. Non controlla la grafica.
- [x] Merge automatico: una pull request si fonde da sola quando qualcuno preme "Ready for review" e il controllo di GitHub è verde. Finché è in bozza resta ferma, per provarla. Dopo la fusione l'anteprima si cancella e "ultima-versione" e il sito si aggiornano da soli.
- [x] Attivazione a prova di errore: pacchetti chiamati "Coop Space" (da attivare) e "Coop Space - grafica" (si aggiunge da sola), messaggio in chat "Coop Space <versione> attivo." all'ingresso, mondo di prova `.mcworld` già pronto in ogni release e anteprima. Causa del 16/11: era attiva solo la grafica.
- [x] Blocco di ottone (`coop:blocco_ottone`): cubo pieno, suono di metallo, 5 secondi per romperlo, texture 16×16, nomi "Blocco di ottone" / "Brass Block".
- [x] Versione nel nome dei pack ("Coop Space BP 0.320.996", e "(anteprima PR #N)" nelle anteprime) e sul pulsante di download del sito, così in Minecraft si distinguono.
- [x] Decisione: le pull request le può approvare chiunque del gruppo, anche Jowa. Documentato come tornare indietro (pulsante Revert, o `git revert` per gli assistenti). Controllo automatico mensile degli strumenti Mojang (routine cloud, il 7 di ogni mese).
- [x] `npm run verify` controlla anche quello che il validatore Mojang non vede: blocchi senza forma (`minecraft:geometry`), nomi italiano e inglese mancanti, dipendenza circolare tra i pack.
- [x] Il repository è il centro di contatto tra gli agenti: `team.json` dice chi c'è, l'hook riconosce chi è nuovo e l'assistente avvia l'accoglienza da solo, i messaggi (issue con etichetta `messaggio`) arrivano all'assistente del destinatario all'avvio; modulo "Scrivi al team" nel sito.
- [x] Versione automatica dei pacchetti (`prima cifra.giorno.minuto`): ogni `.mcaddon` è più nuovo del precedente, così Minecraft non lo rifiuta più come "Pacchetto doppio rilevato" e nessuno deve alzare la versione a mano.
- [x] Anteprima di ogni pull request scaricabile dal telefono con un tocco (sito o pagina Releases), cancellata da sola alla chiusura della pull request.
- [x] Telefono e PC: comandi GitHub che funzionano anche nelle sessioni cloud (`gh api`), hook che legge i lavori aperti anche dal cloud e i rami senza pull request, accoglienza delle persone nuove guidata dall'IA, tabella "PC o telefono" nel README.
- [x] Tolta la dipendenza circolare tra i pack (il resource pack dipendeva dal behavior pack), come chiede la guida Mojang. Versione 0.1.2.
- [x] Assistenti sempre aggiornati: all'avvio di Claude Code l'hook aggiorna `main` (solo se è sicuro) e scrive l'elenco dei lavori aperti; regola del cartello "occupato" (pull request in bozza subito) e aggiornamento da `main` prima di finire.
- [x] Moduli per le richieste del team (accesso, idea, problema) con pulsanti nel sito e richieste aperte mostrate in diretta. `main` protetto: solo pull request con controllo passato, niente push forzati.
- [x] Sito del team su GitHub Pages (<https://nex0r.github.io/coop-space/>): progressi da `TASKS.md`, pull request e modifiche in diretta, contenuti con i controlli di base, visore 3D con animazioni (anche per modelli esportati da Blockbench), download dell'ultima versione.
- [x] Configurazione di Claude Code per tutti (`.claude/settings.json`): permessi per i comandi sicuri, blocco dei comandi pericolosi, installazione automatica degli strumenti all'avvio. Provata con una sessione di prova: l'hook installa, il blocco nega.
- [x] Sicurezza: forzate le versioni corrette di `axios`, `@modelcontextprotocol/sdk`, `@hono/node-server` e `zod` (0 vulnerabilità). Add-on, verifica, skill e server MCP provati: funzionano come prima. Da togliere al prossimo aggiornamento di `creator-tools` (vedi `AGENTS.md`).
- [x] Scritte in `AGENTS.md` e `README.md` le scoperte della prima prova nel gioco: forma obbligatoria dei blocchi, versione da alzare, importare a gioco chiuso, mondo nuovo, nomi italiani del registro dei contenuti, prova sul PC e divieto di `npm audit fix --force`.
- [x] Corretto il blocco di prova: mancava la forma (`minecraft:geometry`), il gioco lo scartava e non compariva nell'inventario. Versione dei pack 0.1.1.
- [x] Guida "Inizia qui" nel README, metodo di lavoro in AGENTS.md (piano prima dei file, confronto tra approcci, efficienza), script funzionanti anche su Windows.
- [x] Struttura del progetto, blocco di prova, verifica automatica con il validatore Mojang e build del `.mcaddon` su GitHub.
