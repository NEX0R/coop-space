// Sangue Immortale — BARA PER DORMIRE (1.4.0): come un letto, ma al contrario.
//   - Si crafta (6 assi di quercia scura + lana rossa) e si posa a terra come un oggetto.
//   - DI GIORNO: toccala ("Dormi") e ti stendi dentro; dopo 3 secondi di buio si fa NOTTE e la bara diventa il tuo punto di rinascita.
//   - DI NOTTE non si può dormire nella bara (per quello c'è il letto).
//   - Colpiscila per raccoglierla (torna oggetto).
import { world, system, ItemStack } from '@minecraft/server';
import * as U from './util.js';

export const ENTITA = U.I('bara_letto');
export const OGGETTO = U.I('bara_letto');
const DORMI = 60;                                            // tick prima che si faccia notte
const sonni = new Map();                                     // id giocatore -> { bara, t }

/** ogni secondo: chi è nella bara */
export function tickBare() {
  for (const p of world.getPlayers()) {
    const bara = (() => { try { return p.getComponent('minecraft:riding')?.entityRidingOn; } catch { return undefined; } })() ?? p.cavalca;
    const nella = bara?.typeId === ENTITA;
    const s = sonni.get(p.id);
    if (!nella) { if (s) sonni.delete(p.id); continue; }
    if (!U.eGiorno()) {
      sonni.delete(p.id);
      try { bara.getComponent('minecraft:rideable')?.ejectRider(p); } catch {}
      U.barForte(p, '§7Nella bara si dorme solo §fdi giorno§7. Di notte c\'è il letto.', 60);
      continue;
    }
    if (!s) {
      sonni.set(p.id, { bara: bara.id, t: system.currentTick });
      U.lampo(p, 0, 0, 0, 1.0, 2.5, 1.0);
      U.barForte(p, '§8Chiudi gli occhi nel buio della bara...', 60);
      continue;
    }
    if (system.currentTick - s.t < DORMI) continue;
    sonni.delete(p.id);
    try { world.setTimeOfDay(13000); } catch {}
    try { p.setSpawnPoint({ dimension: p.dimension, x: Math.floor(bara.location.x), y: Math.floor(bara.location.y), z: Math.floor(bara.location.z) }); } catch {}
    try { bara.getComponent('minecraft:rideable')?.ejectRider(p); } catch {}
    U.titolo(p, '§4Notte', '§7Ti risvegli al calar del sole.');
    U.tell(p, '§4[Bara]§r È notte. La bara è il tuo nuovo punto di rinascita.');
  }
}

/** bara colpita: torna oggetto */
export function raccolta(b) {
  if (!U.ok(b) || b.typeId !== ENTITA) return;
  try { b.dimension.spawnItem(new ItemStack(OGGETTO, 1), U.add(b.location, U.v3(0, 0.5, 0))); } catch {}
  try { b.remove(); } catch {}
}
