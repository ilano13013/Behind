// L'immeuble.
//
// On ne pose pas des habitants dans des cases : on installe des foyers,
// avec des liens qui existaient déjà avant l'arrivée du joueur. Le premier
// jour d'une partie, l'immeuble a déjà trente ans d'histoires derrière lui.

import { makeResident, pickJob } from './resident.js';
import { makePersonality, compatibility } from './traits.js';
import { LINK } from './relations.js';
import { rentFor } from '../content/jobs.js';
import { pickSurname, pickFirstName } from '../content/names.js';
import { STUDENT, RETIRED, CHILD_JOB, UNEMPLOYED, KEEPER } from '../content/jobs.js';

export const HOUSEHOLD_TYPES = [
  { id: 'solo_jeune', w: 14, rooms: [1, 2] },
  { id: 'solo_age', w: 12, rooms: [1, 3] },
  { id: 'solo_adulte', w: 13, rooms: [1, 2] },
  { id: 'couple', w: 14, rooms: [2, 3] },
  { id: 'famille', w: 18, rooms: [3, 4] },
  { id: 'monoparent', w: 10, rooms: [2, 3] },
  { id: 'coloc', w: 9, rooms: [2, 4] },
  { id: 'fratrie', w: 4, rooms: [2, 3] },
  { id: 'couple_age', w: 6, rooms: [2, 3] },
];

export const SPECIAL_UNITS = {
  HALL: 'hall',
  LOGE: 'loge',
  COMMERCE: 'commerce',
  ESCALIER: 'escalier',
};

/** Fabrique la grille d'appartements. */
export function makeApartments(rng, floors, cols) {
  const apartments = [];
  let id = 0;
  for (let f = 0; f < floors; f++) {
    for (let c = 0; c < cols; c++) {
      const apt = {
        id: id++,
        floor: f,
        col: c,
        special: null,
        rooms: 2,
        rent: 0,
        residents: [],
        neighbours: [],
        // état vivant
        noise: 0,
        lightOn: false,
        tvOn: false,
        musicOn: false,
        curtains: rng.chance(0.24) ? 'closed' : 'open',
        condition: rng.float(0.5, 1),
        vacantSince: null,
        hidden: false,
        sealed: false,
        haunted: false,
        ghostFlicker: 0,
        mourningUntil: 0,
        // décor
        balcony: false,
        style: rng.int(0, 5),
        plants: rng.int(0, 3),
        laundry: false,
        dish: rng.chance(0.22),
        flag: rng.chance(0.05),
        blinds: rng.chance(0.18),
        gag: rng.chance(0.12) ? rng.int(0, 7) : null,
      };
      apartments.push(apt);
    }
  }

  // Rez-de-chaussée : hall, loge, commerce. Un immeuble n'est pas un tableur.
  const ground = apartments.filter((a) => a.floor === 0);
  if (ground.length >= 4) {
    const hallCol = Math.floor(cols / 2);
    for (const a of ground) {
      if (a.col === hallCol) a.special = SPECIAL_UNITS.HALL;
      else if (a.col === 0) a.special = SPECIAL_UNITS.LOGE;
      else if (a.col >= cols - 2) {
        a.special = SPECIAL_UNITS.COMMERCE;
        // Le rez-de-chaussée fait partie du quartier : un immeuble avec une
        // boulangerie ne vit pas comme un immeuble avec une laverie.
        a.commerce = rng.pick(['cafe', 'pharmacie', 'boulangerie', 'tabac',
          'salon_coiffure', 'laverie', 'salle_de_sport', 'supermarche',
          'ecole', 'bibliotheque']);
      }
    }
  }
  // Une cage d'escalier verticale, visible de l'extérieur.
  const stairCol = cols >= 6 ? Math.floor(cols / 2) : -1;
  for (const a of apartments) {
    if (a.col === stairCol && a.floor > 0) a.special = SPECIAL_UNITS.ESCALIER;
  }

  // Balcons : par étage, une bande sur deux, plus quelques exceptions.
  for (const a of apartments) {
    if (a.special) continue;
    a.balcony = a.floor > 0 && (a.floor % 2 === 1 || rng.chance(0.2));
    a.laundry = a.balcony && rng.chance(0.4);
  }

  // Voisinage : mitoyens, dessus, dessous. La géographie du conflit.
  const at = (f, c) => apartments.find((a) => a.floor === f && a.col === c);
  for (const a of apartments) {
    if (a.special) continue;
    for (const [df, dc] of [[0, -1], [0, 1], [1, 0], [-1, 0]]) {
      const n = at(a.floor + df, a.col + dc);
      if (n && !n.special) a.neighbours.push(n.id);
    }
  }

  // Surfaces : plus grand en bas, chambres de bonne sous les toits.
  for (const a of apartments) {
    if (a.special) {
      a.rooms = 0;
      continue;
    }
    if (a.floor === floors - 1) a.rooms = rng.int(1, 2);
    else if (a.floor <= 2) a.rooms = rng.int(2, 4);
    else a.rooms = rng.int(1, 4);
    a.rent = rentFor(a, floors);
  }

  return apartments;
}

