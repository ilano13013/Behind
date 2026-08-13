// Les images dessinées à la main.
//
// Tout Behind est tracé par du code, forme par forme. Ça a une limite dure :
// un trait de code ne remplacera jamais un trait de dessinateur. Ce module
// est la prise où l'on branche de vraies illustrations quand on en a.
//
// Trois règles tiennent le fichier :
//
//   1. RIEN N'EST OBLIGATOIRE. Chaque image est un bonus. Si le fichier
//      manque, le jeu retombe sur son dessin procédural sans un mot. On
//      peut livrer une seule image et voir la différence sur un seul écran.
//
//   2. LA SIMULATION NE SAIT RIEN. Aucun habitant, aucun appartement, aucun
//      évènement ne dépend d'un fichier. Les images sont une peau, jamais
//      une condition.
//
//   3. LE CHARGEMENT NE BLOQUE JAMAIS. On lance les téléchargements, on
//      joue tout de suite, et chaque image apparaît dès qu'elle arrive.
//
// La liste des emplacements et le cahier des charges de chaque image sont
// dans assets/README.md. `node tools/check-assets.js` dit lesquels sont
// remplis.

import { ARCHETYPES } from './interior-plan.js';
import { MORPHO } from './wardrobe.js';

/** Où le jeu va chercher les images. Le bundler y injecte du base64. */
export const ASSET_BASE = 'assets/';

/**
 * Le catalogue des emplacements.
 *
 * Un emplacement = un identifiant, un dossier, une taille attendue, et une
 * phrase qui dit à quoi il sert. Ajouter un emplacement, c'est ajouter une
 * ligne ; le reste du jeu s'en sert automatiquement.
 */
export const SLOTS = [];

function slot(id, o) {
  SLOTS.push({ id, file: `${o.dir}/${o.name}.png`, ...o });
}

// --- Décors intérieurs ---
// Le fond de la pièce quand le mur s'efface. C'est le meilleur rapport
// qualité/effort de toute la liste : douze images, et le jeu change de
// visage. Les habitants continuent d'être dessinés par-dessus.
for (const a of ARCHETYPES) {
  slot(`decor/${a}`, {
    dir: 'decors', name: a, w: 1600, h: 900,
    role: `Intérieur « ${a.replace(/_/g, ' ')} », vu en coupe, sans personnage`,
  });
}

// --- Ambiances de façade ---
// Un calque posé derrière l'immeuble : le ciel et le quartier. Six moments.
for (const [id, role] of [
  ['nuit', 'Nuit calme sur le quartier'],
  ['soiree', 'Début de soirée, lumières chaudes'],
  ['aube', 'Aube, ciel rose et bleu'],
  ['pluie', 'Jour pluvieux, gris et lavé'],
  ['canicule', 'Canicule, lumière blanche écrasante'],
  ['hiver', 'Hiver, ciel bas et froid'],
]) {
  slot(`ambiance/${id}`, { dir: 'ambiances', name: id, w: 1920, h: 1080, role });
}

// --- Portraits ---
// Le visage d'un habitant dans sa fiche. Ce ne sont pas des portraits de
// personnages nommés : c'est une TROUPE. Chaque habitant se voit attribuer
// un comédien de son gabarit, une fois pour toutes. Six portraits par
// gabarit suffisent à ce qu'on ne voie pas la répétition dans une fiche
// qu'on ouvre un habitant à la fois.
export const PORTRAITS_PAR_GABARIT = 6;
for (const morpho of Object.keys(MORPHO)) {
  for (let i = 1; i <= PORTRAITS_PAR_GABARIT; i++) {
    const n = String(i).padStart(2, '0');
    slot(`portrait/${morpho}-${n}`, {
      dir: 'portraits', name: `${morpho}-${n}`, w: 512, h: 512,
      role: `Portrait ${MORPHO[morpho].label.toLowerCase()} n°${i}, buste, fond transparent`,
      morpho,
    });
  }
}

// --- État du chargement ------------------------------------------------------

const images = new Map();     // id → HTMLImageElement prêt à dessiner
const failed = new Set();     // id → on a essayé, il n'y a rien
let started = false;

/**
 * Base64 injecté par tools/build.js dans le fichier unique.
 * En développement l'objet est vide et on charge par le réseau.
 */
export const EMBEDDED = {};

