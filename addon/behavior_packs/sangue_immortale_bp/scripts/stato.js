// Sangue Immortale — stato del giocatore: umano, sangue di vampiro in corpo, transizione, vampiro, Originale.
// Lore delle serie TV sui vampiri:
//  - si diventa vampiri morendo con sangue di vampiro in corpo; poi la transizione: bisogna bere sangue umano
//    entro circa un giorno, altrimenti si muore;
//  - il vampiro si nutre di sangue, brucia al sole senza anello diurno, la verbena lo indebolisce, il paletto lo uccide;
//  - più è vecchio più è forte; spegnere l'umanità lo rende più feroce; gli Originali non muoiono al sole.
import { world, system } from '@minecraft/server';
import * as U from './util.js';
import { car } from './glifi.js';

export const ETA = ['', 'Neonato', 'Giovane', 'Adulto', 'Antico', 'Millenario', 'Originale'];
// L'ETÀ (dalla 1.3.0) non cresce più da sola: sale di un gradino con il RITO DELLA STIRPE all'altare
// (a mezzanotte, sangue di cacciatore, vicino a una quercia bianca). Le soglie servono solo a convertire i mondi vecchi.
const SOGLIE = [0, 40, 120, 300, 700];
export const SANGUE_MAX = 20;
// collegamenti messi da main.js (evitano import circolari): poteri, pipistrello, seguito
export const ganci = { vampiro: [], umano: [], seguito: () => 0 };

// effetti passivi per età (amplificatore, -1 = niente): forza, velocità, salto, resistenza, rigenerazione
const PASSIVI = {
  1: { forza: 0, vel: 0, salto: -1, res: -1, rig: 0 },
  2: { forza: 0, vel: 0, salto: 0, res: -1, rig: 0 },
  3: { forza: 1, vel: 1, salto: 0, res: 0, rig: 0 },
  4: { forza: 1, vel: 1, salto: 1, res: 0, rig: 1 },
  5: { forza: 2, vel: 1, salto: 1, res: 1, rig: 1 },
  6: { forza: 3, vel: 2, salto: 1, res: 1, rig: 1 },
};

// ---------------------------------------------------------------- lettura dello stato
export const eVampiro = (p) => U.get(p, 'stato', 'umano') === 'vampiro';
export const eOriginale = (p) => eVampiro(p) && !!U.get(p, 'originale', false);
export const inTransizione = (p) => U.get(p, 'transizione', 0) > 0;
export const sangue = (p) => U.get(p, 'sangue', 0);
export const umanita = (p) => U.get(p, 'umanita', true);
export const squartatore = (p) => !!U.get(p, 'squartatore', false);
export const bloccato = (p) => U.get(p, 'bloccato', 0) > 0;
export const verbenaInCorpo = (p) => U.get(p, 'verbena', 0) > 0;
function livelloDaXp(xp) {
  let l = 1;
  for (let i = 0; i < SOGLIE.length; i++) if (xp >= SOGLIE[i]) l = i + 1;
  return l;
}
export function livello(p) {
  if (U.get(p, 'originale', false)) return 6;
  let l = U.get(p, 'eta_liv', undefined);
  if (l === undefined) { l = livelloDaXp(U.get(p, 'xp', 0)); U.set(p, 'eta_liv', l); }   // mondi delle versioni vecchie
  return Math.max(1, Math.min(5, l));
}
const NUOVI = { 2: 'Interruttore dell\'umanità', 3: 'Allucinazioni e Spezzare il collo', 4: 'Strappare il cuore' };
/** rito della stirpe compiuto: l'età sale di un gradino (Neonato -> Giovane -> Adulto -> Antico -> Millenario) */
export function cresci(p) {
  if (!eVampiro(p) || eOriginale(p)) return false;
  const prima = livello(p);
  if (prima >= 5) return false;
  U.set(p, 'eta_liv', prima + 1);
  U.titolo(p, '§4' + ETA[prima + 1], '§7Il sangue dei cacciatori ti ha reso più antico.');
  U.suonoP(p, 'random.levelup', 1, 0.6);
  if (NUOVI[prima + 1]) U.tell(p, `§4[Vampiro]§r Nuovo potere: §c${NUOVI[prima + 1]}§r (accovacciati due volte per la colonna dei poteri).`);
  return true;
}
export function setSangue(p, v) { U.set(p, 'sangue', Math.max(0, Math.min(SANGUE_MAX, v))); }

