// Tutorial di Coop Space: un quartiere con 4 stazioni (bacchette e scavo multiplo), costruito come
// la mappa tutorial di Sangue Immortale (scripts/tutorial.js del pack di Jowa): pavimento, lanterne,
// cartelli in fila, una cassa con gli oggetti e una prova pronta da usare.
//   - Nel mondo tutorial (piatto, con uno strato di ardesia profonda sotto la terra: lo stesso segno
//     che usa Sangue Immortale) si costruisce da solo la prima volta, a est della piazza dei vampiri,
//     con una strada di ghiaia che parte dalla stazione 4 di Jowa.
//   - In qualsiasi altro mondo: /scriptevent coop:tutorial  (lo costruisce intorno a te).
// Pianta del quartiere (Q = centro):
//      1 Bacchette        2 Menu della bacchetta
//                  PIAZZA Q   <- strada dalla piazza di Sangue Immortale
//      4 Forme dello scavo  3 Scavo multiplo
// Solo API stabili: @minecraft/server 2.11.0.
import { world, system, ItemStack } from "@minecraft/server";
import { prova } from "./prove.js";

const FATTO = "coop:tutorial_fatto";
const v3 = (x, y, z) => ({ x, y, z });
const somma = (a, b) => v3(a.x + b.x, a.y + b.y, a.z + b.z);
const cmd = (dim, c) => {
  try {
    dim.runCommand(c);
    return true;
  } catch {
    return false;
  }
};
const riempi = (dim, a, b, blocco, modo = "") => cmd(dim, `fill ${a.x} ${a.y} ${a.z} ${b.x} ${b.y} ${b.z} ${blocco}${modo ? " " + modo : ""}`);
const metti = (dim, l, blocco) => cmd(dim, `setblock ${l.x} ${l.y} ${l.z} ${blocco}`);

/** cartello con lo stesso testo davanti e dietro, come nel tutorial di Jowa */
function cartello(dim, l, testo) {
  metti(dim, l, "standing_sign");
  try {
    const s = dim.getBlock(l)?.getComponent("minecraft:sign");
    s?.setText(testo, "Front");
    s?.setText(testo, "Back");
    s?.setWaxed?.(true);
  } catch {}
}
function cassa(dim, l, oggetti) {
  metti(dim, l, "chest");
  let c;
  try {
    c = dim.getBlock(l)?.getComponent("minecraft:inventory")?.container;
  } catch {}
  for (const [id, n] of oggetti) {
    try {
      c?.addItem(new ItemStack(id, n));
    } catch {}
  }
}

const BACCHETTE = ["legno", "pietra", "rame", "ferro", "oro", "diamante", "netherite"].map((m) => [`coop:bacchetta_${m}`, 1]);
const BLOCCHI = [["minecraft:stone_bricks", 64], ["minecraft:oak_planks", 64], ["minecraft:glass", 64]];

