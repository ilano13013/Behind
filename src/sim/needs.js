// Besoins.
//
// 100 = comblé, 0 = insupportable. Tout se vide en permanence, à des
// vitesses différentes selon la personnalité, l'âge et la santé.
// C'est le moteur de fond : sans besoin, personne ne bouge.

export const NEEDS = ['energie', 'faim', 'hygiene', 'plaisir', 'social', 'confort'];

export const NEED_LABEL = {
  energie: 'énergie',
  faim: 'faim',
  hygiene: 'hygiène',
  plaisir: 'plaisir',
  social: 'social',
  confort: 'confort',
};

// Points perdus par tick (5 minutes) dans des conditions neutres.
const BASE_DECAY = {
  energie: 0.115,
  faim: 0.155,
  hygiene: 0.085,
  plaisir: 0.095,
  social: 0.075,
  confort: 0.035,
};

export class Needs {
  constructor(init = {}) {
    this.v = {};
    for (const n of NEEDS) this.v[n] = init[n] ?? 70;
  }

  get(n) {
    return this.v[n];
  }

  set(n, val) {
    this.v[n] = Math.min(100, Math.max(0, val));
  }

  add(n, delta) {
    this.set(n, this.v[n] + delta);
  }

  apply(deltas, scale = 1) {
    for (const [k, d] of Object.entries(deltas)) {
      if (k in this.v) this.add(k, d * scale);
    }
  }

  /** Urgence d'un besoin : 0 quand tout va bien, explose quand ça descend. */
  urgency(n) {
    const x = this.v[n] / 100;
    return Math.pow(1 - x, 2.2);
  }

  /** Le besoin le plus criant. */
  worst() {
    let best = NEEDS[0];
    let bestU = -1;
    for (const n of NEEDS) {
      const u = this.urgency(n);
      if (u > bestU) {
        bestU = u;
        best = n;
      }
    }
    return { need: best, urgency: bestU };
  }

  serialize() {
    return { ...this.v };
  }
}

/**
 * Fait couler les besoins d'un tick.
 * Modulé par : personnalité, âge, santé, action en cours, saison.
 */
export function decayNeeds(person, ctx) {
  const p = person.personality;
  const age = person.age;
  const n = person.needs;

  const mult = {
    // Les insomniaques et les anxieux dorment mal : leur énergie tient moins.
    energie: 1 + p.t('insomniaque', 0.25) + p.get('anxiete') * 0.2
      + (age > 70 ? 0.25 : 0) + (age < 14 ? 0.2 : 0) + (1 - person.health / 100) * 0.5,
    faim: 1 + (age < 18 ? 0.25 : 0) + (age > 75 ? -0.2 : 0) + person.stress / 400,
    hygiene: 1 + p.t('desordonne', 0.2) - p.t('organise', 0.15),
    // Un extraverti s'ennuie plus vite tout seul.
    plaisir: 1 + p.get('extraversion') * 0.2 + (age < 20 ? 0.3 : 0) - p.t('patient', 0.1),
    social: 1 + p.sociabilite * 0.7 - 0.25,
    confort: 1 + p.t('desordonne', 0.5) - p.t('organise', 0.3),
  };

  for (const key of NEEDS) {
    n.add(key, -BASE_DECAY[key] * (mult[key] ?? 1));
  }

  // Le stress monte quand plusieurs besoins sont dans le rouge, et redescend
  // lentement quand tout va bien. La résilience amortit tout.
  let pressure = 0;
  for (const key of NEEDS) pressure += n.urgency(key);
  const target = Math.min(100, pressure * 22 + person.externalStress);
  const resist = 0.55 + p.resilience * 0.45;
  const rate = target > person.stress ? 0.012 / resist : 0.02 * resist;
  person.stress += (target - person.stress) * rate;
  person.stress = Math.min(100, Math.max(0, person.stress));

  // L'humeur suit les besoins, le stress et la vie affective.
  const satisfaction = NEEDS.reduce((s, k) => s + n.get(k), 0) / (NEEDS.length * 100);
  const moodTarget = satisfaction * 100 - person.stress * 0.45 + person.moodBias;
  person.mood += (Math.min(100, Math.max(0, moodTarget)) - person.mood) * 0.03;
  // Le biais d'humeur (deuil, amour, promotion…) s'estompe tout seul.
  person.moodBias *= 0.9992;

  if (ctx?.cold) n.add('confort', -0.02);
}
