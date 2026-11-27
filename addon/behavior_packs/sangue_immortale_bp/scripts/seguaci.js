// Sangue Immortale — il SEGUITO: i vampiri soggiogati ("Unisciti al mio seguito") o nati dal tuo sangue.
//   - nei primi 10 minuti un altro vampiro può soggiogarli e portarteli via; dopo diventano LEALI soltanto a te;
//   - puoi nutrirli con la Sacca di sangue umano (accovacciato + colpo): fino a 10 calici, ognuno li rende più forti;
//   - col tempo crescono di grado: Neonato, Giovane (10 min), Adulto (20), Antico (40) e, solo se il padrone è un
//     Originale, Millenario (80 min);
//   - avvicinati e TOCCALO (pulsante "Ordini"): Seguimi / Resta fermo qui / Seduto (riposo) / Neutrale / Aggressivo / Anello diurno;
//   - ACCOVACCIATO + TOCCO: si siede o si alza, come i lupi. Seduto sta fermo e non fa nulla (non segue, non attacca).
import { world, system } from '@minecraft/server';
import { ActionFormData } from '@minecraft/server-ui';
import * as U from './util.js';
import * as S from './stato.js';

export const LEALE_DOPO = 20 * 60 * 10;               // 10 minuti
export const MAX_CALICI = 10;
const GRADI = ['', 'Neonato', 'Giovane', 'Adulto', 'Antico', 'Millenario'];
const MINUTI = [0, 0, 10, 20, 40, 80];
const VAMP = /^vamp:(vampiro|squartatore)$/;
const ora = () => { try { return world.getAbsoluteTime(); } catch { return 0; } };
/** è un vampiro del seguito di p? */
export const eMio = (p, v) => VAMP.test(v?.typeId ?? '') && !!U.prop(v, 'vamp:alleato', false) && padrone(v) === p.id;

export const padrone = (v) => U.get(v, 'padrone', '');
const tempo = (v) => U.get(v, 'tempo_seguito', 0);
export const leale = (v) => !!padrone(v) && tempo(v) >= LEALE_DOPO;
const padroneOriginale = (v) => {
  const p = world.getPlayers().find((q) => q.id === padrone(v));
  return p ? S.eOriginale(p) : !!U.get(v, 'padrone_originale', false);
};
export function grado(v) {
  const min = tempo(v) / 1200;
  const max = padroneOriginale(v) ? 5 : 4;
  let g = 1;
  for (let i = 1; i <= max; i++) if (min >= MINUTI[i]) g = i;
  return g;
}

/** può p prendere v nel suo seguito? (testo dell'errore oppure '') */
export function puoPrendere(p, v) {
  const pad = padrone(v);
  if (!pad || pad === p.id) return '';
  if (leale(v)) return `È leale soltanto a ${U.get(v, 'padrone_nome', 'un altro vampiro')}: nessuno può più soggiogarlo.`;
  return '';
}

/** registra il nuovo seguace (chiamato da rendiAlleato) */
export function nuovoSeguace(v, p) {
  const cambio = padrone(v) !== (p?.id ?? '');
  if (cambio) { U.set(v, 'tempo_seguito', 0); U.set(v, 'calici', 0); U.set(v, 'avvisato', false); U.set(v, 'grado', 1); }
  U.set(v, 'ordini', 1); U.set(v, 'mov', 'segui'); U.set(v, 'att', 'aggressivo');   // l'evento diventa_alleato mette già questi gruppi
  if (p) { U.set(v, 'padrone_nome', p.name); U.set(v, 'padrone_originale', S.eOriginale(p)); }
}

