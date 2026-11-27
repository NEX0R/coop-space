// Sangue Immortale — la FORZA DELL'ORIGINALE (giocatore Originale):
//   - a MANI NUDE un colpo fa 50 di danno (25 cuori): sulle creature senza sangue, oppure accovacciato
//     (senza accovacciarti, su un umano o un animale, la mano vuota morde);
//   - colpisci un blocco e continua a guardarlo: in 2 secondi si rompe e lo raccogli, qualunque blocco tranne la bedrock
//     (e i blocchi tecnici: barriera, portali, blocchi comando...).
import { world, system } from '@minecraft/server';
import * as U from './util.js';
import * as S from './stato.js';

export const DANNO_MANI = 50;
export const TEMPO_SCAVO = 40;                        // tick (2 secondi)
const INTOCCABILI = /^minecraft:(bedrock|barrier|command_block|chain_command_block|repeating_command_block|structure_block|structure_void|jigsaw|end_portal|end_gateway|portal|light_block.*|allow|deny|border_block|air|cave_air|void_air|water|flowing_water|lava|flowing_lava)$|^vamp:altare$/;

/** colpo a mani nude dell'Originale (non sui suoi seguaci) */
export function colpo(p, e) {
  if (!S.eOriginale(p) || U.mano(p)) return;
  if (U.prop(e, 'vamp:alleato', false) && U.get(e, 'padrone', '') === p.id) return;
  U.danno(e, DANNO_MANI, 'entityAttack', p);
  U.suono(e.dimension, 'random.break', e.location, 0.5, 0.4);
}

const scavi = new Map();                               // id giocatore -> { x, y, z, t }
const creativo = (p) => { try { return /creative/i.test(String(p.getGameMode())); } catch { return false; } };

/** l'Originale colpisce un blocco: comincia a romperlo */
export function bloccoColpito(p, b) {
  if (!S.eOriginale(p) || !b || creativo(p) || INTOCCABILI.test(b.typeId)) return;
  const v = scavi.get(p.id);
  if (v && v.x === b.location.x && v.y === b.location.y && v.z === b.location.z) return;
  scavi.set(p.id, { x: b.location.x, y: b.location.y, z: b.location.z, t: system.currentTick });
}

function mirato(p) { try { return p.getBlockFromViewDirection({ maxDistance: 7 })?.block; } catch { return undefined; } }

/** ogni 2 tick: se continui a guardare lo stesso blocco, dopo 2 secondi si rompe (e lascia il suo oggetto) */
export function tickScavi() {
  for (const p of world.getPlayers()) {
    const v = scavi.get(p.id);
    if (!v) continue;
    const b = mirato(p);
    if (!S.eOriginale(p) || !b || b.location.x !== v.x || b.location.y !== v.y || b.location.z !== v.z || INTOCCABILI.test(b.typeId)) {
      scavi.delete(p.id); continue;
    }
    const c = U.v3(v.x + 0.5, v.y + 0.5, v.z + 0.5);
    if ((system.currentTick - v.t) % 10 === 0) U.fx(p.dimension, 'minecraft:critical_hit_emitter', c);
    if (system.currentTick - v.t < TEMPO_SCAVO) continue;
    scavi.delete(p.id);
    try { p.dimension.runCommand(`setblock ${v.x} ${v.y} ${v.z} air destroy`); } catch { try { b.setType('minecraft:air'); } catch {} }
  }
}

// ---------------------------------------------------------------- SFONDAMENTO (tutti i vampiri; gratis per l'Originale, 25/11/2026)
// Si accende e si spegne dalla ruota (oggetto accanto all'Istinto). Quando è acceso e CORRI con la super velocità,
// i blocchi davanti a te (all'altezza del corpo, non il pavimento) vanno in pezzi: passi attraverso muri, alberi e colline.
// Restano la bedrock, i blocchi tecnici e l'altare. I blocchi rotti spariscono (niente oggetti a terra).
export function sfondamento(p) {
  const on = !U.get(p, 'sfondamento', false);
  U.set(p, 'sfondamento', on);
  U.barForte(p, on ? '§6Sfondamento acceso: §7corri e passi attraverso i blocchi.' : '§7Sfondamento spento.', 60);
  U.suonoP(p, on ? 'random.anvil_land' : 'random.click', 0.5, on ? 0.6 : 1);
}
/** ogni 2 tick: se corri con lo sfondamento acceso, rompe i blocchi davanti (altezza piedi e testa, 1-2 blocchi avanti) */
export function tickSfondamento(p) {
  if (!U.get(p, 'sfondamento', false) || !S.eVampiro(p) || !S.staCorrendo(p)) return;
  if (!S.eOriginale(p) && S.sangue(p) < 1) { if (U.pronto(p, 60, 'sfonda_sete')) U.barForte(p, '§cSenza sangue non sfondi niente.'); return; }
  const d = U.norm2d(p.getViewDirection()), f = U.floor(p.location);
  let rotti = 0;
  for (let k = 1; k <= 2; k++) {
    const x = Math.floor(p.location.x + d.x * k), z = Math.floor(p.location.z + d.z * k);
    for (let dy = 0; dy <= 2; dy++) {
      const b = U.blk(p.dimension, U.v3(x, f.y + dy, z));
      if (!b || b.isAir || b.isLiquid || INTOCCABILI.test(b.typeId)) continue;
      try { b.setType('minecraft:air'); rotti++; } catch {}
    }
  }
  if (rotti) {
    if (!S.eOriginale(p)) S.setSangue(p, S.sangue(p) - 0.05 * rotti);   // i vampiri normali pagano un po' di sangue
    U.fx(p.dimension, 'minecraft:critical_hit_emitter', U.add(p.location, U.v3(d.x * 1.5, 1, d.z * 1.5)));
    if (U.pronto(p, 6, 'sfonda')) U.suono(p.dimension, 'random.break', p.location, 0.8, 0.6);
  }
}

