// La caméra.
//
// Un seul mouvement, mais c'est le mouvement du jeu : on part de la
// façade, on s'approche d'une fenêtre, et le mur s'efface. Il ne faut
// jamais qu'on ait l'impression de changer d'écran — juste de s'approcher
// suffisamment pour voir à travers.

import { smoothstep } from '../core/rng.js';
import { rgba } from './palette.js';

export const VIEW = {
  FACADE: 'facade',
  ZOOM_IN: 'zoom-in',
  INTERIEUR: 'interieur',
  ZOOM_OUT: 'zoom-out',
};

export class Camera {
  constructor() {
    this.state = VIEW.FACADE;
    this.apartment = null;
    this.t = 0;
    this.duration = 0.85;
  }

  get zoomed() {
    return this.state === VIEW.INTERIEUR;
  }

  get busy() {
    return this.state === VIEW.ZOOM_IN || this.state === VIEW.ZOOM_OUT;
  }

  enter(apt) {
    if (this.state === VIEW.INTERIEUR && this.apartment === apt) return;
    this.apartment = apt;
    this.state = VIEW.ZOOM_IN;
    this.t = 0;
  }

  leave() {
    if (this.state === VIEW.FACADE) return;
    this.state = VIEW.ZOOM_OUT;
    this.t = 0;
  }

  update(dt) {
    if (!this.busy) return;
    this.t += dt / this.duration;
    if (this.t >= 1) {
      this.t = 0;
      this.state = this.state === VIEW.ZOOM_IN ? VIEW.INTERIEUR : VIEW.FACADE;
      if (this.state === VIEW.FACADE) this.apartment = null;
    }
  }

  /** Avancement 0 → 1 de l'approche, quel que soit le sens. */
  progress() {
    if (this.state === VIEW.FACADE) return 0;
    if (this.state === VIEW.INTERIEUR) return 1;
    const u = smoothstep(Math.min(1, Math.max(0, this.t)));
    return this.state === VIEW.ZOOM_IN ? u : 1 - u;
  }
}

/**
 * Le cadre que doit occuper l'intérieur une fois le zoom terminé.
 *
 * On réserve la colonne de droite pour la fiche d'habitant et le bas pour
 * la chronique : la pièce doit rester entièrement visible pendant qu'on
 * lit ce qui s'y passe.
 */
const PANEL_RIGHT = 356;
const PANEL_BOTTOM = 150;
const PANEL_TOP = 86;

export function interiorTarget(width, height) {
  const availW = Math.max(320, width - PANEL_RIGHT - 28);
  const availH = Math.max(220, height - PANEL_TOP - PANEL_BOTTOM);
  // Une pièce en coupe est large et basse, mais pas au point d'avoir un
  // grand mur vide au-dessus des meubles.
  const w = Math.min(availW, availH * 2.15);
  const h = Math.min(availH, w / 2.15);
  return {
    x: 14 + (availW - w) / 2,
    y: PANEL_TOP + (availH - h) / 2,
    w,
    h,
  };
}

/** Interpole entre le rectangle de la fenêtre et celui de l'intérieur. */
export function lerpRect(a, b, u) {
  return {
    x: a.x + (b.x - a.x) * u,
    y: a.y + (b.y - a.y) * u,
    w: a.w + (b.w - a.w) * u,
    h: a.h + (b.h - a.h) * u,
  };
}

/**
 * Transformation appliquée à la façade pendant l'approche : la fenêtre
 * visée grossit jusqu'à occuper le cadre intérieur, et tout le reste de
 * l'immeuble grossit avec elle. C'est ce qui donne la sensation d'avancer
 * plutôt que de zapper.
 */
export function facadeTransform(ctx, from, to, u) {
  if (u <= 0) return;
  const scale = 1 + (to.w / Math.max(1, from.w) - 1) * u;
  const fromCx = from.x + from.w / 2;
  const fromCy = from.y + from.h / 2;
  const toCx = to.x + to.w / 2;
  const toCy = to.y + to.h / 2;
  const cx = fromCx + (toCx - fromCx) * u;
  const cy = fromCy + (toCy - fromCy) * u;
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.translate(-fromCx, -fromCy);
}

/** Assombrit le pourtour quand on est entré : l'attention va à la pièce. */
export function drawVignette(ctx, width, height, rect, strength) {
  if (strength <= 0.01) return;
  ctx.save();
  ctx.fillStyle = rgba('#0a0d16', 0.72 * strength);
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.fill('evenodd');
  ctx.restore();
}

/**
 * Le cadre de la scène finale.
 *
 * Elle ne partage l'écran avec rien : pas de fiche, pas de chronique, pas
 * de jauge. On regarde, et c'est tout.
 */
export function finaleTarget(width, height) {
  const w = Math.min(width * 0.92, height * 1.9);
  const h = Math.min(height * 0.74, w / 1.9);
  return { x: (width - w) / 2, y: (height - h) / 2 - height * 0.02, w, h };
}
