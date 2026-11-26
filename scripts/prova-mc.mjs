// Prepara Minecraft sul PC (Windows) per provare l'add-on e lo avvia: niente da importare a mano.
//
//   npm run prova-mc              crea il pacchetto da addon/ (npm run package) e lo installa
//   npm run prova-mc -- 31        scarica l'anteprima della pull request #31 e la installa
//   opzioni: --pulisci            cancella i mondi di prova "Coop Space ..." vecchi (non quelli tuoi)
//            --non-avviare        installa senza aprire Minecraft
//
// Cosa fa: chiude Minecraft se è aperto, sostituisce i pack "Coop Space" installati con quelli
// nuovi (riconosciuti dall'UUID del manifest, non dal nome), aggiunge il mondo di prova in cima
// alla lista dei mondi e avvia il gioco. Codici: 0 = pronto, 3 = non è stato possibile prepararlo.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { leggiZip } from "./zip.mjs";

const radice = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = "NEX0R/coop-space";
const PROCESSO = "Minecraft.Windows.exe";
const args = process.argv.slice(2);
const pr = args.find((a) => /^\d+$/.test(a));
const pulisci = args.includes("--pulisci");
const avvia = !args.includes("--non-avviare");

const ferma = (msg) => {
  console.error(`\n✗ ${msg}`);
  process.exit(3);
};
const leggiJson = (file) => {
  try {
    return JSON.parse(readFileSync(file, "utf8").replace(/^﻿/, ""));
  } catch {
    return null;
  }
};

if (process.platform !== "win32") ferma("Funziona solo su Windows, dove è installato Minecraft Bedrock.");
const utenti = join(process.env.APPDATA || "", "Minecraft Bedrock", "Users");
const condivisa = join(utenti, "Shared", "games", "com.mojang");
if (!existsSync(condivisa)) ferma(`Non trovo Minecraft Bedrock (${condivisa}). Aprilo una volta e riprova.`);
// La cartella dei mondi è quella del profilo Xbox usato più di recente.
const cartelleMondi = readdirSync(utenti)
  .filter((u) => u !== "Shared")
  .map((u) => join(utenti, u, "games", "com.mojang", "minecraftWorlds"))
  .filter((d) => existsSync(d))
  .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
if (!cartelleMondi.length) ferma("Non trovo la cartella dei mondi: entra una volta in Minecraft con il tuo profilo e riprova.");
const mondi = cartelleMondi[0];

// ---------- 1. i file da installare ----------
let addon, mondo;
if (pr) {
  const cartella = join(radice, "out", "prova-mc");
  mkdirSync(cartella, { recursive: true });
  for (const nome of ["coop-space.mcaddon", "coop-space-mondo-prova.mcworld"]) {
    const url = `https://github.com/${REPO}/releases/download/anteprima-pr-${pr}/${nome}`;
    console.log(`Scarico ${url}`);
    const r = await fetch(url).catch((e) => ({ ok: false, statusText: e.message }));
    if (!r.ok) ferma(`Anteprima della pull request #${pr} non trovata (${r.status || r.statusText}). La build è finita?`);
    writeFileSync(join(cartella, nome), Buffer.from(await r.arrayBuffer()));
  }
  addon = join(cartella, "coop-space.mcaddon");
  mondo = join(cartella, "coop-space-mondo-prova.mcworld");
} else {
  console.log("Creo il pacchetto da addon/ (npm run package)...");
  const r = spawnSync(process.execPath, [join(radice, "scripts", "package.mjs")], { cwd: radice, stdio: "inherit" });
  if (r.status !== 0) ferma("npm run package non è riuscito: correggi l'add-on (npm run verify) e riprova.");
  addon = join(radice, "dist", "coop-space.mcaddon");
  mondo = join(radice, "dist", "coop-space-mondo-prova.mcworld");
}

// ---------- 2. chiudere Minecraft (i pack nuovi si leggono solo all'avvio) ----------
const aperto = () => spawnSync("tasklist", ["/FI", `IMAGENAME eq ${PROCESSO}`, "/NH"], { encoding: "utf8" }).stdout.includes(PROCESSO);
const aspetta = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
if (aperto()) {
  console.log("Minecraft è aperto: lo chiudo (il gioco salva i mondi da solo).");
  spawnSync("taskkill", ["/IM", PROCESSO]);
  for (let i = 0; i < 20 && aperto(); i++) aspetta(500);
  if (aperto()) spawnSync("taskkill", ["/F", "/IM", PROCESSO]);
  for (let i = 0; i < 10 && aperto(); i++) aspetta(500);
  if (aperto()) ferma("Non riesco a chiudere Minecraft: chiudilo tu e rilancia.");
}

