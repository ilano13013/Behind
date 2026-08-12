// Relations.
//
// Une relation n'est pas un chiffre unique : on peut aimer quelqu'un et
// lui en vouloir, le connaître depuis trente ans sans lui faire confiance.
// Quatre dimensions séparées, plus l'historique des souvenirs partagés.

export const LINK = {
  INCONNU: 'inconnu',
  VOISIN: 'voisin',
  CONNAISSANCE: 'connaissance',
  AMI: 'ami',
  MEILLEUR_AMI: 'meilleur ami',
  RIVAL: 'rival',
  ENNEMI: 'ennemi',
  FLIRT: 'flirt',
  COUPLE: 'en couple',
  MARIE: 'marié',
  EX: 'ex',
  PARENT: 'parent',
  ENFANT: 'enfant',
  FRATRIE: 'frère ou sœur',
  COLOC: 'colocataire',
};

export const FAMILY_LINKS = new Set([LINK.PARENT, LINK.ENFANT, LINK.FRATRIE]);
export const ROMANTIC_LINKS = new Set([LINK.FLIRT, LINK.COUPLE, LINK.MARIE]);

export class Relation {
  constructor(otherId, type = LINK.INCONNU) {
    this.other = otherId;
    this.type = type;
    this.affinity = 0;     // -1 déteste .. +1 adore
    this.trust = 0;        // -1 se méfie .. +1 confierait ses clés
    this.romance = 0;      // 0 .. 1
    this.tension = 0;      // 0 .. 1, la pression avant la dispute
    this.familiarity = 0;  // 0 .. 1, « on se connaît »
    this.interactions = 0;
    this.lastInteraction = -99999;
    this.lastConflict = -99999;
    this.knownSecrets = [];
  }

  /** Force globale du lien, utilisée pour trier les relations affichées. */
  get weight() {
    return Math.abs(this.affinity) * 0.5 + this.familiarity * 0.3
      + this.romance * 0.4 + this.tension * 0.3
      + (FAMILY_LINKS.has(this.type) ? 0.6 : 0);
  }

  get isFamily() {
    return FAMILY_LINKS.has(this.type);
  }

  get isRomantic() {
    return ROMANTIC_LINKS.has(this.type);
  }

  adjust(d) {
    if (d.affinity) this.affinity = clamp(this.affinity + d.affinity, -1, 1);
    if (d.trust) this.trust = clamp(this.trust + d.trust, -1, 1);
    if (d.romance) this.romance = clamp(this.romance + d.romance, 0, 1);
    if (d.tension) this.tension = clamp(this.tension + d.tension, 0, 1);
    if (d.familiarity) this.familiarity = clamp(this.familiarity + d.familiarity, 0, 1);
  }

  describe() {
    if (this.type !== LINK.INCONNU && this.type !== LINK.VOISIN) return this.type;
    if (this.affinity > 0.55) return LINK.AMI;
    if (this.affinity < -0.5) return LINK.ENNEMI;
    if (this.familiarity > 0.3) return LINK.CONNAISSANCE;
    return this.type;
  }
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export class RelationBook {
  constructor(ownerId) {
    this.owner = ownerId;
    this.map = new Map();
  }

  get(otherId, create = true) {
    let r = this.map.get(otherId);
    if (!r && create) {
      r = new Relation(otherId);
      this.map.set(otherId, r);
    }
    return r;
  }

  has(otherId) {
    return this.map.has(otherId);
  }

  all() {
    return [...this.map.values()];
  }

  ofType(type) {
    return this.all().filter((r) => r.type === type);
  }

  partner() {
    return this.all().find((r) => r.type === LINK.COUPLE || r.type === LINK.MARIE) ?? null;
  }

  children() {
    return this.ofType(LINK.ENFANT);
  }

  parents() {
    return this.ofType(LINK.PARENT);
  }

  friends() {
    return this.all().filter((r) => r.affinity > 0.5 && !r.isFamily && !r.isRomantic);
  }

  enemies() {
    return this.all().filter((r) => r.affinity < -0.45 || r.tension > 0.7);
  }

  /** Relations les plus significatives, pour la fiche d'habitant. */
  top(n = 8) {
    return this.all().sort((a, b) => b.weight - a.weight).slice(0, n);
  }

  /**
   * Refroidissement : sans nouvelles, l'affinité retombe vers zéro et la
   * tension se dégonfle — plus ou moins vite selon la capacité à pardonner.
   */
  decay(tick, pardon = 0.5) {
    for (const r of this.map.values()) {
      const idle = tick - r.lastInteraction;
      if (idle > 400) {
        const rate = r.isFamily ? 0.00015 : 0.0006;
        r.affinity *= 1 - rate;
        r.familiarity *= 1 - rate * 0.3;
        if (!r.isRomantic) r.romance *= 0.9995;
      }
      // La tension redescend seule : c'est ce qui empêche l'immeuble
      // d'exploser. Appelée une fois par jour, donc calibrée en jours :
      // une brouille sérieuse met un à deux mois à se dissoudre, plus
      // longtemps chez les rancuniers.
      r.tension = Math.max(0, r.tension - 0.028 * (0.35 + pardon));
    }
  }
}

/** Le lien vu de l'extérieur, pour l'affichage. */
export function linkLabel(rel) {
  if (!rel) return 'inconnu';
  const base = rel.describe();
  if (rel.tension > 0.6 && !FAMILY_LINKS.has(rel.type) && !ROMANTIC_LINKS.has(rel.type)) {
    return `${base} (en froid)`;
  }
  if (rel.tension > 0.6) return `${base} (ça craque)`;
  return base;
}
