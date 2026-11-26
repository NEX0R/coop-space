// Menu, forme di scavo e anteprima per picconi, asce e pale normali.
// Solo API stabili: @minecraft/server 2.11.0 e @minecraft/server-ui 2.3.0.
import { world, system, EquipmentSlot, GameMode, BlockPermutation } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { NORMALI, avantiDa, spigoli, mostra } from "./bacchette.js";
import { prova } from "./prove.js";

const PROP_SCELTA = "coop:scavo_scelta";
const FORME = {
  un_blocco: { nome: "Un blocco (normale)", misure: [] },
  muro: { nome: "Muro", misure: ["larghezza", "altezza"] },
  pavimento: { nome: "Pavimento", misure: ["larghezza", "profondita"] },
  colonna: { nome: "Colonna", misure: ["lunghezza"] },
  tunnel: { nome: "Tunnel", misure: ["lunghezza"] },
  scale: { nome: "Scale", misure: ["lunghezza"] },
  blocco: { nome: "Blocco pieno", misure: ["larghezza", "altezza", "profondita"] },
  da_x_a_y: { nome: "Da X a Y", misure: [] },
};
const NOMI_MISURE = { larghezza: "Larghezza", altezza: "Altezza", profondita: "Profondità", lunghezza: "Lunghezza" };
const INIZIALE = { vena: false, forma: "un_blocco", larghezza: 3, altezza: 3, profondita: 3, lunghezza: 5 };
const NERI = new Set([
  "minecraft:bedrock", "minecraft:barrier", "minecraft:command_block", "minecraft:chain_command_block",
  "minecraft:repeating_command_block", "minecraft:structure_block", "minecraft:jigsaw", "minecraft:end_portal_frame",
  "minecraft:end_portal", "minecraft:portal", "minecraft:reinforced_deepslate", "minecraft:light_block",
  "minecraft:allow", "minecraft:deny", "minecraft:border_block",
]);
const ATTREZZI = ["pickaxe", "axe", "shovel"];
const TAG_LIVELLO = [
  ["minecraft:wooden_tier", 4], ["minecraft:stone_tier", 9], ["minecraft:copper_tier", 16],
  ["minecraft:iron_tier", 27], ["minecraft:golden_tier", 64], ["minecraft:diamond_tier", 128],
  ["minecraft:netherite_tier", 225],
];
const TAG_RISERVA = {
  pickaxe: ["stone", "metal", "diamond_pick_diggable", "iron_pick_diggable", "stone_pick_diggable"],
  axe: ["wood", "log"],
  shovel: ["dirt", "sand", "gravel", "grass", "snow"],
};
// I nostri blocchi dicono con quale attrezzo si rompono con un'etichetta "coop:", nel file del blocco:
// "minecraft:tags": ["coop:da_piccone"]. Con format_version 1.26.60 la vecchia scrittura "tag:...": {} fa scartare il blocco.
const TAG_NOSTRI = { pickaxe: "coop:da_piccone", axe: "coop:da_ascia", shovel: "coop:da_pala" };
const anteprime = new Map();
const puntiX = new Map();
const facceColpite = new Map();
const ultimoMenu = new Map();
const GIRO_ANTEPRIMA = 1; // tick

const somma = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const per = (a, n) => ({ x: a.x * n, y: a.y * n, z: a.z * n });
const centrati = (n) => Array.from({ length: n }, (_, i) => i - Math.floor((n - 1) / 2));
const intero = (v) => Math.max(1, Math.min(15, Math.floor(Number(v) || 1)));
const chiavePos = (p) => `${p.x},${p.y},${p.z}`;

function lettura(player) {
  try {
    const testo = player.getDynamicProperty(PROP_SCELTA);
    if (typeof testo === "string") return { ...INIZIALE, ...JSON.parse(testo) };
  } catch {}
  return { ...INIZIALE };
}

function tipoAttrezzo(oggetto) {
  if (!oggetto) return undefined;
  return ATTREZZI.find((tipo) => oggetto.hasTag(`minecraft:is_${tipo}`));
}

