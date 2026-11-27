// Sangue Immortale — ROCCA DEL DRAGO v2 (26/11/2026), rifatta sul tutorial "Dragonstone Castle" di Stevler (5 parti,
// playlist "Minecraft costruzione" di Jowa). Dal video:
//   - PIANTA a stella / drago ad ali aperte (cartello "1st FLOOR" della parte 2): un corpo centrale con 11 punte
//     (due corna in alto, ali ai lati, artigli e coda in basso), circa 80×86 blocchi;
//   - MURI fatti di COSTOLE VERTICALI strette e vicine, scure in basso (deepslate) e grigio chiaro in alto
//     (andesite, pietra, mattoni di pietra), con le cime frastagliate e le punte che si alzano verso l'esterno;
//   - GRADONI concentrici (la stessa stella sempre più piccola) fino al mastio, in cima due grandi CORNA a V;
//   - finestre strette con le sbarre, portale gotico, salone a volta con le lanterne e il trono.
// La costruzione è lunga (migliaia di comandi): va a pezzi, 200 comandi per tick, con un'area caricata (tickingarea)
// finché non è finita; alla fine compaiono il Signore Originale e le 18 guardie.
import { system, ItemStack } from '@minecraft/server';
import * as U from './util.js';
import { BLOCCHI, DATI, POSTI } from './rocca_dati.js';

export const RAGGIO = 62;                               // ingombro (pianta ~108×116 + bordo di roccia)
const K = 1.35;                                         // la pianta del video ingrandita del 35% (richiesta di Jowa)
export const H = [0, 16, 26, 35, 44];                   // altezza di ogni gradone (1 = esterno ... 4 = mastio): bassi e larghi come nel video
const SCALA = [0, 1.0, 0.8, 0.6, 0.42];

// ---------------------------------------------------------------- la pianta (in blocchi, x destra, z verso il portale)
const CORPO = [[-20, -30], [20, -30], [30, -18], [31, 16], [22, 30], [-22, 30], [-31, 16], [-30, -18]];
// punte: [punta x, punta z, larghezza della base]  (dalla pianta del video: corna, ali, artigli, coda)
const PUNTE = [[-18, -43, 12], [18, -43, 12], [-34, -31, 10], [34, -31, 10], [-41, -3, 13], [41, -3, 13],
  [-38, 21, 10], [38, 21, 10], [-21, 42, 10], [21, 42, 10], [0, 37, 9]];
function dentroPoligono(p, x, z) {
  let d = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, zi] = p[i], [xj, zj] = p[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) d = !d;
  }
  return d;
}
const TRIANGOLI = PUNTE.map(([tx, tz, w]) => {
  const l = Math.hypot(tx, tz), ux = tx / l, uz = tz / l, bx = ux * l * 0.55, bz = uz * l * 0.55;
  return [[tx, tz], [bx - uz * w / 2, bz + ux * w / 2], [bx + uz * w / 2, bz - ux * w / 2]];
});
/** il punto (x, z) è dentro il gradone k? (k = 1 tutta la pianta, poi la stessa stella rimpicciolita) */
export function dentro(k, x, z) {
  const s = SCALA[k];
  if (!s) return false;
  const px = x / s / K, pz = z / s / K;
  if (dentroPoligono(CORPO, px, pz)) return true;
  for (const t of TRIANGOLI) if (dentroPoligono(t, px, pz)) return true;
  return false;
}
const bordo = (k, x, z) => dentro(k, x, z) && (!dentro(k, x + 1, z) || !dentro(k, x - 1, z) || !dentro(k, x, z + 1) || !dentro(k, x, z - 1));
const hash = (x, z) => { let h = (x * 73856093) ^ (z * 19349663); h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0); };
/** quanto è "punta" una colonna del gradone k: le punte (artigli) si alzano verso l'esterno */
function slancio(k, x, z) {
  const r = Math.hypot(x, z) / SCALA[k] / K;
  return Math.max(0, Math.round((r - 30) * 0.5));
}

