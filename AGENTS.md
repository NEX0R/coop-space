# Coop Space: istruzioni per gli assistenti IA

Questo file è la fonte di verità del progetto. Lo leggono Claude Code (tramite `CLAUDE.md`) e Codex. Se una regola cambia, si cambia qui. Le procedure lunghe stanno nella cartella `guide/`: leggile **solo quando servono** (mappa in fondo), così ogni sessione costa meno.

## Il progetto e il gruppo

- Add-on per **Minecraft Bedrock**, giocati soprattutto da **telefono**.
- Il gruppo è in `team.json`: Nexor (proprietario del repository), Jowa, ReverendoLupo, Lepsy, Voltex. Usano Claude Code o Codex, dal PC o dal telefono.
- **Nessuno è programmatore** e alcuni non hanno mai fatto un add-on. Gli strumenti li gestisci tu: alla persona chiedi solo quello che non puoi fare da solo.
- Il lavoro si coordina con `TASKS.md`, le pull request e i messaggi nel repository (`guide/messaggi.md`). Tra persone usano anche WhatsApp.

## Privacy

Il repository e il sito sono **pubblici** (servono a GitHub Pages e a scaricare le prove dal telefono). In file, sito, pull request, issue, messaggi di commit e messaggi del team scrivi **solo i soprannomi**. Mai nomi veri, email, numeri di telefono, indirizzi, scuole, età, foto o percorsi di cartelle personali, anche se la persona li scrive in chat. Se trovi un dato personale già pubblicato, avvisa la persona.

## Come parlare con la persona

