// Pulsante di prova: il comando `/scriptevent coop:autotest` fa girare le prove registrate con
// `prova(...)`. `npm run prova-server` lo preme da solo e legge l'esito.
// SICUREZZA: le prove svuotano una zona del mondo, quindi partono SOLO se nel mondo non c'è nessun
// giocatore (il server di prova). Nel gioco vero il comando viene rifiutato e non tocca niente.
//
// Come si scrive una prova (in qualsiasi file di scripts/ importato da main.js):
//   import { prova } from "./prove.js";
//   prova("vena", async ({ dim, origine, aspetta }) => {
//     ...prepara i blocchi vicino a `origine`, chiama la tua funzione...
//     if (qualcosa non va) throw new Error("cosa si aspettava e cosa è successo");
//     return "dettaglio facoltativo";
//   });
// La zona di prova (16x11x16 blocchi da `origine`) viene svuotata prima di ogni prova.
import { system, world, ItemStack } from "@minecraft/server";

const prove = [];
export function prova(nome, funzione) {
  prove.push({ nome, funzione });
}

// prova-server tiene caricata questa zona con `tickingarea`: senza, il mondo vuoto non la carica.
export const ORIGINE = { x: 0, y: 100, z: 0 };
const aspetta = (tick) => new Promise((fatto) => system.runTimeout(fatto, tick));

async function zonaPronta(dim) {
  for (let i = 0; i < 40; i++) {
    try {
      if (dim.getBlock(ORIGINE)) return true;
    } catch {
      // zona non ancora caricata
    }
    await aspetta(5);
  }
  return false;
}

function svuota(dim) {
  const { x, y, z } = ORIGINE;
  dim.runCommand(`fill ${x} ${y} ${z} ${x + 15} ${y + 10} ${z + 15} air`);
  // Solo gli oggetti a terra dentro la zona di prova.
  for (const e of dim.getEntities({ type: "minecraft:item", location: ORIGINE, volume: { x: 15, y: 10, z: 15 } })) e.remove();
}

system.afterEvents.scriptEventReceive.subscribe(async (evento) => {
  if (evento.id !== "coop:autotest") return;
  if (world.getAllPlayers().length > 0) {
    const avviso = "Il pulsante di prova funziona solo sul server di prova (npm run prova-server): in un mondo con giocatori cancellerebbe blocchi. Non ho toccato niente.";
    evento.sourceEntity?.sendMessage?.(`§e${avviso}`);
    console.warn(`COOP-TEST rifiutato: ${avviso}`);
    return;
  }
  const dim = world.getDimension("overworld");
  if (!(await zonaPronta(dim))) {
    console.error("COOP-TEST zona FALLITO: la zona di prova non si è caricata (manca tickingarea?)");
  } else {
    for (const { nome, funzione } of prove) {
      if (evento.message && evento.message !== nome) continue;
      try {
        svuota(dim);
        const dettaglio = await funzione({ dim, origine: { ...ORIGINE }, aspetta });
        console.warn(`COOP-TEST ${nome} OK${dettaglio ? ` (${dettaglio})` : ""}`);
      } catch (errore) {
        console.error(`COOP-TEST ${nome} FALLITO: ${errore?.message ?? errore}`);
      }
    }
  }
  console.warn(`COOP-TEST FINE (${prove.length} prove)`);
});

// Prova d'esempio: il blocco di ottone si piazza e si legge.
prova("blocco_ottone", async ({ dim, origine }) => {
  dim.setBlockType(origine, "coop:blocco_ottone");
  const tipo = dim.getBlock(origine)?.typeId;
  if (tipo !== "coop:blocco_ottone") throw new Error(`atteso coop:blocco_ottone, trovato ${tipo}`);
});

// Per npm run prova-server: `/scriptevent coop:esiste <id>` dice se lo script riesce a creare l'oggetto.
// Serve per gli oggetti nascosti (categoria "none"), che /give non accetta. Non tocca il mondo.
system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
  if (id !== "coop:esiste") return;
  const oggetto = message.trim();
  try {
    new ItemStack(oggetto, 1);
    console.warn(`COOP-ESISTE-SI ${oggetto}`);
  } catch {
    console.warn(`COOP-ESISTE-NO ${oggetto}`);
  }
});
