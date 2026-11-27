// Sangue Immortale — l'Altare dei rituali (un BLOCCO: si piazza e si rompe come un banco da lavoro).
// È l'unica "magia" della mod e serve solo dove la lore dei vampiri la richiede:
//   1) Anello diurno: anello con lapislazzuli messo sotto la luce del sole (lore: anello diurno)
//   2) Rito dell'immortalità: vino con sangue umano, a mezzogiorno, vicino alla quercia bianca
//   3) Risveglio dell'Antico: a mezzanotte, il pugnale con la cenere di quercia bianca: dalla terra sale una bara
//      e l'Originale che vi dormiva essiccato si risveglia
//   4) Argento: "Ferro con cenere di quercia bianca" sull'altare -> il ferro fonde con la cenere e diventa Lingotto d'argento;
//      poi, con l'argento sull'altare, tocca con un paletto (di legno o di quercia bianca) -> Paletto d'argento INDISTRUTTIBILE
//   5) Rito della stirpe: a MEZZANOTTE, il Sangue di cacciatore vicino a una QUERCIA BIANCA -> chi lo offre (vampiro)
//      sale di un'età: Neonato -> Giovane -> Adulto -> Antico -> Millenario. È l'unico modo per diventare più potente.
//   7) GIURAMENTO DEL CACCIATORE (1.5.0): da UMANO, di NOTTE, con la VERBENA in corpo, offri il Sangue di cacciatore
//      -> diventi Cacciatore di vampiri (Diario del cacciatore, Determinazione, gradi). Un vampiro con lo stesso sangue fa il rito della stirpe.
//   8) SANTA BOMBA (uovo Fabergé, 1.5.0): posi il GUSCIO D'ORO sull'altare -> si apre come un uovo; tocchi l'altare con
//      LA CURA -> la Cura scende nel guscio, che si richiude in 8 secondi di luce -> tocchi l'altare e prendi la SANTA BOMBA.
//      Lo stato del blocco vamp:uovo dice a che punto è: 0 niente, 1 si apre, 2 aperto, 3 con la Cura (rito), 4 bomba finita.
//   6) Anello del varco: l'Anello d'argento con ametista sull'altare in una NOTTE DI ECLISSI (luna nuova)
//      -> Anello del varco, a uso illimitato (solo l'Originale può usarlo).
// L'offerta e il rito in corso sono STATI del blocco (vamp:offerta, vamp:rito); il resto (progresso, chi l'ha
// cominciato, quercia trovata) sta in un elenco salvato nel mondo, una voce per altare.
import { world, system, ItemStack } from '@minecraft/server';
import * as U from './util.js';
import * as S from './stato.js';
import { eclissi, notti } from './varco.js';
import * as C from './cacciatore.js';

export const ID = U.I('altare');
// offerta: 0 niente, 1 anello con lapislazzuli, 2 vino del rito, 3 pugnale con cenere, 4 anello diurno, 5 vino dell'immortalità,
//          6 pugnale, 7 ferro con cenere (fonde), 8 lingotto d'argento, 9 argento + paletto (rito), 10 argento + paletto di quercia (rito),
//          11 paletto d'argento, 12 paletto d'argento e quercia bianca, 13 sangue di cacciatore (rito della stirpe),
//          14 anello d'argento con ametista (rito dell'eclissi), 15 anello del varco
const OFFERTE = { [U.I('anello_lapis')]: 1, [U.I('vino_rito')]: 2, [U.I('pugnale_cenere')]: 3, [U.I('lega_argento')]: 7, [U.I('sangue_cacciatore')]: 13, [U.I('anello_ametista')]: 14 };
const SU_ARGENTO = { [U.I('paletto')]: 9, [U.I('paletto_quercia')]: 10 };   // paletto toccato sull'argento
const OGGETTO = { 1: U.I('anello_lapis'), 2: U.I('vino_rito'), 3: U.I('pugnale_cenere'), 4: U.I('anello_diurno'), 5: U.I('vino_immortalita'), 6: U.I('pugnale'),
  7: U.I('lega_argento'), 8: U.I('argento'), 11: U.I('paletto_argento'), 12: U.I('paletto_argento_quercia'), 13: U.I('sangue_cacciatore'), 14: U.I('anello_ametista'), 15: U.I('anello_varco'), 16: U.I('sangue_cacciatore') };
