// La garde-robe et le catalogue de visages.
//
// C'est la charte graphique traduite en code : morphologies, têtes, yeux,
// nez, bouches, coiffures, pilosité, hauts, bas, chaussures, couvre-chefs,
// accessoires. Chaque entrée est une petite fonction de dessin dans un
// repère normalisé, et `appearance()` compose un habitant en tirant une
// pièce dans chaque catalogue.
//
// Pourquoi un catalogue plutôt qu'un `switch` dans le personnage : parce
// qu'un immeuble de cent cinquante habitants a besoin de cent cinquante
// visages différents. Avec 9 mâchoires × 10 yeux × 9 nez × 9 bouches ×
// 18 coiffures × 12 hauts × 9 bas × 8 chaussures, la répétition ne se voit
// plus. Et ajouter une pièce, c'est ajouter une ligne dans un tableau.
//
// Repères :
//   — visage : origine au centre de la tête, `r` = rayon du crâne ;
//   — vêtements : origine au bassin, géométrie fournie par le personnage.

import { PALETTE, shade, rgba, pickStable } from './palette.js';
import { INK, LINE, ink, solid, capsulePath, roundRect } from './ink.js';

// --- Morphologies -----------------------------------------------------------
//
// Six gabarits, comme sur la planche. Ce ne sont pas six tailles : ce sont
// six façons d'occuper l'espace. Un ado n'est pas un adulte en plus petit,
// il est plus étroit d'épaules et plus long de jambes ; un senior s'est
// tassé et voûté ; un enfant, c'est surtout une tête.

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

// --- Mâchoires --------------------------------------------------------------
//
// La tête est tracée d'un seul chemin : tempes, pommettes, mâchoire, menton.
// C'est la pièce qui porte le plus de la ressemblance, donc c'est celle qui
// a le plus de variantes.

export const JAWS = [
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

// --- Yeux -------------------------------------------------------------------
//
// Chaque entrée renvoie la géométrie de l'œil : demi-largeur, demi-hauteur,
// inclinaison, et de quoi savoir s'il faut un cil, un cerne ou un maquillage.
// Le dessin lui-même est fait une fois pour toutes dans character.js — c'est
// lui qui connaît l'ouverture de la paupière et la direction du regard.

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
];

// --- Nez --------------------------------------------------------------------

