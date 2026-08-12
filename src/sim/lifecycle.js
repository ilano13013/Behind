// Cycles de vie.
//
// Vieillir, travailler, tomber amoureux, se séparer, avoir des enfants,
// tomber malade, mourir. Rien ici n'est déclenché par un scénario : ce
// sont des seuils franchis par des trajectoires. Deux habitants dans la
// même situation ne prennent pas la même décision, parce qu'ils ne sont
// pas les mêmes personnes.

import { LINK } from './relations.js';
import { TONE } from '../core/events.js';
import { compatibility } from './traits.js';
import { makeResident, pickJob } from './resident.js';
import { makePersonality } from './traits.js';
import { pickFirstName } from '../content/names.js';
import { JOBS, UNEMPLOYED, RETIRED, STUDENT, CHILD_JOB, jobById, jobLabel } from '../content/jobs.js';
import { g, pronom, Pronom, de } from '../core/text.js';
import { DAYS_PER_YEAR, TICKS_PER_DAY, DAYS_PER_MONTH } from '../core/clock.js';

const GESTATION_DAYS = 18; // neuf mois à l'échelle de l'immeuble

// ---------------------------------------------------------------- vieillir

export function ageOneDay(world, p) {
  p.age += 1 / DAYS_PER_YEAR;

  // Anniversaires : franchissements de seuils qui changent une vie.
  const a = Math.floor(p.age);
  const before = Math.floor(p.age - 1 / DAYS_PER_YEAR);
  if (a === before) return;

  if (a === 18 && p.job.id === 'ecole') {
    p.job = world.rng.chance(0.6) ? STUDENT : pickJob(world.rng, 18, p.personality);
    world.beat({
      kind: 'vie.majorite',
      text: `${p.shortName} a 18 ans. ${p.job.id === 'etudiant' ? 'Études.' : 'Premier vrai boulot.'}`,
      tone: TONE.QUOTIDIEN, weight: 0.3, actors: [p.id], apartment: p.apartment,
      causes: ['le temps passe, même ici'],
    });
  }
  if (a === 65 && p.job.id !== 'retraite') {
    const old = p.job;
    p.job = RETIRED;
    p.moodBias += p.personality.has('travailleur') ? -8 : 6;
    world.beat({
      kind: 'travail.retraite',
      text: `${p.shortName} est à la retraite après une vie ${de(jobLabel(old, p))}. ${p.personality.has('travailleur') ? `${Pronom(p)} ne sait pas quoi faire de ${g(p, 'ses')} journées.` : 'Enfin.'}`,
      tone: TONE.QUOTIDIEN, weight: 0.4, actors: [p.id], apartment: p.apartment,
      causes: [`${p.shortName} a 65 ans`, `${pronom(p)} était ${jobLabel(old, p)}`],
    });
    p.remember({ kind: 'retraite', text: 'le dernier jour de travail', valence: p.personality.has('travailleur') ? -0.3 : 0.5, strength: 0.9, tick: world.clock.tick, core: true });
  }
}

// ---------------------------------------------------------------- santé

