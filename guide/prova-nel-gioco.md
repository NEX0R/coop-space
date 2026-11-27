# Provare l'add-on nel gioco

Guida per gli assistenti. Leggila quando la persona deve provare una modifica in Minecraft o quando qualcosa non funziona nel gioco. Alla persona dai sempre i nomi del menu **in italiano**, come li vede lei.

## Sul PC: il mondo "Coop Space - laboratorio" (`npm run prova-mc`)

Se lavori sul PC (Windows) dove c'è Minecraft, **non dare link da scaricare**: prepara tu il gioco.

- `npm run prova-mc -- <N>`: installa l'anteprima della pull request #N (la pubblica la build qualche minuto dopo il push; dopo la fusione non c'è più).
- `npm run prova-mc`: crea il pacchetto da `addon/` e installa quello (utile prima del push, o dopo la fusione).

Se Minecraft è aperto lo script **si ferma**: prima chiedi alla persona di uscire dal mondo (Salva ed esci) e chiudere il gioco, poi rilancia (oppure, se ti dice che è già fuori dal mondo, aggiungi `--chiudi`). Mai chiuderlo con la persona dentro: il 27/11 un laboratorio ha perso le zone non ancora salvate. Prima di toccare il laboratorio lo script ne salva una copia in `out/prova-mc/copie del laboratorio` (le ultime 3). Poi sostituisce i pack "Coop Space" installati con quelli nuovi (li riconosce dall'UUID), aggiorna l'add-on nel mondo fisso **"Coop Space - laboratorio"** (lo crea la prima volta), lo mette primo nella lista e avvia il gioco. La persona deve solo entrare nel primo mondo: in chat compare "Coop Space <versione> attivo.".

- Nel laboratorio **costruzioni e impostazioni restano** da una prova all'altra: cambia solo l'add-on dentro il mondo.
- `--mondo-nuovo` rifà il laboratorio da zero. **Solo quando serve davvero** (deciso da Nexor il 26/11): per le cose che nascono quando il mondo viene generato, cioè biomi, strutture, minerali e generazione naturale, impostazioni del mondo. Avvisa prima la persona che le costruzioni del laboratorio si perdono.
- `--pulisci` cancella i mondi di prova "Coop Space …" importati a mano (mai il laboratorio né i mondi della persona). `--non-avviare` installa senza aprire il gioco.
- Codici: 0 = pronto, 3 = non è stato possibile prepararlo (il messaggio dice perché).

Altre cose utili sul PC:

- **Pack installati**: `%APPDATA%\Minecraft Bedrock\Users\Shared\games\com.mojang\behavior_packs` e `resource_packs` (cartelle `CoopSpaceB`, `CoopSpaceR`).
- **Mondi**: `%APPDATA%\Minecraft Bedrock\Users\<numero>\games\com.mojang\minecraftWorlds\<cartella>` (il laboratorio è `coopLaboratorio`); `world_behavior_packs.json` dice quali pack e versioni usa il mondo.
- **Registro su file**: chiedi alla persona di attivare **Abilita file registro dei contenuti** (Impostazioni → Creatore → Impostazioni registro dei contenuti). Il gioco scrive `%APPDATA%\Minecraft Bedrock\logs\ContentLog*.txt`. Se il file è vuoto, fai chiudere Minecraft e rileggilo. Cerca le righe con `[error]` o `[warning]` che citano `coop`.

## Sul telefono: il mondo di prova

Ogni pull request pubblica un'**anteprima** (la pre-release `anteprima-pr-<N>`), aggiornata a ogni push e cancellata quando la pull request si chiude. Dopo la fusione i file stanno nella release **"ultima-versione"**. Il sito ha i pulsanti per tutte e due, anche nel gruppo "Prototipi".

1. **Modo consigliato: il mondo di prova** (`coop-space-mondo-prova.mcworld`): copia del mondo tutorial di Sangue Immortale (piatto, sopravvivenza, inventario che resta, coordinate visibili, trucchi attivi, nessun esperimento), con tutti i pack **già attivi**. Dopo pochi secondi si costruiscono da soli la piazza dei vampiri e, 15 secondi dopo, il quartiere Coop Space a est (strada di ghiaia dalla stazione 4). Per la creativa: `/gamemode creative`. In un mondo già esistente (come il laboratorio di `prova-mc`) i tutorial si costruiscono intorno a sé con `/scriptevent vamp:tutorial` e `/scriptevent coop:tutorial`. La persona lo apre **con Minecraft chiuso**: compare il mondo "Coop Space <versione>". Entrando, la chat deve dire "Coop Space <versione> attivo." (lo scrive `scripts/main.js`, la versione la mette `package.mjs`). Se il messaggio manca, la logica non è attiva.
   Link: `https://github.com/NEX0R/coop-space/releases/download/anteprima-pr-<N>/coop-space-mondo-prova.mcworld`
2. **Con l'add-on** (`coop-space.mcaddon`, per i mondi propri): aperto con Minecraft chiuso, poi in un **mondo nuovo** si attiva **"Coop Space" nei Pacchetti comportamento**; la grafica ("Coop Space - grafica") e Sangue Immortale (con la sua grafica) si aggiungono da soli. **Errore tipico**: attivare solo la grafica nei Pacchetti risorse lascia il mondo senza blocchi.
3. Un mondo creato con una versione vecchia continua a usare quella che ha dentro: **non riaprire mondi di prova vecchi**.
   - **"Impossibile importare… Pacchetto doppio rilevato"**: quella versione è già installata, anche se rovinata (per esempio dopo un'importazione interrotta). Ogni pacchetto ha una versione nuova, quindi basta scaricare di nuovo l'ultima.
   - **Pacchetti vecchi o rovinati**: Impostazioni → **Generale** → **Archiviazione** → **Pacchetti di comportamenti** (poi **Pacchetti di risorse**, e **Non valido** se c'è) → seleziona "Coop Space" → **Elimina**. Elimina anche i mondi di prova che li usavano. Fallo ogni tanto: ogni versione importata resta installata accanto alle altre.

## Quando qualcosa non funziona

1. **Esiste davvero?** Nel mondo: Pausa → Impostazioni → **Trucchi** → **Attiva i trucchi**, poi in chat `/give @s coop:<nome>`. Se dà errore di sintassi sull'identificativo, il gioco non lo conosce: il pack non è caricato oppure il contenuto è stato scartato.
2. **Registro dei contenuti** (in inglese "Content Log"), se `npm run verify` passa ma il gioco non va:
   - prima di entrare nel mondo: Impostazioni → **Creatore** → gruppo **Impostazioni registro dei contenuti** → attiva **Mostra l'interfaccia utente del registro dei contenuti** (in alcune schermate: "Abilita l'interfaccia grafica del registro dei contenuti") e, se c'è, **Mostra UI registro dei contenuti per errori di caricamento**;
   - per leggere gli errori: Impostazioni → Creatore → **Cronologia registro dei contenuti** → **Visualizza** → **Copia negli appunti**, e fatti incollare il testo;
   - la skill `debug-addon` (file `references/content-log.md`) spiega come leggerlo.
3. Problemi del gioco che non si vedono dai file: skill `debug-addon`.
