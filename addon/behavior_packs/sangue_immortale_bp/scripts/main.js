// Sangue Immortale — logica principale (API @minecraft/server 2.0.0 stabile, nessun esperimento).
//
//   ACCOVACCIATO + colpo a mano vuota        -> morso (vampiro o in transizione)
//   ACCOVACCIATO + colpo con sacca vuota      -> riempie la sacca di sangue umano
//   ACCOVACCIATO + colpo con fiala su abitante -> il tuo sangue nel suo corpo (legame del sire)
//   ISTINTO DEL VAMPIRO: tocco = ruota delle abilità; l'abilità scelta compare accanto all'Istinto (tocco = la usi)
//   Morso: abilità della ruota (avvicinati e tocca); in transizione si morde a mano vuota
//   Balestra normale: con i paletti nell'inventario spara paletti invece delle frecce
//   Bara per dormire: di giorno ti ci siedi dentro e si fa notte
//   Altare dei rituali: tocco = offri / riprendi
//   Forma di pipistrello (potere, illimitata): movimento + sguardo, salto = sali, accovacciato = torni vampiro
//   Super velocità: sempre pronta, parte quando corri (doppio tocco in avanti)
//   Mirino a canini davanti agli umani; accovacciato dopo il morso = continui a bere
//   Tocco su un tuo seguace = ordini (segui, fermo, seduto, neutrale, aggressivo, anello diurno)
//   Accovacciato + tocco su un tuo seguace = seduto / in piedi (come i lupi)
//   Sedia del prelievo: a mano vuota fai sedere un umano, cibo e sacche vuote -> sacche piene ogni 30 s
//   Cenere di quercia bianca posata in un giro chiuso: i vampiri non entrano (gli Originali sì)
//   Anello del varco (solo Originale): tocco = X Y Z + dimensione -> portale di fumo nero per 10 secondi
//   Occhi rossi: chi è vampiro (anche Originale) ha gli occhi rossi, li vedono gli altri giocatori
//   Villaggi: borgo umano, avamposto dei cacciatori, covo dei vampiri, dimora dell'Originale (si generano esplorando)
//   Medaglione del cacciatore in tasca = la maledizione del cacciatore non ha effetto
//   Originale: 50 di danno a mani nude, rompe qualsiasi blocco (tranne la bedrock) in 2 secondi
//   CACCIATORE DI VAMPIRI (1.5.0): giuramento all'altare; Diario del cacciatore (come l'Istinto) con 10 abilità, Determinazione, gradi
//   SANTA BOMBA A MANO (1.5.0): fatta con La Cura; luce a cerchio 50×50: cura gli umani, uccide i vampiri, l'Originale si salva solo col medaglione
//   Comandi di prova (trucchi attivi): /scriptevent vamp:info | vamp:vampiro | vamp:originale | vamp:umano | vamp:sangue 20 | vamp:eta 300
//                                      vamp:cacciatore | vamp:caccia <abilità> | vamp:prede 15
import { world, system } from '@minecraft/server';
import * as U from './util.js';
import * as S from './stato.js';
import * as N from './nutrirsi.js';
import * as P from './poteri.js';
import * as M from './mondo.js';
import * as A from './altare.js';
import { apriGuida } from './guida.js';
import * as B from './barra.js';
import * as Pip from './pipistrello.js';
import * as Seg from './seguaci.js';
import * as F from './forza.js';
import * as Cer from './cerchio.js';
import * as Sed from './sedia.js';
import * as Var from './varco.js';
import * as Vil from './villaggi.js';
import * as Bal from './balestra.js';
import * as Let from './letto.js';
import * as Tut from './tutorial.js';
import * as C from './cacciatore.js';
import * as Santa from './santa.js';

// collegamenti tra moduli
S.ganci.vampiro.push((p) => { B.pulisciVecchio(p); B.sistema(p); C.perdiClasse(p, '§4[Cacciatore] Il sangue di vampiro ha spezzato il tuo giuramento.'); });
S.ganci.umano.push((p) => { Pip.torna(p); B.togliTutto(p); U.set(p, 'sfondamento', false); });
S.ganci.seguito = (p) => P.seguito(p);

