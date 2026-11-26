// Prove automatiche con un vero giocatore simulato (solo nel mondo usa-e-getta del server).
// Ogni prova scrive nel log "COOP-GIOCATORE <nome> OK|FALLITO|SALTATO ..."; alla fine "COOP-GIOCATORE FINE".
// Per aggiungerne una: importa `prova`, prepara una zona lontana dalle altre, crea il giocatore
// con `creaGiocatore`, fai le azioni e controlla i blocchi/inventario. Se manca qualcosa, lancia
// `throw new Error("atteso ...")`: il riepilogo mostrerà il motivo. L'assistente rimuove sempre
// il giocatore dopo ogni prova. Non copiare questo pack in addon/: Gametest è beta.
import { system, world, ItemStack, EquipmentSlot, GameMode, Direction } from "@minecraft/server";
import { spawnSimulatedPlayer } from "@minecraft/server-gametest";

const attesa = (tick = 10) => new Promise((resolve) => system.runTimeout(resolve, tick));

// Zona autonoma: x=32..47, z=0..15; quella delle prove degli script è x=0..15.
const ZONA = { x: 32, y: 100, z: 0 };
const pos = (x, y, z) => ({ x: ZONA.x + x, y: ZONA.y + y, z: ZONA.z + z });
const prove = [];
function prova(nome, funzione) { prove.push({ nome, funzione }); }

function pulisci(dim) {
  dim.runCommand(`fill ${ZONA.x} ${ZONA.y} ${ZONA.z} ${ZONA.x + 15} ${ZONA.y + 10} ${ZONA.z + 15} air`);
  for (const entita of dim.getEntities({ type: "minecraft:item", location: ZONA, volume: { x: 15, y: 10, z: 15 } })) entita.remove();
}

export function preparaBlocchi(dim, blocchi) {
  for (const { posizione, tipo } of blocchi) dim.setBlockType(posizione, tipo);
}

export function contaBlocchi(dim, tipo, da, volume) {
  let quanti = 0;
  for (let x = da.x; x <= da.x + volume.x; x++) {
    for (let y = da.y; y <= da.y + volume.y; y++) {
      for (let z = da.z; z <= da.z + volume.z; z++) {
        if (dim.getBlock({ x, y, z })?.typeId === tipo) quanti++;
      }
    }
  }
  return quanti;
}

export function contaOggetti(dim, tipo, da, volume) {
  return dim.getEntities({ type: "minecraft:item", location: da, volume })
    .reduce((totale, entita) => {
      const stack = entita.getComponent("minecraft:item")?.itemStack;
      return totale + (stack?.typeId === tipo ? stack.amount : 0);
    }, 0);
}

export function durataInMano(giocatore) {
  const oggetto = giocatore.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Mainhand);
  return oggetto?.getComponent("minecraft:durability")?.damage ?? 0;
}

export function creaGiocatore(dim, posizione, nome, modalita, oggetto, quantita = 1) {
  const giocatore = spawnSimulatedPlayer({ dimension: dim, ...posizione }, nome, modalita);
  if (oggetto) giocatore.setItem(new ItemStack(oggetto, quantita), 0, true);
  return giocatore;
}

prova("bacchetta_creativa", async ({ dim }) => {
  pulisci(dim);
  const pietra = pos(5, 0, 5);
  preparaBlocchi(dim, [{ posizione: pietra, tipo: "minecraft:stone" }]);
  const giocatore = creaGiocatore(dim, pos(5, 1, 8), "Prova bacchetta", GameMode.Creative, "coop:bacchetta_ferro");
  try {
    giocatore.lookAtBlock(pietra);
    await attesa(5);
    if (!giocatore.useItemOnBlock(new ItemStack("coop:bacchetta_ferro"), pietra, Direction.Up)) {
      throw new Error("useItemOnBlock non ha eseguito l'uso sulla pietra");
    }
    await attesa(10);
    const posizioni = [pos(5, 1, 5), pos(6, 1, 5), pos(5, 2, 5), pos(6, 2, 5)];
    const mancanti = posizioni.filter((p) => dim.getBlock(p)?.typeId !== "minecraft:stone");
    if (mancanti.length) throw new Error(`attesi 4 blocchi di pietra sopra il blocco base; ne mancano ${mancanti.length}`);
    return "4 blocchi costruiti in creativa";
  } finally {
    giocatore.remove();
  }
});