// dx, dz: posizione rispetto al centro del quartiere. Le prove (oltre) controllano casse, cartelli e prove pronte.
export const STAZIONI = [
  {
    dx: -14, dz: -14, colore: "lime_concrete",
    titolo: "§a§l1 Bacchette\n§a§lda\n§a§lcostruzione",
    cartelli: [
      "Tocca un blocco\ncon la\nbacchetta:\ncostruisce",
      "Scintille §averdi§r:\nanteprima di\ndove mette\ni blocchi",
      "Più forte, più\nblocchi: legno 4\npietra 9, rame\n16, ferro 27",
      "oro 64\ndiamante 128\nnetherite 225\nlati fino a 15",
    ],
    oggetti: [...BACCHETTE, ...BLOCCHI],
    // un muretto di quarzo su cui costruire
    extra: (dim, c, lontano) => riempi(dim, v3(c.x - 3, c.y, c.z + lontano * 3), v3(c.x + 3, c.y, c.z + lontano * 3), "quartz_block"),
    prova: (dim, c, lontano) => dim.getBlock(v3(c.x, c.y, c.z + lontano * 3))?.typeId === "minecraft:quartz_block",
  },
  {
    dx: 14, dz: -14, colore: "lime_concrete",
    titolo: "§a§l2 Menu della\n§a§lbacchetta",
    cartelli: [
      "Accovacciati e\ntocca un blocco\n(o tocca in\naria): menu",
      "9 modi: muro,\npavimento,\ncolonne, scale,\nfino a me...",
      "§aDa X a Y§r: tocca\nil primo blocco\n(X), poi il\nsecondo (Y)",
      "§aAnnulla§r: toglie\nl'ultima\ncostruzione",
      "Sopravvivenza:\nusa i blocchi\nche hai e 1 di\ndurata a colpo",
    ],
    oggetti: [["coop:bacchetta_ferro", 1], ["coop:bacchetta_diamante", 1], ...BLOCCHI],
    // due colonne di pietra: prova "Da X a Y" tra le due
    extra: (dim, c, lontano) => {
      riempi(dim, v3(c.x - 3, c.y, c.z + lontano * 3), v3(c.x - 3, c.y + 2, c.z + lontano * 3), "polished_andesite");
      riempi(dim, v3(c.x + 3, c.y, c.z + lontano * 3), v3(c.x + 3, c.y + 2, c.z + lontano * 3), "polished_andesite");
    },
    prova: (dim, c, lontano) =>
      dim.getBlock(v3(c.x - 3, c.y + 2, c.z + lontano * 3))?.typeId === "minecraft:polished_andesite" &&
      dim.getBlock(v3(c.x + 3, c.y + 2, c.z + lontano * 3))?.typeId === "minecraft:polished_andesite",
  },
  {
    dx: 14, dz: 14, colore: "red_concrete",
    titolo: "§c§l3 Scavo\n§c§lmultiplo",
    cartelli: [
      "Piccone, ascia\no pala:\naccovacciati e\ntocca = menu",
      "§cVena§r SÌ: rompi\nun blocco e\nviene via tutta\nla vena uguale",
      "Prova: vena di\nferro nella\npietra, albero\ncon l'ascia",
      "Fortuna e Tocco\ndi velluto\nvalgono. 1 di\ndurata a blocco",
    ],
    oggetti: [["minecraft:iron_pickaxe", 1], ["minecraft:diamond_pickaxe", 1], ["minecraft:diamond_axe", 1], ["minecraft:diamond_shovel", 1]],
    // collinetta di pietra con una vena di ferro che si vede, e un albero da tagliare
    extra: (dim, c, lontano) => {
      const z = c.z + lontano * 3;
      riempi(dim, v3(c.x - 4, c.y, z - 1), v3(c.x - 1, c.y + 2, z + 1), "stone");
      for (const [x, y] of [[-4, 0], [-3, 0], [-3, 1], [-2, 1], [-2, 2], [-1, 2]]) metti(dim, v3(c.x + x, c.y + y, z - lontano), "iron_ore");
      riempi(dim, v3(c.x + 1, c.y + 3, z - 1), v3(c.x + 4, c.y + 4, z + 1), "oak_leaves");
      riempi(dim, v3(c.x + 2, c.y + 5, z), v3(c.x + 3, c.y + 5, z), "oak_leaves");
      riempi(dim, v3(c.x + 3, c.y, z), v3(c.x + 3, c.y + 4, z), "oak_log");
    },
    prova: (dim, c, lontano) =>
      dim.getBlock(v3(c.x - 2, c.y + 1, c.z + lontano * 3 - lontano))?.typeId === "minecraft:iron_ore" &&
      dim.getBlock(v3(c.x + 3, c.y + 4, c.z + lontano * 3))?.typeId === "minecraft:oak_log",
  },
  {
    dx: -14, dz: 14, colore: "red_concrete",
    titolo: "§c§l4 Forme\n§c§ldello scavo",
    cartelli: [
      "Nel menu: muro,\npavimento,\ncolonna, tunnel,\nscale, blocco",
      "Rompe solo i\nblocchi §cuguali§r\na quello che\ncolpisci",
      "Massimo come le\nbacchette: pietra\n9, ferro 27,\ndiamante 128",
      "Scintille §crosse§r:\nanteprima di\ncosa rompi",
    ],
    oggetti: [["minecraft:stone_pickaxe", 1], ["minecraft:iron_pickaxe", 1], ["minecraft:diamond_pickaxe", 1], ["minecraft:netherite_pickaxe", 1], ["minecraft:diamond_shovel", 1]],
    // un blocco di pietra per tunnel e scale, e uno di sabbia per la pala
    extra: (dim, c, lontano) => {
      const z = c.z + lontano * 3;
      riempi(dim, v3(c.x - 4, c.y, z - 1), v3(c.x, c.y + 4, z + 1), "stone");
      riempi(dim, v3(c.x + 2, c.y, z - 1), v3(c.x + 4, c.y + 2, z + 1), "sand");
    },
    prova: (dim, c, lontano) =>
      dim.getBlock(v3(c.x - 2, c.y + 4, c.z + lontano * 3))?.typeId === "minecraft:stone" &&
      dim.getBlock(v3(c.x + 3, c.y + 2, c.z + lontano * 3))?.typeId === "minecraft:sand",
  },
];