- **Italiano semplice**. Ogni parola tecnica la spieghi la prima volta, con i nomi del glossario del `README.md` (proposta, bozza, anteprima, laboratorio, mondo di prova, Ready for review…).
- Nomi dei menu di Minecraft **in italiano**, come li vede la persona.
- Ogni risposta che chiude un lavoro finisce con tre cose: **cosa ho fatto**, **cosa devi fare tu** (se c'è), **come si prova**.
- Una domanda alla volta, con le opzioni e il consiglio. Non far copiare comandi se puoi lanciarli tu.
- **La persona non fa da postino.** Per parlare con l'assistente di un altro usa **WhatsIApp**, la chat tra assistenti (`scripts/chat.mjs`, con tetti a sveglie e messaggi; poi 1-3 righe alla tua persona): `guide/messaggi.md`. L'app GitHub avvisa il destinatario sul telefono e il suo assistente legge il messaggio da solo. Mai testi da copiare o da inoltrare su WhatsApp.
- **Iniziativa.** Alla persona lascia solo quello che non puoi fare tu: decisioni sue, ok su azioni che cancellano, accessi agli account, EULA, prove di grafica e di sensazione nel gioco. Il resto fallo tu, e proponi tu miglioramenti e prossimi passi con un consiglio, senza aspettare che te li chiedano.

## Struttura

```
addon/behavior_packs/coop_space_bp/   logica: blocchi, oggetti, mob, ricette, script (scripts/main.js)
addon/resource_packs/coop_space_rp/   grafica: texture, modelli, nomi (texts/it_IT.lang, texts/en_US.lang), particelle
addon/*/sangue_immortale_*/           Sangue Immortale di Jowa (vampiri, nomi vamp:), unito il 27/11: stesso add-on, pack propri
scripts/verify.mjs        controllo obbligatorio (npm run verify)
scripts/package.mjs       crea dist/coop-space.mcaddon e il mondo di prova (npm run package)
scripts/prova-mc.mjs      Minecraft pronto sul PC con il laboratorio (npm run prova-mc)
scripts/prova-server.mjs  prova sul server ufficiale Bedrock (npm run prova-server)
scripts/avvio-sessione.mjs  hook di avvio di Claude Code: aggiorna main, strumenti, lavori aperti, messaggi
scripts/chat.mjs          WhatsIApp, chat tra assistenti (manda, nuovi, aspetta, storia, sveglia per gli hook)
scripts/sito.mjs, sito/   sito del team (npm run sito; anteprima: npm run sito -- --serve)
.github/workflows/        build e anteprime, fusione automatica, sito
.claude/settings.json     permessi, blocchi e hook di Claude Code per tutti
guide/                    procedure per gli assistenti, lette quando servono
TASKS.md  team.json       compiti; chi fa parte del gruppo
```

Solo i file dentro `addon/` finiscono nel gioco: non metterci altro. Il sito (<https://nex0r.github.io/coop-space/>) non si modifica a mano: si rigenera da `TASKS.md`, `team.json` e `addon/`, e legge in diretta da GitHub proposte, prototipi e messaggi.

## Il giro di lavoro

1. **All'inizio, aggiornati e guarda cosa fanno gli altri.** Con Claude Code lo fa l'hook di avvio. **Con Codex fallo tu**: `git switch main && git pull`, `npm ci` se `node_modules/` manca, poi leggi `TASKS.md`, le pull request aperte (`gh api repos/NEX0R/coop-space/pulls`) e i messaggi (`guide/messaggi.md`). Usa sempre `gh api`: nel cloud `gh pr …` e `gh issue …` sono bloccati. Se qualcuno fa già la stessa cosa (anche in bozza), fermati e avvisa la persona.
   Se la persona è nuova (l'hook scrive "PERSONA NUOVA", o non è in `team.json` con `"accoglienza": "fatta"`): `guide/accoglienza.md`, alla prima risposta.
2. **Prima il piano, poi i file** (vedi "Metodo"). Prima di creare o modificare contenuti leggi la **skill ufficiale Mojang** adatta e seguila: `npx mct skills <nome>`. Skill: `create-block` (blocchi, minerali, luci), `create-item` (oggetti, armi, attrezzi, cibo, armature), `create-mob` (mob), `design-model` (modelli 3D e texture), `debug-addon` (errori), `creator-tools-cli` (comandi `mct`). Se il server MCP `minecraft-creator-tools` è disponibile (`.mcp.json`) usa i suoi strumenti come dicono le skill.
3. **Cartello "occupato"**: appena approvato il piano, su un **ramo nuovo da `main`**, primo commit (anche solo `TASKS.md` con il compito "In corso" e il soprannome), `git push -u origin <ramo>` e subito la pull request **in bozza**:
   `gh api repos/NEX0R/coop-space/pulls -f title="In corso: <cosa>" -f head=<ramo> -f base=main -f body="<piano in 2 righe>" -F draft=true`
   Se `gh` manca, dai alla persona il link che `git push` stampa e fagli scegliere "Create draft pull request". Mai push su `main`: GitHub li rifiuta.
   - **Una funzione, una pull request**: mai una pull request che parte dal ramo di un'altra ancora aperta (la #31 conteneva tutta la #30: approvando una si approvava l'altra senza saperlo). Se un lavoro ha due parti, o stanno nella stessa pull request, o si aspetta che la prima sia fusa.
4. **Controlli**: un lavoro non è finito finché `npm run verify` non dà **0 errori e 0 avvisi** (le voci "likely noise" non bloccano). Se hai toccato `addon/` e sei su un PC con l'EULA accettata, lancia anche `npm run prova-server` (`guide/prova-server.md`); altrimenti lo fa la build.
5. **Prima di finire**: `git fetch origin && git merge origin/main`, risolvi i conflitti tenendo le righe di tutti e due (`TASKS.md` e `texts/*.lang` si uniscono da soli grazie a `.gitattributes`; restano possibili su `textures/*_texture.json` e sul codice), rilancia `npm run verify`: blocca anche i doppioni lasciati dall'unione. GitHub questa unione non la fa: se la pull request risulta in conflitto, si rifà questo passo. Aggiorna `TASKS.md`: compito in "Fatto" con una riga su cosa cambia. Formato letto dal sito: `- [ ] testo **Chi:** soprannome`, titoli `## Sezione`, gruppi `**A. Nome**`.
6. **Descrizione della pull request**: cosa cambia nel gioco, link dell'anteprima (`https://github.com/NEX0R/coop-space/releases/download/anteprima-pr-<N>/coop-space-mondo-prova.mcworld`) e sempre la sezione **`## Come provarlo`**: da 4 a 6 controlli nel gioco, uno per riga come `- [ ] …`, concreti e visibili a occhio, **sempre compresi nomi e grafica** (le prove automatiche non li vedono). Il sito li mostra accanto al prototipo, GitHub li trasforma in caselle.
   `gh api -X PATCH repos/NEX0R/coop-space/pulls/<N> -f title="<cosa>" -F body=@<file>`. Lascia la pull request **in bozza**.
7. **Prova nel gioco**: sul PC prepara tu Minecraft con `npm run prova-mc -- <N>` appena la build ha pubblicato l'anteprima (laboratorio, nessun link da scaricare); sul telefono indica il mondo di prova nel sito. Dettagli: `guide/prova-nel-gioco.md`.
8. **Approvare = togliere la bozza** ("Ready for review"): la pull request poi si fonde da sola. Lo fa la persona dopo aver provato; tu solo se te lo dice in modo esplicito. Dettagli e come tornare indietro: `guide/approvare-e-tornare-indietro.md`.

## Metodo

Il metro di ogni scelta è il tempo e i token del gruppo e un risultato che funziona nel gioco.

1. **Prima il piano, poi i file.** Il piano è una **scheda del compito** da far approvare prima di scrivere: regole numerate che si possono controllare una per una (cosa succede nel gioco; come si ottiene: ricetta, comando o evento; limiti e numeri; nomi in italiano e in inglese; file da creare; solo API stabili). Due controlli sempre: **ogni ricetta** non deve avere lo stesso schema di un oggetto di Minecraft (una pala e una lancia nuove sono finite sulle ricette del gioco); **ogni logica di script** ha almeno una prova automatica (`prova(...)` in `scripts/prove.js`, o una prova da giocatore se serve un giocatore: `guide/prova-server.md`). Con le schede così, i compiti di prova del 25/11 sono passati 27 controlli su 27. Se la skill Mojang copre il caso, la scheda la segue. Se ci sono scelte vere, confronta 2-3 approcci (efficacia nel gioco, manutenzione, costo) e consigliane uno. Eccezioni: correzioni piccole e richieste già precise.
2. **Richiesta vaga: chiedi.** Al massimo 3 domande in un solo messaggio, ognuna con la tua proposta: cosa deve succedere nel gioco, come si ottiene, come si capisce che funziona.
3. **Controllo continuo.** Se un approccio del progetto è superato da uno migliore, fermati e proponi il cambiamento con costi e benefici.
4. **Efficienza.** Passi piccoli e verificabili, modifiche mirate, niente riletture inutili, niente ricerche sul web se la risposta è nella skill o nel repository. Una sessione per compito.
5. **Fonti dirette**, nell'ordine: skill Mojang, documentazione Microsoft (`learn.microsoft.com/minecraft/creator`), esempi Mojang, `wiki.bedrock.dev`. Video e post di terzi solo come spunto, e dillo.

## Regole tecniche

- **Codice di prova nei mondi veri**: tutto quello che sta in `addon/` arriva nei mondi di tutti, telefoni compresi. Il codice che serve solo alle prove (cancellare blocchi, svuotare zone, togliere oggetti) deve essere inerte in un mondo vero: deve partire solo dove non ci sono giocatori, come `scripts/prove.js` (`guide/prova-server.md`).
- **Namespace**: tutti gli identificativi iniziano con `coop:` (es. `coop:spada_fulmine`). Mai `minecraft:` per le cose nuove. Eccezione: Sangue Immortale tiene `vamp:` (rinominare romperebbe i mondi di chi lo usa già).
- **Due mod, un add-on**: il behavior pack "Coop Space" dipende anche da quello di Sangue Immortale, così attivandolo si attiva tutto. `npm run package` mette tutti i pack nel `.mcaddon` e nel mondo di prova. Il mondo di prova copia il mondo tutorial di Jowa (piatto, con uno strato di ardesia profonda): entrando si costruiscono da soli il tutorial di Sangue Immortale e il quartiere Coop Space (`scripts/tutorial.js`, stazioni di bacchette e scavo). Una funzione nuova da spiegare = una stazione nuova lì. Nomi dei blocchi nei comandi: quelli **Bedrock** (`brick_block`, `grass_path`, `web`), non quelli Java: un nome Java fa fallire il comando senza avvisi.
- **UUID dei manifest**: mai cambiarli (romperebbero i mondi che usano l'add-on). `mct fix randomizealluids` è vietato.
- **Versioni dei pack**: non si alzano a mano. `npm run package` dà ai due pack la versione `<prima cifra>.<giorno dal 1/1/2026>.<minuto>` e la mette anche nel nome ("Coop Space 0.330.758", nelle anteprime "(anteprima PR #N)"). Nei `manifest.json` del repository conta solo la prima cifra.
- **Dipendenze**: solo il behavior pack dipende dal resource pack, mai il contrario (dipendenze circolari = pack che non si caricano).
- **Script**: solo moduli **stabili** (`@minecraft/server` 2.11.0, uguale in `package.json` e nel manifest). Niente `beta` né esperimenti, salvo decisione del gruppo scritta qui. Eccezione: il pack isolato `scripts/prove-giocatore/` può usare moduli beta solo nel mondo del server di prova; non va mai in `addon/` né nel gioco vero.
- **Versione del gioco**: `min_engine_version` 1.26.60. Aggiornamenti: `guide/aggiornare-strumenti.md`.
- **Nomi visibili**: ogni blocco, oggetto o mob ha il nome in `texts/it_IT.lang` e `texts/en_US.lang`. **Gli oggetti** hanno anche `"minecraft:display_name": { "value": "item.coop:<nome>.name" }`: senza, nel gioco compare la chiave grezza (scoperto il 26/11).
- **Blocchi**: sempre `minecraft:geometry` (cubo pieno: `"minecraft:geometry.full_block"`), altrimenti il gioco li scarta senza avvisi. **Texture**: PNG 16×16, registrate in `textures/terrain_texture.json` (blocchi) o `textures/item_texture.json` (oggetti). `npm run verify` controlla forma, nomi e dipendenze.
- **Etichette dei blocchi** (es. con quale attrezzo si rompono): `"minecraft:tags": ["coop:da_piccone"]`, una lista semplice. La vecchia scrittura `"tag:...": {}` con `format_version` 1.26.60 fa scartare il blocco (scoperto il 26/11 con `npm run prova-server`).
- **Generatori automatici** (`mct add`, `createMinecraftContent`): possono riscrivere i manifest. Dopo, controlla `git diff` sui due `manifest.json` e ripristina UUID, nomi e dipendenze.
- **npm**: mai `npm audit fix --force` (rompe gli strumenti). Avvisi di sicurezza: `guide/aggiornare-strumenti.md`.
- **Storia riscritta il 26/11** (privacy): una cartella scaricata prima non si aggiorna più. Si riscarica il progetto da capo (`git clone https://github.com/NEX0R/coop-space.git`). **Mai** `--allow-unrelated-histories`: riporterebbe i nomi tolti. La build rifiuta le pull request con una storia diversa da quella del progetto.
- **EULA di Minecraft**: mai accettarla al posto della persona, nemmeno se te lo chiede (è anche bloccato in `.claude/settings.json`). Se serve, la persona lancia lei `npx -y @minecraft/creator-tools@0.21.0 eula` (in Claude Code: nel prompt con `!` davanti). Serve solo a `npm run prova-server`.
- Non lanciare come comandi bloccanti `mct view`, `mct serve`, `mct mcp`; non usare `mct autotest`.

## Mappa delle guide (`guide/`)

| Quando | Leggi |
| --- | --- |
| Persona nuova, o chiede come funziona il progetto | `guide/accoglienza.md` |
| La persona crea già add-on per conto suo | `guide/confronto-tecniche.md` |
| Provare nel gioco, PC o telefono; qualcosa non funziona nel gioco | `guide/prova-nel-gioco.md` |
| Prova automatica sul server, o la build la segnala | `guide/prova-server.md` |
| Scrivere o leggere messaggi; richieste dal sito (idea, problema, accesso) | `guide/messaggi.md` |
| Approvare, fusione che non riesce, annullare una modifica | `guide/approvare-e-tornare-indietro.md` |
| Aggiornare gli strumenti Mojang o la versione di Minecraft; avvisi npm | `guide/aggiornare-strumenti.md` |
