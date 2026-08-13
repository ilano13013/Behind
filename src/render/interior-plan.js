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
 * Les quarante décors de l'asset bible.
 *
 * Un appartement n'est pas décoré au hasard : il raconte QUI y vit. Chaque
 * décor est déduit d'un fait vérifiable de la simulation — un métier, un
 * défaut de caractère, une composition de foyer, une dette, un âge — jamais
 * d'un tirage. Un décor qu'aucune règle ne peut atteindre serait un mensonge
 * dans le catalogue d'images ; tools/test-look.js vérifie qu'ils sortent
 * tous au moins une fois sur un immeuble simulé.
 *
 * L'ordre de ce tableau EST l'ordre de priorité : le plus spécifique gagne.
 * Un tatoueur bohème avec un aquarium est d'abord un tatoueur.
 */
export const ARCHETYPE_RULES = [
  // --- 1. L'état du logement prime sur qui l'occupe ---
  ['vide', (o) => !o.length],
  ['squat', (o, c) => c.dettes > 900 && c.pauvres >= 1],
  ['en_renovation', (o, c) => c.bricoleurs > 0 && c.desordre > 0.45],
  ['airbnb', (o, c) => o.length >= 2 && c.arrives < 20 && !c.familles],

  // --- 2. Le métier, quand il déborde sur le logement ---
  ['tatoueur', (o, c) => c.job('artiste') && c.tatoues >= 1],
  ['coiffeur', (o, c) => c.job('coiffeur')],
  ['musicien', (o, c) => c.job('musicien')],
  ['psychologue', (o, c) => c.job('infirmier') && c.calme],
  // Aucun agent de sécurité dans cet immeuble ? Alors c'est la discipline
  // qui fait le militaire, pas la fiche de paie.
  ['militaire', (o, c) => c.job('agent_secu')
    || (o.length <= 2 && c.rigueur > 0.86 && c.has((p) => p.personality.has('courageux')))],
  ['artiste', (o, c) => c.job('artiste')],
  ['bureau_domicile', (o, c) => c.remote],

  // --- 3. Les foyers qu'on reconnaît au premier coup d'œil ---
  ['couple_toxique', (o, c) => o.length <= 3 && c.tension > 0.28],
  ['famille_recomposee', (o, c) => c.enfants >= 1 && c.demiFreres],
  ['etudiant_erasmus', (o, c) => o.length === 1 && c.job('etudiant') && c.arrives < 20],
  ['studio_etudiant', (o, c) => o.length === 1 && c.job('etudiant')],
  ['jeune_parent', (o, c) => c.bebes > 0],
  ['colocation', (o, c) => c.coloc],
  ['fete_permanente', (o, c) => o.length >= 2 && c.extraversion > 0.62 && c.age < 36],

  // --- 4. Le caractère poussé jusqu'au décor ---
  ['accumulateur', (o, c) => c.desordre > 0.62 && c.age > 38],
  ['ultra_propre', (o, c) => c.organises === o.length && c.rigueur > 0.78],
  ['minimaliste', (o, c) => o.length === 1 && c.rigueur > 0.78 && c.depense < 0.28],
  ['collectionneur', (o, c) => c.has((p) => p.personality.has('tetu')) && c.age > 45],
  ['rempli_de_plantes', (o, c) => c.plantes >= 3 && c.ouverture > 0.52],
  ['aquariums', (o, c) => c.has((p) => p.personality.has('patient') && p.personality.has('discret'))],
  ['tres_religieux', (o, c) => c.has((p) => p.personality.has('fidele')) && c.age > 52],
  ['boheme', (o, c) => c.ouverture > 0.78],
  ['brocante', (o, c) => c.has((p) => p.personality.has('radin')) && c.age > 50],

  // --- 5. Les passions, qui passent avant le foyer ordinaire ---
  ['fan_de_foot', (o, c) => c.has((p) => p.personality.has('bruyant') && p.gender === 'm' && p.age >= 16)],
  ['fan_de_mangas', (o, c) => c.has((p) => p.age >= 13 && p.age < 30 && p.personality.has('discret'))],
  ['gamer', (o, c) => o.length <= 2 && c.age < 38 && c.ouverture > 0.55 && c.extraversion < 0.45],
  ['influenceur', (o, c) => c.age < 34 && c.has((p) => p.personality.has('orgueilleux') && p.age < 34)],
  ['ancien_boxeur', (o, c) => c.has((p) => p.age > 50 && p.gender === 'm'
    && (p.personality.has('courageux') || p.personality.has('tetu')))],
  ['sport_maison', (o, c) => c.has((p) => p.personality.has('travailleur') && p.age < 55 && p.id % 5 === 0)],

  // --- 6. Le foyer ordinaire ---
  ['chambre_ado', (o, c) => c.ados > 0 && !c.enfants && o.length <= 3],
  ['retraite', (o) => o.every((p) => p.isOld)],
  ['cuisine_populaire', (o, c) => c.enfants > 0 && o.length >= 4],
  ['salon_familial', (o, c) => c.enfants > 0],
  ['couple', (o, c) => o.length === 2 && c.enCouple],

  // --- 7. Faute de mieux, la forme du logement ---
  ['micro_appartement', (o, c) => c.pieces <= 1],
  ['loft_industriel', (o, c) => c.pieces >= 4 && c.riches],
];

