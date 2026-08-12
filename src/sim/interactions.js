// Interactions.
//
// Ce qui se passe réellement quand deux habitants se retrouvent dans la
// même pièce. Le résultat n'est jamais tiré au sort tout seul : il dépend
// de la compatibilité, de l'humeur du jour, de ce que chacun garde en
// mémoire de l'autre, et de ce que les autres ont raconté.

import { compatibility, traitLabel } from './traits.js';
import { LINK } from './relations.js';
import { TONE } from '../core/events.js';
import { speech, distortRumour, GOSSIP_SEEDS } from '../content/lines.js';
import { g } from '../core/text.js';

/** Note de rencontre : à quel point ce moment s'est bien passé. -1..1 */
export function encounterQuality(a, b, world) {
  const compat = compatibility(a.personality, b.personality);
  const relA = a.relations.get(b.id);
  const memFeel = a.memory.feelingToward(b.id);

  let q = compat * 0.5 + relA.affinity * 0.25 + memFeel * 0.2;
  // L'humeur du jour compte : on est injuste quand on va mal.
  q += (a.mood - 55) / 260;
  q += (b.mood - 55) / 300;
  q -= a.stress / 340;
  q -= relA.tension * 0.6;
  // Un ancien conflit non digéré empoisonne tout.
  const scar = a.memory.strongestAbout(b.id);
  if (scar && scar.valence < -0.4) q -= scar.intensity * 0.5;
  q += (world.rng.next() - 0.5) * 0.25;
  return Math.max(-1, Math.min(1, q));
}

/** Applique une rencontre réussie ou ratée aux deux carnets de relations. */
export function applyEncounter(a, b, quality, world, kind = 'visite') {
  const relA = a.relations.get(b.id);
  const relB = b.relations.get(a.id);
  const tick = world.clock.tick;

  const gain = quality * 0.09;
  relA.adjust({ affinity: gain, familiarity: 0.05, trust: gain * 0.6 });
  relB.adjust({ affinity: gain * 0.85, familiarity: 0.05, trust: gain * 0.5 });
  relA.interactions++;
  relB.interactions++;
  relA.lastInteraction = tick;
  relB.lastInteraction = tick;

  if (quality < -0.35) {
    relA.adjust({ tension: 0.12 });
    relB.adjust({ tension: 0.1 });
  } else if (quality > 0.4) {
    relA.adjust({ tension: -0.08 });
    relB.adjust({ tension: -0.07 });
  }

  // L'attirance ne sort pas de nulle part : elle pousse dans les rencontres
  // réussies entre deux personnes libres et d'âges compatibles. C'est le
  // seul endroit du jeu où l'amour commence.
  if (quality > 0.25 && !relA.isFamily && a.age >= 16 && b.age >= 16) {
    const gapOk = Math.abs(a.age - b.age) <= 8 + Math.min(a.age, b.age) * 0.22;
    const bothFree = !a.relations.partner() && !b.relations.partner();
    if (gapOk && bothFree) {
      relA.adjust({ romance: quality * 0.1 * (0.4 + a.personality.romantisme) });
      relB.adjust({ romance: quality * 0.09 * (0.4 + b.personality.romantisme) });
      if (relA.romance > 0.3 && relA.romance < 0.36 && world.rng.chance(0.4)) {
        world.beat({
          kind: 'romance.regard',
          text: `${a.shortName} et ${b.shortName} se sont croisés dans l'escalier. Personne n'a rien dit. Ça compte quand même.`,
          tone: TONE.TENDRE, weight: 0.3, actors: [a.id, b.id], apartment: a.apartment,
          causes: [`ils se voient souvent`, `${a.shortName} est romantique`],
        });
      }
    }
  }

  // Un moment marquant laisse un souvenir. Le reste s'oublie, comme la vraie vie.
  if (Math.abs(quality) > 0.55) {
    const good = quality > 0;
    a.remember({
      kind: good ? 'bon.moment' : 'mauvais.moment',
      text: good ? `un bon moment avec ${b.shortName}` : `un moment pénible avec ${b.shortName}`,
      valence: quality * 0.8,
      strength: 0.35 + Math.abs(quality) * 0.3,
      about: b.id,
      tick,
    });
  }

  // L'amitié se déclare quand elle est déjà là depuis longtemps.
  if (relA.affinity > 0.62 && relB.affinity > 0.55 && relA.familiarity > 0.45
    && !relA.isFamily && !relA.isRomantic && relA.type !== LINK.AMI && relA.type !== LINK.MEILLEUR_AMI) {
    relA.type = LINK.AMI;
    relB.type = LINK.AMI;
    world.beat({
      kind: 'amitie.debut',
      text: `${a.shortName} et ${b.shortName} sont devenus amis.`,
      tone: TONE.TENDRE,
      weight: 0.4,
      actors: [a.id, b.id],
      apartment: a.apartment,
      causes: [
        `${a.shortName} et ${b.shortName} se croisent souvent`,
        `leurs caractères s'accordent (${Math.round(compatibility(a.personality, b.personality) * 100)}%)`,
        `${relA.interactions} moments passés ensemble`,
      ],
    });
    a.remember({ kind: 'amitie', text: `${b.shortName} est devenu un ami`, valence: 0.7, strength: 0.8, about: b.id, tick, core: true });
    b.remember({ kind: 'amitie', text: `${a.shortName} est devenu un ami`, valence: 0.7, strength: 0.8, about: a.id, tick, core: true });
  }

  // L'inimitié aussi.
  if (relA.affinity < -0.55 && relA.tension > 0.5 && relA.type !== LINK.ENNEMI && !relA.isFamily) {
    relA.type = LINK.ENNEMI;
    relB.type = LINK.ENNEMI;
    world.beat({
      kind: 'voisinage.conflit',
      text: `${a.shortName} et ${b.shortName} ne se saluent plus.`,
      tone: TONE.TENDU,
      weight: 0.45,
      actors: [a.id, b.id],
      apartment: a.apartment,
      causes: causeChain(a, b),
    });
  }
  return quality;
}