export const NOSES = [
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

/** Les nez qu'on remplit au lieu de simplement les tracer. */
export const NOSE_FILLED = new Set([2, 8]);

// --- Bouches ----------------------------------------------------------------
//
// Une bouche = une largeur, une épaisseur de lèvre, et éventuellement une
// lèvre inférieure dessinée à part. La courbe, elle, vient de l'émotion.

export const MOUTHS = [
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

// --- Coiffures --------------------------------------------------------------
//
// Une coiffure est décrite par une fonction qui trace sa masse. Le remplissage
// et l'encrage sont faits par l'appelant, donc une coiffure peut être un seul
// chemin ou vingt boucles empilées — ça reste la même écriture.

export const HAIR = [
  // 0 — court, dégradé net.
  (ctx, r) => {
    ctx.moveTo(-r * 1.0, -r * 0.2);
    ctx.quadraticCurveTo(-r * 1.05, -r * 1.15, 0, -r * 1.18);
    ctx.quadraticCurveTo(r * 1.05, -r * 1.15, r * 1.0, -r * 0.2);
    ctx.quadraticCurveTo(r * 0.7, -r * 0.55, r * 0.2, -r * 0.5);
    ctx.quadraticCurveTo(-r * 0.6, -r * 0.45, -r * 1.0, -r * 0.2);
    ctx.closePath();
  },
  // 1 — carré au menton, avec frange.
  (ctx, r) => {
    ctx.moveTo(-r * 1.1, r * 0.55);
    ctx.quadraticCurveTo(-r * 1.18, -r * 1.2, 0, -r * 1.2);
    ctx.quadraticCurveTo(r * 1.18, -r * 1.2, r * 1.1, r * 0.55);
    ctx.lineTo(r * 0.72, r * 0.5);
    ctx.quadraticCurveTo(r * 0.88, -r * 0.42, 0, -r * 0.56);
    ctx.quadraticCurveTo(-r * 0.88, -r * 0.42, -r * 0.72, r * 0.5);
    ctx.closePath();
  },
  // 2 — chignon haut.
  (ctx, r) => {
    ctx.moveTo(-r * 1.0, -r * 0.25);
    ctx.quadraticCurveTo(-r * 1.05, -r * 1.15, 0, -r * 1.15);
    ctx.quadraticCurveTo(r * 1.05, -r * 1.15, r * 1.0, -r * 0.25);
    ctx.quadraticCurveTo(0, -r * 0.62, -r * 1.0, -r * 0.25);
    ctx.closePath();
    ctx.moveTo(r * 0.15 + r * 0.44, -r * 1.38);
    ctx.arc(r * 0.15, -r * 1.38, r * 0.44, 0, Math.PI * 2);
  },
  // 3 — afro, en grappes serrées.
  (ctx, r) => {
    for (let i = 0; i < 11; i++) {
      const a = Math.PI * 1.02 + (i / 10) * Math.PI * 0.96;
      const cx = Math.cos(a) * r * 0.92;
      const cy = Math.sin(a) * r * 1.02;
      ctx.moveTo(cx + r * 0.4, cy);
      ctx.arc(cx, cy, r * 0.4, 0, Math.PI * 2);
    }
    ctx.moveTo(0 + r * 0.5, -r * 0.72);
    ctx.arc(0, -r * 0.72, r * 0.5, 0, Math.PI * 2);
  },
  // 4 — longs, jusqu'aux épaules.
  (ctx, r) => {
    ctx.moveTo(-r * 1.12, r * 1.4);
    ctx.quadraticCurveTo(-r * 1.28, -r * 1.2, 0, -r * 1.2);
    ctx.quadraticCurveTo(r * 1.28, -r * 1.2, r * 1.12, r * 1.4);
    ctx.lineTo(r * 0.74, r * 1.34);
    ctx.quadraticCurveTo(r * 0.92, -r * 0.5, 0, -r * 0.6);
    ctx.quadraticCurveTo(-r * 0.92, -r * 0.5, -r * 0.74, r * 1.34);
    ctx.closePath();
  },
  // 5 — dégarni : deux golfes bien marqués.
  (ctx, r) => {
    ctx.moveTo(-r * 1.0, -r * 0.1);
    ctx.quadraticCurveTo(-r * 1.0, -r * 0.8, -r * 0.45, -r * 0.78);
    ctx.quadraticCurveTo(-r * 0.1, -r * 0.72, 0, -r * 0.95);
    ctx.quadraticCurveTo(r * 0.1, -r * 0.72, r * 0.45, -r * 0.78);
    ctx.quadraticCurveTo(r * 1.0, -r * 0.8, r * 1.0, -r * 0.1);
    ctx.quadraticCurveTo(r * 0.6, -r * 0.5, 0, -r * 0.5);
    ctx.quadraticCurveTo(-r * 0.6, -r * 0.5, -r * 1.0, -r * 0.1);
    ctx.closePath();
  },
  // 6 — banane gominée.
  (ctx, r) => {
    ctx.moveTo(-r * 1.0, -r * 0.2);
    ctx.quadraticCurveTo(-r * 1.1, -r * 1.1, -r * 0.2, -r * 1.15);
    ctx.quadraticCurveTo(r * 0.5, -r * 1.95, r * 0.95, -r * 1.15);
    ctx.quadraticCurveTo(r * 1.05, -r * 0.6, r * 1.0, -r * 0.2);
    ctx.quadraticCurveTo(0, -r * 0.6, -r * 1.0, -r * 0.2);
    ctx.closePath();
  },
  // 7 — queue de cheval.
  (ctx, r) => {
    ctx.moveTo(-r * 1.02, -r * 0.22);
    ctx.quadraticCurveTo(-r * 1.08, -r * 1.16, 0, -r * 1.16);
    ctx.quadraticCurveTo(r * 1.08, -r * 1.16, r * 1.02, -r * 0.22);
    ctx.quadraticCurveTo(0, -r * 0.68, -r * 1.02, -r * 0.22);
    ctx.closePath();
    // La queue part de l'arrière du crâne et retombe.
    ctx.moveTo(-r * 0.9, -r * 0.6);
    ctx.quadraticCurveTo(-r * 1.6, -r * 0.5, -r * 1.5, r * 0.5);
    ctx.quadraticCurveTo(-r * 1.42, r * 1.0, -r * 1.1, r * 0.9);
    ctx.quadraticCurveTo(-r * 1.16, r * 0.1, -r * 0.72, -r * 0.36);
    ctx.closePath();
  },
  // 8 — couettes.
  (ctx, r) => {
    ctx.moveTo(-r * 1.04, -r * 0.2);
    ctx.quadraticCurveTo(-r * 1.1, -r * 1.18, 0, -r * 1.18);
    ctx.quadraticCurveTo(r * 1.1, -r * 1.18, r * 1.04, -r * 0.2);
    ctx.quadraticCurveTo(0, -r * 0.6, -r * 1.04, -r * 0.2);
    ctx.closePath();
    for (const side of [-1, 1]) {
      ctx.moveTo(side * r * 1.34, -r * 0.3);
      ctx.ellipse(side * r * 1.2, -r * 0.34, r * 0.36, r * 0.5, side * 0.4, 0, Math.PI * 2);
    }
  },
  // 9 — bouclé volumineux, mi-long.
  (ctx, r) => {
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
  },
  // 10 — rasé sur les côtés, touffe sur le dessus.
  (ctx, r) => {
    ctx.moveTo(-r * 0.98, -r * 0.32);
    ctx.quadraticCurveTo(-r * 1.02, -r * 0.92, -r * 0.5, -r * 1.02);
    ctx.quadraticCurveTo(0, -r * 1.32, r * 0.72, -r * 1.0);
    ctx.quadraticCurveTo(r * 1.02, -r * 0.86, r * 0.98, -r * 0.32);
    ctx.quadraticCurveTo(r * 0.6, -r * 0.66, 0, -r * 0.66);
    ctx.quadraticCurveTo(-r * 0.6, -r * 0.66, -r * 0.98, -r * 0.32);
    ctx.closePath();
  },
  // 11 — tresses collées, quatre bandes.
  (ctx, r) => {
    ctx.moveTo(-r * 1.02, -r * 0.24);
    ctx.quadraticCurveTo(-r * 1.08, -r * 1.14, 0, -r * 1.14);
    ctx.quadraticCurveTo(r * 1.08, -r * 1.14, r * 1.02, -r * 0.24);
    ctx.quadraticCurveTo(0, -r * 0.66, -r * 1.02, -r * 0.24);
    ctx.closePath();
    // Les nattes retombent derrière les oreilles, pas sur la figure.
    for (const side of [-1, 1]) {
      for (let i = 0; i < 2; i++) {
        const x = side * r * (0.72 + i * 0.16);
        capsulePath(ctx, x, -r * 0.72, side * r * (1.06 + i * 0.1), r * (0.5 + i * 0.24),
          r * 0.11, r * 0.09);
      }
    }
  },
  // 12 — mulet : court devant, long derrière.
  (ctx, r) => {
    ctx.moveTo(-r * 1.02, -r * 0.24);
    ctx.quadraticCurveTo(-r * 1.1, -r * 1.16, 0, -r * 1.18);
    ctx.quadraticCurveTo(r * 1.1, -r * 1.14, r * 1.0, -r * 0.28);
    ctx.quadraticCurveTo(r * 0.66, -r * 0.62, r * 0.24, -r * 0.56);
    ctx.quadraticCurveTo(-r * 0.4, -r * 0.5, -r * 0.84, -r * 0.3);
    ctx.quadraticCurveTo(-r * 1.0, r * 0.5, -r * 1.34, r * 1.0);
    ctx.quadraticCurveTo(-r * 0.9, r * 1.1, -r * 0.74, r * 0.6);
    ctx.quadraticCurveTo(-r * 0.94, r * 0.1, -r * 1.02, -r * 0.24);
    ctx.closePath();
  },
  // 13 — cheveux plaqués en arrière.
  (ctx, r) => {
    ctx.moveTo(-r * 1.0, -r * 0.28);
    ctx.quadraticCurveTo(-r * 1.06, -r * 1.12, 0, -r * 1.12);
    ctx.quadraticCurveTo(r * 1.06, -r * 1.12, r * 1.0, -r * 0.28);
    ctx.quadraticCurveTo(r * 0.5, -r * 0.88, -r * 0.2, -r * 0.86);
    ctx.quadraticCurveTo(-r * 0.72, -r * 0.84, -r * 1.0, -r * 0.28);
    ctx.closePath();
  },
  // 14 — frange épaisse et droite.
  (ctx, r) => {
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
  },
  // 15 — dreads mi-longues.
  (ctx, r) => {
    ctx.moveTo(-r * 1.02, -r * 0.3);
    ctx.quadraticCurveTo(-r * 1.08, -r * 1.16, 0, -r * 1.16);
    ctx.quadraticCurveTo(r * 1.08, -r * 1.16, r * 1.02, -r * 0.3);
    ctx.quadraticCurveTo(0, -r * 0.7, -r * 1.02, -r * 0.3);
    ctx.closePath();
    // Idem : seules les mèches des côtés descendent.
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const x = side * r * (0.74 + i * 0.13);
        const y = -r * (0.62 - i * 0.24);
        capsulePath(ctx, x, y, x * 1.2, y + r * (0.9 + (i % 2) * 0.3), r * 0.13, r * 0.11);
      }
    }
  },
  // 16 — cheveux en bataille, mèches pointues.
  (ctx, r) => {
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
  },
  // 17 — mèche sur le côté, coupe nette.
  (ctx, r) => {
    ctx.moveTo(-r * 1.04, -r * 0.16);
    ctx.quadraticCurveTo(-r * 1.12, -r * 1.18, 0, -r * 1.18);
    ctx.quadraticCurveTo(r * 1.12, -r * 1.18, r * 1.04, -r * 0.16);
    ctx.quadraticCurveTo(r * 0.9, -r * 0.5, r * 0.4, -r * 0.56);
    ctx.quadraticCurveTo(-r * 0.4, -r * 0.66, -r * 0.86, -r * 0.86);
    ctx.quadraticCurveTo(-r * 1.0, -r * 0.6, -r * 1.04, -r * 0.16);
    ctx.closePath();
  },
];

