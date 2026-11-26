// Visore 3D: modelli Bedrock, oggetti a rilievo e prova di rottura dei blocchi.
import { StandaloneModelViewer, Model } from "bridge-model-viewer";
import { Color, Mesh, BoxGeometry, PlaneGeometry, CanvasTexture, MeshBasicMaterial } from "three";

let viewer = null;
let crepe = [];
let frammenti = [];
let rotturaTimer = null;
let animazioneFrammenti = 0;
let audio = null;
let audioAttivo = true;
const cacheOggetti = new Map();

function dimensioni(box) { return { width: Math.max(1, box.clientWidth), height: Math.max(1, box.clientHeight) }; }
function coloreSfondo(box) { return new Color(getComputedStyle(box).backgroundColor || "#cfd8dc"); }

export async function mostra(canvas, geo, textureUrl, opzioni = {}) {
  fermaRottura();
  pulisciEffetti();
  canvas.onpointerdown = canvas.onpointermove = canvas.onpointerup = canvas.onpointercancel = canvas.onlostpointercapture = canvas.oncontextmenu = null;
  canvas.classList.remove("visore-rottura");
  const box = canvas.parentElement;
  if (!viewer) {
    viewer = new StandaloneModelViewer(canvas, geo, textureUrl, { ...dimensioni(box), antialias: true });
    await viewer.loadedModel;
    new ResizeObserver(() => { Object.assign(viewer.options, dimensioni(box)); viewer.onResize(); }).observe(box);
  } else {
    const vecchio = viewer.model;
    viewer.scene.remove(vecchio.getGroup());
    vecchio.dispose();
    const nuovo = new Model(geo, textureUrl);
    await nuovo.create();
    viewer.model = nuovo;
    viewer.scene.add(nuovo.getGroup());
  }
  viewer.scene.background = coloreSfondo(box);
  viewer.positionCamera(1.25);
  viewer.requestRendering();
  window.__visore = viewer;
  if (opzioni.tipo === "blocco") preparaRottura(canvas, { ...opzioni, textureUrl });
}

function immagine(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("non riesco a leggere la texture"));
    img.src = url;
  });
}

// Un cubo per texel opaco; i lati usano il texel confinante come colore del bordo.
export async function geoOggetto(textureUrl) {
  if (cacheOggetti.has(textureUrl)) return cacheOggetti.get(textureUrl);
  const img = await immagine(textureUrl);
  const c = document.createElement("canvas");
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const dati = ctx.getImageData(0, 0, c.width, c.height);
  const sx = 16 / c.width, sy = 16 / c.height;
  const uv = (x, y) => ({ uv: [x, y], uv_size: [1, 1] });
  const cubes = [];
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    if (dati.data[(y * c.width + x) * 4 + 3] < 8) continue;
    const vicino = (xx, yy) => {
      xx = Math.max(0, Math.min(c.width - 1, xx)); yy = Math.max(0, Math.min(c.height - 1, yy));
      return uv(dati.data[(yy * c.width + xx) * 4 + 3] >= 8 ? xx : x, dati.data[(yy * c.width + xx) * 4 + 3] >= 8 ? yy : y);
    };
    cubes.push({
      origin: [-8 + x * sx, (c.height - y - 1) * sy, -0.5], size: [sx, sy, 1],
      uv: { north: uv(x, y), south: uv(x, y), east: vicino(x + 1, y), west: vicino(x - 1, y), up: vicino(x, y - 1), down: vicino(x, y + 1) },
    });
  }
  const geo = { description: { identifier: "geometry.coop.oggetto", texture_width: c.width, texture_height: c.height }, bones: [{ name: "oggetto", pivot: [0, 8, 0], rotation: [0, 0, -12], cubes }] };
  cacheOggetti.set(textureUrl, geo);
  return geo;
}

export function geoBlocco() {
  const faccia = { uv: [0, 0], uv_size: [16, 16] };
  const uv = { north: faccia, south: faccia, east: faccia, west: faccia, up: faccia, down: faccia };
  return { description: { identifier: "geometry.coop.blocco", texture_width: 16, texture_height: 16 }, bones: [{ name: "blocco", pivot: [0, 0, 0], cubes: [{ origin: [-8, 0, -8], size: [16, 16, 16], uv }] }] };
}

