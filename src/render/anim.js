// Animation.
//
// Le problème d'avant : chaque pose était appliquée telle quelle, image par
// image. Quand un habitant passait de « dort » à « cuisine », il changeait
// de posture en une image. Ça ne bouge pas, ça saute.
//
// Ici, chaque articulation a une valeur courante qui court après sa valeur
// cible. Trois conséquences, gratuites :
//   — les changements de pose se fondent au lieu de claquer ;
//   — les parties lourdes (torse, tête) traînent derrière les parties
//     légères (mains), ce qui donne le mouvement secondaire ;
//   — l'écrasement et l'étirement suivent la vitesse réelle du corps.

/** Toutes les articulations du pantin, à leur valeur de repos. */
const REST = {
  armL: -0.14, armR: 0.14,      // épaules, en radians
  elbowL: 0.35, elbowR: -0.35,  // coudes
  handL: 0.25, handR: 0.25,     // ouverture de la main, 0 poing → 1 doigts écartés
  legL: 0, legR: 0,
  lean: 0,                      // inclinaison du buste
  twist: 0,                     // rotation des épaules
  bob: 0,                       // hauteur
  squash: 1,                    // 1 normal, <1 tassé, >1 étiré
  headTilt: 0,
  headTurn: 0,
  sit: 0,                       // 0 debout, 1 assis
  lie: 0,                       // 0 debout, 1 couché
  brow: 0,                      // -1 sourcils froncés, +1 relevés
  browInner: 0,                 // asymétrie intérieure (tristesse / colère)
  mouth: 0,                     // -1 bouche tombante, +1 grand sourire
  mouthOpen: 0,
  eye: 1,                       // 1 ouvert, 0 fermé
};

/**
 * Vitesse de poursuite par articulation.
 * Plus le nombre est grand, plus la partie est « légère » et réactive.
 * C'est ce tableau, et lui seul, qui crée le mouvement secondaire : les
 * mains arrivent avant les épaules, la tête arrive après le torse.
 */
const SPEED = {
  armL: 13, armR: 13,
  elbowL: 15, elbowR: 15,
  handL: 18, handR: 18,
  legL: 15, legR: 15,
  lean: 6,        // le buste est lourd
  twist: 7,
  bob: 16,
  squash: 12,
  headTilt: 4.5,  // la tête traîne : c'est ce qui donne du poids
  headTurn: 5,
  sit: 7,
  lie: 6,
  brow: 9,
  browInner: 9,
  mouth: 8,
  mouthOpen: 20,
  eye: 26,        // un clignement doit être net
};

export class Rig {
  constructor() {
    this.cur = { ...REST };
    this.prev = { ...REST };
    this.pose = 'idle';
    this.poseAge = 0;
    this.blink = 0;
    this.nextBlink = 1 + Math.random() * 3;
    this.glance = 0;
    this.nextGlance = 2 + Math.random() * 5;
    this.speed = 0;      // vitesse de déplacement, pour le penché
    this.lastX = null;
  }

  /** Poursuite exponentielle : stable quel que soit le pas de temps. */
  chase(key, target, dt, speedScale = 1) {
    const k = (SPEED[key] ?? 10) * speedScale;
    const a = 1 - Math.exp(-k * dt);
    this.cur[key] += (target - this.cur[key]) * a;
  }
}

export function rigFor(person) {
  if (!person._rig) person._rig = new Rig();
  return person._rig;
}

/**
 * Met à jour le pantin d'un habitant.
 *
 * @param {object} person
 * @param {string} poseName  la pose visée
 * @param {(t:number, p:object)=>object} poseFn  la fonction de pose
 * @param {number} t   temps d'animation en secondes
 * @param {number} dt  durée de l'image
 * @param {object} emo émotion courante
 */
export function updateRig(person, poseName, poseFn, t, dt, emo) {
  const rig = rigFor(person);
  const step = Math.min(0.05, Math.max(0.001, dt));

  if (poseName !== rig.pose) {
    rig.pose = poseName;
    rig.poseAge = 0;
  } else {
    rig.poseAge += step;
  }

  const target = { ...REST, ...poseFn(t, person, rig) };

  // Le sursaut s'épuise tout seul : rien à nettoyer ailleurs.
  if (person._startle) {
    person._startle.ttl -= step;
    if (person._startle.ttl <= 0) person._startle = null;
  }

  // --- Clignements ---
  rig.nextBlink -= step;
  if (rig.nextBlink <= 0) {
    rig.blink = 0.13;
    // On cligne plus vite quand on est stressé, moins quand on rêvasse.
    rig.nextBlink = 1.4 + Math.random() * 4 - (person.stress ?? 20) / 60;
  }
  if (rig.blink > 0) {
    rig.blink -= step;
    target.eye = 0;
  }
  if (emo.kind === 'endormie' || emo.kind === 'dort') target.eye = 0;

  // --- Coups d'œil : la tête tourne toute seule de temps en temps ---
  rig.nextGlance -= step;
  if (rig.nextGlance <= 0) {
    rig.glance = (Math.random() - 0.5) * 1.1;
    rig.nextGlance = 2.5 + Math.random() * 6;
  }
  rig.glance *= 1 - step * 0.7;
  target.headTurn += rig.glance;

  // --- Le visage suit l'émotion, mais en douceur ---
  applyEmotion(target, emo, t);

  // --- Anticipation : au tout début d'une pose, on charge dans l'autre sens ---
  if (rig.poseAge < 0.16) {
    const k = 1 - rig.poseAge / 0.16;
    target.squash -= 0.05 * k;
    target.lean -= (target.lean - rig.cur.lean) * 0.4 * k;
  }

  // --- Poursuite de toutes les articulations ---
  for (const key of Object.keys(REST)) {
    rig.chase(key, target[key] ?? REST[key], step);
  }

  // --- Mouvement secondaire déduit, pas scripté ---
  // Le buste s'incline dans le sens du mouvement des bras : quand les mains
  // partent vite d'un côté, le corps suit avec un temps de retard.
  const armVel = ((rig.cur.armL - rig.prev.armL) + (rig.cur.armR - rig.prev.armR)) / step;
  rig.cur.twist += (armVel * 0.006 - rig.cur.twist) * Math.min(1, step * 8);

  // Écrasement / étirement d'après la vitesse verticale réelle.
  const bobVel = (rig.cur.bob - rig.prev.bob) / step;
  rig.cur.squash += (-bobVel * 0.06) * Math.min(1, step * 10);
  rig.cur.squash = Math.max(0.82, Math.min(1.16, rig.cur.squash));

  for (const key of Object.keys(REST)) rig.prev[key] = rig.cur[key];
  return rig.cur;
}

/**
 * Les quarante expressions de l'asset bible.
 *
 * Chacune n'est qu'un jeu de valeurs sur quatre canaux — sourcils, coin
 * interne du sourcil, courbe de la bouche, ouverture — plus parfois un
 * mouvement de tête ou de paupière. C'est peu, et c'est justement pour ça
 * que ça marche : le lissage les enchaîne sans qu'aucune transition soit
 * écrite, et passer de « fière » à « honteuse » prend une demi-seconde.
 *
 * Le tableau est une donnée, pas un `switch` : ajouter une expression, c'est
 * ajouter une ligne, et tools/test-anim.js vérifie qu'elles sont toutes
 * distinctes les unes des autres.
 */
