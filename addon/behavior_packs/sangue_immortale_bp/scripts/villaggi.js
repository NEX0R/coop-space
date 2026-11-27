// Sangue Immortale — VILLAGGI (richiesta di Jowa, 24/11/2026).
// Mentre esplori il mondo normale, ogni zona di 320×320 blocchi ha circa una possibilità su due di ospitare un villaggio.
// Viene costruito dallo script su un terreno abbastanza piatto, a 40–64 blocchi da te, e ti arriva un avviso con la direzione.
// 1.5.0: borgo, avamposto e covo rifatti in stile MEDIEVALE PUNK (graticcio, tetti di rame, comignoli, forge, catene) e col
// pavimento delle case allo stesso livello del terreno (prima era rialzato di un blocco).
//   - BORGO UMANO          case a graticcio coi tetti di rame, pozzo coperto, forgia del fabbro, mercato, campo, orto di verbena,
//                          abitanti (alcuni bevono verbena di nascosto);
//   - AVAMPOSTO DEI CACCIATORI  palizzata appuntita, portone con saracinesca e torrette, torre di guardia con campana,
//                          caserme, armeria, fantocci e bersagli, gabbia per vampiri, falò, cacciatori e una cassa di armi;
//   - COVO DEI VAMPIRI     case gotiche nere coi tetti di rame ossidato, cripta, fontana di sangue, cimitero, forca con la
//                          gabbia, vampiri con l'anello, la Sedia del prelievo con un abitante legato, una cassa di sacche;
//   - ROCCA DEL DRAGO (dimora dell'Originale, 45×45, alta ~40): mura con 4 torri, mastio a gradoni, salone del trono, Tavolo
//                          dipinto, stanza del tesoro, 18 guardie vampiro e il SIGNORE ORIGINALE: è calmo finché nessuno lo
//                          attacca; se lo colpisci diventa l'Antico Originale.
// Gli abitanti restano vicino a casa (non spariscono). Comando di prova: /scriptevent vamp:villaggio umano|cacciatori|vampiri|originale
import { world, system, ItemStack, BlockPermutation } from '@minecraft/server';
import * as U from './util.js';
import * as Sed from './sedia.js';
import * as MC from '@minecraft/server';
import * as Rocca from './rocca.js';

export const ZONA = 320;
const PROB = 0.5;
const TIPI = [['umano', 35], ['cacciatori', 25], ['vampiri', 25], ['originale', 15]];
export const NOMI = { umano: 'un borgo umano', cacciatori: 'un avamposto di cacciatori di vampiri', vampiri: 'un covo di vampiri', originale: 'la Rocca del Drago di un Originale' };
const R = 18;                                   // raggio del villaggio (37×37: il 40% più grande, richiesta del 26/11/2026)
const NATURALE = /^minecraft:(grass_block|dirt|coarse_dirt|podzol|sand|red_sand|snow|snow_layer|stone|gravel|moss_block|mud|clay|short_grass|tall_grass|fern|large_fern|.*_flower|dandelion|poppy|.*_leaves|.*_log|sweet_berry_bush|dead_bush|.*tulip|azure_bluet|oxeye_daisy|cornflower|allium|blue_orchid|lily_of_the_valley|pink_petals|leaf_litter|bush|firefly_bush)$/;

const zonaDi = (l) => `${Math.floor(l.x / ZONA)},${Math.floor(l.z / ZONA)}`;

// ---------------------------------------------------------------- comandi di costruzione
let registro = null;                                   // comandi falliti durante una costruzione (si ritentano)
function cmd(dim, c) { try { dim.runCommand(c); return true; } catch { registro?.push(c); return false; } }
function riempi(dim, x0, y0, z0, x1, y1, z1, blocco, modo = '') { cmd(dim, `fill ${x0} ${y0} ${z0} ${x1} ${y1} ${z1} ${blocco}${modo ? ' ' + modo : ''}`); }
function metti(dim, x, y, z, blocco) { cmd(dim, `setblock ${x} ${y} ${z} ${blocco}`); }
/** letto (due metà) rivolto verso +z; se gli stati non vanno, niente letto */
function letto(dim, x, y, z) {
  for (const [k, v0] of [['direction', 0], ['minecraft:cardinal_direction', 'south']]) {
    try {
      const piedi = BlockPermutation.resolve('minecraft:bed', { [k]: v0, head_piece_bit: false });
      const testa = BlockPermutation.resolve('minecraft:bed', { [k]: v0, head_piece_bit: true });
      dim.getBlock(U.v3(x, y, z)).setPermutation(piedi);
      dim.getBlock(U.v3(x, y, z + 1)).setPermutation(testa);
      return true;
    } catch {}
  }
  return false;
}
/** cassa con dentro gli oggetti */
function cassa(dim, x, y, z, oggetti) {
  metti(dim, x, y, z, 'chest');
  let c;
  try { c = dim.getBlock(U.v3(x, y, z))?.getComponent('minecraft:inventory')?.container; } catch {}
  for (const [id, n] of oggetti) { try { c?.addItem(id instanceof ItemStack ? id : new ItemStack(id, n)); } catch {} }   // id può essere già un oggetto incantato
}
const DIR_CARD = { nord: 'north', sud: 'south', est: 'east', ovest: 'west' };
const DIR_NUM = { est: 0, sud: 1, ovest: 2, nord: 3 };
/** porta vera (due metà). Prova gli stati nuovi (cardinal_direction) e quelli vecchi (direction); se nessuno va, resta il vano. */
function porta(dim, x, y, z, verso, legno = 'dark_oak_door') {
  for (const st of [{ 'minecraft:cardinal_direction': DIR_CARD[verso] }, { direction: DIR_NUM[verso] }]) {
    try {
      const basso = BlockPermutation.resolve('minecraft:' + legno, { ...st, upper_block_bit: false, open_bit: false, door_hinge_bit: false });
      const alto = BlockPermutation.resolve('minecraft:' + legno, { ...st, upper_block_bit: true, open_bit: false, door_hinge_bit: false });
      dim.getBlock(U.v3(x, y, z)).setPermutation(basso);
      dim.getBlock(U.v3(x, y + 1, z)).setPermutation(alto);
      return true;
    } catch {}
  }
  return false;
}

/** CASA in stile MEDIEVALE PUNK (1.5.0). Il pavimento è allo stesso livello del terreno (prima i muri erano un "fill hollow",
 *  che riempiva anche lo strato in basso: dentro si stava un blocco più in alto della porta).
 *  Zoccolo di pietra, graticcio con le travi a vista, tetto a capanna di rame, comignolo che fuma, tubo lungo il muro,
 *  finestre, PORTA vera, lanterna sul palo; dentro letto, barile, banco, e nelle case grandi tavolo con le sedie,
 *  libreria, fornello e tappeto. fronte = -1: porta a nord (z minore); +1: porta a sud. Restituisce il colmo del tetto. */
