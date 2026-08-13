// L'intérieur d'un appartement, vu en coupe.
//
// Quand le mur disparaît, la pièce doit déjà raconter quelque chose : qui
// vit là, s'il range, s'il a de l'argent, s'il est seul. Chaque logement
// tire son propre plan (voir interior-plan.js) — disposition, sens de
// lecture, variantes de meubles — et se remplit d'objets qui appartiennent
// à ses habitants. Deux appartements ne doivent jamais se ressembler.

import { PALETTE, pickStable, shade, rgba, ambientLight, skyColors, mixHex } from './palette.js';
import { drawCharacter, drawSpeech, roundRect, appearance } from './character.js';
import { planFor, propsFor } from './interior-plan.js';

/** Où se tient quelqu'un en fonction de ce qu'il fait, dans SON appartement. */
export function zoneFor(person, apt) {
  const z = apt ? planFor(apt).zones : null;
  const at = (name, fallback) => (z ? z[name] : fallback);
  const id = person.action?.id;
  switch (id) {
    case 'dormir':
    case 'soigner': return at('lit', 0.85);
    case 'insomnie': return at('fenetre', 0.7);
    case 'cuisiner': return at('cuisine', 0.22);
    case 'manger':
    case 'famille_temps': return at('table', 0.37);
    case 'douche': return at('bain', 0.95);
    case 'tv':
    case 'jeu':
    case 'ruminer':
    case 'boire':
    case 'musique':
    case 'fete':
    case 'invite':
    case 'lire': return at('salon', 0.54);
    case 'teletravail':
    case 'chercher_emploi': return at('table', 0.37);
    case 'espionner': return at('entree', 0.07);
    case 'telephoner': return at('fenetre', 0.7);
    case 'menage': return (at('cuisine', 0.22) + at('salon', 0.54)) / 2;
    case 'bricoler': return (at('entree', 0.07) + at('salon', 0.54)) / 2;
    case 'sport': return at('salon', 0.54);
    case 'betise': return (at('salon', 0.54) + at('lit', 0.85)) / 2;
    default: return at('salon', 0.54);
  }
}

