// La façade.
//
// C'est l'écran d'accueil et le cœur du jeu : un mur de fenêtres qui doit
// être vivant en permanence, même quand le joueur ne fait rien. Lumières
// qui s'allument, rideaux qui bougent, télés qui clignotent, silhouettes
// qui traversent, linge qui sèche, un chat qui passe.

import {
  PALETTE, skyColors, ambientLight, shade, rgba, mixHex, pickStable,
} from './palette.js';
import { roundRect } from './ink.js';
import { asset, ambianceFor, batimentFor, drawCover } from './assets.js';
import { occupantsOf } from './apartment.js';
import { SPECIAL_UNITS } from '../sim/building.js';

export class FacadeLayout {
  constructor(world) {
    this.world = world;
    this.resize(1280, 720);
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    const w = this.world;

    // La rue occupe le bas, le ciel le haut. L'immeuble prend le reste.
    // Le ciel garde assez de marge pour le toit, les cheminées et les
    // antennes, qui débordent au-dessus du dernier étage.
    const streetH = Math.max(78, height * 0.14);
    const skyH = Math.max(58, height * 0.105);
    const availH = height - streetH - skyH;
    const availW = width * 0.9;

    const cellH = availH / w.floors;
    // Une fenêtre avec son balcon est plus large que haute : on laisse
    // l'immeuble s'étaler tant qu'il reste de la place.
    const cellW = Math.min(availW / w.cols, cellH * 1.6);
    const bw = cellW * w.cols;

    this.cellW = cellW;
    this.cellH = cellH;
    this.x = (width - bw) / 2;
    this.y = skyH;
    this.w = bw;
    this.h = cellH * w.floors;
    this.streetY = this.y + this.h;
    this.streetH = height - this.streetY;
  }

  /** Rectangle d'un appartement, étage 0 en bas. */
  cellRect(apt) {
    const w = this.world;
    return {
      x: this.x + apt.col * this.cellW,
      y: this.y + (w.floors - 1 - apt.floor) * this.cellH,
      w: this.cellW,
      h: this.cellH,
    };
  }

  /** Rectangle de la fenêtre à l'intérieur de la cellule. */
  windowRect(apt) {
    const c = this.cellRect(apt);
    const pw = c.w * 0.24;
    const ph = c.h * 0.26;
    return {
      x: c.x + pw / 2,
      y: c.y + ph * 0.7,
      w: c.w - pw,
      h: c.h - ph * 1.5,
    };
  }

  /** Quel appartement se trouve sous ce point ? */
  hit(px, py) {
    const w = this.world;
    if (px < this.x || px > this.x + this.w || py < this.y || py > this.y + this.h) return null;
    const col = Math.floor((px - this.x) / this.cellW);
    const row = Math.floor((py - this.y) / this.cellH);
    const floor = w.floors - 1 - row;
    const apt = w.apartments.find((a) => a.col === col && a.floor === floor);
    if (!apt) return null;
    if (apt.special === SPECIAL_UNITS.ESCALIER) return null;
    return apt;
  }
}

/** Prépare l'état visuel des fenêtres à partir de la simulation. */
export function syncWindows(world) {
  const amb = ambientLight(world.clock.dayFraction);
  const blackout = world.forcedBlackoutDay === world.clock.day && world.clock.isNight;

  for (const apt of world.apartments) {
    if (apt.special === SPECIAL_UNITS.ESCALIER) {
      apt.lightOn = world.clock.isNight ? false : true;
      continue;
    }
    if (apt.hidden) {
      // L'appartement éteint. Toujours. C'est tout l'intérêt.
      apt.lightOn = false;
      apt.tvOn = false;
      apt.musicOn = false;
      continue;
    }

    const occupants = occupantsOf(world, apt);
    const awake = occupants.filter((p) => p.action?.id !== 'dormir');
    apt.tvOn = occupants.some((p) => p.action?.def?.tv);
    apt.musicOn = occupants.some((p) => p.action?.def?.music || p.action?.def?.party);

    let lit = awake.length > 0 && (amb < 0.62 || apt.tvOn);
    // On laisse parfois une lumière allumée en dormant. Ça arrive.
    if (!lit && occupants.length && world.clock.isNight && (apt.id % 11 === 0)) lit = true;
    // Un logement vide reste éteint, sauf quand il ne devrait pas.
    if (!occupants.length) lit = world.clock.tick < apt.ghostFlicker;
    if (blackout) lit = false;
    apt.lightOn = lit;
  }
}

/**
 * Dessine tout : ciel, immeuble, rue.
 * Le calque « dur » (maçonnerie, balcons, décor fixe) est mis en cache :
 * seules les fenêtres sont redessinées à chaque image.
 */