function casa(dim, x, y, z, w, d, h, st, fronte = -1) {
  const x1 = x + w - 1, z1 = z + d - 1, zp = fronte < 0 ? z : z1, zf = fronte < 0 ? z - 1 : z1 + 1;
  riempi(dim, x, y - 1, z, x1, y - 1, z1, st.fondamenta);
  riempi(dim, x + 1, y - 1, z + 1, x1 - 1, y - 1, z1 - 1, st.pavimento);
  riempi(dim, x + 1, y, z + 1, x1 - 1, y + h - 1, z1 - 1, 'air');
  muri(dim, x, y, z, x1, y + h - 1, z1, st.muro);
  muri(dim, x, y, z, x1, y, z1, st.zoccolo);
  muri(dim, x, y + h - 1, z, x1, y + h - 1, z1, st.trave);
  for (const [cx, cz] of [[x, z], [x1, z], [x, z1], [x1, z1]]) riempi(dim, cx, y, cz, cx, y + h - 1, cz, st.palo);
  const mx = x + Math.floor(w / 2), mz = z + Math.floor(d / 2);
  for (let t = x + 2; t < x1 - 1; t += 3) if (t !== mx) { riempi(dim, t, y + 1, z, t, y + h - 2, z, st.palo); riempi(dim, t, y + 1, z1, t, y + h - 2, z1, st.palo); }
  // tetto a capanna (colmo lungo x) a gradini, sporgente di 1, con i timpani pieni
  let k = 0;
  for (; z - 1 + k <= z1 + 1 - k; k++) riempi(dim, x - 1, y + h + k, z - 1 + k, x1 + 1, y + h + k, z1 + 1 - k, k % 2 ? st.tetto2 : st.tetto);
  const colmo = y + h + k - 1;
  riempi(dim, x - 1, colmo, z + Math.floor(d / 2), x1 + 1, colmo, z1 - Math.floor(d / 2), st.colmo);
  for (let q = 0; q < k - 1; q++) { riempi(dim, x, y + h + q, z + q + 1, x, y + h + q, z1 - q - 1, st.muro); riempi(dim, x1, y + h + q, z + q + 1, x1, y + h + q, z1 - q - 1, st.muro); }
  // finestre sui lati e sul retro (due per lato nelle case lunghe)
  for (const fz of d >= 7 ? [z + 2, z1 - 2] : [mz]) { riempi(dim, x, y + 1, fz, x, y + 2, fz, st.finestra); riempi(dim, x1, y + 1, fz, x1, y + 2, fz, st.finestra); }
  for (const fx of w >= 8 ? [x + 2, x1 - 2] : [mx - 1 > x ? mx - 1 : mx]) riempi(dim, fx, y + 1, fronte < 0 ? z1 : z, fx, y + 2, fronte < 0 ? z1 : z, st.finestra);
  if (w >= 8) metti(dim, mx + 2, y + 1, zp, st.finestra);
  // PORTA vera, gradino, lanterna sul palo
  riempi(dim, mx, y, zp, mx, y + 1, zp, 'air');
  metti(dim, mx, y - 1, zp, st.pavimento);
  porta(dim, mx, y, zp, fronte < 0 ? 'nord' : 'sud', st.porta ?? 'dark_oak_door');
  metti(dim, mx, y - 1, zf, st.fondamenta);
  metti(dim, mx + 1, y, zf, st.recinto); metti(dim, mx + 1, y + 1, zf, st.luce);
  // comignolo che fuma (in un angolo dietro) e tubo lungo il muro
  const cx = x1 - 1, cz = fronte < 0 ? z1 - 1 : z + 1, dietro = fronte < 0 ? z1 - 2 : z + 1, davanti = fronte < 0 ? z + 1 : z1 - 1;
  riempi(dim, cx, y, cz, cx, colmo + 1, cz, st.camino);
  metti(dim, cx, colmo + 2, cz, 'campfire');
  if (st.tubo) riempi(dim, x1 + 1, y, cz, x1 + 1, y + h, cz, st.tubo);
  // arredi
  if (st.letto) letto(dim, x + 1, y, dietro);
  metti(dim, x + 1, y, davanti, 'barrel');
  if (w >= 6) metti(dim, x1 - 1, y, davanti, st.banco ?? 'crafting_table');
  if (w >= 8 && d >= 6) {
    const tx = x + 3;
    metti(dim, tx, y, mz, st.recinto); metti(dim, tx, y + 1, mz, st.piatto ?? 'wooden_pressure_plate');
    metti(dim, tx - 1, y, mz, st.sedia ?? 'oak_stairs'); metti(dim, tx + 1, y, mz, st.sedia ?? 'oak_stairs');
    riempi(dim, x1 - 1, y, mz, x1 - 1, y + 1, mz, st.libreria ?? 'bookshelf');
    metti(dim, x1 - 1, y, mz + (fronte < 0 ? -1 : 1), st.fornello ?? 'smoker');
    metti(dim, mx, y, mz, st.tappeto ?? 'red_carpet');
  }
  lanternaAppesa(dim, mx, y + h - 1, mz);
  return colmo;
}
/** lampione: palo di muretto con la lanterna */
function lampione(dim, x, y, z, palo, luce) { riempi(dim, x, y, z, x, y + 1, z, palo); metti(dim, x, y + 2, z, luce); }
/** torre quadrata con tetto di rame a piramide, campana e scala a pioli; porta verso -z */
function torre(dim, tx, y, tz, h, st) {
  riempi(dim, tx, y - 1, tz, tx + 4, y - 1, tz + 4, st.fondamenta);
  muri(dim, tx, y, tz, tx + 4, y + h - 1, tz + 4, st.muro);
  for (const [cx, cz] of [[tx, tz], [tx + 4, tz], [tx, tz + 4], [tx + 4, tz + 4]]) riempi(dim, cx, y, cz, cx, y + h + 2, cz, st.palo);
  for (const yy of [3, Math.floor(h / 2) + 1]) { metti(dim, tx, y + yy, tz + 2, 'iron_bars'); metti(dim, tx + 4, y + yy, tz + 2, 'iron_bars'); metti(dim, tx + 2, y + yy, tz + 4, 'iron_bars'); }
  riempi(dim, tx + 2, y, tz, tx + 2, y + 1, tz, 'air'); porta(dim, tx + 2, y, tz, 'nord', st.porta ?? 'spruce_door');
  riempi(dim, tx, y + h, tz, tx + 4, y + h, tz + 4, st.pavimento);
  muri(dim, tx, y + h + 1, tz, tx + 4, y + h + 1, tz + 4, st.recinto);
  riempi(dim, tx - 1, y + h + 3, tz - 1, tx + 5, y + h + 3, tz + 5, st.tetto);
  riempi(dim, tx, y + h + 4, tz, tx + 4, y + h + 4, tz + 4, st.tetto2);
  riempi(dim, tx + 1, y + h + 5, tz + 1, tx + 3, y + h + 5, tz + 3, st.tetto2); metti(dim, tx + 2, y + h + 6, tz + 2, 'lightning_rod');
  metti(dim, tx + 2, y + h + 2, tz + 2, 'bell');
  scala(dim, tx + 3, y, y + h, tz + 2, 4);
}

