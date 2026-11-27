// Sangue Immortale — il mondo intorno ai vampiri: cacciatori, Antico Originale e la sua stirpe, verbena, paletti,
// quercia bianca, invito nelle case.
import { world, system, ItemStack, BlockPermutation } from '@minecraft/server';
import * as U from './util.js';
import * as S from './stato.js';
import { uccidiVampiro } from './poteri.js';
import { batFerito } from './pipistrello.js';
import { menteProtetta } from './cacciatore.js';

const VAMP_MOB = /^vamp:(vampiro|squartatore|originale)$/;
export const eVampiroQualsiasi = (e) => VAMP_MOB.test(e.typeId) || (e.typeId === 'minecraft:player' && S.eVampiro(e));

// ---------------------------------------------------------------- danni: paletti, fuoco, frecce dei cacciatori, morsi dei vampiri
const inCorso = new Set();
function armaDi(e) {
  if (!e) return undefined;
  const m = U.mano(e)?.typeId;
  if (m) return m;
  return e.typeId === 'vamp:cacciatore_paletto' ? U.I('paletto') : undefined;   // se la mano del mob non si legge
}
export function ferito(ev) {
  const e = ev.hurtEntity, ds = ev.damageSource, da = ds?.damagingEntity, n = ev.damage;
  if (!U.ok(e) || inCorso.has(e.id)) return;
  if (e.typeId === 'vamp:pipistrello') { batFerito(e, n, ds); return; }
  // i vampiri selvatici si nutrono mordendo: recuperano vita
  if (da && VAMP_MOB.test(da.typeId) && ds.cause === 'entityAttack') {
    U.cura(da, Math.min(6, n));
    U.fx(e.dimension, 'vamp:sangue', U.add(e.location, U.v3(0, 1.4, 0)));
  }
  if (e.typeId !== 'minecraft:player' || !S.eVampiro(e)) {
    if (VAMP_MOB.test(e.typeId) && da?.typeId === 'vamp:cacciatore') { U.eff(e, 'weakness', 100, 0); U.eff(e, 'slowness', 60, 0); }
    return;
  }
  const orig = S.eOriginale(e);
  inCorso.add(e.id);
  try {
    // fuoco: danni doppi (non il sole, che è già calcolato)
    if (/^(fire|fireTick|lava)$/.test(ds.cause) && !orig && !S.bruciaAlSole(e)) {
      S.segnaMorteVera(e, 'il fuoco');
      U.danno(e, n, 'magic');
    }
    // freccia di legno alla verbena dei cacciatori
    if (da?.typeId === 'vamp:cacciatore') {
      U.set(e, 'bloccato', Math.max(U.get(e, 'bloccato', 0), 200)); U.eff(e, 'weakness', 120, 0);
      U.barForte(e, '§dFreccia di legno imbevuta di verbena!', 40);
    }
    // paletto: sotto metà vita = nel cuore
    const arma = armaDi(da);
    if (U.eQuercia(arma) || (U.ePaletto(arma) && !orig)) {
      const h = U.salute(e);
      if (h.ora <= h.max / 2) {
        S.segnaMorteVera(e, U.eQuercia(arma) ? 'un paletto di quercia bianca nel cuore' : 'un paletto nel cuore');
        U.danno(e, 1000, 'entityAttack', da);
      } else { U.danno(e, 3, 'magic'); U.eff(e, 'slowness', 60, 1); }
    }
  } finally { inCorso.delete(e.id); }
}

// ---------------------------------------------------------------- morti
export function morto(ev) {
  const e = ev.deadEntity, ds = ev.damageSource;
  if (e.typeId === 'minecraft:player') { S.allaMorte(e, ds); return; }
  let assassino = ds?.damagingEntity;
  if (e.typeId === 'vamp:originale') { mortaStirpe(e); return; }
  // maledizione del cacciatore: chi uccide un cacciatore ed è un vampiro
  if (/^vamp:cacciatore/.test(e.typeId) && assassino?.typeId === 'minecraft:player' && S.eVampiro(assassino)) {
    if (S.haMedaglione(assassino)) {
      U.barForte(assassino, '§6Il Medaglione del cacciatore si scalda: §7la sua maledizione non ti tocca.', 80);
      U.fx(assassino.dimension, 'vamp:sole', U.add(assassino.location, U.v3(0, 1.2, 0)));
      return;
    }
    U.set(assassino, 'maledizione', 2 * U.GIORNO);
    U.titolo(assassino, '§8La maledizione del cacciatore', '§7Le sue visioni ti tormenteranno.');
    U.tell(assassino, '§8[Maledizione]§r Hai ucciso un cacciatore di vampiri: per §edue giorni di gioco§r vedrai e sentirai cose che non ci sono.');
  }
}

