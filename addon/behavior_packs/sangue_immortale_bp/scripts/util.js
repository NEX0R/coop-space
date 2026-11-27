// Sangue Immortale — funzioni di base condivise (API @minecraft/server 2.0.0 stabile).
import { world, system, ItemStack, EquipmentSlot } from '@minecraft/server';

export const NS = 'vamp';
export const I = (n) => NS + ':' + n;
export const GIORNO = 24000;                       // tick in un giorno di gioco
// paletti: quelli d'argento (fatti all'altare) valgono come il paletto da cui nascono, ma sono indistruttibili
export const PALETTI_QUERCIA = new Set([I('paletto_quercia'), I('paletto_argento_quercia')]);
export const PALETTI = new Set([I('paletto'), I('paletto_argento'), ...PALETTI_QUERCIA]);
export const ePaletto = (id) => PALETTI.has(id);
export const eQuercia = (id) => PALETTI_QUERCIA.has(id);

export const guard = (fn) => { try { return fn(); } catch (e) { console.warn('[vamp] ' + e + '\n' + (e?.stack || '')); } };
export const ok = (e) => { try { return !!e && e.isValid; } catch { return false; } };

// ---------------------------------------------------------------- proprietà dinamiche (salvate nel mondo)
export function get(e, k, def) { try { const v = e.getDynamicProperty(I(k)); return v === undefined ? def : v; } catch { return def; } }
export function set(e, k, v) { try { e.setDynamicProperty(I(k), v); } catch {} }
export function getJ(e, k, def) { const s = get(e, k, undefined); if (typeof s !== 'string') return def; try { return JSON.parse(s); } catch { return def; } }
export function setJ(e, k, v) { set(e, k, JSON.stringify(v)); }
export function wGet(k, def) { try { const v = world.getDynamicProperty(I(k)); return v === undefined ? def : v; } catch { return def; } }
export function wSet(k, v) { try { world.setDynamicProperty(I(k), v); } catch {} }
export function wGetJ(k, def) { const s = wGet(k, undefined); if (typeof s !== 'string') return def; try { return JSON.parse(s); } catch { return def; } }
export function wSetJ(k, v) { wSet(k, JSON.stringify(v)); }
export function prop(e, k, def) { try { const v = e.getProperty(k); return v === undefined ? def : v; } catch { return def; } }
export function setProp(e, k, v) { try { e.setProperty(k, v); } catch {} }

// ---------------------------------------------------------------- vettori
export const v3 = (x, y, z) => ({ x, y, z });
export const add = (a, b) => v3(a.x + b.x, a.y + b.y, a.z + b.z);
export const sub = (a, b) => v3(a.x - b.x, a.y - b.y, a.z - b.z);
export const mul = (a, k) => v3(a.x * k, a.y * k, a.z * k);
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const dist2d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const norm2d = (a) => { const l = Math.hypot(a.x, a.z) || 1; return v3(a.x / l, 0, a.z / l); };
export const floor = (a) => v3(Math.floor(a.x), Math.floor(a.y), Math.floor(a.z));

// ---------------------------------------------------------------- messaggi, suoni, particelle
export function tell(p, t) { try { p.sendMessage(t); } catch {} }
export function bar(p, t) { try { p.onScreenDisplay.setActionBar(t); } catch {} }
export function titolo(p, t, sotto) {
  try { p.onScreenDisplay.setTitle(t, { subtitle: sotto ?? '', fadeInDuration: 10, stayDuration: 50, fadeOutDuration: 20 }); } catch {}
}
export function suono(dim, id, loc, vol = 1, pitch = 1) { try { dim.playSound(id, loc, { volume: vol, pitch }); } catch {} }
export function suonoP(p, id, vol = 1, pitch = 1) { try { p.playSound(id, { volume: vol, pitch }); } catch {} }
export function fx(dim, id, loc) { try { dim.spawnParticle(id, loc); } catch {} }
export function fxP(p, id, loc) { try { p.spawnParticle(id, loc); } catch {} }
/** schermo che pulsa di un colore (volto del vampiro, sole, verbena) */
export function lampo(p, r, g, b, dentro = 0.1, resta = 0.15, fuori = 0.5) {
  try { p.camera.fade({ fadeColor: { red: r, green: g, blue: b }, fadeTime: { fadeInTime: dentro, holdTime: resta, fadeOutTime: fuori } }); } catch {}
}