// ---------------------------------------------------------------- creature
function abitante(dim, l, verbena = false) {
  let e;
  try { e = dim.spawnEntity('minecraft:villager_v2', l); } catch { return undefined; }
  try { e.addTag(verbena ? 'vamp_verbena' : 'vamp_pulito'); } catch {}
  return e;
}
// PNG di tutte le età e di tutti i gradi (1.5.0): il nome sopra la testa dice chi sono
export const ETA_PNG = ['', 'Neonato', 'Giovane', 'Adulto', 'Antico', 'Millenario'];
export const GRADI_PNG = ['', 'Recluta', 'Cacciatore', 'Veterano', 'Maestro'];
/** dà al PNG un'età (vampiro, 1..5) o un grado (cacciatore, 1..4) e il nome; senza numero la sceglie a caso come la natura */
export function grado(e, n) {
  if (e.typeId === U.I('vampiro')) {
    n ??= [1, 1, 1, 2, 2, 3, 3, 4, 5][Math.floor(Math.random() * 9)];
    try { e.triggerEvent(U.I('eta_' + n)); } catch {}
    try { e.nameTag = '§4Vampiro ' + ETA_PNG[n]; } catch {}
  } else if (/^vamp:cacciatore/.test(e.typeId)) {
    n ??= [1, 1, 1, 2, 2, 3, 3, 4][Math.floor(Math.random() * 8)];
    try { e.triggerEvent(U.I('grado_' + n)); } catch {}
    try { e.nameTag = '§6' + (n === 2 ? 'Cacciatore' : 'Cacciatore ' + GRADI_PNG[n]); } catch {}
  }
  U.set(e, 'grado_png', n);
  return e;
}
function residente(dim, tipo, l, anello = false, livello) {
  let e;
  try { e = dim.spawnEntity(tipo, l); } catch { return undefined; }
  try { e.triggerEvent(U.I('residente')); } catch {}                             // resta vicino a casa e non sparisce
  if (anello) { try { e.triggerEvent(U.I('metti_anello')); } catch {} }
  grado(e, livello);
  return e;
}

// ---------------------------------------------------------------- i villaggi medievali punk (1.5.0: 40% più grandi, 37×37)
const BORGO = { fondamenta: 'cobblestone', pavimento: 'oak_planks', zoccolo: 'cobblestone', muro: 'white_terracotta', trave: 'stripped_dark_oak_log',
  palo: 'stripped_dark_oak_log', tetto: 'waxed_exposed_cut_copper', tetto2: 'waxed_weathered_cut_copper', colmo: 'waxed_cut_copper',
  finestra: 'glass_pane', recinto: 'dark_oak_fence', luce: 'lantern', camino: 'brick_block', tubo: 'lightning_rod', letto: true, porta: 'dark_oak_door' };
const CASERMA = { fondamenta: 'stone_bricks', pavimento: 'spruce_planks', zoccolo: 'mossy_cobblestone', muro: 'spruce_planks', trave: 'stripped_spruce_log',
  palo: 'spruce_log', tetto: 'waxed_weathered_cut_copper', tetto2: 'waxed_oxidized_cut_copper', colmo: 'iron_block',
  finestra: 'iron_bars', recinto: 'spruce_fence', luce: 'lantern', camino: 'mud_bricks', tubo: 'chain', letto: true, banco: 'smithing_table',
  porta: 'spruce_door', sedia: 'spruce_stairs', piatto: 'spruce_pressure_plate', tappeto: 'brown_carpet' };
const NERA = { fondamenta: 'polished_blackstone', pavimento: 'polished_blackstone', zoccolo: 'blackstone', muro: 'deepslate_bricks', trave: 'stripped_crimson_stem',
  palo: 'polished_blackstone_bricks', tetto: 'waxed_oxidized_cut_copper', tetto2: 'deepslate_tiles', colmo: 'polished_blackstone_bricks',
  finestra: 'red_stained_glass_pane', recinto: 'crimson_fence', luce: 'soul_lantern', camino: 'polished_blackstone_bricks', tubo: 'chain', letto: true,
  porta: 'crimson_door', sedia: 'crimson_stairs', piatto: 'crimson_pressure_plate', libreria: 'bookshelf', fornello: 'blast_furnace', tappeto: 'red_carpet' };
const TORRE_BORGO = { ...BORGO, pavimento: 'dark_oak_planks', recinto: 'dark_oak_fence', muro: 'stone_bricks', palo: 'stripped_dark_oak_log' };
const TORRE_CACCIA = { ...CASERMA, pavimento: 'spruce_planks', muro: 'spruce_planks', palo: 'stripped_spruce_log' };

