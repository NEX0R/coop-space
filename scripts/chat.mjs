// Chat tra gli assistenti del gruppo (Claude Code e Codex), tipo WhatsApp, attraverso il repository.
// Ogni coppia di persone ha una richiesta (issue) "Chat: A e B" con l'etichetta "chat"; ogni commento è un messaggio.
// "Chat: tutti" è il gruppo. Qui dentro non c'è IA: zero token. Con Claude Code la usa il subagente
// "postino" (Haiku, .claude/agents/postino.md); gli hook mostrano da soli i messaggi nuovi (.claude/settings.json).
//
//   node scripts/chat.mjs manda <soprannome|tutti> "<testo>"   manda un messaggio
//   node scripts/chat.mjs nuovi                                  messaggi non letti per te (poi risultano letti)
//   node scripts/chat.mjs aspetta [minuti]                       aspetta il prossimo messaggio per te (predefinito 10)
//   node scripts/chat.mjs storia <soprannome|tutti> [quanti]     ultimi messaggi di una chat (predefinito 10)
//   node scripts/chat.mjs nuovi --hook                           per gli hook: zitto se non c'è niente, mai errori
//
// Tutto è pubblico: solo soprannomi, niente dati personali (AGENTS.md, "Privacy").
// Per le prove: COOP_GITHUB_UTENTE finge un altro account in lettura, COOP_CHAT_STATO sposta il file dei letti.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO = "NEX0R/coop-space";
const ETICHETTA = "chat";
const OGNI_SECONDI = 20; // attesa tra due controlli in "aspetta"
const ORA = (iso) => new Date(iso).toLocaleString("it-IT", { timeZone: "Europe/Rome", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

// ---------- GitHub (tramite gh, che ha già l'accesso dell'account) ----------
const GH = [process.env.COOP_GH, "gh", "C:\\Program Files\\GitHub CLI\\gh.exe"].filter(Boolean);
function gh(args, dati) {
  for (const exe of GH) {
    const r = spawnSync(exe, ["api", ...args, ...(dati ? ["--input", "-"] : [])], { cwd: root, encoding: "utf8", timeout: 30000, input: dati ? JSON.stringify(dati) : undefined });
    if (r.error?.code === "ENOENT") continue;
    if (r.status !== 0) throw new Error(((r.stderr || r.stdout || r.error?.message || "gh non risponde") + "").trim().split("\n")[0]);
    return r.stdout.trim() ? JSON.parse(r.stdout) : null;
  }
  throw new Error("manca GitHub CLI (gh): installalo e fai gh auth login (guide/accoglienza.md)");
}

// ---------- chi è chi (team.json: solo soprannomi e account GitHub) ----------
const membri = (() => {
  try {
    return JSON.parse(readFileSync(path.join(root, "team.json"), "utf8")).membri || [];
  } catch {
    return [];
  }
})();
const stesso = (a, b) => (a || "").toLowerCase() === (b || "").toLowerCase();
const perNome = (n) => membri.find((m) => stesso(m.nome, n));
const nomeDi = (login) => membri.find((m) => stesso(m.github, login))?.nome || login;

// L'account si chiede a GitHub una volta sola e si ricorda nel file dei letti (gli hook devono essere veloci).
function io(stato) {
  const login = process.env.COOP_GITHUB_UTENTE || stato?.login || gh(["user"]).login;
  if (stato && !process.env.COOP_GITHUB_UTENTE) stato.login = login;
  const m = membri.find((x) => stesso(x.github, login));
  return { login, nome: m?.nome || login, assistente: m?.assistente || "assistente" };
}

// ---------- le chat ----------
const titoloChat = (a, b) => (b === "tutti" ? "Chat: tutti" : `Chat: ${[a, b].sort((x, y) => x.localeCompare(y)).join(" e ")}`);
const tutteLeChat = () => gh([`repos/${REPO}/issues?labels=${ETICHETTA}&state=all&per_page=100`]).filter((i) => !i.pull_request);
const eMia = (chat, me) => chat.title === "Chat: tutti" || chat.title.replace(/^Chat: /, "").split(" e ").some((n) => stesso(n, me.nome));

function chatCon(me, altro) {
  const titolo = titoloChat(me.nome, altro);
  const c = tutteLeChat().find((i) => i.title === titolo);
  if (c) {
    if (c.state === "closed") gh([`repos/${REPO}/issues/${c.number}`, "-X", "PATCH", "-f", "state=open"]);
    return c.number;
  }
  try {
    gh([`repos/${REPO}/labels/${ETICHETTA}`]);
  } catch {
    gh([`repos/${REPO}/labels`, "-X", "POST"], { name: ETICHETTA, color: "25D366", description: "Chat tra gli assistenti (scripts/chat.mjs)" });
  }
  // Assegnati = le due persone: GitHub avvisa chi è assegnato (app GitHub Mobile) a ogni messaggio nuovo.
  const assegnabili = new Set(gh([`repos/${REPO}/assignees?per_page=100`]).map((u) => u.login.toLowerCase()));
  const assegnati = altro === "tutti" ? [] : [me.login, perNome(altro)?.github].filter((l) => l && assegnabili.has(l.toLowerCase()));
  const chi = altro === "tutti" ? "tutti gli assistenti del gruppo" : `gli assistenti di ${titolo.replace(/^Chat: /, "")}`;
  const body = `Chat tra ${chi}: ogni commento è un messaggio. La usano \`scripts/chat.mjs\` e il subagente \`postino\` (vedi \`guide/messaggi.md\`).\n\nÈ pubblica: solo soprannomi, niente dati personali.`;
  return gh([`repos/${REPO}/issues`, "-X", "POST"], { title: titolo, body, labels: [ETICHETTA], assignees: assegnati }).number;
}

// ---------- messaggi letti (file locale, mai nel repository) ----------
function fileStato() {
  if (process.env.COOP_CHAT_STATO) return process.env.COOP_CHAT_STATO;
  const r = spawnSync("git", ["rev-parse", "--git-path", "coop-chat.json"], { cwd: root, encoding: "utf8" });
  return r.status === 0 ? path.resolve(root, r.stdout.trim()) : path.join(root, ".coop-chat.json");
}
function leggiStato() {
  try {
    return JSON.parse(readFileSync(fileStato(), "utf8"));
  } catch {
    return { visto: new Date(Date.now() - 7 * 86400000).toISOString(), controllo: 0 }; // prima volta: ultimi 7 giorni
  }
}
const salvaStato = (s) => writeFileSync(fileStato(), JSON.stringify(s));

// Messaggi degli altri, nelle mie chat, arrivati dopo "visto". Una sola chiamata quando non c'è niente di nuovo.
function nuoviMessaggi(me, stato) {
  const commenti = gh([`repos/${REPO}/issues/comments?since=${encodeURIComponent(stato.visto)}&sort=created&direction=asc&per_page=100`]).filter(
    (c) => c.created_at > stato.visto && !stesso(c.user.login, me.login),
  );
  if (!commenti.length) return [];
  const mie = new Map(tutteLeChat().filter((c) => eMia(c, me)).map((c) => [c.number, c.title]));
  return commenti
    .map((c) => ({ chat: Number(c.issue_url.split("/").pop()), da: nomeDi(c.user.login), quando: c.created_at, testo: c.body.trim() }))
    .filter((m) => mie.has(m.chat))
    .map((m) => ({ ...m, titolo: mie.get(m.chat) }));
}
const riga = (m) => `- [${m.titolo} #${m.chat}] ${m.da}, ${ORA(m.quando)}:\n  ${m.testo.replace(/\n/g, "\n  ")}`;
function segnaLetti(stato, messaggi) {
  if (messaggi.length) stato.visto = messaggi[messaggi.length - 1].quando;
  stato.controllo = Date.now();
  salvaStato(stato);
}

// ---------- comandi ----------
const [comando, ...resto] = process.argv.slice(2);
const hook = resto.includes("--hook");

async function main() {
  if (comando === "manda") {
    const [a, ...parole] = resto;
    const altro = stesso(a, "tutti") ? "tutti" : perNome(a)?.nome;
    const testo = parole.join(" ").trim();
    if (!altro || !testo) throw new Error(`uso: node scripts/chat.mjs manda <${membri.map((m) => m.nome).join("|")}|tutti> "<testo>"`);
    const me = io();
    if (altro !== "tutti" && stesso(altro, me.nome)) throw new Error("non puoi scrivere a te stesso");
    const n = chatCon(me, altro);
    gh([`repos/${REPO}/issues/${n}/comments`, "-X", "POST"], { body: `${testo}\n\n— assistente di ${me.nome} (${me.assistente})` });
    console.log(`Mandato a ${altro} (chat #${n}).`);
  } else if (comando === "nuovi") {
    const stato = leggiStato();
    if (hook && Date.now() - (stato.controllo || 0) < 60000) return; // negli hook al massimo un controllo al minuto
    const me = io(stato);
    const msg = nuoviMessaggi(me, stato);
    segnaLetti(stato, msg);
    if (msg.length) {
      const testa = hook
        ? `CHAT TRA ASSISTENTI: messaggi nuovi per l'assistente di ${me.nome}. Rispondi tu (con Claude Code tramite il subagente postino) se puoi farlo senza decidere al posto della persona; altrimenti riferiscili alla persona con parole semplici. Vedi guide/messaggi.md.`
        : `Messaggi nuovi per l'assistente di ${me.nome}:`;
      console.log(`${testa}\n${msg.map(riga).join("\n")}`);
    } else if (!hook) console.log("Nessun messaggio nuovo.");
  } else if (comando === "aspetta") {
    const minuti = Number(resto[0]) > 0 ? Number(resto[0]) : 10;
    const me = io(leggiStato());
    const fine = Date.now() + minuti * 60000;
    let errori = 0;
    for (;;) {
      const stato = leggiStato();
      try {
        const msg = nuoviMessaggi(me, stato);
        errori = 0;
        if (msg.length) {
          segnaLetti(stato, msg);
          console.log(`Messaggi nuovi per l'assistente di ${me.nome}:\n${msg.map(riga).join("\n")}`);
          return;
        }
      } catch (e) {
        if (++errori >= 5) throw e; // la rete a volte salta: si arrende solo dopo 5 errori di fila
      }
      if (Date.now() >= fine) return console.log(`Nessun messaggio nuovo in ${minuti} minuti.`);
      await new Promise((ok) => setTimeout(ok, OGNI_SECONDI * 1000));
    }
  } else if (comando === "storia") {
    const [a, quanti] = resto;
    const altro = stesso(a, "tutti") ? "tutti" : perNome(a)?.nome;
    if (!altro) throw new Error("uso: node scripts/chat.mjs storia <soprannome|tutti> [quanti]");
    const me = io();
    const c = tutteLeChat().find((i) => i.title === titoloChat(me.nome, altro));
    if (!c) return console.log(`Nessuna chat con ${altro}.`);
    const tutti = gh([`repos/${REPO}/issues/${c.number}/comments?per_page=100`]);
    const ultimi = tutti.slice(-(Number(quanti) > 0 ? Number(quanti) : 10));
    console.log(ultimi.length ? ultimi.map((x) => riga({ titolo: c.title, chat: c.number, da: nomeDi(x.user.login), quando: x.created_at, testo: x.body.trim() })).join("\n") : "La chat è vuota.");
  } else {
    console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").slice(4, 12).map((r) => r.replace(/^\/\/ ?/, "")).join("\n"));
  }
}

main().catch((e) => {
  if (hook) process.exit(0); // un hook non deve mai disturbare la sessione
  console.error(`Chat: ${e.message}`);
  process.exit(1);
});
