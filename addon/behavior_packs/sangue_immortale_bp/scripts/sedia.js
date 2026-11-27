// Sangue Immortale — SEDIA DEL PRELIEVO (richiesta di Jowa, 24/11/2026): una "farm" di sangue senza uccidere.
//   - Piazza la sedia. TOCCALA A MANO VUOTA: l'umano più vicino (abitante, mercante, predone, vendicatore, evocatore,
//     strega o cacciatore, entro 8 blocchi) viene fatto sedere e legato (cavalca un sedile invisibile: non scappa).
//   - TOCCALA CON DEL CIBO: il cibo va nel vassoio a sinistra (tutta la pila).
//   - TOCCALA CON SACCHE VUOTE: vanno nel cesto a destra (tutta la pila).
//   - Ogni 30 secondi, se c'è qualcuno seduto, almeno 1 cibo e 1 sacca vuota: mangia, gli si preleva il sangue
//     (nessun danno) e una sacca si riempie: Sacca di sangue umano, oppure Sangue di cacciatore se è un cacciatore.
//     La sacca piena va in una cassa/tramoggia/barile attaccati alla sedia (sotto o ai lati); se non c'è, cade a terra.
//   - ACCOVACCIATO + TOCCO A MANO VUOTA: liberi chi è seduto. A mano vuota (senza accovacciarti) vedi lo stato.
//   - Rompendo la sedia ti ridà cibo e sacche, e chi era seduto si alza.
import { world, system, ItemStack } from '@minecraft/server';
import * as U from './util.js';

export const ID = U.I('sedia');
export const SEDILE = U.I('sedile');
const OGNI = 600;                                          // tick tra un prelievo e l'altro (30 s)
const UMANI = /^minecraft:(villager_v2|villager|wandering_trader|pillager|vindicator|evoker|witch)$|^vamp:cacciatore(_paletto)?$/;
const CIBO = /^minecraft:(bread|apple|golden_carrot|carrot|potato|baked_potato|beetroot|cookie|pumpkin_pie|melon_slice|sweet_berries|glow_berries|dried_kelp|cooked_beef|cooked_porkchop|cooked_chicken|cooked_mutton|cooked_rabbit|cooked_cod|cooked_salmon|beef|porkchop|chicken|mutton|rabbit|cod|salmon|mushroom_stew|rabbit_stew|beetroot_soup|honey_bottle|cake)$/;

const chiave = (dim, l) => `${dim.id}|${l.x}|${l.y}|${l.z}`;
const elenco = () => U.wGetJ('sedie', {});
const salvaE = (e) => U.wSetJ('sedie', e);
function dati(b) { return elenco()[chiave(b.dimension, b.location)] ?? { cibo: 0, sacche: 0, chi: '', sedile: '', t: 0, fatte: 0 }; }
function setDati(b, d) { const e = elenco(); e[chiave(b.dimension, b.location)] = d; salvaE(e); }
function setStato(b, k, v) { try { b.setPermutation(b.permutation.withState(U.I(k), v)); } catch {} }
function aggiornaStati(b, d) { setStato(b, 'cibo', d.cibo > 0); setStato(b, 'sacche', d.sacche > 0); }
const centro = (b) => U.add(b.location, U.v3(0.5, 0.5, 0.5));
const nomeDi = (e) => ({ 'minecraft:villager_v2': 'L\'abitante', 'minecraft:villager': 'L\'abitante', 'minecraft:wandering_trader': 'Il mercante',
  'minecraft:pillager': 'Il predone', 'minecraft:vindicator': 'Il vendicatore', 'minecraft:evoker': 'L\'evocatore', 'minecraft:witch': 'La strega' }[e.typeId] ?? 'Il cacciatore');

/** chi è seduto (se c'è ancora) */
function seduto(b, d) {
  if (!d.chi) return undefined;
  const e = world.getEntity(d.chi);
  return U.ok(e) ? e : undefined;
}
function sedile(d) { const s = d.sedile ? world.getEntity(d.sedile) : undefined; return U.ok(s) ? s : undefined; }

