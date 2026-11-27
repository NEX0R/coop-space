// Sangue Immortale — ISTINTO DEL VAMPIRO + RUOTA DELLE ABILITÀ (1.4.0, richieste di Jowa del 25/11/2026).
//   - L'ISTINTO è di nuovo un oggetto: toccalo e si apre la RUOTA DELLE ABILITÀ (come quella delle emote).
//   - Tocca un'abilità sulla ruota: diventa l'abilità SCELTA e compare come oggetto nello SLOT ACCANTO all'Istinto.
//   - Tocca (usa) quell'oggetto quante volte vuoi: il potere parte sul mob che guardi. Resta lì finché non lo togli.
//   - Per toglierla riapri la ruota e tocca di nuovo la stessa abilità (o un'altra per cambiarla). La X chiude.
//   - Niente più doppio accovacciamento.
// La ruota è un modulo del gioco (ActionFormData) ridisegnato dal pacchetto di risorse (ui/server_form.json).
import { world, system, ItemStack, ItemLockMode } from '@minecraft/server';
import { ActionFormData } from '@minecraft/server-ui';
import * as U from './util.js';
import * as S from './stato.js';
import * as P from './poteri.js';
import { forma } from './pipistrello.js';
import { sisma, sfondamento } from './forza.js';
import { iniziaMorso } from './nutrirsi.js';
import { comandaTutti } from './seguaci.js';

export const TITOLO = 'vamp:barra';
export const ISTINTO = U.I('istinto');
// id, età minima, se serve guardare un mob, nome, funzione.
// 1.4.1 (obiettivo di Jowa del 25/11/2026): TUTTE le abilità si scelgono e funzionano per ogni vampiro, a qualsiasi età.
// L'età e l'essere Originale cambiano solo la forza e il costo (l'Originale non paga sangue).
export const POTERI = [
  ['morso', 1, false, 'Morso (bevi sangue)', (p) => iniziaMorso(p)],
  ['soggiogo', 1, true, 'Soggiogamento', (p, e) => P.soggioga(p, e)],
  ['seguito', 1, false, 'Ordini al seguito', (p) => comandaTutti(p)],
  ['sensi', 1, false, 'Sensi del vampiro', (p) => P.sensi(p)],
  ['pipistrello', 1, false, 'Forma di pipistrello', (p) => forma(p)],
  ['sangue', 1, false, 'Offri il tuo sangue', (p) => P.offriSangue(p)],
  ['umanita', 1, false, 'Interruttore dell\'umanità', (p) => P.interruttore(p)],
  ['allucinazioni', 1, true, 'Allucinazioni', (p, e) => P.allucina(p, e)],
  ['velo', 1, false, "Velo d'ombra", (p) => P.velo(p)],
  ['collo', 1, true, 'Spezzare il collo', (p, e) => P.spezzaCollo(p, e)],
  ['cuore', 1, true, 'Strappare il cuore', (p, e) => P.strappaCuore(p, e)],
  ['sisma', 1, false, 'Onda sismica', (p) => sisma(p)],                 // l'Originale gratis, gli altri pagano sangue
  ['sfondamento', 1, false, 'Sfondamento', (p) => sfondamento(p)],      // correndo rompe i blocchi (gli altri pagano sangue)
];
export const icona = (n) => `textures/ui/vamp/potere_${n}`;
const ID = (n) => U.I('potere_' + n);
export const ePotere = (id) => typeof id === 'string' && id.startsWith(U.I('potere_'));
export const scelto = (p) => U.get(p, 'potere_sel', '');

function oggettoPotere(n) {
  const s = new ItemStack(ID(n), 1);
  try { s.lockMode = ItemLockMode.slot; } catch {}
  try { s.keepOnDeath = true; } catch {}
  return s;
}
function oggettoIstinto() {
  const s = new ItemStack(ISTINTO, 1);
  try { s.keepOnDeath = true; } catch {}
  return s;
}

// ---------------------------------------------------------------- Istinto e slot accanto
function slotIstinto(c) { for (let i = 0; i < c.size; i++) if (c.getItem(i)?.typeId === ISTINTO) return i; return -1; }
/** lo slot accanto all'Istinto (a destra; se l'Istinto è nell'ultimo slot della sua riga, a sinistra) */
function slotAccanto(i) { return i % 9 === 8 ? i - 1 : i + 1; }

/** sposta altrove quello che c'è in uno slot (nell'inventario, o a terra se è pieno) */
function libera(p, c, slot) {
  const ora = c.getItem(slot);
  if (!ora || ePotere(ora.typeId)) return;
  c.setItem(slot, undefined);
  for (let j = 9; j < c.size; j++) if (!c.getItem(j)) { c.setItem(j, ora); return; }
  for (let j = 0; j < 9; j++) if (j !== slot && !c.getItem(j)) { c.setItem(j, ora); return; }
  try { p.dimension.spawnItem(ora, p.location); } catch {}
}