function borgoUmano(dim, c) {
  const { x, y, z } = c, A = R - 1;
  // muretto di cinta con i varchi sulle strade e le lanterne ai varchi
  muri(dim, x - A, y, z - A, x + A, y, z + A, 'cobblestone_wall');
  for (const [dx, dz] of [[0, -A], [0, A], [-A, 0], [A, 0]]) {
    riempi(dim, x + (dx ? dx : -1), y, z + (dz ? dz : -1), x + (dx ? dx : 1), y, z + (dz ? dz : 1), 'air');
    for (const s of [-2, 2]) lampione(dim, x + (dx || s), y, z + (dz || s), 'cobblestone_wall', 'lantern');
  }
  // strade di terra battuta, piazza lastricata
  riempi(dim, x - A, y - 1, z - 1, x + A, y - 1, z + 1, 'grass_path'); riempi(dim, x - 1, y - 1, z - A, x + 1, y - 1, z + A, 'grass_path');
  riempi(dim, x - 4, y - 1, z - 4, x + 4, y - 1, z + 4, 'stone_bricks'); muri(dim, x - 4, y - 1, z - 4, x + 4, y - 1, z + 4, 'polished_andesite');
  // otto case a graticcio (le porte guardano il centro)
  casa(dim, x - 16, y, z - 16, 9, 7, 5, BORGO, 1); casa(dim, x - 7, y, z - 16, 6, 6, 4, BORGO, 1);
  casa(dim, x + 2, y, z - 16, 6, 6, 4, BORGO, 1); casa(dim, x + 9, y, z - 16, 9, 7, 5, BORGO, 1);
  casa(dim, x - 16, y, z + 10, 9, 7, 5, BORGO, -1); casa(dim, x - 7, y, z + 11, 6, 6, 4, BORGO, -1);
  casa(dim, x + 2, y, z + 11, 6, 6, 4, BORGO, -1); casa(dim, x + 9, y, z + 10, 9, 7, 5, BORGO, -1);
  // pozzo col tettuccio di rame su pali, la catena e il secchio (calderone)
  riempi(dim, x - 1, y - 1, z - 1, x + 1, y, z + 1, 'cobblestone'); metti(dim, x, y - 1, z, 'water'); metti(dim, x, y, z, 'water');
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) riempi(dim, x + dx, y + 1, z + dz, x + dx, y + 2, z + dz, 'dark_oak_fence');
  riempi(dim, x - 2, y + 3, z - 2, x + 2, y + 3, z + 2, 'waxed_cut_copper_slab'); metti(dim, x, y + 3, z, 'waxed_cut_copper'); metti(dim, x, y + 2, z, 'chain');
  metti(dim, x + 2, y, z + 2, 'cauldron');
  for (const [dx, dz] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) lampione(dim, x + dx, y, z + dz, 'cobblestone_wall', 'lantern');
  // mercato (nord-ovest): tre bancarelle con le tende a strisce e la merce
  for (const sx of [-15, -11, -7]) {
    for (const [dx, dz] of [[0, -8], [3, -8], [0, -4], [3, -4]]) riempi(dim, x + sx + dx, y, z + dz, x + sx + dx, y + 2, z + dz, 'spruce_fence');
    for (let t = 0; t <= 3; t++) riempi(dim, x + sx + t, y + 3, z - 8, x + sx + t, y + 3, z - 4, t % 2 ? 'white_wool' : (sx === -11 ? 'blue_wool' : 'red_wool'));
    metti(dim, x + sx + 1, y, z - 7, 'barrel'); metti(dim, x + sx + 2, y, z - 7, sx === -15 ? 'hay_block' : sx === -11 ? 'melon_block' : 'pumpkin');
    metti(dim, x + sx + 1, y, z - 6, 'composter'); metti(dim, x + sx + 2, y, z - 5, 'spruce_slab');
  }
  // forgia del fabbro (nord-est): tettoia di rame, altoforni col camino, incudine, mola, banco, barili, calderone
  for (const [dx, dz] of [[4, -8], [16, -8], [4, -3], [16, -3], [10, -8]]) riempi(dim, x + dx, y, z + dz, x + dx, y + 3, z + dz, 'stripped_dark_oak_log');
  riempi(dim, x + 3, y + 4, z - 9, x + 17, y + 4, z - 2, 'waxed_exposed_cut_copper_slab');
  riempi(dim, x + 4, y - 1, z - 8, x + 16, y - 1, z - 3, 'stone_bricks');
  metti(dim, x + 15, y, z - 6, 'blast_furnace'); metti(dim, x + 15, y, z - 5, 'blast_furnace'); riempi(dim, x + 16, y, z - 6, x + 16, y + 6, z - 5, 'brick_block');
  metti(dim, x + 16, y + 7, z - 6, 'campfire');
  metti(dim, x + 10, y, z - 5, 'anvil'); metti(dim, x + 12, y, z - 4, 'smithing_table'); metti(dim, x + 12, y, z - 7, 'grindstone');
  metti(dim, x + 6, y, z - 7, 'barrel'); metti(dim, x + 7, y, z - 7, 'barrel'); metti(dim, x + 6, y + 1, z - 7, 'barrel'); metti(dim, x + 5, y, z - 4, 'cauldron');
  lanternaAppesa(dim, x + 8, y + 3, z - 5); lanternaAppesa(dim, x + 13, y + 3, z - 5);
  // orto di verbena recintato (sud-ovest) e campo di grano con l'acqua
  muri(dim, x - 15, y, z + 3, x - 9, y, z + 8, 'dark_oak_fence'); metti(dim, x - 12, y, z + 3, 'dark_oak_fence_gate');
  for (const [dx, dz] of [[-14, 4], [-13, 4], [-11, 4], [-10, 4], [-14, 6], [-12, 6], [-10, 6], [-13, 7], [-11, 7]]) { metti(dim, x + dx, y - 1, z + dz, 'grass_block'); metti(dim, x + dx, y, z + dz, U.I('verbena_pianta')); }
  riempi(dim, x - 7, y - 1, z + 3, x - 3, y - 1, z + 8, 'farmland'); riempi(dim, x - 7, y, z + 3, x - 3, y, z + 8, 'wheat');
  riempi(dim, x - 5, y - 1, z + 3, x - 5, y - 1, z + 8, 'water'); riempi(dim, x - 5, y, z + 3, x - 5, y, z + 8, 'air');
  // torre dell'orologio col tetto di rame e la campana (sud-est), carretti di fieno, panchine
  torre(dim, x + 12, y, z + 3, 10, TORRE_BORGO);
  riempi(dim, x + 4, y, z + 6, x + 5, y, z + 7, 'hay_block'); metti(dim, x + 4, y + 1, z + 6, 'hay_block'); metti(dim, x + 6, y, z + 7, 'grindstone'); metti(dim, x + 3, y, z + 7, 'grindstone');
  for (const dx of [7, 9]) metti(dim, x + dx, y, z + 4, 'dark_oak_stairs');
  for (const t of [-12, -8, 8, 12]) lampione(dim, x + t, y, z + 2, 'cobblestone_wall', 'lantern');
  cassa(dim, x - 14, y, z - 11, [['minecraft:bread', 6], ['minecraft:carrot', 8], [U.I('verbena'), 4], ['minecraft:iron_ingot', 3]]);
  const g = [];
  for (let i = 0; i < 6; i++) g.push(abitante(dim, U.v3(x + 2.5 + (i % 3) * 1.5, y, z + 1.5 + Math.floor(i / 3) * 1.5 - 4), i < 2));
  return g.filter(Boolean).length;
}

