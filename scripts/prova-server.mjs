// Prova automatica sul server ufficiale Bedrock (npm run prova-server).
//
// Avvia il "Bedrock Dedicated Server" di Mojang (un Minecraft senza schermo), gli fa caricare
// l'add-on e controlla due cose che `npm run verify` non può sapere:
//   1. se il gioco scrive errori mentre carica i pack (blocchi scartati, script che si fermano...);
//   2. se ogni blocco, oggetto e mob `coop:` esiste davvero nel gioco (come fare /give a mano);
//   3. se gli script hanno il "pulsante di prova" (scripts/prove.js del behavior pack), lo preme con
//      `/scriptevent coop:autotest` e legge l'esito di ogni prova, più gli errori scritti DOPO l'avvio.
// Non controlla la grafica: texture e modelli li disegna solo il gioco vero.
//
// Il mondo di prova è nuovo a ogni avvio e senza esperimenti, come sul telefono.
// Serve l'EULA di Minecraft accettata dalla persona (vedi AGENTS.md): lo script non la accetta mai.
//
// Uso:  npm run prova-server                     prova la cartella addon/
//       npm run prova-server -- --addon <dir>    prova un'altra cartella con dentro behavior_packs/
// Codici di uscita: 0 tutto bene, 1 problemi nell'add-on, 3 la prova non è potuta partire.

import { spawn, spawnSync } from "node:child_process";
import {
  appendFileSync, chmodSync, cpSync, createWriteStream, existsSync, mkdirSync,
  readdirSync, readFileSync, rmSync, writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// Per accendere l'esperimento "Beta API" serve scrivere il level.dat (NBT): lo fa un modulo interno dei
// Creator Tools. Se un aggiornamento lo sposta, le prove da giocatore risultano "saltate" e il resto continua.
let WorldLevelDat = null;
try {
  WorldLevelDat = (await import("../node_modules/@minecraft/creator-tools/lib/minecraft/WorldLevelDat.js")).default.default;
} catch (errore) {
  console.log(`Prove da giocatore saltate: non trovo il modulo per scrivere level.dat (${errore.message}).`);
}
const argomenti = process.argv.slice(2);
const iAddon = argomenti.indexOf("--addon");
const addonDir = resolve(iAddon >= 0 ? argomenti[iAddon + 1] : join(root, "addon"));
const windows = process.platform === "win32";
const serverDir =
  process.env.COOP_SERVER_DIR ||
  (windows
    ? join(process.env.LOCALAPPDATA || homedir(), "coop-space-server")
    : join(homedir(), ".cache", "coop-space-server"));
const eseguibile = join(serverDir, windows ? "bedrock_server.exe" : "bedrock_server");
const VAR_EULA = "MCTOOLS_I_ACCEPT_EULA_AT_MINECRAFTDOTNETSLASHEULA";
const ELENCO_VERSIONI = "https://net-secondary.web.minecraft-services.net/api/v1.0/download/links";
const SENTINELLA = "coop:sentinella_che_non_esiste";
const FINE_PROVE = "COOP-TEST FINE";
const FINE_PROVE_GIOCATORE = "COOP-GIOCATORE FINE";
const DIR_PROVE_GIOCATORE = join(root, "scripts", "prove-giocatore");
// Zona tenuta carica per le prove degli script: deve coprire ORIGINE di scripts/prove.js.
const ZONA_PROVE = "tickingarea add 0 100 0 15 110 15 coop_prove";

// La prova non è potuta partire: non è colpa dell'add-on (codice 3).
function nonPartita(messaggio) {
  console.error(`\n✗ La prova sul server non è partita: ${messaggio}`);
  riepilogoGitHub(`### Prova sul server Bedrock\n\n⚠️ Non è partita: ${messaggio}\n`);
  process.exit(3);
}

function riepilogoGitHub(testo) {
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, testo + "\n");
}

