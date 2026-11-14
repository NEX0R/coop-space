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
.github/workflows/build.yml       build automatica e release "ultima-versione"
TASKS.md                          compiti e assegnazioni
```

Solo i file dentro `addon/` finiscono nel gioco. Non mettere altro lì dentro: il validatore lo segnala come errore.

## Come lavorare

1. All'inizio: `npm install` (se `node_modules/` manca), poi leggi `TASKS.md`.
2. Prima di creare o modificare contenuti, **leggi la skill ufficiale Mojang** adatta e seguila:
   `npx mct skills <nome>` (o `npm run skills -- <nome>`). Skill disponibili:
   - `create-block`: blocchi, minerali, luci
   - `create-item`: oggetti, armi, attrezzi, cibo, armature
   - `create-mob`: mob e creature
   - `design-model`: modelli 3D e texture in pixel art
   - `debug-addon`: trovare e correggere errori
   - `creator-tools-cli`: comandi dello strumento `mct`
   Se il server MCP `minecraft-creator-tools` è disponibile (vedi `.mcp.json`), usa i suoi strumenti come dicono le skill. Se non lo è, scrivi i file a mano seguendo la skill.
3. Lavora su un **ramo nuovo** e apri una **pull request** verso `main`. Mai push diretti su `main`.
4. **Un lavoro non è finito finché `npm run verify` non passa: 0 errori e 0 avvisi.** Correggi e rilancia finché non passa. Le voci "likely noise" sono accettate da Bedrock e non bloccano.
5. Aggiorna `TASKS.md`: sposta il compito nella sezione giusta e scrivi in una riga cosa hai fatto.
6. Nella descrizione della pull request spiega cosa cambia nel gioco e come provarlo.

## Regole tecniche

- **Namespace**: tutti gli identificativi iniziano con `coop:` (es. `coop:spada_fulmine`). Mai `minecraft:`.
- **UUID dei manifest**: non cambiarli mai. Cambiarli rompe i mondi che usano già l'add-on. Lo strumento `mct fix randomizealluids` è vietato.
- **Versioni dei pack**: se aumenti `header.version` di un pack, aggiorna anche la versione nella `dependencies` dell'altro pack, che deve combaciare.
- **Script API**: usa solo moduli **stabili** (`@minecraft/server` 2.11.0, la stessa in `package.json` e nel manifest). Niente versioni `beta`, a meno che il team lo decida: in quel caso ogni mondo deve attivare "Beta API" negli esperimenti, e va scritto qui.
- **Versione del gioco**: `min_engine_version` è `1.26.60`. Se Minecraft si aggiorna, controlla le nuove versioni con `npm view @minecraft/server dist-tags` e `npm view @minecraft/vanilla-data dist-tags`, poi aggiorna insieme manifest, `package.json` e questo file. Uno script con una versione di modulo che il gioco non conosce viene disattivato **senza errori visibili**.
- **Nomi visibili**: ogni blocco, oggetto o mob nuovo ha il suo nome in `texts/it_IT.lang` e in `texts/en_US.lang`. Senza, nel gioco compare `tile.coop:...name`.
- **Texture**: PNG 16×16 per blocchi e oggetti, registrate in `textures/terrain_texture.json` (blocchi) o `textures/item_texture.json` (oggetti).
- **Generatori automatici**: i comandi `mct add` e lo strumento `createMinecraftContent` possono riscrivere i manifest. Dopo averli usati controlla `git diff` sui due `manifest.json` e ripristina UUID, nomi e dipendenze originali.
- **EULA di Minecraft**: non accettarla mai al posto dell'utente. Se un comando la chiede, digli di eseguire lui `npx -y @minecraft/creator-tools@0.21.0 eula`. Validazione ed export non ne hanno bisogno.
- Non lanciare come comandi bloccanti `mct view`, `mct serve` o `mct mcp`: restano attivi finché non vengono fermati.

## Provare l'add-on sul telefono

1. Ogni pull request produce un `.mcaddon` nella sezione Actions di GitHub; dopo il merge su `main` il file si aggiorna nella release **"ultima-versione"**.
2. Sul telefono: scarica `coop-space.mcaddon` e aprilo, Minecraft lo importa da solo.
3. Nel mondo di prova: Impostazioni del mondo → Pacchetti comportamento e Pacchetti risorse → attiva "Coop Space".
4. Se qualcosa non funziona ma `npm run verify` passa: nel gioco, Impostazioni → Creatore → attiva "Content Log GUI", riapri il mondo e fatti incollare le righe che citano `coop`. La skill `debug-addon` (file `references/content-log.md`) spiega come leggerle.

## Aggiornare gli strumenti

Le skill ufficiali arrivano con il pacchetto `@minecraft/creator-tools`. Per aggiornarle basta alzare la sua versione in `package.json` e in `.mcp.json` (controlla con `npm view @minecraft/creator-tools version`), poi `npm install` e `npm run verify`. Funziona anche da una sessione cloud, perché usa solo npm.
