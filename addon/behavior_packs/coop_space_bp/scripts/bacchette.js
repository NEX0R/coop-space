// Il potere delle bacchette da costruzione, ispirato alla mod "Building Gadgets".
//
// Come si usa nel gioco:
// - tocca un blocco con la bacchetta: costruisce con il modo e le misure scelti;
// - accovacciati e tocca un blocco (o usa la bacchetta in aria): si apre il menu,
//   dove si sceglie il blocco da usare, il modo, le misure, o si annulla l'ultima costruzione.
// Ogni bacchetta ha un massimo di blocchi per colpo: più il materiale è forte, più blocchi.
// In sopravvivenza consuma i blocchi dall'inventario e 1 punto di durata a colpo.
//
// Solo API stabili: @minecraft/server 2.11.0 e @minecraft/server-ui 2.3.0.
import { world, system, BlockPermutation, EquipmentSlot, GameMode, ItemStack } from "@minecraft/server";
import { ActionFormData, ModalFormData, FormCancelationReason } from "@minecraft/server-ui";

const ETICHETTA = "coop:bacchetta_costruzione";

// Massimo di blocchi per colpo, per materiale, presi dalle mod:
// pietra 9, ferro 27 e diamante 128 come le bacchette della mod Construction Wand;
// netherite 225 = un muro 15x15, il massimo di Building Gadgets. Legno e oro scelti per stare in mezzo.
export const MASSIMI = {
  "coop:bacchetta_legno": 4,
  "coop:bacchetta_pietra": 9,
  "coop:bacchetta_ferro": 27,
  "coop:bacchetta_oro": 64,
  "coop:bacchetta_diamante": 128,
  "coop:bacchetta_netherite": 225,
};

// Ogni lato arriva al massimo a 15, come il "raggio" di Building Gadgets.
const LATO_MASSIMO = 15;

// I modi di costruire, come nella mod. "misure" dice quali cursori mostra il menu.
export const MODI = {
  muro: { nome: "Muro verticale", misure: ["larghezza", "altezza"] },
  pavimento: { nome: "Pavimento", misure: ["larghezza", "profondita"] },
  da_x_a_y: { nome: "Da X a Y", misure: [] },
  colonna: { nome: "Colonna verticale", misure: ["lunghezza"] },
  fila: { nome: "Colonna orizzontale", misure: ["lunghezza"] },
  fino_a_me: { nome: "Fino a me", misure: [] },
  scale: { nome: "Scale", misure: ["lunghezza"] },
  superficie: { nome: "Superficie", misure: ["larghezza", "profondita"] },
  blocco: { nome: "Blocco pieno", misure: ["larghezza", "altezza", "profondita"] },
};

const NOMI_MISURE = {
  larghezza: "Larghezza",
  altezza: "Altezza",
  profondita: "Profondità",
  lunghezza: "Lunghezza",
};

const SCELTA_INIZIALE = { modo: "muro", larghezza: 2, altezza: 2, profondita: 1, lunghezza: 4 };

// Le caselle che la bacchetta può riempire: non distrugge mai niente.
const VUOTI = new Set([
  "minecraft:air",
  "minecraft:water",
  "minecraft:flowing_water",
  "minecraft:lava",
  "minecraft:flowing_lava",
]);

// ---------- Geometria (senza giocatori: si può provare da sola) ----------

export const NORMALI = {
  Up: { x: 0, y: 1, z: 0 },
  Down: { x: 0, y: -1, z: 0 },
  North: { x: 0, y: 0, z: -1 },
  South: { x: 0, y: 0, z: 1 },
  East: { x: 1, y: 0, z: 0 },
  West: { x: -1, y: 0, z: 0 },
};

const somma = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const per = (v, k) => ({ x: v.x * k, y: v.y * k, z: v.z * k });
const scalare = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

// Direzione orizzontale "in avanti" (quella più vicina a dove si guarda).
export function avantiDa(vista) {
  if (Math.abs(vista.x) >= Math.abs(vista.z)) return { x: Math.sign(vista.x) || 1, y: 0, z: 0 };
  return { x: 0, y: 0, z: Math.sign(vista.z) || 1 };
}