export function healthStep(world, p) {
  const rng = world.rng;
  // Usure de fond : l'âge, le stress, l'addiction, la mauvaise hygiène.
  let drift = -0.004 - Math.max(0, p.age - 45) * 0.0016;
  drift -= p.stress / 100 * 0.02;
  drift -= p.addiction * 0.045;
  if (p.needs.get('hygiene') < 30) drift -= 0.012;
  if (p.needs.get('faim') < 25) drift -= 0.02;
  if (p.needs.get('energie') < 25) drift -= 0.014;
  // Et ce qui répare : le calme, les gens, l'âge tendre.
  if (p.stress < 30) drift += 0.012;
  if (p.needs.get('social') > 65) drift += 0.006;
  if (p.age < 35) drift += 0.014;
  p.health = Math.min(100, Math.max(0, p.health + drift));

  // Maladie : rare, mais plus probable quand le corps est déjà bas.
  if (!p.conditions.has('malade')) {
    const risk = 0.0007 + Math.max(0, (60 - p.health)) * 0.00012
      + Math.max(0, p.age - 60) * 0.00009 + p.stress * 0.000018;
    if (rng.chance(risk)) {
      p.conditions.add('malade');
      p.health -= rng.float(6, 16);
      p.moodBias -= 8;
      world.beat({
        kind: 'sante.maladie',
        text: `${p.shortName} est ${g(p, 'tombé')} malade. ${Pronom(p)} dit que ce n'est rien.`,
        tone: TONE.TENDU, weight: 0.4, actors: [p.id], apartment: p.apartment,
        causes: [
          p.stress > 60 ? `${p.shortName} vit sous pression depuis des semaines` : 'un corps fatigué',
          p.addiction > 0.3 ? `${pronom(p)} boit trop, et depuis longtemps` : null,
          p.age > 65 ? `${Math.floor(p.age)} ans` : null,
        ].filter(Boolean),
      });
      p.remember({ kind: 'maladie', text: 'ce jour où le corps a lâché', valence: -0.5, strength: 0.6, tick: world.clock.tick });
    }
  } else if (rng.chance(0.05 + p.health / 900 + (p.age < 50 ? 0.03 : 0))) {
    p.conditions.delete('malade');
    p.health = Math.min(100, p.health + 8);
    p.moodBias += 6;
  }

  // Mortalité. Gompertz doux, aggravé par une mauvaise santé.
  const base = 0.00040 * Math.exp(0.090 * (p.age - 30));
  const frail = 1 + Math.max(0, (70 - p.health)) / 45;
  const yearly = Math.min(0.85, base * frail);
  const daily = yearly / DAYS_PER_YEAR;
  if (rng.chance(daily)) {
    die(world, p, p.conditions.has('malade') ? 'maladie' : p.age > 70 ? 'vieillesse' : 'santé');
  }
}

export function die(world, p, cause) {
  if (!p.alive) return;
  p.alive = false;
  p.causeOfDeath = cause;
  p.deathTick = world.clock.tick;
  p.action = null;
  const apt = world.apartments[p.apartment];

  world.beat({
    kind: 'sante.mort',
    text: `${p.name} s'est ${g(p, 'éteint')}. ${Math.floor(p.age)} ans.`,
    tone: TONE.GRAVE,
    weight: 1,
    actors: [p.id],
    apartment: p.apartment,
    causes: [
      cause === 'vieillesse' ? 'une longue vie' : `cause : ${cause}`,
      `santé descendue à ${Math.round(p.health)}`,
      p.addiction > 0.4 ? 'l\'alcool, depuis des années' : null,
    ].filter(Boolean),
  });

  // Le deuil : chacun encaisse selon ce qu'il perd et ce qu'il est.
  for (const rel of p.relations.all()) {
    const other = world.people.get(rel.other);
    if (!other || !other.alive) continue;
    const closeness = Math.max(0, rel.affinity) * 0.6 + (rel.isFamily ? 0.5 : 0)
      + (rel.isRomantic ? 0.7 : 0) + rel.familiarity * 0.2;
    if (closeness < 0.12) continue;
    const blow = closeness * (1.4 - other.personality.resilience);
    other.moodBias -= blow * 34;
    other.externalStress = Math.min(80, other.externalStress + blow * 26);
    other.remember({
      kind: 'deuil',
      text: `la mort de ${p.shortName}`,
      valence: -0.9,
      strength: Math.min(1, 0.6 + closeness * 0.4),
      about: p.id,
      tick: world.clock.tick,
      core: true,
    });
    const orel = other.relations.get(p.id);
    if (orel.isRomantic) {
      other.tags.add('veuf');
      orel.type = LINK.EX;
    }
  }

  // Héritage : ce qui reste va aux proches, et ça se voit.
  const heirs = p.relations.all()
    .filter((r) => (r.type === LINK.ENFANT || r.isRomantic) && world.people.get(r.other)?.alive)
    .map((r) => world.people.get(r.other));
  if (heirs.length && p.money > 200) {
    const share = p.money / heirs.length;
    for (const h of heirs) {
      h.money += share;
      h.remember({ kind: 'heritage', text: `l'héritage de ${p.shortName}`, valence: -0.1, strength: 0.5, about: p.id, tick: world.clock.tick });
    }
    world.beat({
      kind: 'argent.heritage',
      text: `${heirs.map((h) => h.shortName).join(' et ')} hérite${heirs.length > 1 ? 'nt' : ''} de ${Math.round(p.money)} €. Personne n'en parle.`,
      tone: TONE.QUOTIDIEN, weight: 0.35, actors: heirs.map((h) => h.id), apartment: p.apartment,
      causes: [`${p.shortName} est ${g(p, 'mort')}`, `${pronom(p)} avait mis de côté`],
    });
  }
  p.money = 0;

  if (apt) {
    apt.residents = apt.residents.filter((id) => id !== p.id);
    apt.mourningUntil = world.clock.tick + TICKS_PER_DAY * 6;
    if (apt.residents.length === 0) apt.vacantSince = world.clock.tick;
  }
  world.dead.push(p);
}

