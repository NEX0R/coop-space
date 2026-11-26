// Accesso automatico al progetto, senza nessuna IA accesa: lo lancia GitHub (.github/workflows/accesso.yml).
//
// 1. Qualcuno apre una richiesta di accesso (modulo del sito, oppure il suo assistente con titolo "Accesso: ...").
//    Lo script controlla il soprannome in team.json e chiede l'ok a Nexor con un commento.
// 2. Nexor (solo il proprietario del repository) risponde "ok": lo script manda l'invito, apre una
//    proposta che scrive l'account in team.json (si fonde da sola dopo la build) e chiude la richiesta.
//    Poi l'assistente dell'amico accetta l'invito al suo posto (guide/accoglienza.md).
//
// Prova senza scrivere niente su GitHub: node scripts/accesso.mjs --prova <evento.json>
import { readFileSync } from "node:fs";

const prova = process.argv.includes("--prova");
const fileEvento = prova ? process.argv[process.argv.indexOf("--prova") + 1] : process.env.GITHUB_EVENT_PATH;
const nomeEvento = prova ? (JSON.parse(readFileSync(fileEvento, "utf8")).comment ? "issue_comment" : "issues") : process.env.GITHUB_EVENT_NAME;
const evento = JSON.parse(readFileSync(fileEvento, "utf8"));
const repo = evento.repository.full_name;
const proprietario = evento.repository.owner.login;
const richiesta = evento.issue;
const autore = richiesta.user.login;
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
const TOKEN_INVITI = process.env.TOKEN_INVITI || "";
const SEGNO_ATTESA = "<!-- accesso:attesa -->";