// Da 1..n a scostamenti centrati: 3 -> -1,0,1; 4 -> -1,0,1,2.
function centrati(n) {
  const inizio = -Math.floor((n - 1) / 2);
  return Array.from({ length: n }, (_, i) => inizio + i);
}
function inAvanti(n) {
  return Array.from({ length: n }, (_, i) => i);
}

/**
 * Calcola le caselle da riempire, in ordine dalla più vicina alla più lontana.
 * @param {object} p
 * @param {{x:number,y:number,z:number}} p.blocco   il blocco toccato
 * @param {string} p.faccia                         "Up", "Down", "North", ...
 * @param {{x:number,y:number,z:number}} p.vista    direzione dello sguardo del giocatore
 * @param {{x:number,y:number,z:number}} p.giocatore posizione del giocatore
 * @param {object} p.scelta                         modo e misure
 * @param {number} p.massimo                        massimo di blocchi della bacchetta
 * @param {(pos:{x:number,y:number,z:number}) => boolean} [p.uguale] per "Superficie": la casella sotto è come il blocco toccato?
 * @param {{x:number,y:number,z:number}} [p.puntoX] per "Da X a Y": la casella segnata col primo tocco
 */
export function calcolaPosizioni({ blocco, faccia, vista, giocatore, scelta, massimo, uguale, puntoX }) {
  const n = NORMALI[faccia];
  const partenza = somma(blocco, n);
  const verticale = n.y !== 0;
  const su = { x: 0, y: n.y < 0 ? -1 : 1, z: 0 };
  const avanti = avantiDa(vista);
  const destra = { x: -avanti.z, y: 0, z: avanti.x };
  // Sul lato di un blocco: "lungo la faccia" è l'asse orizzontale parallelo alla faccia.
  let lungo = { x: -n.z, y: 0, z: n.x };
  if (scalare(lungo, destra) < 0) lungo = per(lungo, -1);
  // Asse orizzontale della larghezza e asse della profondità.
  const assL = verticale ? destra : lungo;
  const assP = verticale ? avanti : n;
  const lim = (v) => Math.max(1, Math.min(LATO_MASSIMO, Math.floor(v ?? 1)));
  const L = lim(scelta.larghezza);
  const A = lim(scelta.altezza);
  const P = lim(scelta.profondita);
  const N = lim(scelta.lunghezza);

  const posizioni = [];
  let origine = partenza; // si costruisce prima vicino a qui
  const metti = (a, b, c, assA, assB, assC) =>
    posizioni.push(somma(somma(somma(partenza, per(assA, a)), per(assB, b)), per(assC, c)));

  switch (scelta.modo) {
    case "muro":
      for (const h of inAvanti(A)) for (const w of centrati(L)) metti(w, h, 0, assL, su, assP);
      break;
    case "pavimento":
      for (const d of inAvanti(P)) for (const w of centrati(L)) metti(w, d, 0, assL, assP, su);
      break;
    case "colonna":
      for (const h of inAvanti(N)) metti(h, 0, 0, su, assL, assP);
      break;
    case "fila":
      for (const d of inAvanti(N)) metti(d, 0, 0, assP, assL, su);
      break;
    case "fino_a_me": {
      // Dal blocco toccato verso il giocatore, fermandosi prima di lui.
      const piedi = { x: Math.floor(giocatore.x), y: Math.floor(giocatore.y), z: Math.floor(giocatore.z) };
      const passi = scalare({ x: piedi.x - partenza.x, y: piedi.y - partenza.y, z: piedi.z - partenza.z }, n);
      for (let i = 0; i < Math.min(passi, LATO_MASSIMO * 4); i++) metti(i, 0, 0, n, assL, su);
      break;
    }
    case "scale":
      for (const i of inAvanti(N)) posizioni.push(somma(somma(partenza, per(assP, i)), per(su, i)));
      break;
    case "superficie": {
      // Copre solo le caselle che hanno sotto lo stesso blocco di quello toccato.
      const assS = verticale ? avanti : su;
      for (const d of centrati(P))
        for (const w of centrati(L)) {
          const pos = somma(somma(partenza, per(assL, w)), per(assS, d));
          if (!uguale || uguale(somma(pos, per(n, -1)))) posizioni.push(pos);
        }
      break;
    }
    case "da_x_a_y": {
      // Senza X segnato: solo la casella del primo tocco. Con X: tutto lo spazio da X a qui.
      if (!puntoX) {
        posizioni.push(partenza);
        break;
      }
      origine = puntoX;
      const min = { x: Math.min(puntoX.x, partenza.x), y: Math.min(puntoX.y, partenza.y), z: Math.min(puntoX.z, partenza.z) };
      const max = { x: Math.max(puntoX.x, partenza.x), y: Math.max(puntoX.y, partenza.y), z: Math.max(puntoX.z, partenza.z) };
      const volume = (max.x - min.x + 1) * (max.y - min.y + 1) * (max.z - min.z + 1);
      if (volume > 20000) return { posizioni: [], richieste: volume, troppoGrande: true };
      for (let x = min.x; x <= max.x; x++)
        for (let y = min.y; y <= max.y; y++) for (let z = min.z; z <= max.z; z++) posizioni.push({ x, y, z });
      break;
    }
    case "blocco":
      for (const d of inAvanti(P))
        for (const h of inAvanti(A)) for (const w of centrati(L)) metti(w, h, d, assL, su, assP);
      break;
  }

  const distanza = (p) =>
    Math.abs(p.x - origine.x) + Math.abs(p.y - origine.y) + Math.abs(p.z - origine.z);
  posizioni.sort((a, b) => distanza(a) - distanza(b));
  return { posizioni: posizioni.slice(0, massimo), richieste: posizioni.length };
}

