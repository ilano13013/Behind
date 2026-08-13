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

/**
 * Les douze expressions de la charte.
 *
 * Chacune n'est qu'un jeu de valeurs sur quatre canaux — sourcils, coin
 * interne du sourcil, courbe de la bouche, ouverture — plus parfois un
 * mouvement de tête. C'est peu, et c'est justement pour ça que ça marche :
 * le lissage les enchaîne sans qu'aucune transition soit écrite.
 */
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
    case 'content':
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
    case 'surpris':
      // Sourcils au plafond, yeux ronds, bouche en O.
      target.brow = 1;
      target.browInner = -0.2;
      target.mouth = 0.1;
      target.mouthOpen = 0.65;
      target.headTilt -= 0.06;
      break;
    case 'choque':
      // La surprise, mais en arrière : le buste recule.
      target.brow = 1;
      target.browInner = 0.5;
      target.mouth = -0.3;
      target.mouthOpen = 0.85;
      target.lean -= 0.14;
      target.headTilt -= 0.1;
      break;
    case 'effraye':
      target.brow = 1;
      target.browInner = 0.9;
      target.mouth = -0.6;
      target.mouthOpen = 0.4;
      target.headTurn += Math.sin(t * 9) * 0.12;
      target.lean -= 0.08;
      break;
    case 'mefiant':
      // Un sourcil plus haut que l'autre, bouche de travers, regard en biais.
      target.brow = -0.15;
      target.browInner = -0.75;
      target.mouth = -0.15;
      target.headTurn += 0.3;
      target.headTilt += 0.05;
      target.eye = Math.min(target.eye, 0.72);
      break;
    case 'reveur':
      target.brow = 0.4;
      target.browInner = 0.25;
      target.mouth = 0.35;
      target.headTilt += 0.1 + Math.sin(t * 0.5) * 0.05;
      target.headTurn += Math.sin(t * 0.31) * 0.35;
      target.eye = Math.min(target.eye, 0.8);
      break;
    case 'energique':
      target.brow = 0.75;
      target.mouth = 1;
      target.mouthOpen = 0.5 + Math.sin(t * 6) * 0.2;
      target.squash *= 1 + Math.sin(t * 6) * 0.012;
      break;
    case 'fatigue':
      // Paupières lourdes, tête qui pique du nez, bâillement de temps en temps.
      target.brow = 0.2;
      target.browInner = 0.5;
      target.mouth = -0.25;
      target.headTilt += 0.14 + Math.sin(t * 0.6) * 0.06;
      target.eye = Math.min(target.eye, 0.45);
      if (Math.sin(t * 0.28) > 0.96) target.mouthOpen = 0.9;
      break;
    default:
      // Même au repos, une bouche parfaitement droite fait masque. Un
      // soupçon de courbe suffit à ce que quelqu'un habite le visage.
      target.mouth = 0.32;
      break;
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

/** La pose visée pour ce que fait l'habitant en ce moment. */
export function poseFor(person) {
  if (person.walking) return person.running ? 'courir' : 'marche';
  const id = person.action?.id ?? 'rien';
  const mood = person.mood ?? 60;
  switch (id) {
    case 'dormir':
    case 'soigner': return 'couche';
    case 'insomnie': return 'insomnie';
    case 'manger': return 'mange';
    case 'cuisiner': return 'cuisine';
    case 'douche': return 'douche';
    case 'menage': return 'menage';
    // Épuisé devant la télé, on finit allongé sur le canapé.
    case 'tv': return (person.needs?.get?.('energie') ?? 70) < 28 ? 'allonge' : 'avachi';
    // On n'écoute pas tous la musique pareil : les expansifs dansent,
    // les autres hochent la tête, casque sur les oreilles.
    case 'musique':
      return (person.personality?.get?.('extraversion') ?? 0.5) > 0.45 ? 'danse' : 'assis';
    case 'fete': return person.id % 3 === 0 ? 'rit' : 'danse';
    case 'betise': return 'danse';
    case 'jeu': return person.age < 12 ? 'assis_sol' : 'joue';
    case 'lire': return 'lecture';
    case 'sport': return 'sport';
    case 'bricoler': return 'bricole';
    case 'teletravail':
    case 'chercher_emploi': return 'bureau';
    // Un appel sur deux se passe l'écran sous le nez, pas à l'oreille.
    case 'telephoner': return person.id % 2 === 0 ? 'scroll' : 'telephone';
    case 'espionner': return 'fenetre';
    // Ruminer devient pleurer quand le moral est vraiment au fond.
    case 'ruminer': return mood < 22 ? 'pleure' : 'reflechit';
    case 'boire': return 'boit';
    case 'visiter': return 'discute';
    case 'reconcilier':
    case 'famille_temps': return 'ecoute';
    case 'flirter': return 'embrasse';
    case 'confronter':
    case 'plaindre': return 'colere';
    default:
      // Sans occupation : la peur si le stress déborde, la clope si le
      // corps la réclame, sinon le repos.
      if ((person.stress ?? 20) > 85) return 'peur';
      if ((person.addiction ?? 0) > 0.5 && person.age >= 18) return 'fume';
      return 'idle';
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
