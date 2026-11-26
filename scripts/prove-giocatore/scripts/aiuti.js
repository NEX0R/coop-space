// Strumenti comuni per le prove da giocatore. Per una prova nuova crea un file in questa cartella
// (es. scavo.js), importa `prova` e gli aiuti da qui, e aggiungi il file agli import di main.js.
// Ogni prova usa una zona propria dentro x=32..47, y=100..110, z=0..15 (tenuta carica da prova-server).
import { system, ItemStack, EquipmentSlot } from "@minecraft/server";
import { spawnSimulatedPlayer } from "@minecraft/server-gametest";

export const attesa = (tick = 10) => new Promise((resolve) => system.runTimeout(resolve, tick));

// Aspetta che una condizione diventi vera, controllando ogni 2 tick, al massimo `massimoTick` (100 = 5 secondi).
// Da usare al posto di un'attesa fissa dopo un'azione: su una macchina lenta (GitHub) un'attesa fissa può non
// bastare e la prova fallirebbe per caso; così invece si va avanti appena il risultato c'è.
// Restituisce true se la condizione si è avverata; dopo, i controlli della prova spiegano cosa manca.
export async function aspettaFinche(condizione, massimoTick = 100) {
  for (let trascorsi = 0; trascorsi <= massimoTick; trascorsi += 2) {
    try {
      if (condizione()) return true;
    } catch {
      // la zona o l'entità non è ancora pronta: si riprova
    }
    await attesa(2);
  }
  return false;
}

// Zona autonoma: x=32..47, z=0..15; quella delle prove degli script è x=0..15.
export const ZONA = { x: 32, y: 100, z: 0 };
export const pos = (x, y, z) => ({ x: ZONA.x + x, y: ZONA.y + y, z: ZONA.z + z });
export const prove = [];
export function prova(nome, funzione) { prove.push({ nome, funzione }); }

export function pulisci(dim) {
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

