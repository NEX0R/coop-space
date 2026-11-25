// Script principale del behavior pack.
// Usa solo l'API stabile di @minecraft/server: non servono esperimenti nel mondo.
import { world } from "@minecraft/server";
// Pulsante di prova (/scriptevent coop:autotest): vedi prove.js.
import "./prove.js";

// npm run package sostituisce questo segnaposto con la versione del pacchetto (es. "0.320.1024").
const VERSIONE = "__VERSIONE_COOP__";

// Appena un giocatore entra nel mondo scriviamo in chat quale versione è attiva.
// Se il messaggio non compare, la logica di Coop Space non è attiva nel mondo.
world.afterEvents.playerSpawn.subscribe((event) => {
  if (event.initialSpawn) {
    event.player.sendMessage(`§aCoop Space ${VERSIONE} attivo.`);
  }
});

// Quando un giocatore piazza il blocco di prova, gli mandiamo un messaggio in chat.
// Serve a confermare che gli script dell'add-on sono attivi.
world.afterEvents.playerPlaceBlock.subscribe((event) => {
  if (event.block.typeId === "coop:blocco_prova") {
    event.player.sendMessage("§aCoop Space funziona! Gli script sono attivi.");
  }
});