/** Peuple un appartement d'un foyer cohérent. */
export function populateApartment(rng, apt, world, forcedType = null) {
  const taken = new Set([...world.people.values()].map((p) => p.firstName));
  const surname = pickSurname(rng);
  const people = [];

  const pool = HOUSEHOLD_TYPES.filter((t) => apt.rooms >= t.rooms[0] && apt.rooms <= t.rooms[1] + 1);
  const type = forcedType ?? (rng.weighted(pool.length ? pool : HOUSEHOLD_TYPES, (t) => t.w)?.id ?? 'solo_adulte');

  const mk = (opts) => {
    const r = makeResident(rng, { ...opts, taken, apartment: apt.id });
    taken.add(r.firstName);
    people.push(r);
    return r;
  };

  switch (type) {
    case 'solo_jeune': {
      const a = mk({ age: rng.int(19, 29), lastName: surname });
      if (rng.chance(0.4)) a.job = STUDENT;
      break;
    }
    case 'solo_age': {
      const a = mk({ age: rng.int(66, 89), lastName: surname, job: RETIRED });
      a.tags.add(rng.chance(0.5) ? 'veuf' : 'solitaire');
      break;
    }
    case 'solo_adulte':
      mk({ age: rng.int(30, 60), lastName: surname });
      break;
    case 'couple':
    case 'couple_age': {
      const base = type === 'couple_age' ? rng.int(62, 84) : rng.int(24, 55);
      const a = mk({ age: base, lastName: surname, gender: rng.chance(0.5) ? 'f' : 'm' });
      const b = mk({
        age: Math.max(19, base + rng.int(-6, 6)),
        lastName: rng.chance(0.65) ? surname : pickSurname(rng),
        gender: a.gender === 'f' ? 'm' : 'f',
      });
      if (type === 'couple_age') {
        a.job = RETIRED;
        b.job = RETIRED;
      }
      coupleUp(a, b, rng, type === 'couple_age' ? 0.9 : 0.7);
      break;
    }
    case 'famille': {
      const pa = rng.int(29, 48);
      const a = mk({ age: pa, lastName: surname, gender: 'f' });
      const b = mk({ age: pa + rng.int(-5, 6), lastName: surname, gender: 'm' });
      coupleUp(a, b, rng, 0.65);
      const nKids = Math.min(apt.rooms, rng.int(1, 3));
      const kids = [];
      for (let i = 0; i < nKids; i++) {
        const kidAge = rng.int(0, Math.max(1, Math.min(19, pa - 22)));
        const k = mk({
          age: kidAge,
          lastName: surname,
          job: kidAge < 15 ? CHILD_JOB : (kidAge < 19 ? STUDENT : undefined),
        });
        kids.push(k);
        familyLink(a, k, LINK.ENFANT);
        familyLink(b, k, LINK.ENFANT);
      }
      for (let i = 0; i < kids.length; i++) {
        for (let j = i + 1; j < kids.length; j++) familyLink(kids[i], kids[j], LINK.FRATRIE, LINK.FRATRIE);
      }
      a.tags.add('parent');
      b.tags.add('parent');
      break;
    }
    case 'monoparent': {
      const pa = rng.int(27, 47);
      const a = mk({ age: pa, lastName: surname, gender: rng.chance(0.75) ? 'f' : 'm' });
      a.tags.add('parent');
      a.tags.add('solo');
      const nKids = Math.min(apt.rooms, rng.int(1, 2));
      for (let i = 0; i < nKids; i++) {
        const kidAge = rng.int(1, Math.max(2, Math.min(18, pa - 20)));
        const k = mk({ age: kidAge, lastName: surname, job: kidAge < 15 ? CHILD_JOB : STUDENT });
        familyLink(a, k, LINK.ENFANT);
      }
      break;
    }
    case 'coloc': {
      const n = Math.min(3, Math.max(2, apt.rooms - 1));
      const mates = [];
      for (let i = 0; i < n; i++) {
        mates.push(mk({ age: rng.int(19, 32), lastName: pickSurname(rng) }));
      }
      for (let i = 0; i < mates.length; i++) {
        for (let j = i + 1; j < mates.length; j++) {
          const ra = mates[i].relations.get(mates[j].id);
          const rb = mates[j].relations.get(mates[i].id);
          ra.type = LINK.COLOC;
          rb.type = LINK.COLOC;
          const compat = compatibility(mates[i].personality, mates[j].personality);
          ra.affinity = compat * 0.5;
          rb.affinity = compat * 0.5;
          ra.familiarity = 0.7;
          rb.familiarity = 0.7;
          // Deux colocataires incompatibles, c'est une sitcom qui commence.
          if (compat < -0.2) {
            ra.tension = 0.35;
            rb.tension = 0.35;
          }
        }
      }
      break;
    }
    case 'fratrie': {
      const surname2 = surname;
      const a = mk({ age: rng.int(20, 34), lastName: surname2 });
      const b = mk({ age: rng.int(19, 34), lastName: surname2 });
      familyLink(a, b, LINK.FRATRIE, LINK.FRATRIE);
      break;
    }
    default:
      mk({ age: rng.int(25, 60), lastName: surname });
  }

  for (const p of people) world.addResident(p, apt.id);
  apt.vacantSince = null;
  return people;
}

