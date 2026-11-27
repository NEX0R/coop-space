// Sangue Immortale — nutrirsi: morso (colpo a mano vuota), sacche di sangue, fiale, verbena, bevande.
import { world, system } from '@minecraft/server';
import * as U from './util.js';
import * as S from './stato.js';
import { nuovoSeguace, eMio } from './seguaci.js';

const UMANI = /^minecraft:(villager_v2|villager|wandering_trader|pillager|vindicator|evoker|witch|illusioner)$|^vamp:cacciatore(_paletto)?$/;
const ANIMALI = /^minecraft:(cow|pig|sheep|chicken|horse|donkey|mule|llama|trader_llama|goat|rabbit|fox|wolf|cat|ocelot|panda|polar_bear|camel|sniffer|armadillo|mooshroom|bat|dolphin|turtle|parrot)$/;
const VAMPIRI = /^vamp:(vampiro|squartatore|originale)$/;

export function tipoSangue(e) {
  if (e.typeId === 'minecraft:player') return S.eVampiro(e) ? 'vampiro' : 'umano';
  if (UMANI.test(e.typeId)) return 'umano';
  if (ANIMALI.test(e.typeId)) return 'animale';
  if (VAMPIRI.test(e.typeId)) return 'vampiro';
  return '';
}

/** lore: alcuni umani bevono verbena di nascosto; i cacciatori la prendono sempre */
export function haVerbena(e) {
  if (e.typeId === 'minecraft:player') return S.verbenaInCorpo(e) ||          // la mente del cacciatore (dal grado Cacciatore o con Volontà di ferro)
    (U.get(e, 'classe', '') === 'cacciatore' && (U.get(e, 'cacce', 0) >= 5 || U.get(e, 'volonta', 0) > 0));
  if (/^vamp:cacciatore/.test(e.typeId)) return true;
  try {
    if (e.hasTag('vamp_verbena')) return true;
    if (e.hasTag('vamp_pulito')) return false;
    let h = 0;
    for (const ch of e.id) h = (h * 31 + ch.charCodeAt(0)) % 1000003;
    const si = /villager|wandering_trader/.test(e.typeId) && h % 100 < 12;
    e.addTag(si ? 'vamp_verbena' : 'vamp_pulito');
    return si;
  } catch { return false; }
}

function bruciaVerbena(p, quanto = 4) {
  U.danno(p, quanto, 'magic');
  U.eff(p, 'weakness', 200, 1);
  U.eff(p, 'nausea', 140, 0);
  U.set(p, 'bloccato', 400);
  U.lampo(p, 0.55, 0.2, 0.75, 0.05, 0.2, 0.6);
  U.fx(p.dimension, 'vamp:verbena', U.add(p.location, U.v3(0, 1.2, 0)));
  U.suonoP(p, 'random.fizz', 1, 0.8);
}

function effettiMorso(p, e) {
  U.lampo(p, 0.55, 0, 0.03, 0.05, 0.15, 0.45);                  // il volto del vampiro: lo schermo si tinge di rosso
  U.suonoP(p, 'mob.warden.heartbeat', 0.9, 1.2);
  U.suono(p.dimension, 'random.drink', e.location, 0.9, 0.7);
  U.fx(p.dimension, 'vamp:sangue', U.add(e.location, U.v3(0, 1.5, 0)));
}

/** chi può mordere chi: vampiro (o in transizione) su una creatura con sangue */
export const puoMordere = (p, e) => (S.eVampiro(p) || S.inTransizione(p)) && !!tipoSangue(e);

