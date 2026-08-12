// Un habitant.
//
// Tout ce qu'il faut pour qu'une vie tienne debout toute seule : un corps
// avec des besoins, une tête avec une personnalité et des souvenirs, un
// carnet de relations, un métier, un compte en banque, des ambitions,
// et une santé qui finira par céder.

import { Needs } from './needs.js';
import { MemoryBank, Memory } from './memory.js';
import { RelationBook } from './relations.js';
import { makePersonality } from './traits.js';
import { pickFirstName, pickSurname } from '../content/names.js';
import { jobById, JOBS, STUDENT, RETIRED, UNEMPLOYED, CHILD_JOB } from '../content/jobs.js';
import { DAYS_PER_YEAR, TICKS_PER_DAY } from '../core/clock.js';

let residentId = 0;
export function resetResidentIds() {
  residentId = 0;
}

export const AMBITIONS = [
  { id: 'famille', label: 'fonder une famille', want: (p) => 0.4 + p.get('amabilite') * 0.5 - p.get('ouverture') * 0.15 },
  { id: 'carriere', label: 'réussir sa carrière', want: (p) => 0.2 + p.serieux * 0.7 },
  { id: 'argent', label: 'mettre de l\'argent de côté', want: (p) => 0.2 + p.get('rigueur') * 0.5 + p.t('radin', 0.4) },
  { id: 'paix', label: 'avoir la paix', want: (p) => 0.2 + (1 - p.get('extraversion')) * 0.6 + p.t('discret', 0.3) },
  { id: 'amour', label: 'trouver quelqu\'un', want: (p) => 0.3 + p.romantisme * 0.6 },
  { id: 'amitie', label: 'être entouré', want: (p) => 0.2 + p.sociabilite * 0.7 },
  { id: 'art', label: 'créer quelque chose', want: (p) => 0.1 + p.get('ouverture') * 0.8 },
  { id: 'partir', label: 'partir d\'ici', want: (p) => 0.15 + p.get('ouverture') * 0.4 + p.get('anxiete') * 0.2 },
  { id: 'respect', label: 'être respecté dans l\'immeuble', want: (p) => 0.15 + p.t('orgueilleux', 0.6) + p.get('extraversion') * 0.2 },
  { id: 'sante', label: 'aller mieux', want: (p) => 0.1 + p.get('anxiete') * 0.4 },
];

export class Resident {
  constructor(o) {
    this.id = ++residentId;
    this.firstName = o.firstName;
    this.lastName = o.lastName;
    this.gender = o.gender; // 'f' | 'm' | 'x'
    this.age = o.age;
    this.birthTick = o.birthTick ?? -Math.round(o.age * DAYS_PER_YEAR * TICKS_PER_DAY);
    this.personality = o.personality;

    this.needs = new Needs(o.needs);
    this.stress = o.stress ?? 25;
    this.mood = o.mood ?? 60;
    this.moodBias = 0;
    this.externalStress = 0;

    this.health = o.health ?? 92;
    this.conditions = new Set(o.conditions ?? []);
    this.addiction = 0; // 0..1, monte tout seul si on la nourrit

    this.job = o.job ?? UNEMPLOYED;
    this.jobPerformance = 0.5;
    this.jobTenure = 0;
    this.money = o.money ?? 800;
    this.debt = 0;

    this.apartment = o.apartment ?? null;
    this.relations = new RelationBook(this.id);
    this.memory = new MemoryBank();

    this.ambition = null;
    this.ambitionProgress = 0;

    this.action = null;
    this.location = 'home'; // 'home' | 'travail' | 'dehors' | numéro d'appartement visité
    this.alive = true;
    this.causeOfDeath = null;
    this.deathTick = null;

    this.pregnant = false;
    this.pregnancyStart = 0;

    // Rendu : position dans la pièce, animation, expression.
    this.pos = { x: 0.5, y: 0.72 };
    this.target = { x: 0.5, y: 0.72 };
    this.facing = 1;
    this.animPhase = 0;
    this.speech = null;

    this.secrets = new Set();     // ce qu'il sait de l'immeuble
    this.rumourCooldown = 0;
    this.noiseMade = 0;           // bruit produit ce tick
    this.lastMeal = 0;
    this.interventionCooldown = 0;
    this.tags = new Set();        // marqueurs de vie (parent, veuf, patron…)
  }

