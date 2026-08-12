// Les habitants, dessinés.
//
// Direction : animation urbaine française. Traits d'encre épais, aplats
// francs, une seule ombre portée par volume, et des proportions assumées —
// membres longs et fins, mains larges et bavardes, mâchoires marquées, nez
// caractériels. Personne n'est joli, tout le monde est reconnaissable.
//
// Ce fichier ne décide de rien : il reçoit des articulations déjà lissées
// par anim.js et il les dessine.

import { PALETTE, pickStable, shade, rgba, mixHex } from './palette.js';
import { updateRig, POSES, poseFor, applySpeech } from './anim.js';

const INK = '#241a13';
const LINE = 2.5;          // épaisseur du trait, en unités locales
const UNITS = 105;         // hauteur du pantin dans son repère

// --- Apparence --------------------------------------------------------------

export function appearance(person) {
  if (person._look) return person._look;
  const id = person.id;
  const naturalHair = PALETTE.hair.filter((c) => !['#a8a29c', '#d8d4ce'].includes(c));
  const look = {
    skin: pickStable(PALETTE.skin, `peau${id}`),
    hair: pickStable(person.age > 55 ? PALETTE.hair : naturalHair, `cheveux${id}`),
    top: pickStable(PALETTE.clothes, `haut${id}`),
    bottom: pickStable(PALETTE.clothes, `bas${id * 7 + 3}`),
    hairStyle: hashPick(id * 13 + 5, 7),
    build: 0.82 + (hashPick(id * 3 + 1, 100) / 100) * 0.4,
    // Le visage : c'est là que se joue la ressemblance.
    jaw: hashPick(id * 31 + 4, 3),        // 0 carré, 1 pointu, 2 lourd
    nose: hashPick(id * 23 + 11, 4),      // 0 long, 1 busqué, 2 rond, 3 retroussé
    ears: hashPick(id * 41 + 9, 3),
    glasses: hashPick(id * 17 + 2, 100) < 18,
    shades: hashPick(id * 53 + 6, 100) < 14 && person.age > 14,
    cap: hashPick(id * 61 + 3, 100) < 22 && person.age < 62,
    beard: person.gender === 'm' && person.age > 22 && hashPick(id * 19 + 7, 100) < 42,
    stubble: person.gender === 'm' && person.age > 19 && hashPick(id * 71 + 5, 100) < 45,
  };
  if (person.age > 62 && hashPick(id * 29, 100) < 75) {
    look.hair = person.age > 75 ? '#ded9d2' : '#b0aaa2';
  }
  look.capColor = pickStable(PALETTE.clothes, `casquette${id}`);
  person._look = look;
  return look;
}

function hashPick(seed, mod) {
  let h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  return (h >>> 0) % mod;
}

export function heightFactor(age) {
  if (age < 1) return 0.34;
  if (age < 6) return 0.44 + age * 0.032;
  if (age < 14) return 0.62 + (age - 6) * 0.036;
  if (age < 18) return 0.91 + (age - 14) * 0.022;
  if (age > 74) return 0.94;
  return 1;
}

/** Ce que le visage doit raconter, en un mot. */
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

// --- Outils de trait --------------------------------------------------------

function ink(ctx, w = LINE) {
  ctx.strokeStyle = INK;
  ctx.lineWidth = w;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
}

/** Remplit puis encre : l'ordre qui donne le look « dessin animé ». */
function paint(ctx, color, outline = true, w = LINE) {
  ctx.fillStyle = color;
  ctx.fill();
  if (outline) {
    ink(ctx, w);
    ctx.stroke();
  }
}

/** Membre : un tronc de cône encré, plus lisible qu'une simple ligne. */
function limb(ctx, x1, y1, x2, y2, w1, w2, color, outline = true) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  ctx.beginPath();
  ctx.moveTo(x1 + nx * w1, y1 + ny * w1);
  ctx.lineTo(x2 + nx * w2, y2 + ny * w2);
  ctx.arc(x2, y2, w2, Math.atan2(ny, nx), Math.atan2(-ny, -nx), true);
  ctx.lineTo(x1 - nx * w1, y1 - ny * w1);
  ctx.arc(x1, y1, w1, Math.atan2(-ny, -nx), Math.atan2(ny, nx), true);
  ctx.closePath();
  paint(ctx, color, outline);
}

/**
 * Une main.
 *
 * C'est le détail qui change tout : dans ce style, les mains parlent autant
 * que les visages. Paume large, doigts longs qui s'écartent selon
 * l'ouverture, pouce à part.
 */
