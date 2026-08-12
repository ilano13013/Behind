// Les habitants, dessinés.
//
// Des marionnettes 2D très stylisées : grosse tête, petit corps, membres
// souples. Tout l'enjeu est l'expressivité — un habitant doit être lisible
// à trois centimètres de haut derrière une fenêtre, et attachant en gros
// plan dans son salon. L'émotion passe par trois choses : l'angle des
// sourcils, la courbe de la bouche, et la posture.

import { PALETTE, pickStable, shade, rgba } from './palette.js';

/** Apparence stable d'un habitant : tirée de son identifiant, jamais stockée. */
export function appearance(person) {
  if (person._look) return person._look;
  const id = person.id;
  // Les teintes grises et blanches sont réservées aux plus âgés : elles
  // sont dans la palette pour eux.
  const naturalHair = PALETTE.hair.filter((c) => !['#a8a29c', '#d8d4ce'].includes(c));
  const look = {
    skin: pickStable(PALETTE.skin, `peau${id}`),
    hair: pickStable(person.age > 55 ? PALETTE.hair : naturalHair, `cheveux${id}`),
    top: pickStable(PALETTE.clothes, `haut${id}`),
    bottom: pickStable(PALETTE.clothes, `bas${id * 7 + 3}`),
    hairStyle: hashPick(id * 13 + 5, 7),
    build: 0.85 + (hashPick(id * 3 + 1, 100) / 100) * 0.35,
    glasses: hashPick(id * 17 + 2, 100) < 24,
    beard: person.gender === 'm' && person.age > 22 && hashPick(id * 19 + 7, 100) < 38,
    nose: hashPick(id * 23 + 11, 3),
  };
  // Les cheveux blanchissent avec l'âge, comme il se doit.
  if (person.age > 62 && hashPick(id * 29, 100) < 75) {
    look.hair = person.age > 75 ? '#ded9d2' : '#b0aaa2';
  }
  person._look = look;
  return look;
}

function hashPick(seed, mod) {
  let h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  return (h >>> 0) % mod;
}

/** Taille relative selon l'âge : un enfant n'est pas un adulte en réduction. */
export function heightFactor(age) {
  if (age < 1) return 0.36;
  if (age < 6) return 0.46 + age * 0.03;
  if (age < 14) return 0.62 + (age - 6) * 0.035;
  if (age < 18) return 0.9 + (age - 14) * 0.025;
  if (age > 72) return 0.95;
  return 1;
}

// --- Poses -----------------------------------------------------------------
//
// Une pose renvoie des angles en radians et quelques décalages. Le reste
// du dessin ne connaît rien aux actions : il applique une pose.

