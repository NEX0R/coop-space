// Crea dist/coop-space.mcaddon, il file da aprire sul telefono per importare l'add-on.
// Esegue prima la verifica: un add-on con errori non viene impacchettato.
import { spawnSync } from "node:child_process";
import { mkdirSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const addonDir = join(root, "addon");
const dist = join(root, "dist");
const out = join(dist, "coop-space.mcaddon");

const verify = spawnSync(process.execPath, [join(root, "scripts/verify.mjs")], { stdio: "inherit" });
if (verify.status !== 0) process.exit(verify.status ?? 1);

if (existsSync(out)) rmSync(out);
mkdirSync(dist, { recursive: true });

const mct = join(root, "node_modules/.bin/mct");
const r = spawnSync(mct, ["-i", addonDir, "-o", dist, "--of", out, "export", "addon"], {
  stdio: "inherit",
});
if (r.status !== 0 || !existsSync(out)) {
  console.error("Impacchettamento fallito.");
  process.exit(1);
}
console.log(`\nPronto: ${out}`);