function avampostoCacciatori(dim, c) {
  const { x, y, z } = c, A = R - 1;
  // palizzata appuntita (5 tronchi d'altezza) con il camminamento interno
  muri(dim, x - A, y, z - A, x + A, y + 4, z + A, 'spruce_log');
  for (let t = -A; t <= A; t += 2) { metti(dim, x + t, y + 5, z - A, 'spruce_fence'); metti(dim, x + t, y + 5, z + A, 'spruce_fence'); metti(dim, x - A, y + 5, z + t, 'spruce_fence'); metti(dim, x + A, y + 5, z + t, 'spruce_fence'); }
  muri(dim, x - A + 1, y + 3, z - A + 1, x + A - 1, y + 3, z + A - 1, 'spruce_slab');
  // portone a nord con la saracinesca alzata, due torrette e le lanterne
  riempi(dim, x - 1, y, z - A, x + 1, y + 3, z - A, 'air');
  riempi(dim, x - 1, y + 4, z - A, x + 1, y + 4, z - A, 'iron_bars');
  for (const sx of [-3, 3]) {
    riempi(dim, x + sx - 1, y, z - A - 1, x + sx + 1, y + 7, z - A + 1, 'stripped_spruce_log');
    riempi(dim, x + sx - 1, y + 8, z - A - 1, x + sx + 1, y + 8, z - A + 1, 'waxed_weathered_cut_copper_slab');
    metti(dim, x + sx, y + 6, z - A - 2, 'lantern');
  }
  // torre di guardia con la campana (sud-est) e tre piattaforme con le balestre da muro
  torre(dim, x + 11, y, z + 10, 11, TORRE_CACCIA);
  for (const [px, pz] of [[-15, -15], [13, -15], [-15, 13]]) {
    for (const [dx, dz] of [[0, 0], [2, 0], [0, 2], [2, 2]]) riempi(dim, x + px + dx, y, z + pz + dz, x + px + dx, y + 6, z + pz + dz, 'stripped_spruce_log');
    riempi(dim, x + px, y + 7, z + pz, x + px + 2, y + 7, z + pz + 2, 'spruce_planks');
    muri(dim, x + px, y + 8, z + pz, x + px + 2, y + 8, z + pz + 2, 'spruce_fence');
    metti(dim, x + px + 1, y + 8, z + pz + 1, 'dispenser');
    scala(dim, x + px + 1, y, y + 7, z + pz + 1, 4);
  }
  // caserme, e la mensa lunga col tavolone
  casa(dim, x - 15, y, z - 12, 9, 6, 5, CASERMA, 1);
  casa(dim, x - 15, y, z + 5, 9, 6, 5, CASERMA, -1);
  casa(dim, x + 2, y, z - 12, 11, 7, 5, CASERMA, 1);
  riempi(dim, x + 4, y, z - 9, x + 9, y, z - 9, 'spruce_fence'); riempi(dim, x + 4, y + 1, z - 9, x + 9, y + 1, z - 9, 'spruce_pressure_plate');
  for (const dz of [-10, -8]) for (let t = 4; t <= 9; t += 2) metti(dim, x + t, y, z + dz, 'spruce_stairs');
  // armeria (sud): tettoia, incudine, mola, banco del fabbro, tavolo da arciere, barili di frecce, rastrelliera
  riempi(dim, x - 4, y - 1, z + 9, x + 5, y - 1, z + 14, 'stone_bricks');
  for (const [dx, dz] of [[-4, 9], [5, 9], [-4, 14], [5, 14]]) riempi(dim, x + dx, y, z + dz, x + dx, y + 3, z + dz, 'spruce_log');
  riempi(dim, x - 5, y + 4, z + 8, x + 6, y + 4, z + 15, 'waxed_weathered_cut_copper_slab');
  metti(dim, x - 2, y, z + 14, 'anvil'); metti(dim, x - 1, y, z + 14, 'grindstone'); metti(dim, x, y, z + 14, 'smithing_table'); metti(dim, x + 1, y, z + 14, 'fletching_table');
  metti(dim, x + 2, y, z + 14, 'barrel'); metti(dim, x + 3, y, z + 14, 'barrel'); metti(dim, x + 3, y + 1, z + 14, 'barrel');
  riempi(dim, x - 3, y, z + 10, x - 3, y + 1, z + 12, 'spruce_fence'); lanternaAppesa(dim, x, y + 3, z + 11);
  // campo d'allenamento (ovest): fantocci di fieno con la testa di zucca e i bersagli
  for (const dz of [-3, 0, 3]) { metti(dim, x - 10, y, z + dz, 'hay_block'); metti(dim, x - 10, y + 1, z + dz, 'carved_pumpkin'); }
  metti(dim, x - 15, y, z - 1, 'target'); metti(dim, x - 15, y + 1, z - 1, 'target');
  // gabbia per vampiri (sbarre, tetto di ferro, catena)
  muri(dim, x + 6, y, z + 1, x + 9, y + 2, z + 4, 'iron_bars');
  riempi(dim, x + 6, y + 3, z + 1, x + 9, y + 3, z + 4, 'iron_block'); metti(dim, x + 7, y + 2, z + 2, 'chain');
  // falò al centro coi ceppi, casse e fieno vicino al portone, lampioni
  metti(dim, x, y, z, 'campfire');
  for (const [dx, dz] of [[-2, 0], [2, 0], [0, 2], [0, -2]]) metti(dim, x + dx, y, z + dz, 'stripped_spruce_log');
  riempi(dim, x + 4, y, z - 15, x + 5, y, z - 14, 'hay_block'); metti(dim, x - 5, y, z - 15, 'barrel'); metti(dim, x - 5, y + 1, z - 15, 'barrel');
  for (const [dx, dz] of [[-6, -2], [6, -2], [-6, 6], [6, 6]]) lampione(dim, x + dx, y, z + dz, 'spruce_fence', 'lantern');
  cassa(dim, x + 2, y, z - 2, [[U.I('paletto'), 8], [U.I('paletto_quercia'), 1], [U.I('verbena'), 6], [U.I('granata_verbena'), 2], [U.I('sacca_vuota'), 4], ['minecraft:arrow', 16]]);
  const g = [];
  for (let i = 0; i < 4; i++) g.push(residente(dim, U.I(i % 2 ? 'cacciatore_paletto' : 'cacciatore'), U.v3(x - 2.5 + i * 1.5, y, z + 3.5), false, i + 1));   // uno per grado
  return g.filter(Boolean).length;
}

