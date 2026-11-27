// Sangue Immortale — SANTA BOMBA A MANO (1.5.0, richiesta di Jowa del 26/11/2026).
// Si fa così (richiesta di Jowa): si crafta il GUSCIO D'ORO (uovo Fabergé: smeraldo, oro, diamante, luminite, polvere da sparo),
// lo si posa sull'ALTARE e si apre come un uovo; si tocca l'altare con LA CURA (la lascia l'Antico Originale), il guscio si
// richiude nella luce e la SANTA BOMBA è finita: si prende toccando l'altare (vedi altare.js).
// Si lancia come la granata di verbena. Dove cade, parte un FASCIO DI LUCE INTENSA che si allarga A CERCHIO
// fino a 25 blocchi di raggio (50×50) in un secondo e mezzo. Quando l'onda di luce ti raggiunge:
//   - UMANI (giocatori non vampiri, abitanti, mercanti, cacciatori, illager): CURATI del tutto, rigenerazione,
//     assorbimento, e via gli effetti negativi;
//   - VAMPIRI (vampiri, squartatori, giocatori vampiri, anche i seguaci): MORTE ISTANTANEA;
//   - ORIGINALI (giocatore Originale o Antico Originale): se hanno il MEDAGLIONE (indossato, in mano o in tasca)
//     il medaglione si SACRIFICA (si rompe) e loro restano vivi con pochissima vita; se non ce l'hanno, MUOIONO.
//     Il Signore Originale della Rocca del Drago porta un medaglione: la prima bomba glielo spezza.
import { world, system } from '@minecraft/server';
import * as U from './util.js';
import * as S from './stato.js';
import { tipoSangue } from './nutrirsi.js';
import { uccidiVampiro } from './poteri.js';

export const BOMBA = U.I('santa_bomba');
export const RAGGIO = 25;                 // 50×50
const DURATA = 30;                        // tick per arrivare al bordo (1,5 s)
const ALTO = 16;                          // la luce sale e scende di 16 blocchi
const NEGATIVI = ['poison', 'wither', 'weakness', 'slowness', 'blindness', 'nausea', 'darkness', 'hunger', 'mining_fatigue'];

const eOriginaleQ = (e) => e.typeId === 'vamp:originale' || (e.typeId === 'minecraft:player' && S.eOriginale(e));

/** la bomba è caduta: comincia l'onda di luce */
export function esplodi(dim, loc, chi) {
  const c = U.v3(loc.x, loc.y, loc.z);
  U.suono(dim, 'beacon.activate', c, 2, 0.5);
  U.suono(dim, 'random.explode', c, 1.2, 1.6);
  U.suono(dim, 'random.levelup', c, 1.5, 0.5);
  for (let y = 0; y < 24; y += 2) U.fx(dim, 'vamp:raggio_santo', U.add(c, U.v3(0, y, 0)));     // colonna di luce
  U.fx(dim, 'vamp:luce_santa', c);
  const fatti = new Set();
  let t = 0;
  const giro = () => U.guard(() => {
    t += 2;
    const r0 = RAGGIO * Math.max(0, t - 2) / DURATA, r1 = Math.min(RAGGIO, RAGGIO * t / DURATA);
    anello(dim, c, r1);
    for (const e of U.vicini(dim, c, r1 + 0.5)) {
      if (fatti.has(e.id) || !U.ok(e)) continue;
      const dx = e.location.x - c.x, dz = e.location.z - c.z, d = Math.hypot(dx, dz);
      if (d > r1 || Math.abs(e.location.y - c.y) > ALTO) continue;
      fatti.add(e.id);
      tocca(e, chi);
    }
    if (t < DURATA) system.runTimeout(giro, 2);
    else for (let y = 0; y < 24; y += 3) U.fx(dim, 'vamp:raggio_santo', U.add(c, U.v3(0, y, 0)));
  });
  giro();
  return fatti;
}

/** l'anello di luce: particelle lungo la circonferenza (al massimo 72 per passo, sul telefono va bene) */
function anello(dim, c, r) {
  if (r < 0.5) return;
  const n = Math.min(72, Math.max(8, Math.round(2 * Math.PI * r / 2.2)));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    U.fx(dim, 'vamp:luce_santa', U.add(c, U.v3(Math.cos(a) * r, 0.6, Math.sin(a) * r)));
  }
}