/** Coiffures qui descendent derrière les épaules : à dessiner aussi en arrière-plan. */
export const HAIR_BEHIND = new Set([4, 9, 11, 12, 15]);

// --- Barbes et moustaches ---------------------------------------------------

export const BEARDS = [
  null,                                                     // 0 — rien
  // 1 — collier taillé, s'arrête sous la bouche.
  (ctx, r) => {
    ctx.moveTo(-r * 0.88, r * 0.02);
    ctx.quadraticCurveTo(-r * 0.8, r * 1.2, 0, r * 1.24);
    ctx.quadraticCurveTo(r * 0.8, r * 1.2, r * 0.88, r * 0.02);
    ctx.quadraticCurveTo(r * 0.66, r * 0.66, 0, r * 0.74);
    ctx.quadraticCurveTo(-r * 0.66, r * 0.66, -r * 0.88, r * 0.02);
    ctx.closePath();
  },
  // 2 — barbe pleine et longue.
  (ctx, r) => {
    ctx.moveTo(-r * 0.94, -r * 0.1);
    ctx.quadraticCurveTo(-r * 0.98, r * 1.5, 0, r * 1.7);
    ctx.quadraticCurveTo(r * 0.98, r * 1.5, r * 0.94, -r * 0.1);
    ctx.quadraticCurveTo(r * 0.6, r * 0.5, 0, r * 0.56);
    ctx.quadraticCurveTo(-r * 0.6, r * 0.5, -r * 0.94, -r * 0.1);
    ctx.closePath();
  },
  // 3 — bouc et moustache.
  (ctx, r) => {
    ctx.moveTo(-r * 0.34, r * 0.36);
    ctx.quadraticCurveTo(0, r * 0.24, r * 0.34, r * 0.36);
    ctx.quadraticCurveTo(r * 0.44, r * 1.02, 0, r * 1.14);
    ctx.quadraticCurveTo(-r * 0.44, r * 1.02, -r * 0.34, r * 0.36);
    ctx.closePath();
  },
  // 4 — moustache seule, large.
  (ctx, r) => {
    ctx.moveTo(-r * 0.5, r * 0.3);
    ctx.quadraticCurveTo(0, r * 0.14, r * 0.5, r * 0.3);
    ctx.quadraticCurveTo(r * 0.4, r * 0.5, 0, r * 0.44);
    ctx.quadraticCurveTo(-r * 0.4, r * 0.5, -r * 0.5, r * 0.3);
    ctx.closePath();
  },
  // 5 — moustache fine à la gauloise, qui redescend.
  (ctx, r) => {
    ctx.moveTo(-r * 0.46, r * 0.28);
    ctx.quadraticCurveTo(0, r * 0.16, r * 0.46, r * 0.28);
    ctx.quadraticCurveTo(r * 0.52, r * 0.78, r * 0.38, r * 0.82);
    ctx.quadraticCurveTo(r * 0.3, r * 0.44, 0, r * 0.38);
    ctx.quadraticCurveTo(-r * 0.3, r * 0.44, -r * 0.38, r * 0.82);
    ctx.quadraticCurveTo(-r * 0.52, r * 0.78, -r * 0.46, r * 0.28);
    ctx.closePath();
  },
  // 6 — barbe de trois jours dessinée : un contour bas et flou.
  (ctx, r) => {
    ctx.moveTo(-r * 0.86, r * 0.08);
    ctx.quadraticCurveTo(-r * 0.78, r * 0.98, 0, r * 1.06);
    ctx.quadraticCurveTo(r * 0.78, r * 0.98, r * 0.86, r * 0.08);
    ctx.quadraticCurveTo(r * 0.6, r * 0.56, 0, r * 0.62);
    ctx.quadraticCurveTo(-r * 0.6, r * 0.56, -r * 0.86, r * 0.08);
    ctx.closePath();
  },
  // 7 — favoris seuls, façon vieux monsieur.
  (ctx, r) => {
    for (const side of [-1, 1]) {
      ctx.moveTo(side * r * 0.94, -r * 0.28);
      ctx.quadraticCurveTo(side * r * 1.02, r * 0.5, side * r * 0.66, r * 0.62);
      ctx.quadraticCurveTo(side * r * 0.72, r * 0.05, side * r * 0.78, -r * 0.28);
      ctx.closePath();
    }
  },
];