// ---------------------------------------------------------------- materiali: PIETRA NERA con CONTRASTI di LUMINITE del Nether (richiesta di Jowa)
// in basso pietranera grezza e dorata (gilded), in mezzo una fascia di luminite, in alto mattoni di pietranera levigata;
// le costole in rilievo hanno la cima di luminite (fanno anche luce di notte). L'oro resta solo nel trono e nel tesoro.
function fasce(hq, y0, y1, x, z) {
  // restituisce [[da, a, blocco], ...] in altezze assolute rispetto al suolo (0 = livello del terreno)
  const pari = (x + z) % 2 === 0, hh = hash(x, z);
  const basso = hh % 5 === 0 ? 'gilded_blackstone' : (pari ? 'blackstone' : 'polished_blackstone');
  const fascia = hh % 3 === 0 ? 'glowstone' : 'gilded_blackstone';
  const alto = pari ? 'polished_blackstone_bricks' : (hh % 4 ? 'polished_blackstone' : 'cracked_polished_blackstone_bricks');
  const out = [], b1 = Math.round(hq * 0.3);
  const metti = (a, b, m) => { const da = Math.max(a, y0), al = Math.min(b, y1); if (da <= al) out.push([da, al, m]); };
  metti(0, b1 - 1, basso); metti(b1, b1, fascia); metti(b1 + 1, 999, alto);
  return out;
}

// ---------------------------------------------------------------- il piano di costruzione (lista di comandi e funzioni)
/** prepara tutti i comandi; c = centro (y = primo blocco d'aria sopra il terreno) */
export const ALTO = 50;                                 // l'isola galleggia 50 blocchi sopra il terreno (richiesta di Jowa)
/** c = centro del PAVIMENTO del castello (già alzato di ALTO); il terreno è ALTO blocchi più in basso */
// ---------------------------------------------------------------- piano PRECALCOLATO (1.5.1)
// Calcolare la pianta sul telefono richiedeva troppo tempo in un solo tick: il controllo anti-blocco di Minecraft
// fermava lo script e la Rocca non compariva. Ora il piano si calcola sul PC (prove_simulate/genera_rocca.mjs) e sta
// in rocca_dati.js: sul telefono si leggono solo le voci, una alla volta, mentre si costruisce.
let _voci = null;
function voci() { if (!_voci) _voci = DATI.split(';'); return _voci; }
/** la voce i del piano, già spostata nel punto c: stringa di comando o [cosa, x, y, z, extra] */
function voce(i, c) {
  const p = voci()[i].split(','), t = p[0];
  if (t === 'f') return `fill ${c.x + +p[1]} ${c.y + +p[2]} ${c.z + +p[3]} ${c.x + +p[4]} ${c.y + +p[5]} ${c.z + +p[6]} ${BLOCCHI[+p[7]]}`;
  if (t === 's') return `setblock ${c.x + +p[1]} ${c.y + +p[2]} ${c.z + +p[3]} ${BLOCCHI[+p[4]]}`;
  return [p[1], +p[2], +p[3], +p[4], p[5] !== undefined && p[5] !== '' && !isNaN(+p[5]) ? +p[5] : p[5]];
}
export const nVoci = () => (DATI ? voci().length : 0);
/** il piano completo (per le prove e le anteprime) */
export function piano(c) {
  if (!DATI) return pianoCalcolato(c);
  const L = [];
  for (let i = 0; i < nVoci(); i++) L.push(voce(i, c));
  return L;
}

