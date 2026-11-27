// Sangue Immortale — MAPPA TUTORIAL (1.4.0, richiesta di Jowa del 25/11/2026).
// Una piazza con la Guida e 8 stazioni intorno (cartelli, casse con gli oggetti, dimostrazioni vive) + i 4 villaggi agli angoli.
//   - Nel mondo "Tutorial Sangue Immortale" (mondo piatto con uno strato di deepslate sotto la terra) si costruisce DA SOLO
//     la prima volta che entri.
//   - In qualsiasi altro mondo: /scriptevent vamp:tutorial  (lo costruisce intorno a te; meglio in un mondo piatto).
// Pianta (dalla piazza, al centro):
//      [Originale]                 [Cacciatori]       villaggi a ±48 blocchi
//         1 Vampiro   2 Istinto   3 Sole e anelli
//         8 Armi/bara   PIAZZA    4 Verbena e quercia
//         7 Sedia      6 Cerchio  5 Altare e riti
//      [Umano]                     [Vampiri]
import { world, system, ItemStack } from '@minecraft/server';
import * as U from './util.js';
import * as Vil from './villaggi.js';
import * as M from './mondo.js';
import * as Sed from './sedia.js';
import * as Cer from './cerchio.js';

const cmd = (dim, c) => { try { dim.runCommand(c); return true; } catch { return false; } };
const riempi = (dim, a, b, blocco, modo = '') => cmd(dim, `fill ${a.x} ${a.y} ${a.z} ${b.x} ${b.y} ${b.z} ${blocco}${modo ? ' ' + modo : ''}`);
const metti = (dim, l, blocco) => cmd(dim, `setblock ${l.x} ${l.y} ${l.z} ${blocco}`);

/** cartello con lo stesso testo davanti e dietro (così si legge da tutte e due le parti) */
function cartello(dim, l, testo) {
  metti(dim, l, 'standing_sign');
  try {
    const s = dim.getBlock(l)?.getComponent('minecraft:sign');
    s?.setText(testo, 'Front'); s?.setText(testo, 'Back'); s?.setWaxed?.(true);
  } catch {}
}
function cassa(dim, l, oggetti) {
  metti(dim, l, 'chest');
  let c;
  try { c = dim.getBlock(l)?.getComponent('minecraft:inventory')?.container; } catch {}
  for (const [id, n, nome] of oggetti) {
    try { const s = new ItemStack(id, n); if (nome) s.nameTag = nome; c?.addItem(s); } catch {}
  }
}
const I = U.I;

