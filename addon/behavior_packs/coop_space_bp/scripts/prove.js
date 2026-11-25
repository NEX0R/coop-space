// Pulsante di prova: il comando `/scriptevent coop:autotest` fa girare le prove registrate con
// `prova(...)`, anche senza giocatori. `npm run prova-server` lo preme da solo e legge l'esito.
// Nel gioco funziona solo con i trucchi attivi; `/scriptevent coop:autotest <nome>` fa una prova sola.
//
// Come si scrive una prova (in qualsiasi file di scripts/ importato da main.js):
//   import { prova } from "./prove.js";
//   prova("vena", async ({ dim, origine, aspetta }) => {
//     ...prepara i blocchi vicino a `origine`, chiama la tua funzione...
//     if (qualcosa non va) throw new Error("cosa si aspettava e cosa è successo");
//     return "dettaglio facoltativo";
//   });
// La zona di prova (16x11x16 blocchi da `origine`) viene svuotata prima di ogni prova.
import { system, world } from "@minecraft/server";

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
  for (const e of dim.getEntities({ type: "minecraft:item" })) e.remove();
}

system.afterEvents.scriptEventReceive.subscribe(async (evento) => {
  if (evento.id !== "coop:autotest") return;
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
