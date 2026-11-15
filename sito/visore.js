// Visore 3D dei modelli Bedrock (.geo.json) con animazioni, basato su bridge-model-viewer.
// Un solo renderer per tutta la pagina: cambiando modello si sostituisce solo il modello nella scena.
import { StandaloneModelViewer, Model } from "bridge-model-viewer";
import { Color } from "three";

let viewer = null;

function dimensioni(box) {
  return { width: Math.max(1, box.clientWidth), height: Math.max(1, box.clientHeight) };
}

function coloreSfondo(box) {
  return new Color(getComputedStyle(box).backgroundColor || "#cfd8dc");
}

export async function mostra(canvas, geo, textureUrl) {
  const box = canvas.parentElement;
  if (!viewer) {
    viewer = new StandaloneModelViewer(canvas, geo, textureUrl, { ...dimensioni(box), antialias: true });
    await viewer.loadedModel;
    new ResizeObserver(() => {
      Object.assign(viewer.options, dimensioni(box));
      viewer.onResize();
    }).observe(box);
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
  window.__visore = viewer; // per i test automatici
}

export function aggiungiAnimazioni(animazioni) {
  const animator = viewer.getModel().animator;
  for (const [id, dati] of Object.entries(animazioni)) animator.addAnimation(id, dati);
}

export function suona(id) {
  const animator = viewer.getModel().animator;
  animator.pauseAll();
  // Rimette le ossa nella posa di partenza: altrimenti, cambiando animazione, restano ferme a metà movimento.
  for (const osso of viewer.getModel().getBoneMap().values()) {
    if (osso.userData.defaultRotation) osso.rotation.fromArray(osso.userData.defaultRotation);
    if (osso.userData.defaultPosition) osso.position.fromArray(osso.userData.defaultPosition);
  }
  if (id) animator.play(id);
  viewer.requestRendering();
}

// Cubo pieno per i blocchi con minecraft:geometry.full_block: ogni faccia usa tutta la texture.
export function geoBlocco() {
  const faccia = { uv: [0, 0], uv_size: [16, 16] };
  const uv = { north: faccia, south: faccia, east: faccia, west: faccia, up: faccia, down: faccia };
  return {
    description: { identifier: "geometry.coop.blocco", texture_width: 16, texture_height: 16 },
    bones: [{ name: "blocco", pivot: [0, 0, 0], cubes: [{ origin: [-8, 0, -8], size: [16, 16, 16], uv }] }],
  };
}

// Lastra sottile per le icone degli oggetti, che nel gioco sono piatte.
export function geoOggetto() {
  const fronte = { uv: [0, 0], uv_size: [16, 16] };
  const bordo = { uv: [0, 0], uv_size: [1, 1] };
  const uv = { north: fronte, south: fronte, east: bordo, west: bordo, up: bordo, down: bordo };
  return {
    description: { identifier: "geometry.coop.oggetto", texture_width: 16, texture_height: 16 },
    bones: [{ name: "oggetto", pivot: [0, 0, 0], cubes: [{ origin: [-8, 0, -0.5], size: [16, 16, 1], uv }] }],
  };
}