function leggiJson(file) {
  return JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

function fileJson(cartella) {
  if (!existsSync(cartella)) return [];
  return readdirSync(cartella, { withFileTypes: true, recursive: true })
    .filter((f) => f.isFile() && f.name.endsWith(".json"))
    .map((f) => join(f.parentPath ?? f.path, f.name));
}

function sottocartelle(cartella) {
  if (!existsSync(cartella)) return [];
  return readdirSync(cartella, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
}

// ---------------------------------------------------------------------------------------------
// 1. EULA: deve averla accettata la persona, con `mct eula` sul PC o con la variabile su GitHub.
// ---------------------------------------------------------------------------------------------
function eulaAccettata() {
  if ((process.env[VAR_EULA] || "").toLowerCase() === "true") return true;
  const mct = join(root, "node_modules", "@minecraft", "creator-tools", "cli", "index.mjs");
  if (!existsSync(mct)) return false;
  const r = spawnSync(process.execPath, [mct, "eula", "--status", "--json"], { encoding: "utf8" });
  return /"accepted"\s*:\s*true/.test(r.stdout || "");
}

// ---------------------------------------------------------------------------------------------
// 2. Server: si scarica dal sito ufficiale la prima volta e quando esce una versione nuova.
// ---------------------------------------------------------------------------------------------
async function preparaServer() {
  const tipo = windows ? "serverBedrockWindows" : process.platform === "linux" ? "serverBedrockLinux" : null;
  if (!tipo) nonPartita("il server Bedrock esiste solo per Windows e Linux.");

  const fileVersione = join(serverDir, "versione.txt");
  const installata = existsSync(eseguibile) && existsSync(fileVersione) ? readFileSync(fileVersione, "utf8").trim() : "";
  const intestazioni = { "User-Agent": "Mozilla/5.0 (prova-server)" };

  let indirizzo = "";
  let ultima = "";
  try {
    const risposta = await fetch(ELENCO_VERSIONI, { headers: intestazioni, signal: AbortSignal.timeout(30000) });
    const dati = await risposta.json();
    indirizzo = dati.result.links.find((l) => l.downloadType === tipo).downloadUrl;
    ultima = indirizzo.match(/-([\d.]+)\.zip$/)[1];
  } catch (errore) {
    if (installata) {
      console.log(`Non riesco a controllare se c'è un server più nuovo (${errore.message}): uso la ${installata}.`);
      return installata;
    }
    nonPartita(`non riesco a leggere l'elenco delle versioni del server (${errore.message}).`);
  }
  if (installata === ultima) return installata;

  console.log(`Scarico il server Bedrock ${ultima} dal sito ufficiale (solo la prima volta e a ogni versione nuova)...`);
  const zip = serverDir + ".zip";
  try {
    rmSync(serverDir, { recursive: true, force: true });
    mkdirSync(serverDir, { recursive: true });
    const risposta = await fetch(indirizzo, { headers: intestazioni });
    if (!risposta.ok) throw new Error(`il sito ha risposto ${risposta.status}`);
    await pipeline(Readable.fromWeb(risposta.body), createWriteStream(zip));
    // Su Windows si usa il tar di sistema (sa aprire gli zip); quello di Git Bash no.
    const estrai = windows
      ? spawnSync(join(process.env.SystemRoot || "C:\\Windows", "System32", "tar.exe"), ["-xf", zip, "-C", serverDir])
      : spawnSync("unzip", ["-q", "-o", zip, "-d", serverDir]);
    if (estrai.status !== 0 || !existsSync(eseguibile)) throw new Error("non riesco ad aprire il file scaricato");
    if (!windows) chmodSync(eseguibile, 0o755);
    cpSync(join(serverDir, "server.properties"), join(serverDir, "server.properties.originale"));
    writeFileSync(fileVersione, ultima);
  } catch (errore) {
    rmSync(serverDir, { recursive: true, force: true });
    nonPartita(`download del server fallito (${errore.message}).`);
  } finally {
    rmSync(zip, { force: true });
  }
  return ultima;
}

// ---------------------------------------------------------------------------------------------
// 3. Mondo di prova: nuovo ogni volta, con i pack dell'add-on già attivi e nessun esperimento.
// ---------------------------------------------------------------------------------------------
function preparaMondo() {
  const pack = [];
  for (const [tipo, sorgente, destinazione] of [
    ["behavior", "behavior_packs", "development_behavior_packs"],
    ["resource", "resource_packs", "development_resource_packs"],
  ]) {
    rmSync(join(serverDir, destinazione), { recursive: true, force: true });
    mkdirSync(join(serverDir, destinazione), { recursive: true });
    for (const nome of sottocartelle(join(addonDir, sorgente))) {
      cpSync(join(addonDir, sorgente, nome), join(serverDir, destinazione, nome), { recursive: true });
      const intestazione = leggiJson(join(addonDir, sorgente, nome, "manifest.json")).header;
      pack.push({ tipo, nome, cartella: join(addonDir, sorgente, nome), uuid: intestazione.uuid, versione: intestazione.version, titolo: intestazione.name });
    }
  }
  // Questo pack beta vive solo nel server usa-e-getta. Non viene mai copiato in addon/.
  if (WorldLevelDat) {
  const packGiocatore = leggiJson(join(DIR_PROVE_GIOCATORE, "manifest.json"));
  cpSync(DIR_PROVE_GIOCATORE, join(serverDir, "development_behavior_packs", "coop_prove_giocatore"), { recursive: true });
  pack.push({
    tipo: "behavior",
    nome: "prove-giocatore",
    cartella: DIR_PROVE_GIOCATORE,
    uuid: packGiocatore.header.uuid,
    versione: packGiocatore.header.version,
    titolo: packGiocatore.header.name,
    soloProveGiocatore: true,
  });
  }
  if (!pack.some((p) => p.tipo === "behavior")) nonPartita(`in ${addonDir} non c'è nessun behavior pack.`);

  const mondo = join(serverDir, "worlds", "prova");
  rmSync(mondo, { recursive: true, force: true });
  mkdirSync(mondo, { recursive: true });
  const riferimenti = (tipo) => pack.filter((p) => p.tipo === tipo).map((p) => ({ pack_id: p.uuid, version: p.versione }));
  writeFileSync(join(mondo, "world_behavior_packs.json"), JSON.stringify(riferimenti("behavior"), null, 2));
  writeFileSync(join(mondo, "world_resource_packs.json"), JSON.stringify(riferimenti("resource"), null, 2));
  // Creator Tools Mojang scrive il level.dat NBT Bedrock e il tag experiments.gametest.
  // Il modulo è già una dipendenza dev del progetto; nessuna libreria viene aggiunta.
  if (WorldLevelDat) {
  const level = new WorldLevelDat();
  level.levelName = "prova";
  level.betaApisExperiment = true;
  level.savedWithToggledExperiments = true;
  level.experimentsEverUsed = true;
  level.commandsEnabled = true;
  level.cheatsEnabled = true;
  level.ensureDefaults();
  level.persist();
  writeFileSync(join(mondo, "level.dat"), Buffer.from(level.getBytes()));
  }

  // Impostazioni del server: porta diversa da quella normale e invisibile in rete locale,
  // così non disturba chi sta giocando; registro dei contenuti scritto sulla console.
  const impostazioni = {
    "server-name": "Prova Coop Space",
    "level-name": "prova",
    gamemode: "creative",
    difficulty: "peaceful",
    "allow-cheats": "true",
    "online-mode": "false",
    "allow-list": "false", // con online-mode spento il server rifiuta di partire se la lista è attiva
    "enable-lan-visibility": "false",
    "server-port": "19432",
    "server-portv6": "19433",
    "emit-server-telemetry": "false",
    "content-log-file-enabled": "false",
    "content-log-console-output-enabled": "true",
    "content-log-console-output": "true",
    "content-log-level": "verbose",
  };
  const fatte = new Set();
  const righe = readFileSync(join(serverDir, "server.properties.originale"), "utf8").split(/\r?\n/).map((riga) => {
    const chiave = riga.split("=")[0].trim();
    if (!(chiave in impostazioni)) return riga;
    fatte.add(chiave);
    return `${chiave}=${impostazioni[chiave]}`;
  });
  for (const chiave of Object.keys(impostazioni)) if (!fatte.has(chiave)) righe.push(`${chiave}=${impostazioni[chiave]}`);
  writeFileSync(join(serverDir, "server.properties"), righe.join("\n"));
  return pack;
}

// Identificativi dichiarati nei behavior pack, con il comando che li mette alla prova.
function contenuti(pack) {
  const tipi = [
    ["blocks", "minecraft:block", "il blocco", (id) => `setblock 0 200 0 ${id}`],
    ["items", "minecraft:item", "l'oggetto", (id) => `give @a ${id}`],
    ["entities", "minecraft:entity", "il mob", (id) => `summon ${id} 0 200 0`],
  ];
  const elenco = [];
  for (const p of pack.filter((x) => x.tipo === "behavior")) {
    for (const [cartella, chiave, cosa, comando] of tipi) {
      for (const file of fileJson(join(p.cartella, cartella))) {
        let id;
        try { id = leggiJson(file)[chiave]?.description?.identifier; } catch { /* JSON rotto: lo segnala già verify */ }
        if (id) elenco.push({ id, cosa, comando: comando(id), file: file.slice(addonDir.length + 1) });
      }
    }
  }
  return elenco;
}

// ---------------------------------------------------------------------------------------------
// 4. Avvio: aspetta "Server started", manda i comandi dalla console, poi spegne.
// ---------------------------------------------------------------------------------------------
function avviaServer(comandi, aspettaProve, aspettaProveGiocatore) {
  return new Promise((fine) => {
    const righe = [];
    const prima = []; // scritte durante il caricamento (prima dei comandi)
    const dopo = []; // risposte ai comandi
    let partito = false;
    let comandiMandati = false;
    let chiuso = false;
    const attesa = (ms) => new Promise((r) => setTimeout(r, ms));
    const ambiente = { ...process.env, LD_LIBRARY_PATH: serverDir };
    const srv = spawn(eseguibile, [], { cwd: serverDir, env: ambiente });

    const spegni = () => {
      if (chiuso) return;
      chiuso = true;
      try { srv.stdin.write("stop\n"); } catch { /* già chiuso */ }
      setTimeout(() => { try { srv.kill(); } catch { /* già chiuso */ } }, 10000);
    };
    const tempoMassimo = setTimeout(spegni, 240000);

    async function mandaComandi() {
      await attesa(2000); // lascia finire gli script di avvio
      comandiMandati = true;
      for (const comando of [...comandi, `setblock 0 200 0 ${SENTINELLA}`]) {
        srv.stdin.write(comando + "\n");
        await attesa(250);
      }
      // La sentinella è un blocco inventato: quando il server la rifiuta, ha letto tutti i comandi.
      for (let i = 0; i < 60 && !dopo.some((r) => r.includes(SENTINELLA)); i++) await attesa(250);
      // Le prove degli script girano nei tick del gioco: si aspetta la loro riga finale (massimo 60 s).
      if (aspettaProve) for (let i = 0; i < 240 && !dopo.some((r) => r.includes(FINE_PROVE)); i++) await attesa(250);
      // Il pack beta è opzionale: aspetta la risposta, poi segnala Saltato se non è partito.
      if (aspettaProveGiocatore) for (let i = 0; i < 80 && !dopo.some((r) => r.includes(FINE_PROVE_GIOCATORE)); i++) await attesa(250);
      spegni();
    }

    let resto = "";
    const leggi = (pezzo) => {
      resto += pezzo.toString("utf8");
      const parti = resto.split(/\r?\n/);
      resto = parti.pop();
      for (const riga of parti) {
        if (!riga.trim()) continue;
        righe.push(riga);
        (comandiMandati ? dopo : prima).push(riga);
        if (!partito && riga.includes("Server started")) { partito = true; mandaComandi(); }
      }
    };
    srv.stdout.on("data", leggi);
    srv.stderr.on("data", leggi);
    srv.on("error", (errore) => { clearTimeout(tempoMassimo); fine({ righe, prima, dopo, partito, errore }); });
    srv.on("exit", () => { clearTimeout(tempoMassimo); fine({ righe, prima, dopo, partito }); });
  });
}

// ---------------------------------------------------------------------------------------------
// 5. Lettura del risultato.
// ---------------------------------------------------------------------------------------------
// Messaggi che il server scrive sempre, anche senza add-on.
const RUMORE = [/bootstrap\.json/, /cdn_config\.json/];

function leggiRisultato(esito, pack, elenco) {
  const problemi = [];
  const altri = [];
  // Gli errori del pack opzionale non devono trasformarsi in errori dell'add-on: se Gametest
  // non si carica, più sotto la sua prova risulta saltata e il motivo resta nel log completo.
  const parole = ["coop", "development_", "[Scripting]", ...pack.filter((p) => !p.soloProveGiocatore).flatMap((p) => [p.nome, p.titolo])].filter(Boolean);

  // Errori del caricamento e, dopo i comandi, degli script (per esempio un TypeError dentro una prova).
  // Dopo i comandi contano solo le righe degli script: le risposte ai comandi sono volute.
  for (const riga of [...esito.prima, ...esito.dopo.filter((r) => r.includes("[Scripting]"))]) {
    if (riga.includes("COOP-TEST") || riga.includes("COOP-GIOCATORE")) continue;
    if (riga.includes("prove-giocatore") || riga.includes("Coop Space - prove da giocatore")) continue;
    if (!/\b(ERROR|WARN)\]/.test(riga) || RUMORE.some((r) => r.test(riga))) continue;
    const testo = riga.replace(/^\[[^\]]*\]\s*/, "");
    (parole.some((p) => riga.includes(p)) ? problemi : altri).push(testo);
  }

  // Esito del pulsante di prova: una riga "COOP-TEST <nome> OK|FALLITO ..." per prova.
  const prove = [];
  for (const riga of esito.dopo) {
    const m = riga.match(/COOP-TEST (\S+) (OK|FALLITO)(.*)$/);
    if (m) prove.push({ nome: m[1], ok: m[2] === "OK", dettaglio: m[3].replace(/^[:\s]+/, "").trim() });
  }
  const proveFinite = esito.dopo.some((r) => r.includes(FINE_PROVE));
  const proveGiocatore = [];
  for (const riga of esito.dopo) {
    const m = riga.match(/COOP-GIOCATORE (\S+) (OK|FALLITO|SALTATO)(.*)$/);
    if (m) proveGiocatore.push({ nome: m[1], stato: m[2], ok: m[2] === "OK", dettaglio: m[3].replace(/^[:\s()]+|[()]+$/g, "").trim() });
  }
  const proveGiocatoreFinite = esito.dopo.some((r) => r.includes(FINE_PROVE_GIOCATORE));

  const rifiutati = new Set();
  for (const riga of esito.dopo) for (const m of riga.matchAll(/Unexpected "([^"]+)"/g)) rifiutati.add(m[1]);
  const comandiLetti = rifiutati.has(SENTINELLA);
  const mancanti = elenco.filter((c) => rifiutati.has(c.id));
  return { problemi, altri, comandiLetti, mancanti, prove, proveFinite, proveGiocatore, proveGiocatoreFinite };
}