// ---------- Ricordi del giocatore ----------

const PROP_SCELTA = "coop:bacchetta_scelta";
const PROP_BLOCCO = "coop:bacchetta_blocco";
const ultimaCostruzione = new Map(); // id giocatore -> { dimensione, posizioni, tipo, oggetto }
const ultimoUso = new Map(); // id giocatore -> tick
const puntiX = new Map(); // id giocatore -> { dimensione, pos } del modo "Da X a Y"

function leggiPuntoX(player) {
  const punto = puntiX.get(player.id);
  return punto && punto.dimensione === player.dimension.id ? punto.pos : undefined;
}

function leggiScelta(player) {
  try {
    const testo = player.getDynamicProperty(PROP_SCELTA);
    if (typeof testo === "string") return { ...SCELTA_INIZIALE, ...JSON.parse(testo) };
  } catch {}
  return { ...SCELTA_INIZIALE };
}

function leggiBloccoScelto(player) {
  try {
    const testo = player.getDynamicProperty(PROP_BLOCCO);
    if (typeof testo !== "string") return undefined;
    const { tipo, stati } = JSON.parse(testo);
    return BlockPermutation.resolve(tipo, stati);
  } catch {
    return undefined;
  }
}

function ricordaBlocco(player, permutazione) {
  player.setDynamicProperty(
    PROP_BLOCCO,
    JSON.stringify({ tipo: permutazione.type.id, stati: permutazione.getAllStates() })
  );
}

function avviso(player, testo) {
  player.onScreenDisplay.setActionBar(testo);
}

function nomeBlocco(permutazione) {
  return { translate: permutazione.getItemStack(1)?.localizationKey ?? permutazione.type.id };
}

// ---------- Costruire ----------

function inCreativa(player) {
  return player.getGameMode() === GameMode.Creative;
}

function contaNellInventario(contenitore, tipo) {
  let totale = 0;
  for (let i = 0; i < contenitore.size; i++) {
    const oggetto = contenitore.getItem(i);
    if (oggetto?.typeId === tipo) totale += oggetto.amount;
  }
  return totale;
}

