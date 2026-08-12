// L'intérieur d'un appartement, vu en coupe.
//
// Quand le mur disparaît, il faut que la pièce raconte déjà quelque chose :
// qui vit là, s'il range, s'il a de l'argent, s'il est seul. Le décor est
// tiré de l'appartement et de ses occupants — deux logements du même
// immeuble ne se ressemblent jamais tout à fait.

import { PALETTE, pickStable, shade, rgba, ambientLight, skyColors, mixHex } from './palette.js';
import { drawCharacter, drawSpeech, roundRect, appearance } from './character.js';

/** Où se tient quelqu'un en fonction de ce qu'il fait. */
const ZONES = {
  entree: 0.07,
  cuisine: 0.22,
  table: 0.37,
  salon: 0.54,
  fenetre: 0.70,
  lit: 0.85,
  bain: 0.955,
};

export function zoneFor(person) {
  const id = person.action?.id;
  switch (id) {
    case 'dormir':
    case 'soigner': return ZONES.lit;
    case 'insomnie': return ZONES.fenetre;
    case 'cuisiner': return ZONES.cuisine;
    case 'manger': return ZONES.table;
    case 'douche': return ZONES.bain;
    case 'tv':
    case 'jeu':
    case 'ruminer':
    case 'boire':
    case 'lire': return ZONES.salon;
    case 'teletravail':
    case 'chercher_emploi': return ZONES.table;
    case 'menage': return 0.3;
    case 'bricoler': return 0.45;
    case 'sport': return 0.6;
    case 'espionner': return ZONES.entree;
    case 'telephoner': return ZONES.fenetre;
    case 'musique':
    case 'fete':
    case 'invite': return ZONES.salon;
    case 'famille_temps': return ZONES.table;
    case 'betise': return 0.66;
    default: return ZONES.salon;
  }
}

/** Fait glisser les habitants vers leur zone. Purement visuel. */
export function updatePositions(world, apt, dt) {
  const occupants = occupantsOf(world, apt);
  occupants.forEach((p, i) => {
    const base = zoneFor(p);
    // On décale les gens qui partagent une zone pour qu'ils ne se superposent pas.
    const same = occupants.filter((q) => Math.abs(zoneFor(q) - base) < 0.02);
    const rank = same.indexOf(p);
    // Assez d'écart pour que personne ne se superpose, et un rang de
    // profondeur pour que le groupe ait de l'épaisseur.
    const offset = same.length > 1 ? (rank - (same.length - 1) / 2) * 0.115 : 0;
    p.zRank = same.length > 1 ? (rank % 2) : 0;
    const target = Math.max(0.04, Math.min(0.96, base + offset));
    const dx = target - p.pos.x;
    if (Math.abs(dx) > 0.004) {
      const step = Math.sign(dx) * Math.min(Math.abs(dx), dt * 0.22);
      p.pos.x += step;
      p.facing = Math.sign(dx) || p.facing;
      p.walking = true;
    } else {
      p.pos.x = target;
      p.walking = false;
    }
  });
}

export function occupantsOf(world, apt) {
  return world.occupancy.get(apt.id) ?? [];
}

/**
 * Dessine l'intérieur.
 * @param {object} rect { x, y, w, h } en pixels écran
 */