export function drawFacade(ctx, world, layout, time, cache) {
  const { width, height } = layout;
  const amb = ambientLight(world.clock.dayFraction);
  const sky = skyColors(world.clock.dayFraction, world.clock.season);

  // --- Ciel ---
  // Une ambiance peinte remplace le dégradé quand elle existe : c'est un
  // fond de quartier, pas seulement un ciel. Sinon, le dégradé fait le
  // travail depuis le début et le fait bien.
  const ciel = asset(ambianceFor(world));
  if (ciel) {
    drawCover(ctx, ciel, 0, 0, width, height);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, height);
    g.addColorStop(0, sky.top);
    g.addColorStop(1, sky.bot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);

    if (amb < 0.35) drawStars(ctx, width, height, world.seed, amb);
    drawSunMoon(ctx, world, width, height, amb);
  }

  // --- Calque dur ---
  if (cache?.canvas) ctx.drawImage(cache.canvas, 0, 0);

  // --- L'âge de l'immeuble ---
  // Un calque de taches et de coulures posé sur la maçonnerie, d'autant
  // plus marqué que les années passent. Il se cale sur le rectangle du
  // bâtiment, quelle que soit sa géométrie.
  const usure = asset(batimentFor(world));
  if (usure) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(layout.x, layout.y, layout.w, layout.h);
    ctx.clip();
    ctx.globalAlpha = 0.55;
    drawCover(ctx, usure, layout.x, layout.y, layout.w, layout.h);
    ctx.restore();
  }

  // --- Fenêtres vivantes ---
  for (const apt of world.apartments) {
    if (apt.special && apt.special !== SPECIAL_UNITS.LOGE) {
      if (apt.special === SPECIAL_UNITS.ESCALIER) drawStairwell(ctx, world, layout, apt, time, amb);
      continue;
    }
    drawWindow(ctx, world, layout, apt, time, amb);
  }

  drawStreetLife(ctx, world, layout, time, amb);

  // --- Ambiance nocturne globale ---
  if (amb < 0.6) {
    ctx.fillStyle = rgba('#0a1020', (0.6 - amb) * 0.38);
    ctx.fillRect(0, 0, width, layout.streetY + layout.streetH);
  }
}

// --- Fenêtres ---------------------------------------------------------------

