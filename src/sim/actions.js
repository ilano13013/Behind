// Catalogue d'actions.
//
// Aucune action n'est imposée à personne. Chacune sait dire « à quel point
// j'ai du sens pour cette personne, maintenant, ici » ; l'IA compare et
// choisit. Changer la personnalité d'un habitant change sa journée entière
// sans qu'une seule ligne de scénario n'ait été écrite.

import { speech } from '../content/lines.js';
import { isWorkTime } from '../content/jobs.js';
import { LINK } from './relations.js';

/** Sucre : besoin comblé par tick. */
const R = (o) => o;

const HOME = 'home';
const OUT = 'dehors';
const WORK = 'travail';

/**
 * Une action.
 * @typedef {object} ActionDef
 * @property {string} id
 * @property {string} label      texte affiché ("dort", "fait la vaisselle")
 * @property {string} place      où elle se déroule
 * @property {[number,number]} dur durée en ticks (min, max)
 * @property {object} rates      besoins comblés par tick
 * @property {number} noise      0..1 bruit produit pour les voisins
 * @property {(p, c) => boolean} avail
 * @property {(p, c) => number} bonus  utilité qui ne vient pas des besoins
 */
export const ACTIONS = [
  {
    id: 'dormir',
    label: 'dort',
    place: HOME,
    dur: [40, 90],
    rates: R({ energie: 1.5, hygiene: -0.02, social: -0.02 }),
    noise: 0,
    interruptible: false,
    avail: (p, c) => c.atHome && !c.mustWork,
    bonus: (p, c) => {
      let b = 0;
      const h = c.clock.hour;
      if (h >= 23 || h < 6) b += 2.4;
      else if (h >= 21) b += 0.7;
      else if (h >= 13 && h < 15) b += 0.25; // la sieste est une institution
      else b -= 1.4;
      if (p.job.nightShift) b -= h >= 23 || h < 6 ? 2.2 : -1.0;
      b += p.personality.t('paresseux', 0.35);
      b -= p.personality.t('insomniaque', 0.55);
      if (p.stress > 70) b -= 0.4; // on ne dort pas quand ça tourne dans la tête
      return b;
    },
  },
  {
    id: 'insomnie',
    label: 'ne dort pas',
    place: HOME,
    dur: [8, 22],
    rates: R({ energie: 0.18, plaisir: -0.04 }),
    noise: 0.05,
    avail: (p, c) => c.atHome && c.clock.isNight && (p.stress > 55 || p.personality.has('insomniaque')),
    bonus: (p) => 0.5 + p.stress / 90 + p.personality.t('insomniaque', 0.9),
    speech: 'stresse',
  },
  {
    id: 'manger',
    label: 'mange',
    place: HOME,
    dur: [4, 8],
    rates: R({ faim: 6.5, plaisir: 0.25 }),
    noise: 0.05,
    avail: (p, c) => c.atHome,
    bonus: (p, c) => {
      const h = c.clock.hour;
      let b = 0;
      if (h >= 12 && h < 14) b += 1.1;
      if (h >= 19 && h < 22) b += 1.2;
      if (h >= 7 && h < 9) b += 0.7;
      return b;
    },
    speech: 'manger',
  },
  {
    id: 'cuisiner',
    label: 'cuisine',
    place: HOME,
    dur: [7, 14],
    rates: R({ faim: 4.2, plaisir: 0.5, confort: -0.1 }),
    noise: 0.15,
    avail: (p, c) => c.atHome && p.money > 20,
    bonus: (p, c) => {
      let b = p.personality.t('cuisinier_ne', 1.1) - p.personality.t('paresseux', 0.5);
      const h = c.clock.hour;
      if (h >= 11 && h < 14) b += 0.9;
      if (h >= 18 && h < 21) b += 1.2;
      if (c.others.length) b += 0.5; // on cuisine mieux pour quelqu'un
      return b;
    },
    speech: 'cuisiner',
  },
  {
    id: 'douche',
    label: 'prend une douche',
    place: HOME,
    dur: [3, 6],
    rates: R({ hygiene: 9, plaisir: 0.4, energie: 0.2 }),
    noise: 0.12,
    avail: (p, c) => c.atHome,
    bonus: (p, c) => (c.clock.hour >= 6 && c.clock.hour < 9 ? 0.9 : 0.1)
      + p.personality.t('organise', 0.3),
    speech: 'douche',
  },
  {
    id: 'menage',
    label: 'fait le ménage',
    place: HOME,
    dur: [8, 20],
    rates: R({ confort: 3.2, energie: -0.35, plaisir: -0.15 }),
    noise: 0.3,
    avail: (p, c) => c.atHome && !c.clock.isNight,
    bonus: (p) => p.personality.t('organise', 1.2) - p.personality.t('paresseux', 0.8)
      + p.personality.get('rigueur') * 0.6,
    speech: 'menage',
  },
  {
    id: 'tv',
    label: 'regarde la télé',
    place: HOME,
    dur: [10, 30],
    rates: R({ plaisir: 1.3, energie: 0.1, social: 0.12 }),
    noise: 0.25,
    tv: true,
    avail: (p, c) => c.atHome,
    bonus: (p, c) => 0.35 + (c.clock.hour >= 20 ? 0.7 : 0)
      + p.personality.t('paresseux', 0.4) + (p.age > 60 ? 0.4 : 0),
    speech: 'tv',
  },
  {
    id: 'musique',
    label: 'écoute de la musique',
    place: HOME,
    dur: [8, 24],
    rates: R({ plaisir: 1.5, energie: 0.05 }),
    noise: 0.6,
    music: true,
    avail: (p, c) => c.atHome,
    bonus: (p) => 0.3 + p.personality.t('bruyant', 0.9) + p.personality.get('ouverture') * 0.5
      + (p.job.id === 'musicien' ? 1.2 : 0),
    speech: 'musique',
  },
  {
    id: 'jeu',
    label: 'joue',
    place: HOME,
    dur: [12, 36],
    rates: R({ plaisir: 1.8, energie: -0.1, social: 0.15 }),
    noise: 0.3,
    avail: (p, c) => c.atHome && p.age < 45,
    bonus: (p) => (p.age < 25 ? 1.1 : 0.3) + p.personality.get('ouverture') * 0.4,
    speech: 'jeu',
  },
  {
    id: 'lire',
    label: 'lit',
    place: HOME,
    dur: [10, 26],
    rates: R({ plaisir: 1.0, energie: 0.15 }),
    noise: 0,
    avail: (p, c) => c.atHome,
    bonus: (p) => 0.15 + p.personality.get('ouverture') * 0.8 + p.personality.t('discret', 0.4),
    speech: 'lecture',
  },
  {
    id: 'sport',
    label: 'fait du sport',
    place: HOME,
    dur: [5, 12],
    rates: R({ plaisir: 0.6, energie: -0.7, hygiene: -0.7 }),
    noise: 0.35,
    health: 0.02,
    avail: (p, c) => c.atHome && p.age < 65 && p.needs.get('energie') > 35,
    bonus: (p) => p.personality.get('rigueur') * 0.7 - p.personality.t('paresseux', 0.9)
      + (p.ambition?.id === 'sante' ? 0.6 : 0),
    speech: 'sport',
  },
  {
    id: 'bricoler',
    label: 'bricole',
    place: HOME,
    dur: [10, 28],
    rates: R({ confort: 1.6, plaisir: 0.8, energie: -0.25 }),
    noise: 0.75,
    avail: (p, c) => c.atHome && !c.clock.isNight,
    bonus: (p) => p.personality.t('bricoleur', 1.5) - 0.4,
    speech: 'bricolage',
  },
  {
    id: 'travailler',
    label: 'travaille',
    place: WORK,
    dur: [20, 60],
    rates: R({ energie: -0.32, social: 0.25, plaisir: -0.12, faim: -0.05 }),
    noise: 0,
    avail: (p, c) => c.mustWork && !p.job.remote,
    bonus: () => 6, // on ne discute pas avec le patron
  },
  {
    id: 'teletravail',
    label: 'télétravaille',
    place: HOME,
    dur: [16, 40],
    rates: R({ energie: -0.22, plaisir: -0.1, social: -0.08 }),
    noise: 0.05,
    avail: (p, c) => c.mustWork && p.job.remote && c.atHome,
    bonus: () => 5.5,
    speech: 'travail',
  },
  {
    id: 'chercher_emploi',
    label: 'cherche du travail',
    place: HOME,
    dur: [8, 18],
    rates: R({ plaisir: -0.5, energie: -0.15 }),
    noise: 0,
    avail: (p, c) => c.atHome && p.job.id === 'chomage' && !c.clock.isNight && p.age < 63,
    bonus: (p) => 0.9 + p.personality.serieux * 1.2 - p.stress / 120,
    speech: 'stresse',
  },
  {
    id: 'ecole',
    label: 'est à l\'école',
    place: WORK,
    dur: [30, 50],
    rates: R({ social: 0.5, energie: -0.2, plaisir: -0.05 }),
    noise: 0,
    avail: (p, c) => p.isChild && c.mustWork,
    bonus: () => 6,
  },
  {
    id: 'sortir',
    label: 'est sorti',
    place: OUT,
    dur: [16, 48],
    rates: R({ plaisir: 1.5, social: 1.2, energie: -0.2, faim: -0.05 }),
    noise: 0,
    cost: 22,
    avail: (p, c) => !c.mustWork && p.age >= 15 && p.money > 30 && !c.isVisiting,
    bonus: (p, c) => {
      let b = p.personality.sociabilite * 1.3 - 0.4;
      if (c.clock.isWeekend) b += 0.7;
      if (c.clock.hour >= 20 && p.age < 40) b += 0.6;
      if (c.clock.isNight && p.age > 55) b -= 1.2;
      b -= p.personality.depense < 0.3 ? 0.5 : 0;
      return b;
    },
    speech: 'heureux',
  },
  {
    id: 'courses',
    label: 'fait les courses',
    place: OUT,
    dur: [8, 16],
    rates: R({ energie: -0.15, plaisir: -0.05 }),
    noise: 0,
    cost: 45,
    avail: (p, c) => !c.mustWork && p.age >= 15 && p.money > 60 && !c.clock.isNight && !c.isVisiting,
    bonus: (p) => (p.needs.get('faim') < 45 ? 1.4 : 0.15) + p.personality.t('organise', 0.4),
  },
  {
    id: 'promener',
    label: 'marche dehors',
    place: OUT,
    dur: [8, 20],
    rates: R({ plaisir: 0.8, energie: -0.1, social: 0.3 }),
    noise: 0,
    avail: (p, c) => !c.mustWork && !c.clock.isNight && p.age >= 12 && !c.isVisiting,
    bonus: (p) => 0.25 + (p.isOld ? 0.7 : 0) + (p.stress > 60 ? 0.6 : 0),
  },
  {
    id: 'rien',
    label: 'ne fait rien',
    place: HOME,
    dur: [4, 12],
    rates: R({ plaisir: 0.1, energie: 0.25 }),
    noise: 0,
    avail: (p, c) => c.atHome,
    bonus: () => 0.12,
    speech: 'ennui',
  },
  {
    id: 'ruminer',
    label: 'rumine',
    place: HOME,
    dur: [6, 16],
    rates: R({ plaisir: -0.5, energie: -0.05 }),
    noise: 0,
    avail: (p, c) => c.atHome && (p.mood < 38 || p.stress > 68),
    bonus: (p) => (p.mood < 30 ? 1.0 : 0.2) + p.personality.get('anxiete') * 0.8
      - p.personality.resilience * 0.5,
    speech: 'triste',
  },
  {
    id: 'boire',
    label: 'boit un peu trop',
    place: HOME,
    dur: [8, 20],
    rates: R({ plaisir: 1.4, energie: -0.2, hygiene: -0.2 }),
    noise: 0.2,
    health: -0.03,
    cost: 12,
    avail: (p, c) => c.atHome && p.age > 18 && (p.addiction > 0.1 || p.stress > 72),
    bonus: (p) => p.addiction * 2.2 + (p.stress > 75 ? 0.8 : 0) - p.personality.get('rigueur') * 0.4,
    onEnd: (p) => {
      p.addiction = Math.min(1, p.addiction + 0.012);
    },
  },
  {
    id: 'soigner',
    label: 'se soigne',
    place: HOME,
    dur: [6, 14],
    rates: R({ energie: 0.5, plaisir: -0.1 }),
    noise: 0,
    health: 0.06,
    avail: (p, c) => c.atHome && p.health < 72,
    bonus: (p) => (100 - p.health) / 45 - p.personality.t('orgueilleux', 0.5),
    speech: 'malade',
  },
  {
    id: 'telephoner',
    label: 'téléphone',
    place: HOME,
    dur: [4, 10],
    rates: R({ social: 2.6, plaisir: 0.3 }),
    noise: 0.15,
    avail: (p, c) => c.atHome && p.age > 10,
    bonus: (p) => 0.2 + p.personality.sociabilite * 0.5,
    speech: 'telephone',
  },
  {
    id: 'espionner',
    label: 'observe le palier',
    place: HOME,
    dur: [3, 8],
    rates: R({ plaisir: 0.8, social: 0.4 }),
    noise: 0,
    avail: (p, c) => c.atHome,
    bonus: (p) => p.personality.curiosite * 1.4 - 0.75 + p.personality.t('commere', 0.6),
    speech: 'espionnage',
    social: 'gossip',
  },

  // --- Actions sociales : elles ont besoin de quelqu'un d'autre ---
  {
    id: 'visiter',
    label: 'rend visite',
    place: 'visite',
    dur: [12, 30],
    rates: R({ social: 2.2, plaisir: 1.0 }),
    noise: 0.25,
    needsTarget: 'ami',
    avail: (p, c) => c.atHome && !c.mustWork && !c.isVisiting && c.socialTargets.length > 0,
    bonus: (p, c) => 0.3 + p.personality.sociabilite * 1.0
      + (c.clock.hour >= 17 && c.clock.hour < 23 ? 0.5 : -0.3),
    speech: 'invite',
  },
  {
    id: 'fete',
    label: 'reçoit du monde',
    place: HOME,
    dur: [24, 60],
    rates: R({ social: 2.4, plaisir: 2.2, energie: -0.3, confort: -0.4 }),
    noise: 1.0,
    party: true,
    cost: 60,
    avail: (p, c) => c.atHome && !c.mustWork && p.age >= 17 && p.money > 90
      && c.clock.hour >= 18 && c.socialTargets.length >= 2,
    bonus: (p, c) => (c.clock.isWeekend ? 1.0 : -0.6) + p.personality.get('extraversion') * 1.4
      + p.personality.t('bruyant', 0.8) - 1.1,
    speech: 'fete',
  },
  {
    id: 'plaindre',
    label: 'va se plaindre du bruit',
    place: 'visite',
    dur: [2, 5],
    rates: R({ plaisir: -0.2 }),
    noise: 0.4,
    needsTarget: 'bruyant',
    // On ne monte pas se plaindre au premier bruit : il faut que ça dure,
    // et il faut ne pas l'avoir déjà fait avant-hier.
    avail: (p, c) => c.atHome && c.noisyNeighbours.length > 0
      && c.clock.tick - (p.lastComplaint ?? -9999) > 288 * 4
      && p.externalStress > 22,
    bonus: (p, c) => {
      const worst = c.noisyNeighbours[0];
      // Le voisin entend le bruit atténué par un mur, comme dans la vraie vie.
      const excess = worst.noise * 0.75 - p.personality.toleranceBruit;
      if (excess <= 0) return -5;
      if (worst.apt.noiseStreak < 12) return -5; // moins d'une heure : on laisse couler
      return -0.6 + excess * 4 + p.personality.irritabilite * 1.2
        + (c.clock.isNight ? 2.2 : 0);
    },
    speech: 'plainte',
    conflict: true,
  },
  {
    id: 'confronter',
    label: 'va s\'expliquer',
    place: 'visite',
    dur: [3, 8],
    rates: R({ plaisir: -0.3, energie: -0.2 }),
    noise: 0.55,
    needsTarget: 'tendu',
    avail: (p, c) => c.atHome && !c.isVisiting && c.tenseTargets.length > 0,
    bonus: (p, c) => {
      const t = c.tenseTargets[0];
      return (t.rel.tension - 0.62) * 4 + p.personality.irritabilite * 1.0 - 1.4;
    },
    speech: 'dispute',
    conflict: true,
  },
  {
    id: 'reconcilier',
    label: 'tend la main',
    place: 'visite',
    dur: [4, 10],
    rates: R({ social: 1.2, plaisir: 0.4 }),
    needsTarget: 'brouille',
    noise: 0.1,
    avail: (p, c) => c.atHome && !c.isVisiting && c.reconcileTargets.length > 0,
    bonus: (p, c) => {
      const t = c.reconcileTargets[0];
      return p.personality.pardon * 1.8 + t.rel.familiarity * 0.8
        + (t.rel.isFamily ? 1.0 : 0) - 1.2;
    },
    speech: 'invite',
  },
  {
    id: 'flirter',
    label: 'tourne autour de quelqu\'un',
    place: 'visite',
    dur: [6, 16],
    rates: R({ social: 1.6, plaisir: 1.4 }),
    needsTarget: 'flirt',
    noise: 0.05,
    avail: (p, c) => c.atHome && !c.isVisiting && p.age >= 16 && c.romanceTargets.length > 0,
    bonus: (p, c) => {
      const t = c.romanceTargets[0];
      return t.rel.romance * 2.4 + p.personality.romantisme * 1.2 - 0.9
        + (p.needs.get('social') < 45 ? 0.4 : 0);
    },
    speech: 'flirt',
  },
  {
    id: 'famille_temps',
    label: 's\'occupe des siens',
    place: HOME,
    dur: [8, 20],
    rates: R({ social: 1.8, plaisir: 0.7, energie: -0.15 }),
    noise: 0.2,
    needsTarget: 'foyer',
    avail: (p, c) => c.atHome && c.householdTargets.length > 0,
    bonus: (p, c) => 0.5 + p.personality.get('amabilite') * 0.9
      + (c.householdTargets.some((t) => t.person.isChild) ? 0.9 : 0)
      + p.personality.t('protecteur', 0.7),
  },
  {
    id: 'betise',
    label: 'fait une bêtise',
    place: HOME,
    dur: [3, 8],
    rates: R({ plaisir: 2.4, confort: -1.2 }),
    noise: 0.7,
    avail: (p, c) => c.atHome && p.age < 13,
    bonus: (p) => 0.6 + p.personality.get('ouverture') * 1.2 - p.personality.get('rigueur') * 0.8,
    speech: 'betise',
  },
];