const g = U.guard;
const PASSO = 20;

// ---------------------------------------------------------------- tick principale
let conta = 0;
system.runInterval(() => g(() => {
  conta++;
  for (const p of world.getPlayers()) {
    g(() => {
      if (S.eVampiro(p)) S.tickVampiro(p, PASSO);
      else if (S.inTransizione(p)) S.tickTransizione(p, PASSO);
      else S.tickUmano(p, PASSO);
      if (C.eCacciatore(p)) C.tickCacciatore(p, PASSO);
      S.tickMaledizione(p, PASSO);
      if (conta % 2 === 0) M.tickInvito(p);
    });
  }
  g(() => A.tickAltari());
  g(() => M.tickOriginali());
  if (conta % 5 === 0) g(() => M.tickGhiande(PASSO * 5));
  if (conta % 60 === 0) g(() => M.tickCacciatori());
  if (conta % 5 === 0) g(() => Seg.tickSeguito());
  if (conta % 5 === 0) g(() => Vil.tickVillaggi());
  g(() => Let.tickBare());
  g(() => Sed.tickSedie());
}), PASSO);
system.runInterval(() => g(() => P.tickSeguaci()), 2);
system.runInterval(() => g(() => Pip.tickPipistrelli()), 1);
system.runInterval(() => g(() => { B.tickBarra(); for (const p of world.getPlayers()) g(() => { if (C.eCacciatore(p)) C.sistema(p); }); }), 20);
system.runInterval(() => g(() => C.tickTrappole()), 4);
system.runInterval(() => g(() => C.tickRichiamati()), 40);
system.runInterval(() => g(() => Pip.pulisci()), 100);
system.runInterval(() => g(() => Cer.tickCerchi()), 4);
system.runInterval(() => g(() => {
  for (const p of world.getPlayers()) g(() => { S.tickCorsa(p); F.tickSfondamento(p); });
  g(() => N.tickMirino());
  g(() => F.tickScavi());
  g(() => Var.tickVarchi());
  g(() => S.tickOcchi());
}), 2);

// ---------------------------------------------------------------- colpi: morso, sacca, fiala
world.afterEvents.entityHitEntity.subscribe((ev) => g(() => {
  const p = ev.damagingEntity, e = ev.hitEntity;
  if (p?.typeId !== 'minecraft:player' || !U.ok(e)) return;
  const s = U.mano(p);
  C.colpoCacciatore(p, e);                                   // cacciatore: danno extra sui vampiri, Colpo al cuore
  if (!s || B.ePotere(s.typeId) || C.eAbilita(s.typeId) || s.typeId === C.DIARIO) {
    // mano vuota: in transizione MORDI; da vampiro il morso è un'abilità della ruota, quindi qui è un colpo
    // (l'Originale tira il pugno da 50)
    if (S.inTransizione(p) && N.puoMordere(p, e)) N.morso(p, e);
    else F.colpo(p, e);
    return;
  }
  if (!p.isSneaking) return;
  if (s.typeId === U.I('sacca_vuota')) N.riempiSacca(p, e);
  else if (s.typeId === U.I('fiala_vampiro')) N.daiSangueAbitante(p, e);
  else if (s.typeId === U.I('sacca_sangue')) Seg.nutri(p, e);
}));

// colpo su un blocco: l'Originale lo rompe in 2 secondi
world.afterEvents.entityHitBlock.subscribe((ev) => g(() => {
  if (ev.damagingEntity?.typeId === 'minecraft:player') F.bloccoColpito(ev.damagingEntity, ev.hitBlock);
}));
// tocco su un tuo seguace: ordini
// paletti sparati dalla balestra normale
world.afterEvents.entitySpawn.subscribe((ev) => g(() => { if (ev.entity?.typeId === 'minecraft:arrow') Bal.frecciaNata(ev.entity); }));
world.afterEvents.playerInteractWithEntity.subscribe((ev) => g(() => {
  const p = ev.player, e = ev.target;
  if (!p || !U.ok(e) || !U.pronto(p, 10, 'ordini')) return;
  const giu = p.isSneaking;
  system.run(() => g(() => { if (giu) Seg.seduto(p, e); else Seg.ordini(p, e); }));
}));