// ---------------------------------------------------------------------------------------------
if (!eulaAccettata()) {
  nonPartita(
    "serve l'EULA di Minecraft, e deve accettarla la persona, non l'assistente.\n" +
      "  Sul PC, una volta sola:  npx -y @minecraft/creator-tools@0.21.0 eula\n" +
      "  (in Claude Code scrivilo nel prompt con un punto esclamativo davanti)"
  );
}
if (!existsSync(join(addonDir, "behavior_packs"))) nonPartita(`la cartella ${addonDir} non contiene behavior_packs/.`);

const versione = await preparaServer();
const pack = preparaMondo();
const elenco = contenuti(pack);
console.log(`Avvio il server Bedrock ${versione} con ${pack.map((p) => p.titolo).join(" + ")}...`);
// Il pulsante di prova si preme solo se qualche script del behavior pack lo ascolta.
const conProve = pack.filter((p) => p.tipo === "behavior").some((p) =>
  readdirSync(p.cartella, { recursive: true })
    .some((f) => /\.js$/.test(f) && readFileSync(join(p.cartella, f), "utf8").includes("coop:autotest")));
const comandi = elenco.map((c) => c.comando);
comandi.push("tickingarea add 32 100 0 47 110 15 coop_prove_giocatore");
if (conProve) comandi.push(ZONA_PROVE, "scriptevent coop:autotest");
comandi.push("scriptevent coop:prove_giocatore");
const esito = await avviaServer(comandi, conProve, true);

