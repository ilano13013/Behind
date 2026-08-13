// Le trait.
//
// Tout Behind est dessiné avec la même encre : un contour épais et sombre,
// puis un aplat par-dessus. Ces six fonctions sont la base commune de la
// charte graphique — la façade, les habitants, les meubles et les
// pictogrammes passent tous par là, ce qui garantit qu'aucun élément ne
// détonne dans l'image.

export const INK = '#241a13';
// Épaisseur du trait, dans le repère du personnage (118 unités de haut).
// À 2,5 le contour faisait un sixième de la largeur d'un torse : les
// personnages étaient noyés dans leur propre encre.
export const LINE = 1.9;

/** Prépare le pinceau à encrer. */
export function ink(ctx, w = LINE) {
  ctx.strokeStyle = INK;
  ctx.lineWidth = w;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
}

/** Remplit le chemin courant puis l'encre. */
export function paint(ctx, color, outline = true, w = LINE) {
  ctx.fillStyle = color;
  ctx.fill();
  if (outline) {
    ink(ctx, w);
    ctx.stroke();
  }
}

/**
 * Encre puis remplit — l'ordre inverse, et la différence est capitale.
 * Le trait est tracé d'abord, très épais, puis l'aplat le recouvre par
 * l'intérieur : il ne reste que la moitié extérieure du trait. Résultat,
 * un volume construit de plusieurs capsules n'a aucune couture interne.
 */
export function solid(ctx, build, color, outline = true, lw = LINE * 1.9) {
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

/** Ajoute une capsule au chemin courant, sans l'ouvrir ni le fermer. */
export function capsulePath(ctx, ax, ay, bx, by, wa, wb = wa) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  ctx.moveTo(ax + nx * wa, ay + ny * wa);
  ctx.lineTo(bx + nx * wb, by + ny * wb);
  ctx.arc(bx, by, wb, Math.atan2(ny, nx), Math.atan2(-ny, -nx), true);
  ctx.lineTo(ax - nx * wa, ay - ny * wa);
  ctx.arc(ax, ay, wa, Math.atan2(-ny, -nx), Math.atan2(ny, nx), true);
  ctx.closePath();
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