/** lore (Sirelines): se muore un Originale, muoiono tutti i vampiri della sua stirpe */
function mortaStirpe(o) {
  const dim = o.dimension, loc = o.location;
  for (const p of U.vicini(dim, loc, 96, { type: 'minecraft:player' })) {
    U.titolo(p, '§6L\'Antico è caduto', '§7...e con lui tutta la sua stirpe.');
    U.tell(p, '§6[Stirpe]§r Con la morte dell\'Originale, i vampiri della sua stirpe bruciano. Ha lasciato §bLa Cura§r.');
  }
  let i = 0;
  for (const v of U.vicini(dim, loc, 96)) {
    if (!/^vamp:(vampiro|squartatore)$/.test(v.typeId) || U.prop(v, 'vamp:alleato', false)) continue;
    const ritardo = 20 + (i++) * 6;
    system.runTimeout(() => U.guard(() => {
      if (!U.ok(v)) return;
      try { v.setOnFire(5, true); } catch {}
      U.fx(v.dimension, 'vamp:fumo_nero', U.add(v.location, U.v3(0, 1, 0)));
      uccidiVampiro(v);
    }), ritardo);
  }
}

// ---------------------------------------------------------------- granata di verbena
export function granata(dim, loc) {
  U.fx(dim, 'vamp:verbena', loc);
  U.suono(dim, 'random.glass', loc, 1, 0.9);
  U.suono(dim, 'random.fizz', loc, 0.8, 1.2);
  for (const e of U.vicini(dim, loc, 3.5)) {
    if (e.typeId === 'minecraft:player' && !S.eVampiro(e) && !S.inTransizione(e)) { U.set(e, 'verbena', Math.max(U.get(e, 'verbena', 0), 6000)); continue; }
    if (!eVampiroQualsiasi(e)) continue;
    U.danno(e, e.typeId === 'vamp:originale' ? 10 : 6, 'magic');
    U.eff(e, 'weakness', 300, 1); U.eff(e, 'slowness', 300, 1);
    if (e.typeId === 'minecraft:player') {
      U.set(e, 'bloccato', 400);
      U.lampo(e, 0.55, 0.2, 0.75, 0.05, 0.3, 0.8);
      U.barForte(e, '§dVerbena! I tuoi poteri sono bloccati.', 60);
    }
  }
}

// ---------------------------------------------------------------- paletti sparati con la Balestra da caccia
// Paletto di legno nel cuore: un vampiro (selvatico, squartatore, giocatore) muore all'istante.
// L'Antico Originale regge molti colpi: il legno comune lo porta allo stremo, solo la quercia bianca lo finisce.
export function dardo(ev) {
  const quercia = ev.projectile?.typeId === U.I('dardo_quercia');
  let e;
  try { e = ev.getEntityHit()?.entity; } catch {}
  const da = ev.source;
  if (!U.ok(e)) return;
  const avvisa = (t) => { if (da?.typeId === 'minecraft:player') U.barForte(da, t, 60); };
  const sangue = () => { U.fx(e.dimension, 'vamp:sangue', U.add(e.location, U.v3(0, 1.3, 0))); U.suono(e.dimension, 'mob.zombie.woodbreak', e.location, 0.8, 1.4); };
  if (/^vamp:(vampiro|squartatore)$/.test(e.typeId)) {
    sangue();
    uccidiVampiro(e, da);
    avvisa('§6Paletto nel cuore!');
    return;
  }
  if (e.typeId === 'vamp:originale') {
    const h = U.salute(e), essiccato = U.prop(e, 'vamp:essiccato', false);
    if (quercia) {
      sangue();
      if (essiccato || h.ora <= 60) {
        for (const q of U.vicini(e.dimension, e.location, 48, { type: 'minecraft:player' }))
          U.titolo(q, '§eLa quercia bianca', '§7Il paletto trafigge il cuore dell\'Antico.');
        uccidiVampiro(e, da);
        return;
      }
      U.danno(e, 30, 'entityAttack', da);
      avvisa('§eLa quercia bianca lo ferisce gravemente.');
    } else if (h.ora <= 31) avvisa('§6Il legno comune non basta più: solo la §equercia bianca§6 può finire l\'Antico.');
    return;
  }
  if (e.typeId === 'minecraft:player' && S.eVampiro(e)) {
    const h = U.salute(e);
    if (!S.eOriginale(e) || (quercia && h.ora <= h.max / 2)) {
      sangue();
      S.segnaMorteVera(e, quercia ? 'un paletto di quercia bianca nel cuore' : 'un paletto nel cuore');
      U.danno(e, 1000, 'entityAttack', da);
    } else if (quercia) U.danno(e, 10, 'entityAttack', da);
  }
}
/** paletto piantato in un blocco: dopo 5 secondi sparisce, e metà delle volte si può raccogliere */
export function dardoPiantato(ev) {
  const pr = ev.projectile, id = pr?.typeId === U.I('dardo_quercia') ? U.I('paletto_quercia') : U.I('paletto');
  system.runTimeout(() => U.guard(() => {
    if (!U.ok(pr)) return;
    if (Math.random() < 0.5) { try { pr.dimension.spawnItem(new ItemStack(id, 1), pr.location); } catch {} }
    pr.remove();
  }), 100);
}