// ---------------------------------------------------------------- travail

export function workStep(world, p) {
  const rng = world.rng;
  // On ne licencie pas un retraité, un écolier — ni un étudiant de ses études.
  if (p.job.id === 'retraite' || p.job.id === 'ecole' || p.job.id === 'etudiant'
    || p.job.id === 'foyer' || p.age < 16) return;

  if (p.job.id === 'chomage') {
    // Chercher du travail marche mieux quand on est en état de chercher.
    const effort = p.personality.serieux * 0.5 + (p.mood / 100) * 0.3 + (p.health / 100) * 0.2;
    const luck = 0.012 + effort * 0.05 - Math.min(0.02, p.age > 55 ? 0.018 : 0);
    if (rng.chance(luck)) {
      p.job = pickJob(rng, p.age, p.personality);
      if (p.job.id === 'chomage') p.job = rng.pick(JOBS);
      p.jobPerformance = 0.42;
      p.jobTenure = 0;
      p.moodBias += 16;
      p.externalStress = Math.max(0, p.externalStress - 20);
      world.beat({
        kind: 'travail.embauche',
        text: `${p.shortName} a retrouvé du travail : ${jobLabel(p.job, p)}. ${Pronom(p)} l'a annoncé à trois personnes dans l'escalier.`,
        tone: TONE.TENDRE, weight: 0.5, actors: [p.id], apartment: p.apartment,
        causes: [`${p.shortName} cherchait depuis ${Math.round(p.jobSearchDays ?? 0)} jours`,
          `${pronom(p)} est ${p.personality.has('travailleur') ? g(p, 'travailleur', 'travailleuse') : 'tenace'}`],
      });
      p.remember({ kind: 'embauche', text: 'le jour du coup de fil', valence: 0.8, strength: 0.8, tick: world.clock.tick, core: true });
      p.jobSearchDays = 0;
    } else {
      p.jobSearchDays = (p.jobSearchDays ?? 0) + 1;
      if (p.jobSearchDays % 30 === 0) p.moodBias -= 4;
    }
    return;
  }

  p.jobTenure += 1;

  // La performance suit l'état réel de la personne, pas un compteur abstrait.
  const capacity = (p.needs.get('energie') / 100) * 0.4 + (p.health / 100) * 0.25
    + (1 - p.stress / 100) * 0.2 + p.personality.serieux * 0.35 - p.addiction * 0.4
    + (p.mood / 100) * 0.15 - 0.25;
  p.jobPerformance += (Math.max(0, Math.min(1, capacity)) - p.jobPerformance) * 0.05;

  // Promotion : mérite + ancienneté + un peu de chance.
  if (p.jobPerformance > 0.72 && p.jobTenure > 120 && rng.chance(0.006 + (p.jobPerformance - 0.72) * 0.03)) {
    const raise = 1 + rng.float(0.08, 0.2);
    p.job = { ...p.job, pay: Math.round(p.job.pay * raise), prestige: Math.min(1, (p.job.prestige ?? 0.3) + 0.08) };
    p.jobTenure = 0;
    p.moodBias += 14;
    p.tags.add('promu');
    world.beat({
      kind: 'travail.promotion',
      text: `${p.shortName} a été ${g(p, 'promu')}. ${Pronom(p)} essaie de ne pas trop le montrer. ${Pronom(p)} le montre.`,
      tone: TONE.DROLE, weight: 0.5, actors: [p.id], apartment: p.apartment,
      causes: [`performance à ${Math.round(p.jobPerformance * 100)}%`,
        `${p.personality.has('travailleur') ? `${pronom(p)} ne compte pas ses heures` : `${pronom(p)} fait le travail`}`],
    });
    p.remember({ kind: 'promotion', text: 'la promotion', valence: 0.8, strength: 0.85, tick: world.clock.tick, core: true });
  }

  // Licenciement : quand ça ne va plus, ça finit par se voir.
  const layoffRisk = (p.jobPerformance < 0.28 ? (0.28 - p.jobPerformance) * 0.09 : 0)
    + (p.job.precarious ? 0.0018 : 0.0004)
    + (p.addiction > 0.6 ? 0.004 : 0);
  if (rng.chance(layoffRisk)) {
    const old = p.job;
    p.job = UNEMPLOYED;
    p.jobPerformance = 0.4;
    p.jobSearchDays = 0;
    p.moodBias -= 22;
    p.externalStress = Math.min(85, p.externalStress + 30);
    world.beat({
      kind: 'travail.licenciement',
      text: `${p.shortName} a perdu son poste ${de(jobLabel(old, p))}. ${Pronom(p)} n'en a parlé à personne.`,
      tone: TONE.GRAVE, weight: 0.75, actors: [p.id], apartment: p.apartment,
      causes: [
        p.addiction > 0.6 ? `${pronom(p)} buvait au travail` : null,
        p.jobPerformance < 0.3 ? `${pronom(p)} n'y arrivait plus depuis des mois` : null,
        p.stress > 65 ? `un stress à ${Math.round(p.stress)}%` : null,
        old.precarious ? 'un contrat qui ne tenait à rien' : null,
      ].filter(Boolean).length ? [
        p.addiction > 0.6 ? `${pronom(p)} buvait au travail` : null,
        p.jobPerformance < 0.3 ? `${pronom(p)} n'y arrivait plus depuis des mois` : null,
        p.stress > 65 ? `un stress à ${Math.round(p.stress)}%` : null,
        old.precarious ? 'un contrat qui ne tenait à rien' : null,
      ].filter(Boolean) : ['une restructuration, une ligne dans un tableau'],
    });
    p.remember({ kind: 'licenciement', text: `le jour du licenciement`, valence: -0.85, strength: 0.9, tick: world.clock.tick, core: true });
  }
}