/** morso (abilità della ruota; in transizione: colpo a mano vuota) */
export function morso(p, e) {
  if (!S.eVampiro(p) && !S.inTransizione(p)) return false;
  if (!U.pronto(p, 14, 'morso')) return true;
  const tipo = tipoSangue(e);
  if (!tipo) { U.barForte(p, '§7Non ha sangue da bere.'); return true; }
  if (tipo === 'umano' && haVerbena(e)) {
    bruciaVerbena(p);
    U.barForte(p, '§dVerbena! Il suo sangue ti brucia la gola.', 80);
    return true;
  }
  if (S.inTransizione(p)) {
    if (tipo !== 'umano') { U.barForte(p, '§7Solo il §csangue umano§7 completa la transizione.'); return true; }
    effettiMorso(p, e);
    U.danno(e, 2, 'entityAttack', p);
    S.diventaVampiro(p, !!U.get(p, 'trans_originale', false));
    return true;
  }
  const spenta = !S.umanita(p), rip = S.squartatore(p);
  if (tipo === 'vampiro' && !rip && !S.eOriginale(p)) {
    U.barForte(p, '§7Il sangue di un vampiro non ti nutre' + (spenta ? '... non ancora.' : '.'));
    return true;
  }
  const h = U.salute(e).ora;
  const ferita = rip ? 6 : (spenta ? 4 : 2);
  let preso = { umano: 4, animale: 2, vampiro: 3 }[tipo];
  if (spenta && tipo === 'umano') preso += 1;
  if (rip) preso += 1;
  effettiMorso(p, e);
  U.danno(e, ferita, 'entityAttack', p);
  if (e.typeId !== 'minecraft:player') { U.eff(e, 'weakness', 100, 0); U.eff(e, 'slowness', 60, 1); }
  else { U.eff(e, 'weakness', 200, 0); U.eff(e, 'nausea', 100, 0); U.tell(e, '§4Un vampiro ti ha morso!'); }
  S.setSangue(p, S.sangue(p) + preso);
  if (tipo === 'umano') {
    S.aggiungiXp(p, 1);
    U.set(p, 'dieta', Math.max(0, U.get(p, 'dieta', 0) - 1));
    if (h <= ferita) {                                             // l'ha prosciugato
      S.aggiungiXp(p, 3);
      if (spenta) {
        const n = U.get(p, 'uccisioni', 0) + 1;
        U.set(p, 'uccisioni', n);
        if (n >= 5 && !rip) {
          U.set(p, 'squartatore', true);
          U.titolo(p, '§4§lSQUARTATORE', '§7La sete non ti lascia più.');
          U.tell(p, '§4[Squartatore]§r Hai ucciso troppo con l\'umanità spenta. Ora i tuoi morsi sono feroci e puoi bere anche ' +
            'dai vampiri, ma la sete corre più veloce. Riaccendi l\'umanità per tornare in te.');
        }
      }
    }
  } else if (tipo === 'animale') {
    const d = Math.min(5, U.get(p, 'dieta', 0) + 1);
    U.set(p, 'dieta', d);
    if (d === 3) U.tell(p, '§7[Vampiro] Con il solo sangue animale sei più debole (come chi rinuncia al sangue umano). Un morso umano ti rimette in forze.');
  }
  if (U.ok(e)) pasti.set(p.id, { id: e.id, t: system.currentTick });   // continua a bere finché lo guardi
  U.barForte(p, `§4+${preso} sangue ${tipo === 'animale' ? '§7(animale)' : tipo === 'vampiro' ? '§8(di vampiro)' : ''}`, 30);
  return true;
}

/** accovacciato + colpo con la sacca vuota su un umano: la riempie (anche gli umani possono farlo) */
export function riempiSacca(p, e) {
  if (tipoSangue(e) !== 'umano' || e.typeId === 'minecraft:player') { U.barForte(p, '§7Serve un umano (un abitante, per esempio).'); return; }
  if (!U.pronto(p, 20, 'sacca')) return;
  U.consumaMano(p);
  const cacciatore = /^vamp:cacciatore/.test(e.typeId);
  U.dai(p, U.I(cacciatore ? 'sangue_cacciatore' : 'sacca_sangue'));
  U.danno(e, 2, 'entityAttack', p);
  U.eff(e, 'weakness', 200, 0);
  U.fx(p.dimension, 'vamp:sangue', U.add(e.location, U.v3(0, 1.2, 0)));
  U.suono(p.dimension, 'bucket.fill', e.location, 0.7, 1.4);
  U.barForte(p, cacciatore ? '§cSangue di cacciatore: §7offrilo all\'altare a mezzanotte, vicino a una quercia bianca.' : '§cSacca di sangue riempita.');
}

/** accovacciato + colpo con la fiala su un abitante: il tuo sangue nel suo corpo (se muore, rinasce vampiro legato a te) */
export function daiSangueAbitante(p, e) {
  if (!/villager|wandering_trader/.test(e.typeId)) { U.barForte(p, '§7Funziona su un abitante.'); return; }
  U.consumaMano(p);
  U.dai(p, 'minecraft:glass_bottle');
  try { e.addTag('vamp_sangue_vampiro'); } catch {}
  U.set(e, 'sire', p.id);
  U.set(e, 'sire_nome', p.name);
  U.set(e, 'sangue_fino', U.giornoAssoluto() + 1);
  U.curaTutto(e);
  U.eff(e, 'regeneration', 200, 1);
  U.fx(e.dimension, 'vamp:sangue', U.add(e.location, U.v3(0, 1.8, 0)));
  U.tell(p, '§4[Sire]§r L\'abitante ha il tuo sangue in corpo (per un giorno). Se muore in questo tempo, §crinascerà vampiro§r e ti sarà fedele (legame del sire).');
}

