// Pagina del team: legge dati.json (creato da scripts/sito.mjs a ogni modifica su main)
// e chiede a GitHub, in diretta, le pull request aperte e le ultime modifiche.
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
// Markdown minimo e sicuro: `codice`, **grassetto**, [testo](https://...)
const md = (s) =>
  esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/&lt;(https?:\/\/[^\s&]+)&gt;/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');

// "Ultima versione 0.320.996" o "Anteprima PR #23 (0.320.1000)" -> "0.320.996" / "0.320.1000"
const versioneDa = (nome) => (String(nome || "").match(/\d+\.\d+\.\d+/) || [""])[0];

const fa = (data) => {
  const sec = Math.round((Date.now() - new Date(data).getTime()) / 1000);
  if (!isFinite(sec)) return "";
  if (sec < 90) return "adesso";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min fa`;
  const ore = Math.round(min / 60);
  if (ore < 36) return `${ore} ${ore === 1 ? "ora" : "ore"} fa`;
  const giorni = Math.round(ore / 24);
  return `${giorni} ${giorni === 1 ? "giorno" : "giorni"} fa`;
};

// ---------- progressi ----------
function mostraCompiti(sezioni) {
  const tutti = (s) => s.gruppi.flatMap((g) => g.compiti);
  const trova = (nome) => sezioni.find((s) => s.titolo.toLowerCase().startsWith(nome));
  const pre = trova("preamboli");
  const numeri = [];
  if (pre) {
    const c = tutti(pre);
    const f = c.filter((x) => x.fatto).length;
    numeri.push(`<div class="numero"><b>${f}/${c.length}</b><span>preamboli fatti</span><div class="barra"><i style="width:${c.length ? Math.round((f / c.length) * 100) : 0}%"></i></div></div>`);
  }
  for (const [nome, etichetta] of [["da fare", "da fare"], ["in corso", "in corso"], ["fatto", "fatti"]]) {
    const s = trova(nome);
    if (s) numeri.push(`<div class="numero"><b>${tutti(s).length}</b><span>${etichetta}</span></div>`);
  }
  $("numeri").innerHTML = numeri.join("");

  $("compiti").innerHTML = sezioni
    .map((s) => {
      const n = tutti(s).length;
      const aperta = !/^fatto/i.test(s.titolo) ? " open" : "";
      const gruppi = s.gruppi
        .map(
          (g) =>
            (g.titolo ? `<div class="gruppo">${md(g.titolo)}</div>` : "") +
            g.compiti
              .map(
                (c) => `<div class="compito${c.fatto ? " fatto" : ""}">
                  <span class="spunta" aria-label="${c.fatto ? "fatto" : "da fare"}">${c.fatto ? "✓" : ""}</span>
                  <div><span class="testo">${md(c.testo)}</span>${
                    c.chi ? `<span class="chi">${esc(c.chi)}</span>` : c.fatto || /^fatto/i.test(s.titolo) ? "" : '<span class="chi libero">libero</span>'
                  }${c.note.length ? `<ul class="note">${c.note.map((x) => `<li>${md(x)}</li>`).join("")}</ul>` : ""}</div>
                </div>`
              )
              .join("")
        )
        .join("");
      return `<details class="sezione-compiti"${aperta}><summary>${esc(s.titolo)} (${n})</summary>${n ? gruppi : '<p class="nota">Niente, per ora.</p>'}</details>`;
    })
    .join("");
}

// ---------- GitHub in diretta (con 3 minuti di cache: GitHub concede 60 richieste l'ora) ----------
async function github(percorso) {
  const chiave = "gh:" + percorso;
  try {
    const c = JSON.parse(localStorage.getItem(chiave) || "null");
    if (c && Date.now() - c.t < 180000) return c.d;
  } catch {}
  const r = await fetch("https://api.github.com/" + percorso, { headers: { Accept: "application/vnd.github+json" } });
  if (!r.ok) throw new Error(r.status === 403 ? "troppe richieste a GitHub, riprova tra un po'" : "GitHub ha risposto " + r.status);
  const d = await r.json();
  try {
    localStorage.setItem(chiave, JSON.stringify({ t: Date.now(), d }));
  } catch {}
  return d;
}

const ETICHETTE = { accesso: "accesso", idea: "idea", problema: "problema", messaggio: "messaggio" };

async function mostraRichieste(repo) {
  try {
    const voci = (await github(`repos/${repo}/issues?state=open&per_page=15`)).filter((i) => !i.pull_request);
    $("richieste").innerHTML = voci.length
      ? voci
          .map(
            (i) => `<li><a href="${esc(i.html_url)}" target="_blank" rel="noopener">#${i.number} ${esc(i.title)}</a>${i.labels
              .filter((l) => ETICHETTE[l.name])
              .map((l) => `<span class="etichetta">${esc(l.name)}</span>`)
              .join("")}<div class="meta">di ${esc(i.user.login)} · ${fa(i.created_at)}${i.comments ? ` · ${i.comments} rispost${i.comments === 1 ? "a" : "e"}` : ""}</div></li>`
          )
          .join("")
      : '<li class="nota">Nessuna richiesta aperta.</li>';
  } catch (e) {
    $("richieste").innerHTML = `<li class="nota">Non disponibile: ${esc(e.message)}.</li>`;
  }
}

async function mostraGitHub(repo) {
  mostraRichieste(repo);
  try {
    const prs = await github(`repos/${repo}/pulls?state=open&per_page=10`);
    if (!prs.length) {
      $("pr").innerHTML = '<p class="nota">Nessuna proposta aperta.</p>';
    } else {
      const [stati, anteprime] = await Promise.all([
        Promise.all(
          prs.slice(0, 6).map((p) =>
            github(`repos/${repo}/commits/${p.head.sha}/check-runs?per_page=20`)
              .then((r) => r.check_runs || [])
              .catch(() => null)
          )
        ),
        github(`repos/${repo}/releases?per_page=30`)
          .then((r) => new Map(r.map((x) => [x.tag_name, versioneDa(x.name)])))
          .catch(() => new Map()),
      ]);
      $("pr").innerHTML =
        '<ul class="elenco">' +
        prs
          .map((p, i) => {
            const runs = stati[i];
            let stato = "";
            if (runs && runs.length) {
              const ko = runs.some((r) => ["failure", "timed_out", "cancelled"].includes(r.conclusion));
              const attesa = runs.some((r) => r.status !== "completed");
              stato = ko ? '<span class="stato ko">controllo fallito</span>' : attesa ? '<span class="stato attesa">controllo in corso</span>' : '<span class="stato ok">controllo passato</span>';
            }
            const prima = p.base.ref !== "main" ? prs.find((q) => q.head.ref === p.base.ref) : null;
            const anteprima = anteprime.has(`anteprima-pr-${p.number}`)
              ? ` <a class="stato ok" href="https://github.com/${repo}/releases/download/anteprima-pr-${p.number}/coop-space-mondo-prova.mcworld">mondo di prova ${esc(anteprime.get(`anteprima-pr-${p.number}`) || "")}</a> <a class="stato ok" href="https://github.com/${repo}/releases/download/anteprima-pr-${p.number}/coop-space.mcaddon">add-on</a>`
              : "";
            return `<li><a href="${esc(p.html_url)}" target="_blank" rel="noopener">#${p.number} ${esc(p.title)}</a> ${stato}${anteprima}
              <div class="meta">di ${esc(p.user.login)} · aperta ${fa(p.created_at)}${p.draft ? " · bozza" : ""}${prima ? ` · da fondere dopo la #${prima.number}` : ""}</div></li>`;
          })
          .join("") +
        "</ul>";
    }
  } catch (e) {
    $("pr").innerHTML = `<p class="nota">Non riesco a leggere GitHub: ${esc(e.message)}.</p>`;
  }
  try {
    const commits = await github(`repos/${repo}/commits?sha=main&per_page=6`);
    $("commit").innerHTML = commits
      .map((c) => {
        const righe = c.commit.message.split("\n").filter(Boolean);
        const merge = righe[0].match(/^Merge pull request #(\d+)/);
        const titolo = merge && righe[1] ? `#${merge[1]} ${righe[1]}` : righe[0];
        return `<li><a href="${esc(c.html_url)}" target="_blank" rel="noopener">${esc(titolo)}</a><div class="meta">${esc(c.author?.login || c.commit.author.name)} · ${fa(c.commit.author.date)}</div></li>`;
      })
      .join("");
  } catch (e) {
    $("commit").innerHTML = `<li class="nota">Non disponibile: ${esc(e.message)}.</li>`;
  }
}