// ---------------------------------------------------------------- argent

export function monthlyMoney(world, p) {
  // Les enfants ne paient rien et ne s'endettent pas : le foyer les porte.
  // Sans ce garde-fou, l'immeuble se remplit d'écoliers surendettés.
  if (p.age < 18) {
    p.money = Math.max(0, p.money);
    p.debt = 0;
    return;
  }
  const apt = world.apartments[p.apartment];
  const income = p.income;
  // Le loyer se partage entre adultes du foyer.
  const adults = apt ? apt.residents.map((id) => world.people.get(id)).filter((r) => r?.alive && r.age >= 18) : [];
  const rentShare = apt && adults.length ? apt.rent / adults.length : 0;

  // Aide au logement : sans elle, tous les étudiants de l'immeuble seraient
  // expulsés en un an, ce qui n'est pas exactement le pays qu'on simule.
  const aide = income < 1500
    ? Math.max(0, Math.min(rentShare * 0.6, 520 - income * 0.24))
    : 0;
  const life = 200 + p.personality.depense * 290 + (p.isChild ? -140 : 0) + p.addiction * 220;

  p.money += income - (p.age >= 18 ? Math.max(0, rentShare - aide) : 0) - life;

  if (p.money < 0) {
    p.debt += -p.money;
    p.money = 0;
    p.externalStress = Math.min(90, p.externalStress + 12);
    if (p.debt > 900 && !p.tags.has('crise')) {
      p.tags.add('crise');
      world.beat({
        kind: 'argent.crise',
        text: `${p.shortName} ne s'en sort plus. Le courrier s'entasse près de la porte.`,
        tone: TONE.GRAVE, weight: 0.7, actors: [p.id], apartment: p.apartment,
        causes: [
          p.job.id === 'chomage' ? 'plus de salaire depuis des mois' : `${jobLabel(p.job, p)}, ça ne suffit pas`,
          `loyer de ${Math.round(rentShare)} € par mois`,
          p.personality.has('depensier') ? 'et il ne sait pas compter' : null,
          p.personality.has('orgueilleux') ? 'et il ne demandera rien à personne' : null,
        ].filter(Boolean),
      });
      p.remember({ kind: 'dette', text: 'les lettres qu\'on n\'ouvre plus', valence: -0.7, strength: 0.8, tick: world.clock.tick, core: true });
    }
  } else if (p.debt > 0) {
    const pay = Math.min(p.debt, p.money * 0.35);
    p.debt -= pay;
    p.money -= pay;
    if (p.debt <= 0) {
      p.debt = 0;
      if (p.tags.delete('crise')) {
        p.moodBias += 12;
        world.beat({
          kind: 'argent.sortie',
          text: `${p.shortName} a fini de rembourser. Il a racheté du bon café.`,
          tone: TONE.TENDRE, weight: 0.4, actors: [p.id], apartment: p.apartment,
          causes: ['des mois à serrer', p.job.id !== 'chomage' ? 'un salaire qui est revenu' : 'de l\'aide'],
        });
      }
    }
  }

  // Expulsion : la conséquence lente, pas un couperet.
  if (p.debt > 3200 && p.age >= 18) {
    evict(world, p);
  }
}

