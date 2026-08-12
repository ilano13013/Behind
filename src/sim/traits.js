// Personnalité.
//
// Cinq grands axes continus + des qualités et des défauts nommés.
// Tout le reste de la simulation lit cette couche : un habitant ne fait
// jamais « une action au hasard », il fait ce que sa personnalité rend
// probable dans sa situation.

export const AXES = ['ouverture', 'rigueur', 'extraversion', 'amabilite', 'anxiete'];

export const QUALITIES = [
  { id: 'genereux', labelF: 'généreuse', label: 'généreux', desc: 'donne sans compter, parfois trop' },
  { id: 'drole', labelF: 'drôle', label: 'drôle', desc: 'désamorce tout par une vanne' },
  { id: 'patient', label: 'patient', desc: 'encaisse longtemps avant d\'exploser' },
  { id: 'courageux', labelF: 'courageuse', label: 'courageux', desc: 'monte au front pour les autres' },
  { id: 'fidele', labelF: 'fidèle', label: 'fidèle', desc: 'ne lâche jamais les siens' },
  { id: 'curieux', labelF: 'curieuse', label: 'curieux', desc: 'veut savoir, quitte à déranger' },
  { id: 'bricoleur', labelF: 'bricoleuse', label: 'bricoleur', desc: 'répare tout, à sa façon' },
  { id: 'cuisinier_ne', labelF: 'bonne cuisinière', label: 'bon cuisinier', desc: 'nourrit tout le palier' },
  { id: 'optimiste', labelF: 'optimiste', label: 'optimiste', desc: 'voit le bon côté, même faux' },
  { id: 'discret', labelF: 'discrète', label: 'discret', desc: 'ne fait jamais de vagues' },
  { id: 'travailleur', labelF: 'travailleuse', label: 'travailleur', desc: 'ne compte pas ses heures' },
  { id: 'protecteur', labelF: 'protectrice', label: 'protecteur', desc: 'veille sur les plus faibles' },
  { id: 'romantique', labelF: 'romantique', label: 'romantique', desc: 'croit encore aux grands gestes' },
  { id: 'organise', labelF: 'organisée', label: 'organisé', desc: 'a un tableau pour tout' },
];

export const DEFAULTS_ = [
  { id: 'rancunier', label: 'rancunier', desc: 'n\'oublie rien, jamais' },
  { id: 'radin', labelF: 'radine', label: 'radin', desc: 'compte au centime' },
  { id: 'bruyant', labelF: 'bruyante', label: 'bruyant', desc: 'vit à plein volume' },
  { id: 'jaloux', labelF: 'jalouse', label: 'jaloux', desc: 'voit des rivaux partout' },
  { id: 'menteur', labelF: 'menteuse', label: 'menteur', desc: 'arrange toujours la vérité' },
  { id: 'colerique', labelF: 'colérique', label: 'colérique', desc: 'part au quart de tour' },
  { id: 'commere', labelF: 'commère', label: 'commère', desc: 'sait tout, répète tout' },
  { id: 'paresseux', label: 'paresseux', desc: 'demain, c\'est très bien aussi' },
  { id: 'orgueilleux', labelF: 'orgueilleuse', label: 'orgueilleux', desc: 'préfère couler que demander' },
  { id: 'anxieux', labelF: 'anxieuse', label: 'anxieux', desc: 'prévoit le pire, en détail' },
  { id: 'desordonne', labelF: 'désordonnée', label: 'désordonné', desc: 'vit dans un chantier' },
  { id: 'depensier', label: 'dépensier', desc: 'l\'argent lui brûle les doigts' },
  { id: 'susceptible', labelF: 'susceptible', label: 'susceptible', desc: 'tout est une attaque' },
  { id: 'possessif', labelF: 'possessive', label: 'possessif', desc: 'aime en fermant la porte' },
  { id: 'insomniaque', labelF: 'insomniaque', label: 'insomniaque', desc: 'la nuit lui appartient' },
  { id: 'tetu', labelF: 'têtue', label: 'têtu', desc: 'ne revient jamais sur un « non »' },
];

const BY_ID = new Map([...QUALITIES, ...DEFAULTS_].map((t) => [t.id, t]));
export const traitInfo = (id) => BY_ID.get(id) ?? { id, label: id, desc: '' };

/** Le trait, accordé : « Denise est curieuse », pas « curieux ». */
export function traitLabel(id, person) {
  const t = BY_ID.get(id);
  if (!t) return id;
  if (person?.gender === 'f' && t.labelF) return t.labelF;
  return t.label;
}