// ---------------------------------------------------------------- oggetti
function usa(p, item) {
  if (!item || !U.ok(p)) return;
  if (item.typeId === U.I('guida') && U.pronto(p, 10, 'libro')) system.run(() => g(() => apriGuida(p)));
  if (item.typeId === B.ISTINTO && U.pronto(p, 8, 'istinto')) { const el = !p.isSneaking; system.run(() => g(() => B.apri(p, el))); }
  if (B.ePotere(item.typeId) && U.pronto(p, 6, 'tocco_potere')) system.run(() => g(() => B.usato(p, item.typeId)));
  if (item.typeId === C.DIARIO && U.pronto(p, 8, 'diario')) { const el = !p.isSneaking; system.run(() => g(() => C.apri(p, el))); }
  if (C.eAbilita(item.typeId) && U.pronto(p, 6, 'tocco_caccia')) system.run(() => g(() => C.usato(p, item.typeId)));
  if (item.typeId === 'minecraft:crossbow') g(() => Bal.carica(p));
  if (item.typeId === U.I('tabaccata') && U.pronto(p, 10, 'tabaccata')) g(() => N.inizioFumata(p));
  if (item.typeId === Var.ANELLO && U.pronto(p, 20, 'varco')) system.run(() => g(() => Var.usa(p)));
}
world.afterEvents.itemStartUse.subscribe((ev) => g(() => usa(ev.source, ev.itemStack)));
world.afterEvents.itemUse.subscribe((ev) => g(() => usa(ev.source, ev.itemStack)));
world.afterEvents.itemStopUse.subscribe((ev) => g(() => { if (ev.itemStack?.typeId === U.I('tabaccata')) N.fineFumata(ev.source); }));
world.afterEvents.itemCompleteUse.subscribe((ev) => g(() => {
  const id = ev.itemStack?.typeId;
  if (!id || id === U.I('guida') || id === Var.ANELLO || id === B.ISTINTO || B.ePotere(id) || id === C.DIARIO || C.eAbilita(id)) return;
  N.bevuto(ev.source, id);
}));

// ---------------------------------------------------------------- danni e morti
world.afterEvents.entityHurt.subscribe((ev) => g(() => M.ferito(ev)));
world.afterEvents.entityDie.subscribe((ev) => g(() => {
  const e = ev.deadEntity;
  let dim, loc;
  try { dim = e.dimension; loc = e.location; } catch {}
  if (dim && loc && /villager|wandering_trader/.test(e.typeId)) N.abitanteMorto(e, dim, loc);
  C.preda(e, ev.damageSource?.damagingEntity);
  M.morto(ev);
}));
world.afterEvents.dataDrivenEntityTrigger.subscribe((ev) => g(() => {
  if (ev.eventId === U.I('provocato')) {                    // il Signore Originale è stato attaccato
    U.set(ev.entity, 'calmo', false);
    for (const q of U.vicini(ev.entity.dimension, ev.entity.location, 40, { type: 'minecraft:player' }))
      U.tell(q, '§6Il Signore Originale:§r «Hai osato alzare la mano contro di me. Ne pagherai il prezzo.»');
  }
  if (ev.eventId === U.I('raccolta')) Let.raccolta(ev.entity);   // bara per dormire colpita: torna oggetto
  if (ev.eventId === U.I('rialzati')) {
    U.curaTutto(ev.entity);
    U.suono(ev.entity.dimension, 'mob.zombie.unfect', ev.entity.location, 0.8, 1.3);
  }
}));