function togliDallInventario(contenitore, tipo, quanti) {
  for (let i = 0; i < contenitore.size && quanti > 0; i++) {
    const oggetto = contenitore.getItem(i);
    if (oggetto?.typeId !== tipo) continue;
    const via = Math.min(quanti, oggetto.amount);
    quanti -= via;
    if (via === oggetto.amount) contenitore.setItem(i, undefined);
    else {
      oggetto.amount -= via;
      contenitore.setItem(i, oggetto);
    }
  }
}

function restituisci(player, tipo, quanti) {
  const contenitore = player.getComponent("minecraft:inventory")?.container;
  while (quanti > 0) {
    const pila = new ItemStack(tipo, Math.min(quanti, 64));
    quanti -= pila.amount;
    const avanzo = contenitore?.addItem(pila);
    if (avanzo) player.dimension.spawnItem(avanzo, player.location);
  }
}

// Consuma 1 punto di durata; se la bacchetta finisce, si rompe.
function consumaDurata(player) {
  const equip = player.getComponent("minecraft:equippable");
  const bacchetta = equip?.getEquipment(EquipmentSlot.Mainhand);
  const durata = bacchetta?.getComponent("minecraft:durability");
  if (!durata) return;
  if (durata.damage + 1 >= durata.maxDurability) {
    equip.setEquipment(EquipmentSlot.Mainhand, undefined);
    player.playSound("random.break");
    return;
  }
  durata.damage += 1;
  equip.setEquipment(EquipmentSlot.Mainhand, bacchetta);
}

/**
 * Riempie le caselle vuote con il blocco scelto. Restituisce le posizioni riempite.
 * Senza `player` (per le prove) non consuma niente.
 */
export function piazza(dimensione, posizioni, permutazione, player) {
  const fatte = [];
  for (const pos of posizioni) {
    let casella;
    try {
      casella = dimensione.getBlock(pos);
    } catch {
      continue; // fuori dal mondo
    }
    if (!casella || !VUOTI.has(casella.typeId)) continue;
    if (player && occupataDalGiocatore(player, pos)) continue;
    casella.setPermutation(permutazione);
    fatte.push(pos);
  }
  return fatte;
}

function occupataDalGiocatore(player, pos) {
  const p = player.location;
  const x = Math.floor(p.x);
  const y = Math.floor(p.y);
  const z = Math.floor(p.z);
  return pos.x === x && pos.z === z && (pos.y === y || pos.y === y + 1);
}

// Prepara una costruzione: quali caselle riempire e con quale blocco. Serve sia per
// costruire sia per l'anteprima. Se non si può costruire, "errore" spiega perché.
function progetto(player, bacchetta, blocco, faccia) {
  const massimo = MASSIMI[bacchetta.typeId] ?? 4;
  const permutazione = leggiBloccoScelto(player) ?? blocco.permutation;
  const tipoToccato = blocco.typeId;
  const dimensione = player.dimension;

  const scelta = leggiScelta(player);
  const { posizioni, richieste, troppoGrande } = calcolaPosizioni({
    blocco: blocco.location,
    faccia,
    vista: player.getViewDirection(),
    giocatore: player.location,
    scelta,
    massimo,
    puntoX: scelta.modo === "da_x_a_y" ? leggiPuntoX(player) : undefined,
    uguale: (pos) => {
      try {
        return dimensione.getBlock(pos)?.typeId === tipoToccato;
      } catch {
        return false;
      }
    },
  });

  // Quante caselle sono davvero vuote.
  let libere = posizioni.filter((pos) => {
    try {
      const c = dimensione.getBlock(pos);
      return c && VUOTI.has(c.typeId) && !occupataDalGiocatore(player, pos);
    } catch {
      return false;
    }
  });
  const risultato = { dimensione, permutazione, massimo, richieste, libere, creativa: inCreativa(player), scelta };
  if (troppoGrande) return { ...risultato, errore: "§cDa X a Y: i due punti sono troppo lontani." };
  if (libere.length === 0) return { ...risultato, errore: "§eNiente da costruire qui: le caselle sono già piene." };

  // In sopravvivenza servono i blocchi nell'inventario.
  if (!risultato.creativa) {
    const oggetto = permutazione.getItemStack(1)?.typeId;
    const contenitore = player.getComponent("minecraft:inventory")?.container;
    if (!oggetto || !contenitore) return { ...risultato, errore: "§cQuesto blocco non si può costruire con la bacchetta." };
    const disponibili = contaNellInventario(contenitore, oggetto);
    if (disponibili === 0) {
      return {
        ...risultato,
        errore: { rawtext: [{ text: "§cNon hai blocchi di " }, nomeBlocco(permutazione), { text: " nell'inventario." }] },
      };
    }
    risultato.libere = libere.slice(0, disponibili);
    risultato.oggetto = oggetto;
    risultato.contenitore = contenitore;
  }
  return risultato;
}

