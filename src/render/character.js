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
    shades: hashPick(id * 53 + 6, 100) < 8 && person.age > 14,
    cap: hashPick(id * 61 + 3, 100) < 22 && person.age < 62,
    beard: person.gender === 'm' && person.age > 22 && hashPick(id * 19 + 7, 100) < 42,
    stubble: person.gender === 'm' && person.age > 19 && hashPick(id * 71 + 5, 100) < 45,
    // L'habillement : col et manches suffisent à faire un vêtement.
    collar: hashPick(id * 83 + 2, 3),        // 0 rond, 1 en V, 2 chemise
    longSleeve: hashPick(id * 97 + 1, 100) < 45,
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
  const spread = 0.26 + open * 0.6;

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
    const len = s * (i === 0 || i === 3 ? 1.35 : 1.65);
    const knuckleX = Math.cos(a) * s * 0.5;
    const knuckleY = Math.sin(a) * s * 0.5 + s * 0.1;
    capsule(knuckleX, knuckleY, Math.cos(a) * len, Math.sin(a) * len + s * 0.1, s * 0.24);
  }
  // Pouce, écarté à l'opposé.
  const ta = -Math.PI / 2 - (0.95 + open * 0.55);
  capsule(0, s * 0.2, Math.cos(ta) * s * 1.15, Math.sin(ta) * s * 0.8 + s * 0.2, s * 0.27);
  // Paume.
  ctx.moveTo(s * 0.66, s * 0.12);
  ctx.ellipse(0, s * 0.12, s * 0.66, s * 0.74, 0, 0, Math.PI * 2);

  if (outline) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = LINE * 1.6;
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

// --- Construction du corps ---------------------------------------------------
//
// Règle qui change tout : un membre entier est UN seul chemin. Avant, chaque
// segment était une capsule autonome, donc chaque articulation laissait voir
// deux bouts arrondis superposés — la rotule de pantin articulé. Ici on
// assemble cuisse et mollet dans le même tracé, on encre le contour d'un
// trait épais, puis on remplit par-dessus : les coutures internes
// disparaissent et le membre devient continu.

/** Ajoute une capsule au chemin courant, sans l'ouvrir ni le fermer. */
function capsulePath(ctx, ax, ay, bx, by, wa, wb = wa) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  ctx.moveTo(ax + nx * wa, ay + ny * wa);
  ctx.lineTo(bx + nx * wb, by + ny * wb);
  ctx.arc(bx, by, wb, Math.atan2(ny, nx), Math.atan2(-ny, -nx), true);
  ctx.lineTo(ax - nx * wa, ay - ny * wa);
  ctx.arc(ax, ay, wa, Math.atan2(-ny, -nx), Math.atan2(ny, nx), true);
  ctx.closePath();
}

/** Encre puis remplit : la seule façon d'obtenir une silhouette sans couture. */
function solid(ctx, build, color, outline = true, lw = LINE * 1.9) {
  ctx.beginPath();
  build();
  if (outline) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = lw;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  ctx.fillStyle = color;
  ctx.fill();
}

/**
 * Une jambe entière : cuisse + mollet en un tracé, puis la chaussure.
 * Le genou n'est plus une bille, c'est un simple changement de direction.
 */
function drawLeg(ctx, hx, hy, kx, ky, fx, fy, B, trousers, outline) {
  solid(ctx, () => {
    capsulePath(ctx, hx, hy, kx, ky, 6.4 * B, 5.2 * B);
    capsulePath(ctx, kx, ky, fx, fy, 5.2 * B, 4.1 * B);
  }, trousers, outline);
  // Ourlet du pantalon, juste au-dessus de la chaussure.
  if (outline) {
    const a = Math.atan2(fy - ky, fx - kx);
    const ox = fx - Math.cos(a) * 5;
    const oy = fy - Math.sin(a) * 5;
    ctx.beginPath();
    ctx.moveTo(ox - Math.sin(a) * 4.2 * B, oy + Math.cos(a) * 4.2 * B);
    ctx.lineTo(ox + Math.sin(a) * 4.2 * B, oy - Math.cos(a) * 4.2 * B);
    ink(ctx, LINE * 0.75);
    ctx.stroke();
  }
}

