// L'appartement éteint.
//
// La scène que tout le jeu prépare. Elle se joue une seule fois par partie,
// elle dure une quarantaine de secondes, et elle ne se rejoue jamais.
//
// Le joueur entre dans un appartement identique au sien. Un ordinateur est
// allumé. Quelqu'un joue à Behind. Cette personne clique sur des fenêtres,
// exactement comme le joueur vient de le faire pendant des heures. Puis
// elle s'arrête. Elle tourne lentement la tête. Elle regarde le joueur.
//
// Après ça, la fenêtre reste éteinte pour toujours.

import { PALETTE, rgba, shade, mixHex } from './palette.js';
import { roundRect } from './character.js';

export const PHASES = [
  { id: 'noir', dur: 2.6 },      // on ne voit rien, on entend l'immeuble
  { id: 'ecran', dur: 3.2 },     // la lueur d'un écran apparaît
  { id: 'jeu', dur: 9.0 },       // quelqu'un joue à Behind
  { id: 'arret', dur: 3.0 },     // le curseur s'immobilise
  { id: 'regard', dur: 6.5 },    // la tête se tourne vers vous
  { id: 'fin', dur: 3.4 },       // noir, et retour
];

export const TOTAL = PHASES.reduce((s, p) => s + p.dur, 0);

export function phaseAt(t) {
  let acc = 0;
  for (const p of PHASES) {
    if (t < acc + p.dur) return { id: p.id, local: (t - acc) / p.dur, elapsed: t };
    acc += p.dur;
  }
  return { id: 'fin', local: 1, elapsed: t };
}

/**
 * @param {object} rect cadre de la pièce
 * @param {number} t    temps écoulé depuis l'entrée, en secondes
 */