/** esperienza (solo un contatore: l'età ora sale col rito della stirpe) */
export function aggiungiXp(p, n) { livello(p); U.set(p, 'xp', U.get(p, 'xp', 0) + n); }

// ---------------------------------------------------------------- passaggi di stato

export function diventaVampiro(p, originale = false) {
  U.set(p, 'stato', 'vampiro');
  U.set(p, 'originale', originale);
  U.set(p, 'transizione', 0);
  U.set(p, 'sangue_corpo', 0);
  U.set(p, 'umanita', true);
  U.set(p, 'squartatore', false);
  U.set(p, 'uccisioni', 0);
  U.set(p, 'senza_sangue', 0);
  U.set(p, 'giorno', U.giornoAssoluto());
  if (U.get(p, 'xp', undefined) === undefined) U.set(p, 'xp', 0);
  livello(p);
  setSangue(p, 14);
  try { p.addTag('vamp_vampiro'); } catch {}
  for (const f of ganci.vampiro) U.guard(() => f(p));
  U.curaTutto(p);
  U.lampo(p, 0.6, 0, 0.05, 0.2, 0.6, 1.2);
  U.suonoP(p, 'mob.warden.heartbeat', 1, 0.5);
  U.suonoP(p, 'mob.wither.spawn', 0.4, 1.6);
  for (let i = 0; i < 16; i++) U.fx(p.dimension, 'vamp:sangue', U.add(p.location, U.v3(Math.cos(i) * 0.6, 1 + i * 0.05, Math.sin(i) * 0.6)));
  if (originale) {
    U.titolo(p, '§6§lORIGINALE', '§7Il primo sangue. Solo la quercia bianca può ucciderti.');
    U.tell(p, '§6[Originale]§r Il sole non può ucciderti, sei al massimo della forza e più vampiri hai nel tuo seguito, più diventi forte. I tuoi seguaci possono arrivare a Millenario. La verbena ti brucia ancora.');
  } else {
    U.titolo(p, '§4§lVAMPIRO', '§7La transizione è completa.');
    U.tell(p, '§4[Vampiro]§r Tocca l\'§cIstinto del vampiro§r: si apre la §cruota delle abilità§r. L\'abilità che scegli compare accanto all\'Istinto: ' +
      'toccala per usarla. Per bere scegli il §cMorso§r e avvicinati a un umano. Il sole ti brucia: ti serve un §eAnello diurno§r.');
  }
}

export function tornaUmano(p, motivo) {
  U.set(p, 'stato', 'umano');
  U.set(p, 'originale', false);
  U.set(p, 'transizione', 0);
  U.set(p, 'squartatore', false);
  U.set(p, 'sensi', false);
  U.set(p, 'veloce', false);
  for (const f of ganci.umano) U.guard(() => f(p));
  try { p.removeTag('vamp_vampiro'); } catch {}
  for (const e of ['strength', 'speed', 'jump_boost', 'resistance', 'regeneration', 'water_breathing', 'night_vision', 'saturation', 'health_boost'])
    U.togliEff(p, e);
  U.dimenticaInf(p);
  if (motivo) U.tell(p, motivo);
}

export function iniziaTransizione(p, originale) {
  U.set(p, 'transizione', U.GIORNO);
  U.set(p, 'trans_originale', !!originale);
  U.set(p, 'sangue_corpo', 0);
  U.set(p, 'rito', 0);
  U.titolo(p, originale ? '§6Rinasci...' : '§4Ti svegli...', '§7Sei in transizione: bevi §csangue umano§7 entro un giorno.');
  U.tell(p, '§4[Transizione]§r Sei morto con ' + (originale ? 'il vino dell\'immortalità' : 'sangue di vampiro') +
    ' in corpo. Hai §eun giorno di gioco§r per bere §csangue umano§r: colpisci a mano vuota un abitante, ' +
    'oppure bevi una sacca di sangue. Se non lo fai, morirai davvero.');
  U.suonoP(p, 'mob.warden.heartbeat', 1, 0.8);
}

