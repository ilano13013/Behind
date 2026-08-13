// Interventions.
//
// Le joueur ne contrôle personne. Il pose quelque chose dans la vie de
// quelqu'un — un cadeau, une lettre, une occasion — et il regarde ce que
// cette personne en fait. Un habitant fier refuse l'argent. Un habitant
// méfiant retourne le cadeau contre son voisin. Une fête réussie peut
// coûter une amitié au sixième étage.
//
// Chaque intervention peut donc améliorer une vie et en abîmer une autre.

import { TONE } from '../core/events.js';
import { LINK } from './relations.js';
import { compatibility } from './traits.js';
import { JOBS, jobLabel } from '../content/jobs.js';
import { g, pronom, Pronom, de } from '../core/text.js';
import { TICKS_PER_DAY } from '../core/clock.js';

export const INTERVENTIONS = [
  {
    id: 'cadeau',
    label: 'Déposer un cadeau anonyme',
    desc: 'Un paquet devant la porte, sans nom. On verra bien.',
    cost: 1,
    scope: 'personne',
    apply: (world, p) => {
      const rng = world.rng;
      const suspicious = p.personality.mefiance > 0.6;
      p.needs.add('plaisir', suspicious ? 4 : 20);

      if (suspicious) {
        // Il cherche qui. Et il se trompe.
        const neighbours = world.neighboursOf(p);
        const suspect = rng.pick(neighbours);
        p.externalStress = Math.min(80, p.externalStress + 8);
        if (suspect) {
          p.relations.get(suspect.id).adjust({ trust: -0.1, tension: 0.12, familiarity: 0.05 });
          p.remember({ kind: 'cadeau.suspect', text: `ce paquet bizarre devant la porte`, valence: -0.2, strength: 0.4, about: suspect.id, tick: world.clock.tick });
        }
        return {
          accepted: false,
          text: `${p.shortName} a trouvé le paquet. ${Pronom(p)} ne l'a pas ouvert. ${Pronom(p)} a regardé dans le couloir, longtemps.`,
          causes: [`${p.shortName} est méfiant (${Math.round(p.personality.mefiance * 100)}%)`,
            'un cadeau sans nom, ça inquiète plus que ça fait plaisir'],
          tone: TONE.TENDU,
        };
      }

      p.moodBias += 12;
      // Le paquet se voit. Trois ticks — un quart d'heure — pendant lesquels
      // l'habitant tient quelque chose dans les mains : sans ça, un cadeau
      // n'est qu'une ligne de chronique et rien à l'écran.
      p.parcel = { dir: 1, ttl: 3 };
      p.remember({ kind: 'cadeau', text: 'le paquet sans nom devant la porte', valence: 0.7, strength: 0.65, tick: world.clock.tick, core: true });
      // Un geste reçu donne envie d'en faire un autre : ça se propage.
      const friend = p.relations.all().filter((r) => r.affinity > 0.3)[0];
      if (friend && p.personality.get('amabilite') > 0.55) {
        const f = world.people.get(friend.other);
        if (f?.alive) {
          f.needs.add('plaisir', 10);
          f.relations.get(p.id).adjust({ affinity: 0.06 });
          // Le paquet change de mains : l'un le tend, l'autre le prend.
          p.parcel = { dir: -1, ttl: 3 };
          f.parcel = { dir: 1, ttl: 3 };
        }
      }
      return {
        accepted: true,
        text: `${p.shortName} a ouvert le paquet dans le couloir. ${Pronom(p)} a souri ${g(p, 'tout seul', 'toute seule')}, comme ${g(p, 'un idiot', 'une idiote')}.`,
        causes: [`${p.shortName} n'est pas du genre à se méfier`, 'il n\'attendait rien de personne'],
        tone: TONE.TENDRE,
      };
    },
  },

  {
    id: 'lettre',
    label: 'Glisser une lettre',
    desc: 'Quelques mots sous la porte. Ce qu\'il en fait ne dépend plus de vous.',
    cost: 1,
    scope: 'personne',
    apply: (world, p) => {
      // La lettre agit sur ce qui occupe déjà la personne : elle ne crée rien.
      const wound = p.memory.highlights(8).find((m) => m.valence < -0.5);
      const target = wound?.about ? world.people.get(wound.about) : null;

      if (target?.alive) {
        const rel = p.relations.get(target.id);
        const moved = p.personality.pardon * 0.6 + p.personality.get('ouverture') * 0.3
          - p.personality.t('tetu', 0.3) > 0.4;
        if (moved) {
          rel.adjust({ tension: -0.3, affinity: 0.12 });
          p.moodBias += 10;
          p.tags.add('veut_reconcilier');
          return {
            accepted: true,
            text: `${p.shortName} a lu la lettre deux fois. Le soir, ${pronom(p)} a regardé longtemps la porte de ${target.shortName}.`,
            causes: [`la lettre parlait de : ${wound.text}`, `${p.shortName} sait pardonner`],
            tone: TONE.TENDRE,
          };
        }
        p.externalStress = Math.min(85, p.externalStress + 10);
        rel.adjust({ tension: 0.1 });
        return {
          accepted: false,
          text: `${p.shortName} a lu la lettre. ${Pronom(p)} l'a froissée. On n'a pas le droit de lui parler de ça.`,
          causes: [`${wound.text}`, `${p.shortName} est ${p.personality.has('tetu') ? g(p, 'têtu', 'têtue') : g(p, 'fermé')}`],
          tone: TONE.TENDU,
        };
      }

      p.moodBias += 8;
      p.needs.add('social', 12);
      p.remember({ kind: 'lettre.recue', text: 'une lettre de quelqu\'un qui ne s\'est pas nommé', valence: 0.5, strength: 0.6, tick: world.clock.tick });
      return {
        accepted: true,
        text: `${p.shortName} a lu la lettre. ${Pronom(p)} l'a gardée. C'est déjà beaucoup.`,
        causes: ['personne ne lui écrit jamais'],
        tone: TONE.TENDRE,
      };
    },
  },

  {
    id: 'emploi',
    label: 'Proposer une opportunité',
    desc: 'Une annonce qui tombe au bon moment. À lui de la saisir.',
    cost: 2,
    scope: 'personne',
    condition: (p) => p.age >= 18 && p.age < 64 && p.job.id !== 'retraite',
    apply: (world, p) => {
      const rng = world.rng;
      const better = rng.weighted(
        JOBS.filter((j) => j.pay > p.income * 1.05),
        (j) => 1 / (1 + Math.abs(j.pay - p.income * 1.35) / 500),
      ) ?? rng.pick(JOBS);

      // Accepte-t-il ? Question d'ambition, de peur du changement, d'urgence.
      const drive = (p.ambition?.id === 'carriere' ? 0.35 : 0)
        + (p.job.id === 'chomage' ? 0.5 : 0)
        + (p.debt > 500 ? 0.25 : 0)
        + p.personality.get('ouverture') * 0.3
        + p.personality.serieux * 0.2
        - p.personality.get('anxiete') * 0.35
        - (p.age > 52 ? 0.25 : 0)
        - p.personality.t('paresseux', 0.3);

      if (drive < 0.45) {
        p.externalStress = Math.min(70, p.externalStress + 4);
        return {
          accepted: false,
          text: `${p.shortName} a regardé l'annonce. Il a dit « pas pour moi » à voix haute, alors qu'il était seul.`,
          causes: [
            p.personality.get('anxiete') > 0.6 ? `${p.shortName} a peur du changement` : null,
            p.age > 52 ? `${pronom(p)} se dit qu'${pronom(p)} est trop ${g(p, 'vieux', 'vieille')} pour ça` : null,
            p.personality.has('paresseux') ? `et ${pronom(p)} est bien là où ${pronom(p)} est` : null,
          ].filter(Boolean).slice(0, 2),
          tone: TONE.QUOTIDIEN,
        };
      }

      const old = p.job;
      p.job = { ...better };
      p.jobPerformance = 0.45;
      p.jobTenure = 0;
      p.moodBias += 15;
      p.externalStress = Math.max(0, p.externalStress - 15);
      p.remember({ kind: 'nouveau.travail', text: `le jour où il a osé changer de travail`, valence: 0.8, strength: 0.85, tick: world.clock.tick, core: true });

      // Un métier plus stressant peut détruire une vie de famille. Le joueur
      // ne le sait pas encore.
      const risk = better.stress > 0.7 && p.personality.get('anxiete') > 0.55;
      return {
        accepted: true,
        text: `${p.shortName} a décroché le poste : ${jobLabel(better, p)}. ${Pronom(p)} a monté les escaliers quatre à quatre.`,
        causes: [
          p.job.id === 'chomage' ? 'il n\'avait plus rien à perdre' : `${pronom(p)} était ${jobLabel(old, p)}`,
          p.ambition?.id === 'carriere' ? 'la carrière, c\'était son objectif' : 'il avait besoin d\'y croire',
          risk ? 'le poste est plus dur qu\'il ne le pense' : null,
        ].filter(Boolean),
        tone: TONE.TENDRE,
      };
    },
  },

  {
    id: 'argent',
    label: 'Aider financièrement',
    desc: 'Une enveloppe. La fierté, elle, ne se règle pas en liquide.',
    cost: 2,
    scope: 'personne',
    apply: (world, p) => {
      const amount = 600 + Math.round(Math.min(1200, p.debt * 0.6));
      // La fierté refuse. Toujours. C'est le prix d'être orgueilleux.
      if (p.personality.fierte > 0.62 && p.debt < 2000) {
        p.externalStress = Math.min(80, p.externalStress + 6);
        p.remember({ kind: 'aumone', text: 'l\'enveloppe qu\'il a refusée', valence: -0.3, strength: 0.5, tick: world.clock.tick });
        return {
          accepted: false,
          text: `${p.shortName} a trouvé l'enveloppe. ${Pronom(p)} l'a laissée sur la boîte aux lettres du hall. Pendant deux jours.`,
          causes: [`${p.shortName} est ${g(p, 'orgueilleux', 'orgueilleuse')} (${Math.round(p.personality.fierte * 100)}%)`,
            'il préfère couler que devoir quelque chose'],
          tone: TONE.TENDU,
        };
      }

      p.money += amount;
      const cleared = Math.min(p.debt, amount);
      p.debt = Math.max(0, p.debt - amount);
      p.externalStress = Math.max(0, p.externalStress - 25);
      p.moodBias += 14;
      if (p.debt === 0) p.tags.delete('crise');

      // Le revers : chez quelqu'un de fragile, l'argent trouve son chemin.
      if (p.addiction > 0.35) {
        p.addiction = Math.min(1, p.addiction + 0.1);
        return {
          accepted: true,
          text: `${p.shortName} a pris l'argent. Le soir même, la lumière est restée allumée très tard chez ${g(p, 'lui', 'elle')}.`,
          causes: [`${Math.round(cleared)} € de dettes effacées`,
            `${p.shortName} a un problème avec l'alcool depuis longtemps`,
            'l\'argent ne soigne pas tout'],
          tone: TONE.TENDU,
        };
      }
      return {
        accepted: true,
        text: `${p.shortName} a pris l'enveloppe. ${Pronom(p)} a payé le loyer le lendemain, en premier.`,
        causes: [`${Math.round(cleared)} € de dettes effacées`, 'il n\'en parlera à personne'],
        tone: TONE.TENDRE,
      };
    },
  },

  {
    id: 'rencontre',
    label: 'Favoriser une rencontre',
    desc: 'Un ascenseur qui s\'arrête, un colis mal livré. Le reste ne vous appartient pas.',
    cost: 2,
    scope: 'personne',
    apply: (world, p) => {
      const rng = world.rng;
      // Quelqu'un qu'il ne connaît pas encore, ou à peine.
      const strangers = world.livingPeople().filter((o) => {
        if (o.id === p.id) return false;
        const r = p.relations.get(o.id, false);
        return (!r || r.familiarity < 0.25) && Math.abs(o.age - p.age) < 25;
      });
      if (!strangers.length) {
        return { accepted: false, text: `${p.shortName} connaît déjà tout le monde ici.`, causes: [], tone: TONE.QUOTIDIEN };
      }
      const other = rng.pick(strangers);
      const compat = compatibility(p.personality, other.personality);

      const ra = p.relations.get(other.id);
      const rb = other.relations.get(p.id);
      ra.adjust({ familiarity: 0.2, affinity: compat * 0.25 });
      rb.adjust({ familiarity: 0.2, affinity: compat * 0.22 });
      ra.lastInteraction = world.clock.tick;
      rb.lastInteraction = world.clock.tick;
      ra.interactions++;
      rb.interactions++;

      if (compat > 0.25) {
        const romantic = !p.relations.partner() && !other.relations.partner()
          && p.age >= 18 && other.age >= 18 && Math.abs(p.age - other.age) < 14;
        if (romantic) {
          ra.adjust({ romance: 0.2 + compat * 0.2 });
          rb.adjust({ romance: 0.15 + compat * 0.18 });
        }
        return {
          accepted: true,
          text: `${p.shortName} et ${other.shortName} se sont retrouvés coincés dans l'ascenseur. Ils ont parlé vingt minutes.`,
          causes: [`ils ne s'étaient jamais parlé`, `ils s'entendent bien (${Math.round(compat * 100)}%)`,
            romantic ? 'et ils sont célibataires tous les deux' : null].filter(Boolean),
          tone: TONE.TENDRE,
        };
      }
      ra.adjust({ tension: 0.15 });
      rb.adjust({ tension: 0.15 });
      p.remember({ kind: 'mauvaise.rencontre', text: `dix minutes de trop avec ${other.shortName}`, valence: -0.35, strength: 0.4, about: other.id, tick: world.clock.tick });
      return {
        accepted: false,
        text: `${p.shortName} et ${other.shortName} se sont retrouvés coincés ensemble. Les vingt minutes ont paru longues.`,
        causes: [`leurs caractères ne collent pas (${Math.round(compat * 100)}%)`,
          'vous ne pouviez pas le savoir'],
        tone: TONE.DROLE,
      };
    },
  },

  {
    id: 'fete',
    label: 'Organiser un évènement',
    desc: 'Un vide-grenier dans la cour. Tout le monde n\'a pas envie de descendre.',
    cost: 3,
    scope: 'immeuble',
    apply: (world) => {
      const rng = world.rng;
      const people = world.livingPeople();
      const came = [];
      const stayed = [];
      for (const p of people) {
        const willing = p.personality.sociabilite * 0.7 + (p.mood / 100) * 0.3
          - p.personality.t('discret', 0.35) - (p.isOld ? 0.1 : 0) + rng.float(-0.15, 0.15);
        if (willing > 0.42) came.push(p);
        else stayed.push(p);
      }

      for (const p of came) {
        p.needs.add('social', 30);
        p.needs.add('plaisir', 22);
        p.moodBias += 6;
        for (const q of came) {
          if (q.id === p.id) continue;
          const compat = compatibility(p.personality, q.personality);
          const rel = p.relations.get(q.id);
          rel.adjust({ familiarity: 0.08, affinity: compat * 0.06 });
          rel.lastInteraction = world.clock.tick;
          // Une fête ne réconcilie pas ceux qui se détestent : elle les met
          // dans la même cour.
          if (rel.tension > 0.5 && compat < 0) rel.adjust({ tension: 0.08 });
          else if (rel.tension > 0.2) rel.adjust({ tension: -0.06 });
        }
      }
      for (const p of stayed) {
        // Rester chez soi pendant que tout l'immeuble rit en bas, ça se paie.
        if (p.personality.sociabilite > 0.4) {
          p.needs.add('social', -8);
          p.moodBias -= 3;
        }
      }
      world.setBuildingNoise(0.7, TICKS_PER_DAY / 3);

      return {
        accepted: came.length > people.length * 0.4,
        text: `Vide-grenier dans la cour. ${came.length} habitants sont descendus. ${stayed.length} ont regardé par la fenêtre.`,
        causes: ['une table, deux tréteaux, et beaucoup de curiosité',
          stayed.length > came.length ? 'l\'immeuble n\'était pas d\'humeur' : 'l\'immeuble avait besoin de ça'],
        tone: came.length > stayed.length ? TONE.TENDRE : TONE.DROLE,
        actors: came.slice(0, 6).map((p) => p.id),
      };
    },
  },

  {
    id: 'reparer',
    label: 'Réparer un équipement commun',
    desc: 'L\'ascenseur, l\'interphone, la minuterie. Personne ne vous remerciera.',
    cost: 2,
    scope: 'immeuble',
    apply: (world) => {
      const what = world.elevatorBroken ? 'l\'ascenseur'
        : world.security < 0.5 ? 'la porte du hall'
          : world.averageCondition() < 0.6 ? 'la minuterie de la cage d\'escalier'
            : 'l\'interphone';

      if (what === 'l\'ascenseur') {
        world.elevatorBroken = false;
        for (const p of world.livingPeople()) {
          const apt = world.apartments[p.apartment];
          if (apt && apt.floor >= 3) p.externalStress = Math.max(0, p.externalStress - 12);
        }
      } else if (what === 'la porte du hall') {
        world.security = Math.min(1, world.security + 0.3);
        for (const p of world.livingPeople()) p.externalStress = Math.max(0, p.externalStress - 6);
      } else {
        for (const apt of world.apartments) {
          if (!apt.special) apt.condition = Math.min(1, apt.condition + 0.12);
        }
        for (const p of world.livingPeople()) p.needs.add('confort', 10);
      }

      // Le bricoleur de l'immeuble se sent doublé. Il est vexé. C'est humain.
      const bricoleur = world.livingPeople().find((p) => p.personality.has('bricoleur'));
      let jab = null;
      if (bricoleur && world.rng.chance(0.5)) {
        bricoleur.moodBias -= 4;
        jab = `${bricoleur.shortName} dit qu'il allait le faire ce week-end.`;
      }

      return {
        accepted: true,
        text: `Quelqu'un a réparé ${what}. ${jab ?? 'Personne ne sait qui.'}`,
        causes: ['ça ne marchait plus depuis longtemps', 'l\'immeuble respire un peu mieux'],
        tone: TONE.QUOTIDIEN,
      };
    },
  },

  {
    id: 'mot',
    label: 'Afficher un mot dans le hall',
    desc: 'Une feuille A4 scotchée. L\'arme la plus puissante de la copropriété.',
    cost: 1,
    scope: 'immeuble',
    apply: (world) => {
      const rng = world.rng;
      const noisy = world.livingPeople()
        .filter((p) => p.personality.has('bruyant'))
        .sort((a, b) => b.personality.get('extraversion') - a.personality.get('extraversion'))[0];
      const messages = [
        'MERCI DE NE PAS CLAQUER LA PORTE (les gens dorment)',
        'À la personne qui met ses poubelles dans le local vélo : on sait qui vous êtes.',
        'La fête d\'hier : c\'était très bien, mais 3 h du matin, non.',
        'Qui a pris mon colis ? Aucun jugement. Rendez-le.',
        'Le chat du 4e n\'est PAS un chat errant. Arrêtez de le nourrir.',
      ];
      const msg = rng.pick(messages);

      let touched = 0;
      for (const p of world.livingPeople()) {
        if (p.personality.has('susceptible') || p.personality.has('orgueilleux')) {
          p.externalStress = Math.min(70, p.externalStress + 5);
          touched++;
        }
      }
      if (noisy) {
        noisy.externalStress = Math.min(75, noisy.externalStress + 8);
        // Se sentir visé rend rarement plus discret.
        if (noisy.personality.has('tetu')) {
          world.setNoise(noisy.apartment, 0.8);
        }
      }
      return {
        accepted: true,
        text: `Un mot est apparu dans le hall : « ${msg} » ${touched} personnes se sont senties visées.`,
        causes: ['une feuille A4 et beaucoup de convictions',
          noisy?.personality.has('tetu') ? `${noisy.shortName} a mis la musique plus fort` : null].filter(Boolean),
        tone: TONE.DROLE,
      };
    },
  },
];

