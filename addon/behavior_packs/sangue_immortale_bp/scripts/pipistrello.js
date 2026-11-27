// Sangue Immortale — FORMA DI PIPISTRELLO: il vampiro si dissolve in fumo nero e diventa un grande pipistrello nero.
//   Il giocatore diventa invisibile e "cavalca" il pipistrello (così si muove fluido anche per chi guarda);
//   avanti/indietro/lati con i comandi di movimento, va dove guardi (su e giù col tuo sguardo), SALTO = sali.
//   ACCOVACCIATI per tornare vampiro. È ILLIMITATO e non costa sangue (richiesta di Jowa, 23/11/2026).
//   Verbena e acqua ti fanno tornare vampiro.
import { world, system } from '@minecraft/server';
import * as U from './util.js';
import * as S from './stato.js';

export const ID = U.I('pipistrello');
const stati = new Map();                                  // id giocatore -> { bat, tick, sangue }
export const inForma = (p) => stati.has(p.id);

function nuvola(dim, l) {
  for (let i = 0; i < 3; i++) U.fx(dim, 'vamp:fumo_denso', U.add(l, U.v3(0, 0.4 + i * 0.6, 0)));
  U.fx(dim, 'vamp:braci', U.add(l, U.v3(0, 1, 0)));
  U.fx(dim, 'vamp:braci', U.add(l, U.v3(0, 1.8, 0)));
  U.suono(dim, 'mob.bat.takeoff', l, 1.2, 0.6);
  U.suono(dim, 'mob.bat.idle', l, 1, 0.5);
}

/** potere: entra o esce dalla forma di pipistrello */
export function forma(p) {
  if (inForma(p)) { torna(p, '§7Riprendi la tua forma.'); return; }
  if (!S.eVampiro(p)) return;
  if (S.bloccato(p)) { U.barForte(p, '§dLa verbena ti impedisce di trasformarti.'); return; }
  if (p.isInWater) { U.barForte(p, '§7Non puoi trasformarti in acqua.'); return; }
  let bat;
  try { bat = p.dimension.spawnEntity(ID, U.add(p.location, U.v3(0, 0.6, 0))); } catch { return; }
  nuvola(p.dimension, p.location);
  U.eff(p, 'invisibility', 20 * 60 * 10, 0);
  try { bat.getComponent('minecraft:rideable')?.addRider(p); } catch {}
  stati.set(p.id, { bat, tick: 0, sangue: 0 });
  U.set(p, 'in_pipistrello', true);
  if (U.pronto(p, 6000, 'aiuto_pip')) U.tell(p, '§8[Pipistrello]§r Muoviti con i comandi: vai dove guardi, §fsalto§r = sali. §fAccovacciati§r per tornare vampiro.');
}

export function torna(p, motivo) {
  const st = stati.get(p.id);
  if (!st) return;
  stati.delete(p.id);
  U.set(p, 'in_pipistrello', false);
  const l = U.ok(st.bat) ? st.bat.location : p.location;
  try { st.bat.getComponent('minecraft:rideable')?.ejectRider(p); } catch {}
  try { if (U.ok(st.bat)) st.bat.remove(); } catch {}
  try { p.teleport(l); } catch {}
  U.togliEff(p, 'invisibility');
  U.eff(p, 'slow_falling', 80, 0);                        // niente danni da caduta
  nuvola(p.dimension, l);
  if (motivo) U.barForte(p, motivo, 50);
}


/** ogni tick */
export function tickPipistrelli() {
  for (const p of world.getPlayers()) {
    const st = stati.get(p.id);
    if (!st) continue;
    st.tick++;
    const bat = st.bat;
    if (!U.ok(bat) || !S.eVampiro(p)) { torna(p); continue; }
    // sceso dal pipistrello (accovacciato) -> torna vampiro
    let sopra = false;
    try { sopra = bat.getComponent('minecraft:rideable')?.getRiders().some((r) => r.id === p.id); } catch {}
    if (!sopra && st.tick > 5) { torna(p, '§7Riprendi la tua forma.'); continue; }
    if (S.bloccato(p)) { torna(p, '§dVerbena! Torni nella tua forma.'); continue; }
    if (bat.isInWater) { torna(p, '§7L\'acqua ti costringe a tornare nella tua forma.'); continue; }
    // guida: comandi di movimento + direzione dello sguardo; salto = sali
    let mv = { x: 0, y: 0 }, salta = false;
    try { mv = p.inputInfo.getMovementVector(); } catch {}
    try { salta = p.inputInfo.getButtonState('Jump') === 'Pressed'; } catch {}
    const d = p.getViewDirection(), h = U.norm2d(d), destra = U.v3(-h.z, 0, h.x);
    const vel = 0.42 + 0.04 * S.livello(p) + (p.isSprinting ? 0.15 : 0);
    let v = U.add(U.mul(d, mv.y * vel), U.mul(destra, -mv.x * vel * 0.7));
    if (salta) v = U.add(v, U.v3(0, 0.3, 0));
    if (!mv.x && !mv.y && !salta) v = U.v3(0, Math.sin(st.tick / 6) * 0.02, 0);   // resta sospeso battendo le ali
    try { bat.clearVelocity(); bat.applyImpulse(v); } catch {}
    try { bat.setRotation({ x: 0, y: p.getRotation().y }); } catch {}
    if (st.tick % 4 === 0) U.fx(bat.dimension, 'vamp:scia_nera', bat.location);
  }
}

/** pipistrelli rimasti senza padrone (uscita dal mondo, ricarica): via */
export function pulisci() {
  const vivi = new Set([...stati.values()].map((s) => s.bat?.id));
  for (const p of world.getPlayers()) {
    for (const b of U.vicini(p.dimension, p.location, 64, { type: ID })) if (!vivi.has(b.id)) { try { b.remove(); } catch {} }
  }
}

/** i colpi al pipistrello li prende il vampiro */
export function batFerito(bat, n, ds) {
  for (const [pid, st] of stati) {
    if (st.bat?.id !== bat.id) continue;
    const p = world.getPlayers().find((q) => q.id === pid);
    if (p) U.danno(p, n, ds?.cause ?? 'entityAttack', ds?.damagingEntity);
    U.curaTutto(bat);
  }
}