/** Une barbe qui monte au-dessus de la bouche l'avalerait : on l'éclaircit. */
export const BEARD_COVERS_MOUTH = new Set([2, 3, 4, 5]);

// --- Hauts ------------------------------------------------------------------
//
// Un haut reçoit la géométrie du buste et dessine ce qui va PAR-DESSUS
// l'aplat de couleur : col, boutonnage, capuche, revers, bandes. Le corps du
// vêtement, lui, est déjà peint — c'est le torse.

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
];

// --- Bas --------------------------------------------------------------------

export const BOTTOMS = [
  { id: 'jean', label: 'Jean', length: 1, width: 1, seam: true, pockets: true },
  { id: 'chino', label: 'Chino', length: 1, width: 0.94 },
  { id: 'jogging', label: 'Jogging', length: 1, width: 1.12, stripe: true, cuff: true },
  { id: 'short', label: 'Short', length: 0.5, width: 1.1 },
  { id: 'jupe', label: 'Jupe', length: 0.42, width: 1.5, skirt: true },
  { id: 'large', label: 'Pantalon large', length: 1, width: 1.28 },
  { id: 'costume', label: 'Pantalon de costume', length: 1, width: 1.0, crease: true },
  { id: 'legging', label: 'Legging', length: 1, width: 0.82 },
  { id: 'bermuda', label: 'Bermuda', length: 0.66, width: 1.16, pockets: true },
];