/** accovacciato + colpo con la Sacca di sangue umano sul tuo seguace: un calice di sangue */
export function nutri(p, v) {
  if (!VAMP.test(v.typeId) || !U.prop(v, 'vamp:alleato', false)) return false;
  if (padrone(v) !== p.id) { U.barForte(p, '§7Non è nel tuo seguito.'); return true; }
  const c = U.get(v, 'calici', 0);
  if (c >= MAX_CALICI) { U.barForte(p, `§7Ha già bevuto ${MAX_CALICI} calici: più forte di così non può diventare.`); return true; }
  U.consumaMano(p);
  U.dai(p, U.I('sacca_vuota'));
  U.set(v, 'calici', c + 1);
  U.curaTutto(v);
  U.fx(v.dimension, 'vamp:sangue', U.add(v.location, U.v3(0, 1.6, 0)));
  U.fx(v.dimension, 'vamp:rito', U.add(v.location, U.v3(0, 1, 0)));
  U.suono(v.dimension, 'random.drink', v.location, 1, 0.8);
  aggiorna(v);
  U.barForte(p, `§4Calice di sangue §f${c + 1}/${MAX_CALICI}§4: il tuo seguace è più forte.`, 60);
  return true;
}

/** effetti e nome del seguace secondo grado e calici */
export function aggiorna(v) {
  const g = grado(v), c = U.get(v, 'calici', 0);
  const forza = Math.floor((g - 1) / 2) + Math.floor(c / 4);           // fino a forza IV (Millenario + 10 calici)
  const res = (g >= 4 ? 1 : 0) + (c >= 8 ? 1 : 0);
  const vita = Math.floor(c / 2) + (g >= 5 ? 2 : 0);                   // fino a +14 cuori
  // effetti INFINITI (cambiano solo quando cresce di grado o beve un calice)
  U.effInf(v, 'strength', forza - 1);
  U.effInf(v, 'resistance', res - 1);
  U.effInf(v, 'health_boost', vita - 1);
  U.effInf(v, 'speed', g >= 3 && U.get(v, 'mov', 'segui') === 'segui' ? (g >= 5 ? 1 : 0) : -1);
  const nome = U.get(v, 'padrone_nome', '');
  const mov = U.get(v, 'mov', 'segui'), neutro = U.get(v, 'att', 'aggressivo') === 'neutrale';
  const st = mov === 'seduto' ? ' §7[seduto]' : (mov === 'fermo' ? ' §7[fermo]' : '') + (neutro ? ' §7[neutrale]' : '');
  try { v.nameTag = `§7${GRADI[g]}${leale(v) ? ' §4leale' : ''} §8di ${nome}${c ? ' §c' + c + '♦' : ''}${st}`; } catch {}
}

// ---------------------------------------------------------------- ORDINI (tocca il tuo seguace da vicino)
const evento = (v, n) => { try { v.triggerEvent(U.I(n)); } catch {} };
/** applica gli ordini salvati (usato anche per i seguaci nati con le versioni vecchie) */
function applicaOrdini(v) {
  const mov = U.get(v, 'mov', 'segui'), att = U.get(v, 'att', 'aggressivo');
  if (mov === 'seduto') { evento(v, 'ordine_seduto'); tieniFermo(v); return; }   // seduto: niente segui, niente attacchi
  evento(v, 'ordine_alzati');
  evento(v, mov === 'fermo' ? 'ordine_fermo' : 'ordine_segui');
  evento(v, att === 'neutrale' ? 'ordine_neutrale' : 'ordine_aggressivo');
  if (mov === 'fermo') tieniFermo(v);
  else U.togliEff(v, 'slowness');
}
function tieniFermo(v) {
  const a = U.getJ(v, 'ancora', null);
  if (a && U.dist(a, v.location) > 1.5) { try { v.teleport(a); } catch {} }
  U.eff(v, 'slowness', 140, 255);
}