function sanguina(e) { U.fx(e.dimension, 'vamp:fumo_nero', U.add(e.location, U.v3(0, 1, 0))); U.fx(e.dimension, 'vamp:luce_santa', U.add(e.location, U.v3(0, 1, 0))); }

/** cosa fa la luce a una creatura */
export function tocca(e, chi) {
  if (e.typeId === 'minecraft:player') U.lampo(e, 1, 0.97, 0.82, 0.05, 0.25, 0.9);
  // ---- Originali: il medaglione si sacrifica, altrimenti muoiono
  if (eOriginaleQ(e)) {
    if (e.typeId === 'vamp:originale') {
      try { if (U.get(e, 'calmo', false)) { U.set(e, 'calmo', false); e.triggerEvent(U.I('provocato')); } } catch {}
      if (U.get(e, 'medaglione', false)) {
        U.set(e, 'medaglione', false);
        salvo(e, 30);
        avvisaVicini(e, '§6Il medaglione dell\'Originale si spezza nella luce:§7 è vivo, ma allo stremo.');
      } else {
        sanguina(e);
        avvisaVicini(e, '§eLa luce della Cura brucia l\'Antico Originale!');
        uccidiVampiro(e, chi);
      }
      return 'originale';
    }
    if (rompiMedaglione(e)) {
      salvo(e, 4);
      U.titolo(e, '§6Il medaglione si spezza', '§7Ha preso la luce al posto tuo. Sei vivo per un soffio.');
      return 'salvo';
    }
    sanguina(e);
    S.segnaMorteVera(e, 'la luce santa della Cura');
    U.danno(e, 1000, 'magic', chi);
    return 'morto';
  }
  const tipo = tipoSangue(e);
  // ---- vampiri: morte istantanea
  if (tipo === 'vampiro') {
    sanguina(e);
    if (e.typeId === 'minecraft:player') { S.segnaMorteVera(e, 'la luce santa della Cura'); U.danno(e, 1000, 'magic', chi); }
    else uccidiVampiro(e, chi);
    return 'morto';
  }
  // ---- umani (anche chi è in transizione: non è ancora un vampiro): cura piena
  if (tipo === 'umano') {
    U.curaTutto(e);
    for (const n of NEGATIVI) U.togliEff(e, n);
    U.eff(e, 'regeneration', 200, 1, true);
    U.eff(e, 'absorption', 1200, 1, true);
    if (e.typeId === 'minecraft:player') U.barForte(e, '§eLa luce ti attraversa: ti senti guarito.', 60);
    U.fx(e.dimension, 'vamp:sole', U.add(e.location, U.v3(0, 1, 0)));
    return 'curato';
  }
  return '';
}

function salvo(e, vita) {
  try { const h = e.getComponent('minecraft:health'); h.setCurrentValue(Math.min(h.currentValue, vita)); } catch {}
  U.eff(e, 'weakness', 200, 1); U.eff(e, 'slowness', 200, 1);
  U.suono(e.dimension, 'random.break', e.location, 1.2, 0.7);
  U.suono(e.dimension, 'random.anvil_break', e.location, 0.6, 1.4);
  for (let i = 0; i < 6; i++) U.fx(e.dimension, 'vamp:sole', U.add(e.location, U.v3(0, 0.8 + i * 0.2, 0)));
}
function avvisaVicini(e, t) { for (const q of U.vicini(e.dimension, e.location, 48, { type: 'minecraft:player' })) U.barForte(q, t, 80); }

/** toglie UN medaglione al giocatore (prima quello indossato, poi la mano secondaria, poi l'inventario) */
export function rompiMedaglione(p) {
  const M = U.I('medaglione'), eq = U.equip(p);
  for (const slot of ['Chest', 'Offhand', 'Mainhand']) {
    try { if (eq?.getEquipment(slot)?.typeId === M) { eq.setEquipment(slot, undefined); return true; } } catch {}
  }
  const c = U.inv(p);
  if (c) for (let i = 0; i < c.size; i++) {
    const s = c.getItem(i);
    if (s?.typeId !== M) continue;
    if (s.amount > 1) { s.amount -= 1; c.setItem(i, s); } else c.setItem(i, undefined);
    return true;
  }
  return false;
}
