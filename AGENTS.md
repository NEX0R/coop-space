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
scripts/avvio-sessione.mjs        installa gli strumenti all'avvio di Claude Code, se mancano
scripts/sito.mjs                  costruisce il sito del team in out/sito (npm run sito)
sito/                             pagine del sito: progressi, contenuti, visore 3D
.github/workflows/sito.yml        pubblica il sito su GitHub Pages a ogni modifica su main
.claude/settings.json             impostazioni di Claude Code per tutti: permessi, blocchi, hook
.github/workflows/build.yml       build automatica e release "ultima-versione"
TASKS.md                          compiti e assegnazioni
```

Solo i file dentro `addon/` finiscono nel gioco. Non mettere altro lì dentro: il validatore lo segnala come errore.

## Come lavorare

1. **All'inizio, aggiornati e guarda cosa fanno gli altri.** Il lavoro degli altri finché non entra in `main` sta solo nelle loro pull request: se non le guardi, rischi di rifare la stessa cosa.
   - Aggiorna il progetto: `git switch main && git pull`, poi `npm install` se `node_modules/` manca. Con Claude Code lo fa da solo l'hook di avvio (`scripts/avvio-sessione.mjs`), che ti scrive anche l'elenco dei lavori aperti.
   - Leggi `TASKS.md` e i lavori aperti: `gh pr list` e `gh issue list`. Se `gh` non funziona, usa <https://api.github.com/repos/NEX0R/coop-space/pulls> oppure il sito del team.
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
   - **Cartello "occupato"**: appena approvato il piano, prima di scrivere i file, fai un primo commit (anche solo `TASKS.md` con il compito "In corso" e il nome) e apri subito la pull request **in bozza** con titolo `In corso: <cosa>` (`gh pr create --draft`). Così gli assistenti degli altri la vedono all'avvio. A lavoro finito togli la bozza (`gh pr ready`) e rinomina il titolo. Se il tuo strumento non apre bozze (per esempio Codex), apri la pull request appena puoi e avvisa sul gruppo WhatsApp.
   - **Prima di finire**: `git fetch origin && git merge origin/main`, risolvi i conflitti (succedono spesso su `texts/*.lang` e `textures/*_texture.json`, file che tutti toccano: tieni le righe di tutti e due), poi rilancia `npm run verify`.
   **Richieste del team**: arrivano come issue dai moduli del sito (etichette `accesso`, `idea`, `problema`); leggile con `gh issue list`. Un'idea approvata dal team diventa un compito in `TASKS.md` e la pull request che la realizza scrive `Chiude #N`. Un problema si affronta con la skill `debug-addon`. Gli inviti (`accesso`) li può mandare solo Samuele: controlla che l'account esista e chiedigli l'ok.
4. **Un lavoro non è finito finché `npm run verify` non passa: 0 errori e 0 avvisi.** Correggi e rilancia finché non passa. Le voci "likely noise" sono accettate da Bedrock e non bloccano.
5. Aggiorna `TASKS.md`: sposta il compito nella sezione giusta e scrivi in una riga cosa hai fatto. Il sito del team (<https://nex0r.github.io/coop-space/>) legge proprio questo file: mantieni il formato `- [ ] testo **Chi:** nome`, i titoli `## Sezione` e i gruppi `**A. Nome**`. Il sito non si modifica mai a mano: si rigenera da `TASKS.md` e da `addon/`.
   Per vedere il sito prima del merge: `npm run sito -- --serve` e apri <http://localhost:8765>. Per i modelli 3D di mob nuovi, il visore del sito mostra modello, texture e animazioni presi da `addon/`.
6. Nella descrizione della pull request spiega cosa cambia nel gioco e come provarlo.

## Metodo di lavoro

Il team sta imparando a usare l'IA: il metro di ogni scelta è il loro tempo, i loro token e un risultato che funziona nel gioco.

1. **Prima il piano, poi i file.** Per ogni contenuto o funzione nuova proponi un piano breve e aspetta l'approvazione prima di scrivere. Se la skill ufficiale copre il caso, il piano è seguire la skill. Se ci sono scelte vere (più modi di ottenere lo stesso risultato), confronta 2-3 approcci su efficacia nel gioco, manutenzione e costo (tempo e token) e consigliane uno spiegando perché. Fanno eccezione le correzioni piccole e le richieste già precise.
2. **Richiesta vaga: chiedi.** Al massimo 3 domande: cosa deve succedere nel gioco, come si ottiene, come si capisce che funziona.
3. **Controllo continuo.** Se un approccio già usato nel progetto risulta obsoleto, inefficiente o superato da un'alternativa migliore, fermati e proponi il cambiamento con costi e benefici prima di andare avanti.
4. **Efficienza.** Passi piccoli e verificabili, modifiche mirate invece di riscrivere file interi, niente riletture di file già in contesto, niente ricerche sul web se la risposta è nella skill o nel repository. Una pull request, una cosa sola.
5. **Fonti dirette.** Nell'ordine: skill ufficiali Mojang, documentazione Microsoft (`learn.microsoft.com/minecraft/creator`), esempi Mojang, `wiki.bedrock.dev`. Video e post di terzi solo come spunto, e dillo quando li usi.
6. **Persona nuova.** Se chi ti scrive è nuovo o chiede come funziona il progetto, guidalo con la sezione "Inizia qui" di `README.md`, un passo alla volta.

## Regole tecniche

- **Namespace**: tutti gli identificativi iniziano con `coop:` (es. `coop:spada_fulmine`). Mai `minecraft:`.
- **UUID dei manifest**: non cambiarli mai. Cambiarli rompe i mondi che usano già l'add-on. Lo strumento `mct fix randomizealluids` è vietato.
- **Versioni dei pack**: se aumenti `header.version` di un pack, aggiorna anche la versione nella `dependencies` dell'altro pack, che deve combaciare.
- **Script API**: usa solo moduli **stabili** (`@minecraft/server` 2.11.0, la stessa in `package.json` e nel manifest). Niente versioni `beta`, a meno che il team lo decida: in quel caso ogni mondo deve attivare "Beta API" negli esperimenti, e va scritto qui.
- **Versione del gioco**: `min_engine_version` è `1.26.60`. Se Minecraft si aggiorna, controlla le nuove versioni con `npm view @minecraft/server dist-tags` e `npm view @minecraft/vanilla-data dist-tags`, poi aggiorna insieme manifest, `package.json` e questo file. Uno script con una versione di modulo che il gioco non conosce viene disattivato **senza errori visibili**.
- **Nomi visibili**: ogni blocco, oggetto o mob nuovo ha il suo nome in `texts/it_IT.lang` e in `texts/en_US.lang`. Senza, nel gioco compare `tile.coop:...name`.
- **Texture**: PNG 16×16 per blocchi e oggetti, registrate in `textures/terrain_texture.json` (blocchi) o `textures/item_texture.json` (oggetti).
- **Forma dei blocchi**: ogni blocco deve avere `minecraft:geometry` (per un cubo pieno: `"minecraft:geometry": "minecraft:geometry.full_block"`). Senza, il gioco scarta il blocco senza avvisi visibili: non compare nell'inventario e `/give` dà errore di sintassi. `npm run verify` **non** se ne accorge, l'errore compare solo nel registro dei contenuti del gioco.
- **Versione da alzare per provare**: Minecraft importa un pack solo se `header.version` è più alta di quella già installata; con la stessa versione l'importazione viene ignorata. Ogni pull request che cambia `addon/` alza la versione di entrambi i pack (vedi "Versioni dei pack").
- **Avvisi di sicurezza npm** (Dependabot, `npm audit`): arrivano dalle dipendenze di `@minecraft/creator-tools`, non dall'add-on (nel `.mcaddon` finisce solo `addon/`). Le versioni corrette sono imposte dalla sezione `overrides` di `package.json` (vedi "Aggiornare gli strumenti"). **Mai `npm audit fix --force`**: riporta `creator-tools` alla 0.15.6, senza skill, e rompe la verifica.
- **Generatori automatici**: i comandi `mct add` e lo strumento `createMinecraftContent` possono riscrivere i manifest. Dopo averli usati controlla `git diff` sui due `manifest.json` e ripristina UUID, nomi e dipendenze originali.
- **EULA di Minecraft**: non accettarla mai al posto dell'utente. Se un comando la chiede, digli di eseguire lui `npx -y @minecraft/creator-tools@0.21.0 eula`. Validazione ed export non ne hanno bisogno.
- Non lanciare come comandi bloccanti `mct view`, `mct serve` o `mct mcp`: restano attivi finché non vengono fermati.

## Provare l'add-on sul telefono

1. Ogni pull request produce un `.mcaddon` nella sezione Actions di GitHub; dopo il merge su `main` il file si aggiorna nella release **"ultima-versione"**.
2. Sul telefono: scarica `coop-space.mcaddon` e aprilo **con Minecraft chiuso**: lo importa da solo. Se il gioco è già aperto dentro un mondo, l'importazione viene ignorata senza nessun messaggio.
3. Crea un **mondo nuovo** per ogni versione da provare: Impostazioni del mondo → Pacchetti comportamento e Pacchetti risorse → attiva "Coop Space". Un mondo creato con una versione vecchia può continuare a usare quella.
4. Se qualcosa non funziona ma `npm run verify` passa, usa il **registro dei contenuti** (in inglese "Content Log"). L'utente vede il gioco in italiano: dagli questi nomi, non quelli inglesi.
   - Prima di entrare nel mondo: Impostazioni → **Creatore** → gruppo **Impostazioni registro dei contenuti** → attiva **Mostra l'interfaccia utente del registro dei contenuti** (in alcune schermate: "Abilita l'interfaccia grafica del registro dei contenuti") e, se c'è, **Mostra UI registro dei contenuti per errori di caricamento**.
   - Per leggere gli errori: Impostazioni → Creatore → **Cronologia registro dei contenuti** → **Visualizza** → **Copia negli appunti**, e fatti incollare il testo.
   - La skill `debug-addon` (file `references/content-log.md`) spiega come leggerlo.
5. Per sapere se un contenuto esiste davvero nel gioco: nel mondo, Pausa → Impostazioni → **Trucchi** → **Attiva i trucchi**, poi in chat `/give @s coop:<nome>`. Se dà errore di sintassi sull'ID, il gioco non lo conosce: il pack non è caricato oppure il contenuto è stato scartato (leggi il registro).

### Prova sul PC (Windows, Minecraft Bedrock 1.26)

Se l'assistente gira sul PC dove è installato Minecraft, può fare da solo i controlli sui file:

- **Importare**: con Minecraft chiuso, apri `dist/coop-space.mcaddon` (in PowerShell: `Start-Process`). Poi controlla che la versione nuova sia arrivata prima di far provare l'utente.
- **Pack installati**: `%APPDATA%\Minecraft Bedrock\Users\Shared\games\com.mojang\behavior_packs` e `resource_packs` (cartelle `CoopSpaceB`, `CoopSpaceR`; le versioni successive finiscono in `CoopSpaceB(1)`, ecc.). Le versioni vecchie restano accanto e confondono le prove: dopo una prova riuscita si possono eliminare, **controllando prima** nel loro `manifest.json` che siano davvero quelle vecchie, e solo con l'ok dell'utente.
- **Mondi**: `%APPDATA%\Minecraft Bedrock\Users\<numero>\games\com.mojang\minecraftWorlds\<cartella>`; `world_behavior_packs.json` dice quali pack e versioni usa il mondo.
- **Registro su file**: chiedi all'utente di attivare **Abilita file registro dei contenuti** (stesso gruppo in Impostazioni → Creatore). Il gioco scrive `%APPDATA%\Minecraft Bedrock\logs\ContentLog*.txt`. Se il file è vuoto, fai chiudere Minecraft e rileggilo. Cerca le righe con `[error]` o `[warning]` che citano `coop`.

## Aggiornare gli strumenti

Le skill ufficiali arrivano con il pacchetto `@minecraft/creator-tools`. Per aggiornarle basta alzare la sua versione in `package.json` e in `.mcp.json` (controlla con `npm view @minecraft/creator-tools version`), poi `npm install` e `npm run verify`. Funziona anche da una sessione cloud, perché usa solo npm.

**Versioni forzate (`overrides` in `package.json`).** `creator-tools` 0.21.0 fissava librerie con falle note (`axios`, `@modelcontextprotocol/sdk`, `@hono/node-server`, `zod`). Dal 15/11/2026 il progetto impone le versioni corrette, provate con: `npm ci`, `npm audit` (0 vulnerabilità), `npm run verify`, `npm run package` (`.mcaddon` identico a prima), `mct skills`, server MCP (20 strumenti, `validateFile`, `createMinecraftContent` con file identici a quelli prodotti con le versioni originali).
Quando aggiorni `creator-tools`: **togli tutta la sezione `overrides`**, poi `npm install` e `npm audit`. Rimetti solo le voci ancora necessarie, con l'ultima versione corretta, e rifai le stesse prove. Lasciate lì, le versioni forzate potrebbero imporre librerie più vecchie di quelle che la versione nuova si porta dietro.
