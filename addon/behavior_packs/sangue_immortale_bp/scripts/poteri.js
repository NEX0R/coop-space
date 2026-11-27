// Sangue Immortale — poteri del vampiro. Si usano dalla BARRA DEI POTERI (barra.js): premi lo slot e guarda il mob.
import { world, system, ItemStack } from '@minecraft/server';
import { ActionFormData } from '@minecraft/server-ui';
import * as U from './util.js';
import * as S from './stato.js';
import { haVerbena, tipoSangue, rendiAlleato } from './nutrirsi.js';
import { puoPrendere } from './seguaci.js';

const NOMI = {
  'minecraft:villager_v2': 'Abitante', 'minecraft:villager': 'Abitante', 'minecraft:wandering_trader': 'Mercante ambulante',
  'minecraft:pillager': 'Predone', 'minecraft:vindicator': 'Vendicatore', 'minecraft:evoker': 'Evocatore', 'minecraft:witch': 'Strega',
  'minecraft:player': 'Giocatore', 'vamp:vampiro': 'Vampiro', 'vamp:squartatore': 'Squartatore', 'vamp:originale': 'Antico Originale',
  'vamp:cacciatore': 'Cacciatore', 'vamp:cacciatore_paletto': 'Cacciatore',
};
export const nome = (e) => (e.typeId === 'minecraft:player' ? e.name : (e.nameTag || NOMI[e.typeId] ||
  e.typeId.split(':')[1].replace(/_v\d$/, '').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())));
const ABITANTI = /^minecraft:(villager_v2|villager|wandering_trader)$/;
const BOSS = /^minecraft:(wither|warden|ender_dragon|elder_guardian)$/;   // si fermano, ma non spariscono

function paga(p, n) {
  if (S.eOriginale(p)) return true;                       // un Originale non usa sangue per i poteri
  if (S.sangue(p) < n) { U.barForte(p, `§cTi serve più sangue (${n}).`); return false; }
  S.setSangue(p, S.sangue(p) - n);
  return true;
}
export function vervainaBlocca(p) {
  if (!S.bloccato(p)) return false;
  U.barForte(p, '§dLa verbena ti scorre nelle vene: i poteri non rispondono.', 50);
  return true;
}

// ---------------------------------------------------------------- soggiogamento (compulsione): funziona su TUTTI i mob
function scegli(p, titolo, testo, opzioni) {
  const f = new ActionFormData().title(titolo).body(testo);
  for (const [t] of opzioni) f.button(t);
  f.show(p).then((r) => {
    if (r.canceled) { if (r.cancelationReason === 'UserBusy') system.runTimeout(() => scegli(p, titolo, testo, opzioni), 10); return; }
    U.guard(() => opzioni[r.selection]?.[1]());
  }).catch(() => {});
}
function occhi(e) {   // effetto visivo: pupille che si dilatano
  U.fx(e.dimension, 'vamp:rito', U.add(e.location, U.v3(0, 1.4, 0)));
  U.suono(e.dimension, 'mob.evocation_illager.prepare_summon', e.location, 0.4, 1.8);
}

