# Coop Space: istruzioni per gli assistenti IA

Questo file è la fonte di verità del progetto. Lo leggono Claude Code (tramite `CLAUDE.md`) e Codex. Se una regola cambia, si cambia qui.

## Il progetto

- Add-on per **Minecraft Bedrock**, giocati soprattutto da **telefono**.
- Team di tre persone che **non sono programmatori**: due usano Claude Code, uno usa Codex. Parla in **italiano**, con parole semplici, e alla fine spiega sempre cosa hai fatto e come provarlo.
- Il lavoro si coordina con `TASKS.md` (cosa fare, chi lo fa) e con le pull request su GitHub. Per parlare tra loro usano WhatsApp.

## Struttura

```
addon/
  behavior_packs/coop_space_bp/   logica: blocchi, oggetti, mob, ricette, script
    manifest.json
    blocks/  items/  entities/  loot_tables/  recipes/
    scripts/main.js               punto di ingresso degli script
  resource_packs/coop_space_rp/   grafica: texture, modelli, nomi, suoni
    manifest.json
    textures/  texts/it_IT.lang  texts/en_US.lang
scripts/verify.mjs                controllo obbligatorio (npm run verify)
scripts/package.mjs               crea dist/coop-space.mcaddon (npm run package)
scripts/prova-server.mjs          prova l'add-on sul server ufficiale Bedrock (npm run prova-server)
scripts/prova-mc.mjs              prepara Minecraft sul PC con add-on e mondo di prova, e lo avvia (npm run prova-mc)
scripts/avvio-sessione.mjs        all'avvio di Claude Code: aggiorna main, installa gli strumenti, elenca i lavori aperti
scripts/sito.mjs                  costruisce il sito del team in out/sito (npm run sito)
sito/                             pagine del sito: progressi, contenuti, visore 3D
.github/workflows/sito.yml        pubblica il sito su GitHub Pages a ogni modifica su main
.claude/settings.json             impostazioni di Claude Code per tutti: permessi, blocchi, hook
.github/workflows/build.yml       build automatica e release "ultima-versione"
.github/workflows/merge-automatico.yml  fonde da sola ogni pull request pronta e con la build verde
TASKS.md                          compiti e assegnazioni
team.json                         chi fa parte del gruppo e chi ha fatto l'accoglienza
```

Solo i file dentro `addon/` finiscono nel gioco. Non mettere altro lì dentro: il validatore lo segnala come errore.

## Come lavorare

1. **All'inizio, aggiornati e guarda cosa fanno gli altri.** Il lavoro degli altri finché non entra in `main` sta solo nelle loro pull request: se non le guardi, rischi di rifare la stessa cosa.
   - Aggiorna il progetto: `git switch main && git pull`, poi `npm install` se `node_modules/` manca. Con Claude Code lo fa da solo l'hook di avvio (`scripts/avvio-sessione.mjs`), che ti scrive anche l'elenco dei lavori aperti.
   - Leggi `TASKS.md` e i lavori aperti: `gh api repos/NEX0R/coop-space/pulls` e `gh api repos/NEX0R/coop-space/issues`. **Usa sempre `gh api`**: nelle sessioni cloud (telefono) i comandi `gh pr …` e `gh issue …` sono bloccati. Senza `gh`: <https://api.github.com/repos/NEX0R/coop-space/pulls> oppure il sito del team.
   - Se qualcuno sta già facendo la stessa cosa (pull request aperta, anche in bozza), fermati e avvisa l'utente.
2. Prima di creare o modificare contenuti, **leggi la skill ufficiale Mojang** adatta e seguila:
   `npx mct skills <nome>` (o `npm run skills -- <nome>`). Skill disponibili:
   - `create-block`: blocchi, minerali, luci
   - `create-item`: oggetti, armi, attrezzi, cibo, armature
   - `create-mob`: mob e creature
   - `design-model`: modelli 3D e texture in pixel art
   - `debug-addon`: trovare e correggere errori
   - `creator-tools-cli`: comandi dello strumento `mct`
   Se il server MCP `minecraft-creator-tools` è disponibile (vedi `.mcp.json`), usa i suoi strumenti come dicono le skill. Se non lo è, scrivi i file a mano seguendo la skill.