prova("bacchetta_sopravvivenza", async ({ dim }) => {
  pulisci(dim);
  const pietra = pos(10, 0, 5);
  preparaBlocchi(dim, [{ posizione: pietra, tipo: "minecraft:stone" }]);
  const giocatore = creaGiocatore(dim, pos(10, 1, 8), "Prova materiali", GameMode.Survival, "coop:bacchetta_ferro");
  try {
    giocatore.getComponent("minecraft:inventory")?.container?.setItem(1, new ItemStack("minecraft:stone", 2));
    giocatore.lookAtBlock(pietra);
    await attesa(5);
    const prima = durataInMano(giocatore);
    if (!giocatore.useItemOnBlock(new ItemStack("coop:bacchetta_ferro"), pietra, Direction.Up)) {
      throw new Error("useItemOnBlock non ha eseguito l'uso sulla pietra");
    }
    await attesa(10);
    const costruiti = contaBlocchi(dim, "minecraft:stone", pos(8, 1, 5), { x: 4, y: 1, z: 0 });
    const inventario = giocatore.getComponent("minecraft:inventory")?.container;
    const restanti = [0, 1, 2, 3, 4, 5, 6, 7, 8].reduce((totale, slot) => {
      const item = inventario?.getItem(slot);
      return totale + (item?.typeId === "minecraft:stone" ? item.amount : 0);
    }, 0);
    const dopo = durataInMano(giocatore);
    if (costruiti !== 2) throw new Error(`attesi 2 blocchi costruiti con 2 pietre, trovati ${costruiti}`);
    if (restanti !== 0) throw new Error(`attese 0 pietre nell'inventario, ne restano ${restanti}`);
    if (dopo !== prima + 1) throw new Error(`attesa durata +1, prima ${prima}, dopo ${dopo}`);
    return "costruiti 2 blocchi, pietre esaurite, durata +1";
  } finally {
    giocatore.remove();
  }
});

system.afterEvents.scriptEventReceive.subscribe(async (evento) => {
  if (evento.id !== "coop:prove_giocatore") return;
  if (world.getAllPlayers().length > 0) {
    console.warn("COOP-GIOCATORE prove_giocatore SALTATO: il mondo contiene giocatori veri");
    return;
  }
  const dim = world.getDimension("overworld");
  try {
    for (const { nome } of prove) {
      try {
        // Le funzioni registrate sono eseguite sotto, per passare gli strumenti comuni.
        await esegui(nome, dim);
      } catch (errore) {
        const dettaglio = errore?.message ?? String(errore);
        if (/not available|not supported|unsupported|gametest|beta api/i.test(dettaglio)) {
          console.warn(`COOP-GIOCATORE ${nome} SALTATO: giocatore simulato non disponibile (${dettaglio})`);
        } else {
          console.error(`COOP-GIOCATORE ${nome} FALLITO: ${dettaglio}`);
        }
      }
    }
  } catch (errore) {
    console.error(`COOP-GIOCATORE prove_giocatore FALLITO: ${errore?.message ?? errore}`);
  }
  console.warn("COOP-GIOCATORE FINE");
});

async function esegui(nome, dim) {
  const test = prove.find((p) => p.nome === nome);
  if (!test) throw new Error(`prova non registrata: ${nome}`);
  pulisci(dim);
  try {
    const dettaglio = await test.funzione({
      dim,
      origine: { ...ZONA },
      aspetta: attesa,
      creaGiocatore: (posizione, nomeGiocatore, modalita, oggetto, quantita) => creaGiocatore(dim, posizione, nomeGiocatore, modalita, oggetto, quantita),
      preparaBlocchi,
      contaBlocchi,
      contaOggetti,
      durataInMano,
    });
    console.warn(`COOP-GIOCATORE ${nome} OK${dettaglio ? ` (${dettaglio})` : ""}`);
  } finally {
    pulisci(dim);
  }
}
