// Bus d'évènements + chronique.
//
// Rien dans Behind n'arrive « comme ça ». Chaque battement d'histoire
// transporte ses causes : c'est ce qui permet au joueur d'ouvrir un
// évènement et de remonter jusqu'au trait de caractère, au souvenir ou
// à la dispute qui l'a rendu inévitable.

export class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(fn);
    return () => this.off(type, fn);
  }

  off(type, fn) {
    this.listeners.get(type)?.delete(fn);
  }

  emit(type, payload) {
    const direct = this.listeners.get(type);
    if (direct) for (const fn of Array.from(direct)) fn(payload, type);
    const all = this.listeners.get('*');
    if (all) for (const fn of Array.from(all)) fn(payload, type);
  }
}

/** Importance d'un battement : filtre principal de la chronique. */
export const TONE = {
  QUOTIDIEN: 'quotidien',
  DROLE: 'drole',
  TENDRE: 'tendre',
  TENDU: 'tendu',
  GRAVE: 'grave',
  SECRET: 'secret',
};

let beatId = 0;

/**
 * Un battement d'histoire.
 * @param {object} o
 * @param {string} o.text        phrase affichée au joueur
 * @param {string} o.tone        TONE.*
 * @param {number} o.weight      0..1, importance narrative
 * @param {number[]} o.actors    ids des habitants concernés
 * @param {number} o.apartment   appartement concerné
 * @param {string[]} o.causes    chaîne causale, en français, du plus profond au plus proche
 * @param {string} o.kind        identifiant machine (romance.debut, conflit.bruit…)
 */
export function makeBeat(o) {
  return {
    id: ++beatId,
    tick: o.tick ?? 0,
    stamp: o.stamp ?? '',
    text: o.text,
    tone: o.tone ?? TONE.QUOTIDIEN,
    weight: o.weight ?? 0.2,
    actors: o.actors ?? [],
    apartment: o.apartment ?? null,
    causes: o.causes ?? [],
    kind: o.kind ?? 'divers',
  };
}

export class Chronicle {
  constructor(limit = 4000) {
    this.beats = [];
    this.limit = limit;
    this.counts = new Map();
  }

  add(beat) {
    this.beats.push(beat);
    this.counts.set(beat.kind, (this.counts.get(beat.kind) ?? 0) + 1);
    if (this.beats.length > this.limit) this.beats.splice(0, this.beats.length - this.limit);
    return beat;
  }

  countOf(kind) {
    return this.counts.get(kind) ?? 0;
  }

  /** Derniers battements, du plus récent au plus ancien. */
  recent(n = 40, filter = null) {
    const out = [];
    for (let i = this.beats.length - 1; i >= 0 && out.length < n; i--) {
      const b = this.beats[i];
      if (!filter || filter(b)) out.push(b);
    }
    return out;
  }

  forActor(id, n = 30) {
    return this.recent(n, (b) => b.actors.includes(id));
  }

  forApartment(aptId, n = 30) {
    return this.recent(n, (b) => b.apartment === aptId);
  }
}