const CADE = { ...Object.fromEntries(Object.entries(OGGETTO).map(([k, v]) => [k, [v]])),
  9: [U.I('argento'), U.I('paletto')], 10: [U.I('argento'), U.I('paletto_quercia')] };       // cosa cade se rompi l'altare
const DURATA = { 1: 10, 2: 15, 3: 8, 7: 8, 9: 10, 10: 10, 13: 12, 14: 15, 16: 12 };                 // secondi di rito
const METALLO = new Set([7, 9, 10]);                                        // riti dell'argento: niente condizioni, non si interrompono
/** l'oggetto restituito: i paletti d'argento non si perdono nemmeno morendo */
function oggettoDi(n) {
  const s = new ItemStack(OGGETTO[n], 1);
  if (n === 11 || n === 12) { try { s.keepOnDeath = true; } catch {} }
  return s;
}
function dai(p, n) {
  const s = oggettoDi(n);
  let resto;
  try { resto = U.inv(p)?.addItem(s); } catch { resto = s; }
  if (resto) { try { p.dimension.spawnItem(resto, p.location); } catch {} }
}

// ---------------------------------------------------------------- elenco degli altari nel mondo
const chiave = (dim, l) => `${dim.id}|${l.x}|${l.y}|${l.z}`;
const elenco = () => U.wGetJ('altari', {});
const salva = (e) => U.wSetJ('altari', e);
function dati(b) { return elenco()[chiave(b.dimension, b.location)] ?? { progresso: 0, chi: '', quercia: false }; }
function setDati(b, d) { const e = elenco(); e[chiave(b.dimension, b.location)] = d; salva(e); }
function registra(b) { const e = elenco(), k = chiave(b.dimension, b.location); if (!e[k]) { e[k] = { progresso: 0, chi: '', quercia: false }; salva(e); } }
function dimentica(dim, l) { const e = elenco(); delete e[chiave(dim, l)]; salva(e); }

const stato = (b, k, def) => { try { return b.permutation.getState(U.I(k)) ?? def; } catch { return def; } };
function setStato(b, k, v) { try { b.setPermutation(b.permutation.withState(U.I(k), v)); } catch {} }
const centro = (b) => U.add(b.location, U.v3(0.5, 0.9, 0.5));

