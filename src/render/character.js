// Les habitants, dessinés.
//
// Direction : animation urbaine française. Traits d'encre épais, aplats
// francs, une seule ombre portée par volume, et des proportions assumées —
// réalisme stylisé, jamais caricature molle. Personne n'est joli, tout le
// monde est reconnaissable.
//
// Ce fichier n'invente plus les pièces : il les prend dans wardrobe.js, qui
// tient le catalogue (morphologies, visages, coiffures, tenues). Ici on ne
// fait que deux choses — assembler un corps à partir d'une morphologie, et
// le dessiner d'après des articulations déjà lissées par anim.js.

import { PALETTE, shade, rgba } from './palette.js';
import { INK, LINE, ink, paint, solid, capsulePath, roundRect } from './ink.js';
import { updateRig, POSES, poseFor, applySpeech, startleOf } from './anim.js';
import {
  appearance, outfitOf, heightFactor, HEADS, EYES, NOSES, MOUTHS,
  HAIR, HAIR_BEHIND, BEARDS, BEARD_COVERS_MOUTH, GLASSES,
  drawTopDetails, drawCollar, drawAccessory, drawTinyAccessory, drawHeadAccessory,
  drawShoe,
} from './wardrobe.js';

// Le canon de la charte : « proportions légèrement caricaturales ». Ni le
// réalisme (huit têtes, sec) ni le chibi (quatre têtes, mignon). On vise un
// peu moins de six têtes, avec des épaules larges et des membres courts —
// c'est ce qui donne des silhouettes trapues et lisibles au lieu des
// échalas qu'on obtenait avec des jambes de quarante-six unités.
const LEG = 42;
const TORSO = 36;
const NECK = 13;
const HEAD = 13.2;
const UNITS = LEG + TORSO + NECK + HEAD * 2;   // hauteur totale du pantin

/**
 * Ce que le visage doit raconter, en un mot.
 *
 * Quarante visages existent (voir anim.js) ; c'est ici qu'on décide lequel
 * porter. L'ordre des tests EST l'ordre des priorités : un sursaut passe
 * avant l'humeur, une colère avant la fatigue, un corps malade avant un
 * moral bas. On lit d'abord ce qui arrive, ensuite ce qu'on fait, enfin ce
 * qu'on est.
 */
export function emotionOf(person) {
  const startle = startleOf(person);
  if (startle) return startle;

  const mood = person.mood ?? 60;
  const stress = person.stress ?? 20;
  const sante = person.health ?? 90;
  const energie = person.needs?.get?.('energie') ?? 70;
  const social = person.needs?.get?.('social') ?? 70;
  const plaisir = person.needs?.get?.('plaisir') ?? 70;
  const act = person.action?.id;
  const P = person.personality;
  const trait = (t) => P?.has?.(t) === true;
  const f = (x) => Math.max(0.3, Math.min(1, x));

  // --- 1. Ce qu'on est en train de faire ---
  if (act === 'dormir' || act === 'soigner') return { kind: 'endormie', force: 1 };
  if (act === 'insomnie') return { kind: 'fatiguee', force: 0.9 };
  if (act === 'confronter' || act === 'plaindre') {
    // On ne s'énerve pas tous pareil : le colérique crie, le rancunier toise.
    return { kind: trait('colerique') ? 'colere' : 'menace', force: 1 };
  }
  if (act === 'flirter') return { kind: 'amoureuse', force: 0.9 };
  if (act === 'reconcilier') return { kind: 'honteuse', force: 0.7 };
  if (act === 'espionner') return { kind: 'suspicieuse', force: 0.85 };
  if (act === 'boire') {
    return { kind: (person.addiction ?? 0) > 0.4 ? 'ivre' : 'resignee', force: 0.8 };
  }
  if (act === 'bricoler' || act === 'teletravail' || act === 'chercher_emploi') {
    return { kind: 'concentree', force: 0.7 };
  }
  if (act === 'sport') return { kind: 'determinee', force: 0.8 };
  if (act === 'fete' || act === 'musique' || act === 'betise') {
    return { kind: mood > 80 ? 'fou_rire' : 'euphorique', force: 0.85 };
  }
  if (act === 'famille_temps' || act === 'visiter') {
    return { kind: 'attendrie', force: 0.6 };
  }
  if (act === 'lire') return { kind: 'curieuse', force: 0.6 };

  // --- 2. Ce que le corps subit ---
  if (sante < 45) return { kind: 'malade', force: f((60 - sante) / 40) };
  if (stress > 90) return { kind: 'panique', force: 1 };
  if (stress > 82) return { kind: 'peur', force: f((stress - 78) / 22) };
  if (energie < 14) return { kind: 'assoupie', force: 0.9 };

  // --- 3. Ce qui pèse sur le moral ---
  if (act === 'ruminer' || mood < 22) {
    return { kind: trait('anxieux') ? 'inquiete' : 'triste', force: f((45 - mood) / 30) };
  }
  if (mood < 34) return { kind: 'resignee', force: f((45 - mood) / 30) };
  if (stress > 66) return { kind: 'stressee', force: f((stress - 60) / 40) };
  if (person.debt > 1200) return { kind: 'inquiete', force: 0.7 };
  if (energie < 28) return { kind: 'fatiguee', force: f((32 - energie) / 30) };

  // --- 4. Ce qui manque ---
  if (social < 22) return { kind: 'ennui', force: 0.7 };
  if (plaisir < 22) return { kind: 'ennui', force: 0.6 };

  // --- 5. Ce qu'on est, quand rien ne presse ---
  if (mood > 84) return { kind: 'heureuse', force: f((mood - 70) / 30) };
  if (mood > 74) return { kind: trait('drole') ? 'amusee' : 'soulagee', force: 0.6 };
  if (person.isOld && trait('rancunier')) return { kind: 'mepris', force: 0.5 };
  if (person.isOld) return { kind: 'nostalgique', force: 0.5 };
  if (trait('jaloux') && person.relations?.partner()) return { kind: 'jalousie', force: 0.6 };
  if (trait('orgueilleux') && mood > 62) return { kind: 'fiere', force: 0.5 };
  if (trait('discret') || trait('anxieux')) return { kind: 'timide', force: 0.5 };
  if (trait('curieux')) return { kind: 'curieuse', force: 0.5 };
  if (act === 'rien' || act === undefined) return { kind: 'songeuse', force: 0.6 };
  return { kind: 'neutre', force: 0.3 };
}