function drawWindow(ctx, world, layout, apt, time, amb) {
  const r = layout.windowRect(apt);
  const occupants = occupantsOf(world, apt);

  // Vitre.
  let glass;
  if (apt.hidden) {
    // Éteinte, toujours. Mais c'est une vitre, pas un trou : elle prend
    // un peu du ciel, sinon elle crie « regardez-moi » dès la première
    // seconde de jeu.
    glass = apt.sealed ? '#0a0c12' : mixHex('#12161f', PALETTE.glassDay, amb * 0.22);
  } else if (apt.lightOn) {
    glass = PALETTE.glassLit;
    if (apt.tvOn) glass = mixHex(glass, PALETTE.glassTv, 0.28 + Math.sin(time * 8 + apt.id) * 0.1);
    if (apt.musicOn) glass = mixHex(glass, PALETTE.glassMusic, 0.18 + Math.sin(time * 3 + apt.id) * 0.08);
  } else if (amb > 0.5) {
    glass = mixHex(PALETTE.glassDay, '#8fa8b5', Math.sin(apt.id) * 0.2 + 0.2);
  } else {
    glass = PALETTE.glassNight;
  }

  ctx.fillStyle = glass;
  ctx.fillRect(r.x, r.y, r.w, r.h);

  // Halo chaud autour d'une fenêtre allumée : c'est ce qui rend la nuit belle.
  // Le rectangle de remplissage doit couvrir tout le dégradé, sinon le halo
  // se coupe net et l'immeuble se retrouve couvert de rectangles pâles.
  if (apt.lightOn && amb < 0.65) {
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    const R = Math.max(r.w, r.h) * 1.5;
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    const c = apt.tvOn ? 'rgba(150,205,235,' : 'rgba(255,200,120,';
    glow.addColorStop(0, `${c}${0.3 * (1 - amb)})`);
    glow.addColorStop(0.55, `${c}${0.09 * (1 - amb)})`);
    glow.addColorStop(1, `${c}0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
  }

  // Reflet du ciel sur la vitre, en diagonale.
  if (!apt.hidden) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    ctx.fillStyle = rgba('#ffffff', apt.lightOn ? 0.06 : 0.1 + amb * 0.08);
    ctx.beginPath();
    ctx.moveTo(r.x, r.y + r.h * 0.75);
    ctx.lineTo(r.x + r.w * 0.75, r.y);
    ctx.lineTo(r.x + r.w, r.y);
    ctx.lineTo(r.x, r.y + r.h);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Silhouettes : le vrai signal de vie.
  if (apt.lightOn && occupants.length && r.h > 10) {
    drawSilhouettes(ctx, world, r, occupants, time);
  }

  // Rideaux.
  drawCurtains(ctx, apt, r, time);

  // Croisillons et cadre.
  ctx.strokeStyle = amb > 0.4 ? PALETTE.frame : shade(PALETTE.frame, -0.35);
  ctx.lineWidth = Math.max(1, r.w * 0.045);
  ctx.strokeRect(r.x, r.y, r.w, r.h);
  if (r.w > 22) {
    ctx.lineWidth = Math.max(1, r.w * 0.03);
    ctx.beginPath();
    ctx.moveTo(r.x + r.w / 2, r.y);
    ctx.lineTo(r.x + r.w / 2, r.y + r.h);
    ctx.stroke();
  }

  // Volets roulants à moitié descendus : très français, très pratique.
  if (apt.blinds && !apt.lightOn) {
    ctx.fillStyle = rgba('#b8a890', 0.9);
    ctx.fillRect(r.x, r.y, r.w, r.h * 0.35);
    ctx.strokeStyle = rgba('#8a7a64', 0.6);
    ctx.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
      const yy = r.y + (r.h * 0.35 / 5) * i;
      ctx.beginPath();
      ctx.moveTo(r.x, yy);
      ctx.lineTo(r.x + r.w, yy);
      ctx.stroke();
    }
  }

  // Notes de musique qui s'échappent.
  if (apt.musicOn && r.w > 18) {
    ctx.save();
    ctx.font = `${Math.round(r.w * 0.28)}px serif`;
    for (let i = 0; i < 2; i++) {
      const p = ((time * 0.4 + i * 0.5 + apt.id * 0.1) % 1);
      ctx.globalAlpha = (1 - p) * 0.8;
      ctx.fillStyle = '#ffd0e0';
      ctx.fillText(i ? '♫' : '♪', r.x + r.w * (0.7 + i * 0.15), r.y - p * r.h * 0.7);
    }
    ctx.restore();
  }

  // Deuil : un voile sombre sur la fenêtre pendant quelques jours.
  if (world.clock.tick < apt.mourningUntil) {
    ctx.fillStyle = rgba('#1a1520', 0.35);
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
}

function drawSilhouettes(ctx, world, r, occupants, time) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  const floorY = r.y + r.h * 1.02;
  const shown = occupants.slice(0, 3);
  shown.forEach((p, i) => {
    // Les habitants se répartissent dans la pièce au lieu de se planter
    // tous au milieu de la vitre, face à la rue.
    const lane = shown.length > 1 ? (i + 0.5) / shown.length : 0.5;
    const sway = Math.sin(time * 0.35 + p.id * 1.7) * 0.12;
    const px = r.x + r.w * Math.max(0.14, Math.min(0.86, lane + sway));
    const h = r.h * (p.age < 12 ? 0.5 : 0.66);
    drawTinySilhouette(ctx, p, px, floorY, h, time);
  });
  ctx.restore();
}

/**
 * Silhouette de fenêtre.
 *
 * Ce sont des gens à contre-jour derrière un rideau, pas des ombres.
 * Trois choses les rendaient inquiétantes : le noir presque pur, la
 * posture figée de face, et la taille — ils remplissaient la vitre. On
 * les dessine donc plus petits, en brun chaud translucide, de trois
 * quarts, et occupés à quelque chose.
 */
function drawTinySilhouette(ctx, person, x, y, h, time) {
  const t = time + person.id * 1.3;
  const act = person.action?.id;
  const side = person.id % 2 ? 1 : -1;

  // Brun chaud, jamais noir : la lampe est derrière eux, elle traverse.
  const body = 'rgba(96,58,36,0.62)';
  const dark = 'rgba(74,42,26,0.7)';
  ctx.fillStyle = body;
  ctx.strokeStyle = body;

  if (act === 'dormir' || act === 'soigner') {
    // Allongé, tout en bas : à peine une bosse sous une couverture.
    ctx.globalAlpha = 0.5;
    roundRect(ctx, x - h * 0.42, y - h * 0.2, h * 0.84, h * 0.2, h * 0.09);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x - h * 0.34, y - h * 0.26, h * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    return;
  }

  const sitting = act === 'tv' || act === 'lire' || act === 'jeu'
    || act === 'manger' || act === 'ruminer' || act === 'boire'
    || act === 'teletravail' || act === 'chercher_emploi';
  const busy = act === 'cuisiner' || act === 'menage' || act === 'bricoler'
    || (person.action?.def?.noise ?? 0) > 0.3;
  const dancing = act === 'musique' || act === 'fete' || act === 'invite';

  const scale = sitting ? 0.72 : 1;
  const bob = dancing ? Math.abs(Math.sin(t * 4)) * h * 0.05
    : busy ? Math.abs(Math.sin(t * 3)) * h * 0.015
      : Math.sin(t * 1.2) * h * 0.008;
  const hipY = y - h * 0.02;
  const shY = hipY - h * 0.42 * scale - bob;
  const headR = h * 0.135;
  const headY = shY - headR * 1.15;

  // Buste : des épaules arrondies, pas un trapèze coupé au couteau.
  ctx.beginPath();
  ctx.moveTo(x - h * 0.13, hipY);
  ctx.quadraticCurveTo(x - h * 0.15, shY + h * 0.04, x - h * 0.1, shY);
  ctx.quadraticCurveTo(x, shY - h * 0.03, x + h * 0.1, shY);
  ctx.quadraticCurveTo(x + h * 0.15, shY + h * 0.04, x + h * 0.13, hipY);
  ctx.closePath();
  ctx.fill();

  if (sitting) {
    // Les cuisses partent sur le côté : on voit tout de suite que c'est assis.
    ctx.beginPath();
    roundRect(ctx, x + (side > 0 ? 0 : -h * 0.3), hipY - h * 0.05, h * 0.3, h * 0.09, h * 0.04);
    ctx.fill();
  }

  // Bras.
  const swing = dancing ? Math.sin(t * 4) * h * 0.22
    : busy ? Math.sin(t * 4.5) * h * 0.14
      : Math.sin(t * 1.1) * h * 0.03;
  ctx.lineWidth = h * 0.065;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - h * 0.1, shY + h * 0.03);
  ctx.lineTo(x - h * 0.17, shY + h * 0.22 + swing);
  ctx.moveTo(x + h * 0.1, shY + h * 0.03);
  ctx.lineTo(x + h * 0.17, shY + h * 0.22 - swing);
  ctx.stroke();

  // Tête de trois quarts : décalée et penchée, jamais plein axe vers la rue.
  const turn = Math.sin(t * 0.5) * h * 0.03 + side * h * 0.02;
  ctx.beginPath();
  ctx.ellipse(x + turn, headY, headR * 0.92, headR, side * 0.12, 0, Math.PI * 2);
  ctx.fill();
  // Une nuque plus dense : ça suffit à donner une direction au regard.
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.ellipse(x + turn - side * headR * 0.25, headY - headR * 0.2,
    headR * 0.75, headR * 0.7, side * 0.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawCurtains(ctx, apt, r, time) {
  if (apt.hidden) {
    // Rideaux tirés, immobiles, depuis toujours.
    ctx.fillStyle = 'rgba(20,20,26,0.92)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    return;
  }
  const color = pickStable(PALETTE.curtains, `rideau${apt.id}`);
  const closed = apt.curtains === 'closed';
  const breathe = Math.sin(time * 0.8 + apt.id) * r.w * 0.012;

  ctx.save();
  ctx.globalAlpha = closed ? 0.93 : 0.85;
  ctx.fillStyle = color;
  if (closed) {
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = rgba(shade(color, -0.3), 0.35);
    ctx.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
      const xx = r.x + (r.w / 5) * i + breathe * (i % 2 ? 1 : -1);
      ctx.beginPath();
      ctx.moveTo(xx, r.y);
      ctx.lineTo(xx, r.y + r.h);
      ctx.stroke();
    }
  } else {
    // Deux pans sur les côtés, qui respirent un peu.
    const pw = r.w * 0.2;
    ctx.beginPath();
    ctx.moveTo(r.x, r.y);
    ctx.lineTo(r.x + pw + breathe, r.y);
    ctx.quadraticCurveTo(r.x + pw * 0.6 + breathe, r.y + r.h * 0.5, r.x + pw + breathe, r.y + r.h);
    ctx.lineTo(r.x, r.y + r.h);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(r.x + r.w, r.y);
    ctx.lineTo(r.x + r.w - pw - breathe, r.y);
    ctx.quadraticCurveTo(r.x + r.w - pw * 0.6 - breathe, r.y + r.h * 0.5, r.x + r.w - pw - breathe, r.y + r.h);
    ctx.lineTo(r.x + r.w, r.y + r.h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawStairwell(ctx, world, layout, apt, time, amb) {
  const c = layout.cellRect(apt);
  const r = { x: c.x + c.w * 0.3, y: c.y + c.h * 0.14, w: c.w * 0.4, h: c.h * 0.72 };
  // La cage d'escalier n'est jamais complètement noire : il y a toujours
  // une veilleuse quelque part, et ça donne à l'immeuble sa colonne
  // vertébrale lumineuse la nuit.
  ctx.fillStyle = amb > 0.5 ? 'rgba(170,180,185,0.45)' : 'rgba(150,120,70,0.42)';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = amb > 0.5 ? 'rgba(255,255,255,0.1)' : 'rgba(255,205,140,0.12)';
  ctx.fillRect(r.x, r.y + r.h * 0.62, r.w, r.h * 0.08);
  // La minuterie du hall, qui s'allume quand quelqu'un passe.
  const someone = (Math.sin(time * 0.31 + apt.floor * 2.1) > 0.86);
  if (someone) {
    ctx.fillStyle = 'rgba(255,210,140,0.55)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = 'rgba(30,20,15,0.6)';
    const px = r.x + r.w * (0.3 + Math.sin(time * 2 + apt.floor) * 0.2);
    ctx.beginPath();
    ctx.ellipse(px, r.y + r.h * 0.62, r.w * 0.12, r.h * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = rgba(PALETTE.frameDark, 0.5);
  ctx.lineWidth = 1;
  ctx.strokeRect(r.x, r.y, r.w, r.h);
}

// --- Décor ------------------------------------------------------------------

function drawStars(ctx, w, h, seed, amb) {
  ctx.save();
  ctx.globalAlpha = (0.35 - amb) * 2.4;
  for (let i = 0; i < 90; i++) {
    const x = ((i * 9301 + 49297) % 233280) / 233280 * w;
    const y = ((i * 4523 + 1013) % 233280) / 233280 * h * 0.5;
    const s = ((i * 7919) % 100) / 100;
    ctx.fillStyle = `rgba(255,250,235,${0.3 + s * 0.6})`;
    ctx.fillRect(x, y, 1.4, 1.4);
  }
  ctx.restore();
}

function drawSunMoon(ctx, world, w, h, amb) {
  const f = world.clock.dayFraction;
  // Le soleil traverse le ciel de 6 h à 20 h, la lune prend le reste.
  const isDay = f > 0.25 && f < 0.85;
  const p = isDay ? (f - 0.25) / 0.6 : ((f + 0.15) % 1) / 0.4;
  const x = w * (0.12 + p * 0.76);
  const y = h * (0.42 - Math.sin(p * Math.PI) * 0.32);
  ctx.save();
  if (isDay) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, h * 0.12);
    g.addColorStop(0, 'rgba(255,240,190,0.95)');
    g.addColorStop(1, 'rgba(255,220,150,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - h * 0.12, y - h * 0.12, h * 0.24, h * 0.24);
    ctx.fillStyle = '#fff4d0';
    ctx.beginPath();
    ctx.arc(x, y, h * 0.026, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = 'rgba(240,240,225,0.9)';
    ctx.beginPath();
    ctx.arc(x, y, h * 0.022, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = rgba(skyColors(f, world.clock.season).top, 0.95);
    ctx.beginPath();
    ctx.arc(x + h * 0.009, y - h * 0.007, h * 0.021, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawStreetLife(ctx, world, layout, time, amb) {
  const sy = layout.streetY;
  const sh = layout.streetH;
  const w = layout.width;

  // Réverbère : le halo du soir, obligatoire.
  const lampX = layout.x - Math.max(24, layout.cellW * 0.5);
  if (amb < 0.55) {
    const g = ctx.createRadialGradient(lampX, sy - sh * 0.4, 0, lampX, sy - sh * 0.4, sh * 2.4);
    g.addColorStop(0, `rgba(255,215,150,${0.32 * (1 - amb)})`);
    g.addColorStop(1, 'rgba(255,215,150,0)');
    ctx.fillStyle = g;
    ctx.fillRect(lampX - sh * 2.4, sy - sh * 2.6, sh * 4.8, sh * 3.4);
    ctx.fillStyle = '#ffe0a8';
    ctx.beginPath();
    ctx.arc(lampX, sy - sh * 0.95, Math.max(3, sh * 0.06), 0, Math.PI * 2);
    ctx.fill();
  }

  // Le chat de personne, quand il daigne passer.
  if (world.secrets.catAt !== null) {
    const apt = world.apartments[world.secrets.catAt];
    if (apt) {
      const c = layout.cellRect(apt);
      drawCat(ctx, c.x + c.w * (0.5 + Math.sin(time * 0.4) * 0.25), c.y + c.h * 0.94, Math.max(8, c.w * 0.16));
    }
  }

  // Un passant traverse de temps en temps.
  const walkP = (time * 0.035) % 1;
  if (walkP < 0.6) {
    const px = w * (walkP / 0.6) * 1.1 - w * 0.05;
    drawPasserby(ctx, px, sy + sh * 0.55, sh * 0.42, time);
  }
}

function drawCat(ctx, x, y, s) {
  ctx.save();
  ctx.fillStyle = '#3a332c';
  ctx.beginPath();
  ctx.ellipse(x, y - s * 0.3, s * 0.5, s * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + s * 0.42, y - s * 0.5, s * 0.22, 0, Math.PI * 2);
  ctx.fill();
  // Oreilles.
  ctx.beginPath();
  ctx.moveTo(x + s * 0.3, y - s * 0.64);
  ctx.lineTo(x + s * 0.36, y - s * 0.86);
  ctx.lineTo(x + s * 0.45, y - s * 0.66);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + s * 0.5, y - s * 0.66);
  ctx.lineTo(x + s * 0.58, y - s * 0.86);
  ctx.lineTo(x + s * 0.62, y - s * 0.62);
  ctx.closePath();
  ctx.fill();
  // Queue.
  ctx.strokeStyle = '#3a332c';
  ctx.lineWidth = s * 0.12;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - s * 0.45, y - s * 0.3);
  ctx.quadraticCurveTo(x - s * 0.8, y - s * 0.7, x - s * 0.6, y - s * 0.95);
  ctx.stroke();
  ctx.restore();
}

function drawPasserby(ctx, x, y, h, time) {
  ctx.save();
  ctx.fillStyle = 'rgba(40,32,26,0.75)';
  const bob = Math.abs(Math.sin(time * 6)) * h * 0.03;
  ctx.beginPath();
  ctx.ellipse(x, y - h * 0.62 - bob, h * 0.14, h * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y - h * 0.95 - bob, h * 0.13, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,32,26,0.75)';
  ctx.lineWidth = h * 0.07;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y - h * 0.4);
  ctx.lineTo(x + Math.sin(time * 6) * h * 0.16, y);
  ctx.moveTo(x, y - h * 0.4);
  ctx.lineTo(x - Math.sin(time * 6) * h * 0.16, y);
  ctx.stroke();
  ctx.restore();
}

// --- Calque dur (mis en cache) ---------------------------------------------

export function buildStaticLayer(world, layout) {
  const canvas = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(layout.width, layout.height)
    : Object.assign(document.createElement('canvas'), { width: layout.width, height: layout.height });
  const ctx = canvas.getContext('2d');
  const facadeColor = pickStable(PALETTE.facade, world.seed);

  // Corps du bâtiment.
  ctx.fillStyle = facadeColor;
  ctx.fillRect(layout.x, layout.y, layout.w, layout.h);

  // Grain de crépi : quelques milliers de points, et le mur cesse d'être plat.
  ctx.save();
  for (let i = 0; i < 2600; i++) {
    const x = layout.x + ((i * 9301 + 49297) % 233280) / 233280 * layout.w;
    const y = layout.y + ((i * 4523 + 1013) % 233280) / 233280 * layout.h;
    const v = ((i * 7919) % 100) / 100;
    ctx.fillStyle = `rgba(${v > 0.5 ? '255,255,255' : '0,0,0'},0.045)`;
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.restore();

  // Bandeaux d'étage.
  for (let f = 1; f < world.floors; f++) {
    const y = layout.y + (world.floors - f) * layout.cellH;
    ctx.fillStyle = rgba(PALETTE.facadeLight, 0.35);
    ctx.fillRect(layout.x, y - layout.cellH * 0.04, layout.w, layout.cellH * 0.02);
    ctx.fillStyle = rgba(PALETTE.facadeShade, 0.3);
    ctx.fillRect(layout.x, y - layout.cellH * 0.02, layout.w, layout.cellH * 0.012);
  }

  // Toit et cheminées.
  ctx.fillStyle = shade(facadeColor, -0.35);
  ctx.fillRect(layout.x - layout.cellW * 0.08, layout.y - layout.cellH * 0.1, layout.w + layout.cellW * 0.16, layout.cellH * 0.1);
  ctx.fillStyle = '#8a5a48';
  for (let i = 0; i < 3; i++) {
    const cx = layout.x + layout.w * (0.18 + i * 0.32);
    ctx.fillRect(cx, layout.y - layout.cellH * 0.42, layout.cellW * 0.16, layout.cellH * 0.33);
    ctx.fillStyle = '#6d4638';
    ctx.fillRect(cx - layout.cellW * 0.02, layout.y - layout.cellH * 0.46, layout.cellW * 0.2, layout.cellH * 0.05);
    ctx.fillStyle = '#8a5a48';
  }
  // Antennes.
  ctx.strokeStyle = 'rgba(40,40,45,0.8)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 2; i++) {
    const ax = layout.x + layout.w * (0.42 + i * 0.3);
    ctx.beginPath();
    ctx.moveTo(ax, layout.y - layout.cellH * 0.1);
    ctx.lineTo(ax, layout.y - layout.cellH * 0.55);
    for (let j = 0; j < 3; j++) {
      const yy = layout.y - layout.cellH * (0.25 + j * 0.1);
      ctx.moveTo(ax - layout.cellW * 0.08, yy);
      ctx.lineTo(ax + layout.cellW * 0.08, yy);
    }
    ctx.stroke();
  }

  // Décor par appartement : balcons, plantes, linge, paraboles.
  for (const apt of world.apartments) {
    const c = layout.cellRect(apt);
    if (apt.special === SPECIAL_UNITS.HALL) {
      drawEntranceDoor(ctx, c, world);
      continue;
    }
    if (apt.special === SPECIAL_UNITS.COMMERCE) {
      drawShop(ctx, c, world, apt);
      continue;
    }
    if (apt.special === SPECIAL_UNITS.ESCALIER) {
      // La cage d'escalier a son bandeau vitré, dessiné à chaque image.
      continue;
    }
    // Appui de fenêtre.
    const r = layout.windowRect(apt);
    ctx.fillStyle = shade(facadeColor, 0.28);
    ctx.fillRect(r.x - r.w * 0.06, r.y + r.h, r.w * 1.12, Math.max(2, c.h * 0.028));

    if (apt.balcony) drawBalcony(ctx, apt, c, r, facadeColor);
    if (apt.dish && !apt.hidden) drawDish(ctx, c);
    if (apt.flag && !apt.hidden) drawFlag(ctx, c);
  }

  // Descentes d'eau.
  ctx.strokeStyle = rgba(PALETTE.facadeShade, 0.55);
  ctx.lineWidth = Math.max(2, layout.cellW * 0.035);
  for (const cx of [layout.x + layout.w * 0.005, layout.x + layout.w * 0.995]) {
    ctx.beginPath();
    ctx.moveTo(cx, layout.y);
    ctx.lineTo(cx, layout.streetY);
    ctx.stroke();
  }

  drawStreet(ctx, world, layout);
  return { canvas, ctx };
}

function drawBalcony(ctx, apt, c, r, facadeColor) {
  const bx = c.x + c.w * 0.08;
  const bw = c.w * 0.84;
  const by = r.y + r.h + c.h * 0.02;
  const bh = c.h * 0.16;

  // Garde-corps en ferronnerie.
  ctx.strokeStyle = 'rgba(50,48,44,0.85)';
  ctx.lineWidth = Math.max(1.2, c.w * 0.018);
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.lineTo(bx, by + bh);
  ctx.moveTo(bx + bw, by);
  ctx.lineTo(bx + bw, by + bh);
  ctx.moveTo(bx, by + bh * 0.1);
  ctx.lineTo(bx + bw, by + bh * 0.1);
  ctx.moveTo(bx, by + bh);
  ctx.lineTo(bx + bw, by + bh);
  ctx.stroke();
  ctx.lineWidth = Math.max(0.8, c.w * 0.009);
  const bars = Math.max(4, Math.floor(bw / Math.max(4, c.w * 0.09)));
  ctx.beginPath();
  for (let i = 1; i < bars; i++) {
    const xx = bx + (bw / bars) * i;
    ctx.moveTo(xx, by + bh * 0.1);
    ctx.lineTo(xx, by + bh);
  }
  ctx.stroke();

  // Dalle.
  ctx.fillStyle = shade(facadeColor, -0.15);
  ctx.fillRect(bx - c.w * 0.02, by + bh, bw + c.w * 0.04, Math.max(2, c.h * 0.03));

  if (apt.hidden) return;

  // Pots de fleurs.
  for (let i = 0; i < apt.plants; i++) {
    const px = bx + bw * (0.15 + i * 0.32);
    ctx.fillStyle = '#a9613f';
    ctx.fillRect(px, by + bh * 0.55, c.w * 0.09, bh * 0.45);
    ctx.fillStyle = i === 1 ? '#7d9c5a' : '#5d7f4e';
    ctx.beginPath();
    ctx.arc(px + c.w * 0.045, by + bh * 0.5, c.w * 0.07, 0, Math.PI * 2);
    ctx.fill();
  }

  // Linge qui sèche : le détail qui dit « des gens vivent ici ».
  if (apt.laundry) {
    ctx.strokeStyle = 'rgba(240,235,225,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx + bw * 0.1, by + bh * 0.12);
    ctx.quadraticCurveTo(bx + bw * 0.5, by + bh * 0.3, bx + bw * 0.9, by + bh * 0.12);
    ctx.stroke();
    const colors = ['#e8e2d6', '#a8bfd0', '#d9a3a3', '#e0c88a'];
    for (let i = 0; i < 4; i++) {
      const t = 0.15 + i * 0.22;
      const lx = bx + bw * t;
      const ly = by + bh * (0.14 + Math.sin(t * Math.PI) * 0.12);
      ctx.fillStyle = colors[(apt.id + i) % colors.length];
      ctx.fillRect(lx, ly, c.w * 0.07, bh * 0.42);
    }
  }
}

function drawDish(ctx, c) {
  const x = c.x + c.w * 0.82;
  const y = c.y + c.h * 0.22;
  const r = c.w * 0.11;
  ctx.fillStyle = 'rgba(225,222,214,0.9)';
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.6, r, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(80,78,72,0.8)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - r * 0.7, y + r * 0.5);
  ctx.stroke();
}

function drawFlag(ctx, c) {
  const x = c.x + c.w * 0.12;
  const y = c.y + c.h * 0.2;
  ctx.strokeStyle = 'rgba(60,58,54,0.8)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + c.h * 0.2);
  ctx.stroke();
  ctx.fillStyle = '#b5563f';
  ctx.fillRect(x, y, c.w * 0.16, c.h * 0.07);
}

function drawEntranceDoor(ctx, c, world) {
  const dw = c.w * 0.52;
  const dh = c.h * 0.72;
  const x = c.x + (c.w - dw) / 2;
  const y = c.y + c.h - dh;
  ctx.fillStyle = '#3f5a4a';
  ctx.fillRect(x, y, dw, dh);
  ctx.fillStyle = 'rgba(180,205,200,0.35)';
  ctx.fillRect(x + dw * 0.12, y + dh * 0.1, dw * 0.76, dh * 0.5);
  ctx.strokeStyle = '#2a3e33';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, dw, dh);
  ctx.beginPath();
  ctx.moveTo(x + dw / 2, y);
  ctx.lineTo(x + dw / 2, y + dh);
  ctx.stroke();
  // Auvent, digicode, plaque.
  ctx.fillStyle = shade('#3f5a4a', -0.3);
  ctx.fillRect(x - dw * 0.12, y - c.h * 0.06, dw * 1.24, c.h * 0.06);
  ctx.fillStyle = '#2b2b2b';
  ctx.fillRect(x + dw * 1.06, y + dh * 0.35, c.w * 0.07, c.h * 0.12);
  ctx.fillStyle = '#d8d2c4';
  ctx.font = `${Math.max(6, c.h * 0.07)}px "Trebuchet MS", sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(`${world.floors * world.cols > 60 ? '14' : '8'} RUE DES LILAS`, x + dw / 2, y - c.h * 0.09);
  ctx.textAlign = 'left';
}

function drawShop(ctx, c, world, apt) {
  ctx.fillStyle = '#2f3a44';
  ctx.fillRect(c.x, c.y + c.h * 0.28, c.w, c.h * 0.72);
  // Vitrine éclairée.
  ctx.fillStyle = 'rgba(255,215,150,0.55)';
  ctx.fillRect(c.x + c.w * 0.06, c.y + c.h * 0.38, c.w * 0.88, c.h * 0.44);
  // Store rayé.
  const stripes = 6;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 ? '#c9453f' : '#f0e6d4';
    ctx.fillRect(c.x + (c.w / stripes) * i, c.y + c.h * 0.2, c.w / stripes, c.h * 0.12);
  }
  if (apt.col % 2 === 0) {
    ctx.fillStyle = '#f4ecdc';
    ctx.font = `bold ${Math.max(7, c.h * 0.1)}px "Trebuchet MS", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('ALIMENTATION', c.x + c.w / 2, c.y + c.h * 0.17);
    ctx.textAlign = 'left';
  }
}

function drawStreet(ctx, world, layout) {
  const y = layout.streetY;
  const h = layout.streetH;
  const w = layout.width;

  // Trottoir puis chaussée.
  ctx.fillStyle = '#8d8577';
  ctx.fillRect(0, y, w, h * 0.42);
  ctx.fillStyle = PALETTE.street;
  ctx.fillRect(0, y + h * 0.42, w, h * 0.58);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  ctx.setLineDash([18, 16]);
  ctx.beginPath();
  ctx.moveTo(0, y + h * 0.78);
  ctx.lineTo(w, y + h * 0.78);
  ctx.stroke();
  ctx.setLineDash([]);

  // Dalles du trottoir.
  ctx.strokeStyle = 'rgba(0,0,0,0.1)';
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += Math.max(20, h * 0.3)) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + h * 0.42);
    ctx.stroke();
  }

  // Réverbère.
  const lampX = layout.x - Math.max(24, layout.cellW * 0.5);
  ctx.strokeStyle = '#3a3a38';
  ctx.lineWidth = Math.max(3, h * 0.05);
  ctx.beginPath();
  ctx.moveTo(lampX, y + h * 0.4);
  ctx.lineTo(lampX, y - h * 0.9);
  ctx.stroke();
  ctx.fillStyle = '#4a4a46';
  ctx.beginPath();
  ctx.ellipse(lampX, y - h * 0.95, h * 0.12, h * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();

  // Poubelles.
  const binX = layout.x + layout.w + Math.max(14, layout.cellW * 0.25);
  for (let i = 0; i < 2; i++) {
    ctx.fillStyle = i ? '#4a6b4a' : '#5a5f66';
    roundRect(ctx, binX + i * h * 0.34, y - h * 0.02, h * 0.3, h * 0.42, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(binX + i * h * 0.34, y - h * 0.04, h * 0.3, h * 0.06);
  }

  // Un arbre maigre, comme dans toutes les rues.
  const tx = layout.x + layout.w * 0.5;
  ctx.fillStyle = '#5a4436';
  ctx.fillRect(tx - h * 0.03, y - h * 0.5, h * 0.06, h * 0.55);
  ctx.fillStyle = '#5f7a4a';
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(tx + Math.cos(i * 1.7) * h * 0.16, y - h * 0.6 + Math.sin(i * 1.7) * h * 0.12, h * 0.19, 0, Math.PI * 2);
    ctx.fill();
  }

  // Scooter garé, et le tag qui va avec.
  const sx = layout.x + layout.w * 0.78;
  ctx.fillStyle = '#7a3f3f';
  roundRect(ctx, sx, y - h * 0.16, h * 0.34, h * 0.14, 4);
  ctx.fill();
  ctx.fillStyle = '#2a2a2a';
  for (const wx of [sx + h * 0.05, sx + h * 0.29]) {
    ctx.beginPath();
    ctx.arc(wx, y + h * 0.02, h * 0.07, 0, Math.PI * 2);
    ctx.fill();
  }
}

// --- Météo -------------------------------------------------------------------
//
// Les ambiances de la planche : jour pluvieux, hiver qui neige, canicule.
// Un calque par-dessus la façade — la pluie raye, la neige flotte, la
// canicule écrase tout d'un voile chaud qui tremble au ras de la rue.

export function drawWeather(ctx, weather, w, h, t) {
  if (!weather || weather.id === 'clair') return;
  const k = weather.intensity ?? 0.6;
  ctx.save();

  if (weather.id === 'pluie') {
    ctx.fillStyle = 'rgba(56,66,86,0.12)';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(200,214,234,0.5)';
    ctx.lineWidth = 1.2;
    const n = Math.round(190 * k);
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      // Chaque goutte a sa colonne et sa phase : pas deux fois la même pluie.
      const seed = i * 127.3;
      const x = ((seed * 7.13) % 1.07) * w;
      const speed = 620 + (i % 5) * 90;
      const y = ((seed + t * speed) % (h + 60)) - 30;
      ctx.moveTo(x, y);
      ctx.lineTo(x - 4, y + 19);
    }
    ctx.stroke();
  } else if (weather.id === 'neige') {
    ctx.fillStyle = 'rgba(200,208,220,0.1)';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(245,248,252,0.85)';
    const n = Math.round(70 * k);
    for (let i = 0; i < n; i++) {
      const seed = i * 91.7;
      const x = (((seed * 3.7) % 1.03) * w + Math.sin(t * 0.8 + i) * 18) % w;
      const speed = 34 + (i % 4) * 12;
      const y = ((seed + t * speed) % (h + 20)) - 10;
      ctx.beginPath();
      ctx.arc(x, y, 1.1 + (i % 3) * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (weather.id === 'canicule') {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,196,110,0.1)');
    g.addColorStop(1, 'rgba(255,150,70,0.16)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // L'air qui tremble au ras du bitume.
    ctx.strokeStyle = 'rgba(255,220,160,0.18)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      for (let x = 0; x <= w; x += 14) {
        const y = h * (0.86 + i * 0.04) + Math.sin(x * 0.05 + t * (3 + i)) * 3;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}