3. Lavora su un **ramo nuovo** e apri una **pull request** verso `main`. Mai push diretti su `main`: GitHub li rifiuta (regola "Proteggi main": servono pull request e controllo `build` passato; vietati push forzati e cancellazione).
   - **Cartello "occupato"**: appena approvato il piano, prima di scrivere i file, fai un primo commit (anche solo `TASKS.md` con il compito "In corso" e il nome), `git push -u origin <ramo>` e apri subito la pull request **in bozza** (GitHub non permette di fondere le bozze):
     `gh api repos/NEX0R/coop-space/pulls -f title="In corso: <cosa>" -f head=<ramo> -f base=main -f body="<piano in 2 righe>" -F draft=true`
     Così gli assistenti degli altri la vedono all'avvio. Se `gh` manca (PC senza GitHub CLI), dai all'utente il link che `git push` stampa e fagli scegliere "Create draft pull request". Se il tuo strumento non apre bozze (per esempio Codex), apri la pull request appena puoi e avvisa sul gruppo WhatsApp.
   - **Una funzione, una pull request**: non aprire una pull request che parte dal ramo di un'altra ancora aperta. La #31 conteneva tutta la #30: approvando la prima si approvava anche la seconda, senza saperlo. Se un lavoro ha due parti, o restano nella stessa pull request, o si aspetta che la prima sia fusa e si riparte da `main`.
   - **A lavoro finito**: aggiorna titolo e descrizione (`gh api -X PATCH repos/NEX0R/coop-space/pulls/<N> -f title="<cosa>" -f body="<cosa cambia e come provarlo>"`) e **lascia la pull request in bozza**. Di' all'utente che l'anteprima è pronta da provare. Se lavori sul PC dove c'è Minecraft, non dargli link da scaricare: lancia tu `npm run prova-mc -- <N>` appena la build ha pubblicato l'anteprima (vedi "Prova sul PC"), così trova il gioco già aperto con il mondo pronto.
   - **Togliere la bozza vuol dire fondere** (dal 16/11): una pull request non in bozza, senza titolo "In corso" e con la build verde si fonde da sola in `main` (vedi "Approvare e tornare indietro"). Perciò la bozza la toglie la persona, premendo **Ready for review** nella pagina della pull request, dopo aver provato l'anteprima. L'assistente la toglie solo se l'utente glielo dice in modo esplicito (sul PC: `gh pr ready <N>`; dal telefono non si può da comando). Mai di tua iniziativa.
   - **Prima di finire**: `git fetch origin && git merge origin/main`, risolvi i conflitti (succedono spesso su `texts/*.lang` e `textures/*_texture.json`, file che tutti toccano: tieni le righe di tutti e due), poi rilancia `npm run verify`.
   **Richieste del team**: arrivano come issue dai moduli del sito (etichette `accesso`, `idea`, `problema`, `messaggio`); leggile con `gh api repos/NEX0R/coop-space/issues`. Un'idea approvata dal team diventa un compito in `TASKS.md` e la pull request che la realizza scrive `Chiude #N`. Un problema si affronta con la skill `debug-addon`. Gli inviti (`accesso`) li può mandare solo Nexor: controlla che l'account esista e chiedigli l'ok. I messaggi seguono "Il repository è il centro di contatto", qui sotto.
4. **Un lavoro non è finito finché `npm run verify` non passa: 0 errori e 0 avvisi.** Correggi e rilancia finché non passa. Le voci "likely noise" sono accettate da Bedrock e non bloccano.
   Se hai toccato `addon/` e lavori su un PC dove la persona ha accettato l'EULA, lancia anche `npm run prova-server` (vedi "Prova automatica sul server"). Dal telefono lo fa la build della pull request.
