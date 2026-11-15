// Crea dist/coop-space.mcaddon, il file da aprire sul telefono per importare l'add-on.
// Esegue prima la verifica: un add-on con errori non viene impacchettato.
import { spawnSync } from "node:child_process";
import { mkdirSync, existsSync, rmSync, cpSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// fileURLToPath dà un percorso valido anche su Windows (C:\...), a differenza di URL.pathname.
const root = fileURLToPath(new URL("..", import.meta.url));
const addonDir = join(root, "addon");
const dist = join(root, "dist");
const out = join(dist, "coop-space.mcaddon");

const verify = spawnSync(process.execPath, [join(root, "scripts/verify.mjs")], { stdio: "inherit" });
if (verify.status !== 0) process.exit(verify.status ?? 1);

if (existsSync(out)) rmSync(out);
mkdirSync(dist, { recursive: true });

// Versione automatica: Minecraft rifiuta un pacchetto con UUID e versione già installati
// ("Pacchetto doppio rilevato"), anche se quello installato è rovinato. Ogni pacchetto prende
// quindi una versione che cresce sempre: <prima cifra del repo>.<giorno dal 1/1/2026>.<minuto del giorno>
// (UTC), per esempio 0.319.874. Minecraft tiene ogni cifra in 16 bit (massimo 65535): con questo
// schema non si sfora per oltre un secolo.
// Si modifica solo una copia in out/pacchetto: i manifest in addon/ restano come sono.
const minuti = Math.floor((Date.now() - Date.UTC(2026, 0, 1)) / 60000);
const giorno = Math.floor(minuti / 1440) + 1;
const minuto = minuti % 1440;
const copia = join(root, "out", "pacchetto");
rmSync(copia, { recursive: true, force: true });
cpSync(addonDir, copia, { recursive: true });
const manifest = [];
for (const tipo of ["behavior_packs", "resource_packs"]) {
  const base = join(copia, tipo);
  if (!existsSync(base)) continue;
  for (const pack of readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    const file = join(base, pack.name, "manifest.json");
    if (existsSync(file)) manifest.push({ file, dati: JSON.parse(readFileSync(file, "utf8")) });
  }
}
const nuove = new Map();
for (const m of manifest) {
  m.dati.header.version = [m.dati.header.version[0], giorno, minuto];
  nuove.set(m.dati.header.uuid, m.dati.header.version);
}
for (const m of manifest) {
  for (const d of m.dati.dependencies || []) if (d.uuid && nuove.has(d.uuid)) d.version = [...nuove.get(d.uuid)];
  writeFileSync(m.file, JSON.stringify(m.dati, null, 2) + "\n");
}
const versione = manifest[0]?.dati.header.version.join(".");

// Lanciamo il file JS di mct direttamente con node: il collegamento in node_modules/.bin
// su Windows è un .cmd e non si può avviare così.
const mct = join(root, "node_modules/@minecraft/creator-tools/cli/index.mjs");
const r = spawnSync(
  process.execPath,
  [mct, "-i", copia, "-o", dist, "--of", out, "export", "addon"],
  { stdio: "inherit" },
);
if (r.status !== 0 || !existsSync(out)) {
  console.error("Impacchettamento fallito.");
  process.exit(1);
}
console.log(`\nPronto: ${out} (versione ${versione})`);