export function soggioga(p, e) {
  if (!U.ok(e)) { U.barForte(p, '§7Guarda negli occhi una creatura (entro 14 blocchi).'); return; }
  if (vervainaBlocca(p)) return;
  const tipo = tipoSangue(e);
  if (e.typeId === 'vamp:originale') { U.barForte(p, '§6Nessuno soggioga l\'Antico Originale.'); return; }
  if (U.famiglia(e, 'inanimate') || !e.getComponent('minecraft:health') || /^vamp:(altare|bara|pipistrello|granata_verbena)$|^minecraft:(armor_stand|boat|chest_boat|minecart|item|xp_orb|painting|.*_minecart)$/.test(e.typeId)) {
    U.barForte(p, '§7Non ha una mente da soggiogare.'); return;
  }
  if (e.typeId === 'minecraft:player' && S.eOriginale(e) && !S.eOriginale(p)) { U.barForte(p, '§6Non puoi soggiogare un Originale.'); return; }
  if (tipo === 'umano' && haVerbena(e)) {
    if (!paga(p, 2)) return;
    U.barForte(p, '§dHa la verbena in corpo: i tuoi occhi non hanno potere su di lui.', 80);
    if (e.typeId === 'minecraft:player') U.tell(e, '§d[Verbena]§r Un vampiro ha provato a soggiogarti, ma la verbena ti protegge.');
    return;
  }
  const t = `§7Guardi §f${nome(e)}§7 negli occhi. Le pupille si dilatano...`;
  if (ABITANTI.test(e.typeId)) {
    scegli(p, '§4Soggiogamento', t, [
      ['Seguimi', () => comando(p, e, 'segui')], ['Resta qui', () => comando(p, e, 'resta')],
      ['Dimentica tutto', () => comando(p, e, 'dimentica')], ['Fammi un dono', () => comando(p, e, 'dono')],
      ['Invitami in casa', () => comando(p, e, 'invito')]]);
  } else if (e.typeId === 'minecraft:player') {
    scegli(p, '§4Soggiogamento', t, [['Fermati', () => comando(p, e, 'fermo')], ['Vieni qui', () => comando(p, e, 'vieni')]]);
  } else if (/^vamp:(vampiro|squartatore)$/.test(e.typeId)) {
    // solo un Originale piega la mente di un altro vampiro (a qualsiasi età gli altri vampiri non possono)
    if (!S.eOriginale(p)) { U.barForte(p, '§7La mente di un vampiro si piega solo a un §6Originale§7.', 80); return; }
    const no = puoPrendere(p, e);
    if (no) { U.barForte(p, '§4' + no, 80); return; }
    scegli(p, '§4Soggiogamento', t, [['Unisciti al mio seguito', () => comando(p, e, 'obbedisci')], ['Fermati', () => comando(p, e, 'fermo')],
      ['Vattene', () => comando(p, e, 'vattene')]]);
  } else if (BOSS.test(e.typeId)) {
    scegli(p, '§4Soggiogamento', t, [['Fermati', () => comando(p, e, 'fermo')], ['Resta qui', () => comando(p, e, 'resta')]]);
  } else {
    scegli(p, '§4Soggiogamento', t, [['Seguimi', () => comando(p, e, 'segui')], ['Resta qui', () => comando(p, e, 'resta')],
      ['Fermati', () => comando(p, e, 'fermo')], ['Vattene', () => comando(p, e, 'vattene')]]);
  }
}

// chi segue chi (id creatura -> id vampiro), salvato nel mondo
let seguaci;
const mappa = () => { if (!seguaci) seguaci = new Map(Object.entries(U.wGetJ('seguaci', {}))); return seguaci; };
const salvaSeguaci = () => U.wSetJ('seguaci', Object.fromEntries(mappa()));

function comando(p, e, cosa) {
  if (!U.ok(e) || !paga(p, 2)) return;
  occhi(e);
  switch (cosa) {
    case 'segui':
      mappa().set(e.id, p.id); salvaSeguaci(); U.togliEff(e, 'slowness');
      U.barForte(p, `§f${nome(e)}§7 ti segue.`); break;
    case 'resta':
      mappa().delete(e.id); salvaSeguaci(); U.eff(e, 'slowness', 20 * 60 * 20, 255);
      U.barForte(p, `§f${nome(e)}§7 resta qui.`); break;
    case 'dimentica':
      mappa().delete(e.id); salvaSeguaci(); U.togliEff(e, 'slowness'); U.togliEff(e, 'weakness'); U.curaTutto(e);
      U.barForte(p, `§f${nome(e)}§7 sbatte le palpebre: non ricorda più il morso.`); break;
    case 'dono': {
      const g = U.giornoAssoluto();
      if (U.get(e, 'dono', -1) === g) { U.barForte(p, `§f${nome(e)}§7: «Ti ho già dato tutto, oggi.»`); return; }
      U.set(e, 'dono', g);
      const doni = [['minecraft:emerald', 1 + Math.floor(Math.random() * 3)], [['minecraft:bread', 'minecraft:iron_ingot', 'minecraft:book', 'minecraft:carrot', 'minecraft:gold_ingot'][Math.floor(Math.random() * 5)], 1 + Math.floor(Math.random() * 2)]];
      for (const [id, n] of doni) { try { e.dimension.spawnItem(new ItemStack(id, n), U.add(e.location, U.v3(0, 1, 0))); } catch {} }
      U.barForte(p, `§f${nome(e)}§7: «Prendi, è per te.»`); break;
    }
    case 'invito': {
      const zone = U.getJ(p, 'inviti', []);
      zone.push({ d: e.dimension.id, x: Math.round(e.location.x), z: Math.round(e.location.z) });
      U.setJ(p, 'inviti', zone.slice(-40));
      U.barForte(p, `§f${nome(e)}§7: «Entra pure, sei il benvenuto.» §8(case vicine aperte)`, 80); break;
    }
    case 'fermo':
      U.eff(e, 'slowness', 20 * (e.typeId === 'minecraft:player' ? 6 : 20), 255); U.eff(e, 'weakness', 400, 2);
      if (e.typeId === 'minecraft:player') U.titolo(e, '§4Fermati.', '§7Non riesci a muoverti.');
      U.barForte(p, `§f${nome(e)}§7 resta immobile.`); break;
    case 'vieni':
      try { const d = U.norm2d(p.getViewDirection()); e.teleport(U.add(p.location, U.v3(d.x * 1.5, 0, d.z * 1.5))); } catch {}
      U.titolo(e, '§4Vieni qui.', ''); break;
    case 'vattene':
      for (let i = 0; i < 6; i++) U.fx(e.dimension, 'vamp:fumo_nero', U.add(e.location, U.v3(0, i * 0.35, 0)));
      U.barForte(p, `§f${nome(e)}§7 se ne va senza voltarsi.`);
      try { e.remove(); } catch {} break;
    case 'obbedisci':
      rendiAlleato(e, p, p.id);
      U.barForte(p, `§f${nome(e)}§6 entra nel tuo seguito.` + (S.eOriginale(p) ? ' §7Più seguaci hai, più sei forte.' : ''), 80); break;
  }
}