// ---------------------------------------------------------------- bevande consumate
export function bevuto(p, id) {
  const vamp = S.eVampiro(p), trans = S.inTransizione(p);
  switch (id) {
    case U.I('sacca_sangue'):
      if (trans) { S.diventaVampiro(p, !!U.get(p, 'trans_originale', false)); return; }
      if (vamp) { S.setSangue(p, S.sangue(p) + 6); U.suonoP(p, 'mob.warden.heartbeat', 0.6, 1.2); U.barForte(p, '§4+6 sangue (sacca)'); return; }
      U.eff(p, 'nausea', 200, 0); U.tell(p, '§7Bleah. Sei umano: il sangue non fa per te.'); return;
    case U.I('fiala_vampiro'):
      if (vamp) {
        if (S.squartatore(p) || S.eOriginale(p)) { S.setSangue(p, S.sangue(p) + 3); U.barForte(p, '§4+3 sangue (di vampiro)'); }
        else { U.eff(p, 'nausea', 120, 0); U.barForte(p, '§7Il sangue di vampiro non ti nutre.'); }
        return;
      }
      // lore: il sangue di vampiro guarisce gli umani quasi all'istante
      U.curaTutto(p); U.eff(p, 'regeneration', 200, 2); U.eff(p, 'absorption', 1200, 0);
      U.set(p, 'sangue_corpo', U.GIORNO);
      U.lampo(p, 0.4, 0, 0, 0.1, 0.2, 0.6);
      U.tell(p, '§4[Sangue di vampiro]§r Le ferite si chiudono. Per §eun giorno di gioco§r il sangue di vampiro resta nel tuo corpo: ' +
        'se muori in questo tempo, §crinascerai vampiro§r.');
      return;
    case U.I('infuso_verbena'):
      if (vamp || trans) { bruciaVerbena(p, 6); U.tell(p, '§d[Verbena]§r Hai bevuto verbena: brucia come fuoco e blocca i tuoi poteri per un po\'.'); return; }
      U.set(p, 'verbena', 12000);
      U.tell(p, '§d[Verbena]§r Per 10 minuti nessun vampiro può soggiogarti, e chi ti morde si brucia.');
      return;
    case U.I('tabaccata'): fumata(p); return;
    case U.I('vino'):
      if (!vamp) U.eff(p, 'nausea', 100, 0);
      U.barForte(p, vamp ? '§7Il vino non sazia, ma per un momento la sete tace.' : '§7Un po\' forte...');
      return;
    case U.I('vino_immortalita'):
      if (vamp || trans) { U.tell(p, '§6[Rito]§r Il vino dell\'immortalità funziona solo su un umano.'); return; }
      U.set(p, 'rito', 1200);
      U.lampo(p, 1, 0.8, 0.3, 0.2, 0.5, 1.0);
      U.titolo(p, '§6Il rito è compiuto', '§7Ora devi morire entro 60 secondi.');
      U.tell(p, '§6[Rito dell\'immortalità]§r Il sole, la quercia bianca e il sangue sono dentro di te. Come nell\'antico rito, ' +
        'devi §cmorire entro 60 secondi§r: rinascerai in transizione come §6Originale§r.');
      return;
    case U.I('cura'):
      if (vamp || trans) {
        S.tornaUmano(p, '§b[La Cura]§r Il sangue torna caldo, il cuore batte da solo. §bSei di nuovo umano§r: mortale, e libero.');
        U.titolo(p, '§bUMANO', '§7La Cura ha funzionato.');
        U.lampo(p, 0.9, 0.95, 1, 0.3, 0.5, 1.5);
        U.set(p, 'sangue_corpo', 0);
        return;
      }
      U.tell(p, '§7[La Cura] Non sei un vampiro: la Cura non ha effetto su di te.');
      return;
    default:
      if (vamp && !id.startsWith(U.NS + ':') && U.pronto(p, 200, 'cibo')) {
        U.eff(p, 'nausea', 160, 0);
        U.tell(p, '§7[Vampiro] Il cibo non ti nutre più: ti serve sangue.');
      } else if (vamp && !id.startsWith(U.NS + ':')) U.eff(p, 'nausea', 160, 0);
  }
}

