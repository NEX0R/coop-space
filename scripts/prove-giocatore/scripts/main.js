// Prove automatiche con un vero giocatore simulato (solo nel mondo usa-e-getta del server).
// Ogni prova scrive nel log "COOP-GIOCATORE <nome> OK|FALLITO|SALTATO ..."; alla fine "COOP-GIOCATORE FINE".
// Per aggiungerne una: importa `prova`, prepara una zona lontana dalle altre, crea il giocatore
// con `creaGiocatore`, fai le azioni e controlla i blocchi/inventario. Se manca qualcosa, lancia
// `throw new Error("atteso ...")`: il riepilogo mostrerà il motivo. L'assistente rimuove sempre
// il giocatore dopo ogni prova. Non copiare questo pack in addon/: Gametest è beta.
import { system, world } from "@minecraft/server";
import { prove, pulisci, attesa, ZONA, preparaBlocchi, contaBlocchi, contaOggetti, durataInMano, creaGiocatore } from "./aiuti.js";
// Un file per funzione: aggiungi qui l'import di ogni file di prove nuovo.
import "./bacchette.js";

system.afterEvents.scriptEventReceive.subscribe(async (evento) => {
  if (evento.id !== "coop:prove_giocatore") return;
  if (world.getAllPlayers().length > 0) {
    console.warn("COOP-GIOCATORE prove_giocatore SALTATO: il mondo contiene giocatori veri");
    return;
  }
  const dim = world.getDimension("overworld");
  try {
    for (const { nome } of prove) {
      try {
        // Le funzioni registrate sono eseguite sotto, per passare gli strumenti comuni.
        await esegui(nome, dim);
      } catch (errore) {
        const dettaglio = errore?.message ?? String(errore);
        if (/not available|not supported|unsupported|gametest|beta api/i.test(dettaglio)) {
          console.warn(`COOP-GIOCATORE ${nome} SALTATO: giocatore simulato non disponibile (${dettaglio})`);
        } else {
          console.error(`COOP-GIOCATORE ${nome} FALLITO: ${dettaglio}`);
        }
      }
    }
  } catch (errore) {
    console.error(`COOP-GIOCATORE prove_giocatore FALLITO: ${errore?.message ?? errore}`);
  }
  console.warn("COOP-GIOCATORE FINE");
});

async function esegui(nome, dim) {
  const test = prove.find((p) => p.nome === nome);
  if (!test) throw new Error(`prova non registrata: ${nome}`);
  pulisci(dim);
  try {
    const dettaglio = await test.funzione({
      dim,
      origine: { ...ZONA },
      aspetta: attesa,
      creaGiocatore: (posizione, nomeGiocatore, modalita, oggetto, quantita) => creaGiocatore(dim, posizione, nomeGiocatore, modalita, oggetto, quantita),
      preparaBlocchi,
      contaBlocchi,
      contaOggetti,
      durataInMano,
    });
    console.warn(`COOP-GIOCATORE ${nome} OK${dettaglio ? ` (${dettaglio})` : ""}`);
  } finally {
    pulisci(dim);
  }
}
