// La garde-robe et le catalogue de visages.
//
// C'est la charte graphique traduite en code, et les nombres ne sont pas
// décoratifs : la planche demande 30 formes de têtes, 50 coiffures,
// 30 paires d'yeux, 25 nez, 40 bouches, 30 barbes et moustaches,
// 50 pantalons, 40 chaussures, 60 accessoires et 80 tenues réparties en
// sept contextes (quotidien, travail, sport, soirée, été, hiver, maison).
// Chaque compte est vérifié par tools/test-look.js — si un rayon rétrécit,
// le test casse.
//
// Deux principes tiennent tout le fichier :
//
//   1. Un catalogue de pièces, pas des modèles recolorés. Chaque habitant
//      tire une pièce dans chaque rayon ; le tirage est stable (dérivé de
//      son identifiant) mais orienté par l'âge, le genre, le métier et le
//      caractère. Les pièces incompatibles sont retirées du sac AVANT le
//      tirage.
//
//   2. Une tenue n'est pas une propriété, c'est un contexte. Le même
//      habitant a sept tenues — il dort en pyjama, travaille en chemise ou
//      en salopette selon son métier, sort en tenue de soirée, met un
//      manteau l'hiver. C'est `contextFor` qui décide laquelle il porte.
//
// Repères :
//   — visage : origine au centre de la tête, `r` = rayon du crâne ;
//   — vêtements : géométrie du buste fournie par le personnage.

import { PALETTE, shade, rgba, pickStable } from './palette.js';
import { INK, LINE, ink, solid, capsulePath, roundRect } from './ink.js';

// --- Tirages stables --------------------------------------------------------

function hashPick(seed, mod) {
  let h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  return (h >>> 0) % mod;
}

/** Tirage pondéré stable : les listes de préférences passent avant le hasard. */
function preferred(seed, pool, preferences, strength = 3) {
  const bag = [...pool];
  for (const p of preferences) {
    if (!pool.includes(p)) continue;
    for (let i = 0; i < strength; i++) bag.push(p);
  }
  return bag[hashPick(seed, bag.length)];
}

// --- Morphologies -----------------------------------------------------------
//
// Six gabarits. Ce ne sont pas six tailles : ce sont six façons d'occuper
// l'espace. Un ado n'est pas un adulte en plus petit, il est plus étroit
// d'épaules et plus long de jambes ; un senior s'est tassé et voûté ; un
// enfant, c'est surtout une tête.

export const MORPHO = {
  enfant: {
    label: 'Enfant',
    head: 1.42, torso: 0.78, leg: 0.66, shoulder: 0.74, waist: 1.0, hip: 0.94,
    limb: 0.82, neck: 0.62, posture: 0.03, step: 0.82,
  },
  ado: {
    label: 'Adolescent',
    head: 1.08, torso: 0.96, leg: 1.1, shoulder: 0.84, waist: 0.78, hip: 0.86,
    limb: 1.1, neck: 1.08, posture: 0.13, step: 1.06,
  },
  homme: {
    label: 'Homme adulte',
    head: 1, torso: 1, leg: 1, shoulder: 1.14, waist: 0.92, hip: 0.96,
    limb: 1, neck: 1, posture: 0, step: 1,
  },
  femme: {
    label: 'Femme',
    head: 1.03, torso: 0.95, leg: 1.05, shoulder: 0.9, waist: 0.74, hip: 1.14,
    limb: 0.97, neck: 1.02, posture: -0.02, step: 0.96,
  },
  mature: {
    label: 'Mature',
    head: 1, torso: 1.04, leg: 0.95, shoulder: 1.06, waist: 1.16, hip: 1.08,
    limb: 0.97, neck: 0.9, posture: 0.05, step: 0.92,
  },
  senior: {
    label: 'Senior',
    head: 1.05, torso: 0.97, leg: 0.88, shoulder: 0.93, waist: 1.0, hip: 0.98,
    limb: 0.92, neck: 0.82, posture: 0.16, step: 0.78,
  },
};

/** Le gabarit d'un habitant : l'âge d'abord, le genre ensuite. */
export function morphoKey(person) {
  if (person.age < 12) return 'enfant';
  if (person.age < 20) return 'ado';
  if (person.age >= 68) return 'senior';
  if (person.gender === 'f') return person.age >= 54 ? 'mature' : 'femme';
  return person.age >= 50 ? 'mature' : 'homme';
}

/** La taille d'un habitant, relative à un adulte. */
export function heightFactor(age) {
  if (age < 1) return 0.34;
  if (age < 6) return 0.44 + age * 0.032;
  if (age < 14) return 0.62 + (age - 6) * 0.036;
  if (age < 18) return 0.91 + (age - 14) * 0.022;
  if (age > 74) return 0.94;
  return 1;
}

// --- 30 formes de têtes -----------------------------------------------------
//
// La tête est tracée d'un seul chemin : tempes, pommettes, mâchoire,
// menton. Neuf formes sont dessinées à la main — ce sont les plus
// caractérielles — et vingt et une sont déclinées d'un gabarit paramétré
// (largeur, menton, mâchoire). C'est la pièce qui porte le plus de la
// ressemblance.

const HAND_HEADS = [
  // Carrée : deux angles nets, menton large.
  (ctx, r) => {
    ctx.moveTo(-r * 0.95, -r * 0.18);
    ctx.quadraticCurveTo(-r * 1.02, -r * 1.06, 0, -r * 1.06);
    ctx.quadraticCurveTo(r * 1.02, -r * 1.06, r * 0.95, -r * 0.18);
    ctx.quadraticCurveTo(r * 0.94, r * 0.74, r * 0.52, r * 0.94);
    ctx.lineTo(-r * 0.48, r * 0.94);
    ctx.quadraticCurveTo(-r * 0.94, r * 0.74, -r * 0.95, -r * 0.18);
  },
  // En pointe : joues creuses, menton fin.
  (ctx, r) => {
    ctx.moveTo(-r * 0.92, -r * 0.2);
    ctx.quadraticCurveTo(-r * 1.0, -r * 1.08, 0, -r * 1.08);
    ctx.quadraticCurveTo(r * 1.0, -r * 1.08, r * 0.92, -r * 0.2);
    ctx.quadraticCurveTo(r * 0.82, r * 0.66, 0, r * 1.12);
    ctx.quadraticCurveTo(-r * 0.82, r * 0.66, -r * 0.92, -r * 0.2);
  },
  // Lourde : bajoues, menton bas.
  (ctx, r) => {
    ctx.moveTo(-r * 0.96, -r * 0.2);
    ctx.quadraticCurveTo(-r * 1.0, -r * 1.02, 0, -r * 1.02);
    ctx.quadraticCurveTo(r * 1.0, -r * 1.02, r * 0.96, -r * 0.2);
    ctx.quadraticCurveTo(r * 1.1, r * 0.9, r * 0.32, r * 1.06);
    ctx.lineTo(-r * 0.28, r * 1.06);
    ctx.quadraticCurveTo(-r * 1.1, r * 0.9, -r * 0.96, -r * 0.2);
  },
  // Ovale : la plus douce, aucun angle.
  (ctx, r) => {
    ctx.moveTo(-r * 0.9, -r * 0.12);
    ctx.quadraticCurveTo(-r * 0.98, -r * 1.1, 0, -r * 1.1);
    ctx.quadraticCurveTo(r * 0.98, -r * 1.1, r * 0.9, -r * 0.12);
    ctx.quadraticCurveTo(r * 0.86, r * 0.86, 0, r * 1.02);
    ctx.quadraticCurveTo(-r * 0.86, r * 0.86, -r * 0.9, -r * 0.12);
  },
  // Ronde : celle des enfants et des bonnes vivantes.
  (ctx, r) => {
    ctx.moveTo(-r * 1.02, -r * 0.06);
    ctx.quadraticCurveTo(-r * 1.06, -r * 1.04, 0, -r * 1.04);
    ctx.quadraticCurveTo(r * 1.06, -r * 1.04, r * 1.02, -r * 0.06);
    ctx.quadraticCurveTo(r * 1.0, r * 0.92, 0, r * 0.98);
    ctx.quadraticCurveTo(-r * 1.0, r * 0.92, -r * 1.02, -r * 0.06);
  },
  // Longue : front haut, visage étiré.
  (ctx, r) => {
    ctx.moveTo(-r * 0.86, -r * 0.3);
    ctx.quadraticCurveTo(-r * 0.94, -r * 1.16, 0, -r * 1.16);
    ctx.quadraticCurveTo(r * 0.94, -r * 1.16, r * 0.86, -r * 0.3);
    ctx.quadraticCurveTo(r * 0.84, r * 0.9, r * 0.3, r * 1.1);
    ctx.lineTo(-r * 0.26, r * 1.1);
    ctx.quadraticCurveTo(-r * 0.84, r * 0.9, -r * 0.86, -r * 0.3);
  },
  // Anguleuse : pommettes hautes et saillantes.
  (ctx, r) => {
    ctx.moveTo(-r * 0.88, -r * 0.34);
    ctx.quadraticCurveTo(-r * 0.94, -r * 1.04, 0, -r * 1.04);
    ctx.quadraticCurveTo(r * 0.94, -r * 1.04, r * 0.88, -r * 0.34);
    ctx.lineTo(r * 1.0, -r * 0.1);
    ctx.quadraticCurveTo(r * 0.78, r * 0.72, 0, r * 1.04);
    ctx.quadraticCurveTo(-r * 0.78, r * 0.72, -r * 1.0, -r * 0.1);
  },
  // Menton en galoche : le profil du vieux titi.
  (ctx, r) => {
    ctx.moveTo(-r * 0.92, -r * 0.24);
    ctx.quadraticCurveTo(-r * 0.98, -r * 1.05, 0, -r * 1.05);
    ctx.quadraticCurveTo(r * 0.98, -r * 1.05, r * 0.92, -r * 0.24);
    ctx.quadraticCurveTo(r * 0.86, r * 0.5, r * 0.62, r * 0.78);
    ctx.quadraticCurveTo(r * 0.3, r * 1.16, -r * 0.2, r * 1.0);
    ctx.quadraticCurveTo(-r * 0.86, r * 0.7, -r * 0.92, -r * 0.24);
  },
  // Fine et haute : les traits secs.
  (ctx, r) => {
    ctx.moveTo(-r * 0.82, -r * 0.26);
    ctx.quadraticCurveTo(-r * 0.9, -r * 1.12, 0, -r * 1.12);
    ctx.quadraticCurveTo(r * 0.9, -r * 1.12, r * 0.82, -r * 0.26);
    ctx.quadraticCurveTo(r * 0.76, r * 0.7, r * 0.18, r * 1.06);
    ctx.quadraticCurveTo(-r * 0.14, r * 1.14, -r * 0.34, r * 0.98);
    ctx.quadraticCurveTo(-r * 0.78, r * 0.66, -r * 0.82, -r * 0.26);
  },
];

/** Gabarit paramétré : largeur, hauteur du front, joue, mâchoire, menton. */
const genHead = ({ w = 1, top = 1.07, cheek = 0.95, jaw = 0.5, chin = 1.0, sq = 0.5 }) =>
  (ctx, r) => {
    ctx.moveTo(-r * 0.94 * w, -r * 0.18);
    ctx.quadraticCurveTo(-r * 1.02 * w, -r * top, 0, -r * top);
    ctx.quadraticCurveTo(r * 1.02 * w, -r * top, r * 0.94 * w, -r * 0.18);
    ctx.quadraticCurveTo(r * cheek * w, r * (0.35 + sq * 0.45), r * jaw, r * chin);
    ctx.lineTo(-r * jaw, r * chin);
    ctx.quadraticCurveTo(-r * cheek * w, r * (0.35 + sq * 0.45), -r * 0.94 * w, -r * 0.18);
  };

const GEN_HEAD_PARAMS = [];
for (const w of [0.88, 1, 1.1]) {
  for (const chin of [0.94, 1.05, 1.16]) {
    for (const jaw of [0.32, 0.55]) {
      GEN_HEAD_PARAMS.push({ w, chin, jaw, cheek: 0.88 + jaw * 0.2, sq: 0.35 + jaw * 0.4 });
    }
  }
}
GEN_HEAD_PARAMS.push(
  { w: 1.16, top: 1.0, chin: 0.96, jaw: 0.62, cheek: 1.0, sq: 0.7 },   // massive
  { w: 0.8, top: 1.18, chin: 1.1, jaw: 0.24, cheek: 0.8, sq: 0.3 },    // très étroite
  { w: 1.04, top: 0.96, chin: 1.02, jaw: 0.5, cheek: 0.96, sq: 0.55 }, // front bas
);

export const HEADS = [...HAND_HEADS, ...GEN_HEAD_PARAMS.map(genHead)];

// --- 30 paires d'yeux -------------------------------------------------------
//
// Chaque entrée est une géométrie : demi-largeur, demi-hauteur,
// inclinaison, et de quoi savoir s'il faut un cil, un cerne, une paupière
// lourde ou un maquillage. Le dessin est fait une seule fois dans
// character.js — c'est lui qui connaît l'ouverture et le regard.

export const EYES = [
  { w: 0.175, h: 0.17, tilt: 0, lash: 0 },                       // ronds
  { w: 0.21, h: 0.145, tilt: 0.06, lash: 0 },                    // en amande
  { w: 0.2, h: 0.13, tilt: -0.14, lash: 0 },                     // tombants
  { w: 0.155, h: 0.115, tilt: 0.02, lash: 0 },                   // petits
  { w: 0.19, h: 0.185, tilt: 0, lash: 0.9 },                     // grands, cils longs
  { w: 0.185, h: 0.1, tilt: 0.16, lash: 0 },                     // rieurs, plissés
  { w: 0.165, h: 0.16, tilt: 0, lash: 0, ring: 0.55 },           // cernés
  { w: 0.2, h: 0.155, tilt: 0.04, lash: 0.6, liner: 0.9 },       // maquillés
  { w: 0.145, h: 0.09, tilt: -0.05, lash: 0, hood: 0.8 },        // paupière lourde
  { w: 0.215, h: 0.2, tilt: 0, lash: 0.3 },                      // écarquillés
  // Vingt déclinaisons : mêmes familles, autres proportions.
  ...[
    [0.15, 0.11, -0.08], [0.15, 0.15, 0.1], [0.15, 0.19, 0],
    [0.185, 0.11, 0.12], [0.185, 0.19, -0.06], [0.21, 0.11, 0],
    [0.21, 0.15, -0.12], [0.21, 0.19, 0.08], [0.17, 0.13, 0.04], [0.19, 0.17, -0.1],
  ].map(([w, h, tilt]) => ({ w, h, tilt, lash: 0 })),
  { w: 0.18, h: 0.15, tilt: 0, lash: 0, ring: 0.4 },
  { w: 0.16, h: 0.12, tilt: 0.06, lash: 0, hood: 0.6 },
  { w: 0.2, h: 0.16, tilt: 0, lash: 0.5 },
  { w: 0.19, h: 0.14, tilt: 0.05, lash: 0.4, liner: 0.7 },
  { w: 0.17, h: 0.16, tilt: -0.04, lash: 0, ring: 0.7 },
  { w: 0.15, h: 0.1, tilt: 0.14, lash: 0 },
  { w: 0.22, h: 0.13, tilt: 0, lash: 0 },
  { w: 0.14, h: 0.14, tilt: 0, lash: 0 },
  { w: 0.2, h: 0.12, tilt: -0.14, lash: 0, hood: 0.5 },
  { w: 0.18, h: 0.18, tilt: 0.06, lash: 0.8 },
];