function evict(world, p) {
  world.beat({
    kind: 'logement.expulsion',
    text: `${p.name} a quitté l'immeuble. Deux valises, pas d'au revoir.`,
    tone: TONE.GRAVE, weight: 0.9, actors: [p.id], apartment: p.apartment,
    causes: [`${Math.round(p.debt)} € de dettes`,
      p.job.id === 'chomage' ? 'sans emploi depuis trop longtemps' : 'un salaire trop juste',
      'personne n\'a rien vu venir'],
  });
  for (const rel of p.relations.all()) {
    const other = world.people.get(rel.other);
    if (!other?.alive || rel.affinity < 0.3) continue;
    other.remember({ kind: 'depart', text: `le départ de ${p.shortName}`, valence: -0.5, strength: 0.6, about: p.id, tick: world.clock.tick });
    other.moodBias -= rel.affinity * 10;
  }
  world.removeResident(p, 'parti');
}

// ---------------------------------------------------------------- amour

export function romanceStep(world, p) {
  const rng = world.rng;
  if (p.age < 16 || !p.alive) return;
  const partnerRel = p.relations.partner();

  if (partnerRel) {
    const partner = world.people.get(partnerRel.other);
    if (!partner?.alive) return;

    // Un couple qui ne se parle plus s'use ; un couple qui se parle tient.
    const health = partnerRel.affinity * 0.5 + partnerRel.romance * 0.3 - partnerRel.tension * 0.9;

    // Mariage : seulement si les deux y croient et que ça dure.
    if (partnerRel.type === LINK.COUPLE && health > 0.45
      && partnerRel.interactions > 55
      && p.personality.romantisme > 0.45 && partner.personality.romantisme > 0.4
      && rng.chance(0.0035)) {
      partnerRel.type = LINK.MARIE;
      partner.relations.get(p.id).type = LINK.MARIE;
      p.moodBias += 22;
      partner.moodBias += 22;
      p.tags.add('marie');
      partner.tags.add('marie');
      world.beat({
        kind: 'romance.mariage',
        text: `${p.shortName} et ${partner.shortName} se sont mariés. Le buffet était dans la cour, tout le monde était invité, même le 6e droite.`,
        tone: TONE.TENDRE, weight: 0.95, actors: [p.id, partner.id], apartment: p.apartment,
        causes: [`ensemble depuis ${Math.round(partnerRel.interactions / 3)} semaines`,
          `affinité à ${Math.round(partnerRel.affinity * 100)}%`,
          'les deux sont romantiques'],
      });
      const m = { kind: 'mariage', text: 'le jour du mariage', valence: 0.95, strength: 1, tick: world.clock.tick, core: true };
      p.remember({ ...m, about: partner.id });
      partner.remember({ ...m, about: p.id });
    }

    // Infidélité : jamais gratuite. Il faut une occasion, une faille, un manque.
    if (partnerRel.tension > 0.45 && p.personality.loyaute < 0.5) {
      const tempting = p.relations.all()
        .filter((r) => r.other !== partner.id && r.romance > 0.35 && world.people.get(r.other)?.alive)
        .sort((a, b) => b.romance - a.romance)[0];
      if (tempting && rng.chance(0.0025 * (1 - p.personality.loyaute) * (1 + partnerRel.tension))) {
        const third = world.people.get(tempting.other);
        p.tags.add('secret_infidelite');
        p.remember({ kind: 'infidelite', text: `ce qu'il a fait avec ${third.shortName}`, valence: -0.3, strength: 0.9, about: third.id, tick: world.clock.tick, core: true });
        world.beat({
          kind: 'romance.infidelite',
          text: `${p.shortName} a fait une bêtise avec ${third.shortName}. ${partner.shortName} ne le sait pas encore.`,
          tone: TONE.TENDU, weight: 0.85, actors: [p.id, third.id], apartment: p.apartment,
          causes: [`le couple est tendu (${Math.round(partnerRel.tension * 100)}%)`,
            `${p.shortName} est peu ${g(p, 'fidèle', 'fidèle')} (${Math.round(p.personality.loyaute * 100)}%)`,
            `une attirance pour ${third.shortName} depuis un moment`],
        });
      }
    }

    // Découverte : les commères de l'immeuble finissent toujours par parler.
    if (p.tags.has('secret_infidelite') && rng.chance(0.004)) {
      revealAffair(world, p, partner);
    }

    // Rupture.
    if (health < -0.25 && rng.chance(0.008 + partnerRel.tension * 0.02)) {
      breakUp(world, p, partner);
    }
    return;
  }

  // Célibataire : un flirt peut se transformer.
  const best = p.relations.all()
    .filter((r) => {
      const o = world.people.get(r.other);
      if (!o?.alive || o.age < 17 || r.isFamily) return false;
      if (o.relations.partner()) return false;
      if (Math.abs(o.age - p.age) > 6 + Math.min(p.age, o.age) * 0.25) return false;
      return r.romance > 0.55 && r.affinity > 0.4;
    })
    .sort((a, b) => b.romance - a.romance)[0];
  if (!best) return;

  const other = world.people.get(best.other);
  const mutual = other.relations.get(p.id);
  if (mutual.romance < 0.5 || mutual.affinity < 0.3) return;

  if (rng.chance(0.03)) {
    best.type = LINK.COUPLE;
    mutual.type = LINK.COUPLE;
    p.moodBias += 20;
    other.moodBias += 20;
    world.beat({
      kind: 'romance.couple',
      text: `${p.shortName} et ${other.shortName} sont ensemble. Tout l'immeuble le savait avant eux.`,
      tone: TONE.TENDRE, weight: 0.7, actors: [p.id, other.id], apartment: p.apartment,
      causes: [
        `${best.interactions} rencontres depuis leur première`,
        `une vraie compatibilité (${Math.round(compatibility(p.personality, other.personality) * 100)}%)`,
        p.ambition?.id === 'amour' ? `${p.shortName} cherchait quelqu'un` : null,
      ].filter(Boolean),
    });
    const m = { kind: 'amour', text: 'le début de leur histoire', valence: 0.85, strength: 0.95, tick: world.clock.tick, core: true };
    p.remember({ ...m, about: other.id });
    other.remember({ ...m, about: p.id });
  }
}