mkdirSync(join(root, "out"), { recursive: true });
writeFileSync(join(root, "out", "prova-server.log"), esito.righe.join("\n"));

if (!esito.partito) {
  console.error(esito.righe.slice(-15).join("\n"));
  nonPartita(`il server non si è avviato${esito.errore ? ` (${esito.errore.message})` : ""}. Registro completo: out/prova-server.log`);
}

const { problemi, altri, comandiLetti, mancanti, prove, proveFinite, proveGiocatore, proveGiocatoreFinite } = leggiRisultato(esito, pack, elenco);
if (!comandiLetti) nonPartita("il server si è avviato ma non ha risposto ai comandi. Registro completo: out/prova-server.log");

const righeRiepilogo = [];
const scrivi = (riga) => { console.log(riga); righeRiepilogo.push(riga); };
scrivi(`\nProva sul server Bedrock ${versione}`);
scrivi(problemi.length ? `✗ Il gioco ha segnalato ${problemi.length} problemi (caricamento o script):` : "✓ Nessun errore durante il caricamento dell'add-on");
for (const p of problemi) scrivi(`    - ${p}`);
if (!elenco.length) scrivi("- Nessun blocco, oggetto o mob da controllare");
for (const c of elenco) {
  const manca = mancanti.includes(c);
  scrivi(`${manca ? "✗" : "✓"} ${c.cosa} ${c.id} ${manca ? `NON esiste nel gioco: è stato scartato (${c.file})` : "esiste nel gioco"}`);
}
if (conProve) {
  for (const p of prove) scrivi(`${p.ok ? "✓" : "✗"} prova degli script "${p.nome}"${p.dettaglio ? `: ${p.dettaglio}` : ""}`);
  if (!proveFinite) scrivi("✗ Le prove degli script non sono finite entro 60 secondi (bloccate o in errore)");
}
for (const p of proveGiocatore) {
  const stato = p.stato === "OK" ? "✓" : p.stato === "SALTATO" ? "↷" : "✗";
  scrivi(`${stato} prova da giocatore "${p.nome}"${p.dettaglio ? `: ${p.dettaglio}` : ""}`);
}
if (!proveGiocatoreFinite) scrivi("↷ prove da giocatore saltate: il pack beta o il comando Gametest non ha risposto");
if (altri.length) {
  scrivi("- Altri messaggi del server (non riguardano l'add-on):");
  for (const a of altri) scrivi(`    - ${a}`);
}
const fallita = problemi.length > 0 || mancanti.length > 0 || prove.some((p) => !p.ok) || (conProve && !proveFinite) || proveGiocatore.some((p) => p.stato === "FALLITO");
scrivi(fallita ? "\nProva sul server FALLITA: correggi i problemi qui sopra." : "\nProva sul server superata. La grafica va comunque guardata nel gioco.");
riepilogoGitHub("### Prova sul server Bedrock\n\n```\n" + righeRiepilogo.join("\n").trim() + "\n```\n");
process.exit(fallita ? 1 : 0);