/** Reconstitue pourquoi deux personnes en sont arrivées là. */
export function causeChain(a, b) {
  const rel = a.relations.get(b.id, false);
  const out = [];
  const scar = a.memory.strongestAbout(b.id);
  if (scar) out.push(`${a.shortName} n'a pas oublié : ${scar.text}`);
  if (rel) {
    if (rel.tension > 0.5) out.push(`la tension entre eux est montée à ${Math.round(rel.tension * 100)}%`);
    if (rel.affinity < -0.3) out.push('ils ne se supportent plus depuis un moment');
  }
  const compat = compatibility(a.personality, b.personality);
  if (compat < -0.2) out.push('leurs caractères ne collent pas du tout');
  const defA = a.personality.defects[0];
  if (defA) out.push(`${a.shortName} est ${traitLabel(defA, a)}`);
  return out;
}

// --- Résolutions par type d'action ---

export function resolveVisit(a, b, world) {
  const q = encounterQuality(a, b, world);
  applyEncounter(a, b, q, world, 'visite');
  b.needs.add('social', 22);
  b.needs.add('plaisir', q > 0 ? 10 : -4);
  if (world.rng.chance(0.35)) exchangeGossip(a, b, world);
  if (q > 0.6 && world.rng.chance(0.25)
    && world.canBeat('entraide', `${Math.min(a.id, b.id)}-${Math.max(a.id, b.id)}`, 25)) {
    const scenes = [
      `Ils ont refait le monde jusqu'à pas d'heure.`,
      `Il est reparti avec un tupperware.`,
      `On les a entendus rire à travers la cloison.`,
      `Ils ont regardé un film que ni l'un ni l'autre n'a fini.`,
      `Le café a duré trois heures.`,
      `Ils n'ont pas parlé de grand-chose. C'était très bien.`,
    ];
    world.beat({
      kind: 'voisinage.entraide',
      text: `${a.shortName} est ${g(a, 'passé')} chez ${b.shortName}. ${world.rng.pick(scenes)}`,
      tone: TONE.TENDRE,
      weight: 0.25,
      actors: [a.id, b.id],
      apartment: b.apartment,
      causes: [`${a.shortName} avait besoin de voir du monde`, 'ils s\'entendent bien'],
    });
  }
  return q;
}