export const EXPRESSIONS = {
  // brow : sourcils hauts (+) ou froncés (−)
  // browInner : coin interne relevé (+ tristesse) ou baissé (− colère)
  // mouth : sourire (+) ou moue (−)   ·   open : bouche ouverte
  // eye : plafond d'ouverture des paupières ·  tilt / turn : tête
  // shake : tremblement rapide  ·  wobble : flottement lent
  neutre: { brow: 0, mouth: 0.32 },

  // --- Ce qui va bien ---
  heureuse: { brow: 0.55, mouth: 1, open: 0.35 },
  rire: { brow: 0.7, mouth: 1, open: 0.75, tilt: -0.12, eye: 0.35 },
  fou_rire: { brow: 0.85, mouth: 1, open: 0.95, tilt: -0.24, eye: 0.1, shake: 8 },
  amusee: { brow: 0.5, browInner: -0.15, mouth: 0.85, tilt: -0.05, eye: 0.65 },
  euphorique: { brow: 0.95, mouth: 1, open: 0.8, tilt: -0.16, shake: 5 },
  fiere: { brow: 0.4, browInner: -0.3, mouth: 0.7, tilt: -0.14, eye: 0.9 },
  soulagee: { brow: 0.3, browInner: 0.3, mouth: 0.5, open: 0.25, tilt: 0.08, eye: 0.55 },
  attendrie: { brow: 0.45, browInner: 0.5, mouth: 0.6, tilt: 0.14, eye: 0.72 },
  amoureuse: { brow: 0.7, browInner: 0.4, mouth: 0.8, tilt: 0.07, eye: 0.8 },
  timide: { brow: 0.5, browInner: 0.6, mouth: 0.25, tilt: 0.2, turn: 0.5, eye: 0.6 },
  nostalgique: { brow: 0.45, browInner: 0.55, mouth: 0.3, tilt: 0.16, turn: 0.4, eye: 0.7 },

  // --- Ce qui se passe dans la tête ---
  songeuse: { brow: 0.4, browInner: 0.25, mouth: 0.35, tilt: 0.1, turn: 0.35, eye: 0.8 },
  concentree: { brow: -0.5, browInner: -0.1, mouth: -0.05, tilt: 0.08, eye: 0.85 },
  determinee: { brow: -0.7, browInner: -0.2, mouth: -0.05, tilt: -0.06, eye: 1 },
  curieuse: { brow: 0.65, browInner: -0.1, mouth: 0.2, tilt: 0.18, turn: -0.3 },
  confuse: { brow: 0.5, browInner: -0.5, mouth: -0.1, tilt: 0.24, turn: -0.2 },
  douteuse: { brow: -0.2, browInner: -0.4, mouth: -0.15, turn: 0.3, eye: 0.75 },
  suspicieuse: { brow: -0.15, browInner: -0.75, mouth: -0.15, turn: 0.3, tilt: 0.05, eye: 0.72 },
  ennui: { brow: 0.1, browInner: 0.2, mouth: -0.2, tilt: 0.22, turn: 0.3, eye: 0.6 },

  // --- Ce qui surprend ---
  surprise: { brow: 1, browInner: -0.2, mouth: 0.1, open: 0.65, tilt: -0.06 },
  choquee: { brow: 1, browInner: 0.5, mouth: -0.3, open: 0.85, tilt: -0.1, lean: -0.14 },

  // --- Ce qui fâche ---
  irritee: { brow: -0.7, browInner: -0.6, mouth: -0.4, turn: -0.1 },
  colere: { brow: -1, browInner: -1, mouth: -0.5, open: 0.55, tilt: 0.06, shake: 14 },
  menace: { brow: -0.9, browInner: -0.9, mouth: -0.2, turn: -0.15, eye: 0.75 },
  mepris: { brow: -0.3, browInner: -0.6, mouth: -0.3, tilt: -0.1, turn: 0.22, eye: 0.62 },
  degout: { brow: -0.5, browInner: -0.2, mouth: -0.75, turn: 0.28, eye: 0.55 },
  jalousie: { brow: -0.6, browInner: -0.5, mouth: -0.35, turn: 0.42, eye: 0.7 },

  // --- Ce qui fait mal ---
  triste: { brow: 0.3, browInner: 1, mouth: -0.7, tilt: 0.12 },
  honteuse: { brow: 0.4, browInner: 0.8, mouth: -0.4, tilt: 0.3, eye: 0.35 },
  resignee: { brow: 0.2, browInner: 0.45, mouth: -0.5, tilt: 0.2, turn: -0.18, eye: 0.5 },
  inquiete: { brow: 0.6, browInner: 0.7, mouth: -0.35, turn: 0.2 },
  stressee: { brow: -0.35, browInner: 0.7, mouth: -0.2, wobble: 0.35 },
  peur: { brow: 1, browInner: 0.9, mouth: -0.6, open: 0.4, turn: 0.12, shake: 9 },
  panique: { brow: 1, browInner: 1, mouth: -0.8, open: 0.9, eye: 1, shake: 16 },

  // --- Ce qui use le corps ---
  fatiguee: { brow: 0.2, browInner: 0.5, mouth: -0.25, tilt: 0.14, eye: 0.45 },
  assoupie: { brow: 0.1, browInner: 0.15, mouth: 0.05, open: 0.2, tilt: 0.28, eye: 0.08 },
  endormie: { brow: 0.1, mouth: 0.1, open: 0.25, eye: 0 },
  malade: { brow: 0.15, browInner: 0.7, mouth: -0.5, tilt: 0.18, eye: 0.4 },
  ivre: { brow: 0.35, browInner: -0.3, mouth: 0.6, open: 0.3, tilt: 0.26, eye: 0.4, wobble: 0.9 },
};

/**
 * Les noms que la simulation emploie, ramenés aux visages ci-dessus.
 * Le monde parle en états — « il dort », « il est stressé » — et l'asset
 * bible parle en visages. Cette table est le seul endroit où les deux se
 * rencontrent, donc renommer un état ne casse jamais un visage.
 */
export const EXPRESSION_ALIAS = {
  content: 'heureuse', joyeux: 'heureuse', energique: 'euphorique',
  amoureux: 'amoureuse', reveur: 'songeuse', surpris: 'surprise',
  choque: 'choquee', effraye: 'peur', stresse: 'stressee',
  mefiant: 'suspicieuse', fatigue: 'fatiguee', dort: 'endormie',
};

export function expressionOf(kind) {
  return EXPRESSIONS[kind] ?? EXPRESSIONS[EXPRESSION_ALIAS[kind]] ?? EXPRESSIONS.neutre;
}

function applyEmotion(target, emo, t) {
  const e = expressionOf(emo.kind);
  target.brow = e.brow ?? 0;
  target.browInner = e.browInner ?? 0;
  target.mouth = e.mouth ?? 0;
  if (e.open !== undefined) target.mouthOpen = e.open;
  if (e.eye !== undefined) target.eye = Math.min(target.eye, e.eye);
  if (e.tilt) target.headTilt += e.tilt;
  if (e.turn) target.headTurn += e.turn;
  if (e.lean) target.lean += e.lean;

  // Deux modulations, et c'est ce qui sépare une grimace figée de quelqu'un
  // qui ressent quelque chose : le tremblement (colère, peur, fou rire) et
  // le flottement (ivresse, stress).
  if (e.shake) {
    target.mouthOpen = (target.mouthOpen ?? 0) + Math.sin(t * e.shake) * 0.2;
    target.headTilt += Math.sin(t * e.shake * 0.7) * 0.02;
  }
  if (e.wobble) {
    target.headTurn += Math.sin(t * 3.5) * 0.18 * e.wobble;
    target.headTilt += Math.sin(t * 2.1) * 0.1 * e.wobble;
  }
}

/**
 * Sursaut.
 *
 * Une expression ne peut pas venir de l'état interne quand la cause est
 * extérieure : personne ne « devient » surpris tout seul. Le monde signale
 * donc l'évènement, et le visage le porte quelques secondes.
 */
export function startle(person, kind, seconds = 3) {
  if (!person) return;
  person._startle = { kind, ttl: seconds, max: seconds };
}

/** L'expression de sursaut en cours, ou null. */
export function startleOf(person) {
  const s = person?._startle;
  if (!s || s.ttl <= 0) return null;
  return { kind: s.kind, force: Math.min(1, s.ttl / (s.max * 0.6)) };
}

/**
 * Poses.
 *
 * Chacune ne décrit qu'une intention. Le lissage s'occupe du reste, donc on
 * peut écrire des poses franches sans craindre les à-coups.
 */
