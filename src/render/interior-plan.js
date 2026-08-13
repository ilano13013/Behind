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
 * Les douze décors de la planche.
 *
 * Un appartement n'est pas décoré au hasard : il raconte QUI y vit. Le
 * studio de l'étudiant, le salon familial, la chambre d'ado, le repaire du
 * gamer, l'atelier de l'artiste, la colocation, le logement du retraité, le
 * bureau à domicile, la salle de sport improvisée, le couple sans enfant,
 * la cuisine populaire — et le logement vide, drap sur les meubles.
 */
export const ARCHETYPES = ['vide', 'studio_etudiant', 'salon_familial', 'cuisine_populaire',
  'chambre_ado', 'couple', 'retraite', 'gamer', 'artiste', 'colocation',
  'bureau_domicile', 'sport_maison'];

export function archetypeFor(world, apt, occupants) {
  if (!occupants.length) return 'vide';
  const adults = occupants.filter((p) => p.age >= 18);
  const kids = occupants.filter((p) => p.age < 12);
  const teens = occupants.filter((p) => p.age >= 12 && p.age < 20);
  const has = (fn) => occupants.some(fn);

  if (has((p) => p.job.id === 'artiste' || p.job.id === 'musicien')) return 'artiste';
  // Le gamer : jeune, seul, joueur invétéré.
  if (adults.length === 1 && !kids.length && adults[0].age < 38
    && adults[0].personality.get('ouverture') > 0.55
    && adults[0].personality.get('extraversion') < 0.45) return 'gamer';
  if (occupants.length === 1 && occupants[0].job.id === 'etudiant') return 'studio_etudiant';
  if (teens.length && !kids.length && occupants.length <= 3) return 'chambre_ado';
  if (has((p) => p.job.remote)) return 'bureau_domicile';
  if (has((p) => p.personality.has('travailleur') && p.personality.get('anxiete') < 0.4
    && p.age >= 18 && p.age < 55 && (p.id % 5 === 0))) return 'sport_maison';
  if (occupants.every((p) => p.isOld)) return 'retraite';
  // La colocation : des adultes sans lien de famille.
  if (adults.length >= 2 && !kids.length
    && adults.every((a) => a === adults[0] || !a.relations.get(adults[0].id, false)?.isFamily)
    && !adults.some((a) => a.relations.partner())) return 'colocation';
  if (kids.length) return occupants.length >= 4 ? 'cuisine_populaire' : 'salon_familial';
  if (adults.length === 2) return 'couple';
  return 'salon_familial';
}

/** Ce que chaque décor pose dans la pièce, en plus des affaires de chacun. */
const ARCHETYPE_PROPS = {
  vide: ['drap_meuble', 'cartons'],
  studio_etudiant: ['cartons', 'livres'],
  salon_familial: ['jouets', 'panier_linge'],
  cuisine_populaire: ['casseroles', 'epices', 'panier_linge'],
  chambre_ado: ['ampli', 'skate'],
  couple: ['bouquet'],
  retraite: ['napperon', 'tricot'],
  gamer: ['double_ecran', 'led', 'manettes'],
  artiste: ['toiles'],
  colocation: ['bouteilles', 'chaussures_tas'],
  bureau_domicile: ['ordinateur', 'imprimante'],
  sport_maison: ['velo_appart', 'halteres', 'tapis_yoga'],
};

/**
 * Ce que les habitants laissent traîner.
 *
 * Le décor d'abord (qui vit là), puis les affaires de chacun (ce qu'ils
 * font de leurs journées) : on doit pouvoir deviner tout ça sans lire la
 * moindre fiche.
 */
export function propsFor(world, apt, occupants) {
  const key = occupants.map((p) => p.id).join(',');
  if (apt._propsKey === key) return apt._props;

  const archetype = archetypeFor(world, apt, occupants);
  const props = [...(ARCHETYPE_PROPS[archetype] ?? [])];
  const has = (fn) => occupants.some(fn);
  const add = (p) => { if (!props.includes(p)) props.push(p); };

  if (has((p) => p.job.id === 'musicien')) add('guitare');
  if (has((p) => p.job.id === 'artiste')) add('chevalet');
  if (has((p) => p.personality.has('bricoleur'))) add('etabli');
  if (has((p) => p.personality.has('cuisinier_ne'))) add('casseroles');
  if (has((p) => p.personality.get('ouverture') > 0.68)) add('livres');
  if (has((p) => p.age < 10)) add('jouets');
  if (has((p) => p.age < 2)) add('berceau');
  if (has((p) => p.addiction > 0.35)) add('bouteilles');
  if (has((p) => p.isOld)) add('napperon');
  if (has((p) => p.tags.has('crise'))) add('courrier');
  if (has((p) => p.personality.has('organise'))) add('tableau');
  if (has((p) => p.job.id === 'chomage')) add('ordinateur');

  // Les très rares de la planche : un canard en plastique dans une salle de
  // bain de l'immeuble, une licorne gonflable dans un salon. À découvrir.
  if ((apt.id * 31 + apt.floor * 7) % 97 === 3) add('canard');
  if ((apt.id * 53 + apt.col * 11) % 131 === 8) add('licorne');

  apt._archetype = archetype;
  apt._propsKey = key;
  apt._props = props;
  return props;
}