// ---------------------------------------------------------------- ONDA SISMICA (tutti i vampiri: 5 di sangue per onda, gratis per l'Originale)
// Ogni volta: un'onda d'urto in un raggio di 10 blocchi scuote la terra, ferisce e scaglia via le creature
// (non i tuoi seguaci né gli altri giocatori Originali). Tre onde di fila (entro 30 secondi): alla TERZA i blocchi
// nel quadrato 10x10 intorno a te vengono distrutti (da 2 blocchi sotto i piedi a 3 sopra la testa), tranne la bedrock,
// i blocchi tecnici e l'altare. I blocchi distrutti spariscono (niente oggetti a terra: sul telefono sarebbero troppi).
export const RAGGIO_SISMA = 10;
const sismi = new Map();                               // id giocatore -> { n: onde di fila, t: tick dell'ultima }
export function sisma(p) {
  if (!S.eOriginale(p)) {                                // i vampiri normali pagano 5 di sangue per onda
    if (S.bloccato(p)) { U.barForte(p, '§dLa verbena ti scorre nelle vene: i poteri non rispondono.'); return; }
    if (S.sangue(p) < 5) { U.barForte(p, '§cTi serve più sangue (5).'); return; }
    S.setSangue(p, S.sangue(p) - 5);
  }
  const dim = p.dimension, o = U.floor(p.location), ora = system.currentTick;
  const st = sismi.get(p.id);
  const n = st && ora - st.t <= 600 ? st.n + 1 : 1;
  sismi.set(p.id, { n: n >= 3 ? 0 : n, t: ora });
  // onda: anelli di polvere che si allargano, terremoto sullo schermo, colpo a chi è vicino
  for (let r = 2; r <= RAGGIO_SISMA; r += 2) {
    system.runTimeout(() => U.guard(() => {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        U.fx(dim, 'vamp:fumo_nero', U.v3(o.x + 0.5 + Math.cos(a) * r, o.y + 0.2, o.z + 0.5 + Math.sin(a) * r));
      }
    }), r);
  }
  U.suono(dim, 'random.explode', p.location, 1, 0.5);
  U.suono(dim, 'mob.warden.sonic_boom', p.location, 0.8, 0.6);
  try { dim.runCommand(`camerashake add @a[x=${o.x},y=${o.y},z=${o.z},r=${RAGGIO_SISMA + 6}] ${n >= 3 ? 1 : 0.5} 1.2 positional`); } catch {}
  for (const e of U.vicini(dim, p.location, RAGGIO_SISMA)) {
    if (e.id === p.id || !e.getComponent?.('minecraft:health')) continue;
    if (U.prop(e, 'vamp:alleato', false) && U.get(e, 'padrone', '') === p.id) continue;   // i tuoi seguaci no
    if (e.typeId === 'minecraft:player' && S.eOriginale(e)) continue;
    const d = U.norm2d(U.sub(e.location, p.location));
    U.danno(e, n >= 3 ? 14 : 8, 'entityAttack', p);
    try { e.applyKnockback({ x: d.x * 2.2, z: d.z * 2.2 }, 0.6); } catch {}
  }
  if (n < 3) { U.barForte(p, `§6Onda sismica §f${n}/3§6: ${n === 2 ? 'ancora una e la terra si spacca.' : 'la terra trema.'}`, 60); return; }
  // terza onda: i blocchi nel quadrato 10x10 vanno in pezzi (un piano per tick, dal basso)
  U.barForte(p, '§6Terza onda: §fla terra si spacca!', 60);
  for (let dy = -2; dy <= 3; dy++) {
    system.runTimeout(() => U.guard(() => {
      for (let dx = -5; dx < 5; dx++) for (let dz = -5; dz < 5; dz++) {
        const b = U.blk(dim, U.v3(o.x + dx, o.y + dy, o.z + dz));
        if (!b || b.isAir || INTOCCABILI.test(b.typeId)) continue;
        try { b.setType('minecraft:air'); } catch {}
      }
      U.fx(dim, 'minecraft:huge_explosion_emitter', U.v3(o.x + 0.5, o.y + dy, o.z + 0.5));
    }), 3 + (dy + 2) * 2);
  }
  U.suono(dim, 'random.explode', p.location, 1.5, 0.3);
}