export const ARCHETYPES = ARCHETYPE_RULES.map(([id]) => id);

/** Les faits sur lesquels les règles s'appuient, calculés une seule fois. */
function contexte(world, apt, occupants) {
  const has = (fn) => occupants.some(fn);
  const moyenne = (fn) => (occupants.length
    ? occupants.reduce((s, p) => s + fn(p), 0) / occupants.length : 0);
  const adultes = occupants.filter((p) => p.age >= 18);

  // Depuis combien de temps le plus récent est-il là ? Un Airbnb, c'est
  // exactement ça : des gens qui viennent d'arriver et qui repartiront.
  const arrives = occupants.length
    ? Math.min(...occupants.map((p) => (world.clock.tick - (p.movedInTick ?? 0)) / 288))
    : 9999;

  // Une brouille sous le même toit, c'est un couple toxique, pas un couple.
  let tension = 0;
  for (const a of occupants) {
    for (const b of occupants) {
      if (a === b) continue;
      tension = Math.max(tension, a.relations.get(b.id, false)?.tension ?? 0);
    }
  }

  const enfants = occupants.filter((p) => p.age < 12).length;
  // Une famille recomposée, ce n'est pas « des demi-frères » — c'est un
  // enfant qui vit sous le même toit qu'un adulte qui n'est pas son parent.
  // Cherchée par les demi-frères, elle ne sortait jamais : les enfants nés
  // dans l'immeuble ont tous les deux mêmes parents.
  const adultesTous = occupants.filter((p) => p.age >= 20);
  const demiFreres = occupants.some((enf) => {
    if (enf.age >= 18) return false;
    const sesParents = new Set(enf.relations.parents().map((r) => r.other));
    if (!sesParents.size) return false;
    return adultesTous.some((a) => !sesParents.has(a.id)
      && a.relations.get(enf.id, false)?.isFamily !== true);
  });

  return {
    has,
    job: (id) => has((p) => p.job.id === id),
    remote: has((p) => p.job.remote),
    age: moyenne((p) => p.age),
    rigueur: moyenne((p) => p.personality.get('rigueur')),
    ouverture: moyenne((p) => p.personality.get('ouverture')),
    extraversion: moyenne((p) => p.personality.get('extraversion')),
    depense: moyenne((p) => p.personality.depense),
    desordre: moyenne((p) => (p.personality.has('desordonne') ? 1 : 0) * 0.7
      + (p.personality.has('paresseux') ? 0.3 : 0)),
    organises: occupants.filter((p) => p.personality.has('organise')).length,
    bricoleurs: occupants.filter((p) => p.personality.has('bricoleur')).length,
    // Le tatouage vit dans l'apparence, qui n'est calculée qu'au dessin :
    // hors navigateur elle n'existe pas. On rejoue donc le même tirage.
    tatoues: occupants.filter((p) => p.age >= 18 && p.age < 60 && p.id % 9 === 4).length,
    calme: moyenne((p) => p.personality.get('amabilite')) > 0.55,
    plantes: apt.plants ?? 0,
    pieces: apt.rooms ?? 2,
    riches: moyenne((p) => p.money) > 2600,
    pauvres: occupants.filter((p) => p.money < 220).length,
    dettes: occupants.reduce((s, p) => s + p.debt, 0),
    enfants,
    bebes: occupants.filter((p) => p.age < 3).length,
    ados: occupants.filter((p) => p.age >= 12 && p.age < 20).length,
    familles: occupants.some((p) => occupants.some((q) => q !== p
      && p.relations.get(q.id, false)?.isFamily)),
    demiFreres,
    tension,
    arrives,
    // partner() rend une RELATION, pas un identifiant. Comparer les deux
    // donnait toujours faux, et le décor « couple » ne sortait jamais.
    enCouple: adultes.length === 2
      && adultes.some((a) => a.relations.partner()?.other === adultes.find((b) => b !== a)?.id),
    coloc: adultes.length >= 2 && enfants === 0
      && adultes.every((a) => a === adultes[0] || !a.relations.get(adultes[0].id, false)?.isFamily)
      && !adultes.some((a) => a.relations.partner()),
  };
}

