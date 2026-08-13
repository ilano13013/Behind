// Le monde.
//
// Un immeuble, ses appartements, ses habitants, et une boucle qui fait
// tourner tout ça. Le monde ne raconte rien : il fait vivre des gens, et
// la chronique enregistre ce qui en sort.

import { RNG } from '../core/rng.js';
import { Clock, TICKS_PER_DAY, DAYS_PER_MONTH } from '../core/clock.js';
import { EventBus, Chronicle, makeBeat, TONE } from '../core/events.js';
import { makeApartments, populateApartment, seedHistory, SPECIAL_UNITS } from './building.js';
import { buildContext, chooseAction, ACTION_BY_ID } from './actions.js';
import { decayNeeds } from './needs.js';
import {
  resolveVisit, resolveComplaint, resolveConfrontation, resolveReconcile,
  resolveFlirt, resolveHouseholdTime, exchangeGossip,
  encounterQuality, applyEncounter,
} from './interactions.js';
import {
  ageOneDay, healthStep, workStep, monthlyMoney, romanceStep, familyStep, ambitionStep, die,
} from './lifecycle.js';
import { Director } from './director.js';
import { Secrets } from './secrets.js';
import { InfluenceMeter } from './interventions.js';
import { LINK } from './relations.js';
import { speech } from '../content/lines.js';

const FLOOR_SIDES = ['gauche', 'droite', 'face', 'fond'];

export class World {
  constructor(opts = {}) {
    this.seed = opts.seed ?? 'behind';
    this.rng = new RNG(this.seed);
    this.clock = new Clock(opts.startTick ?? 7 * 12);
    this.bus = new EventBus();
    this.chronicle = new Chronicle();
    this.weather = { id: 'clair', intensity: 0.5 };

    this.floors = opts.floors ?? 11;
    this.cols = opts.cols ?? 8;

    this.people = new Map();
    this.dead = [];
    this.apartments = [];
    this.hiddenApartmentId = null;
    this.keeperId = null;
    this.doyenneId = null;

    this.security = 0.55;
    this.elevatorBroken = false;
    this.elevatorFixDay = 0;
    this.buildingNoise = 0;
    this.buildingNoiseUntil = 0;
    this.forcedBlackoutDay = -1;
    this.buildingParty = -1;

    this.influence = new InfluenceMeter();
    this.director = new Director(this);
    this.secrets = new Secrets(this);

    this.stats = { births: 0, deaths: 0, couples: 0, breakups: 0, moveIns: 0, moveOuts: 0 };
    this.beatThrottle = new Map();
    this.occupancy = new Map();
    this.generate();
    this.rebuildOccupancy();
  }

  // ------------------------------------------------------------- création

  generate() {
    this.apartments = makeApartments(this.rng, this.floors, this.cols);

    const habitable = this.apartments.filter((a) => !a.special);

    // L'appartement caché : jamais au rez-de-chaussée, jamais en évidence.
    const hiddenPool = habitable.filter((a) => a.floor >= 2 && a.floor <= this.floors - 1);
    const hidden = this.rng.pick(hiddenPool);
    hidden.hidden = true;
    hidden.curtains = 'closed';
    hidden.condition = 1;
    hidden.plants = 0;
    hidden.laundry = false;
    hidden.dish = false;
    hidden.gag = null;
    this.hiddenApartmentId = hidden.id;

    // On laisse quelques logements vides : un immeuble plein est un immeuble
    // sans mouvement, et le mouvement fait les histoires.
    for (const apt of habitable) {
      if (apt.hidden) continue;
      if (apt.special === SPECIAL_UNITS.LOGE) {
        populateApartment(this.rng, apt, this, 'solo_adulte');
        continue;
      }
      if (this.rng.chance(0.07)) {
        apt.vacantSince = -this.rng.int(1, 60) * TICKS_PER_DAY;
        continue;
      }
      populateApartment(this.rng, apt, this);
    }

    // La loge est un cas à part : elle est habitée même si elle est marquée.
    const loge = this.apartments.find((a) => a.special === SPECIAL_UNITS.LOGE);
    if (loge && !loge.residents.length) {
      loge.rooms = 2;
      loge.rent = 0;
      populateApartment(this.rng, loge, this, 'solo_adulte');
    }

    seedHistory(this.rng, this);

    for (const p of this.livingPeople()) {
      p.action = null;
      p.location = 'home';
    }
  }

