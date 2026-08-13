// Fabrique le fichier unique.
//
// Behind est écrit en modules ES. C'est confortable à développer, mais un
// navigateur refuse de charger des modules depuis un fichier local
// (file://) : ouvrir index.html en double-cliquant ne donne rien. Ce script
// assemble tout — HTML, CSS, les vingt-cinq modules — dans un seul
// behind.html qui s'ouvre partout, sans serveur et sans dépendance.
//
//   node tools/build.js
//
// L'assemblage est volontairement simple parce que le code source l'est :
// uniquement des imports nommés, aucun export par défaut, aucun import
// dynamique, aucun await de premier niveau. Le script vérifie ces
// hypothèses et s'arrête net si l'une d'elles tombe.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SLOTS } from '../src/render/assets.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENTRY = 'src/main.js';
const OUT = path.join(root, 'behind.html');

const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const rel = (p) => path.relative(root, p).split(path.sep).join('/');

// --- Analyse d'un module ----------------------------------------------------

const IMPORT_RE = /^[ \t]*import\s*\{([\s\S]*?)\}\s*from\s*['"]([^'"]+)['"]\s*;?[ \t]*$/gm;
const EXPORT_RE = /^export\s+(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gm;

function analyse(file) {
  const src = read(file);
  const dir = path.dirname(file);

  // Garde-fous : on préfère une erreur claire à un fichier silencieusement cassé.
  if (/^\s*export\s+default/m.test(src)) throw new Error(`${file} : export default non géré`);
  if (/^\s*export\s*\{/m.test(src)) throw new Error(`${file} : « export { … } » non géré`);
  if (/\bimport\s*\(/.test(src)) throw new Error(`${file} : import dynamique non géré`);
  if (/^\s*import\s+(?!\{)/m.test(src)) throw new Error(`${file} : import non nommé non géré`);
  if (/^\s*await\s/m.test(src)) throw new Error(`${file} : await de premier niveau non géré`);

  const deps = [];
  let body = src.replace(IMPORT_RE, (_, names, spec) => {
    const target = rel(path.resolve(root, dir, spec));
    deps.push(target);
    // « A, B as C » devient « A, B: C » : la déstructuration fait le travail.
    const binding = names
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean)
      .map((n) => {
        const m = n.match(/^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/);
        return m ? `${m[1]}: ${m[2]}` : n;
      })
      .join(', ');
    return `const { ${binding} } = __m[${JSON.stringify(target)}];`;
  });

  const exports = [...src.matchAll(EXPORT_RE)].map((m) => m[1]);
  body = body.replace(/^export\s+/gm, '');

  return { file, deps, body, exports };
}

// --- Graphe et ordre d'évaluation -------------------------------------------

const modules = new Map();
function collect(file) {
  if (modules.has(file)) return;
  const mod = analyse(file);
  modules.set(file, mod);
  for (const d of mod.deps) collect(d);
}
collect(ENTRY);

const order = [];
const state = new Map(); // 1 = en cours, 2 = fini
function visit(file, stack) {
  const st = state.get(file);
  if (st === 2) return;
  if (st === 1) {
    throw new Error(`cycle d'imports : ${[...stack, file].join(' → ')}`);
  }
  state.set(file, 1);
  for (const d of modules.get(file).deps) visit(d, [...stack, file]);
  state.set(file, 2);
  order.push(file);
}
visit(ENTRY, []);

// --- Images embarquées -------------------------------------------------------
//
// Le fichier unique n'a pas le droit d'aller chercher quoi que ce soit sur
// le disque ni sur le réseau : tout ce qui est dans assets/ devient donc du
// base64 injecté dans EMBEDDED, la table que src/render/assets.js consulte
// avant de tenter un chargement réseau.
//
// Le dossier peut très bien être vide. C'est même le cas par défaut : le
// jeu tourne alors entièrement sur son dessin procédural.

const MIME = { '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };

// Au-delà de ça, le fichier unique cesse d'être ouvrable : le base64
// gonfle d'un tiers, et un navigateur qui reçoit cent mégaoctets de source
// dans une seule balise <script> ne les analyse pas, il rame.
const PLAFOND_MO = 24;

function collectAssets() {
  const dir = path.join(root, 'assets');
  if (!fs.existsSync(dir)) return { entries: [], bytes: 0, ecartes: [] };
  const entries = [];
  const ecartes = [];
  const manifeste = [];   // tout ce qui est livré, embarqué ou non
  let bytes = 0;

  // On parcourt le CATALOGUE, pas le dossier — pour deux raisons. La
  // première : le catalogue dit déjà où vit chaque emplacement, et
  // redéduire la correspondance dossier → famille avait rendu deux
  // familles entières invisibles au build, sans la moindre erreur.
  //
  // La seconde compte plus. Quand ça ne rentre pas, il faut choisir QUOI
  // écarter, et l'ordre alphabétique des dossiers est le pire arbitre
  // possible. Cet ordre-ci est un ordre de valeur au mégaoctet : un décor
  // change une pièce entière pour 200 ko, une planche de personnage change
  // un habitant pour dix fois plus.
  const RANG = { decor: 0, ambiance: 1, commerce: 2, batiment: 3, expression: 4, portrait: 5, perso: 6 };
  const catalogue = [...SLOTS].sort(
    (a, b) => (RANG[a.id.split('/')[0]] ?? 9) - (RANG[b.id.split('/')[0]] ?? 9));

  for (const s of catalogue) {
    let trouve = null;
    for (const ext of Object.keys(MIME)) {
      const f = path.join(dir, s.file.replace(/\.png$/, ext));
      if (fs.existsSync(f)) { trouve = { f, ext }; break; }
    }
    if (!trouve) continue;
    const buf = fs.readFileSync(trouve.f);
    manifeste.push({ id: s.id, file: rel(trouve.f).replace(/^assets\//, '') });

    // Les planches de personnages ne rentrent pas toutes, et le dire ici
    // est plus honnête que de fabriquer un behind.html de trois cents
    // mégaoctets que personne n'ouvrira. Le jeu servi depuis le dossier,
    // lui, les a toutes.
    if (bytes + buf.length > PLAFOND_MO * 1048576) { ecartes.push(s.id); continue; }
    bytes += buf.length;
    entries.push([s.id, `data:${MIME[trouve.ext]};base64,${buf.toString('base64')}`]);
  }
  return { entries, bytes, ecartes, manifeste };
}

const assets = collectAssets();

// Le manifeste que lit la version « serveur » du jeu. On le réécrit ici
// aussi : construire après avoir ajouté une image et se retrouver avec un
// manifeste périmé serait le genre de piège qu'on ne voit pas.
{
  const dir = path.join(root, 'assets');
  if (fs.existsSync(dir)) {
    // Le manifeste liste TOUT ce qui est livré, y compris ce que le
    // fichier unique a dû écarter : c'est la version servie depuis le
    // dossier qui le lit, et elle, elle a la place.
    fs.writeFileSync(path.join(dir, 'manifest.json'),
      `${JSON.stringify(assets.manifeste, null, 2)}\n`);
  }
}

// --- Assemblage du script ---------------------------------------------------

const chunks = [
  '(function () {',
  "'use strict';",
  'const __m = Object.create(null);',
];
for (const file of order) {
  const mod = modules.get(file);
  chunks.push(`\n/* ${file} */`);
  chunks.push(`__m[${JSON.stringify(file)}] = (function () {`);
  chunks.push('const __x = {};');
  chunks.push(mod.body.trim());
  for (const name of mod.exports) chunks.push(`__x.${name} = ${name};`);
  chunks.push('return __x;');
  chunks.push('})();');
}
// Les images entrent APRÈS l'évaluation des modules : EMBEDDED est un objet
// exporté, on le remplit, et le premier appel à loadAssets() les trouve.
if (assets.entries.length) {
  chunks.push('\n/* images embarquées */');
  chunks.push('Object.assign(__m["src/render/assets.js"].EMBEDDED, {');
  for (const [id, uri] of assets.entries) {
    chunks.push(`${JSON.stringify(id)}: ${JSON.stringify(uri)},`);
  }
  chunks.push('});');
}
chunks.push('})();');
const script = chunks.join('\n');

// --- Assemblage du HTML -----------------------------------------------------

let html = read('index.html');
const css = read('styles/main.css');
const icon = read('icon.svg');
const iconUri = `data:image/svg+xml,${encodeURIComponent(icon)}`;
const manifest = JSON.parse(read('manifest.webmanifest'));
manifest.icons[0].src = iconUri;
const manifestUri = `data:application/manifest+json,${encodeURIComponent(JSON.stringify(manifest))}`;

html = html.replace(
  '<link rel="stylesheet" href="styles/main.css">',
  `<style>\n${css}\n</style>`,
);
html = html.replace('<link rel="manifest" href="manifest.webmanifest">',
  `<link rel="manifest" href="${manifestUri}">`);
html = html.replace('<link rel="apple-touch-icon" href="icon.svg">',
  `<link rel="apple-touch-icon" href="${iconUri}">`);

// Plus aucun import : un script classique suffit, et c'est précisément ce
// qui rend le fichier ouvrable en double-cliquant.
html = html.replace(
  '<script type="module" src="src/main.js"></script>',
  `<script>\n${script.replace(/<\/script/gi, '<\\/script')}\n</script>`,
);

if (html.includes('src="src/main.js"') || html.includes('styles/main.css')) {
  throw new Error('des références externes subsistent dans le HTML');
}

const banner = `<!--
  Behind — fichier unique, autonome.

  Assemblé par « npm run build » depuis les sources du dépôt.
  Ne pas modifier ici : éditer src/ puis relancer la construction.

  Aucun serveur, aucune dépendance, aucune connexion réseau.
  Il suffit d'ouvrir ce fichier dans un navigateur.
-->\n`;

fs.writeFileSync(OUT, banner + html, 'utf8');

const ko = (n) => `${(n / 1024).toFixed(0)} ko`;
console.log(`\nbehind.html écrit — ${ko(Buffer.byteLength(banner + html))}`);
console.log(`  ${order.length} modules assemblés, CSS et icônes compris`);
console.log(assets.entries.length
  ? `  ${assets.entries.length} images embarquées — ${ko(assets.bytes)} avant base64`
  : '  aucune image dans assets/ : le jeu tourne sur son dessin procédural');
if (assets.ecartes.length) {
  const familles = new Map();
  for (const id of assets.ecartes) {
    const f = id.split('/')[0];
    familles.set(f, (familles.get(f) ?? 0) + 1);
  }
  console.log(`  ${assets.ecartes.length} images écartées — le fichier unique plafonne à ${PLAFOND_MO} Mo`);
  for (const [f, n] of familles) console.log(`    · ${n} en ${f}/`);
  console.log('    elles restent dans assets/ : la version servie (npm start) les a toutes.');
}
console.log(`  ordre d'évaluation : ${order[0]} → … → ${order[order.length - 1]}\n`);