export function pianoCalcolato(c, alto = ALTO) {
  const { x: X, y: Y, z: Z } = c, L = [];
  const fill = (x0, y0, z0, x1, y1, z1, b) => L.push(`fill ${X + x0} ${Y + y0} ${Z + z0} ${X + x1} ${Y + y1} ${Z + z1} ${b}`);
  const set = (x, y, z, b) => L.push(`setblock ${X + x} ${Y + y} ${Z + z} ${b}`);
  const R = 60, N = 2 * R + 1, id = (x, z) => (x + R) * N + (z + R);
  // ---- sgombera il volume (alberi, colline): a fette di 2 blocchi, un fill fa al massimo 32768 blocchi
  for (let y0 = -42; y0 <= 80; y0 += 2) fill(-62, y0, -62, 62, y0 + 1, 62, 'air');
  // ---- ISOLA SOSPESA: la pianta allargata di 4 blocchi, sotto un cono rovesciato di roccia nera
  const dentro1 = new Uint8Array(N * N), dist = new Float32Array(N * N).fill(1e9);
  const coda = [];
  for (let x = -R; x <= R; x++) for (let z = -R; z <= R; z++) if (dentro(1, x, z)) { dentro1[id(x, z)] = 1; dist[id(x, z)] = 0; coda.push([x, z]); }
  for (let q = 0; q < coda.length; q++) {                         // distanza dalla pianta (per allargarla)
    const [x, z] = coda[q], d0 = dist[id(x, z)];
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = x + dx, nz = z + dz;
      if (Math.abs(nx) > R || Math.abs(nz) > R) continue;
      const nd = d0 + (dx && dz ? 1.41 : 1);
      if (nd < dist[id(nx, nz)] && nd <= 4.5) { dist[id(nx, nz)] = nd; coda.push([nx, nz]); }
    }
  }
  const isola = (x, z) => Math.abs(x) <= R && Math.abs(z) <= R && dist[id(x, z)] <= 4.5;
  const prof = new Float32Array(N * N).fill(0), c2 = [];            // profondità: distanza dal bordo dell'isola
  for (let x = -R; x <= R; x++) for (let z = -R; z <= R; z++) {
    if (!isola(x, z)) continue;
    if (!isola(x + 1, z) || !isola(x - 1, z) || !isola(x, z + 1) || !isola(x, z - 1)) { prof[id(x, z)] = 1; c2.push([x, z]); }
  }
  for (let q = 0; q < c2.length; q++) {
    const [x, z] = c2[q], d0 = prof[id(x, z)];
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz;
      if (!isola(nx, nz) || prof[id(nx, nz)]) continue;
      prof[id(nx, nz)] = d0 + 1; c2.push([nx, nz]);
    }
  }
  const fondo = (x, z) => { const e = prof[id(x, z)], h = hash(x, z); return Math.min(36, 2 + Math.round(e * 0.85) + (h % 3) + (h % 31 === 0 ? 6 : 0)); };
  let massimo = 0;
  for (let x = -R; x <= R; x++) for (let z = -R; z <= R; z++) if (isola(x, z)) massimo = Math.max(massimo, fondo(x, z));
  const STRATI = (d) => (d <= 2 ? 'blackstone' : d % 7 === 0 ? 'gilded_blackstone' : d % 3 === 0 ? 'basalt' : d < 14 ? 'blackstone' : 'smooth_basalt');
  for (let d = 0; d <= massimo; d++) {                               // a strati: una riga di fill per ogni tratto
    const m = d === 0 ? 'polished_blackstone' : STRATI(d);
    for (let x = -R; x <= R; x++) {
      let a = null;
      for (let z = -R; z <= R + 1; z++) {
        const si = z <= R && isola(x, z) && fondo(x, z) >= d;
        if (si && a === null) a = z;
        if (!si && a !== null) { fill(x, -1 - d, a, x, -1 - d, z - 1, m); a = null; }
      }
    }
  }
  // grappoli di luminite che pendono sotto l'isola (luce del Nether) e ringhiera sul bordo
  for (let x = -R; x <= R; x++) for (let z = -R; z <= R; z++) {
    if (!isola(x, z)) continue;
    const h = hash(x, z), f = fondo(x, z);
    if (h % 37 === 0 && f > 4) fill(x, -3 - f - (h % 3), z, x, -2 - f, z, 'glowstone');
    if (prof[id(x, z)] === 1 && !(Math.abs(x) <= 3 && z > 0)) set(x, 0, z, h % 4 ? 'polished_blackstone_wall' : 'blackstone_wall');
  }
  // ---- gradoni: pavimento/tetto per righe, muri a costole sul bordo
  for (let k = 1; k <= 4; k++) {
    const yb = k === 1 ? 0 : H[k - 1] + 1, yt = H[k];
    // tetto del gradone (fa da terrazza per chi sta sopra e da soffitto per chi sta sotto)
    for (let x = -R; x <= R; x++) {
      let a = null;
      for (let z = -R; z <= R + 1; z++) {
        const si = z <= R && dentro(k, x, z);
        if (si && a === null) a = z;
        if (!si && a !== null) { fill(x, yt, a, x, yt, z - 1, k === 4 ? 'polished_blackstone' : 'polished_blackstone_bricks'); if (k === 1) fill(x, -1, a, x, -1, z - 1, 'polished_blackstone'); a = null; }
      }
    }
    for (let x = -R; x <= R; x++) for (let z = -R; z <= R; z++) {
      if (!bordo(k, x, z)) continue;
      const hh = hash(x, z), punta = slancio(k, x, z);
      let top = yt + 1 + (hh % 3) + punta;                           // cime frastagliate, le punte più alte
      // le CORNA del mastio: una grande U, basse al centro e altissime ai lati (più alte ancora sulle punte)
      if (k === 4) top = yt + 1 + Math.round(24 * Math.pow(Math.min(1, Math.abs(x) / 16), 1.6)) + punta * 2 + (hh % 2);
      for (const [a, b, m] of fasce(top, yb, top - 1, x, z)) fill(x, a, z, x, b, z, m);
      set(x, top, z, (x + z) % 2 ? 'polished_blackstone_brick_wall' : 'blackstone_wall');
      // costola esterna in rilievo (una sì e una no), un po' più bassa: le strisce verticali del video
      if ((x + z) % 2 === 0) {
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (dentro(k, x + dx, z + dz)) continue;
          const fx = x + dx, fz = z + dz, ft = Math.max(yb + 2, top - 2 - (hh % 3));
          for (const [a, b, m] of fasce(ft, yb, ft - 1, fx, fz)) fill(fx, a, fz, fx, b, fz, m);
          set(fx, ft, fz, 'glowstone');                                        // cima di luminite della costola
          break;
        }
      }
      // finestre strette con le sbarre
      if (hh % 9 === 0 && yt - yb > 8) fill(x, yb + 4, z, x, yb + 7, z, 'iron_bars');
    }
  }
  // ---- portale gotico e galleria d'ingresso (lungo x = 0, verso +z)
  let zf = R;
  while (zf > 0 && !dentro(1, 0, zf)) zf--;
  for (let z = zf; z > 0; z--) {
    fill(-1, 0, z, 1, 4, z, 'air');
    if (dentro(1, -3, z) && dentro(1, 3, z) && !bordo(1, -2, z) && !bordo(1, 2, z) && z < zf - 1) break;
  }
  fill(-4, 0, zf + 1, 4, 9, zf + 1, 'glowstone'); fill(-3, 0, zf + 1, 3, 8, zf + 1, 'polished_blackstone_bricks');
  fill(-2, 0, zf + 1, 2, 3, zf + 1, 'air'); fill(-1, 4, zf + 1, 1, 5, zf + 1, 'air'); set(0, 6, zf + 1, 'air');
  for (const dx of [-5, 5]) { fill(dx, 0, zf + 2, dx, 1, zf + 2, 'gilded_blackstone'); set(dx, 2, zf + 2, 'dragon_head'); }
  for (let k = 0; k < 6; k++) { fill(-2, -1, zf + 2 + k, 2, -1, zf + 2 + k, 'polished_blackstone'); set(-3, -1, zf + 2 + k, 'glowstone'); set(3, -1, zf + 2 + k, 'glowstone'); }
  // ---- SCALA A CHIOCCIOLA SOSPESA: dal terreno (alto blocchi sotto) fino al ponte davanti al portale
  if (alto > 0) {
    const cz = zf + 13;
    fill(-7, -alto, cz - 6, 7, -2, cz + 6, 'air');
    fill(0, -alto, cz, 0, -1, cz, 'polished_blackstone_bricks');                 // colonna centrale
    for (let k = 0; k < alto; k++) {
      const t = -Math.PI / 2 - (alto - 1 - k) * 0.25, y = -alto + k;
      for (const r of [3, 4, 5]) set(Math.round(Math.cos(t) * r), y, cz + Math.round(Math.sin(t) * r), k % 8 === 0 ? 'glowstone' : 'polished_blackstone_bricks');
      if (k % 4 === 0) set(Math.round(Math.cos(t) * 6), y + 1, cz + Math.round(Math.sin(t) * 6), 'polished_blackstone_wall');
    }
    fill(-2, -1, zf + 8, 2, -1, cz - 3, 'polished_blackstone');
  }
  // ---- SALONE del trono (piano terra): muri a archi, pilastri, lanterne, tappeto rosso
  const A1 = H[1] - 1;
  fill(-7, 0, -26, -7, A1, 22, 'polished_blackstone_bricks'); fill(7, 0, -26, 7, A1, 22, 'polished_blackstone_bricks');
  fill(-7, 5, -26, -7, 5, 22, 'glowstone'); fill(7, 5, -26, 7, 5, 22, 'glowstone');
  for (let z = -22; z <= 20; z += 6) { fill(-7, 0, z, -7, 3, z + 1, 'air'); fill(7, 0, z, 7, 3, z + 1, 'air'); }
  fill(-7, 0, -27, 7, A1, -27, 'polished_blackstone_bricks'); fill(-1, 5, -27, 1, 10, -27, 'red_stained_glass');
  for (let z = -22; z <= 18; z += 5) for (const px of [-4, 4]) { fill(px, 0, z, px, A1, z, 'polished_blackstone'); set(px, 0, z, 'glowstone'); set(px, A1, z, 'glowstone'); }
  for (let z = -20; z <= 18; z += 5) L.push(['lanterna', 0, A1, z]);
  fill(0, 0, -22, 0, 0, zf, 'red_carpet');
  fill(-3, 0, -26, 3, 0, -23, 'polished_blackstone');
  fill(-1, 1, -26, 1, 3, -26, 'gold_block'); set(0, 1, -25, 'polished_blackstone_stairs');
  set(-3, 1, -25, U.I('altare'));
  // pilastri nel resto del piano terra (sostengono il primo gradone)
  for (let x = -56; x <= 56; x += 7) for (let z = -56; z <= 56; z += 7) {
    if (Math.abs(x) <= 8 || (x >= 9 && x <= 13 && z >= -8 && z <= 9) || !dentro(1, x, z) || bordo(1, x, z) || bordo(1, x + 1, z) || bordo(1, x - 1, z)) continue;
    fill(x, 0, z, x, A1, z, 'polished_blackstone_bricks'); set(x, 0, z, 'gilded_blackstone');
    L.push(['lanterna', x + 1, A1, z]);
  }
  // ---- scale fra i piani (blocchi a gradini) con il buco nel soffitto
  const P2 = H[1] + 1, P3 = H[2] + 1, P4 = H[3] + 1;              // pavimento (primo blocco d'aria) di ogni piano
  for (let k = 0; k < H[1]; k++) fill(10, 0, -8 + k, 12, k, -8 + k, 'polished_blackstone_bricks');
  fill(10, H[1], -8, 12, H[1], -9 + H[1], 'air');
  for (let k = 0; k < H[2] - H[1] - 1; k++) fill(5, P2, -4 + k, 6, P2 + k, -4 + k, 'polished_blackstone_bricks');
  fill(5, H[2], -4, 6, H[2], -6 + H[2] - H[1], 'air');
  fill(4, P3, 0, 4, H[3] - 1, 0, 'polished_blackstone_bricks');                      // pilastro a cui si appoggia la scala a pioli
  L.push(['scala', 3, P3, H[3] + 1, 0]);
  // ---- 2° piano: camerata e sala del Tavolo dipinto (una mappa)
  fill(-4, P2, -6, 3, P2, -1, 'dark_oak_planks');
  fill(-4, P2 + 1, -6, 3, P2 + 1, -1, 'blue_carpet'); fill(-3, P2 + 1, -5, -1, P2 + 1, -2, 'green_carpet'); fill(0, P2 + 1, -4, 2, P2 + 1, -2, 'brown_carpet'); set(-2, P2 + 1, -3, 'lime_carpet');
  for (const z of [4, 7, 10]) L.push(['letto', -12, P2, z]);
  for (const z of [-8, 0, 8]) L.push(['lanterna', -2, H[2] - 1, z]);
  L.push(['cassa', -12, P2, 1, 'camerata']);
  // ---- 3° piano: stanza del tesoro
  fill(-6, P3, -8, -4, P3 + 1, -8, 'gold_block'); fill(-14, P3, -8, -12, P3 + 1, -8, 'gold_block');
  set(-6, P3, -6, 'diamond_block'); set(-13, P3, -6, 'emerald_block'); set(-6, P3, -4, 'emerald_block'); set(-13, P3, -4, 'diamond_block');
  L.push(['cassa', -11, P3, -8, 'tesoro1'], ['cassa', -9, P3, -8, 'tesoro2'], ['cassa', -7, P3, -8, 'tesoro3']);
  L.push(['lanterna', -9, H[3] - 1, -5]);
  // ---- mastio: camera del Signore
  fill(-2, P4, -6, 2, P4 + 2, -6, 'bookshelf');
  L.push(['letto', 2, P4, 2], ['cassa', -4, P4, -5, 'signore'], ['lanterna', 0, H[4] - 1, 0]);
  return L;
}