export function archetypeFor(world, apt, occupants) {
  const c = contexte(world, apt, occupants);
  for (const [id, test] of ARCHETYPE_RULES) {
    if (test(occupants, c)) return id;
  }
  return 'salon_familial';
}

/** Ce que chaque décor pose dans la pièce, en plus des affaires de chacun. */
const ARCHETYPE_PROPS = {
  vide: ['drap_meuble', 'cartons'],
  squat: ['cartons', 'bouteilles', 'clutter'],
  en_renovation: ['etabli', 'cartons', 'toiles'],
  airbnb: ['valises', 'napperon'],
  tatoueur: ['etabli', 'toiles'],
  coiffeur: ['miroir_pro', 'produits'],
  musicien: ['guitare', 'ampli'],
  psychologue: ['livres', 'divan'],
  militaire: ['cartons', 'halteres'],
  artiste: ['chevalet', 'toiles'],
  bureau_domicile: ['ordinateur', 'imprimante'],
  accumulateur: ['cartons', 'clutter', 'livres', 'bouteilles'],
  ultra_propre: ['produits'],
  minimaliste: [],
  collectionneur: ['vitrine', 'livres'],
  rempli_de_plantes: ['jungle'],
  aquariums: ['aquarium'],
  tres_religieux: ['napperon', 'vitrine'],
  boheme: ['tapis_mural', 'guitare', 'jungle'],
  brocante: ['vitrine', 'cartons', 'napperon'],
  fan_de_foot: ['echarpe_club', 'ecran_geant'],
  fan_de_mangas: ['figurines', 'livres'],
  gamer: ['double_ecran', 'led', 'manettes'],
  influenceur: ['ring_light', 'led'],
  ancien_boxeur: ['sac_frappe', 'vitrine'],
  sport_maison: ['velo_appart', 'halteres', 'tapis_yoga'],
  couple_toxique: ['bouteilles', 'clutter'],
  famille_recomposee: ['jouets', 'panier_linge', 'cartons'],
  etudiant_erasmus: ['valises', 'cartons', 'livres'],
  studio_etudiant: ['cartons', 'livres'],
  chambre_ado: ['ampli', 'skate'],
  jeune_parent: ['berceau', 'panier_linge', 'jouets'],
  colocation: ['bouteilles', 'chaussures_tas'],
  fete_permanente: ['bouteilles', 'led', 'ampli'],
  retraite: ['napperon', 'tricot'],
  cuisine_populaire: ['casseroles', 'epices', 'panier_linge'],
  salon_familial: ['jouets', 'panier_linge'],
  couple: ['bouquet'],
  micro_appartement: ['cartons'],
  loft_industriel: ['toiles', 'vitrine'],
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