// --- Chaussures -------------------------------------------------------------

export const SHOES = [
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
      roundRect(ctx, Math.min(x - 5 * side, x + 9.6 * side), y + 0.2,
        Math.abs(14.6), 2.6, 1.2);
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
      roundRect(ctx, Math.min(x - 5.4 * side, x + 10.4 * side), y - 1.4,
        15.8, 3, 1);
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
];

// --- Couvre-chefs -----------------------------------------------------------

export const HATS = [
  null,
  // 1 — casquette à visière.
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
  // 2 — bonnet, avec revers.
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
  // 3 — béret, penché.
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
  // 4 — bob.
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
  // 5 — foulard noué.
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
  // 6 — chapeau à bord.
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
];

// --- Motifs de tissu --------------------------------------------------------
//
// Un aplat uni pour tout le monde donne un immeuble en plastique. Trois
// motifs suffisent à casser ça, et ils sont peints dans le chemin déjà
// découpé du vêtement, donc ils ne débordent jamais.

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

// --- Accessoires ------------------------------------------------------------

// Cravate, tablier et badge ne s'attrapent pas au hasard : ils sont
// attribués par le métier, plus bas. Ici, seulement ce qu'on met le matin
// sans y penser.
export const ACCESSORIES = ['aucun', 'aucun', 'aucun', 'aucun', 'aucun',
  'echarpe', 'boucles', 'collier', 'montre', 'bretelles'];