function revealAffair(world, cheater, partner) {
  cheater.tags.delete('secret_infidelite');
  const rel = partner.relations.get(cheater.id);
  const relC = cheater.relations.get(partner.id);
  rel.adjust({ tension: 0.7, affinity: -0.6, trust: -1, romance: -0.4 });
  relC.adjust({ tension: 0.5, affinity: -0.2 });
  partner.moodBias -= 30;
  partner.externalStress = Math.min(95, partner.externalStress + 35);
  partner.remember({ kind: 'trahison', text: `la trahison de ${cheater.shortName}`, valence: -0.95, strength: 1, about: cheater.id, tick: world.clock.tick, core: true });
  world.beat({
    kind: 'romance.trahison',
    text: `${partner.shortName} a appris pour ${cheater.shortName}. On a entendu une assiette.`,
    tone: TONE.GRAVE, weight: 0.95, actors: [partner.id, cheater.id], apartment: partner.apartment,
    causes: ['l\'immeuble parle beaucoup', `${cheater.shortName} n\'a pas su cacher`,
      'quelqu\'un a fini par le dire'],
  });
}

export function breakUp(world, a, b) {
  const relA = a.relations.get(b.id);
  const relB = b.relations.get(a.id);
  const married = relA.type === LINK.MARIE;
  relA.type = LINK.EX;
  relB.type = LINK.EX;
  relA.adjust({ romance: -0.8, tension: 0.2 });
  relB.adjust({ romance: -0.8, tension: 0.2 });
  a.moodBias -= 26;
  b.moodBias -= 26;
  a.tags.delete('marie');
  b.tags.delete('marie');

  const mem = { kind: married ? 'divorce' : 'rupture', text: married ? 'le divorce' : 'la rupture', valence: -0.8, strength: 0.95, tick: world.clock.tick, core: true };
  a.remember({ ...mem, about: b.id });
  b.remember({ ...mem, about: a.id });

  world.beat({
    kind: 'romance.rupture',
    text: married
      ? `${a.shortName} et ${b.shortName} divorcent. Après ${Math.max(1, Math.round(relA.interactions / 40))} ans.`
      : `${a.shortName} et ${b.shortName}, c'est fini. Les cartons descendent déjà.`,
    tone: TONE.GRAVE, weight: 0.85, actors: [a.id, b.id], apartment: a.apartment,
    causes: [
      `tension du couple à ${Math.round(relA.tension * 100)}%`,
      relA.affinity < 0 ? 'ils ne se supportaient plus' : 'l\'affection s\'est éteinte doucement',
      a.memory.has('trahison', b.id) || b.memory.has('trahison', a.id) ? 'et il y a eu la trahison' : null,
    ].filter(Boolean),
  });

  // Qui part ? Celui qui n'est pas titulaire du bail, ou le plus fragile.
  if (a.apartment === b.apartment && a.apartment !== null) {
    const leaver = (b.money < a.money) ? b : a;
    world.rehouseOrLeave(leaver, 'rupture');
  }
}

