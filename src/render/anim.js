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
  if (emo.kind === 'dort') target.eye = 0;

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

function applyEmotion(target, emo, t) {
  switch (emo.kind) {
    case 'colere':
      target.brow = -1;
      target.browInner = -1;
      target.mouth = -0.5;
      target.mouthOpen = 0.55 + Math.sin(t * 14) * 0.25;
      target.headTilt += 0.06;
      break;
    case 'triste':
      target.brow = 0.3;
      target.browInner = 1;
      target.mouth = -0.7;
      target.headTilt += 0.12;
      break;
    case 'stresse':
      target.brow = -0.35;
      target.browInner = 0.7;
      target.mouth = -0.2;
      target.headTurn += Math.sin(t * 3.5) * 0.18;
      break;
    case 'joyeux':
      target.brow = 0.55;
      target.mouth = 1;
      target.mouthOpen = 0.35;
      break;
    case 'amoureux':
      target.brow = 0.7;
      target.browInner = 0.4;
      target.mouth = 0.8;
      target.headTilt += Math.sin(t * 0.8) * 0.07;
      break;
    case 'dort':
      target.brow = 0.1;
      target.mouth = 0.1;
      target.mouthOpen = 0.25 + Math.sin(t * 0.9) * 0.12;
      break;
    default:
      target.mouth = 0.15;
      break;
  }
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
      armL: -0.3 - Math.abs(quirk) * 0.12 + breath * 0.05,
      armR: 0.3 + Math.abs(quirk) * 0.12 - breath * 0.05,
      elbowL: 0.34 + quirk * 0.25,
      elbowR: -0.34 + quirk * 0.25,
      handL: 0.3 + quirk * 0.2,
      handR: 0.3 - quirk * 0.2,
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
    const cycle = (t * 0.9) % 1;
    const up = Math.sin(Math.min(1, cycle * 1.6) * Math.PI);
    return {
      sit: 1,
      armR: 0.45 + up * 0.75,
      elbowR: -0.7 - up * 1.1,
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
    armR: 1.95,
    elbowR: -1.75,
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
};

/** La pose visée pour ce que fait l'habitant en ce moment. */
export function poseFor(person) {
  if (person.walking) return 'marche';
  const id = person.action?.id ?? 'rien';
  switch (id) {
    case 'dormir':
    case 'soigner': return 'couche';
    case 'insomnie': return 'insomnie';
    case 'manger': return 'mange';
    case 'cuisiner': return 'cuisine';
    case 'douche': return 'douche';
    case 'menage': return 'menage';
    case 'tv': return 'avachi';
    case 'musique':
    case 'fete':
    case 'invite':
    case 'betise': return 'danse';
    case 'jeu': return 'assis';
    case 'lire': return 'lecture';
    case 'sport': return 'sport';
    case 'bricoler': return 'bricole';
    case 'teletravail':
    case 'chercher_emploi': return 'bureau';
    case 'telephoner': return 'telephone';
    case 'espionner': return 'fenetre';
    case 'ruminer':
    case 'boire': return 'avachi';
    case 'confronter':
    case 'plaindre': return 'colere';
    default: return 'idle';
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