  get name() {
    return `${this.firstName} ${this.lastName}`;
  }

  get shortName() {
    return this.firstName;
  }

  get isChild() {
    return this.age < 15;
  }

  get isTeen() {
    return this.age >= 13 && this.age < 20;
  }

  get isAdult() {
    return this.age >= 18;
  }

  get isOld() {
    return this.age >= 68;
  }

  get income() {
    return this.job?.pay ?? 0;
  }

  /** Le bonheur, tel que le joueur le voit : la somme de plusieurs vies. */
  happinessFactors() {
    const rel = this.relations;
    const partner = rel.partner();
    const friends = rel.friends();
    const family = rel.all().filter((r) => r.isFamily);
    const enemies = rel.enemies();

    const amour = partner ? 0.55 + partner.affinity * 0.3 + partner.romance * 0.25 - partner.tension * 0.45 : 0.32;
    const famille = family.length
      ? clamp01(0.45 + family.reduce((s, r) => s + r.affinity, 0) / family.length * 0.5)
      : 0.42;
    const amitie = clamp01(0.2 + Math.min(4, friends.length) * 0.16);
    const travail = this.job.id === 'chomage' ? 0.18
      : this.job.id === 'retraite' ? 0.6
        : clamp01(0.35 + this.jobPerformance * 0.4 - this.job.stress * 0.2);
    const argent = clamp01(0.15 + Math.min(1, this.money / 4000) * 0.7 - Math.min(1, this.debt / 3000) * 0.5);
    const sante = clamp01(this.health / 100);
    const securite = clamp01(0.85 - this.externalStress / 100 - (enemies.length ? 0.15 * Math.min(3, enemies.length) : 0));
    const logement = clamp01(this.needs.get('confort') / 100);
    const solitude = clamp01(this.needs.get('social') / 100);
    const calme = clamp01(1 - this.stress / 100);

    return { amour, famille, amitie, travail, argent, sante, securite, logement, solitude, calme };
  }

  get happiness() {
    const f = this.happinessFactors();
    const w = {
      amour: 1.15, famille: 1.05, amitie: 0.95, travail: 0.9, argent: 0.85,
      sante: 1.2, securite: 0.9, logement: 0.7, solitude: 1.0, calme: 1.1,
    };
    let sum = 0;
    let tot = 0;
    for (const [k, v] of Object.entries(f)) {
      sum += v * w[k];
      tot += w[k];
    }
    // L'humeur du moment pèse, mais ne fait pas tout.
    const base = (sum / tot) * 100;
    return clamp01((base * 0.78 + this.mood * 0.22) / 100) * 100;
  }

  remember(o) {
    return this.memory.add(new Memory(o));
  }

  feelAbout(otherId) {
    const r = this.relations.get(otherId, false);
    const mem = this.memory.feelingToward(otherId);
    if (!r) return mem * 0.5;
    return clamp(r.affinity * 0.7 + mem * 0.3, -1, 1);
  }

  say(text, ttl = 34) {
    this.speech = { text, ttl, max: ttl };
  }

  /** État lisible pour l'interface. */
  statusLine() {
    if (!this.alive) return 'n\'est plus là';
    return this.action?.label ?? 'ne fait rien de particulier';
  }