function drawHand(ctx, x, y, angle, open, skin, size, outline = true) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const s = size;
  const spread = 0.3 + open * 0.62;

  // Un seul chemin pour toute la main : paume + doigts + pouce. On encre
  // d'abord d'un trait épais, puis on remplit par-dessus — le trait ne
  // subsiste qu'au pourtour, et la main garde une silhouette nette au lieu
  // d'être une moufle avec des coutures.
  ctx.beginPath();
  const capsule = (ax, ay, bx, by, w) => {
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * w;
    const ny = (dx / len) * w;
    ctx.moveTo(ax + nx, ay + ny);
    ctx.lineTo(bx + nx, by + ny);
    ctx.arc(bx, by, w, Math.atan2(ny, nx), Math.atan2(-ny, -nx), true);
    ctx.lineTo(ax - nx, ay - ny);
    ctx.arc(ax, ay, w, Math.atan2(-ny, -nx), Math.atan2(ny, nx), true);
    ctx.closePath();
  };

  // Quatre doigts en éventail. L'index et l'auriculaire sont plus courts.
  for (let i = 0; i < 4; i++) {
    const a = (i - 1.5) * spread * 0.44 - Math.PI / 2;
    const len = s * (i === 0 || i === 3 ? 1.55 : 1.95);
    const knuckleX = Math.cos(a) * s * 0.5;
    const knuckleY = Math.sin(a) * s * 0.5 + s * 0.1;
    capsule(knuckleX, knuckleY, Math.cos(a) * len, Math.sin(a) * len + s * 0.1, s * 0.24);
  }
  // Pouce, écarté à l'opposé.
  const ta = -Math.PI / 2 - (0.95 + open * 0.55);
  capsule(0, s * 0.2, Math.cos(ta) * s * 1.15, Math.sin(ta) * s * 0.8 + s * 0.2, s * 0.27);
  // Paume.
  ctx.moveTo(s * 0.72, s * 0.15);
  ctx.ellipse(0, s * 0.15, s * 0.72, s * 0.8, 0, 0, Math.PI * 2);

  if (outline) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = LINE * 1.9;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  ctx.fillStyle = skin;
  ctx.fill();
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

// --- Le pantin --------------------------------------------------------------

/**
 * Dessine un habitant.
 * @param {object} o { time, dt, facing, silhouette, alpha, pose }
 */