/**
 * Un bras entier : bras + avant-bras en un tracé couleur peau, puis la
 * manche par-dessus. C'est l'ordre du dessinateur — on construit le corps,
 * on l'habille ensuite — et c'est ce qui donne une vraie manche avec un
 * bord, au lieu d'un tube bicolore.
 */
function drawArm(ctx, sx, sy, shoulder, elbow, open, B, sleeve, skin, outline, longSleeve) {
  const upper = 20 * B;
  const fore = 19 * B;
  const ex = sx + Math.sin(shoulder) * upper;
  const ey = sy + Math.cos(shoulder) * upper;
  const wristA = shoulder + elbow;
  const wx = ex + Math.sin(wristA) * fore;
  const wy = ey + Math.cos(wristA) * fore;

  solid(ctx, () => {
    capsulePath(ctx, sx, sy, ex, ey, 5.2 * B, 4.3 * B);
    capsulePath(ctx, ex, ey, wx, wy, 4.3 * B, 3.5 * B);
  }, skin, outline);

  // La manche est peinte À L'INTÉRIEUR du bras, pas posée dessus : sinon
  // son contour dessine une boucle en travers de l'épaule et du torse.
  const endX = longSleeve ? ex + (wx - ex) * 0.82 : sx + (ex - sx) * 0.62;
  const endY = longSleeve ? ey + (wy - ey) * 0.82 : sy + (ey - sy) * 0.62;
  ctx.save();
  ctx.beginPath();
  capsulePath(ctx, sx, sy, ex, ey, 5.2 * B, 4.3 * B);
  capsulePath(ctx, ex, ey, wx, wy, 4.3 * B, 3.5 * B);
  ctx.clip();
  ctx.beginPath();
  capsulePath(ctx, sx - 2, sy - 2, endX, endY, 7 * B, 5.4 * B);
  ctx.fillStyle = sleeve;
  ctx.fill();
  ctx.restore();
  // Le bord de manche : une seule ligne en travers du bras.
  if (outline) {
    const a = Math.atan2(endY - sy, endX - sx);
    ctx.beginPath();
    ctx.moveTo(endX - Math.sin(a) * 4.4 * B, endY + Math.cos(a) * 4.4 * B);
    ctx.lineTo(endX + Math.sin(a) * 4.4 * B, endY - Math.cos(a) * 4.4 * B);
    ink(ctx, LINE * 0.85);
    ctx.stroke();
  }

  drawHand(ctx, wx, wy, wristA + Math.PI, open, skin, 4.3 * B, outline);
}