function coupleUp(a, b, rng, strength) {
  const ra = a.relations.get(b.id);
  const rb = b.relations.get(a.id);
  const married = rng.chance(strength);
  ra.type = married ? LINK.MARIE : LINK.COUPLE;
  rb.type = ra.type;
  const compat = compatibility(a.personality, b.personality);
  ra.affinity = 0.45 + compat * 0.35;
  rb.affinity = 0.45 + compat * 0.35;
  ra.romance = rng.float(0.45, 0.9);
  rb.romance = ra.romance * rng.float(0.8, 1.1);
  ra.familiarity = 1;
  rb.familiarity = 1;
  ra.trust = 0.5 + compat * 0.3;
  rb.trust = ra.trust;
  // Des couples usés existent : ils étaient déjà tendus avant nous.
  const wear = Math.max(0, -compat) * rng.float(0.3, 0.8);
  ra.tension = wear;
  rb.tension = wear;
  ra.interactions = rng.int(60, 400);
  rb.interactions = ra.interactions;
  if (married) {
    a.tags.add('marie');
    b.tags.add('marie');
  }
}

function familyLink(a, b, typeAtoB, typeBtoA = null) {
  const inverse = typeBtoA ?? (typeAtoB === LINK.ENFANT ? LINK.PARENT : LINK.ENFANT);
  const ra = a.relations.get(b.id);
  const rb = b.relations.get(a.id);
  ra.type = typeAtoB;
  rb.type = inverse;
  ra.affinity = 0.55;
  rb.affinity = 0.55;
  ra.familiarity = 1;
  rb.familiarity = 1;
  ra.trust = 0.6;
  rb.trust = 0.6;
}

/**
 * Histoire d'avant la partie.
 * On tisse des liens de voisinage plausibles : les gens d'un même palier se
 * connaissent, les anciens connaissent tout le monde, et quelques inimitiés
 * traînent déjà depuis des années.
 */