export const INTERVENTION_BY_ID = new Map(INTERVENTIONS.map((i) => [i.id, i]));

export class InfluenceMeter {
  constructor(max = 5) {
    this.max = max;
    this.points = 3;
    this.progress = 0;
  }

  /** Un point tous les deux jours. Observer coûte de la patience. */
  tick(dt = 1) {
    this.progress += dt / (TICKS_PER_DAY * 2);
    while (this.progress >= 1 && this.points < this.max) {
      this.progress -= 1;
      this.points++;
    }
    if (this.points >= this.max) this.progress = 0;
  }

  can(cost) {
    return this.points >= cost;
  }

  spend(cost) {
    if (!this.can(cost)) return false;
    this.points -= cost;
    return true;
  }
}

/** Exécute une intervention. Retourne le résultat, ou null si impossible. */
export function performIntervention(world, id, targetId = null) {
  const def = INTERVENTION_BY_ID.get(id);
  if (!def) return null;
  if (!world.influence.can(def.cost)) {
    return { error: 'Pas assez d\'influence. Il faut attendre.' };
  }

  let person = null;
  if (def.scope === 'personne') {
    person = world.people.get(targetId);
    if (!person || !person.alive) return { error: 'Cette personne n\'est plus là.' };
    if (def.condition && !def.condition(person)) {
      return { error: 'Ça n\'a pas de sens pour cette personne.' };
    }
    if (person.interventionCooldown > world.clock.tick) {
      return { error: `${person.shortName} a déjà eu sa part d'étrangeté cette semaine.` };
    }
  }

  world.influence.spend(def.cost);
  if (person) person.interventionCooldown = world.clock.tick + TICKS_PER_DAY * 4;

  const res = def.apply(world, person);
  world.beat({
    kind: `intervention.${def.id}`,
    text: res.text,
    tone: res.tone ?? TONE.QUOTIDIEN,
    weight: 0.55,
    actors: res.actors ?? (person ? [person.id] : []),
    apartment: person?.apartment ?? null,
    causes: ['une intervention discrète de votre part', ...(res.causes ?? [])],
  });
  world.bus.emit('intervention', { id: def.id, result: res, person });
  return res;
}
