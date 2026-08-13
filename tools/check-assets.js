// Ce qui manque, et ce qui est là.
//
// Le jeu n'a besoin d'AUCUNE image pour tourner : chaque emplacement vide
// retombe sur le dessin procédural. Cet outil ne signale donc pas des
// erreurs, il donne un état d'avancement — et vérifie que ce qui a été
// livré est utilisable (bon nom, bon format, bonnes dimensions).
//
//   node tools/check-assets.js

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SLOTS } from '../src/render/assets.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'assets');
const OK = ['.png', '.webp'];

/** Dimensions d'un PNG ou d'un WebP, lues dans l'en-tête. */
function dimensions(buf, ext) {
  if (ext === '.png' && buf.length > 24) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  if (ext === '.webp' && buf.length > 30 && buf.toString('ascii', 12, 16) === 'VP8X') {
    return { w: buf.readUIntLE(24, 3) + 1, h: buf.readUIntLE(27, 3) + 1 };
  }
  return null;
}

// Le chemin d'un emplacement est déjà dans le catalogue (`s.file`) : le
// dupliquer ici a coûté une famille entière introuvable le jour où les
// planches de personnages sont arrivées. On ne le redéduit plus.
const groupes = new Map();
const manifeste = [];
let presents = 0;
let poids = 0;
const soucis = [];
const tout = process.argv.includes('--tout');

// Une planche de six cases pèse forcément plus qu'un portrait. Le budget
// est donc par famille, et il dit la vérité sur ce qui tient dans le
// fichier unique : au-delà, l'image reste utilisable, mais servie depuis
// le dossier assets/, pas embarquée.
const BUDGET_KO = { perso: 1400, ambiance: 900, decor: 700, commerce: 700 };

for (const s of SLOTS) {
  const famille = s.id.split('/')[0];
  let trouve = null;
  for (const ext of OK) {
    const f = path.join(dir, s.file.replace(/\.png$/, ext));
    if (fs.existsSync(f)) { trouve = { f, ext }; break; }
  }

  if (trouve) {
    presents++;
    manifeste.push({ id: s.id, file: path.relative(dir, trouve.f).split(path.sep).join('/') });
    const buf = fs.readFileSync(trouve.f);
    poids += buf.length;
    const d = dimensions(buf, trouve.ext);
    // Une image trop petite, on la verra floue.
    if (d && (d.w < s.w * 0.75 || d.h < s.h * 0.75)) {
      soucis.push(`${s.id} : ${d.w}×${d.h}, attendu ${s.w}×${s.h} — ce sera flou`);
    }
    // Une planche dont la largeur n'est pas un multiple exact du nombre
    // d'images se découpe de travers, et le personnage tremble à chaque
    // case. C'est le défaut le plus difficile à voir sur la planche même.
    if (s.sprite && d && d.w % s.frames !== 0) {
      soucis.push(`${s.id} : ${d.w} px de large pour ${s.frames} images — le découpage tombera à côté`);
    }
    const budget = BUDGET_KO[famille] ?? 600;
    if (buf.length > budget * 1024) {
      soucis.push(`${s.id} : ${(buf.length / 1024).toFixed(0)} ko — au-delà des ${budget} ko du fichier unique`);
    }
  }

  if (!groupes.has(famille)) groupes.set(famille, []);
  groupes.get(famille).push({ s, trouve });
}

// Le manifeste : c'est lui que le jeu lit au démarrage. Sans lui, il
// faudrait tenter les cinquante-quatre fichiers et remplir la console de
// 404 pour un état parfaitement normal.
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'manifest.json'), `${JSON.stringify(manifeste, null, 2)}\n`);

console.log(`\nassets/ — ${presents} / ${SLOTS.length} emplacements remplis`
  + `${poids ? ` · ${(poids / 1048576).toFixed(1)} Mo livrés` : ''}`);
console.log('assets/manifest.json à jour\n');

for (const [famille, liste] of groupes) {
  const n = liste.filter((e) => e.trouve).length;
  console.log(`${famille.toUpperCase()}  ${n}/${liste.length}`);
  // Six cent cinquante et une lignes, personne ne les lit. Par défaut on
  // détaille les familles courtes et on ne montre, pour les longues, que
  // ce qui manque encore — c'est la seule information qui fait agir.
  const detail = tout || liste.length <= 45
    ? liste
    : liste.filter((e) => !e.trouve);
  for (const { s, trouve } of detail) {
    const marque = trouve ? '✔' : '·';
    console.log(`  ${marque} ${s.file.padEnd(40)} ${`${s.w}×${s.h}`.padEnd(10)} ${s.role}`);
  }
  if (detail.length < liste.length) {
    console.log(`  … ${liste.length - detail.length} déjà livrés, masqués (« --tout » pour tout voir)`);
  }
  console.log('');
}

if (soucis.length) {
  console.log('À revoir :');
  for (const s of soucis) console.log(`  ! ${s}`);
  console.log('');
}

if (presents === 0) {
  console.log('Rien pour l\'instant, et c\'est un état valide : le jeu tourne');
  console.log('entièrement sur son dessin procédural. Chaque image ajoutée');
  console.log('remplace un morceau de dessin, sans qu\'il y ait rien d\'autre');
  console.log('à faire que « npm run build ».\n');
}