// ---------------------------------------------------------------- effetti
export function eff(e, id, ticks, amp = 0, particelle = false) {
  try { e.addEffect(id, ticks, { amplifier: Math.max(0, amp), showParticles: particelle }); } catch {}
}
export function togliEff(e, id) { try { e.removeEffect(id); } catch {} }
// effetti INFINITI: si rimettono solo se mancano o se cambia il livello (amp < 0 = toglilo, se l'avevamo messo noi)
const _inf = new Map();                                   // id entità -> { effetto: amplificatore }
export function effInf(e, id, amp) {
  let m = _inf.get(e.id);
  if (!m) { m = {}; _inf.set(e.id, m); }
  let ora;
  try { ora = e.getEffect(id); } catch { return; }
  if (amp < 0) {
    if (m[id] !== undefined) { delete m[id]; if (ora && (ora.duration < 0 || ora.duration > 1e6)) togliEff(e, id); }
    return;
  }
  if (ora && m[id] === amp && ora.amplifier === amp && (ora.duration < 0 || ora.duration > 1e6)) return;
  togliEff(e, id);
  let fatto = false;
  try { fatto = (e.runCommand(`effect @s ${id} infinite ${amp} true`)?.successCount ?? 0) > 0; } catch {}
  if (!fatto) eff(e, id, 20000000, amp);                  // riserva: durata lunghissima
  m[id] = amp;
}
export function dimenticaInf(e) { _inf.delete(e.id); }
export function haEff(e, id) { try { return !!e.getEffect(id); } catch { return false; } }

// ---------------------------------------------------------------- inventario e mani
export function inv(e) { try { return e.getComponent('minecraft:inventory')?.container; } catch { return undefined; } }
export function equip(e) { try { return e.getComponent('minecraft:equippable'); } catch { return undefined; } }
export function mano(e) { try { return equip(e)?.getEquipment(EquipmentSlot.Mainhand); } catch { return undefined; } }
export function manoSinistra(e) { try { return equip(e)?.getEquipment(EquipmentSlot.Offhand); } catch { return undefined; } }
export function setMano(e, s) { try { equip(e)?.setEquipment(EquipmentSlot.Mainhand, s); } catch {} }
export function ha(p, id) {
  if (manoSinistra(p)?.typeId === id) return true;
  for (const s of ['Head', 'Chest', 'Legs', 'Feet']) { try { if (equip(p)?.getEquipment(s)?.typeId === id) return true; } catch {} }
  const c = inv(p);
  if (!c) return false;
  for (let i = 0; i < c.size; i++) if (c.getItem(i)?.typeId === id) return true;
  return false;
}
/** toglie 1 oggetto dalla mano principale (o lo svuota) */
export function consumaMano(p) {
  const s = mano(p);
  if (!s) return;
  if (s.amount > 1) { s.amount -= 1; setMano(p, s); } else setMano(p, undefined);
}
export function dai(p, id, n = 1) {
  let s;
  try { s = new ItemStack(id, n); } catch { return; }
  const resto = (() => { try { return inv(p)?.addItem(s); } catch { return s; } })();
  if (resto) try { p.dimension.spawnItem(resto, p.location); } catch {}
}

// ---------------------------------------------------------------- salute
export function salute(e) { try { const h = e.getComponent('minecraft:health'); return h ? { ora: h.currentValue, max: h.effectiveMax } : { ora: 0, max: 1 }; } catch { return { ora: 0, max: 1 }; } }
export function cura(e, n) { try { const h = e.getComponent('minecraft:health'); h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + n)); } catch {} }
export function curaTutto(e) { try { e.getComponent('minecraft:health').resetToMaxValue(); } catch {} }
export function danno(e, n, cause = 'entityAttack', da) {
  try { return e.applyDamage(n, da ? { cause, damagingEntity: da } : { cause }); } catch { return false; }
}