// --- Composition ------------------------------------------------------------
//
// Un habitant tire une pièce dans chaque catalogue. Le tirage est stable
// (dérivé de l'identifiant), mais il n'est pas aveugle : l'âge, le genre, le
// métier et le caractère orientent le choix. Un plombier ne porte pas la
// même chose qu'une avocate, et un enfant ne porte pas de cravate.

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

  // — Teinte de peau et cheveux —
  const natural = PALETTE.hair.filter((c) => !GREY_HAIR.includes(c));
  let hair = pickStable(natural, `cheveux${id}`);
  if (person.age > 60 && hashPick(id * 29, 100) < (person.age - 55) * 5) {
    hair = person.age > 76 ? '#ded9d2' : pickStable(GREY_HAIR, `gris${id}`);
  }

  // — Visage —
  // Les mâchoires lourdes et les mentons en galoche vont aux visages âgés,
  // les rondes aux enfants : c'est ce qui fait qu'on devine l'âge de dos.
  const jawPrefs = child ? [4, 3] : old ? [2, 7, 5] : female ? [3, 4, 8] : [0, 6, 5];
  const eyePrefs = child ? [0, 4, 9] : old ? [6, 8, 2] : female ? [1, 7, 4] : [1, 3, 5];

  // — Garde-robe —
  // Le métier habille : on ne va pas au bureau en survêtement, et on ne
  // répare pas une chaudière en costume.
  const topPrefs = [];
  const bottomPrefs = [];
  const shoePrefs = [];
  if (child) {
    topPrefs.push(0, 7, 8);
    bottomPrefs.push(3, 2, 8);
    shoePrefs.push(0, 0);
  } else if (person.age < 20) {
    topPrefs.push(3, 8, 0);
    bottomPrefs.push(0, 2);
    shoePrefs.push(0, 0);
  } else if (old) {
    topPrefs.push(2, 11, 1);
    bottomPrefs.push(6, 1);
    shoePrefs.push(3, 2, 1);
  }
  if (female) {
    topPrefs.push(6, 9, 5);
    bottomPrefs.push(4, 7);
    shoePrefs.push(4, 2);
  }
  if (['avocat', 'banquier', 'cadre', 'notaire', 'medecin', 'prof'].includes(job)) {
    topPrefs.push(1, 4);
    bottomPrefs.push(6, 1);
    shoePrefs.push(2);
  }
  if (['plombier', 'macon', 'gardien', 'ouvrier', 'livreur', 'menuisier'].includes(job)) {
    topPrefs.push(0, 3);
    bottomPrefs.push(0, 5);
    shoePrefs.push(6, 0);
  }
  if ((P.rigueur ?? 0.5) > 0.7) topPrefs.push(1, 2);
  if ((P.ouverture ?? 0.5) > 0.72) topPrefs.push(4, 9);
  if ((P.extraversion ?? 0.5) < 0.3) topPrefs.push(2, 11);

  // Certaines pièces ne vont pas à tout le monde. On les retire du sac
  // AVANT le tirage plutôt que de corriger après : corriger après, c'est
  // se retrouver avec trois hommes en jupe sur les quatre-vingts habitants,
  // et le joueur ne voit que ça.
  const topPool = TOPS.map((_, i) => i).filter((i) => (female || !TOPS[i].dress));
  const bottomPool = BOTTOMS.map((_, i) => i)
    .filter((i) => (female || !BOTTOMS[i].skirt))
    .filter((i) => !(BOTTOMS[i].id === 'legging' && !female && !child));
  const shoePool = SHOES.map((_, i) => i).filter((i) => (female || i !== 4));

  const topIdx = preferred(id * 41 + 7, topPool, topPrefs);
  let bottomIdx = preferred(id * 53 + 11, bottomPool, bottomPrefs);
  const top = TOPS[topIdx];
  // Une robe se suffit à elle-même : en dessous, seulement des collants.
  if (top.dress) bottomIdx = 7;
  // Une salopette, c'est une bavette ET un pantalon : pas de short dessous.
  if (top.bib && BOTTOMS[bottomIdx].length < 1) bottomIdx = 0;

  const hairPrefs = female ? [1, 4, 2, 7, 9, 14] : [0, 10, 13, 16, 5, 6];
  if (child) hairPrefs.push(8, 16, 0);
  // Chignon et couettes : réservés. Un quinquagénaire à couettes, on ne
  // voit plus que lui, et la charte demande des habitants crédibles.
  const hairPool = HAIR.map((_, i) => i)
    .filter((i) => (female || child || (i !== 8 && i !== 2)))
    .filter((i) => !(i === 5 && (child || female || person.age < 30)));
  const hairStyle = preferred(id * 13 + 5, hairPool, hairPrefs);

  const beardable = !female && person.age > 19;
  let beard = 0;
  if (beardable) {
    const roll = hashPick(id * 19 + 7, 100);
    if (roll < 18) beard = 1;
    else if (roll < 26) beard = old ? 7 : 2;
    else if (roll < 36) beard = 3;
    else if (roll < 44) beard = old ? 4 : 5;
    else if (roll < 62) beard = 6;
  }

  const look = {
    morpho: key,
    proportions: m,
    skin: pickStable(PALETTE.skin, `peau${id}`),
    hair,
    hairStyle,
    beard,
    jaw: preferred(id * 31 + 4, JAWS.map((_, i) => i), jawPrefs),
    eyes: preferred(id * 23 + 3, EYES.map((_, i) => i), eyePrefs),
    nose: hashPick(id * 23 + 11, NOSES.length),
    mouth: preferred(id * 37 + 9, MOUTHS.map((_, i) => i), female ? [4, 5] : [0, 3, 7]),
    ears: hashPick(id * 41 + 9, 3),

    top,
    bottom: BOTTOMS[bottomIdx],
    shoe: SHOES[preferred(id * 67 + 5, shoePool, shoePrefs)],
    hat: null,
    accessory: ACCESSORIES[hashPick(id * 73 + 4, ACCESSORIES.length)],

    // Le corps : corpulence propre, en plus du gabarit.
    build: 0.86 + (hashPick(id * 3 + 1, 100) / 100) * 0.32,
    glasses: hashPick(id * 17 + 2, 100) < (old ? 46 : 18),
    shades: hashPick(id * 53 + 6, 100) < 6 && person.age > 14,
  };

  // Couleurs de vêtement : le haut franc, le bas plus sourd. C'est la règle
  // qui empêche l'immeuble de ressembler à un sachet de bonbons. Les
  // couleurs vivent sur l'habitant, jamais sur l'entrée de catalogue —
  // celle-ci est partagée par tout l'immeuble.
  look.topColor = pickStable(PALETTE.clothes, `haut${id}`);
  look.bottomColor = pickStable(PALETTE.trousers, `bas${id * 7 + 3}`);
  look.shoeColor = pickStable(PALETTE.leather, `pieds${id}`);
  look.pattern = PATTERNS[hashPick(id * 89 + 3, PATTERNS.length)];
  look.accentColor = pickStable(PALETTE.clothes, `accent${id * 3}`);

  // Couvre-chef : rare, mais net quand il est là.
  const hatRoll = hashPick(id * 61 + 3, 100);
  if (hatRoll < 5) look.hat = { draw: HATS[1], color: pickStable(PALETTE.clothes, `chapeau${id}`) };
  else if (hatRoll < 9) look.hat = { draw: HATS[2], color: pickStable(PALETTE.clothes, `chapeau${id}`) };
  else if (hatRoll < 11 && person.age > 55) look.hat = { draw: HATS[3], color: '#2f3742' };
  else if (hatRoll < 13) look.hat = { draw: HATS[4], color: pickStable(PALETTE.clothes, `chapeau${id}`) };
  else if (hatRoll < 15 && female) look.hat = { draw: HATS[5], color: pickStable(PALETTE.clothes, `chapeau${id}`) };
  else if (hatRoll < 17 && person.age > 45) look.hat = { draw: HATS[6], color: '#4a3a2c' };
  // Sous un couvre-chef, une coiffure volumineuse dépasse mal : on la range.
  if (look.hat && [2, 3, 6, 9, 16].includes(look.hairStyle)) look.hairStyle = 0;

  // Un enfant ne porte ni montre ni collier ni bretelles.
  if (child && ['montre', 'collier', 'bretelles'].includes(look.accessory)) {
    look.accessory = 'aucun';
  }
  if (look.accessory === 'collier' && !female && person.age > 30) look.accessory = 'aucun';
  if (look.accessory === 'bretelles' && person.age < 45) look.accessory = 'aucun';
  // Le métier passe avant l'humeur du matin.
  if (['cuisinier', 'boulanger', 'serveur'].includes(job)) look.accessory = 'tablier';
  if (['avocat', 'banquier', 'notaire', 'cadre'].includes(job) && !female) look.accessory = 'cravate';
  if (job === 'gardien') look.accessory = 'badge';

  person._look = look;
  return look;
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