function covoVampiri(dim, c) {
  const { x, y, z } = c, A = R - 1;
  // viali di pietra nera; cancellata di ferro tutto intorno con i pilastri
  riempi(dim, x - A, y - 1, z, x + A, y - 1, z, 'blackstone'); riempi(dim, x, y - 1, z - A, x, y - 1, z + A, 'blackstone');
  muri(dim, x - A, y, z - A, x + A, y + 1, z + A, 'iron_bars');
  for (let t = -A; t <= A; t += 6) for (const [px, pz] of [[t, -A], [t, A], [-A, t], [A, t]]) { riempi(dim, x + px, y, z + pz, x + px, y + 2, z + pz, 'polished_blackstone_bricks'); metti(dim, x + px, y + 3, z + pz, 'soul_lantern'); }
  for (const [dx, dz] of [[0, -A], [0, A], [-A, 0], [A, 0]]) riempi(dim, x + (dx || -1), y, z + (dz || -1), x + (dx || 1), y + 1, z + (dz || 1), 'air');
  // tre case gotiche
  casa(dim, x - 16, y, z - 16, 9, 7, 6, NERA, 1);
  casa(dim, x + 8, y, z - 16, 9, 7, 6, NERA, 1);
  casa(dim, x - 16, y, z + 10, 9, 7, 6, NERA, -1);
  // cripta (mausoleo, sud-est) con le bare e la Sedia del prelievo
  riempi(dim, x + 5, y - 1, z + 5, x + 15, y - 1, z + 15, 'soul_soil');
  riempi(dim, x + 6, y - 1, z + 6, x + 14, y - 1, z + 14, 'polished_blackstone');
  riempi(dim, x + 6, y, z + 6, x + 14, y + 4, z + 14, 'air');
  muri(dim, x + 5, y, z + 5, x + 15, y + 4, z + 15, 'polished_blackstone_bricks');
  for (const [cx, cz] of [[5, 5], [15, 5], [5, 15], [15, 15], [10, 5]]) riempi(dim, x + cx, y, z + cz, x + cx, y + 6, z + cz, 'chiseled_polished_blackstone');
  riempi(dim, x + 5, y + 5, z + 5, x + 15, y + 5, z + 15, 'deepslate_tiles');
  riempi(dim, x + 6, y + 6, z + 6, x + 14, y + 6, z + 14, 'deepslate_tiles');
  riempi(dim, x + 7, y + 7, z + 7, x + 13, y + 7, z + 13, 'waxed_oxidized_cut_copper');
  riempi(dim, x + 9, y + 8, z + 9, x + 11, y + 8, z + 11, 'waxed_oxidized_cut_copper'); metti(dim, x + 10, y + 9, z + 10, 'lightning_rod');
  riempi(dim, x + 9, y, z + 5, x + 9, y + 1, z + 5, 'air'); porta(dim, x + 9, y, z + 5, 'nord', 'iron_door');
  metti(dim, x + 8, y + 2, z + 4, 'soul_lantern'); metti(dim, x + 11, y + 2, z + 4, 'soul_lantern');
  for (const dz of [8, 12]) { riempi(dim, x + 5, y + 1, z + dz, x + 5, y + 2, z + dz, 'red_stained_glass_pane'); riempi(dim, x + 15, y + 1, z + dz, x + 15, y + 2, z + dz, 'red_stained_glass_pane'); }
  for (const dx of [7, 12]) { riempi(dim, x + dx, y, z + 13, x + dx + 1, y, z + 13, 'dark_oak_planks'); metti(dim, x + dx, y + 1, z + 13, 'dark_oak_slab'); }
  metti(dim, x + 7, y, z + 7, 'soul_lantern'); metti(dim, x + 13, y, z + 7, 'soul_lantern');
  lanternaAppesa(dim, x + 10, y + 4, z + 10);
  // fontana di sangue al centro
  riempi(dim, x - 3, y, z - 3, x + 3, y, z + 3, 'polished_blackstone_wall');
  riempi(dim, x - 2, y, z - 2, x + 2, y, z + 2, 'air'); riempi(dim, x - 2, y - 1, z - 2, x + 2, y - 1, z + 2, 'redstone_block');
  riempi(dim, x, y - 1, z, x, y + 3, z, 'polished_blackstone_bricks'); metti(dim, x, y + 4, z, 'soul_lantern');
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) metti(dim, x + dx, y + 2, z + dz, 'chain');
  for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) metti(dim, x + dx, y + 1, z + dz, 'soul_lantern');
  // cimitero (sud-ovest) con lapidi, ragnatele, cespugli secchi e cancellata
  muri(dim, x - 15, y, z + 2, x - 4, y, z + 8, 'iron_bars'); metti(dim, x - 9, y, z + 2, 'air');
  for (const [dx, dz] of [[-14, 4], [-12, 4], [-10, 4], [-8, 4], [-6, 4], [-14, 7], [-11, 7], [-8, 7], [-6, 7]]) { metti(dim, x + dx, y, z + dz, 'stone_brick_wall'); metti(dim, x + dx, y - 1, z + dz + 1, 'coarse_dirt'); }
  for (const [dx, dz] of [[-13, 5], [-7, 6], [-10, 6]]) metti(dim, x + dx, y, z + dz, 'web');
  for (const [dx, dz] of [[-12, 6], [-5, 5]]) metti(dim, x + dx, y, z + dz, 'deadbush');
  // cappella sconsacrata (nord, al centro): vetrate rosse, candele, altare di ossidiana piangente
  riempi(dim, x - 4, y - 1, z - 14, x + 4, y - 1, z - 8, 'polished_blackstone');
  riempi(dim, x - 3, y, z - 13, x + 3, y + 5, z - 9, 'air');
  muri(dim, x - 4, y, z - 14, x + 4, y + 5, z - 8, 'polished_blackstone_bricks');
  for (let k = 0; k < 4; k++) riempi(dim, x - 4 + k, y + 6 + k, z - 14, x + 4 - k, y + 6 + k, z - 8, 'deepslate_tiles');
  riempi(dim, x - 1, y + 2, z - 14, x + 1, y + 4, z - 14, 'red_stained_glass');
  riempi(dim, x, y, z - 8, x, y + 1, z - 8, 'air'); porta(dim, x, y, z - 8, 'sud', 'crimson_door');
  riempi(dim, x - 1, y, z - 13, x + 1, y, z - 13, 'crying_obsidian'); metti(dim, x - 1, y + 1, z - 13, 'candle'); metti(dim, x + 1, y + 1, z - 13, 'candle');
  for (const dx of [-2, 2]) for (const dz of [-11, -10]) metti(dim, x + dx, y, z + dz, 'crimson_stairs');
  // forca con la gabbia appesa (nord-est) e alberi morti
  riempi(dim, x + 7, y, z - 5, x + 7, y + 6, z - 5, 'polished_blackstone_bricks'); riempi(dim, x + 8, y + 6, z - 5, x + 11, y + 6, z - 5, 'polished_blackstone_bricks');
  metti(dim, x + 11, y + 5, z - 5, 'chain'); riempi(dim, x + 11, y + 2, z - 5, x + 11, y + 4, z - 5, 'iron_bars');
  for (const [tx, tz] of [[-3, -16], [15, -3]]) { riempi(dim, x + tx, y, z + tz, x + tx, y + 4, z + tz, 'dark_oak_log'); metti(dim, x + tx + 1, y + 3, z + tz, 'dark_oak_log'); metti(dim, x + tx - 1, y + 4, z + tz, 'dark_oak_log'); }
  for (const [dx, dz] of [[-5, -5], [5, -5], [-5, 5], [4, 5]]) lampione(dim, x + dx, y, z + dz, 'polished_blackstone_wall', 'soul_lantern');
  // la Sedia del prelievo con un abitante legato, cibo e sacche
  metti(dim, x + 10, y, z + 10, U.I('sedia'));
  const vittima = abitante(dim, U.v3(x + 10.5, y, z + 11.5));
  U.guard(() => Sed.prepara(dim, U.v3(x + 10, y, z + 10), vittima, 6, 6));
  cassa(dim, x + 13, y, z + 7, [[U.I('sacca_sangue'), 4], [U.I('sacca_vuota'), 6], [U.I('fiala_vampiro'), 1], ['minecraft:bread', 6]]);
  const g = [];
  for (let i = 0; i < 5; i++) g.push(residente(dim, U.I('vampiro'), U.v3(x - 3.5 + i * 1.7, y, z - 5.5), i < 3, i + 1));   // uno per età
  return g.filter(Boolean).length;
}