// ---------------------------------------------------------------- Antico Originale (boss)
export function tickOriginali() {
  const visti = new Set();
  for (const p of world.getPlayers()) {
    for (const o of U.vicini(p.dimension, p.location, 64, { type: 'vamp:originale' })) {
      if (visti.has(o.id)) continue;
      visti.add(o.id);
      const h = U.salute(o);
      if (U.get(o, 'calmo', false)) { if (U.pronto(o, 60, 'aura')) U.fx(o.dimension, 'vamp:rito', U.add(o.location, U.v3(0, 1, 0))); continue; }
      // a metà vita chiama la sua stirpe
      if (!U.get(o, 'chiamata', false) && h.ora <= h.max / 2) {
        U.set(o, 'chiamata', true);
        for (let i = 0; i < 3; i++) {
          const a = i * 2.1, l = U.add(o.location, U.v3(Math.cos(a) * 3, 0, Math.sin(a) * 3));
          U.guard(() => o.dimension.spawnEntity(U.I('vampiro'), l));
          U.fx(o.dimension, 'vamp:fumo_nero', U.add(l, U.v3(0, 1, 0)));
        }
        for (const q of U.vicini(o.dimension, o.location, 40, { type: 'minecraft:player' })) U.tell(q, '§6Antico Originale:§r «Figli miei. Venite.»');
      }
      if (U.prop(o, 'vamp:essiccato', false)) { U.fx(o.dimension, 'vamp:fumo_nero', U.add(o.location, U.v3(0, 2, 0))); continue; }
      // la sua stirpe vicina lo rende più forte
      const stirpe = U.vicini(o.dimension, o.location, 32).filter((v) => /^vamp:(vampiro|squartatore)$/.test(v.typeId) && !U.prop(v, 'vamp:alleato', false)).length;
      if (stirpe) {
        U.eff(o, 'strength', 40, Math.min(4, Math.floor(stirpe / 2)));
        U.eff(o, 'resistance', 40, Math.min(2, Math.floor(stirpe / 3)));
        if (stirpe >= 4) U.eff(o, 'regeneration', 40, 1);
        if (U.pronto(o, 40, 'aura')) U.fx(o.dimension, 'vamp:rito', U.add(o.location, U.v3(0, 1, 0)));
      }
      U.set(o, 'stirpe', stirpe);
      // soggiogamento dell'Originale: ferma chi non ha verbena
      if (U.pronto(o, 300, 'compulsione')) {
        for (const q of U.vicini(o.dimension, o.location, 12, { type: 'minecraft:player' })) {
          if (S.eOriginale(q)) continue;
          if (S.verbenaInCorpo(q)) { U.barForte(q, '§dL\'Antico prova a soggiogarti: la verbena ti protegge.', 50); continue; }
          if (menteProtetta(q)) { U.barForte(q, '§fL\'Antico prova a soggiogarti: la tua mente di cacciatore non si piega.', 50); continue; }
          U.eff(q, 'slowness', 50, 255); U.eff(q, 'weakness', 100, 1);
          U.titolo(q, '§6«In ginocchio.»', '§7Il tuo corpo obbedisce prima della tua mente.');
        }
      }
    }
  }
}