// ---------------------------------------------------------------- nascita / rinascita
world.afterEvents.playerSpawn.subscribe((ev) => g(() => {
  const p = ev.player;
  if (ev.initialSpawn) {
    if (!U.get(p, 'guida_data', false)) {
      U.set(p, 'guida_data', true);
      U.dai(p, U.I('guida'));
      U.tell(p, '§4[Sangue Immortale]§r Hai ricevuto la §4Guida del Sangue Immortale§r: toccala per leggerla.');
    }
    if (S.eVampiro(p)) { try { p.addTag('vamp_vampiro'); } catch {} }
    B.pulisciVecchio(p);
    if (S.eVampiro(p)) B.sistema(p);
    if (C.eCacciatore(p)) C.sistema(p);
    system.runTimeout(() => g(() => { if (p.isValid) Tut.avvia(p); }), 40);       // mondo del tutorial: si costruisce da solo la prima volta
    if (U.get(p, 'in_pipistrello', false)) {   // uscito dal mondo da pipistrello: torna visibile e scende piano
      U.set(p, 'in_pipistrello', false); U.togliEff(p, 'invisibility'); U.eff(p, 'slow_falling', 200, 0);
    }
    return;
  }
  system.runTimeout(() => g(() => { S.allaRinascita(p); B.pulisciVecchio(p); if (S.eVampiro(p)) B.sistema(p); if (C.eCacciatore(p)) C.sistema(p); }), 5);
}));
world.afterEvents.weatherChange.subscribe((ev) => g(() => { if (/overworld/.test(String(ev.dimension))) S.setMeteo(ev.newWeather); }));
system.run(() => g(() => S.caricaMeteo()));

// ---------------------------------------------------------------- granata di verbena
const DARDI = new Set([U.I('dardo_paletto'), U.I('dardo_quercia')]);
world.afterEvents.projectileHitEntity.subscribe((ev) => g(() => {
  if (ev.projectile?.typeId === U.I('granata_verbena')) M.granata(ev.dimension, ev.location);
  else if (ev.projectile?.typeId === Santa.BOMBA) Santa.esplodi(ev.dimension, ev.location, ev.source);
  else if (DARDI.has(ev.projectile?.typeId)) M.dardo(ev);
}));
world.afterEvents.projectileHitBlock.subscribe((ev) => g(() => {
  if (ev.projectile?.typeId === U.I('granata_verbena')) M.granata(ev.dimension, ev.location);
  else if (ev.projectile?.typeId === Santa.BOMBA) Santa.esplodi(ev.dimension, ev.location, ev.source);
  else if (DARDI.has(ev.projectile?.typeId)) M.dardoPiantato(ev);
}));

// ---------------------------------------------------------------- blocchi: verbena, ghiande, letti, farina d'ossa
world.afterEvents.playerBreakBlock.subscribe((ev) => g(() => M.bloccoRotto(ev)));
// cerchio di cenere: si ricalcola quando posi o togli la cenere
world.afterEvents.playerBreakBlock.subscribe((ev) => g(() => { let id; try { id = ev.brokenBlockPermutation?.type?.id; } catch {} if (id === Cer.STRATO) Cer.ricalcola(ev.block.dimension, ev.block.location); }));
world.afterEvents.playerPlaceBlock.subscribe((ev) => g(() => { if (ev.block?.typeId === Cer.STRATO) Cer.ricalcola(ev.block.dimension, ev.block.location); }));
world.afterEvents.playerPlaceBlock.subscribe((ev) => g(() => M.piantato(ev)));
world.afterEvents.playerInteractWithBlock.subscribe((ev) => g(() => M.farinaDOssa(ev)));

// ---------------------------------------------------------------- altare (blocco con componente personalizzato)
system.beforeEvents.startup.subscribe((ev) => {
  ev.blockComponentRegistry.registerCustomComponent(A.ID, {
    onPlayerInteract: (e) => { const p = e.player, b = e.block; if (p && b) system.run(() => g(() => { if (U.pronto(p, 8, 'altare')) A.tocca(p, b); })); },
    onPlayerBreak: (e) => g(() => A.rotto(e.dimension, e.block.location, e.brokenBlockPermutation)),
  });
  // sedia del prelievo
  ev.blockComponentRegistry.registerCustomComponent(Sed.ID, {
    onPlayerInteract: (e) => { const p = e.player, b = e.block; if (p && b) system.run(() => g(() => { if (U.pronto(p, 8, 'sedia')) Sed.tocca(p, b); })); },
    onPlayerBreak: (e) => g(() => Sed.rotta(e.dimension, e.block.location)),
  });
});
world.afterEvents.playerPlaceBlock.subscribe((ev) => g(() => A.piazzato(ev.block)));