const POSES = {
  idle: (t) => ({
    breathe: Math.sin(t * 1.6) * 0.012,
    armL: -0.15 + Math.sin(t * 1.4) * 0.05,
    armR: 0.15 - Math.sin(t * 1.4 + 0.6) * 0.05,
    lean: Math.sin(t * 0.7) * 0.02,
  }),
  marche: (t) => ({
    legL: Math.sin(t * 7) * 0.55,
    legR: -Math.sin(t * 7) * 0.55,
    armL: -Math.sin(t * 7) * 0.5,
    armR: Math.sin(t * 7) * 0.5,
    bob: Math.abs(Math.sin(t * 7)) * 0.025,
  }),
  assis: () => ({ sit: 1, armL: -0.35, armR: 0.35, lean: 0.06 }),
  avachi: (t) => ({ sit: 1, slump: 1, armL: -0.6, armR: 0.6, lean: 0.16, breathe: Math.sin(t * 1.2) * 0.01 }),
  couche: (t) => ({ lie: 1, breathe: Math.sin(t * 0.9) * 0.03 }),
  cuisine: (t) => ({
    armR: 0.9 + Math.sin(t * 5) * 0.35,
    armL: -0.4,
    lean: 0.08,
    breathe: Math.sin(t * 1.5) * 0.01,
  }),
  mange: (t) => ({
    sit: 1,
    armR: 0.5 + Math.sin(t * 2.4) * 0.6,
    armL: -0.3,
  }),
  menage: (t) => ({
    armR: 0.7 + Math.sin(t * 3) * 0.4,
    armL: -0.5 + Math.sin(t * 3) * 0.3,
    lean: 0.22 + Math.sin(t * 3) * 0.05,
  }),
  danse: (t) => ({
    armL: -1.5 + Math.sin(t * 4.5) * 0.7,
    armR: 1.5 - Math.sin(t * 4.5 + 1) * 0.7,
    legL: Math.sin(t * 4.5) * 0.3,
    legR: -Math.sin(t * 4.5) * 0.3,
    bob: Math.abs(Math.sin(t * 4.5)) * 0.05,
    lean: Math.sin(t * 2.2) * 0.1,
  }),
  colere: (t) => ({
    armL: -2.1 + Math.sin(t * 12) * 0.16,
    armR: 2.1 + Math.sin(t * 12 + 1) * 0.16,
    lean: 0.18,
    shake: Math.sin(t * 22) * 0.006,
  }),
  sport: (t) => ({
    armL: -1.8 * Math.abs(Math.sin(t * 5)),
    armR: 1.8 * Math.abs(Math.sin(t * 5)),
    legL: Math.sin(t * 5) * 0.35,
    legR: -Math.sin(t * 5) * 0.35,
    bob: Math.abs(Math.sin(t * 5)) * 0.06,
  }),
  douche: (t) => ({
    armL: -0.9 + Math.sin(t * 2) * 0.3,
    armR: 0.9,
    lean: Math.sin(t * 1.2) * 0.06,
  }),
  bureau: (t) => ({ sit: 1, armL: -0.9, armR: 0.9, lean: 0.14, tap: Math.sin(t * 9) * 0.02 }),
  lecture: () => ({ sit: 1, armL: -0.75, armR: 0.75, lean: 0.1 }),
  telephone: (t) => ({ armR: 1.9, armL: -0.2 + Math.sin(t * 1.3) * 0.15, lean: Math.sin(t * 0.9) * 0.05 }),
  bricole: (t) => ({ armL: -1.2, armR: 1.2 + Math.sin(t * 14) * 0.25, lean: 0.2 }),
  fenetre: (t) => ({ armL: -0.2, armR: 0.2, lean: -0.04, breathe: Math.sin(t * 1.1) * 0.012 }),
  bebe: (t) => ({ lie: 1, breathe: Math.sin(t * 2.2) * 0.05, armL: -0.9, armR: 0.9 }),
};

/** Quelle pose pour quelle action. Le rendu ne décide rien d'autre. */
export function poseFor(person) {
  const id = person.action?.id ?? 'rien';
  switch (id) {
    case 'dormir': return 'couche';
    case 'insomnie': return 'assis';
    case 'manger': return 'mange';
    case 'cuisiner': return 'cuisine';
    case 'douche': return 'douche';
    case 'menage': return 'menage';
    case 'tv': return 'avachi';
    case 'musique': return 'danse';
    case 'fete':
    case 'invite': return 'danse';
    case 'jeu': return 'assis';
    case 'lire': return 'lecture';
    case 'sport': return 'sport';
    case 'bricoler': return 'bricole';
    case 'teletravail': return 'bureau';
    case 'chercher_emploi': return 'bureau';
    case 'telephoner': return 'telephone';
    case 'espionner': return 'fenetre';
    case 'ruminer': return 'avachi';
    case 'boire': return 'avachi';
    case 'soigner': return 'couche';
    case 'confronter':
    case 'plaindre': return 'colere';
    case 'betise': return 'danse';
    case 'rien': return 'idle';
    default: return 'idle';
  }
}

/** Émotion lisible : ce que le visage doit raconter. */
export function emotionOf(person) {
  const mood = person.mood ?? 60;
  const stress = person.stress ?? 20;
  const act = person.action?.id;
  if (act === 'dormir') return { kind: 'dort', force: 1 };
  if (act === 'confronter' || act === 'plaindre') return { kind: 'colere', force: 1 };
  if (act === 'flirter') return { kind: 'amoureux', force: 0.9 };
  if (act === 'ruminer' || mood < 30) return { kind: 'triste', force: Math.min(1, (45 - mood) / 30) };
  if (stress > 68) return { kind: 'stresse', force: Math.min(1, (stress - 60) / 40) };
  if (mood > 72) return { kind: 'joyeux', force: Math.min(1, (mood - 65) / 35) };
  return { kind: 'neutre', force: 0.3 };
}