// ---------------------------------------------------------------- cacciatori che arrivano dai vampiri
export function tickCacciatori() {
  for (const p of world.getPlayers()) {
    if (!S.eVampiro(p) || p.dimension.id !== 'minecraft:overworld') continue;
    if (Math.random() > 0.12) continue;
    const gia = U.vicini(p.dimension, p.location, 64).filter((e) => /^vamp:cacciatore/.test(e.typeId)).length;
    if (gia >= 2) continue;
    const a = Math.random() * Math.PI * 2, d = 24 + Math.random() * 10;
    const x = Math.floor(p.location.x + Math.cos(a) * d), z = Math.floor(p.location.z + Math.sin(a) * d);
    let top;
    try { top = p.dimension.getTopmostBlock({ x, z }); } catch { continue; }
    if (!top || /water|lava|leaves|log/.test(top.typeId)) continue;
    const loc = U.v3(x + 0.5, top.location.y + 1, z + 0.5);
    U.guard(() => p.dimension.spawnEntity(U.I('cacciatore'), loc));
    if (Math.random() < 0.5) U.guard(() => p.dimension.spawnEntity(U.I('cacciatore_paletto'), U.add(loc, U.v3(1, 0, 0))));
    if (U.pronto(p, 2400, 'avviso_cacciatori')) U.tell(p, '§8[Vampiro] Senti odore di verbena nel vento... qualcuno ti sta dando la caccia.');
  }
}

// ---------------------------------------------------------------- verbena e ghiande dai blocchi rotti
export function bloccoRotto(ev) {
  const id = ev.brokenBlockPermutation?.type?.id ?? '';
  const dim = ev.dimension ?? ev.player?.dimension, loc = ev.block?.location;
  if (!dim || !loc || dim.id !== 'minecraft:overworld') return;
  const c = U.add(loc, U.v3(0.5, 0.3, 0.5));
  if (/^minecraft:(short_grass|tall_grass|fern|large_fern|grass)$/.test(id) && Math.random() < 0.045)
    U.guard(() => dim.spawnItem(new ItemStack(U.I('verbena'), 1), c));
  if (/^minecraft:(oak_leaves|dark_oak_leaves)$/.test(id) && Math.random() < 0.02)
    U.guard(() => dim.spawnItem(new ItemStack(U.I('ghianda'), 1), c));
}

// ---------------------------------------------------------------- quercia bianca
export function piantato(ev) {
  const b = ev.block, p = ev.player;
  if (!b) return;
  if (b.typeId === 'minecraft:bed') {
    const l = U.getJ(p, 'letti', []);
    l.push({ d: b.dimension.id, x: b.location.x, y: b.location.y, z: b.location.z });
    U.setJ(p, 'letti', l.slice(-30));
  }
  if (b.typeId === U.I('ghianda_pianta')) {
    const g = U.wGetJ('ghiande', []);
    g.push({ d: b.dimension.id, x: b.location.x, y: b.location.y, z: b.location.z, t: 20 * 60 * (4 + Math.random() * 4) });
    U.wSetJ('ghiande', g.slice(-50));
    U.tell(p, '§e[Quercia bianca]§r Come la quercia scura: servono §f4 ghiande in un quadrato 2×2§r. Crescerà tra qualche minuto (la farina d\'ossa la aiuta).');
  }
}