// ---------------------------------------------------------------- ROCCA DEL DRAGO (dimora dell'Originale, 26/11/2026)
// Ispirata al tutorial "Dragonstone Castle" di Stevler (playlist "Minecraft costruzione" di Jowa), ridotta e rifatta
// a comandi: base scura in deepslate, muri grigi con lesene alte e finestre strette con le sbarre, portale gotico, mura di
// cinta con 4 torri, mastio a gradoni con le due "ali di drago" in cima, salone a volta con le lanterne, sala del Tavolo
// dipinto, camerata, stanza del tesoro e camera del Signore in cima. 18 guardie vampiro e bottino prezioso.
export const RO = Rocca.RAGGIO;                          // raggio della Rocca del Drago (isola sospesa)
const RAGGIO = { originale: RO };
export const raggioDi = (tipo) => RAGGIO[tipo] ?? R;
function muri(dim, x0, y0, z0, x1, y1, z1, b) {
  riempi(dim, x0, y0, z0, x1, y1, z0, b); riempi(dim, x0, y0, z1, x1, y1, z1, b);
  riempi(dim, x0, y0, z0, x0, y1, z1, b); riempi(dim, x1, y0, z0, x1, y1, z1, b);
}
/** colonna di scale a pioli appoggiata al muro (verso: 4 = muro a est, 5 = muro a ovest) */
function scala(dim, x, y0, y1, z, verso) {
  if (!cmd(dim, `fill ${x} ${y0} ${z} ${x} ${y1} ${z} ladder["facing_direction"=${verso}]`)) riempi(dim, x, y0, z, x, y1, z, 'ladder');
}
function lanternaAppesa(dim, x, y, z) { if (!cmd(dim, `setblock ${x} ${y} ${z} lantern["hanging"=true]`)) metti(dim, x, y, z, 'lantern'); }
/** oggetto incantato (se l'incantesimo non va, resta l'oggetto normale) */
function incantato(id, incantesimi, nome) {
  const s = new ItemStack(id, 1);
  try {
    const e = s.getComponent?.('minecraft:enchantable');
    for (const [t, l] of incantesimi) {
      try { e?.addEnchantment({ type: MC.EnchantmentTypes?.get?.(t) ?? new MC.EnchantmentType(t), level: l }); } catch {}
    }
  } catch {}
  if (nome) { try { s.nameTag = nome; } catch {} }
  return s;
}
const ARMATURA = [['protection', 4], ['unbreaking', 3], ['mending', 1]];

/** Rocca del Drago v2 (rocca.js): isola sospesa a 50 blocchi, costruita a pezzi; alla fine il Signore e le 18 guardie */
function dimoraOriginale(dim, c) {
  const base = U.v3(c.x, c.y + Rocca.ALTO, c.z);
  const aiuti = { lanterna: lanternaAppesa, letto, scala, cassa };
  Rocca.usaApi(MC);
  Rocca.costruisciRocca(dim, base, aiuti, () => {
    const [tx, ty, tz] = Rocca.TRONO;
    const lord = (() => { try { return dim.spawnEntity(U.I('originale'), U.v3(base.x + tx, base.y + ty, base.z + tz)); } catch { return undefined; } })();
    if (lord) {
      try { lord.triggerEvent(U.I('signore')); } catch {}
      U.set(lord, 'calmo', true);
      try { lord.nameTag = '§6Il Signore Originale'; } catch {}
      U.set(lord, 'medaglione', true);                   // la prima Santa Bomba gli spezza il medaglione
    }
    for (const [k, [pianoNome]] of Rocca.GUARDIE.entries()) {
      const q = Rocca.postoGuardia(k);
      if (q) residente(dim, U.I('vampiro'), U.v3(base.x + q[0], base.y + q[1], base.z + q[2]), true, pianoNome === 'mastio' || pianoNome === 'piano3' ? 5 : 4);
    }
  });
  return 1 + Rocca.GUARDIE.length;                         // compaiono quando la costruzione è finita
}

const COSTRUTTORI = { umano: borgoUmano, cacciatori: avampostoCacciatori, vampiri: covoVampiri, originale: dimoraOriginale };