// --- Mains ------------------------------------------------------------------

/**
 * Une main.
 *
 * C'est le détail qui change tout : dans ce style, les mains parlent autant
 * que les visages. Paume large, doigts longs qui s'écartent selon
 * l'ouverture, pouce à part. Un seul chemin pour l'ensemble, encré puis
 * rempli — sinon c'est une moufle avec des coutures.
 */
function drawHand(ctx, x, y, angle, open, skin, size, outline = true) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const s = size;
  const spread = 0.26 + open * 0.6;

  ctx.beginPath();
  const cap = (ax, ay, bx, by, w) => capsulePath(ctx, ax, ay, bx, by, w);

  for (let i = 0; i < 4; i++) {
    const a = (i - 1.5) * spread * 0.44 - Math.PI / 2;
    const len = s * (i === 0 || i === 3 ? 1.35 : 1.65);
    cap(Math.cos(a) * s * 0.5, Math.sin(a) * s * 0.5 + s * 0.1,
      Math.cos(a) * len, Math.sin(a) * len + s * 0.1, s * 0.24);
  }
  const ta = -Math.PI / 2 - (0.95 + open * 0.55);
  cap(0, s * 0.2, Math.cos(ta) * s * 1.15, Math.sin(ta) * s * 0.8 + s * 0.2, s * 0.27);
  ctx.moveTo(s * 0.66, s * 0.12);
  ctx.ellipse(0, s * 0.12, s * 0.66, s * 0.74, 0, 0, Math.PI * 2);

  if (outline) {
    ctx.strokeStyle = INK;
    // Le contour d'une main se mesure sur la main. Calé sur l'épaisseur du
    // corps, il mangeait la paume et il ne restait qu'un nœud sombre.
    ctx.lineWidth = Math.min(LINE * 1.4, s * 0.34);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  ctx.fillStyle = skin;
  ctx.fill();
  ctx.restore();
}

// --- Membres ----------------------------------------------------------------
//
// Règle qui change tout : un membre entier est UN seul chemin. Cuisse et
// mollet dans le même tracé, contour encré épais, puis remplissage —
// les coutures internes disparaissent et le membre devient continu.

/** Une jambe entière, habillée du bas choisi dans la garde-robe. */
function drawLeg(ctx, L, B, look, outline, silhouette, skirted = false) {
  const bot = look.bottom;
  const skin = silhouette ? INK : look.skin;
  const cloth = silhouette ? INK : look.bottomColor;
  const wide = bot.width;
  // Jusqu'où descend le tissu : 1 = cheville, 0.5 = mi-cuisse.
  const cut = bot.length;
  const kneeT = 1; // le genou est le point de bascule cuisse/mollet

  // La jambe nue d'abord — un short ne cache pas le mollet.
  solid(ctx, () => {
    capsulePath(ctx, L.hx, L.hy, L.kx, L.ky, 6.0 * B, 4.9 * B);
    capsulePath(ctx, L.kx, L.ky, L.fx, L.fy, 4.9 * B, 3.9 * B);
  }, skin, outline);

  // Sous une jupe, la jambe reste nue : le volume est dessiné après, une
  // seule fois pour les deux jambes.
  if (skirted) return;

  // Puis le tissu par-dessus, découpé à la bonne longueur.
  const hem = hemPoint(L, cut);
  solid(ctx, () => {
    if (cut > kneeT * 0.62) {
      capsulePath(ctx, L.hx, L.hy - 2, L.kx, L.ky, 6.6 * B * wide, 5.4 * B * wide);
      capsulePath(ctx, L.kx, L.ky, hem.x, hem.y, 5.4 * B * wide, 4.5 * B * wide);
    } else {
      capsulePath(ctx, L.hx, L.hy - 2, hem.x, hem.y, 6.8 * B * wide, 5.8 * B * wide);
    }
  }, cloth, outline);

  if (!outline) return;

  // Ourlet : une ligne en travers, et le vêtement a un bord.
  const a = Math.atan2(hem.y - L.ky, hem.x - L.kx);
  ctx.beginPath();
  ctx.moveTo(hem.x - Math.sin(a) * 4.6 * B * wide, hem.y + Math.cos(a) * 4.6 * B * wide);
  ctx.lineTo(hem.x + Math.sin(a) * 4.6 * B * wide, hem.y - Math.cos(a) * 4.6 * B * wide);
  ink(ctx, bot.cuff ? LINE * 1.3 : LINE * 0.75);
  ctx.stroke();

  // Couture latérale du jean, bande du jogging, pli du costume.
  if (bot.seam || bot.stripe || bot.crease) {
    ctx.beginPath();
    ctx.moveTo(L.hx + (L.side ?? 1) * 3 * B, L.hy);
    ctx.quadraticCurveTo(L.kx + (L.side ?? 1) * 2 * B, L.ky, hem.x + (L.side ?? 1) * 1.5 * B, hem.y);
    ctx.strokeStyle = bot.stripe ? rgba('#f2ece0', 0.85) : rgba(shade(look.bottomColor, -0.45), 0.7);
    ctx.lineWidth = bot.stripe ? LINE * 0.9 : LINE * 0.5;
    ctx.stroke();
  }
  if (bot.pockets) {
    ctx.beginPath();
    ctx.moveTo(L.hx - 4 * B, L.hy + 2);
    ctx.quadraticCurveTo(L.hx, L.hy + 7, L.hx + 4 * B, L.hy + 1);
    ctx.strokeStyle = rgba(shade(look.bottomColor, -0.5), 0.6);
    ctx.lineWidth = LINE * 0.45;
    ctx.stroke();
  }
  // Jean déchiré : deux accrocs francs sur la cuisse, la peau dessous.
  if (bot.torn) {
    ctx.strokeStyle = look.skin;
    ctx.lineWidth = LINE * 1.1;
    ctx.lineCap = 'round';
    for (const k of [0.3, 0.52]) {
      const tx = L.hx + (L.kx - L.hx) * k;
      const ty = L.hy + (L.ky - L.hy) * k;
      ctx.beginPath();
      ctx.moveTo(tx - 2.4 * B, ty);
      ctx.lineTo(tx + 2.4 * B, ty - 1);
      ctx.stroke();
    }
  }
}