function costruisci(player, bacchetta, blocco, faccia) {
  // "Da X a Y": il primo tocco segna X, il secondo costruisce.
  if (leggiScelta(player).modo === "da_x_a_y" && !leggiPuntoX(player)) {
    puntiX.set(player.id, { dimensione: player.dimension.id, pos: somma(blocco.location, NORMALI[faccia]) });
    avviso(player, "§bPunto X segnato. Ora tocca il blocco Y.");
    player.playSound("random.orb");
    return;
  }
  const p = progetto(player, bacchetta, blocco, faccia);
  if (p.errore) {
    avviso(player, p.errore);
    if (p.scelta.modo === "da_x_a_y" && p.richieste > 20000) puntiX.delete(player.id);
    return;
  }
  puntiX.delete(player.id);
  anteprime.delete(player.id);
  const fatte = piazza(p.dimensione, p.libere, p.permutazione, player);
  if (fatte.length === 0) return;
  if (!p.creativa) {
    togliDallInventario(p.contenitore, p.oggetto, fatte.length);
    consumaDurata(player);
  }
  ultimaCostruzione.set(player.id, {
    dimensione: p.dimensione.id,
    posizioni: fatte,
    tipo: p.permutazione.type.id,
    oggetto: p.oggetto,
  });
  p.dimensione.playSound("dig.stone", fatte[0]);

  let testo = `§aCostruiti ${fatte.length} blocchi`;
  if (p.richieste > p.massimo) testo += ` §e(questa bacchetta ne fa al massimo ${p.massimo})`;
  avviso(player, testo);
}

// Anteprima, come i blocchi trasparenti di Building Gadgets: mentre guardi un blocco
// con la bacchetta in mano, scintille verdi segnano dove andranno i blocchi.
// Il mirino si controlla a ogni tick (0,05 secondi): appena cambia quello che guardi, le scintille
// si ridisegnano subito. Se non cambia niente, si ridisegnano ogni 2 tick (0,1 secondi); la scintilla
// "coop:anteprima_bacchetta" (resource pack) dura 0,15 secondi: niente buchi, e sparisce quasi subito.
// I calcoli (caselle libere, inventario) si rifanno solo quando cambia qualcosa.
const DISTANZA_ANTEPRIMA = 10;
const GIRO_MIRINO = 1; // tick
const GIRO_SCINTILLE = 2; // tick
const anteprime = new Map(); // id giocatore -> { chiave, punti, tick }
const PUNTI_PIENI = 48; // oltre, si segnano solo gli spigoli della forma