export const ACTION_BY_ID = new Map(ACTIONS.map((a) => [a.id, a]));

/** Instancie une action pour une personne (durée tirée, cible fixée). */
export function instantiate(def, person, ctx, target = null) {
  const dur = Math.max(1, Math.round(ctx.rng.int(def.dur[0], def.dur[1])
    * (def.id === 'dormir' ? (person.isChild ? 1.15 : person.isOld ? 0.8 : 1) : 1)));
  const line = def.speech ? speech(def.speech, ctx.rng) : null;
  return {
    id: def.id,
    def,
    label: def.label,
    remaining: dur,
    total: dur,
    place: def.place,
    target: target?.person?.id ?? null,
    targetName: target?.person?.shortName ?? null,
    line,
  };
}

/** Contexte de décision : tout ce que la personne « perçoit » à cet instant. */
export function buildContext(person, world) {
  const clock = world.clock;
  const apt = world.apartments[person.apartment];
  const atHome = person.location === 'home';
  const mustWork = isWorkTime(person.job, clock) && person.health > 45;

  const household = apt ? apt.residents.filter((r) => r !== person.id) : [];
  const householdTargets = household
    .map((id) => ({ person: world.people.get(id) }))
    .filter((t) => t.person && t.person.alive && t.person.location === 'home');

  // Cibles sociales : les gens qu'on connaît un peu et qui sont chez eux.
  const socialTargets = [];
  const romanceTargets = [];
  const tenseTargets = [];
  const reconcileTargets = [];
  for (const rel of person.relations.all()) {
    const other = world.people.get(rel.other);
    if (!other || !other.alive) continue;
    const home = other.location === 'home' && other.apartment !== null;
    // On ne remonte pas s'expliquer tous les jours : il faut laisser
    // retomber, sinon l'immeuble ne fait plus que ça.
    const cooled = clock.tick - rel.lastConflict > 288 * 4;
    if (rel.tension > 0.68 && home && cooled) tenseTargets.push({ person: other, rel });
    if (rel.tension > 0.35 && rel.affinity > -0.2 && rel.familiarity > 0.25 && cooled) {
      reconcileTargets.push({ person: other, rel });
    }
    if (!home) continue;
    if (rel.affinity > 0.25 && !rel.isFamily) socialTargets.push({ person: other, rel });
    if (rel.romance > 0.2 && other.age >= 16 && Math.abs(other.age - person.age) < 22) {
      romanceTargets.push({ person: other, rel });
    }
  }
  socialTargets.sort((a, b) => b.rel.affinity - a.rel.affinity);
  romanceTargets.sort((a, b) => b.rel.romance - a.rel.romance);
  tenseTargets.sort((a, b) => b.rel.tension - a.rel.tension);
  reconcileTargets.sort((a, b) => b.rel.familiarity - a.rel.familiarity);

  // Voisins bruyants : perçus seulement si on est chez soi.
  const noisyNeighbours = [];
  if (atHome && apt) {
    for (const nid of apt.neighbours) {
      const n = world.apartments[nid];
      if (!n || n.noise < 0.35) continue;
      const culprit = n.residents
        .map((id) => world.people.get(id))
        .find((r) => r && r.alive && r.location === 'home');
      if (culprit) noisyNeighbours.push({ person: culprit, noise: n.noise, apt: n });
    }
    noisyNeighbours.sort((a, b) => b.noise - a.noise);
  }

  return {
    clock,
    world,
    apt,
    atHome,
    mustWork,
    isVisiting: typeof person.location === 'number',
    rng: world.rng,
    others: householdTargets,
    householdTargets,
    socialTargets,
    romanceTargets,
    tenseTargets,
    reconcileTargets,
    noisyNeighbours,
  };
}