// ---------------------------------------------------------------- l'uovo della Santa Bomba
export const GUSCIO = U.I('guscio_bomba');
const DURATA_UOVO = 8;
function dai1(p, id) {
  const st = new ItemStack(id, 1);
  let resto;
  try { resto = U.inv(p)?.addItem(st); } catch { resto = st; }
  if (resto) { try { p.dimension.spawnItem(resto, p.location); } catch {} }
}
function toccaUovo(p, b, uovo, s) {
  const dim = b.dimension, loc = centro(b);
  if (uovo === 0) {                                             // posa il guscio: si apre come un uovo Fabergé
    U.consumaMano(p);
    setStato(b, 'uovo', 1);
    setDati(b, { progresso: 0, chi: p.id, quercia: false });
    U.suono(dim, 'random.chestopen', loc, 0.8, 1.6);
    U.suono(dim, 'block.end_portal_frame.fill', loc, 0.6, 1.4);
    U.barForte(p, '§6Il guscio d\'oro si schiude come un uovo prezioso... §7Mettici dentro §bLa Cura§7.', 100);
    return;
  }
  if (uovo === 1) { U.barForte(p, '§6Il guscio si sta aprendo...', 40); return; }
  if (uovo === 2) {
    if (s?.typeId === U.I('cura')) {                            // la Cura scende nel guscio
      U.consumaMano(p);
      setStato(b, 'uovo', 3);
      setStato(b, 'rito', true);
      setDati(b, { progresso: 0, chi: p.id, quercia: false });
      U.suono(dim, 'bottle.empty', loc, 1, 0.8);
      U.suono(dim, 'beacon.activate', loc, 0.8, 1.2);
      U.barForte(p, '§bLa Cura scende nel guscio.§e Il guscio si richiude nella luce...', 100);
      return;
    }
    setStato(b, 'uovo', 0);                                     // a mano (o con altro): riprendi il guscio vuoto
    setDati(b, { progresso: 0, chi: '', quercia: false });
    dai1(p, GUSCIO);
    U.suono(dim, 'random.chestclosed', loc, 0.8, 1.4);
    U.barForte(p, '§7Hai ripreso il guscio vuoto. §8(Per la Santa Bomba toccalo con La Cura.)', 80);
    return;
  }
  if (uovo === 3) { U.barForte(p, '§eLa luce sta entrando nel guscio: aspetta.', 40); return; }
  setStato(b, 'uovo', 0);                                       // 4: la Santa Bomba è pronta
  setStato(b, 'rito', false);
  setDati(b, { progresso: 0, chi: '', quercia: false });
  dai1(p, U.I('santa_bomba'));
  U.suono(dim, 'random.levelup', loc, 0.8, 1.6);
  U.titolo(p, '§eSanta Bomba a mano', '§7Lanciala: la luce cura gli umani e brucia i vampiri.');
}
function tickUovo(b, uovo) {
  const dim = b.dimension, loc = centro(b);
  if (uovo === 1) { setStato(b, 'uovo', 2); U.suono(dim, 'random.chestopen', loc, 0.6, 1.9); U.fx(dim, 'vamp:sole', loc); return; }
  if (uovo === 2) { if (system.currentTick % 60 === 0) U.fx(dim, 'vamp:sole', loc); return; }
  if (uovo !== 3) { if (uovo === 4) U.fx(dim, 'vamp:luce_santa', U.add(loc, U.v3(0, 0.4, 0))); return; }
  const d = dati(b);
  d.progresso = (d.progresso ?? 0) + 1;
  setDati(b, d);
  for (let i = 0; i < 3; i++) U.fx(dim, 'vamp:luce_santa', U.add(loc, U.v3(0, 0.3 + i * 0.4, 0)));
  U.suono(dim, 'block.enchanting_table.use', loc, 0.6, 1.2 + d.progresso * 0.05);
  if (d.progresso < DURATA_UOVO) return;
  setStato(b, 'uovo', 4);
  setStato(b, 'rito', false);
  for (let y = 0; y < 8; y++) U.fx(dim, 'vamp:raggio_santo', U.add(loc, U.v3(0, y, 0)));
  U.suono(dim, 'beacon.power', loc, 1, 1.5);
  U.suono(dim, 'random.chestclosed', loc, 0.8, 1.2);
  for (const q of U.vicini(dim, loc, 16, { type: 'minecraft:player' }))
    U.barForte(q, '§eIl guscio si è richiuso con la Cura dentro: è la §6Santa Bomba a mano§e. Tocca l\'altare per prenderla.', 120);
}