function charge(id, src, onProgress) {
  const img = new Image();
  img.onload = () => {
    images.set(id, img);
    onProgress?.(images.size, SLOTS.length);
  };
  img.onerror = () => {
    // Un emplacement vide est le cas NORMAL, pas une erreur.
    failed.add(id);
  };
  img.src = src;
}

/**
 * Lance le chargement. Ne bloque pas : on rend la main tout de suite et
 * chaque image s'installe quand elle arrive.
 *
 * On ne tente JAMAIS un fichier au hasard. Cinquante-quatre emplacements
 * dont deux remplis, ce serait cinquante-deux 404 rouges dans la console
 * du navigateur à chaque partie — pour un état de fonctionnement normal.
 * Le dossier assets/ tient donc un manifeste de ce qu'il contient
 * réellement, régénéré par `node tools/check-assets.js`.
 */
export function loadAssets(onProgress) {
  if (started || typeof Image === 'undefined') return;
  started = true;

  // Fichier unique : les images sont déjà là, en base64. Aucun réseau.
  const embarquees = Object.keys(EMBEDDED);
  if (embarquees.length) {
    for (const id of embarquees) charge(id, EMBEDDED[id], onProgress);
    return;
  }

  // Développement : on lit le manifeste, et lui seul.
  fetch(`${ASSET_BASE}manifest.json`)
    .then((r) => (r.ok ? r.json() : []))
    .then((liste) => {
      const connus = new Map(SLOTS.map((s) => [s.id, s]));
      for (const entree of liste) {
        const id = typeof entree === 'string' ? entree : entree.id;
        const s = connus.get(id);
        if (s) charge(id, `${ASSET_BASE}${entree.file ?? s.file}`, onProgress);
      }
    })
    .catch(() => { /* pas de manifeste : le jeu dessine tout lui-même. */ });
}

/** L'image d'un emplacement, ou null s'il est vide. */
export function asset(id) {
  return images.get(id) ?? null;
}

export function hasAsset(id) {
  return images.has(id);
}

/** Combien d'emplacements sont remplis. Pour le diagnostic, rien d'autre. */
export function assetStatus() {
  return { charges: images.size, total: SLOTS.length, manquants: failed.size };
}

// --- Attribution -------------------------------------------------------------

/**
 * Le comédien attribué à un habitant.
 *
 * Stable et dérivé de l'identifiant : le même voisin garde le même visage
 * toute la partie. On ne retient que les portraits de son gabarit — un
 * enfant ne peut pas hériter du portrait d'un senior.
 */
export function portraitFor(person) {
  if (person._portrait !== undefined) return person._portrait;
  const morpho = person._look?.morpho ?? 'homme';
  const dispo = [];
  for (let i = 1; i <= PORTRAITS_PAR_GABARIT; i++) {
    const id = `portrait/${morpho}-${String(i).padStart(2, '0')}`;
    if (images.has(id)) dispo.push(id);
  }
  // Tant que rien n'est livré, la réponse est « rien », et la fiche garde
  // son dessin. On ne met pas le résultat en cache dans ce cas : une image
  // peut encore arriver une seconde plus tard.
  if (!dispo.length) return null;
  const choisi = dispo[person.id % dispo.length];
  person._portrait = choisi;
  return choisi;
}

/** L'ambiance de façade qui correspond à l'heure et au temps qu'il fait. */
export function ambianceFor(world) {
  const meteo = world.weather?.id ?? 'clair';
  if (meteo === 'pluie' || meteo === 'neige') return 'ambiance/pluie';
  if (meteo === 'canicule') return 'ambiance/canicule';
  const h = world.clock.hour;
  if (h >= 22 || h < 5) return 'ambiance/nuit';
  if (h < 8) return 'ambiance/aube';
  if (h >= 19) return 'ambiance/soiree';
  if (world.clock.season === 0) return 'ambiance/hiver';
  return null;   // plein jour ordinaire : le ciel dégradé fait très bien.
}

/** Le décor d'un appartement, d'après ce que la pièce raconte déjà. */
export function decorFor(apt) {
  return apt._archetype ? `decor/${apt._archetype}` : null;
}

/**
 * Dessine une image en la recadrant pour remplir le rectangle sans la
 * déformer — l'équivalent de `object-fit: cover`. Une illustration étirée
 * se voit immédiatement, et ruine le travail du dessinateur.
 */
export function drawCover(ctx, img, x, y, w, h) {
  const ratio = Math.max(w / img.width, h / img.height);
  const dw = img.width * ratio;
  const dh = img.height * ratio;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}