// ---------------------------------------------------------------- bottino e creature
let MC = null;
export function usaApi(m) { MC = m; }
function incantato(id, inc, nome) {
  const s = new ItemStack(id, 1);
  try { const e = s.getComponent?.('minecraft:enchantable'); for (const [t, l] of inc) { try { e?.addEnchantment({ type: MC?.EnchantmentTypes?.get?.(t) ?? new MC.EnchantmentType(t), level: l }); } catch {} } } catch {}
  if (nome) { try { s.nameTag = nome; } catch {} }
  return s;
}
const ARM = [['protection', 4], ['unbreaking', 3], ['mending', 1]];
const BOTTINO = {
  camerata: () => [['minecraft:golden_apple', 8], ['minecraft:experience_bottle', 32], [U.I('sacca_sangue'), 8], ['minecraft:arrow', 64]],
  tesoro1: () => [['minecraft:netherite_ingot', 4], ['minecraft:diamond', 24], ['minecraft:emerald', 32], ['minecraft:gold_block', 8], ['minecraft:enchanted_golden_apple', 3], ['minecraft:totem_of_undying', 2]],
  tesoro2: () => [[incantato('minecraft:netherite_sword', [['sharpness', 5], ['fire_aspect', 2], ['looting', 3], ['unbreaking', 3], ['mending', 1]], "§6Lama dell'Originale"), 1],
    [incantato('minecraft:netherite_helmet', ARM), 1], [incantato('minecraft:netherite_chestplate', ARM), 1], [incantato('minecraft:netherite_leggings', ARM), 1],
    [incantato('minecraft:netherite_boots', [...ARM, ['feather_falling', 4]]), 1], [incantato('minecraft:bow', [['power', 5], ['flame', 1], ['infinity', 1], ['unbreaking', 3]]), 1]],
  tesoro3: () => [[U.I('anello_diurno'), 1], [U.I('medaglione'), 1], [U.I('paletto_argento_quercia'), 1], [U.I('fiala_vampiro'), 2], [U.I('vino'), 4], [U.I('vino_immortalita'), 1], [U.I('sacca_sangue'), 12], [U.I('cura'), 1]],
  signore: () => [[incantato('minecraft:mace', [['density', 5], ['wind_burst', 3], ['unbreaking', 3], ['mending', 1]], '§6Maglio del Drago'), 1],
    [incantato('minecraft:netherite_axe', [['sharpness', 5], ['efficiency', 5], ['unbreaking', 3], ['mending', 1]]), 1],
    [incantato('minecraft:elytra', [['unbreaking', 3], ['mending', 1]]), 1], ['minecraft:nether_star', 1], ['minecraft:beacon', 1], ['minecraft:netherite_block', 1], ['minecraft:enchanted_golden_apple', 2]],
};
// guardie: [piano, x, z] -> si cerca il posto libero più vicino in quel piano
const PIANI = {
  terra: [0, (x, z) => dentro(1, x, z) && !bordo(1, x, z) && Math.abs(Math.abs(x) - 7) > 1 && !(x >= 9 && x <= 13 && z >= -9 && z <= 8) && (x % 7 !== 0 || z % 7 !== 0)],
  terrazza: [H[1] + 1, (x, z) => dentro(1, x, z) && !dentro(2, x, z) && !vicinoBordo(1, x, z) && !vicinoBordo(2, x, z)],
  piano2: [H[1] + 1, (x, z) => dentro(2, x, z) && !vicinoBordo(2, x, z) && !(x >= 9 && x <= 13 && z >= -9 && z <= 8) && !(x >= -5 && x <= 6 && z >= -7 && z <= 6)],
  piano3: [H[2] + 1, (x, z) => dentro(3, x, z) && !vicinoBordo(3, x, z) && z > -7 && !(x >= 2 && x <= 6 && z >= -5 && z <= 6)],
  mastio: [H[3] + 1, (x, z) => dentro(4, x, z) && !vicinoBordo(4, x, z) && z > -5],
};
function vicinoBordo(k, x, z) { for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (bordo(k, x + dx, z + dz)) return true; return false; }
export function posto(pianoNome, x0, z0) {
  const [y, ok] = PIANI[pianoNome];
  for (let r = 0; r <= 14; r++) for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
    if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
    if (ok(x0 + dx, z0 + dz)) return [x0 + dx + 0.5, y, z0 + dz + 0.5];
  }
  return undefined;
}
export const GUARDIE = [['terra', -3, -12], ['terra', 3, -12], ['terra', -3, 5], ['terra', 3, 5], ['terra', -3, 27], ['terra', 3, 27],
  ['terrazza', -37, 0], ['terrazza', 37, 0], ['terrazza', 0, -37], ['terrazza', -30, 32],
  ['piano2', -9, 8], ['piano2', 8, -12], ['piano2', -12, -4],
  ['piano3', 0, -5], ['piano3', -6, 3],
  ['mastio', -6, 0], ['mastio', 6, -2], ['mastio', 0, 6]];