function massimo(oggetto) {
  for (const [tag, quanti] of TAG_LIVELLO) if (oggetto.hasTag(tag)) return quanti;
  return 4;
}

function bloccoAdatto(permutazione, tipo) {
  if (NERI.has(permutazione.type.id)) return false;
  if (permutazione.hasTag(TAG_NOSTRI[tipo]) || permutazione.hasTag(`minecraft:is_${tipo}_item_destructible`)) return true;
  return TAG_RISERVA[tipo].some((tag) => permutazione.hasTag(tag));
}

/** Calcola le caselle candidate, senza accedere al mondo o ai giocatori. */
export function calcolaScavo({ blocco, faccia, vista, scelta, massimo: limite, puntoX }) {
  const n = NORMALI[faccia];
  if (!n) return { posizioni: [], richieste: 0 };
  const avanti = avantiDa(vista);
  const destra = { x: -avanti.z, y: 0, z: avanti.x };
  const laterale = n.y ? destra : { x: -n.z, y: 0, z: n.x };
  const verticale = { x: 0, y: vista.y < -0.3 ? -1 : 1, z: 0 };
  // Secondo lato del rettangolo: verso l'alto sulle facce laterali, in avanti su quelle di sopra e di sotto.
  const secondo = n.y ? avanti : { x: 0, y: 1, z: 0 };
  const L = intero(scelta.larghezza), A = intero(scelta.altezza), P = intero(scelta.profondita), N = intero(scelta.lunghezza);
  const posizioni = [];
  const aggiungi = (p) => posizioni.push(p);
  const origine = { ...blocco };
  switch (scelta.forma) {
    case "un_blocco": aggiungi(origine); break;
    case "muro":
      for (const h of centrati(A)) for (const w of centrati(L)) aggiungi(somma(somma(origine, per(laterale, w)), per(secondo, h)));
      break;
    case "pavimento":
      for (let d = 0; d < P; d++) for (const w of centrati(L)) aggiungi(somma(somma(origine, per(destra, w)), per(avanti, d)));
      break;
    case "colonna": {
      const verso = faccia === "Up" ? { x: 0, y: -1, z: 0 } : { x: 0, y: 1, z: 0 };
      for (let i = 0; i < N; i++) aggiungi(somma(origine, per(verso, i)));
      break;
    }
    case "tunnel":
      for (let i = 0; i < N; i++) aggiungi(somma(origine, per(n, -i)));
      break;
    case "scale":
      for (let i = 0; i < N; i++) aggiungi(somma(somma(origine, per(avanti, i)), per(verticale, i)));
      break;
    case "blocco":
      for (let d = 0; d < P; d++) for (const h of centrati(A)) for (const w of centrati(L))
        aggiungi(somma(somma(somma(origine, per(laterale, w)), per(secondo, h)), per(n, -d)));
      break;
    case "da_x_a_y": {
      if (!puntoX) return { posizioni: [origine], richieste: 1, segnaX: true };
      const lo = { x: Math.min(puntoX.x, origine.x), y: Math.min(puntoX.y, origine.y), z: Math.min(puntoX.z, origine.z) };
      const hi = { x: Math.max(puntoX.x, origine.x), y: Math.max(puntoX.y, origine.y), z: Math.max(puntoX.z, origine.z) };
      const richieste = (hi.x - lo.x + 1) * (hi.y - lo.y + 1) * (hi.z - lo.z + 1);
      if (richieste > 20000) return { posizioni: [], richieste, troppoGrande: true };
      for (let x = lo.x; x <= hi.x; x++) for (let y = lo.y; y <= hi.y; y++) for (let z = lo.z; z <= hi.z; z++) aggiungi({ x, y, z });
      break;
    }
  }
  const uniche = [...new Map(posizioni.map((p) => [chiavePos(p), p])).values()];
  uniche.sort((a, b) => (Math.abs(a.x - origine.x) + Math.abs(a.y - origine.y) + Math.abs(a.z - origine.z)) -
    (Math.abs(b.x - origine.x) + Math.abs(b.y - origine.y) + Math.abs(b.z - origine.z)));
  return { posizioni: uniche.slice(0, limite), richieste: uniche.length, tagliate: uniche.length > limite };
}

