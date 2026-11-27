// Prova da giocatore del mondo tutorial: Sangue Immortale e Coop Space devono costruirsi da soli, uno dopo
// l'altro, quando un giocatore entra in un mondo con il segno del tutorial (bedrock, ardesia profonda, terra
// sotto 0,0). Gira per ultima: il tutorial di Jowa sposta il giocatore e costruisce piazza e villaggi.
import { GameMode } from "@minecraft/server";
import { prova, pos, aspettaFinche, creaGiocatore } from "./aiuti.js";

const tipo = (dim, x, y, z) => {
  try {
    return dim.getBlock({ x, y, z })?.typeId;
  } catch {
    return undefined; // zona non caricata
  }
};

prova("tutorial_mondo", async ({ dim }) => {
  dim.runCommand("setblock 0 -64 0 bedrock");
  dim.runCommand("setblock 0 -63 0 deepslate");
  dim.runCommand("setblock 0 -62 0 dirt");
  const giocatore = creaGiocatore(dim, pos(8, 1, 8), "Prova tutorial", GameMode.Survival);
  try {
    const controlli = {
      "piazza di Sangue Immortale (cemento rosso al centro)": () => tipo(dim, 0, -60, 0) === "minecraft:red_concrete",
      "quartiere Coop Space (cemento verde al centro, x 110)": () => tipo(dim, 110, -60, 0) === "minecraft:lime_concrete",
      "strada di ghiaia verso il quartiere": () => tipo(dim, 60, -60, 0) === "minecraft:gravel",
      "cartello Coop Space nella piazza di Jowa": () => tipo(dim, 4, -59, 0) === "minecraft:standing_sign",
      "cassa della stazione 1 (bacchette)": () => tipo(dim, 110 - 14 + 4, -59, -14 + 4) === "minecraft:chest",
    };
    // Sangue Immortale costruisce dopo 6 s, Coop Space dopo 15 s: si aspetta al massimo 40 s.
    await aspettaFinche(() => Object.values(controlli).every((c) => c()), 800);
    const mancano = Object.entries(controlli).filter(([, c]) => !c()).map(([nome]) => nome);
    if (mancano.length) throw new Error(`dopo 40 secondi mancano: ${mancano.join("; ")}`);
    return "piazza di Jowa, strada e quartiere Coop Space costruiti da soli";
  } finally {
    giocatore.remove();
  }
});