// Solo gli spigoli della scatola che contiene la forma: molte meno scintille, forma riconoscibile.
export function spigoli(posizioni) {
  if (posizioni.length <= PUNTI_PIENI) return posizioni;
  const assi = ["x", "y", "z"];
  const min = {};
  const max = {};
  for (const a of assi) {
    min[a] = Math.min(...posizioni.map((p) => p[a]));
    max[a] = Math.max(...posizioni.map((p) => p[a]));
  }
  return posizioni.filter((p) => assi.filter((a) => p[a] === min[a] || p[a] === max[a]).length >= 2);
}
function anteprima(player) {
  const bacchetta = player.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Mainhand);
  if (!eUnaBacchetta(bacchetta) || player.isSneaking) {
    anteprime.delete(player.id);
    return;
  }
  const mira = player.getBlockFromViewDirection({ maxDistance: DISTANZA_ANTEPRIMA });
  if (!mira) {
    anteprime.delete(player.id);
    return;
  }
  // Tutto quello che cambia la forma: se è uguale a prima, si riusano i punti già calcolati.
  const b = mira.block.location;
  const avanti = avantiDa(player.getViewDirection());
  const piedi = player.location;
  const chiave = [
    player.dimension.id, b.x, b.y, b.z, mira.face, mira.block.typeId, bacchetta.typeId,
    avanti.x, avanti.z, Math.floor(piedi.x), Math.floor(piedi.y), Math.floor(piedi.z),
    player.getDynamicProperty(PROP_SCELTA), player.getDynamicProperty(PROP_BLOCCO),
    JSON.stringify(leggiPuntoX(player) ?? null),
  ].join("|");
  const adesso = system.currentTick;
  let stato = anteprime.get(player.id);
  if (!stato || stato.chiave !== chiave) {
    const p = progetto(player, bacchetta, mira.block, mira.face);
    const x = leggiPuntoX(player);
    let punti = p.errore ? [] : spigoli(p.libere);
    if (x && p.scelta.modo === "da_x_a_y") punti = [x, ...punti];
    stato = { chiave, punti, tick: -100 };
    anteprime.set(player.id, stato);
  }
  if (adesso - stato.tick < GIRO_SCINTILLE) return;
  stato.tick = adesso;
  for (const pos of stato.punti) {
    try {
      player.spawnParticle("coop:anteprima_bacchetta", { x: pos.x + 0.5, y: pos.y + 0.5, z: pos.z + 0.5 });
    } catch {}
  }
}

function annulla(player) {
  const ultima = ultimaCostruzione.get(player.id);
  if (!ultima) {
    avviso(player, "§eNon c'è niente da annullare.");
    return;
  }
  ultimaCostruzione.delete(player.id);
  anteprime.delete(player.id);
  const dimensione = world.getDimension(ultima.dimensione);
  let tolti = 0;
  for (const pos of ultima.posizioni) {
    try {
      const casella = dimensione.getBlock(pos);
      if (casella?.typeId === ultima.tipo) {
        casella.setType("minecraft:air");
        tolti++;
      }
    } catch {}
  }
  if (ultima.oggetto && tolti > 0) restituisci(player, ultima.oggetto, tolti);
  avviso(player, `§aAnnullata l'ultima costruzione (${tolti} blocchi).`);
}

// ---------- Menu ----------

// Il gioco può rifiutare il menu se il giocatore sta ancora toccando: riprova qualche volta.
export async function mostra(form, player) {
  for (let tentativo = 0; tentativo < 10; tentativo++) {
    const risposta = await form.show(player);
    if (risposta.cancelationReason !== FormCancelationReason.UserBusy) return risposta;
    await new Promise((fatto) => system.runTimeout(fatto, 5));
  }
  return { canceled: true };
}