/** Cerca i blocchi uguali connessi usando tutti i 26 vicini, dal più vicino. */
export function trovaVena(origine, uguale, limite) {
  const visti = new Set([chiavePos(origine)]), coda = [origine];
  const trovati = [];
  for (let indice = 0; indice < coda.length; indice++) {
    const p = coda[indice];
    const radice = indice === 0;
    const corrisponde = uguale(p);
    if (corrisponde) trovati.push(p);
    if (trovati.length >= limite) break;
    if (!corrisponde && !radice) continue;
    for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
      if (!(x || y || z)) continue;
      const vicino = { x: p.x + x, y: p.y + y, z: p.z + z }, k = chiavePos(vicino);
      if (visti.has(k)) continue;
      visti.add(k);
      if (uguale(vicino)) coda.push(vicino);
    }
  }
  return trovati;
}

async function sceltaMisure(player, forma, scelta, massimoAttrezzo) {
  const misure = FORME[forma].misure;
  const nuova = { ...scelta, vena: false, forma };
  if (misure.length) {
    const lato = Math.min(massimoAttrezzo, 15);
    const form = new ModalFormData().title(FORME[forma].nome).label(`Questo attrezzo rompe al massimo ${massimoAttrezzo} blocchi per colpo.`);
    for (const m of misure) form.slider(NOMI_MISURE[m], 1, lato, { defaultValue: Math.min(lato, intero(scelta[m])) });
    form.submitButton("Fatto");
    const risposta = await mostra(form, player);
    if (risposta.canceled || !risposta.formValues) return;
    const numeri = risposta.formValues.filter((v) => typeof v === "number");
    misure.forEach((m, i) => nuova[m] = numeri[i] ?? nuova[m]);
  }
  player.setDynamicProperty(PROP_SCELTA, JSON.stringify(nuova));
  puntiX.delete(player.id);
  player.onScreenDisplay.setActionBar(`§aForma: ${FORME[forma].nome}`);
}

async function apriMenu(player, oggetto) {
  if (system.currentTick - (ultimoMenu.get(player.id) ?? -100) < 5) return;
  ultimoMenu.set(player.id, system.currentTick);
  const scelta = lettura(player), max = massimo(oggetto);
  const dettagli = scelta.forma === "un_blocco" ? "Un blocco" : `${FORME[scelta.forma]?.nome ?? scelta.forma}: ${FORME[scelta.forma]?.misure.map((m) => scelta[m]).join("×")}`;
  const menu = new ActionFormData().title("Scavo multiplo")
    .body(`Vena: ${scelta.vena ? "SÌ" : "NO"}\nForma: ${dettagli}\nMassimo: ${max} blocchi per colpo`)
    .button(`Vena: ${scelta.vena ? "SÌ" : "NO"}`);
  const azioni = [() => player.setDynamicProperty(PROP_SCELTA, JSON.stringify({ ...scelta, vena: !scelta.vena }))];
  for (const [id, forma] of Object.entries(FORME)) {
    menu.button(id === scelta.forma && !scelta.vena ? `§2> ${forma.nome} <` : forma.nome);
    azioni.push(() => sceltaMisure(player, id, scelta, max));
  }
  const risposta = await mostra(menu, player);
  if (!risposta.canceled && risposta.selection !== undefined) await azioni[risposta.selection]?.();
}

function puntoAzione(player, testo) { player.onScreenDisplay.setActionBar(testo); }

function consumaDurata(player, oggetto) {
  const equip = player.getComponent("minecraft:equippable");
  const inMano = equip?.getEquipment(EquipmentSlot.Mainhand);
  if (inMano?.typeId !== oggetto?.typeId) return false;
  const durata = inMano.getComponent("minecraft:durability");
  if (!durata) return true;
  const livello = inMano.getComponent("minecraft:enchantable")?.getEnchantment("unbreaking")?.level ?? 0;
  if (Math.random() >= 1 / (livello + 1)) return true;
  if (durata.damage + 1 > durata.maxDurability) { // si rompe quando il danno supera il massimo, come nel gioco
    equip?.setEquipment(EquipmentSlot.Mainhand, undefined);
    player.playSound("random.break");
    return false;
  }
  durata.damage++;
  equip?.setEquipment(EquipmentSlot.Mainhand, inMano);
  return true;
}