// ---------------------------------------------------------------- dove costruire
/** altezza del terreno (primo blocco solido dall'alto) e se è naturale */
function terreno(dim, x, z) {
  let b;
  try { b = dim.getTopmostBlock({ x, z }); } catch { return undefined; }
  if (!b) return undefined;
  let y = b.location.y, t = b.typeId;
  for (let k = 0; k < 24 && /leaves|_log$|grass$|fern|flower|bush|petals|snow_layer|litter|dandelion|poppy|tulip|orchid|allium|bluet|daisy|cornflower|lily/.test(t); k++) {
    const sotto = U.blk(dim, U.v3(x, y - 1, z));
    if (!sotto) return undefined;
    y--; t = sotto.typeId;
  }
  return { y, t, naturale: NATURALE.test(t) && !/water|lava/.test(t) };
}
/** cerca un posto piatto e naturale; restituisce il centro (y = primo blocco d'aria) o undefined */
export function cercaPosto(dim, vicino, tentativi = 8, R = 13) {
  const grande = R > 13;
  for (let i = 0; i < tentativi; i++) {
    const a = Math.random() * Math.PI * 2, r = grande ? 75 + Math.random() * 15 : 40 + Math.random() * 24;
    const cx = Math.floor(vicino.x + Math.cos(a) * r), cz = Math.floor(vicino.z + Math.sin(a) * r);
    const alt = [];
    let ok = true;
    const passo = grande ? 12 : 4;
    for (let dx = -R; dx <= R && ok; dx += passo) for (let dz = -R; dz <= R && ok; dz += passo) {
      const t = terreno(dim, cx + dx, cz + dz);
      if (!t || (!t.naturale && !(grande && /water/.test(t.t)))) ok = false; else alt.push(t.y);   // la Rocca può galleggiare anche sul mare
    }
    if (!ok || !alt.length) continue;
    alt.sort((p, q) => p - q);
    if (!grande && alt[alt.length - 1] - alt[0] > 5) continue;                  // la Rocca sospesa non ha bisogno di terreno piatto
    if (lontanoDaAltri(dim.id, cx, cz) < 160) continue;
    return U.v3(cx, alt[Math.floor(alt.length / 2)] + 1, cz);
  }
  return undefined;
}
function lontanoDaAltri(d, x, z) {
  let m = 1e9;
  for (const v of U.wGetJ('villaggi', [])) if (v.d === d) m = Math.min(m, Math.hypot(v.x - x, v.z - z));
  return m;
}

/** spiana il terreno e costruisce il villaggio; restituisce il numero di abitanti */
export function costruisci(dim, tipo, c) {
  const f = COSTRUTTORI[tipo];
  if (!f) return 0;
  const { x, y, z } = c;
  const fondo = tipo === 'umano' ? 'grass_block' : tipo === 'cacciatori' ? 'podzol' : tipo === 'originale' ? 'stone' : 'coarse_dirt';
  const R = raggioDi(tipo);
  const elenco = U.wGetJ('villaggi', []);
  elenco.push({ tipo, d: dim.id, x, y, z });
  U.wSetJ('villaggi', elenco.slice(-200));
  if (tipo === 'originale') return f(dim, c);                   // la Rocca carica la sua area e ritenta da sola (rocca.js)
  // tutta l'area caricata PRIMA di costruire (senza, i pezzi lontani dal giocatore mancavano)
  let n = -1;
  const subito = U.conAreaCaricata(dim, x - R - 1, z - R - 1, x + R + 1, z + R + 1, y, 'vamp_villaggio_' + Math.abs(x) + '_' + Math.abs(z), (area) => {
    registro = [];
    riempi(dim, x - R, y - 9, z - R, x + R, y - 2, z + R, 'dirt', 'replace air');               // riempie i buchi sotto
    riempi(dim, x - R, y - 1, z - R, x + R, y - 1, z + R, fondo);
    for (let y0 = 0; y0 <= 26; y0 += 13) riempi(dim, x - R, y + y0, z - R, x + R, y + Math.min(26, y0 + 12), z + R, 'air');   // toglie alberi e collinette (a fette: un fill fa max 32768 blocchi)
    n = f(dim, c);
    const falliti = registro;
    registro = null;
    ritenta(dim, falliti, 0, () => U.togliArea(dim, area));
  });
  return subito ? n : -1;
}
/** ritenta i comandi falliti (fino a 3 volte, a 2 secondi di distanza), poi chiama fine() */
function ritenta(dim, falliti, volta, fine) {
  if (!falliti.length || volta >= 3) { if (falliti.length) console.warn(`[vamp] villaggio: ${falliti.length} comandi non riusciti`); fine(); return; }
  system.runTimeout(() => U.guard(() => {
    const ancora = [];
    for (const c of falliti) { try { dim.runCommand(c); } catch { ancora.push(c); } }
    ritenta(dim, ancora, volta + 1, fine);
  }), 40);
}

function direzione(da, a) {
  const ang = Math.atan2(a.z - da.z, a.x - da.x) * 180 / Math.PI;           // 0 = est, 90 = sud
  const nomi = ['est', 'sud-est', 'sud', 'sud-ovest', 'ovest', 'nord-ovest', 'nord', 'nord-est'];
  return nomi[((Math.round(ang / 45) % 8) + 8) % 8];
}

function sceglieTipo() {
  let t = Math.random() * TIPI.reduce((s, [, w]) => s + w, 0);
  for (const [n, w] of TIPI) { if ((t -= w) < 0) return n; }
  return 'umano';
}

/** ogni 5 secondi: zone nuove esplorate dai giocatori nel mondo normale */
export function tickVillaggi() {
  if (U.wGet('villaggi_spenti', false)) return;                       // /scriptevent vamp:villaggi off
  const viste = U.wGetJ('zone_viste', []);
  const set = new Set(viste);
  let cambiato = false;
  for (const p of world.getPlayers()) {
    if (p.dimension.id !== 'minecraft:overworld') continue;
    const k = zonaDi(p.location);
    if (set.has(k)) continue;
    set.add(k); viste.push(k); cambiato = true;
    if (Math.abs(p.location.x) < 96 && Math.abs(p.location.z) < 96) continue;    // non attaccato al punto di partenza
    if (Math.random() >= PROB) continue;
    const tipo = sceglieTipo();
    const c = cercaPosto(p.dimension, p.location, 8, raggioDi(tipo));
    if (!c) continue;
    const n = costruisci(p.dimension, tipo, c);
    const dist = Math.round(U.dist2d(p.location, c));
    U.tell(p, `§6[Villaggio]§r A circa §f${dist} blocchi§r verso §f${direzione(p.location, c)}§r c'è ${NOMI[tipo]}.`);
    if (n === 0) U.tell(p, '§8(gli abitanti non sono comparsi: il posto era troppo lontano)');
    if (n < 0) U.tell(p, '§8(lo sto costruendo: carico la zona, ci vuole qualche secondo)');
  }
  if (cambiato) U.wSetJ('zone_viste', viste.slice(-1500));
}

/** comando di prova: costruisce un villaggio a 30 blocchi davanti al giocatore */
export function provaVillaggio(p, tipo) {
  if (!COSTRUTTORI[tipo]) { U.tell(p, '§7Tipi: umano, cacciatori, vampiri, originale'); return; }
  const d = U.norm2d(p.getViewDirection());
  const dd = tipo === 'originale' ? 75 : 30;
  const cx = Math.floor(p.location.x + d.x * dd), cz = Math.floor(p.location.z + d.z * dd);
  const t = terreno(p.dimension, cx, cz);
  const c = U.v3(cx, (t?.y ?? Math.floor(p.location.y) - 1) + 1, cz);
  const n = costruisci(p.dimension, tipo, c);
  U.tell(p, `§6[Villaggio]§r Costruito ${NOMI[tipo]} davanti a te (${n} abitanti).`);
}