  serialize() {
    return {
      id: this.id, firstName: this.firstName, lastName: this.lastName,
      gender: this.gender, age: this.age, health: this.health,
      job: this.job.id, money: Math.round(this.money), apartment: this.apartment,
      alive: this.alive, happiness: Math.round(this.happiness),
      personality: this.personality.serialize(),
      needs: this.needs.serialize(),
    };
  }
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** Métier plausible pour un âge et une personnalité donnés. */
export function pickJob(rng, age, personality) {
  if (age < 15) return CHILD_JOB;
  if (age < 19) return rng.chance(0.7) ? STUDENT : CHILD_JOB;
  if (age < 25 && rng.chance(0.45)) return STUDENT;
  if (age >= 64) return rng.chance(0.85) ? RETIRED : UNEMPLOYED;
  if (rng.chance(0.09)) return UNEMPLOYED;

  // On pondère les métiers par la personnalité : un anxieux discret finit
  // rarement patron, et un désordonné rarement comptable.
  const p = personality;
  return rng.weighted(JOBS, (j) => {
    let w = 1;
    w += p.serieux * (j.prestige ?? 0.3) * 1.5;
    w -= p.get('anxiete') * (j.stress ?? 0.5) * 0.8;
    if (j.remote) w += (1 - p.sociabilite) * 0.8;
    if (j.onSite) w += p.curiosite * 0.9;
    if (j.noisy) w += p.t('bruyant', 0.6) + p.t('bricoleur', 0.5);
    if (j.precarious) w += p.get('ouverture') * 0.6 - p.get('rigueur') * 0.4;
    if (j.nightShift) w += p.t('insomniaque', 1.0) - p.sociabilite * 0.3;
    return Math.max(0.05, w);
  });
}

/** Fabrique un habitant complet. */
export function makeResident(rng, opts = {}) {
  const age = opts.age ?? rng.int(19, 78);
  const gender = opts.gender ?? (rng.chance(0.49) ? 'f' : rng.chance(0.97) ? 'm' : 'x');
  const personality = opts.personality ?? makePersonality(rng, { ageBias: Math.min(1, age / 70) });
  const job = opts.job ?? pickJob(rng, age, personality);

  const r = new Resident({
    firstName: opts.firstName ?? pickFirstName(rng, gender, age, opts.taken ?? new Set()),
    lastName: opts.lastName ?? pickSurname(rng),
    gender,
    age,
    personality,
    job,
    health: opts.health ?? Math.min(100, rng.gauss(96 - Math.max(0, age - 45) * 0.55, 6, 25, 100)),
    money: opts.money ?? Math.max(0, rng.gauss(job.pay * 1.6, job.pay * 1.1, 0, 40000)),
    apartment: opts.apartment ?? null,
    birthTick: opts.birthTick,
  });

  // Une ambition dominante, tirée selon la personnalité et l'âge.
  const pool = AMBITIONS.filter((a) => {
    if (a.id === 'famille' && (age < 22 || age > 45)) return false;
    if (a.id === 'carriere' && (age < 20 || age > 60)) return false;
    if (a.id === 'amour' && age < 17) return false;
    if (a.id === 'sante' && age < 50) return false;
    return true;
  });
  const chosen = rng.weighted(pool, (a) => Math.max(0.05, a.want(personality)));
  r.ambition = chosen ? { ...chosen } : { ...AMBITIONS[3] };

  // Quelques habitudes de départ : où en est-il de sa journée.
  r.needs.set('energie', rng.int(45, 95));
  r.needs.set('faim', rng.int(35, 90));
  r.needs.set('social', rng.int(30, 85));
  r.jobPerformance = clamp01(rng.gauss(0.45 + personality.serieux * 0.25, 0.12));
  r.jobTenure = rng.int(0, 900);

  // Une vieille addiction, rare, mais qui explique bien des choses.
  if (age > 22 && rng.chance(0.06 + personality.get('anxiete') * 0.05)) {
    r.addiction = rng.float(0.15, 0.45);
    r.conditions.add('fragilite');
  }

  return r;
}