// Certains traits appellent naturellement certains axes.
const AFFINITY = {
  genereux: { amabilite: 0.6 },
  drole: { extraversion: 0.5, ouverture: 0.3 },
  patient: { anxiete: -0.5, amabilite: 0.3 },
  courageux: { anxiete: -0.6 },
  fidele: { amabilite: 0.4, rigueur: 0.4 },
  curieux: { ouverture: 0.7 },
  bricoleur: { rigueur: 0.4 },
  cuisinier_ne: { amabilite: 0.4 },
  optimiste: { anxiete: -0.6 },
  discret: { extraversion: -0.6 },
  travailleur: { rigueur: 0.7 },
  protecteur: { amabilite: 0.5 },
  romantique: { ouverture: 0.4, extraversion: 0.2 },
  organise: { rigueur: 0.8 },
  rancunier: { amabilite: -0.6 },
  radin: { amabilite: -0.3, rigueur: 0.3 },
  bruyant: { extraversion: 0.6, amabilite: -0.2 },
  jaloux: { anxiete: 0.5, amabilite: -0.3 },
  menteur: { amabilite: -0.4, rigueur: -0.3 },
  colerique: { anxiete: 0.5, amabilite: -0.5 },
  commere: { extraversion: 0.6, amabilite: -0.2 },
  paresseux: { rigueur: -0.8 },
  orgueilleux: { amabilite: -0.3 },
  anxieux: { anxiete: 0.8 },
  desordonne: { rigueur: -0.7 },
  depensier: { rigueur: -0.5, extraversion: 0.3 },
  susceptible: { anxiete: 0.5 },
  possessif: { anxiete: 0.4, amabilite: -0.3 },
  insomniaque: { anxiete: 0.4 },
  tetu: { amabilite: -0.3, rigueur: 0.3 },
};

// Couples de traits qui ne peuvent pas cohabiter chez la même personne.
const INCOMPATIBLE = [
  ['patient', 'colerique'], ['discret', 'bruyant'], ['discret', 'commere'],
  ['travailleur', 'paresseux'], ['organise', 'desordonne'], ['radin', 'depensier'],
  ['genereux', 'radin'], ['optimiste', 'anxieux'], ['courageux', 'anxieux'],
];

export class Personality {
  constructor(axes, tags) {
    this.axes = axes;
    this.tags = new Set(tags);
  }

  get(axis) {
    return this.axes[axis] ?? 0.5;
  }

  has(tag) {
    return this.tags.has(tag);
  }

  /** +bonus si le trait est présent, sinon 0. Sucre syntaxique très utilisé. */
  t(tag, bonus = 1) {
    return this.tags.has(tag) ? bonus : 0;
  }

  get qualities() {
    return [...this.tags].filter((t) => QUALITIES.some((q) => q.id === t));
  }

  get defects() {
    return [...this.tags].filter((t) => DEFAULTS_.some((d) => d.id === t));
  }

  // --- Grandeurs dérivées, lues par l'IA et les systèmes de vie ---

  /** Supporte-t-il le bruit des voisins ? 0 = appelle la police, 1 = n'entend rien. */
  get toleranceBruit() {
    return clamp01(0.5 + this.get('amabilite') * 0.4 - this.get('anxiete') * 0.45
      + this.t('patient', 0.25) - this.t('susceptible', 0.2) - this.t('colerique', 0.2)
      + this.t('bruyant', 0.2) - this.t('insomniaque', 0.15));
  }

  /** Envie d'être avec les autres. */
  get sociabilite() {
    return clamp01(this.get('extraversion') * 0.8 + this.get('amabilite') * 0.2
      + this.t('commere', 0.15) - this.t('discret', 0.2));
  }

  /** Facilité à dépenser. */
  get depense() {
    return clamp01(0.5 - this.get('rigueur') * 0.4 + this.t('depensier', 0.35) - this.t('radin', 0.4));
  }

  /** Refuse-t-il l'aide ? Le nerf de la guerre pour les interventions du joueur. */
  get fierte() {
    return clamp01(0.35 + this.t('orgueilleux', 0.4) + this.t('tetu', 0.15)
      - this.t('genereux', 0.1) - this.get('amabilite') * 0.2);
  }

  /** Se méfie d'un cadeau anonyme. */
  get mefiance() {
    return clamp01(0.3 + this.get('anxiete') * 0.4 - this.get('ouverture') * 0.3
      + this.t('anxieux', 0.2) + this.t('menteur', 0.15));
  }

  /** Vitesse à laquelle la colère monte. */
  get irritabilite() {
    return clamp01(0.3 + this.get('anxiete') * 0.35 - this.get('amabilite') * 0.3
      + this.t('colerique', 0.35) + this.t('susceptible', 0.2) - this.t('patient', 0.25));
  }

  /** Vitesse à laquelle une rancune s'efface. 0 = jamais. */
  get pardon() {
    return clamp01(0.55 + this.get('amabilite') * 0.35 - this.t('rancunier', 0.55) - this.t('tetu', 0.15));
  }

  /** Attirance pour le romanesque. */
  get romantisme() {
    return clamp01(0.35 + this.get('ouverture') * 0.3 + this.t('romantique', 0.35)
      + this.get('extraversion') * 0.15);
  }

  /** Fidélité dans le couple. */
  get loyaute() {
    return clamp01(0.55 + this.get('amabilite') * 0.25 + this.t('fidele', 0.3)
      + this.get('rigueur') * 0.15 - this.t('menteur', 0.2) - this.get('ouverture') * 0.1);
  }

