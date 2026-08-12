// Mémoire épisodique.
//
// Un habitant n'a pas de « variable rancune » : il a des souvenirs, avec
// une charge émotionnelle et une force qui s'érode. C'est la relecture de
// ces souvenirs qui produit la rancune, la nostalgie ou la confiance.
// Un souvenir très fort peut ressortir des années plus tard.

import { TICKS_PER_DAY } from '../core/clock.js';

let memId = 0;

export class Memory {
  /**
   * @param {object} o
   * @param {string} o.kind      identifiant machine (dispute.bruit, cadeau.recu…)
   * @param {string} o.text      formulation vue par le joueur
   * @param {number} o.valence   -1 (traumatisant) à +1 (lumineux)
   * @param {number} o.strength  0..1, s'érode avec le temps
   * @param {number} o.about     id de la personne concernée (facultatif)
   */
  constructor(o) {
    this.id = ++memId;
    this.kind = o.kind;
    this.text = o.text;
    this.valence = o.valence ?? 0;
    this.strength = o.strength ?? 0.5;
    this.about = o.about ?? null;
    this.tick = o.tick ?? 0;
    this.core = o.core ?? false; // un souvenir fondateur ne s'efface jamais tout à fait
    this.recalls = 0;
  }

  get intensity() {
    return Math.abs(this.valence) * this.strength;
  }
}

export class MemoryBank {
  constructor(capacity = 60) {
    this.items = [];
    this.capacity = capacity;
  }

  add(mem) {
    this.items.push(mem);
    if (this.items.length > this.capacity) this.forgetWeakest();
    return mem;
  }

  forgetWeakest() {
    let idx = -1;
    let min = Infinity;
    for (let i = 0; i < this.items.length; i++) {
      const m = this.items[i];
      if (m.core) continue;
      const v = m.strength * (0.4 + Math.abs(m.valence));
      if (v < min) {
        min = v;
        idx = i;
      }
    }
    if (idx >= 0) this.items.splice(idx, 1);
    else this.items.shift();
  }

  /**
   * Érosion. Les souvenirs neutres partent vite, les chocs restent.
   * `pardon` accélère l'oubli des souvenirs négatifs : c'est très
   * exactement ce que veut dire « être rancunier ».
   */
  decay(pardon = 0.5) {
    for (const m of this.items) {
      const emotional = 0.25 + Math.abs(m.valence) * 0.75;
      let rate = 0.00035 / emotional;
      if (m.valence < 0) rate *= 0.5 + pardon * 1.2;
      if (m.core) rate *= 0.12;
      m.strength = Math.max(0, m.strength - rate);
    }
    if (this.items.length > 20) {
      this.items = this.items.filter((m) => m.core || m.strength > 0.03);
    }
  }

  /** Tous les souvenirs qui concernent quelqu'un. */
  about(personId) {
    return this.items.filter((m) => m.about === personId);
  }

  /** Sentiment net accumulé envers quelqu'un, -1..1. */
  feelingToward(personId) {
    let sum = 0;
    let weight = 0;
    for (const m of this.items) {
      if (m.about !== personId) continue;
      sum += m.valence * m.strength;
      weight += m.strength;
    }
    return weight > 0 ? sum / Math.max(1, weight) : 0;
  }

  /** Le souvenir qui domine la relation avec quelqu'un. */
  strongestAbout(personId) {
    let best = null;
    for (const m of this.items) {
      if (m.about !== personId) continue;
      if (!best || m.intensity > best.intensity) best = m;
    }
    return best;
  }

  has(kind, personId = undefined) {
    return this.items.some((m) => m.kind === kind && (personId === undefined || m.about === personId));
  }

  count(kind) {
    return this.items.filter((m) => m.kind === kind).length;
  }

  /** Souvenirs marquants, pour la biographie affichée au joueur. */
  highlights(n = 6) {
    return [...this.items]
      .sort((a, b) => (b.intensity + (b.core ? 1 : 0)) - (a.intensity + (a.core ? 1 : 0)))
      .slice(0, n);
  }

  /**
   * Une réminiscence : un vieux souvenir remonte tout seul et colore
   * l'humeur. C'est ce qui fait qu'un habitant peut avoir un coup de blues
   * un mardi sans raison apparente — sauf qu'il y en a une.
   */
  reminisce(rng, tick) {
    const candidates = this.items.filter(
      (m) => m.intensity > 0.35 && tick - m.tick > TICKS_PER_DAY * 3,
    );
    if (!candidates.length) return null;
    const m = rng.weighted(candidates, (x) => x.intensity);
    if (!m) return null;
    m.recalls++;
    // Se souvenir rafraîchit le souvenir : on n'oublie pas ce qu'on rumine.
    m.strength = Math.min(1, m.strength + 0.02);
    return m;
  }

  serialize() {
    return this.items.map((m) => ({
      kind: m.kind, text: m.text, valence: m.valence,
      strength: m.strength, about: m.about, tick: m.tick, core: m.core,
    }));
  }
}
