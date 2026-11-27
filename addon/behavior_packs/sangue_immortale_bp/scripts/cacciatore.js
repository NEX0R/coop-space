// Sangue Immortale — CLASSE DEL CACCIATORE DI VAMPIRI (1.5.0, richiesta di Jowa del 26/11/2026).
// Fatta come la classe del vampiro, con le stesse regole d'interfaccia (niente abilità sparse nella hotbar):
//   - si diventa cacciatori con il GIURAMENTO all'Altare: da umano, di NOTTE, con la verbena in corpo, si offre il
//     Sangue di cacciatore. Un vampiro non può giurare; un cacciatore che diventa vampiro perde il giuramento.
//   - il DIARIO DEL CACCIATORE (come l'Istinto): tocco = elenco delle 10 abilità, accovacciato + tocco = pannello a icone.
//     L'abilità scelta compare nello SLOT ACCANTO al Diario e si usa toccandola. Riaprendo si toglie o si cambia.
//   - la DETERMINAZIONE (20 punti, scudi d'argento sopra la hotbar) al posto delle gocce di sangue: le abilità la
//     consumano, torna col tempo e salendo di grado torna più in fretta; ogni vampiro ucciso ne ridà 4.
//   - i GRADI salgono con le prede: Recluta -> Cacciatore -> Veterano -> Maestro (vampiro 1 punto, giocatore vampiro 2,
//     Originale 10). Ogni grado: più danno contro i vampiri, abilità più forti; dal grado Cacciatore la mente
//     resiste al soggiogamento; il Maestro ha Resistenza I sempre.
//   - INCARICHI dal Diario (accovacciato su "Stato e incarichi"): elimina N vampiri / uno Squartatore -> premi.
//   - i cacciatori della mod (NPC) sono alleati: con "Richiamo" accorrono e combattono con te.
import { world, system, ItemStack, ItemLockMode } from '@minecraft/server';
import { ActionFormData } from '@minecraft/server-ui';
import * as U from './util.js';
import * as S from './stato.js';
import { car } from './glifi.js';
import { uccidiVampiro } from './poteri.js';
import { grado as gradoPng } from './villaggi.js';

export const DIARIO = U.I('diario');
export const GRADI = ['', 'Recluta', 'Cacciatore', 'Veterano', 'Maestro'];
const SOGLIE = [0, 0, 5, 15, 40];                       // punti preda per ogni grado
export const DET_MAX = 20;
const VAMP_MOB = /^vamp:(vampiro|squartatore|originale)$/;
const eVampiroQ = (e) => VAMP_MOB.test(e.typeId) || (e.typeId === 'minecraft:player' && S.eVampiro(e));
const eOriginaleQ = (e) => e.typeId === 'vamp:originale' || (e.typeId === 'minecraft:player' && S.eOriginale(e));

// ---------------------------------------------------------------- stato
export const eCacciatore = (p) => U.get(p, 'classe', '') === 'cacciatore';
export const det = (p) => U.get(p, 'det', 0);
export function setDet(p, v) { U.set(p, 'det', Math.max(0, Math.min(DET_MAX, v))); }
export const punti = (p) => U.get(p, 'cacce', 0);
export function grado(p) { const n = punti(p); let g = 1; for (let i = 1; i < SOGLIE.length; i++) if (n >= SOGLIE[i]) g = i; return g; }
export const volonta = (p) => U.get(p, 'volonta', 0) > 0;
/** la mente del cacciatore resiste al soggiogamento (dal grado Cacciatore, o con Volontà di ferro) */
export const menteProtetta = (p) => eCacciatore(p) && (grado(p) >= 2 || volonta(p));

export function diventaCacciatore(p) {
  if (S.eVampiro(p) || S.inTransizione(p)) return false;
  U.set(p, 'classe', 'cacciatore');
  if (U.get(p, 'cacce', undefined) === undefined) U.set(p, 'cacce', 0);
  setDet(p, DET_MAX);
  U.set(p, 'caccia_sel', '');
  try { p.addTag('vamp_cacciatore'); } catch {}
  sistema(p);
  U.titolo(p, '§f§lCACCIATORE DI VAMPIRI', '§7Hai giurato. Da stanotte sono loro a doverti temere.');
  U.suonoP(p, 'beacon.activate', 1, 0.7);
  U.suonoP(p, 'random.anvil_land', 0.5, 0.6);
  U.lampo(p, 0.85, 0.85, 0.95, 0.1, 0.3, 1.0);
  for (let i = 0; i < 12; i++) U.fx(p.dimension, 'vamp:sole', U.add(p.location, U.v3(Math.cos(i) * 0.7, 0.4 + i * 0.12, Math.sin(i) * 0.7)));
  U.tell(p, '§f[Cacciatore]§r Tocca il §fDiario del cacciatore§r: scegli un\'abilità e comparirà §faccanto al Diario§r. ' +
    'Le abilità consumano §fDeterminazione§r (gli scudi sopra la barra). Ogni vampiro che elimini ti fa salire di §fgrado§r.');
  return true;
}
export function perdiClasse(p, motivo) {
  if (!eCacciatore(p)) return;
  U.set(p, 'classe', '');
  U.set(p, 'caccia_sel', '');
  U.set(p, 'volonta', 0); U.set(p, 'fiuto', 0);
  try { p.removeTag('vamp_cacciatore'); } catch {}
  togliTutto(p);
  U.effInf(p, 'resistance', -1);
  if (motivo) U.tell(p, motivo);
}