// --- 25 nez -----------------------------------------------------------------

const NOSE_SHAPES = [
  // Droit et court : deux traits, l'arête et la base.
  (ctx, r, x, y) => {
    ctx.moveTo(x - r * 0.02, y);
    ctx.lineTo(x + r * 0.08, y + r * 0.2);
    ctx.quadraticCurveTo(x + r * 0.01, y + r * 0.25, x - r * 0.09, y + r * 0.21);
  },
  // Busqué : une bosse sur l'arête.
  (ctx, r, x, y) => {
    ctx.moveTo(x - r * 0.03, y - r * 0.02);
    ctx.quadraticCurveTo(x + r * 0.19, y + r * 0.08, x + r * 0.1, y + r * 0.23);
    ctx.quadraticCurveTo(x + r * 0.01, y + r * 0.27, x - r * 0.1, y + r * 0.22);
  },
  // Rond, en patate. Rempli, pas seulement tracé.
  (ctx, r, x, y) => {
    ctx.moveTo(x + r * 0.12, y + r * 0.16);
    ctx.ellipse(x, y + r * 0.16, r * 0.12, r * 0.11, 0, 0, Math.PI * 2);
  },
  // Retroussé : la pointe remonte.
  (ctx, r, x, y) => {
    ctx.moveTo(x - r * 0.01, y + r * 0.02);
    ctx.quadraticCurveTo(x + r * 0.13, y + r * 0.14, x + r * 0.03, y + r * 0.19);
    ctx.quadraticCurveTo(x - r * 0.07, y + r * 0.16, x - r * 0.08, y + r * 0.2);
  },
  // Épaté, large à la base.
  (ctx, r, x, y) => {
    ctx.moveTo(x - r * 0.15, y + r * 0.19);
    ctx.quadraticCurveTo(x, y + r * 0.28, x + r * 0.15, y + r * 0.19);
    ctx.quadraticCurveTo(x + r * 0.07, y + r * 0.04, x, y + r * 0.03);
  },
  // Pointu, fin, un peu sec.
  (ctx, r, x, y) => {
    ctx.moveTo(x - r * 0.01, y - r * 0.02);
    ctx.lineTo(x + r * 0.11, y + r * 0.21);
    ctx.lineTo(x - r * 0.04, y + r * 0.2);
  },
  // Fort : la grosse cloison à la française.
  (ctx, r, x, y) => {
    ctx.moveTo(x - r * 0.04, y - r * 0.04);
    ctx.quadraticCurveTo(x + r * 0.17, y + r * 0.06, x + r * 0.16, y + r * 0.22);
    ctx.quadraticCurveTo(x + r * 0.06, y + r * 0.29, x - r * 0.11, y + r * 0.24);
  },
  // Cassé, légèrement de travers.
  (ctx, r, x, y) => {
    ctx.moveTo(x - r * 0.02, y);
    ctx.lineTo(x + r * 0.13, y + r * 0.08);
    ctx.lineTo(x + r * 0.04, y + r * 0.23);
    ctx.quadraticCurveTo(x - r * 0.05, y + r * 0.26, x - r * 0.11, y + r * 0.21);
  },
  // Petit bouton : les enfants, surtout.
  (ctx, r, x, y) => {
    ctx.moveTo(x + r * 0.09, y + r * 0.15);
    ctx.ellipse(x, y + r * 0.15, r * 0.09, r * 0.08, 0, 0, Math.PI * 2);
  },
];

function noseEntry(shape, s = 1) {
  return {
    draw: (ctx, r, x, y) => NOSE_SHAPES[shape](ctx, r * s, x, y),
    filled: shape === 2 || shape === 8,
  };
}

export const NOSES = [
  ...NOSE_SHAPES.map((_, i) => noseEntry(i)),
  ...[[0, 0.85], [0, 1.15], [1, 0.85], [1, 1.2], [2, 0.8], [2, 1.25], [3, 1.2],
    [4, 0.85], [4, 1.2], [5, 1.15], [6, 0.85], [6, 1.15], [7, 1.15], [8, 1.25],
    [3, 0.85], [5, 0.85]].map(([i, s]) => noseEntry(i, s)),
];

// --- 40 bouches -------------------------------------------------------------
//
// Une bouche = une largeur, une épaisseur de lèvre, un pli en coin, et
// éventuellement une lèvre inférieure. La courbe, elle, vient de l'émotion.

const HAND_MOUTHS = [
  { w: 0.28, lw: 0.145, lower: 0 },                 // ordinaire
  { w: 0.22, lw: 0.13, lower: 0 },                  // petite
  { w: 0.35, lw: 0.15, lower: 0 },                  // large
  { w: 0.27, lw: 0.11, lower: 0 },                  // fine
  { w: 0.26, lw: 0.16, lower: 0.9, full: true },    // lèvres pleines
  { w: 0.3, lw: 0.13, lower: 0.5, full: true },     // lèvres dessinées
  { w: 0.23, lw: 0.2, lower: 0 },                   // boudeuse
  { w: 0.32, lw: 0.12, lower: 0, wry: 0.35 },       // en coin, ironique
  { w: 0.2, lw: 0.14, lower: 0, wry: -0.3 },        // pincée
];

const GEN_MOUTHS = [];
for (const w of [0.2, 0.26, 0.32]) {
  for (const lw of [0.11, 0.15, 0.19]) {
    for (const wry of [-0.25, 0, 0.3]) {
      GEN_MOUTHS.push({ w, lw, lower: 0, wry });
    }
  }
}
for (const lower of [0.35, 0.55, 0.75]) {
  for (const w of [0.24, 0.3]) GEN_MOUTHS.push({ w, lw: 0.15, lower, full: true });
}

export const MOUTHS = [...HAND_MOUTHS, ...GEN_MOUTHS].slice(0, 40);

// --- 50 coiffures -----------------------------------------------------------
//
// Une coiffure est une fonction qui trace sa masse ; le remplissage et
// l'encrage sont faits par l'appelant. Dix-huit coiffures sont dessinées à
// la main, le reste est décliné de gabarits (longueurs, volumes, boucles,
// piques). La calvitie complète est une coiffure comme une autre : elle ne
// trace rien.

const HAIR_LIST = [];
const BEHIND = new Set();
function addHair(fn, behind = false) {
  if (behind) BEHIND.add(HAIR_LIST.length);
  HAIR_LIST.push(fn);
}

// 0 — court, dégradé net.
addHair((ctx, r) => {
  ctx.moveTo(-r * 1.0, -r * 0.2);
  ctx.quadraticCurveTo(-r * 1.05, -r * 1.15, 0, -r * 1.18);
  ctx.quadraticCurveTo(r * 1.05, -r * 1.15, r * 1.0, -r * 0.2);
  ctx.quadraticCurveTo(r * 0.7, -r * 0.55, r * 0.2, -r * 0.5);
  ctx.quadraticCurveTo(-r * 0.6, -r * 0.45, -r * 1.0, -r * 0.2);
  ctx.closePath();
});
// 1 — carré au menton, avec frange.
addHair((ctx, r) => {
  ctx.moveTo(-r * 1.1, r * 0.55);
  ctx.quadraticCurveTo(-r * 1.18, -r * 1.2, 0, -r * 1.2);
  ctx.quadraticCurveTo(r * 1.18, -r * 1.2, r * 1.1, r * 0.55);
  ctx.lineTo(r * 0.72, r * 0.5);
  ctx.quadraticCurveTo(r * 0.88, -r * 0.42, 0, -r * 0.56);
  ctx.quadraticCurveTo(-r * 0.88, -r * 0.42, -r * 0.72, r * 0.5);
  ctx.closePath();
});
// 2 — chignon haut.
addHair((ctx, r) => {
  ctx.moveTo(-r * 1.0, -r * 0.25);
  ctx.quadraticCurveTo(-r * 1.05, -r * 1.15, 0, -r * 1.15);
  ctx.quadraticCurveTo(r * 1.05, -r * 1.15, r * 1.0, -r * 0.25);
  ctx.quadraticCurveTo(0, -r * 0.62, -r * 1.0, -r * 0.25);
  ctx.closePath();
  ctx.moveTo(r * 0.15 + r * 0.44, -r * 1.38);
  ctx.arc(r * 0.15, -r * 1.38, r * 0.44, 0, Math.PI * 2);
});
// 3 — afro, en grappes serrées.
addHair((ctx, r) => {
  for (let i = 0; i < 11; i++) {
    const a = Math.PI * 1.02 + (i / 10) * Math.PI * 0.96;
    const cx = Math.cos(a) * r * 0.92;
    const cy = Math.sin(a) * r * 1.02;
    ctx.moveTo(cx + r * 0.4, cy);
    ctx.arc(cx, cy, r * 0.4, 0, Math.PI * 2);
  }
  ctx.moveTo(0 + r * 0.5, -r * 0.72);
  ctx.arc(0, -r * 0.72, r * 0.5, 0, Math.PI * 2);
});
// 4 — longs, jusqu'aux épaules.
addHair((ctx, r) => {
  ctx.moveTo(-r * 1.12, r * 1.4);
  ctx.quadraticCurveTo(-r * 1.28, -r * 1.2, 0, -r * 1.2);
  ctx.quadraticCurveTo(r * 1.28, -r * 1.2, r * 1.12, r * 1.4);
  ctx.lineTo(r * 0.74, r * 1.34);
  ctx.quadraticCurveTo(r * 0.92, -r * 0.5, 0, -r * 0.6);
  ctx.quadraticCurveTo(-r * 0.92, -r * 0.5, -r * 0.74, r * 1.34);
  ctx.closePath();
}, true);
// 5 — dégarni : deux golfes bien marqués.
addHair((ctx, r) => {
  ctx.moveTo(-r * 1.0, -r * 0.1);
  ctx.quadraticCurveTo(-r * 1.0, -r * 0.8, -r * 0.45, -r * 0.78);
  ctx.quadraticCurveTo(-r * 0.1, -r * 0.72, 0, -r * 0.95);
  ctx.quadraticCurveTo(r * 0.1, -r * 0.72, r * 0.45, -r * 0.78);
  ctx.quadraticCurveTo(r * 1.0, -r * 0.8, r * 1.0, -r * 0.1);
  ctx.quadraticCurveTo(r * 0.6, -r * 0.5, 0, -r * 0.5);
  ctx.quadraticCurveTo(-r * 0.6, -r * 0.5, -r * 1.0, -r * 0.1);
  ctx.closePath();
});
// 6 — banane gominée.
addHair((ctx, r) => {
  ctx.moveTo(-r * 1.0, -r * 0.2);
  ctx.quadraticCurveTo(-r * 1.1, -r * 1.1, -r * 0.2, -r * 1.15);
  ctx.quadraticCurveTo(r * 0.5, -r * 1.95, r * 0.95, -r * 1.15);
  ctx.quadraticCurveTo(r * 1.05, -r * 0.6, r * 1.0, -r * 0.2);
  ctx.quadraticCurveTo(0, -r * 0.6, -r * 1.0, -r * 0.2);
  ctx.closePath();
});
// 7 — queue de cheval.
addHair((ctx, r) => {
  ctx.moveTo(-r * 1.02, -r * 0.22);
  ctx.quadraticCurveTo(-r * 1.08, -r * 1.16, 0, -r * 1.16);
  ctx.quadraticCurveTo(r * 1.08, -r * 1.16, r * 1.02, -r * 0.22);
  ctx.quadraticCurveTo(0, -r * 0.68, -r * 1.02, -r * 0.22);
  ctx.closePath();
  ctx.moveTo(-r * 0.9, -r * 0.6);
  ctx.quadraticCurveTo(-r * 1.6, -r * 0.5, -r * 1.5, r * 0.5);
  ctx.quadraticCurveTo(-r * 1.42, r * 1.0, -r * 1.1, r * 0.9);
  ctx.quadraticCurveTo(-r * 1.16, r * 0.1, -r * 0.72, -r * 0.36);
  ctx.closePath();
});
// 8 — couettes.
addHair((ctx, r) => {
  ctx.moveTo(-r * 1.04, -r * 0.2);
  ctx.quadraticCurveTo(-r * 1.1, -r * 1.18, 0, -r * 1.18);
  ctx.quadraticCurveTo(r * 1.1, -r * 1.18, r * 1.04, -r * 0.2);
  ctx.quadraticCurveTo(0, -r * 0.6, -r * 1.04, -r * 0.2);
  ctx.closePath();
  for (const side of [-1, 1]) {
    ctx.moveTo(side * r * 1.34, -r * 0.3);
    ctx.ellipse(side * r * 1.2, -r * 0.34, r * 0.36, r * 0.5, side * 0.4, 0, Math.PI * 2);
  }
});
// 9 — bouclé volumineux, mi-long.
addHair((ctx, r) => {
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * 0.98 + (i / 8) * Math.PI * 1.04;
    const cx = Math.cos(a) * r * 1.0;
    const cy = Math.sin(a) * r * 0.95 - r * 0.1;
    ctx.moveTo(cx + r * 0.34, cy);
    ctx.arc(cx, cy, r * 0.34, 0, Math.PI * 2);
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const cy = r * (0.1 + i * 0.34);
      ctx.moveTo(side * r * 1.06 + r * 0.3, cy);
      ctx.arc(side * r * 1.06, cy, r * 0.3, 0, Math.PI * 2);
    }
  }
}, true);
// 10 — rasé sur les côtés, touffe sur le dessus.
addHair((ctx, r) => {
  ctx.moveTo(-r * 0.98, -r * 0.32);
  ctx.quadraticCurveTo(-r * 1.02, -r * 0.92, -r * 0.5, -r * 1.02);
  ctx.quadraticCurveTo(0, -r * 1.32, r * 0.72, -r * 1.0);
  ctx.quadraticCurveTo(r * 1.02, -r * 0.86, r * 0.98, -r * 0.32);
  ctx.quadraticCurveTo(r * 0.6, -r * 0.66, 0, -r * 0.66);
  ctx.quadraticCurveTo(-r * 0.6, -r * 0.66, -r * 0.98, -r * 0.32);
  ctx.closePath();
});
// 11 — tresses collées, retombant derrière les oreilles.
addHair((ctx, r) => {
  ctx.moveTo(-r * 1.02, -r * 0.24);
  ctx.quadraticCurveTo(-r * 1.08, -r * 1.14, 0, -r * 1.14);
  ctx.quadraticCurveTo(r * 1.08, -r * 1.14, r * 1.02, -r * 0.24);
  ctx.quadraticCurveTo(0, -r * 0.66, -r * 1.02, -r * 0.24);
  ctx.closePath();
  for (const side of [-1, 1]) {
    for (let i = 0; i < 2; i++) {
      const x = side * r * (0.72 + i * 0.16);
      capsulePath(ctx, x, -r * 0.72, side * r * (1.06 + i * 0.1), r * (0.5 + i * 0.24),
        r * 0.11, r * 0.09);
    }
  }
}, true);
// 12 — mulet : court devant, long derrière.
addHair((ctx, r) => {
  ctx.moveTo(-r * 1.02, -r * 0.24);
  ctx.quadraticCurveTo(-r * 1.1, -r * 1.16, 0, -r * 1.18);
  ctx.quadraticCurveTo(r * 1.1, -r * 1.14, r * 1.0, -r * 0.28);
  ctx.quadraticCurveTo(r * 0.66, -r * 0.62, r * 0.24, -r * 0.56);
  ctx.quadraticCurveTo(-r * 0.4, -r * 0.5, -r * 0.84, -r * 0.3);
  ctx.quadraticCurveTo(-r * 1.0, r * 0.5, -r * 1.34, r * 1.0);
  ctx.quadraticCurveTo(-r * 0.9, r * 1.1, -r * 0.74, r * 0.6);
  ctx.quadraticCurveTo(-r * 0.94, r * 0.1, -r * 1.02, -r * 0.24);
  ctx.closePath();
}, true);
// 13 — plaqué en arrière.
addHair((ctx, r) => {
  ctx.moveTo(-r * 1.0, -r * 0.28);
  ctx.quadraticCurveTo(-r * 1.06, -r * 1.12, 0, -r * 1.12);
  ctx.quadraticCurveTo(r * 1.06, -r * 1.12, r * 1.0, -r * 0.28);
  ctx.quadraticCurveTo(r * 0.5, -r * 0.88, -r * 0.2, -r * 0.86);
  ctx.quadraticCurveTo(-r * 0.72, -r * 0.84, -r * 1.0, -r * 0.28);
  ctx.closePath();
});
// 14 — frange épaisse et droite.
addHair((ctx, r) => {
  ctx.moveTo(-r * 1.06, -r * 0.1);
  ctx.quadraticCurveTo(-r * 1.14, -r * 1.18, 0, -r * 1.18);
  ctx.quadraticCurveTo(r * 1.14, -r * 1.18, r * 1.06, -r * 0.1);
  ctx.lineTo(r * 1.0, -r * 0.38);
  ctx.lineTo(-r * 1.0, -r * 0.38);
  ctx.closePath();
  ctx.moveTo(-r * 1.06, -r * 0.4);
  ctx.lineTo(r * 1.06, -r * 0.4);
  ctx.lineTo(r * 1.0, -r * 0.62);
  ctx.lineTo(-r * 1.0, -r * 0.62);
  ctx.closePath();
});
// 15 — dreads mi-longues, sur les côtés.
addHair((ctx, r) => {
  ctx.moveTo(-r * 1.02, -r * 0.3);
  ctx.quadraticCurveTo(-r * 1.08, -r * 1.16, 0, -r * 1.16);
  ctx.quadraticCurveTo(r * 1.08, -r * 1.16, r * 1.02, -r * 0.3);
  ctx.quadraticCurveTo(0, -r * 0.7, -r * 1.02, -r * 0.3);
  ctx.closePath();
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const x = side * r * (0.74 + i * 0.13);
      const y = -r * (0.62 - i * 0.24);
      capsulePath(ctx, x, y, x * 1.2, y + r * (0.9 + (i % 2) * 0.3), r * 0.13, r * 0.11);
    }
  }
}, true);
// 16 — en bataille, mèches pointues.
addHair((ctx, r) => {
  ctx.moveTo(-r * 1.02, -r * 0.2);
  for (let i = 0; i <= 6; i++) {
    const x = -r * 1.0 + (i / 6) * r * 2.0;
    const up = -r * (1.1 + ((i * 7) % 5) * 0.09);
    ctx.lineTo(x + r * 0.1, up);
    ctx.lineTo(x + r * 0.24, -r * 0.94);
  }
  ctx.lineTo(r * 1.02, -r * 0.2);
  ctx.quadraticCurveTo(0, -r * 0.62, -r * 1.02, -r * 0.2);
  ctx.closePath();
});
// 17 — mèche sur le côté, coupe nette.
addHair((ctx, r) => {
  ctx.moveTo(-r * 1.04, -r * 0.16);
  ctx.quadraticCurveTo(-r * 1.12, -r * 1.18, 0, -r * 1.18);
  ctx.quadraticCurveTo(r * 1.12, -r * 1.18, r * 1.04, -r * 0.16);
  ctx.quadraticCurveTo(r * 0.9, -r * 0.5, r * 0.4, -r * 0.56);
  ctx.quadraticCurveTo(-r * 0.4, -r * 0.66, -r * 0.86, -r * 0.86);
  ctx.quadraticCurveTo(-r * 1.0, -r * 0.6, -r * 1.04, -r * 0.16);
  ctx.closePath();
});