/** i mob soggiogati con "Seguimi" camminano verso il vampiro (passo a passo) */
export function tickSeguaci() {
  const m = mappa();
  if (!m.size) return;
  const giocatori = new Map(world.getPlayers().map((p) => [p.id, p]));
  let cambiato = false;
  for (const [id, pid] of m) {
    const e = world.getEntity(id), p = giocatori.get(pid);
    if (!e || !U.ok(e)) { m.delete(id); cambiato = true; continue; }
    if (!p || p.dimension.id !== e.dimension.id) continue;
    const d = U.dist(e.location, p.location);
    if (d > 30) continue;
    if (d > 12) { try { const v = U.norm2d(p.getViewDirection()); e.teleport(U.sub(p.location, U.v3(v.x * 2, 0, v.z * 2))); } catch {} continue; }
    if (d < 2.5) continue;
    const dir = U.norm2d(U.sub(p.location, e.location));
    let n = U.add(e.location, U.mul(dir, 0.35));
    const dim = e.dimension;
    const solido = (l) => { const b = U.blk(dim, l); return !!b && !b.isAir && !b.isLiquid && !/grass|flower|torch|snow_layer|carpet/.test(b.typeId); };
    if (solido(n)) { const su = U.add(n, U.v3(0, 1, 0)); if (solido(su) || solido(U.add(su, U.v3(0, 1, 0)))) continue; n = su; }
    else if (!solido(U.add(n, U.v3(0, -1, 0))) && !solido(U.add(n, U.v3(0, -2, 0)))) n = U.add(n, U.v3(0, -1, 0));
    else if (!solido(U.add(n, U.v3(0, -1, 0)))) n = U.add(n, U.v3(0, -1, 0));
    try { e.teleport(n, { facingLocation: p.location }); } catch {}
  }
  if (cambiato) salvaSeguaci();
}

// ---------------------------------------------------------------- altri poteri
export function sensi(p) {
  const on = !U.get(p, 'sensi', false);
  U.set(p, 'sensi', on);
  if (on) { U.eff(p, 'night_vision', 400, 0); U.barForte(p, '§4Sensi accesi: senti ogni battito intorno a te.'); }
  else { U.togliEff(p, 'night_vision'); U.barForte(p, '§7Sensi a riposo.'); }
}


export function offriSangue(p) {
  if (vervainaBlocca(p) || !paga(p, 4)) return;
  // la fiala porta il tuo nome: "Sangue di <nome>"
  let fiala;
  try { fiala = new ItemStack(U.I('fiala_vampiro'), 1); fiala.nameTag = '§4Sangue di ' + p.name; } catch {}
  if (fiala) {
    let resto;
    try { resto = U.inv(p)?.addItem(fiala); } catch { resto = fiala; }
    if (resto) { try { p.dimension.spawnItem(resto, p.location); } catch {} }
  } else U.dai(p, U.I('fiala_vampiro'));
  U.danno(p, 1, 'magic');
  U.fx(p.dimension, 'vamp:sangue', U.add(p.location, U.v3(0, 1.2, 0)));
  U.barForte(p, '§4Ti mordi il polso e riempi una fiala di sangue.', 60);
}

