// Eseguito da Claude Code all'inizio di ogni sessione (hook SessionStart in .claude/settings.json).
// Quello che scrive finisce nel contesto dell'assistente, quindi scrive poco.
// 1. Aggiorna il progetto da GitHub, solo quando è sicuro (main pulito, avanzamento semplice).
// 2. Installa gli strumenti se mancano o se package-lock.json è cambiato.
// 3. Elenca i lavori aperti (pull request e richieste), per non rifare quello che fa già un altro.
// Se qualcosa non va (niente rete, niente git) non blocca mai la sessione.
import { existsSync, statSync, readFileSync } from "node:fs";
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

// ---------- 0. la cartella è collegata al progetto giusto? ----------
// Chi ha accesso in scrittura lavora sul repository del gruppo, non su una sua copia (fork):
// da una copia main resta vecchio, e anteprime e fusione automatica non partono.
function collegamento() {
  const url = git("remote", "get-url", "origin").out;
  const m = url.match(/github\.com[:/]([^/]+)\/([^/.\s]+)/i);
  if (!m || `${m[1]}/${m[2]}`.toLowerCase() === "nex0r/coop-space") return;
  righe.push(`ATTENZIONE: questa cartella è collegata a ${m[1]}/${m[2]}, una copia (fork), non al progetto del gruppo NEX0R/coop-space. Da qui main resta vecchio e anteprime e fusione automatica non partono. Prima di lavorare spiegalo all'utente e, con il suo ok, ricollegala: git remote set-url origin https://github.com/NEX0R/coop-space.git && git fetch origin.`);
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
  // npm ci cancella tutta la cartella node_modules: su Windows fallisce a metà (EPERM) se il server MCP
  // di Mojang, avviato con la sessione, tiene aperto un suo file. Per aggiornare basta npm install,
  // che segue package-lock.json e non tocca i file già giusti (problema visto il 26/11).
  const comando = manca && !existsSync(path.join(root, "node_modules")) ? "npm ci" : "npm install";
  let r = spawnSync(`${comando} --no-audit --no-fund --loglevel=error`, { cwd: root, encoding: "utf8", shell: true });
  if (r.status !== 0 && comando === "npm ci") r = spawnSync("npm install --no-audit --no-fund --loglevel=error", { cwd: root, encoding: "utf8", shell: true });
  righe.push(r.status === 0 ? `Strumenti del progetto ${manca ? "installati" : "aggiornati"}.` : `L'installazione degli strumenti non è riuscita: chiudi le altre sessioni sul progetto, lancia "npm install" e leggi l'errore.\n${(r.stderr || "").slice(-600)}`);
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
  // Nelle sessioni cloud (telefono) Node non passa dal proxy di rete, gh sì: si prova prima gh api
  // (REST: nel cloud i comandi "gh pr" e "gh issue" sono bloccati), poi la connessione diretta.
  const leggi = async (p) => {
    const r = spawnSync("gh", ["api", `repos/${repo}/${p}`], { cwd: root, encoding: "utf8", timeout: 15000 });
    if (r.status === 0) {
      try {
        return JSON.parse(r.stdout);
      } catch {}
    }
    return chiedi(p);
  };
  const voci = [];
  const messaggi = [];
  const conPr = new Set();
  const chi = chiSei();
  accoglienza(chi);
  try {
    const [prs, issues] = await Promise.all([leggi("pulls?state=open&per_page=20"), leggi("issues?state=open&per_page=30")]);
    for (const p of prs) {
      conPr.add(p.head.ref);
      voci.push(`- PR #${p.number}${p.draft ? " [in corso]" : ""} ${p.title} (di ${p.user.login}, ramo ${p.head.ref})`);
    }
    for (const i of issues.filter((x) => !x.pull_request)) {
      const etichette = i.labels.map((l) => l.name);
      if (etichette.includes("chat")) continue; // le chat di WhatsIApp le mostra scripts/chat.mjs (secondo hook di avvio)
      if (etichette.includes("messaggio")) {
        const destinatari = (i.assignees || []).map((a) => a.login);
        if (destinatari.length && chi && !destinatari.includes(chi)) continue; // messaggio per un altro
        const testo = (i.body || "").replace(/\s+/g, " ").trim().slice(0, 300);
        messaggi.push(`- #${i.number} ${i.title} (da ${i.user.login}${destinatari.length ? "" : ", per tutti"}): ${testo}`);
      } else {
        voci.push(`- Richiesta #${i.number}${etichette.length ? ` [${etichette.join(", ")}]` : ""} ${i.title} (di ${i.user.login})`);
      }
    }
  } catch {
    // niente rete o limite di richieste: restano i rami; il sito del team mostra gli stessi dati
    voci.push("- Non riesco a leggere pull request e richieste: guardale nel sito del team prima di iniziare.");
  }
  // Rami su GitHub senza pull request: lavoro iniziato ma non ancora proposto (git passa sempre dal proxy)
  const mio = git("rev-parse", "--abbrev-ref", "HEAD").out;
  const rami = git("ls-remote", "--heads", "origin")
    .out.split("\n")
    .map((r) => r.split("refs/heads/")[1])
    .filter((r) => r && r !== "main" && r !== mio && !conPr.has(r));
  if (rami.length) voci.push(`- Rami senza pull request: ${rami.join(", ")}`);
  if (messaggi.length) righe.push(`MESSAGGI DEL TEAM${chi ? ` PER ${chi}` : ""} (riferiscili all'utente con parole semplici e chiedi se rispondere; vedi guide/messaggi.md):\n${messaggi.join("\n")}`);
  righe.push(voci.length ? `Lavori aperti su GitHub (prima di iniziare controlla che nessuno stia già facendo la stessa cosa):\n${voci.join("\n")}` : "Nessun lavoro aperto su GitHub.");
}

