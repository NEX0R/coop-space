// Controllo obbligatorio: nessun lavoro è "finito" finché questo script non esce con codice 0.
// 1) Controlla la sintassi degli script JavaScript del behavior pack.
// 2) Controlli del progetto che il validatore Mojang non fa (errori trovati provando nel gioco):
//    forma dei blocchi, dipendenza circolare tra i pack, nomi italiano e inglese.
// 3) Lancia il validatore ufficiale Mojang (Minecraft Creator Tools) tramite lo script
//    della skill "debug-addon", che filtra i falsi positivi e controlla le dipendenze tra pack.
import { spawnSync } from "node:child_process";
import { readdirSync, statSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// fileURLToPath dà un percorso valido anche su Windows (C:\...), a differenza di URL.pathname.
const root = fileURLToPath(new URL("..", import.meta.url));
const addonDir = join(root, "addon");
let failed = false;
let syntaxErrors = 0;

function listJs(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? listJs(p) : p.endsWith(".js") ? [p] : [];
  });
}

console.log("1/3 Controllo sintassi degli script...");
const bpRoot = join(addonDir, "behavior_packs");
const jsFiles = existsSync(bpRoot)
  ? readdirSync(bpRoot).flatMap((pack) => listJs(join(bpRoot, pack, "scripts")))
  : [];
for (const file of jsFiles) {
  const r = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (r.status !== 0) {
    failed = true;
    syntaxErrors++;
    console.error(`  ERRORE di sintassi in ${file}\n${r.stderr}`);
  }
}
console.log(`  ${jsFiles.length} file controllati.`);

console.log("2/3 Controlli del progetto (quello che il validatore Mojang non vede)...");
let projectErrors = 0;
const problema = (testo) => {
  projectErrors++;
  failed = true;
  console.error(`  ERRORE: ${testo}`);
};
// I file Bedrock possono avere commenti // e il BOM: li togliamo prima di leggere il JSON.
const leggiJson = (file) => {
  try {
    return JSON.parse(readFileSync(file, "utf8").replace(/^﻿/, "").replace(/^\s*\/\/.*$/gm, ""));
  } catch {
    return null;
  }
};
const elencaJson = (dir) =>
  !existsSync(dir)
    ? []
    : readdirSync(dir).flatMap((name) => {
        const p = join(dir, name);
        return statSync(p).isDirectory() ? elencaJson(p) : p.endsWith(".json") ? [p] : [];
      });
const leggiLang = (file) =>
  !existsSync(file)
    ? new Set()
    : new Set(
        readFileSync(file, "utf8")
          .split(/\r?\n/)
          .map((r) => r.split("=")[0].trim())
          .filter((k) => k && !k.startsWith("#")),
      );