export function ordini(p, v) {
  if (!VAMP.test(v.typeId) || !U.prop(v, 'vamp:alleato', false)) return false;
  if (padrone(v) !== p.id) { U.barForte(p, `§7Questo vampiro obbedisce a ${U.get(v, 'padrone_nome', 'un altro')}.`); return true; }
  const mov = U.get(v, 'mov', 'segui'), att = U.get(v, 'att', 'aggressivo'), anello = !!U.prop(v, 'vamp:anello', false);
  const voci = [
    [(mov === 'segui' ? '§2» ' : '') + 'Seguimi', () => ordina(p, v, 'segui')],
    [(mov === 'fermo' ? '§2» ' : '') + 'Resta fermo qui', () => ordina(p, v, 'fermo')],
    mov === 'seduto' ? ['§2» §rAlzati §8(torna a seguirti)', () => ordina(p, v, 'alzati')] : ['Seduto §8(riposo: fermo, non fa nulla)', () => ordina(p, v, 'seduto')],
    [(att === 'neutrale' ? '§2» ' : '') + 'Neutrale §8(si difende soltanto)', () => ordina(p, v, 'neutrale')],
    [(att === 'aggressivo' ? '§2» ' : '') + 'Aggressivo §8(attacca i nemici)', () => ordina(p, v, 'aggressivo')],
    anello ? ['§6Togli l\'Anello diurno', () => ordina(p, v, 'togli_anello')] : ['§6Dai un Anello diurno', () => ordina(p, v, 'dai_anello')],
  ];
  const f = new ActionFormData().title('§4Il tuo seguace').body(
    `§7${GRADI[grado(v)]}${leale(v) ? ' §4leale' : ''}§7, calici §c${U.get(v, 'calici', 0)}/${MAX_CALICI}§7.\n` +
    `Anello diurno: ${anello ? '§6sì' : '§cno (brucia al sole)'}§7.\nCosa gli ordini?`);
  for (const [t] of voci) f.button(t);
  const mostra = () => f.show(p).then((r) => {
    if (r.canceled) { if (r.cancelationReason === 'UserBusy') system.runTimeout(mostra, 10); return; }
    U.guard(() => voci[r.selection]?.[1]());
  }).catch(() => {});
  mostra();
  return true;
}

export function ordina(p, v, cosa, zitto = false) {
  if (!U.ok(v)) return;
  const barForte = zitto ? () => {} : U.barForte;
  switch (cosa) {
    case 'segui': U.set(v, 'mov', 'segui'); barForte(p, '§4Il tuo seguace ti segue.'); break;
    case 'seduto':
      U.set(v, 'mov', 'seduto'); U.setJ(v, 'ancora', { x: v.location.x, y: v.location.y, z: v.location.z });
      barForte(p, '§4Il tuo seguace si siede: §7resta fermo e non fa nulla.'); break;
    case 'alzati': U.set(v, 'mov', 'segui'); barForte(p, '§4Il tuo seguace si alza e ti segue.'); break;
    case 'fermo':
      U.set(v, 'mov', 'fermo'); U.setJ(v, 'ancora', { x: v.location.x, y: v.location.y, z: v.location.z });
      barForte(p, '§4Il tuo seguace resta fermo qui.'); break;
    case 'neutrale': U.set(v, 'att', 'neutrale'); barForte(p, '§4Neutrale: §7attacca solo chi colpisce te o lui.'); break;
    case 'aggressivo': U.set(v, 'att', 'aggressivo'); if (U.get(v, 'mov', 'segui') === 'seduto') U.set(v, 'mov', 'segui'); /* per attaccare si alza */ barForte(p, '§4Aggressivo: §7attacca mostri e cacciatori vicini.'); break;
    case 'dai_anello': {
      const c = U.inv(p);
      let i = -1;
      if (c) for (let k = 0; k < c.size && i < 0; k++) if (c.getItem(k)?.typeId === U.I('anello_diurno')) i = k;
      if (i >= 0) { const s = c.getItem(i); if (s.amount > 1) { s.amount -= 1; c.setItem(i, s); } else c.setItem(i, undefined); }
      else if (U.manoSinistra(p)?.typeId === U.I('anello_diurno')) { try { U.equip(p).setEquipment('Offhand', undefined); } catch {} }
      else { barForte(p, '§7Non hai un §6Anello diurno§7 da dargli.'); return; }
      evento(v, 'metti_anello');
      U.fx(v.dimension, 'vamp:sole', U.add(v.location, U.v3(0, 1.2, 0)));
      barForte(p, '§6Gli hai dato l\'Anello diurno: §7ora il sole non lo brucia.');
      break;
    }
    case 'togli_anello':
      evento(v, 'togli_anello');
      U.dai(p, U.I('anello_diurno'));
      barForte(p, '§6Ti riprendi l\'Anello diurno: §7di giorno ora cerca l\'ombra.');
      break;
  }
  applicaOrdini(v);
  aggiorna(v);
  U.suono(v.dimension, 'mob.evocation_illager.prepare_summon', v.location, 0.4, 1.8);
}