// ---------------------------------------------------------------- le 10 abilità
// id, costo in determinazione, se serve guardare un mob, nome, funzione
export const ABILITA = [
  ['fiuto', 4, false, 'Fiuto del vampiro', (p) => fiuto(p)],
  ['colpo', 6, false, 'Colpo al cuore', (p) => colpo(p)],
  ['nube', 6, false, 'Nube di verbena', (p) => nube(p)],
  ['trappola', 5, false, 'Trappola di verbena', (p) => trappola(p)],
  ['rete', 4, true, "Rete d'argento", (p, e) => rete(p, e)],
  ['raffica', 6, false, 'Raffica di paletti', (p) => raffica(p)],
  ['schivata', 2, false, 'Schivata', (p) => schivata(p)],
  ['volonta', 5, false, 'Volontà di ferro', (p) => volontaDiFerro(p)],
  ['richiamo', 12, false, 'Richiamo dei cacciatori', (p) => richiamo(p)],
  ['fuoco', 5, true, 'Fuoco purificatore', (p, e) => fuoco(p, e)],
];
export const icona = (n) => `textures/ui/vamp/caccia_${n}`;
const ID = (n) => U.I('caccia_' + n);
export const eAbilita = (id) => typeof id === 'string' && id.startsWith(U.I('caccia_'));
export const scelta = (p) => U.get(p, 'caccia_sel', '');

function oggettoAbilita(n) {
  const s = new ItemStack(ID(n), 1);
  try { s.lockMode = ItemLockMode.slot; } catch {}
  try { s.keepOnDeath = true; } catch {}
  return s;
}
function oggettoDiario() {
  const s = new ItemStack(DIARIO, 1);
  try { s.keepOnDeath = true; } catch {}
  return s;
}

// ---------------------------------------------------------------- Diario e slot accanto (come l'Istinto del vampiro)
function slotDiario(c) { for (let i = 0; i < c.size; i++) if (c.getItem(i)?.typeId === DIARIO) return i; return -1; }
function slotAccanto(i) { return i % 9 === 8 ? i - 1 : i + 1; }
function libera(p, c, slot) {
  const ora = c.getItem(slot);
  if (!ora || eAbilita(ora.typeId)) return;
  c.setItem(slot, undefined);
  for (let j = 9; j < c.size; j++) if (!c.getItem(j)) { c.setItem(j, ora); return; }
  for (let j = 0; j < 9; j++) if (j !== slot && !c.getItem(j)) { c.setItem(j, ora); return; }
  try { p.dimension.spawnItem(ora, p.location); } catch {}
}
export function sistema(p) {
  const c = U.inv(p);
  if (!c) return;
  if (!eCacciatore(p)) { togliTutto(p); return; }
  let i = slotDiario(c);
  if (i < 0) {
    let j = -1;
    for (let k = 0; k < 9 && j < 0; k++) if (!c.getItem(k)) j = k;
    if (j < 0) for (let k = 9; k < c.size && j < 0; k++) if (!c.getItem(k)) j = k;
    if (j < 0) return;
    c.setItem(j, oggettoDiario());
    i = j;
  }
  const n = scelta(p), voluto = n ? slotAccanto(i) : -1;
  for (let k = 0; k < c.size; k++) if (k !== voluto && eAbilita(c.getItem(k)?.typeId)) c.setItem(k, undefined);
  if (voluto >= 0 && c.getItem(voluto)?.typeId !== ID(n)) { libera(p, c, voluto); c.setItem(voluto, oggettoAbilita(n)); }
}
export function togliTutto(p) {
  const c = U.inv(p);
  if (c) for (let k = 0; k < c.size; k++) { const t = c.getItem(k)?.typeId; if (t === DIARIO || eAbilita(t)) c.setItem(k, undefined); }
}