/** chiamato dal componente del blocco quando lo tocchi */
export function tocca(p, b) {
  if (!b || b.typeId !== ID) return;
  registra(b);
  const off = stato(b, 'offerta', 0), s = U.mano(p), uovo = stato(b, 'uovo', 0);
  if (uovo > 0 || (off === 0 && s?.typeId === GUSCIO)) { toccaUovo(p, b, uovo, s); return; }
  if (off === 8 && s && SU_ARGENTO[s.typeId]) {            // paletto sull'argento: comincia il rivestimento
    U.consumaMano(p);
    setStato(b, 'offerta', SU_ARGENTO[s.typeId]);
    setDati(b, { progresso: 0, chi: p.id, quercia: false });
    U.suono(b.dimension, 'random.anvil_use', centro(b), 0.6, 0.8);
    U.barForte(p, "§7L'argento fuso avvolge il paletto...", 100);
    return;
  }
  if (off === 0) {
    let n = s ? OFFERTE[s.typeId] : undefined;
    if (!n) {
      U.barForte(p, '§5Altare: offri un §9Anello con lapislazzuli§5, il §cVino del rito§5, il §fPugnale con cenere§5, il §7Ferro con cenere§5, il §cSangue di cacciatore§5 (da umano: giuramento del cacciatore), l\'§dAnello con ametista§5 o il §6Guscio d\'oro§5 della Santa Bomba.', 100);
      return;
    }
    if (n === 13 && !S.eVampiro(p)) {                       // da umano lo stesso sangue è il GIURAMENTO DEL CACCIATORE
      if (S.inTransizione(p)) { U.barForte(p, '§7Sei in transizione: non puoi giurare.'); return; }
      if (C.eCacciatore(p)) { U.barForte(p, '§7Hai già giurato: sei un cacciatore.'); return; }
      n = 16;
    }
    if (n === 13) {                                         // rito della stirpe: solo un vampiro che può ancora crescere
      if (S.eOriginale(p)) { U.barForte(p, '§6Un Originale è già al massimo: il sangue dei cacciatori non ti serve.'); return; }
      if (S.livello(p) >= 5) { U.barForte(p, '§7Sei già §fMillenario§7: più antico di così non si diventa.'); return; }
    }
    U.consumaMano(p);
    // il blocco ha solo gli stati 0..15: il giuramento (16) sta sull'altare come "sangue di cacciatore" (13) + un segno nei dati
    setStato(b, 'offerta', n === 16 ? 13 : n);
    setDati(b, { progresso: 0, chi: p.id, quercia: false, giuramento: n === 16 });
    U.suono(b.dimension, 'block.end_portal_frame.fill', centro(b), 0.8, 0.8);
    const cond = condizione(b, n);
    U.barForte(p, cond ? '§5' + cond : '§5Il rito comincia...', 100);
    return;
  }
  // c'è già qualcosa: lo riprendi (finito o no)
  if (METALLO.has(off)) { U.barForte(p, '§7Il metallo sta ancora fondendo: aspetta.'); return; }
  if (stato(b, 'rito', false) && (off <= 3 || off === 13 || off === 14 || off === 16)) { U.barForte(p, '§5Il rito è in corso: aspetta.'); return; }
  if (off === 8) U.barForte(p, "§7Lingotto d'argento ripreso. §8(Toccando l'altare con un paletto lo rivesti d'argento.)", 80);
  setStato(b, 'offerta', 0);
  setStato(b, 'rito', false);
  setDati(b, { progresso: 0, chi: '', quercia: false });
  dai(p, off);
  U.suono(b.dimension, 'random.pop', centro(b), 0.8, 0.9);
}

/** altare rotto: cade anche l'offerta che c'era sopra (l'altare stesso lo lascia il gioco) */
export function rotto(dim, loc, permutazione) {
  let off = 0, uovo = 0;
  try { off = permutazione?.getState(U.I('offerta')) ?? 0; } catch {}
  try { uovo = permutazione?.getState(U.I('uovo')) ?? 0; } catch {}
  const uova = { 1: [GUSCIO], 2: [GUSCIO], 3: [GUSCIO, U.I('cura')], 4: [U.I('santa_bomba')] }[uovo] ?? [];
  for (const id of [...(CADE[off] ?? []), ...uova]) {
    const s = new ItemStack(id, 1);
    if (/paletto_argento/.test(id)) { try { s.keepOnDeath = true; } catch {} }
    try { dim.spawnItem(s, U.add(loc, U.v3(0.5, 0.5, 0.5))); } catch {}
  }
  dimentica(dim, loc);
}
export function piazzato(b) { if (b?.typeId === ID) registra(b); }