// ---------------------------------------------------------------- morte e rinascita
// motivo della morte "vera" impostato da chi uccide (sole, paletto, cuore, fuoco)
const morteVera = new Map();
export function segnaMorteVera(p, motivo) { morteVera.set(p.id, { motivo, tick: system.currentTick }); }
// ultimo tick in cui il sole ha bruciato il giocatore (il fuoco del sole non va raddoppiato)
const ultimoSole = new Map();
export const bruciaAlSole = (p) => system.currentTick - (ultimoSole.get(p.id) ?? -1e9) <= 30;

const NEMICI_VERI = { fire: 'il fuoco', fireTick: 'il fuoco', lava: 'la lava', soulCampfire: 'il fuoco', campfire: 'il fuoco' };
export function allaMorte(p, ds) {
  const st = U.get(p, 'stato', 'umano');
  if (U.get(p, 'rinascita', '') === 'umano_transizione') return;   // transizione scaduta (già deciso)
  if (inTransizione(p)) { U.set(p, 'rinascita', 'umano_transizione'); return; }
  if (st !== 'vampiro') {
    if (U.get(p, 'rito', 0) > 0) U.set(p, 'rinascita', 'originale');
    else if (U.get(p, 'sangue_corpo', 0) > 0) U.set(p, 'rinascita', 'vampiro');
    else U.set(p, 'rinascita', '');
    return;
  }
  const m = morteVera.get(p.id);
  let vero = m && system.currentTick - m.tick < 40 ? m.motivo : '';
  const orig = eOriginale(p);
  if (!vero && ds) {
    const arma = (() => { try { return U.mano(ds.damagingEntity)?.typeId; } catch { return undefined; } })();
    if (U.eQuercia(arma)) vero = 'un paletto di quercia bianca nel cuore';
    else if (!orig && U.ePaletto(arma)) vero = 'un paletto nel cuore';
    else if (!orig && NEMICI_VERI[ds.cause]) vero = NEMICI_VERI[ds.cause];
  }
  if (orig && vero && !/quercia|Cura/.test(vero)) vero = '';  // un Originale muore solo per la quercia bianca (o la luce della Santa Bomba)
  U.set(p, 'rinascita', vero ? 'morto:' + vero : 'risveglio');
  morteVera.delete(p.id);
}

export function allaRinascita(p) {
  const r = U.get(p, 'rinascita', '');
  U.set(p, 'rinascita', '');
  if (r === 'vampiro') iniziaTransizione(p, false);
  else if (r === 'originale') iniziaTransizione(p, true);
  else if (r === 'umano_transizione') {
    U.set(p, 'transizione', 0);
    U.tell(p, '§7[Transizione] Sei morto durante la transizione: il sangue di vampiro è svanito. Sei di nuovo umano.');
  } else if (r === 'risveglio') {
    setSangue(p, Math.max(sangue(p), 8));
    U.tell(p, '§4[Vampiro]§r Ti risvegli con un sussulto: un vampiro non muore così facilmente. Hai sete.');
    U.suonoP(p, 'mob.warden.heartbeat', 1, 0.6);
  } else if (r.startsWith('morto:')) {
    tornaUmano(p, `§7[Vampiro] §cSei morto davvero§7: ${r.slice(6)}. Rinasci come umano.`);
  }
  if (eVampiro(p)) { try { p.addTag('vamp_vampiro'); } catch {} }
}

// ---------------------------------------------------------------- tick per giocatore (ogni secondo)
let meteo = 'Clear';
export function setMeteo(m) { meteo = String(m); U.wSet('meteo', meteo); }
export function caricaMeteo() { meteo = U.wGet('meteo', 'Clear'); }