// foglie proprie della quercia bianca (pallide e argentate); se mancassero, quelle vanilla più simili
const FOGLIE = [[U.I('foglie_quercia'), undefined], ['minecraft:pale_oak_leaves', { persistent_bit: true }], ['minecraft:birch_leaves', { persistent_bit: true }]];
function foglia() {
  for (const [id, st] of FOGLIE) { try { return BlockPermutation.resolve(id, st); } catch {} }
  return undefined;
}
/** angolo (x e z minimi) del quadrato 2x2 di ghiande che contiene base, oppure undefined */
export function quadrato(dim, base) {
  const G = U.I('ghianda_pianta'), f = U.floor(base);
  for (const [ox, oz] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) {
    const c = U.v3(f.x + ox, f.y, f.z + oz);
    let tutte = true;
    for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) if (U.blk(dim, U.v3(c.x + dx, c.y, c.z + dz))?.typeId !== G) { tutte = false; break; }
    if (tutte) return c;
  }
  return undefined;
}
/** la quercia bianca cresce come la QUERCIA SCURA: tronco 2x2, chioma larga e piatta, qualche ramo laterale */
export function cresciQuercia(dim, base) {
  const b0 = U.blk(dim, base);
  if (!b0 || b0.typeId !== U.I('ghianda_pianta')) return false;
  const c = quadrato(dim, base);
  if (!c) return false;                                               // una ghianda da sola non cresce (come la quercia scura)
  const h = 6 + Math.floor(Math.random() * 3), F = foglia(), LEGNO = U.I('quercia_bianca');
  const libero = (b) => b && (b.isAir || /leaves|short_grass|tall_grass|fern|flower|vine|sapling|ghianda|foglie/.test(b.typeId));
  const legno = (l) => { const b = U.blk(dim, l); if (b && libero(b)) try { b.setType(LEGNO); } catch {} };
  const fogl = (l) => { const b = U.blk(dim, l); if (F && b && b.isAir) try { b.setPermutation(F); } catch {} };
  // le 4 ghiande diventano la base del tronco
  for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const b = U.blk(dim, U.v3(c.x + dx, c.y, c.z + dz)); try { b?.setType(LEGNO); } catch {} }
  let altezza = 1;
  for (let i = 1; i < h; i++) {
    let ok = true;
    for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) if (!libero(U.blk(dim, U.v3(c.x + dx, c.y + i, c.z + dz)))) ok = false;
    if (!ok) break;
    for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) legno(U.v3(c.x + dx, c.y + i, c.z + dz));
    altezza = i + 1;
  }
  const top = c.y + altezza - 1, cx = c.x + 0.5, cz = c.z + 0.5;
  // rami storti che escono dal tronco (come la quercia scura)
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (Math.random() < 0.35) continue;
    const y0 = top - 1 - Math.floor(Math.random() * 2);
    const sx = dx > 0 ? c.x + 2 : dx < 0 ? c.x - 1 : c.x + Math.floor(Math.random() * 2);
    const sz = dz > 0 ? c.z + 2 : dz < 0 ? c.z - 1 : c.z + Math.floor(Math.random() * 2);
    legno(U.v3(sx, y0, sz)); legno(U.v3(sx + dx, y0 + 1, sz + dz));
    for (let fx = -1; fx <= 1; fx++) for (let fz = -1; fz <= 1; fz++) fogl(U.v3(sx + dx + fx, y0 + 2, sz + dz + fz));
  }
  // chioma: tre strati larghi e piatti
  for (let dy = -1; dy <= 1; dy++) {
    const r = dy === 1 ? 2.6 : 4.2;
    for (let x = Math.floor(cx - 5); x <= Math.ceil(cx + 5); x++) for (let z = Math.floor(cz - 5); z <= Math.ceil(cz + 5); z++) {
      const d2 = (x + 0.5 - cx - 0.5) ** 2 + (z + 0.5 - cz - 0.5) ** 2;
      if (d2 > r * r || (d2 > (r - 1) ** 2 && Math.random() < 0.3)) continue;
      fogl(U.v3(x, top + dy, z));
    }
  }
  const cima = U.v3(c.x, top, c.z);
  base = c;
  // lore: la verbena cresceva ai piedi della quercia bianca
  let n = 0;
  for (let k = 0; k < 24 && n < 5; k++) {
    const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 2.5;
    const x = Math.round(base.x + Math.cos(a) * r), z = Math.round(base.z + Math.sin(a) * r);
    for (let dy = 2; dy >= -2; dy--) {
      const sotto = U.blk(dim, U.v3(x, base.y + dy - 1, z)), qui = U.blk(dim, U.v3(x, base.y + dy, z));
      if (sotto && qui && qui.isAir && /grass_block|dirt|podzol/.test(sotto.typeId)) { try { qui.setType(U.I('verbena_pianta')); n++; } catch {} break; }
    }
  }
  U.fx(dim, 'vamp:sole', U.add(cima, U.v3(0.5, 1, 0.5)));
  U.suono(dim, 'random.levelup', base, 0.6, 0.5);
  return true;
}
export function tickGhiande(passo) {
  const g = U.wGetJ('ghiande', []);
  if (!g.length) return;
  const resto = [];
  for (const q of g) {
    q.t -= passo;
    if (q.t > 0) { resto.push(q); continue; }
    let dim;
    try { dim = world.getDimension(q.d); } catch { continue; }
    const b = U.blk(dim, q);
    if (!b) { resto.push(q); continue; }                                // chunk non caricato: aspetta
    if (b.typeId !== U.I('ghianda_pianta')) continue;
    if (!cresciQuercia(dim, U.v3(q.x, q.y, q.z))) { q.t = 20 * 60 * 2; resto.push(q); }   // manca il 2x2: riprova più tardi
  }
  U.wSetJ('ghiande', resto);
}
export function farinaDOssa(ev) {
  const b = ev.block, p = ev.player;
  const usato = ev.beforeItemStack?.typeId ?? ev.itemStack?.typeId;
  if (!b || b.typeId !== U.I('ghianda_pianta') || usato !== 'minecraft:bone_meal' || ev.isFirstEvent === false) return;
  if (!U.pronto(p, 10, 'ossa')) return;
  if (p.getGameMode?.() !== 'Creative' && p.getGameMode?.() !== 'creative') U.consumaMano(p);
  U.fx(b.dimension, 'minecraft:crop_growth_emitter', U.add(b.location, U.v3(0.5, 0.5, 0.5)));
  const c = quadrato(b.dimension, b.location);
  if (!c) { U.barForte(p, '§e[Quercia bianca] §7Servono §f4 ghiande in un quadrato 2×2§7, come la quercia scura.', 80); return; }
  if (Math.random() < 0.45) {
    cresciQuercia(b.dimension, b.location);
    U.wSetJ('ghiande', U.wGetJ('ghiande', []).filter((q) => !(q.x >= c.x && q.x <= c.x + 1 && q.z >= c.z && q.z <= c.z + 1 && q.y === c.y)));
  }
}

