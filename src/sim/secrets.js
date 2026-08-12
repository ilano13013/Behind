// Secrets.
//
// Des choses très rares, qui n'arrivent presque jamais, et qu'on a envie
// de raconter à quelqu'un. Le plus important d'entre eux est l'appartement
// éteint : il existe dans chaque partie, personne n'y habite, et les
// habitants en parlent parfois comme d'une légende.

import { TONE } from '../core/events.js';
import { TICKS_PER_DAY, DAYS_PER_YEAR } from '../core/clock.js';
import { g, pronom } from '../core/text.js';
import { traitLabel } from './traits.js';

export const SECRET_LIST = [
  { id: 'appartement_eteint', title: 'L\'appartement éteint', hint: 'Une fenêtre ne s\'allume jamais.' },
  { id: 'chat_de_personne', title: 'Le chat de personne', hint: 'Il appartient à tout le monde et à personne.' },
  { id: 'lettre_jamais_envoyee', title: 'La lettre jamais envoyée', hint: 'Écrite, relue, jamais postée.' },
  { id: 'concert_de_4h', title: 'Le concert de 4 h', hint: 'Une nuit, personne n\'a appelé la police.' },
  { id: 'nuit_sans_lumiere', title: 'La nuit sans lumière', hint: 'Toutes les fenêtres éteintes en même temps.' },
  { id: 'fete_de_l_immeuble', title: 'La fête de l\'immeuble', hint: 'Quand tout le monde va bien en même temps.' },
  { id: 'locataire_fantome', title: 'Le locataire fantôme', hint: 'Une silhouette dans un appartement vide.' },
  { id: 'boite_aux_lettres', title: 'Le nom sur la boîte', hint: 'Personne ne connaît ce nom-là.' },
  { id: 'vieille_dame_qui_sait', title: 'Celle qui sait tout', hint: 'Elle vous regarde par l\'œilleton depuis le début.' },
  { id: 'le_regard', title: 'Le regard', hint: '—' },
];

/** Conditions d'accès à l'appartement caché. Aucune n'est affichée en clair. */
const HIDDEN_CONDITIONS = [
  { id: 'legende', label: 'Entendre la légende de trois habitants différents' },
  { id: 'veille', label: 'Veiller longtemps devant la fenêtre éteinte' },
  { id: 'cycle', label: 'Avoir vu l\'immeuble perdre quelqu\'un et accueillir quelqu\'un' },
  { id: 'bonheur', label: 'Rendre l\'immeuble heureux' },
];

export class Secrets {
  constructor(world) {
    this.world = world;
    this.discovered = new Set();
    this.conditions = new Set();
    this.legendTellers = new Set();
    this.watchTicks = 0;       // temps passé par le joueur sur la fenêtre éteinte
    this.hasBirth = false;
    this.hasDeath = false;
    this.peakHappiness = 0;
    this.hiddenUnlocked = false;
    this.hiddenEntered = false;
    this.finaleState = null;
    this.ghostApartment = null;
    this.catAt = null;
    this.catTimer = 0;
    this.lastSecretDay = -999;
  }

  get hiddenApartment() {
    return this.world.hiddenApartmentId;
  }

  discover(id) {
    if (this.discovered.has(id)) return false;
    this.discovered.add(id);
    const s = SECRET_LIST.find((x) => x.id === id);
    this.world.bus.emit('secret', { id, title: s?.title ?? id });
    return true;
  }

  // --- Suivi des conditions ---

  notifyBirth() {
    this.hasBirth = true;
    this.checkCycle();
  }

  notifyDeath() {
    this.hasDeath = true;
    this.checkCycle();
  }

  checkCycle() {
    if (this.hasBirth && this.hasDeath) this.addCondition('cycle');
  }

  notifyDisappearance(person) {
    // Un appartement d'où quelqu'un a disparu garde une présence.
    if (person.apartment !== null) this.ghostApartment = person.apartment;
  }

  notifyCrime() {
    // Le crime ne débloque rien. Il pèse, c'est tout.
  }

  addCondition(id) {
    if (this.conditions.has(id)) return;
    this.conditions.add(id);
    this.world.bus.emit('condition', { id, total: HIDDEN_CONDITIONS.length, done: this.conditions.size });
    this.checkUnlock();
  }

