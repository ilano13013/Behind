// Des images de test, pour vérifier la tuyauterie avant de commander des dessins.
//
// Elles ne sont pas jolies, et c'est voulu : un damier bien laid avec une
// ligne de sol rouge répond aux deux seules questions qui comptent avant de
// payer un illustrateur —
//
//   1. l'image est-elle bien prise en compte, à la place du dessin ?
//   2. les habitants posent-ils les pieds sur la ligne de sol ?
//
// La ligne rouge est tracée exactement là où assets/README.md la place :
// à 86 % de la hauteur. Si les pieds ne tombent pas dessus, c'est la
// spécification qui ment, pas le dessinateur.
//
//   node tools/fake-assets.js          crée tout ce qui manque
//   node tools/fake-assets.js --clean  efface les images de test

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { SLOTS } from '../src/render/assets.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'assets');
const MARQUE = 'behind-test';   // écrit dans le PNG, pour savoir quoi effacer

// --- Écriture PNG minimale ---------------------------------------------------

const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  let c = 0xffffffff;
  for (const b of td) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE((c ^ 0xffffffff) >>> 0);
  return Buffer.concat([len, td, crc]);
}

function png(w, h, pixel) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  let o = 0;
  for (let y = 0; y < h; y++) {
    raw[o++] = 0;                       // filtre « aucun »
    for (let x = 0; x < w; x++) {
      const [r, g, b] = pixel(x, y);
      raw[o++] = r; raw[o++] = g; raw[o++] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2;             // 8 bits, RVB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('tEXt', Buffer.from(`Comment\0${MARQUE}`, 'latin1')),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const estTest = (f) => fs.readFileSync(f).includes(MARQUE);

// --- Nettoyage ---------------------------------------------------------------

if (process.argv.includes('--clean')) {
  let n = 0;
  for (const sub of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
    const p = path.join(dir, sub);
    if (!fs.statSync(p).isDirectory()) continue;
    for (const f of fs.readdirSync(p)) {
      const full = path.join(p, f);
      if (f.endsWith('.png') && estTest(full)) { fs.unlinkSync(full); n++; }
    }
  }
  fs.writeFileSync(path.join(dir, 'manifest.json'), '[]\n');
  console.log(`\n${n} image${n > 1 ? 's' : ''} de test effacée${n > 1 ? 's' : ''}.`);
  console.log('assets/manifest.json vidé — le jeu redessine tout lui-même.\n');
  process.exit(0);
}

// --- Fabrication -------------------------------------------------------------

const teintes = {
  decor: [[196, 118, 62], [162, 92, 48]],
  ambiance: [[92, 116, 156], [72, 94, 132]],
  portrait: [[142, 118, 96], [116, 94, 76]],
  commerce: [[168, 140, 78], [136, 112, 60]],
  batiment: [[150, 120, 96], [124, 98, 78]],
};

let crees = 0;
let gardes = 0;

for (const s of SLOTS) {
  const famille = s.id.split('/')[0];
  const sub = { decor: 'decors', ambiance: 'ambiances', portrait: 'portraits',
    commerce: 'commerces', batiment: 'batiment' }[famille] ?? famille;
  const cible = path.join(dir, sub, `${path.basename(s.file, '.png')}.png`);

  // On ne touche JAMAIS à une vraie image livrée.
  if (fs.existsSync(cible)) {
    if (!estTest(cible)) { gardes++; continue; }
    fs.unlinkSync(cible);
  }

  const [a, b] = teintes[famille] ?? teintes.decor;
  const sol = Math.round(s.h * 0.86);
  const buf = png(s.w, s.h, (x, y) => {
    // La ligne de sol, seulement là où elle veut dire quelque chose.
    if ((famille === 'decor' || famille === 'commerce') && Math.abs(y - sol) < 4) return [230, 60, 60];
    return ((x / 80 | 0) + (y / 80 | 0)) % 2 ? a : b;
  });
  fs.mkdirSync(path.dirname(cible), { recursive: true });
  fs.writeFileSync(cible, buf);
  crees++;
}

console.log(`\n${crees} image${crees > 1 ? 's' : ''} de test créée${crees > 1 ? 's' : ''}${gardes ? `, ${gardes} vraie${gardes > 1 ? 's' : ''} laissée${gardes > 1 ? 's' : ''} en place` : ''}.`);
console.log('Lancez « node tools/check-assets.js » puis « npm start ».');
console.log('Pour tout retirer : node tools/fake-assets.js --clean\n');