async function api(metodo, percorso, corpo, token = TOKEN) {
  const scrive = metodo !== "GET";
  if (prova && scrive) {
    console.log(`[prova] ${metodo} ${percorso}${corpo ? "\n" + JSON.stringify(corpo, null, 2) : ""}`);
    return {};
  }
  const r = await fetch(`https://api.github.com/${percorso}`, {
    method: metodo,
    headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28" },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  if (r.status === 204) return {};
  const dati = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${metodo} ${percorso}: ${r.status} ${dati.message || ""}`);
  return dati;
}
const commenta = (testo) => api("POST", `repos/${repo}/issues/${richiesta.number}/comments`, { body: testo });

// Il modulo del sito scrive "### Domanda" e sotto la risposta: lo stesso formato che usano gli assistenti.
function campo(corpo, parola) {
  const righe = String(corpo || "").split(/\r?\n/);
  const i = righe.findIndex((r) => /^#{2,4}\s/.test(r) && r.toLowerCase().includes(parola));
  if (i < 0) return "";
  const valore = righe.slice(i + 1).find((r) => r.trim() && !/^#{2,4}\s/.test(r));
  return (valore || "").trim().replace(/^_No response_$/i, "");
}

async function leggiTeam() {
  const f = await api("GET", `repos/${repo}/contents/team.json?ref=main`);
  return { sha: f.sha, team: JSON.parse(Buffer.from(f.content, "base64").toString("utf8")) };
}

const soprannome = campo(richiesta.body, "soprannome") || richiesta.title.replace(/^accesso:\s*/i, "").trim();
const assistente = campo(richiesta.body, "assistente");
const valido = /^[\p{L}\p{N}_ .-]{2,30}$/u.test(soprannome);

// ---------- 1. richiesta aperta: controlli e domanda a Nexor ----------
async function nuovaRichiesta() {
  if (!richiesta.labels.some((l) => l.name === "accesso")) await api("POST", `repos/${repo}/issues/${richiesta.number}/labels`, { labels: ["accesso"] });
  const commenti = await api("GET", `repos/${repo}/issues/${richiesta.number}/comments?per_page=100`);
  if (commenti.some((c) => c.body.includes(SEGNO_ATTESA))) return console.log("Richiesta già gestita.");
  const { team } = await leggiTeam();
  const membri = team.membri || [];
  const io = membri.find((m) => (m.github || "").toLowerCase() === autore.toLowerCase());
  const posto = membri.find((m) => (m.nome || "").toLowerCase() === soprannome.toLowerCase());
  let nota;
  if (!valido) nota = `⚠️ Non trovo un soprannome valido nella richiesta. @${autore}, scrivi solo il soprannome (niente nome vero) e riprova.`;
  else if (io) nota = `ℹ️ L'account @${autore} è già nel gruppo come **${io.nome}**. Se l'invito non è arrivato, Nexor può rispondere \`ok\` per rimandarlo.`;
  else if (posto?.github) nota = `⚠️ Il soprannome **${soprannome}** è già di un altro account. Nexor, controlla prima di rispondere \`ok\`.`;
  else if (posto) nota = `✓ **${soprannome}** è nel gruppo (\`team.json\`) e il suo posto è libero.`;
  else nota = `⚠️ **${soprannome}** non è in \`team.json\`. Se è davvero una persona nuova del gruppo, con \`ok\` la aggiungo. Controlla che sia un soprannome e non un nome vero: il progetto è pubblico.`;
  await commenta(
    `${SEGNO_ATTESA}\nRichiesta di accesso di @${autore} come **${soprannome || "?"}**${assistente ? ` (${assistente})` : ""}.\n\n${nota}\n\n` +
      `@${proprietario}, se la conosci e va bene, rispondi qui solo \`ok\`: mando l'invito e aggiorno \`team.json\` da solo. Se non va bene, chiudi la richiesta.\n\n` +
      `_Automazione del progetto: nessuna IA è accesa, risponde GitHub._`
  );
}

// ---------- 2. "ok" di Nexor: invito, team.json, chiusura ----------
async function approvazione() {
  const c = evento.comment;
  if (c.user.login !== proprietario || !/^\s*ok\b/i.test(c.body) || richiesta.state !== "open") return console.log("Commento ignorato.");
  if (!valido) return commenta("⚠️ Manca un soprannome valido: chiedo a chi ha fatto la richiesta di correggerla.");
  if (!TOKEN_INVITI && !prova)
    return commenta(
      "⚠️ Non posso mandare l'invito: manca il segreto `TOKEN_INVITI` (le automazioni normali di GitHub non possono invitare persone). " +
        "Nexor: il tuo assistente sa come crearlo (`guide/messaggi.md`, \"Accesso automatico\"). Poi rispondi di nuovo `ok`."
    );

  // L'invito: accesso in scrittura, come gli altri del gruppo.
  await api("PUT", `repos/${repo}/collaborators/${autore}`, { permission: "push" }, TOKEN_INVITI);

  // team.json: proposta che si fonde da sola dopo la build (creata con il token di Nexor, così la build parte).
  const { sha, team } = await leggiTeam();
  team.membri ??= [];
  const giaDentro = team.membri.find((m) => (m.github || "").toLowerCase() === autore.toLowerCase());
  let proposta = "";
  if (!giaDentro) {
    const posto = team.membri.find((m) => (m.nome || "").toLowerCase() === soprannome.toLowerCase() && !m.github);
    if (posto) posto.github = autore;
    else team.membri.push({ github: autore, nome: soprannome, assistente: assistente.replace(/\s*\(.*\)$/, ""), dispositivi: [], accoglienza: "da fare" });
    if (posto && !posto.assistente && assistente) posto.assistente = assistente.replace(/\s*\(.*\)$/, "");
    const testo = JSON.stringify(team, null, 2);
    const ramo = `accesso-${autore.toLowerCase()}`.replace(/[^a-z0-9-]/g, "-");
    const main = await api("GET", `repos/${repo}/git/ref/heads/main`);
    await api("POST", `repos/${repo}/git/refs`, { ref: `refs/heads/${ramo}`, sha: main.object.sha }, TOKEN_INVITI).catch(() => {});
    await api(
      "PUT",
      `repos/${repo}/contents/team.json`,
      { message: `${soprannome} entra nel gruppo (accesso automatico)`, content: Buffer.from(testo + "\n").toString("base64"), sha, branch: ramo },
      TOKEN_INVITI
    );
    const pr = await api(
      "POST",
      `repos/${repo}/pulls`,
      {
        title: `${soprannome} entra nel gruppo`,
        head: ramo,
        base: "main",
        body: `Scrive l'account GitHub di **${soprannome}** in \`team.json\` (richiesta #${richiesta.number}, approvata da Nexor). Si fonde da sola quando la build è verde.\n\n_Automazione del progetto._`,
      },
      TOKEN_INVITI
    );
    proposta = pr.number ? ` La proposta #${pr.number} lo scrive in \`team.json\` e si fonde da sola.` : "";
  }
  await commenta(
    `✓ Invito mandato a @${autore} (**${soprannome}**).${proposta}\n\n` +
      `@${autore}: il tuo assistente accetta l'invito al tuo posto e continua l'accoglienza. Se fai da solo: <https://github.com/${repo}/invitations>.`
  );
  await api("PATCH", `repos/${repo}/issues/${richiesta.number}`, { state: "closed", state_reason: "completed" });
}

try {
  if (nomeEvento === "issue_comment") await approvazione();
  else await nuovaRichiesta();
} catch (e) {
  console.error(e.message);
  if (!prova) await commenta(`⚠️ Qualcosa non è andato: \`${e.message}\`. Nexor, il tuo assistente può guardare la scheda Actions.`).catch(() => {});
  process.exitCode = 1;
}