// ---------- 4. chi sta lavorando e accoglienza ----------
// Nel cloud e sui PC con GitHub CLI, "gh api user" dice quale account GitHub è collegato.
function chiSei() {
  if (process.env.COOP_GITHUB_UTENTE) return process.env.COOP_GITHUB_UTENTE; // per le prove, o per chi non ha gh
  const r = spawnSync("gh", ["api", "user", "--jq", ".login"], { cwd: root, encoding: "utf8", timeout: 15000 });
  return r.status === 0 ? (r.stdout || "").trim() : "";
}

function accoglienza(chi) {
  let membri = [];
  try {
    membri = JSON.parse(readFileSync(path.join(root, "team.json"), "utf8")).membri || [];
  } catch {
    return;
  }
  const io = membri.find((m) => chi && (m.github || "").toLowerCase() === chi.toLowerCase());
  const daFare = membri.filter((m) => m.accoglienza !== "fatta").map((m) => (m.github ? `${m.nome || m.github} (${m.github})` : `${m.nome} (account GitHub ancora da scrivere)`));
  if (chi && (!io || io.accoglienza !== "fatta")) {
    righe.push(`PERSONA NUOVA: l'account GitHub ${chi} ${io ? "non ha ancora fatto l'accoglienza" : "non è in team.json"}. Alla tua prima risposta, prima di qualsiasi altra cosa, avvia tu l'accoglienza (guide/accoglienza.md), anche se l'utente ha scritto solo "ciao"; poi riprendi la sua richiesta.`);
  } else if (!chi && daFare.length) {
    righe.push(`Non so quale account GitHub sta usando l'utente. In team.json l'accoglienza è ancora da fare per: ${daFare.join(", ")}. Alla prima risposta chiedigli soprannome e nome utente GitHub: se è uno di questi, o non è in team.json, avvia l'accoglienza (guide/accoglienza.md).`);
  }
}

collegamento();
aggiorna();
strumenti();
await lavoriAperti();
if (righe.length) console.log(righe.join("\n"));
process.exitCode = 0;