function vicinoQuercia(dim, loc, r = 8) {
  const f = U.floor(loc);
  for (let dy = -3; dy <= 8; dy++) for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
    if (U.blk(dim, U.v3(f.x + dx, f.y + dy, f.z + dz))?.typeId === U.I('quercia_bianca')) return true;
  }
  return false;
}

/** testo con quello che manca, oppure '' se il rito può andare avanti */
function condizione(b, n) {
  const ora = U.t(), dim = b.dimension;
  const cielo = U.cieloAperto(dim, b.location, 1.3);
  if (n === 1) {
    if (!U.eGiorno(ora)) return 'Serve la luce del sole: aspetta il giorno.';
    if (!cielo) return 'Il sole deve toccare l\'anello: sopra l\'altare ci vuole il cielo aperto.';
    return '';
  }
  if (n === 2) {
    if (ora < 5000 || ora > 7000) return 'Il rito dell\'immortalità si compie a mezzogiorno (quando il sole è più alto).';
    if (!cielo) return 'Il sole deve vedere il calice: sopra l\'altare ci vuole il cielo aperto.';
    const d = dati(b);
    if (!d.quercia) {
      if (!vicinoQuercia(dim, b.location)) return 'Serve una §equercia bianca§5 entro 8 blocchi dall\'altare.';
      d.quercia = true; setDati(b, d);
    }
    return '';
  }
  if (n === 14) {
    if (!U.eNotte(ora)) return 'Il varco si apre solo di §fnotte§5, in una notte di eclissi.';
    if (!eclissi()) { const k = notti(); return `Serve una §fnotte di eclissi§5 (luna nuova, la luna sparisce): ${k === 1 ? 'manca 1 notte' : 'mancano ' + k + ' notti'}.`; }
    if (!cielo) return 'L\'eclissi deve vedere l\'anello: sopra l\'altare ci vuole il cielo aperto.';
    return '';
  }
  if (n === 13) {
    if (ora < 17000 || ora > 19000) return 'Il rito della stirpe si compie a §fmezzanotte§5.';
    const d = dati(b);
    if (!d.quercia) {
      if (!vicinoQuercia(dim, b.location)) return 'Serve una §equercia bianca§5 entro 8 blocchi dall\'altare.';
      d.quercia = true; setDati(b, d);
    }
    return '';
  }
  if (n === 16) {
    if (!U.eNotte(ora)) return 'Il giuramento del cacciatore si fa di §fnotte§5, l\'ora dei vampiri.';
    const chi = world.getPlayers().find((q) => q.id === dati(b).chi);
    if (!chi) return 'Chi giura deve restare vicino all\'altare.';
    if (U.dist(chi.location, centro(b)) > 8) return 'Chi giura deve restare entro 8 blocchi dall\'altare.';
    if (!S.verbenaInCorpo(chi)) return 'Chi giura deve avere la §dverbena§5 in corpo: bevi un §dInfuso di verbena§5.';
    return '';
  }
  if (n === 3) {
    if (ora < 17000 || ora > 19000) return 'Il risveglio dell\'Antico si compie a mezzanotte.';
    if (dim.id !== 'minecraft:overworld') return 'Solo nel mondo normale.';
    return '';
  }
  return '';
}