/** abilità ORDINI AL SEGUITO (dalla ruota): un ordine a tutti i tuoi seguaci entro 64 blocchi */
export function comandaTutti(p) {
  const miei = U.vicini(p.dimension, p.location, 64).filter((v) => eMio(p, v));
  if (!miei.length) { U.barForte(p, '§7Non hai seguaci vicini.'); return; }
  const voci = [['Seguitemi', 'segui'], ['Fermi qui', 'fermo'], ['Seduti (riposo)', 'seduto'], ['In piedi', 'alzati'],
    ['Neutrali', 'neutrale'], ['Aggressivi: attaccate', 'aggressivo']];
  const f = new ActionFormData().title('§4Ordini al seguito').body(`§7Hai §f${miei.length}§7 seguaci vicini. Cosa ordini a tutti?`);
  for (const [t] of voci) f.button(t);
  const mostra = () => f.show(p).then((r) => {
    if (r.canceled) { if (r.cancelationReason === 'UserBusy') system.runTimeout(mostra, 10); return; }
    const v = voci[r.selection];
    if (!v) return;
    for (const s of miei) U.guard(() => ordina(p, s, v[1], true));
    U.barForte(p, `§4${v[0]}! §7(${miei.length} seguaci)`, 60);
  }).catch(() => {});
  mostra();
}

/** accovacciato + tocco sul tuo seguace: si siede o si alza (come i lupi) */
export function seduto(p, v) {
  if (!VAMP.test(v.typeId) || !U.prop(v, 'vamp:alleato', false)) return false;
  if (padrone(v) !== p.id) { U.barForte(p, `§7Questo vampiro obbedisce a ${U.get(v, 'padrone_nome', 'un altro')}.`); return true; }
  ordina(p, v, U.get(v, 'mov', 'segui') === 'seduto' ? 'alzati' : 'seduto');
  return true;
}

/** ogni 5 secondi: gradi, effetti, avviso di lealtà */
export function tickSeguito() {
  const visti = new Set();
  for (const p of world.getPlayers()) {
    for (const v of U.vicini(p.dimension, p.location, 64)) {
      if (visti.has(v.id) || !VAMP.test(v.typeId) || !U.prop(v, 'vamp:alleato', false)) continue;
      visti.add(v.id);
      if (!U.get(v, 'ordini', 0)) { U.set(v, 'ordini', 1); applicaOrdini(v); }    // seguaci delle versioni vecchie
      else if (/^(fermo|seduto)$/.test(U.get(v, 'mov', 'segui'))) tieniFermo(v);
      U.set(v, 'tempo_seguito', tempo(v) + 100);                         // chiamato ogni 100 tick
      const g0 = U.get(v, 'grado', 1), g = grado(v);
      if (g > g0) {
        U.set(v, 'grado', g);
        const pad = world.getPlayers().find((q) => q.id === padrone(v));
        if (pad) U.barForte(pad, `§4Un tuo seguace è cresciuto: ora è §f${GRADI[g]}§4.`, 60);
      }
      if (leale(v) && !U.get(v, 'avvisato', false)) {
        U.set(v, 'avvisato', true);
        const pad = world.getPlayers().find((q) => q.id === padrone(v));
        if (pad) U.tell(pad, '§4[Seguito]§r Un tuo vampiro ora è §4leale soltanto a te§r: nessun altro può più soggiogarlo.');
      }
      aggiorna(v);
    }
  }
}