function scala(p, k, passo) { const v = U.get(p, k, 0); if (v > 0) U.set(p, k, Math.max(0, v - passo)); return v; }

/** true se il giocatore è sotto il sole che brucia */
export function sottoIlSole(p) {
  if (p.dimension.id !== 'minecraft:overworld') return false;
  if (!U.eGiorno()) return false;
  if (meteo !== 'Clear') return false;
  return U.cieloAperto(p.dimension, p.location);
}

export function haAnello(p) { return U.ha(p, U.I('anello_diurno')); }
/** Medaglione del cacciatore: in tasca (o nella mano secondaria) la maledizione del cacciatore non ha effetto */
export function haMedaglione(p) { return U.ha(p, U.I('medaglione')); }

// Gli effetti positivi sono INFINITI (richiesta di Jowa, 24/11/2026): si mettono con durata infinita e si cambiano
// solo quando cambia il livello (età, fame, verbena, seguito, corsa). Se il latte li toglie, tornano da soli.
function effettiPassivi(p, lv, s) {
  const base = PASSIVI[lv], orig = lv === 6;
  let forza = base.forza, vel = base.vel, salto = base.salto, res = base.res, vita = -1;
  if (U.get(p, 'dieta', 0) >= 3 && !orig) { forza -= 1; res -= 1; }  // dieta animale: più deboli
  if (!umanita(p)) forza += 1;
  if (squartatore(p)) forza += 1;
  if (s < 4 && !orig) { forza = -1; vel -= 1; salto = -1; }           // affamato (l'Originale non ha bisogno di sangue per la sua forza)
  if (bloccato(p)) { forza = -1; vel = -1; salto = -1; res = -1; }    // verbena in corpo
  velBase.set(p.id, vel);
  if (staCorrendo(p)) vel = lv >= 6 ? 6 : 4;                          // super velocità mentre corri
  // seguito dell'Originale: più vampiri lo seguono, più è forte
  if (orig) {
    const n = ganci.seguito(p);
    if (n > 0) { forza += Math.min(3, Math.floor(n / 2)); if (n >= 3) res = Math.max(res, 2); vita = Math.min(4, Math.floor(n / 2)); }
    U.set(p, 'n_seguito', n);
  }
  U.effInf(p, 'strength', forza);
  U.effInf(p, 'speed', vel);
  U.effInf(p, 'jump_boost', salto);
  U.effInf(p, 'resistance', res);
  U.effInf(p, 'health_boost', vita);
  U.effInf(p, 'water_breathing', 0);                                  // i vampiri non respirano
  U.eff(p, 'saturation', 2, 0);                                       // la fame normale resta piena
  const h = U.salute(p);
  const guarisce = h.ora < h.max && (s >= 4 || orig) && !bloccato(p);
  U.effInf(p, 'regeneration', guarisce ? base.rig : -1);
  return guarisce && !orig;                                           // guarire costa sangue, non all'Originale
}

// ---------------------------------------------------------------- super velocità: sempre pronta, parte quando CORRI
// (sul telefono: doppio tocco in avanti sulla levetta, o il pulsante di corsa). Consuma un po' di sangue, non all'Originale.
const corre = new Map();                            // id -> sta usando la super velocità
const velBase = new Map();                          // id -> amplificatore della velocità normale (-1 = niente)
export const staCorrendo = (p) => !!corre.get(p.id);
export function tickCorsa(p) {
  if (!eVampiro(p)) { corre.delete(p.id); return; }
  const puo = !bloccato(p) && (eOriginale(p) || sangue(p) >= 1) && !U.get(p, 'in_pipistrello', false);
  const si = !!p.isSprinting && puo, prima = staCorrendo(p);
  if (si) {
    if (!prima) {
      for (let i = 0; i < 3; i++) U.fx(p.dimension, 'vamp:fumo_nero', U.add(p.location, U.v3(0, 0.5 + i * 0.5, 0)));
      U.suono(p.dimension, 'mob.phantom.swoop', p.location, 0.7, 1.5);
    }
    U.effInf(p, 'speed', livello(p) >= 6 ? 6 : 4);
    if (system.currentTick % 4 === 0) U.fx(p.dimension, 'vamp:scia_nera', p.location);
  } else if (prima) U.effInf(p, 'speed', velBase.get(p.id) ?? -1);
  corre.set(p.id, si);
}

