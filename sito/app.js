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
    // Fuori dall'if: serve anche ai prototipi più sotto (prima era dentro l'else e i prototipi davano errore).
    let anteprime = new Map();
    if (!prs.length) {
      $("pr").innerHTML = '<p class="nota">Nessuna proposta aperta.</p>';
    } else {
      let stati;
      [stati, anteprime] = await Promise.all([
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
    mostraPrototipi(repo, prs, anteprime);
  } catch (e) {
    $("pr").innerHTML = `<p class="nota">Non riesco a leggere GitHub: ${esc(e.message)}.</p>`;
    $("prototipi").innerHTML = `<p class="nota">Non riesco a leggere GitHub: ${esc(e.message)}.</p>`;
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

// ---------- prototipi: le pull request aperte che cambiano l'add-on ----------
// Non sono ancora nella versione stabile: si provano con il loro mondo di prova.
// Per ogni proposta: i contenuti nuovi (nome dai .lang della proposta, icona dal suo ramo)
// e la lista "## Come provarlo" scritta nella descrizione. Una richiesta a GitHub per proposta;
// i file si leggono da raw.githubusercontent.com, che non conta nel limite di 60 richieste l'ora.
const CARTELLE = { blocks: "blocco", items: "oggetto", entities: "mob" };
const RP_PREDEFINITO = "addon/resource_packs/coop_space_rp";
const crudo = (repo, sha, percorso) => `https://raw.githubusercontent.com/${repo}/${sha}/${percorso}`;
const leggiCrudo = (url) =>
  fetch(url)
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);

// Righe "- [ ] ...", "- ..." o "1. ..." sotto il titolo "## Come provarlo", fino al titolo dopo.
function comeProvarlo(corpo) {
  const righe = String(corpo || "").split(/\r?\n/);
  const inizio = righe.findIndex((r) => /^#{2,3}\s*come provarlo/i.test(r.trim()));
  if (inizio < 0) return [];
  const voci = [];
  for (const r of righe.slice(inizio + 1)) {
    if (/^#{1,3}\s/.test(r.trim())) break;
    const m = r.match(/^\s*(?:[-*]\s+(?:\[[ xX]\]\s*)?|\d+[.)]\s+)(.+)/);
    if (m) voci.push(m[1].trim());
  }
  return voci;
}

// Le righe "chiave=valore" aggiunte a un file .lang, lette dalla differenza della proposta.
function righeLang(file) {
  const mappa = {};
  for (const r of String(file?.patch || "").split("\n")) {
    const m = r.match(/^\+([^#=+][^=]*)=(.*)$/);
    if (m) mappa[m[1].trim()] = m[2].trim();
  }
  return mappa;
}

async function contenutiDellaProposta(repo, p) {
  const files = await github(`repos/${repo}/pulls/${p.number}/files?per_page=100`);
  const nuovi = files.filter((f) => f.status === "added" && /^addon\/behavior_packs\/[^/]+\/(blocks|items|entities)\/.+\.json$/.test(f.filename));
  if (!nuovi.length) return [];
  const lang = (nome) => righeLang(files.find((f) => f.filename.endsWith(`/texts/${nome}.lang`)));
  const it = lang("it_IT");
  const en = lang("en_US");
  const rp = files.map((f) => f.filename.match(/^addon\/resource_packs\/[^/]+/)?.[0]).find(Boolean) || RP_PREDEFINITO;
  const blocksPromise = nuovi.some((f) => f.filename.includes("/blocks/"))
    ? leggiCrudo(crudo(repo, p.head.sha, `${rp}/blocks.json`))
    : Promise.resolve({});
  const atlanti = {};
  const atlante = (nome) => (atlanti[nome] ??= leggiCrudo(crudo(repo, p.head.sha, `${rp}/textures/${nome}.json`)).then((j) => j?.texture_data || {}));
  const png = async (nomeAtlante, chiave) => {
    if (!chiave) return "";
    let t = (await atlante(nomeAtlante))[chiave]?.textures;
    if (Array.isArray(t)) t = t[0];
    if (t && typeof t === "object") t = t.path;
    return t ? crudo(repo, p.head.sha, `${rp}/${t}.png`) : "";
  };
  return Promise.all(
    nuovi.map(async (f) => {
      const tipo = CARTELLE[f.filename.split("/")[3]];
      const j = (await leggiCrudo(crudo(repo, p.head.sha, f.filename))) || {};
      const radice = j["minecraft:block"] || j["minecraft:item"] || j["minecraft:entity"] || {};
      const id = radice.description?.identifier || f.filename.split("/").pop().replace(/\.json$/, "");
      const comp = radice.components || {};
      let chiave = `entity.${id}.name`;
      let texture = "";
      if (tipo === "oggetto") {
        chiave = comp["minecraft:display_name"]?.value || "";
        let icona = comp["minecraft:icon"];
        if (icona && typeof icona === "object") icona = icona.texture || icona.textures?.default;
        texture = await png("item_texture", icona);
      } else if (tipo === "blocco") {
        chiave = `tile.${id}.name`;
        const mi = comp["minecraft:material_instances"] || {};
        texture = await png("terrain_texture", (mi["*"] || Object.values(mi)[0] || {}).texture);
      }
      const blocksRp = await blocksPromise || {};
      const mining = comp["minecraft:destructible_by_mining"];
      const seconds = typeof mining === "number" ? mining : Number(mining?.seconds_to_destroy);
      const suono = blocksRp[id]?.sound || "stone";
      return { tipo, id, nome: it[chiave] || "", nomeEn: en[chiave] || "", texture,
        tempoRottura: tipo === "blocco" && Number.isFinite(seconds) && seconds >= 0 ? seconds : 1.5,
        suono: ["metal", "stone", "wood", "gravel", "sand", "grass"].includes(suono) ? suono : "stone" };
    })
  );
}

async function mostraPrototipi(repo, prs, anteprime) {
  const proposte = prs.filter((p) => anteprime.has(`anteprima-pr-${p.number}`)).sort((a, b) => b.number - a.number);
  if (!proposte.length) {
    $("prototipi").innerHTML = '<p class="nota">Nessun prototipo da provare, per ora.</p>';
    return;
  }
  const contenuti = await Promise.all(proposte.map((p) => contenutiDellaProposta(repo, p).catch(() => null)));
  const modelliPrototipo = [];
  const visti = new Set(); // se due proposte portano lo stesso contenuto, si mostra nella più recente
  $("prototipi").innerHTML = proposte
    .map((p, i) => {
      const tutti = contenuti[i] || [];
      const doppi = tutti.filter((c) => visti.has(c.id));
      const lista = tutti.filter((c) => !visti.has(c.id) && visti.add(c.id));
      const dove = doppi.length ? proposte.find((q, k) => k < i && (contenuti[k] || []).some((c) => c.id === doppi[0].id)) : null;
      const prove = comeProvarlo(p.body);
      const base = `https://github.com/${repo}/releases/download/anteprima-pr-${p.number}`;
      const inCorso = /^in corso/i.test(p.title);
      return `<article class="prototipo">
        <div><a href="${esc(p.html_url)}" target="_blank" rel="noopener"><strong>#${p.number} ${esc(p.title)}</strong></a>
          <span class="stato attesa">${inCorso ? "in lavorazione" : "da provare"}</span></div>
        <div class="meta">di ${esc(p.user.login)} · aggiornata ${fa(p.updated_at)} · versione ${esc(anteprime.get(`anteprima-pr-${p.number}`) || "?")}</div>
        <p class="azioni"><a class="stato ok" href="${base}/coop-space-mondo-prova.mcworld">Mondo di prova</a> <a class="stato ok" href="${base}/coop-space.mcaddon">Add-on</a></p>
        ${
          contenuti[i] === null
            ? '<p class="nota">Non riesco a leggere i contenuti di questa proposta.</p>'
            : lista.length
              ? `<div class="griglia">${lista
                  .map(
                    (c) => {
                      const indice = modelliPrototipo.push(c) - 1;
                      return `<button class="scheda" type="button" data-prototipo="${indice}">
                ${c.texture ? `<img src="${esc(c.texture)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'vuoto'}))">` : '<span class="vuoto"></span>'}
                <span><span class="tipo">${TIPI[c.tipo] || c.tipo} · prototipo</span><br><strong>${esc(c.nome || c.nomeEn || c.id)}</strong>
                <span class="id">${esc(c.id)}</span>${c.tipo === "blocco" ? `<span class="id">Tempo di rottura: ${esc(c.tempoRottura)} s (a mano)</span>` : ""}</span></button>`;
                    })
                  .join("")}</div>`
              : dove
                ? `<p class="nota">I suoi contenuti sono mostrati nella #${dove.number}, che li contiene già.</p>`
                : '<p class="nota">Nessun contenuto nuovo: cambia come funzionano le cose che ci sono già.</p>'
        }
        ${
          prove.length
            ? `<details open><summary>Come provarlo (${prove.length})</summary><ul class="prova">${prove
                .map((v) => `<li><label><input type="checkbox"> <span>${md(v)}</span></label></li>`)
                .join("")}</ul></details>`
            : '<p class="nota">La descrizione non ha ancora la lista "Come provarlo".</p>'
        }
      </article>`;
    })
    .join("");
  $("prototipi").onclick = (e) => {
    const scheda = e.target.closest("[data-prototipo]");
    if (!scheda) return;
    const c = modelliPrototipo[Number(scheda.dataset.prototipo)];
    if (!c || !c.texture || !["blocco", "oggetto"].includes(c.tipo)) return; // i mob dei prototipi non hanno ancora il modello qui
    mostraModello({ texture: c.texture, tipo: c.tipo, tempoRottura: c.tempoRottura, suono: c.suono });
    $("visore-sezione").scrollIntoView({ behavior: "smooth", block: "start" });
  };
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

async function mostraModello({ geo, texture, animazioni = {}, tipo = "", tempoRottura, suono = "stone" }) {
  stato("Caricamento…");
  try {
    const v = await apriVisore();
    if (!geo && tipo === "oggetto") geo = await v.geoOggetto(texture);
    if (!geo && tipo === "blocco") geo = v.geoBlocco();
    await v.mostra($("tela"), geo, texture, { tipo, tempoRottura, suono });
    v.aggiungiAnimazioni(animazioni);
    const sel = $("scelta-animazione");
    const nomi = Object.keys(animazioni);
    sel.innerHTML = '<option value="">Nessuna</option>' + nomi.map((n) => `<option value="${esc(n)}">${esc(n.replace(/^animation\./, ""))}</option>`).join("");
    sel.disabled = !nomi.length;
    if (nomi.length) {
      sel.value = nomi[0];
      v.suona(nomi[0]);
    }
    const etichettaTempo = $("visore-tempo");
    etichettaTempo.hidden = tipo !== "blocco";
    etichettaTempo.textContent = tipo === "blocco" ? `Tempo di rottura: ${tempoRottura ?? 1.5} s (a mano)` : "";
    stato(nomi.length ? `${nomi.length} animazion${nomi.length === 1 ? "e" : "i"}` : tipo === "blocco" ? "Tieni premuto sul blocco per romperlo." : "");
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
        return { geo: c.tipo === "oggetto" ? await v.geoOggetto(c.texture) : v.geoBlocco(), texture: c.texture, tipo: c.tipo, tempoRottura: c.tempoRottura, suono: c.suono };
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
  $("suono-visore").addEventListener("click", async () => {
    const attivo = $("suono-visore").getAttribute("aria-pressed") !== "true";
    $("suono-visore").setAttribute("aria-pressed", String(attivo));
    $("suono-visore").textContent = attivo ? "Suono sì" : "Suono no";
    (await apriVisore()).impostaAudio(attivo);
  });
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