/** Fait glisser les habitants vers leur zone. Purement visuel. */
export function updatePositions(world, apt, dt) {
  const occupants = occupantsOf(world, apt);
  occupants.forEach((p) => {
    const base = zoneFor(p, apt);
    const same = occupants.filter((q) => Math.abs(zoneFor(q, apt) - base) < 0.02);
    const rank = same.indexOf(p);
    const offset = same.length > 1 ? (rank - (same.length - 1) / 2) * 0.115 : 0;
    p.zRank = same.length > 1 ? (rank % 2) : 0;
    const target = Math.max(0.05, Math.min(0.95, base + offset));
    const dx = target - p.pos.x;
    if (Math.abs(dx) > 0.004) {
      p.pos.x += Math.sign(dx) * Math.min(Math.abs(dx), dt * 0.22);
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

// --- Scène ------------------------------------------------------------------

export function drawInterior(ctx, world, apt, rect, time, opts = {}) {
  const { x, y, w, h } = rect;
  const detail = opts.detail ?? 1;
  const dt = opts.dt ?? 1 / 60;
  const plan = planFor(apt);
  const occupants = occupantsOf(world, apt);
  const props = propsFor(world, apt, occupants);
  const messy = clutterLevel(apt, occupants);
  const wealth = wealthLevel(occupants);

  const floorH = h * 0.14;
  const floorY = y + h - floorH;
  const wallColor = PALETTE.wall[apt.style % PALETTE.wall.length];
  const floorColor = PALETTE.floor[(apt.id + plan.rug) % PALETTE.floor.length];

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  const U = (u) => x + u * w;
  const V = floorY;
  const S = { ctx, x, y, w, h, U, V, detail, plan, apt, wealth, messy };

  drawWalls(S, wallColor, floorColor);
  drawBackWindow(S, world, time);

  // Les meubles secondaires d'abord : ils sont contre le mur, et le
  // mobilier principal doit pouvoir passer devant. Dessinés après, une
  // penderie recouvrait le lit.
  if (detail > 0.35) drawExtras(S);

  // Le mobilier suit le plan : chaque bande est dessinée à sa place.
  for (const zone of plan.order) {
    switch (zone) {
      case 'entree': drawEntrance(S); break;
      case 'cuisine': drawKitchen(S); break;
      case 'table': drawTable(S); break;
      case 'salon': drawLiving(S, time); break;
      case 'lit': drawBed(S, occupants); break;
      case 'bain': drawBathroom(S); break;
      default: break;
    }
  }

  if (detail > 0.35) {
    drawWallDecor(S, occupants);
    drawProps(S, props);
    for (let i = 0; i < apt.plants; i++) {
      drawPlant(S.ctx, U(0.11 + i * 0.31 + plan.jitter[i % 8]), V, h * (0.12 + (i % 2) * 0.04));
    }
    if (messy > 0.3) drawClutter(S, messy);
  }

  drawLight(S, world, apt, time);
  drawPeople(S, occupants, time, dt, detail);

  ctx.restore();
}

// --- Enveloppe --------------------------------------------------------------

function drawWalls(S, wallColor, floorColor) {
  const { ctx, x, y, w, h, V, detail, plan } = S;
  ctx.fillStyle = wallColor;
  ctx.fillRect(x, y, w, h);

  if (detail > 0.4) {
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = PALETTE.wallpaper[plan.wallpaper % PALETTE.wallpaper.length];
    const s = Math.max(10, w * 0.045);
    if (plan.wallpaper === 0) {
      for (let i = 0; i < w; i += Math.max(8, w * 0.035)) ctx.fillRect(x + i, y, Math.max(3, w * 0.012), h);
    } else if (plan.wallpaper === 1) {
      for (let i = 0; i < w; i += s) {
        for (let j = 0; j < h; j += s) {
          ctx.beginPath();
          ctx.arc(x + i + s / 2, y + j + s / 2, s * 0.11, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (plan.wallpaper === 2) {
      // Frise à mi-hauteur : très courant, et ça casse le grand aplat.
      ctx.globalAlpha = 0.3;
      ctx.fillRect(x, y + h * 0.42, w, h * 0.02);
      ctx.fillRect(x, y + h * 0.46, w, h * 0.006);
    }
    ctx.restore();
  }

  ctx.fillStyle = floorColor;
  ctx.fillRect(x, V, w, h - (V - y));
  ctx.fillStyle = rgba(shade(floorColor, -0.3), 0.5);
  ctx.fillRect(x, V, w, Math.max(1, h * 0.008));
  if (detail > 0.5) {
    ctx.strokeStyle = rgba(shade(floorColor, -0.35), 0.3);
    ctx.lineWidth = 1;
    for (let i = 0; i < w; i += Math.max(14, w * 0.06)) {
      ctx.beginPath();
      ctx.moveTo(x + i, V);
      ctx.lineTo(x + i - w * 0.02, y + h);
      ctx.stroke();
    }
  }
}

function drawBackWindow(S, world, time) {
  const { ctx, y, h, U, plan } = S;
  const cx = U(plan.zones.fenetre);
  const cy = y + h * 0.15;
  const ww = S.w * 0.14;
  const wh = h * 0.4;
  const sky = skyColors(world.clock.dayFraction, world.clock.season);
  const g = ctx.createLinearGradient(0, cy, 0, cy + wh);
  g.addColorStop(0, sky.top);
  g.addColorStop(1, sky.bot);
  ctx.fillStyle = g;
  ctx.fillRect(cx - ww / 2, cy, ww, wh);

  ctx.fillStyle = rgba('#2c3444', 0.5);
  ctx.fillRect(cx - ww / 2, cy + wh * 0.55, ww, wh * 0.45);
  ctx.fillStyle = rgba('#ffcf7a', 0.45 + Math.sin(time * 0.5 + S.apt.id) * 0.12);
  ctx.fillRect(cx - ww * 0.28, cy + wh * 0.66, ww * 0.16, wh * 0.12);

  ctx.strokeStyle = PALETTE.frame;
  ctx.lineWidth = Math.max(2, ww * 0.055);
  ctx.strokeRect(cx - ww / 2, cy, ww, wh);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx, cy + wh);
  ctx.moveTo(cx - ww / 2, cy + wh / 2);
  ctx.lineTo(cx + ww / 2, cy + wh / 2);
  ctx.stroke();

  // Un rideau d'un côté, pas systématiquement du même.
  if (S.detail > 0.5) {
    const side = plan.mirror ? -1 : 1;
    ctx.fillStyle = rgba(pickStable(PALETTE.curtains, `int${S.apt.id}`), 0.85);
    ctx.beginPath();
    ctx.moveTo(cx + side * ww * 0.5, cy - h * 0.02);
    ctx.lineTo(cx + side * ww * 0.78, cy - h * 0.02);
    ctx.lineTo(cx + side * ww * 0.66, cy + wh);
    ctx.lineTo(cx + side * ww * 0.44, cy + wh);
    ctx.closePath();
    ctx.fill();
  }
}

// --- Mobilier ---------------------------------------------------------------

function drawEntrance(S) {
  const { ctx, w, h, U, V, detail, plan } = S;
  const cx = U(plan.zones.entree);
  const dw = w * 0.07;
  const dh = h * 0.45;
  ctx.fillStyle = PALETTE.woodDark;
  ctx.fillRect(cx - dw / 2, V - dh, dw, dh);
  ctx.strokeStyle = rgba('#000', 0.22);
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - dw / 2, V - dh, dw, dh);
  if (detail > 0.5) {
    ctx.fillStyle = PALETTE.metal;
    ctx.beginPath();
    ctx.arc(cx + dw * 0.3, V - dh * 0.5, Math.max(1.5, w * 0.005), 0, Math.PI * 2);
    ctx.fill();
    // Le porte-manteau, toujours trop chargé.
    const side = plan.mirror ? -1 : 1;
    ctx.strokeStyle = PALETTE.wood;
    ctx.lineWidth = Math.max(1.5, w * 0.005);
    ctx.beginPath();
    ctx.moveTo(cx + side * dw * 0.8, V - dh * 1.02);
    ctx.lineTo(cx + side * dw * 1.7, V - dh * 1.02);
    ctx.stroke();
    ctx.fillStyle = PALETTE.fabric[(S.apt.id + 2) % PALETTE.fabric.length];
    roundRect(ctx, cx + side * dw * 0.95 - dw * 0.25, V - dh, dw * 0.5, dh * 0.38, 3);
    ctx.fill();
  }
}

function drawKitchen(S) {
  const { ctx, w, h, U, V, detail, plan, wealth, messy } = S;
  const cx = U(plan.zones.cuisine);
  const cw = w * 0.16;
  const ch = h * 0.16;
  ctx.fillStyle = shade(PALETTE.wood, 0.15);
  ctx.fillRect(cx - cw / 2, V - ch, cw, ch);
  ctx.fillStyle = shade(PALETTE.wood, -0.2);
  ctx.fillRect(cx - cw / 2, V - ch, cw, h * 0.018);
  if (detail < 0.4) return;

  ctx.strokeStyle = rgba('#000', 0.16);
  ctx.beginPath();
  ctx.moveTo(cx, V - ch + h * 0.018);
  ctx.lineTo(cx, V);
  ctx.stroke();
  ctx.fillStyle = '#333a42';
  ctx.fillRect(cx - cw * 0.4, V - ch - h * 0.012, cw * 0.34, h * 0.012);
  ctx.fillStyle = PALETTE.metal;
  roundRect(ctx, cx - cw * 0.36, V - ch - h * 0.044, cw * 0.25, h * 0.033, 2);
  ctx.fill();

  const side = plan.mirror ? -1 : 1;
  const fw = cw * 0.42;
  const fh = h * 0.3;
  const fx = cx + side * cw * 0.55 - (side < 0 ? fw : 0);
  ctx.fillStyle = wealth > 0.6 ? '#d8dde2' : '#e8e2d6';
  ctx.fillRect(fx, V - fh, fw, fh);
  ctx.strokeStyle = rgba('#000', 0.2);
  ctx.strokeRect(fx, V - fh, fw, fh);
  ctx.fillStyle = PALETTE.accent;
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(fx + fw * 0.15 + (i % 2) * fw * 0.4, V - fh * 0.85 + i * fh * 0.16, fw * 0.2, fh * 0.09);
  }

  // Placards hauts : c'est la variante qui change le plus la silhouette.
  if (plan.kitchen === 1) {
    ctx.fillStyle = shade(PALETTE.wood, 0.05);
    ctx.fillRect(cx - cw / 2, V - h * 0.44, cw * 0.9, h * 0.12);
    ctx.strokeStyle = rgba('#000', 0.18);
    ctx.strokeRect(cx - cw / 2, V - h * 0.44, cw * 0.9, h * 0.12);
    ctx.beginPath();
    ctx.moveTo(cx - cw * 0.05, V - h * 0.44);
    ctx.lineTo(cx - cw * 0.05, V - h * 0.32);
    ctx.stroke();
  }

  if (messy > 0.45) {
    ctx.fillStyle = '#e6e0d4';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(cx + cw * 0.08 + i * w * 0.011, V - ch - h * 0.013 - i * h * 0.007,
        w * 0.015, h * 0.007, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawTable(S) {
  const { ctx, w, h, U, V, detail, plan } = S;
  const cx = U(plan.zones.table);
  const ty = V - h * 0.15;
  const th = h * 0.012;

  if (plan.table === 1) {
    // Ronde : un seul pied central.
    const r = w * 0.075;
    ctx.fillStyle = PALETTE.wood;
    ctx.beginPath();
    ctx.ellipse(cx, ty, r, h * 0.018, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx - w * 0.008, ty, w * 0.016, V - ty);
    ctx.fillStyle = PALETTE.woodDark;
    ctx.beginPath();
    ctx.ellipse(cx, V, w * 0.032, h * 0.008, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const tw = plan.table === 2 ? w * 0.1 : w * 0.16;
    ctx.fillStyle = PALETTE.wood;
    ctx.fillRect(cx - tw / 2, ty, tw, th);
    ctx.fillRect(cx - tw * 0.4, ty + th, w * 0.012, V - ty - th);
    ctx.fillRect(cx + tw * 0.34, ty + th, w * 0.012, V - ty - th);
  }

  if (detail < 0.45) return;
  const chairs = plan.table === 2 ? 1 : 2;
  for (let i = 0; i < chairs; i++) {
    const side = i === 0 ? -1 : 1;
    const chx = cx + side * w * 0.115;
    ctx.fillStyle = PALETTE.woodDark;
    ctx.fillRect(chx - w * 0.018, V - h * 0.09, w * 0.036, h * 0.008);
    ctx.fillRect(chx - side * w * 0.016, V - h * 0.17, w * 0.008, h * 0.088);
    ctx.fillRect(chx - w * 0.014, V - h * 0.082, w * 0.006, h * 0.082);
    ctx.fillRect(chx + w * 0.008, V - h * 0.082, w * 0.006, h * 0.082);
  }
  ctx.fillStyle = '#f2ece0';
  ctx.fillRect(cx - w * 0.03, ty - h * 0.012, w * 0.028, h * 0.012);
  ctx.fillStyle = PALETTE.fabric[3];
  ctx.beginPath();
  ctx.ellipse(cx + w * 0.02, ty - h * 0.01, w * 0.013, h * 0.009, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawLiving(S, time) {
  const { ctx, w, h, U, V, detail, plan, apt } = S;
  const cx = U(plan.zones.salon);
  const fab = PALETTE.fabric[apt.id % PALETTE.fabric.length];

  if (detail > 0.4 && plan.rug > 0) {
    ctx.fillStyle = rgba(PALETTE.fabric[(apt.id + 3) % PALETTE.fabric.length], 0.5);
    if (plan.rug === 1) {
      ctx.beginPath();
      ctx.ellipse(cx, V + h * 0.012, w * 0.16, h * 0.022, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(cx - w * 0.15, V, w * 0.3, h * 0.028);
    }
  }

  const sh = h * 0.12;
  const sy = V - sh;
  if (plan.sofa === 2) {
    // Deux fauteuils séparés plutôt qu'un canapé.
    for (const side of [-1, 1]) {
      const ax = cx + side * w * 0.075;
      ctx.fillStyle = fab;
      roundRect(ctx, ax - w * 0.045, sy, w * 0.09, sh, h * 0.02);
      ctx.fill();
      ctx.fillStyle = shade(fab, -0.2);
      roundRect(ctx, ax - w * 0.045, sy - h * 0.05, w * 0.09, h * 0.07, h * 0.02);
      ctx.fill();
    }
  } else {
    const sw = plan.sofa === 1 ? w * 0.24 : w * 0.19;
    ctx.fillStyle = fab;
    roundRect(ctx, cx - sw / 2, sy, sw, sh, h * 0.02);
    ctx.fill();
    ctx.fillStyle = shade(fab, -0.2);
    roundRect(ctx, cx - sw / 2, sy - h * 0.05, sw, h * 0.07, h * 0.02);
    ctx.fill();
    if (plan.sofa === 1) {
      // Retour d'angle.
      const side = plan.mirror ? -1 : 1;
      ctx.fillStyle = fab;
      roundRect(ctx, cx + side * (sw / 2 - w * 0.05), sy - h * 0.03, w * 0.06, sh + h * 0.03, h * 0.02);
      ctx.fill();
    }
    if (detail > 0.5) {
      ctx.fillStyle = shade(fab, 0.28);
      roundRect(ctx, cx - sw * 0.4, sy - h * 0.035, sw * 0.2, h * 0.04, h * 0.012);
      ctx.fill();
    }
  }

  if (plan.tv) {
    const tvw = w * 0.12;
    const tvh = h * 0.085;
    const tvy = V - h * 0.2;
    ctx.fillStyle = PALETTE.woodDark;
    ctx.fillRect(cx - tvw * 0.6, V - h * 0.085, tvw * 1.2, h * 0.085);
    ctx.fillStyle = '#20262e';
    ctx.fillRect(cx - tvw / 2, tvy, tvw, tvh);
    ctx.fillStyle = apt.tvOn
      ? mixHex('#8fd0e8', '#ffffff', 0.2 + (Math.sin(time * 11 + apt.id) * 0.5 + 0.5) * 0.3)
      : PALETTE.screen;
    ctx.fillRect(cx - tvw / 2 + 2, tvy + 2, tvw - 4, tvh - 4);
  }

  if (detail > 0.45) {
    const side = plan.mirror ? -1 : 1;
    const lx = cx + side * w * 0.115;
    ctx.strokeStyle = PALETTE.metal;
    ctx.lineWidth = Math.max(1.5, w * 0.005);
    ctx.beginPath();
    ctx.moveTo(lx, V);
    ctx.lineTo(lx, V - h * (plan.lampStyle ? 0.24 : 0.19));
    ctx.stroke();
    const ly = V - h * (plan.lampStyle ? 0.24 : 0.19);
    ctx.fillStyle = apt.lightOn ? '#ffd98f' : '#cbbfa8';
    if (plan.lampStyle) {
      ctx.beginPath();
      ctx.moveTo(lx - w * 0.026, ly);
      ctx.lineTo(lx + w * 0.026, ly);
      ctx.lineTo(lx + w * 0.016, ly - h * 0.055);
      ctx.lineTo(lx - w * 0.016, ly - h * 0.055);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(lx, ly, w * 0.022, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawBed(S, occupants) {
  const { ctx, w, h, U, V, detail, plan } = S;
  const cx = U(plan.zones.lit);
  const wide = plan.bed === 0;
  const bw = wide ? w * 0.18 : w * 0.13;
  const bh = h * 0.075;
  const by = V - bh;

  ctx.fillStyle = PALETTE.woodDark;
  ctx.fillRect(cx - bw / 2, by, bw, bh);
  ctx.fillStyle = '#e8ded0';
  ctx.fillRect(cx - bw / 2, by - h * 0.03, bw, h * 0.035);
  ctx.fillStyle = PALETTE.fabric[(plan.bed + S.apt.id) % PALETTE.fabric.length];
  ctx.fillRect(cx - bw * 0.15, by - h * 0.028, bw * 0.65, h * 0.032);

  const side = plan.mirror ? 1 : -1;
  ctx.fillStyle = PALETTE.wood;
  ctx.fillRect(cx + side * (bw / 2) - (side > 0 ? 0 : w * 0.012), by - h * 0.11, w * 0.012, h * 0.11);
  ctx.fillStyle = '#f4ece0';
  roundRect(ctx, cx + side * bw * 0.35 - bw * 0.13, by - h * 0.045, bw * 0.26, h * 0.026, 3);
  ctx.fill();

  if (detail > 0.5) {
    const nx = cx - side * bw * 0.62;
    ctx.fillStyle = PALETTE.wood;
    ctx.fillRect(nx - w * 0.02, V - h * 0.08, w * 0.04, h * 0.08);
    ctx.fillStyle = '#c94f3f';
    ctx.fillRect(nx - w * 0.011, V - h * 0.095, w * 0.022, h * 0.015);
  }
  // Un lit d'enfant en plus quand il y a des enfants et de la place.
  if (occupants.some((p) => p.age >= 2 && p.age < 12) && plan.bed !== 0 && detail > 0.5) {
    const kx = cx + (plan.mirror ? -1 : 1) * w * 0.1;
    ctx.fillStyle = PALETTE.woodDark;
    ctx.fillRect(kx - w * 0.05, V - h * 0.055, w * 0.1, h * 0.055);
    ctx.fillStyle = '#e8ded0';
    ctx.fillRect(kx - w * 0.05, V - h * 0.075, w * 0.1, h * 0.022);
  }
}

function drawBathroom(S) {
  const { ctx, w, h, U, V, detail, plan } = S;
  const cx = U(plan.zones.bain);
  ctx.fillStyle = rgba('#ffffff', 0.12);
  ctx.fillRect(cx - w * 0.045, V - h * 0.5, w * 0.09, h * 0.5);
  ctx.strokeStyle = rgba('#ffffff', 0.22);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.045, V - h * 0.5);
  ctx.lineTo(cx - w * 0.045, V);
  ctx.moveTo(cx + w * 0.045, V - h * 0.5);
  ctx.lineTo(cx + w * 0.045, V);
  ctx.stroke();
  if (detail < 0.4) return;
  ctx.fillStyle = '#dfe6e8';
  ctx.fillRect(cx - w * 0.032, V - h * 0.02, w * 0.064, h * 0.02);
  ctx.strokeStyle = PALETTE.metal;
  ctx.lineWidth = Math.max(1.2, w * 0.004);
  ctx.beginPath();
  ctx.moveTo(cx, V - h * 0.02);
  ctx.lineTo(cx, V - h * 0.34);
  ctx.lineTo(cx - w * 0.022, V - h * 0.34);
  ctx.stroke();
}

/** Meubles secondaires : c'est eux qui font qu'un logement a un caractère. */
/** Les jointures entre deux bandes : le seul espace mural vraiment libre. */
function seams(plan) {
  const centres = plan.order.map((z) => plan.zones[z]).sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < centres.length - 1; i++) out.push((centres[i] + centres[i + 1]) / 2);
  return out;
}

function drawExtras(S) {
  const { ctx, w, h, U, V, plan } = S;
  const spots = seams(plan);
  plan.extras.forEach((kind, i) => {
    // On répartit sur les jointures, en sautant une sur deux pour ne pas
    // empiler deux meubles côte à côte.
    const cx = U(spots[(i * 2 + 1) % spots.length] + plan.jitter[i] * 0.5);
    switch (kind) {
      case 'bibliotheque': {
        const bw = w * 0.09;
        const bh = h * 0.34;
        ctx.fillStyle = PALETTE.wood;
        ctx.fillRect(cx - bw / 2, V - bh, bw, bh);
        ctx.fillStyle = shade(PALETTE.wood, -0.3);
        for (let r = 1; r < 4; r++) ctx.fillRect(cx - bw / 2, V - bh + (bh / 4) * r, bw, h * 0.006);
        for (let r = 0; r < 4; r++) {
          for (let b = 0; b < 5; b++) {
            ctx.fillStyle = PALETTE.fabric[(r * 5 + b + S.apt.id) % PALETTE.fabric.length];
            ctx.fillRect(cx - bw * 0.44 + b * bw * 0.18, V - bh + (bh / 4) * r + h * 0.008,
              bw * 0.14, bh / 4 - h * 0.014);
          }
        }
        break;
      }
      case 'penderie': {
        const pw = w * 0.075;
        const ph = h * 0.4;
        ctx.fillStyle = shade(PALETTE.wood, 0.1);
        ctx.fillRect(cx - pw / 2, V - ph, pw, ph);
        ctx.strokeStyle = rgba('#000', 0.2);
        ctx.strokeRect(cx - pw / 2, V - ph, pw, ph);
        ctx.beginPath();
        ctx.moveTo(cx, V - ph);
        ctx.lineTo(cx, V);
        ctx.stroke();
        break;
      }
      case 'bureau': {
        ctx.fillStyle = PALETTE.wood;
        ctx.fillRect(cx - w * 0.055, V - h * 0.14, w * 0.11, h * 0.012);
        ctx.fillRect(cx - w * 0.05, V - h * 0.128, w * 0.01, h * 0.128);
        ctx.fillRect(cx + w * 0.04, V - h * 0.128, w * 0.01, h * 0.128);
        ctx.fillStyle = '#20262e';
        ctx.fillRect(cx - w * 0.022, V - h * 0.2, w * 0.045, h * 0.055);
        break;
      }
      case 'commode': {
        ctx.fillStyle = shade(PALETTE.wood, -0.05);
        ctx.fillRect(cx - w * 0.05, V - h * 0.13, w * 0.1, h * 0.13);
        ctx.strokeStyle = rgba('#000', 0.2);
        for (let r = 1; r < 3; r++) {
          ctx.beginPath();
          ctx.moveTo(cx - w * 0.05, V - h * 0.13 + (h * 0.13 / 3) * r);
          ctx.lineTo(cx + w * 0.05, V - h * 0.13 + (h * 0.13 / 3) * r);
          ctx.stroke();
        }
        break;
      }
      default: { // buffet
        ctx.fillStyle = PALETTE.woodDark;
        ctx.fillRect(cx - w * 0.06, V - h * 0.1, w * 0.12, h * 0.1);
        ctx.fillStyle = shade(PALETTE.wood, 0.2);
        ctx.fillRect(cx - w * 0.06, V - h * 0.11, w * 0.12, h * 0.012);
        break;
      }
    }
  });
}

function drawWallDecor(S, occupants) {
  const { ctx, x, y, w, h, plan, apt } = S;
  const kind = plan.wallDecor;
  if (kind === 2) {
    // Horloge.
    const cx = x + w * 0.5;
    const cy = y + h * 0.16;
    ctx.beginPath();
    ctx.arc(cx, cy, w * 0.022, 0, Math.PI * 2);
    ctx.fillStyle = '#f2ece0';
    ctx.fill();
    ctx.strokeStyle = PALETTE.woodDark;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy - w * 0.014);
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + w * 0.01, cy);
    ctx.stroke();
    return;
  }
  if (kind === 3) {
    // Miroir.
    const cx = x + w * 0.3;
    ctx.fillStyle = rgba('#c9d6da', 0.5);
    roundRect(ctx, cx, y + h * 0.14, w * 0.05, h * 0.16, w * 0.02);
    ctx.fill();
    ctx.strokeStyle = PALETTE.wood;
    ctx.lineWidth = 3;
    ctx.stroke();
    return;
  }
  const n = Math.min(4, 1 + occupants.length);
  for (let i = 0; i < n; i++) {
    const fx = x + w * (0.24 + i * 0.14 + plan.jitter[i]);
    const fy = y + h * (0.17 + (i % 2) * 0.08);
    const fw = w * 0.05;
    const fh = h * 0.085;
    if (kind === 1) {
      // Affiches : pas de cadre, couleurs franches.
      ctx.fillStyle = pickStable(PALETTE.fabric, `affiche${apt.id}${i}`);
      ctx.fillRect(fx, fy, fw, fh);
      ctx.fillStyle = rgba('#000', 0.15);
      ctx.fillRect(fx, fy + fh * 0.7, fw, fh * 0.1);
      continue;
    }
    ctx.fillStyle = PALETTE.wood;
    ctx.fillRect(fx, fy, fw, fh);
    ctx.fillStyle = pickStable(['#c9b8a0', '#a8bcc9', '#c9a8a8', '#b6c9a8'], `cadre${apt.id}${i}`);
    ctx.fillRect(fx + fw * 0.12, fy + fh * 0.12, fw * 0.76, fh * 0.76);
    if (occupants[i]) {
      const look = appearance(occupants[i]);
      ctx.fillStyle = look.hair;
      ctx.beginPath();
      ctx.arc(fx + fw / 2, fy + fh * 0.4, fw * 0.17, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = look.top;
      ctx.fillRect(fx + fw * 0.28, fy + fh * 0.52, fw * 0.44, fh * 0.3);
    }
  }
}

/** Les objets des habitants : on doit deviner qui vit là sans lire la fiche. */
function drawProps(S, props) {
  const { ctx, w, h, U, V, plan } = S;
  const spot = (i) => U(0.2 + ((i * 0.23 + plan.zones.salon) % 0.66) + plan.jitter[i % 8]);
  props.forEach((kind, i) => {
    const cx = spot(i);
    switch (kind) {
      case 'guitare':
        ctx.fillStyle = '#b3763c';
        ctx.beginPath();
        ctx.ellipse(cx, V - h * 0.045, w * 0.021, h * 0.048, 0.18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = PALETTE.woodDark;
        ctx.fillRect(cx + w * 0.006, V - h * 0.155, w * 0.008, h * 0.1);
        break;
      case 'chevalet':
        ctx.strokeStyle = PALETTE.wood;
        ctx.lineWidth = Math.max(1.5, w * 0.005);
        ctx.beginPath();
        ctx.moveTo(cx - w * 0.025, V);
        ctx.lineTo(cx, V - h * 0.2);
        ctx.lineTo(cx + w * 0.025, V);
        ctx.stroke();
        ctx.fillStyle = '#f2ece0';
        ctx.fillRect(cx - w * 0.03, V - h * 0.19, w * 0.06, h * 0.07);
        break;
      case 'etabli':
        ctx.fillStyle = shade(PALETTE.wood, -0.15);
        ctx.fillRect(cx - w * 0.05, V - h * 0.11, w * 0.1, h * 0.014);
        ctx.fillRect(cx - w * 0.045, V - h * 0.096, w * 0.008, h * 0.096);
        ctx.fillRect(cx + w * 0.037, V - h * 0.096, w * 0.008, h * 0.096);
        ctx.fillStyle = '#c0392b';
        ctx.fillRect(cx - w * 0.02, V - h * 0.14, w * 0.04, h * 0.03);
        break;
      case 'jouets':
        for (let k = 0; k < 4; k++) {
          ctx.fillStyle = ['#c0392b', '#2f80c0', '#e0a83f', '#4a9c5a'][k];
          ctx.beginPath();
          ctx.arc(cx + (k - 1.5) * w * 0.018, V - h * 0.008, w * 0.008, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      case 'berceau':
        ctx.fillStyle = '#e8ded0';
        roundRect(ctx, cx - w * 0.03, V - h * 0.06, w * 0.06, h * 0.055, w * 0.01);
        ctx.fill();
        ctx.strokeStyle = PALETTE.wood;
        ctx.lineWidth = 2;
        ctx.stroke();
        break;
      case 'bouteilles':
        for (let k = 0; k < 3; k++) {
          ctx.fillStyle = k % 2 ? '#4a6b3f' : '#6b5233';
          ctx.fillRect(cx + k * w * 0.012, V - h * 0.035, w * 0.007, h * 0.035);
        }
        break;
      case 'livres':
        ctx.fillStyle = PALETTE.fabric[1];
        for (let k = 0; k < 3; k++) {
          ctx.fillRect(cx, V - h * 0.012 * (k + 1), w * 0.03, h * 0.011);
          ctx.fillStyle = PALETTE.fabric[(k + 3) % PALETTE.fabric.length];
        }
        break;
      case 'cartons':
        ctx.fillStyle = '#b3915f';
        ctx.fillRect(cx - w * 0.025, V - h * 0.05, w * 0.05, h * 0.05);
        ctx.strokeStyle = rgba('#000', 0.2);
        ctx.strokeRect(cx - w * 0.025, V - h * 0.05, w * 0.05, h * 0.05);
        break;
      case 'casseroles':
        ctx.fillStyle = PALETTE.metal;
        for (let k = 0; k < 2; k++) {
          ctx.beginPath();
          ctx.arc(cx + k * w * 0.025, S.y + h * 0.3, w * 0.014, 0, Math.PI);
          ctx.fill();
        }
        break;
      case 'napperon':
        ctx.fillStyle = 'rgba(250,245,235,0.85)';
        ctx.beginPath();
        ctx.ellipse(cx, V - h * 0.152, w * 0.026, h * 0.008, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'courrier':
        ctx.fillStyle = '#f2ece0';
        for (let k = 0; k < 4; k++) {
          ctx.fillRect(cx - w * 0.02 + k * 2, V - h * 0.006 - k * 2, w * 0.035, h * 0.006);
        }
        break;
      case 'tableau':
        ctx.fillStyle = '#3f5a4a';
        ctx.fillRect(cx - w * 0.035, S.y + h * 0.2, w * 0.07, h * 0.09);
        ctx.strokeStyle = PALETTE.wood;
        ctx.lineWidth = 2;
        ctx.strokeRect(cx - w * 0.035, S.y + h * 0.2, w * 0.07, h * 0.09);
        break;
      default: // ordinateur
        ctx.fillStyle = '#2a3038';
        ctx.fillRect(cx - w * 0.018, V - h * 0.19, w * 0.036, h * 0.026);
        break;
    }
  });
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

function drawClutter(S, level) {
  const { ctx, x, w, h, V, apt } = S;
  const n = Math.round(level * 9);
  for (let i = 0; i < n; i++) {
    const u = ((apt.id * 37 + i * 91) % 100) / 100;
    const cx = x + w * (0.1 + u * 0.8);
    const kind = (apt.id + i) % 4;
    ctx.fillStyle = ['#c9b8a0', '#8a7f6f', '#b5563f', '#5b7c98'][kind];
    if (kind === 0) ctx.fillRect(cx, V - h * 0.012, w * 0.022, h * 0.012);
    else if (kind === 1) {
      ctx.beginPath();
      ctx.ellipse(cx, V + h * 0.004, w * 0.014, h * 0.007, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 2) ctx.fillRect(cx, V - h * 0.02, w * 0.01, h * 0.02);
    else {
      roundRect(ctx, cx, V - h * 0.016, w * 0.026, h * 0.016, 2);
      ctx.fill();
    }
  }
}

// --- Lumière et habitants ---------------------------------------------------

function drawLight(S, world, apt, time) {
  const { ctx, x, y, w, h, U } = S;
  const amb = ambientLight(world.clock.dayFraction);
  if (amb < 0.75) {
    ctx.fillStyle = rgba('#0b1020', (1 - amb) * (apt.lightOn ? 0.35 : 0.72));
    ctx.fillRect(x, y, w, h);
    if (apt.lightOn) {
      const g = ctx.createRadialGradient(U(0.5), y + h * 0.3, 0, U(0.5), y + h * 0.3, w * 0.62);
      g.addColorStop(0, 'rgba(255,205,130,0.34)');
      g.addColorStop(1, 'rgba(255,190,120,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
    }
  }
  if (apt.tvOn) {
    const cx = U(S.plan.zones.salon);
    const flick = 0.16 + Math.sin(time * 9 + apt.id) * 0.06 + Math.sin(time * 23) * 0.03;
    const g = ctx.createRadialGradient(cx, y + h * 0.55, 0, cx, y + h * 0.55, w * 0.45);
    g.addColorStop(0, `rgba(150,205,235,${Math.max(0, flick)})`);
    g.addColorStop(1, 'rgba(150,205,235,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  }
}

function drawPeople(S, occupants, time, dt, detail) {
  const { ctx, w, h, U, V } = S;
  const charH = h * 0.54;
  const sorted = [...occupants].sort((a, b) => (b.zRank ?? 0) - (a.zRank ?? 0) || a.pos.x - b.pos.x);
  for (const p of sorted) {
    const depth = p.zRank ?? 0;
    const px = U(p.pos.x);
    let py = V + h * 0.02 - depth * h * 0.035;
    let pose;
    // On ne s'allonge qu'une fois arrivé au lit. Sans cette condition, le
    // dormeur se met à l'horizontale dès la décision et traverse la pièce
    // en lévitation jusqu'au matelas — ce qui était exactement le cas.
    const couche = !p.walking
      && (p.action?.id === 'dormir' || p.action?.id === 'soigner');
    if (couche) {
      // Hauteur du matelas : le corps doit poser dessus, pas flotter.
      py = V - h * 0.072;
      pose = 'couche';
    } else if (p.age < 2) {
      pose = 'bebe';
      py = V;
    }
    drawCharacter(ctx, p, px, py, charH * (1 - depth * 0.07), { time, dt, pose, facing: p.facing });
  }
  if (detail > 0.55) {
    for (const p of sorted) {
      if (!p.speech) continue;
      ctx.globalAlpha = Math.min(1, p.speech.ttl / 8);
      drawSpeech(ctx, p.speech.text, U(p.pos.x), V - charH * 0.98,
        Math.min(w * 0.42, 190), Math.min(1.35, w / 420));
      ctx.globalAlpha = 1;
    }
  }
}

// --- Lecture de l'état ------------------------------------------------------

function clutterLevel(apt, occupants) {
  if (!occupants.length) return 0;
  const confort = occupants.reduce((s, p) => s + p.needs.get('confort'), 0) / occupants.length;
  const messyTrait = occupants.some((p) => p.personality.has('desordonne')) ? 0.25 : 0;
  const kids = occupants.filter((p) => p.age < 12).length * 0.12;
  return Math.max(0, Math.min(1, (100 - confort) / 100 + messyTrait + kids));
}

function wealthLevel(occupants) {
  if (!occupants.length) return 0.3;
  const money = occupants.reduce((s, p) => s + p.money, 0) / occupants.length;
  return Math.max(0, Math.min(1, money / 8000));
}