/** Le point où s'arrête le tissu sur la jambe. */
function hemPoint(L, cut) {
  if (cut >= 0.98) return { x: L.fx, y: L.fy };
  if (cut > 0.62) {
    const k = (cut - 0.62) / 0.38;
    return { x: L.kx + (L.fx - L.kx) * k, y: L.ky + (L.fy - L.ky) * k };
  }
  const k = cut / 0.62;
  return { x: L.hx + (L.kx - L.hx) * k, y: L.hy + (L.ky - L.hy) * k };
}

/**
 * Un bras entier : bras + avant-bras en un tracé couleur peau, puis la
 * manche par-dessus. C'est l'ordre du dessinateur — on construit le corps,
 * on l'habille ensuite. La manche est peinte À L'INTÉRIEUR du bras : posée
 * dessus, son contour dessinerait une boucle en travers de l'épaule.
 */
function drawArm(ctx, sx, sy, shoulder, elbow, open, B, M, look, outline, silhouette) {
  // Bras courts : le poignet doit tomber à la hanche, pas au genou.
  const upper = 18 * B * M.limb;
  const fore = 16.5 * B * M.limb;
  const ex = sx + Math.sin(shoulder) * upper;
  const ey = sy + Math.cos(shoulder) * upper;
  const wristA = shoulder + elbow;
  const wx = ex + Math.sin(wristA) * fore;
  const wy = ey + Math.cos(wristA) * fore;
  const skin = silhouette ? INK : look.skin;
  const sleeveColor = silhouette ? INK : look.topColor;

  const arm = () => {
    capsulePath(ctx, sx, sy, ex, ey, 5.2 * B, 4.3 * B);
    capsulePath(ctx, ex, ey, wx, wy, 4.3 * B, 3.5 * B);
  };
  solid(ctx, arm, skin, outline);

  // Longueur de manche : -1 sans manche, 0 courte, 1 longue.
  const sleeve = look.top.sleeve;
  if (sleeve >= 0) {
    const k = sleeve === 1 ? 0.82 : 0.6;
    const endX = sleeve === 1 ? ex + (wx - ex) * k : sx + (ex - sx) * k;
    const endY = sleeve === 1 ? ey + (wy - ey) * k : sy + (ey - sy) * k;
    ctx.save();
    ctx.beginPath();
    arm();
    ctx.clip();
    ctx.beginPath();
    capsulePath(ctx, sx - 2, sy - 2, endX, endY, 7 * B, 5.4 * B);
    ctx.fillStyle = sleeveColor;
    ctx.fill();
    ctx.restore();
    if (outline) {
      const a = Math.atan2(endY - sy, endX - sx);
      ctx.beginPath();
      ctx.moveTo(endX - Math.sin(a) * 4.4 * B, endY + Math.cos(a) * 4.4 * B);
      ctx.lineTo(endX + Math.sin(a) * 4.4 * B, endY - Math.cos(a) * 4.4 * B);
      ink(ctx, LINE * 0.85);
      ctx.stroke();
    }
  }

  // Tatouage : trois marques sur l'avant-bras, visibles seulement si la
  // manche ne le couvre pas. C'est peu, mais on le remarque tout de suite.
  if (outline && look.tattoo && sleeve !== 1) {
    ctx.save();
    ctx.strokeStyle = rgba(INK, 0.5);
    ctx.lineWidth = LINE * 0.55;
    ctx.lineCap = 'round';
    for (const k of [0.35, 0.5, 0.65]) {
      const tx = ex + (wx - ex) * k;
      const ty = ey + (wy - ey) * k;
      const a = Math.atan2(wy - ey, wx - ex);
      ctx.beginPath();
      ctx.moveTo(tx - Math.sin(a) * 2.6 * B, ty + Math.cos(a) * 2.6 * B);
      ctx.lineTo(tx + Math.sin(a) * 2.6 * B, ty - Math.cos(a) * 2.6 * B);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (outline) drawTinyAccessory(ctx, look, 'poignet', wx, wy, 3.4 * B);
  drawHand(ctx, wx, wy, wristA + Math.PI, open, skin, 5.0 * B, outline);
}

// --- Le pantin --------------------------------------------------------------

/**
 * Dessine un habitant.
 * @param {object} o { time, dt, facing, silhouette, alpha, pose }
 */
export function drawCharacter(ctx, person, x, y, h, o = {}) {
  // Le visage est permanent, la tenue est un contexte : on fusionne les
  // deux ici, une fois par image. `o.outfit` permet à la planche de forcer
  // un contexte précis.
  const base = appearance(person);
  const fit = o.outfit
    ? (base.outfits[o.outfit] ?? base.outfits.quotidien)
    : outfitOf(person);
  const look = { ...base, ...fit };
  const M = look.proportions;
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
  const outline = !silhouette;
  const skin = silhouette ? INK : look.skin;
  const cloth = silhouette ? INK : look.topColor;
  const trousers = silhouette ? INK : look.bottomColor;

  // --- Squelette, déduit de la morphologie ---
  const hipY = -LEG * M.leg + drop;
  const shoulderY = (hipY - TORSO * M.torso) * c.squash + drop * 0.1;
  const headR = HEAD * M.head * (0.9 + B * 0.12);
  const headY = shoulderY - NECK * M.neck - headR;
  const shW = 16.4 * B * M.shoulder;
  const waW = 10.4 * B * M.waist;
  const hiW = 12.0 * B * M.hip;
  const waistY = (shoulderY + hipY) / 2 + 2;
  const hemY = hipY + 5;
  const spread = 6.0 * B * M.hip;
  // La posture du gabarit : un ado se voûte, un senior aussi, autrement.
  const lean = c.lean + M.posture;
  const geo = { shW, waW, hiW, shoulderY, waistY, hemY, B };

  const farArm = () => drawArm(ctx, -shW * 0.86, shoulderY + 7,
    c.armL, c.elbowL, c.handL, B, M, look, outline, silhouette);
  const nearArm = () => drawArm(ctx, shW * 0.86, shoulderY + 7,
    c.armR, c.elbowR, c.handR, B, M, look, outline, silhouette);

  // 1. Bras arrière : il passe derrière le buste, sinon tout est à plat.
  farArm();

  // 2. Jambes. Le genou part en avant : une jambe parfaitement droite
  //    n'existe pas debout.
  const legGeom = (side, ang) => {
    const hx = side * spread;
    if (sit > 0.5) {
      const kx = hx - 16 * M.leg;
      return { side, hx, hy: hipY, kx, ky: hipY + 3, fx: kx - 1, fy: 0 };
    }
    return {
      side,
      hx,
      hy: hipY,
      kx: hx + Math.sin(ang) * 14 * M.step + 1.5,
      ky: hipY * 0.47 - Math.abs(Math.sin(ang)) * 3,
      fx: hx + Math.sin(ang) * 27 * M.step,
      fy: -Math.abs(Math.sin(ang)) * 7,
    };
  };
  const skirted = look.bottom.skirt === true;
  for (const L of [legGeom(-1, c.legL), legGeom(1, c.legR)]) {
    drawLeg(ctx, L, B, look, outline, silhouette, skirted);
    drawShoe(ctx, look.shoe, L.fx, L.fy, L.side, silhouette ? INK : look.shoeColor,
      silhouette, silhouette ? INK : look.skin);
  }

  // 3. Bassin : il relie les deux cuisses, sinon le personnage est fendu.
  solid(ctx, () => {
    capsulePath(ctx, -spread, hipY - 1, spread, hipY - 1, 5.6 * B * M.hip);
  }, trousers, outline);

  // 3 bis. La jupe : UN volume par-dessus les deux jambes, pas un pantalon
  // large — c'est exactement la différence entre une jupe et un sarouel.
  if (skirted) {
    const hemYs = hipY * (1 - look.bottom.length);
    const hemW = hiW * look.bottom.width;
    solid(ctx, () => {
      ctx.moveTo(-hiW * 0.95, hipY - 3);
      ctx.lineTo(hiW * 0.95, hipY - 3);
      ctx.quadraticCurveTo(hemW * 1.02, (hipY + hemYs) / 2, hemW, hemYs);
      ctx.quadraticCurveTo(0, hemYs + 3, -hemW, hemYs);
      ctx.quadraticCurveTo(-hemW * 1.02, (hipY + hemYs) / 2, -hiW * 0.95, hipY - 3);
      ctx.closePath();
    }, trousers, outline);
    if (outline && look.bottom.pleats) {
      ink(ctx, LINE * 0.5);
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(i * hiW * 0.32, hipY - 1);
        ctx.lineTo(i * hemW * 0.42, hemYs + 1);
        ctx.stroke();
      }
    }
  }

  // 4. Cou, avant le buste : le col viendra le recouvrir à la base.
  ctx.save();
  ctx.translate(0, hipY);
  ctx.rotate(lean * 0.5 + c.twist * 0.18);
  ctx.translate(0, -hipY);
  solid(ctx, () => {
    capsulePath(ctx, 0, headY + headR * 0.55, 0, shoulderY + 4, 3.9 * B, 5.4 * B);
  }, skin, outline);

  // 5. Le buste : épaules, taille, hanches. Plus jamais un trapèze.
  const hemW = look.top.dress ? hiW * 1.45 : hiW;
  const bustY = shoulderY + (hipY - shoulderY) * 0.38;
  solid(ctx, () => {
    ctx.moveTo(-shW, shoulderY + 6);
    // Trapèzes : l'épaule remonte vers le cou au lieu d'être coupée net.
    ctx.quadraticCurveTo(-shW * 0.86, shoulderY - 3, -4.4 * B, shoulderY - 1);
    ctx.lineTo(4.4 * B, shoulderY - 1);
    ctx.quadraticCurveTo(shW * 0.86, shoulderY - 3, shW, shoulderY + 6);
    // Deltoïde, poitrine, creux de la taille, puis hanche.
    ctx.quadraticCurveTo(shW * 1.06, shoulderY + 12, shW * 0.92, bustY);
    ctx.quadraticCurveTo(waW * 1.02, waistY - 3, waW, waistY);
    ctx.quadraticCurveTo(hemW * 1.02, hemY - 6, hemW, hemY);
    ctx.lineTo(-hemW, hemY);
    ctx.quadraticCurveTo(-hemW * 1.02, hemY - 6, -waW, waistY);
    ctx.quadraticCurveTo(-waW * 1.02, waistY - 3, -shW * 0.92, bustY);
    ctx.quadraticCurveTo(-shW * 1.06, shoulderY + 12, -shW, shoulderY + 6);
    ctx.closePath();
  }, cloth, outline);

  if (outline) {
    // Motif, ombre, poches, boutonnage : tout ce qui se passe dans le tissu
    // est peint à l'intérieur du buste déjà découpé, donc rien ne déborde.
    ctx.save();
    ctx.clip();
    drawTopDetails(ctx, look, { ...geo, hemY, hemW });
    ctx.restore();

    drawCollar(ctx, look, geo);
    drawAccessory(ctx, look, geo);

    // Bas du vêtement : une ligne, et le pantalon existe.
    ctx.beginPath();
    ctx.moveTo(-hemW * 0.92, hemY - 1);
    ctx.quadraticCurveTo(0, hemY + 2, hemW * 0.92, hemY - 1);
    ink(ctx, LINE * 0.8);
    ctx.stroke();
  }
  ctx.restore();

  // 6. Bras avant, par-dessus le buste.
  ctx.save();
  ctx.translate(0, hipY);
  ctx.rotate(lean * 0.5 + c.twist * 0.18);
  ctx.translate(0, -hipY);
  nearArm();
  ctx.restore();

  // 7. Tête.
  ctx.save();
  ctx.translate(0, hipY);
  ctx.rotate(lean * 0.5);
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
  const hairShape = HAIR[look.hairStyle] ?? HAIR[0];

  // Les cheveux longs passent DERRIÈRE la tête : sinon la masse arrière
  // recouvre le visage au lieu de l'encadrer.
  if (HAIR_BEHIND.has(look.hairStyle)) {
    ctx.beginPath();
    hairShape(ctx, r);
    paint(ctx, silhouette ? INK : shade(look.hair, -0.14), !silhouette, LINE * 0.9);
  }

  // Crâne + mâchoire : une seule silhouette, pas un rond.
  ctx.beginPath();
  (HEADS[look.head] ?? HEADS[0])(ctx, r);
  ctx.closePath();
  paint(ctx, skin, !silhouette);

  if (silhouette) {
    ctx.beginPath();
    hairShape(ctx, r);
    paint(ctx, INK, false);
    if (look.hat) look.hat.draw(ctx, r, INK, true);
    return;
  }

  // Ombre du visage, côté opposé à la lumière. Un dégradé, pas un aplat :
  // un aplat posait une arête verticale nette au milieu de la figure, et
  // le visage semblait coupé en deux.
  ctx.save();
  ctx.clip();
  const faceShade = ctx.createLinearGradient(r * 0.1, 0, r * 1.1, 0);
  faceShade.addColorStop(0, rgba(shade(look.skin, -0.4), 0));
  faceShade.addColorStop(1, rgba(shade(look.skin, -0.4), 0.34));
  ctx.fillStyle = faceShade;
  ctx.fillRect(-r * 1.4, -r * 1.4, r * 2.8, r * 2.8);
  ctx.restore();

  // Oreilles, avant les cheveux.
  if (look.ears < 2) {
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(side * r * 0.98, r * 0.05, r * 0.14, r * 0.24, 0, 0, Math.PI * 2);
      paint(ctx, skin, true, LINE * 0.8);
      drawTinyAccessory(ctx, look, 'oreille', side * r * 0.98, r * 0.26, r);
    }
  }

  // Le canon du visage. Toutes les épaisseurs de trait sont exprimées en
  // fraction du rayon du crâne — c'est la seule façon d'avoir un nez fin
  // sur une grosse tête comme sur une petite. Le réglage d'avant montait à
  // 10 % du rayon, ce qui donnait une bouche en barre et un nez en crochet.
  const eyeY = -r * 0.06;
  const eyeDx = r * 0.36;
  const E = EYES[look.eyes] ?? EYES[0];

  // Les yeux d'abord, les lunettes ensuite : des verres translucides
  // laissent voir le regard au lieu de l'effacer.
  for (const side of [-1, 1]) drawEye(ctx, E, c, r, side, tx, eyeY, eyeDx, turn);
  if (look.glasses >= 0) drawGlasses(ctx, GLASSES[look.glasses], look, r, tx, eyeY, eyeDx);

  // Pilosité AVANT le nez et la bouche : peinte après, la barbe recouvrait
  // la bouche et le visage n'avait plus d'expression.
  const beard = BEARDS[look.beard];
  if (beard) {
    ctx.beginPath();
    beard.draw(ctx, r);
    paint(ctx, beard.faded ? rgba(look.hair, 0.34) : look.hair,
      !beard.faded, LINE * 0.8);
  }

  drawNose(ctx, look, r, tx, eyeY);
  drawMouth(ctx, look, c, r, tx, BEARD_COVERS_MOUTH.has(look.beard));

  // Cheveux de devant, puis casque audio et couvre-chef par-dessus tout.
  ctx.beginPath();
  hairShape(ctx, r);
  paint(ctx, look.hair, true, LINE * 0.9);

  // Les sourcils PAR-DESSUS les cheveux. C'est contre-intuitif — une frange
  // passe devant, en vrai — mais les sourcils sont le premier canal
  // d'expression du visage : dessinés sous la coiffure, la moitié des
  // quarante expressions devenaient illisibles.
  drawBrows(ctx, look, c, r, tx, eyeY, eyeDx);

  drawHeadAccessory(ctx, look, r);
  if (look.hat) look.hat.draw(ctx, r, look.hat.color, false);

  const emo = emotionOf(person);
  if (['amoureuse', 'heureuse', 'timide', 'attendrie'].includes(emo.kind)
    || (person.mood ?? 60) > 82) {
    ctx.fillStyle = 'rgba(214,102,102,0.28)';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(tx + side * r * 0.66, r * 0.3, r * 0.22, r * 0.13, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Une goutte de sueur : la peur et le stress se lisent sur la tempe.
  if (['peur', 'panique', 'stressee', 'malade'].includes(emo.kind)) {
    ctx.beginPath();
    ctx.moveTo(r * 0.86, -r * 0.62);
    ctx.quadraticCurveTo(r * 1.04, -r * 0.36, r * 0.86, -r * 0.28);
    ctx.quadraticCurveTo(r * 0.7, -r * 0.36, r * 0.86, -r * 0.62);
    ctx.closePath();
    paint(ctx, 'rgba(150,205,235,0.9)', true, LINE * 0.5);
  }
}

/** Les sourcils : le premier outil d'expression, et de loin le plus lisible. */
function drawBrows(ctx, look, c, r, tx, eyeY, eyeDx) {
  ctx.save();
  ctx.strokeStyle = shade(look.hair, -0.1);
  ctx.lineWidth = r * 0.085;
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    const bx = tx + side * eyeDx;
    // Assez bas pour rester sous la plupart des franges : un sourcil
    // caché, et la colère ne se lit plus.
    const by = eyeY - r * 0.38 - c.brow * r * 0.12;
    const inner = c.browInner * r * 0.2;
    ctx.beginPath();
    ctx.moveTo(bx - side * r * 0.25, by + inner);
    ctx.quadraticCurveTo(bx, by - r * 0.09, bx + side * r * 0.23, by - inner * 0.3);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Un œil.
 *
 * La forme vient du catalogue (rond, en amande, tombant, cerné, maquillé…),
 * l'ouverture et la direction du regard viennent du pantin. La paupière
 * supérieure est un trait franc posé sur l'œil : sans elle, l'œil est une
 * bille collée sur le visage.
 */
function drawEye(ctx, E, c, r, side, tx, eyeY, eyeDx, turn) {
  const open = Math.max(0, Math.min(1, c.eye));
  const ex = tx + side * eyeDx;
  const ey = eyeY + side * (E.tilt ?? 0) * r * -0.5;
  const ew = r * E.w;

  if (E.ring) {
    // Cerne : une ombre basse, et le personnage a mal dormi depuis des années.
    ctx.beginPath();
    ctx.ellipse(ex, ey + r * 0.16, ew * 1.05, r * 0.13, 0, 0, Math.PI);
    ctx.fillStyle = rgba('#8a6a70', 0.3 * E.ring);
    ctx.fill();
  }

  if (open < 0.12) {
    ctx.beginPath();
    ctx.moveTo(ex - ew, ey);
    ctx.quadraticCurveTo(ex, ey + r * 0.13, ex + ew, ey);
    ink(ctx, r * 0.062);
    ctx.stroke();
    return;
  }

  const eh = r * E.h * open;
  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(side * (E.tilt ?? 0));
  ctx.beginPath();
  ctx.ellipse(0, 0, ew, eh, 0, 0, Math.PI * 2);
  paint(ctx, '#fdfaf4', true, r * 0.05);

  // Pupille : elle suit le regard, elle ne reste jamais plein centre.
  const pr = Math.min(ew * 0.6, eh * 0.86, r * 0.105);
  const px = turn * r * 0.08;
  const py = c.browInner > 0.5 ? eh * 0.22 : 0;
  ctx.beginPath();
  ctx.arc(px, py, pr, 0, Math.PI * 2);
  ctx.fillStyle = INK;
  ctx.fill();
  // Le reflet. Sans lui l'œil est un trou ; avec lui, il y a quelqu'un.
  ctx.beginPath();
  ctx.arc(px - pr * 0.34, py - pr * 0.38, pr * 0.32, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // Paupière supérieure.
  ctx.beginPath();
  ctx.moveTo(-ew * 1.15, -eh * 0.35);
  ctx.quadraticCurveTo(0, -eh * 1.5, ew * 1.15, -eh * 0.35);
  ink(ctx, r * (E.liner ? 0.1 : 0.062));
  ctx.stroke();

  if (E.hood) {
    // Paupière lourde : un second trait au-dessus, qui écrase le regard.
    ctx.beginPath();
    ctx.moveTo(-ew * 1.1, -eh * 1.5);
    ctx.quadraticCurveTo(0, -eh * 2.6, ew * 1.1, -eh * 1.4);
    ink(ctx, r * 0.05);
    ctx.stroke();
  }
  if (E.lash) {
    ink(ctx, r * 0.048);
    for (let i = 0; i < 3; i++) {
      const a = -0.5 - i * 0.35;
      ctx.beginPath();
      ctx.moveTo(ew * (0.5 + i * 0.22), -eh * (0.9 - i * 0.15));
      ctx.lineTo(ew * (0.75 + i * 0.3), -eh * (1.5 + i * 0.25) - r * 0.05);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawNose(ctx, look, r, tx, eyeY) {
  const nx = tx * 1.4;
  const ny = eyeY + r * 0.16;
  const N = NOSES[look.nose] ?? NOSES[0];
  ctx.beginPath();
  N.draw(ctx, r, nx, ny);
  if (N.filled) {
    ctx.fillStyle = rgba(shade(look.skin, -0.3), 0.9);
    ctx.fill();
  }
  ink(ctx, r * 0.058);
  ctx.stroke();
}

function drawMouth(ctx, look, c, r, tx, onBeard = false) {
  const M = MOUTHS[look.mouth] ?? MOUTHS[0];
  const my = r * 0.5;
  const curve = c.mouth;
  const openAmt = Math.max(0, c.mouthOpen);
  const w = r * M.w;
  const wry = (M.wry ?? 0) * r * 0.1;

  if (openAmt > 0.12) {
    // Bouche ouverte : on voit l'intérieur, et les dents si ça sourit.
    const oh = r * 0.14 + openAmt * r * 0.3;
    ctx.beginPath();
    ctx.moveTo(tx - w, my - curve * r * 0.1 + wry);
    ctx.quadraticCurveTo(tx, my + curve * r * 0.22 + oh, tx + w, my - curve * r * 0.1 - wry);
    ctx.quadraticCurveTo(tx, my + curve * r * 0.1 - oh * 0.25, tx - w, my - curve * r * 0.1 + wry);
    ctx.closePath();
    paint(ctx, '#6d2f2f', true, r * 0.05);
    if (curve > 0.4) {
      ctx.save();
      ctx.clip();
      ctx.fillStyle = '#f6f1e6';
      ctx.fillRect(tx - w, my - curve * r * 0.16 - oh * 0.3, w * 2, oh * 0.5);
      ctx.restore();
    }
    return;
  }

  ctx.beginPath();
  ctx.moveTo(tx - w, my - curve * r * 0.14 + wry);
  ctx.quadraticCurveTo(tx, my + curve * r * 0.4, tx + w, my - curve * r * 0.14 - wry);
  ctx.strokeStyle = onBeard ? rgba('#f0d9c8', 0.9) : INK;
  ctx.lineWidth = r * M.lw * 0.46;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();

  // Lèvre inférieure : deux traits au lieu d'un, et la bouche a du volume.
  if (M.lower > 0 && !onBeard) {
    ctx.beginPath();
    ctx.moveTo(tx - w * 0.8, my + r * 0.12);
    ctx.quadraticCurveTo(tx, my + r * (0.12 + 0.2 * M.lower), tx + w * 0.8, my + r * 0.12);
    ctx.strokeStyle = rgba('#a85a58', 0.7);
    ctx.lineWidth = r * 0.055;
    ctx.stroke();
  }
}

/**
 * Lunettes : huit styles du catalogue, un seul dessin. Les solaires ont des
 * verres translucides — opaques, ils effaçaient le regard, et avec une
 * barbe il ne restait plus rien du visage.
 */
function drawGlasses(ctx, G, look, r, tx, eyeY, eyeDx) {
  const sun = G.sun === true;
  const frame = () => {
    for (const side of [-1, 1]) {
      const ex = tx + side * eyeDx;
      ctx.beginPath();
      if (G.kind === 'ronde') ctx.ellipse(ex, eyeY, r * 0.27, r * 0.24, 0, 0, Math.PI * 2);
      else if (G.kind === 'carree') roundRect(ctx, ex - r * 0.28, eyeY - r * 0.22, r * 0.56, r * 0.44, r * 0.09);
      else if (G.kind === 'fine') ctx.ellipse(ex, eyeY, r * 0.24, r * 0.17, 0, 0, Math.PI * 2);
      else if (G.kind === 'demi') roundRect(ctx, ex - r * 0.24, eyeY + r * 0.02, r * 0.48, r * 0.22, r * 0.08);
      else if (G.kind === 'papillon') {
        ctx.moveTo(ex - side * r * 0.28, eyeY + r * 0.14);
        ctx.quadraticCurveTo(ex - side * r * 0.3, eyeY - r * 0.24, ex, eyeY - r * 0.2);
        ctx.quadraticCurveTo(ex + side * r * 0.32, eyeY - r * 0.28, ex + side * r * 0.28, eyeY);
        ctx.quadraticCurveTo(ex + side * r * 0.2, eyeY + r * 0.18, ex - side * r * 0.28, eyeY + r * 0.14);
        ctx.closePath();
      } else { // aviateur
        ctx.moveTo(ex - r * 0.28, eyeY - r * 0.18);
        ctx.lineTo(ex + r * 0.28, eyeY - r * 0.18);
        ctx.quadraticCurveTo(ex + r * 0.26, eyeY + r * 0.26, ex, eyeY + r * 0.28);
        ctx.quadraticCurveTo(ex - r * 0.26, eyeY + r * 0.26, ex - r * 0.28, eyeY - r * 0.18);
        ctx.closePath();
      }
      if (sun) {
        ctx.fillStyle = 'rgba(32,37,46,0.72)';
        ctx.fill();
      }
      ctx.strokeStyle = rgba(INK, G.kind === 'fine' ? 0.7 : 0.85);
      ctx.lineWidth = r * (G.kind === 'fine' ? 0.045 : 0.06);
      ctx.stroke();
      if (sun) {
        // Un éclat sur chaque verre : sans ça, ce sont deux trous noirs.
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.beginPath();
        ctx.moveTo(ex - r * 0.14, eyeY + r * 0.1);
        ctx.lineTo(ex + r * 0.02, eyeY - r * 0.18);
        ctx.lineTo(ex + r * 0.1, eyeY - r * 0.18);
        ctx.lineTo(ex - r * 0.06, eyeY + r * 0.1);
        ctx.closePath();
        ctx.fill();
      }
    }
    // Le pont.
    ctx.beginPath();
    ctx.moveTo(tx - eyeDx + r * 0.26, eyeY - (G.kind === 'demi' ? -r * 0.08 : r * 0.02));
    ctx.lineTo(tx + eyeDx - r * 0.26, eyeY - (G.kind === 'demi' ? -r * 0.08 : r * 0.02));
    ctx.strokeStyle = rgba(INK, 0.8);
    ctx.lineWidth = r * 0.05;
    ctx.stroke();
  };
  frame();
}

// --- Couché -----------------------------------------------------------------

function drawLying(ctx, person, look, c, t, silhouette) {
  const skin = silhouette ? INK : look.skin;
  const duvet = silhouette ? INK : PALETTE.fabric[(person.id + 2) % PALETTE.fabric.length];
  const B = look.build;
  const y = -9;
  // La respiration soulève la couette, pas le corps entier.
  const breathe = (c.squash - 1) * 26;

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
    ctx.fillStyle = look.topColor;
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

  if (emo.kind === 'endormie') {
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
  } else if (['stressee', 'peur', 'panique', 'inquiete'].includes(emo.kind)) {
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
  } else if (['colere', 'menace', 'irritee'].includes(emo.kind)) {
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
  } else if (emo.kind === 'amoureuse') {
    for (let i = 0; i < 2; i++) {
      const p = (t * 0.45 + i * 0.5) % 1;
      ctx.globalAlpha = (o.alpha ?? 1) * (1 - p);
      drawHeart(ctx, x + h * 0.15 + Math.sin(p * 6) * h * 0.02, topY - p * h * 0.28, h * 0.05, '#d9556f');
    }
  } else if (emo.kind === 'surprise' || emo.kind === 'choquee') {
    ctx.font = `bold ${Math.round(h * 0.19)}px "Trebuchet MS", sans-serif`;
    ctx.fillStyle = emo.kind === 'choquee' ? '#b83a2e' : '#e0a83f';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    const bounce = Math.abs(Math.sin(t * 8)) * h * 0.03;
    ctx.strokeText('!', x + h * 0.16, topY + h * 0.06 - bounce);
    ctx.fillText('!', x + h * 0.16, topY + h * 0.06 - bounce);
  } else if (emo.kind === 'songeuse' || emo.kind === 'nostalgique') {
    // Une petite bulle qui monte : on est ailleurs.
    for (let i = 0; i < 3; i++) {
      const p = (t * 0.22 + i * 0.33) % 1;
      ctx.globalAlpha = (o.alpha ?? 1) * (1 - p) * 0.6;
      ctx.beginPath();
      ctx.arc(x + h * 0.17 + p * h * 0.05, topY - p * h * 0.22, h * 0.012 + p * h * 0.014, 0, Math.PI * 2);
      ctx.fillStyle = '#f2ece0';
      ctx.fill();
      ctx.strokeStyle = rgba(INK, 0.7);
      ctx.lineWidth = 1.4;
      ctx.stroke();
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
