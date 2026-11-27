// Costruisce il sito del team in out/sito: progressi (da TASKS.md), contenuti dell'add-on e visore 3D.
// Non usa pacchetti npm: gira anche senza `npm install`.
//   npm run sito             costruisce out/sito
//   npm run sito -- --serve  costruisce e lo apre su http://localhost:8765 (Ctrl+C per fermare)
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "out", "sito");
const addon = process.env.SITO_ADDON || path.join(root, "addon"); // SITO_ADDON: solo per le prove
const REPO = "NEX0R/coop-space";

// ---------- utilità ----------
const leggiJson = (file) => {
  try {
    // i file Bedrock possono avere commenti // e il BOM
    const testo = fs.readFileSync(file, "utf8").replace(/^﻿/, "").replace(/^\s*\/\/.*$/gm, "");
    return JSON.parse(testo);
  } catch {
    return null;
  }
};
const elencaJson = (dir) => {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return elencaJson(p);
    return e.name.endsWith(".json") ? [p] : [];
  });
};
const sottocartelle = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => path.join(dir, e.name)) : []);
const leggiLang = (file) => {
  const mappa = {};
  if (!fs.existsSync(file)) return mappa;
  for (const riga of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = riga.match(/^([^#=\s][^=]*)=(.*?)(\t*##.*)?$/);
    if (m) mappa[m[1].trim()] = m[2].trim();
  }
  return mappa;
};
const git = (cmd, riserva) => {
  try {
    return execSync(`git ${cmd}`, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return riserva;
  }
};

// ---------- TASKS.md ----------
function leggiCompiti() {
  const righe = fs.readFileSync(path.join(root, "TASKS.md"), "utf8").split(/\r?\n/);
  const sezioni = [];
  let sezione = null;
  let gruppo = null;
  let ultimo = null;
  for (const riga of righe) {
    let m;
    if ((m = riga.match(/^##\s+(.*)/))) {
      sezione = { titolo: m[1].trim(), gruppi: [] };
      gruppo = { titolo: "", compiti: [] };
      sezione.gruppi.push(gruppo);
      sezioni.push(sezione);
      ultimo = null;
    } else if (sezione && (m = riga.match(/^\*\*(.+?)\*\*\s*$/))) {
      gruppo = { titolo: m[1].trim(), compiti: [] };
      sezione.gruppi.push(gruppo);
      ultimo = null;
    } else if (sezione && (m = riga.match(/^-\s+\[( |x|X)\]\s+(.*)/))) {
      let testo = m[2].trim();
      let chi = "";
      const c = testo.match(/\*\*Chi:\*\*\s*(.*)$/);
      if (c) {
        chi = c[1].trim();
        testo = testo.slice(0, c.index).trim();
      }
      ultimo = { fatto: m[1] !== " ", testo, chi: chi === "?" ? "" : chi, note: [] };
      gruppo.compiti.push(ultimo);
    } else if (ultimo && (m = riga.match(/^\s{2,}-\s+(.*)/))) {
      ultimo.note.push(m[1].trim());
    }
  }
  for (const s of sezioni) s.gruppi = s.gruppi.filter((g) => g.compiti.length || g.titolo);
  return sezioni;
}

// ---------- contenuti dell'add-on ----------
// Ogni behavior pack con il suo resource pack (quello da cui dipende): Coop Space e Sangue Immortale.
function leggiContenuti() {
  const rps = sottocartelle(path.join(addon, "resource_packs"));
  const coppie = sottocartelle(path.join(addon, "behavior_packs")).map((bp) => {
    const dipende = new Set((leggiJson(path.join(bp, "manifest.json"))?.dependencies || []).map((d) => d.uuid));
    return { bp, rp: rps.find((rp) => dipende.has(leggiJson(path.join(rp, "manifest.json"))?.header?.uuid)) };
  }).filter((c) => c.rp);
  if (!coppie.length) return { contenuti: [], versione: "", rps: [] };
  const risultati = coppie.map(({ bp, rp }) => leggiCoppia(bp, rp));
  return { contenuti: risultati.flatMap((r) => r.contenuti), versione: risultati[0].versione, rps: coppie.map((c) => c.rp) };
}

function leggiCoppia(bp, rp) {
  const rpNome = path.basename(rp);
  const it = leggiLang(path.join(rp, "texts", "it_IT.lang"));
  const en = leggiLang(path.join(rp, "texts", "en_US.lang"));
  const terrain = leggiJson(path.join(rp, "textures", "terrain_texture.json"))?.texture_data || {};
  const itemTex = leggiJson(path.join(rp, "textures", "item_texture.json"))?.texture_data || {};
  const blocksRp = leggiJson(path.join(rp, "blocks.json")) || {};
  const manifest = leggiJson(path.join(bp, "manifest.json"));

  // modelli e animazioni del resource pack
  const geometrie = {};
  for (const f of elencaJson(path.join(rp, "models"))) {
    const j = leggiJson(f);
    if (!j) continue;
    for (const g of j["minecraft:geometry"] || []) if (g?.description?.identifier) geometrie[g.description.identifier] = g;
    for (const [k, v] of Object.entries(j)) if (k.startsWith("geometry.") && v && typeof v === "object") geometrie[k.split(":")[0]] = { description: { identifier: k.split(":")[0], texture_width: v.texturewidth, texture_height: v.textureheight }, bones: v.bones || [] };
  }
  const animazioni = {};
  for (const f of elencaJson(path.join(rp, "animations"))) Object.assign(animazioni, leggiJson(f)?.animations || {});

  // percorso texture ("textures/blocks/x") -> file nel sito, se il PNG esiste
  const texturePng = (rel) => {
    if (!rel) return null;
    for (const est of [".png", ".tga"]) if (fs.existsSync(path.join(rp, rel + est))) return `rp/${rpNome}/${rel}${est}`;
    return null;
  };
  const daAtlante = (atlante, nome) => {
    let t = atlante[nome]?.textures;
    if (Array.isArray(t)) t = t[0];
    if (t && typeof t === "object") t = t.path;
    return typeof t === "string" ? t : null;
  };
  const controllo = (nome, ok) => ({ nome, ok: !!ok });
  const contenuti = [];

  for (const f of elencaJson(path.join(bp, "blocks"))) {
    const b = leggiJson(f)?.["minecraft:block"];
    const id = b?.description?.identifier;
    if (!id) continue;
    const comp = b.components || {};
    const mining = comp["minecraft:destructible_by_mining"];
    const tempoRottura = typeof mining === "number" ? mining : Number(mining?.seconds_to_destroy);
    const suono = blocksRp[id]?.sound || "stone";
    let forma = comp["minecraft:geometry"];
    if (forma && typeof forma === "object") forma = forma.identifier;
    const mi = comp["minecraft:material_instances"] || {};
    let nomeTex = (mi["*"] || Object.values(mi)[0] || {}).texture;
    if (!nomeTex) {
      const t = blocksRp[id]?.textures;
      nomeTex = typeof t === "string" ? t : t?.side || t?.up || null;
    }
    const tex = texturePng(daAtlante(terrain, nomeTex));
    const geo = forma && !String(forma).startsWith("minecraft:") ? geometrie[forma] || null : null;
    contenuti.push({
      tipo: "blocco",
      id,
      tempoRottura: Number.isFinite(tempoRottura) && tempoRottura >= 0 ? tempoRottura : 1.5,
      suono: ["metal", "stone", "wood", "gravel", "sand", "grass"].includes(suono) ? suono : "stone",
      nome: it[`tile.${id}.name`] || "",
      nomeEn: en[`tile.${id}.name`] || "",
      texture: tex,
      forma: forma || null,
      modello: geo ? { geo, animazioni: {} } : null,
      controlli: [controllo("nome italiano", it[`tile.${id}.name`]), controllo("nome inglese", en[`tile.${id}.name`]), controllo("texture", tex), controllo("forma", forma && (String(forma).startsWith("minecraft:") || geo))],
    });
  }

  for (const f of elencaJson(path.join(bp, "items"))) {
    const i = leggiJson(f)?.["minecraft:item"];
    const id = i?.description?.identifier;
    if (!id) continue;
    const comp = i.components || {};
    let icona = comp["minecraft:icon"];
    if (icona && typeof icona === "object") icona = icona.texture || icona.textures?.default;
    const tex = texturePng(daAtlante(itemTex, icona));
    const dn = comp["minecraft:display_name"]?.value;
    // Il gioco mostra il nome di un oggetto solo tramite minecraft:display_name (che punta ai .lang).
    const nomeIt = (dn && (it[dn] || (/\s/.test(dn) ? dn : ""))) || "";
    const nomeEn = (dn && (en[dn] || (/\s/.test(dn) ? dn : ""))) || "";
    contenuti.push({
      tipo: "oggetto",
      id,
      nome: nomeIt,
      nomeEn,
      texture: tex,
      modello: null,
      controlli: [controllo("nome italiano", nomeIt), controllo("nome inglese", nomeEn), controllo("icona", tex)],
    });
  }

  for (const f of elencaJson(path.join(rp, "entity"))) {
    const d = leggiJson(f)?.["minecraft:client_entity"]?.description;
    const id = d?.identifier;
    if (!id) continue;
    const geoId = d.geometry?.default || Object.values(d.geometry || {})[0];
    const tex = texturePng(d.textures?.default || Object.values(d.textures || {})[0]);
    const geo = geometrie[geoId] || null;
    const anim = {};
    for (const [breve, completo] of Object.entries(d.animations || {})) if (animazioni[completo]) anim[breve] = animazioni[completo];
    const comportamento = elencaJson(path.join(bp, "entities")).some((x) => leggiJson(x)?.["minecraft:entity"]?.description?.identifier === id);
    contenuti.push({
      tipo: "mob",
      id,
      nome: it[`entity.${id}.name`] || "",
      nomeEn: en[`entity.${id}.name`] || "",
      texture: tex,
      modello: geo ? { geo, animazioni: anim } : null,
      controlli: [controllo("nome italiano", it[`entity.${id}.name`]), controllo("nome inglese", en[`entity.${id}.name`]), controllo("texture", tex), controllo("modello 3D", geo), controllo("comportamento", comportamento)],
    });
  }

  return { contenuti, versione: (manifest?.header?.version || []).join(".") };
}

// ---------- costruzione ----------
function costruisci() {
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  fs.cpSync(path.join(root, "sito"), out, { recursive: true });
  const { contenuti, versione, rps } = leggiContenuti();
  for (const rp of rps) fs.cpSync(rp, path.join(out, "rp", path.basename(rp)), { recursive: true });
  const dati = {
    repo: REPO,
    generato: new Date().toISOString(),
    commit: git("rev-parse --short HEAD", (process.env.GITHUB_SHA || "").slice(0, 7)),
    dataCommit: git("log -1 --format=%cI", ""),
    versione,
    download: `https://github.com/${REPO}/releases/download/ultima-versione/coop-space.mcaddon`,
    compiti: leggiCompiti(),
    team: (leggiJson(path.join(root, "team.json"))?.membri || []).map(({ github, nome, assistente, accoglienza }) => ({ github, nome, assistente, accoglienza })),
    contenuti,
  };
  fs.writeFileSync(path.join(out, "dati.json"), JSON.stringify(dati));
  const n = dati.compiti.flatMap((s) => s.gruppi.flatMap((g) => g.compiti)).length;
  console.log(`Sito pronto in out/sito: ${n} compiti, ${contenuti.length} contenuti, versione add-on ${versione}.`);
}

costruisci();

if (process.argv.includes("--serve")) {
  const tipi = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };
  http
    .createServer((req, res) => {
      const rel = decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/\/$/, "/index.html");
      const file = path.join(out, path.normalize(rel));
      if (!file.startsWith(out) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404).end("Non trovato");
        return;
      }
      res.writeHead(200, { "Content-Type": tipi[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
      fs.createReadStream(file).pipe(res);
    })
    .listen(8765, "127.0.0.1", () => console.log("Apri http://localhost:8765 (Ctrl+C per fermare)"));
}
