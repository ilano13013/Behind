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

const familles = {
  decor: 'decors', ambiance: 'ambiances', portrait: 'portraits',
  commerce: 'commerces', batiment: 'batiment',
};
const groupes = new Map();
const manifeste = [];
let presents = 0;
const soucis = [];

for (const s of SLOTS) {
  const famille = s.id.split('/')[0];
  const sousdossier = familles[famille] ?? famille;
  let trouve = null;
  for (const ext of OK) {
    const f = path.join(dir, sousdossier, path.basename(s.file, '.png') + ext);
    if (fs.existsSync(f)) { trouve = { f, ext }; break; }
  }

  if (trouve) {
    presents++;
    manifeste.push({ id: s.id, file: path.relative(dir, trouve.f).split(path.sep).join('/') });
    const buf = fs.readFileSync(trouve.f);
    const d = dimensions(buf, trouve.ext);
    // Une image trop petite, on la verra floue ; trop lourde, elle
    // alourdira behind.html pour rien.
    if (d && (d.w < s.w * 0.75 || d.h < s.h * 0.75)) {
      soucis.push(`${s.id} : ${d.w}×${d.h}, attendu ${s.w}×${s.h} — ce sera flou`);
    }
    if (buf.length > 600 * 1024) {
      soucis.push(`${s.id} : ${(buf.length / 1024).toFixed(0)} ko — trop lourd pour le fichier unique`);
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

console.log(`\nassets/ — ${presents} / ${SLOTS.length} emplacements remplis`);
console.log('assets/manifest.json à jour\n');

for (const [famille, liste] of groupes) {
  const n = liste.filter((e) => e.trouve).length;
  console.log(`${famille.toUpperCase()}  ${n}/${liste.length}`);
  for (const { s, trouve } of liste) {
    const marque = trouve ? '✔' : '·';
    const chemin = `${familles[famille] ?? famille}/${path.basename(s.file, '.png')}.png`;
    console.log(`  ${marque} ${chemin.padEnd(34)} ${s.w}×${s.h}  ${s.role}`);
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
