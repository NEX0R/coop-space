// Sangue Immortale — CERCHIO DI CENERE (richiesta di Jowa, 24/11/2026).
// La Cenere di quercia bianca si posa a terra come la polvere di redstone (blocco vamp:cenere_strato).
// Se la cenere forma un giro CHIUSO, nessun vampiro può entrare nello spazio dentro il cerchio:
// viene respinto al bordo. Gli ORIGINALI (giocatore Originale e Antico Originale) passano lo stesso.
// Chi era già dentro quando il cerchio si è chiuso resta dentro (lore: il cerchio intrappola), ma se esce non rientra.
// I cerchi sono salvati nel mondo: { d: dimensione, y, x0, z0, x1, z1, celle: ["x,z", ...] }.
import { world, system } from '@minecraft/server';
import * as U from './util.js';
import * as S from './stato.js';

export const STRATO = U.I('cenere_strato');
const MAX = 48;                                            // lato massimo di un cerchio (blocchi)
const VAMPIRI = /^vamp:(vampiro|squartatore)$/;

const cerchi = () => U.wGetJ('cerchi', []);
const salva = (c) => U.wSetJ('cerchi', c);
const eCenere = (dim, x, y, z) => U.blk(dim, U.v3(x, y, z))?.typeId === STRATO;
function cenereColonna(dim, x, y, z) { return eCenere(dim, x, y, z) || eCenere(dim, x, y - 1, z) || eCenere(dim, x, y + 1, z); }

/** ricalcola i cerchi intorno a un punto (cenere posata o tolta) */
export function ricalcola(dim, loc) {
  const f = U.floor(loc);
  // 1) la cenere collegata (anche in diagonale, anche un gradino su o giù)
  const vista = new Set(), coda = [], colonne = new Map();
  const parti = [];
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++)
    if (eCenere(dim, f.x + dx, f.y + dy, f.z + dz)) parti.push(U.v3(f.x + dx, f.y + dy, f.z + dz));
  for (const p of parti) { const k = `${p.x},${p.y},${p.z}`; if (!vista.has(k)) { vista.add(k); coda.push(p); } }
  let x0 = f.x, x1 = f.x, z0 = f.z, z1 = f.z, ysom = 0;
  while (coda.length && vista.size < 600) {
    const c = coda.pop();
    colonne.set(`${c.x},${c.z}`, c.y); ysom += c.y;
    x0 = Math.min(x0, c.x); x1 = Math.max(x1, c.x); z0 = Math.min(z0, c.z); z1 = Math.max(z1, c.z);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) {
      if (!dx && !dz && !dy) continue;
      const n = U.v3(c.x + dx, c.y + dy, c.z + dz), k = `${n.x},${n.y},${n.z}`;
      if (vista.has(k) || Math.abs(n.x - f.x) > MAX || Math.abs(n.z - f.z) > MAX) continue;
      if (eCenere(dim, n.x, n.y, n.z)) { vista.add(k); coda.push(n); }
    }
  }
  // 2) toglie i cerchi vecchi che toccavano questa zona
  const tutti = cerchi().filter((c) => !(c.d === dim.id && c.x1 >= x0 - 1 && c.x0 <= x1 + 1 && c.z1 >= z0 - 1 && c.z0 <= z1 + 1 && Math.abs(c.y - f.y) <= 3));
  // 3) dentro il riquadro della cenere: le zone che non toccano il bordo sono CHIUSE
  const nuovi = [];
  if (colonne.size >= 4 && x1 - x0 >= 2 && z1 - z0 >= 2 && x1 - x0 <= MAX && z1 - z0 <= MAX) {
    const y = Math.round(ysom / colonne.size), fatte = new Set();
    for (let x = x0 + 1; x < x1; x++) for (let z = z0 + 1; z < z1; z++) {
      const k0 = `${x},${z}`;
      if (fatte.has(k0) || colonne.has(k0)) continue;
      const zona = [], q = [[x, z]];
      let aperta = false;
      fatte.add(k0);
      while (q.length) {
        const [cx, cz] = q.pop();
        zona.push(`${cx},${cz}`);
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx, nz = cz + dz, k = `${nx},${nz}`;
          if (colonne.has(k) || fatte.has(k)) continue;
          if (nx <= x0 || nx >= x1 || nz <= z0 || nz >= z1) { aperta = true; continue; }
          fatte.add(k); q.push([nx, nz]);
        }
      }
      if (aperta || !zona.length) continue;
      const xs = zona.map((s) => +s.split(',')[0]), zs = zona.map((s) => +s.split(',')[1]);
      nuovi.push({ d: dim.id, y, x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs), celle: zona });
    }
  }
  salva([...tutti, ...nuovi].slice(-40));
  for (const c of nuovi) {
    const centro = U.v3((c.x0 + c.x1) / 2 + 0.5, c.y + 0.3, (c.z0 + c.z1) / 2 + 0.5);
    U.suono(dim, 'block.enchanting_table.use', centro, 0.8, 0.6);
    for (const p of U.vicini(dim, centro, 16, { type: 'minecraft:player' })) U.barForte(p, '§7Il cerchio di cenere è §fchiuso§7: nessun vampiro può entrare (tranne gli Originali).', 80);
  }
  return nuovi.length;
}

/** il punto è dentro un cerchio? (il cerchio, oppure undefined) */
export function dentro(dimId, l) {
  const x = Math.floor(l.x), z = Math.floor(l.z);
  for (const c of cerchi()) {
    if (c.d !== dimId || x < c.x0 || x > c.x1 || z < c.z0 || z > c.z1) continue;
    if (l.y < c.y - 1 || l.y > c.y + 4) continue;
    if (c.celle.includes(`${x},${z}`)) return c;
  }
  return undefined;
}

const respinto = (e) => {
  if (e.typeId === 'minecraft:player') return S.eVampiro(e) && !S.eOriginale(e);
  return VAMPIRI.test(e.typeId);                         // l'Antico Originale (vamp:originale) passa
};

// ultima posizione fuori dai cerchi (id -> posizione): chi prova a entrare torna lì
const fuori = new Map();
/** ogni 4 tick */
export function tickCerchi() {
  const tutti = cerchi();
  if (!tutti.length) { fuori.clear(); return; }
  const visti = new Set();
  for (const c of tutti) {
    let dim;
    try { dim = world.getDimension(c.d); } catch { continue; }
    const centro = U.v3((c.x0 + c.x1) / 2 + 0.5, c.y, (c.z0 + c.z1) / 2 + 0.5);
    const r = Math.hypot(c.x1 - c.x0, c.z1 - c.z0) / 2 + 6;
    for (const e of U.vicini(dim, centro, r)) {
      if (visti.has(e.id) || !respinto(e)) continue;
      visti.add(e.id);
      const qui = dentro(dim.id, e.location);
      if (!qui) { fuori.set(e.id, { x: e.location.x, y: e.location.y, z: e.location.z }); continue; }
      const prima = fuori.get(e.id);
      if (!prima) continue;                              // era già dentro quando il cerchio si è chiuso
      try { e.teleport(prima); } catch {}
      try { e.clearVelocity?.(); } catch {}
      U.fx(dim, 'vamp:fumo_nero', U.add(e.location, U.v3(0, 1, 0)));
      if (e.typeId === 'minecraft:player' && U.pronto(e, 40, 'cerchio')) {
        U.barForte(e, '§7La §fcenere di quercia bianca§7 ti respinge: non puoi entrare nel cerchio.', 50);
        U.suonoP(e, 'random.fizz', 0.7, 0.6);
      }
    }
  }
}