export function resolveComplaint(a, b, world) {
  // a monte se plaindre du bruit de b.
  const relA = a.relations.get(b.id);
  const relB = b.relations.get(a.id);
  const tick = world.clock.tick;
  relA.lastInteraction = tick;
  relB.lastInteraction = tick;
  a.lastComplaint = tick;

  // b accepte-t-il la remarque ? Question de caractère, pas de dé.
  const receptive = b.personality.get('amabilite') * 0.6 + b.personality.pardon * 0.3
    - b.personality.t('tetu', 0.3) - b.personality.t('bruyant', 0.25)
    - b.personality.irritabilite * 0.4 + (relB.affinity * 0.3);

  if (receptive > 0.3) {
    if (b.apartment !== null) world.setNoise(b.apartment, 0.05);
    relA.adjust({ tension: -0.05, affinity: 0.02, familiarity: 0.04 });
    relB.adjust({ tension: 0.05, familiarity: 0.04 });
    b.remember({
      kind: 'reproche',
      text: `${a.shortName} est monté se plaindre du bruit`,
      valence: -0.25, strength: 0.4, about: a.id, tick,
    });
    // Une plainte qui se règle bien n'est pas une histoire : on ne l'écrit
    // dans la chronique que si elle est un peu spectaculaire.
    if (world.clock.isNight && world.canBeat('voisinage.bruit', 'poli', 3)
      && world.canBeat('voisinage.bruit', `${a.id}-${b.id}`, 20)) {
      world.beat({
        kind: 'voisinage.bruit',
        text: `${a.shortName} est ${g(a, 'monté')} chez ${b.shortName} pour le bruit. ${b.shortName} a baissé. Ça arrive.`,
        tone: TONE.QUOTIDIEN,
        weight: 0.2,
        actors: [a.id, b.id],
        apartment: b.apartment,
        causes: [`${b.shortName} ${b.action?.label ?? 'faisait du bruit'}`,
          `${a.shortName} supporte mal le bruit (${Math.round(a.personality.toleranceBruit * 100)}%)`],
      });
    }
  } else {
    relA.adjust({ tension: 0.22, affinity: -0.12, familiarity: 0.05 });
    relB.adjust({ tension: 0.25, affinity: -0.14, familiarity: 0.05 });
    relA.lastConflict = tick;
    relB.lastConflict = tick;
    a.remember({
      kind: 'dispute.bruit',
      text: `${b.shortName} a claqué la porte au nez`,
      valence: -0.55, strength: 0.55, about: b.id, tick,
    });
    b.remember({
      kind: 'dispute.bruit',
      text: `${a.shortName} est venu faire la leçon`,
      valence: -0.5, strength: 0.5, about: a.id, tick,
    });
    a.externalStress = Math.min(60, a.externalStress + 8);
    b.externalStress = Math.min(60, b.externalStress + 6);
    if (world.canBeat('voisinage.bruit', `${a.id}-${b.id}`, 14)
      && world.canBeat('voisinage.bruit', 'clash', 1)) {
      world.beat({
        kind: 'voisinage.bruit',
        text: `Ça a crié sur le palier entre ${a.shortName} et ${b.shortName}. ${world.clock.timeString()}, quand même.`,
        tone: TONE.TENDU,
        weight: 0.35,
        actors: [a.id, b.id],
        apartment: b.apartment,
        causes: [
          `${b.shortName} ${b.action?.label ?? 'faisait du bruit'}`,
          `${a.shortName} est ${a.personality.defects.includes('colerique') ? 'colérique' : 'à bout'}`,
          `${b.shortName} n'accepte pas la remarque (${b.personality.has('tetu') ? traitLabel('tetu', b) : g(b, 'peu réceptif', 'peu réceptive')})`,
        ],
      });
    }
  }
}