// --- Détails de vêtement ----------------------------------------------------
//
// Ces fonctions sont appelées par character.js une fois le buste peint et
// découpé. Elles reçoivent la géométrie mesurée du torse, jamais des valeurs
// en dur : un enfant rondouillard et un senior voûté ont le même code.

export function drawTopDetails(ctx, look, geo) {
  const { shW, waW, hiW, shoulderY, waistY, hemY, B } = geo;
  const t = look.top;
  const c = look.topColor;

  // Motif du tissu, à l'intérieur du buste déjà découpé.
  paintPattern(ctx, look.pattern, c, -shW * 1.2, shoulderY, shW * 2.4, hemY - shoulderY);

  // Ombre douce, côté opposé à la lumière.
  const grad = ctx.createLinearGradient(-shW * 0.3, 0, shW * 1.1, 0);
  grad.addColorStop(0, rgba(shade(c, -0.45), 0));
  grad.addColorStop(1, rgba(shade(c, -0.45), 0.4));
  ctx.fillStyle = grad;
  ctx.fillRect(-shW * 1.3, shoulderY - 10, shW * 2.6, hemY - shoulderY + 20);

  // Poche kangourou du sweat.
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

  // Bandes latérales du survêtement.
  if (t.stripes) {
    ctx.fillStyle = rgba('#f3ece0', 0.85);
    for (const side of [-1, 1]) {
      ctx.fillRect(side * shW * 0.78 - 1.2, shoulderY + 8, 2.4, hemY - shoulderY - 6);
    }
  }

  // Bavette de la salopette : deux bretelles et une poche carrée.
  if (t.bib) {
    ctx.beginPath();
    roundRect(ctx, -waW * 0.62, waistY - 8, waW * 1.24, hemY - waistY + 6, 2);
    ctx.strokeStyle = rgba(shade(c, -0.55), 0.8);
    ctx.lineWidth = LINE * 0.75;
    ctx.stroke();
  }

  // Boutonnage : une ligne et trois points, ça suffit à lire « chemise ».
  if (t.buttons) {
    ink(ctx, LINE * 0.6);
    ctx.beginPath();
    ctx.moveTo(0, shoulderY + 6);
    ctx.lineTo(0, hemY - 2);
    ctx.strokeStyle = rgba(shade(c, -0.5), 0.85);
    ctx.stroke();
    ctx.fillStyle = rgba(shade(c, 0.55), 0.95);
    const n = t.id === 'polo' ? 2 : 4;
    for (let i = 0; i < n; i++) {
      ctx.beginPath();
      ctx.arc(0, shoulderY + 12 + i * ((hemY - shoulderY - 16) / n), 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Veste ou gilet ouvert : deux pans plus sombres et une chemise dessous.
  // Veste ou gilet ouvert : on voit le tee-shirt en dessous. Un rectangle
  // clair collé au milieu du torse ressemblait à une feuille de papier ;
  // il lui fallait une encolure et un bas arrondi pour devenir un vêtement.
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
}

/** Écharpe, cravate, collier, tablier : le détail qui fait le personnage. */
export function drawAccessory(ctx, look, geo) {
  const { shW, waW, shoulderY, waistY, hemY, B } = geo;
  switch (look.accessory) {
    case 'echarpe':
      solid(ctx, () => {
        roundRect(ctx, -shW * 0.72, shoulderY - 4, shW * 1.44, 9, 4);
      }, look.accentColor, true, LINE * 0.9);
      solid(ctx, () => {
        roundRect(ctx, -shW * 0.2, shoulderY + 2, 7, 22, 3);
      }, shade(look.accentColor, -0.12), true, LINE * 0.85);
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
    case 'collier':
      ctx.beginPath();
      ctx.moveTo(-4.6 * B, shoulderY + 1);
      ctx.quadraticCurveTo(0, shoulderY + 11, 4.6 * B, shoulderY + 1);
      ctx.strokeStyle = '#e0c07a';
      ctx.lineWidth = LINE * 0.55;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, shoulderY + 9.5, 1.9, 0, Math.PI * 2);
      ctx.fillStyle = '#e0c07a';
      ctx.fill();
      break;
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
    default:
      break;
  }
}

/** Montre et boucles d'oreille : deux touches, mais on les remarque. */
export function drawTinyAccessory(ctx, look, where, x, y, s) {
  if (where === 'poignet' && look.accessory === 'montre') {
    solid(ctx, () => {
      roundRect(ctx, x - s * 0.5, y - s * 0.9, s, s * 1.8, s * 0.3);
    }, '#3c4450', true, LINE * 0.55);
  }
  if (where === 'oreille' && look.accessory === 'boucles') {
    ctx.beginPath();
    ctx.arc(x, y, s * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = '#e0c07a';
    ctx.fill();
  }
}