export const POSES = {
  idle: (t, person) => {
    // Repos : respiration, transfert de poids d'une jambe sur l'autre, et
    // une posture propre à chacun — personne ne se tient droit comme un i.
    const breath = Math.sin(t * 1.5);
    const shift = Math.sin(t * 0.42);
    const quirk = ((person?.id ?? 0) % 7) / 7 - 0.5;   // -0.5 .. +0.5
    return {
      squash: 1 + breath * 0.012,
      lean: shift * 0.05 + quirk * 0.06,
      twist: quirk * 0.1,
      headTilt: -shift * 0.05 + quirk * 0.08,
      headTurn: quirk * 0.3,
      // Les bras s'écartent du corps : collés, ça fait pain d'épices.
      armL: -0.58 - Math.abs(quirk) * 0.14 + breath * 0.05,
      armR: 0.58 + Math.abs(quirk) * 0.14 - breath * 0.05,
      // Coude vers l'extérieur : replié vers l'intérieur, l'avant-bras
      // ramenait la main devant le bassin et le personnage avait l'air gêné.
      elbowL: 0.34 + quirk * 0.2,
      elbowR: -0.34 + quirk * 0.2,
      handL: 0.34 + quirk * 0.16,
      handR: 0.34 - quirk * 0.16,
      // Hanche déhanchée : une jambe porte, l'autre se repose.
      legL: quirk > 0 ? 0.1 : 0.02,
      legR: quirk > 0 ? -0.02 : -0.1,
      bob: breath * 0.004,
    };
  },

  marche: (t) => {
    // Cycle de marche : contact, passage, contact. Le corps monte deux fois
    // par cycle, les bras vont à l'opposé des jambes.
    const c = t * 8;
    const swing = Math.sin(c);
    return {
      legL: swing * 0.62,
      legR: -swing * 0.62,
      armL: -swing * 0.55,
      armR: swing * 0.55,
      elbowL: 0.35 + Math.max(0, swing) * 0.4,
      elbowR: -0.35 - Math.max(0, -swing) * 0.4,
      bob: Math.abs(Math.cos(c)) * 0.028,
      lean: 0.07,
      twist: -swing * 0.12,
      headTilt: -0.04,
      handL: 0.15, handR: 0.15,
    };
  },

  assis: (t) => ({
    sit: 1,
    lean: 0.05 + Math.sin(t * 1.2) * 0.015,
    armL: -0.5, armR: 0.5,
    elbowL: 0.9, elbowR: -0.9,
    squash: 1 + Math.sin(t * 1.3) * 0.008,
  }),

  avachi: (t) => ({
    sit: 1,
    lean: 0.2,
    headTilt: 0.16,
    armL: -0.75, armR: 0.75,
    elbowL: 0.5, elbowR: -0.5,
    squash: 0.96 + Math.sin(t * 1.1) * 0.01,
    handL: 0.1, handR: 0.1,
  }),

  couche: (t) => ({
    lie: 1,
    squash: 1 + Math.sin(t * 0.85) * 0.03,
  }),

  bebe: (t) => ({
    lie: 1,
    squash: 1 + Math.sin(t * 2.1) * 0.06,
    armL: -1.1 + Math.sin(t * 3) * 0.3,
    armR: 1.1 - Math.sin(t * 3.4) * 0.3,
    handL: 0.9, handR: 0.9,
  }),

  cuisine: (t) => {
    // On touille : le bras droit tourne, l'épaule accompagne.
    const stir = t * 5.5;
    return {
      armR: 1.0 + Math.sin(stir) * 0.22,
      elbowR: -1.1 + Math.cos(stir) * 0.35,
      armL: -0.55,
      elbowL: 1.0,
      lean: 0.11,
      twist: Math.sin(stir) * 0.09,
      headTilt: 0.08,
      handR: 0.05, handL: 0.4,
    };
  },

  mange: (t) => {
    // La fourchette monte à la bouche, redescend, et on mâche.
    // Les angles ne sont pas au jugé : l'épaule et le coude sont résolus
    // pour que le poignet arrive DEVANT LA BOUCHE. Réglés à l'estime, le
    // bras partait sur le côté et l'habitant mangeait dans le vide.
    const cycle = (t * 0.9) % 1;
    const up = Math.sin(Math.min(1, cycle * 1.6) * Math.PI);
    return {
      sit: 1,
      armR: 0.5 + up * 2.35,
      elbowR: -0.9 - up * 3.2,
      armL: -0.35,
      elbowL: 0.7,
      lean: 0.1 - up * 0.05,
      headTilt: 0.05 - up * 0.06,
      mouthOpen: up > 0.75 ? 0.6 : 0.05,
      handR: 0.05,
    };
  },

  menage: (t) => {
    // Coup de balai : appui, poussée, retour.
    const s = Math.sin(t * 3.2);
    return {
      armR: 0.85 + s * 0.4,
      elbowR: -0.5 - s * 0.3,
      armL: -0.65 + s * 0.3,
      elbowL: 0.6,
      lean: 0.26 + s * 0.06,
      twist: s * 0.16,
      bob: Math.abs(s) * 0.01,
      handL: 0.05, handR: 0.05,
    };
  },

  danse: (t) => {
    // Deux fréquences décalées : sinon ça ressemble à de la gymnastique.
    const a = t * 4.2;
    return {
      armL: -1.45 + Math.sin(a) * 0.85,
      armR: 1.45 - Math.sin(a + 1.1) * 0.85,
      elbowL: 0.8 + Math.cos(a * 1.3) * 0.5,
      elbowR: -0.8 - Math.cos(a * 1.1) * 0.5,
      legL: Math.sin(a * 0.5) * 0.28,
      legR: -Math.sin(a * 0.5) * 0.28,
      bob: Math.abs(Math.sin(a)) * 0.055,
      lean: Math.sin(a * 0.5) * 0.13,
      twist: Math.sin(a * 0.5) * 0.22,
      headTilt: Math.sin(a * 0.5 + 0.6) * 0.14,
      handL: 0.9, handR: 0.9,
      squash: 1 + Math.sin(a) * 0.04,
    };
  },

  colere: (t) => {
    // Bras en l'air, tremblement rapide, buste projeté en avant.
    const shake = Math.sin(t * 17);
    return {
      armL: -2.15 + shake * 0.12,
      armR: 2.15 - shake * 0.12,
      elbowL: 0.55, elbowR: -0.55,
      lean: 0.22,
      headTilt: 0.05,
      twist: shake * 0.05,
      handL: 1, handR: 1,
      bob: Math.abs(shake) * 0.006,
    };
  },

  sport: (t) => {
    const a = t * 4.6;
    const jump = Math.abs(Math.sin(a));
    return {
      armL: -1.9 * jump,
      armR: 1.9 * jump,
      elbowL: 0.2, elbowR: -0.2,
      legL: Math.sin(a) * 0.4,
      legR: -Math.sin(a) * 0.4,
      bob: jump * 0.07,
      squash: 1 + jump * 0.06 - 0.03,
      handL: 0.8, handR: 0.8,
    };
  },

  douche: (t) => ({
    armL: -1.0 + Math.sin(t * 2.2) * 0.35,
    armR: 1.15,
    elbowL: 1.3, elbowR: -1.5,
    lean: Math.sin(t * 1.3) * 0.07,
    headTilt: -0.1,
    handL: 0.7, handR: 0.3,
  }),

  bureau: (t) => ({
    // Les mains pianotent, le dos s'arrondit.
    sit: 1,
    armL: -0.95, armR: 0.95,
    elbowL: 1.15 + Math.sin(t * 11) * 0.05,
    elbowR: -1.15 + Math.sin(t * 9 + 1) * 0.05,
    lean: 0.19,
    headTilt: 0.12,
    handL: 0.35, handR: 0.35,
  }),

  lecture: (t) => ({
    sit: 1,
    armL: -0.8, armR: 0.8,
    elbowL: 1.35, elbowR: -1.35,
    lean: 0.13,
    headTilt: 0.16 + Math.sin(t * 0.5) * 0.02,
    handL: 0.5, handR: 0.5,
  }),

  telephone: (t) => ({
    // Une main à l'oreille, l'autre qui gesticule : personne ne téléphone
    // sans faire de gestes.
    armR: 2.95,
    elbowR: -4.15,
    armL: -0.35 + Math.sin(t * 2.1) * 0.4,
    elbowL: 0.7 + Math.sin(t * 2.6) * 0.5,
    lean: Math.sin(t * 0.9) * 0.06,
    headTilt: 0.1,
    handR: 0.15,
    handL: 0.8,
    mouthOpen: 0.25 + Math.sin(t * 7) * 0.2,
  }),

  bricole: (t) => {
    const hit = Math.sin(t * 12);
    return {
      armL: -1.25, armR: 1.15 + hit * 0.3,
      elbowL: 1.2, elbowR: -0.9 - hit * 0.4,
      lean: 0.24,
      headTilt: 0.14,
      handL: 0.05, handR: 0.05,
      bob: Math.abs(hit) * 0.008,
    };
  },

  fenetre: (t) => ({
    // Accoudé à la fenêtre, à regarder la rue. Presque immobile.
    armL: -0.35, armR: 0.35,
    elbowL: 1.5, elbowR: -1.5,
    lean: -0.06,
    headTurn: Math.sin(t * 0.35) * 0.25,
    squash: 1 + Math.sin(t * 1.1) * 0.01,
    handL: 0.3, handR: 0.3,
  }),

  insomnie: (t) => ({
    sit: 1,
    lean: 0.15,
    headTilt: 0.2,
    armL: -0.6, armR: 0.6,
    elbowL: 1.4, elbowR: -1.4,
    headTurn: Math.sin(t * 0.25) * 0.3,
  }),

  courir: (t) => {
    // La course, ce n'est pas une marche rapide : le buste part en avant,
    // les coudes se plient, et les deux pieds quittent le sol au passage.
    const c = t * 13;
    const swing = Math.sin(c);
    return {
      legL: swing * 1.05,
      legR: -swing * 1.05,
      armL: -swing * 0.9,
      armR: swing * 0.9,
      elbowL: 1.25 + Math.max(0, swing) * 0.35,
      elbowR: -1.25 - Math.max(0, -swing) * 0.35,
      bob: 0.02 + Math.abs(Math.cos(c)) * 0.05,
      lean: 0.24,
      twist: -swing * 0.2,
      headTilt: -0.08,
      handL: 0.05, handR: 0.05,
      squash: 1 + Math.abs(Math.sin(c)) * 0.03,
    };
  },

  ecoute: (t) => {
    // Écouter, c'est presque ne rien faire — mais pas tout à fait : on
    // hoche, on se balance très peu, et on regarde l'autre.
    const nod = Math.sin(t * 1.1);
    return {
      lean: 0.04,
      headTilt: 0.09 + nod * 0.05,
      headTurn: -0.35,
      armL: -0.42, armR: 0.42,
      elbowL: 0.85, elbowR: -0.85,
      handL: 0.2, handR: 0.2,
      squash: 1 + Math.sin(t * 1.4) * 0.008,
    };
  },

  discute: (t) => {
    // On parle avec les mains. Deux fréquences décalées, sinon les deux
    // bras battent la mesure ensemble et ça fait chef d'orchestre.
    const a = t * 2.6;
    return {
      armL: -0.55 + Math.sin(a) * 0.35,
      armR: 0.6 + Math.sin(a * 1.27 + 0.9) * 0.4,
      elbowL: 1.0 + Math.sin(a * 1.1 + 0.4) * 0.4,
      elbowR: -1.05 - Math.sin(a * 0.93) * 0.45,
      lean: 0.05 + Math.sin(a * 0.5) * 0.03,
      twist: Math.sin(a * 0.6) * 0.1,
      headTilt: Math.sin(a * 0.7) * 0.07,
      headTurn: -0.3,
      handL: 0.75, handR: 0.85,
      mouthOpen: 0.25 + Math.sin(t * 12) * 0.2,
    };
  },

  embrasse: (t) => {
    // Penché en avant, un bras qui entoure, l'autre qui hésite.
    const hover = Math.sin(t * 0.9);
    return {
      lean: 0.16 + hover * 0.03,
      headTilt: 0.13,
      headTurn: -0.5,
      armL: -1.35, armR: 0.85 + hover * 0.1,
      elbowL: 1.5, elbowR: -1.15,
      handL: 0.35, handR: 0.55,
      squash: 1 + hover * 0.012,
      bob: hover * 0.005,
    };
  },

  joue: (t) => {
    // Manette : le buste immobile, les pouces qui s'agitent, et le corps
    // qui bascule dans le sens de ce qui se passe à l'écran.
    const twitch = Math.sin(t * 9);
    return {
      sit: 1,
      armL: -0.72, armR: 0.72,
      elbowL: 1.28 + twitch * 0.06,
      elbowR: -1.28 - twitch * 0.06,
      lean: 0.16 + Math.sin(t * 0.7) * 0.06,
      twist: Math.sin(t * 0.7) * 0.14,
      headTilt: 0.1,
      handL: 0.08, handR: 0.08,
    };
  },

  reflechit: (t) => {
    // Une main au menton, le regard qui part sur le côté. C'est la pose
    // qui dit « il se passe quelque chose là-dedans » sans un mot.
    const drift = Math.sin(t * 0.4);
    return {
      armR: 2.88,
      elbowR: -4.05,
      armL: -0.35,
      elbowL: 1.15,
      lean: 0.09,
      headTilt: 0.14 + drift * 0.05,
      headTurn: 0.4 + drift * 0.25,
      handR: 0.25, handL: 0.15,
      squash: 1 + Math.sin(t * 1.2) * 0.007,
    };
  },

  boit: (t) => {
    // Le verre monte, on renverse la tête, on repose. Long cycle : boire
    // vite, ça se voit, et ce n'est pas la même histoire.
    const cycle = (t * 0.35) % 1;
    const up = Math.sin(Math.min(1, cycle * 1.4) * Math.PI);
    return {
      sit: 1,
      armR: 0.5 + up * 2.4,
      elbowR: -0.9 - up * 3.25,
      armL: -0.5,
      elbowL: 0.6,
      lean: 0.14 - up * 0.04,
      headTilt: 0.08 - up * 0.22,
      mouthOpen: up > 0.8 ? 0.35 : 0.05,
      handR: 0.1, handL: 0.2,
    };
  },

  pleure: (t) => {
    // Le visage dans les mains, les épaules qui tressautent. La tristesse
    // du canal `browInner` fait le reste.
    const sob = Math.abs(Math.sin(t * 5.5));
    return {
      lean: 0.22,
      headTilt: 0.32,
      // Mêmes angles résolus que « manger » et « téléphoner » : c'est la
      // seule façon d'amener réellement les paumes sur le visage.
      armL: -2.88, armR: 2.88,
      elbowL: 4.05, elbowR: -4.05,
      handL: 0.55, handR: 0.55,
      squash: 0.97 + sob * 0.02,
      bob: -sob * 0.004,
      eye: 0.1,
      mouth: -0.8,
    };
  },

  rit: (t) => {
    // Tête en arrière, une main sur le ventre, et tout le corps rebondit.
    const ha = Math.abs(Math.sin(t * 7));
    return {
      lean: -0.12,
      headTilt: -0.24,
      armR: 0.8, elbowR: -2.2,
      armL: -0.7 + ha * 0.15, elbowL: 0.6,
      mouth: 1, mouthOpen: 0.7 + ha * 0.25,
      brow: 0.8,
      squash: 1 + ha * 0.025,
      bob: ha * 0.01,
      handL: 0.8, handR: 0.2,
    };
  },

  peur: (t) => {
    // Les mains devant, le buste en arrière, et ce tremblement qu'on ne
    // contrôle pas.
    const tremble = Math.sin(t * 16);
    return {
      lean: -0.18,
      headTilt: -0.06,
      armL: -2.6 + tremble * 0.05, armR: 2.6 - tremble * 0.05,
      elbowL: 3.5, elbowR: -3.5,
      handL: 1, handR: 1,
      legL: -0.08, legR: 0.08,
      twist: tremble * 0.03,
      eye: 1,
    };
  },

  bagarre: (t) => {
    // Garde de boxeur : poings fermés, petit rebond, jab de temps en temps.
    const bounce = Math.abs(Math.sin(t * 6));
    const jab = Math.max(0, Math.sin(t * 2.2) - 0.85) / 0.15;
    return {
      lean: 0.14,
      armL: -2.7 - jab * 0.35, armR: 2.55,
      elbowL: 3.8 - jab * 1.9, elbowR: -3.7,
      handL: 0, handR: 0,
      legL: 0.14, legR: -0.14,
      bob: bounce * 0.014,
      twist: -jab * 0.2,
      squash: 1 + bounce * 0.01,
    };
  },

  fume: (t) => {
    // La cigarette monte, une bouffée, et le bras retombe le long du corps.
    const cycle = (t * 0.28) % 1;
    const up = Math.sin(Math.min(1, cycle * 1.5) * Math.PI);
    return {
      armR: 0.55 + up * 2.35,
      elbowR: -0.9 - up * 3.2,
      armL: -0.5, elbowL: 0.3,
      lean: 0.05,
      headTilt: 0.04 - up * 0.08,
      handR: 0.05, handL: 0.15,
      mouthOpen: up > 0.85 ? 0.2 : 0.05,
      headTurn: 0.25,
    };
  },

  scroll: (t) => ({
    // Les deux mains à hauteur du ventre, la tête penchée dessus : tout le
    // monde reconnaît la posture avant même de voir le téléphone.
    armL: -0.6, armR: 0.6,
    elbowL: 2.15 + Math.sin(t * 9) * 0.03, elbowR: -2.15,
    lean: 0.1,
    headTilt: 0.34,
    handL: 0.1, handR: 0.1,
    eye: 0.75,
  }),

  porte: (t) => ({
    // Un carton dans les bras : les avant-bras à l'horizontale, le dos qui
    // compense en arrière.
    armL: -0.85, armR: 0.85,
    elbowL: 2.1, elbowR: -2.1,
    lean: -0.08,
    handL: 0.05, handR: 0.05,
    squash: 0.985 + Math.sin(t * 1.4) * 0.006,
  }),

  courses: (t) => ({
    // Deux sacs pleins : les bras tirés vers le bas, les épaules remontées,
    // les doigts crochetés sur les anses.
    armL: -0.12, armR: 0.12,
    elbowL: 0.06, elbowR: -0.06,
    handL: 0, handR: 0,
    lean: 0.09,
    squash: 0.975,
    headTilt: 0.06,
  }),

  assis_sol: (t) => ({
    // Par terre, en tailleur — la position des enfants devant leurs jouets.
    sit: 1,
    bob: -0.055,
    lean: 0.12,
    armL: -0.5, armR: 0.7 + Math.sin(t * 2.4) * 0.2,
    elbowL: 0.9, elbowR: -1.2 - Math.sin(t * 2.4) * 0.3,
    handL: 0.6, handR: 0.6,
    headTilt: 0.14,
  }),

  allonge: (t) => ({
    // Allongé mais pas endormi : la sieste du dimanche.
    lie: 1,
    squash: 1 + Math.sin(t * 1.1) * 0.02,
  }),

  reveil: (t, person, rig) => {
    // Assis au bord du lit, les bras au ciel, un bâillement.
    const k = Math.min(1, rig.poseAge / 1.2);
    return {
      sit: 1,
      armL: -0.4 - k * 2.3, armR: 0.4 + k * 2.3,
      elbowL: 0.5 - k * 0.3, elbowR: -0.5 + k * 0.3,
      lean: 0.12 - k * 0.12,
      headTilt: 0.18 - k * 0.1,
      mouthOpen: k > 0.6 ? 0.8 : 0.1,
      eye: 0.3 + k * 0.4,
      squash: 1 + k * 0.02,
      handL: 0.7, handR: 0.7,
    };
  },

  habille: (t) => {
    // On enfile un pantalon : une jambe levée, les bras qui tirent, et cet
    // équilibre incertain que tout le monde connaît.
    const hop = Math.abs(Math.sin(t * 3.2));
    return {
      legL: 0.55, legR: -0.06,
      lean: 0.2,
      armL: -0.9, armR: 0.9,
      elbowL: 1.7, elbowR: -1.7,
      handL: 0.05, handR: 0.05,
      bob: hop * 0.008,
      twist: hop * 0.04,
      headTilt: 0.22,
    };
  },

  conduit: (t) => ({
    // Les mains sur le volant, les yeux droit devant, les secousses de la
    // route. Personne ne conduit dans son salon, mais la planche la demande
    // et la fenêtre du rez-de-chaussée donne sur la rue.
    sit: 1,
    armL: -0.55, armR: 0.55,
    elbowL: 1.9 + Math.sin(t * 8) * 0.02, elbowR: -1.9 + Math.sin(t * 7) * 0.02,
    lean: 0.06,
    handL: 0, handR: 0,
    bob: Math.sin(t * 11) * 0.0025,
  }),

  jardiner: (t) => {
    // Accroupi devant les plantes du balcon, une main qui gratte la terre.
    const gratte = Math.sin(t * 3.4);
    return {
      sit: 0.75, bob: -0.05, lean: 0.3, headTilt: 0.3,
      armR: 1.05 + gratte * 0.18, elbowR: -1.6,
      armL: -0.7, elbowL: 1.3,
      handR: 0.15, handL: 0.45,
    };
  },

  arroser: (t) => ({
    // Bras tendu, arrosoir penché : le poignet fait tout le travail.
    armR: 1.35, elbowR: -0.55,
    armL: -0.4, elbowL: 0.5,
    lean: 0.08, headTilt: 0.12,
    handR: 0.05, handL: 0.2,
    squash: 1 + Math.sin(t * 1.2) * 0.006,
  }),

  repasser: (t) => {
    // Va-et-vient horizontal, épaule qui suit, buste immobile.
    const va = Math.sin(t * 2.6);
    return {
      armR: 1.15 + va * 0.28, elbowR: -1.15 - va * 0.2,
      armL: -0.55, elbowL: 0.9,
      lean: 0.2, headTilt: 0.22,
      handR: 0.05, handL: 0.3,
      twist: va * 0.07,
    };
  },

  vaisselle: (t) => {
    // Devant l'évier : les deux mains basses, les épaules qui frottent.
    const frotte = Math.sin(t * 5);
    return {
      armL: -0.75 + frotte * 0.12, armR: 0.8 - frotte * 0.12,
      elbowL: 1.5, elbowR: -1.5,
      lean: 0.18, headTilt: 0.24,
      handL: 0.2, handR: 0.2,
      twist: frotte * 0.05,
    };
  },

  balcon: (t) => ({
    // Accoudé à la rambarde, penché vers la rue. Presque immobile, mais
    // pas tout à fait : on regarde à droite, puis à gauche.
    armL: -0.45, armR: 0.45,
    elbowL: 1.75, elbowR: -1.75,
    lean: 0.14,
    headTurn: Math.sin(t * 0.28) * 0.4,
    handL: 0.35, handR: 0.35,
    squash: 1 + Math.sin(t * 1.05) * 0.009,
  }),

  frapper_porte: (t) => {
    // Trois coups, une pause, trois coups. Personne ne frappe en continu.
    const cycle = (t * 0.55) % 1;
    const coup = cycle < 0.45 ? Math.abs(Math.sin(cycle * Math.PI * 6)) : 0;
    return {
      armR: 2.6 - coup * 0.35, elbowR: -3.4 + coup * 0.5,
      armL: -0.35, elbowL: 0.4,
      lean: 0.08 + coup * 0.04,
      handR: 0, handL: 0.25,
      headTilt: 0.05,
    };
  },

  saluer: (t) => ({
    // La main levée qui balaie. Le geste le plus reconnaissable du monde.
    armR: 2.75, elbowR: -0.55 + Math.sin(t * 5.5) * 0.42,
    armL: -0.4, elbowL: 0.4,
    handR: 1, handL: 0.3,
    lean: 0.03, headTilt: -0.05,
    mouth: 0.8,
  }),

  applaudir: (t) => {
    // Les mains se rejoignent au centre, vite.
    const clap = Math.abs(Math.sin(t * 7));
    return {
      armL: -1.15, armR: 1.15,
      elbowL: 2.0 + clap * 0.3, elbowR: -2.0 - clap * 0.3,
      handL: 0.1, handR: 0.1,
      lean: -0.04, headTilt: -0.06,
      squash: 1 + clap * 0.012,
    };
  },

  hausser_epaules: (t, person, rig) => {
    // « J'en sais rien. » Les épaules montent, les paumes s'ouvrent.
    const k = Math.min(1, rig.poseAge / 0.5);
    return {
      armL: -1.0 * k, armR: 1.0 * k,
      elbowL: 1.75 * k, elbowR: -1.75 * k,
      handL: 1, handR: 1,
      squash: 1 - 0.02 * k,
      headTilt: 0.12 * k,
      mouth: -0.1,
    };
  },

  croiser_bras: (t) => ({
    // Bras croisés sur la poitrine : fermé, et ça se voit de loin.
    armL: -1.25, armR: 1.25,
    elbowL: 2.5, elbowR: -2.5,
    handL: 0.05, handR: 0.05,
    lean: -0.04,
    squash: 1 + Math.sin(t * 1.1) * 0.007,
  }),

  pointer: (t) => ({
    // Le doigt tendu vers l'autre. Rarement amical.
    armR: 1.75, elbowR: -0.35,
    armL: -0.4, elbowL: 0.55,
    handR: 0.15, handL: 0.4,
    lean: 0.12, headTurn: -0.25,
    twist: -0.08,
    mouthOpen: 0.3 + Math.sin(t * 9) * 0.2,
  }),

  chercher: (t) => {
    // On a perdu quelque chose : on soulève, on se penche, on recommence.
    const balayage = Math.sin(t * 0.9);
    return {
      lean: 0.34 + Math.abs(balayage) * 0.08,
      headTilt: 0.3,
      headTurn: balayage * 0.5,
      armR: 1.15, elbowR: -1.5,
      armL: -0.8, elbowL: 1.1,
      handL: 0.6, handR: 0.6,
      twist: balayage * 0.12,
    };
  },

  soulever: (t, person, rig) => {
    // Plier les genoux, pas le dos. Personne ne fait ça, mais il le faudrait.
    const k = Math.min(1, rig.poseAge / 0.8);
    return {
      sit: 0.4 * (1 - k),
      bob: -0.035 * (1 - k),
      lean: 0.3 - k * 0.22,
      armL: -0.9, armR: 0.9,
      elbowL: 1.9, elbowR: -1.9,
      handL: 0, handR: 0,
      squash: 0.95 + k * 0.05,
      headTilt: 0.1,
    };
  },

  tomber: (t, person, rig) => {
    // La chute : bras en moulinet, buste en arrière, et on se retrouve
    // assis par terre. Ça dure une seconde et demie, pas plus.
    const k = Math.min(1, rig.poseAge / 1.4);
    return {
      sit: k,
      bob: -0.02 * k,
      lean: -0.4 * (1 - k) + 0.12 * k,
      armL: -2.4 + k * 1.4, armR: 2.4 - k * 1.4,
      elbowL: 0.4, elbowR: -0.4,
      handL: 1, handR: 1,
      legL: 0.5 * (1 - k), legR: -0.35 * (1 - k),
      headTilt: -0.2 * (1 - k),
    };
  },

  sursauter: (t, person, rig) => {
    // Tout le corps se rétracte d'un coup, puis redescend.
    const k = Math.min(1, rig.poseAge / 0.55);
    const pic = Math.sin((1 - k) * Math.PI * 0.5);
    return {
      bob: pic * 0.05,
      squash: 1 + pic * 0.07,
      lean: -0.2 * pic,
      armL: -1.5 * pic, armR: 1.5 * pic,
      elbowL: 1.2, elbowR: -1.2,
      handL: 1, handR: 1,
      headTilt: -0.14 * pic,
    };
  },

  bouder: (t) => ({
    // Assis, bras croisés, tête tournée vers le mur. Un ado, ou pas.
    sit: 1,
    armL: -1.2, armR: 1.2,
    elbowL: 2.45, elbowR: -2.45,
    handL: 0.05, handR: 0.05,
    lean: 0.06,
    headTurn: 0.62,
    headTilt: 0.08,
    squash: 1 + Math.sin(t * 0.9) * 0.006,
  }),

  ecrire: (t) => ({
    // Penché sur une table, la main qui court. L'autre tient la feuille.
    sit: 1,
    armR: 0.95, elbowR: -1.5 + Math.sin(t * 6) * 0.06,
    armL: -0.85, elbowL: 1.6,
    lean: 0.28, headTilt: 0.34,
    handR: 0.1, handL: 0.3,
    eye: 0.8,
  }),

  etendre_linge: (t) => {
    // Les deux bras en l'air, une pince à la fois.
    const pince = (t * 0.7) % 1;
    const haut = Math.sin(Math.min(1, pince * 1.6) * Math.PI);
    return {
      armL: -1.2 - haut * 1.1, armR: 1.2 + haut * 1.1,
      elbowL: 0.9 - haut * 0.5, elbowR: -0.9 + haut * 0.5,
      handL: 0.2, handR: 0.2,
      lean: -0.06 - haut * 0.05,
      headTilt: -0.12 - haut * 0.08,
      bob: haut * 0.012,
    };
  },

  bercer: (t) => {
    // Un bébé dans les bras, et ce balancement qu'on ne décide pas.
    const berce = Math.sin(t * 1.3);
    return {
      armL: -0.95, armR: 0.95,
      elbowL: 2.05, elbowR: -2.05,
      handL: 0.1, handR: 0.1,
      lean: berce * 0.09,
      twist: berce * 0.06,
      headTilt: 0.2 + berce * 0.04,
      squash: 1 + Math.sin(t * 1.3) * 0.008,
      mouth: 0.5,
    };
  },

  compter_sous: (t) => {
    // Les billets qu'on recompte, au cas où. Ça ne change jamais rien.
    const feuille = Math.sin(t * 4.2);
    return {
      sit: 1,
      armL: -0.7, armR: 0.75 + feuille * 0.08,
      elbowL: 1.85, elbowR: -1.95,
      handL: 0.15, handR: 0.45,
      lean: 0.22, headTilt: 0.3,
      eye: 0.75,
    };
  },

  // --- Les animations de la bible qui manquaient encore ---------------------
  //
  // Les noms internes des poses ci-dessus sont l'héritage du dessin
  // procédural ; les noms de la bible, eux, sont des noms de FICHIERS, et
  // c'est POSE_TO_ANIMATION qui fait le pont. Celles qui suivent portent
  // directement leur nom de bible parce qu'elles n'avaient aucun équivalent.

  monter_escaliers: (t) => {
    // Monter : le genou très haut, le buste penché en avant, la main qui
    // suit la rampe. Ce n'est pas une marche inclinée.
    const c = t * 5.5;
    const swing = Math.sin(c);
    return {
      legL: swing * 0.9 - 0.25, legR: -swing * 0.9 - 0.25,
      armL: -0.5, armR: 0.9,
      elbowL: 0.6, elbowR: -0.9,
      lean: 0.28,
      bob: 0.02 + Math.abs(Math.cos(c)) * 0.03,
      headTilt: 0.06,
      handL: 0.3, handR: 0.15,
    };
  },

  descendre_escaliers: (t) => {
    // Descendre : le buste en arrière, la jambe qui tâte devant.
    const c = t * 6;
    const swing = Math.sin(c);
    return {
      legL: swing * 0.75 + 0.2, legR: -swing * 0.75 + 0.2,
      armL: -0.7, armR: 0.55,
      elbowL: 0.5, elbowR: -0.7,
      lean: -0.14,
      bob: Math.abs(Math.cos(c)) * 0.02,
      handL: 0.2, handR: 0.35,
    };
  },

  discuter_anime: (t) => {
    // La même conversation, mais montée d'un cran : les deux bras partent,
    // le buste accompagne, la tête ponctue.
    const a = t * 3.4;
    return {
      armL: -0.9 + Math.sin(a) * 0.7, armR: 1.0 + Math.sin(a * 1.3 + 1.1) * 0.75,
      elbowL: 1.3 + Math.sin(a * 1.1) * 0.6, elbowR: -1.35 - Math.sin(a * 0.9) * 0.6,
      lean: 0.08 + Math.sin(a * 0.6) * 0.05,
      twist: Math.sin(a * 0.7) * 0.16,
      headTilt: Math.sin(a * 0.8) * 0.1,
      headTurn: -0.3,
      handL: 1, handR: 1,
      mouthOpen: 0.35 + Math.sin(t * 14) * 0.25,
    };
  },

  faire_calin: (t) => {
    // Les deux bras qui entourent, le buste qui se ferme, la tête posée.
    const respire = Math.sin(t * 0.9);
    return {
      armL: -1.55, armR: 1.55,
      elbowL: 2.2, elbowR: -2.2,
      handL: 0.25, handR: 0.25,
      lean: 0.1,
      headTilt: 0.22,
      headTurn: -0.35,
      squash: 1 + respire * 0.012,
      mouth: 0.6,
    };
  },

  donner_objet: (t, person, rig) => {
    // Les deux mains tendues vers l'avant, paumes ouvertes. On offre.
    const k = Math.min(1, rig.poseAge / 0.7);
    return {
      armL: -0.7 - k * 0.5, armR: 0.75 + k * 0.5,
      elbowL: 1.6 - k * 0.5, elbowR: -1.6 + k * 0.5,
      handL: 1, handR: 1,
      lean: 0.1 * k,
      headTilt: 0.08,
      headTurn: -0.3,
    };
  },

  recevoir_objet: (t, person, rig) => {
    // Les mains en coupe, un peu plus bas, et le buste qui recule à peine.
    const k = Math.min(1, rig.poseAge / 0.7);
    return {
      armL: -0.55 - k * 0.35, armR: 0.6 + k * 0.35,
      elbowL: 1.9, elbowR: -1.9,
      handL: 0.9, handR: 0.9,
      lean: -0.05 * k,
      headTilt: 0.16,
      headTurn: -0.28,
      mouth: 0.5,
    };
  },

  jouer_guitare: (t) => {
    // Une main sur le manche, l'autre qui gratte. Le pied bat la mesure.
    const gratte = Math.sin(t * 7);
    return {
      sit: 1,
      armL: -1.35, elbowL: 1.85,
      armR: 0.85 + gratte * 0.16, elbowR: -1.05,
      handL: 0.55, handR: 0.15,
      lean: 0.14, headTilt: 0.2,
      twist: gratte * 0.04,
      squash: 1 + Math.sin(t * 3.5) * 0.008,
    };
  },

  peindre: (t) => {
    // Devant le chevalet : le bras se recule pour juger, puis revient.
    const recul = Math.sin(t * 0.55);
    const touche = Math.sin(t * 5.5);
    return {
      armR: 1.5 - Math.max(0, recul) * 0.45,
      elbowR: -0.6 - Math.max(0, recul) * 0.9 + touche * 0.08,
      armL: -0.65, elbowL: 1.15,
      lean: 0.06 - recul * 0.06,
      headTilt: 0.06,
      handR: 0.1, handL: 0.35,
    };
  },

  dessiner: (t) => ({
    // Penché très près de la feuille, la main qui hachure vite.
    sit: 1,
    armR: 0.9, elbowR: -1.55 + Math.sin(t * 9) * 0.08,
    armL: -0.9, elbowL: 1.7,
    lean: 0.32, headTilt: 0.4,
    handR: 0.1, handL: 0.25,
    eye: 0.75,
  }),

  yoga: (t) => ({
    // Assis en tailleur, paumes sur les genoux, la respiration très lente.
    sit: 1,
    bob: -0.06,
    armL: -0.95, armR: 0.95,
    elbowL: 1.5, elbowR: -1.5,
    handL: 0.9, handR: 0.9,
    lean: -0.03,
    headTilt: 0.02,
    eye: 0.15,
    squash: 1 + Math.sin(t * 0.55) * 0.018,
  }),

  ecouter_musique: (t) => {
    // Casque sur les oreilles, tête qui hoche, épaules dans le tempo.
    const beat = Math.sin(t * 4.4);
    return {
      armL: -0.5, armR: 0.5,
      elbowL: 0.7, elbowR: -0.7,
      headTilt: beat * 0.12,
      twist: beat * 0.08,
      bob: Math.abs(beat) * 0.01,
      handL: 0.4, handR: 0.4,
      mouth: 0.6,
      eye: 0.55,
    };
  },

  bricoler_creatif: (t) => {
    // À l'établi, on assemble : les deux mains proches, minutieuses.
    const ajuste = Math.sin(t * 3.8);
    return {
      armL: -0.85 + ajuste * 0.06, armR: 0.9 - ajuste * 0.06,
      elbowL: 1.75, elbowR: -1.75,
      handL: 0.15, handR: 0.15,
      lean: 0.3, headTilt: 0.34,
      eye: 0.8,
    };
  },

  triste_debout: (t) => ({
    // Debout, mais éteint : épaules tombées, bras morts le long du corps.
    armL: -0.12, armR: 0.12,
    elbowL: 0.15, elbowR: -0.15,
    handL: 0.1, handR: 0.1,
    lean: 0.14,
    headTilt: 0.3,
    squash: 0.972 + Math.sin(t * 0.8) * 0.006,
  }),

  fatigue_debout: (t) => {
    // On tient debout, à peine : le poids passe d'un pied sur l'autre et
    // la tête part vers l'avant.
    const bascule = Math.sin(t * 0.5);
    return {
      armL: -0.2, armR: 0.2,
      elbowL: 0.25, elbowR: -0.25,
      handL: 0.15, handR: 0.15,
      lean: 0.1 + bascule * 0.04,
      twist: bascule * 0.06,
      headTilt: 0.34,
      squash: 0.965,
      eye: 0.3,
    };
  },

  stresse_debout: (t) => {
    // Les mains qui ne savent pas où se mettre, le pied qui bat.
    const nerveux = Math.sin(t * 6.5);
    return {
      armL: -0.8 + nerveux * 0.1, armR: 0.85 - nerveux * 0.1,
      elbowL: 1.85, elbowR: -1.9,
      handL: 0.5 + nerveux * 0.3, handR: 0.5 - nerveux * 0.3,
      lean: 0.1,
      twist: nerveux * 0.05,
      headTurn: Math.sin(t * 1.7) * 0.3,
      bob: Math.abs(Math.sin(t * 5)) * 0.004,
    };
  },

  malade_debout: (t) => {
    // Une main sur le ventre, l'autre qui cherche un appui, le corps plié.
    const vague = Math.sin(t * 0.7);
    return {
      armR: 0.95, elbowR: -2.2,
      armL: -0.55, elbowL: 0.7,
      lean: 0.24 + vague * 0.05,
      headTilt: 0.32,
      squash: 0.955,
      handR: 0.2, handL: 0.2,
      eye: 0.35,
    };
  },

  ivre_debout: (t) => {
    // L'équilibre approximatif : le buste dérive, les pieds rattrapent.
    const derive = Math.sin(t * 1.15);
    const derive2 = Math.sin(t * 0.73 + 1.4);
    return {
      lean: derive * 0.16,
      twist: derive2 * 0.14,
      headTilt: derive2 * 0.22,
      headTurn: derive * 0.3,
      armL: -0.55 + derive * 0.2, armR: 0.6 - derive2 * 0.2,
      elbowL: 0.5, elbowR: -0.55,
      legL: derive * 0.14, legR: -derive * 0.14,
      handL: 0.5, handR: 0.4,
      bob: Math.abs(derive) * 0.006,
      eye: 0.4,
    };
  },

  amoureux_debout: (t) => {
    // Les mains derrière le dos, le poids qui se balance, le regard ailleurs.
    const balance = Math.sin(t * 0.85);
    return {
      armL: -0.25, armR: 0.25,
      elbowL: 0.9, elbowR: -0.9,
      handL: 0.3, handR: 0.3,
      lean: -0.05 + balance * 0.04,
      twist: balance * 0.08,
      headTilt: 0.14 + balance * 0.06,
      headTurn: balance * 0.35,
      squash: 1 + Math.sin(t * 1.2) * 0.01,
      mouth: 0.8,
    };
  },

  prier: (t) => ({
    // Les mains jointes à hauteur de poitrine, la tête basse, immobile.
    armL: -0.9, armR: 0.9,
    elbowL: 2.05, elbowR: -2.05,
    handL: 0.35, handR: 0.35,
    lean: 0.06,
    headTilt: 0.36,
    eye: 0.1,
    squash: 1 + Math.sin(t * 0.6) * 0.01,
  }),

  se_coucher: (t, person, rig) => {
    // Le passage debout → couché : on s'assoit au bord, on bascule.
    const k = Math.min(1, rig.poseAge / 1.1);
    return {
      sit: 1 - k * 0.4,
      lie: k > 0.6 ? (k - 0.6) / 0.4 : 0,
      bob: -0.03 * k,
      lean: 0.2 - k * 0.5,
      armL: -0.8, armR: 0.8,
      elbowL: 1.2, elbowR: -1.2,
      headTilt: 0.1,
      eye: 1 - k * 0.7,
    };
  },

  ecouter_porte: (t) => ({
    // L'oreille collée au battant, une main en appui, le corps immobile.
    // Le seul mouvement, c'est de retenir sa respiration.
    armL: -1.35, elbowL: 1.1,
    armR: 0.35, elbowR: -0.4,
    lean: 0.18,
    headTilt: -0.28,
    headTurn: -0.55,
    handL: 0.9, handR: 0.2,
    squash: 1 + Math.sin(t * 0.45) * 0.005,
    eye: 0.5,
  }),

  releve: (t, person, rig) => {
    // Se relever : on pousse sur les mains, le buste part en avant, puis on
    // se déplie. La pose dure le temps que le lissage mette à la quitter.
    const k = Math.min(1, rig.poseAge / 0.6);
    return {
      sit: 1 - k,
      lean: 0.35 * (1 - k * 0.7),
      armL: -1.1 + k * 0.8, armR: 1.1 - k * 0.8,
      elbowL: 1.2 - k * 0.9, elbowR: -1.2 + k * 0.9,
      bob: -0.02 * (1 - k),
      squash: 0.94 + k * 0.06,
      headTilt: 0.2 - k * 0.2,
    };
  },
};