function generaCrepe(stage) {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const ctx = c.getContext("2d");
  ctx.strokeStyle = "rgba(20,17,15,.9)"; ctx.lineWidth = 3; ctx.lineCap = "round"; ctx.lineJoin = "round";
  // Percorsi frastagliati indipendenti, progressivamente rivelati nelle dieci fasi.
  const percorsi = [
    [[64,64],[54,53],[59,43],[46,31],[48,17]], [[54,53],[39,55],[30,46],[18,49],[9,43]],
    [[59,43],[74,39],[81,28],[96,25],[105,13]], [[39,55],[36,70],[23,78],[20,94],[8,104]],
    [[64,64],[73,72],[70,88],[84,98],[86,116]], [[74,39],[71,24],[79,16]],
    [[36,70],[49,81],[45,95],[57,107]], [[81,28],[94,39],[108,37],[119,47]],
    [[70,88],[61,99],[65,114]], [[23,78],[12,70],[8,61]],
  ];
  const count = Math.ceil(percorsi.length * stage / 10);
  for (let i = 0; i < count; i++) {
    const p = percorsi[i]; ctx.beginPath(); ctx.moveTo(...p[0]);
    for (let j = 1; j < p.length; j++) ctx.lineTo(...p[j]);
    ctx.stroke();
  }
  return new CanvasTexture(c);
}

const texCrepe = [];
function crepaFase(n) {
  return (texCrepe[n] ??= generaCrepe(n));
}