function compiuto(b, n) {
  const dim = b.dimension, loc = centro(b), d = dati(b), chi = world.getPlayers().find((p) => p.id === d.chi);
  setStato(b, 'rito', false);
  setDati(b, { progresso: 0, chi: d.chi, quercia: false });
  if (n === 1) {
    setStato(b, 'offerta', 4);
    U.suono(dim, 'beacon.power', loc, 1, 1.4);
    for (let i = 0; i < 4; i++) U.fx(dim, 'vamp:sole', U.add(loc, U.v3(0, 0.3 + i * 0.3, 0)));
    for (const p of U.vicini(dim, loc, 16, { type: 'minecraft:player' })) U.barForte(p, '§eL\'anello ha catturato la luce del sole: è un §6Anello diurno§e. Tocca l\'altare per prenderlo.', 100);
  } else if (n === 2) {
    setStato(b, 'offerta', 5);
    U.suono(dim, 'beacon.activate', loc, 1, 0.6);
    for (let i = 0; i < 6; i++) U.fx(dim, 'vamp:sole', U.add(loc, U.v3(0, 0.2 + i * 0.4, 0)));
    for (const p of U.vicini(dim, loc, 16, { type: 'minecraft:player' }))
      U.tell(p, '§6[Rito]§r Il vino ha preso la vita del sole e l\'eternità della quercia bianca: è il §6Vino dell\'immortalità§r. ' +
        'Bevilo da umano, poi muori entro 60 secondi.');
  } else if (n === 3) {
    setStato(b, 'offerta', 6);
    risveglio(dim, U.add(b.location, U.v3(0.5, 0, 0.5)), chi);
  } else if (n === 7) {
    setStato(b, 'offerta', 8);
    U.suono(dim, 'random.anvil_land', loc, 0.7, 1.4);
    for (let i = 0; i < 4; i++) U.fx(dim, 'vamp:braci', U.add(loc, U.v3(0, 0.3 + i * 0.2, 0)));
    for (const p of U.vicini(dim, loc, 16, { type: 'minecraft:player' }))
      U.barForte(p, "§fIl ferro e la cenere sono diventati §7argento§f. §8Tocca l'altare con un paletto per rivestirlo, o a mano per prenderlo.", 120);
  } else if (n === 14) {
    setStato(b, 'offerta', 15);
    U.suono(dim, 'portal.travel', loc, 0.4, 0.5);
    for (let i = 0; i < 6; i++) U.fx(dim, 'vamp:fumo_denso', U.add(loc, U.v3(0, 0.3 + i * 0.3, 0)));
    for (const p of U.vicini(dim, loc, 16, { type: 'minecraft:player' }))
      U.barForte(p, '§5Nel buio dell\'eclissi l\'ametista si è spenta: è l\'§dAnello del varco§5. Tocca l\'altare per prenderlo.', 120);
  } else if (n === 13) {
    setStato(b, 'offerta', 0);                              // il sangue è stato bevuto dal rito
    U.suono(dim, 'mob.warden.heartbeat', loc, 1, 0.6);
    U.suono(dim, 'beacon.power', loc, 0.8, 0.5);
    for (let i = 0; i < 6; i++) U.fx(dim, 'vamp:sangue', U.add(loc, U.v3(0, 0.2 + i * 0.3, 0)));
    if (chi && S.cresci(chi)) U.fx(dim, 'vamp:rito', U.add(chi.location, U.v3(0, 1, 0)));
    else if (chi) U.barForte(chi, '§7Il rito si è compiuto, ma non puoi diventare più antico.');
  } else if (n === 16) {
    setStato(b, 'offerta', 0);                              // il sangue è stato versato nel giuramento
    U.suono(dim, 'beacon.activate', loc, 1, 0.7);
    for (let i = 0; i < 6; i++) U.fx(dim, 'vamp:sole', U.add(loc, U.v3(0, 0.2 + i * 0.3, 0)));
    if (chi && !C.diventaCacciatore(chi)) U.barForte(chi, '§7Il giuramento non ha preso: un vampiro non può essere cacciatore.');
  } else if (n === 9 || n === 10) {
    setStato(b, 'offerta', n === 9 ? 11 : 12);
    U.suono(dim, 'random.anvil_use', loc, 1, 1.2);
    U.suono(dim, 'beacon.power', loc, 0.8, 1.6);
    for (let i = 0; i < 5; i++) U.fx(dim, 'vamp:sole', U.add(loc, U.v3(0, 0.2 + i * 0.3, 0)));
    for (const p of U.vicini(dim, loc, 16, { type: 'minecraft:player' }))
      U.barForte(p, `§fÈ pronto il §7${n === 9 ? "Paletto d'argento" : "Paletto d'argento e quercia bianca"}§f: indistruttibile. Tocca l'altare per prenderlo.`, 120);
  }
}