// ---------------------------------------------------------------- il Diario: elenco / pannello / stato e incarichi
const aperto = new Set();
function mostra(p, f, dopo) {
  aperto.add(p.id);
  const vai = () => f.show(p).then((r) => {
    if (r.canceled) { if (r.cancelationReason === 'UserBusy') { system.runTimeout(vai, 10); return; } aperto.delete(p.id); return; }
    aperto.delete(p.id);
    U.guard(() => dopo(r.selection));
  }).catch(() => aperto.delete(p.id));
  vai();
}
/** elenco = true: finestra normale (tocco); false: pannello a icone come la ruota del vampiro (accovacciato + tocco) */
export function apri(p, elenco = true) {
  if (!eCacciatore(p) || aperto.has(p.id)) return;
  const sel = scelta(p), g = grado(p);
  const f = new ActionFormData().title(elenco ? '§fDiario del cacciatore' : 'vamp:barra')
    .body(`§7Grado: §f${GRADI[g]}§7  Determinazione: §f${Math.floor(det(p))}/${DET_MAX}` +
      (sel ? `\n§7Scelta: §f${ABILITA.find(([n]) => n === sel)?.[3] ?? ''}§7 (toccala di nuovo per toglierla)` : '\n§7Scegli un\'abilità'));
  for (const [n, costo, , nome] of ABILITA) f.button((n === sel ? '» ' : '') + nome + (elenco ? ` §8(${costo})` : ''), icona(n));
  f.button('Stato e incarichi', 'textures/ui/vamp/caccia_stato');
  f.button('Chiudi', 'textures/ui/vamp/chiudi');
  U.suonoP(p, 'item.book.page_turn', 0.8, 0.9);
  mostra(p, f, (i) => {
    if (i < ABILITA.length) scegli(p, ABILITA[i]);
    else if (i === ABILITA.length) system.run(() => U.guard(() => stato(p)));
  });
}
function scegli(p, ab) {
  const [n, , , nome] = ab;
  if (scelta(p) === n) { U.set(p, 'caccia_sel', ''); sistema(p); U.barForte(p, `§7Hai tolto §f${nome}§7.`, 40); return; }
  U.set(p, 'caccia_sel', n);
  sistema(p);
  U.barForte(p, `§f${nome}§7: è accanto al Diario. Toccala per usarla.`, 60);
}
/** l'oggetto dell'abilità è stato usato */
export function usato(p, id) {
  const ab = ABILITA.find(([n]) => ID(n) === id);
  if (!ab || !eCacciatore(p)) return;
  const [n, costo, mira, nome, fn] = ab;
  if (!U.pronto(p, 6, 'caccia')) return;
  const pausa = ATTESA[n] ?? 0;
  if (pausa && !U.pronto(p, pausa, 'attesa_' + n)) { U.barForte(p, `§7${nome}: non ancora pronta.`, 30); return; }
  if (det(p) < costo) { U.barForte(p, `§7Ti serve più §fDeterminazione§7 (${costo}).`, 40); U.suonoP(p, 'note.bass', 0.6, 0.6); return; }
  const e = mira ? miraVampiro(p) : undefined;
  if (fn(p, e) === false) return;                                 // non è partita: niente costo
  setDet(p, det(p) - costo);
}
const ATTESA = { richiamo: 20 * 60, raffica: 40, nube: 60, trappola: 20 };
export function attivaPerNome(p, n) {
  const ab = ABILITA.find(([id]) => id === n);
  if (!ab) { U.tell(p, '§7Abilità: ' + ABILITA.map(([id]) => id).join(', ')); return; }
  usato(p, ID(n));
}

/** il bersaglio davanti: prima un vampiro sulla linea di vista, poi qualsiasi creatura (mai i propri cacciatori richiamati) */
function miraVampiro(p) {
  let primo;
  try {
    for (const h of p.getEntitiesFromViewDirection({ maxDistance: 16 })) {
      const e = h.entity;
      if (!U.ok(e) || e.id === p.id || /^minecraft:(item|xp_orb|arrow)$|^vamp:dardo/.test(e.typeId)) continue;
      if (e.hasTag?.('vamp_richiamato') && U.get(e, 'capo', '') === p.id) continue;
      if (eVampiroQ(e)) return e;
      primo ??= e;
    }
  } catch {}
  return primo;
}

