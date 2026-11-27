// Crea dist/coop-space.mcaddon, il file da aprire sul telefono per importare l'add-on.
// Esegue prima la verifica: un add-on con errori non viene impacchettato.
import { spawnSync } from "node:child_process";
import { mkdirSync, existsSync, rmSync, cpSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { leggiZip, scriviZip } from "./zip.mjs";

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
// Il nome mostrato in Minecraft contiene la versione (e, per le anteprime, il numero della pull
// request, passato da build.yml in COOP_ETICHETTA): così nella lista dei pacchetti si distinguono.
const etichetta = (process.env.COOP_ETICHETTA || "").trim();
const nuove = new Map();
for (const m of manifest) {
  m.dati.header.version = [m.dati.header.version[0], giorno, minuto];
  m.dati.header.name = `${m.dati.header.name} ${m.dati.header.version.join(".")}${etichetta ? ` (${etichetta})` : ""}`;
  nuove.set(m.dati.header.uuid, m.dati.header.version);
}
for (const m of manifest) {
  for (const d of m.dati.dependencies || []) if (d.uuid && nuove.has(d.uuid)) d.version = [...nuove.get(d.uuid)];
  writeFileSync(m.file, JSON.stringify(m.dati, null, 2) + "\n");
}
const versione = manifest[0]?.dati.header.version.join(".");
const nomeVersione = `${versione}${etichetta ? ` (${etichetta})` : ""}`;

// Gli script scrivono in chat la versione attiva: se il messaggio non compare, la logica non è attiva.
const elencaJs = (dir) =>
  !existsSync(dir) ? [] : readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? elencaJs(join(dir, d.name)) : d.name.endsWith(".js") ? [join(dir, d.name)] : []));
for (const file of elencaJs(join(copia, "behavior_packs"))) {
  const testo = readFileSync(file, "utf8");
  if (testo.includes("__VERSIONE_COOP__")) writeFileSync(file, testo.replaceAll("__VERSIONE_COOP__", nomeVersione));
}

// Lanciamo il file JS di mct direttamente con node: il collegamento in node_modules/.bin
// su Windows è un .cmd e non si può avviare così.
const mct = join(root, "node_modules/@minecraft/creator-tools/cli/index.mjs");
// I pack sono quattro (Coop Space e Sangue Immortale, logica e grafica): "mct export addon" ne mette
// nel file una sola coppia (provato il 27/11), quindi lo zip con tutti i pack lo componiamo noi.
// Un .mcaddon è solo uno zip con una cartella per pack.
const vociDi = (dir, prefisso) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory()
      ? [{ nome: `${prefisso}${d.name}/`, dati: Buffer.alloc(0) }, ...vociDi(join(dir, d.name), `${prefisso}${d.name}/`)]
      : [{ nome: `${prefisso}${d.name}`, dati: readFileSync(join(dir, d.name)) }],
  );
const packs = manifest.map((m) => ({
  cartella: dirname(m.file),
  nome: basename(dirname(m.file)),
  tipo: basename(dirname(dirname(m.file))),
  uuid: m.dati.header.uuid,
  versione: m.dati.header.version,
}));
writeFileSync(out, scriviZip(packs.flatMap((p) => vociDi(p.cartella, `${p.nome}/`))));