  // ------------------------------------------------------------- accès

  /**
   * Qui se trouve dans quel appartement, à cet instant.
   * Recalculé une fois par tick : le rendu tourne à 60 images par seconde
   * et n'a pas à balayer tous les habitants pour chaque fenêtre.
   */
  rebuildOccupancy() {
    this.occupancy.clear();
    for (const p of this.people.values()) {
      if (!p.alive || p.present === false) continue;
      const where = typeof p.location === 'number' ? p.location
        : p.location === 'home' ? p.apartment : null;
      if (where === null || where === undefined) continue;
      let list = this.occupancy.get(where);
      if (!list) {
        list = [];
        this.occupancy.set(where, list);
      }
      list.push(p);
    }
  }

  livingPeople() {
    const out = [];
    for (const p of this.people.values()) if (p.alive && p.present !== false) out.push(p);
    return out;
  }

  occupiedApartments() {
    return this.apartments.filter((a) => a.residents.length > 0);
  }

  vacantApartments() {
    return this.apartments.filter((a) => !a.special && !a.hidden && a.residents.length === 0);
  }

  aptName(apt) {
    if (!apt) return '?';
    if (apt.special === SPECIAL_UNITS.LOGE) return 'la loge';
    if (apt.special === SPECIAL_UNITS.HALL) return 'le hall';
    if (apt.special === SPECIAL_UNITS.COMMERCE) return 'le local commercial';
    const side = FLOOR_SIDES[apt.col % FLOOR_SIDES.length];
    if (apt.floor === 0) return `rez-de-chaussée ${side}`;
    return `${apt.floor}${apt.floor === 1 ? 'er' : 'e'} ${side}`;
  }

  apartmentAbove(apt) {
    return this.apartments.find((a) => a.col === apt.col && a.floor === apt.floor + 1 && !a.special) ?? null;
  }

  apartmentBelow(apt) {
    return this.apartments.find((a) => a.col === apt.col && a.floor === apt.floor - 1 && !a.special) ?? null;
  }

  neighboursOf(person) {
    const apt = this.apartments[person.apartment];
    if (!apt) return [];
    const out = [];
    for (const nid of apt.neighbours) {
      for (const rid of this.apartments[nid].residents) {
        const p = this.people.get(rid);
        if (p?.alive) out.push(p);
      }
    }
    return out;
  }

  averageHappiness() {
    const people = this.livingPeople();
    if (!people.length) return 0;
    return people.reduce((s, p) => s + p.happiness, 0) / people.length;
  }

  happinessBreakdown() {
    const people = this.livingPeople();
    const acc = {};
    for (const p of people) {
      const f = p.happinessFactors();
      for (const [k, v] of Object.entries(f)) acc[k] = (acc[k] ?? 0) + v;
    }
    for (const k of Object.keys(acc)) acc[k] = (acc[k] / Math.max(1, people.length)) * 100;
    return acc;
  }

  averageCondition() {
    const a = this.apartments.filter((x) => !x.special);
    return a.reduce((s, x) => s + x.condition, 0) / Math.max(1, a.length);
  }

  // ------------------------------------------------------------- mutations

  /**
   * Anti-répétition de la chronique.
   * L'immeuble peut très bien se disputer tous les jours ; la chronique,
   * elle, n'a pas besoin de l'écrire tous les jours. On garde la vie, on
   * jette la redite.
   */
  canBeat(kind, key, days) {
    const k = `${kind}:${key}`;
    const last = this.beatThrottle.get(k) ?? -99999;
    if (this.clock.tick - last < days * TICKS_PER_DAY) return false;
    this.beatThrottle.set(k, this.clock.tick);
    return true;
  }