const rpRoot = join(addonDir, "resource_packs");
const bpDirs = existsSync(bpRoot) ? readdirSync(bpRoot).map((d) => join(bpRoot, d)) : [];
const rpDirs = existsSync(rpRoot) ? readdirSync(rpRoot).map((d) => join(rpRoot, d)) : [];
const it = new Set(rpDirs.flatMap((d) => [...leggiLang(join(d, "texts", "it_IT.lang"))]));
const en = new Set(rpDirs.flatMap((d) => [...leggiLang(join(d, "texts", "en_US.lang"))]));
const nomi = (chiave, cosa, file) => {
  if (!it.has(chiave)) problema(`${cosa} (${file}) non ha il nome italiano: aggiungi "${chiave}=..." in texts/it_IT.lang.`);
  if (!en.has(chiave)) problema(`${cosa} (${file}) non ha il nome inglese: aggiungi "${chiave}=..." in texts/en_US.lang.`);
};
let contenuti = 0;
for (const bp of bpDirs) {
  for (const file of elencaJson(join(bp, "blocks"))) {
    const blocco = leggiJson(file)?.["minecraft:block"];
    const id = blocco?.description?.identifier;
    if (!id) continue;
    contenuti++;
    const rel = file.slice(addonDir.length + 1);
    // Senza forma il gioco scarta il blocco senza avvisi: non c'è nell'inventario e /give dà errore.
    if (!blocco.components?.["minecraft:geometry"]) problema(`il blocco ${id} (${rel}) non ha "minecraft:geometry": il gioco lo scarta. Per un cubo pieno: "minecraft:geometry": "minecraft:geometry.full_block".`);
    nomi(`tile.${id}.name`, `il blocco ${id}`, rel);
  }
  for (const file of elencaJson(join(bp, "entities"))) {
    const id = leggiJson(file)?.["minecraft:entity"]?.description?.identifier;
    if (!id) continue;
    contenuti++;
    nomi(`entity.${id}.name`, `il mob ${id}`, file.slice(addonDir.length + 1));
  }
  for (const file of elencaJson(join(bp, "items"))) {
    const item = leggiJson(file)?.["minecraft:item"];
    const id = item?.description?.identifier;
    if (!id) continue;
    contenuti++;
    // Gli oggetti possono avere il nome nel componente minecraft:display_name invece che nei .lang.
    if (!item.components?.["minecraft:display_name"]) nomi(`item.${id}.name`, `l'oggetto ${id}`, file.slice(addonDir.length + 1));
  }
}
// La guida Mojang (debug-addon) avverte: dipendenze circolari tra pack possono impedirne il caricamento.
const uuidBp = new Set(bpDirs.map((d) => leggiJson(join(d, "manifest.json"))?.header?.uuid).filter(Boolean));
// Il behavior pack deve dipendere dal resource pack: così attivando "Coop Space" nei Pacchetti
// comportamento si attiva da sola anche la grafica (senza, i blocchi sono senza texture o nomi).
const uuidRp = new Set(rpDirs.map((d) => leggiJson(join(d, "manifest.json"))?.header?.uuid).filter(Boolean));
for (const bp of bpDirs) {
  const deps = leggiJson(join(bp, "manifest.json"))?.dependencies || [];
  if (uuidRp.size && !deps.some((d) => uuidRp.has(d.uuid))) problema(`il behavior pack ${bp.slice(addonDir.length + 1)} non dipende dal resource pack: attivandolo non arriverebbe la grafica. Aggiungi l'uuid e la versione del resource pack nelle sue "dependencies".`);
}
for (const rp of rpDirs) {
  const deps = leggiJson(join(rp, "manifest.json"))?.dependencies || [];
  if (deps.some((d) => uuidBp.has(d.uuid))) problema(`il resource pack ${rp.slice(addonDir.length + 1)} dipende dal behavior pack: dipendenza circolare. Togli quella dipendenza (deve dipendere solo il behavior pack dal resource pack).`);
}
console.log(`  ${contenuti} contenuti controllati, ${projectErrors} problemi.`);

console.log("3/3 Validatore ufficiale Mojang...");
const summary = join(
  root,
  "node_modules/@minecraft/creator-tools/skills/debug-addon/scripts/validate-summary.mjs",
);
if (!existsSync(summary)) {
  console.error("  Creator Tools non installato: esegui prima `npm install`.");
  process.exit(2);
}
// Prima il resoconto leggibile, poi i conteggi in JSON per decidere.
spawnSync(process.execPath, [summary, addonDir], { stdio: "inherit" });
const j = spawnSync(process.execPath, [summary, addonDir, "--json"], { encoding: "utf8" });
let counts;
try {
  counts = JSON.parse(j.stdout).counts;
} catch {
  console.error("  Il validatore non ha prodotto un risultato leggibile (codice " + j.status + ").");
  process.exit(2);
}
// Anche gli avvisi bloccano: la skill ufficiale "debug-addon" li considera problemi reali
// (es. [PACKDEP]: i pack non si attivano insieme). Il "likely noise" invece è accettato da Bedrock.
if (counts.errors > 0 || counts.warnings > 0) failed = true;

if (failed) {
  console.error(
    `\nVERIFICA FALLITA (${counts.errors} errori e ${counts.warnings} avvisi Mojang, ${projectErrors} problemi del progetto, ${syntaxErrors} script con errori di sintassi): correggi prima di considerare il lavoro finito.`,
  );
  process.exit(1);
}
console.log("\nVERIFICA OK: nessun errore e nessun avviso.");