function hud(p, lv, s, sole, protetto) {
  const piene = Math.floor(s / 2), meta = s % 2 >= 1 ? 1 : 0;
  let gocce = '';
  for (let i = 0; i < 10; i++) gocce += i < piene ? car('goccia_piena') : (i === piene && meta ? car('goccia_meta') : car('goccia_vuota'));
  let icone = '';
  if (protetto) icone += ' §e' + car('anello');                       // l'anello si vede sempre quando lo porti
  else if (sole) icone += ' ' + car('sole');
  if (bloccato(p)) icone += ' ' + car('verbena');
  if (!umanita(p)) icone += ' ' + car('umanita_off');
  if (U.get(p, 'maledizione', 0) > 0 && !haMedaglione(p)) icone += ' ' + car('teschio');
  const n = U.get(p, 'n_seguito', 0);
  const nome = squartatore(p) ? '§4Squartatore' : (lv === 6 ? '§6Originale' + (n ? ' §7seguito ' + n : '') : '§7' + ETA[lv]);
  U.bar(p, `§r${gocce}§r${icone} ${nome}`);
}

const VIVI = /^minecraft:(villager_v2|villager|wandering_trader|pillager|vindicator|evoker|witch|player|cow|pig|sheep|chicken|horse|goat|llama|rabbit|fox|wolf|cat|camel|donkey|mule|panda|mooshroom|armadillo|sniffer)$|^vamp:cacciatore/;