function fallSedere(b, d, e) {
  let s = sedile(d);
  if (!s) { try { s = b.dimension.spawnEntity(SEDILE, U.add(b.location, U.v3(0.5, 0.45, 0.5))); } catch { return false; } }
  try { s.getComponent('minecraft:rideable')?.addRider(e); } catch {}
  try { e.addTag('vamp_sedia'); } catch {}
  try { e.triggerEvent(U.I('legato')); } catch {}                     // i cacciatori legati non attaccano
  U.eff(e, 'slowness', 20 * 60, 255); U.eff(e, 'weakness', 20 * 60, 255);
  d.chi = e.id; d.sedile = s.id; d.t = system.currentTick;
  return true;
}
function libera(b, d) {
  const e = seduto(b, d), s = sedile(d);
  if (e) {
    try { s?.getComponent('minecraft:rideable')?.ejectRider(e); } catch {}
    try { e.removeTag('vamp_sedia'); } catch {}
    try { e.triggerEvent(U.I('slegato')); } catch {}
    U.togliEff(e, 'slowness'); U.togliEff(e, 'weakness');
  }
  try { s?.remove(); } catch {}
  d.chi = ''; d.sedile = '';
}

/** tocco sulla sedia */
export function tocca(p, b) {
  if (!b || b.typeId !== ID) return;
  const d = dati(b), s = U.mano(p);
  if (s && CIBO.test(s.typeId)) {
    d.cibo += s.amount; U.setMano(p, undefined);
    U.suono(b.dimension, 'random.pop', centro(b), 0.6, 1.2);
    U.barForte(p, `§6Vassoio del cibo: §f${d.cibo}`, 50);
  } else if (s && s.typeId === U.I('sacca_vuota')) {
    d.sacche += s.amount; U.setMano(p, undefined);
    U.suono(b.dimension, 'random.pop', centro(b), 0.6, 0.9);
    U.barForte(p, `§cCesto delle sacche vuote: §f${d.sacche}`, 50);
  } else if (!s && p.isSneaking) {
    if (!seduto(b, d)) { U.barForte(p, '§7Sulla sedia non c\'è nessuno.'); return; }
    libera(b, d);
    U.barForte(p, '§7Lo hai slegato: si alza dalla sedia.', 50);
  } else if (!s) {
    const e = seduto(b, d);
    if (e) {
      U.barForte(p, `§7${nomeDi(e)} è seduto. §6Cibo §f${d.cibo}§7, §csacche vuote §f${d.sacche}§7, sacche riempite §f${d.fatte}§7. ` +
        '§8(Accovacciato + tocco = slegalo)', 90);
    } else {
      const pres = new Set(Object.values(elenco()).map((x) => x.chi).filter(Boolean));
      const c = U.vicini(b.dimension, centro(b), 8).filter((x) => UMANI.test(x.typeId) && !pres.has(x.id))
        .sort((x, y) => U.dist(x.location, centro(b)) - U.dist(y.location, centro(b)))[0];
      if (!c) { U.barForte(p, '§7Nessun umano entro 8 blocchi da far sedere (abitante, predone, cacciatore...).', 70); return; }
      if (!fallSedere(b, d, c)) return;
      U.suono(b.dimension, 'random.door_close', centro(b), 0.6, 0.8);
      U.barForte(p, `§7${nomeDi(c)} si siede sulla sedia ed è legato. §8Metti cibo e sacche vuote.`, 80);
    }
  } else {
    U.barForte(p, '§7Sedia del prelievo: §fa mano vuota§7 fai sedere un umano, §6cibo§7 nel vassoio, §csacche vuote§7 nel cesto.', 90);
    return;
  }
  aggiornaStati(b, d);
  setDati(b, d);
}