// ---------- contenuti e visore ----------
const TIPI = { blocco: "Blocco", oggetto: "Oggetto", mob: "Mob" };
let modelli = [];

function mostraContenuti(contenuti) {
  if (!contenuti.length) {
    $("contenuti").innerHTML = '<p class="nota">Ancora nessun contenuto.</p>';
    return;
  }
  $("contenuti").innerHTML = contenuti
    .map(
      (c, i) => `<button class="scheda" type="button" data-modello="${i}">
        ${c.texture ? `<img src="${esc(c.texture)}" alt="">` : '<span class="vuoto"></span>'}
        <span><span class="tipo">${TIPI[c.tipo] || c.tipo}</span><br><strong>${esc(c.nome || c.nomeEn || c.id)}</strong>
        <span class="id">${esc(c.id)}</span>
        <ul class="controlli">${c.controlli.map((k) => `<li class="${k.ok ? "si" : "no"}">${k.ok ? "✓" : "✗ manca"} ${esc(k.nome)}</li>`).join("")}</ul></span>
      </button>`
    )
    .join("");
  $("contenuti").addEventListener("click", (e) => {
    const b = e.target.closest("[data-modello]");
    if (!b) return;
    $("scelta-modello").value = "c" + b.dataset.modello;
    caricaScelto();
    $("visore-sezione").scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

let visore = null;
async function apriVisore() {
  if (!visore) visore = await import("./visore.js");
  return visore;
}

function stato(testo) {
  $("visore-stato").textContent = testo;
}

async function mostraModello({ geo, texture, animazioni = {} }) {
  stato("Caricamento…");
  try {
    const v = await apriVisore();
    await v.mostra($("tela"), geo, texture);
    v.aggiungiAnimazioni(animazioni);
    const sel = $("scelta-animazione");
    const nomi = Object.keys(animazioni);
    sel.innerHTML = '<option value="">Nessuna</option>' + nomi.map((n) => `<option value="${esc(n)}">${esc(n.replace(/^animation\./, ""))}</option>`).join("");
    sel.disabled = !nomi.length;
    if (nomi.length) {
      sel.value = nomi[0];
      v.suona(nomi[0]);
    }
    stato(nomi.length ? `${nomi.length} animazion${nomi.length === 1 ? "e" : "i"}` : "");
  } catch (e) {
    stato("Non riesco a mostrare il modello: " + (e?.message || e));
    console.error(e);
  }
}

async function caricaScelto() {
  const val = $("scelta-modello").value;
  const m = modelli.find((x) => x.valore === val);
  if (m) mostraModello(await m.carica());
}

async function leggiFile(input) {
  const f = input.files?.[0];
  return f ? f : null;
}

function primaGeometria(j) {
  const g = j?.["minecraft:geometry"]?.[0];
  if (g) return g;
  const vecchia = Object.entries(j || {}).find(([k]) => k.startsWith("geometry."));
  if (vecchia) return { description: { identifier: vecchia[0], texture_width: vecchia[1].texturewidth, texture_height: vecchia[1].textureheight }, bones: vecchia[1].bones || [] };
  throw new Error("nel file non trovo nessun modello Bedrock");
}

function preparaVisore(contenuti) {
  modelli = [];
  contenuti.forEach((c, i) => {
    if (!c.texture && !c.modello) return;
    modelli.push({
      valore: "c" + i,
      nome: `${TIPI[c.tipo]}: ${c.nome || c.id}`,
      carica: async () => {
        const v = await apriVisore();
        if (c.modello) return { geo: c.modello.geo, texture: c.texture, animazioni: c.modello.animazioni };
        return { geo: c.tipo === "oggetto" ? v.geoOggetto() : v.geoBlocco(), texture: c.texture };
      },
    });
  });
  modelli.push({
    valore: "esempio",
    nome: "Esempio: robottino animato",
    carica: async () => {
      const [geo, anim] = await Promise.all(["esempi/robottino.geo.json", "esempi/robottino.animation.json"].map((u) => fetch(u).then((r) => r.json())));
      return { geo: primaGeometria(geo), texture: "esempi/robottino.png", animazioni: anim.animations };
    },
  });
  $("scelta-modello").innerHTML = modelli.map((m) => `<option value="${m.valore}">${esc(m.nome)}</option>`).join("");
  $("scelta-modello").addEventListener("change", caricaScelto);
  $("scelta-animazione").addEventListener("change", async (e) => (await apriVisore()).suona(e.target.value));
  $("carica-miei").addEventListener("click", async () => {
    try {
      const [fg, fp, fa_] = await Promise.all([leggiFile($("file-geo")), leggiFile($("file-png")), leggiFile($("file-anim"))]);
      if (!fg || !fp) return stato("Scegli almeno il modello (.geo.json) e la texture (.png).");
      const geo = primaGeometria(JSON.parse(await fg.text()));
      const animazioni = fa_ ? JSON.parse(await fa_.text()).animations || {} : {};
      await mostraModello({ geo, texture: URL.createObjectURL(fp), animazioni });
    } catch (e) {
      stato("File non valido: " + e.message);
    }
  });
  // Il visore si carica solo quando la sezione arriva sullo schermo: chi guarda solo i progressi non scarica la grafica 3D.
  const oss = new IntersectionObserver((voci) => {
    if (voci.some((v) => v.isIntersecting)) {
      oss.disconnect();
      if (!$("tela").dataset.avviato) {
        $("tela").dataset.avviato = "1";
        caricaScelto();
      }
    }
  });
  oss.observe($("visore-sezione"));
}

// ---------- avvio ----------
async function avvio() {
  let dati;
  try {
    dati = await fetch("dati.json", { cache: "no-store" }).then((r) => r.json());
  } catch {
    $("compiti").innerHTML = '<p class="nota">Non trovo i dati del sito.</p>';
    return;
  }
  $("scarica").href = dati.download;
  $("scarica").textContent = "Scarica l'add-on";
  $("mondo").href = dati.download.replace("coop-space.mcaddon", "coop-space-mondo-prova.mcworld");
  // La versione vera la sa solo la release (la crea la build, dopo il sito): la chiediamo a GitHub.
  github(`repos/${dati.repo}/releases/tags/ultima-versione`)
    .then((r) => {
      const v = versioneDa(r.name);
      if (v) {
        $("scarica").textContent = `Add-on ${v}`;
        $("mondo").textContent = `Mondo di prova ${v}`;
      }
      // Le release vecchie non hanno il mondo di prova: in quel caso il pulsante non si mostra.
      if (!(r.assets || []).some((a) => a.name === "coop-space-mondo-prova.mcworld")) $("mondo").hidden = true;
    })
    .catch(() => {});
  $("piede").textContent = `Aggiornato dal commit ${dati.commit || "?"}${dati.dataCommit ? ", " + fa(dati.dataCommit) : ""}. Si aggiorna da solo a ogni modifica su main.`;
  if (dati.team?.length)
    $("team").innerHTML =
      "Il gruppo: " +
      dati.team
        .map((m) => `<strong>${esc(m.nome || m.github)}</strong>${m.assistente ? ` (${esc(m.assistente)})` : ""}${m.accoglienza === "fatta" ? "" : ' <span class="chi libero">accoglienza da fare</span>'}`)
        .join(" · ");
  mostraCompiti(dati.compiti);
  mostraContenuti(dati.contenuti);
  preparaVisore(dati.contenuti);
  mostraGitHub(dati.repo);
}
avvio();
