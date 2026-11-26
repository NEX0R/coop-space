# Aggiornare gli strumenti

Guida per gli assistenti. Leggila quando aggiorni gli strumenti di Mojang, quando Minecraft cambia versione o quando arrivano avvisi di sicurezza di npm.

## Strumenti Mojang (`@minecraft/creator-tools`)

Le skill ufficiali arrivano con il pacchetto `@minecraft/creator-tools`. Per aggiornarle basta alzare la sua versione in `package.json` e in `.mcp.json` (controlla con `npm view @minecraft/creator-tools version`), poi `npm install` e `npm run verify`. Funziona anche da una sessione cloud, perché usa solo npm.

**Controllo automatico mensile**: il 7 di ogni mese alle 9 (ora italiana) una routine cloud dell'account di Nexor confronta la versione di `creator-tools`. Se ce n'è una nuova, prepara l'aggiornamento con la procedura qui sotto e apre una pull request "Aggiorna gli strumenti Mojang a <versione>"; se le prove falliscono, apre invece un messaggio per tutti. Quella pull request va provata e approvata come le altre. Gestione: <https://claude.ai/code/routines/trig_013BpMMcqkMkNY3MDbDx1Luf>.

**Versioni forzate (`overrides` in `package.json`).** `creator-tools` 0.21.0 fissava librerie con falle note (`axios`, `@modelcontextprotocol/sdk`, `@hono/node-server`, `zod`). Dal 15/11/2026 il progetto impone le versioni corrette, provate con: `npm ci`, `npm audit` (0 vulnerabilità), `npm run verify`, `npm run package` (`.mcaddon` identico a prima), `mct skills`, server MCP (20 strumenti, `validateFile`, `createMinecraftContent` con file identici a quelli prodotti con le versioni originali).
Quando aggiorni `creator-tools`: **togli tutta la sezione `overrides`**, poi `npm install` e `npm audit`. Rimetti solo le voci ancora necessarie, con l'ultima versione corretta, e rifai le stesse prove. Lasciate lì, le versioni forzate potrebbero imporre librerie più vecchie di quelle che la versione nuova si porta dietro.

**Avvisi di sicurezza npm** (Dependabot, `npm audit`): arrivano dalle dipendenze di `creator-tools`, non dall'add-on (nel `.mcaddon` finisce solo `addon/`). **Mai `npm audit fix --force`**: riporta `creator-tools` alla 0.15.6, senza skill, e rompe la verifica.

## Versione di Minecraft

Oggi `min_engine_version` è `1.26.60` e gli script usano `@minecraft/server` 2.11.0 (stabile). Se Minecraft si aggiorna, controlla le nuove versioni con `npm view @minecraft/server dist-tags` e `npm view @minecraft/vanilla-data dist-tags`, poi aggiorna insieme i due `manifest.json`, `package.json` e le regole tecniche di `AGENTS.md`. Uno script con una versione di modulo che il gioco non conosce viene disattivato **senza errori visibili**: dopo l'aggiornamento controlla che in chat compaia ancora "Coop Space <versione> attivo.".