// ---------------------------------------------------------------- incarichi
const PREMI = {
  1: [[U.I('paletto'), 8], [U.I('infuso_verbena'), 2], [U.I('granata_verbena'), 2]],
  2: [[U.I('paletto'), 12], [U.I('granata_verbena'), 4], [U.I('infuso_verbena'), 3], ['minecraft:golden_apple', 2]],
  3: [[U.I('paletto_quercia'), 2], [U.I('granata_verbena'), 6], [U.I('medaglione'), 1], ['minecraft:diamond', 4]],
  4: [[U.I('paletto_argento'), 1], [U.I('paletto_quercia'), 4], [U.I('granata_verbena'), 8], ['minecraft:enchanted_golden_apple', 1]],
};
export const incarico = (p) => U.getJ(p, 'incarico', undefined);
function nuovoIncarico(p) {
  const g = grado(p);
  const inc = Math.random() < 0.3 ? { tipo: 'squartatore', n: 1, fatti: 0 } : { tipo: 'vampiri', n: 2 + g, fatti: 0 };
  U.setJ(p, 'incarico', inc);
  return inc;
}
const descr = (inc) => (inc.tipo === 'squartatore' ? 'Elimina uno §cSquartatore' : `Elimina §f${inc.n}§7 vampiri`) + `§7 (${inc.fatti}/${inc.n})`;
function stato(p) {
  if (!eCacciatore(p) || aperto.has(p.id)) return;
  const g = grado(p), n = punti(p), prossimo = SOGLIE[g + 1];
  let inc = incarico(p);
  const f = new ActionFormData().title('§fStato del cacciatore');
  let testo = `§7Grado: §f${GRADI[g]}§7  (prede: §f${n}§7${prossimo !== undefined ? `, prossimo grado a §f${prossimo}` : ', grado massimo'}§7)\n` +
    `§7Determinazione: §f${Math.floor(det(p))}/${DET_MAX}§7, torna di 1 ogni §f${(passoDet(g) / 20).toFixed(1)} s\n` +
    `§7Danno extra contro i vampiri: §f+${g}\n` +
    `§7Mente protetta dal soggiogamento: §f${grado(p) >= 2 ? 'sì' : 'solo con Volontà di ferro'}\n\n`;
  const pronto = inc && inc.fatti >= inc.n;
  if (!inc) testo += '§7Nessun incarico.';
  else testo += `§7Incarico: ${descr(inc)}${pronto ? '\n§aCompiuto! Riscuoti il premio.' : ''}`;
  f.body(testo);
  const voci = [];
  if (!inc) voci.push(['Prendi un incarico', () => { const i = nuovoIncarico(p); U.tell(p, `§f[Incarico]§r ${descr(i)}§r. Il premio dipende dal tuo grado.`); }]);
  if (pronto) voci.push(['Riscuoti il premio', () => riscuoti(p)]);
  if (inc && !pronto) voci.push(['Rinuncia all\'incarico', () => { U.set(p, 'incarico', undefined); U.tell(p, '§7[Incarico] Hai rinunciato.'); }]);
  voci.push(['Rompi il giuramento', () => conferma(p)]);
  voci.push(['Chiudi', () => {}]);
  for (const [t] of voci) f.button(t);
  mostra(p, f, (i) => voci[i]?.[1]());
}
function riscuoti(p) {
  const inc = incarico(p);
  if (!inc || inc.fatti < inc.n) return;
  for (const [id, k] of PREMI[grado(p)]) U.dai(p, id, k);
  U.set(p, 'incarico', undefined);
  U.set(p, 'cacce', punti(p) + 2);
  setDet(p, DET_MAX);
  U.suonoP(p, 'random.levelup', 1, 1.1);
  U.tell(p, '§f[Incarico]§r Compiuto: la Confraternita ti ricompensa (+2 prede, Determinazione piena).');
  controllaGrado(p);
}
function conferma(p) {
  const f = new ActionFormData().title('§cRompere il giuramento?').body('§7Perdi il Diario, le abilità e la Determinazione. I gradi restano scritti: se giuri di nuovo, li ritrovi.');
  f.button('§cSì, rompo il giuramento'); f.button('No');
  mostra(p, f, (i) => { if (i === 0) perdiClasse(p, '§7[Cacciatore] Hai rotto il giuramento. Sei di nuovo un umano qualsiasi.'); });
}

// ---------------------------------------------------------------- prede e gradi
let gradoPrima = new Map();
function controllaGrado(p) {
  const g = grado(p), prima = gradoPrima.get(p.id) ?? U.get(p, 'grado_visto', 1);
  if (g > prima) {
    U.titolo(p, '§f' + GRADI[g], '§7Sei salito di grado tra i cacciatori.');
    U.suonoP(p, 'random.levelup', 1, 0.8);
    const cosa = { 2: 'La tua mente ora resiste al soggiogamento dei vampiri.', 3: 'Il tuo fiuto si affina: senti i vampiri vicini anche senza cercarli.', 4: 'Resistenza I permanente. Sei una leggenda tra i cacciatori.' }[g];
    if (cosa) U.tell(p, '§f[Cacciatore]§r ' + cosa);
  }
  gradoPrima.set(p.id, g);
  U.set(p, 'grado_visto', g);
}
/** chiamata quando muore una creatura o un giocatore: se l'ha ucciso un cacciatore ed era un vampiro, conta */
export function preda(morto, assassino) {
  if (assassino?.typeId !== 'minecraft:player' || !eCacciatore(assassino) || morto.id === assassino.id) return;
  let tipo = morto.typeId, valore = 0;
  if (tipo === 'vamp:originale') valore = 10;
  else if (/^vamp:(vampiro|squartatore)$/.test(tipo)) valore = 1;
  else if (tipo === 'minecraft:player' && S.eVampiro(morto)) { valore = S.eOriginale(morto) ? 10 : 2; tipo = 'vamp:vampiro'; }
  if (!valore) return;
  U.set(assassino, 'cacce', punti(assassino) + valore);
  setDet(assassino, det(assassino) + 4);
  U.barForte(assassino, `§fPreda: §7+${valore} §8(${punti(assassino)} in tutto)`, 40);
  const inc = incarico(assassino);
  if (inc && inc.fatti < inc.n && (inc.tipo === 'vampiri' || (inc.tipo === 'squartatore' && tipo === 'vamp:squartatore'))) {
    inc.fatti++;
    U.setJ(assassino, 'incarico', inc);
    if (inc.fatti >= inc.n) U.tell(assassino, '§f[Incarico]§r Compiuto! Apri il Diario → §fStato e incarichi§r per riscuotere il premio.');
  }
  controllaGrado(assassino);
}
/** colpo del cacciatore su un vampiro: danno extra secondo il grado, e il Colpo al cuore se è pronto */
export function colpoCacciatore(p, e) {
  if (!eCacciatore(p) || !U.ok(e) || !eVampiroQ(e)) return;
  const g = grado(p);
  if (U.get(p, 'colpo_pronto', 0) > system.currentTick) { U.set(p, 'colpo_pronto', 0); colpoAlCuore(p, e); return; }
  U.danno(e, g, 'magic', p);
}