  beat(o) {
    const b = makeBeat({ ...o, tick: this.clock.tick, stamp: this.clock.stamp() });
    this.chronicle.add(b);
    this.bus.emit('beat', b);
    if (b.kind === 'famille.naissance') {
      this.stats.births++;
      this.secrets.notifyBirth();
    }
    if (b.kind === 'sante.mort') {
      this.stats.deaths++;
      this.secrets.notifyDeath();
    }
    if (b.kind === 'romance.couple') this.stats.couples++;
    if (b.kind === 'romance.rupture') this.stats.breakups++;
    return b;
  }

  addResident(p, aptId) {
    p.apartment = aptId;
    p.present = true;
    this.people.set(p.id, p);
    const apt = this.apartments[aptId];
    if (apt && !apt.residents.includes(p.id)) apt.residents.push(p.id);
    if (apt) apt.vacantSince = null;
  }

  removeResident(p, reason = 'parti') {
    const apt = this.apartments[p.apartment];
    if (apt) {
      apt.residents = apt.residents.filter((id) => id !== p.id);
      if (apt.residents.length === 0) apt.vacantSince = this.clock.tick;
    }
    p.present = false;
    p.apartment = null;
    p.action = null;
    p.leftReason = reason;
    this.stats.moveOuts++;
  }

  /** Reloger sur place si c'est possible, sinon quitter l'immeuble. */
  rehouseOrLeave(p, reason) {
    const affordable = this.vacantApartments()
      .filter((a) => a.rent <= p.income * 0.42)
      .sort((a, b) => a.rent - b.rent);
    const target = affordable[0];
    if (target && this.rng.chance(0.6)) {
      const old = this.apartments[p.apartment];
      if (old) {
        old.residents = old.residents.filter((id) => id !== p.id);
        if (old.residents.length === 0) old.vacantSince = this.clock.tick;
      }
      this.addResident(p, target.id);
      p.location = 'home';
      this.beat({
        kind: 'logement.demenagement',
        text: reason === 'independance'
          ? `${p.shortName} a pris son propre appartement, ${this.aptName(target)}. Sa mère est descendue trois fois le premier jour.`
          : `${p.shortName} a déménagé au ${this.aptName(target)}. Deux étages, une vie différente.`,
        tone: TONE.QUOTIDIEN, weight: 0.45, actors: [p.id], apartment: target.id,
        causes: [reason === 'independance' ? 'il gagnait enfin assez' : 'il ne pouvait plus rester là-haut'],
      });
      return true;
    }
    this.beat({
      kind: 'logement.depart',
      text: `${p.name} a quitté l'immeuble.`,
      tone: TONE.QUOTIDIEN, weight: 0.5, actors: [p.id], apartment: p.apartment,
      causes: [reason === 'rupture' ? 'la séparation' : 'il fallait bien partir',
        'aucun logement libre à son budget ici'],
    });
    this.removeResident(p, reason);
    return false;
  }

  setNoise(aptId, level) {
    const apt = this.apartments[aptId];
    if (apt) apt.noise = Math.max(apt.noise, level);
  }

  setBuildingNoise(level, duration) {
    this.buildingNoise = level;
    this.buildingNoiseUntil = this.clock.tick + duration;
  }

  // ------------------------------------------------------------- boucle