// 18-23 — six coupes courtes déclinées (hauteur de calotte, cran).
const genCourt = (top, notch) => (ctx, r) => {
  ctx.moveTo(-r * 1.0, -r * 0.2);
  ctx.quadraticCurveTo(-r * 1.06, -r * top, -r * 0.2, -r * top);
  if (notch > 0) ctx.lineTo(-r * 0.05, -r * (top - notch));
  ctx.quadraticCurveTo(r * 1.06, -r * top, r * 1.0, -r * 0.2);
  ctx.quadraticCurveTo(r * 0.55, -r * (0.48 - notch * 0.5), 0, -r * 0.5);
  ctx.quadraticCurveTo(-r * 0.55, -r * 0.46, -r * 1.0, -r * 0.2);
  ctx.closePath();
};
for (const [top, notch] of [[1.12, 0], [1.22, 0.06], [1.3, 0.1], [1.16, 0.03], [1.26, 0], [1.36, 0.08]]) {
  addHair(genCourt(top, notch));
}

// 24-31 — huit longueurs (mi-long au très long), avec ou sans frange.
const genLong = (len, vol, fringe) => (ctx, r) => {
  ctx.moveTo(-r * vol, r * len);
  ctx.quadraticCurveTo(-r * (vol + 0.16), -r * 1.2, 0, -r * 1.2);
  ctx.quadraticCurveTo(r * (vol + 0.16), -r * 1.2, r * vol, r * len);
  ctx.lineTo(r * (vol - 0.36), r * (len - 0.06));
  if (fringe) {
    ctx.quadraticCurveTo(r * 0.9, -r * 0.44, 0, -r * 0.52);
    ctx.quadraticCurveTo(-r * 0.9, -r * 0.44, -r * (vol - 0.36), r * (len - 0.06));
  } else {
    ctx.quadraticCurveTo(r * 0.88, -r * 0.6, 0, -r * 0.72);
    ctx.quadraticCurveTo(-r * 0.88, -r * 0.6, -r * (vol - 0.36), r * (len - 0.06));
  }
  ctx.closePath();
};
for (const [len, vol, fringe] of [[0.2, 1.06, true], [0.5, 1.1, false], [0.8, 1.12, true],
  [1.1, 1.14, false], [1.5, 1.16, true], [1.8, 1.2, false], [0.9, 1.3, true], [1.4, 1.34, false]]) {
  addHair(genLong(len, vol, fringe), len > 0.6);
}

// 32-39 — huit boucles (nombre, rayon, retombées).
const genCurly = (n, rad, sideLen) => (ctx, r) => {
  for (let i = 0; i < n; i++) {
    const a = Math.PI * 1.0 + (i / (n - 1)) * Math.PI;
    const cx = Math.cos(a) * r * 0.95;
    const cy = Math.sin(a) * r * 0.98 - r * 0.05;
    ctx.moveTo(cx + r * rad, cy);
    ctx.arc(cx, cy, r * rad, 0, Math.PI * 2);
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < sideLen; i++) {
      const cy = r * (0.14 + i * 0.32);
      ctx.moveTo(side * r * 1.02 + r * rad * 0.85, cy);
      ctx.arc(side * r * 1.02, cy, r * rad * 0.85, 0, Math.PI * 2);
    }
  }
};
for (const [n, rad, sideLen] of [[8, 0.3, 0], [10, 0.34, 0], [7, 0.42, 0], [9, 0.3, 1],
  [8, 0.36, 2], [10, 0.3, 3], [7, 0.46, 1], [9, 0.4, 2]]) {
  addHair(genCurly(n, rad, sideLen), sideLen >= 2);
}

// 40-44 — cinq attachés : chignon bas, double chignon, serré haut,
// couronne tressée, demi-queue.
addHair((ctx, r) => { // chignon bas
  HAIR_LIST[13](ctx, r);
  ctx.moveTo(-r * 0.7, r * 0.3);
  ctx.arc(-r * 0.95, r * 0.32, r * 0.38, 0, Math.PI * 2);
});
addHair((ctx, r) => { // double chignon
  HAIR_LIST[13](ctx, r);
  for (const side of [-1, 1]) {
    ctx.moveTo(side * r * 0.6 + r * 0.3, -r * 1.28);
    ctx.arc(side * r * 0.6, -r * 1.28, r * 0.3, 0, Math.PI * 2);
  }
});
addHair((ctx, r) => { // serré haut
  HAIR_LIST[13](ctx, r);
  ctx.moveTo(r * 0.05 + r * 0.3, -r * 1.42);
  ctx.ellipse(r * 0.05, -r * 1.42, r * 0.3, r * 0.4, 0.2, 0, Math.PI * 2);
});
addHair((ctx, r) => { // couronne tressée
  HAIR_LIST[13](ctx, r);
  for (let i = 0; i < 6; i++) {
    const x = -r * 0.85 + (i / 5) * r * 1.7;
    ctx.moveTo(x + r * 0.15, -r * (0.98 - Math.abs(x) / r * 0.28));
    ctx.arc(x, -r * (0.98 - Math.abs(x) / r * 0.28), r * 0.15, 0, Math.PI * 2);
  }
});
addHair((ctx, r) => { // demi-queue
  HAIR_LIST[0](ctx, r);
  ctx.moveTo(-r * 0.8, -r * 0.5);
  ctx.quadraticCurveTo(-r * 1.5, -r * 0.2, -r * 1.3, r * 0.7);
  ctx.quadraticCurveTo(-r * 1.1, r * 0.85, -r * 0.95, r * 0.6);
  ctx.quadraticCurveTo(-r * 1.05, -r * 0.1, -r * 0.7, -r * 0.4);
  ctx.closePath();
}, true);

// 45-48 — quatre coupes en piques (crête comprise).
const genSpiky = (teeth, height) => (ctx, r) => {
  ctx.moveTo(-r * 1.0, -r * 0.24);
  for (let i = 0; i <= teeth; i++) {
    const x = -r * 0.95 + (i / teeth) * r * 1.9;
    ctx.lineTo(x + r * 0.08, -r * (height + ((i * 5) % 3) * 0.07));
    ctx.lineTo(x + r * 0.2, -r * 0.96);
  }
  ctx.lineTo(r * 1.0, -r * 0.24);
  ctx.quadraticCurveTo(0, -r * 0.6, -r * 1.0, -r * 0.24);
  ctx.closePath();
};
addHair(genSpiky(5, 1.2));
addHair(genSpiky(7, 1.3));
addHair(genSpiky(4, 1.45));
addHair((ctx, r) => { // crête
  ctx.moveTo(-r * 0.2, -r * 0.7);
  for (let i = 0; i <= 4; i++) {
    const x = -r * 0.16 + (i / 4) * r * 0.5;
    ctx.lineTo(x, -r * 1.7);
    ctx.lineTo(x + r * 0.1, -r * 0.75);
  }
  ctx.quadraticCurveTo(r * 0.1, -r * 0.7, -r * 0.2, -r * 0.7);
  ctx.closePath();
});

// 49 — chauve : la coiffure qui ne trace rien.
addHair(() => {});
const BALD = HAIR_LIST.length - 1;

export const HAIR = HAIR_LIST;
export const HAIR_BEHIND = BEHIND;

// --- 30 barbes et moustaches ------------------------------------------------
//
// Sept pilosités dessinées à la main, puis vingt-trois combinaisons
// moustache × barbe assemblées de pièces. L'index 0 est « rasé de près ».

const BEARD_LIST = [null];
const COVERS = new Set();
function addBeard(draw, { faded = false, covers = false } = {}) {
  if (covers) COVERS.add(BEARD_LIST.length);
  BEARD_LIST.push({ draw, faded });
}