// ---------------------------------------------------------------- TABACCATA DI VERBENA (richiesta di Jowa, 24/11/2026)
// Carta + 2 verbena = 2 tabaccate. Si fuma tenendo premuto.
//   - ORIGINALE: sollievo. La verbena per lui è solo un fastidio: il fumo gli schiarisce la mente, toglie gli effetti negativi
//     e la verbena che aveva in corpo, lo guarisce un po' e gli dà rigenerazione.
//   - VAMPIRO (o in transizione): brucia come l'infuso (danno, debolezza, poteri bloccati).
//   - UMANO: verbena in corpo per 5 minuti (niente soggiogamento, chi lo morde si brucia).
//   - Il FUMO resta intorno per 5 secondi e ferisce i vampiri normali vicini (non gli Originali).
const MALI = ['weakness', 'slowness', 'nausea', 'blindness', 'darkness', 'poison', 'wither', 'mining_fatigue', 'hunger'];
// ---- la tabaccata si porta alla bocca come il cannocchiale: mentre tiri, la brace si accende e esce il fumo viola
const fumando = new Map();
function puntaTabaccata(p, dist = 0.55) {
  let h, d;
  try { h = p.getHeadLocation(); d = p.getViewDirection(); } catch { return undefined; }
  return U.add(h, U.v3(d.x * dist, d.y * dist - 0.12, d.z * dist));
}
export function inizioFumata(p) {
  const id = system.currentTick;
  fumando.set(p.id, id);
  for (let k = 0; k <= 48; k += 3) system.runTimeout(() => U.guard(() => {
    if (fumando.get(p.id) !== id || !U.ok(p) || U.mano(p)?.typeId !== U.I('tabaccata')) return;
    const c = puntaTabaccata(p);
    if (!c) return;
    U.fx(p.dimension, 'vamp:brace', c);
    if (k % 6 === 0) U.fx(p.dimension, 'vamp:fumo_viola', U.add(c, U.v3(0, 0.05, 0)));
    if (k % 12 === 0) U.suono(p.dimension, 'random.fizz', c, 0.15, 1.9);
  }), k);
}
export function fineFumata(p) { fumando.delete(p.id); }
export function fumata(p) {
  fineFumata(p);
  // la boccata: una nuvola di fumo viola che esce dalla bocca e va avanti
  for (let i = 0; i < 6; i++) { const c = puntaTabaccata(p, 0.4 + i * 0.35); if (c) U.fx(p.dimension, 'vamp:fumo_viola', c); }
  const bocca = (() => { try { return p.getHeadLocation(); } catch { return U.add(p.location, U.v3(0, 1.6, 0)); } })();
  U.suono(p.dimension, 'random.fizz', bocca, 0.4, 1.6);
  if (S.eOriginale(p)) {
    for (const e of MALI) U.togliEff(p, e);
    U.set(p, 'bloccato', 0);
    U.cura(p, 8);
    U.eff(p, 'regeneration', 200, 1);
    U.barForte(p, '§6Un tiro di verbena: §7brucia appena, poi ti schiarisce la mente. §6Che sollievo.', 80);
  } else if (S.eVampiro(p) || S.inTransizione(p)) {
    bruciaVerbena(p, 4);
    U.tell(p, '§d[Verbena]§r Il fumo di verbena ti brucia la gola e i polmoni: i poteri non rispondono.');
  } else {
    U.set(p, 'verbena', Math.max(U.get(p, 'verbena', 0), 6000));
    U.barForte(p, '§dHai fumato verbena: §7per 5 minuti nessun vampiro può soggiogarti.', 80);
  }
  // nuvola di fumo: 5 secondi, raggio 3
  for (let k = 0; k < 5; k++) {
    system.runTimeout(() => U.guard(() => {
      if (!U.ok(p)) return;
      const c = U.add(p.location, U.v3(0, 1.4, 0));
      U.fx(p.dimension, 'vamp:verbena', c);
      U.fx(p.dimension, 'vamp:fumo_viola', c);
      for (const e of U.vicini(p.dimension, c, 3)) {
        if (e.id === p.id) continue;
        const vampiro = e.typeId === 'minecraft:player' ? (S.eVampiro(e) && !S.eOriginale(e)) : /^vamp:(vampiro|squartatore)$/.test(e.typeId);
        if (!vampiro) continue;
        U.danno(e, 2, 'magic', p);
        U.eff(e, 'weakness', 80, 0);
        if (e.typeId === 'minecraft:player' && U.pronto(e, 60, 'fumo_verbena')) U.barForte(e, '§dFumo di verbena! §7Ti brucia gli occhi e la gola.', 50);
      }
    }), 20 * k + 1);
  }
}

