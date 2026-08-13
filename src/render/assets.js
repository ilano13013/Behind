// Les images dessinées à la main.
//
// Tout Behind est tracé par du code, forme par forme. Ça a une limite dure :
// un trait de code ne remplacera jamais un trait de dessinateur. Ce module
// est la prise où l'on branche de vraies illustrations quand on en a.
//
// Trois règles tiennent le fichier :
//
//   1. RIEN N'EST OBLIGATOIRE. Chaque image est un bonus. Si le fichier
//      manque, le jeu retombe sur son dessin procédural sans un mot. On
//      peut livrer une seule image et voir la différence sur un seul écran.
//
//   2. LA SIMULATION NE SAIT RIEN. Aucun habitant, aucun appartement, aucun
//      évènement ne dépend d'un fichier. Les images sont une peau, jamais
//      une condition.
//
//   3. LE CHARGEMENT NE BLOQUE JAMAIS. On lance les téléchargements, on
//      joue tout de suite, et chaque image apparaît dès qu'elle arrive.
//
// La liste des emplacements et le cahier des charges de chaque image sont
// dans assets/README.md. `node tools/check-assets.js` dit lesquels sont
// remplis.

import { ARCHETYPES } from './interior-plan.js';
import { MORPHO } from './wardrobe.js';

/** Où le jeu va chercher les images. Le bundler y injecte du base64. */
export const ASSET_BASE = 'assets/';

/**
 * Le catalogue des emplacements.
 *
 * Un emplacement = un identifiant, un dossier, une taille attendue, et une
 * phrase qui dit à quoi il sert. Ajouter un emplacement, c'est ajouter une
 * ligne ; le reste du jeu s'en sert automatiquement.
 */
export const SLOTS = [];

function slot(id, o) {
  SLOTS.push({ id, file: `${o.dir}/${o.name}.png`, ...o });
}

// --- Décors intérieurs ---
// Le fond de la pièce quand le mur s'efface. C'est le meilleur rapport
// qualité/effort de toute la liste : douze images, et le jeu change de
// visage. Les habitants continuent d'être dessinés par-dessus.
for (const a of ARCHETYPES) {
  slot(`decor/${a}`, {
    dir: 'decors', name: a, w: 1600, h: 900,
    role: `Intérieur « ${a.replace(/_/g, ' ')} », vu en coupe, sans personnage`,
  });
}

// --- Ambiances de façade ---
// Le calque posé derrière l'immeuble : le ciel et le quartier. Vingt-cinq
// moments, et chacun doit pouvoir arriver — une image qu'aucun état du
// monde ne peut déclencher ne serait jamais vue.
export const AMBIANCES = [
  ['jour_clair', 'Plein jour, ciel dégagé'],
  ['soiree', 'Début de soirée, lumières chaudes'],
  ['nuit', 'Nuit calme sur le quartier'],
  ['aube', 'Aube, ciel rose et bleu'],
  ['coucher_soleil', 'Coucher de soleil sur les toits'],
  ['pluie', 'Jour pluvieux, gris et lavé'],
  ['orage', 'Orage, éclairs au-dessus des toits'],
  ['neige', 'Il neige sur le quartier'],
  ['petite_neige', 'Quelques flocons, à peine'],
  ['brouillard', 'Brouillard : l\'immeuble d\'en face a disparu'],
  ['canicule', 'Canicule, lumière blanche écrasante'],
  ['grand_froid', 'Grand froid, ciel dur et net'],
  ['vent_fort', 'Vent fort, nuages qui filent'],
  ['tempete', 'Tempête, ciel noir en plein jour'],
  ['pollution', 'Air lourd, horizon jaune'],
  ['arc_en_ciel', 'Un arc-en-ciel après la pluie'],
  ['coupure_courant', 'Panne de courant : tout le quartier est noir'],
  ['pleine_lune', 'Pleine lune, très basse'],
  ['feu_artifice', 'Feu d\'artifice au-dessus des toits'],
  ['noel', 'Noël, guirlandes aux fenêtres'],
  ['halloween', 'Halloween, citrouilles et lumières orange'],
  ['nouvel_an', 'Nouvel an, minuit passé'],
  ['printemps', 'Printemps, premiers arbres en fleur'],
  ['automne', 'Automne, feuilles et lumière rase'],
  ['apocalyptique', 'Un ciel qu\'on ne reverra pas'],
];
for (const [id, role] of AMBIANCES) {
  slot(`ambiance/${id}`, { dir: 'ambiances', name: id, w: 1920, h: 1080, role });
}