// Scrive le voci di uno zip (già lette) in una cartella, togliendo il prefisso indicato.
function estrai(voci, prefisso, destinazione) {
  for (const v of voci) {
    if (!v.nome.startsWith(prefisso) || v.nome.endsWith("/")) continue;
    const file = join(destinazione, v.nome.slice(prefisso.length));
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, v.dati);
  }
}

// ---------- 3. i pack: sostituiti quelli con lo stesso UUID ----------
const vociAddon = leggiZip(readFileSync(addon));
const pack = [];
for (const v of vociAddon.filter((x) => /^[^/]+\/manifest\.json$/.test(x.nome))) {
  const m = JSON.parse(v.dati.toString("utf8").replace(/^﻿/, ""));
  const risorse = (m.modules || []).some((x) => x.type === "resources");
  pack.push({ prefisso: v.nome.replace("manifest.json", ""), uuid: m.header.uuid, nome: m.header.name, tipo: risorse ? "resource_packs" : "behavior_packs" });
}
if (!pack.length) ferma(`${addon} non contiene pack.`);
for (const p of pack) {
  const base = join(condivisa, p.tipo);
  mkdirSync(base, { recursive: true });
  for (const d of readdirSync(base)) {
    if (leggiJson(join(base, d, "manifest.json"))?.header?.uuid === p.uuid) {
      rmSync(join(base, d), { recursive: true, force: true });
      console.log(`Tolto il pack vecchio ${p.tipo}/${d}`);
    }
  }
  const cartella = p.tipo === "resource_packs" ? "CoopSpaceR" : "CoopSpaceB";
  estrai(vociAddon, p.prefisso, join(base, cartella));
  console.log(`Installato "${p.nome}" in ${p.tipo}/${cartella}`);
}
const uuidBp = pack.find((p) => p.tipo === "behavior_packs")?.uuid;

// ---------- 4. il mondo di prova, in cima alla lista ----------
const vociMondo = leggiZip(readFileSync(mondo));
const nomeMondo = vociMondo.find((v) => v.nome === "levelname.txt")?.dati.toString("utf8").trim() || "Coop Space";
// Minecraft ordina i mondi per "LastPlayed" (secondi, nel level.dat): lo mettiamo ad adesso.
const tag = Buffer.concat([Buffer.from([4]), Buffer.from([10, 0]), Buffer.from("LastPlayed")]);
for (const v of vociMondo.filter((x) => x.nome === "level.dat" || x.nome === "level.dat_old")) {
  const i = v.dati.indexOf(tag);
  if (i >= 0) v.dati.writeBigInt64LE(BigInt(Math.floor(Date.now() / 1000)), i + tag.length);
}
// Mondi di prova vecchi: nome "Coop Space ..." e il nostro behavior pack dentro il mondo.
const vecchi = readdirSync(mondi).filter((d) => {
  const nome = existsSync(join(mondi, d, "levelname.txt")) ? readFileSync(join(mondi, d, "levelname.txt"), "utf8").trim() : "";
  const usa = JSON.stringify(leggiJson(join(mondi, d, "world_behavior_packs.json")) || []).includes(uuidBp);
  return nome.startsWith("Coop Space ") && usa && existsSync(join(mondi, d, "behavior_packs"));
});
const cartellaMondo = `coopprova${Date.now().toString(36)}`;
estrai(vociMondo, "", join(mondi, cartellaMondo));
console.log(`Aggiunto il mondo "${nomeMondo}"`);
if (pulisci) {
  for (const d of vecchi) {
    console.log(`Cancellato il mondo di prova vecchio "${readFileSync(join(mondi, d, "levelname.txt"), "utf8").trim()}"`);
    rmSync(join(mondi, d), { recursive: true, force: true });
  }
} else if (vecchi.length) {
  console.log(`(Ci sono ${vecchi.length} mondi di prova vecchi: "npm run prova-mc -- --pulisci" li cancella.)`);
}

// ---------- 5. avvio ----------
if (avvia) {
  spawnSync("cmd", ["/c", "start", "", "minecraft:"], { stdio: "ignore" });
  console.log("\nAvvio Minecraft.");
}
console.log(`\n✓ Pronto: in Minecraft entra nel mondo "${nomeMondo}" (il primo della lista).`);
console.log('  Entrando, la chat deve dire "Coop Space ... attivo."');