export function drawInterior(ctx, world, apt, rect, time, opts = {}) {
  const { x, y, w, h } = rect;
  const detail = opts.detail ?? 1; // 0 = vignette lointaine, 1 = plein écran
  const style = apt.style % 6;
  const occupants = occupantsOf(world, apt);
  const messy = clutterLevel(world, apt, occupants);
  const wealth = wealthLevel(world, occupants);

  const floorH = h * 0.14;
  const floorY = y + h - floorH;
  const wallColor = PALETTE.wall[style];
  const floorColor = PALETTE.floor[apt.id % PALETTE.floor.length];

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  // --- Murs et sol ---
  ctx.fillStyle = wallColor;
  ctx.fillRect(x, y, w, h);

  // Papier peint : rayures ou motif discret selon le style.
  if (detail > 0.4) {
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = PALETTE.wallpaper[style % 3];
    if (style % 3 === 0) {
      for (let i = 0; i < w; i += Math.max(8, w * 0.035)) ctx.fillRect(x + i, y, Math.max(3, w * 0.012), h);
    } else if (style % 3 === 1) {
      const s = Math.max(10, w * 0.05);
      for (let i = 0; i < w; i += s) {
        for (let j = 0; j < h; j += s) {
          ctx.beginPath();
          ctx.arc(x + i + s / 2, y + j + s / 2, s * 0.12, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  // Plinthe et sol.
  ctx.fillStyle = floorColor;
  ctx.fillRect(x, floorY, w, floorH);
  ctx.fillStyle = rgba(shade(floorColor, -0.3), 0.5);
  ctx.fillRect(x, floorY, w, Math.max(1, h * 0.008));
  if (detail > 0.5) {
    ctx.strokeStyle = rgba(shade(floorColor, -0.35), 0.35);
    ctx.lineWidth = 1;
    for (let i = 0; i < w; i += Math.max(14, w * 0.06)) {
      ctx.beginPath();
      ctx.moveTo(x + i, floorY);
      ctx.lineTo(x + i - w * 0.02, y + h);
      ctx.stroke();
    }
  }

  const U = (u) => x + u * w;        // coordonnée horizontale normalisée
  const V = floorY;                   // ligne de sol

  // --- Fenêtre du fond : elle laisse entrer l'heure qu'il est ---
  drawBackWindow(ctx, world, U(ZONES.fenetre), y + h * 0.16, w * 0.15, h * 0.4, time);

  // --- Mobilier, de gauche à droite ---
  drawEntrance(ctx, U(ZONES.entree), V, w, h, detail);
  drawKitchen(ctx, U(ZONES.cuisine), V, w, h, style, wealth, detail, messy);
  drawTable(ctx, U(ZONES.table), V, w, h, style, detail);
  drawLiving(ctx, U(ZONES.salon), V, w, h, style, wealth, detail, apt);
  drawBed(ctx, U(ZONES.lit), V, w, h, style, detail);
  drawBathroom(ctx, U(ZONES.bain), V, w, h, detail);

  // Détails qui font l'appartement : plantes, cadres, désordre.
  if (detail > 0.35) {
    for (let i = 0; i < apt.plants; i++) {
      drawPlant(ctx, U(0.13 + i * 0.29), V, h * (0.12 + (i % 2) * 0.04));
    }
    drawFrames(ctx, x, y, w, h, apt, occupants, detail);
    if (messy > 0.3) drawClutter(ctx, x, floorY, w, h, messy, apt.id);
  }

  // --- Lumière ---
  const amb = ambientLight(world.clock.dayFraction);
  const lampOn = apt.lightOn;
  if (amb < 0.75) {
    // Nuit : on assombrit tout, puis on rallume autour des lampes.
    ctx.fillStyle = rgba('#0b1020', (1 - amb) * (lampOn ? 0.35 : 0.72));
    ctx.fillRect(x, y, w, h);
    if (lampOn) {
      const g = ctx.createRadialGradient(U(0.5), y + h * 0.3, 0, U(0.5), y + h * 0.3, w * 0.62);
      g.addColorStop(0, 'rgba(255,205,130,0.34)');
      g.addColorStop(1, 'rgba(255,190,120,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
    }
  }
  // Lueur de télévision : bleutée, clignotante, sur le mur d'en face.
  if (apt.tvOn) {
    const flick = 0.16 + Math.sin(time * 9 + apt.id) * 0.06 + Math.sin(time * 23) * 0.03;
    const g = ctx.createRadialGradient(U(0.5), y + h * 0.55, 0, U(0.5), y + h * 0.55, w * 0.45);
    g.addColorStop(0, `rgba(150,205,235,${Math.max(0, flick)})`);
    g.addColorStop(1, 'rgba(150,205,235,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  }

  // --- Les habitants ---
  // Le pas de temps est indispensable : c'est lui qui pilote le lissage des
  // articulations, donc toute l'animation.
  const charH = h * 0.54;
  const dt = opts.dt ?? 1 / 60;
  // Les gens du fond se dessinent d'abord, un peu plus petits et plus haut :
  // c'est ce qui empêche un groupe de ressembler à une frise.
  const sorted = [...occupants].sort((a, b) => (b.zRank ?? 0) - (a.zRank ?? 0) || a.pos.x - b.pos.x);
  for (const p of sorted) {
    const depth = p.zRank ?? 0;
    const px = U(p.pos.x);
    let py = V + h * 0.02 - depth * h * 0.035;
    let pose;
    if (p.action?.id === 'dormir' || p.action?.id === 'soigner') {
      py = V - h * 0.055;
      pose = 'couche';
    } else if (p.age < 2) {
      pose = 'bebe';
      py = V;
    }
    drawCharacter(ctx, p, px, py, charH * (1 - depth * 0.07), { time, dt, pose, facing: p.facing });
  }

  // Bulles au-dessus, après tout le monde, pour qu'elles ne soient pas cachées.
  if (detail > 0.55) {
    for (const p of sorted) {
      if (!p.speech) continue;
      const alpha = Math.min(1, p.speech.ttl / 8);
      ctx.globalAlpha = alpha;
      drawSpeech(ctx, p.speech.text, U(p.pos.x), V - charH * 0.98, Math.min(w * 0.42, 190), Math.min(1.35, w / 420));
      ctx.globalAlpha = 1;
    }
  }

  ctx.restore();
}

// --- Éléments de décor ------------------------------------------------------

function drawBackWindow(ctx, world, cx, cy, w, h, time) {
  const sky = skyColors(world.clock.dayFraction, world.clock.season);
  const g = ctx.createLinearGradient(0, cy, 0, cy + h);
  g.addColorStop(0, sky.top);
  g.addColorStop(1, sky.bot);
  ctx.fillStyle = g;
  ctx.fillRect(cx - w / 2, cy, w, h);

  // Immeuble d'en face : on n'est jamais seul dans une rue.
  ctx.fillStyle = rgba('#2c3444', 0.55);
  ctx.fillRect(cx - w / 2, cy + h * 0.55, w, h * 0.45);
  ctx.fillStyle = rgba('#ffcf7a', 0.5 + Math.sin(time * 0.5) * 0.1);
  ctx.fillRect(cx - w * 0.28, cy + h * 0.66, w * 0.16, h * 0.12);
  ctx.fillRect(cx + w * 0.1, cy + h * 0.75, w * 0.14, h * 0.1);

  // Croisillons.
  ctx.strokeStyle = PALETTE.frame;
  ctx.lineWidth = Math.max(2, w * 0.055);
  ctx.strokeRect(cx - w / 2, cy, w, h);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx, cy + h);
  ctx.moveTo(cx - w / 2, cy + h / 2);
  ctx.lineTo(cx + w / 2, cy + h / 2);
  ctx.stroke();
}

function drawEntrance(ctx, cx, floorY, w, h, detail) {
  const dw = w * 0.075;
  const dh = h * 0.44;
  ctx.fillStyle = PALETTE.woodDark;
  ctx.fillRect(cx - dw / 2, floorY - dh, dw, dh);
  ctx.strokeStyle = rgba('#000', 0.25);
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - dw / 2, floorY - dh, dw, dh);
  if (detail > 0.5) {
    ctx.fillStyle = PALETTE.metal;
    ctx.beginPath();
    ctx.arc(cx + dw * 0.3, floorY - dh * 0.5, Math.max(1.5, w * 0.006), 0, Math.PI * 2);
    ctx.fill();
    // Le porte-manteau, toujours trop chargé.
    ctx.strokeStyle = PALETTE.wood;
    ctx.lineWidth = Math.max(1.5, w * 0.006);
    ctx.beginPath();
    ctx.moveTo(cx + dw * 0.8, floorY - dh * 1.02);
    ctx.lineTo(cx + dw * 1.6, floorY - dh * 1.02);
    ctx.stroke();
    ctx.fillStyle = PALETTE.fabric[2];
    roundRect(ctx, cx + dw * 0.9, floorY - dh * 1.0, dw * 0.5, dh * 0.4, 3);
    ctx.fill();
  }
}

function drawKitchen(ctx, cx, floorY, w, h, style, wealth, detail, messy) {
  const cw = w * 0.17;
  const ch = h * 0.16;
  // Plan de travail.
  ctx.fillStyle = shade(PALETTE.wood, 0.15);
  ctx.fillRect(cx - cw / 2, floorY - ch, cw, ch);
  ctx.fillStyle = shade(PALETTE.wood, -0.2);
  ctx.fillRect(cx - cw / 2, floorY - ch, cw, h * 0.018);
  if (detail > 0.4) {
    ctx.strokeStyle = rgba('#000', 0.18);
    ctx.beginPath();
    ctx.moveTo(cx, floorY - ch + h * 0.018);
    ctx.lineTo(cx, floorY);
    ctx.stroke();
    // Plaques et casserole.
    ctx.fillStyle = '#333a42';
    ctx.fillRect(cx - cw * 0.4, floorY - ch - h * 0.012, cw * 0.35, h * 0.012);
    ctx.fillStyle = PALETTE.metal;
    roundRect(ctx, cx - cw * 0.36, floorY - ch - h * 0.045, cw * 0.26, h * 0.034, 2);
    ctx.fill();
    // Frigo, couvert d'aimants.
    const fw = cw * 0.42;
    const fh = h * 0.3;
    ctx.fillStyle = wealth > 0.6 ? '#d8dde2' : '#e8e2d6';
    ctx.fillRect(cx + cw * 0.55, floorY - fh, fw, fh);
    ctx.strokeStyle = rgba('#000', 0.2);
    ctx.strokeRect(cx + cw * 0.55, floorY - fh, fw, fh);
    ctx.fillStyle = PALETTE.accent;
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(cx + cw * 0.6 + (i % 2) * fw * 0.4, floorY - fh * 0.85 + i * fh * 0.16, fw * 0.22, fh * 0.1);
    }
    // Vaisselle en attente : chez les désordonnés, il y en a toujours.
    if (messy > 0.45) {
      ctx.fillStyle = '#e6e0d4';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(cx + cw * 0.1 + i * w * 0.012, floorY - ch - h * 0.014 - i * h * 0.008, w * 0.016, h * 0.008, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function drawTable(ctx, cx, floorY, w, h, style, detail) {
  const tw = w * 0.16;
  const th = h * 0.012;
  const ty = floorY - h * 0.15;
  ctx.fillStyle = PALETTE.wood;
  ctx.fillRect(cx - tw / 2, ty, tw, th);
  ctx.fillRect(cx - tw * 0.4, ty + th, w * 0.012, floorY - ty - th);
  ctx.fillRect(cx + tw * 0.34, ty + th, w * 0.012, floorY - ty - th);
  if (detail > 0.45) {
    // Chaises.
    for (const side of [-1, 1]) {
      const chx = cx + side * tw * 0.75;
      ctx.fillStyle = PALETTE.woodDark;
      ctx.fillRect(chx - w * 0.018, floorY - h * 0.09, w * 0.036, h * 0.008);
      ctx.fillRect(chx - side * w * 0.016, floorY - h * 0.17, w * 0.008, h * 0.088);
      ctx.fillRect(chx - w * 0.014, floorY - h * 0.082, w * 0.006, h * 0.082);
      ctx.fillRect(chx + w * 0.008, floorY - h * 0.082, w * 0.006, h * 0.082);
    }
    // Ce qui traîne toujours sur une table : du courrier et un bol.
    ctx.fillStyle = '#f2ece0';
    ctx.fillRect(cx - tw * 0.3, ty - h * 0.012, tw * 0.28, h * 0.012);
    ctx.fillStyle = PALETTE.fabric[3];
    ctx.beginPath();
    ctx.ellipse(cx + tw * 0.2, ty - h * 0.01, w * 0.014, h * 0.01, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawLiving(ctx, cx, floorY, w, h, style, wealth, detail, apt) {
  // Tapis.
  if (detail > 0.4) {
    ctx.fillStyle = rgba(PALETTE.fabric[(apt.id + 2) % PALETTE.fabric.length], 0.55);
    ctx.beginPath();
    ctx.ellipse(cx, floorY + h * 0.012, w * 0.17, h * 0.022, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Canapé.
  const sw = w * 0.2;
  const sh = h * 0.12;
  const sy = floorY - sh;
  const fab = PALETTE.fabric[apt.id % PALETTE.fabric.length];
  ctx.fillStyle = fab;
  roundRect(ctx, cx - sw / 2, sy, sw, sh, h * 0.02);
  ctx.fill();
  ctx.fillStyle = shade(fab, -0.2);
  roundRect(ctx, cx - sw / 2, sy - h * 0.05, sw, h * 0.07, h * 0.02);
  ctx.fill();
  if (detail > 0.5) {
    ctx.fillStyle = shade(fab, 0.25);
    roundRect(ctx, cx - sw * 0.42, sy - h * 0.035, sw * 0.22, h * 0.04, h * 0.012);
    ctx.fill();
  }

  // Télé, sur son meuble.
  const tvw = w * 0.13;
  const tvh = h * 0.09;
  const tvy = floorY - h * 0.2;
  ctx.fillStyle = PALETTE.woodDark;
  ctx.fillRect(cx - tvw * 0.6, floorY - h * 0.09, tvw * 1.2, h * 0.09);
  ctx.fillStyle = '#20262e';
  ctx.fillRect(cx - tvw / 2, tvy, tvw, tvh);
  if (apt.tvOn) {
    ctx.fillStyle = mixHex('#8fd0e8', '#ffffff', 0.2 + Math.random() * 0.25);
    ctx.fillRect(cx - tvw / 2 + 2, tvy + 2, tvw - 4, tvh - 4);
  } else {
    ctx.fillStyle = PALETTE.screen;
    ctx.fillRect(cx - tvw / 2 + 2, tvy + 2, tvw - 4, tvh - 4);
  }

  // Lampe : c'est elle qui fait la fenêtre allumée vue de la rue.
  if (detail > 0.45) {
    const lx = cx + sw * 0.75;
    ctx.strokeStyle = PALETTE.metal;
    ctx.lineWidth = Math.max(1.5, w * 0.005);
    ctx.beginPath();
    ctx.moveTo(lx, floorY);
    ctx.lineTo(lx, floorY - h * 0.24);
    ctx.stroke();
    ctx.fillStyle = apt.lightOn ? '#ffd98f' : '#cbbfa8';
    ctx.beginPath();
    ctx.moveTo(lx - w * 0.028, floorY - h * 0.24);
    ctx.lineTo(lx + w * 0.028, floorY - h * 0.24);
    ctx.lineTo(lx + w * 0.018, floorY - h * 0.30);
    ctx.lineTo(lx - w * 0.018, floorY - h * 0.30);
    ctx.closePath();
    ctx.fill();
  }
}

function drawBed(ctx, cx, floorY, w, h, style, detail) {
  const bw = w * 0.18;
  const bh = h * 0.075;
  const by = floorY - bh;
  ctx.fillStyle = PALETTE.woodDark;
  ctx.fillRect(cx - bw / 2, by, bw, bh);
  ctx.fillStyle = '#e8ded0';
  ctx.fillRect(cx - bw / 2, by - h * 0.03, bw, h * 0.035);
  ctx.fillStyle = PALETTE.fabric[(style + 1) % PALETTE.fabric.length];
  ctx.fillRect(cx - bw * 0.15, by - h * 0.028, bw * 0.65, h * 0.032);
  // Tête de lit + oreiller.
  ctx.fillStyle = PALETTE.wood;
  ctx.fillRect(cx - bw / 2 - w * 0.008, by - h * 0.11, w * 0.012, h * 0.11);
  ctx.fillStyle = '#f4ece0';
  roundRect(ctx, cx - bw * 0.44, by - h * 0.045, bw * 0.26, h * 0.026, 3);
  ctx.fill();
  if (detail > 0.5) {
    // Table de nuit et réveil, qui n'a jamais servi à personne.
    ctx.fillStyle = PALETTE.wood;
    ctx.fillRect(cx + bw * 0.55, floorY - h * 0.08, w * 0.04, h * 0.08);
    ctx.fillStyle = '#c94f3f';
    ctx.fillRect(cx + bw * 0.58, floorY - h * 0.095, w * 0.022, h * 0.015);
  }
}

function drawBathroom(ctx, cx, floorY, w, h, detail) {
  // Cloison.
  ctx.fillStyle = rgba('#ffffff', 0.13);
  ctx.fillRect(cx - w * 0.05, floorY - h * 0.5, w * 0.11, h * 0.5);
  ctx.strokeStyle = rgba('#ffffff', 0.25);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.05, floorY - h * 0.5);
  ctx.lineTo(cx - w * 0.05, floorY);
  ctx.stroke();
  if (detail > 0.4) {
    // Douche.
    ctx.fillStyle = '#dfe6e8';
    ctx.fillRect(cx - w * 0.035, floorY - h * 0.02, w * 0.07, h * 0.02);
    ctx.strokeStyle = PALETTE.metal;
    ctx.lineWidth = Math.max(1.2, w * 0.004);
    ctx.beginPath();
    ctx.moveTo(cx, floorY - h * 0.02);
    ctx.lineTo(cx, floorY - h * 0.36);
    ctx.lineTo(cx - w * 0.025, floorY - h * 0.36);
    ctx.stroke();
  }
}

function drawPlant(ctx, cx, floorY, size) {
  ctx.fillStyle = '#a9613f';
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.22, floorY);
  ctx.lineTo(cx + size * 0.22, floorY);
  ctx.lineTo(cx + size * 0.16, floorY - size * 0.28);
  ctx.lineTo(cx - size * 0.16, floorY - size * 0.28);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#5d7f4e';
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.42;
    ctx.beginPath();
    ctx.ellipse(cx + Math.cos(a) * size * 0.25, floorY - size * 0.28 + Math.sin(a) * size * 0.3,
      size * 0.13, size * 0.3, a + Math.PI / 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFrames(ctx, x, y, w, h, apt, occupants, detail) {
  // Des cadres au mur : plus il y a d'habitants, plus il y a de photos.
  const n = Math.min(4, 1 + occupants.length);
  for (let i = 0; i < n; i++) {
    const fx = x + w * (0.28 + i * 0.13);
    const fy = y + h * (0.2 + (i % 2) * 0.08);
    const fw = w * 0.055;
    const fh = h * 0.09;
    ctx.fillStyle = PALETTE.wood;
    ctx.fillRect(fx, fy, fw, fh);
    ctx.fillStyle = pickStable(['#c9b8a0', '#a8bcc9', '#c9a8a8', '#b6c9a8'], `cadre${apt.id}${i}`);
    ctx.fillRect(fx + fw * 0.12, fy + fh * 0.12, fw * 0.76, fh * 0.76);
    if (detail > 0.7 && occupants[i]) {
      // Une silhouette dans le cadre : c'est déjà une photo de famille.
      const look = appearance(occupants[i]);
      ctx.fillStyle = look.hair;
      ctx.beginPath();
      ctx.arc(fx + fw / 2, fy + fh * 0.4, fw * 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = look.top;
      ctx.fillRect(fx + fw * 0.28, fy + fh * 0.52, fw * 0.44, fh * 0.3);
    }
  }
}

function drawClutter(ctx, x, floorY, w, h, level, seed) {
  const n = Math.round(level * 9);
  for (let i = 0; i < n; i++) {
    const u = ((seed * 37 + i * 91) % 100) / 100;
    const cx = x + w * (0.1 + u * 0.8);
    const kind = (seed + i) % 4;
    ctx.fillStyle = ['#c9b8a0', '#8a7f6f', '#b5563f', '#5b7c98'][kind];
    if (kind === 0) {
      ctx.fillRect(cx, floorY - h * 0.012, w * 0.022, h * 0.012);
    } else if (kind === 1) {
      ctx.beginPath();
      ctx.ellipse(cx, floorY + h * 0.004, w * 0.014, h * 0.007, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 2) {
      ctx.fillRect(cx, floorY - h * 0.02, w * 0.01, h * 0.02);
    } else {
      roundRect(ctx, cx, floorY - h * 0.016, w * 0.026, h * 0.016, 2);
      ctx.fill();
    }
  }
}

// --- Lecture de l'état ------------------------------------------------------

function clutterLevel(world, apt, occupants) {
  if (!occupants.length) return 0;
  const confort = occupants.reduce((s, p) => s + p.needs.get('confort'), 0) / occupants.length;
  const messyTrait = occupants.some((p) => p.personality.has('desordonne')) ? 0.25 : 0;
  const kids = occupants.filter((p) => p.age < 12).length * 0.12;
  return Math.max(0, Math.min(1, (100 - confort) / 100 + messyTrait + kids - (1 - apt.condition) * 0.1));
}

function wealthLevel(world, occupants) {
  if (!occupants.length) return 0.3;
  const money = occupants.reduce((s, p) => s + p.money, 0) / occupants.length;
  return Math.max(0, Math.min(1, money / 8000));
}