// ---------------------------------------------------------------- comandi di prova
system.afterEvents.scriptEventReceive.subscribe((ev) => g(() => {
  const p = ev.sourceEntity;
  if (p?.typeId !== 'minecraft:player') return;
  const n = ev.message ? Number(ev.message) : NaN;
  switch (ev.id) {
    case 'vamp:info': {
      const st = S.eVampiro(p) ? (S.eOriginale(p) ? 'Originale' : 'vampiro') : (S.inTransizione(p) ? 'in transizione' : 'umano');
      U.tell(p, `§4[Info]§r stato: §f${st}§r | sangue §c${S.sangue(p).toFixed(1)}§r | età §f${S.ETA[S.livello(p)]}§r (xp ${U.get(p, 'xp', 0)}) | ` +
        `umanità ${S.umanita(p) ? 'accesa' : 'spenta'} | squartatore ${S.squartatore(p) ? 'sì' : 'no'} | verbena ${U.fmtTempo(U.get(p, 'verbena', 0))} | ` +
        `sole ${S.sottoIlSole(p) ? 'sì' : 'no'} | anello ${S.haAnello(p) ? 'sì' : 'no'}`);
      break;
    }
    case 'vamp:vampiro': S.diventaVampiro(p, false); break;
    case 'vamp:originale': S.diventaVampiro(p, true); break;
    case 'vamp:umano': S.tornaUmano(p, '§7[Prova] Sei di nuovo umano.'); break;
    case 'vamp:sangue': S.setSangue(p, isFinite(n) ? n : 20); break;
    case 'vamp:eta': U.set(p, 'eta_liv', isFinite(n) ? Math.max(1, Math.min(5, n)) : 1); break;   // 1 Neonato ... 5 Millenario
    case 'vamp:potere': B.attivaPerNome(p, String(ev.message || '').trim()); break;
    case 'vamp:barra': B.apri(p, ev.message !== 'pannello'); break;
    case 'vamp:varco': Var.usa(p); break;
    case 'vamp:villaggi': {
      const off = /off|no|spegni/i.test(ev.message || '');
      U.wSet('villaggi_spenti', off);
      U.tell(p, off ? '§6[Villaggi]§r Generazione dei villaggi §cspenta§r.' : '§6[Villaggi]§r Generazione dei villaggi §aaccesa§r.');
      break;
    }
    case 'vamp:tutorial': Tut.avvia(p, true); break;
    case 'vamp:cacciatore': if (!C.diventaCacciatore(p)) U.tell(p, '§7[Prova] Un vampiro (o chi è in transizione) non può giurare.'); break;
    case 'vamp:caccia': C.attivaPerNome(p, String(ev.message || '').trim()); break;
    case 'vamp:prede': U.set(p, 'cacce', isFinite(n) ? Math.max(0, n) : 0); break;
    case 'vamp:santa': { const d = U.norm2d(p.getViewDirection()); Santa.esplodi(p.dimension, U.add(p.location, U.v3(d.x * 8, 0, d.z * 8)), p); break; }
    case 'vamp:villaggio': Vil.provaVillaggio(p, String(ev.message || 'umano').trim()); break;
    case 'vamp:quercia': {   // 4 ghiande in 2x2 dove sei, poi cresce
      const f = U.floor(p.location);
      for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const b = U.blk(p.dimension, U.v3(f.x + dx, f.y, f.z + dz)); try { b.setType(U.I('ghianda_pianta')); } catch {} }
      M.cresciQuercia(p.dimension, f); break;
    }
  }
}));