/** prepara una sedia già piazzata: chi è seduto, quanto cibo e quante sacche (usato dai villaggi) */
export function prepara(dim, loc, e, cibo, sacche) {
  const b = U.blk(dim, loc);
  if (!b || b.typeId !== ID) return false;
  const d = dati(b);
  d.cibo = cibo; d.sacche = sacche;
  if (e && U.ok(e)) fallSedere(b, d, e);
  aggiornaStati(b, d);
  setDati(b, d);
  return true;
}

/** sedia rotta: ridà cibo e sacche, chi era seduto si alza */
export function rotta(dim, loc) {
  const e = elenco(), k = chiave(dim, loc), d = e[k];
  if (!d) return;
  const finta = { dimension: dim, location: loc };
  libera(finta, d);
  const l = U.add(loc, U.v3(0.5, 0.5, 0.5));
  const butta = (id, n) => { while (n > 0) { const q = Math.min(64, n); n -= q; try { dim.spawnItem(new ItemStack(id, q), l); } catch {} } };
  butta(U.I('sacca_vuota'), d.sacche);
  butta('minecraft:bread', d.cibo);                          // il cibo misto torna come pane
  delete e[k]; salvaE(e);
}

/** mette la sacca piena in un contenitore attaccato (sotto o ai lati), altrimenti la lascia cadere */
function consegna(b, stack) {
  for (const o of [[0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]) {
    const c = U.blk(b.dimension, U.add(b.location, U.v3(...o)));
    let inv;
    try { inv = c?.getComponent('minecraft:inventory')?.container; } catch {}
    if (!inv) continue;
    let resto;
    try { resto = inv.addItem(stack); } catch { resto = stack; }
    if (!resto) return 'cassa';
    stack = resto;
  }
  try { b.dimension.spawnItem(stack, U.add(b.location, U.v3(0.5, 1.1, 0.5))); } catch {}
  return 'terra';
}

/** ogni secondo: tiene seduti gli ospiti e riempie le sacche */
export function tickSedie() {
  const e = elenco();
  let cambiato = false;
  for (const k of Object.keys(e)) {
    const [dd, x, y, z] = k.split('|');
    let dim;
    try { dim = world.getDimension(dd); } catch { continue; }
    const b = U.blk(dim, U.v3(+x, +y, +z));
    if (!b) continue;                                          // chunk non caricato
    if (b.typeId !== ID) { rotta(dim, U.v3(+x, +y, +z)); continue; }
    const d = e[k];
    const chi = seduto(b, d);
    if (d.chi && !chi) { libera(b, d); cambiato = true; continue; }   // morto o sparito
    if (!chi) continue;
    // resta seduto e legato
    let sopra = false;
    const s = sedile(d);
    try { sopra = !!s?.getComponent('minecraft:rideable')?.getRiders().some((r) => r.id === chi.id); } catch {}
    if (!sopra) { if (s) { try { chi.teleport(s.location); s.getComponent('minecraft:rideable')?.addRider(chi); } catch {} } else fallSedere(b, d, chi); }
    U.eff(chi, 'slowness', 60, 255); U.eff(chi, 'weakness', 60, 255);
    if (system.currentTick - d.t < OGNI) continue;
    if (d.cibo < 1 || d.sacche < 1) continue;
    d.t = system.currentTick;
    d.cibo -= 1; d.sacche -= 1; d.fatte = (d.fatte ?? 0) + 1;
    const id = /^vamp:cacciatore/.test(chi.typeId) ? U.I('sangue_cacciatore') : U.I('sacca_sangue');
    consegna(b, new ItemStack(id, 1));
    U.fx(dim, 'vamp:sangue', U.add(chi.location, U.v3(0, 1.2, 0)));
    U.suono(dim, 'random.drink', centro(b), 0.5, 1.3);
    aggiornaStati(b, d);
    cambiato = true;
  }
  if (cambiato) salvaE(e);
}