export function resolveConfrontation(a, b, world) {
  const relA = a.relations.get(b.id);
  const relB = b.relations.get(a.id);
  const tick = world.clock.tick;
  const q = encounterQuality(a, b, world);
  // Une explication franche peut vider l'abcès… si les deux savent parler.
  const skill = (a.personality.get('amabilite') + b.personality.get('amabilite')) / 2
    + (a.personality.pardon + b.personality.pardon) / 2 - a.personality.irritabilite * 0.5;

  relA.lastInteraction = tick;
  relB.lastInteraction = tick;

  if (skill > 0.75 && q > -0.3) {
    relA.adjust({ tension: -0.45, affinity: 0.1, trust: 0.08 });
    relB.adjust({ tension: -0.42, affinity: 0.08, trust: 0.06 });
    a.remember({ kind: 'reconciliation', text: `mis les choses à plat avec ${b.shortName}`, valence: 0.5, strength: 0.5, about: b.id, tick });
    b.remember({ kind: 'reconciliation', text: `${a.shortName} est venu s'expliquer`, valence: 0.45, strength: 0.5, about: a.id, tick });
    world.beat({
      kind: 'famille.reconciliation',
      text: `${a.shortName} et ${b.shortName} se sont expliqués. Ça va mieux.`,
      tone: TONE.TENDRE,
      weight: 0.35,
      actors: [a.id, b.id],
      apartment: b.apartment,
      causes: [`la tension durait depuis ${Math.round((tick - relA.lastConflict) / 288)} jours`,
        'les deux savent se parler'],
    });
  } else {
    const severity = 0.2 + a.personality.irritabilite * 0.2 + relA.tension * 0.2;
    relA.adjust({ tension: severity, affinity: -severity * 0.8 });
    relB.adjust({ tension: severity, affinity: -severity * 0.7 });
    relA.lastConflict = tick;
    relB.lastConflict = tick;
    a.remember({ kind: 'dispute', text: `une dispute violente avec ${b.shortName}`, valence: -0.7, strength: 0.65, about: b.id, tick });
    b.remember({ kind: 'dispute', text: `${a.shortName} lui a hurlé dessus`, valence: -0.7, strength: 0.65, about: a.id, tick });
    a.externalStress = Math.min(70, a.externalStress + 12);
    b.externalStress = Math.min(70, b.externalStress + 12);
    if (!world.canBeat('conflit', `${Math.min(a.id, b.id)}-${Math.max(a.id, b.id)}`, 12)) return;
    world.beat({
      kind: relA.isFamily || relA.isRomantic ? 'famille.dispute' : 'voisinage.conflit',
      text: relA.isRomantic
        ? `${a.shortName} et ${b.shortName} se sont déchirés. Les voisins ont tout entendu.`
        : `${a.shortName} est ${g(a, 'allé')} s'expliquer avec ${b.shortName}. Ça s'est mal passé.`,
      tone: TONE.TENDU,
      weight: 0.5,
      actors: [a.id, b.id],
      apartment: b.apartment,
      causes: causeChain(a, b),
    });
  }
}

export function resolveReconcile(a, b, world) {
  const relA = a.relations.get(b.id);
  const relB = b.relations.get(a.id);
  const tick = world.clock.tick;
  const accepted = b.personality.pardon * 0.6 + relB.familiarity * 0.4
    + (relB.isFamily ? 0.3 : 0) - relB.tension * 0.5 > 0.35;

  relA.lastInteraction = tick;
  relB.lastInteraction = tick;

  if (accepted) {
    relA.adjust({ tension: -0.5, affinity: 0.18, trust: 0.12 });
    relB.adjust({ tension: -0.5, affinity: 0.16, trust: 0.12 });
    a.remember({ kind: 'reconciliation', text: `réconcilié avec ${b.shortName}`, valence: 0.6, strength: 0.6, about: b.id, tick, core: true });
    b.remember({ kind: 'reconciliation', text: `${a.shortName} a fait le premier pas`, valence: 0.65, strength: 0.6, about: a.id, tick, core: true });
    world.beat({
      kind: 'famille.reconciliation',
      text: `${a.shortName} a fait le premier pas vers ${b.shortName}. Ça a marché.`,
      tone: TONE.TENDRE,
      weight: 0.45,
      actors: [a.id, b.id],
      apartment: b.apartment,
      causes: [`${a.shortName} sait pardonner (${Math.round(a.personality.pardon * 100)}%)`,
        `il restait de l'attachement entre eux`],
    });
  } else {
    relA.adjust({ affinity: -0.06, tension: 0.05 });
    a.remember({ kind: 'rebuffade', text: `${b.shortName} a refusé la main tendue`, valence: -0.5, strength: 0.5, about: b.id, tick });
    if (!world.canBeat('rebuffade', `${a.id}-${b.id}`, 15)) return;
    world.beat({
      kind: 'voisinage.conflit',
      text: `${a.shortName} a tendu la main à ${b.shortName}. La porte est restée fermée.`,
      tone: TONE.TENDU,
      weight: 0.35,
      actors: [a.id, b.id],
      apartment: b.apartment,
      causes: [`${b.shortName} ne pardonne pas facilement (${Math.round(b.personality.pardon * 100)}%)`,
        ...causeChain(b, a).slice(0, 1)],
    });
  }
}