export const TRONO = [0.5, 1, -23.5];
/** posto della guardia i: precalcolato sul PC (la ricerca è lenta sul telefono) */
export const postoGuardia = (i) => (POSTI && POSTI[i] !== undefined ? POSTI[i] : posto(...GUARDIE[i]));

function eseguiVoce(dim, c, v, aiuti) {
  const [cosa, x, y, z, extra] = v;
  const p = U.v3(c.x + x, c.y + y, c.z + z);
  if (cosa === 'lanterna') aiuti.lanterna(dim, p.x, p.y, p.z);
  else if (cosa === 'letto') aiuti.letto(dim, p.x, p.y, p.z);
  else if (cosa === 'scala') aiuti.scala(dim, p.x, p.y, c.y + extra, p.z, 4);
  else if (cosa === 'cassa') aiuti.cassa(dim, p.x, p.y, p.z, BOTTINO[extra]());
}

/** costruisce la Rocca a pezzi; alla fine chiama fatto() (che fa comparire le creature). Restituisce il numero di comandi. */
export function costruisciRocca(dim, c, aiuti, fatto, perTick = 200) {
  const usaDati = !!DATI, L = usaDati ? null : pianoCalcolato(c), N = usaDati ? nVoci() : L.length;
  const nome = 'vamp_rocca_' + Math.abs(c.x) + '_' + Math.abs(c.z), R = RAGGIO;
  let i = 0, falliti = [], volta = 0, area = '';
  const esegui = (v) => {
    if (typeof v === 'string') { try { dim.runCommand(v); } catch { falliti.push(v); } } else U.guard(() => eseguiVoce(dim, c, v, aiuti));
  };
  const passo = () => U.guard(() => {
    const fine = Math.min(N, i + perTick);
    for (; i < fine; i++) esegui(usaDati ? voce(i, c) : L[i]);
    if (i < N) { system.runTimeout(passo, 1); return; }
    // i comandi falliti (chunk non ancora pronti) si ritentano fino a 3 volte: la Rocca deve venire COMPLETA
    if (falliti.length && volta < 3) {
      volta++;
      const ancora = falliti; falliti = [];
      system.runTimeout(() => U.guard(() => { for (const v of ancora) esegui(v); finito(); }), 40);
      return;
    }
    finito();
  });
  const finito = () => {
    if (falliti.length && volta < 3) { passo(); return; }
    if (falliti.length) console.warn(`[vamp] Rocca: ${falliti.length} comandi non riusciti`);
    U.togliArea(dim, area);
    U.guard(fatto);
  };
  // tutta l'area (125×125) caricata prima di cominciare: era il motivo dei pezzi mancanti
  // (verso +z c'è anche la scala a chiocciola davanti al portale: l'area arriva fino a +78)
  U.conAreaCaricata(dim, c.x - R, c.z - R, c.x + R, c.z + 78, c.y, nome, (a) => { area = a; system.runTimeout(passo, 1); });
  return N;
}