/**
 * Les soixante animations de l'asset bible.
 *
 * Ces identifiants sont des NOMS DE FICHIERS : c'est sous ces noms que les
 * planches de sprites sont livrées (assets/personnages/). L'ordre et
 * l'orthographe viennent de la bible, pas d'ici.
 *
 * `fps` et `frames` décrivent la boucle attendue. Un dessinateur qui livre
 * huit images pour « marcher » sait qu'elles tourneront à douze par seconde,
 * et le jeu sait où découper la planche.
 */
export const BIBLE_ANIMATIONS = [
  // 01-08 Déplacements
  ['marcher', 8, 12], ['courir', 8, 16], ['monter_escaliers', 8, 10],
  ['descendre_escaliers', 8, 10], ['s_asseoir', 6, 10], ['se_lever', 6, 10],
  ['se_pencher', 4, 8], ['porter_objet', 6, 10],
  // 09-20 Actions quotidiennes
  ['cuisiner', 6, 8], ['manger', 6, 6], ['boire', 6, 6], ['lire', 4, 4],
  ['ecrire', 6, 8], ['telephoner', 6, 6], ['regarder_tele', 4, 4],
  ['faire_menage', 6, 8], ['faire_lessive', 6, 8], ['bricoler', 6, 10],
  ['arroser_plantes', 6, 6], ['fumer', 6, 5],
  // 21-30 Interactions sociales
  ['parler', 6, 8], ['discuter_anime', 8, 10], ['ecouter', 4, 5],
  ['se_disputer', 8, 12], ['se_reconcilier', 6, 7], ['embrasser', 4, 4],
  ['saluer', 6, 10], ['faire_calin', 4, 4], ['donner_objet', 5, 8],
  ['recevoir_objet', 5, 8],
  // 31-40 Loisirs et passions
  ['jouer_video', 6, 8], ['jouer_guitare', 6, 10], ['peindre', 6, 7],
  ['dessiner', 6, 8], ['faire_sport', 8, 12], ['yoga', 4, 3],
  ['danser', 8, 12], ['ecouter_musique', 6, 8], ['jardiner', 6, 7],
  ['bricoler_creatif', 6, 8],
  // 41-50 États et émotions
  ['heureux', 4, 5], ['triste', 4, 4], ['en_colere', 6, 12], ['fatigue', 4, 4],
  ['stresse', 6, 10], ['peur', 6, 12], ['malade', 4, 4], ['ivre', 6, 6],
  ['amoureux', 4, 5], ['deprime', 4, 3],
  // 51-60 Animations spéciales
  ['dormir', 4, 3], ['se_reveiller', 6, 8], ['se_coucher', 6, 8],
  ['pleurer', 6, 8], ['crise_de_rire', 6, 12], ['prier', 4, 3],
  ['surprise', 5, 12], ['regarder_fenetre', 4, 4], ['ecouter_porte', 4, 4],
  ['feter', 8, 12],
];

