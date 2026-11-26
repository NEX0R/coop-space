// Prove da giocatore dello scavo multiplo (picconi, asce e pale): il giocatore simulato rompe davvero
// i blocchi, come una persona, e si controllano blocchi rotti, oggetti caduti e durata dell'attrezzo.
import { ItemStack, GameMode, Direction, EquipmentSlot } from "@minecraft/server";
import { prova, pos, attesa, aspettaFinche, ZONA, preparaBlocchi, contaBlocchi, contaOggetti, durataInMano, creaGiocatore } from "./aiuti.js";

// La scelta si imposta con il comando dell'add-on: le proprietà del giocatore sono separate per pack.
function scegli(giocatore, scelta) {
  giocatore.runCommand(`scriptevent coop:scavo_scelta ${JSON.stringify(scelta)}`);
}

// Pavimento di bedrock: non è adatto a nessun attrezzo, quindi lo scavo non lo tocca mai.
function pavimento(dim) {
  dim.runCommand(`fill ${ZONA.x} ${ZONA.y} ${ZONA.z} ${ZONA.x + 15} ${ZONA.y} ${ZONA.z + 15} bedrock`);
}

function blocchi(tipo, ...posizioni) {
  return posizioni.map(([x, y, z]) => ({ posizione: pos(x, y, z), tipo }));
}

// Oggetti di un tipo a terra nella zona + nell'inventario del giocatore (in sopravvivenza li raccoglie da solo).
function raccolti(dim, giocatore, tipo) {
  let totale = contaOggetti(dim, tipo, ZONA, { x: 15, y: 10, z: 15 });
  const inventario = giocatore.getComponent("minecraft:inventory")?.container;
  for (let i = 0; i < (inventario?.size ?? 0); i++) {
    const oggetto = inventario.getItem(i);
    if (oggetto?.typeId === tipo) totale += oggetto.amount;
  }
  return totale;
}

// Rompe un blocco come un giocatore: colpisce finché il blocco sparisce (massimo 10 s), poi aspetta che lo
// scavo multiplo abbia finito: cioè finché `fatto()` è vero, o al massimo 5 s.
async function rompi(dim, giocatore, blocco, faccia, fatto = () => false) {
  giocatore.lookAtBlock(blocco);
  await attesa(3);
  giocatore.breakBlock(blocco, faccia);
  await aspettaFinche(() => dim.getBlock(blocco)?.typeId === "minecraft:air", 200);
  giocatore.stopBreakingBlock();
  await aspettaFinche(fatto);
  await attesa(10); // ancora mezzo secondo: se rompesse troppi blocchi, la prova deve vederlo
}

prova("scavo_vena_carbone", async ({ dim }) => {
  pavimento(dim);
  // 4 carboni attaccati (l'ultimo solo in diagonale), 1 carbone staccato, pietra intorno.
  preparaBlocchi(dim, [
    ...blocchi("minecraft:coal_ore", [5, 1, 5], [6, 1, 5], [6, 2, 5], [7, 3, 6], [12, 1, 5]),
    ...blocchi("minecraft:stone", [4, 1, 5], [5, 2, 5], [7, 1, 5]),
  ]);
  const giocatore = creaGiocatore(dim, pos(5, 1, 8), "Prova vena", GameMode.Survival, "minecraft:iron_pickaxe");
  try {
    scegli(giocatore, { vena: true, forma: "un_blocco" });
    await attesa(2);
    await rompi(dim, giocatore, pos(5, 1, 5), Direction.South, () => contaBlocchi(dim, "minecraft:coal_ore", pos(0, 1, 0), { x: 15, y: 5, z: 15 }) <= 1);
    const carbone = contaBlocchi(dim, "minecraft:coal_ore", pos(0, 1, 0), { x: 15, y: 5, z: 15 });
    const pietra = contaBlocchi(dim, "minecraft:stone", pos(0, 1, 0), { x: 15, y: 5, z: 15 });
    const presi = raccolti(dim, giocatore, "minecraft:coal");
    const durata = durataInMano(giocatore);
    if (carbone !== 1) throw new Error(`atteso 1 carbone rimasto (quello staccato), ne restano ${carbone}`);
    if (pietra !== 3) throw new Error(`la pietra intorno non va toccata: attesi 3 blocchi, ne restano ${pietra}`);
    if (presi < 4) throw new Error(`attesi almeno 4 carboni caduti o raccolti, trovati ${presi}`);
    if (durata !== 4) throw new Error(`attesa durata 4 (1 colpo + 3 blocchi in più), trovata ${durata}`);
    return `4 carboni rotti, ${presi} raccolti, pietra intatta, durata ${durata}`;
  } finally {
    giocatore.remove();
  }
});

