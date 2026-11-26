# Confronto delle tecniche (per chi fa già add-on)

Guida per gli assistenti. Usala durante l'accoglienza di una persona che crea già add-on per conto suo, oppure quando il gruppo vuole sapere se un suo modo di lavorare è migliore del nostro.

**Lo scopo** è doppio: prendere dalla persona quello che fa meglio di noi, e darle i nostri strumenti dove le fanno risparmiare tempo. Non è un esame: nel messaggio finale si scrivono prima le cose che fa bene.

## Come si fa

1. **Chiedi il permesso** e dove tiene i suoi add-on (una cartella sul PC, un file `.mcaddon`, un repository). Guarda solo i file degli add-on, nient'altro.
2. Se la persona non sa rispondere a una domanda, guarda tu nei file. Chiedi solo quello che dai file non si capisce.
3. Confronta i 10 punti qui sotto con il nostro metodo (`AGENTS.md`). Per ogni punto: cosa fa lei, cosa facciamo noi, chi fa meglio e perché, con la fonte (skill Mojang o documentazione Microsoft) quando c'è.
4. Scrivi il risultato in un messaggio `Per tutti: come lavora <soprannome>` (`guide/messaggi.md`). **Nessun dato personale**: niente percorsi delle sue cartelle, nomi veri o nomi di account.
5. Riferisci alla persona il messaggio con parole semplici. Le proposte di cambiare il nostro metodo le decide il gruppo: nel messaggio sono proposte, non modifiche.

## I 10 punti

1. **Strumenti**: con cosa scrive i file (editor, app come bridge., Blockbench, generatori online, un'IA) e da dove lavora (PC, telefono).
2. **Struttura**: behavior pack e resource pack separati, `manifest.json` con UUID fissi, dipendenza dal behavior pack al resource pack (mai il contrario).
3. **Guide**: segue le guide ufficiali (skill Mojang, `learn.microsoft.com/minecraft/creator`) o tutorial di terzi, e di che anno.
4. **Controlli**: usa un validatore (come il nostro `npm run verify`) o scopre gli errori solo nel gioco.
5. **Identificativi**: usa un suo namespace (noi `coop:`) e mai `minecraft:` per le cose nuove.
6. **Versioni**: `format_version`, `min_engine_version`, versione dei moduli degli script (stabili o beta), esperimenti attivi nei mondi. Le versioni beta e gli esperimenti si rompono a ogni aggiornamento di Minecraft.
7. **Come prova**: come porta l'add-on nel gioco, quanto tempo ci mette a ogni modifica, se usa le cartelle di sviluppo (`development_behavior_packs`) o il comando `/reload`, se tiene un mondo fisso.
8. **Grafica**: dimensioni delle texture, modelli 3D e animazioni, come li fa.
9. **Nomi e lingue**: file `.lang` in italiano e inglese, componente `minecraft:display_name` per gli oggetti.
10. **Copie e condivisione**: come salva le versioni e come torna indietro se rompe qualcosa (copie a mano, zip, git).

## Il messaggio

```
Per tutti: come lavora <soprannome>

Cosa fa bene (da prendere anche noi):
- …

Cosa dei nostri strumenti gli fa risparmiare tempo:
- …

Proposte per il nostro metodo (da decidere insieme):
- …

— assistente di <soprannome> (Claude Code / Codex)
```