export function seedHistory(rng, world) {
  const people = world.livingPeople();
  for (const a of people) {
    const apt = world.apartments[a.apartment];
    if (!apt) continue;
    for (const nid of apt.neighbours) {
      const n = world.apartments[nid];
      for (const bid of n.residents) {
        const b = world.people.get(bid);
        if (!b || b.id === a.id || a.relations.has(b.id)) continue;
        const compat = compatibility(a.personality, b.personality);
        const years = Math.min(a.age, b.age, rng.float(0.5, 14));
        const rel = a.relations.get(b.id);
        const rel2 = b.relations.get(a.id);
        rel.type = LINK.VOISIN;
        rel2.type = LINK.VOISIN;
        const fam = Math.min(0.85, 0.15 + years * 0.05);
        rel.familiarity = fam;
        rel2.familiarity = fam;
        rel.affinity = compat * 0.4 * (0.5 + fam);
        rel2.affinity = rel.affinity;
        rel.interactions = Math.round(years * 12);
        rel2.interactions = rel.interactions;
        // Les vieux contentieux de palier : le socle comique de l'immeuble.
        if (compat < -0.25 && rng.chance(0.5)) {
          const t = rng.float(0.25, 0.6);
          rel.tension = t;
          rel2.tension = t;
          const grief = rng.pick([
            'l\'histoire des poubelles',
            'l\'histoire de la place de parking',
            'l\'histoire du vélo dans le couloir',
            'l\'histoire de la fête de 2019',
            'l\'histoire du chien',
            'l\'histoire de la fuite jamais réparée',
          ]);
          a.remember({ kind: 'vieux.contentieux', text: `${grief}, avec ${b.shortName}`, valence: -0.6, strength: 0.7, about: b.id, tick: 0, core: true });
          b.remember({ kind: 'vieux.contentieux', text: `${grief}, avec ${a.shortName}`, valence: -0.55, strength: 0.65, about: a.id, tick: 0, core: true });
        } else if (compat > 0.35 && rng.chance(0.5)) {
          rel.affinity = Math.min(1, rel.affinity + 0.25);
          rel2.affinity = rel.affinity;
          rel.type = LINK.AMI;
          rel2.type = LINK.AMI;
          a.remember({ kind: 'vieille.amitie', text: `des années de café avec ${b.shortName}`, valence: 0.7, strength: 0.7, about: b.id, tick: 0, core: true });
          b.remember({ kind: 'vieille.amitie', text: `des années de café avec ${a.shortName}`, valence: 0.7, strength: 0.7, about: a.id, tick: 0, core: true });
        }
      }
    }
  }

  // La gardienne (ou le gardien) connaît tout le monde. Par définition.
  const loge = world.apartments.find((a) => a.special === 'loge');
  if (loge && loge.residents.length) {
    const keeper = world.people.get(loge.residents[0]);
    if (keeper) {
      keeper.job = { ...KEEPER };
      keeper.tags.add('gardien');
      world.keeperId = keeper.id;
      for (const p of world.livingPeople()) {
        if (p.id === keeper.id) continue;
        const rel = keeper.relations.get(p.id);
        const rel2 = p.relations.get(keeper.id);
        rel.familiarity = Math.max(rel.familiarity, 0.75);
        rel2.familiarity = Math.max(rel2.familiarity, 0.6);
        rel.type = rel.type === LINK.INCONNU ? LINK.CONNAISSANCE : rel.type;
        rel2.type = rel2.type === LINK.INCONNU ? LINK.CONNAISSANCE : rel2.type;
      }
    }
  }

  // Une doyenne qui espionne le palier : elle sait déjà des choses sur tout
  // le monde, et elle a bien l'intention de les répéter.
  const elders = world.livingPeople().filter((p) => p.age > 72 && p.personality.curiosite > 0.4);
  const doyenne = rng.pick(elders);
  if (doyenne) {
    doyenne.tags.add('oeilleton');
    doyenne.personality.tags.add('commere');
    doyenne.personality.tags.add('curieux');
    world.doyenneId = doyenne.id;
  }
}