/**
 * De la pose interne au nom de la bible.
 *
 * Les poses ci-dessus portent des noms hérités du dessin procédural. La
 * bible, elle, nomme des fichiers. Cette table est le seul endroit où les
 * deux se rencontrent — renommer une pose ne casse donc aucun fichier
 * livré, et une pose sans entrée reste simplement dessinée par le code.
 */
export const POSE_TO_ANIMATION = {
  marche: 'marcher', courir: 'courir', assis: 's_asseoir', releve: 'se_lever',
  chercher: 'se_pencher', porte: 'porter_objet', courses: 'porter_objet',
  soulever: 'porter_objet', cuisine: 'cuisiner', mange: 'manger', boit: 'boire',
  lecture: 'lire', ecrire: 'ecrire', compter_sous: 'ecrire', bureau: 'ecrire',
  telephone: 'telephoner', scroll: 'telephoner', avachi: 'regarder_tele',
  menage: 'faire_menage', vaisselle: 'faire_menage', etendre_linge: 'faire_lessive',
  repasser: 'faire_lessive', bricole: 'bricoler', arroser: 'arroser_plantes',
  fume: 'fumer', discute: 'parler', ecoute: 'ecouter', colere: 'se_disputer',
  pointer: 'se_disputer', bagarre: 'se_disputer', croiser_bras: 'en_colere',
  hausser_epaules: 'se_reconcilier', embrasse: 'embrasser', saluer: 'saluer',
  bercer: 'faire_calin', joue: 'jouer_video', sport: 'faire_sport',
  danse: 'danser', jardiner: 'jardiner', peur: 'peur', pleure: 'pleurer',
  rit: 'crise_de_rire', sursauter: 'surprise', tomber: 'surprise',
  fenetre: 'regarder_fenetre', balcon: 'regarder_fenetre',
  frapper_porte: 'ecouter_porte', applaudir: 'feter', couche: 'dormir',
  allonge: 'dormir', bebe: 'dormir', reveil: 'se_reveiller',
  bouder: 'deprime', insomnie: 's_asseoir', assis_sol: 's_asseoir',
  conduit: 's_asseoir', habille: 'se_lever', idle: 'heureux',
  reflechit: 'triste', douche: 'faire_menage',
};
// Les poses qui portent déjà leur nom de bible se mappent sur elles-mêmes.
for (const [id] of BIBLE_ANIMATIONS) {
  if (POSES[id] && !POSE_TO_ANIMATION[id]) POSE_TO_ANIMATION[id] = id;
}
POSE_TO_ANIMATION.triste_debout = 'triste';
POSE_TO_ANIMATION.fatigue_debout = 'fatigue';
POSE_TO_ANIMATION.stresse_debout = 'stresse';
POSE_TO_ANIMATION.malade_debout = 'malade';
POSE_TO_ANIMATION.ivre_debout = 'ivre';
POSE_TO_ANIMATION.amoureux_debout = 'amoureux';

