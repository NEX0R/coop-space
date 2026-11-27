// Sangue Immortale — PALETTI COME MUNIZIONI DELLA BALESTRA NORMALE (1.4.0, al posto della Balestra da caccia).
//   - Se hai dei paletti nell'inventario, la balestra del gioco spara PALETTI invece delle frecce.
//     Prima i paletti di legno; il paletto di quercia bianca solo se lo tieni nella mano secondaria (o se non hai altri paletti).
//   - Senza frecce la balestra non si caricherebbe: se hai paletti ma nessuna freccia, quando cominci a caricarla
//     ti viene prestata una freccia (che poi diventa il paletto, quindi non te ne resta niente in più).
//   - Se la freccia caricata era tua, ti viene restituita: si consuma solo il paletto.
//   - I paletti d'argento sono indistruttibili e non si sparano (restano armi da impugnare).
import { world, system, ItemStack } from '@minecraft/server';
import * as U from './util.js';

const LEGNO = U.I('paletto'), QUERCIA = U.I('paletto_quercia');
const prestiti = new Map();                                   // id giocatore -> frecce prestate in attesa di partire

function conta(p, id) {
  const c = U.inv(p);
  let n = 0;
  if (c) for (let i = 0; i < c.size; i++) { const s = c.getItem(i); if (s?.typeId === id) n += s.amount; }
  if (U.manoSinistra(p)?.typeId === id) n += U.manoSinistra(p).amount;
  return n;
}
function togliUno(p, id) {
  const sx = U.manoSinistra(p);
  if (sx?.typeId === id) {
    try { if (sx.amount > 1) { sx.amount -= 1; U.equip(p).setEquipment('Offhand', sx); } else U.equip(p).setEquipment('Offhand', undefined); return true; } catch {}
  }
  const c = U.inv(p);
  if (!c) return false;
  for (let i = 0; i < c.size; i++) {
    const s = c.getItem(i);
    if (s?.typeId !== id) continue;
    if (s.amount > 1) { s.amount -= 1; c.setItem(i, s); } else c.setItem(i, undefined);
    return true;
  }
  return false;
}
/** quale paletto sparare (o niente) */
function quale(p) {
  if (U.manoSinistra(p)?.typeId === QUERCIA) return QUERCIA;
  if (conta(p, LEGNO) > 0) return LEGNO;
  if (conta(p, QUERCIA) > 0) return QUERCIA;
  return undefined;
}

/** comincia a caricare la balestra: se servono, presta una freccia */
export function carica(p) {
  if (!quale(p) || conta(p, 'minecraft:arrow') > 0) return;
  U.dai(p, 'minecraft:arrow');
  prestiti.set(p.id, (prestiti.get(p.id) ?? 0) + 1);
}

/** una freccia appena nata: se l'ha sparata un giocatore con la balestra e dei paletti, diventa un paletto */
export function frecciaNata(f) {
  let chi;
  try { chi = f.getComponent('minecraft:projectile')?.owner; } catch {}
  if (chi?.typeId !== 'minecraft:player' || U.mano(chi)?.typeId !== 'minecraft:crossbow') return;
  const tipo = quale(chi);
  if (!tipo) return;
  let vel, loc;
  try { vel = f.getVelocity(); loc = f.location; } catch { return; }
  togliUno(chi, tipo);
  const pr = prestiti.get(chi.id) ?? 0;
  if (pr > 0) prestiti.set(chi.id, pr - 1); else U.dai(chi, 'minecraft:arrow');     // la freccia vera torna a te
  try { f.remove(); } catch {}
  let d;
  try { d = chi.dimension.spawnEntity(U.I(tipo === QUERCIA ? 'dardo_quercia' : 'dardo_paletto'), loc); } catch { return; }
  try {
    const comp = d.getComponent('minecraft:projectile');
    if (comp) { comp.owner = chi; comp.shoot(vel); } else d.applyImpulse(vel);
  } catch { try { d.applyImpulse(vel); } catch {} }
  U.suono(chi.dimension, 'crossbow.shoot', loc, 0.8, 0.8);
}

/** un prestito non usato (balestra non caricata fino in fondo): la freccia prestata sparisce */
export function restituisci(p) {
  const pr = prestiti.get(p.id) ?? 0;
  if (!pr) return;
  for (let i = 0; i < pr; i++) togliUno(p, 'minecraft:arrow');
  prestiti.delete(p.id);
}
world.afterEvents.itemStopUse?.subscribe?.((ev) => U.guard(() => {
  if (ev.itemStack?.typeId !== 'minecraft:crossbow') return;
  const p = ev.source;
  system.runTimeout(() => U.guard(() => { if (U.ok(p) && conta(p, 'minecraft:arrow') > 0 && (prestiti.get(p.id) ?? 0) > 0 && !caricata(p)) restituisci(p); }), 2);
}));
function caricata(p) {
  try { return !!U.mano(p)?.getComponent('minecraft:charged')?.chargedItem; } catch { return false; }
}
