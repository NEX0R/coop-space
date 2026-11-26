// Prove da giocatore della bacchetta da costruzione.
import { ItemStack, GameMode, Direction } from "@minecraft/server";
import { prova, pos, attesa, aspettaFinche, preparaBlocchi, contaBlocchi, durataInMano, creaGiocatore } from "./aiuti.js";

prova("bacchetta_creativa", async ({ dim }) => {
  const pietra = pos(5, 0, 5);
  preparaBlocchi(dim, [{ posizione: pietra, tipo: "minecraft:stone" }]);
  const giocatore = creaGiocatore(dim, pos(5, 1, 8), "Prova bacchetta", GameMode.Creative, "coop:bacchetta_ferro");
  try {
    giocatore.lookAtBlock(pietra);
    await attesa(5);
    if (!giocatore.useItemOnBlock(new ItemStack("coop:bacchetta_ferro"), pietra, Direction.Up)) {
      throw new Error("useItemOnBlock non ha eseguito l'uso sulla pietra");
    }
    const posizioni = [pos(5, 1, 5), pos(6, 1, 5), pos(5, 2, 5), pos(6, 2, 5)];
    const mancano = () => posizioni.filter((p) => dim.getBlock(p)?.typeId !== "minecraft:stone");
    await aspettaFinche(() => mancano().length === 0);
    const mancanti = mancano();
    if (mancanti.length) throw new Error(`attesi 4 blocchi di pietra sopra il blocco base; ne mancano ${mancanti.length}`);
    return "4 blocchi costruiti in creativa";
  } finally {
    giocatore.remove();
  }
});

prova("bacchetta_sopravvivenza", async ({ dim }) => {
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
    const costruitiOra = () => contaBlocchi(dim, "minecraft:stone", pos(8, 1, 5), { x: 4, y: 1, z: 0 });
    await aspettaFinche(() => costruitiOra() >= 2 && durataInMano(giocatore) > prima);
    await attesa(10); // ancora mezzo secondo: se costruisse più di 2 blocchi, la prova deve vederlo
    const costruiti = costruitiOra();
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