// ---------------------------------------------------------------- le 8 stazioni
const STAZIONI = [
  { dx: -20, dz: -20, titolo: '§4§l1 Diventare\n§4§lvampiro', cartelli: [
    'Bevi una §4Fiala\ndi sangue di\nvampiro, poi\nmuori (lava qui)',
    'Rinasci in\n§4transizione§r:\nmordi l\'abitante\na mano vuota',
    'Scorciatoia:\n/scriptevent\nvamp:vampiro\n(o originale)'],
    oggetti: [[I('fiala_vampiro'), 3], [I('sacca_sangue'), 4], [I('cura'), 1], [I('guida'), 1]],
    extra: (dim, c) => {
      riempi(dim, U.v3(c.x + 2, c.y - 1, c.z - 3), U.v3(c.x + 3, c.y - 1, c.z - 2), 'lava');                 // per morire in fretta
      riempi(dim, U.v3(c.x + 1, c.y, c.z - 4), U.v3(c.x + 4, c.y, c.z - 1), 'oak_fence', 'hollow');
      cmd(dim, `fill ${c.x + 2} ${c.y} ${c.z - 3} ${c.x + 3} ${c.y} ${c.z - 2} air`);
      riempi(dim, U.v3(c.x - 4, c.y, c.z + 1), U.v3(c.x - 1, c.y, c.z + 4), 'oak_fence', 'hollow');          // recinto con un abitante
      abitanteFermo(dim, U.v3(c.x - 2.5, c.y, c.z + 2.5));
    } },
  { dx: 0, dz: -20, titolo: '§4§l2 Istinto e\n§4§labilità', cartelli: [
    'Da vampiro hai\nl\'§4Istinto§r: tocca\ne scegli una\ndelle 13 abilità',
    'L\'abilità va\n§1accanto§r\nall\'Istinto:\ntoccala e usala',
    'Ritoccala\nnell\'elenco per\ntoglierla',
    '§4Morso§r: sceglilo,\navvicinati a un\numano e tocca.\nBevi da solo'],
    oggetti: [[I('sacca_vuota'), 8], ['minecraft:bread', 8]],
    extra: (dim, c) => { riempi(dim, U.v3(c.x - 4, c.y, c.z + 1), U.v3(c.x - 1, c.y, c.z + 4), 'oak_fence', 'hollow'); abitanteFermo(dim, U.v3(c.x - 2.5, c.y, c.z + 2.5)); abitanteFermo(dim, U.v3(c.x - 1.8, c.y, c.z + 3.2)); } },
  { dx: 20, dz: -20, titolo: '§6§l3 Sole e\n§6§lanelli', cartelli: [
    'Di giorno, sotto\nil cielo, il\nvampiro §4brucia§r.\nAll\'ombra no',
    '§1Anello diurno§r:\nin tasca, mano\nsinistra o\n§1indossato§r',
    'Si fa §1qui§r:\nanello e lapis\nsull\'altare, di\ngiorno, al sole'],
    oggetti: [[I('anello_lapis'), 1], [I('anello_diurno'), 1], [I('medaglione'), 1], ['minecraft:lapis_lazuli', 4], ['minecraft:gold_ingot', 6]],
    extra: (dim, c) => { metti(dim, U.v3(c.x - 3, c.y, c.z + 3), I('altare')); riempi(dim, U.v3(c.x + 1, c.y + 3, c.z + 1), U.v3(c.x + 4, c.y + 3, c.z + 4), 'dark_oak_planks'); } },
  { dx: 20, dz: 0, titolo: '§5§l4 Verbena e\n§2§lquercia bianca', cartelli: [
    '§5Verbena§r: brucia\ni vampiri.\nInfuso = vetro\n+ 2 verbena',
    '§5Tabaccata§r:\ncarta+2 verbena\nOriginale: bene\nvampiro: brucia',
    '§2Quercia bianca§r:\n4 ghiande in 2x2\ncome la quercia\nscura',
    'Fornace: legno\n= §1cenere§r.\nLegno+bastone =\npaletto quercia'],
    oggetti: [[I('verbena'), 16], [I('ghianda'), 8], ['minecraft:paper', 8], ['minecraft:glass_bottle', 4], [I('tabaccata'), 4], [I('infuso_verbena'), 2], [I('granata_verbena'), 4], ['minecraft:bone_meal', 16]],
    extra: (dim, c) => {
      for (const [dx, dz] of [[-3, -3], [-2, -3], [-3, -2], [-1, -4]]) metti(dim, U.v3(c.x + dx, c.y, c.z + dz), I('verbena_pianta'));
      const q = U.v3(c.x + 2, c.y, c.z + 2);
      for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) metti(dim, U.v3(q.x + dx, q.y, q.z + dz), I('ghianda_pianta'));
      U.guard(() => M.cresciQuercia(dim, q));
    } },
  { dx: 20, dz: 20, titolo: '§5§l5 Altare e\n§5§lriti', cartelli: [
    'Tocca l\'altare\ncon l\'offerta.\nRitocca per\nriprenderla',
    'Mezzogiorno:\nvino del rito.\nMezzanotte:\npugnale (boss)',
    '§4Stirpe§r: sangue\ndi cacciatore\na mezzanotte\n= età + 1',
    'Ferro+cenere =\nargento. Luna\nnuova: anello\ndel varco'],
    oggetti: [[I('vino_rito'), 1], [I('pugnale_cenere'), 1], [I('sangue_cacciatore'), 4], [I('lega_argento'), 2], [I('paletto'), 4], [I('anello_ametista'), 1], [I('cenere'), 8]],
    extra: (dim, c) => {
      metti(dim, U.v3(c.x, c.y, c.z + 2), I('altare'));
      const q = U.v3(c.x - 4, c.y, c.z + 1);                          // quercia bianca vicina (serve ai riti)
      for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) metti(dim, U.v3(q.x + dx, q.y, q.z + dz), I('ghianda_pianta'));
      U.guard(() => M.cresciQuercia(dim, q));
    } },
  { dx: 0, dz: 20, titolo: '§8§l6 Cerchio di\n§8§lcenere', cartelli: [
    'La §1cenere§r si\nposa a terra\ncome la\nredstone',
    'Giro §1chiuso§r:\nnessun vampiro\nentra (gli\nOriginali sì)',
    'Guarda: il\nvampiro nel\nvetro non\nprende l\'umano'],
    oggetti: [[I('cenere'), 32]],
    extra: (dim, c) => {
      // recinto di vetro dal lato lontano dalla piazza (i cartelli e la cassa restano fuori)
      riempi(dim, U.v3(c.x - 5, c.y, c.z - 3), U.v3(c.x + 5, c.y + 1, c.z + 5), 'glass', 'hollow');
      cmd(dim, `fill ${c.x - 4} ${c.y + 1} ${c.z - 2} ${c.x + 4} ${c.y + 1} ${c.z + 4} air`);
      for (let i = -2; i <= 2; i++) for (const [x, z] of [[c.x + i, c.z - 2], [c.x + i, c.z + 2], [c.x - 2, c.z + i], [c.x + 2, c.z + i]]) metti(dim, U.v3(x, c.y, z), I('cenere_strato'));
      U.guard(() => Cer.ricalcola(dim, U.v3(c.x + 2, c.y, c.z)));
      abitanteFermo(dim, U.v3(c.x + 0.5, c.y, c.z + 0.5));
      try { const v = dim.spawnEntity(I('vampiro'), U.v3(c.x - 3.5, c.y, c.z + 3.5)); v.triggerEvent(I('residente')); v.triggerEvent(I('metti_anello')); } catch {}
    } },
  { dx: -20, dz: 20, titolo: '§4§l7 Sedia del\n§4§lprelievo', cartelli: [
    'Tocca la sedia\na mano vuota:\nl\'umano vicino\nsi siede legato',
    'Cibo a sinistra,\nsacche a destra.\nOgni 30 secondi\nuna sacca piena',
    'Le sacche piene\nvanno nella\ncassa accanto.\nAccov.+tocco=via'],
    oggetti: [['minecraft:bread', 16], [I('sacca_vuota'), 16]],
    extra: (dim, c) => {
      metti(dim, U.v3(c.x, c.y, c.z + 1), I('sedia'));
      metti(dim, U.v3(c.x + 1, c.y, c.z + 1), 'chest');
      const ab = abitanteFermo(dim, U.v3(c.x + 0.5, c.y, c.z + 2.5));
      U.guard(() => Sed.prepara(dim, U.v3(c.x, c.y, c.z + 1), ab, 8, 8));
    } },
  { dx: -20, dz: 0, titolo: '§6§l8 Armi, bara\n§6§le seguito', cartelli: [
    '§4Paletto§r nel\ncuore = morte.\nLa balestra\nspara paletti',
    '§8Bara§r: toccala\ndi giorno e si\nfa notte (punto\ndi rinascita)',
    '§4Seguito§r: solo\nl\'Originale\nsoggioga i\nvampiri',
    'Ordini: tocca il\nseguace. Accov.\n+ tocco: seduto\ncome i lupi'],
    oggetti: [[I('paletto'), 16], [I('paletto_quercia'), 2], ['minecraft:crossbow', 1], [I('paletto_argento'), 1], [I('bara_letto'), 1], [I('medaglione'), 1], [I('anello_diurno'), 2]],
    extra: (dim, c) => { try { dim.spawnEntity(I('bara_letto'), U.v3(c.x - 2.5, c.y, c.z + 2.5)); } catch {} } },
];