// 1 — collier taillé, s'arrête sous la bouche.
addBeard((ctx, r) => {
  ctx.moveTo(-r * 0.88, r * 0.02);
  ctx.quadraticCurveTo(-r * 0.8, r * 1.2, 0, r * 1.24);
  ctx.quadraticCurveTo(r * 0.8, r * 1.2, r * 0.88, r * 0.02);
  ctx.quadraticCurveTo(r * 0.66, r * 0.66, 0, r * 0.74);
  ctx.quadraticCurveTo(-r * 0.66, r * 0.66, -r * 0.88, r * 0.02);
  ctx.closePath();
});
// 2 — barbe pleine et longue.
addBeard((ctx, r) => {
  ctx.moveTo(-r * 0.94, -r * 0.1);
  ctx.quadraticCurveTo(-r * 0.98, r * 1.5, 0, r * 1.7);
  ctx.quadraticCurveTo(r * 0.98, r * 1.5, r * 0.94, -r * 0.1);
  ctx.quadraticCurveTo(r * 0.6, r * 0.5, 0, r * 0.56);
  ctx.quadraticCurveTo(-r * 0.6, r * 0.5, -r * 0.94, -r * 0.1);
  ctx.closePath();
}, { covers: true });
// 3 — bouc et moustache.
addBeard((ctx, r) => {
  ctx.moveTo(-r * 0.34, r * 0.36);
  ctx.quadraticCurveTo(0, r * 0.24, r * 0.34, r * 0.36);
  ctx.quadraticCurveTo(r * 0.44, r * 1.02, 0, r * 1.14);
  ctx.quadraticCurveTo(-r * 0.44, r * 1.02, -r * 0.34, r * 0.36);
  ctx.closePath();
}, { covers: true });
// 4 — moustache seule, large.
addBeard((ctx, r) => {
  ctx.moveTo(-r * 0.5, r * 0.3);
  ctx.quadraticCurveTo(0, r * 0.14, r * 0.5, r * 0.3);
  ctx.quadraticCurveTo(r * 0.4, r * 0.5, 0, r * 0.44);
  ctx.quadraticCurveTo(-r * 0.4, r * 0.5, -r * 0.5, r * 0.3);
  ctx.closePath();
}, { covers: true });
// 5 — moustache fine à la gauloise, qui redescend.
addBeard((ctx, r) => {
  ctx.moveTo(-r * 0.46, r * 0.28);
  ctx.quadraticCurveTo(0, r * 0.16, r * 0.46, r * 0.28);
  ctx.quadraticCurveTo(r * 0.52, r * 0.78, r * 0.38, r * 0.82);
  ctx.quadraticCurveTo(r * 0.3, r * 0.44, 0, r * 0.38);
  ctx.quadraticCurveTo(-r * 0.3, r * 0.44, -r * 0.38, r * 0.82);
  ctx.quadraticCurveTo(-r * 0.52, r * 0.78, -r * 0.46, r * 0.28);
  ctx.closePath();
}, { covers: true });
// 6 — barbe de trois jours : le même contour, mais estompé.
addBeard((ctx, r) => {
  ctx.moveTo(-r * 0.86, r * 0.08);
  ctx.quadraticCurveTo(-r * 0.78, r * 0.98, 0, r * 1.06);
  ctx.quadraticCurveTo(r * 0.78, r * 0.98, r * 0.86, r * 0.08);
  ctx.quadraticCurveTo(r * 0.6, r * 0.56, 0, r * 0.62);
  ctx.quadraticCurveTo(-r * 0.6, r * 0.56, -r * 0.86, r * 0.08);
  ctx.closePath();
}, { faded: true });
// 7 — favoris seuls, façon vieux monsieur.
addBeard((ctx, r) => {
  for (const side of [-1, 1]) {
    ctx.moveTo(side * r * 0.94, -r * 0.28);
    ctx.quadraticCurveTo(side * r * 1.02, r * 0.5, side * r * 0.66, r * 0.62);
    ctx.quadraticCurveTo(side * r * 0.72, r * 0.05, side * r * 0.78, -r * 0.28);
    ctx.closePath();
  }
});

// Les pièces des vingt-trois combinaisons.
const MOUS = {
  fine: (ctx, r) => {
    ctx.moveTo(-r * 0.42, r * 0.26);
    ctx.quadraticCurveTo(0, r * 0.16, r * 0.42, r * 0.26);
    ctx.quadraticCurveTo(r * 0.34, r * 0.36, 0, r * 0.3);
    ctx.quadraticCurveTo(-r * 0.34, r * 0.36, -r * 0.42, r * 0.26);
    ctx.closePath();
  },
  large: (ctx, r) => {
    ctx.moveTo(-r * 0.52, r * 0.3);
    ctx.quadraticCurveTo(0, r * 0.12, r * 0.52, r * 0.3);
    ctx.quadraticCurveTo(r * 0.42, r * 0.52, 0, r * 0.44);
    ctx.quadraticCurveTo(-r * 0.42, r * 0.52, -r * 0.52, r * 0.3);
    ctx.closePath();
  },
  chevron: (ctx, r) => {
    ctx.moveTo(-r * 0.46, r * 0.36);
    ctx.lineTo(0, r * 0.2);
    ctx.lineTo(r * 0.46, r * 0.36);
    ctx.lineTo(r * 0.38, r * 0.46);
    ctx.lineTo(0, r * 0.32);
    ctx.lineTo(-r * 0.38, r * 0.46);
    ctx.closePath();
  },
  crayon: (ctx, r) => {
    ctx.moveTo(-r * 0.34, r * 0.3);
    ctx.quadraticCurveTo(0, r * 0.24, r * 0.34, r * 0.3);
    ctx.quadraticCurveTo(0, r * 0.36, -r * 0.34, r * 0.3);
    ctx.closePath();
  },
};
const BARBE = {
  bouc: (ctx, r) => {
    ctx.moveTo(-r * 0.3, r * 0.6);
    ctx.quadraticCurveTo(0, r * 0.52, r * 0.3, r * 0.6);
    ctx.quadraticCurveTo(r * 0.36, r * 1.06, 0, r * 1.16);
    ctx.quadraticCurveTo(-r * 0.36, r * 1.06, -r * 0.3, r * 0.6);
    ctx.closePath();
  },
  collier: (ctx, r) => BEARD_LIST[1].draw(ctx, r),
  courte: (ctx, r) => {
    ctx.moveTo(-r * 0.88, r * 0.04);
    ctx.quadraticCurveTo(-r * 0.8, r * 1.08, 0, r * 1.14);
    ctx.quadraticCurveTo(r * 0.8, r * 1.08, r * 0.88, r * 0.04);
    ctx.quadraticCurveTo(r * 0.62, r * 0.6, 0, r * 0.68);
    ctx.quadraticCurveTo(-r * 0.62, r * 0.6, -r * 0.88, r * 0.04);
    ctx.closePath();
  },
  pleine: (len) => (ctx, r) => {
    ctx.moveTo(-r * 0.94, -r * 0.08);
    ctx.quadraticCurveTo(-r * 0.98, r * len, 0, r * (len + 0.2));
    ctx.quadraticCurveTo(r * 0.98, r * len, r * 0.94, -r * 0.08);
    ctx.quadraticCurveTo(r * 0.6, r * 0.52, 0, r * 0.58);
    ctx.quadraticCurveTo(-r * 0.6, r * 0.52, -r * 0.94, -r * 0.08);
    ctx.closePath();
  },
  favoris: (ctx, r) => BEARD_LIST[7].draw(ctx, r),
  mouche: (ctx, r) => {
    ctx.moveTo(r * 0.08, r * 0.6);
    ctx.ellipse(0, r * 0.62, r * 0.09, r * 0.07, 0, 0, Math.PI * 2);
  },
};

const COMBOS = [
  ['fine', null], ['large', null], ['chevron', null], ['crayon', null],
  ['fine', 'bouc'], ['large', 'bouc'], ['chevron', 'bouc'], [null, 'bouc'],
  ['fine', 'collier'], ['large', 'collier'], ['crayon', 'collier'],
  ['fine', 'courte'], ['large', 'courte'], ['chevron', 'courte'], [null, 'courte'],
  [null, 'mouche'], ['fine', 'mouche'],
  ['large', 'pleine', 1.3], ['fine', 'pleine', 1.5], ['chevron', 'pleine', 1.2],
  [null, 'pleine', 1.9], ['large', 'favoris'], ['fine', 'favoris'],
];
for (const [m, b, len] of COMBOS) {
  const barbe = b === 'pleine' ? BARBE.pleine(len) : (b ? BARBE[b] : null);
  addBeard((ctx, r) => {
    if (m) MOUS[m](ctx, r);
    if (barbe) barbe(ctx, r);
  }, { covers: m !== null || b === 'pleine' });
}

export const BEARDS = BEARD_LIST;
export const BEARD_COVERS_MOUTH = COVERS;
/** Les barbes longues, à réserver aux visages d'un certain âge. */
const LONG_BEARDS = [2, ...BEARD_LIST.map((e, i) => i).filter((i) => i >= 25 && i <= 28)];

// --- Lunettes ---------------------------------------------------------------
//
// Les lunettes comptent parmi les 60 accessoires de la planche, mais elles
// vivent sur leur propre emplacement du visage : on peut porter des
// lunettes ET une écharpe.

export const GLASSES = [
  { kind: 'ronde' },
  { kind: 'carree' },
  { kind: 'fine' },
  { kind: 'demi' },              // les lunettes de lecture, sur le nez
  { kind: 'papillon' },
  { kind: 'carree', sun: true },
  { kind: 'aviateur', sun: true },
  { kind: 'ronde', sun: true },
];

// --- Couvre-chefs -----------------------------------------------------------