// Mondo di prova: copia del mondo tutorial di Sangue Immortale (vedi sistemaLevelDat), con i trucchi attivi e tutti i pack già attivati dentro.
// Aprendolo non si deve scegliere nessun pacchetto: è il modo più sicuro per provare, su PC e telefono.
// Lo esporta Creator Tools; noi cambiamo il nome e spegniamo l'esperimento "Beta API" (gametest),
// che Creator Tools accende ma a noi non serve (usiamo solo API stabili).
const mondo = join(dist, "coop-space-mondo-prova.mcworld");
if (existsSync(mondo)) rmSync(mondo);
const rw = spawnSync(process.execPath, [mct, "-i", copia, "-o", dist, "--of", mondo, "export", "world"], { stdio: "inherit" });
if (rw.status !== 0 || !existsSync(mondo)) {
  console.error("Mondo di prova non creato.");
  process.exit(1);
}
const nomeMondo = `Coop Space ${nomeVersione}`;
const u16 = (n) => {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n);
  return b;
};
const STRATI_TUTORIAL = {
  biome_id: 1,
  block_layers: [
    { block_name: "minecraft:bedrock", count: 1 },
    { block_name: "minecraft:deepslate", count: 1 },
    { block_name: "minecraft:dirt", count: 2 },
    { block_name: "minecraft:grass_block", count: 1 },
  ],
  encoding_version: 6,
  structure_options: null,
  world_version: "version.post_1_18",
};
// [tipo NBT (1 = sì/no, 3 = numero), nome, valore], presi dal level.dat del tutorial di Jowa.
const IMPOSTAZIONI_TUTORIAL = [
  [3, "GameType", 0],
  [1, "keepinventory", 1],
  [1, "showcoordinates", 1],
  [1, "domobspawning", 0],
  [1, "doweathercycle", 0],
];
const tagNbt = (tipo, nome) => Buffer.concat([Buffer.from([tipo]), u16(Buffer.byteLength(nome)), Buffer.from(nome)]);
function sistemaLevelDat(buf) {
  const i = buf.indexOf(tagNbt(8, "LevelName"));
  if (i >= 0) {
    const s = i + tagNbt(8, "LevelName").length;
    const nuovo = Buffer.from(nomeMondo, "utf8");
    buf = Buffer.concat([buf.subarray(0, s), u16(nuovo.length), nuovo, buf.subarray(s + 2 + buf.readUInt16LE(s))]);
  }
  const g = buf.indexOf(tagNbt(1, "gametest"));
  if (g >= 0) buf[g + tagNbt(1, "gametest").length] = 0;
  // Il mondo di prova è una copia del mondo "Tutorial Sangue Immortale" di Jowa: stesso terreno piatto
  // con uno strato di ardesia profonda (è il segno da cui i due tutorial capiscono dove sono e si
  // costruiscono da soli), sopravvivenza, inventario che resta, coordinate, niente mob spontanei né meteo.
  const strati = Buffer.from(JSON.stringify(STRATI_TUTORIAL), "utf8");
  const f = buf.indexOf(tagNbt(8, "FlatWorldLayers"));
  if (f >= 0) {
    const s = f + tagNbt(8, "FlatWorldLayers").length;
    buf = Buffer.concat([buf.subarray(0, s), u16(strati.length), strati, buf.subarray(s + 2 + buf.readUInt16LE(s))]);
  }
  for (const [tipo, nome, valore] of IMPOSTAZIONI_TUTORIAL) {
    const t = buf.indexOf(tagNbt(tipo, nome));
    if (t < 0) continue;
    if (tipo === 1) buf[t + tagNbt(tipo, nome).length] = valore;
    else buf.writeInt32LE(valore, t + tagNbt(tipo, nome).length);
  }
  buf.writeInt32LE(buf.length - 8, 4); // l'intestazione del level.dat contiene la lunghezza del resto
  return buf;
}
// Dal mondo esportato teniamo solo impostazioni e nome: i pack (anche qui ne metterebbe una coppia sola)
// e gli elenchi dei pack attivi li scriviamo noi, con tutti e quattro.
const json = (d) => Buffer.from(JSON.stringify(d, null, 2), "utf8");
const voci = leggiZip(readFileSync(mondo)).filter((v) => !/^(behavior_packs|resource_packs)\//.test(v.nome) && !/^world_(behavior|resource)_pack/.test(v.nome));
for (const v of voci) {
  if (v.nome === "level.dat" || v.nome === "level.dat_old") v.dati = sistemaLevelDat(v.dati);
  if (v.nome === "levelname.txt") v.dati = Buffer.from(nomeMondo, "utf8");
}
for (const [tipo, chiave] of [["behavior_packs", "behavior"], ["resource_packs", "resource"]]) {
  const questi = packs.filter((p) => p.tipo === tipo);
  voci.push({ nome: `${tipo}/`, dati: Buffer.alloc(0) }, ...questi.flatMap((p) => vociDi(p.cartella, `${tipo}/${p.nome}/`)));
  voci.push({ nome: `world_${chiave}_packs.json`, dati: json(questi.map((p) => ({ pack_id: p.uuid, version: p.versione }))) });
  voci.push({ nome: `world_${chiave}_pack_history.json`, dati: json({ packs: questi.map((p) => ({ uuid: p.uuid, version: p.versione, name: p.nome, can_be_redownloaded: false })) }) });
}
writeFileSync(mondo, scriviZip(voci));

console.log(`\nPronto: ${out} (versione ${versione})`);
console.log(`Pronto: ${mondo} (mondo "${nomeMondo}")`);
