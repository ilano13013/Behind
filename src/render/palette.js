// Direction artistique.
//
// Palette chaude de quartier populaire : ocres, terres cuites, verts
// fanés, bleus de nuit. Rien de saturé, rien de froid, sauf la nuit —
// et encore, la nuit est bleue mais les fenêtres sont orange.
//
// L'idée : un immeuble qu'on a envie de regarder même quand il ne se
// passe rien, parce que chaque fenêtre est une petite tache de couleur
// dans un mur qui, lui, change avec l'heure.

export const PALETTE = {
  // Façades : chaque immeuble tire sa teinte de sa graine.
  facade: ['#c98c5a', '#d6a271', '#bd7f56', '#c9976b', '#b8845f', '#d2a67d'],
  facadeShade: '#8f5f3d',
  facadeLight: '#e8c49a',
  joint: '#a06e48',

  // Menuiseries.
  frame: '#f3e6d4',
  frameShade: '#c9b193',
  frameDark: '#6d5540',

  // Vitres.
  glassDay: '#5f7b88',
  glassNight: '#1d2634',
  glassLit: '#ffcf7a',
  glassTv: '#8fd0e8',
  glassMusic: '#ff9ec4',

  // Rideaux : chaque appartement a les siens.
  curtains: ['#e8d5c0', '#d9a3a3', '#a8bfa0', '#e0c88a', '#b9a8c9', '#efe0d0', '#c88f7a'],

  // Intérieurs.
  wall: ['#e6cfae', '#d9c3a8', '#e8d6bd', '#cfc0a6', '#e3cbb4', '#dcc9b0'],
  wallpaper: ['#c9a98a', '#b99d80', '#d0b295'],
  floor: ['#a9784f', '#96684a', '#b78a5e', '#8d6f52'],
  ceiling: '#f2e4cf',

  // Mobilier.
  wood: '#8a5f3c',
  woodDark: '#6b4830',
  fabric: ['#b5563f', '#4f7a6a', '#7a6a9c', '#c48a3f', '#5b7c98', '#a34e6a'],
  metal: '#8d939b',
  screen: '#2a3440',

  // Peau et cheveux : un immeuble, pas un catalogue.
  skin: ['#f6dcc0', '#f0c9a0', '#e6b98c', '#d69a72', '#c68a5e', '#b0764c', '#a3663f',
    '#8a5734', '#7d4a2b', '#664026', '#5c3620', '#48291a'],
  hair: ['#1f1912', '#2b2118', '#3a2a1e', '#4a3226', '#6d4a2f', '#8f6b3f', '#b98f4e',
    '#c9a45e', '#dcc084', '#7a2f28', '#a34a35', '#3a3f4a', '#a8a29c', '#d8d4ce', '#bdb7ae'],

  // Vêtements : des teintes franches, contrastées, jamais délavées. La règle
  // de la charte — couleurs riches — se joue ici et nulle part ailleurs.
  clothes: ['#c0503a', '#e07a3c', '#e8b13f', '#7fa03c', '#3f8a6e', '#3d7f9c', '#3a5a94',
    '#6a4f9c', '#a8407a', '#d4685f', '#2f6f66', '#b8763a', '#8a3f4a', '#4f7a4a',
    '#e3a04f', '#5f6f8c', '#9c4f2f', '#7a8a3f'],
  // Les bas sont plus sourds : sinon la silhouette se coupe en deux.
  trousers: ['#3a4658', '#2f3a4a', '#5a4a3c', '#46504a', '#6b5340', '#38414f',
    '#7a6650', '#4a4038', '#5c5f6b', '#8a7a62', '#33455c', '#6a4c42'],
  leather: ['#3b332c', '#5a4234', '#2f3540', '#7a6250', '#4a3a2e', '#8f8578', '#d9d2c6'],

  // Ambiances.
  night: '#131b2b',
  street: '#3a3630',
  streetLight: '#ffd9a0',
  ink: '#2b2018',

  // Interface.
  paper: '#f7efe2',
  accent: '#d4763f',
  accentSoft: '#f0b98a',
};

/** Ciel selon l'heure : 0 = minuit, 1 = minuit suivant. */
export function skyColors(dayFraction, season = 1) {
  const h = dayFraction * 24;
  // Points clés de la journée. On interpole entre eux.
  const keys = [
    { h: 0, top: '#0d1424', bot: '#1b2436' },
    { h: 5, top: '#1a2138', bot: '#3d3550' },
    { h: 6.5, top: '#3f4a72', bot: '#c98a6a' },   // aube
    { h: 8, top: '#7fa3c4', bot: '#d9c0a0' },
    { h: 12, top: '#8fb8d8', bot: '#cfe0e8' },    // plein jour
    { h: 17, top: '#8aaecd', bot: '#e0c7a8' },
    { h: 19, top: '#6b7fa8', bot: '#e79a63' },    // crépuscule
    { h: 20.5, top: '#39415f', bot: '#a86a5e' },
    { h: 22, top: '#1a2136', bot: '#2b3348' },
    { h: 24, top: '#0d1424', bot: '#1b2436' },
  ];
  let a = keys[0];
  let b = keys[keys.length - 1];
  for (let i = 0; i < keys.length - 1; i++) {
    if (h >= keys[i].h && h <= keys[i + 1].h) {
      a = keys[i];
      b = keys[i + 1];
      break;
    }
  }
  const t = (h - a.h) / Math.max(0.001, b.h - a.h);
  let top = mixHex(a.top, b.top, t);
  let bot = mixHex(a.bot, b.bot, t);

  // L'hiver refroidit et grisaille, l'été dore.
  if (season === 0) {
    top = mixHex(top, '#9aa4b0', 0.18);
    bot = mixHex(bot, '#b8bcc0', 0.18);
  } else if (season === 2) {
    top = mixHex(top, '#f0c48a', 0.1);
    bot = mixHex(bot, '#ffd9a0', 0.12);
  }
  return { top, bot };
}

/** Luminosité ambiante 0 (nuit noire) → 1 (plein jour). */
export function ambientLight(dayFraction) {
  const h = dayFraction * 24;
  if (h < 5 || h > 22) return 0.06;
  if (h < 7) return (h - 5) / 2 * 0.7;
  if (h < 18) return 1;
  if (h < 20.5) return 1 - (h - 18) / 2.5 * 0.85;
  return 0.15 - (h - 20.5) / 1.5 * 0.09;
}

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function rgbToHex(r, g, b) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function mixHex(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex(A.r + (B.r - A.r) * t, A.g + (B.g - A.g) * t, A.b + (B.b - A.b) * t);
}

export function shade(hex, amount) {
  const c = hexToRgb(hex);
  const t = amount < 0 ? 0 : 255;
  const k = Math.abs(amount);
  return rgbToHex(c.r + (t - c.r) * k, c.g + (t - c.g) * k, c.b + (t - c.b) * k);
}

export function rgba(hex, alpha) {
  const c = hexToRgb(hex);
  return `rgba(${c.r},${c.g},${c.b},${alpha})`;
}

/** Couleur stable tirée d'un identifiant : le même habitant garde ses habits. */
export function pickStable(list, seed) {
  let h = 2166136261 >>> 0;
  const s = String(seed);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return list[(h >>> 0) % list.length];
}