function shoe(ctx, x, y, side, silhouette) {
  solid(ctx, () => {
    ctx.moveTo(x - 4.2 * side, y - 5);
    ctx.quadraticCurveTo(x - 5.4 * side, y + 1.6, x + 3.5 * side, y + 1.8);
    ctx.quadraticCurveTo(x + 9.5 * side, y + 1.6, x + 8.8 * side, y - 2.2);
    ctx.quadraticCurveTo(x + 6 * side, y - 5.4, x + 2.5 * side, y - 5.2);
    ctx.closePath();
  }, silhouette ? INK : PALETTE.frameDark, !silhouette, LINE * 1.6);
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
  const headY = shoulderY - 14 - headR;
  const torsoW = 18 * B;
  const outline = !silhouette;
  const skin = silhouette ? INK : look.skin;
  const top = silhouette ? INK : look.top;
  const bottom = silhouette ? INK : look.bottom;
  const spread = 4.8 * B;

  // Le bras du fond passe derrière le buste : sans ça, tout est à plat.
  const farArm = () => drawArm(ctx, -torsoW * 0.44, shoulderY + 6,
    c.armL, c.elbowL, c.handL, B, top, skin, outline, look.longSleeve);
  const nearArm = () => drawArm(ctx, torsoW * 0.44, shoulderY + 6,
    c.armR, c.elbowR, c.handR, B, top, skin, outline, look.longSleeve);

  // 1. Bras arrière.
  farArm();

  // 2. Jambes. Le genou part légèrement en avant : une jambe parfaitement
  //    droite n'existe pas debout.
  const legGeom = (side, ang) => {
    const hx = side * spread;
    if (sit > 0.5) {
      const kx = hx - 16;
      return { hx, hy: hipY, kx, ky: hipY + 3, fx: kx - 1, fy: 0 };
    }
    return {
      hx,
      hy: hipY,
      kx: hx + Math.sin(ang) * 14 + 1.5,
      ky: hipY * 0.47 - Math.abs(Math.sin(ang)) * 3,
      fx: hx + Math.sin(ang) * 27,
      fy: -Math.abs(Math.sin(ang)) * 7,
    };
  };
  const legs = [[-1, c.legL], [1, c.legR]].map(([side, ang]) => ({ side, ...legGeom(side, ang) }));
  // La jambe du fond d'abord, pour la même raison que le bras.
  for (const L of legs) {
    drawLeg(ctx, L.hx, L.hy, L.kx, L.ky, L.fx, L.fy, B, bottom, outline);
    shoe(ctx, L.fx, L.fy, L.side, silhouette);
  }

  // 3. Bassin : il relie les deux cuisses, sinon le personnage est fendu.
  solid(ctx, () => {
    capsulePath(ctx, -spread, hipY - 1, spread, hipY - 1, 7 * B);
  }, bottom, outline);

  // 4. Cou, avant le buste : le col viendra le recouvrir à la base.
  ctx.save();
  ctx.translate(0, hipY);
  ctx.rotate(c.lean * 0.5 + c.twist * 0.18);
  ctx.translate(0, -hipY);
  solid(ctx, () => {
    capsulePath(ctx, 0, headY + headR * 0.5, 0, shoulderY + 4, 4.4 * B, 5.6 * B);
  }, skin, outline);

  // 5. Le buste : épaules, taille, hanches. Plus jamais un trapèze.
  const shW = torsoW * 0.62;   // demi-largeur aux épaules
  const waW = torsoW * 0.40;   // à la taille
  const hiW = torsoW * 0.50;   // aux hanches
  const waistY = (shoulderY + hipY) / 2 + 2;
  const hemY = hipY + 5;
  solid(ctx, () => {
    ctx.moveTo(-shW, shoulderY + 6);
    // Trapèzes : l'épaule remonte vers le cou au lieu d'être coupée net.
    ctx.quadraticCurveTo(-shW * 0.86, shoulderY - 3, -4.4 * B, shoulderY - 1);
    ctx.lineTo(4.4 * B, shoulderY - 1);
    ctx.quadraticCurveTo(shW * 0.86, shoulderY - 3, shW, shoulderY + 6);
    // Deltoïde, puis creux de la taille, puis hanche.
    ctx.quadraticCurveTo(shW * 1.04, shoulderY + 12, waW, waistY);
    ctx.quadraticCurveTo(hiW * 1.02, hemY - 6, hiW, hemY);
    ctx.lineTo(-hiW, hemY);
    ctx.quadraticCurveTo(-hiW * 1.02, hemY - 6, -waW, waistY);
    ctx.quadraticCurveTo(-shW * 1.04, shoulderY + 12, -shW, shoulderY + 6);
    ctx.closePath();
  }, top, outline);

  if (outline) {
    // Ombre portée : un seul aplat, côté opposé à la lumière.
    ctx.save();
    ctx.clip();
    // Un dégradé plutôt qu'un aplat : une bande nette au milieu du torse
    // ressemblait à une rayure peinte, pas à une ombre.
    const grad = ctx.createLinearGradient(-torsoW * 0.2, 0, torsoW * 0.7, 0);
    grad.addColorStop(0, rgba(shade(look.top, -0.45), 0));
    grad.addColorStop(1, rgba(shade(look.top, -0.45), 0.42));
    ctx.fillStyle = grad;
    ctx.fillRect(-torsoW, shoulderY - 10, torsoW * 2.2, hemY - shoulderY + 20);
    ctx.restore();

    // Col : c'est lui qui transforme un torse coloré en vêtement.
    ctx.beginPath();
    if (look.collar === 0) {          // col rond
      ctx.moveTo(-5.6 * B, shoulderY);
      ctx.quadraticCurveTo(0, shoulderY + 6.5, 5.6 * B, shoulderY);
    } else if (look.collar === 1) {   // col en V
      ctx.moveTo(-5.6 * B, shoulderY - 0.5);
      ctx.lineTo(0, shoulderY + 8);
      ctx.lineTo(5.6 * B, shoulderY - 0.5);
    } else {                          // col de chemise
      ctx.moveTo(-6 * B, shoulderY - 1);
      ctx.lineTo(-2 * B, shoulderY + 7);
      ctx.lineTo(0, shoulderY + 2);
      ctx.lineTo(2 * B, shoulderY + 7);
      ctx.lineTo(6 * B, shoulderY - 1);
    }
    ink(ctx, LINE * 0.85);
    ctx.stroke();

    // Bas du vêtement : une ligne, et le pantalon existe.
    ctx.beginPath();
    ctx.moveTo(-hiW * 0.92, hemY - 1);
    ctx.quadraticCurveTo(0, hemY + 2, hiW * 0.92, hemY - 1);
    ink(ctx, LINE * 0.8);
    ctx.stroke();
  }
  ctx.restore();

  // 6. Bras avant, par-dessus le buste.
  ctx.save();
  ctx.translate(0, hipY);
  ctx.rotate(c.lean * 0.5 + c.twist * 0.18);
  ctx.translate(0, -hipY);
  nearArm();
  ctx.restore();

  // 7. Tête.
  ctx.save();
  ctx.translate(0, hipY);
  ctx.rotate(c.lean * 0.5);
  ctx.translate(0, -hipY);
  ctx.translate(0, headY);
  ctx.rotate(c.headTilt * 0.5);
  drawHead(ctx, person, look, c, headR, t, silhouette);
  ctx.restore();

  ctx.restore();
  drawEmotes(ctx, person, x, y, h, o, false);
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
  ctx.strokeStyle = INK;
  ctx.lineWidth = r * 0.125;
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    const bx = tx + side * eyeDx;
    const by = eyeY - r * 0.52 - c.brow * r * 0.13;
    const inner = c.browInner * r * 0.2;
    ctx.beginPath();
    ctx.moveTo(bx - side * r * 0.24, by + inner);
    ctx.quadraticCurveTo(bx, by - r * 0.06, bx + side * r * 0.24, by - inner * 0.3);
    ctx.stroke();
  }
  ctx.restore();

  // --- Yeux ---
  if (look.shades) {
    drawShades(ctx, look, r, tx, eyeY);
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
      const eh = r * 0.17 * open;
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, r * 0.175, eh, 0, 0, Math.PI * 2);
      paint(ctx, '#fbf7f0', true, LINE * 0.65);
      // Pupille : elle suit le regard, elle ne reste jamais plein centre.
      const px = ex + turn * r * 0.09;
      ctx.beginPath();
      ctx.arc(px, eyeY + (c.browInner > 0.5 ? eh * 0.25 : 0), r * 0.095 * Math.min(1, open * 1.6), 0, Math.PI * 2);
      ctx.fillStyle = INK;
      ctx.fill();
      // Paupière supérieure : un trait franc posé sur l'œil. C'est elle qui
      // empêche l'œil d'être une bille collée sur le visage.
      ctx.beginPath();
      ctx.moveTo(ex - r * 0.21, eyeY - eh * 0.35);
      ctx.quadraticCurveTo(ex, eyeY - eh * 1.5, ex + r * 0.21, eyeY - eh * 0.35);
      ink(ctx, r * 0.1);
      ctx.stroke();
    }
    if (look.glasses) drawGlasses(ctx, r, tx, eyeY, eyeDx);
  }

  // Pilosité AVANT le nez et la bouche : peinte après, la barbe recouvrait
  // la bouche et le visage n'avait plus d'expression.
  if (look.beard) {
    // Un collier qui suit la mâchoire et s'arrête sous la bouche : taillée
    // plus haut, la barbe avalait la bouche et le visage devenait un masque.
    ctx.beginPath();
    ctx.moveTo(-r * 0.88, r * 0.02);
    ctx.quadraticCurveTo(-r * 0.8, r * 1.2, 0, r * 1.24);
    ctx.quadraticCurveTo(r * 0.8, r * 1.2, r * 0.88, r * 0.02);
    ctx.quadraticCurveTo(r * 0.66, r * 0.66, 0, r * 0.74);
    ctx.quadraticCurveTo(-r * 0.66, r * 0.66, -r * 0.88, r * 0.02);
    ctx.closePath();
    paint(ctx, look.hair, true, LINE * 0.8);
  } else if (look.stubble) {
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = look.hair;
    ctx.beginPath();
    ctx.ellipse(tx * 0.5, r * 0.62, r * 0.7, r * 0.4, 0, 0, Math.PI);
    ctx.fill();
    ctx.restore();
  }

  drawNose(ctx, look, r, tx, eyeY);
  drawMouth(ctx, look, c, r, tx, look.beard);

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
  if (look.nose === 2) {
    ctx.fillStyle = rgba(shade(look.skin, -0.3), 0.9);
    ctx.fill();
  }
  ink(ctx, r * 0.1);
  ctx.stroke();
}