// ---------------------------------------------------------------- abilità
function fiuto(p) {
  U.set(p, 'fiuto', 20 * (20 + 5 * grado(p)));
  U.suonoP(p, 'mob.wolf.sniff', 1, 0.8);
  U.bar(p, '§fFiuto del vampiro:§7 senti il loro odore di morte.');
}
function vampiriVicini(p, r) { return U.vicini(p.dimension, p.location, r).filter((e) => e.id !== p.id && eVampiroQ(e)); }
const FRECCE = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
function freccia(p, e) {
  const d = p.getViewDirection(), a = Math.atan2(e.location.x - p.location.x, e.location.z - p.location.z) - Math.atan2(d.x, d.z);
  const k = ((Math.round(-a / (Math.PI / 4)) % 8) + 8) % 8;
  return FRECCE[k];
}
function colpo(p) {
  U.set(p, 'colpo_pronto', system.currentTick + 200);
  U.suonoP(p, 'item.trident.riptide_1', 0.8, 1.4);
  U.barForte(p, '§fColpo al cuore pronto:§7 colpisci un vampiro entro 10 secondi (col paletto è mortale).', 80);
}
function colpoAlCuore(p, e) {
  const arma = U.mano(p)?.typeId, g = grado(p);
  const sangue = () => { for (let i = 0; i < 4; i++) U.fx(e.dimension, 'vamp:sangue', U.add(e.location, U.v3(0, 1.1 + i * 0.15, 0))); U.suono(e.dimension, 'mob.zombie.woodbreak', e.location, 1, 1.3); };
  if (eOriginaleQ(e)) {
    if (U.eQuercia(arma)) {
      const h = U.salute(e);
      sangue();
      if (h.ora <= 60 || (e.typeId === 'minecraft:player' && h.ora <= h.max / 2)) {
        if (e.typeId === 'minecraft:player') { S.segnaMorteVera(e, 'un paletto di quercia bianca nel cuore'); U.danno(e, 1000, 'entityAttack', p); } else uccidiVampiro(e, p);
        U.barForte(p, '§eLa quercia bianca trafigge il cuore dell\'Originale!', 80);
      } else { U.danno(e, 30 + 5 * g, 'entityAttack', p); U.barForte(p, '§eLa quercia bianca lo ferisce gravemente.', 60); }
    } else { U.danno(e, 8 + 2 * g, 'entityAttack', p); U.barForte(p, '§6Il cuore di un Originale si ferma solo con la quercia bianca.', 60); }
    return;
  }
  if (U.ePaletto(arma)) {
    sangue();
    if (e.typeId === 'minecraft:player') { S.segnaMorteVera(e, 'un paletto nel cuore (cacciatore)'); U.danno(e, 1000, 'entityAttack', p); } else uccidiVampiro(e, p);
    U.barForte(p, '§fPaletto nel cuore!', 50);
  } else { U.danno(e, 8 + 2 * g, 'entityAttack', p); U.barForte(p, '§7Senza paletto è solo un gran colpo.', 50); }
}
function nube(p) {
  const r = 5 + grado(p), dim = p.dimension, loc = p.location;
  let n = 0;
  for (const e of U.vicini(dim, loc, r)) {
    if (e.id === p.id) continue;
    if (e.typeId === 'minecraft:player' && !S.eVampiro(e)) { U.set(e, 'verbena', Math.max(U.get(e, 'verbena', 0), 3000)); continue; }
    if (!eVampiroQ(e)) continue;
    n++;
    U.danno(e, e.typeId === 'vamp:originale' ? 8 + 2 * grado(p) : 4 + grado(p), 'magic', p);
    U.eff(e, 'weakness', 300, 1); U.eff(e, 'slowness', 240, 1);
    if (e.typeId === 'minecraft:player') { U.set(e, 'bloccato', 400); U.lampo(e, 0.55, 0.2, 0.75, 0.05, 0.3, 0.8); U.barForte(e, '§dNube di verbena! I tuoi poteri sono bloccati.', 60); }
  }
  for (let k = 1; k <= r; k += 1.5) for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + k;
    U.fx(dim, 'vamp:verbena', U.add(loc, U.v3(Math.cos(a) * k, 0.6, Math.sin(a) * k)));
  }
  U.suono(dim, 'random.fizz', loc, 1, 0.7);
  U.suono(dim, 'random.glass', loc, 0.8, 1.1);
  U.barForte(p, n ? `§dNube di verbena: §f${n}§d vampiri avvelenati.` : '§dLa nube di verbena si sparge: nessun vampiro qui.', 50);
}
// trappole: piastre d'oro a terra; un vampiro che ci passa sopra resta inchiodato
const PIASTRA = 'minecraft:light_weighted_pressure_plate';
function trappola(p) {
  const dim = p.dimension, f = U.floor(p.location), b = U.blk(dim, f), sotto = U.blk(dim, U.v3(f.x, f.y - 1, f.z));
  if (!b || !b.isAir || !sotto || sotto.isAir || sotto.isLiquid) { U.barForte(p, '§7Qui non si può piazzare: serve un pavimento libero.', 40); return false; }
  const mie = U.wGetJ('trappole', []).filter((t) => t.chi === p.id);
  const max = 2 + grado(p);
  if (mie.length >= max) { U.barForte(p, `§7Hai già §f${max}§7 trappole piazzate (raccoglile o aspetta che scattino).`, 50); return false; }
  try { b.setType(PIASTRA); } catch { return false; }
  const tutte = U.wGetJ('trappole', []);
  tutte.push({ chi: p.id, d: dim.id, x: f.x, y: f.y, z: f.z, g: grado(p) });
  U.wSetJ('trappole', tutte.slice(-60));
  U.fx(dim, 'vamp:verbena', U.add(f, U.v3(0.5, 0.2, 0.5)));
  U.suono(dim, 'random.click', f, 1, 0.6);
  U.barForte(p, `§dTrappola di verbena piazzata §7(${mie.length + 1}/${max}).`, 40);
}
export function tickTrappole() {
  const tutte = U.wGetJ('trappole', []);
  if (!tutte.length) return;
  const resto = [];
  let cambiato = false;
  for (const t of tutte) {
    let dim;
    try { dim = world.getDimension(t.d); } catch { cambiato = true; continue; }
    const b = U.blk(dim, U.v3(t.x, t.y, t.z));
    if (!b) { resto.push(t); continue; }                                     // chunk non caricato
    if (b.typeId !== PIASTRA) { cambiato = true; continue; }                  // raccolta o rotta
    const c = U.v3(t.x + 0.5, t.y, t.z + 0.5);
    const preda = U.vicini(dim, c, 1.3).find(eVampiroQ);
    if (!preda) { resto.push(t); continue; }
    cambiato = true;
    try { b.setType('minecraft:air'); } catch {}
    const s = 20 * (4 + t.g);
    U.eff(preda, 'slowness', s, 255); U.eff(preda, 'weakness', s, 2); U.eff(preda, 'jump_boost', s, 128);
    U.danno(preda, 4 + t.g, 'magic');
    if (preda.typeId === 'minecraft:player') { U.set(preda, 'bloccato', Math.max(U.get(preda, 'bloccato', 0), s)); U.titolo(preda, '§dTrappola!', '§7La verbena ti brucia le gambe: non riesci a muoverti.'); }
    for (let i = 0; i < 3; i++) U.fx(dim, 'vamp:verbena', U.add(c, U.v3(0, 0.3 + i * 0.4, 0)));
    U.suono(dim, 'random.anvil_land', c, 0.6, 1.6);
    const chi = world.getPlayers().find((q) => q.id === t.chi);
    if (chi) U.barForte(chi, '§dUna tua trappola è scattata!', 60);
  }
  if (cambiato) U.wSetJ('trappole', resto);
}
function rete(p, e) {
  if (!U.ok(e)) { U.barForte(p, '§7Guarda la creatura su cui lanciare la rete (entro 16 blocchi).', 40); return false; }
  const s = 20 * (5 + grado(p));
  U.eff(e, 'slowness', s, 4); U.eff(e, 'jump_boost', s, 128); U.eff(e, 'mining_fatigue', s, 2);
  if (eVampiroQ(e)) { U.eff(e, 'weakness', s, 1); U.danno(e, 2, 'magic', p); }
  const f = U.floor(e.location), b = U.blk(e.dimension, f);
  if (b?.isAir) {
    try { b.setType('minecraft:web'); } catch {}
    system.runTimeout(() => U.guard(() => { const q = U.blk(e.dimension, f); if (q?.typeId === 'minecraft:web') q.setType('minecraft:air'); }), s);
  }
  U.suono(p.dimension, 'random.bow', p.location, 1, 0.6);
  U.suono(e.dimension, 'block.chain.place', e.location, 1, 1.0);
  if (e.typeId === 'minecraft:player') U.titolo(e, '§7Rete d\'argento', '§7Sei impigliato!');
  U.barForte(p, '§fRete d\'argento:§7 bersaglio impigliato.', 40);
}
function raffica(p) {
  const c = U.inv(p);
  let tipo = '';
  if (c) for (let i = 0; i < c.size && !tipo; i++) { const t = c.getItem(i)?.typeId; if (t === U.I('paletto_quercia') || t === U.I('paletto')) tipo = t; }
  if (!tipo) { U.barForte(p, '§7Ti serve almeno un §6Paletto§7 nell\'inventario.', 50); return false; }
  for (let i = 0; i < c.size; i++) { const s = c.getItem(i); if (s?.typeId === tipo) { if (s.amount > 1) { s.amount -= 1; c.setItem(i, s); } else c.setItem(i, undefined); break; } }
  const quercia = tipo === U.I('paletto_quercia'), n = 2 + grado(p);
  for (let k = 0; k < n; k++) system.runTimeout(() => U.guard(() => tiraDardo(p, quercia, k)), k * 3);
  U.barForte(p, `§6Raffica di paletti: §f${n}§6 colpi${quercia ? ' §e(quercia bianca)' : ''}.`, 40);
}
function tiraDardo(p, quercia, k) {
  if (!U.ok(p)) return;
  const d = p.getViewDirection(), h = p.getHeadLocation();
  const sp = (k % 3 - 1) * 0.04;
  const dir = U.v3(d.x + sp * d.z, d.y + (k % 2 ? 0.02 : -0.01), d.z - sp * d.x);
  const pr = p.dimension.spawnEntity(U.I(quercia ? 'dardo_quercia' : 'dardo_paletto'), U.add(h, U.mul(dir, 1.2)));
  const comp = pr.getComponent?.('minecraft:projectile');
  if (comp) { try { comp.owner = p; } catch {} try { comp.shoot(U.mul(dir, 3.2), { uncertainty: 0 }); } catch {} }
  U.suono(p.dimension, 'crossbow.shoot', p.location, 0.8, 1.2 + k * 0.05);
}
function schivata(p) {
  const d = U.norm2d(p.getViewDirection());
  try { p.applyKnockback({ x: -d.x * 2.4, z: -d.z * 2.4 }, 0.38); } catch {}
  U.eff(p, 'resistance', 15, 4);
  U.fx(p.dimension, 'vamp:scia_nera', p.location);
  U.suono(p.dimension, 'mob.phantom.swoop', p.location, 0.6, 1.8);
}
const NEGATIVI = ['slowness', 'weakness', 'nausea', 'blindness', 'darkness', 'mining_fatigue', 'poison', 'hunger'];
function volontaDiFerro(p) {
  U.set(p, 'volonta', 20 * (60 + 30 * grado(p)));
  for (const e of NEGATIVI) U.togliEff(p, e);
  U.lampo(p, 0.9, 0.9, 1, 0.05, 0.15, 0.5);
  U.suonoP(p, 'beacon.power', 0.8, 1.4);
  U.barForte(p, '§fVolontà di ferro:§7 nessun vampiro può entrarti nella mente.', 60);
}
function richiamo(p) {
  const dim = p.dimension, n = 1 + grado(p), presi = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, l = U.add(p.location, U.v3(Math.cos(a) * 3, 0, Math.sin(a) * 3));
    const e = U.guard(() => dim.spawnEntity(U.I(i % 2 ? 'cacciatore_paletto' : 'cacciatore'), l));
    if (!e) continue;
    try { e.addTag('vamp_richiamato'); } catch {}
    gradoPng(e, grado(p));                                           // accorrono cacciatori del tuo stesso grado
    U.set(e, 'capo', p.id);
    U.set(e, 'fine', system.currentTick + 20 * 120);
    presi.push(e.id);
    U.fx(dim, 'vamp:sole', U.add(l, U.v3(0, 1, 0)));
  }
  U.suono(dim, 'raid.horn', p.location, 0.6, 1.3);
  U.barForte(p, `§fRichiamo:§7 ${presi.length} cacciatori della Confraternita combattono con te per 2 minuti.`, 80);
  if (!presi.length) return false;
}
function fuoco(p, e) {
  const g = grado(p);
  if (U.ok(e)) {
    try { e.setOnFire(6 + g, true); } catch {}
    if (eVampiroQ(e)) U.danno(e, 2 + g, 'fire', p);
    for (let i = 0; i <= 6; i++) U.fx(p.dimension, 'vamp:braci', U.add(p.location, U.v3((e.location.x - p.location.x) * i / 6, 1.2 + (e.location.y - p.location.y) * i / 6, (e.location.z - p.location.z) * i / 6)));
    U.suono(p.dimension, 'mob.blaze.shoot', p.location, 1, 0.8);
    return;
  }
  const d = U.norm2d(p.getViewDirection()), f = U.floor(p.location);
  let n = 0;
  for (let k = 2; k <= 4 + g; k++) {
    const x = Math.floor(p.location.x + d.x * k), z = Math.floor(p.location.z + d.z * k);
    for (let dy = 1; dy >= -2; dy--) {
      const b = U.blk(p.dimension, U.v3(x, f.y + dy, z)), sotto = U.blk(p.dimension, U.v3(x, f.y + dy - 1, z));
      if (b?.isAir && sotto && !sotto.isAir && !sotto.isLiquid) { try { b.setType('minecraft:fire'); n++; } catch {} break; }
    }
  }
  U.suono(p.dimension, 'mob.blaze.shoot', p.location, 1, 0.8);
  U.barForte(p, '§6Fuoco purificatore: §7una lingua di fiamme davanti a te.', 40);
}