export function drawCharacter(ctx, person, x, y, h, o = {}) {
  const look = appearance(person);
  const t = (o.time ?? 0) + person.id * 0.7;
  const silhouette = o.silhouette === true;

  const poseName = o.pose ?? poseFor(person);
  const poseFn = POSES[poseName] ?? POSES.idle;
  const emo = emotionOf(person);
  const c = updateRig(person, poseName, poseFn, t, o.dt ?? 1 / 60, emo);
  applySpeech(c, person, t);

  const facing = o.facing ?? person.facing ?? 1;
  const scale = (h * heightFactor(person.age)) / UNITS;

  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.translate(x, y - c.bob * h);
  ctx.scale(facing * scale, scale);

  if (c.lie > 0.5) {
    drawLying(ctx, person, look, c, t, silhouette);
    ctx.restore();
    drawEmotes(ctx, person, x, y, h, o, true);
    return;
  }

  const B = look.build;
  const sit = c.sit;
  const drop = sit * 17;
  const hipY = -46 + drop;
  const shoulderY = (-78 + drop * 0.9) * c.squash;
  const headR = 12 * (0.9 + B * 0.12);
  const headY = shoulderY - 8 - headR;
  const torsoW = 17 * B;
  const skin = silhouette ? INK : look.skin;
  const top = silhouette ? INK : look.top;
  const bottom = silhouette ? INK : look.bottom;

  // --- Jambes ---
  const spread = 4.5 * B;
  if (sit > 0.5) {
    for (const side of [-1, 1]) {
      const kx = side * spread - 15;
      limb(ctx, side * spread, hipY, kx, hipY + 3, 6 * B, 5.5 * B, bottom, !silhouette);
      limb(ctx, kx, hipY + 3, kx - 1, 0, 5.5 * B, 4.6 * B, bottom, !silhouette);
      shoe(ctx, kx - 1, 0, side, silhouette);
    }
  } else {
    for (const [side, ang] of [[-1, c.legL], [1, c.legR]]) {
      const hx = side * spread;
      // Genou légèrement en avant : une jambe droite fait pantin de bois.
      const kx = hx + Math.sin(ang) * 15;
      const ky = hipY + (0 - hipY) * 0.52 - Math.abs(Math.sin(ang)) * 3;
      const fx = hx + Math.sin(ang) * 27;
      const fy = -Math.abs(Math.sin(ang)) * 7;
      limb(ctx, hx, hipY, kx, ky, 6.2 * B, 5 * B, bottom, !silhouette);
      limb(ctx, kx, ky, fx, fy, 5 * B, 4.2 * B, bottom, !silhouette);
      shoe(ctx, fx, fy, side, silhouette);
    }
  }

  // --- Buste ---
  ctx.save();
  ctx.translate(0, hipY);
  ctx.rotate(c.lean * 0.55 + c.twist * 0.2);
  ctx.translate(0, -hipY);

  const sy = shoulderY;
  ctx.beginPath();
  // Un buste en trapèze : épaules larges, taille étroite.
  ctx.moveTo(-torsoW * 0.52, sy + 2);
  ctx.quadraticCurveTo(-torsoW * 0.62, (sy + hipY) / 2, -torsoW * 0.4, hipY + 3);
  ctx.lineTo(torsoW * 0.4, hipY + 3);
  ctx.quadraticCurveTo(torsoW * 0.62, (sy + hipY) / 2, torsoW * 0.52, sy + 2);
  ctx.quadraticCurveTo(0, sy - 4, -torsoW * 0.52, sy + 2);
  ctx.closePath();
  paint(ctx, top, !silhouette);

  if (!silhouette) {
    // Ombre portée : un seul aplat, du côté opposé à la fenêtre.
    ctx.save();
    ctx.clip();
    ctx.fillStyle = rgba(shade(top, -0.42), 0.42);
    ctx.beginPath();
    ctx.moveTo(torsoW * 0.06, sy - 6);
    ctx.lineTo(torsoW * 0.7, sy - 6);
    ctx.lineTo(torsoW * 0.7, hipY + 6);
    ctx.lineTo(torsoW * 0.22, hipY + 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  // --- Bras ---
  const shx = torsoW * 0.46;
  const shy = sy + 5;
  drawArm(ctx, -shx, shy, c.armL, c.elbowL, c.handL, B, top, skin, silhouette);
  drawArm(ctx, shx, shy, c.armR, c.elbowR, c.handR, B, top, skin, silhouette);

  // --- Tête ---
  ctx.save();
  ctx.translate(0, hipY);
  ctx.rotate(c.lean * 0.55);
  ctx.translate(0, -hipY);
  ctx.translate(0, headY);
  ctx.rotate(c.headTilt * 0.5);

  // Cou : franc et un peu long, il tient la silhouette.
  ctx.beginPath();
  ctx.moveTo(-4 * B, headR * 0.55);
  ctx.lineTo(-3.4 * B, sy - headY + 4);
  ctx.lineTo(3.4 * B, sy - headY + 4);
  ctx.lineTo(4 * B, headR * 0.55);
  ctx.closePath();
  paint(ctx, skin, !silhouette);

  drawHead(ctx, person, look, c, headR, t, silhouette);
  ctx.restore();

  ctx.restore();
  drawEmotes(ctx, person, x, y, h, o, false);
}

function drawArm(ctx, sx, sy, shoulder, elbow, open, B, sleeve, skin, silhouette) {
  const upper = 20 * B;
  const fore = 19 * B;
  const ex = sx + Math.sin(shoulder) * upper;
  const ey = sy + Math.cos(shoulder) * upper;
  const wristA = shoulder + elbow;
  const wx = ex + Math.sin(wristA) * fore;
  const wy = ey + Math.cos(wristA) * fore;

  limb(ctx, sx, sy, ex, ey, 5.4 * B, 4.2 * B, sleeve, !silhouette);
  limb(ctx, ex, ey, wx, wy, 4.2 * B, 3.4 * B, skin, !silhouette);
  // Des mains larges : dans ce style elles portent autant que les visages.
  drawHand(ctx, wx, wy, wristA + Math.PI, open, skin, 6.2 * B, !silhouette);
}

function shoe(ctx, x, y, side, silhouette) {
  ctx.beginPath();
  ctx.moveTo(x - 4.5 * side, y - 4.5);
  ctx.quadraticCurveTo(x - 5.5 * side, y + 1.5, x + 4 * side, y + 1.5);
  ctx.quadraticCurveTo(x + 9 * side, y + 1, x + 8.5 * side, y - 2);
  ctx.quadraticCurveTo(x + 6 * side, y - 5, x + 3 * side, y - 5);
  ctx.closePath();
  paint(ctx, silhouette ? INK : PALETTE.frameDark, !silhouette);
}

// --- Tête et visage ---------------------------------------------------------

function drawHead(ctx, person, look, c, r, t, silhouette) {
  const skin = silhouette ? INK : look.skin;
  const turn = Math.max(-1, Math.min(1, c.headTurn));
  const tx = turn * r * 0.16;

  // Crâne + mâchoire : une seule silhouette, pas un rond.
  ctx.beginPath();
  ctx.moveTo(-r * 0.95, -r * 0.15);
  ctx.quadraticCurveTo(-r * 1.0, -r * 1.05, 0, -r * 1.05);
  ctx.quadraticCurveTo(r * 1.0, -r * 1.05, r * 0.95, -r * 0.15);
  if (look.jaw === 0) {          // carrée
    ctx.quadraticCurveTo(r * 0.95, r * 0.75, r * 0.55, r * 0.95);
    ctx.lineTo(-r * 0.5, r * 0.95);
    ctx.quadraticCurveTo(-r * 0.95, r * 0.75, -r * 0.95, -r * 0.15);
  } else if (look.jaw === 1) {   // pointue
    ctx.quadraticCurveTo(r * 0.85, r * 0.7, 0, r * 1.1);
    ctx.quadraticCurveTo(-r * 0.85, r * 0.7, -r * 0.95, -r * 0.15);
  } else {                       // lourde
    ctx.quadraticCurveTo(r * 1.05, r * 0.95, r * 0.35, r * 1.05);
    ctx.lineTo(-r * 0.3, r * 1.05);
    ctx.quadraticCurveTo(-r * 1.05, r * 0.95, -r * 0.95, -r * 0.15);
  }
  ctx.closePath();
  paint(ctx, skin, !silhouette);

  if (silhouette) {
    drawHair(ctx, look, r, true);
    return;
  }

  // Ombre du visage, côté opposé à la lumière.
  ctx.save();
  ctx.clip();
  ctx.fillStyle = rgba(shade(look.skin, -0.4), 0.3);
  ctx.beginPath();
  ctx.moveTo(r * 0.25, -r * 1.2);
  ctx.lineTo(r * 1.2, -r * 1.2);
  ctx.lineTo(r * 1.2, r * 1.3);
  ctx.lineTo(r * 0.55, r * 1.3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Oreilles, avant les cheveux.
  if (look.ears < 2) {
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(side * r * 0.98, r * 0.05, r * 0.14, r * 0.24, 0, 0, Math.PI * 2);
      paint(ctx, skin, true, LINE * 0.8);
    }
  }

  const eyeY = -r * 0.1;
  const eyeDx = r * 0.38;
  const open = Math.max(0, Math.min(1, c.eye));

  // --- Sourcils : le premier outil d'expression ---
  ctx.save();
  ctx.strokeStyle = shade(look.hair, -0.2);
  ctx.lineWidth = r * 0.17;
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    const bx = tx + side * eyeDx;
    const by = eyeY - r * 0.44 - c.brow * r * 0.13;
    const inner = c.browInner * r * 0.2;
    ctx.beginPath();
    ctx.moveTo(bx - side * r * 0.24, by + inner);
    ctx.quadraticCurveTo(bx, by - r * 0.06, bx + side * r * 0.24, by - inner * 0.3);
    ctx.stroke();
  }
  ctx.restore();

  // --- Yeux ---
  if (look.shades) {
    drawShades(ctx, r, tx, eyeY);
  } else {
    for (const side of [-1, 1]) {
      const ex = tx + side * eyeDx;
      if (open < 0.12) {
        ctx.beginPath();
        ctx.moveTo(ex - r * 0.2, eyeY);
        ctx.quadraticCurveTo(ex, eyeY + r * 0.14, ex + r * 0.2, eyeY);
        ink(ctx, r * 0.1);
        ctx.stroke();
        continue;
      }
      const eh = r * 0.2 * open;
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, r * 0.2, eh, 0, 0, Math.PI * 2);
      paint(ctx, '#fbf7f0', true, LINE * 0.7);
      // Pupille : elle suit le regard, elle ne reste jamais plein centre.
      const px = ex + turn * r * 0.09;
      ctx.beginPath();
      ctx.arc(px, eyeY + (c.browInner > 0.5 ? eh * 0.25 : 0), r * 0.105 * Math.min(1, open * 1.6), 0, Math.PI * 2);
      ctx.fillStyle = INK;
      ctx.fill();
      // Paupière supérieure lourde : ça vieillit et ça caractérise.
      ctx.beginPath();
      ctx.moveTo(ex - r * 0.22, eyeY - eh * 0.55);
      ctx.quadraticCurveTo(ex, eyeY - eh * 1.25, ex + r * 0.22, eyeY - eh * 0.55);
      ink(ctx, r * 0.075);
      ctx.stroke();
    }
    if (look.glasses) drawGlasses(ctx, r, tx, eyeY, eyeDx);
  }

  drawNose(ctx, look, r, tx, eyeY);
  drawMouth(ctx, look, c, r, tx);

  if (look.stubble && !look.beard) {
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = look.hair;
    ctx.beginPath();
    ctx.ellipse(tx * 0.5, r * 0.6, r * 0.72, r * 0.42, 0, 0, Math.PI);
    ctx.fill();
    ctx.restore();
  }
  if (look.beard) {
    ctx.beginPath();
    ctx.moveTo(-r * 0.8, r * 0.15);
    ctx.quadraticCurveTo(-r * 0.6, r * 1.5, 0, r * 1.5);
    ctx.quadraticCurveTo(r * 0.6, r * 1.5, r * 0.8, r * 0.15);
    ctx.quadraticCurveTo(r * 0.4, r * 0.6, 0, r * 0.6);
    ctx.quadraticCurveTo(-r * 0.4, r * 0.6, -r * 0.8, r * 0.15);
    ctx.closePath();
    paint(ctx, look.hair, true, LINE * 0.8);
  }

  drawHair(ctx, look, r, false);

  if ((emotionOf(person).kind === 'amoureux') || (person.mood > 80)) {
    ctx.fillStyle = 'rgba(214,102,102,0.3)';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(tx + side * r * 0.66, r * 0.3, r * 0.22, r * 0.13, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawNose(ctx, look, r, tx, eyeY) {
  const nx = tx * 1.4;
  const ny = eyeY + r * 0.14;
  ctx.beginPath();
  switch (look.nose) {
    case 0: // long et droit
      ctx.moveTo(nx, ny);
      ctx.lineTo(nx + r * 0.12, ny + r * 0.42);
      ctx.quadraticCurveTo(nx + r * 0.02, ny + r * 0.5, nx - r * 0.12, ny + r * 0.44);
      break;
    case 1: // busqué
      ctx.moveTo(nx - r * 0.04, ny - r * 0.02);
      ctx.quadraticCurveTo(nx + r * 0.3, ny + r * 0.2, nx + r * 0.14, ny + r * 0.46);
      ctx.quadraticCurveTo(nx, ny + r * 0.52, nx - r * 0.14, ny + r * 0.42);
      break;
    case 2: // rond
      ctx.ellipse(nx, ny + r * 0.3, r * 0.19, r * 0.17, 0, 0, Math.PI * 2);
      break;
    default: // retroussé
      ctx.moveTo(nx, ny + r * 0.05);
      ctx.quadraticCurveTo(nx + r * 0.2, ny + r * 0.3, nx + r * 0.04, ny + r * 0.36);
      ctx.quadraticCurveTo(nx - r * 0.1, ny + r * 0.3, nx - r * 0.1, ny + r * 0.36);
      break;
  }
  ctx.fillStyle = rgba(shade(look.skin, -0.28), 0.95);
  ctx.fill();
  ink(ctx, r * 0.075);
  ctx.stroke();
}

function drawMouth(ctx, look, c, r, tx) {
  const my = r * 0.55;
  const curve = c.mouth;
  const openAmt = Math.max(0, c.mouthOpen);
  const w = r * 0.36;

  if (openAmt > 0.12) {
    // Bouche ouverte : on voit l'intérieur, et les dents si ça sourit.
    const oh = r * 0.14 + openAmt * r * 0.3;
    ctx.beginPath();
    ctx.moveTo(tx - w, my - curve * r * 0.1);
    ctx.quadraticCurveTo(tx, my + curve * r * 0.22 + oh, tx + w, my - curve * r * 0.1);
    ctx.quadraticCurveTo(tx, my + curve * r * 0.1 - oh * 0.25, tx - w, my - curve * r * 0.1);
    ctx.closePath();
    paint(ctx, '#6d2f2f', true, r * 0.08);
    if (curve > 0.4) {
      ctx.save();
      ctx.clip();
      ctx.fillStyle = '#f6f1e6';
      ctx.fillRect(tx - w, my - curve * r * 0.16 - oh * 0.3, w * 2, oh * 0.5);
      ctx.restore();
    }
  } else {
    ctx.beginPath();
    ctx.moveTo(tx - w, my - curve * r * 0.12);
    ctx.quadraticCurveTo(tx, my + curve * r * 0.34, tx + w, my - curve * r * 0.12);
    ink(ctx, r * 0.11);
    ctx.stroke();
  }
}

function drawShades(ctx, r, tx, eyeY) {
  // Lunettes de soleil : deux verres larges reliés, très présents.
  ctx.beginPath();
  roundRect(ctx, tx - r * 0.92, eyeY - r * 0.3, r * 0.78, r * 0.5, r * 0.16);
  paint(ctx, '#20252e', true, LINE * 0.8);
  ctx.beginPath();
  roundRect(ctx, tx + r * 0.14, eyeY - r * 0.3, r * 0.78, r * 0.5, r * 0.16);
  paint(ctx, '#20252e', true, LINE * 0.8);
  ctx.beginPath();
  ctx.moveTo(tx - r * 0.14, eyeY - r * 0.16);
  ctx.lineTo(tx + r * 0.14, eyeY - r * 0.16);
  ink(ctx, r * 0.09);
  ctx.stroke();
  // Un éclat sur chaque verre : sans ça, ce sont deux trous noirs.
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(tx + side * r * 0.5 - r * 0.2, eyeY + r * 0.14);
    ctx.lineTo(tx + side * r * 0.5 + r * 0.05, eyeY - r * 0.24);
    ctx.lineTo(tx + side * r * 0.5 + r * 0.22, eyeY - r * 0.24);
    ctx.lineTo(tx + side * r * 0.5 - r * 0.03, eyeY + r * 0.14);
    ctx.closePath();
    ctx.fill();
  }
}

function drawGlasses(ctx, r, tx, eyeY, eyeDx) {
  ctx.strokeStyle = rgba(INK, 0.85);
  ctx.lineWidth = r * 0.08;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(tx + side * eyeDx, eyeY, r * 0.32, r * 0.28, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(tx - eyeDx + r * 0.32, eyeY);
  ctx.lineTo(tx + eyeDx - r * 0.32, eyeY);
  ctx.stroke();
}

function drawHair(ctx, look, r, silhouette) {
  if (look.cap) {
    drawCap(ctx, look, r, silhouette);
    return;
  }
  const color = silhouette ? INK : look.hair;
  ctx.beginPath();
  switch (look.hairStyle) {
    case 0: // court, dégradé net
      ctx.moveTo(-r * 1.0, -r * 0.2);
      ctx.quadraticCurveTo(-r * 1.05, -r * 1.15, 0, -r * 1.18);
      ctx.quadraticCurveTo(r * 1.05, -r * 1.15, r * 1.0, -r * 0.2);
      ctx.quadraticCurveTo(r * 0.7, -r * 0.55, r * 0.2, -r * 0.5);
      ctx.quadraticCurveTo(-r * 0.6, -r * 0.45, -r * 1.0, -r * 0.2);
      break;
    case 1: // carré
      ctx.moveTo(-r * 1.08, r * 0.5);
      ctx.quadraticCurveTo(-r * 1.15, -r * 1.2, 0, -r * 1.2);
      ctx.quadraticCurveTo(r * 1.15, -r * 1.2, r * 1.08, r * 0.5);
      ctx.lineTo(r * 0.7, r * 0.45);
      ctx.quadraticCurveTo(r * 0.85, -r * 0.5, 0, -r * 0.62);
      ctx.quadraticCurveTo(-r * 0.85, -r * 0.5, -r * 0.7, r * 0.45);
      break;
    case 2: // chignon
      ctx.moveTo(-r * 1.0, -r * 0.25);
      ctx.quadraticCurveTo(-r * 1.05, -r * 1.15, 0, -r * 1.15);
      ctx.quadraticCurveTo(r * 1.05, -r * 1.15, r * 1.0, -r * 0.25);
      ctx.quadraticCurveTo(0, -r * 0.62, -r * 1.0, -r * 0.25);
      ctx.moveTo(r * 0.15, -r * 1.35);
      ctx.arc(r * 0.15, -r * 1.35, r * 0.42, 0, Math.PI * 2);
      break;
    case 3: // frisé, en grappes
      for (let i = 0; i < 8; i++) {
        const a = Math.PI * 1.05 + (i / 7) * Math.PI * 0.9;
        ctx.moveTo(Math.cos(a) * r * 0.95 + r * 0.34, Math.sin(a) * r * 1.0);
        ctx.arc(Math.cos(a) * r * 0.95, Math.sin(a) * r * 1.0, r * 0.36, 0, Math.PI * 2);
      }
      break;
    case 4: // long
      ctx.moveTo(-r * 1.1, r * 1.3);
      ctx.quadraticCurveTo(-r * 1.25, -r * 1.2, 0, -r * 1.2);
      ctx.quadraticCurveTo(r * 1.25, -r * 1.2, r * 1.1, r * 1.3);
      ctx.lineTo(r * 0.72, r * 1.25);
      ctx.quadraticCurveTo(r * 0.9, -r * 0.5, 0, -r * 0.6);
      ctx.quadraticCurveTo(-r * 0.9, -r * 0.5, -r * 0.72, r * 1.25);
      break;
    case 5: // dégarni : deux golfes bien marqués
      ctx.moveTo(-r * 1.0, -r * 0.1);
      ctx.quadraticCurveTo(-r * 1.0, -r * 0.8, -r * 0.45, -r * 0.78);
      ctx.quadraticCurveTo(-r * 0.1, -r * 0.72, 0, -r * 0.95);
      ctx.quadraticCurveTo(r * 0.1, -r * 0.72, r * 0.45, -r * 0.78);
      ctx.quadraticCurveTo(r * 1.0, -r * 0.8, r * 1.0, -r * 0.1);
      ctx.quadraticCurveTo(r * 0.6, -r * 0.5, 0, -r * 0.5);
      ctx.quadraticCurveTo(-r * 0.6, -r * 0.5, -r * 1.0, -r * 0.1);
      break;
    default: // banane
      ctx.moveTo(-r * 1.0, -r * 0.2);
      ctx.quadraticCurveTo(-r * 1.1, -r * 1.1, -r * 0.2, -r * 1.15);
      ctx.quadraticCurveTo(r * 0.5, -r * 1.9, r * 0.95, -r * 1.15);
      ctx.quadraticCurveTo(r * 1.05, -r * 0.6, r * 1.0, -r * 0.2);
      ctx.quadraticCurveTo(0, -r * 0.6, -r * 1.0, -r * 0.2);
      break;
  }
  ctx.closePath();
  paint(ctx, color, !silhouette, LINE * 0.9);
}

function drawCap(ctx, look, r, silhouette) {
  const color = silhouette ? INK : look.capColor;
  // Calotte.
  ctx.beginPath();
  ctx.moveTo(-r * 1.02, -r * 0.42);
  ctx.quadraticCurveTo(-r * 1.1, -r * 1.35, 0, -r * 1.35);
  ctx.quadraticCurveTo(r * 1.1, -r * 1.35, r * 1.02, -r * 0.42);
  ctx.closePath();
  paint(ctx, color, !silhouette, LINE * 0.9);
  // Visière, tournée vers l'avant.
  ctx.beginPath();
  ctx.moveTo(-r * 1.05, -r * 0.44);
  ctx.quadraticCurveTo(-r * 1.9, -r * 0.5, -r * 1.95, -r * 0.72);
  ctx.quadraticCurveTo(-r * 1.5, -r * 0.85, -r * 1.0, -r * 0.62);
  ctx.closePath();
  paint(ctx, silhouette ? INK : shade(color, -0.22), !silhouette, LINE * 0.9);
  if (!silhouette) {
    ctx.fillStyle = rgba('#ffffff', 0.16);
    ctx.beginPath();
    ctx.ellipse(-r * 0.3, -r * 1.0, r * 0.4, r * 0.18, -0.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

// --- Couché -----------------------------------------------------------------

function drawLying(ctx, person, look, c, t, silhouette) {
  const skin = silhouette ? INK : look.skin;
  const top = silhouette ? INK : look.top;
  const bottom = silhouette ? INK : look.bottom;
  const B = look.build;
  const y = -11;
  const breathe = (c.squash - 1) * 30;

  // Jambes.
  limb(ctx, 6, y + 1, 34, y + 3, 6 * B, 5 * B, bottom, !silhouette);
  // Buste.
  ctx.beginPath();
  roundRect(ctx, -26, y - 9 * B + breathe, 34, 18 * B, 8);
  paint(ctx, top, !silhouette);
  // Bras posé le long du corps.
  limb(ctx, -14, y + 2, 4, y + 7, 4.4 * B, 3.6 * B, skin, !silhouette);
  // Tête, de profil sur l'oreiller.
  ctx.save();
  ctx.translate(-36, y - 5 + breathe * 0.6);
  ctx.rotate(-0.15);
  ctx.beginPath();
  ctx.ellipse(0, 0, 12.5, 11.5, 0, 0, Math.PI * 2);
  paint(ctx, skin, !silhouette);
  if (!silhouette) {
    // Œil fermé, bouche entrouverte : deux traits, et ça dort vraiment.
    ctx.beginPath();
    ctx.moveTo(-6, -2);
    ctx.quadraticCurveTo(-3.5, 1.5, -1, -2);
    ink(ctx, 1.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(-4, 5, 2.2, 1.6 + Math.abs(breathe) * 0.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#6d2f2f';
    ctx.fill();
    // Cheveux ébouriffés.
    ctx.beginPath();
    ctx.ellipse(2, -6, 11, 7, -0.25, 0, Math.PI * 2);
    paint(ctx, look.hair, true, LINE * 0.8);
  }
  ctx.restore();
}

// --- Bulles et pictogrammes -------------------------------------------------

function drawEmotes(ctx, person, x, y, h, o, lying) {
  if (o.silhouette) return;
  const t = (o.time ?? 0) + person.id;
  const topY = y - h * (lying ? 0.34 : 0.98);
  const emo = emotionOf(person);

  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;

  if (emo.kind === 'dort') {
    ctx.font = `bold ${Math.round(h * 0.14)}px "Trebuchet MS", sans-serif`;
    for (let i = 0; i < 3; i++) {
      const p = (t * 0.32 + i * 0.33) % 1;
      ctx.globalAlpha = (o.alpha ?? 1) * (1 - p) * 0.85;
      ctx.fillStyle = '#f2ece0';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      const zx = x + h * 0.2 + p * h * 0.16;
      const zy = topY - p * h * 0.3;
      ctx.strokeText('z', zx, zy);
      ctx.fillText('z', zx, zy);
    }
  } else if (emo.kind === 'stresse') {
    const p = (t * 0.9) % 1;
    ctx.beginPath();
    const dx = x + h * 0.15;
    const dy = topY + h * 0.08 + p * h * 0.1;
    ctx.moveTo(dx, dy - h * 0.03);
    ctx.quadraticCurveTo(dx + h * 0.022, dy + h * 0.01, dx, dy + h * 0.022);
    ctx.quadraticCurveTo(dx - h * 0.022, dy + h * 0.01, dx, dy - h * 0.03);
    ctx.fillStyle = 'rgba(150,205,235,0.92)';
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.stroke();
  } else if (emo.kind === 'colere') {
    // La petite croix de colère, tracée à l'encre.
    const cx = x + h * 0.15;
    const cy = topY + h * 0.05;
    const s = h * 0.035 * (1 + Math.sin(t * 12) * 0.12);
    ctx.strokeStyle = '#b83a2e';
    ctx.lineWidth = Math.max(2, h * 0.014);
    ctx.lineCap = 'round';
    for (const a of [0, Math.PI / 2]) {
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * s, cy + Math.sin(a) * s);
      ctx.lineTo(cx - Math.cos(a) * s, cy - Math.sin(a) * s);
      ctx.stroke();
    }
  } else if (emo.kind === 'amoureux') {
    for (let i = 0; i < 2; i++) {
      const p = (t * 0.45 + i * 0.5) % 1;
      ctx.globalAlpha = (o.alpha ?? 1) * (1 - p);
      drawHeart(ctx, x + h * 0.15 + Math.sin(p * 6) * h * 0.02, topY - p * h * 0.28, h * 0.05, '#d9556f');
    }
  }

  if (person.action?.def?.music || person.action?.id === 'musique') {
    ctx.globalAlpha = o.alpha ?? 1;
    ctx.font = `${Math.round(h * 0.17)}px serif`;
    for (let i = 0; i < 2; i++) {
      const p = (t * 0.5 + i * 0.5) % 1;
      ctx.globalAlpha = (o.alpha ?? 1) * (1 - p) * 0.95;
      const nx = x - h * 0.22 - p * h * 0.1;
      const ny = topY - p * h * 0.28;
      ctx.fillStyle = '#e084a8';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.strokeText(i ? '♫' : '♪', nx, ny);
      ctx.fillText(i ? '♫' : '♪', nx, ny);
    }
  }
  ctx.restore();
}

export function drawHeart(ctx, x, y, r, color) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.7);
  ctx.bezierCurveTo(x - r * 1.4, y - r * 0.5, x - r * 0.3, y - r * 1.2, x, y - r * 0.4);
  ctx.bezierCurveTo(x + r * 0.3, y - r * 1.2, x + r * 1.4, y - r * 0.5, x, y + r * 0.7);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.restore();
}

/** Bulle de dialogue, dans le repère écran, encrée comme le reste. */
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

  const pad = fs * 0.55;
  const lh = fs * 1.25;
  const w = Math.min(maxWidth, Math.max(...lines.map((l) => ctx.measureText(l).width))) + pad * 2;
  const hh = lines.length * lh + pad * 1.6;
  const bx = x - w / 2;
  const by = y - hh;

  ctx.beginPath();
  roundRect(ctx, bx, by, w, hh, fs * 0.6);
  ctx.moveTo(x - fs * 0.4, by + hh - 2);
  ctx.lineTo(x - fs * 0.05, by + hh + fs * 0.72);
  ctx.lineTo(x + fs * 0.42, by + hh - 2);
  ctx.fillStyle = '#fcf7ee';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1.6, 2 * scale);
  ctx.lineJoin = 'round';
  ctx.stroke();

  ctx.fillStyle = '#33261c';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, x, by + pad * 0.8 + lh * (i + 0.5)));
  ctx.restore();
}