async function apriMenu(player, bacchetta, bloccoToccato) {
  const massimo = MASSIMI[bacchetta.typeId] ?? 4;
  const scelta = leggiScelta(player);
  const bloccoScelto = leggiBloccoScelto(player);

  const menu = new ActionFormData()
    .title("Bacchetta da costruzione")
    .body({
      rawtext: [
        { text: `Modo: ${MODI[scelta.modo]?.nome ?? scelta.modo}\nMassimo: ${massimo} blocchi per colpo\nBlocco: ` },
        bloccoScelto ? nomeBlocco(bloccoScelto) : { text: "quello che tocchi" },
      ],
    });
  const azioni = [];
  if (bloccoToccato) {
    menu.button({ rawtext: [{ text: "Usa questo blocco: " }, nomeBlocco(bloccoToccato)] });
    azioni.push(() => {
      ricordaBlocco(player, bloccoToccato);
      player.sendMessage({ rawtext: [{ text: "§aBlocco scelto: " }, nomeBlocco(bloccoToccato)] });
    });
  }
  if (bloccoScelto) {
    menu.button("Usa il blocco che tocchi");
    azioni.push(() => {
      player.setDynamicProperty(PROP_BLOCCO, undefined);
      avviso(player, "§aOra la bacchetta copia il blocco che tocchi.");
    });
  }
  for (const [chiave, modo] of Object.entries(MODI)) {
    menu.button(chiave === scelta.modo ? `§2> ${modo.nome} <` : modo.nome);
    azioni.push(() => sceltaMisure(player, chiave, scelta, massimo));
  }
  menu.button("Annulla l'ultima costruzione");
  azioni.push(() => annulla(player));

  const risposta = await mostra(menu, player);
  if (risposta.canceled || risposta.selection === undefined) return;
  await azioni[risposta.selection]?.();
}

async function sceltaMisure(player, modo, scelta, massimo) {
  const misure = MODI[modo].misure;
  const nuova = { ...scelta, modo };
  if (misure.length > 0) {
    const lato = Math.min(massimo, LATO_MASSIMO);
    const form = new ModalFormData()
      .title(MODI[modo].nome)
      .label(`Questa bacchetta piazza al massimo ${massimo} blocchi per colpo.`);
    for (const m of misure) {
      form.slider(NOMI_MISURE[m], 1, lato, { defaultValue: Math.min(lato, Math.max(1, scelta[m] ?? 1)) });
    }
    form.submitButton("Fatto");
    const risposta = await mostra(form, player);
    if (risposta.canceled || !risposta.formValues) return;
    const numeri = risposta.formValues.filter((v) => typeof v === "number");
    misure.forEach((m, i) => (nuova[m] = numeri[i] ?? nuova[m]));
  }
  player.setDynamicProperty(PROP_SCELTA, JSON.stringify(nuova));
  puntiX.delete(player.id);
  const totale = misure.reduce((t, m) => t * nuova[m], 1);
  let testo = `§aModo: ${MODI[modo].nome}`;
  if (misure.length > 0) testo += ` ${misure.map((m) => nuova[m]).join("×")}`;
  if (totale > massimo) testo += ` §e(ne costruirà ${massimo})`;
  avviso(player, testo);
}

// ---------- Eventi ----------

function eUnaBacchetta(oggetto) {
  return oggetto?.hasTag(ETICHETTA) === true;
}

// Evita doppi colpi quando si tiene premuto o il tocco si ripete.
function troppoPresto(player) {
  const adesso = system.currentTick;
  if (adesso - (ultimoUso.get(player.id) ?? -100) < 6) return true;
  ultimoUso.set(player.id, adesso);
  return false;
}

world.beforeEvents.playerInteractWithBlock.subscribe((evento) => {
  const { player, block, blockFace, itemStack } = evento;
  if (!eUnaBacchetta(itemStack)) return;
  evento.cancel = true; // con la bacchetta in mano non si aprono bauli o porte
  if (!evento.isFirstEvent || troppoPresto(player)) return;
  const accovacciato = player.isSneaking;
  const permutazione = block.permutation;
  // Prima dell'evento il mondo non si può cambiare: si lavora al tick dopo.
  system.run(() => {
    if (accovacciato) apriMenu(player, itemStack, permutazione);
    else costruisci(player, itemStack, block, blockFace);
  });
});

system.runInterval(() => {
  for (const player of world.getAllPlayers()) {
    try {
      anteprima(player);
    } catch {}
  }
}, GIRO_MIRINO);

world.afterEvents.itemUse.subscribe(({ source, itemStack }) => {
  if (!eUnaBacchetta(itemStack) || troppoPresto(source)) return;
  apriMenu(source, itemStack);
});