  tick() {
    const clock = this.clock;
    clock.advance(1);
    const t = clock.tick;

    // 1. Le bruit se recalcule intégralement chaque tick. On garde la durée
    //    du vacarme : c'est elle qui fait monter chez le voisin, pas le pic.
    for (const apt of this.apartments) {
      apt.noiseStreak = apt.noise > 0.35 ? (apt.noiseStreak ?? 0) + 1 : 0;
      apt.noise = 0;
    }
    if (t > this.buildingNoiseUntil) this.buildingNoise = 0;

    const people = this.livingPeople();

    // 2. Les actions en cours produisent leurs effets.
    for (const p of people) {
      if (!p.action) continue;
      const def = p.action.def;
      p.needs.apply(def.rates);
      if (def.health) p.health = Math.min(100, Math.max(0, p.health + def.health));
      if (def.noise && (p.location === 'home' || typeof p.location === 'number')) {
        const where = typeof p.location === 'number' ? p.location : p.apartment;
        if (where !== null) {
          // La nuit, le même volume paraît deux fois plus fort.
          this.setNoise(where, def.noise * (clock.isNight ? 1.25 : 1));
        }
      }
      p.action.remaining--;
      if (p.action.remaining <= 0) {
        if (def.onEnd) def.onEnd(p, this);
        this.endAction(p);
      }
    }

    // 3. Besoins, humeur, stress.
    for (const p of people) {
      decayNeeds(p, { cold: clock.season === 0 });
      p.externalStress *= 0.9985;
      if (p.speech) {
        p.speech.ttl--;
        if (p.speech.ttl <= 0) p.speech = null;
      }
    }

    // 4. Décisions : uniquement pour ceux qui n'ont rien en cours.
    for (const p of people) {
      if (p.action) continue;
      if (p.age < 1) continue; // les nourrissons subissent, ils ne décident pas
      const ctx = buildContext(p, this);
      const action = chooseAction(p, ctx);
      this.startAction(p, action, ctx);
    }

    // 5. Le bruit dérange : il monte le stress de ceux qui ne le supportent pas.
    this.propagateNoise(people);

    // 6. Rythmes lents.
    if (t % TICKS_PER_DAY === 0) this.daily();
    if (t % (TICKS_PER_DAY * DAYS_PER_MONTH) === 0) this.monthly();

    this.influence.tick(1);
    this.rebuildOccupancy();
    this.bus.emit('tick', t);
  }

  startAction(p, action, ctx) {
    p.action = action;
    const def = action.def;

    if (def.cost) p.money = Math.max(0, p.money - def.cost);
    if (action.line) p.say(action.line, Math.min(40, action.total * 3));

    // Déplacement. Sortir, c'est traverser la cage d'escalier, et la cage
    // d'escalier est le vrai lieu de vie de l'immeuble.
    const wasHome = p.location === 'home';
    if (def.place === 'travail') p.location = 'travail';
    else if (def.place === 'dehors') p.location = 'dehors';
    else if (def.place === 'visite') {
      const target = this.people.get(action.target);
      p.location = target?.apartment ?? 'home';
    } else p.location = 'home';

    // Résolution sociale : c'est au moment où on frappe à la porte que
    // tout se joue.
    const target = action.target ? this.people.get(action.target) : null;
    if (target?.alive) {
      switch (def.id) {
        case 'visiter': resolveVisit(p, target, this); break;
        case 'plaindre': resolveComplaint(p, target, this); break;
        case 'confronter': resolveConfrontation(p, target, this); break;
        case 'reconcilier': resolveReconcile(p, target, this); break;
        case 'flirter': resolveFlirt(p, target, this); break;
        default: break;
      }
    }
    if (wasHome && (def.place === 'travail' || def.place === 'dehors' || def.place === 'visite')) {
      this.stairwellEncounter(p);
    }
    if (def.id === 'famille_temps') resolveHouseholdTime(p, this, ctx.householdTargets);
    if (def.id === 'espionner' && this.rng.chance(0.3)) {
      const witness = this.neighboursOf(p)[0];
      if (witness) exchangeGossip(p, witness, this);
    }
    if (def.party) this.startParty(p, action, ctx);
  }

  endAction(p) {
    const def = p.action?.def;
    p.action = null;
    p.location = 'home';
    if (def?.party) this.endParty(p);
  }

