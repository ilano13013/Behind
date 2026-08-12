// Le plan d'un appartement.
//
// Tous les logements se ressemblaient : mêmes meubles, mêmes places, dans
// le même ordre de gauche à droite, seules les couleurs changeaient. Au
// bout de cinq fenêtres on avait tout vu.
//
// Ici, chaque appartement tire une fois pour toutes son propre plan : une
// disposition parmi plusieurs, un sens de lecture, des meubles en
// variantes, et surtout des objets qui appartiennent à ses habitants — la
// guitare du musicien, l'établi du bricoleur, les jouets des enfants, les
// bouteilles de celui qui boit trop.

import { RNG } from '../core/rng.js';

/**
 * Dispositions possibles, en bandes de gauche à droite.
 * Le studio n'a pas de chambre séparée ; la grande famille a une penderie
 * là où le célibataire a un bureau.
 */
const ARRANGEMENTS = [
  ['entree', 'cuisine', 'table', 'salon', 'fenetre', 'lit', 'bain'],
  ['entree', 'salon', 'fenetre', 'table', 'cuisine', 'lit', 'bain'],
  ['entree', 'lit', 'salon', 'fenetre', 'table', 'cuisine', 'bain'],
  ['bain', 'cuisine', 'fenetre', 'table', 'salon', 'lit', 'entree'],
  ['entree', 'table', 'cuisine', 'fenetre', 'salon', 'lit', 'bain'],
];

/** Meubles secondaires : tout le monde n'a pas les mêmes. */
export const EXTRAS = ['bibliotheque', 'penderie', 'bureau', 'commode', 'buffet'];

/**
 * Le plan, calculé une fois et gardé sur l'appartement.
 * Tout est tiré d'une graine dérivée de l'identifiant : le même logement
 * garde son plan pendant toute la partie, et deux parties différentes ne
 * donnent pas le même immeuble.
 */
export function planFor(apt) {
  if (apt._plan) return apt._plan;
  const rng = new RNG(`plan-${apt.id}-${apt.floor}-${apt.col}`);

  const studio = apt.rooms <= 1;
  const grand = apt.rooms >= 3;

  const order = rng.pick(studio ? ARRANGEMENTS.slice(0, 3) : ARRANGEMENTS);
  const mirror = rng.chance(0.45);

  // On répartit les bandes sur la largeur, avec des largeurs inégales :
  // une salle de bain prend moins de place qu'un salon.
  const weights = {
    entree: 0.7, cuisine: 1.25, table: 1.05, salon: 1.5,
    fenetre: 0.95, lit: 1.2, bain: 0.6,
  };
  const total = order.reduce((s, z) => s + weights[z], 0);
  const zones = {};
  let cursor = 0;
  for (const z of order) {
    const w = weights[z] / total;
    const centre = cursor + w / 2;
    zones[z] = mirror ? 1 - centre : centre;
    cursor += w;
  }

  const plan = {
    order,
    mirror,
    zones,
    studio,
    // Variantes de mobilier.
    sofa: rng.int(0, 2),          // 0 deux places, 1 d'angle, 2 deux fauteuils
    bed: studio ? rng.int(1, 2) : rng.int(0, 1), // 0 double, 1 simple, 2 clic-clac
    table: rng.int(0, 2),         // 0 rectangulaire, 1 ronde, 2 bistrot
    kitchen: rng.int(0, 1),
    rug: rng.int(0, 2),
    tv: rng.chance(0.82),
    extras: rng.pickMany(EXTRAS, grand ? rng.int(1, 2) : rng.int(0, 1)),
    wallDecor: rng.int(0, 3),     // cadres, affiches, horloge, miroir
    wallpaper: rng.int(0, 3),
    lampStyle: rng.int(0, 1),
    // Décalages pour que deux plans identiques ne soient jamais superposables.
    jitter: Array.from({ length: 8 }, () => rng.float(-0.012, 0.012)),
  };
  apt._plan = plan;
  return plan;
}

/**
 * Ce que les habitants laissent traîner.
 *
 * C'est ce qui différencie deux appartements bien plus sûrement que la
 * couleur du canapé : on doit pouvoir deviner qui vit là sans lire la fiche.
 */
export function propsFor(world, apt, occupants) {
  const key = occupants.map((p) => p.id).join(',');
  if (apt._propsKey === key) return apt._props;

  const props = [];
  const has = (fn) => occupants.some(fn);

  if (has((p) => p.job.id === 'musicien')) props.push('guitare');
  if (has((p) => p.job.id === 'artiste')) props.push('chevalet');
  if (has((p) => p.personality.has('bricoleur'))) props.push('etabli');
  if (has((p) => p.personality.has('cuisinier_ne'))) props.push('casseroles');
  if (has((p) => p.personality.get('ouverture') > 0.68)) props.push('livres');
  if (has((p) => p.age < 10)) props.push('jouets');
  if (has((p) => p.age < 2)) props.push('berceau');
  if (has((p) => p.addiction > 0.35)) props.push('bouteilles');
  if (has((p) => p.job.id === 'etudiant')) props.push('cartons');
  if (has((p) => p.isOld)) props.push('napperon');
  if (has((p) => p.tags.has('crise'))) props.push('courrier');
  if (has((p) => p.personality.has('organise'))) props.push('tableau');
  if (has((p) => p.job.id === 'chomage')) props.push('ordinateur');

  apt._propsKey = key;
  apt._props = props;
  return props;
}