function scava(player, oggetto, dimensione, posizioni, tipoId, max, tagliate) {
  const creative = player.getGameMode() === GameMode.Creative;
  // Si parte da quello che c'è in mano DOPO il colpo normale: se l'attrezzo si è appena rotto, non si continua.
  let rotti = 1, indice = 0, attrezzo = player.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Mainhand);
  function* lavoro() {
    while (indice < posizioni.length) {
      const pos = posizioni[indice++];
      if (!creative && attrezzo?.typeId !== oggetto.typeId) break; // l'attrezzo si è rotto o è cambiato
      try {
        if (dimensione.getBlock(pos)?.typeId !== tipoId) continue;
        if (!creative) {
          const { x, y, z } = pos;
          try {
            player.runCommand(`loot spawn ${x + 0.5} ${y + 0.5} ${z + 0.5} mine ${x} ${y} ${z} mainhand`);
          } catch {
            dimensione.runCommand(`setblock ${x} ${y} ${z} air destroy`);
            rotti++;
            if (!consumaDurata(player, attrezzo)) break;
            attrezzo = player.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Mainhand);
            yield;
            continue;
          }
        }
        dimensione.setBlockType(pos, "minecraft:air");
        rotti++;
        if (!creative) {
          if (!consumaDurata(player, attrezzo)) break;
          attrezzo = player.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Mainhand);
        }
      } catch {}
      yield;
    }
    dimensione.playSound("dig.stone", posizioni[0] ?? player.location);
    puntoAzione(player, `§aRotti ${rotti} blocchi${tagliate ? ` §e(questo attrezzo ne rompe al massimo ${max})` : ""}`);
  }
  const generatore = lavoro();
  if (posizioni.length >= 64) system.runJob(generatore);
  else {
    for (let i = 0; i <= posizioni.length; i++) {
      const passo = generatore.next();
      if (passo.done) break;
    }
  }
}

world.beforeEvents.playerBreakBlock.subscribe(({ player, block }) => {
  try {
    const mira = player.getBlockFromViewDirection({ maxDistance: 8 });
    if (mira && chiavePos(mira.block.location) === chiavePos(block.location)) {
      facceColpite.set(`${player.id}|${chiavePos(block.location)}`, mira.face);
    }
  } catch {}
});

world.afterEvents.playerBreakBlock.subscribe(({ player, block, brokenBlockPermutation, itemStackBeforeBreak }) => {
  const chiaveFaccia = `${player.id}|${chiavePos(block.location)}`;
  const facciaColpita = facceColpite.get(chiaveFaccia) ?? "Up";
  facceColpite.delete(chiaveFaccia);
  const oggetto = itemStackBeforeBreak;
  const tipo = tipoAttrezzo(oggetto);
  if (!tipo || !bloccoAdatto(brokenBlockPermutation, tipo)) return;
  const scelta = lettura(player);
  if (!scelta.vena && scelta.forma === "un_blocco") return;
  // Nel gioco un attrezzo si rompe quando il danno SUPERA il massimo. Se era già al massimo, il colpo normale
  // l'ha rotto (in quel momento risulta ancora in mano): niente blocchi in più.
  const durataPrima = oggetto.getComponent("minecraft:durability");
  if (durataPrima && durataPrima.damage >= durataPrima.maxDurability && player.getGameMode() !== GameMode.Creative) return;
  const max = massimo(oggetto), loc = block.location, dimensione = player.dimension, id = brokenBlockPermutation.type.id;
  const punto = puntiX.get(player.id);
  const uguale = (pos) => {
    try { return dimensione.getBlock(pos)?.typeId === id; } catch { return false; }
  };
  if (scelta.vena) {
    const vena = trovaVena(loc, uguale, max);
    scava(player, oggetto, dimensione, vena.filter((p) => chiavePos(p) !== chiavePos(loc)).slice(0, Math.max(0, max - 1)), id, max, vena.length >= max);
    return;
  }
  // L'evento dopo la rottura non contiene la faccia: la ricordiamo nell'evento precedente.
  const faccia = facciaColpita;
  const risultato = calcolaScavo({ blocco: loc, faccia, vista: player.getViewDirection(), scelta, massimo: Math.max(1, max - 1), puntoX: punto?.dimensione === dimensione.id ? punto.pos : undefined });
  if (risultato.troppoGrande) {
    puntiX.delete(player.id); puntoAzione(player, "§cDa X a Y: i due punti sono troppo lontani."); return;
  }
  if (risultato.segnaX) {
    puntiX.set(player.id, { dimensione: dimensione.id, pos: { ...loc } });
    puntoAzione(player, "§bPunto X segnato. Ora rompi il blocco Y."); return;
  }
  puntiX.delete(player.id);
  const aggiuntivi = risultato.posizioni.filter((p) => chiavePos(p) !== chiavePos(loc) && uguale(p));
  scava(player, oggetto, dimensione, aggiuntivi, id, max, risultato.tagliate || risultato.richieste > max);
});