function drawMouth(ctx, look, c, r, tx, onBeard = false) {
  const my = r * 0.55;
  const curve = c.mouth;
  const openAmt = Math.max(0, c.mouthOpen);
  const w = r * 0.42;

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
    ctx.moveTo(tx - w, my - curve * r * 0.14);
    ctx.quadraticCurveTo(tx, my + curve * r * 0.4, tx + w, my - curve * r * 0.14);
    ctx.strokeStyle = onBeard ? rgba('#f0d9c8', 0.9) : INK;
    ctx.lineWidth = r * 0.145;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }
}

function drawShades(ctx, look, r, tx, eyeY) {
  // Lunettes de soleil : deux verres larges reliés, très présents.
  // Des verres translucides : opaques, ils effaçaient le regard, et avec
  // une barbe il ne restait plus rien du visage.
  for (const dx of [-r * 0.92, r * 0.14]) {
    ctx.beginPath();
    roundRect(ctx, tx + dx, eyeY - r * 0.28, r * 0.78, r * 0.46, r * 0.15);
    ctx.fillStyle = rgba(look.skin, 1);
    ctx.fill();
    ctx.fillStyle = 'rgba(32,37,46,0.78)';
    ctx.fill();
    ink(ctx, LINE * 0.8);
    ctx.stroke();
  }
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
  // Des verres fins et resserrés : trop larges, ils se rejoignaient et le
  // haut du visage devenait une barre noire.
  ctx.strokeStyle = rgba(INK, 0.8);
  ctx.lineWidth = r * 0.055;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(tx + side * eyeDx, eyeY, r * 0.26, r * 0.23, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(tx - eyeDx + r * 0.26, eyeY);
  ctx.lineTo(tx + eyeDx - r * 0.26, eyeY);
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
  const duvet = silhouette ? INK : PALETTE.fabric[(person.id + 2) % PALETTE.fabric.length];
  const B = look.build;
  const y = -9;
  // La respiration soulève la couette, pas le corps entier.
  const breathe = (c.squash - 1) * 26;

  // Oreiller, à la tête du lit.
  if (!silhouette) {
    ctx.beginPath();
    roundRect(ctx, -46, y - 9, 22, 12, 5);
    paint(ctx, '#f4ece0', true, LINE * 0.9);
  }

  // Jambes sous la couette : deux bosses, pas un rectangle.
  ctx.beginPath();
  ctx.moveTo(-24, y + 5);
  ctx.quadraticCurveTo(-6, y - 9 - breathe, 12, y - 5);
  ctx.quadraticCurveTo(26, y - 2, 34, y + 1);
  ctx.quadraticCurveTo(38, y + 6, 30, y + 7);
  ctx.lineTo(-24, y + 7);
  ctx.closePath();
  paint(ctx, duvet, !silhouette);

  if (!silhouette) {
    // Un pli de couette : c'est ce qui la distingue d'un sac de couchage.
    ctx.beginPath();
    ctx.moveTo(-20, y - 2 - breathe * 0.5);
    ctx.quadraticCurveTo(0, y - 6 - breathe, 20, y - 1);
    ink(ctx, LINE * 0.7);
    ctx.stroke();
    // Le bord replié, côté épaules.
    ctx.beginPath();
    ctx.moveTo(-24, y - 1);
    ctx.quadraticCurveTo(-18, y - 6 - breathe * 0.6, -10, y - 4);
    ctx.lineTo(-10, y + 1);
    ctx.lineTo(-24, y + 1);
    ctx.closePath();
    paint(ctx, shade(duvet, 0.3), true, LINE * 0.7);
  }

  // Épaule et bras posés par-dessus la couette.
  ctx.beginPath();
  capsulePath(ctx, -26, y - 3, -12, y + 1, 5.5 * B, 4.5 * B);
  if (silhouette) {
    ctx.fillStyle = INK;
    ctx.fill();
  } else {
    ctx.strokeStyle = INK;
    ctx.lineWidth = LINE * 1.7;
    ctx.stroke();
    ctx.fillStyle = look.top;
    ctx.fill();
  }

  // Tête de profil sur l'oreiller.
  ctx.save();
  ctx.translate(-36, y - 9 + breathe * 0.35);
  ctx.rotate(-0.12);
  const r = 11.5;
  ctx.beginPath();
  ctx.moveTo(-r * 0.9, -r * 0.1);
  ctx.quadraticCurveTo(-r * 0.95, -r * 1.05, 0, -r * 1.05);
  ctx.quadraticCurveTo(r * 0.98, -r * 1.0, r * 0.92, r * 0.1);
  ctx.quadraticCurveTo(r * 0.85, r * 0.85, r * 0.2, r * 0.95);
  ctx.quadraticCurveTo(-r * 0.6, r * 0.95, -r * 0.9, -r * 0.1);
  ctx.closePath();
  paint(ctx, skin, !silhouette);

  if (!silhouette) {
    // Œil fermé, sourcil détendu, bouche entrouverte : trois traits suffisent.
    ctx.beginPath();
    ctx.moveTo(r * 0.1, -r * 0.12);
    ctx.quadraticCurveTo(r * 0.38, r * 0.14, r * 0.62, -r * 0.12);
    ink(ctx, r * 0.1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(r * 0.12, -r * 0.42);
    ctx.quadraticCurveTo(r * 0.4, -r * 0.55, r * 0.66, -r * 0.4);
    ink(ctx, r * 0.09);
    ctx.stroke();
    // Nez de profil.
    ctx.beginPath();
    ctx.moveTo(r * 0.82, -r * 0.16);
    ctx.quadraticCurveTo(r * 1.05, r * 0.06, r * 0.8, r * 0.16);
    ink(ctx, r * 0.09);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(r * 0.5, r * 0.48, r * 0.13, r * 0.09 + Math.abs(breathe) * 0.06, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#6d2f2f';
    ctx.fill();
  }
  // Cheveux ébouriffés sur l'oreiller.
  ctx.beginPath();
  ctx.ellipse(-r * 0.35, -r * 0.62, r * 0.95, r * 0.62, -0.2, 0, Math.PI * 2);
  paint(ctx, silhouette ? INK : look.hair, !silhouette, LINE * 0.8);
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