/** Le nom de bible d'une pose, ou null si elle n'en a pas. */
export function animationOf(pose) {
  return POSE_TO_ANIMATION[pose] ?? null;
}

/**
 * La pose visée pour ce que fait l'habitant en ce moment.
 *
 * Une action ne donne pas une pose, elle donne une FAMILLE de poses : on ne
 * fait pas le ménage de la même façon si on repasse, si on fait la
 * vaisselle ou si on étend du linge. Le choix à l'intérieur d'une famille
 * est stable — dérivé de l'identifiant — pour qu'un habitant garde ses
 * habitudes au lieu de changer de geste toutes les cinq secondes.
 */
export function poseFor(person) {
  // Dans la cage d'escalier, on ne fait rien d'autre que monter ou
  // descendre. C'est le seul endroit du jeu où la pose est imposée par le
  // lieu et non par l'occupation.
  if (person.stairs) {
    return person.stairs.dir > 0 ? 'monter_escaliers' : 'descendre_escaliers';
  }
  if (person.walking) return person.running ? 'courir' : 'marche';

  // Un sursaut se voit dans tout le corps, pas seulement sur le visage.
  const s = person._startle;
  if (s && s.ttl > s.max - 0.6) return 'sursauter';

  // Un paquet qui change de mains passe avant l'occupation : c'est un
  // geste court, et c'est justement pendant ce geste qu'on veut le voir.
  if (person.parcel) {
    return person.parcel.dir > 0 ? 'recevoir_objet' : 'donner_objet';
  }

  const id = person.action?.id ?? 'rien';
  // Un habitant sans identifiant, ça n'existe pas dans le jeu — mais ça
  // existe dans les tests et les planches. Sans ce garde-fou, `n % k` vaut
  // NaN et la pose renvoyée est `undefined`.
  const n = Number.isFinite(person.id) ? person.id : 0;
  const mood = person.mood ?? 60;
  const P = person.personality;
  const trait = (t) => P?.has?.(t) === true;
  const parmi = (...v) => v[n % v.length];

  const act = person.action;
  // Le tout début d'une action se voit : on ne se réveille pas déjà couché.
  const debut = act && act.total && act.remaining > act.total - 3;

  switch (id) {
    case 'dormir': return debut ? 'se_coucher' : 'couche';
    case 'soigner': return 'couche';
    case 'insomnie': return parmi('insomnie', 'balcon', 'insomnie');
    case 'manger': return 'mange';
    case 'cuisiner': return 'cuisine';
    case 'douche': return 'douche';

    // Le ménage se décline : balai, vaisselle, repassage, linge à étendre.
    case 'menage': return parmi('menage', 'vaisselle', 'repasser', 'etendre_linge');

    // Épuisé devant la télé, on finit allongé sur le canapé.
    case 'tv': return (person.needs?.get?.('energie') ?? 70) < 28 ? 'allonge' : 'avachi';

    // On n'écoute pas tous la musique pareil : les expansifs dansent, les
    // curieux en font eux-mêmes, les autres écoutent au casque.
    case 'musique':
      if ((P?.get?.('extraversion') ?? 0.5) > 0.45) return 'danse';
      if ((P?.get?.('ouverture') ?? 0.5) > 0.58) return parmi('jouer_guitare', 'ecouter_musique');
      return parmi('ecouter_musique', 'assis');
    case 'fete': return parmi('danse', 'rit', 'applaudir', 'danse');
    case 'betise': return parmi('danse', 'tomber', 'danse');
    case 'jeu': return person.age < 12 ? parmi('assis_sol', 'dessiner', 'assis_sol') : 'joue';
    case 'lire': return parmi('lecture', 'lecture', 'ecrire');
    // Le sport en appartement, ce n'est pas que de la fonte : à un étage de
    // Paris, c'est surtout un tapis déroulé entre la table et le canapé.
    case 'sport': return parmi('sport', 'soulever', 'yoga');

    // Bricoler couvre deux gestes très différents : réparer, et fabriquer.
    // Le bricoleur visse, le curieux peint.
    case 'bricoler':
      if (trait('bricoleur')) return parmi('bricole', 'bricoler_creatif');
      if ((P?.get?.('ouverture') ?? 0.5) > 0.6) return parmi('peindre', 'dessiner');
      return parmi('bricole', 'soulever', 'bricole');
    case 'teletravail': return parmi('bureau', 'ecrire');
    case 'chercher_emploi': return parmi('bureau', 'chercher');

    // Un appel sur deux se passe l'écran sous le nez, pas à l'oreille.
    case 'telephoner': return n % 2 === 0 ? 'scroll' : 'telephone';
    // Espionner, c'est deux postes : la fenêtre, et l'oreille contre la
    // porte palière. Le second est le geste le plus honteux du jeu.
    case 'espionner': return parmi('ecouter_porte', 'fenetre', 'ecouter_porte', 'balcon');
    case 'courses': return 'courses';
    case 'promener': return parmi('balcon', 'jardiner', 'arroser');

    // Ruminer se décline avec ce qui ronge : le moral, la santé, ou les
    // fins de mois. Le recours au ciel vient quand le corps lâche — c'est
    // là, et pas ailleurs, qu'on a vu des gens se remettre à prier.
    case 'ruminer':
      if (mood < 22) return 'pleure';
      if ((person.health ?? 90) < 58 && person.age >= 55) return parmi('prier', 'reflechit');
      return (person.debt ?? 0) > 800 ? 'compter_sous' : 'reflechit';
    case 'boire': return (person.addiction ?? 0) > 0.45 ? 'boit' : parmi('boit', 'compter_sous');

    // On frappe avant d'entrer. Puis on discute — et les expansifs
    // discutent avec les mains.
    case 'visiter':
      if (debut) return 'frapper_porte';
      if (trait('genereux')) return parmi('donner_objet', 'discute', 'discuter_anime');
      if ((P?.get?.('extraversion') ?? 0.5) > 0.58) return parmi('discuter_anime', 'discute');
      return parmi('discute', 'saluer', 'discute');
    case 'reconcilier': return parmi('ecoute', 'faire_calin', 'hausser_epaules');
    case 'famille_temps':
      if (trait('protecteur') && person.age < 45) return parmi('bercer', 'faire_calin', 'ecoute');
      return parmi('ecoute', 'faire_calin', 'ecoute');
    case 'flirter': return parmi('embrasse', 'faire_calin');
    case 'sortir': return parmi('saluer', 'marche', 'courses');
    case 'ecole': return parmi('ecrire', 'assis');
    case 'travailler': return parmi('bureau', 'porte', 'ecrire');

    case 'confronter': return parmi('colere', 'pointer', 'bagarre');
    case 'plaindre': return parmi('colere', 'frapper_porte', 'pointer');

    default: {
      // Sans occupation, c'est l'état du corps qui parle en premier, le
      // moral ensuite, le caractère en dernier. L'ordre EST le propos :
      // quelqu'un de malade et anxieux se tient d'abord comme un malade.
      if ((person.stress ?? 20) > 85) return 'peur';
      if ((person.health ?? 90) < 46) return 'malade_debout';
      if ((person.addiction ?? 0) > 0.5 && person.age >= 18) {
        return parmi('ivre_debout', 'fume');
      }
      if ((person.needs?.get?.('energie') ?? 70) < 26) return 'fatigue_debout';
      if (mood < 26) return 'triste_debout';
      if ((person.stress ?? 20) > 64) return 'stresse_debout';
      // L'amour se tient debout aussi. Il faut un partenaire ET le moral :
      // en couple et malheureux, on ne se tient pas comme ça.
      if (mood > 74 && person.relations?.partner?.()) return 'amoureux_debout';
      if (person.age >= 12 && person.age < 20 && mood < 45) return 'bouder';
      if (trait('anxieux') || trait('rancunier')) return 'croiser_bras';
      if (trait('curieux')) return parmi('balcon', 'chercher', 'idle');
      if (trait('patient')) return parmi('jardiner', 'arroser', 'idle');
      if (person.age < 12) return parmi('assis_sol', 'idle');
      if (person.isOld) return parmi('balcon', 'idle', 'allonge');
      return parmi('idle', 'idle', 'balcon', 'hausser_epaules');
    }
  }
}

/**
 * Un habitant qui parle bouge les mains et la bouche. C'est ce qui fait la
 * différence entre une bulle posée sur un mannequin et quelqu'un qui parle.
 */
export function applySpeech(channels, person, t) {
  if (!person.speech) return;
  const energy = Math.min(1, person.speech.ttl / person.speech.max + 0.35);
  channels.mouthOpen = Math.max(channels.mouthOpen, (0.25 + Math.sin(t * 13) * 0.22) * energy);
  channels.armL -= Math.sin(t * 3.1) * 0.16 * energy;
  channels.elbowL += Math.sin(t * 3.1 + 0.7) * 0.22 * energy;
  channels.headTilt += Math.sin(t * 2.4) * 0.05 * energy;
}