// --- Dessin ----------------------------------------------------------------

/**
 * Dessine un habitant.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} person
 * @param {number} x  position au sol
 * @param {number} y  position au sol
 * @param {number} h  hauteur en pixels
 * @param {object} o  { time, facing, silhouette, alpha, lightTint }
 */
export function drawCharacter(ctx, person, x, y, h, o = {}) {
  const look = appearance(person);
  const t = (o.time ?? 0) + person.id * 0.7;
  const poseName = o.pose ?? poseFor(person);
  const pose = (POSES[poseName] ?? POSES.idle)(t);
  const facing = o.facing ?? person.facing ?? 1;
  const silhouette = o.silhouette === true;
  const scale = h * heightFactor(person.age) / 100;

  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.translate(x + (pose.shake ?? 0) * h, y - (pose.bob ?? 0) * h);
  ctx.scale(facing * scale, scale);

  // Repère interne : 100 unités de haut, origine aux pieds.
  const build = look.build;
  const hipY = -42;
  const shoulderY = -78 + (pose.breathe ?? 0) * 100;
  const headR = 14.5;
  const headY = shoulderY - 9 - headR;
  const lean = pose.lean ?? 0;

  const skin = silhouette ? '#000' : look.skin;
  const top = silhouette ? '#000' : look.top;
  const bottom = silhouette ? '#000' : look.bottom;
  const hair = silhouette ? '#000' : look.hair;

  if (pose.lie) {
    drawLying(ctx, person, look, pose, { silhouette, headR, build });
    ctx.restore();
    drawEmoteOverlay(ctx, person, x, y, h, o, poseName);
    return;
  }

  const sitDrop = pose.sit ? 16 : 0;
  const hy = hipY + sitDrop;
  const sy = shoulderY + sitDrop + (pose.slump ? 5 : 0);

  // --- Jambes ---
  const legSpread = 5 * build;
  if (pose.sit) {
    // Assis : cuisses horizontales, tibias verticaux.
    limb(ctx, -legSpread, hy, -legSpread - 15, hy + 2, 7 * build, bottom);
    limb(ctx, legSpread, hy, legSpread - 15, hy + 2, 7 * build, bottom);
    limb(ctx, -legSpread - 15, hy + 2, -legSpread - 15, 0, 6.5 * build, bottom);
    limb(ctx, legSpread - 15, hy + 2, legSpread - 15, 0, 6.5 * build, bottom);
    shoe(ctx, -legSpread - 15, 0, silhouette);
    shoe(ctx, legSpread - 15, 0, silhouette);
  } else {
    const l1 = pose.legL ?? 0;
    const l2 = pose.legR ?? 0;
    const footL = { x: -legSpread + Math.sin(l1) * 26, y: -Math.abs(Math.sin(l1)) * 6 };
    const footR = { x: legSpread + Math.sin(l2) * 26, y: -Math.abs(Math.sin(l2)) * 6 };
    limb(ctx, -legSpread, hy, footL.x, footL.y, 7 * build, bottom);
    limb(ctx, legSpread, hy, footR.x, footR.y, 7 * build, bottom);
    shoe(ctx, footL.x, footL.y, silhouette);
    shoe(ctx, footR.x, footR.y, silhouette);
  }

  // --- Torse ---
  ctx.save();
  ctx.translate(0, hy);
  ctx.rotate(lean * 0.5);
  ctx.translate(0, -hy);
  const torsoW = 20 * build;
  roundRect(ctx, -torsoW / 2, sy, torsoW, hy - sy + 3, 8);
  ctx.fillStyle = top;
  ctx.fill();
  if (!silhouette) {
    // Un pli d'ombre : ça suffit à donner du volume.
    ctx.fillStyle = rgba(shade(top, -0.35), 0.35);
    roundRect(ctx, torsoW / 2 - 6, sy + 2, 6, hy - sy, 4);
    ctx.fill();
  }
  ctx.restore();

  // --- Bras ---
  const armLen = 26 * build;
  const shx = torsoW / 2 - 1;
  drawArm(ctx, -shx, sy + 4, pose.armL ?? -0.2, armLen, top, skin, build, -1);
  drawArm(ctx, shx, sy + 4, pose.armR ?? 0.2, armLen, top, skin, build, 1);

  // --- Tête ---
  ctx.save();
  ctx.translate(0, hy);
  ctx.rotate(lean * 0.5);
  ctx.translate(0, -hy);
  const hx = 0;
  const hyy = headY + sitDrop + (pose.slump ? 6 : 0);

  // Cou : il doit descendre jusque sous la ligne d'épaules, sinon la tête
  // flotte au-dessus du corps.
  ctx.fillStyle = skin;
  roundRect(ctx, -4.5, hyy + headR - 5, 9, (sy + 6) - (hyy + headR - 5), 3);
  ctx.fill();

  // Crâne
  ctx.beginPath();
  ctx.ellipse(hx, hyy, headR * 0.94, headR, 0, 0, Math.PI * 2);
  ctx.fillStyle = skin;
  ctx.fill();

  if (!silhouette) {
    drawFace(ctx, person, look, hx, hyy, headR, t, poseName);
  }
  drawHair(ctx, look, hx, hyy, headR, silhouette, person.age);
  ctx.restore();

  ctx.restore();
  drawEmoteOverlay(ctx, person, x, y, h, o, poseName);
}