export const HATS = [
  // 0 — casquette à visière.
  (ctx, r, color, silhouette) => {
    solid(ctx, () => {
      ctx.moveTo(-r * 1.02, -r * 0.42);
      ctx.quadraticCurveTo(-r * 1.1, -r * 1.38, 0, -r * 1.38);
      ctx.quadraticCurveTo(r * 1.1, -r * 1.38, r * 1.02, -r * 0.42);
      ctx.closePath();
    }, silhouette ? INK : color, !silhouette, LINE * 0.95);
    solid(ctx, () => {
      ctx.moveTo(-r * 1.05, -r * 0.44);
      ctx.quadraticCurveTo(-r * 1.95, -r * 0.5, -r * 2.0, -r * 0.74);
      ctx.quadraticCurveTo(-r * 1.5, -r * 0.88, -r * 1.0, -r * 0.64);
      ctx.closePath();
    }, silhouette ? INK : shade(color, -0.24), !silhouette, LINE * 0.95);
  },
  // 1 — bonnet, avec revers.
  (ctx, r, color, silhouette) => {
    solid(ctx, () => {
      ctx.moveTo(-r * 1.06, -r * 0.32);
      ctx.quadraticCurveTo(-r * 1.14, -r * 1.5, 0, -r * 1.5);
      ctx.quadraticCurveTo(r * 1.14, -r * 1.5, r * 1.06, -r * 0.32);
      ctx.closePath();
    }, silhouette ? INK : color, !silhouette, LINE * 0.95);
    if (silhouette) return;
    solid(ctx, () => {
      roundRect(ctx, -r * 1.12, -r * 0.62, r * 2.24, r * 0.36, r * 0.12);
    }, shade(color, 0.22), true, LINE * 0.9);
  },
  // 2 — béret, penché.
  (ctx, r, color, silhouette) => {
    solid(ctx, () => {
      ctx.moveTo(-r * 1.08, -r * 0.72);
      ctx.quadraticCurveTo(-r * 1.3, -r * 1.5, -r * 0.1, -r * 1.44);
      ctx.quadraticCurveTo(r * 1.18, -r * 1.38, r * 1.06, -r * 0.76);
      ctx.quadraticCurveTo(0, -r * 0.5, -r * 1.08, -r * 0.72);
      ctx.closePath();
    }, silhouette ? INK : color, !silhouette, LINE * 0.95);
    if (silhouette) return;
    ink(ctx, LINE * 0.9);
    ctx.beginPath();
    ctx.moveTo(-r * 0.3, -r * 1.46);
    ctx.lineTo(-r * 0.34, -r * 1.66);
    ctx.stroke();
  },
  // 3 — bob.
  (ctx, r, color, silhouette) => {
    solid(ctx, () => {
      ctx.moveTo(-r * 1.0, -r * 0.6);
      ctx.quadraticCurveTo(-r * 1.06, -r * 1.42, 0, -r * 1.42);
      ctx.quadraticCurveTo(r * 1.06, -r * 1.42, r * 1.0, -r * 0.6);
      ctx.closePath();
    }, silhouette ? INK : color, !silhouette, LINE * 0.95);
    solid(ctx, () => {
      ctx.moveTo(-r * 1.5, -r * 0.6);
      ctx.quadraticCurveTo(0, -r * 0.24, r * 1.5, -r * 0.6);
      ctx.quadraticCurveTo(0, -r * 0.86, -r * 1.5, -r * 0.6);
      ctx.closePath();
    }, silhouette ? INK : shade(color, -0.16), !silhouette, LINE * 0.95);
  },
  // 4 — foulard noué.
  (ctx, r, color, silhouette) => {
    solid(ctx, () => {
      ctx.moveTo(-r * 1.04, -r * 0.38);
      ctx.quadraticCurveTo(-r * 1.12, -r * 1.3, 0, -r * 1.3);
      ctx.quadraticCurveTo(r * 1.12, -r * 1.3, r * 1.04, -r * 0.38);
      ctx.quadraticCurveTo(0, -r * 0.68, -r * 1.04, -r * 0.38);
      ctx.closePath();
    }, silhouette ? INK : color, !silhouette, LINE * 0.95);
    if (silhouette) return;
    solid(ctx, () => {
      ctx.moveTo(-r * 0.94, -r * 0.62);
      ctx.lineTo(-r * 1.5, -r * 0.34);
      ctx.lineTo(-r * 1.3, -r * 0.86);
      ctx.closePath();
    }, color, true, LINE * 0.85);
  },
  // 5 — chapeau à bord.
  (ctx, r, color, silhouette) => {
    solid(ctx, () => {
      roundRect(ctx, -r * 0.78, -r * 1.66, r * 1.56, r * 1.06, r * 0.22);
    }, silhouette ? INK : color, !silhouette, LINE * 0.95);
    solid(ctx, () => {
      ctx.moveTo(-r * 1.6, -r * 0.62);
      ctx.quadraticCurveTo(0, -r * 0.2, r * 1.6, -r * 0.62);
      ctx.quadraticCurveTo(0, -r * 0.96, -r * 1.6, -r * 0.62);
      ctx.closePath();
    }, silhouette ? INK : shade(color, -0.2), !silhouette, LINE * 0.95);
  },
  // 6 — casque de chantier.
  (ctx, r, color, silhouette) => {
    solid(ctx, () => {
      ctx.moveTo(-r * 1.06, -r * 0.5);
      ctx.quadraticCurveTo(-r * 1.12, -r * 1.44, 0, -r * 1.44);
      ctx.quadraticCurveTo(r * 1.12, -r * 1.44, r * 1.06, -r * 0.5);
      ctx.closePath();
    }, silhouette ? INK : '#e8b13f', !silhouette, LINE * 0.95);
    if (silhouette) return;
    solid(ctx, () => {
      roundRect(ctx, -r * 1.2, -r * 0.62, r * 2.4, r * 0.2, r * 0.08);
    }, '#d09a2e', true, LINE * 0.8);
  },
  // 7 — bandeau de sport.
  (ctx, r, color, silhouette) => {
    solid(ctx, () => {
      roundRect(ctx, -r * 1.04, -r * 0.9, r * 2.08, r * 0.3, r * 0.12);
    }, silhouette ? INK : color, !silhouette, LINE * 0.85);
  },
  // 8 — LA COURONNE. Très rare : une seule personne dans l'immeuble, peut-être.
  (ctx, r, color, silhouette) => {
    solid(ctx, () => {
      ctx.moveTo(-r * 0.7, -r * 0.95);
      for (let i = 0; i <= 3; i++) {
        const x = -r * 0.7 + (i / 3) * r * 1.4;
        ctx.lineTo(x, -r * 1.5);
        if (i < 3) ctx.lineTo(x + r * 0.23, -r * 1.1);
      }
      ctx.lineTo(r * 0.7, -r * 0.95);
      ctx.closePath();
    }, silhouette ? INK : '#e0b53f', !silhouette, LINE * 0.85);
    if (silhouette) return;
    ctx.fillStyle = '#c0392b';
    for (let i = 0; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(-r * 0.7 + (i / 3) * r * 1.4, -r * 1.5, r * 0.07, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  // 9 — le casque sombre, intégral. Encore plus rare. On ne pose pas de question.
  (ctx, r, color, silhouette) => {
    solid(ctx, () => {
      ctx.moveTo(-r * 1.1, r * 0.9);
      ctx.quadraticCurveTo(-r * 1.25, -r * 1.4, 0, -r * 1.4);
      ctx.quadraticCurveTo(r * 1.25, -r * 1.4, r * 1.1, r * 0.9);
      ctx.quadraticCurveTo(0, r * 1.15, -r * 1.1, r * 0.9);
      ctx.closePath();
    }, '#23262d', true, LINE);
    ctx.fillStyle = 'rgba(150,170,200,0.25)';
    ctx.beginPath();
    roundRect(ctx, -r * 0.6, -r * 0.5, r * 1.2, r * 0.45, r * 0.1);
    ctx.fill();
  },
  // 10 — le masque d'alien. Le voisin dira qu'il n'a rien vu.
  (ctx, r, color, silhouette) => {
    solid(ctx, () => {
      ctx.moveTo(-r * 1.0, -r * 0.1);
      ctx.quadraticCurveTo(-r * 1.3, -r * 1.5, 0, -r * 1.5);
      ctx.quadraticCurveTo(r * 1.3, -r * 1.5, r * 1.0, -r * 0.1);
      ctx.quadraticCurveTo(r * 0.6, r * 0.9, 0, r * 1.1);
      ctx.quadraticCurveTo(-r * 0.6, r * 0.9, -r * 1.0, -r * 0.1);
      ctx.closePath();
    }, '#8fbf6a', true, LINE);
    ctx.fillStyle = '#1c2318';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(side * r * 0.42, -r * 0.15, r * 0.3, r * 0.42, side * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  },
];

// --- 60 accessoires ---------------------------------------------------------
//
// Le catalogue complet, avec l'emplacement de chacun. Tous n'ont pas de
// dessin dédié — un stylo dans une poche ne se voit pas — mais tous
// existent et se tirent.

export const ACCESSORY_CATALOG = [
  // Couvre-chefs (11)
  ...['casquette', 'bonnet', 'beret', 'bob', 'foulard_tete', 'chapeau', 'casque_chantier',
    'bandeau', 'couronne', 'casque_sombre', 'masque_alien'].map((id) => ({ id, slot: 'tete' })),
  // Lunettes (8)
  ...['lunettes_rondes', 'lunettes_carrees', 'lunettes_fines', 'lunettes_lecture',
    'lunettes_papillon', 'soleil_carrees', 'soleil_aviateur', 'soleil_rondes']
    .map((id) => ({ id, slot: 'yeux' })),
  // Cou et torse (14)
  ...['echarpe', 'echarpe_longue', 'foulard_cou', 'cravate', 'noeud_papillon', 'collier',
    'chaine_or', 'perles', 'pendentif', 'medaillon', 'tablier', 'bretelles', 'badge', 'banane']
    .map((id) => ({ id, slot: 'torse' })),
  // Poignets et mains (7)
  ...['montre', 'montre_or', 'bracelet', 'bracelet_cuir', 'bague', 'gants', 'mitaines']
    .map((id) => ({ id, slot: 'poignet' })),
  // Oreilles (3)
  ...['boucles', 'creoles', 'piercing'].map((id) => ({ id, slot: 'oreille' })),
  // Le son (2)
  ...['casque_audio', 'ecouteurs'].map((id) => ({ id, slot: 'oreilles' })),
  // Porté sur le dos ou à la main (9)
  ...['sac_main', 'sac_dos', 'tote_bag', 'cabas', 'valisette', 'parapluie', 'canne',
    'journal', 'telephone'].map((id) => ({ id, slot: 'main' })),
  // Sur la peau (2)
  ...['tatouage_bras', 'tatouage_cou'].map((id) => ({ id, slot: 'peau' })),
  // Dans la poche, mais dans la fiche (4)
  ...['ceinture', 'ceinture_cloutee', 'broche', 'pins'].map((id) => ({ id, slot: 'divers' })),
];

// Ce qu'on peut tirer au quotidien (le métier impose le reste).
const EVERYDAY = ['aucun', 'aucun', 'aucun', 'aucun', 'aucun', 'echarpe', 'boucles',
  'creoles', 'collier', 'chaine_or', 'perles', 'pendentif', 'montre', 'montre_or',
  'bracelet', 'bretelles', 'noeud_papillon', 'banane', 'casque_audio'];

// --- Hauts ------------------------------------------------------------------
//
// Un haut reçoit la géométrie du buste et dessine ce qui va PAR-DESSUS
// l'aplat de couleur : col, boutonnage, bandes, matelassage, ceinture.

export const TOPS = [
  { id: 'tshirt', label: 'T-shirt', sleeve: 0, collar: 'rond' },
  { id: 'chemise', label: 'Chemise', sleeve: 1, collar: 'chemise', buttons: true },
  { id: 'pull', label: 'Pull col roulé', sleeve: 1, collar: 'roule' },
  { id: 'sweat', label: 'Sweat à capuche', sleeve: 1, collar: 'capuche', pocket: true },
  { id: 'veste', label: 'Veste ouverte', sleeve: 1, collar: 'revers', open: true },
  { id: 'debardeur', label: 'Débardeur', sleeve: -1, collar: 'bretelles' },
  { id: 'robe', label: 'Robe', sleeve: 0, collar: 'rond', dress: true },
  { id: 'salopette', label: 'Salopette', sleeve: 0, collar: 'bretelles', bib: true },
  { id: 'survet', label: 'Survêtement', sleeve: 1, collar: 'zip', stripes: true },
  { id: 'blouse', label: 'Blouse', sleeve: 1, collar: 'v', buttons: true },
  { id: 'polo', label: 'Polo', sleeve: 0, collar: 'polo', buttons: true },
  { id: 'gilet', label: 'Gilet', sleeve: 1, collar: 'v', open: true },
  { id: 'manteau', label: 'Manteau', sleeve: 1, collar: 'revers', buttons: true, coat: true },
  { id: 'doudoune', label: 'Doudoune', sleeve: 1, collar: 'zip', quilt: true },
  { id: 'pyjama-haut', label: 'Haut de pyjama', sleeve: 1, collar: 'rond', forcePattern: 'rayures' },
  { id: 'peignoir', label: 'Peignoir', sleeve: 1, collar: 'revers', open: true, belt: true },
  { id: 'marcel', label: 'Marcel', sleeve: -1, collar: 'bretelles' },
  { id: 'maillot', label: 'Maillot de sport', sleeve: -1, collar: 'rond', stripes: true },
  { id: 'chemisier', label: 'Chemisier', sleeve: 0, collar: 'v', buttons: true },
  { id: 'marin', label: 'Pull marin', sleeve: 1, collar: 'rond', forcePattern: 'rayures' },
  { id: 'hoodie-zip', label: 'Sweat zippé', sleeve: 1, collar: 'zip', pocket: true },
  { id: 'jacquard', label: 'Pull jacquard', sleeve: 1, collar: 'roule', forcePattern: 'carreaux' },
  { id: 'tunique', label: 'Tunique', sleeve: 0, collar: 'v', dress: true },
];

const TOP_BY_ID = Object.fromEntries(TOPS.map((t, i) => [t.id, i]));

// --- 50 pantalons -----------------------------------------------------------
//
// Chaque bas garde sa coupe d'origine (`cut`) pour que les règles de tenue
// puissent dire « un jean, peu importe lequel ».

function bottomEntry(cut, label, o = {}) {
  return { id: `${cut}${o.fit ? `-${o.fit}` : ''}`, cut, label, length: 1, width: 1, ...o };
}

const BOTTOM_LIST = [];
{
  const cuts = [
    ['jean', 'Jean', { seam: true, pockets: true }],
    ['chino', 'Chino', {}],
    ['jogging', 'Jogging', { stripe: true, cuff: true }],
    ['cargo', 'Cargo', { pockets: true, cuff: true }],
    ['costume', 'Pantalon de costume', { crease: true }],
    ['large', 'Pantalon large', {}],
    ['velours', 'Velours côtelé', { seam: true }],
    ['legging', 'Legging', {}],
    ['pyjama', 'Bas de pyjama', { soft: true }],
  ];
  const fits = [['slim', 0.86], ['droit', 1], ['ample', 1.18]];
  for (const [cut, label, o] of cuts) {
    for (const [fit, width] of fits) {
      // Le legging n'existe pas en ample, le pantalon large pas en slim.
      if (cut === 'legging' && fit === 'ample') continue;
      if (cut === 'large' && fit === 'slim') continue;
      BOTTOM_LIST.push(bottomEntry(cut, label, {
        ...o, fit,
        width: width * (cut === 'large' ? 1.14 : 1) * (cut === 'legging' ? 0.9 : 1),
      }));
    }
  }
  // Shorts.
  BOTTOM_LIST.push(
    bottomEntry('short', 'Short', { length: 0.5, width: 1.1 }),
    bottomEntry('short', 'Short en jean', { fit: 'jean', length: 0.55, width: 1.05, seam: true }),
    bottomEntry('short', 'Short de sport', { fit: 'sport', length: 0.5, width: 1.12, stripe: true }),
    bottomEntry('bermuda', 'Bermuda', { length: 0.66, width: 1.16, pockets: true }),
    bottomEntry('cycliste', 'Cycliste', { length: 0.45, width: 0.8 }),
    bottomEntry('short', 'Short de pyjama', { fit: 'nuit', length: 0.5, width: 1.15, soft: true }),
  );
  // Retroussés.
  BOTTOM_LIST.push(
    bottomEntry('jean', 'Jean retroussé', { fit: 'retro', length: 0.85, width: 0.95, seam: true, cuff: true }),
    bottomEntry('chino', 'Chino retroussé', { fit: 'retro', length: 0.85, width: 0.95, cuff: true }),
    bottomEntry('cargo', 'Cargo retroussé', { fit: 'retro', length: 0.85, width: 1.1, pockets: true, cuff: true }),
  );
  // Jupes.
  BOTTOM_LIST.push(
    bottomEntry('jupe', 'Jupe', { length: 0.42, width: 1.45, skirt: true }),
    bottomEntry('jupe', 'Jupe longue', { fit: 'longue', length: 0.95, width: 1.6, skirt: true }),
    bottomEntry('jupe', 'Jupe crayon', { fit: 'crayon', length: 0.6, width: 1.02, skirt: true }),
    bottomEntry('jupe', 'Jupe plissée', { fit: 'plissee', length: 0.5, width: 1.65, skirt: true, pleats: true }),
    bottomEntry('jupe', 'Jupe mi-longue', { fit: 'mi', length: 0.7, width: 1.4, skirt: true }),
  );
  // Divers.
  BOTTOM_LIST.push(
    bottomEntry('chino', 'Pantacourt', { fit: 'court', length: 0.8, width: 1.05 }),
    bottomEntry('jean', 'Jean déchiré', { fit: 'dechire', length: 1, width: 0.92, seam: true, torn: true }),
    bottomEntry('jogging', 'Survêt rétro', { fit: 'retro', length: 0.97, width: 1.05, stripe: true, cuff: true }),
    bottomEntry('cargo', 'Treillis', { fit: 'treillis', length: 1, width: 1.2, pockets: true }),
    bottomEntry('costume', 'Tailleur', { fit: 'tailleur', length: 1, width: 0.95, crease: true }),
    bottomEntry('large', 'Pantalon de lin', { fit: 'lin', length: 1, width: 1.1, soft: true }),
    bottomEntry('legging', 'Moulant de sport', { fit: 'sport', length: 1, width: 0.8, stripe: true }),
    bottomEntry('large', 'Baggy', { fit: 'baggy', length: 1, width: 1.35, pockets: true }),
    bottomEntry('jupe', 'Jupe-short', { fit: 'culotte', length: 0.5, width: 1.3, skirt: true }),
    bottomEntry('velours', 'Velours moutarde', { fit: 'retro', length: 0.9, width: 1.02, seam: true, cuff: true }),
    bottomEntry('costume', 'Pantalon à pinces', { fit: 'pinces', length: 0.95, width: 1.08, crease: true }),
  );
}
export const BOTTOMS = BOTTOM_LIST;

// --- 40 chaussures ----------------------------------------------------------
//
// Dix silhouettes dessinées, quarante références : la même basket existe en
// cuir, en toile, en montante, avec ou sans virgule de couleur. La planche
// montre surtout des baskets — l'immeuble aussi.

const SHOE_SHAPES = [
  // 0 — basket : semelle claire bien visible.
  (ctx, x, y, side, color, silhouette) => {
    solid(ctx, () => {
      ctx.moveTo(x - 4.2 * side, y - 6);
      ctx.quadraticCurveTo(x - 5.6 * side, y + 0.5, x + 3.5 * side, y + 1);
      ctx.quadraticCurveTo(x + 9.8 * side, y + 0.8, x + 9 * side, y - 3);
      ctx.quadraticCurveTo(x + 6 * side, y - 6.2, x + 2.5 * side, y - 6);
      ctx.closePath();
    }, silhouette ? INK : color, !silhouette, LINE * 1.6);
    if (silhouette) return;
    solid(ctx, () => {
      roundRect(ctx, Math.min(x - 5 * side, x + 9.6 * side), y + 0.2, 14.6, 2.6, 1.2);
    }, '#f2ece2', true, LINE * 0.8);
  },
  // 1 — bottine à tige.
  (ctx, x, y, side, color, silhouette) => {
    solid(ctx, () => {
      ctx.moveTo(x - 4 * side, y - 11);
      ctx.lineTo(x + 1.6 * side, y - 11);
      ctx.lineTo(x + 2.4 * side, y - 5);
      ctx.quadraticCurveTo(x + 8.6 * side, y - 4.6, x + 8.2 * side, y - 0.6);
      ctx.lineTo(x - 4.4 * side, y - 0.4);
      ctx.closePath();
    }, silhouette ? INK : color, !silhouette, LINE * 1.6);
  },
  // 2 — mocassin bas et fin.
  (ctx, x, y, side, color, silhouette) => {
    solid(ctx, () => {
      ctx.moveTo(x - 3.6 * side, y - 4.2);
      ctx.quadraticCurveTo(x - 4.8 * side, y + 1, x + 4 * side, y + 1.2);
      ctx.quadraticCurveTo(x + 10.5 * side, y + 1, x + 9.6 * side, y - 1.6);
      ctx.quadraticCurveTo(x + 6 * side, y - 4.4, x + 2 * side, y - 4.2);
      ctx.closePath();
    }, silhouette ? INK : color, !silhouette, LINE * 1.5);
  },
  // 3 — chausson, mou et rond.
  (ctx, x, y, side, color, silhouette) => {
    solid(ctx, () => {
      ctx.moveTo(x - 4.4 * side, y - 5.4);
      ctx.quadraticCurveTo(x - 6 * side, y + 1.4, x + 3 * side, y + 1.6);
      ctx.quadraticCurveTo(x + 8.4 * side, y + 1.4, x + 7.6 * side, y - 3);
      ctx.quadraticCurveTo(x + 5 * side, y - 6, x + 2 * side, y - 5.4);
      ctx.closePath();
    }, silhouette ? INK : color, !silhouette, LINE * 1.6);
  },
  // 4 — talon.
  (ctx, x, y, side, color, silhouette) => {
    solid(ctx, () => {
      ctx.moveTo(x - 3.2 * side, y - 6);
      ctx.lineTo(x - 3.6 * side, y + 1.4);
      ctx.lineTo(x - 1.4 * side, y + 1.4);
      ctx.lineTo(x - 1.2 * side, y - 2.2);
      ctx.quadraticCurveTo(x + 6 * side, y - 1.4, x + 9.4 * side, y + 0.6);
      ctx.quadraticCurveTo(x + 10 * side, y - 3, x + 2.4 * side, y - 6);
      ctx.closePath();
    }, silhouette ? INK : color, !silhouette, LINE * 1.4);
  },
  // 5 — sandale : deux brides.
  (ctx, x, y, side, color, silhouette) => {
    solid(ctx, () => {
      ctx.moveTo(x - 4 * side, y - 0.6);
      ctx.quadraticCurveTo(x + 4 * side, y + 1.6, x + 9.4 * side, y - 0.2);
      ctx.lineTo(x + 9.2 * side, y - 2);
      ctx.quadraticCurveTo(x + 3 * side, y - 2.4, x - 4 * side, y - 3);
      ctx.closePath();
    }, silhouette ? INK : color, !silhouette, LINE * 1.4);
    if (silhouette) return;
    ink(ctx, LINE * 0.9);
    for (const dx of [1.5, 5.5]) {
      ctx.beginPath();
      ctx.moveTo(x + dx * side, y - 2.6);
      ctx.lineTo(x + (dx + 1.4) * side, y - 6);
      ctx.stroke();
    }
  },
  // 6 — grosse chaussure de chantier.
  (ctx, x, y, side, color, silhouette) => {
    solid(ctx, () => {
      ctx.moveTo(x - 4.6 * side, y - 8.4);
      ctx.lineTo(x + 2 * side, y - 8);
      ctx.quadraticCurveTo(x + 10.4 * side, y - 6, x + 10 * side, y - 1.4);
      ctx.lineTo(x - 5 * side, y - 1);
      ctx.closePath();
    }, silhouette ? INK : color, !silhouette, LINE * 1.7);
    if (silhouette) return;
    solid(ctx, () => {
      roundRect(ctx, Math.min(x - 5.4 * side, x + 10.4 * side), y - 1.4, 15.8, 3, 1);
    }, '#3b3630', true, LINE * 0.8);
  },
  // 7 — pieds nus : on dessine le pied.
  (ctx, x, y, side, color, silhouette, skin) => {
    solid(ctx, () => {
      ctx.moveTo(x - 3.4 * side, y - 5);
      ctx.quadraticCurveTo(x - 4.4 * side, y + 1, x + 3 * side, y + 1.2);
      ctx.quadraticCurveTo(x + 8 * side, y + 1, x + 7.4 * side, y - 1.6);
      ctx.quadraticCurveTo(x + 4.6 * side, y - 4.6, x + 1.6 * side, y - 5);
      ctx.closePath();
    }, silhouette ? INK : (skin ?? color), !silhouette, LINE * 1.4);
  },
  // 8 — basket montante.
  (ctx, x, y, side, color, silhouette) => {
    solid(ctx, () => {
      ctx.moveTo(x - 4.2 * side, y - 9.5);
      ctx.lineTo(x + 1.4 * side, y - 9.2);
      ctx.quadraticCurveTo(x + 3 * side, y - 5, x + 9 * side, y - 3);
      ctx.quadraticCurveTo(x + 9.6 * side, y + 0.6, x + 3.5 * side, y + 1);
      ctx.quadraticCurveTo(x - 5.4 * side, y + 0.5, x - 4.6 * side, y - 4);
      ctx.closePath();
    }, silhouette ? INK : color, !silhouette, LINE * 1.6);
    if (silhouette) return;
    solid(ctx, () => {
      roundRect(ctx, Math.min(x - 5 * side, x + 9.6 * side), y + 0.2, 14.6, 2.4, 1.2);
    }, '#f2ece2', true, LINE * 0.8);
    ink(ctx, LINE * 0.6);
    ctx.beginPath();
    ctx.moveTo(x - 3 * side, y - 7.8);
    ctx.lineTo(x + 0.6 * side, y - 7.6);
    ctx.stroke();
  },
  // 9 — tong, sur pied nu.
  (ctx, x, y, side, color, silhouette, skin) => {
    SHOE_SHAPES[7](ctx, x, y, side, color, silhouette, skin);
    if (silhouette) return;
    solid(ctx, () => {
      ctx.moveTo(x - 4 * side, y + 0.6);
      ctx.quadraticCurveTo(x + 2 * side, y + 2.4, x + 8 * side, y + 0.8);
      ctx.lineTo(x + 8 * side, y + 2);
      ctx.lineTo(x - 4 * side, y + 2);
      ctx.closePath();
    }, color, true, LINE * 0.7);
    ink(ctx, LINE * 0.7);
    ctx.beginPath();
    ctx.moveTo(x + 2 * side, y + 1);
    ctx.lineTo(x + 3.4 * side, y - 3);
    ctx.stroke();
  },
];

function shoeEntry(shape, pool, o = {}) {
  return { shape, pool, accent: false, ...o };
}
const SHOE_LIST = [
  // Baskets basses — huit références, c'est la rue.
  shoeEntry(0, 'clothes'), shoeEntry(0, 'clothes', { accent: true }),
  shoeEntry(0, 'leather'), shoeEntry(0, 'leather', { accent: true }),
  shoeEntry(0, 'blanc'), shoeEntry(0, 'blanc', { accent: true }),
  shoeEntry(0, 'noir'), shoeEntry(0, 'noir', { accent: true }),
  // Montantes.
  shoeEntry(8, 'clothes'), shoeEntry(8, 'leather'), shoeEntry(8, 'blanc'),
  shoeEntry(8, 'noir', { accent: true }),
  // Bottines.
  shoeEntry(1, 'leather'), shoeEntry(1, 'noir'), shoeEntry(1, 'leather', { accent: true }),
  shoeEntry(1, 'clothes'),
  // Mocassins et derbies.
  shoeEntry(2, 'leather'), shoeEntry(2, 'noir'), shoeEntry(2, 'leather', { accent: true }),
  shoeEntry(2, 'clothes'), shoeEntry(2, 'blanc'),
  // Talons.
  shoeEntry(4, 'leather'), shoeEntry(4, 'noir'), shoeEntry(4, 'clothes'),
  shoeEntry(4, 'clothes', { accent: true }),
  // Sandales et espadrilles.
  shoeEntry(5, 'leather'), shoeEntry(5, 'clothes'), shoeEntry(5, 'clothes', { accent: true }),
  // Chaussons.
  shoeEntry(3, 'clothes'), shoeEntry(3, 'leather'), shoeEntry(3, 'clothes', { accent: true }),
  // Chantier.
  shoeEntry(6, 'leather'), shoeEntry(6, 'noir'),
  // Tongs.
  shoeEntry(9, 'clothes'), shoeEntry(9, 'leather'),
  // Pieds nus.
  shoeEntry(7, 'peau'),
  // Divers pour arriver à quarante — dont LES BASKETS DORÉES.
  shoeEntry(0, 'clothes', { accent: true, flash: true }),
  shoeEntry(8, 'clothes', { accent: true, flash: true }),
  shoeEntry(1, 'blanc'),
  shoeEntry(0, 'or', { accent: true, gold: true }),
];
export const SHOES = SHOE_LIST;

const SHOE_POOLS = {
  clothes: () => PALETTE.clothes,
  leather: () => PALETTE.leather,
  blanc: () => ['#e8e2d6', '#f2ece2', '#ded6c6'],
  noir: () => ['#2b2b30', '#33333a', '#1f2126'],
  peau: () => ['#c9a488'],
  or: () => ['#d9b23f'],
};

export function shoeColorOf(entry, seed) {
  return pickStable(SHOE_POOLS[entry.pool](), seed);
}

/** Dessine une référence du catalogue, virgule de couleur comprise. */
export function drawShoe(ctx, entry, x, y, side, color, silhouette, skin) {
  SHOE_SHAPES[entry.shape](ctx, x, y, side, color, silhouette, skin);
  if (silhouette || !entry.accent) return;
  // La virgule : une touche de couleur sur le flanc, comme sur la planche.
  ctx.beginPath();
  ctx.moveTo(x + 1 * side, y - 4.6);
  ctx.quadraticCurveTo(x + 4.5 * side, y - 4.2, x + 7 * side, y - 2);
  ctx.strokeStyle = entry.gold ? '#f2dc9a' : (entry.flash ? '#e07a3c' : '#f2ece2');
  ctx.lineWidth = LINE * 0.75;
  ctx.lineCap = 'round';
  ctx.stroke();
}

// --- Motifs de tissu --------------------------------------------------------

export const PATTERNS = ['uni', 'uni', 'uni', 'rayures', 'carreaux', 'pois'];

export function paintPattern(ctx, pattern, color, x0, y0, w, h) {
  if (pattern === 'uni') return;
  const dark = rgba(shade(color, -0.35), 0.5);
  const light = rgba(shade(color, 0.4), 0.42);
  ctx.save();
  if (pattern === 'rayures') {
    ctx.fillStyle = light;
    for (let y = y0; y < y0 + h; y += 6) ctx.fillRect(x0, y, w, 2.6);
  } else if (pattern === 'carreaux') {
    ctx.fillStyle = dark;
    for (let y = y0; y < y0 + h; y += 8) ctx.fillRect(x0, y, w, 1.6);
    for (let x = x0; x < x0 + w; x += 8) ctx.fillRect(x, y0, 1.6, h);
  } else if (pattern === 'pois') {
    ctx.fillStyle = light;
    for (let y = y0; y < y0 + h; y += 8) {
      for (let x = x0 + ((y / 8) % 2) * 4; x < x0 + w; x += 8) {
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

// --- Les sept contextes de tenue --------------------------------------------
//
// La planche classe les tenues : Quotidien, Travail, Sport, Soirée, Été,
// Hiver, Maison. Chaque habitant se compose UNE tenue par contexte — même
// haut préféré au quotidien, même pyjama tous les soirs — et `contextFor`
// décide laquelle il porte à l'instant.

export const OUTFIT_CONTEXTS = ['quotidien', 'travail', 'sport', 'soiree', 'ete', 'hiver', 'maison'];

const cutIn = (...cuts) => (b) => cuts.includes(b.cut) && !b.soft;
const OUTFIT_RULES = {
  quotidien: {
    tops: ['tshirt', 'chemise', 'pull', 'sweat', 'polo', 'gilet', 'marin', 'chemisier', 'hoodie-zip', 'veste', 'robe'],
    bottoms: cutIn('jean', 'chino', 'velours', 'cargo', 'large', 'jupe'),
    shoes: (s) => [0, 8, 1, 2].includes(s.shape),
  },
  travail: {
    tops: ['chemise', 'polo', 'blouse', 'veste', 'gilet', 'chemisier'],
    bottoms: cutIn('costume', 'chino', 'jean'),
    shoes: (s) => [2, 1, 0].includes(s.shape),
  },
  sport: {
    tops: ['maillot', 'tshirt', 'survet', 'sweat', 'debardeur'],
    bottoms: (b) => ['jogging', 'short', 'cycliste', 'legging'].includes(b.cut) && !b.soft,
    shoes: (s) => [0, 8].includes(s.shape),
  },
  soiree: {
    tops: ['chemise', 'robe', 'veste', 'chemisier', 'polo', 'gilet'],
    bottoms: cutIn('costume', 'jupe', 'jean'),
    shoes: (s) => [2, 4, 1].includes(s.shape),
  },
  ete: {
    tops: ['tshirt', 'debardeur', 'marcel', 'robe', 'chemisier', 'polo', 'tunique'],
    bottoms: (b) => ['short', 'bermuda', 'jupe'].includes(b.cut) || b.id === 'large-lin',
    shoes: (s) => [5, 9, 0].includes(s.shape),
  },
  hiver: {
    tops: ['manteau', 'doudoune', 'pull', 'jacquard', 'marin', 'sweat'],
    bottoms: cutIn('jean', 'velours', 'costume', 'cargo'),
    shoes: (s) => [1, 6, 8].includes(s.shape),
  },
  maison: {
    tops: ['pyjama-haut', 'peignoir', 'tshirt', 'marcel', 'sweat'],
    bottoms: (b) => b.soft || b.cut === 'jogging',
    shoes: (s) => [3, 7].includes(s.shape),
  },
};

/**
 * Le contexte de tenue du moment. Décidé par l'action d'abord, la saison
 * ensuite. Oui, certains gardent le manteau dans le salon en janvier :
 * le chauffage collectif de cet immeuble est ce qu'il est.
 */
export function contextFor(person, clock) {
  const act = person.action?.id;
  if (act === 'dormir' || act === 'insomnie' || act === 'douche' || act === 'soigner') return 'maison';
  if (act === 'sport') return 'sport';
  if (act === 'fete' || act === 'flirter') return 'soiree';
  if (act === 'travailler' || act === 'teletravail' || act === 'ecole') return 'travail';
  const s = clock?.season ?? 1;
  if (s === 2) return 'ete';
  if (s === 0) return 'hiver';
  return 'quotidien';
}

// --- Composition ------------------------------------------------------------

const GREY_HAIR = ['#a8a29c', '#d8d4ce', '#bdb7ae'];

export function appearance(person) {
  if (person._look) return person._look;
  const id = person.id;
  const key = morphoKey(person);
  const m = MORPHO[key];
  const P = person.personality ?? {};
  const job = person.job?.id ?? '';
  const female = person.gender === 'f';
  const child = person.age < 12;
  const old = person.age >= 66;

  // — Peau et cheveux —
  const natural = PALETTE.hair.filter((c) => !GREY_HAIR.includes(c));
  let hair = pickStable(natural, `cheveux${id}`);
  if (person.age > 60 && hashPick(id * 29, 100) < (person.age - 55) * 5) {
    hair = person.age > 76 ? '#ded9d2' : pickStable(GREY_HAIR, `gris${id}`);
  }
  // Couleur : la planche assume les cheveux teints chez les jeunes.
  if (person.age >= 13 && person.age <= 38 && hashPick(id * 43 + 9, 100) < 6) {
    hair = pickStable(PALETTE.dye, `teinture${id}`);
  }

  // — Visage —
  const headPrefs = child ? [4, 3] : old ? [2, 7, 5] : female ? [3, 4, 8] : [0, 6, 5];
  const eyePrefs = child ? [0, 4, 9] : old ? [6, 8, 2] : female ? [1, 7, 4] : [1, 3, 5];

  // — Coiffure —
  const hairPrefs = female ? [1, 4, 2, 7, 9, 14, 25, 40] : [0, 10, 13, 16, 5, 6, 18, 20];
  if (child) hairPrefs.push(8, 16, 45, 0);
  const hairPool = HAIR.map((_, i) => i)
    .filter((i) => (female || child || (i !== 8 && i !== 2 && i !== 41)))
    .filter((i) => !((i === 5 || i === BALD) && (child || female || person.age < 30)))
    // Crête et piques hautes : pas après cinquante ans.
    .filter((i) => !(i >= 45 && i <= 48 && person.age > 50));
  const hairStyle = preferred(id * 13 + 5, hairPool, hairPrefs);

  // — Pilosité —
  const beardable = !female && person.age > 19;
  let beard = 0;
  if (beardable && hashPick(id * 19 + 7, 100) < 58) {
    const pool = BEARDS.map((e, i) => i).filter((i) => i > 0)
      .filter((i) => (old || !LONG_BEARDS.includes(i)));
    beard = preferred(id * 47 + 3, pool, old ? [7, 2, 4] : [6, 1, 3]);
  }

  // — Lunettes —
  let glasses = -1;
  const gRoll = hashPick(id * 17 + 2, 100);
  if (gRoll < (old ? 46 : 16)) {
    glasses = preferred(id * 59 + 1, [0, 1, 2, 3, 4], old ? [3, 2] : female ? [4, 0] : [1, 0]);
  } else if (gRoll < (old ? 50 : 22) && person.age > 14) {
    glasses = preferred(id * 59 + 1, [5, 6, 7], []);
  }

  const look = {
    morpho: key,
    proportions: m,
    skin: pickStable(PALETTE.skin, `peau${id}`),
    hair,
    hairStyle,
    beard,
    head: preferred(id * 31 + 4, HEADS.map((_, i) => i), headPrefs),
    eyes: preferred(id * 23 + 3, EYES.map((_, i) => i), eyePrefs),
    nose: hashPick(id * 23 + 11, NOSES.length),
    mouth: preferred(id * 37 + 9, MOUTHS.map((_, i) => i), female ? [4, 5] : [0, 3, 7]),
    ears: hashPick(id * 41 + 9, 3),
    glasses,
    build: 0.86 + (hashPick(id * 3 + 1, 100) / 100) * 0.32,
    hat: null,
    // Tatouage : un adulte sur dix, visible seulement en manches courtes.
    tattoo: !child && person.age >= 18 && person.age < 60 && hashPick(id * 79 + 5, 100) < 11,
  };

  // — Accessoire du quotidien —
  let accessory = EVERYDAY[hashPick(id * 73 + 4, EVERYDAY.length)];
  if (child && !['aucun', 'casque_audio'].includes(accessory)) accessory = 'aucun';
  if (!female && person.age > 30 && ['collier', 'perles'].includes(accessory)) accessory = 'aucun';
  if (accessory === 'noeud_papillon' && person.age < 40) accessory = 'aucun';
  // Le métier passe avant l'humeur du matin.
  if (['cuisinier', 'boulanger', 'serveur'].includes(job)) accessory = 'tablier';
  if (['avocat', 'banquier', 'notaire', 'cadre'].includes(job) && !female) accessory = 'cravate';
  if (job === 'gardien') accessory = 'badge';
  look.accessory = accessory;

  // — Couvre-chef —
  const hatRoll = hashPick(id * 61 + 3, 1000);
  const hatColor = pickStable(PALETTE.clothes, `chapeau${id}`);
  if (hatRoll < 50) look.hat = { draw: HATS[0], color: hatColor };
  else if (hatRoll < 90) look.hat = { draw: HATS[1], color: hatColor };
  else if (hatRoll < 110 && person.age > 55) look.hat = { draw: HATS[2], color: '#2f3742' };
  else if (hatRoll < 130) look.hat = { draw: HATS[3], color: hatColor };
  else if (hatRoll < 150 && female) look.hat = { draw: HATS[4], color: hatColor };
  else if (hatRoll < 165 && person.age > 45) look.hat = { draw: HATS[5], color: '#4a3a2c' };
  // Les très rares de la planche. Quelqu'un, quelque part dans l'immeuble.
  else if (hatRoll >= 996 && !child) look.hat = { draw: HATS[8], color: '#e0b53f', rare: 'couronne' };
  else if (hatRoll === 995) look.hat = { draw: HATS[9], color: '#23262d', rare: 'casque_sombre' };
  else if (hatRoll === 994) look.hat = { draw: HATS[10], color: '#8fbf6a', rare: 'masque_alien' };
  if (['plombier', 'macon', 'ouvrier'].includes(job) && hashPick(id * 7, 10) < 4) {
    look.hat = { draw: HATS[6], color: '#e8b13f' };
  }
  // Sous un couvre-chef, une coiffure volumineuse dépasse mal : on la range.
  if (look.hat && ([2, 3, 6, 9, 16, 41, 42, 47, 48].includes(look.hairStyle)
    || (look.hairStyle >= 32 && look.hairStyle <= 39))) {
    look.hairStyle = 0;
  }

  // — Les sept tenues —
  look.outfits = {};
  for (const ctxName of OUTFIT_CONTEXTS) {
    look.outfits[ctxName] = buildOutfit(person, ctxName, look);
  }
  // Compat : la tenue du quotidien reste lisible à plat sur le look.
  Object.assign(look, look.outfits.quotidien);

  person._look = look;
  return look;
}

/** Compose la tenue d'un contexte, orientée par le métier et le caractère. */
function buildOutfit(person, ctxName, look) {
  const id = person.id;
  const P = person.personality ?? {};
  const job = person.job?.id ?? '';
  const female = person.gender === 'f';
  const child = person.age < 12;
  const old = person.age >= 66;
  const R = OUTFIT_RULES[ctxName];
  const seed = (n) => id * 131 + n + ctxName.length * 17 + ctxName.charCodeAt(0) * 7;

  // — Le haut —
  let topPool = R.tops.map((tid) => TOP_BY_ID[tid])
    .filter((i) => (female || !TOPS[i].dress));
  const topPrefs = [];
  if (ctxName === 'travail') {
    if (['avocat', 'banquier', 'cadre', 'notaire', 'medecin', 'prof'].includes(job)) {
      topPrefs.push(TOP_BY_ID.chemise, TOP_BY_ID.veste, TOP_BY_ID.chemisier);
    } else if (['plombier', 'macon', 'gardien', 'ouvrier', 'livreur', 'menuisier'].includes(job)) {
      topPool = [TOP_BY_ID.tshirt, TOP_BY_ID.salopette, TOP_BY_ID.sweat, TOP_BY_ID.polo]
        .filter((i) => (female || !TOPS[i].dress));
      topPrefs.push(TOP_BY_ID.salopette, TOP_BY_ID.tshirt);
    } else if (job === 'medecin' || job === 'infirmier') {
      topPrefs.push(TOP_BY_ID.blouse);
    }
  }
  if ((P.rigueur ?? 0.5) > 0.7) topPrefs.push(TOP_BY_ID.chemise, TOP_BY_ID.pull);
  if ((P.ouverture ?? 0.5) > 0.72) topPrefs.push(TOP_BY_ID.veste, TOP_BY_ID.marin);
  if (child) topPrefs.push(TOP_BY_ID.tshirt, TOP_BY_ID.sweat, TOP_BY_ID.survet);
  if (old) topPrefs.push(TOP_BY_ID.gilet, TOP_BY_ID.pull, TOP_BY_ID.jacquard);
  const top = TOPS[preferred(seed(41), topPool, topPrefs)];

  // — Le bas —
  let bottomPool = BOTTOMS.map((_, i) => i)
    .filter((i) => R.bottoms(BOTTOMS[i]))
    .filter((i) => (female || !BOTTOMS[i].skirt))
    .filter((i) => !(BOTTOMS[i].cut === 'legging' && !female && !child && ctxName !== 'sport'));
  if (ctxName === 'maison') bottomPool = BOTTOMS.map((_, i) => i).filter((i) => R.bottoms(BOTTOMS[i]));
  let bottomIdx = bottomPool.length
    ? preferred(seed(53), bottomPool, [])
    : BOTTOMS.findIndex((b) => b.cut === 'jean');
  if (top.dress) bottomIdx = BOTTOMS.findIndex((b) => b.cut === 'legging');
  if (top.bib && BOTTOMS[bottomIdx].length < 1) bottomIdx = 0;

  // — Les chaussures —
  const shoePool = SHOES.map((_, i) => i)
    .filter((i) => R.shoes(SHOES[i]))
    .filter((i) => (female || SHOES[i].shape !== 4))
    // Les dorées ne se tirent pas : elles s'attrapent, tout en bas.
    .filter((i) => !SHOES[i].gold);
  let shoeIdx = shoePool.length ? preferred(seed(67), shoePool, []) : 0;
  if (!child && hashPick(id * 101 + 13, 1000) === 7) {
    shoeIdx = SHOES.findIndex((s) => s.gold); // LES baskets dorées
  }
  const shoe = SHOES[shoeIdx];

  // — Couleurs : le haut franc, le bas sourd, la soirée plus profonde —
  const topPoolC = ctxName === 'soiree'
    ? PALETTE.clothes.map((c) => shade(c, -0.18))
    : PALETTE.clothes;
  const fit = {
    top,
    bottom: BOTTOMS[bottomIdx],
    shoe,
    topColor: pickStable(topPoolC, `${ctxName}-haut${id}`),
    bottomColor: pickStable(PALETTE.trousers, `${ctxName}-bas${id * 7 + 3}`),
    shoeColor: shoeColorOf(shoe, `${ctxName}-pieds${id}`),
    pattern: top.forcePattern ?? PATTERNS[hashPick(seed(89), PATTERNS.length)],
    accentColor: pickStable(PALETTE.clothes, `accent${id * 3}`),
    accessory: look.accessory,
  };
  // L'hiver ajoute l'écharpe ; la maison enlève la cravate.
  if (ctxName === 'hiver' && hashPick(seed(97), 100) < 55) fit.accessory = 'echarpe';
  if (ctxName === 'maison' && ['cravate', 'badge', 'tablier'].includes(fit.accessory)) {
    fit.accessory = 'aucun';
  }
  if (ctxName === 'sport') fit.accessory = hashPick(seed(98), 100) < 25 ? 'casque_audio' : 'aucun';
  return fit;
}

/** La tenue portée en ce moment (le contexte est posé par updatePositions). */
export function outfitOf(person) {
  const look = appearance(person);
  return look.outfits[person.outfitContext ?? 'quotidien'] ?? look.outfits.quotidien;
}

// --- Détails de vêtement ----------------------------------------------------
//
// Appelées par character.js une fois le buste peint et découpé. Elles
// reçoivent la géométrie mesurée du torse, jamais des valeurs en dur.

export function drawTopDetails(ctx, look, geo) {
  const { shW, waW, hiW, shoulderY, waistY, hemY, B } = geo;
  const t = look.top;
  const c = look.topColor;

  paintPattern(ctx, look.pattern, c, -shW * 1.2, shoulderY, shW * 2.4, hemY - shoulderY);

  // Ombre douce, côté opposé à la lumière.
  const grad = ctx.createLinearGradient(-shW * 0.3, 0, shW * 1.1, 0);
  grad.addColorStop(0, rgba(shade(c, -0.45), 0));
  grad.addColorStop(1, rgba(shade(c, -0.45), 0.4));
  ctx.fillStyle = grad;
  ctx.fillRect(-shW * 1.3, shoulderY - 10, shW * 2.6, hemY - shoulderY + 20);

  // Matelassage de la doudoune : trois boudins, et le vêtement gonfle.
  if (t.quilt) {
    ctx.strokeStyle = rgba(shade(c, -0.4), 0.65);
    ctx.lineWidth = LINE * 0.7;
    for (let i = 1; i <= 3; i++) {
      const y = shoulderY + ((hemY - shoulderY) / 4) * i;
      ctx.beginPath();
      ctx.moveTo(-shW * 1.1, y);
      ctx.quadraticCurveTo(0, y + 3, shW * 1.1, y);
      ctx.stroke();
    }
  }

  // Ceinture du peignoir, nouée.
  if (t.belt) {
    ctx.fillStyle = shade(c, -0.2);
    ctx.fillRect(-waW * 1.2, waistY - 2, waW * 2.4, 5);
    ink(ctx, LINE * 0.6);
    ctx.beginPath();
    ctx.moveTo(waW * 0.2, waistY + 2);
    ctx.lineTo(waW * 0.5, waistY + 12);
    ctx.stroke();
  }

  if (t.pocket) {
    ctx.beginPath();
    ctx.moveTo(-waW * 0.92, waistY + 4);
    ctx.lineTo(-waW * 0.7, hemY - 3);
    ctx.lineTo(waW * 0.7, hemY - 3);
    ctx.lineTo(waW * 0.92, waistY + 4);
    ctx.strokeStyle = rgba(shade(c, -0.5), 0.75);
    ctx.lineWidth = LINE * 0.7;
    ctx.stroke();
  }

  if (t.stripes) {
    ctx.fillStyle = rgba('#f3ece0', 0.85);
    for (const side of [-1, 1]) {
      ctx.fillRect(side * shW * 0.78 - 1.2, shoulderY + 8, 2.4, hemY - shoulderY - 6);
    }
  }

  if (t.bib) {
    ctx.beginPath();
    roundRect(ctx, -waW * 0.62, waistY - 8, waW * 1.24, hemY - waistY + 6, 2);
    ctx.strokeStyle = rgba(shade(c, -0.55), 0.8);
    ctx.lineWidth = LINE * 0.75;
    ctx.stroke();
  }

  if (t.buttons) {
    ctx.beginPath();
    ctx.moveTo(0, shoulderY + 6);
    ctx.lineTo(0, hemY - 2);
    ctx.strokeStyle = rgba(shade(c, -0.5), 0.85);
    ctx.lineWidth = LINE * 0.6;
    ctx.stroke();
    ctx.fillStyle = rgba(shade(c, 0.55), 0.95);
    const n = t.id === 'polo' ? 2 : t.coat ? 3 : 4;
    for (let i = 0; i < n; i++) {
      ctx.beginPath();
      ctx.arc(0, shoulderY + 12 + i * ((hemY - shoulderY - 16) / n), t.coat ? 1.6 : 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Veste ou gilet ouvert : on voit le tee-shirt en dessous. Il lui faut
  // une encolure et un bas arrondi, sinon c'est une feuille de papier.
  if (t.open) {
    ctx.fillStyle = rgba(shade(look.accentColor, 0.5), 0.95);
    ctx.beginPath();
    ctx.moveTo(-waW * 0.38, shoulderY + 3);
    ctx.quadraticCurveTo(0, shoulderY + 13, waW * 0.38, shoulderY + 3);
    ctx.quadraticCurveTo(waW * 0.44, waistY, waW * 0.36, hemY - 1);
    ctx.quadraticCurveTo(0, hemY + 2, -waW * 0.36, hemY - 1);
    ctx.quadraticCurveTo(-waW * 0.44, waistY, -waW * 0.38, shoulderY + 3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = rgba(INK, 0.5);
    ctx.lineWidth = LINE * 0.7;
    ctx.stroke();
  }
}

/** Le col. C'est lui qui transforme un aplat de couleur en vêtement. */
export function drawCollar(ctx, look, geo) {
  const { shW, shoulderY, B } = geo;
  const kind = look.top.collar;
  const c = look.topColor;
  const w = 5.8 * B;

  ctx.beginPath();
  if (kind === 'rond') {
    ctx.moveTo(-w, shoulderY);
    ctx.quadraticCurveTo(0, shoulderY + 6.5, w, shoulderY);
  } else if (kind === 'v') {
    ctx.moveTo(-w, shoulderY - 0.5);
    ctx.lineTo(0, shoulderY + 9);
    ctx.lineTo(w, shoulderY - 0.5);
  } else if (kind === 'chemise' || kind === 'polo') {
    ctx.moveTo(-w * 1.05, shoulderY - 1);
    ctx.lineTo(-w * 0.34, shoulderY + 7.5);
    ctx.lineTo(0, shoulderY + 2.5);
    ctx.lineTo(w * 0.34, shoulderY + 7.5);
    ctx.lineTo(w * 1.05, shoulderY - 1);
  } else if (kind === 'bretelles') {
    ctx.moveTo(-w * 0.8, shoulderY + 10);
    ctx.lineTo(-w * 0.62, shoulderY - 2);
    ctx.moveTo(w * 0.8, shoulderY + 10);
    ctx.lineTo(w * 0.62, shoulderY - 2);
  } else if (kind === 'zip') {
    ctx.moveTo(-w * 0.9, shoulderY + 1);
    ctx.lineTo(0, shoulderY + 7);
    ctx.lineTo(w * 0.9, shoulderY + 1);
    ctx.moveTo(0, shoulderY + 7);
    ctx.lineTo(0, shoulderY + 20);
  } else if (kind === 'revers') {
    ctx.moveTo(-w * 1.1, shoulderY - 1);
    ctx.lineTo(-w * 0.3, shoulderY + 16);
    ctx.lineTo(-w * 0.55, shoulderY + 2);
    ctx.moveTo(w * 1.1, shoulderY - 1);
    ctx.lineTo(w * 0.3, shoulderY + 16);
    ctx.lineTo(w * 0.55, shoulderY + 2);
  }
  ink(ctx, LINE * 0.85);
  ctx.stroke();

  // Le col roulé est un volume, pas un trait : il se dessine plein.
  if (kind === 'roule') {
    solid(ctx, () => {
      roundRect(ctx, -w * 0.95, shoulderY - 9, w * 1.9, 11, 3);
    }, shade(c, 0.14), true, LINE * 0.9);
  }
  // La capuche du sweat : deux cordons, et on comprend tout.
  if (kind === 'capuche') {
    ink(ctx, LINE * 0.7);
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * w * 0.3, shoulderY + 5);
      ctx.lineTo(side * w * 0.34, shoulderY + 15);
      ctx.stroke();
    }
  }
}

/** Écharpe, cravate, collier, tablier… : le détail qui fait le personnage. */
export function drawAccessory(ctx, look, geo) {
  const { shW, waW, shoulderY, waistY, hemY, B } = geo;
  switch (look.accessory) {
    case 'echarpe':
    case 'echarpe_longue':
      solid(ctx, () => {
        roundRect(ctx, -shW * 0.72, shoulderY - 4, shW * 1.44, 9, 4);
      }, look.accentColor, true, LINE * 0.9);
      solid(ctx, () => {
        roundRect(ctx, -shW * 0.2, shoulderY + 2, 7, look.accessory === 'echarpe_longue' ? 34 : 22, 3);
      }, shade(look.accentColor, -0.12), true, LINE * 0.85);
      break;
    case 'foulard_cou':
      solid(ctx, () => {
        roundRect(ctx, -shW * 0.6, shoulderY - 3, shW * 1.2, 7, 3.4);
      }, look.accentColor, true, LINE * 0.8);
      break;
    case 'cravate':
      solid(ctx, () => {
        ctx.moveTo(-3.4, shoulderY + 4);
        ctx.lineTo(3.4, shoulderY + 4);
        ctx.lineTo(2.4, shoulderY + 10);
        ctx.lineTo(4.6, waistY + 6);
        ctx.lineTo(0, waistY + 12);
        ctx.lineTo(-4.6, waistY + 6);
        ctx.lineTo(-2.4, shoulderY + 10);
        ctx.closePath();
      }, look.accentColor, true, LINE * 0.8);
      break;
    case 'noeud_papillon':
      solid(ctx, () => {
        ctx.moveTo(-1.4, shoulderY + 5);
        ctx.lineTo(-6.4, shoulderY + 1.5);
        ctx.lineTo(-6.4, shoulderY + 8.5);
        ctx.closePath();
        ctx.moveTo(1.4, shoulderY + 5);
        ctx.lineTo(6.4, shoulderY + 1.5);
        ctx.lineTo(6.4, shoulderY + 8.5);
        ctx.closePath();
        ctx.moveTo(1.6, shoulderY + 5);
        ctx.arc(0, shoulderY + 5, 1.6, 0, Math.PI * 2);
      }, look.accentColor, true, LINE * 0.7);
      break;
    case 'collier':
    case 'chaine_or':
    case 'perles':
    case 'pendentif':
    case 'medaillon': {
      const gold = look.accessory !== 'collier';
      ctx.beginPath();
      ctx.moveTo(-4.6 * B, shoulderY + 1);
      ctx.quadraticCurveTo(0, shoulderY + 11, 4.6 * B, shoulderY + 1);
      ctx.strokeStyle = gold ? '#e0c07a' : '#c9564a';
      ctx.lineWidth = look.accessory === 'chaine_or' ? LINE * 0.8 : LINE * 0.55;
      ctx.stroke();
      if (look.accessory === 'perles') {
        ctx.fillStyle = '#f2ece0';
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath();
          ctx.arc(i * 2.1, shoulderY + 9 - Math.abs(i), 1.1, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (look.accessory !== 'chaine_or') {
        ctx.beginPath();
        ctx.arc(0, shoulderY + 10, look.accessory === 'medaillon' ? 2.6 : 1.9, 0, Math.PI * 2);
        ctx.fillStyle = '#e0c07a';
        ctx.fill();
      }
      break;
    }
    case 'tablier':
      solid(ctx, () => {
        ctx.moveTo(-waW * 0.5, shoulderY + 14);
        ctx.quadraticCurveTo(0, shoulderY + 10, waW * 0.5, shoulderY + 14);
        ctx.quadraticCurveTo(waW * 0.86, waistY, waW * 0.82, hemY + 3);
        ctx.lineTo(-waW * 0.82, hemY + 3);
        ctx.quadraticCurveTo(-waW * 0.86, waistY, -waW * 0.5, shoulderY + 14);
        ctx.closePath();
      }, '#efe4d2', true, LINE * 0.8);
      break;
    case 'bretelles':
      ink(ctx, LINE * 0.9);
      ctx.strokeStyle = shade(look.bottomColor, -0.4);
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(side * shW * 0.5, shoulderY + 2);
        ctx.lineTo(side * waW * 0.66, hemY);
        ctx.stroke();
      }
      break;
    case 'badge':
      solid(ctx, () => {
        roundRect(ctx, shW * 0.24, shoulderY + 12, 7, 5, 1.2);
      }, '#e8dcc4', true, LINE * 0.6);
      break;
    case 'banane':
      solid(ctx, () => {
        roundRect(ctx, -waW * 0.9, hemY - 7, waW * 1.1, 8, 3.4);
      }, look.accentColor, true, LINE * 0.8);
      ink(ctx, LINE * 0.5);
      ctx.beginPath();
      ctx.moveTo(-waW * 0.9, hemY - 3);
      ctx.lineTo(waW * 0.2, hemY - 3);
      ctx.stroke();
      break;
    default:
      break;
  }
}

/** Montre, bracelet, boucles : deux touches, mais on les remarque. */
export function drawTinyAccessory(ctx, look, where, x, y, s) {
  if (where === 'poignet') {
    if (look.accessory === 'montre' || look.accessory === 'montre_or') {
      solid(ctx, () => {
        roundRect(ctx, x - s * 0.5, y - s * 0.9, s, s * 1.8, s * 0.3);
      }, look.accessory === 'montre_or' ? '#c9a84a' : '#3c4450', true, LINE * 0.55);
    } else if (look.accessory === 'bracelet' || look.accessory === 'bracelet_cuir') {
      ctx.beginPath();
      ctx.moveTo(x - s * 0.6, y - s * 0.3);
      ctx.lineTo(x + s * 0.6, y - s * 0.3);
      ctx.strokeStyle = look.accessory === 'bracelet' ? '#e0c07a' : '#6b4a32';
      ctx.lineWidth = LINE * 0.6;
      ctx.stroke();
    }
  }
  if (where === 'oreille') {
    if (look.accessory === 'boucles') {
      ctx.beginPath();
      ctx.arc(x, y, s * 0.028, 0, Math.PI * 2);
      ctx.fillStyle = '#e0c07a';
      ctx.fill();
    } else if (look.accessory === 'creoles') {
      ctx.beginPath();
      ctx.arc(x, y + s * 0.006, s * 0.01, 0, Math.PI * 2);
      ctx.strokeStyle = '#e0c07a';
      ctx.lineWidth = LINE * 0.55;
      ctx.stroke();
    }
  }
}

/** Le casque audio se dessine sur la tête, par-dessus les cheveux. */
export function drawHeadAccessory(ctx, look, r) {
  if (look.accessory !== 'casque_audio') return;
  ctx.beginPath();
  ctx.moveTo(-r * 1.06, 0);
  ctx.quadraticCurveTo(0, -r * 1.62, r * 1.06, 0);
  ctx.strokeStyle = '#2f333b';
  ctx.lineWidth = r * 0.14;
  ctx.lineCap = 'round';
  ctx.stroke();
  for (const side of [-1, 1]) {
    solid(ctx, () => {
      roundRect(ctx, side * r * 1.0 - r * 0.16, -r * 0.2, r * 0.32, r * 0.5, r * 0.12);
    }, '#2f333b', true, LINE * 0.6);
  }
}