function abitanteFermo(dim, l) {
  let e;
  try { e = dim.spawnEntity('minecraft:villager_v2', l); } catch { return undefined; }
  try { e.addTag('vamp_pulito'); e.addTag('vamp_tutorial'); } catch {}
  return e;
}

function stazione(dim, o, st) {
  const c = U.v3(o.x + st.dx, o.y, o.z + st.dz);
  riempi(dim, U.v3(c.x - 5, c.y - 1, c.z - 5), U.v3(c.x + 5, c.y - 1, c.z + 5), 'stone_bricks');
  for (const [dx, dz] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) { metti(dim, U.v3(c.x + dx, c.y, c.z + dz), 'stone_brick_wall'); metti(dim, U.v3(c.x + dx, c.y + 1, c.z + dz), 'lantern'); }
  // cartelli in fila sul lato verso la piazza
  const verso = U.v3(-Math.sign(st.dx), 0, -Math.sign(st.dz));
  const base = U.v3(c.x + verso.x * 4, c.y, c.z + verso.z * 4);
  const lungo = verso.x !== 0 && verso.z === 0 ? U.v3(0, 0, 1) : U.v3(1, 0, 0);
  const tutti = [st.titolo, ...st.cartelli];
  tutti.forEach((t, i) => cartello(dim, U.v3(base.x + lungo.x * (i - Math.floor(tutti.length / 2)) * 1, c.y, base.z + lungo.z * (i - Math.floor(tutti.length / 2))), t));
  const kc = Math.ceil(tutti.length / 2) + 1;                       // la cassa accanto ai cartelli, verso la piazza
  cassa(dim, U.v3(base.x + lungo.x * kc, c.y, base.z + lungo.z * kc), st.oggetti);
  U.guard(() => st.extra?.(dim, c));
  // strada di ghiaia dalla piazza
  const passi = Math.max(Math.abs(st.dx), Math.abs(st.dz));
  for (let k = 6; k < passi - 5; k++) metti(dim, U.v3(o.x + Math.round(st.dx * k / passi), o.y - 1, o.z + Math.round(st.dz * k / passi)), 'gravel');
}