  checkUnlock() {
    if (this.hiddenUnlocked) return;
    if (this.conditions.size < HIDDEN_CONDITIONS.length) return;
    this.hiddenUnlocked = true;
    this.world.bus.emit('hidden-unlocked', {});
    this.world.beat({
      kind: 'secret.legende',
      text: `Quelque chose a changé dans l'immeuble. La fenêtre du ${this.world.aptName(this.world.apartments[this.hiddenApartment])} n'est plus tout à fait éteinte.`,
      tone: TONE.SECRET, weight: 1, actors: [], apartment: this.hiddenApartment,
      causes: ['vous avez regardé longtemps', 'vous avez écouté ce qu\'on raconte',
        'l\'immeuble a perdu et gagné quelqu\'un', 'les gens y vont mieux qu\'avant'],
    });
  }

  /** Le joueur regarde la fenêtre éteinte. */
  observeHidden(dt) {
    this.watchTicks += dt;
    if (this.watchTicks > 900 && !this.conditions.has('veille')) this.addCondition('veille');
  }

  /** Peut-on entrer, maintenant ? La dernière porte est une heure. */
  canEnter() {
    if (!this.hiddenUnlocked || this.hiddenEntered) return false;
    const c = this.world.clock;
    return c.hour === 3 && c.minute >= 30 && c.minute < 40;
  }

  enterHidden() {
    if (!this.canEnter()) return false;
    this.hiddenEntered = true;
    this.discover('appartement_eteint');
    this.finaleState = { phase: 'entree', t: 0 };
    this.world.bus.emit('finale', { phase: 'entree' });
    return true;
  }

  /** Après le regard, la fenêtre s'éteint définitivement. */
  sealHidden() {
    const apt = this.world.apartments[this.hiddenApartment];
    if (apt) apt.sealed = true;
    this.discover('le_regard');
    this.finaleState = null;
  }

  // --- Rumeurs : les habitants entretiennent la légende eux-mêmes ---

  spreadLegend(person) {
    if (this.legendTellers.has(person.id)) return;
    const apt = this.world.apartments[this.hiddenApartment];
    if (!apt) return;
    this.legendTellers.add(person.id);
    person.secrets.add('legende');
    const lines = [
      `Le ${this.world.aptName(apt)} ? Personne n'y a jamais vu de lumière. Même le syndic sait pas qui c'est.`,
      `On dit que le ${this.world.aptName(apt)} est loué depuis vingt ans. À qui, ça…`,
      `Ma mère disait déjà que le ${this.world.aptName(apt)} était vide. Ma mère.`,
      `Une fois j'ai cru voir un écran allumé au ${this.world.aptName(apt)}. J'avais bu, remarque.`,
      `Le facteur a arrêté de monter au ${this.world.aptName(apt)}. Y'a plus de nom sur la boîte.`,
    ];
    this.world.beat({
      kind: 'secret.legende',
      text: `${person.shortName} : « ${this.world.rng.pick(lines)} »`,
      tone: TONE.SECRET, weight: 0.55, actors: [person.id], apartment: person.apartment,
      causes: [`${person.shortName} est ${person.personality.has('commere') ? 'une commère' : traitLabel('curieux', person)}`,
        'l\'immeuble a sa légende'],
    });
    if (this.legendTellers.size >= 3) this.addCondition('legende');
  }

  // --- Passage quotidien ---