world.beforeEvents.playerInteractWithBlock.subscribe((evento) => {
  const oggetto = evento.itemStack;
  if (!tipoAttrezzo(oggetto) || !evento.player.isSneaking) return;
  evento.cancel = true;
  if (!evento.isFirstEvent) return;
  system.run(() => apriMenu(evento.player, oggetto));
});

world.afterEvents.itemUse.subscribe(({ source, itemStack }) => {
  if (source.typeId !== "minecraft:player" || !source.isSneaking || !tipoAttrezzo(itemStack)) return;
  apriMenu(source, itemStack);
});

// Scelta senza menu, con un comando: /scriptevent coop:scavo_scelta {"vena":true}
// oppure {"forma":"muro","larghezza":3,"altezza":3}. Cambia solo la scelta di chi lancia il comando.
// Serve alle prove da giocatore (un altro pack non può leggere né scrivere le proprietà di questo).
system.afterEvents.scriptEventReceive.subscribe(({ id, message, sourceEntity }) => {
  if (id !== "coop:scavo_scelta" || sourceEntity?.typeId !== "minecraft:player") return;
  try {
    const nuova = { ...lettura(sourceEntity), ...JSON.parse(message) };
    if (!FORME[nuova.forma]) throw new Error(`forma sconosciuta: ${nuova.forma}`);
    sourceEntity.setDynamicProperty(PROP_SCELTA, JSON.stringify(nuova));
    puntiX.delete(sourceEntity.id);
    puntoAzione(sourceEntity, `§aScavo: Vena ${nuova.vena ? "SÌ" : "NO"}, forma ${FORME[nuova.forma].nome}`);
  } catch (errore) {
    puntoAzione(sourceEntity, `§cScelta non valida: ${errore.message}`);
  }
});

function anteprima(player) {
  const oggetto = player.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Mainhand);
  const tipo = tipoAttrezzo(oggetto), scelta = lettura(player);
  if (!tipo || player.isSneaking || (!scelta.vena && scelta.forma === "un_blocco")) { anteprime.delete(player.id); return; }
  const mira = player.getBlockFromViewDirection({ maxDistance: 6 });
  if (!mira || !bloccoAdatto(mira.block.permutation, tipo)) { anteprime.delete(player.id); return; }
  const massimoAttrezzo = massimo(oggetto), blocco = mira.block.location, id = mira.block.typeId;
  const chiave = [player.dimension.id, chiavePos(blocco), mira.face, id, oggetto.typeId, player.getDynamicProperty(PROP_SCELTA), scelta.vena ? "" : `${player.getViewDirection().x.toFixed(1)},${player.getViewDirection().z.toFixed(1)}`].join("|");
  let stato = anteprime.get(player.id);
  if (!stato || stato.chiave !== chiave) {
    const uguale = (p) => { try { return player.dimension.getBlock(p)?.typeId === id; } catch { return false; } };
    const calcolo = scelta.vena ? { posizioni: trovaVena(blocco, uguale, massimoAttrezzo) } : calcolaScavo({ blocco, faccia: mira.face, vista: player.getViewDirection(), scelta, massimo: massimoAttrezzo });
    const valide = calcolo.posizioni.filter((p) => uguale(p));
    stato = { chiave, punti: scelta.vena ? valide.slice(0, 48) : spigoli(valide), tick: -100 };
    anteprime.set(player.id, stato);
  }
  if (system.currentTick - stato.tick < 2) return;
  stato.tick = system.currentTick;
  for (const p of stato.punti) try { player.spawnParticle("coop:anteprima_scavo", { x: p.x + 0.5, y: p.y + 0.5, z: p.z + 0.5 }); } catch {}
}