export function resolveHouseholdTime(a, world, targets) {
  for (const t of targets.slice(0, 2)) {
    const b = t.person;
    const q = encounterQuality(a, b, world) * 0.7 + 0.15;
    applyEncounter(a, b, q, world, 'foyer');
    b.needs.add('social', 12);
    if (b.isChild) {
      b.needs.add('plaisir', 10);
      b.moodBias = Math.min(20, b.moodBias + 1.2);
    }
  }
}

/** Le commérage : l'information circule, et se déforme à chaque étage. */
export function exchangeGossip(a, b, world) {
  const tick = world.clock.tick;
  if (a.rumourCooldown > tick) return;
  a.rumourCooldown = tick + 60;

  // On parle de quelqu'un qu'on connaît tous les deux.
  const shared = a.relations.all().filter((r) => {
    if (r.other === b.id) return false;
    const other = world.people.get(r.other);
    return other && other.alive && b.relations.has(r.other);
  });
  if (!shared.length) return;

  const subjectRel = world.rng.weighted(shared, (r) => 0.2 + r.familiarity + Math.abs(r.affinity));
  const subject = world.people.get(subjectRel.other);
  if (!subject) return;

  // Ce que a croit savoir : un vrai souvenir, ou une banalité observée.
  const source = a.memory.about(subject.id).filter((m) => m.strength > 0.25);
  let content = source.length
    ? world.rng.pick(source).text
    : `${subject.shortName} ${world.rng.pick(GOSSIP_SEEDS)}`;

  const distorted = distortRumour(content, world.rng);
  const believed = b.personality.mefiance < 0.55 || b.personality.has('commere');

  if (believed) {
    const relBS = b.relations.get(subject.id);
    const negative = /amant|divorc|expuls|police|douteuses|drame|illégal/.test(distorted);
    relBS.adjust({
      affinity: negative ? -0.05 : 0.01,
      trust: negative ? -0.06 : 0,
      familiarity: 0.02,
    });
    b.remember({
      kind: 'rumeur',
      text: `on dit que ${distorted}`,
      valence: negative ? -0.3 : 0.05,
      strength: 0.3,
      about: subject.id,
      tick,
    });
    if (distorted !== content && world.rng.chance(0.28)
      && world.canBeat('secret.rumeur', 'global', 1.5)) {
      world.beat({
        kind: 'secret.rumeur',
        text: `${a.shortName} a raconté à ${b.shortName} que ${distorted}. Ce n'est pas tout à fait ce qui s'est passé.`,
        tone: TONE.DROLE,
        weight: 0.28,
        actors: [a.id, b.id, subject.id],
        apartment: b.apartment,
        causes: [
          `à l'origine : ${content}`,
          `${a.shortName} est ${a.personality.has('commere') ? 'une commère' : g(a, 'bavard', 'bavarde')}`,
          `${b.shortName} l'a cru`,
        ],
      });
    }
  }
}

/** Le flirt : deux vitesses, celle de l'un et celle de l'autre. */
export function resolveFlirt(a, b, world) {
  const relA = a.relations.get(b.id);
  const relB = b.relations.get(a.id);
  const tick = world.clock.tick;
  const q = encounterQuality(a, b, world);
  const chemistry = q * 0.6 + (a.personality.romantisme + b.personality.romantisme) / 2 * 0.3;

  relA.lastInteraction = tick;
  relB.lastInteraction = tick;
  relA.adjust({ familiarity: 0.06, romance: chemistry * 0.14, affinity: chemistry * 0.08 });
  relB.adjust({ familiarity: 0.06, romance: chemistry * 0.11, affinity: chemistry * 0.07 });

  if (chemistry < -0.2) {
    relA.adjust({ romance: -0.12 });
    a.remember({ kind: 'rateau', text: `un vent poli de ${b.shortName}`, valence: -0.35, strength: 0.4, about: b.id, tick });
    if (world.rng.chance(0.35)) {
      world.beat({
        kind: 'romance.rateau',
        text: `${a.shortName} a tenté quelque chose avec ${b.shortName}. Silence gêné dans l'ascenseur.`,
        tone: TONE.DROLE,
        weight: 0.25,
        actors: [a.id, b.id],
        apartment: b.apartment,
        causes: [`${a.shortName} est romantique`, 'ce n\'est pas réciproque'],
      });
    }
  }
  return chemistry;
}