/**
 * Una stazione con il centro in c. `verso` = da che parte sta la piazza (+1 o -1 sull'asse z):
 * cartelli e cassa da quella parte, la prova pronta dalla parte opposta (`lontano`).
 */
export function costruisciStazione(dim, c, st, verso) {
  const lontano = -verso;
  riempi(dim, v3(c.x - 5, c.y, c.z - 5), v3(c.x + 5, c.y + 6, c.z + 5), "air");
  riempi(dim, v3(c.x - 5, c.y - 1, c.z - 5), v3(c.x + 5, c.y - 1, c.z + 5), "stone_bricks");
  riempi(dim, v3(c.x - 1, c.y - 1, c.z - 1), v3(c.x + 1, c.y - 1, c.z + 1), st.colore);
  for (const [dx, dz] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) {
    metti(dim, v3(c.x + dx, c.y, c.z + dz), "stone_brick_wall");
    metti(dim, v3(c.x + dx, c.y + 1, c.z + dz), "lantern");
  }
  const tutti = [st.titolo, ...st.cartelli];
  const zCartelli = c.z + verso * 4;
  const inizio = c.x - Math.floor(tutti.length / 2);
  tutti.forEach((t, i) => cartello(dim, v3(inizio + i, c.y, zCartelli), t));
  const cassaIn = v3(inizio + tutti.length + 1, c.y, zCartelli);
  cassa(dim, cassaIn, st.oggetti);
  try {
    st.extra(dim, c, lontano);
  } catch (e) {
    console.warn(`[coop tutorial] ${e}`);
  }
  return { cassa: cassaIn, primoCartello: v3(inizio, c.y, zCartelli), lontano };
}

/** il quartiere intero con il centro in q (q.y = primo blocco d'aria sopra il terreno) */
export function costruisciQuartiere(dim, q) {
  riempi(dim, v3(q.x - 20, q.y, q.z - 20), v3(q.x + 20, q.y + 6, q.z + 20), "air");
  riempi(dim, v3(q.x - 5, q.y - 1, q.z - 5), v3(q.x + 5, q.y - 1, q.z + 5), "smooth_stone");
  riempi(dim, v3(q.x - 1, q.y - 1, q.z - 1), v3(q.x + 1, q.y - 1, q.z + 1), "lime_concrete");
  for (const [dx, dz] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) {
    metti(dim, v3(q.x + dx, q.y, q.z + dz), "cobblestone_wall");
    metti(dim, v3(q.x + dx, q.y + 1, q.z + dz), "lantern");
  }
  cartello(dim, v3(q.x, q.y, q.z - 3), "§a§lCOOP SPACE\n§rTutorial");
  cartello(dim, v3(q.x - 1, q.y, q.z - 3), "Bacchette:\nstazioni 1 e 2\n(verso nord)");
  cartello(dim, v3(q.x + 1, q.y, q.z - 3), "Scavo multiplo:\nstazioni 3 e 4\n(verso sud)");
  cassa(dim, v3(q.x + 2, q.y, q.z + 3), [["coop:bacchetta_diamante", 1], ["minecraft:diamond_pickaxe", 1], ["minecraft:stone_bricks", 64]]);
  cartello(dim, v3(q.x, q.y, q.z + 3), "Cassa: una\nbacchetta e un\npiccone per\niniziare");
  for (const st of STAZIONI) {
    try {
      costruisciStazione(dim, v3(q.x + st.dx, q.y, q.z + st.dz), st, -Math.sign(st.dz));
      // vialetto di ghiaia dalla piazza alla stazione
      for (let k = 6; k <= 8; k++) metti(dim, v3(q.x + Math.sign(st.dx) * k, q.y - 1, q.z + Math.sign(st.dz) * k), "gravel");
    } catch (e) {
      console.warn(`[coop tutorial] ${e}`);
    }
  }
}

// ---------------------------------------------------------------- nel mondo tutorial
// Stesso segno del mondo di Sangue Immortale: bedrock, ardesia profonda, terra sotto (0, 0).
export function eMondoTutorial(dim) {
  const t = (y) => {
    try {
      return dim.getBlock(v3(0, y, 0))?.typeId;
    } catch {
      return undefined;
    }
  };
  return t(-64) === "minecraft:bedrock" && t(-63) === "minecraft:deepslate" && t(-62) === "minecraft:dirt";
}

const PIAZZA = v3(0, -59, 0); // la piazza di Sangue Immortale
const QUARTIERE = v3(110, -59, 0); // fuori dai 62 blocchi che il tutorial di Jowa svuota e lontano dai suoi villaggi