export function tickVampiro(p, passo) {
  const lv = livello(p);
  let s = sangue(p);
  // ---- sete
  let consumo = 1 / 40;
  if (lv >= 4) consumo *= 0.75;
  if (!umanita(p)) consumo *= 1.5;
  if (squartatore(p)) consumo *= 1.5;
  // i poteri costano sangue, ma non a un Originale
  if (U.get(p, 'sensi', false) && !eOriginale(p)) consumo += 1 / 120;
  if (staCorrendo(p) && !eOriginale(p)) consumo += 1 / 15;
  scala(p, 'bloccato', passo);
  const guarisce = effettiPassivi(p, lv, s);
  if (guarisce) consumo += 1 / 10;
  s = Math.max(0, s - consumo * (passo / 20));
  setSangue(p, s);
  // ---- essiccazione (lore: un vampiro senza sangue si rinsecchisce)
  if (s <= 0) {
    const ss = U.get(p, 'senza_sangue', 0) + passo / 20;
    U.set(p, 'senza_sangue', ss);
    if (ss > 30) { U.eff(p, 'weakness', 50, 0); U.eff(p, 'slowness', 50, 0); }
    if (ss > 120) {
      U.eff(p, 'slowness', 50, 3); U.eff(p, 'weakness', 50, 2); U.eff(p, 'mining_fatigue', 50, 2); U.eff(p, 'darkness', 60, 0);
      if (U.pronto(p, 400, 'essicca')) U.tell(p, '§8[Vampiro] Ti stai §7essiccando§8: la pelle diventa grigia, ti muovi a fatica. Bevi sangue!');
    }
  } else U.set(p, 'senza_sangue', 0);
  // ---- sole
  const sole = sottoIlSole(p), protetto = haAnello(p);
  if (sole && !protetto) {
    if (eOriginale(p)) {
      U.eff(p, 'weakness', 50, 1); U.eff(p, 'slowness', 50, 0);
      if (U.pronto(p, 200, 'sole')) U.tell(p, '§6[Originale]§r Il sole non può ucciderti, ma ti indebolisce. Indossa l\'Anello diurno.');
    } else {
      segnaMorteVera(p, 'bruciato dal sole');
      ultimoSole.set(p.id, system.currentTick);
      try { p.setOnFire(2, true); } catch {}
      U.danno(p, 2, 'fire');
      U.lampo(p, 1, 0.55, 0.1, 0.05, 0.1, 0.35);
      U.fx(p.dimension, 'vamp:fumo_nero', U.add(p.location, U.v3(0, 1, 0)));
      if (U.pronto(p, 100, 'sole')) U.tell(p, '§6[Vampiro] §cIl sole ti brucia!§r Corri all\'ombra o porta con te un §eAnello diurno§r.');
    }
  }
  // ---- verbena in mano: brucia
  const mani = [U.mano(p)?.typeId, U.manoSinistra(p)?.typeId];
  if (mani.includes(U.I('verbena'))) {
    U.danno(p, 1, 'magic');
    U.eff(p, 'weakness', 60, 0);
    if (U.pronto(p, 60, 'verbena_mano')) U.tell(p, '§d[Verbena]§r Ti brucia la pelle: posala!');
  }
  // ---- età: ogni nuovo giorno vissuto da vampiro
  const g = U.giornoAssoluto(), g0 = U.get(p, 'giorno', g);
  if (g > g0) { U.set(p, 'giorno', g); aggiungiXp(p, 2 * (g - g0)); }
  // ---- sensi: battiti delle creature vicine (particelle visibili solo a te)
  if (U.get(p, 'sensi', false)) {
    U.effInf(p, 'night_vision', 0);
    let n = 0;
    for (const e of U.vicini(p.dimension, p.location, 20)) {
      if (e.id === p.id || !VIVI.test(e.typeId)) continue;
      if (e.typeId === 'minecraft:player' && e.hasTag('vamp_vampiro')) continue;
      n++;
      U.fxP(p, 'vamp:battito', U.add(e.location, U.v3(0, 2.1, 0)));
    }
    if (n && U.pronto(p, 60, 'battito')) U.suonoP(p, 'mob.warden.heartbeat', 0.4, 1.3);
  }
  // ---- sete di sangue: con poco sangue senti gli umani vicini
  if (s < 5 && U.pronto(p, 120, 'sete')) {
    const preda = U.vicini(p.dimension, p.location, 8).find((e) => /villager|wandering_trader/.test(e.typeId));
    if (preda) { U.suonoP(p, 'mob.warden.heartbeat', 0.7, 1.1); U.lampo(p, 0.4, 0, 0, 0.1, 0.1, 0.4); U.barForte(p, '§4Senti il loro sangue...', 40); }
  }
  if (!U.hudZitto(p)) hud(p, lv, s, sole, protetto);
}

export function tickTransizione(p, passo) {
  const r = scala(p, 'transizione', passo) - passo;
  U.eff(p, 'night_vision', 300, 0);
  if (U.pronto(p, 60, 'battito')) U.suonoP(p, 'mob.warden.heartbeat', 0.8, 0.9);
  if (Math.random() < 0.08) U.eff(p, 'nausea', 100, 0);
  if (sottoIlSole(p) && U.pronto(p, 100, 'luce')) { U.eff(p, 'weakness', 120, 0); U.bar(p, '§eLa luce ti ferisce gli occhi...'); }
  if (r <= 0) {
    U.set(p, 'transizione', 0);
    segnaMorteVera(p, 'transizione non completata');
    U.tell(p, '§4[Transizione]§r Non hai bevuto sangue umano in tempo.');
    U.set(p, 'rinascita', 'umano_transizione');
    try { p.kill(); } catch {}
    return;
  }
  U.bar(p, `§4${car('cuore_battito')} Transizione: bevi sangue umano §f${U.fmtTempo(r)}`);
}