// ---------------------------------------------------------------- mondo
export const t = () => { try { return world.getTimeOfDay(); } catch { return 6000; } };
/** il sole è alto (all'alba e al tramonto il sole è basso ma brucia lo stesso) */
export const eGiorno = (ora = t()) => ora < 12300 || ora > 23500;
export const eNotte = (ora = t()) => ora >= 13000 && ora <= 23000;
export function giornoAssoluto() { try { return Math.floor(world.getAbsoluteTime() / GIORNO); } catch { return 0; } }
export function blk(dim, loc) { try { return dim.getBlock(loc); } catch { return undefined; } }
/** true se sopra la testa c'è il cielo aperto */
export function cieloAperto(dim, loc, altezza = 1.7) {
  try {
    const top = dim.getTopmostBlock({ x: loc.x, z: loc.z });
    if (!top) return true;
    return top.location.y < Math.floor(loc.y + altezza);
  } catch { return false; }
}
/** guarda la creatura davanti al giocatore (raggio in blocchi) */
export function guardata(p, raggio = 12) {
  try {
    const hits = p.getEntitiesFromViewDirection({ maxDistance: raggio });
    for (const h of hits) {
      const e = h.entity;
      if (!ok(e) || e.id === p.id) continue;
      if (/^minecraft:(item|xp_orb|arrow|snowball|fishing_hook)$/.test(e.typeId)) continue;
      return e;
    }
  } catch {}
  return undefined;
}
export function vicini(dim, loc, r, opz = {}) { try { return dim.getEntities({ location: loc, maxDistance: r, ...opz }); } catch { return []; } }
export function famiglia(e, f) { try { return !!e.getComponent('minecraft:type_family')?.hasTypeFamily(f); } catch { return false; } }

export function fmtTempo(ticks) {
  const s = Math.max(0, Math.ceil(ticks / 20));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

// pausa per non ripetere azioni troppo spesso: pronto(p, ticks, chiave)
const _ultimi = new Map();
export function pronto(e, ticks, k) {
  const id = e.id + ':' + k, ora = system.currentTick, prima = _ultimi.get(id) ?? -1e9;
  if (ora - prima < ticks) return false;
  _ultimi.set(id, ora);
  return true;
}

// ---------------------------------------------------------------- AREA CARICATA (1.5.0)
// Sul telefono il gioco tiene caricata solo la zona vicina al giocatore: un fill su chunk non caricati FALLISCE
// (era il motivo del pezzo mancante della dimora). Prima di costruire si chiede al gioco di caricare tutta l'area
// (tickingarea) e si aspetta che sia pronta davvero (si leggono i blocchi agli angoli e al centro).
export function areaPronta(dim, x0, z0, x1, z1, y) {
  const punti = [];
  for (let x = x0; x <= x1 + 15; x += 16) for (let z = z0; z <= z1 + 15; z += 16) punti.push([Math.min(x, x1), Math.min(z, z1)]);
  return punti.every(([x, z]) => !!blk(dim, v3(x, y, z)));
}
/** chiama fn(nome tickingarea o '') quando tutta l'area è caricata; restituisce true se l'ha chiamata subito */
export function conAreaCaricata(dim, x0, z0, x1, z1, y, nome, fn) {
  if (areaPronta(dim, x0, z0, x1, z1, y)) { guard(() => fn('')); return true; }
  try { dim.runCommand(`tickingarea add ${x0} ${y} ${z0} ${x1} ${y} ${z1} ${nome} true`); } catch {}
  let n = 0;
  const prova = () => guard(() => {
    if (areaPronta(dim, x0, z0, x1, z1, y) || ++n > 45) { guard(() => fn(nome)); return; }
    system.runTimeout(prova, 20);
  });
  system.runTimeout(prova, 20);
  return false;
}
export function togliArea(dim, nome) { if (nome) { try { dim.runCommand(`tickingarea remove ${nome}`); } catch {} } }

// messaggio importante sulla barra: per qualche secondo la barra del sangue non lo copre
const _zitto = new Map();
export function barForte(p, testo, ticks = 60) { bar(p, testo); _zitto.set(p.id, system.currentTick + ticks); }
export function hudZitto(p) { return (_zitto.get(p.id) ?? 0) > system.currentTick; }