// abitanti con il sangue del sire che muoiono -> vampiro alleato
export function abitanteMorto(e, dim, loc) {
  let sire, nome, fino;
  try { if (!e.hasTag('vamp_sangue_vampiro')) return; sire = U.get(e, 'sire', ''); nome = U.get(e, 'sire_nome', ''); fino = U.get(e, 'sangue_fino', 0); } catch { return; }
  if (U.giornoAssoluto() > fino) return;
  system.runTimeout(() => U.guard(() => {
    const v = dim.spawnEntity(U.I('vampiro'), loc);
    U.fx(dim, 'vamp:fumo_nero', U.add(loc, U.v3(0, 1, 0)));
    U.suono(dim, 'mob.zombie.unfect', loc, 1, 0.7);
    const padrone = world.getPlayers().find((p) => p.id === sire);
    rendiAlleato(v, padrone, sire);
    if (padrone) U.tell(padrone, `§4[Sire]§r L'abitante è rinato vampiro: ti è legato e ti seguirà.`);
    else if (nome) v.nameTag = '§7Sireato di ' + nome;
  }), 60);
}

export function rendiAlleato(v, padrone, idPadrone) {
  nuovoSeguace(v, padrone);
  U.set(v, 'padrone', idPadrone || padrone?.id || '');
  if (padrone) { try { v.getComponent('minecraft:tameable')?.tame(padrone); } catch {} }
  try { v.triggerEvent(U.I('diventa_alleato')); } catch {}
}

// ---------------------------------------------------------------- MIRINO A CANINI e PASTO CONTINUO
// Guardando un umano da vicino compare una piccola icona di canini davanti a lui (la vedi solo tu).
// Quando lo mordi (colpo a mano vuota, senza accovacciarti) l'icona diventa rossa e, finché continui a guardarlo
// da vicino, bevi da solo (un sorso al secondo). Ti fermi guardando altrove, allontanandoti, prendendo un oggetto
// in mano o quando sei sazio.
const pasti = new Map();                                   // id giocatore -> { id della preda, tick dell'ultimo sorso }
const MORSO = U.I('potere_morso');
export const staBevendo = (p) => pasti.has(p.id);
function testa(e) { try { return e.getHeadLocation(); } catch { return U.add(e.location, U.v3(0, 1.6, 0)); } }
/** punto davanti alla faccia del mob, verso gli occhi del giocatore */
function davanti(p, e) {
  const h = testa(e), o = testa(p), d = U.sub(o, h), l = Math.hypot(d.x, d.y, d.z) || 1;
  return U.add(h, U.mul(d, Math.min(0.6, l / 2) / l));
}
// vampiro: deve avere in mano il MORSO (scelto dalla ruota); in transizione: mano vuota
const pronto = (p) => (S.eVampiro(p) ? U.mano(p)?.typeId === MORSO : !U.mano(p));
/** la preda: quella che guardi da vicino, altrimenti la creatura con sangue più vicina (entro 2,5 blocchi) */
function preda(p) {
  const g = U.guardata(p, 3.5);
  if (g && tipoSangue(g) && !eMio(p, g)) return g;
  return U.vicini(p.dimension, p.location, 2.5).filter((e) => e.id !== p.id && tipoSangue(e) && !eMio(p, e))
    .sort((a, b) => U.dist(a.location, p.location) - U.dist(b.location, p.location))[0];
}
/** abilità MORSO (dalla ruota): avvicinati e tocca l'oggetto del morso: cominci a bere e continui finché resti vicino */
export function iniziaMorso(p) {
  const e = preda(p);
  if (!e) { U.barForte(p, '§7Avvicinati a una creatura con il sangue.'); return; }
  morso(p, e);
}

export function tickMirino() {
  for (const p of world.getPlayers()) {
    const vamp = S.eVampiro(p) || S.inTransizione(p);
    const pasto = pasti.get(p.id);
    if (pasto) {
      const e = world.getEntity(pasto.id);
      if (!vamp || !U.ok(e) || !pronto(p) || U.dist(e.location, p.location) > 3.5) { pasti.delete(p.id); continue; }
      U.fxP(p, 'vamp:canini_rosso', davanti(p, e));
      if (system.currentTick - pasto.t < 20) continue;
      pasto.t = system.currentTick;
      if (S.eVampiro(p) && S.sangue(p) >= S.SANGUE_MAX - 0.5 && S.umanita(p)) { pasti.delete(p.id); U.barForte(p, '§7Sei sazio. Lo lasci andare.', 40); continue; }
      morso(p, e);
      continue;
    }
    if (!vamp || !pronto(p) || U.get(p, 'in_pipistrello', false)) continue;
    const e = preda(p);
    const t = e ? tipoSangue(e) : '';
    if (t === 'umano' || t === 'animale') U.fxP(p, 'vamp:canini', davanti(p, e));
  }
}