// ---------------------------------------------------------------- tick
const passoDet = (g) => Math.round(20 * (6 - g));                // tick per 1 punto: 5 s, 4 s, 3 s, 2 s
function hud(p) {
  const d = det(p), piene = Math.floor(d / 2), meta = d % 2 >= 1 ? 1 : 0;
  let s = '';
  for (let i = 0; i < 10; i++) s += i < piene ? car('det_piena') : (i === piene && meta ? car('det_meta') : car('det_vuota'));
  let icone = '';
  if (volonta(p)) icone += ' ' + car('volonta');
  if (U.get(p, 'fiuto', 0) > 0) icone += ' ' + car('fiuto');
  if (U.get(p, 'verbena', 0) > 0) icone += ' ' + car('verbena');
  if (U.get(p, 'colpo_pronto', 0) > system.currentTick) icone += ' §c' + car('cuore_battito');
  U.bar(p, `§r${s}§r${icone} §f${GRADI[grado(p)]}`);
}
/** ogni secondo, per ogni cacciatore */
export function tickCacciatore(p, passo) {
  if (!eCacciatore(p)) return;
  if (S.eVampiro(p)) { perdiClasse(p, '§4[Cacciatore] Il sangue di vampiro ha spezzato il tuo giuramento.'); return; }
  const g = grado(p);
  controllaGrado(p);                                                   // anche quando le prede cambiano da comando
  // determinazione
  const acc = U.get(p, 'det_acc', 0) + passo;
  if (acc >= passoDet(g)) { setDet(p, det(p) + Math.floor(acc / passoDet(g))); U.set(p, 'det_acc', acc % passoDet(g)); } else U.set(p, 'det_acc', acc);
  // volontà e fiuto
  const v = U.get(p, 'volonta', 0);
  if (v > 0) { U.set(p, 'volonta', Math.max(0, v - passo)); for (const e of ['nausea', 'blindness', 'darkness']) U.togliEff(p, e); if (v - passo <= 0) U.barForte(p, '§7La Volontà di ferro si esaurisce.', 40); }
  U.effInf(p, 'resistance', g >= 4 ? 0 : -1);                       // Maestro: Resistenza I sempre
  const fi = U.get(p, 'fiuto', 0);
  const raggio = fi > 0 ? 48 : (g >= 3 ? 12 : 0);
  if (fi > 0) U.set(p, 'fiuto', Math.max(0, fi - passo));
  if (raggio) {
    const vv = vampiriVicini(p, raggio).sort((a, b) => U.dist(a.location, p.location) - U.dist(b.location, p.location));
    for (const e of vv.slice(0, 12)) for (let i = 0; i < 3; i++) U.fxP(p, 'vamp:fiuto', U.add(e.location, U.v3(0, 0.6 + i * 0.6, 0)));
    if (vv.length && fi > 0) {                                   // il Fiuto ha la precedenza sugli altri messaggi
      const e = vv[0];
      U.barForte(p, `§4${car('teschio')} §f${vv.length}§7 vampir${vv.length > 1 ? 'i' : 'o'} — il più vicino a §f${Math.round(U.dist(e.location, p.location))}§7 blocchi §f${freccia(p, e)}`, 22);
      return;
    }
    if (vv.length && g >= 3 && fi <= 0 && U.pronto(p, 200, 'fiuto_passivo')) U.suonoP(p, 'mob.wolf.growl', 0.4, 1.4);
  }
  if (!U.hudZitto(p) && U.get(p, 'rito', 0) <= 0 && U.get(p, 'sangue_corpo', 0) <= 0) hud(p);
}
/** ogni 2 secondi: i cacciatori richiamati seguono il loro capo e se ne vanno quando finisce il tempo */
export function tickRichiamati() {
  for (const p of world.getPlayers()) {
    for (const e of U.vicini(p.dimension, p.location, 96)) {
      if (!/^vamp:cacciatore/.test(e.typeId) || !e.hasTag?.('vamp_richiamato') || U.get(e, 'capo', '') !== p.id) continue;
      if (system.currentTick > U.get(e, 'fine', 0) || !eCacciatore(p)) {
        U.fx(e.dimension, 'vamp:fumo_nero', U.add(e.location, U.v3(0, 1, 0)));
        try { e.remove(); } catch {}
        continue;
      }
      if (U.dist(e.location, p.location) > 14) {
        const d = U.norm2d(U.sub(e.location, p.location));
        try { e.teleport(U.add(p.location, U.v3(d.x * 3, 0, d.z * 3))); } catch {}
      }
    }
  }
}