export function interruttore(p) {
  if (S.umanita(p)) {
    U.set(p, 'umanita', false);
    U.set(p, 'uccisioni', 0);
    U.titolo(p, '§cUmanità spenta', '§7Niente colpa. Niente paura. Niente dolore.');
    U.suonoP(p, 'beacon.deactivate', 1, 0.6);
    U.tell(p, '§c[Umanità spenta]§r Sei più forte e i tuoi morsi sono più profondi, ma la sete corre più veloce. ' +
      'Se uccidi troppo diventerai uno §4Squartatore§r.');
  } else {
    U.set(p, 'umanita', true);
    U.set(p, 'squartatore', false);
    U.set(p, 'uccisioni', 0);
    U.eff(p, 'nausea', 240, 0); U.eff(p, 'slowness', 240, 1); U.eff(p, 'blindness', 40, 0);
    U.titolo(p, '§bUmanità accesa', '§7Tutto quello che non hai sentito ti travolge in un colpo.');
    U.suonoP(p, 'beacon.activate', 1, 0.8);
  }
}

export function allucina(p, e) {
  if (!U.ok(e)) { U.barForte(p, '§7Guarda una creatura.'); return; }
  if (vervainaBlocca(p)) return;
  if (tipoSangue(e) === 'umano' && haVerbena(e)) { U.barForte(p, '§dLa verbena protegge la sua mente.'); return; }
  if (!paga(p, 3)) return;
  U.eff(e, 'blindness', 160, 0); U.eff(e, 'nausea', 220, 0); U.eff(e, 'slowness', 160, 1); U.eff(e, 'weakness', 160, 1);
  if (e.typeId === 'minecraft:player') U.titolo(e, '§5...', '§7Non sai più cosa è vero.');
  for (let i = 0; i < 3; i++) U.fx(e.dimension, 'vamp:fumo_nero', U.add(e.location, U.v3(0, 1 + i * 0.4, 0)));
  U.barForte(p, `§5${nome(e)}§7 si perde nelle visioni che gli hai dato.`);
}

// ---------------------------------------------------------------- VELO D'OMBRA (effetto ad area, richiesta del 25/11/2026)
// Un'ondata di ombra in un raggio di 8 blocchi: chi è dentro resta IMMOBILE e CIECO per 8 secondi.
// Non tocca i tuoi seguaci, gli Originali e chi ha la verbena in corpo. Costa 4 di sangue (niente all'Originale).
export const RAGGIO_VELO = 8;
export function velo(p) {
  if (vervainaBlocca(p) || !paga(p, 4)) return;
  const dim = p.dimension;
  let n = 0;
  for (const e of U.vicini(dim, p.location, RAGGIO_VELO)) {
    if (e.id === p.id || !e.getComponent?.('minecraft:health') || U.famiglia(e, 'inanimate')) continue;
    if (/^vamp:(originale|sedile|pipistrello|bara|bara_letto)$/.test(e.typeId)) continue;
    if (U.prop(e, 'vamp:alleato', false) && U.get(e, 'padrone', '') === p.id) continue;
    if (e.typeId === 'minecraft:player' && S.eOriginale(e)) continue;
    if (tipoSangue(e) === 'umano' && haVerbena(e)) continue;
    U.eff(e, 'slowness', 160, 255); U.eff(e, 'blindness', 160, 0); U.eff(e, 'weakness', 160, 4); U.eff(e, 'darkness', 160, 0);
    if (e.typeId === 'minecraft:player') U.titolo(e, '§8...', "§7Un velo d'ombra ti avvolge: non vedi e non ti muovi.");
    n++;
  }
  for (let r = 1; r <= RAGGIO_VELO; r += 1.5) for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    U.fx(dim, 'vamp:fumo_nero', U.add(p.location, U.v3(Math.cos(a) * r, 0.4, Math.sin(a) * r)));
  }
  U.suono(dim, 'mob.warden.sonic_charge', p.location, 0.8, 0.5);
  U.barForte(p, n ? `§8Velo d'ombra: §f${n}§8 creature immobili e cieche.` : "§8Il velo d'ombra non trova nessuno.", 60);
}

function vicino(p, e, r = 4.5) {
  if (S.eOriginale(p)) r += 1.5;                          // l'Originale arriva più lontano
  if (!U.ok(e)) { U.barForte(p, '§7Guarda una creatura vicina.'); return false; }
  if (U.dist(p.location, e.location) > r) { U.barForte(p, '§7Troppo lontano: avvicinati.'); return false; }
  return true;
}