// --- Portraits ---
// Le visage d'un habitant dans sa fiche. Ce ne sont pas des portraits de
// personnages nommés : c'est une TROUPE. Chaque habitant se voit attribuer
// un comédien de son gabarit, une fois pour toutes. Les effectifs suivent
// la pyramide des âges d'un immeuble : beaucoup d'adultes, moins d'enfants.
export const PORTRAITS_PAR_GABARIT = {
  enfant: 20, ado: 20, homme: 40, femme: 40, mature: 25, senior: 25,
};
for (const [morpho, n] of Object.entries(PORTRAITS_PAR_GABARIT)) {
  for (let i = 1; i <= n; i++) {
    const num = String(i).padStart(2, '0');
    slot(`portrait/${morpho}-${num}`, {
      dir: 'portraits', name: `${morpho}-${num}`, w: 512, h: 512,
      role: `Portrait ${MORPHO[morpho].label.toLowerCase()} n°${i}, buste, fond transparent`,
      morpho,
    });
  }
}

// --- Commerces ---
// Le rez-de-chaussée. L'immeuble a un local commercial ; on doit pouvoir
// entrer dedans comme dans un appartement.
export const COMMERCES = [
  ['cafe', 'Café de quartier'],
  ['pharmacie', 'Pharmacie'],
  ['boulangerie', 'Boulangerie'],
  ['tabac', 'Bureau de tabac'],
  ['salon_coiffure', 'Salon de coiffure'],
  ['laverie', 'Laverie automatique'],
  ['salle_de_sport', 'Salle de sport'],
  ['supermarche', 'Supérette'],
  ['ecole', 'Salle de classe'],
  ['bibliotheque', 'Bibliothèque de quartier'],
];
for (const [id, role] of COMMERCES) {
  slot(`commerce/${id}`, { dir: 'commerces', name: id, w: 1600, h: 900, role: `${role}, vu en coupe, sans personnage` });
}

// --- Vieillissement du bâtiment ---
// L'immeuble se dégrade pendant la partie. Six états, du neuf au très usé.
export const AGES_BATIMENT = [0, 5, 15, 25, 40, 60];
for (const an of AGES_BATIMENT) {
  slot(`batiment/${an}ans`, {
    dir: 'batiment', name: `${an}ans`, w: 1920, h: 1080,
    // Un calque d'usure, PAS une façade complète : la géométrie de
    // l'immeuble est tirée au sort à chaque partie (étages, colonnes), donc
    // une façade peinte en entier ne tomberait jamais en face. Ce qu'on
    // pose par-dessus, ce sont des traces.
    role: an === 0 ? 'Calque d\'usure : rien, façade ravalée (peut rester vide)'
      : `Calque d'usure après ${an} ans — taches, coulures, fissures, mousse. Fond transparent.`,
    age: an,
  });
}

// --- État du chargement ------------------------------------------------------

const images = new Map();     // id → HTMLImageElement prêt à dessiner
const failed = new Set();     // id → on a essayé, il n'y a rien
let started = false;

/**
 * Base64 injecté par tools/build.js dans le fichier unique.
 * En développement l'objet est vide et on charge par le réseau.
 */
export const EMBEDDED = {};

function charge(id, src, onProgress) {
  const img = new Image();
  img.onload = () => {
    images.set(id, img);
    onProgress?.(images.size, SLOTS.length);
  };
  img.onerror = () => {
    // Un emplacement vide est le cas NORMAL, pas une erreur.
    failed.add(id);
  };
  img.src = src;
}

/**
 * Lance le chargement. Ne bloque pas : on rend la main tout de suite et
 * chaque image s'installe quand elle arrive.
 *
 * On ne tente JAMAIS un fichier au hasard. Cinquante-quatre emplacements
 * dont deux remplis, ce serait cinquante-deux 404 rouges dans la console
 * du navigateur à chaque partie — pour un état de fonctionnement normal.
 * Le dossier assets/ tient donc un manifeste de ce qu'il contient
 * réellement, régénéré par `node tools/check-assets.js`.
 */
export function loadAssets(onProgress) {
  if (started || typeof Image === 'undefined') return;
  started = true;

  // Fichier unique : les images sont déjà là, en base64. Aucun réseau.
  const embarquees = Object.keys(EMBEDDED);
  if (embarquees.length) {
    for (const id of embarquees) charge(id, EMBEDDED[id], onProgress);
    return;
  }

  // Ouvert en double-cliquant, sans serveur : un fetch sur file:// est
  // refusé par la politique d'origine du navigateur, et l'erreur s'affiche
  // en rouge dans la console même quand on l'attrape. Or le fichier unique
  // porte déjà ses images : s'il n'y en a pas, il n'y a rien à charger.
  if (typeof location !== 'undefined' && location.protocol === 'file:') return;

  // Développement : on lit le manifeste, et lui seul.
  fetch(`${ASSET_BASE}manifest.json`)
    .then((r) => (r.ok ? r.json() : []))
    .then((liste) => {
      const connus = new Map(SLOTS.map((s) => [s.id, s]));
      for (const entree of liste) {
        const id = typeof entree === 'string' ? entree : entree.id;
        const s = connus.get(id);
        if (s) charge(id, `${ASSET_BASE}${entree.file ?? s.file}`, onProgress);
      }
    })
    .catch(() => { /* pas de manifeste : le jeu dessine tout lui-même. */ });
}