system.runInterval(() => {
  for (const player of world.getAllPlayers()) try { anteprima(player); } catch {}
}, GIRO_ANTEPRIMA);

prova("vena_scavo", async () => {
  const blocchi = new Set(["0,0,0", "1,0,0", "1,1,0", "-1,0,0", "4,0,0"]);
  const risultato = trovaVena({ x: 0, y: 0, z: 0 }, (p) => blocchi.has(chiavePos(p)), 3);
  if (risultato.length !== 3 || risultato.some((p) => p.x === 4)) throw new Error("la vena non ha rispettato attacchi o massimo");
  if (trovaVena({ x: 0, y: 0, z: 0 }, (p) => blocchi.has(chiavePos(p)), 20).some((p) => p.x === 4)) throw new Error("la vena ha incluso un blocco staccato");
  return "vicini uguali, limite rispettato";
});

prova("forme_scavo", async () => {
  const base = { x: 10, y: 10, z: 10 }, comune = { blocco: base, faccia: "Up", vista: { x: 0, y: 0, z: 1 }, massimo: 225 };
  const muro = calcolaScavo({ ...comune, scelta: { forma: "muro", larghezza: 3, altezza: 3 } }).posizioni;
  const tunnel = calcolaScavo({ ...comune, faccia: "North", scelta: { forma: "tunnel", lunghezza: 5 } }).posizioni;
  const muroLato = calcolaScavo({ ...comune, faccia: "North", scelta: { forma: "muro", larghezza: 3, altezza: 3 } }).posizioni;
  if (muro.length !== 9 || muro.some((p) => p.y !== 10)) throw new Error("Muro 3x3 sulla faccia di sopra: doveva essere orizzontale");
  if (muroLato.length !== 9 || !muroLato.some((p) => p.x === 9 && p.y === 11 && p.z === 10)) throw new Error("Muro 3x3 sul lato errato");
  if (tunnel.length !== 5 || !tunnel.some((p) => p.x === 10 && p.y === 10 && p.z === 14)) throw new Error("Tunnel 5 errato");
  return "Muro 3x3 e Tunnel 5";
});

prova("etichette_scavo", async () => {
  const ottone = BlockPermutation.resolve("coop:blocco_ottone");
  if (!bloccoAdatto(ottone, "pickaxe")) throw new Error("il blocco di ottone non risulta adatto al piccone: etichetta coop:da_piccone non letta");
  if (bloccoAdatto(ottone, "shovel")) throw new Error("il blocco di ottone risulta adatto alla pala");
  if (!bloccoAdatto(BlockPermutation.resolve("minecraft:stone"), "pickaxe")) throw new Error("la pietra non risulta adatta al piccone");
  if (!bloccoAdatto(BlockPermutation.resolve("minecraft:oak_log"), "axe")) throw new Error("il tronco di quercia non risulta adatto all'ascia");
  if (!bloccoAdatto(BlockPermutation.resolve("minecraft:dirt"), "shovel")) throw new Error("la terra non risulta adatta alla pala");
  if (!bloccoAdatto(BlockPermutation.resolve("minecraft:coal_ore"), "pickaxe")) throw new Error("il carbone non risulta adatto al piccone");
  if (bloccoAdatto(BlockPermutation.resolve("minecraft:bedrock"), "pickaxe")) throw new Error("la bedrock risulta rompibile");
  return "ottone, pietra, tronco, terra, carbone, bedrock";
});
