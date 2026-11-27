// Prepara Minecraft sul PC (Windows) per provare l'add-on e lo avvia: niente da importare a mano.
//
//   npm run prova-mc              crea il pacchetto da addon/ (npm run package) e lo installa
//   npm run prova-mc -- 31        scarica l'anteprima della pull request #31 e la installa
//   opzioni: --mondo-nuovo        rifà da zero il mondo "Coop Space - laboratorio" (solo se serve davvero)
//            --pulisci            cancella i mondi di prova "Coop Space ..." vecchi (non quelli tuoi)
//            --non-avviare        installa senza aprire Minecraft
//
// Cosa fa: chiude Minecraft se è aperto, sostituisce i pack "Coop Space" installati con quelli
// nuovi (riconosciuti dall'UUID del manifest, non dal nome), aggiorna l'add-on nel mondo fisso
// "Coop Space - laboratorio" (lo crea la prima volta), lo mette in cima alla lista e avvia il gioco. Codici: 0 = pronto, 3 = non è stato possibile prepararlo.
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

// Uscita con codice 3. Non usa process.exit: dopo un download, su Windows Node si blocca chiudendo.
const FERMATO = Symbol("fermato");
process.on("uncaughtException", (e) => {
  if (e !== FERMATO) {
    console.error(e);
    process.exitCode = 1;
  }
});
const ferma = (msg) => {
  console.error(`\n✗ ${msg}`);
  process.exitCode = 3;
  throw FERMATO;
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
    if (!r.ok) {
      await r.body?.cancel().catch(() => {}); // senza, Node su Windows si blocca uscendo
      ferma(`Anteprima della pull request #${pr} non trovata (${r.status || r.statusText}): la build è finita? Dopo la fusione l'anteprima non c'è più, usa "npm run prova-mc" senza numero.`);
    }
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
  // Una cartella per pack (Coop Space e Sangue Immortale, logica e grafica): con un nome fisso il
  // secondo pack sovrascriveva il primo (successo il 27/11 con la PR #48).
  const cartella = p.prefisso.replace(/\/$/, "");
  estrai(vociAddon, p.prefisso, join(base, cartella));
  console.log(`Installato "${p.nome}" in ${p.tipo}/${cartella}`);
}
const uuidBp = pack.find((p) => p.tipo === "behavior_packs")?.uuid;

// ---------- 4. il mondo "Coop Space - laboratorio", sempre lo stesso ----------
// Il mondo di prova si porta dentro la sua copia dell'add-on: nel laboratorio si sostituiscono solo
// quella copia e l'elenco dei pack attivi (world_*_packs.json). Il resto (db/ = costruzioni,
// level.dat = impostazioni) resta. Con --mondo-nuovo il laboratorio si rifà da zero: serve solo
// per le cose che nascono quando il mondo viene generato (biomi, strutture, generazione naturale).
const LABORATORIO = "coopLaboratorio";
const NOME_LAB = "Coop Space - laboratorio";
const vociMondo = leggiZip(readFileSync(mondo));
const versione = vociMondo.find((v) => v.nome === "levelname.txt")?.dati.toString("utf8").trim().replace(/^Coop Space /, "") || "?";
const u16 = (n) => Buffer.from([n & 255, n >> 8]);
const tagNbt = (tipo, nome) => Buffer.concat([Buffer.from([tipo]), u16(Buffer.byteLength(nome)), Buffer.from(nome)]);
// Nel level.dat: nome del mondo e "LastPlayed" ad adesso (Minecraft ordina i mondi così: va in cima).
function sistemaLevelDat(buf, nome) {
  const tn = tagNbt(8, "LevelName");
  const i = nome ? buf.indexOf(tn) : -1;
  if (i >= 0) {
    const p = i + tn.length;
    const n = Buffer.from(nome, "utf8");
    buf = Buffer.concat([buf.subarray(0, p), u16(n.length), n, buf.subarray(p + 2 + buf.readUInt16LE(p))]);
    buf.writeInt32LE(buf.length - 8, 4); // l'intestazione contiene la lunghezza del resto
  }
  const tl = tagNbt(4, "LastPlayed");
  const j = buf.indexOf(tl);
  if (j >= 0) buf.writeBigInt64LE(BigInt(Math.floor(Date.now() / 1000)), j + tl.length);
  return buf;
}
const lab = join(mondi, LABORATORIO);
const nuovoLab = args.includes("--mondo-nuovo") || !existsSync(join(lab, "level.dat"));
if (nuovoLab) {
  rmSync(lab, { recursive: true, force: true });
  for (const v of vociMondo) {
    if (v.nome === "level.dat" || v.nome === "level.dat_old") v.dati = sistemaLevelDat(v.dati, NOME_LAB);
    if (v.nome === "levelname.txt") v.dati = Buffer.from(NOME_LAB, "utf8");
  }
  estrai(vociMondo, "", lab);
  console.log(`Creato il mondo "${NOME_LAB}" da zero`);
} else {
  for (const d of ["behavior_packs", "resource_packs"]) rmSync(join(lab, d), { recursive: true, force: true });
  const aggiorna = (n) => /^(behavior_packs|resource_packs)\//.test(n) || /^world_(behavior|resource)_pack(s|_history)\.json$/.test(n);
  for (const v of vociMondo.filter((x) => aggiorna(x.nome) && !x.nome.endsWith("/"))) {
    mkdirSync(dirname(join(lab, v.nome)), { recursive: true });
    writeFileSync(join(lab, v.nome), v.dati);
  }
  for (const n of ["level.dat", "level.dat_old"]) {
    if (existsSync(join(lab, n))) writeFileSync(join(lab, n), sistemaLevelDat(readFileSync(join(lab, n))));
  }
  console.log(`Aggiornato l'add-on nel mondo "${NOME_LAB}" (costruzioni e impostazioni restano)`);
}
const nomeMondo = NOME_LAB;
// Mondi di prova vecchi: nome "Coop Space ..." e il nostro behavior pack dentro il mondo.
const vecchi = readdirSync(mondi).filter((d) => {
  if (d === LABORATORIO) return false;
  const nome = existsSync(join(mondi, d, "levelname.txt")) ? readFileSync(join(mondi, d, "levelname.txt"), "utf8").trim() : "";
  const usa = JSON.stringify(leggiJson(join(mondi, d, "world_behavior_packs.json")) || []).includes(uuidBp);
  return nome.startsWith("Coop Space ") && usa && existsSync(join(mondi, d, "behavior_packs"));
});
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
console.log(`\n✓ Pronto: in Minecraft entra nel mondo "${nomeMondo}" (il primo della lista), add-on ${versione}.`);
console.log('  Entrando, la chat deve dire "Coop Space ... attivo."');