function risveglio(dim, loc, chi) {
  const dir = chi ? U.norm2d(U.sub(chi.location, loc)) : U.v3(1, 0, 0);
  const posto = U.add(loc, U.v3(-dir.z * 3, 0, dir.x * 3));
  let bara;
  U.guard(() => { bara = dim.spawnEntity(U.I('bara'), posto); });
  U.suono(dim, 'mob.wither.spawn', posto, 0.7, 0.5);
  for (const p of U.vicini(dim, loc, 48, { type: 'minecraft:player' })) {
    U.titolo(p, '§6Il risveglio', '§7Il pugnale è stato tolto. Qualcosa si muove nella bara...');
  }
  for (let i = 0; i < 8; i++) U.fx(dim, 'vamp:fumo_nero', U.add(posto, U.v3(0, 0.5, 0)));
  system.runTimeout(() => U.guard(() => { if (U.ok(bara)) { U.setProp(bara, 'vamp:aperta', true); U.suono(dim, 'random.door_open', posto, 1, 0.4); } }), 50);
  system.runTimeout(() => U.guard(() => {
    dim.spawnEntity(U.I('originale'), U.add(posto, U.v3(0, 0.8, 0)));
    U.fx(dim, 'vamp:sangue', U.add(posto, U.v3(0, 1.5, 0)));
    U.suono(dim, 'mob.warden.emerge', posto, 1, 0.8);
    for (const p of U.vicini(dim, loc, 48, { type: 'minecraft:player' })) {
      U.tell(p, '§6Antico Originale:§r «Mille anni in una bara. Chi osa svegliarmi?»');
      U.tell(p, '§8[Consiglio] Solo il §epaletto di quercia bianca§8 lo uccide. Il §fpugnale con cenere§8 lo essicca per qualche secondo. La §dverbena§8 lo ferisce.');
    }
  }), 80);
  system.runTimeout(() => U.guard(() => { if (U.ok(bara)) bara.remove(); }), 20 * 60);
}

/** ogni secondo: avanza i riti in corso (solo altari con un'offerta da trasformare, in chunk caricati) */
const avvisi = new Map();
export function tickAltari() {
  for (const k of Object.keys(elenco())) {
    const [d, x, y, z] = k.split('|');
    let dim;
    try { dim = world.getDimension(d); } catch { continue; }
    const b = U.blk(dim, U.v3(+x, +y, +z));
    if (!b) continue;                                               // chunk non caricato
    if (b.typeId !== ID) { dimentica(dim, U.v3(+x, +y, +z)); continue; }   // altare sparito
    const uovo = stato(b, 'uovo', 0);
    if (uovo > 0) { tickUovo(b, uovo); continue; }
    const n0 = stato(b, 'offerta', 0), n = n0 === 13 && dati(b).giuramento ? 16 : n0;
    if (!DURATA[n]) continue;
    const manca = condizione(b, n);
    if (manca) {
      if (stato(b, 'rito', false)) setStato(b, 'rito', false);
      if (system.currentTick - (avvisi.get(k) ?? -1e9) > 200) {
        avvisi.set(k, system.currentTick);
        for (const q of U.vicini(dim, centro(b), 8, { type: 'minecraft:player' })) U.barForte(q, '§5' + manca, 80);
      }
      continue;
    }
    if (!stato(b, 'rito', false)) setStato(b, 'rito', true);
    const dd = dati(b);
    dd.progresso = (dd.progresso ?? 0) + 1;
    setDati(b, dd);
    U.fx(dim, METALLO.has(n) ? 'vamp:braci' : 'vamp:rito', centro(b));
    if (n === 1) U.fx(dim, 'vamp:sole', U.add(centro(b), U.v3(0, 1.5, 0)));
    if (dd.progresso % 3 === 0) U.suono(dim, 'block.enchanting_table.use', centro(b), 0.6, 0.7 + dd.progresso * 0.03);
    if (dd.progresso >= DURATA[n]) compiuto(b, n);
  }
}