  /**
   * On se croise dans l'escalier.
   *
   * Sans ça, deux personnes qui n'habitent pas le même palier ne se
   * rencontreraient jamais, et l'immeuble se réduirait à une pile de
   * foyers étanches. C'est ici que naissent la plupart des amitiés — et
   * la totalité des histoires d'amour entre inconnus.
   */
  stairwellEncounter(p) {
    if (!this.rng.chance(0.22)) return;
    const apt = this.apartments[p.apartment];
    if (!apt) return;

    // On croise surtout les gens des étages proches, et surtout ceux qui
    // bougent en même temps que nous.
    const candidates = [];
    for (const q of this.livingPeople()) {
      if (q.id === p.id || q.apartment === p.apartment) continue;
      const qa = this.apartments[q.apartment];
      if (!qa) continue;
      const dist = Math.abs(qa.floor - apt.floor);
      if (dist > 4) continue;
      const transiting = q.location === 'dehors' || q.location === 'travail';
      const rel = p.relations.get(q.id, false);
      // On croise « par hasard » beaucoup plus souvent les gens qu'on a
      // envie de croiser. Ce n'est pas un bug de la vraie vie non plus.
      const pull = rel ? 0.6 + rel.familiarity * 0.8 + rel.romance * 2.5 : 0.5;
      candidates.push({ q, w: (transiting ? 2 : 0.5) * pull / (1 + dist) });
    }
    if (!candidates.length) return;

    const pick = this.rng.weighted(candidates, (c) => c.w);
    if (!pick) return;
    const other = pick.q;

    const rel = p.relations.get(other.id);
    const rel2 = other.relations.get(p.id);
    if (rel.type === LINK.INCONNU) {
      rel.type = LINK.VOISIN;
      rel2.type = LINK.VOISIN;
    }
    // Une rencontre d'escalier est courte : elle compte moins qu'une visite,
    // mais elle compte.
    const q = encounterQuality(p, other, this) * 0.6;
    applyEncounter(p, other, q, this, 'escalier');
    p.needs.add('social', 5);
    other.needs.add('social', 4);
  }

  /** Une fête : des gens arrivent réellement dans l'appartement. */
  startParty(host, action, ctx) {
    const invited = ctx.socialTargets.slice(0, 5);
    const guests = [];
    for (const t of invited) {
      const g = t.person;
      if (!g.alive || g.action?.def.id === 'travailler') continue;
      const willing = g.personality.sociabilite * 0.8 + t.rel.affinity * 0.4
        - g.personality.t('discret', 0.4) - (g.needs.get('energie') < 25 ? 0.5 : 0);
      if (willing < 0.35) continue;
      g.action = {
        id: 'invite', def: ACTION_BY_ID.get('fete'), label: `est à la fête chez ${host.shortName}`,
        remaining: action.remaining, total: action.total, place: 'visite',
        target: host.id, targetName: host.shortName, line: speech('fete', this.rng),
      };
      g.location = host.apartment;
      g.say(g.action.line, 30);
      guests.push(g);
    }
    host.partyGuests = guests.map((g) => g.id);

    if (guests.length >= 2) {
      this.beat({
        kind: 'fete.debut',
        text: `Il y a du monde chez ${host.shortName}. ${guests.length} personnes, et ça commence bien.`,
        tone: TONE.DROLE, weight: 0.35, actors: [host.id, ...guests.map((g) => g.id)], apartment: host.apartment,
        causes: [`${host.shortName} est ${host.personality.has('bruyant') ? 'bruyant' : 'très sociable'}`,
          'c\'est le week-end'],
      });
    }
  }