// ---------------------------------------------------------------- famille

export function familyStep(world, p) {
  const rng = world.rng;
  const partnerRel = p.relations.partner();

  // Grossesse : un projet, pas un accident de calcul.
  if (!p.pregnant && partnerRel && p.gender === 'f' && p.age >= 19 && p.age <= 43) {
    const partner = world.people.get(partnerRel.other);
    if (partner?.alive && partner.age >= 18) {
      const apt = world.apartments[p.apartment];
      const room = apt && apt.residents.length <= apt.rooms;
      const want = 0.22
        + (p.ambition?.id === 'famille' ? 0.5 : 0)
        + (partner.ambition?.id === 'famille' ? 0.35 : 0)
        + p.personality.get('amabilite') * 0.3
        + partnerRel.affinity * 0.3
        - partnerRel.tension * 0.8
        - (p.money < 300 ? 0.4 : 0)
        - (p.age > 38 ? 0.3 : 0);
      if (room && want > 0.5 && rng.chance(0.016)) {
        p.pregnant = true;
        p.pregnancyStart = world.clock.tick;
        p.moodBias += 10;
        world.beat({
          kind: 'famille.grossesse',
          text: `${p.shortName} attend un enfant. ${partner.shortName} a repeint la petite chambre en trois jours.`,
          tone: TONE.TENDRE, weight: 0.7, actors: [p.id, partner.id], apartment: p.apartment,
          causes: [`${p.shortName} veut fonder une famille`, `le couple va bien (${Math.round(partnerRel.affinity * 100)}%)`],
        });
      }
    }
  }

  if (p.pregnant && world.clock.tick - p.pregnancyStart > GESTATION_DAYS * TICKS_PER_DAY) {
    giveBirth(world, p);
  }

  // Les enfants finissent par partir — ou pas, si le loyer est trop cher.
  if (p.age >= 20 && p.age <= 30 && p.job.id !== 'ecole') {
    const apt = world.apartments[p.apartment];
    if (!apt) return;
    const livesWithParents = p.relations.parents().some((r) => world.people.get(r.other)?.apartment === p.apartment);
    if (livesWithParents && p.income > 1200 && p.money > 1500 && rng.chance(0.004)) {
      world.rehouseOrLeave(p, 'independance');
    }
  }
}

function giveBirth(world, mother) {
  const rng = world.rng;
  mother.pregnant = false;
  const partnerRel = mother.relations.partner();
  const father = partnerRel ? world.people.get(partnerRel.other) : null;

  const gender = rng.chance(0.5) ? 'f' : 'm';
  const taken = new Set([...world.people.values()].map((r) => r.firstName));
  const baby = makeResident(rng, {
    age: 0,
    gender,
    lastName: father && rng.chance(0.7) ? father.lastName : mother.lastName,
    job: CHILD_JOB,
    money: 0,
    health: 98,
    apartment: mother.apartment,
    taken,
    birthTick: world.clock.tick,
    // Les enfants héritent un peu du caractère de leurs parents. Un peu.
    personality: blendPersonality(rng, mother.personality, father?.personality),
  });
  baby.needs.set('energie', 60);
  world.addResident(baby, mother.apartment);

  linkFamily(world, mother, baby, LINK.ENFANT);
  if (father) linkFamily(world, father, baby, LINK.ENFANT);
  // Fratrie.
  for (const r of mother.relations.children()) {
    const sib = world.people.get(r.other);
    if (sib && sib.id !== baby.id && sib.alive) linkFamily(world, sib, baby, LINK.FRATRIE, LINK.FRATRIE);
  }

  mother.moodBias += 25;
  if (father) father.moodBias += 22;
  mother.needs.add('energie', -30);

  world.beat({
    kind: 'famille.naissance',
    text: `${baby.firstName} est né${gender === 'f' ? 'e' : ''} chez ${mother.shortName}${father ? ` et ${father.shortName}` : ''}. L'immeuble ne dormira plus avant deux ans.`,
    tone: TONE.TENDRE, weight: 0.9, actors: [mother.id, baby.id, father?.id].filter(Boolean), apartment: mother.apartment,
    causes: ['une grossesse menée à terme', 'un couple qui tient'],
  });
  const m = { kind: 'naissance', text: `la naissance de ${baby.firstName}`, valence: 0.95, strength: 1, about: baby.id, tick: world.clock.tick, core: true };
  mother.remember(m);
  father?.remember(m);
  mother.tags.add('parent');
  father?.tags.add('parent');
}