export function spezzaCollo(p, e) {
  const orig = S.eOriginale(p);                           // l'Originale lo fa in qualsiasi momento, senza requisiti
  if (!vicino(p, e) || (!orig && vervainaBlocca(p))) return;
  if (e.typeId === 'vamp:originale' && !orig) { U.barForte(p, '§6Un Originale è troppo forte per te.'); return; }
  if (!paga(p, 3)) return;
  U.suono(e.dimension, 'random.break', e.location, 1, 0.5);
  const tipo = tipoSangue(e);
  if (/^vamp:(vampiro|squartatore)$/.test(e.typeId)) {
    try { e.triggerEvent(U.I('neutralizza')); } catch {}
    U.barForte(p, `§f${nome(e)}§7 crolla a terra. Si rialzerà tra poco... a meno che tu non usi un paletto.`, 80);
  } else if (e.typeId === 'vamp:originale') {
    if (orig) {                                           // tra Originali: crolla per 20 secondi
      try { e.triggerEvent(U.I('essicca')); } catch {}
      U.barForte(p, '§6L\'Antico crolla a terra: ora il paletto di quercia bianca può finirlo.', 80);
    } else { U.eff(e, 'slowness', 120, 255); U.barForte(p, '§6L\'Antico barcolla per un istante.'); }
  } else if (e.typeId === 'minecraft:player' && tipo === 'vampiro') {
    U.eff(e, 'blindness', 200, 0); U.eff(e, 'slowness', 200, 255); U.danno(e, 6, 'entityAttack', p);
    U.titolo(e, '§8Crack.', '§7Ti hanno spezzato il collo: ti risvegli tra poco.');
  } else {
    U.danno(e, 1000, 'entityAttack', p);
  }
}

export function uccidiVampiro(e, da) {
  if (e.typeId === 'minecraft:player') { S.segnaMorteVera(e, 'il cuore strappato'); U.danno(e, 1000, 'entityAttack', da); return; }
  try { e.triggerEvent(U.I('morente')); } catch {}
  system.runTimeout(() => U.guard(() => { if (U.ok(e)) U.danno(e, 1000, 'entityAttack', da); }), 2);
}

export function strappaCuore(p, e) {
  const orig = S.eOriginale(p);                           // l'Originale lo fa in qualsiasi momento, senza requisiti
  if (!vicino(p, e, 3.5) || (!orig && vervainaBlocca(p))) return;
  if (e.typeId === 'vamp:originale') {
    if (!orig) { U.barForte(p, '§6Il cuore di un Originale non si ferma: solo la quercia bianca lo uccide.'); return; }
    const h0 = U.salute(e);
    U.danno(e, Math.max(0, Math.min(100, h0.ora - 31)), 'entityAttack', p);   // resta vivo: lo finisce solo la quercia bianca
    for (let i = 0; i < 3; i++) U.fx(e.dimension, 'vamp:sangue', U.add(e.location, U.v3(0, 1.2 + i * 0.2, 0)));
    U.suono(e.dimension, 'mob.zombie.unfect', e.location, 1, 0.6);
    U.barForte(p, '§6Gli strappi il cuore, ma gli ricresce: finiscilo con la quercia bianca.', 80);
    return;
  }
  const tipo = tipoSangue(e), h = U.salute(e);
  const aTerra = U.prop(e, 'vamp:a_terra', false);
  if (!orig && tipo === 'vampiro' && !(aTerra || h.ora <= h.max / 2)) { U.barForte(p, '§7È ancora troppo forte: indeboliscilo prima (sotto metà vita).'); return; }
  if (e.typeId === 'minecraft:player' && S.eOriginale(e)) { U.barForte(p, '§6Il cuore di un Originale non si ferma.'); return; }
  if (!paga(p, 3)) return;
  for (let i = 0; i < 3; i++) U.fx(e.dimension, 'vamp:sangue', U.add(e.location, U.v3(0, 1.2 + i * 0.2, 0)));
  U.suono(e.dimension, 'mob.zombie.unfect', e.location, 1, 0.6);
  if (tipo === 'vampiro') uccidiVampiro(e, p); else U.danno(e, 1000, 'entityAttack', p);
  U.barForte(p, '§cHai strappato il cuore.');
}

// ---------------------------------------------------------------- seguito: quanti vampiri seguono questo vampiro
export function seguito(p, raggio = 48) {
  return U.vicini(p.dimension, p.location, raggio).filter((v) => /^vamp:(vampiro|squartatore)$/.test(v.typeId)
    && U.prop(v, 'vamp:alleato', false) && U.get(v, 'padrone', '') === p.id).length;
}