  endParty(host) {
    const guests = (host.partyGuests ?? []).map((id) => this.people.get(id)).filter((g) => g?.alive);
    host.partyGuests = [];
    if (!guests.length) return;

    // Ce qui se passe entre invités ne dépend que d'eux.
    for (const g of guests) {
      g.location = 'home';
      g.action = null;
      const rel = g.relations.get(host.id);
      rel.adjust({ familiarity: 0.08, affinity: 0.05 });
      rel.lastInteraction = this.clock.tick;
      for (const other of guests) {
        if (other.id === g.id) continue;
        const r = g.relations.get(other.id);
        r.adjust({ familiarity: 0.06 });
        r.lastInteraction = this.clock.tick;
      }
    }

    // Dérapage : trop de monde, trop tard, trop bu.
    const drunk = guests.filter((g) => g.addiction > 0.3 || g.personality.has('bruyant')).length;
    if (this.clock.isNight && (drunk >= 2 || guests.length >= 4) && this.rng.chance(0.35)) {
      const apt = this.apartments[host.apartment];
      apt.condition = Math.max(0, apt.condition - 0.12);
      const victim = this.neighboursOf(host)[0];
      if (victim) {
        victim.relations.get(host.id).adjust({ tension: 0.3, affinity: -0.15 });
        victim.externalStress = Math.min(80, victim.externalStress + 15);
        victim.remember({ kind: 'nuit.blanche', text: `la nuit blanche à cause de ${host.shortName}`, valence: -0.6, strength: 0.6, about: host.id, tick: this.clock.tick });
      }
      this.beat({
        kind: 'fete.derapage',
        text: `La fête chez ${host.shortName} a dérapé. Quelqu'un dort dans l'escalier et il manque une porte de placard.`,
        tone: TONE.DROLE, weight: 0.5, actors: [host.id, ...guests.slice(0, 3).map((g) => g.id)], apartment: host.apartment,
        causes: [`${guests.length} invités dans ${apt.rooms} pièces`,
          drunk >= 2 ? 'et deux d\'entre eux ne savent pas s\'arrêter' : 'et personne n\'a vu l\'heure'],
      });
    }
  }

  /** Le bruit d'un appartement dérange les voisins — ou pas. */
  propagateNoise(people) {
    for (const p of people) {
      if (p.location !== 'home' || p.apartment === null) continue;
      const apt = this.apartments[p.apartment];
      if (!apt) continue;
      let perceived = this.buildingNoise * 0.5;
      for (const nid of apt.neighbours) {
        perceived = Math.max(perceived, this.apartments[nid].noise * 0.75);
      }
      if (perceived <= 0.05) continue;
      const excess = perceived - p.personality.toleranceBruit;
      if (excess > 0) {
        p.externalStress = Math.min(95, p.externalStress + excess * (this.clock.isNight ? 0.9 : 0.35));
        p.needs.add('confort', -excess * 0.6);
        if (p.action?.def.id === 'dormir' && excess > 0.25) {
          p.needs.add('energie', -0.6);
        }
      }
    }
  }

  // ------------------------------------------------------------- lent

  /**
   * La météo du jour — les ambiances de la planche : nuit calme et soirée
   * viennent du cycle du ciel, celles-ci viennent du calendrier. Elle se
   * voit sur la façade et se sent un peu dans les corps.
   */
  weatherStep() {
    const s = this.clock.season;
    const r = this.rng.fork(`meteo-${this.clock.day}`);
    let next = 'clair';
    if (s === 0) next = r.chance(0.2) ? 'neige' : r.chance(0.32) ? 'pluie' : 'clair';
    else if (s === 2) next = r.chance(0.16) ? 'canicule' : r.chance(0.1) ? 'pluie' : 'clair';
    else next = r.chance(0.28) ? 'pluie' : 'clair';

    const before = this.weather?.id ?? 'clair';
    this.weather = { id: next, intensity: 0.5 + r.float(0, 0.5) };
    if (next !== before && next !== 'clair' && this.canBeat('meteo', 'jour', 2)) {
      const textes = {
        pluie: 'Il pleut sur le quartier. Les fenêtres se ferment une à une.',
        neige: 'Il neige. Même le chat du rez-de-chaussée est rentré.',
        canicule: 'Canicule. Tout l\'immeuble vit volets mi-clos.',
      };
      this.beat({
        kind: 'meteo.change', text: textes[next],
        tone: TONE.QUOTIDIEN, weight: 0.3, actors: [], apartment: null,
      });
    }
    // La météo se sent : la canicule use, la pluie enferme.
    if (next === 'canicule') {
      for (const p of this.livingPeople()) {
        p.needs.add('confort', -5);
        p.stress = Math.min(100, p.stress + 2);
      }
    } else if (next === 'pluie' || next === 'neige') {
      for (const p of this.livingPeople()) p.needs.add('plaisir', -2);
    }
  }

