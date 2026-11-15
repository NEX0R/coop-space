// Eseguito da Claude Code all'inizio di ogni sessione (hook SessionStart in .claude/settings.json).
// Quello che scrive finisce nel contesto dell'assistente, quindi scrive poco.
// 1. Aggiorna il progetto da GitHub, solo quando è sicuro (main pulito, avanzamento semplice).
// 2. Installa gli strumenti se mancano o se package-lock.json è cambiato.
// 3. Elenca i lavori aperti (pull request e richieste), per non rifare quello che fa già un altro.
// Se qualcosa non va (niente rete, niente git) non blocca mai la sessione.
import { existsSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const righe = [];

function git(...args) {
  const r = spawnSync("git", args, { cwd: root, encoding: "utf8", timeout: 30000 });
  return { ok: r.status === 0, out: (r.stdout || "").trim(), err: (r.stderr || "").trim() };
}

// ---------- 1. aggiornamento da GitHub ----------
function aggiorna() {
  if (!git("rev-parse", "--is-inside-work-tree").ok) return;
  const ramo = git("rev-parse", "--abbrev-ref", "HEAD").out;
  if (ramo === "main") {
    if (!git("fetch", "--quiet", "origin", "main").ok) return; // niente rete: si lavora con quello che c'è
  } else {
    // aggiorna main senza cambiare ramo; se non è un avanzamento semplice, git rifiuta e non tocca niente
    git("fetch", "--quiet", "origin", "main:main");
    git("fetch", "--quiet", "origin", "main");
  }
  const indietro = Number(git("rev-list", "--count", "HEAD..origin/main").out || 0);
  if (!indietro) return;
  if (ramo === "main") {
    const sporco = git("status", "--porcelain", "--untracked-files=no").out;
    if (sporco) {
      righe.push(`ATTENZIONE: main è indietro di ${indietro} modifiche rispetto a GitHub e ci sono file modificati: non l'ho aggiornato. Sposta le modifiche su un ramo nuovo, poi git pull.`);
    } else if (git("merge", "--ff-only", "--quiet", "origin/main").ok) {
      righe.push(`Progetto aggiornato da GitHub: ${indietro} modifiche nuove su main.`);
    } else {
      righe.push(`ATTENZIONE: non riesco ad aggiornare main (${indietro} modifiche nuove su GitHub). Lancia git pull e leggi l'errore.`);
    }
  } else {
    righe.push(`Il ramo "${ramo}" è indietro di ${indietro} modifiche rispetto a main: prima di aprire o aggiornare la pull request lancia git merge origin/main.`);
  }
}

// ---------- 2. strumenti ----------
function strumenti() {
  const lock = path.join(root, "package-lock.json");
  const installed = path.join(root, "node_modules", ".package-lock.json");
  const tool = path.join(root, "node_modules", "@minecraft", "creator-tools", "package.json");
  const manca = !existsSync(tool) || !existsSync(installed);
  const vecchio = !manca && statSync(lock).mtimeMs > statSync(installed).mtimeMs;
  if (!manca && !vecchio) return;
  const r = spawnSync("npm ci --no-audit --no-fund --loglevel=error", { cwd: root, encoding: "utf8", shell: true });
  righe.push(r.status === 0 ? `Strumenti del progetto ${manca ? "installati" : "aggiornati"} (npm ci).` : `npm ci non è riuscito: lancia "npm install" e leggi l'errore.\n${(r.stderr || "").slice(-600)}`);
}

// ---------- 3. lavori aperti ----------
async function lavoriAperti() {
  const url = git("remote", "get-url", "origin").out;
  const m = url.match(/github\.com[:/]([^/]+\/[^/.]+)/);
  const repo = m ? m[1] : "NEX0R/coop-space";
  // https con agent:false: la connessione si chiude subito e il processo può finire da solo
  // (con fetch e process.exit Node su Windows a volte va in crash mentre chiude la connessione)
  const chiedi = (p) =>
    new Promise((ok, ko) => {
      const req = https.get(`https://api.github.com/repos/${repo}/${p}`, { agent: false, timeout: 6000, headers: { Accept: "application/vnd.github+json", "User-Agent": "coop-space-avvio" } }, (res) => {
        let dati = "";
        res.setEncoding("utf8");
        res.on("data", (d) => (dati += d));
        res.on("end", () => {
          try {
            res.statusCode === 200 ? ok(JSON.parse(dati)) : ko(res.statusCode);
          } catch (e) {
            ko(e);
          }
        });
      });
      req.on("timeout", () => req.destroy(new Error("timeout")));
      req.on("error", ko);
    });
  try {
    const [prs, issues] = await Promise.all([chiedi("pulls?state=open&per_page=20"), chiedi("issues?state=open&per_page=20")]);
    const voci = [
      ...prs.map((p) => `- PR #${p.number}${p.draft ? " [in corso]" : ""} ${p.title} (di ${p.user.login}, ramo ${p.head.ref})`),
      ...issues.filter((i) => !i.pull_request).map((i) => `- Richiesta #${i.number}${i.labels.length ? ` [${i.labels.map((l) => l.name).join(", ")}]` : ""} ${i.title} (di ${i.user.login})`),
    ];
    righe.push(voci.length ? `Lavori aperti su GitHub (prima di iniziare controlla che nessuno stia già facendo la stessa cosa):\n${voci.join("\n")}` : "Nessuna pull request o richiesta aperta su GitHub.");
  } catch {
    // niente rete o limite di richieste: si va avanti; il sito del team mostra gli stessi dati
  }
}

aggiorna();
strumenti();
await lavoriAperti();
if (righe.length) console.log(righe.join("\n"));
process.exitCode = 0;
