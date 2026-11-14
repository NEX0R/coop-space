// Script principale del behavior pack.
// Usa solo l'API stabile di @minecraft/server: non servono esperimenti nel mondo.
import { world } from "@minecraft/server";

// Quando un giocatore piazza il blocco di prova, gli mandiamo un messaggio in chat.
// Serve a confermare che gli script dell'add-on sono attivi.
world.afterEvents.playerPlaceBlock.subscribe((event) => {
  if (event.block.typeId === "coop:blocco_prova") {
    event.player.sendMessage("§aCoop Space funziona! Gli script sono attivi.");
  }
});