  daily() {
    this.weatherStep();
    const rng = this.rng;
    for (const p of this.livingPeople()) {
      ageOneDay(this, p);
      if (!p.alive) continue;
      healthStep(this, p);
      if (!p.alive) continue;
      workStep(this, p);
      romanceStep(this, p);
      familyStep(this, p);
      ambitionStep(this, p);
      p.memory.decay(p.personality.pardon);
      p.relations.decay(this.clock.tick, p.personality.pardon);

      // Réminiscence : un vieux souvenir remonte et colore la journée.
      if (rng.chance(0.12)) {
        const m = p.memory.reminisce(rng, this.clock.tick);
        if (m) {
          p.moodBias += m.valence * 6;
          if (m.intensity > 0.7 && rng.chance(0.15)) {
            this.beat({
              kind: 'vie.souvenir',
              text: `${p.shortName} a repensé à ${m.text}. Il est resté un moment à la fenêtre.`,
              tone: m.valence > 0 ? TONE.TENDRE : TONE.TENDU,
              weight: 0.3, actors: [p.id], apartment: p.apartment,
              causes: [`un souvenir qui ne s'efface pas (${Math.round(m.strength * 100)}%)`],
            });
          }
        }
      }
    }

    if (this.elevatorBroken && this.clock.day >= this.elevatorFixDay) {
      this.elevatorBroken = false;
      this.beat({
        kind: 'immeuble.ascenseur',
        text: `L'ascenseur remarche. Trois personnes ont applaudi dans le hall.`,
        tone: TONE.DROLE, weight: 0.3, actors: [], apartment: null,
        causes: ['le syndic a fini par envoyer quelqu\'un'],
      });
    }

    // L'immeuble s'use tout seul.
    for (const apt of this.apartments) {
      if (apt.special) continue;
      apt.condition = Math.max(0, apt.condition - 0.0004 - apt.residents.length * 0.0002);
    }
    this.security = Math.max(0, this.security - 0.0008);

    this.director.daily();
    this.secrets.daily();
    this.repopulate();
  }

  monthly() {
    for (const p of this.livingPeople()) monthlyMoney(this, p);
  }

  /** Les logements vides finissent par se relouer. */
  repopulate() {
    for (const apt of this.vacantApartments()) {
      if (apt.vacantSince === null) {
        apt.vacantSince = this.clock.tick;
        continue;
      }
      const empty = (this.clock.tick - apt.vacantSince) / TICKS_PER_DAY;
      const wait = apt.haunted ? 90 : 12;
      if (empty < wait) continue;
      if (!this.rng.chance(0.06)) continue;

      const before = this.people.size;
      populateApartment(this.rng, apt, this);
      const arrivals = [...this.people.values()].slice(before);
      if (!arrivals.length) continue;
      this.stats.moveIns++;

      // Les voisins jugent avant même d'avoir dit bonjour.
      for (const a of arrivals) {
        for (const n of this.neighboursOf(a)) {
          const rel = n.relations.get(a.id);
          const rel2 = a.relations.get(n.id);
          rel.type = LINK.VOISIN;
          rel2.type = LINK.VOISIN;
          rel.familiarity = 0.05;
          rel2.familiarity = 0.05;
        }
      }
      this.beat({
        kind: 'logement.arrivee',
        text: `Des nouveaux au ${this.aptName(apt)} : ${arrivals.map((a) => a.shortName).join(', ')}. Le camion a bloqué la rue deux heures.`,
        tone: TONE.QUOTIDIEN, weight: 0.4, actors: arrivals.map((a) => a.id), apartment: apt.id,
        causes: [apt.haunted ? 'l\'appartement était vide depuis longtemps, et on disait des choses'
          : 'l\'appartement était libre'],
      });
      if (apt.haunted) apt.haunted = false;
    }
  }

  // ------------------------------------------------------------- sauvegarde légère

  snapshot() {
    return {
      seed: this.seed,
      tick: this.clock.tick,
      date: this.clock.stamp(),
      population: this.livingPeople().length,
      happiness: Math.round(this.averageHappiness()),
      stats: { ...this.stats },
      secrets: this.secrets.progress(),
    };
  }
}