/** l'Istinto c'è, l'abilità scelta sta accanto, nessun potere fuori posto */
export function sistema(p) {
  const c = U.inv(p);
  if (!c) return;
  if (!S.eVampiro(p)) { togliTutto(p); return; }
  let i = slotIstinto(c);
  if (i < 0) {                                          // l'Istinto torna sempre (nella hotbar se c'è posto)
    let j = -1;
    for (let k = 0; k < 9 && j < 0; k++) if (!c.getItem(k)) j = k;
    if (j < 0) for (let k = 9; k < c.size && j < 0; k++) if (!c.getItem(k)) j = k;
    if (j < 0) return;
    c.setItem(j, oggettoIstinto());
    i = j;
  }
  const n = scelto(p), voluto = n ? slotAccanto(i) : -1;
  for (let k = 0; k < c.size; k++) if (k !== voluto && ePotere(c.getItem(k)?.typeId)) c.setItem(k, undefined);
  if (voluto >= 0 && c.getItem(voluto)?.typeId !== ID(n)) { libera(p, c, voluto); c.setItem(voluto, oggettoPotere(n)); }
}
export function togliTutto(p) {
  const c = U.inv(p);
  if (c) for (let k = 0; k < c.size; k++) { const t = c.getItem(k)?.typeId; if (t === ISTINTO || ePotere(t)) c.setItem(k, undefined); }
  U.set(p, 'potere_sel', '');
}

// ---------------------------------------------------------------- la ruota
const aperta = new Set();
/** apre la ruota: tutti i poteri al loro posto (lucchetto su quelli non sbloccati), quello scelto segnato, X al centro */
/** apre le abilità.
 *  elenco = true  -> finestra NORMALE del gioco con icone e nomi in fila (tocco sull'Istinto): funziona sempre.
 *  elenco = false -> PANNELLO a griglia 7×2 al centro dello schermo (accovacciato + tocco), ridisegnato da ui/server_form.json. */
export function apri(p, elenco = true) {
  if (!S.eVampiro(p) || aperta.has(p.id)) return;
  const lv = S.livello(p), sel = scelto(p);
  const f = new ActionFormData().title(elenco ? '§4Abilità del vampiro' : TITOLO).body(sel ? `§7Scelta: §f${POTERI.find(([n]) => n === sel)?.[3] ?? ''}§7 (toccala di nuovo per toglierla)` : '§7Scegli un\'abilità');
  for (const [n, eta, , nome] of POTERI) f.button((n === sel ? '» ' : '') + nome, lv >= eta ? icona(n) : 'textures/ui/vamp/bloccato');
  f.button('Chiudi', 'textures/ui/vamp/chiudi');
  aperta.add(p.id);
  U.suonoP(p, 'mob.warden.heartbeat', 0.5, 1.5);
  const mostra = () => f.show(p).then((r) => {
    if (r.canceled) { if (r.cancelationReason === 'UserBusy') { system.runTimeout(mostra, 10); return; } aperta.delete(p.id); return; }
    aperta.delete(p.id);
    const pot = POTERI[r.selection];
    if (pot) U.guard(() => scegli(p, pot));
  }).catch(() => aperta.delete(p.id));
  mostra();
}

function scegli(p, pot) {
  const [n, eta, , nome] = pot;
  if (S.livello(p) < eta) { U.barForte(p, eta >= 6 ? '§6Solo un Originale ha questo potere.' : `§7Si sblocca all'età §f${S.ETA[eta]}§7 (rito della stirpe all'altare).`); return; }
  if (scelto(p) === n) { U.set(p, 'potere_sel', ''); sistema(p); U.barForte(p, `§7Hai tolto §f${nome}§7.`, 40); return; }
  U.set(p, 'potere_sel', n);
  sistema(p);
  U.barForte(p, `§4${nome}§7: è accanto all'Istinto. Toccalo per usarlo.`, 60);
}

/** l'oggetto dell'abilità scelta è stato usato */
export function usato(p, id) {
  const pot = POTERI.find(([n]) => ID(n) === id);
  if (!pot || !S.eVampiro(p)) return;
  const [, eta, mira, , fn] = pot;
  if (S.livello(p) < eta) { U.barForte(p, eta >= 6 ? '§6Solo un Originale ha questo potere.' : '§7Non puoi ancora usare questo potere.'); return; }
  if (!U.pronto(p, 6, 'potere')) return;
  fn(p, mira ? U.guardata(p, 14) : undefined);
}

/** usa un potere per nome (comando di prova: /scriptevent vamp:potere collo) */
export function attivaPerNome(p, n) {
  const pot = POTERI.find(([id]) => id === n);
  if (!pot) { U.tell(p, '§7Poteri: ' + POTERI.map(([id]) => id).join(', ')); return; }
  usato(p, ID(n));
}

/** ogni secondo: tiene in ordine Istinto e abilità scelta */
export function tickBarra() { for (const p of world.getPlayers()) U.guard(() => { if (S.eVampiro(p)) sistema(p); }); }

/** dalle versioni vecchie (1.2.x con la hotbar dei poteri): rimette la hotbar a posto */
export function pulisciVecchio(p) {
  const c = U.inv(p);
  if (!c) return;
  if (U.get(p, 'barra', 'normale') === 'poteri') for (let i = 0; i < 9; i++) { try { c.swapItems(i, 27 + i, c); } catch {} }
  U.set(p, 'barra', 'normale');
}