  daily() {
    const w = this.world;
    const rng = w.rng;

    // Le bonheur général, condition la plus longue à obtenir.
    const h = w.averageHappiness();
    this.peakHappiness = Math.max(this.peakHappiness, h);
    if (h >= 68) this.addCondition('bonheur');

    // La légende circule : les curieux en parlent, rarement.
    if (rng.chance(0.045)) {
      const talkers = w.livingPeople().filter((p) =>
        p.age > 12 && !this.legendTellers.has(p.id)
        && (p.personality.curiosite > 0.55 || p.isOld));
      const p = rng.pick(talkers);
      if (p) this.spreadLegend(p);
    }

    if (w.clock.day - this.lastSecretDay < 3) return;

    // Le chat de personne : il passe, il repart, il ne dit rien.
    if (rng.chance(0.03)) {
      const occupied = w.occupiedApartments();
      if (occupied.length) {
        this.catAt = rng.pick(occupied).id;
        this.catTimer = rng.int(200, 600);
        this.lastSecretDay = w.clock.day;
      }
    }

    // La lettre jamais envoyée.
    if (rng.chance(0.012)) {
      const p = rng.pick(w.livingPeople().filter((x) =>
        x.age > 25 && x.memory.items.some((m) => m.valence < -0.6 && m.core)));
      if (p) {
        const m = p.memory.items.filter((x) => x.valence < -0.6 && x.core)[0];
        const to = m.about ? w.people.get(m.about) ?? w.dead.find((d) => d.id === m.about) : null;
        p.tags.add('lettre');
        this.lastSecretDay = w.clock.day;
        w.beat({
          kind: 'secret.lettre',
          text: `${p.shortName} a écrit une lettre${to ? ` à ${to.shortName}` : ''}. ${pronom(p).charAt(0).toUpperCase() + pronom(p).slice(1)} l'a relue, pliée, et rangée dans un tiroir.`,
          tone: TONE.SECRET, weight: 0.7, actors: [p.id], apartment: p.apartment,
          causes: [`${m.text}`, `${p.shortName} ne sait pas dire les choses`],
        });
        this.discover('lettre_jamais_envoyee');
      }
    }

    // Le concert de 4 h : un musicien joue, et personne ne se plaint.
    if (rng.chance(0.006)) {
      const musicien = rng.pick(w.livingPeople().filter((x) => x.job.id === 'musicien' || x.personality.has('drole')));
      if (musicien) {
        this.lastSecretDay = w.clock.day;
        w.beat({
          kind: 'secret.concert',
          text: `À 4 h du matin, ${musicien.shortName} s'est mis à jouer. Des fenêtres se sont ouvertes. Personne n'a crié. On a écouté.`,
          tone: TONE.SECRET, weight: 0.9, actors: [musicien.id], apartment: musicien.apartment,
          causes: ['une nuit particulière', 'un immeuble qui allait bien ce soir-là'],
        });
        for (const p of w.livingPeople()) {
          p.moodBias += 6;
          p.remember({ kind: 'concert', text: 'la nuit du concert', valence: 0.7, strength: 0.7, tick: w.clock.tick, core: true });
        }
        this.discover('concert_de_4h');
      }
    }

    // La nuit sans lumière : statistiquement improbable, donc mémorable.
    if (rng.chance(0.004)) {
      w.forcedBlackoutDay = w.clock.day;
      this.lastSecretDay = w.clock.day;
      w.beat({
        kind: 'secret.nuit_noire',
        text: `Cette nuit-là, toutes les fenêtres se sont éteintes en même temps. Personne n'a su pourquoi.`,
        tone: TONE.SECRET, weight: 0.85, actors: [], apartment: null,
        causes: ['un hasard', 'ou pas'],
      });
      this.discover('nuit_sans_lumiere');
    }

    // La fête spontanée de l'immeuble.
    const happyEnough = w.livingPeople().filter((p) => p.happiness > 70).length;
    if (happyEnough > w.livingPeople().length * 0.75 && rng.chance(0.05)) {
      this.lastSecretDay = w.clock.day;
      w.buildingParty = w.clock.day;
      for (const p of w.livingPeople()) {
        p.needs.add('social', 30);
        p.needs.add('plaisir', 25);
        p.moodBias += 8;
        for (const rel of p.relations.all()) rel.adjust({ affinity: 0.05, tension: -0.1 });
      }
      w.beat({
        kind: 'secret.fete_immeuble',
        text: `Quelqu'un a sorti une table dans la cour. Puis une deuxième. À minuit, il y avait tout l'immeuble, et même le 6e droite.`,
        tone: TONE.SECRET, weight: 0.95, actors: [], apartment: null,
        causes: ['tout le monde allait bien en même temps', 'ça n\'arrive presque jamais'],
      });
      this.discover('fete_de_l_immeuble');
    }

    // Le locataire fantôme : là où quelqu'un a disparu.
    if (this.ghostApartment !== null && rng.chance(0.02)) {
      const apt = w.apartments[this.ghostApartment];
      if (apt && apt.residents.length === 0) {
        this.lastSecretDay = w.clock.day;
        apt.ghostFlicker = w.clock.tick + 300;
        w.beat({
          kind: 'secret.fantome',
          text: `Une lumière s'est allumée au ${w.aptName(apt)}. Il est vide depuis des mois.`,
          tone: TONE.SECRET, weight: 0.8, actors: [], apartment: apt.id,
          causes: ['personne n\'a les clés', 'quelqu\'un a disparu d\'ici'],
        });
        this.discover('locataire_fantome');
      }
    }

    if (this.catTimer > 0) this.catTimer -= TICKS_PER_DAY;
    else this.catAt = null;
  }

  /** Ce que le joueur peut voir de sa progression, sans rien lui donner. */
  progress() {
    return {
      found: this.discovered.size,
      total: SECRET_LIST.length,
      list: SECRET_LIST.map((s) => ({
        ...s,
        found: this.discovered.has(s.id),
      })),
      hidden: {
        unlocked: this.hiddenUnlocked,
        entered: this.hiddenEntered,
        conditions: HIDDEN_CONDITIONS.map((c) => ({ ...c, done: this.conditions.has(c.id) })),
      },
    };
  }
}