function drawArm(ctx, sx, sy, angle, len, sleeve, skin, build, side) {
  const ex = sx + Math.sin(angle) * len * side * -1 * (side === 1 ? -1 : 1);
  // Bras en deux segments pour une silhouette moins raide.
  const a = angle;
  const midX = sx + Math.sin(a) * len * 0.55;
  const midY = sy + Math.cos(a) * len * 0.55;
  const endX = midX + Math.sin(a * 0.6) * len * 0.5;
  const endY = midY + Math.cos(a * 0.6) * len * 0.5;
  limb(ctx, sx, sy, midX, midY, 6 * build, sleeve);
  limb(ctx, midX, midY, endX, endY, 5 * build, skin);
  ctx.beginPath();
  ctx.arc(endX, endY, 3.4 * build, 0, Math.PI * 2);
  ctx.fillStyle = skin;
  ctx.fill();
}

function limb(ctx, x1, y1, x2, y2, w, color) {
  ctx.beginPath();
  ctx.lineCap = 'round';
  ctx.lineWidth = w;
  ctx.strokeStyle = color;
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function shoe(ctx, x, y, silhouette) {
  ctx.beginPath();
  ctx.ellipse(x + 1.5, y - 1, 5.5, 3, 0, 0, Math.PI * 2);
  ctx.fillStyle = silhouette ? '#000' : PALETTE.frameDark;
  ctx.fill();
}

function drawHair(ctx, look, x, y, r, silhouette, age) {
  ctx.fillStyle = silhouette ? '#000' : look.hair;
  const s = look.hairStyle;
  ctx.beginPath();
  switch (s) {
    case 0: // court
      ctx.ellipse(x, y - r * 0.35, r * 0.98, r * 0.72, 0, Math.PI, Math.PI * 2);
      break;
    case 1: // carré : calotte + deux pans sur les côtés, jamais sur le visage
      ctx.ellipse(x, y - r * 0.2, r * 1.05, r * 0.9, 0, Math.PI * 0.98, Math.PI * 2.02);
      ctx.rect(x - r * 1.05, y - r * 0.2, r * 0.42, r * 1.15);
      ctx.rect(x + r * 0.63, y - r * 0.2, r * 0.42, r * 1.15);
      break;
    case 2: // chignon
      ctx.ellipse(x, y - r * 0.3, r * 0.98, r * 0.78, 0, Math.PI, Math.PI * 2);
      ctx.moveTo(x, y - r * 1.35);
      ctx.arc(x + r * 0.1, y - r * 1.25, r * 0.4, 0, Math.PI * 2);
      break;
    case 3: // frisé
      for (let i = 0; i < 7; i++) {
        const a = Math.PI + (i / 6) * Math.PI;
        ctx.moveTo(x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9);
        ctx.arc(x + Math.cos(a) * r * 0.85, y + Math.sin(a) * r * 0.85, r * 0.34, 0, Math.PI * 2);
      }
      break;
    case 4: // long
      ctx.ellipse(x, y - r * 0.25, r * 1.02, r * 0.85, 0, Math.PI, Math.PI * 2);
      ctx.rect(x - r * 1.02, y - r * 0.25, r * 0.36, r * 1.7);
      ctx.rect(x + r * 0.66, y - r * 0.25, r * 0.36, r * 1.7);
      break;
    case 5: // dégarni
      ctx.ellipse(x, y - r * 0.1, r * 0.98, r * 0.5, 0, Math.PI * 1.15, Math.PI * 1.85);
      break;
    default: // banane
      ctx.ellipse(x, y - r * 0.4, r * 0.95, r * 0.8, 0, Math.PI, Math.PI * 2);
      ctx.moveTo(x - r * 0.9, y - r * 0.6);
      ctx.quadraticCurveTo(x, y - r * 1.7, x + r * 0.9, y - r * 0.7);
      break;
  }
  ctx.fill();
}

function drawFace(ctx, person, look, x, y, r, t, poseName) {
  const emo = emotionOf(person);
  const asleep = emo.kind === 'dort' || poseName === 'couche';

  // Clignement : chacun le sien, sinon l'immeuble clignote en rythme.
  const blinkCycle = 3 + (person.id % 5) * 0.7;
  const blink = !asleep && ((t % blinkCycle) < 0.12);

  const eyeY = y - r * 0.05;
  const eyeDx = r * 0.36;
  const eyeR = r * 0.19;

  // Sourcils : l'outil d'expression numéro un.
  let browInner = 0;
  let browOuter = 0;
  let browLift = 0;
  switch (emo.kind) {
    case 'colere': browInner = -0.5; browOuter = 0.25; browLift = -0.1; break;
    case 'triste': browInner = 0.45; browOuter = -0.15; browLift = 0.05; break;
    case 'stresse': browInner = 0.3; browOuter = 0.15; browLift = -0.12; break;
    case 'joyeux': browInner = -0.05; browOuter = -0.2; browLift = 0.12; break;
    case 'amoureux': browInner = 0.15; browOuter = -0.2; browLift = 0.15; break;
    default: break;
  }

  ctx.strokeStyle = shade(look.hair, -0.15);
  ctx.lineWidth = r * 0.13;
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    const bx = x + side * eyeDx;
    const by = eyeY - r * 0.42 - browLift * r;
    ctx.beginPath();
    ctx.moveTo(bx - r * 0.2, by + side * browInner * r * 0.28 * (side === -1 ? 1 : -1) * -1);
    ctx.lineTo(bx + r * 0.22, by + browOuter * r * 0.25);
    ctx.stroke();
  }

  // Yeux
  if (asleep || blink) {
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = r * 0.1;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(x + side * eyeDx, eyeY, eyeR * 0.9, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    }
  } else {
    for (const side of [-1, 1]) {
      const ex = x + side * eyeDx;
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, eyeR, eyeR * 1.05, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#fbf6ef';
      ctx.fill();
      // La pupille regarde légèrement dans la direction du mouvement.
      const look2 = Math.sin(t * 0.6 + person.id) * eyeR * 0.3;
      ctx.beginPath();
      ctx.arc(ex + look2, eyeY + (emo.kind === 'triste' ? eyeR * 0.2 : 0), eyeR * 0.52, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.ink;
      ctx.fill();
      if (emo.kind === 'amoureux') {
        ctx.beginPath();
        ctx.arc(ex + look2 - eyeR * 0.18, eyeY - eyeR * 0.2, eyeR * 0.17, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
      }
    }
  }

  if (look.glasses) {
    ctx.strokeStyle = rgba(PALETTE.ink, 0.7);
    ctx.lineWidth = r * 0.07;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(x + side * eyeDx, eyeY, eyeR * 1.35, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(x - eyeDx + eyeR * 1.35, eyeY);
    ctx.lineTo(x + eyeDx - eyeR * 1.35, eyeY);
    ctx.stroke();
  }

  // Nez : trois variantes, ça suffit à différencier les visages.
  ctx.strokeStyle = rgba(shade(look.skin, -0.4), 0.75);
  ctx.lineWidth = r * 0.09;
  ctx.beginPath();
  if (look.nose === 0) {
    ctx.moveTo(x, eyeY + r * 0.18);
    ctx.lineTo(x - r * 0.06, eyeY + r * 0.4);
  } else if (look.nose === 1) {
    ctx.arc(x, eyeY + r * 0.32, r * 0.11, Math.PI * 0.1, Math.PI * 0.95);
  } else {
    ctx.moveTo(x - r * 0.05, eyeY + r * 0.14);
    ctx.quadraticCurveTo(x + r * 0.14, eyeY + r * 0.33, x - r * 0.04, eyeY + r * 0.42);
  }
  ctx.stroke();

  // Bouche
  const mouthY = y + r * 0.52;
  ctx.strokeStyle = '#8a4a3f';
  ctx.lineWidth = r * 0.12;
  ctx.beginPath();
  if (asleep) {
    ctx.ellipse(x, mouthY, r * 0.13, r * 0.16, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#8a4a3f';
    ctx.fill();
  } else if (emo.kind === 'colere') {
    ctx.moveTo(x - r * 0.3, mouthY + r * 0.16);
    ctx.quadraticCurveTo(x, mouthY - r * 0.16, x + r * 0.3, mouthY + r * 0.16);
    ctx.stroke();
  } else if (emo.kind === 'triste') {
    ctx.moveTo(x - r * 0.26, mouthY + r * 0.14);
    ctx.quadraticCurveTo(x, mouthY - r * 0.1, x + r * 0.26, mouthY + r * 0.14);
    ctx.stroke();
  } else if (emo.kind === 'joyeux' || emo.kind === 'amoureux') {
    ctx.moveTo(x - r * 0.32, mouthY - r * 0.1);
    ctx.quadraticCurveTo(x, mouthY + r * 0.34, x + r * 0.32, mouthY - r * 0.1);
    ctx.stroke();
  } else if (emo.kind === 'stresse') {
    ctx.moveTo(x - r * 0.26, mouthY);
    ctx.lineTo(x + r * 0.26, mouthY + r * 0.06);
    ctx.stroke();
  } else {
    ctx.moveTo(x - r * 0.22, mouthY);
    ctx.quadraticCurveTo(x, mouthY + r * 0.12, x + r * 0.22, mouthY);
    ctx.stroke();
  }

  if (look.beard) {
    ctx.fillStyle = rgba(look.hair, 0.85);
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.55, r * 0.62, r * 0.45, 0, 0, Math.PI);
    ctx.fill();
  }

  // Rougeur amoureuse.
  if (emo.kind === 'amoureux' || (emo.kind === 'joyeux' && emo.force > 0.7)) {
    ctx.fillStyle = 'rgba(220,110,110,0.32)';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(x + side * r * 0.62, y + r * 0.28, r * 0.22, r * 0.14, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawLying(ctx, person, look, pose, { silhouette, headR, build }) {
  // Couché : on tourne la marionnette et on la pose sur le côté.
  const skin = silhouette ? '#000' : look.skin;
  const top = silhouette ? '#000' : look.top;
  const bottom = silhouette ? '#000' : look.bottom;
  const y = -12;
  ctx.save();
  // Corps
  roundRect(ctx, -30, y - 9 * build, 44, 18 * build, 9);
  ctx.fillStyle = top;
  ctx.fill();
  roundRect(ctx, 8, y - 7 * build, 30, 14 * build, 7);
  ctx.fillStyle = bottom;
  ctx.fill();
  // Tête
  ctx.beginPath();
  ctx.ellipse(-38, y - 4 + (pose.breathe ?? 0) * 40, headR, headR * 0.95, 0, 0, Math.PI * 2);
  ctx.fillStyle = skin;
  ctx.fill();
  if (!silhouette) {
    // Profil endormi : deux traits et c'est déjà touchant.
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(-42, y - 6, 3, Math.PI * 0.1, Math.PI * 0.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-40, y + 3, 2, 0, Math.PI * 2);
    ctx.fillStyle = '#8a4a3f';
    ctx.fill();
  }
  ctx.fillStyle = silhouette ? '#000' : look.hair;
  ctx.beginPath();
  ctx.ellipse(-40, y - 12, headR * 0.85, headR * 0.5, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Bulles, ZZZ, gouttes de sueur, notes de musique : au-dessus de la tête. */
function drawEmoteOverlay(ctx, person, x, y, h, o, poseName) {
  if (o.silhouette) return;
  const t = (o.time ?? 0) + person.id;
  const topY = y - h * (poseName === 'couche' ? 0.35 : 0.95);
  const emo = emotionOf(person);

  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;

  if (emo.kind === 'dort') {
    ctx.fillStyle = rgba('#ffffff', 0.75);
    ctx.font = `${Math.round(h * 0.13)}px "Trebuchet MS", sans-serif`;
    for (let i = 0; i < 3; i++) {
      const p = ((t * 0.35 + i * 0.33) % 1);
      ctx.globalAlpha = (o.alpha ?? 1) * (1 - p) * 0.8;
      ctx.fillText('z', x + h * 0.16 + p * h * 0.14, topY - p * h * 0.3);
    }
  } else if (emo.kind === 'stresse') {
    ctx.fillStyle = 'rgba(150,205,235,0.9)';
    const p = (t * 0.8) % 1;
    ctx.beginPath();
    ctx.ellipse(x + h * 0.12, topY + h * 0.06 + p * h * 0.1, h * 0.018, h * 0.028, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (emo.kind === 'colere') {
    ctx.strokeStyle = '#c0392b';
    ctx.lineWidth = Math.max(1, h * 0.012);
    const cx = x + h * 0.13;
    const cy = topY + h * 0.05;
    for (let i = 0; i < 2; i++) {
      const a = i * Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * h * 0.03, cy + Math.sin(a) * h * 0.03);
      ctx.lineTo(cx - Math.cos(a) * h * 0.03, cy - Math.sin(a) * h * 0.03);
      ctx.stroke();
    }
  } else if (emo.kind === 'amoureux') {
    const p = (t * 0.5) % 1;
    ctx.globalAlpha = (o.alpha ?? 1) * (1 - p);
    drawHeart(ctx, x + h * 0.13, topY - p * h * 0.25, h * 0.05, '#e0607a');
  }

  if (person.action?.def?.music || person.action?.id === 'musique') {
    ctx.globalAlpha = o.alpha ?? 1;
    ctx.fillStyle = '#e08fb0';
    ctx.font = `${Math.round(h * 0.16)}px serif`;
    for (let i = 0; i < 2; i++) {
      const p = ((t * 0.5 + i * 0.5) % 1);
      ctx.globalAlpha = (o.alpha ?? 1) * (1 - p) * 0.9;
      ctx.fillText(i ? '♫' : '♪', x - h * 0.2 - p * h * 0.1, topY - p * h * 0.28);
    }
  }
  ctx.restore();
}

export function drawHeart(ctx, x, y, r, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.7);
  ctx.bezierCurveTo(x - r * 1.4, y - r * 0.5, x - r * 0.3, y - r * 1.2, x, y - r * 0.4);
  ctx.bezierCurveTo(x + r * 0.3, y - r * 1.2, x + r * 1.4, y - r * 0.5, x, y + r * 0.7);
  ctx.fill();
  ctx.restore();
}

/** Bulle de dialogue, dessinée dans le repère écran. */
export function drawSpeech(ctx, text, x, y, maxWidth, scale = 1) {
  if (!text) return;
  const fs = Math.max(9, 13 * scale);
  ctx.save();
  ctx.font = `${fs}px "Trebuchet MS", "Segoe UI", sans-serif`;
  const words = String(text).split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);

  const pad = fs * 0.5;
  const lh = fs * 1.25;
  const w = Math.min(maxWidth, Math.max(...lines.map((l) => ctx.measureText(l).width))) + pad * 2;
  const hh = lines.length * lh + pad * 1.6;
  const bx = x - w / 2;
  const by = y - hh;

  ctx.fillStyle = 'rgba(252,247,238,0.96)';
  ctx.strokeStyle = 'rgba(60,40,28,0.45)';
  ctx.lineWidth = Math.max(1, scale);
  roundRect(ctx, bx, by, w, hh, fs * 0.55);
  ctx.fill();
  ctx.stroke();
  // Petite queue de bulle.
  ctx.beginPath();
  ctx.moveTo(x - fs * 0.35, by + hh - 1);
  ctx.lineTo(x, by + hh + fs * 0.6);
  ctx.lineTo(x + fs * 0.35, by + hh - 1);
  ctx.closePath();
  ctx.fillStyle = 'rgba(252,247,238,0.96)';
  ctx.fill();

  ctx.fillStyle = '#3a2a1e';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((l, i) => {
    ctx.fillText(l, x, by + pad * 0.8 + lh * (i + 0.5));
  });
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