/** L'image d'un emplacement, ou null s'il est vide. */
export function asset(id) {
  return images.get(id) ?? null;
}

export function hasAsset(id) {
  return images.has(id);
}

/** Combien d'emplacements sont remplis. Pour le diagnostic, rien d'autre. */
export function assetStatus() {
  return { charges: images.size, total: SLOTS.length, manquants: failed.size };
}

// --- Attribution -------------------------------------------------------------

/**
 * Le comédien attribué à un habitant.
 *
 * Stable et dérivé de l'identifiant : le même voisin garde le même visage
 * toute la partie. On ne retient que les portraits de son gabarit — un
 * enfant ne peut pas hériter du portrait d'un senior.
 */
export function portraitFor(person) {
  if (person._portrait !== undefined) return person._portrait;
  const morpho = person._look?.morpho ?? 'homme';
  const dispo = [];
  for (let i = 1; i <= (PORTRAITS_PAR_GABARIT[morpho] ?? 0); i++) {
    const id = `portrait/${morpho}-${String(i).padStart(2, '0')}`;
    if (images.has(id)) dispo.push(id);
  }
  // Tant que rien n'est livré, la réponse est « rien », et la fiche garde
  // son dessin. On ne met pas le résultat en cache dans ce cas : une image
  // peut encore arriver une seconde plus tard.
  if (!dispo.length) return null;
  const choisi = dispo[person.id % dispo.length];
  person._portrait = choisi;
  return choisi;
}

/**
 * L'ambiance de façade du moment.
 *
 * L'ordre est une priorité, et il dit ce qui compte : une panne de courant
 * passe avant une fête, une fête avant la météo, la météo avant l'heure.
 * Ce qui frappe l'immeuble l'emporte sur ce qu'il traverse.
 */
export function ambianceFor(world) {
  const c = world.clock;

  // 1. Ce qui arrache tout le reste.
  if (world.apocalypse) return 'ambiance/apocalyptique';
  if (world.forcedBlackoutDay === c.day && c.isNight) return 'ambiance/coupure_courant';

  // 2. Ce qui se fête. Une seule journée par an, et on la voit.
  if (world.fete && (c.isNight || c.hour >= 17)) return `ambiance/${world.fete}`;

  // 3. Le temps qu'il fait. Il gagne sur l'heure : sous la tempête, on ne
  //    distingue plus l'aube du crépuscule.
  const meteo = world.weather?.id ?? 'clair';
  if (meteo !== 'clair' && meteo !== 'arc_en_ciel') return `ambiance/${meteo}`;
  if (meteo === 'arc_en_ciel' && !c.isNight) return 'ambiance/arc_en_ciel';

  // 4. La lune, seulement la nuit — sinon elle ne veut rien dire.
  if (world.moonFull && c.isNight) return 'ambiance/pleine_lune';

  // 5. L'heure.
  const h = c.hour;
  if (h >= 22 || h < 5) return 'ambiance/nuit';
  if (h < 8) return 'ambiance/aube';
  if (h >= 20) return 'ambiance/nuit';
  if (h >= 18) return 'ambiance/coucher_soleil';
  if (h >= 16) return 'ambiance/soiree';

  // 6. Plein jour : la saison a le dernier mot.
  if (c.season === 1) return 'ambiance/printemps';
  if (c.season === 3) return 'ambiance/automne';
  return 'ambiance/jour_clair';
}

/** L'usure de la façade, d'après l'âge de l'immeuble dans cette partie. */
export function batimentFor(world) {
  // L'immeuble avait déjà un âge au premier jour : la partie ne fait
  // qu'ajouter à un compteur qui tournait avant elle.
  const ans = (world.buildingAge ?? 30) + world.clock.year;
  let choisi = AGES_BATIMENT[0];
  for (const a of AGES_BATIMENT) if (a <= ans) choisi = a;
  return `batiment/${choisi}ans`;
}

/** Le décor d'un lieu — appartement ou commerce du rez-de-chaussée. */
export function decorFor(apt) {
  if (apt.commerce) return `commerce/${apt.commerce}`;
  return apt._archetype ? `decor/${apt._archetype}` : null;
}

/**
 * Dessine une image en la recadrant pour remplir le rectangle sans la
 * déformer — l'équivalent de `object-fit: cover`. Une illustration étirée
 * se voit immédiatement, et ruine le travail du dessinateur.
 */
export function drawCover(ctx, img, x, y, w, h) {
  const ratio = Math.max(w / img.width, h / img.height);
  const dw = img.width * ratio;
  const dh = img.height * ratio;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}