function preparaCrepe() {
  const group = viewer.getModel().getGroup();
  const orientamenti = [
    [[0,8,8.08],[0,0,0]], [[0,8,-8.08],[0,Math.PI,0]],
    [[8.08,8,0],[0,Math.PI/2,0]], [[-8.08,8,0],[0,-Math.PI/2,0]],
    [[0,16.08,0],[-Math.PI/2,0,0]], [[0,-0.08,0],[Math.PI/2,0,0]],
  ];
  crepe = orientamenti.map(([pos, rot]) => {
    const material = new MeshBasicMaterial({ map: crepaFase(1), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const mesh = new Mesh(new PlaneGeometry(16, 16), material);
    mesh.position.set(...pos); mesh.rotation.set(...rot); mesh.visible = false; group.add(mesh); return mesh;
  });
}

function contextAudio() {
  if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
  if (audio.state === "suspended") audio.resume();
  return audio;
}

function colpo(materiale, rottura = false) {
  if (!audioAttivo) return;
  const a = contextAudio(), t = a.currentTime;
  const fruscio = ["gravel", "sand", "grass"].includes(materiale) || materiale === "stone";
  const metal = materiale === "metal";
  const osc = a.createOscillator(), gain = a.createGain();
  osc.type = metal ? "triangle" : "sine";
  osc.frequency.setValueAtTime(metal ? (rottura ? 920 : 620) : materiale === "wood" ? 110 : 75, t);
  if (rottura && metal) osc.frequency.exponentialRampToValueAtTime(1400, t + .18);
  if (fruscio) {
    const n = a.createBuffer(1, Math.floor(a.sampleRate * .11), a.sampleRate), d = n.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = a.createBufferSource(), filtro = a.createBiquadFilter(); src.buffer = n; filtro.type = "lowpass"; filtro.frequency.value = materiale === "stone" ? 360 : 1300;
    gain.gain.setValueAtTime(rottura ? .24 : .12, t); gain.gain.exponentialRampToValueAtTime(.001, t + .11);
    src.connect(filtro).connect(gain).connect(a.destination); src.start(t); return;
  }
  gain.gain.setValueAtTime(rottura ? .22 : .12, t); gain.gain.exponentialRampToValueAtTime(.001, t + (rottura ? .22 : .08));
  osc.connect(gain).connect(a.destination); osc.start(t); osc.stop(t + (rottura ? .23 : .09));
  if (metal && rottura) { const o = a.createOscillator(), g = a.createGain(); o.type = "sine"; o.frequency.value = 1470; g.gain.setValueAtTime(.08,t); g.gain.exponentialRampToValueAtTime(.001,t+.3); o.connect(g).connect(a.destination); o.start(t); o.stop(t+.31); }
}

function pulisciEffetti() {
  if (!viewer) return;
  for (const m of crepe) { m.parent?.remove(m); m.geometry.dispose(); m.material.dispose(); } // le texture delle crepe restano per il prossimo blocco
  crepe = [];
  for (const m of frammenti) { m.parent?.remove(m); m.geometry.dispose(); m.material.dispose(); }
  frammenti = []; cancelAnimationFrame(animazioneFrammenti);
}

function fermaRottura() { clearInterval(rotturaTimer); rotturaTimer = null; }

function preparaRottura(canvas, { tempoRottura = 1.5, suono = "stone", textureUrl } = {}) {
  const gruppo = viewer.getModel().getGroup();
  preparaCrepe();
  canvas.classList.add("visore-rottura");
  canvas.oncontextmenu = (e) => e.preventDefault();
  let premuto = false, iniziato = 0, ultimoColpo = 0, rotto = false, partenza = null;
  const tempo = Math.max(0, Number(tempoRottura) || 0) * 1000;
  let faseAttuale = -1;
  const fase = (n) => {
    if (n === faseAttuale) return;
    faseAttuale = n;
    crepe.forEach((m) => { m.material.map = crepaFase(Math.max(1, n)); m.material.needsUpdate = true; m.visible = n > 0; });
    viewer.requestRendering();
  };
  const scompari = async () => {
    if (rotto) return; rotto = true; fermaRottura();
    gruppo.visible = false; fase(0); colpo(suono, true);
    // Piccoli frammenti colorati, creati localmente e senza risorse di Minecraft.
    const root = viewer.scene;
    let tinta = suono === "metal" ? 0xb5a57a : suono === "wood" ? 0x80603e : 0x8b8b85;
    try {
      const img = await immagine(textureUrl);
      const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
      const ctx = c.getContext("2d", { willReadFrequently: true }); ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data; let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 20) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
      if (n) tinta = (Math.round(r/n) << 16) | (Math.round(g/n) << 8) | Math.round(b/n);
    } catch {}
    for (let i = 0; i < 9; i++) {
      const m = new Mesh(new BoxGeometry(1.3, 1.3, 1.3), new MeshBasicMaterial({ color: new Color(tinta).offsetHSL(0, 0, (Math.random() - .5) * .18) }));
      m.position.set((Math.random()-.5)*10, 5+Math.random()*7, (Math.random()-.5)*10); root.add(m);
      m.userData.vel = [(Math.random()-.5)*.18, Math.random()*.16, (Math.random()-.5)*.18]; frammenti.push(m);
    }
    const inizio = performance.now();
    const muovi = (ora) => {
      for (const m of frammenti) { m.position.x += m.userData.vel[0]; m.position.y += m.userData.vel[1]; m.position.z += m.userData.vel[2]; m.userData.vel[1] -= .012; }
      viewer.requestRendering();
      if (ora - inizio < 650) animazioneFrammenti = requestAnimationFrame(muovi);
    };
    animazioneFrammenti = requestAnimationFrame(muovi);
    setTimeout(() => { for (const m of frammenti) { root.remove(m); m.geometry.dispose(); m.material.dispose(); } frammenti = []; gruppo.visible = true; rotto = false; viewer.requestRendering(); }, 1000);
  };
  const giu = (e) => {
    if (premuto || rotto) return; e.preventDefault(); premuto = true; partenza = [e.clientX, e.clientY]; iniziato = performance.now(); ultimoColpo = iniziato;
    canvas.setPointerCapture?.(e.pointerId); contextAudio(); colpo(suono);
    fase(1);
    rotturaTimer = setInterval(() => {
      if (!premuto || rotto) return;
      const trascorso = performance.now() - iniziato;
      const n = Math.min(10, Math.max(1, Math.ceil(trascorso / Math.max(1, tempo) * 10)));
      fase(n);
      if (performance.now() - ultimoColpo >= 250) { colpo(suono); ultimoColpo = performance.now(); }
      viewer.requestRendering();
      if (trascorso >= tempo) scompari();
    }, 40);
  };
  const su = () => { premuto = false; fermaRottura(); if (!rotto) fase(0); };
  // Se il dito si sposta, si sta girando il modello: niente rottura.
  const muovi = (e) => { if (premuto && partenza && Math.hypot(e.clientX - partenza[0], e.clientY - partenza[1]) > 10) su(); };
  canvas.onpointerdown = giu; canvas.onpointermove = muovi; canvas.onpointerup = su; canvas.onpointercancel = su; canvas.onlostpointercapture = su;
  viewer.requestRendering();
}

export function impostaAudio(attivo) { audioAttivo = attivo; }
export function aggiungiAnimazioni(animazioni) { const animator = viewer.getModel().animator; for (const [id, dati] of Object.entries(animazioni)) animator.addAnimation(id, dati); }
export function suona(id) {
  const animator = viewer.getModel().animator; animator.pauseAll();
  for (const osso of viewer.getModel().getBoneMap().values()) {
    if (osso.userData.defaultRotation) osso.rotation.fromArray(osso.userData.defaultRotation);
    if (osso.userData.defaultPosition) osso.position.fromArray(osso.userData.defaultPosition);
  }
  if (id) animator.play(id); viewer.requestRendering();
}
