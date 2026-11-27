// Prove da giocatore di Sangue Immortale: i comandi di prova funzionano anche su un amico, scrivendo il suo nome.
import { GameMode } from "@minecraft/server";
import { prova, pos, aspettaFinche, creaGiocatore } from "./aiuti.js";

prova("vampiro_su_un_amico", async ({ dim }) => {
  const amico = creaGiocatore(dim, pos(3, 1, 3), "Prova amico", GameMode.Survival);
  try {
    await aspettaFinche(() => amico.isValid, 20);
    dim.runCommand("scriptevent vamp:originale Prova amico");
    if (!(await aspettaFinche(() => amico.hasTag("vamp_vampiro"), 60))) throw new Error('dopo "/scriptevent vamp:originale Prova amico" l\'amico non è diventato vampiro');
    dim.runCommand('scriptevent vamp:umano "prova AMICO"');
    if (!(await aspettaFinche(() => !amico.hasTag("vamp_vampiro"), 60))) throw new Error("dopo vamp:umano con il nome tra virgolette l'amico è ancora vampiro");
    return "Originale e di nuovo umano, scrivendo il nome dopo il comando";
  } finally {
    amico.remove();
  }
});