export function drawFinale(ctx, world, rect, t) {
  const { x, y, w, h } = rect;
  const ph = phaseAt(t);

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  // Fond : une pièce identique à celle du joueur, mais on ne la voit
  // qu'à peine. C'est l'écran qui éclaire tout.
  ctx.fillStyle = '#080a10';
  ctx.fillRect(x, y, w, h);

  const glow = ph.id === 'noir'
    ? Math.max(0, (ph.local - 0.55) / 0.45) * 0.35
    : ph.id === 'ecran' ? 0.35 + ph.local * 0.5
      : ph.id === 'fin' ? Math.max(0, 1 - ph.local * 1.6)
        : 0.85;

  if (glow > 0.01) {
    drawRoom(ctx, rect, glow);
    drawDeskAndScreen(ctx, world, rect, ph, glow, t);
    drawWatcher(ctx, rect, ph, glow, t);
  }

  // Grain : très léger, juste pour que l'image ne soit pas propre.
  drawGrain(ctx, rect, t);

  if (ph.id === 'fin') {
    ctx.fillStyle = rgba('#000000', Math.min(1, ph.local * 1.5));
    ctx.fillRect(x, y, w, h);
  }

  ctx.restore();

  // Sous-titre discret, une seule ligne, au bon moment.
  const line = subtitleFor(ph);
  if (line) {
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = '#e8e0d0';
    ctx.font = `${Math.max(13, w * 0.018)}px "Trebuchet MS", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(line, x + w / 2, y + h + Math.max(28, h * 0.09));
    ctx.restore();
  }
}

function subtitleFor(ph) {
  switch (ph.id) {
    case 'noir': return ph.local > 0.4 ? 'Il n\'y a jamais eu de lumière ici.' : null;
    case 'ecran': return 'Un écran est allumé.';
    case 'jeu': return ph.local > 0.35 ? 'Quelqu\'un joue à Behind.' : null;
    case 'arret': return 'Il vient de s\'arrêter.';
    case 'regard': return ph.local > 0.45 ? '' : null;
    default: return null;
  }
}

function drawRoom(ctx, rect, glow) {
  const { x, y, w, h } = rect;
  const floorY = y + h * 0.84;
  // Mur, sol, plinthe : les mêmes que partout ailleurs, en beaucoup plus sombre.
  ctx.fillStyle = mixHex('#0a0c14', PALETTE.wall[0], glow * 0.16);
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = mixHex('#080a10', PALETTE.floor[0], glow * 0.14);
  ctx.fillRect(x, floorY, w, h - (floorY - y));

  // La fenêtre, vue de l'intérieur : elle donne sur du noir.
  ctx.fillStyle = '#05070c';
  ctx.fillRect(x + w * 0.62, y + h * 0.16, w * 0.16, h * 0.42);
  ctx.strokeStyle = rgba('#3a3630', 0.5 * glow);
  ctx.lineWidth = 2;
  ctx.strokeRect(x + w * 0.62, y + h * 0.16, w * 0.16, h * 0.42);
}

function drawDeskAndScreen(ctx, world, rect, ph, glow, t) {
  const { x, y, w, h } = rect;
  const floorY = y + h * 0.84;
  const deskX = x + w * 0.24;
  const deskW = w * 0.3;
  const deskY = floorY - h * 0.2;

  // Bureau.
  ctx.fillStyle = mixHex('#0a0c14', PALETTE.wood, glow * 0.35);
  ctx.fillRect(deskX, deskY, deskW, h * 0.022);
  ctx.fillRect(deskX + deskW * 0.06, deskY, w * 0.012, floorY - deskY);
  ctx.fillRect(deskX + deskW * 0.9, deskY, w * 0.012, floorY - deskY);

  // Écran : c'est la seule source de lumière de la scène.
  const scW = deskW * 0.62;
  const scH = scW * 0.6;
  const scX = deskX + deskW * 0.19;
  const scY = deskY - scH - h * 0.01;

  ctx.fillStyle = '#141820';
  roundRect(ctx, scX - 4, scY - 4, scW + 8, scH + 8, 4);
  ctx.fill();

  // Ce qu'il y a sur l'écran : Behind. La façade d'un immeuble.
  ctx.save();
  ctx.beginPath();
  ctx.rect(scX, scY, scW, scH);
  ctx.clip();
  drawGameOnScreen(ctx, world, { x: scX, y: scY, w: scW, h: scH }, ph, t);
  ctx.restore();

  // Halo de l'écran sur la pièce.
  const g = ctx.createRadialGradient(scX + scW / 2, scY + scH / 2, 0, scX + scW / 2, scY + scH / 2, w * 0.42);
  g.addColorStop(0, `rgba(150,190,225,${0.3 * glow})`);
  g.addColorStop(1, 'rgba(150,190,225,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

/** L'écran dans l'écran : une petite façade, et un curseur qui clique. */
function drawGameOnScreen(ctx, world, r, ph, t) {
  ctx.fillStyle = '#1b2436';
  ctx.fillRect(r.x, r.y, r.w, r.h);

  const cols = 7;
  const rows = 6;
  const pad = r.w * 0.08;
  const gw = (r.w - pad * 2) / cols;
  const gh = (r.h - pad * 2) / rows;

  // La façade miniature.
  ctx.fillStyle = '#8a6247';
  ctx.fillRect(r.x + pad * 0.5, r.y + pad * 0.5, r.w - pad, r.h - pad * 0.5);

  // Le curseur : il se promène, puis il s'arrête net.
  const playing = ph.id === 'jeu';
  const frozen = ph.id === 'arret' || ph.id === 'regard' || ph.id === 'fin';
  const ct = playing ? ph.local * 9 : 9;
  const ci = Math.floor(ct * 0.9) % (cols * rows);
  const targetCol = ci % cols;
  const targetRow = Math.floor(ci / cols) % rows;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const wx = r.x + pad + col * gw + gw * 0.18;
      const wy = r.y + pad + row * gh + gh * 0.18;
      const ww = gw * 0.64;
      const wh = gh * 0.64;
      // Les fenêtres de son immeuble s'allument comme les nôtres.
      const seed = row * 13 + col * 7;
      const lit = ((Math.sin(t * 0.3 + seed) + 1) / 2) > 0.55;
      const isTarget = playing && col === targetCol && row === targetRow;
      ctx.fillStyle = isTarget ? '#ffe6b0' : lit ? '#ffcf7a' : '#232a38';
      ctx.fillRect(wx, wy, ww, wh);
    }
  }

  // Et une fenêtre, quelque part, qui ne s'allume jamais chez lui non plus.
  ctx.fillStyle = '#0b0e16';
  ctx.fillRect(r.x + pad + 4 * gw + gw * 0.18, r.y + pad + 2 * gh + gh * 0.18, gw * 0.64, gh * 0.64);

  // Le curseur.
  const cx = frozen
    ? r.x + pad + 4 * gw + gw * 0.5
    : r.x + pad + targetCol * gw + gw * 0.5;
  const cy = frozen
    ? r.y + pad + 2 * gh + gh * 0.5
    : r.y + pad + targetRow * gh + gh * 0.5;
  drawCursor(ctx, cx, cy, Math.max(5, r.w * 0.035));
}

function drawCursor(ctx, x, y, s) {
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#101010';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + s * 1.5);
  ctx.lineTo(x + s * 0.42, y + s * 1.1);
  ctx.lineTo(x + s * 0.72, y + s * 1.7);
  ctx.lineTo(x + s * 0.95, y + s * 1.55);
  ctx.lineTo(x + s * 0.64, y + s * 0.98);
  ctx.lineTo(x + s * 1.08, y + s * 0.92);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/**
 * Celui qui joue.
 *
 * De dos pendant toute la scène. Puis la tête tourne — lentement, en
 * quatre secondes, sans musique, sans effet. Et il vous regarde.
 */
function drawWatcher(ctx, rect, ph, glow, t) {
  const { x, y, w, h } = rect;
  const floorY = y + h * 0.84;
  const cx = x + w * 0.42;
  const scale = h / 320;

  // Rotation de la tête : 0 = de dos, 1 = plein face.
  let turn = 0;
  if (ph.id === 'regard') turn = Math.min(1, ph.local / 0.55);
  else if (ph.id === 'fin') turn = 1;

  const chairY = floorY;
  const seatY = chairY - h * 0.19;

  // Chaise.
  ctx.fillStyle = mixHex('#0a0c14', '#2a2e36', glow * 0.6);
  ctx.fillRect(cx - w * 0.05, seatY, w * 0.1, h * 0.02);
  ctx.fillRect(cx - w * 0.008, seatY + h * 0.02, w * 0.016, chairY - seatY - h * 0.02);
  // Dossier plus étroit que les épaules : sinon la tête a l'air posée sur
  // une chaise plutôt que sur un corps.
  ctx.fillRect(cx - w * 0.032, seatY - h * 0.13, w * 0.064, h * 0.13);

  // Corps, de dos.
  const bodyTop = seatY - h * 0.2;
  ctx.fillStyle = mixHex('#0a0c14', '#3a4250', glow * 0.75);
  roundRect(ctx, cx - w * 0.042, bodyTop, w * 0.084, seatY - bodyTop + h * 0.01, w * 0.02);
  ctx.fill();

  // Tête.
  const headR = h * 0.062;
  const headY = bodyTop - headR * 0.75;
  // Quand elle se tourne, elle se décale légèrement : une tête ne pivote
  // pas sur un axe parfait.
  const shift = Math.sin(turn * Math.PI) * w * 0.006;

  ctx.save();
  ctx.translate(cx + shift, headY);

  // Cheveux (vus de dos au départ).
  ctx.fillStyle = mixHex('#0a0c14', '#2b2118', glow * 0.9);
  ctx.beginPath();
  ctx.ellipse(0, 0, headR * 0.95, headR, 0, 0, Math.PI * 2);
  ctx.fill();

  if (turn > 0.02) {
    // Le visage apparaît progressivement : d'abord une joue, puis un œil,
    // puis les deux. On ne montre jamais de bouche.
    const faceW = headR * 0.92 * turn;
    ctx.fillStyle = mixHex('#0a0c14', '#e8c9a8', glow * 0.85);
    ctx.beginPath();
    ctx.ellipse(0, headR * 0.06, faceW, headR * 0.9, 0, 0, Math.PI * 2);
    ctx.fill();

    // Les yeux. C'est tout l'enjeu de la scène.
    const eyeOpen = Math.min(1, Math.max(0, (turn - 0.35) / 0.4));
    if (eyeOpen > 0) {
      const eyeDx = headR * 0.32 * turn;
      const eyeR = headR * 0.115;
      for (const side of [-1, 1]) {
        if (side === -1 && turn < 0.6) continue; // le deuxième œil arrive après
        const ex = side * eyeDx;
        // Creux de l'orbite : sans lui, les yeux flottent et deviennent
        // comiques au lieu d'être dérangeants.
        ctx.fillStyle = 'rgba(20,16,14,0.5)';
        ctx.beginPath();
        ctx.ellipse(ex, headR * 0.02, eyeR * 2, eyeR * 1.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#d8d0c4';
        ctx.beginPath();
        ctx.ellipse(ex, 0, eyeR * 1.15 * eyeOpen, eyeR * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0d1014';
        ctx.beginPath();
        ctx.arc(ex, 0, eyeR * 0.62 * eyeOpen, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Une mèche qui retombe : le visage reste à moitié caché.
    ctx.fillStyle = mixHex('#0a0c14', '#2b2118', glow * 0.9);
    ctx.beginPath();
    ctx.ellipse(0, -headR * 0.45, headR * 0.95, headR * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Le regard tenu : la scène ne fait plus rien pendant plusieurs secondes.
  if (ph.id === 'regard' && ph.local > 0.6) {
    const hold = (ph.local - 0.6) / 0.4;
    ctx.fillStyle = rgba('#000000', hold * 0.25);
    ctx.fillRect(x, y, w, h);
  }
}

function drawGrain(ctx, rect, t) {
  const { x, y, w, h } = rect;
  ctx.save();
  ctx.globalAlpha = 0.045;
  const n = 260;
  for (let i = 0; i < n; i++) {
    const s = (i * 9301 + Math.floor(t * 24) * 7919) % 233280;
    const px = x + (s / 233280) * w;
    const py = y + (((s * 31) % 233280) / 233280) * h;
    ctx.fillStyle = i % 2 ? '#ffffff' : '#000000';
    ctx.fillRect(px, py, 1.5, 1.5);
  }
  ctx.restore();
}
