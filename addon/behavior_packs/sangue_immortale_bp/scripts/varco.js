// Sangue Immortale — ANELLO DEL VARCO (richiesta di Jowa, 24/11/2026).
//   1) Si crafta l'Anello d'argento con ametista (argento + frammento d'ametista).
//   2) Si consacra sull'Altare dei rituali in una NOTTE DI ECLISSI: in Minecraft è la notte di LUNA NUOVA
//      (la luna sparisce dal cielo, una notte ogni 8). Dopo il rito diventa l'Anello del varco, a uso ILLIMITATO.
//   3) Solo un ORIGINALE può usarlo: tienilo in mano e tocca in qualsiasi direzione -> si apre una schermata dove
//      scrivi X, Y, Z e scegli la dimensione (Mondo normale, Nether, End).
//   4) Davanti a te si apre un PORTALE di fumo nero come la pece che resta aperto 10 SECONDI:
//      chi ci entra (tu, i tuoi seguaci, chiunque) arriva alle coordinate scelte.
import { world, system } from '@minecraft/server';
import { ModalFormData } from '@minecraft/server-ui';
import * as U from './util.js';
import * as S from './stato.js';

export const ANELLO = U.I('anello_varco');
export const DURATA = 200;                                  // tick (10 secondi)
const DIM = [['minecraft:overworld', 'Mondo normale'], ['minecraft:nether', 'Nether'], ['minecraft:the_end', 'End']];
const LIMITI = { 'minecraft:overworld': [-63, 318], 'minecraft:nether': [1, 125], 'minecraft:the_end': [1, 254] };
const portali = [];                                         // { dim, loc, meta: { d, x, y, z }, fine }
const usati = new Map();                                    // id entità -> tick (non rientra subito nel portale)

/** l'anello toccato: chiede le coordinate */
export function usa(p) {
  if (!S.eOriginale(p)) { U.barForte(p, '§5L\'Anello del varco risponde soltanto a un §6Originale§5.', 80); return; }
  const l = U.floor(p.location);
  const qui = Math.max(0, DIM.findIndex(([id]) => id === p.dimension.id));
  const f = new ModalFormData().title('§5Anello del varco')
    .textField('X', 'es. 100', { defaultValue: String(l.x) })
    .textField('Y', 'es. 70', { defaultValue: String(l.y) })
    .textField('Z', 'es. -200', { defaultValue: String(l.z) })
    .dropdown('Dimensione', DIM.map(([, n]) => n), { defaultValueIndex: qui });
  const mostra = () => f.show(p).then((r) => {
    if (r.canceled) { if (r.cancelationReason === 'UserBusy') system.runTimeout(mostra, 10); return; }
    U.guard(() => apri(p, r.formValues));
  }).catch(() => {});
  mostra();
}

function apri(p, valori) {
  const [sx, sy, sz, di] = valori ?? [];
  const n = (v) => Math.round(Number(String(v).trim().replace(',', '.')));
  const x = n(sx), y = n(sy), z = n(sz);
  if (![x, y, z].every(Number.isFinite) || Math.abs(x) > 29999000 || Math.abs(z) > 29999000) {
    U.barForte(p, '§cCoordinate non valide: scrivi tre numeri interi.', 80); return;
  }
  const d = DIM[Number(di) || 0]?.[0] ?? 'minecraft:overworld';
  const [y0, y1] = LIMITI[d];
  const dir = U.norm2d(p.getViewDirection());
  const loc = U.add(p.location, U.v3(dir.x * 2.5, 0, dir.z * 2.5));
  portali.push({ dim: p.dimension, loc, meta: { d, x: x + 0.5, y: Math.max(y0, Math.min(y1, y)), z: z + 0.5 }, fine: system.currentTick + DURATA });
  U.suono(p.dimension, 'mob.warden.emerge', loc, 0.8, 0.5);
  U.suono(p.dimension, 'portal.trigger', loc, 0.6, 0.4);
  U.barForte(p, `§5Il varco è aperto per §f10 secondi§5: entra nel fumo. §8(${x} ${y} ${z}, ${DIM.find(([id]) => id === d)[1]})`, 100);
}

/** ogni 2 tick: fumo del portale e passaggio di chi ci entra */
export function tickVarchi() {
  const ora = system.currentTick;
  for (let i = portali.length - 1; i >= 0; i--) {
    const v = portali[i];
    if (ora > v.fine) {
      U.suono(v.dim, 'random.fizz', v.loc, 0.8, 0.4);
      for (let k = 0; k < 4; k++) U.fx(v.dim, 'vamp:fumo_denso', U.add(v.loc, U.v3(0, 0.3 + k * 0.5, 0)));
      portali.splice(i, 1); continue;
    }
    // colonna di fumo nero come la pece, che ruota
    for (let k = 0; k < 5; k++) {
      const a = ora / 4 + k * 1.26, r = 0.55;
      U.fx(v.dim, 'vamp:fumo_denso', U.add(v.loc, U.v3(Math.cos(a) * r, 0.2 + k * 0.45, Math.sin(a) * r)));
    }
    if (ora % 6 === 0) U.fx(v.dim, 'vamp:fumo_nero', U.add(v.loc, U.v3(0, 1, 0)));
    for (const e of U.vicini(v.dim, U.add(v.loc, U.v3(0, 1, 0)), 1.3)) {
      if (/^minecraft:(item|xp_orb|arrow)$|^vamp:(sedile|pipistrello)$/.test(e.typeId)) continue;
      if (ora - (usati.get(e.id) ?? -1e9) < 60) continue;
      usati.set(e.id, ora);
      passa(e, v.meta);
    }
  }
}

function passa(e, m) {
  let dim;
  try { dim = world.getDimension(m.d); } catch { return; }
  try { e.teleport(U.v3(m.x, m.y, m.z), { dimension: dim }); } catch { return; }
  U.eff(e, 'slow_falling', 120, 0); U.eff(e, 'resistance', 100, 4);
  U.fx(dim, 'vamp:fumo_denso', U.v3(m.x, m.y + 1, m.z));
  // se si arriva dentro la roccia, sale fino al primo spazio libero
  system.runTimeout(() => U.guard(() => {
    if (!U.ok(e)) return;
    const f = U.floor(e.location);
    for (let k = 0; k < 80; k++) {
      const piedi = U.blk(e.dimension, U.v3(f.x, f.y + k, f.z)), testa = U.blk(e.dimension, U.v3(f.x, f.y + k + 1, f.z));
      if (!piedi || !testa) return;                         // chunk non ancora caricato
      if ((piedi.isAir || piedi.isLiquid) && (testa.isAir || testa.isLiquid)) { if (k) e.teleport(U.v3(m.x, f.y + k, m.z)); return; }
    }
  }), 10);
  if (e.typeId === 'minecraft:player') U.barForte(e, '§5Attraversi il fumo nero...', 50);
}

// ---------------------------------------------------------------- notte di eclissi (luna nuova)
export function faseLuna() { try { return Number(world.getMoonPhase()); } catch { return 0; } }
export const eclissi = () => faseLuna() === 4;              // MoonPhase.NewMoon
export function notti() { return (4 - faseLuna() + 8) % 8; }