prova("scavo_muro_3x3", async ({ dim }) => {
  pavimento(dim);
  const muro = [];
  for (let x = 4; x <= 6; x++) for (let y = 1; y <= 3; y++) muro.push([x, y, 5]);
  preparaBlocchi(dim, [...blocchi("minecraft:stone", ...muro), ...blocchi("minecraft:dirt", [4, 3, 5])]);
  const giocatore = creaGiocatore(dim, pos(5, 1, 8), "Prova muro", GameMode.Creative, "minecraft:diamond_pickaxe");
  try {
    scegli(giocatore, { vena: false, forma: "muro", larghezza: 3, altezza: 3 });
    await attesa(2);
    await rompi(dim, giocatore, pos(5, 2, 5), Direction.South, () => contaBlocchi(dim, "minecraft:stone", pos(4, 1, 5), { x: 2, y: 2, z: 0 }) === 0);
    const pietra = contaBlocchi(dim, "minecraft:stone", pos(4, 1, 5), { x: 2, y: 2, z: 0 });
    const terra = contaBlocchi(dim, "minecraft:dirt", pos(4, 1, 5), { x: 2, y: 2, z: 0 });
    if (pietra !== 0) throw new Error(`il muro 3x3 doveva sparire: restano ${pietra} blocchi di pietra`);
    if (terra !== 1) throw new Error("il blocco di terra nel muro non andava rotto (tipo diverso)");
    return "8 pietre rotte, la terra resta";
  } finally {
    giocatore.remove();
  }
});

prova("scavo_limite_legno", async ({ dim }) => {
  pavimento(dim);
  const fila = [];
  for (let x = 2; x <= 11; x++) fila.push([x, 1, 5]);
  preparaBlocchi(dim, blocchi("minecraft:stone", ...fila));
  const giocatore = creaGiocatore(dim, pos(6, 1, 8), "Prova legno", GameMode.Survival, "minecraft:wooden_pickaxe");
  try {
    scegli(giocatore, { vena: true, forma: "un_blocco" });
    await attesa(2);
    await rompi(dim, giocatore, pos(6, 1, 5), Direction.South, () => contaBlocchi(dim, "minecraft:stone", pos(2, 1, 5), { x: 9, y: 0, z: 0 }) <= 6);
    const restano = contaBlocchi(dim, "minecraft:stone", pos(2, 1, 5), { x: 9, y: 0, z: 0 });
    if (restano !== 6) throw new Error(`il piccone di legno rompe al massimo 4 blocchi: dovevano restarne 6 su 10, ne restano ${restano}`);
    const durata = durataInMano(giocatore);
    if (durata !== 4) throw new Error(`attesa durata 4, trovata ${durata}`);
    return "4 blocchi su 10, durata 4";
  } finally {
    giocatore.remove();
  }
});

prova("scavo_normale_di_partenza", async ({ dim }) => {
  pavimento(dim);
  preparaBlocchi(dim, blocchi("minecraft:stone", [4, 1, 5], [5, 1, 5], [6, 1, 5]));
  // Nessuna scelta salvata: chi non apre mai il menu rompe un blocco alla volta, come sempre.
  const giocatore = creaGiocatore(dim, pos(5, 1, 8), "Prova normale", GameMode.Survival, "minecraft:iron_pickaxe");
  try {
    await rompi(dim, giocatore, pos(5, 1, 5), Direction.South);
    const restano = contaBlocchi(dim, "minecraft:stone", pos(4, 1, 5), { x: 2, y: 0, z: 0 });
    if (restano !== 2) throw new Error(`senza scelta deve rompersi 1 blocco solo: restano ${restano} su 3`);
    return "1 blocco rotto, gli altri 2 restano";
  } finally {
    giocatore.remove();
  }
});

prova("scavo_attrezzo_che_si_rompe", async ({ dim }) => {
  pavimento(dim);
  preparaBlocchi(dim, blocchi("minecraft:stone", [4, 1, 5], [5, 1, 5], [6, 1, 5], [7, 1, 5], [8, 1, 5]));
  const giocatore = creaGiocatore(dim, pos(6, 1, 8), "Prova rottura", GameMode.Survival);
  try {
    // Piccone di ferro a un colpo dalla fine: il colpo normale lo rompe e lo scavo non deve continuare.
    const piccone = new ItemStack("minecraft:iron_pickaxe");
    const durabilita = piccone.getComponent("minecraft:durability");
    durabilita.damage = durabilita.maxDurability;
    giocatore.setItem(piccone, 0, true);
    scegli(giocatore, { vena: true, forma: "un_blocco" });
    await attesa(2);
    await rompi(dim, giocatore, pos(6, 1, 5), Direction.South);
    const restano = contaBlocchi(dim, "minecraft:stone", pos(4, 1, 5), { x: 4, y: 0, z: 0 });
    const inMano = giocatore.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Mainhand);
    // In mano può finire il pietrisco raccolto da terra: conta solo che il piccone non ci sia più.
    if (inMano?.typeId === "minecraft:iron_pickaxe") throw new Error(`il piccone doveva rompersi, in mano c'è ancora ${inMano.typeId} (danno ${inMano.getComponent("minecraft:durability")?.damage}/${inMano.getComponent("minecraft:durability")?.maxDurability}, pietre rimaste ${restano})`);
    if (restano !== 4) throw new Error(`con il piccone rotto lo scavo si ferma: dovevano restare 4 pietre, ne restano ${restano}`);
    return "piccone rotto al primo colpo, nessun blocco in più";
  } finally {
    giocatore.remove();
  }
});

