// Guida del Sangue Immortale: libro a capitoli (si apre toccandolo). Aggiornata alla 1.5.0 (26/11/2026).
import { system } from '@minecraft/server';
import { ActionFormData } from '@minecraft/server-ui';

const CAPITOLI = [
  ['Diventare vampiro', [
    "§41. Sangue di vampiro.§r Bevi una §cFiala di sangue di vampiro§r (la lasciano i vampiri, o te la dà un giocatore vampiro: porta il suo nome, es. §cSangue di Jowa§r). Ti guarisce subito, e per §eun giorno di gioco§r resta nel tuo corpo.",
    '',
    "§42. Morire.§r Se muori con il sangue di vampiro in corpo, ti risvegli §cin transizione§r.",
    '',
    "§43. Transizione.§r Hai un giorno di gioco per bere §csangue umano§r: colpisci a mano vuota un abitante, oppure bevi una §cSacca di sangue umano§r.",
    '',
    "Se il tempo finisce, muori e torni umano. Se bevi, §4sei un vampiro§r: hai gli §cocchi rossi§r (li vedono gli altri giocatori) e la §4ruota delle abilità§r."]],
  ['Il sangue', [
    "Sopra la barra degli oggetti vedi le §cgocce di sangue§r (20 punti). La fame normale non conta più.",
    '',
    "§4Morso:§r è un'abilità della ruota. Sceglila: compare accanto all'Istinto. Tienila in mano: davanti agli umani vedi l'icona dei §fcanini§r. Avvicinati e §ftoccala§r: cominci a bere e continui da solo, un sorso al secondo, finché resti vicino. Ti fermi allontanandoti, cambiando oggetto o quando sei sazio.",
    "§f• Umani§r: +4.  §f• Animali§r: +2 (solo animali = più debole).  §f• Vampiri§r: solo Squartatori e Originali.",
    "In §ctransizione§r (non hai ancora l'Istinto) si morde colpendo a mano vuota.",
    '',
    "§cSacca di sangue:§r accovacciati e colpisci un umano con una sacca vuota (su un cacciatore: §4Sangue di cacciatore§r).",
    "Il cibo normale ti dà nausea. Senza sangue ti §7essicchi§r."]],
  ['Istinto e abilità', [
    "Tocca l'§4Istinto del vampiro§r: si apre la finestra con §ftutte le 13 abilità§r (icona e nome). §fAccovacciato + tocco§r: le stesse in un pannello a griglia al centro dello schermo.",
    '',
    "Tocca un'abilità: diventa quella §fscelta§r e compare come oggetto §fnello slot accanto all'Istinto§r. Toccala quante volte vuoi: il potere parte sul mob che guardi. Per toglierla riapri e §ftoccala di nuovo§r (o scegline un'altra).",
    '',
    "§fTutte le abilità sono per tutti i vampiri§r, a qualsiasi età: §4Morso§r, §5Soggiogamento§r, §4Ordini al seguito§r, §cSensi§r, §8Pipistrello§r, §4Offri il tuo sangue§r, Umanità, §dAllucinazioni§r, §8Velo d'ombra§r, §7Spezza collo§r, §cStrappa cuore§r, §6Onda sismica§r, §6Sfondamento§r.",
    "L'età e l'essere §6Originale§r cambiano la forza e il costo: l'Originale non paga sangue, gli altri sì (Onda sismica 5, Sfondamento un po' per ogni blocco).",
    '',
    "§8Velo d'ombra:§r creature entro 8 blocchi §fimmobili e cieche§r per 8 secondi. §4Ordini al seguito:§r un ordine a tutti i seguaci vicini. §6Sfondamento:§r acceso, correndo rompi i blocchi davanti. §6Onda sismica:§r tre onde di fila e il 10×10 va in pezzi.",
    '',
    "§eSuper velocità:§r sempre pronta, basta correre. Gli effetti positivi sono §finfiniti§r."]],
  ['Età e rito della stirpe', [
    "L'età §fnon sale più da sola§r: Neonato → Giovane → Adulto → Antico → Millenario. Ogni gradino (più forza e resistenza) si guadagna all'§5Altare dei rituali§r:",
    '',
    "§4Rito della stirpe:§r a §fmezzanotte§r, con una §equercia bianca§r entro 8 blocchi, tocca l'altare col §4Sangue di cacciatore§r. Dopo 12 secondi sali di un'età.",
    '',
    "Il Sangue di cacciatore lo lasciano spesso i cacciatori uccisi, oppure lo prendi con una sacca vuota (accovacciato + colpo) o dalla Sedia del prelievo con un cacciatore seduto.",
    "Gli §6Originali§r sono già al massimo."]],
  ['Soggiogamento e seguito', [
    "Funziona su §fogni mob§r (non sull'Antico Originale, e non su chi ha la verbena in corpo).",
    "§f• Abitanti:§r Seguimi, Resta qui, Dimentica, Fammi un dono, Invitami in casa.  §f• Giocatori:§r Fermati, Vieni qui.",
    "§f• Vampiri:§r SOLO un §6Originale§r può soggiogarli (Unisciti al mio seguito, Fermati, Vattene). Gli altri vampiri, di qualsiasi età, no.",
    '',
    "§4Seguito:§r nei primi §e10 minuti§r un altro Originale può portarti via un seguace; poi diventa §4leale soltanto a te§r. Accovacciati e colpiscilo con una §cSacca di sangue umano§r: un §ccalice§r lo rende più forte (massimo §f10§r). Col tempo cresce di grado fino ad Antico, e fino a §6Millenario§r con un Originale.",
    "Anche un vampiro nato dal tuo sangue (legame del sire) entra nel tuo seguito.",
    '',
    "§4Ordini:§r tocca un tuo seguace: §fSeguimi§r, §fResta fermo qui§r, §fSeduto§r (riposo), §fNeutrale§r, §fAggressivo§r, §6Dai§r o §6Togli l'Anello diurno§r.",
    "§fAccovacciato + tocco§r: si siede o si alza, §fcome i lupi§r. Seduto sta fermo e non fa nulla (non segue, non attacca)."]],
  ['Pipistrello', [
    "§8Forma di pipistrello:§r ti dissolvi in fumo nero e diventi un grande pipistrello nero. §fIllimitata§r e §fsenza costo di sangue§r.",
    "§f• Muoviti§r con i comandi: vai dove guardi. §fSalto§r = sali.  §f• Accovacciati§r per tornare vampiro (atterri piano).",
    "I colpi presi dal pipistrello li prendi tu. Verbena e acqua ti fanno tornare nella tua forma."]],
  ['Umanità e Squartatori', [
    "Con l'umanità §cspenta§r sei più forte e i morsi sono più profondi, ma la sete corre più veloce.",
    '',
    "Se con l'umanità spenta uccidi 5 umani diventi uno §4Squartatore§r: morsi feroci, puoi bere anche dai vampiri, ma la sete è terribile.",
    '',
    "Riaccendere l'umanità fa male (nausea e lentezza), ma torni in te."]],
  ['Debolezze', [
    "§6Sole§r: di giorno, sotto il cielo aperto, bruci. Ti serve un §6Anello diurno§r (basta averlo nell'inventario; nella barra del sangue compare la sua icona).",
    '',
    "§dVerbena§r: toccarla brucia; infuso, granata e frecce dei cacciatori ti feriscono e bloccano i poteri per un po'.",
    '',
    "§6Paletto di legno§r: sotto metà vita ti trafigge il cuore.  §cFuoco§r: danni doppi.",
    '',
    "§fCerchio di cenere§r: un giro chiuso di cenere di quercia bianca non ti lascia entrare (vedi il suo capitolo).",
    '',
    "Se muori per §esole, fuoco, paletto o cuore strappato§r muori davvero e rinasci umano. Per gli altri colpi ti risvegli.",
    '',
    "§7Invito§r: senza invito non entri nelle case abitate. Soggioga un abitante: Invitami in casa."]],
  ['Quercia bianca e cenere', [
    "§eQuercia bianca§r: legno chiaro scortecciato e foglie bianche. Cresce §fcome la quercia scura§r: servono §f4 ghiande in un quadrato 2×2§r. Diventa un albero grosso, col tronco 2×2 e la chioma larga e piatta. Una ghianda da sola non cresce. Le ghiande cadono di rado dalle foglie di quercia (e da quelle della quercia bianca).",
    '',
    "§fLegno di quercia bianca§r + bastone = §ePaletto di quercia bianca§r (l'unico che uccide un Originale). Nella fornace il legno diventa §fcenere§r.",
    '',
    "§dTabaccata di verbena§r (carta + 2 verbena = 2): si fuma tenendo premuto. All'§6Originale§r dà §fsollievo§r (guarisce, toglie gli effetti negativi e la verbena in corpo); a un §4vampiro§r brucia come l'infuso; a un umano dà 5 minuti di protezione. Il fumo per 5 secondi ferisce i vampiri vicini.",
    '',
    "§fCerchio di cenere:§r la cenere si §fposa a terra come la polvere di redstone§r. Se fai un giro §fchiuso§r (pezzi uno accanto all'altro, non solo in diagonale), §cnessun vampiro può entrare§r: viene respinto al bordo. Gli §6Originali§r passano. Chi era già dentro resta intrappolato. Togli un pezzo e il cerchio si rompe.",
    '',
    "§6Balestra:§r la balestra normale del gioco spara §6paletti§r se li hai nell'inventario (prima quelli di legno; quello di quercia bianca se lo tieni nella mano secondaria). Senza frecce si carica lo stesso. Un paletto di legno nel cuore uccide all'istante un vampiro; l'Antico Originale lo finisce solo la quercia bianca."]],
  ['Altare dei rituali', [
    "Altare = 2 candele, libro, blocco di lapislazzuli, 5 pietre nere levigate. Si piazza, si tocca per offrire (ritocca per riprendere), si rompe per raccoglierlo.",
    '',
    "§61. Anello diurno.§r Anello con lapislazzuli, di giorno, sotto il cielo aperto.",
    "§62. Rito dell'immortalità.§r Vino del rito a §emezzogiorno§r, sotto il cielo, con una quercia bianca vicina: Vino dell'immortalità (da umano: bevi e muori entro 60 s per rinascere §6Originale§r).",
    "§63. Risveglio dell'Antico.§r Pugnale con cenere a §emezzanotte§r: sale una bara e si sveglia l'§6Antico Originale§r.",
    "§74. Argento.§r Ferro con cenere: diventa §fLingotto d'argento§r.  §75. Paletto d'argento.§r Con l'argento sull'altare toccalo con un paletto: §fINDISTRUTTIBILE§r.",
    "§46. Rito della stirpe.§r Sangue di cacciatore, a mezzanotte, con la quercia bianca vicina: sali di un'età.",
    "§57. Anello del varco.§r Anello d'argento con ametista in una §fnotte di eclissi§r (§fluna nuova§r: la luna sparisce, una notte ogni 8), di notte, sotto il cielo: diventa l'§5Anello del varco§r."]],
  ['Originali', [
    "Gli §6Originali§r: età massima, il sole li indebolisce ma non li uccide, solo loro soggiogano i vampiri, e più vampiri hanno nel seguito più sono forti.",
    "Muoiono solo con la §equercia bianca§r. Il pugnale con cenere li essicca per un po'.",
    '',
    "§6Se sei Originale:§r i poteri §fnon ti costano sangue§r e la tua forza non dipende dal sangue (anche affamato resti fortissimo, e guarire è gratis); Spezzare il collo e Strappare il cuore funzionano §fin qualsiasi momento§r; a §fmani nude§r un pugno fa §c50 di danno§r; un blocco colpito e guardato si rompe in §f2 secondi§r (non la bedrock); passi i cerchi di cenere.",
    '',
    "§6Onda sismica§r (ruota delle abilità): un'onda d'urto in un raggio di 10 blocchi ferisce e scaglia via le creature (non i tuoi seguaci). Fai §ftre onde di fila§r (entro 30 secondi): alla terza i blocchi nel §fquadrato 10×10§r intorno a te vanno in pezzi (da 2 sotto i piedi a 3 sopra la testa), tranne bedrock e altare.",
    '',
    "§5Anello del varco§r: tienilo in mano e tocca in qualsiasi direzione: scrivi §fX, Y, Z§r e scegli §fMondo normale, Nether o End§r. Davanti a te si apre un §8portale di fumo nero come la pece§r per §f10 secondi§r: chi ci entra arriva lì. Uso illimitato, solo per gli Originali.",
    '',
    "§6Antico Originale§r (boss): chiama la sua stirpe; quando muore, muore la sua stirpe. Lascia §bLa Cura§r (un vampiro che la beve torna umano)."]],
  ['Sedia del prelievo', [
    "§cSedia del prelievo§r (sbarre di ferro + 3 assi + 2 bastoni): una farm di sangue §fsenza uccidere§r.",
    '',
    "§f1.§r Piazzala e §ftoccala a mano vuota§r: l'umano più vicino (abitante, mercante, predone, vendicatore, evocatore, strega o cacciatore, entro 8 blocchi) si siede ed è legato.",
    "§f2.§r Toccala col §fcibo§r (pane, carote, carne...): va nel vassoio a sinistra.",
    "§f3.§r Toccala con le §fsacche vuote§r: vanno nel cesto a destra.",
    "§f4.§r Ogni §f30 secondi§r mangia un cibo e una sacca si riempie: §cSacca di sangue umano§r (o §4Sangue di cacciatore§r se è un cacciatore). La sacca piena va in una §fcassa, barile o tramoggia§r attaccati alla sedia (sotto o ai lati); se non c'è, cade a terra.",
    '',
    "Toccala a mano vuota per vedere quanto cibo e quante sacche restano. §fAccovacciato + tocco§r: lo sleghi. Rompendola ti ridà cibo e sacche."]],
  ['Villaggi', [
    "Mentre esplori il mondo normale, circa una zona su due (zone di 320×320 blocchi) ospita un §fvillaggio§r. Nasce su un terreno piatto a 40–64 blocchi da te e in chat ti arriva la distanza e la direzione. Non viene mai costruito sopra le tue costruzioni né vicino al punto di partenza.",
    '',
    "§a• Borgo umano:§r 4 case di legno con i letti (serve l'invito per entrare!), pozzo, strade, orto di §dverbena§r e 6 abitanti: §f2 di loro bevono verbena di nascosto§r (non si soggiogano e il loro sangue brucia).",
    "§6• Avamposto dei cacciatori:§r palizzata, torre di guardia, capanne, falò e una cassa di paletti, verbena e granate. I §f4 cacciatori§r restano lì e attaccano i vampiri (anche te).",
    "§4• Covo dei vampiri:§r case di pietra nera, cripta, lanterne delle anime, §f5 vampiri§r (3 con l'anello diurno) che attaccano gli umani ma non i vampiri, e una §cSedia del prelievo§r con un abitante già legato.",
    "§6• Rocca del Drago (dimora dell'Originale):§r un'enorme isola sospesa a §f50 blocchi§r da terra, in pietra nera con la §eluminite§r, a forma di stella come il castello del tutorial \"Dragonstone\": gradoni con le costole, il mastio con le corna, sotto un cono di roccia con la luminite che pende. Si sale con la §fscala a chiocciola sospesa§r davanti al portale. Dentro: salone del trono, Tavolo dipinto, camerata, stanza del tesoro e camera del Signore; 18 guardie Antiche e Millenarie e il §6Signore Originale§r (col medaglione). È §fcalmo§r: §cse lo colpisci§r diventa l'Antico Originale (il boss).",
    '',
    "Comandi (trucchi attivi): §f/scriptevent vamp:villaggio umano§r (o cacciatori, vampiri, originale) lo costruisce 30 blocchi davanti a te; §f/scriptevent vamp:villaggi off§r / §fon§r spegne o riaccende la generazione."]],
  ['Creature e medaglione', [
    "§4Vampiri§r: escono di notte. Feriti crollano e si rialzano dopo 30 secondi: finiscili con un paletto, col fuoco, al sole o strappando il cuore.",
    "§4Squartatori§r: più veloci e feroci, attaccano tutti.",
    '',
    "§6Cacciatori di vampiri§r: arco con frecce alla verbena, o paletto. Se un vampiro uccide un cacciatore riceve la §8maledizione del cacciatore§r: due giorni di visioni.",
    "§6Medaglione del cacciatore§r (spago, 3 oro, verbena): §findossalo sul petto§r (5 di armatura) o tienilo in tasca: la maledizione §fnon ha effetto§r, anche se uccidi un cacciatore.",
    "§eAnello diurno§r: si può §findossare§r (slot delle gambiere, 3 di armatura), tenere nella mano secondaria o in tasca.",
    "§8Bara per dormire§r (8 assi di quercia scura + lana rossa): come un letto al contrario. Posala, toccala §fdi giorno§r e ti stendi dentro: dopo 3 secondi di buio si fa §fnotte§r e la bara diventa il tuo punto di rinascita. Colpiscila per raccoglierla.",
    '',
    "§fLegame del sire§r: accovacciati e colpisci un abitante con una fiala del tuo sangue. Se muore entro un giorno, rinasce vampiro e ti segue."]],
  ['Cacciatore di vampiri', [
    "§fGiuramento:§r da §fumano§r, di §fnotte§r, con la §dverbena in corpo§r (bevi un Infuso di verbena), tocca l'§5Altare§r col §4Sangue di cacciatore§r e resta vicino. Dopo 12 secondi sei un §fCacciatore di vampiri§r.",
    "Un vampiro con lo stesso sangue fa invece il rito della stirpe. Se un cacciatore diventa vampiro, il giuramento si spezza.",
    '',
    "§fDiario del cacciatore§r (come l'Istinto): tocco = elenco delle §f10 abilità§r, accovacciato + tocco = pannello a icone. L'abilità scelta compare §faccanto al Diario§r: toccala per usarla. Ritoccala nel Diario per toglierla.",
    "§fDeterminazione§r: gli §fscudi d'argento§r sopra la barra (20 punti). Le abilità la consumano, torna da sola (più in fretta salendo di grado) e ogni vampiro ucciso ne ridà 4.",
    '',
    "§cFiuto§r (4): per 20 s vedi i segni rossi sui vampiri entro 48 blocchi, quanti sono e dove.  §4Colpo al cuore§r (6): il prossimo colpo entro 10 s, col paletto, uccide un vampiro (l'Originale solo con la quercia bianca).",
    "§dNube di verbena§r (6): verbena intorno a te, i vampiri bruciano e perdono i poteri; gli umani vicini si proteggono.  §dTrappola§r (5): piastra d'oro a terra, il vampiro che la calpesta resta inchiodato.",
    "§7Rete d'argento§r (4): sul mob che guardi, lo impiglia.  §6Raffica di paletti§r (6, serve 1 paletto): 3-6 paletti di fila (di quercia se ne hai).  §fSchivata§r (2): balzo indietro quasi invulnerabile.",
    "§fVolontà di ferro§r (5): niente soggiogamento né visioni, via gli effetti negativi.  §6Richiamo§r (12): arrivano i cacciatori della Confraternita per 2 minuti.  §6Fuoco purificatore§r (5): incendia il mob che guardi o una lingua di fiamme.",
    '',
    "§fGradi:§r Recluta → Cacciatore (5 prede) → Veterano (15) → Maestro (40). Vampiro 1, giocatore vampiro 2, Originale 10. Ogni grado: §f+1 danno§r sui vampiri e abilità più forti; da Cacciatore la mente §fresiste al soggiogamento§r; il Veterano sente i vampiri vicini; il Maestro ha Resistenza I.",
    "§fIncarichi:§r nel Diario, §fStato e incarichi§r: prendi un incarico, elimina i vampiri e riscuoti il premio."]],
  ['Santa Bomba a mano', [
    "§61. Guscio d'oro:§r crafta l'uovo d'oro (smeraldo sopra; oro - diamante - oro; luminite - polvere da sparo - luminite).",
    "§62. Altare:§r tocca l'§5Altare§r col guscio: lo posi e §fsi apre come un uovo prezioso§r.",
    "§63. La Cura:§r tocca l'altare con §bLa Cura§r (la lascia l'Antico Originale quando muore): scende nel guscio, che §fsi richiude nella luce§r in 8 secondi.",
    "§64. Fatta:§r tocca l'altare e prendi la §eSanta Bomba a mano§r.",
    '',
    "Lanciala come la granata. Dove cade parte un §efascio di luce§r che si allarga §fa cerchio§r per §f25 blocchi§r di raggio (50×50):",
    "§f• Umani§r (anche tu, se sei umano): §acurati del tutto§r, rigenerazione e assorbimento.",
    "§f• Vampiri§r (anche i seguaci e i giocatori vampiri): §cmorte istantanea§r.",
    "§f• Originali:§r se hanno il §6Medaglione del cacciatore§r (indossato o in tasca) il medaglione §fsi sacrifica§r e si rompe: restano vivi con pochissima vita. Senza medaglione §cmuoiono§r.",
    '',
    "Il Signore Originale della Rocca del Drago porta un medaglione: la prima bomba glielo spezza.",
    "§cSe sei un vampiro, non lanciarla vicino a te!§r"]],
  ['Ricette veloci', [
    "Paletto: asse sopra un bastone (×2).  Paletto di quercia bianca: legno di quercia bianca sopra un bastone (×2).",
    "Pugnale cerimoniale: ferro, oro, bastone in colonna.  Pugnale con cenere: pugnale + cenere.",
    "Ferro con cenere: ferro + cenere (sull'altare diventa argento).",
    "Anello con lapislazzuli: lapislazzuli sopra, oro intorno.",
    "Anello d'argento con ametista: frammento d'ametista sopra, 3 lingotti d'argento intorno.",
    "Medaglione del cacciatore: spago sopra, oro - verbena - oro, oro sotto.",
    "Sedia del prelievo: sbarre di ferro in alto a sinistra, 3 assi in mezzo, 2 bastoni sotto ai lati.",
    "Vino rosso: bottiglia + 3 bacche dolci + zucchero.  Vino del rito: vino + sacca di sangue + pepita d'oro.",
    "Sacca vuota (×2): cuoio + bottiglia.  Infuso di verbena: bottiglia + 2 verbena.  Granata: + polvere da sparo.",
    "Tabaccata di verbena (×2): carta + 2 verbena.",
    "Bara per dormire: 8 assi di quercia scura intorno, lana rossa al centro.",
    "Guscio d'oro della Santa Bomba: smeraldo sopra; oro, diamante, oro; luminite, polvere da sparo, luminite. Poi sull'altare con La Cura.",
    "Questo libro: libro + colorante rosso."]],
];

function indice(p) {
  const f = new ActionFormData().title('§l§4Guida del Sangue Immortale').body('§7Scegli un capitolo.');
  for (const [t] of CAPITOLI) f.button(t);
  f.show(p).then((r) => {
    if (r.canceled) { if (r.cancelationReason === 'UserBusy') system.runTimeout(() => indice(p), 10); return; }
    capitolo(p, r.selection);
  }).catch(() => {});
}
function capitolo(p, i) {
  const [t, righe] = CAPITOLI[i];
  const f = new ActionFormData().title('§l' + t).body(righe.join('\n'));
  f.button('◀ Indice');
  if (i + 1 < CAPITOLI.length) f.button('Avanti: ' + CAPITOLI[i + 1][0]);
  f.show(p).then((r) => {
    if (r.canceled) return;
    if (r.selection === 0) indice(p); else capitolo(p, i + 1);
  }).catch(() => {});
}
export function apriGuida(p) { indice(p); }
export const N_CAPITOLI = CAPITOLI.length;