const TARGET_POOL = {
  ami: (c) => c.socialTargets,
  flirt: (c) => c.romanceTargets,
  tendu: (c) => c.tenseTargets,
  brouille: (c) => c.reconcileTargets,
  bruyant: (c) => c.noisyNeighbours,
  foyer: (c) => c.householdTargets,
};

/**
 * Le cœur de l'autonomie.
 * On note toutes les actions possibles, on garde les meilleures, on tire
 * parmi elles — le bruit est faible, pour que le comportement reste lisible
 * et attribuable à la personnalité plutôt qu'au hasard.
 */
export function chooseAction(person, ctx) {
  const scored = [];
  for (const def of ACTIONS) {
    if (!def.avail(person, ctx)) continue;

    // Utilité venant des besoins : ce que l'action comble × à quel point ça manque.
    let score = 0;
    for (const [need, rate] of Object.entries(def.rates)) {
      if (rate <= 0) {
        // Une action qui vide un besoin déjà bas devient repoussante.
        score += rate * 0.35 * (1 + person.needs.urgency(need) * 3);
        continue;
      }
      score += person.needs.urgency(need) * Math.min(rate, 3) * 1.5;
    }

    score += def.bonus(person, ctx);

    // On ne dépense pas ce qu'on n'a pas, et la radinerie freine.
    if (def.cost) {
      if (person.money < def.cost) continue;
      score -= (def.cost / 100) * (1.4 - person.personality.depense);
      if (person.money < def.cost * 4) score -= 0.8;
    }
    // La santé fragilise les sorties.
    if (def.place === OUT && person.health < 55) score -= 1.2;
    // Un enfant ne sort pas seul.
    if (def.place === OUT && person.age < 12) continue;

    // Inertie : on ne change pas d'avis toutes les cinq minutes.
    if (person.lastActionId === def.id) score -= 0.35;

    let target = null;
    if (def.needsTarget) {
      const pool = TARGET_POOL[def.needsTarget](ctx);
      if (!pool || !pool.length) continue;
      target = pool[0];
    }

    score += (ctx.rng.next() - 0.5) * 0.45;
    if (score > 0) scored.push({ def, score, target });
  }

  if (!scored.length) {
    const fallback = ACTION_BY_ID.get('rien');
    return instantiate(fallback, person, ctx);
  }

  scored.sort((a, b) => b.score - a.score);
  // Tirage doux parmi les trois meilleures : deux journées ne sont jamais
  // identiques, mais elles restent cohérentes avec la personne.
  const pool = scored.slice(0, 3);
  const chosen = ctx.rng.weighted(pool, (s) => Math.pow(Math.max(0.01, s.score), 2.5));
  person.lastActionId = chosen.def.id;
  return instantiate(chosen.def, person, ctx, chosen.target);
}