  /** Goût du travail bien fait, base de la performance professionnelle. */
  get serieux() {
    return clamp01(this.get('rigueur') * 0.7 + this.t('travailleur', 0.25) - this.t('paresseux', 0.3) + 0.1);
  }

  /** Tendance à fouiner, écouter aux portes, regarder par l'œilleton. */
  get curiosite() {
    return clamp01(this.get('ouverture') * 0.5 + this.t('curieux', 0.3) + this.t('commere', 0.3));
  }

  /** Capacité à encaisser un coup dur sans sombrer. */
  get resilience() {
    return clamp01(0.5 - this.get('anxiete') * 0.4 + this.t('optimiste', 0.3)
      + this.t('courageux', 0.2) + this.get('amabilite') * 0.1);
  }

  /** Potentiel de violence. Reste très bas chez presque tout le monde. */
  get violence() {
    return clamp01(this.t('colerique', 0.35) + this.t('rancunier', 0.2) + this.t('possessif', 0.2)
      + this.t('jaloux', 0.15) + this.get('anxiete') * 0.15 - this.get('amabilite') * 0.4
      - this.t('patient', 0.2)) * 0.6;
  }

  describe() {
    const q = this.qualities.map((id) => traitInfo(id).label);
    const d = this.defects.map((id) => traitInfo(id).label);
    return { qualities: q, defects: d };
  }

  serialize() {
    return { axes: { ...this.axes }, tags: [...this.tags] };
  }

  static deserialize(o) {
    return new Personality(o.axes, o.tags);
  }
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));

/** Fabrique une personnalité cohérente : les traits suivent les axes. */
export function makePersonality(rng, { ageBias = 0 } = {}) {
  const axes = {};
  for (const a of AXES) axes[a] = rng.gauss(0.5, 0.19);
  // L'âge tasse un peu l'extraversion et la rigueur monte avec les années.
  axes.rigueur = clamp01(axes.rigueur + ageBias * 0.15);
  axes.extraversion = clamp01(axes.extraversion - ageBias * 0.08);

  const tags = new Set();
  const nQual = rng.int(1, 3);
  const nDef = rng.int(1, 3);

  const score = (t) => {
    const aff = AFFINITY[t.id] ?? {};
    let s = 0.5;
    for (const [axis, w] of Object.entries(aff)) s += (axes[axis] - 0.5) * w * 2;
    return Math.max(0.05, s);
  };

  const conflicts = (id) => INCOMPATIBLE.some(([a, b]) =>
    (a === id && tags.has(b)) || (b === id && tags.has(a)));

  const draw = (pool, n) => {
    let guard = 0;
    while ([...tags].filter((t) => pool.some((p) => p.id === t)).length < n && guard++ < 40) {
      const pick = rng.weighted(pool, score);
      if (!pick || tags.has(pick.id) || conflicts(pick.id)) continue;
      tags.add(pick.id);
    }
  };

  draw(QUALITIES, nQual);
  draw(DEFAULTS_, nDef);

  return new Personality(axes, tags);
}

/**
 * Compatibilité entre deux personnalités : -1 (insupportable) à +1 (évident).
 * Sert autant à l'amitié qu'à l'amour et aux conflits de palier.
 */
export function compatibility(a, b) {
  let s = 0;
  // L'amabilité aide toujours, des deux côtés.
  s += (a.get('amabilite') + b.get('amabilite') - 1) * 0.5;
  // L'ouverture se ressemble ou se heurte.
  s -= Math.abs(a.get('ouverture') - b.get('ouverture')) * 0.5;
  // Deux anxieux s'épuisent.
  s -= (a.get('anxiete') * b.get('anxiete')) * 0.4;
  // Deux extravertis s'amusent, deux introvertis se respectent, le mélange frotte.
  s -= Math.abs(a.get('extraversion') - b.get('extraversion')) * 0.3;
  // Le désordre de l'un contre la rigueur de l'autre : classique du palier.
  s -= Math.abs(a.get('rigueur') - b.get('rigueur')) * 0.35;

  // Frottements nommés.
  if (a.has('bruyant') && b.tags.has('susceptible')) s -= 0.3;
  if (b.has('bruyant') && a.tags.has('susceptible')) s -= 0.3;
  if (a.has('commere') && b.has('discret')) s -= 0.2;
  if (b.has('commere') && a.has('discret')) s -= 0.2;
  if (a.has('desordonne') && b.has('organise')) s -= 0.35;
  if (b.has('desordonne') && a.has('organise')) s -= 0.35;
  if (a.has('colerique') && b.has('colerique')) s -= 0.3;
  if (a.has('drole') && b.get('ouverture') > 0.5) s += 0.2;
  if (b.has('drole') && a.get('ouverture') > 0.5) s += 0.2;
  if (a.has('genereux') && b.has('genereux')) s += 0.2;
  if (a.has('cuisinier_ne') || b.has('cuisinier_ne')) s += 0.1;

  return Math.max(-1, Math.min(1, s));
}