export function tickUmano(p, passo) {
  const sc = scala(p, 'sangue_corpo', passo), vb = scala(p, 'verbena', passo), rito = scala(p, 'rito', passo);
  if (rito > 0) {
    U.bar(p, `§6Il rito è compiuto: muori entro §f${U.fmtTempo(rito - passo)}§6 per rinascere Originale`);
    if (rito - passo <= 0) U.tell(p, '§6[Rito]§r Il tempo è passato: il vino dell\'immortalità ha perso il suo potere.');
  } else if (sc > 0) {
    U.bar(p, `§4${car('goccia_piena')} §7Sangue di vampiro in corpo: §f${U.fmtTempo(sc - passo)}`);
    if (sc - passo <= 0) U.tell(p, '§7Il sangue di vampiro ha lasciato il tuo corpo.');
  } else if (vb > 0 && U.get(p, 'classe', '') !== 'cacciatore' && U.pronto(p, 100, 'hud_vb')) {   // il cacciatore la vede tra i suoi simboli
    U.bar(p, `§d${car('verbena')} Verbena nel sangue: §f${U.fmtTempo(vb - passo)}`);
  }
}

// ---------------------------------------------------------------- maledizione del cacciatore (allucinazioni)
const FRASI = ['«Non puoi nasconderti, vampiro.»', '«Ti ho visto. Ti vedo ancora.»', '«Il sangue che hai versato ti chiama.»',
  '«Arrenditi. Finiscila.»', '«Mi senti? Sono sempre qui.»'];
export function tickMaledizione(p, passo) {
  const m = scala(p, 'maledizione', passo);
  if (m <= 0) return;
  if (m - passo <= 0) { U.tell(p, '§7[Maledizione] Le visioni del cacciatore svaniscono. Sei di nuovo padrone della tua mente.'); return; }
  if (haMedaglione(p)) return;                                       // il medaglione tiene lontane le visioni
  if (Math.random() < 0.05) {
    const tipo = Math.floor(Math.random() * 4);
    if (tipo === 0) { U.eff(p, 'nausea', 160, 0); U.titolo(p, '', '§4' + FRASI[Math.floor(Math.random() * FRASI.length)]); }
    if (tipo === 1) { U.eff(p, 'darkness', 100, 0); U.suonoP(p, 'mob.warden.nearby_close', 0.8, 0.8); }
    if (tipo === 2) {
      const d = p.getViewDirection(), loc = U.add(p.location, U.v3(d.x * 4, 0.5, d.z * 4));
      for (let i = 0; i < 4; i++) U.fxP(p, 'vamp:fumo_nero', U.add(loc, U.v3(0, i * 0.5, 0)));
      U.suonoP(p, 'mob.evocation_illager.prepare_attack', 0.6, 0.7);
      U.bar(p, '§8Il cacciatore è lì... poi non c\'è più.');
    }
    if (tipo === 3) { U.eff(p, 'weakness', 200, 0); U.lampo(p, 0.1, 0, 0, 0.3, 0.4, 0.8); }
  }
}

// ---------------------------------------------------------------- OCCHI ROSSI (richiesta di Jowa, 24/11/2026)
// Ogni vampiro (normale e Originale) ha gli occhi rossi accesi: due puntini rossi luminosi davanti agli occhi
// del personaggio. Li vedono gli ALTRI giocatori (a te non compaiono davanti allo schermo in prima persona).
export function tickOcchi() {
  const tutti = world.getPlayers();
  if (tutti.length < 2) return;
  for (const p of tutti) {
    if (!eVampiro(p) || U.get(p, 'in_pipistrello', false)) continue;
    let h;
    try { h = p.getHeadLocation(); } catch { continue; }
    const d = p.getViewDirection(), r = U.norm2d(U.v3(-d.z, 0, d.x));
    const avanti = U.add(h, U.v3(d.x * 0.27, d.y * 0.27 + 0.02, d.z * 0.27));
    const occhi = [U.add(avanti, U.mul(r, 0.095)), U.add(avanti, U.mul(r, -0.095))];
    for (const q of tutti) {
      if (q.id === p.id || q.dimension.id !== p.dimension.id || U.dist(q.location, p.location) > 32) continue;
      for (const o of occhi) U.fxP(q, 'vamp:occhio', o);
    }
  }
}