function blendPersonality(rng, a, b) {
  if (!b) return makePersonality(rng);
  const axes = {};
  for (const k of Object.keys(a.axes)) {
    const mid = (a.axes[k] + b.axes[k]) / 2;
    axes[k] = Math.min(1, Math.max(0, mid + (rng.next() - 0.5) * 0.5));
  }
  const fresh = makePersonality(rng);
  fresh.axes = axes;
  // Un trait hérité au hasard de l'un des deux parents : « il a le caractère
  // de son père » n'est pas qu'une expression.
  const inherited = rng.pick([...a.tags, ...b.tags]);
  if (inherited && fresh.tags.size < 6) fresh.tags.add(inherited);
  return fresh;
}

export function linkFamily(world, a, b, typeAtoB, typeBtoA = null) {
  const inverse = typeBtoA ?? (typeAtoB === LINK.ENFANT ? LINK.PARENT
    : typeAtoB === LINK.PARENT ? LINK.ENFANT : typeAtoB);
  const ra = a.relations.get(b.id);
  const rb = b.relations.get(a.id);
  ra.type = typeAtoB;
  rb.type = inverse;
  ra.affinity = Math.max(ra.affinity, 0.6);
  rb.affinity = Math.max(rb.affinity, 0.6);
  ra.familiarity = 1;
  rb.familiarity = 1;
  ra.trust = Math.max(ra.trust, 0.5);
  rb.trust = Math.max(rb.trust, 0.5);
}

// ---------------------------------------------------------------- ambitions

export function ambitionStep(world, p) {
  if (!p.ambition) return;
  const id = p.ambition.id;
  let progress = 0;
  switch (id) {
    case 'famille': progress = p.relations.children().length > 0 ? 1 : (p.relations.partner() ? 0.5 : 0.1); break;
    case 'carriere': progress = Math.min(1, (p.job.prestige ?? 0.2) * 0.6 + p.jobPerformance * 0.4); break;
    case 'argent': progress = Math.min(1, p.money / 12000); break;
    case 'paix': progress = Math.min(1, (1 - p.stress / 100) * 0.7 + (p.relations.enemies().length ? 0 : 0.3)); break;
    case 'amour': progress = p.relations.partner() ? 1 : Math.min(0.8, (p.relations.all().reduce((m, r) => Math.max(m, r.romance), 0))); break;
    case 'amitie': progress = Math.min(1, p.relations.friends().length / 4); break;
    case 'art': progress = Math.min(1, (p.creations ?? 0) / 5); break;
    case 'partir': progress = Math.min(1, p.money / 9000); break;
    case 'respect': progress = Math.min(1, p.relations.all().filter((r) => r.affinity > 0.4).length / 8); break;
    case 'sante': progress = p.health / 100; break;
    default: progress = 0;
  }
  const before = p.ambitionProgress;
  p.ambitionProgress = progress;

  if (before < 1 && progress >= 1 && !p.tags.has(`ambition_${id}`)) {
    p.tags.add(`ambition_${id}`);
    p.moodBias += 18;
    world.beat({
      kind: 'vie.ambition',
      text: `${p.shortName} a fini par ${p.ambition.label}. Ça lui aura pris du temps.`,
      tone: TONE.TENDRE, weight: 0.6, actors: [p.id], apartment: p.apartment,
      causes: [`c'était son objectif depuis le début`, `et ${pronom(p)} ne l'a dit à personne`],
    });
    p.remember({ kind: 'accomplissement', text: p.ambition.label, valence: 0.9, strength: 1, tick: world.clock.tick, core: true });
  }
}
