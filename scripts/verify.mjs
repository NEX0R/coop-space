// Controllo obbligatorio: nessun lavoro è "finito" finché questo script non esce con codice 0.
// 1) Controlla la sintassi degli script JavaScript del behavior pack.
// 2) Lancia il validatore ufficiale Mojang (Minecraft Creator Tools) tramite lo script
//    della skill "debug-addon", che filtra i falsi positivi e controlla le dipendenze tra pack.
import { spawnSync } from "node:child_process";
import { readdirSync, statSync, existsSync } from "node:fs";
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

console.log("1/2 Controllo sintassi degli script...");
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

console.log("2/2 Validatore ufficiale Mojang...");
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
    `\nVERIFICA FALLITA (${counts.errors} errori, ${counts.warnings} avvisi, ${syntaxErrors} script con errori di sintassi): correggi prima di considerare il lavoro finito.`,
  );
  process.exit(1);
}
console.log("\nVERIFICA OK: nessun errore e nessun avviso.");