const VILLAGGI = [['umano', -48, 48], ['cacciatori', 48, -48], ['vampiri', 48, 48], ['originale', -130, -130]];   // la Rocca sospesa è enorme: sta lontano

/** costruisce tutto il tutorial con il centro in o (o.y = primo blocco d'aria sopra il terreno) */
export function costruisci(dim, o) {
  riempi(dim, U.v3(o.x - 62, o.y, o.z - 62), U.v3(o.x + 62, o.y + 6, o.z + 62), 'air');          // spazio libero
  // piazza
  riempi(dim, U.v3(o.x - 5, o.y - 1, o.z - 5), U.v3(o.x + 5, o.y - 1, o.z + 5), 'polished_blackstone');
  riempi(dim, U.v3(o.x - 1, o.y - 1, o.z - 1), U.v3(o.x + 1, o.y - 1, o.z + 1), 'red_concrete');
  for (const [dx, dz] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) { metti(dim, U.v3(o.x + dx, o.y, o.z + dz), 'polished_blackstone_wall'); metti(dim, U.v3(o.x + dx, o.y + 1, o.z + dz), 'soul_lantern'); }
  cartello(dim, U.v3(o.x, o.y, o.z - 3), '§4§lSANGUE\n§4§lIMMORTALE\n§rTutorial');
  cartello(dim, U.v3(o.x - 1, o.y, o.z - 3), 'Segui le strade:\n8 stazioni\nintorno alla\npiazza');
  cartello(dim, U.v3(o.x + 1, o.y, o.z - 3), 'Agli angoli i\n§44 villaggi§r.\nAttenti ai\ncacciatori!');
  cartello(dim, U.v3(o.x, o.y, o.z + 3), 'Cassa: la §4Guida§r\n(17 capitoli)\ne cose utili');
  cassa(dim, U.v3(o.x + 2, o.y, o.z + 3), [[I('guida'), 1], [I('fiala_vampiro'), 2], ['minecraft:bread', 16], ['minecraft:torch', 32]]);
  for (const st of STAZIONI) U.guard(() => stazione(dim, o, st));
  // un villaggio ogni 2 secondi: tutto insieme in un tick era troppo per il telefono (controllo anti-blocco)
  VILLAGGI.forEach(([tipo, dx, dz], i) => system.runTimeout(() => U.guard(() => {
    const c = U.v3(o.x + dx, o.y, o.z + dz);
    Vil.costruisci(dim, tipo, c);
    const rocca = tipo === 'originale';                                                  // la Rocca è grande: cartello fuori dalle mura
    const ingresso = rocca ? U.v3(o.x - 26, o.y, o.z - 22) : U.v3(o.x + Math.sign(dx) * 28, o.y, o.z + Math.sign(dz) * 28);
    cartello(dim, ingresso, { umano: '§2§lBorgo umano\n§rcase, letti,\nverbena', cacciatori: '§6§lCacciatori\n§rti attaccano\nse sei vampiro!',
      vampiri: '§4§lCovo dei\n§4§lvampiri\n§rattaccano gli\numani', originale: '§6§lRocca del\n§6§lDrago\n§rnon colpire\nl\'Originale!' }[tipo]);
    if (!rocca) for (let k = 20; k < 30; k++) metti(dim, U.v3(o.x + Math.sign(dx) * k, o.y - 1, o.z + Math.sign(dz) * k), 'gravel');
  }), 20 + 40 * i));
  U.wSet('tutorial_fatto', true);
  return true;
}