// ---------------------------------------------------------------- invito (lore: un vampiro non entra in una casa abitata senza invito)
export function tickInvito(p) {
  if (!S.eVampiro(p) || p.dimension.id !== 'minecraft:overworld') return;
  const dim = p.dimension, loc = p.location;
  if (U.cieloAperto(dim, loc, 2.2)) return;                              // casa = sotto un tetto
  const abitanti = U.vicini(dim, loc, 10).filter((e) => /^minecraft:(villager_v2|villager)$/.test(e.typeId));
  if (!abitanti.length) return;                                         // nessun proprietario vivo: niente barriera
  const zone = U.getJ(p, 'inviti', []);
  if (zone.some((z) => z.d === dim.id && U.dist2d(z, loc) <= 48)) return;
  const f = U.floor(loc);
  let letto;
  for (let dx = -4; dx <= 4 && !letto; dx++) for (let dz = -4; dz <= 4 && !letto; dz++) for (let dy = -1; dy <= 2 && !letto; dy++) {
    const b = U.blk(dim, U.v3(f.x + dx, f.y + dy, f.z + dz));
    if (b?.typeId === 'minecraft:bed') letto = b.location;
  }
  if (!letto) return;
  const miei = U.getJ(p, 'letti', []);
  if (miei.some((l) => l.d === dim.id && U.dist(l, letto) <= 2.5)) return;
  let dir = U.norm2d(U.sub(loc, U.add(letto, U.v3(0.5, 0, 0.5))));
  if (!isFinite(dir.x)) dir = U.v3(1, 0, 0);
  try { p.applyKnockback({ x: dir.x * 1.4, z: dir.z * 1.4 }, 0.25); } catch {}
  U.fx(dim, 'vamp:fumo_nero', U.add(loc, U.v3(0, 1, 0)));
  if (U.pronto(p, 100, 'invito')) {
    U.barForte(p, '§7Una forza invisibile ti respinge: §cnessuno ti ha invitato§7 in questa casa.', 80);
    if (U.pronto(p, 2400, 'invito_aiuto')) U.tell(p, '§8[Invito] Soggioga un abitante e scegli "Invitami in casa". Le case con i letti che hai messo tu sono sempre aperte.');
  }
}
