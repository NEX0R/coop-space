// Lettura e scrittura minime di file zip (.mcworld, .mcaddon), senza pacchetti npm.
// Serve a package.mjs per sistemare il mondo di prova esportato da Minecraft Creator Tools.
import { inflateRawSync, deflateRawSync } from "node:zlib";

const TABELLA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = TABELLA_CRC[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

// Restituisce [{ nome, dati }] (le cartelle hanno dati vuoti e nome che finisce con "/").
export function leggiZip(buf) {
  let fine = buf.length - 22;
  while (fine >= 0 && buf.readUInt32LE(fine) !== 0x06054b50) fine--;
  if (fine < 0) throw new Error("zip non valido: manca la directory centrale");
  const quanti = buf.readUInt16LE(fine + 10);
  let p = buf.readUInt32LE(fine + 16);
  const voci = [];
  for (let i = 0; i < quanti; i++) {
    const metodo = buf.readUInt16LE(p + 10);
    const compresso = buf.readUInt32LE(p + 20);
    const lNome = buf.readUInt16LE(p + 28);
    const lExtra = buf.readUInt16LE(p + 30);
    const lCommento = buf.readUInt16LE(p + 32);
    const locale = buf.readUInt32LE(p + 42);
    const nome = buf.toString("utf8", p + 46, p + 46 + lNome);
    const inizio = locale + 30 + buf.readUInt16LE(locale + 26) + buf.readUInt16LE(locale + 28);
    const grezzi = buf.subarray(inizio, inizio + compresso);
    voci.push({ nome, dati: metodo === 0 ? Buffer.from(grezzi) : inflateRawSync(grezzi) });
    p += 46 + lNome + lExtra + lCommento;
  }
  return voci;
}

export function scriviZip(voci) {
  const locali = [];
  const centrali = [];
  let offset = 0;
  for (const { nome, dati } of voci) {
    const n = Buffer.from(nome, "utf8");
    const cartella = nome.endsWith("/");
    const compresso = cartella ? Buffer.alloc(0) : deflateRawSync(dati);
    const crc = cartella ? 0 : crc32(dati);
    const metodo = cartella ? 0 : 8;
    const loc = Buffer.alloc(30);
    loc.writeUInt32LE(0x04034b50, 0);
    loc.writeUInt16LE(20, 4);
    loc.writeUInt16LE(0x0800, 6); // nomi in UTF-8
    loc.writeUInt16LE(metodo, 8);
    loc.writeUInt32LE(crc, 14);
    loc.writeUInt32LE(compresso.length, 18);
    loc.writeUInt32LE(cartella ? 0 : dati.length, 22);
    loc.writeUInt16LE(n.length, 26);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0x0800, 8);
    cen.writeUInt16LE(metodo, 10);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(compresso.length, 20);
    cen.writeUInt32LE(cartella ? 0 : dati.length, 24);
    cen.writeUInt16LE(n.length, 28);
    cen.writeUInt32LE(cartella ? 0x10 : 0, 38);
    cen.writeUInt32LE(offset, 42);
    locali.push(loc, n, compresso);
    centrali.push(cen, n);
    offset += 30 + n.length + compresso.length;
  }
  const dirCentrale = Buffer.concat(centrali);
  const coda = Buffer.alloc(22);
  coda.writeUInt32LE(0x06054b50, 0);
  coda.writeUInt16LE(voci.length, 8);
  coda.writeUInt16LE(voci.length, 10);
  coda.writeUInt32LE(dirCentrale.length, 12);
  coda.writeUInt32LE(offset, 16);
  return Buffer.concat([...locali, dirCentrale, coda]);
}