/** il mondo del tutorial: piatto con uno strato di deepslate sotto la terra (marchio del mondo "Tutorial Sangue Immortale") */
export function eMondoTutorial(dim) {
  const t = (y) => U.blk(dim, U.v3(0, y, 0))?.typeId;
  return t(-64) === 'minecraft:bedrock' && t(-63) === 'minecraft:deepslate' && t(-62) === 'minecraft:dirt';
}

/** prima entrata nel mondo del tutorial: carica la zona e costruisce, poi porta il giocatore in piazza */
export function avvia(p, forza = false) {
  if (!forza && (U.wGet('tutorial_fatto', false) || U.wGet('tutorial_in_corso', false))) return;
  const dim = p.dimension;
  const o = forza ? U.floor(p.location) : U.v3(0, -59, 0);
  if (!forza && !eMondoTutorial(dim)) return;
  U.wSet('tutorial_in_corso', true);
  U.wSet('villaggi_spenti', true);                                  // niente villaggi a caso nel tutorial
  cmd(dim, `tickingarea add ${o.x - 72} ${o.y - 6} ${o.z - 72} ${o.x + 72} ${o.y + 10} ${o.z + 72} vamp_tutorial true`);
  U.titolo(p, '§4Sangue Immortale', '§7Preparo il tutorial...');
  system.runTimeout(() => U.guard(() => {
    costruisci(dim, o);
    U.wSet('tutorial_in_corso', false);
    try { p.teleport(U.add(o, U.v3(0.5, 0, 0.5))); } catch {}
    U.titolo(p, '§4§lTUTORIAL', '§7Segui le strade: 8 stazioni e 4 villaggi');
    U.tell(p, '§4[Tutorial]§r Benvenuto! Le §f8 stazioni§r sono intorno alla piazza, i §64 villaggi§r agli angoli. ' +
      'Nella cassa della piazza c\'è la §4Guida§r. Comandi utili: §f/scriptevent vamp:vampiro§r, §f/scriptevent vamp:originale§r, §f/time set 18000§r.');
  }), forza ? 20 : 80);
}
