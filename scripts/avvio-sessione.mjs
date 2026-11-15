// Eseguito da Claude Code all'inizio di ogni sessione (hook SessionStart in .claude/settings.json).
// Installa gli strumenti solo se mancano o se package-lock.json è cambiato (per esempio dopo un pull).
// Se non deve fare niente non scrive niente, così non consuma token.
import { existsSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lock = path.join(root, "package-lock.json");
const installed = path.join(root, "node_modules", ".package-lock.json");
const tool = path.join(root, "node_modules", "@minecraft", "creator-tools", "package.json");

const missing = !existsSync(tool) || !existsSync(installed);
const stale = !missing && statSync(lock).mtimeMs > statSync(installed).mtimeMs;
if (!missing && !stale) process.exit(0);

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const r = spawnSync(npm, ["ci", "--no-audit", "--no-fund", "--loglevel=error"], {
  cwd: root,
  encoding: "utf8",
  shell: process.platform === "win32",
});
if (r.status === 0) {
  console.log(`Strumenti del progetto ${missing ? "installati" : "aggiornati"} (npm ci).`);
} else {
  console.log(`npm ci non è riuscito: lancia "npm install" e leggi l'errore.\n${(r.stderr || "").slice(-600)}`);
}
process.exit(0);