function avvisa(player) {
  try {
    player.sendMessage("§a[Coop Space]§r Il quartiere delle §abacchette§r e dello §cscavo multiplo§r è pronto: dalla piazza segui la §fstrada di ghiaia§r che passa per la stazione 4 e va avanti dritta (x 110).");
  } catch {}
}

/** costruisce il quartiere nel mondo tutorial, dopo che Sangue Immortale ha costruito il suo (che svuota la zona intorno alla piazza) */
function avviaNelTutorial(player, tentativi = 0) {
  if (world.getDynamicProperty(FATTO) || !player.isValid) return; // uscito dal mondo nel frattempo
  const dim = player.dimension;
  if (!eMondoTutorial(dim)) return;
  cmd(dim, `tickingarea add 20 -65 -24 140 -49 24 coop_tutorial true`);
  // la zona si carica in qualche tick: riprova finché il centro del quartiere non è leggibile
  let pronto = false;
  try {
    pronto = !!dim.getBlock(QUARTIERE);
  } catch {}
  if (!pronto) {
    if (tentativi < 30) system.runTimeout(() => avviaNelTutorial(player, tentativi + 1), 20);
    return;
  }
  world.setDynamicProperty(FATTO, true);
  costruisciQuartiere(dim, QUARTIERE);
  // strada di ghiaia dalla stazione 4 di Jowa (x 15-25) alla piazza del quartiere, e un cartello in piazza
  for (let x = 26; x < QUARTIERE.x - 5; x++) metti(dim, v3(x, PIAZZA.y - 1, 0), "gravel");
  cartello(dim, v3(4, PIAZZA.y, 0), "§a§lCOOP SPACE\n§rbacchette e\nscavo: strada\noltre la staz. 4");
  cartello(dim, v3(QUARTIERE.x - 7, PIAZZA.y, 1), "§a§lCOOP SPACE\n§rbacchette e\nscavo multiplo");
  avvisa(player);
}

world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
  if (!initialSpawn || world.getDynamicProperty(FATTO)) return;
  // 15 secondi: Sangue Immortale costruisce piazza e stazioni dopo 6 secondi e i villaggi entro 13
  system.runTimeout(() => {
    try {
      avviaNelTutorial(player);
    } catch (e) {
      console.warn(`[coop tutorial] ${e}`);
    }
  }, 300);
});

system.afterEvents.scriptEventReceive.subscribe(({ id, sourceEntity }) => {
  if (id !== "coop:tutorial" || sourceEntity?.typeId !== "minecraft:player") return;
  const l = sourceEntity.location;
  const q = v3(Math.floor(l.x), Math.floor(l.y), Math.floor(l.z));
  system.run(() => {
    costruisciQuartiere(sourceEntity.dimension, q);
    try {
      sourceEntity.sendMessage("§a[Coop Space]§r Tutorial costruito intorno a te: 4 stazioni, bacchette (1 e 2) e scavo multiplo (3 e 4).");
    } catch {}
  });
});

// ---------------------------------------------------------------- prove automatiche (npm run prova-server)
// Ogni stazione entra nella zona di prova (16x11x16): centro a 7 blocchi dall'origine.
for (const [i, st] of STAZIONI.entries()) {
  prova(`tutorial_stazione_${i + 1}`, async ({ dim, origine }) => {
    const c = somma(origine, v3(7, 1, 7));
    const r = costruisciStazione(dim, c, st, -Math.sign(st.dz));
    const contenitore = dim.getBlock(r.cassa)?.getComponent("minecraft:inventory")?.container;
    if (!contenitore) throw new Error("la cassa non c'è");
    const dentro = [];
    for (let s = 0; s < contenitore.size; s++) {
      const o = contenitore.getItem(s);
      if (o) dentro.push(o.typeId);
    }
    const mancano = st.oggetti.map(([id]) => id).filter((id) => !dentro.includes(id));
    if (mancano.length) throw new Error(`nella cassa mancano: ${mancano.join(", ")}`);
    const testo = dim.getBlock(r.primoCartello)?.getComponent("minecraft:sign")?.getText("Front");
    if (!testo || !testo.includes(st.titolo.split("\n")[0])) throw new Error(`il cartello del titolo dice "${testo}"`);
    for (let k = 0; k < st.cartelli.length; k++) {
      const t = dim.getBlock(somma(r.primoCartello, v3(k + 1, 0, 0)))?.getComponent("minecraft:sign")?.getText("Front");
      if (t !== st.cartelli[k]) throw new Error(`il cartello ${k + 2} dice "${t}"`);
    }
    if (!st.prova(dim, c, r.lontano)) throw new Error("la prova pronta (blocchi da usare) non è stata costruita");
    return `${dentro.length} oggetti, ${st.cartelli.length + 1} cartelli`;
  });
}