5. Aggiorna `TASKS.md`: sposta il compito nella sezione giusta e scrivi in una riga cosa hai fatto. Il sito del team (<https://nex0r.github.io/coop-space/>) legge proprio questo file: mantieni il formato `- [ ] testo **Chi:** nome`, i titoli `## Sezione` e i gruppi `**A. Nome**`. Il sito non si modifica mai a mano: si rigenera da `TASKS.md` e da `addon/`.
   Per vedere il sito prima del merge: `npm run sito -- --serve` e apri <http://localhost:8765>. Per i modelli 3D di mob nuovi, il visore del sito mostra modello, texture e animazioni presi da `addon/`.
6. Nella descrizione della pull request spiega cosa cambia nel gioco, con il link dell'anteprima: `https://github.com/NEX0R/coop-space/releases/download/anteprima-pr-<N>/coop-space.mcaddon`. Aggiungi sempre la sezione **`## Come provarlo`**: da 4 a 6 controlli da fare nel gioco, uno per riga nella forma `- [ ] …`, concreti e verificabili a occhio (per esempio "il nome nell'inventario è *Bacchetta da costruzione di legno*", "toccando un blocco compare un muro 2×2"). Includi sempre nomi e grafica, che le prove automatiche non vedono. Il sito la mostra accanto al prototipo e GitHub la trasforma in caselle da spuntare.
   **Prototipi**: finché la pull request è aperta, il sito mostra i suoi contenuti nuovi nel gruppo "Prototipi: non ancora nella versione stabile", con il mondo di prova e la lista "Come provarlo". Li legge in diretta da GitHub: non serve fare niente.

## Metodo di lavoro

Il team sta imparando a usare l'IA: il metro di ogni scelta è il loro tempo, i loro token e un risultato che funziona nel gioco.

1. **Prima il piano, poi i file.** Per ogni contenuto o funzione nuova proponi un piano breve e aspetta l'approvazione prima di scrivere. Se la skill ufficiale copre il caso, il piano è seguire la skill. Se ci sono scelte vere (più modi di ottenere lo stesso risultato), confronta 2-3 approcci su efficacia nel gioco, manutenzione e costo (tempo e token) e consigliane uno spiegando perché. Fanno eccezione le correzioni piccole e le richieste già precise.
2. **Richiesta vaga: chiedi.** Al massimo 3 domande: cosa deve succedere nel gioco, come si ottiene, come si capisce che funziona.
3. **Controllo continuo.** Se un approccio già usato nel progetto risulta obsoleto, inefficiente o superato da un'alternativa migliore, fermati e proponi il cambiamento con costi e benefici prima di andare avanti.
4. **Efficienza.** Passi piccoli e verificabili, modifiche mirate invece di riscrivere file interi, niente riletture di file già in contesto, niente ricerche sul web se la risposta è nella skill o nel repository. Una pull request, una cosa sola.
5. **Fonti dirette.** Nell'ordine: skill ufficiali Mojang, documentazione Microsoft (`learn.microsoft.com/minecraft/creator`), esempi Mojang, `wiki.bedrock.dev`. Video e post di terzi solo come spunto, e dillo quando li usi.
6. **Persona nuova.** Se chi ti scrive è nuovo o chiede come funziona il progetto, segui "Accoglienza di una persona nuova" qui sotto, un passo alla volta.

## Il repository è il centro di contatto

Il gruppo (oggi 2 Claude Code e 1 Codex, ognuno con la sua persona) si parla attraverso questo repository, non tramite copia e incolla. Chi c'è lo dice `team.json`.

- **Messaggi**: sono issue con l'etichetta `messaggio`. Titolo `Per <nome>: …` oppure `Per tutti: …`. Il destinatario è l'assegnatario (il suo account GitHub); senza assegnatario il messaggio è per tutti. Firma sempre: `— assistente di <nome> (Claude Code / Codex)`.
  - Scrivere: `gh api repos/NEX0R/coop-space/issues -f title="Per <nome>: …" -f body="…" -f "labels[]=messaggio" -f "assignees[]=<account>"`
  - Rispondere: `gh api repos/NEX0R/coop-space/issues/<N>/comments -f body="…"`. Chiudere quando è risolto: `gh api -X PATCH repos/NEX0R/coop-space/issues/<N> -f state=closed`
  - Le persone possono scrivere dal sito ("Scrivi al team").
- **Leggere**: con Claude Code l'hook di avvio consegna all'assistente i messaggi per il suo utente ("MESSAGGI DEL TEAM"). Con Codex, e ogni volta che `gh` non funziona, chiedi all'utente di guardare "Richieste del team" nel sito o le notifiche di GitHub.
- **Riferire**: racconta all'utente i messaggi per lui con parole semplici e chiedigli se e cosa rispondere. Non rispondere a suo nome senza il suo ok.
- **Quando scrivere**: per una decisione o un aiuto che serve a qualcuno, per passare un lavoro, per un problema che blocca, per un cambiamento che tocca il lavoro degli altri. Quello che sta già in `TASKS.md` o in una pull request non va ripetuto.

## Accoglienza di una persona nuova

Il repository è il punto d'ingresso del gruppo: ognuno entra con la propria IA, che controlla i requisiti e spiega le regole.

**Parti da solo.** Se all'avvio l'hook scrive "PERSONA NUOVA", o se l'utente non è in `team.json` con `"accoglienza": "fatta"`, avvia l'accoglienza alla tua prima risposta, anche se ti ha scritto solo "ciao"; poi riprendi la sua richiesta. Se non sai chi è (Codex, o PC senza `gh`), chiedigli il nome utente GitHub. Controlla tu quello che puoi, chiedi il resto, e alla fine fai un riepilogo con ✓ e ✗.

1. **Chi è e da dove lavora**: nome di battesimo, dispositivo (PC o telefono) e assistente (Claude Code o Codex). Spiega la differenza con la tabella "PC o telefono" del README.
2. **Accesso in scrittura**: `gh api repos/NEX0R/coop-space --jq .permissions.push` deve dare `true`. Se dà `false` o un errore, l'invito non è stato accettato: link <https://github.com/NEX0R/coop-space/invitations>. Se non c'è nessun invito, va usato "Chiedi l'accesso" nel sito.
3. **Sicurezza**: autenticazione a due fattori attiva su GitHub (chiedilo, non puoi verificarlo).
4. **Strumenti**: `npm run verify` deve dare 0 errori e 0 avvisi. Con Claude Code l'hook li installa da solo; con Codex serve `npm ci` come script di setup dell'ambiente.
5. **Minecraft**: sul dispositivo dove prova, versione almeno 1.26.60 (in basso a destra nel menu principale).
6. **Prima prova**: il blocco di prova, passo 4 di "Inizia qui" nel README.
7. **Come si lavora**, in 5 righe: compito da `TASKS.md` o dal sito → piano → cartello "occupato" → `npm run verify` → anteprima da provare nel gioco → "Ready for review" → si fonde da sola. Una cosa per pull request, una sessione per compito.
8. **Prima pull request**: aggiorna la sua riga in `team.json` (nome, assistente, dispositivi, `"accoglienza": "fatta"`; se manca, aggiungila). È anche la prova pratica del ciclo di lavoro.
9. **Messaggi in sospeso**: se c'è un messaggio di benvenuto per lui, rispondi con il riepilogo dell'accoglienza e chiudilo.

## Regole tecniche

- **Namespace**: tutti gli identificativi iniziano con `coop:` (es. `coop:spada_fulmine`). Mai `minecraft:`.
- **UUID dei manifest**: non cambiarli mai. Cambiarli rompe i mondi che usano già l'add-on. Lo strumento `mct fix randomizealluids` è vietato.
- **Versioni dei pack**: **non si alzano più a mano.** `npm run package` (e quindi ogni anteprima e ogni release) dà a tutti e due i pack la versione `<prima cifra>.<giorno dal 1/1/2026>.<minuto del giorno>`, per esempio `0.319.874`, e aggiorna la dipendenza. Ogni pacchetto è quindi più nuovo del precedente e Minecraft lo accetta sempre. **Anche il nome** del pack mostrato in Minecraft contiene la versione, per esempio "Coop Space BP 0.320.996"; nelle anteprime si aggiunge "(anteprima PR #N)". Lo fa da solo `npm run package` sulla copia, quindi non scriverlo a mano nei manifest. Il sito mostra la stessa versione sul pulsante di download. Nei `manifest.json` del repository conta solo la prima cifra; le altre due restano come sono. Solo il behavior pack dipende dal resource pack. **Mai** aggiungere la dipendenza al contrario (dal resource pack al behavior pack): la skill `debug-addon` avverte che le dipendenze circolari possono impedire il caricamento dei pack.
- **Script API**: usa solo moduli **stabili** (`@minecraft/server` 2.11.0, la stessa in `package.json` e nel manifest). Niente versioni `beta`, a meno che il team lo decida: in quel caso ogni mondo deve attivare "Beta API" negli esperimenti, e va scritto qui.
- **Versione del gioco**: `min_engine_version` è `1.26.60`. Se Minecraft si aggiorna, controlla le nuove versioni con `npm view @minecraft/server dist-tags` e `npm view @minecraft/vanilla-data dist-tags`, poi aggiorna insieme manifest, `package.json` e questo file. Uno script con una versione di modulo che il gioco non conosce viene disattivato **senza errori visibili**.
- **Nomi visibili**: ogni blocco, oggetto o mob nuovo ha il suo nome in `texts/it_IT.lang` e in `texts/en_US.lang`. Senza, nel gioco compare `tile.coop:...name`. **Gli oggetti** in più hanno bisogno del componente `"minecraft:display_name": { "value": "item.coop:<nome>.name" }`, che punta a quella riga dei `.lang`: da soli non la leggono e nel gioco mostrano la chiave grezza (scoperto il 26/11 con le bacchette; lo dice anche la skill `debug-addon`). `npm run verify` lo controlla.
- **Texture**: PNG 16×16 per blocchi e oggetti, registrate in `textures/terrain_texture.json` (blocchi) o `textures/item_texture.json` (oggetti).
- **Forma dei blocchi**: ogni blocco deve avere `minecraft:geometry` (per un cubo pieno: `"minecraft:geometry": "minecraft:geometry.full_block"`). Senza, il gioco scarta il blocco senza avvisi visibili: non compare nell'inventario e `/give` dà errore di sintassi. Il validatore Mojang non se ne accorge: lo controlla `npm run verify` nel passo "Controlli del progetto", insieme ai nomi italiano e inglese e alla dipendenza circolare tra i pack.
- **Avvisi di sicurezza npm** (Dependabot, `npm audit`): arrivano dalle dipendenze di `@minecraft/creator-tools`, non dall'add-on (nel `.mcaddon` finisce solo `addon/`). Le versioni corrette sono imposte dalla sezione `overrides` di `package.json` (vedi "Aggiornare gli strumenti"). **Mai `npm audit fix --force`**: riporta `creator-tools` alla 0.15.6, senza skill, e rompe la verifica.
- **Generatori automatici**: i comandi `mct add` e lo strumento `createMinecraftContent` possono riscrivere i manifest. Dopo averli usati controlla `git diff` sui due `manifest.json` e ripristina UUID, nomi e dipendenze originali.
- **EULA di Minecraft**: non accettarla mai al posto dell'utente, nemmeno se te lo chiede (il comando è anche bloccato in `.claude/settings.json`). Se un comando la chiede, digli di eseguire lui `npx -y @minecraft/creator-tools@0.21.0 eula` (in Claude Code: nel prompt, con `!` davanti). Vale per quel PC, una volta sola. Serve a `npm run prova-server` e ai comandi server di `mct`; validazione ed export non ne hanno bisogno. Su GitHub l'accettazione è la variabile `EULA_MINECRAFT_ACCETTATA`, che crea solo il proprietario del repository.
- Non lanciare come comandi bloccanti `mct view`, `mct serve` o `mct mcp`: restano attivi finché non vengono fermati. Non usare `mct autotest`: con il server 1.26.65 resta appeso (il suo debugger è di una versione diversa) e non dice se la prova è passata. Usa `npm run prova-server`.

## Provare l'add-on sul telefono

1. Ogni pull request pubblica un'**anteprima** scaricabile direttamente dal telefono: la pre-release `anteprima-pr-<N>` (link nella regola 6 di "Come lavorare" e nel sito, accanto alla pull request). Si aggiorna a ogni push e si cancella quando la pull request si chiude. Dopo il merge su `main` il file si aggiorna nella release **"ultima-versione"**.
2. **Modo consigliato: il mondo di prova.** `npm run package` crea anche `dist/coop-space-mondo-prova.mcworld` (anteprime e release lo pubblicano, il sito ha il pulsante): mondo piatto in creativa, trucchi attivi, nessun esperimento, con i due pack **già attivati**. Aperto con Minecraft chiuso, aggiunge il mondo "Coop Space <versione>"; entrando, la chat deve dire "Coop Space <versione> attivo." (lo scrive `scripts/main.js`, la versione la mette `package.mjs`). Se il messaggio manca, la logica non è attiva.
3. Con il `.mcaddon` (per i mondi propri): aprilo **con Minecraft chiuso**, poi in un **mondo nuovo** attiva **"Coop Space" nei Pacchetti comportamento**: la grafica ("Coop Space - grafica") si aggiunge da sola perché il behavior pack dipende dal resource pack. **Errore tipico** (16/11): attivare solo la grafica nei Pacchetti risorse lascia il mondo senza blocchi. Un mondo creato con una versione vecchia continua a usare quella che ha dentro: non riaprire mondi di prova vecchi.
   - **"Impossibile importare… Pacchetto doppio rilevato"**: quella versione è già installata, anche se rovinata (per esempio dopo un'importazione interrotta). Le versioni create dal 15/11/2026 cambiano a ogni pacchetto, quindi basta scaricare di nuovo l'ultima versione o l'anteprima.
   - **Pacchetti vecchi o rovinati**: Impostazioni → **Generale** → **Archiviazione** → **Pacchetti di comportamenti** (poi **Pacchetti di risorse**, e **Non valido** se c'è) → seleziona "Coop Space" → **Elimina**. Elimina anche i mondi di prova che li usavano. Fallo ogni tanto: ogni versione importata resta installata accanto alle altre.
4. Se qualcosa non funziona ma `npm run verify` passa, usa il **registro dei contenuti** (in inglese "Content Log"). L'utente vede il gioco in italiano: dagli questi nomi, non quelli inglesi.
   - Prima di entrare nel mondo: Impostazioni → **Creatore** → gruppo **Impostazioni registro dei contenuti** → attiva **Mostra l'interfaccia utente del registro dei contenuti** (in alcune schermate: "Abilita l'interfaccia grafica del registro dei contenuti") e, se c'è, **Mostra UI registro dei contenuti per errori di caricamento**.
   - Per leggere gli errori: Impostazioni → Creatore → **Cronologia registro dei contenuti** → **Visualizza** → **Copia negli appunti**, e fatti incollare il testo.
   - La skill `debug-addon` (file `references/content-log.md`) spiega come leggerlo.
5. Per sapere se un contenuto esiste davvero nel gioco: nel mondo, Pausa → Impostazioni → **Trucchi** → **Attiva i trucchi**, poi in chat `/give @s coop:<nome>`. Se dà errore di sintassi sull'ID, il gioco non lo conosce: il pack non è caricato oppure il contenuto è stato scartato (leggi il registro).

### Prova sul PC (Windows, Minecraft Bedrock 1.26)

Se l'assistente gira sul PC dove è installato Minecraft, può fare da solo i controlli sui file:

- **Preparare la prova: `npm run prova-mc`** (voluto da Nexor il 26/11). Chiude Minecraft se è aperto, sostituisce i pack "Coop Space" installati con quelli nuovi (li riconosce dall'UUID), aggiorna l'add-on nel mondo fisso **"Coop Space - laboratorio"** (lo crea la prima volta), lo mette in cima alla lista e avvia il gioco. La persona deve solo entrare nel primo mondo. Nel laboratorio costruzioni e impostazioni restano da una prova all'altra: cambia solo l'add-on dentro il mondo. `npm run prova-mc -- <N>` usa l'anteprima della pull request #N (che sparisce dopo la fusione); senza numero crea il pacchetto da `addon/` (utile prima del push). `--mondo-nuovo` rifà il laboratorio da zero: usalo **solo quando serve davvero**, cioè per le cose che nascono quando il mondo viene generato (biomi, strutture, minerali e generazione naturale, impostazioni del mondo), e avvisa la persona che le costruzioni del laboratorio si perdono. `--pulisci` cancella i mondi di prova "Coop Space …" importati a mano (mai il laboratorio né i mondi della persona); `--non-avviare` non apre il gioco. Usalo sempre al posto dei link quando la persona prova sul PC.
- **Pack installati**: `%APPDATA%\Minecraft Bedrock\Users\Shared\games\com.mojang\behavior_packs` e `resource_packs` (cartelle `CoopSpaceB`, `CoopSpaceR`; le versioni successive finiscono in `CoopSpaceB(1)`, ecc.). Le versioni vecchie restano accanto e confondono le prove: dopo una prova riuscita si possono eliminare, **controllando prima** nel loro `manifest.json` che siano davvero quelle vecchie, e solo con l'ok dell'utente.
- **Mondi**: `%APPDATA%\Minecraft Bedrock\Users\<numero>\games\com.mojang\minecraftWorlds\<cartella>`; `world_behavior_packs.json` dice quali pack e versioni usa il mondo.
- **Registro su file**: chiedi all'utente di attivare **Abilita file registro dei contenuti** (stesso gruppo in Impostazioni → Creatore). Il gioco scrive `%APPDATA%\Minecraft Bedrock\logs\ContentLog*.txt`. Se il file è vuoto, fai chiudere Minecraft e rileggilo. Cerca le righe con `[error]` o `[warning]` che citano `coop`.

## Prova automatica sul server (`npm run prova-server`)

Risponde senza aprire il gioco alla domanda "l'add-on si carica e i contenuti esistono?". Avvia il **Bedrock Dedicated Server** ufficiale di Mojang (un Minecraft senza schermo), con un mondo nuovo e senza esperimenti come sul telefono, e in circa 15 secondi controlla:

- gli **errori del registro dei contenuti** durante il caricamento: blocchi, oggetti e mob scartati, script che si fermano (con file e riga);
- che ogni **blocco, oggetto e mob `coop:`** dei behavior pack esista davvero nel gioco. È la prova `/give` del punto 5 qui sopra, fatta dalla console del server: se il gioco non conosce l'identificativo, risponde con un errore di sintassi.

Cosa **non** controlla: la grafica (texture, modelli, nomi), e tutto quello che succede solo con un giocatore dentro (messaggi in chat, piazzare, usare). Quello si guarda ancora nel gioco, con l'anteprima.

- **Risultato**: `✓`/`✗` riga per riga. Codice 0 = superata, 1 = problemi nell'add-on (da correggere), 3 = la prova non è potuta partire (EULA mancante, download fallito, server non avviato): non è colpa dell'add-on. Il registro completo del server è in `out/prova-server.log`.
- **Sul PC** (Windows o Linux): serve l'EULA accettata dalla persona (vedi "Regole tecniche"). Il server si scarica da solo dal sito ufficiale la prima volta e a ogni versione nuova (circa 500 MB, in `%LOCALAPPDATA%\coop-space-server`; si può cancellare quando si vuole). Usa la porta 19432 e non compare tra i mondi in rete locale.
- **Su GitHub**: la build di ogni pull request lo lancia dopo `npm run package`, se esiste la variabile del repository `EULA_MINECRAFT_ACCETTATA` = `true`. La crea solo il proprietario (Nexor): `gh variable set EULA_MINECRAFT_ACCETTATA --body true --repo NEX0R/coop-space`, oppure Settings → Secrets and variables → Actions → Variables. Senza variabile il passo viene saltato. Con codice 3 la build mostra un avviso e continua.
- **Dal telefono** (sessioni cloud) il comando non parte: guarda il riepilogo della build nella pull request.
- **Provare una copia**: `npm run prova-server -- --addon <cartella>` prova un'altra cartella che contiene `behavior_packs/` (utile per riprodurre un errore senza toccare `addon/`).
- I test con giocatore finto (GameTest, `@minecraft/server-gametest`) esistono solo in versione beta e richiedono l'esperimento "Beta API": per ora non si usano (vedi "Script API").

## Approvare e tornare indietro

- **Chi approva**: chiunque del gruppo (deciso il 16/11), dopo aver provato l'anteprima nel gioco. Approvare vuol dire **togliere la bozza** ("Ready for review"): il pulsante "Merge" non serve più.
- **Merge automatico** (`.github/workflows/merge-automatico.yml`, voluto da Nexor il 16/11): una pull request si fonde da sola in `main` quando non è in bozza, il titolo non inizia con "In corso" e il controllo `build` dell'ultimo commit è verde. Succede quando finisce la build, oppure appena si toglie la bozza se la build era già verde. Vale solo per i rami di questo repository.
  - Per **tenerla ferma**: lasciala in bozza, o rimettila in bozza (nella pagina della pull request, "Convert to draft").
  - Se **non riesce** (di solito conflitti con `main`): l'automazione scrive un commento nella pull request. Aggiorna il ramo (`git fetch origin && git merge origin/main`), risolvi, rilancia `npm run verify` e fai push: si fonde alla build successiva.
  - Dopo la fusione l'automazione cancella l'anteprima e il ramo fuso, ricrea "ultima-versione" e ripubblica il sito. Li avvia lei perché una fusione fatta da un'automazione di GitHub non fa partire le altre da sola. Se "ultima-versione" o il sito restano indietro dopo una fusione, guarda la scheda Actions.
- **Tornare indietro (il "backup")**: niente si perde. `main` è protetto (niente push forzati né cancellazioni) e ogni modifica resta nella storia delle pull request.
  - Per la persona: nella pagina della pull request fusa c'è il pulsante **Revert**. Crea una pull request che annulla quella modifica; quando viene fusa, il progetto torna com'era e "Ultima versione" si ricrea con un numero più alto, quindi il telefono la accetta.
  - Per l'assistente, anche dal cloud: `git switch main && git pull && git switch -c annulla-pr-<N>`, poi `git revert -m 1 <commit di merge della PR>` (lo trovi con `git log --merges --oneline`), `npm run verify`, `git push -u origin annulla-pr-<N>` e la pull request con `gh api` come al solito (titolo `Annulla #<N>: …`).
  - Per un solo file: `git checkout <commit buono> -- <file>` su un ramo nuovo, poi pull request.

## Aggiornare gli strumenti

Le skill ufficiali arrivano con il pacchetto `@minecraft/creator-tools`. Per aggiornarle basta alzare la sua versione in `package.json` e in `.mcp.json` (controlla con `npm view @minecraft/creator-tools version`), poi `npm install` e `npm run verify`. Funziona anche da una sessione cloud, perché usa solo npm.

**Controllo automatico mensile**: il 7 di ogni mese alle 9 (ora italiana) una routine cloud dell'account di Nexor confronta la versione di `creator-tools`. Se ce n'è una nuova, prepara l'aggiornamento con la procedura qui sotto e apre una pull request "Aggiorna gli strumenti Mojang a <versione>"; se le prove falliscono, apre invece un messaggio per tutti. Quella pull request va provata e approvata come le altre. Gestione: <https://claude.ai/code/routines/trig_013BpMMcqkMkNY3MDbDx1Luf>.

**Versioni forzate (`overrides` in `package.json`).** `creator-tools` 0.21.0 fissava librerie con falle note (`axios`, `@modelcontextprotocol/sdk`, `@hono/node-server`, `zod`). Dal 15/11/2026 il progetto impone le versioni corrette, provate con: `npm ci`, `npm audit` (0 vulnerabilità), `npm run verify`, `npm run package` (`.mcaddon` identico a prima), `mct skills`, server MCP (20 strumenti, `validateFile`, `createMinecraftContent` con file identici a quelli prodotti con le versioni originali).
Quando aggiorni `creator-tools`: **togli tutta la sezione `overrides`**, poi `npm install` e `npm audit`. Rimetti solo le voci ancora necessarie, con l'ultima versione corretta, e rifai le stesse prove. Lasciate lì, le versioni forzate potrebbero imporre librerie più vecchie di quelle che la versione nuova si porta dietro.
