// Vérifications de la garde-robe.
//
// wardrobe.js ne touche ni au DOM ni au canvas : on peut donc vérifier hors
// navigateur les deux choses qui comptent vraiment pour la charte —
// que l'immeuble ne se répète pas, et qu'aucun habitant n'est incohérent.
//
// La cohérence n'est pas un détail de goût. Un immeuble où trois hommes
// portent une jupe et où un enfant de six ans a une cravate, le joueur ne
// voit plus que ça, et tout le reste du dessin ne compte plus.
//
//   node tools/test-look.js

import { appearance, MORPHO, morphoKey, heightFactor, JAWS, EYES, NOSES, MOUTHS, HAIR, BEARDS, TOPS, BOTTOMS, SHOES } from '../src/render/wardrobe.js';
import { World } from '../src/sim/world.js';

let failures = 0;
let checks = 0;
function check(label, ok, detail = '') {
  checks++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

const world = new World({ seed: 'garde-robe' });
const people = world.livingPeople();
const looks = people.map((p) => ({ p, l: appearance(p) }));

console.log('\n— Le catalogue est bien celui de la charte —');
{
  check('assez de mâchoires', JAWS.length >= 8, `${JAWS.length}`);
  check('assez d\'yeux', EYES.length >= 8, `${EYES.length}`);
  check('assez de nez', NOSES.length >= 8, `${NOSES.length}`);
  check('assez de bouches', MOUTHS.length >= 8, `${MOUTHS.length}`);
  check('assez de coiffures', HAIR.length >= 16, `${HAIR.length}`);
  check('assez de pilosités', BEARDS.length >= 7, `${BEARDS.length}`);
  check('assez de hauts', TOPS.length >= 10, `${TOPS.length}`);
  check('assez de bas', BOTTOMS.length >= 8, `${BOTTOMS.length}`);
  check('assez de chaussures', SHOES.length >= 7, `${SHOES.length}`);
  check('les six morphologies sont là', Object.keys(MORPHO).length === 6);
}

console.log('\n— L\'immeuble ne se répète pas —');
{
  const key = ({ l }) => [l.jaw, l.eyes, l.nose, l.mouth, l.hairStyle, l.beard,
    l.top.id, l.bottom.id, l.topColor].join('/');
  const uniques = new Set(looks.map(key)).size;
  check('aucun sosie parfait', uniques === looks.length,
    `${uniques} apparences pour ${looks.length} habitants`);

  // Une pièce qui rafle la moitié de l'immeuble trahit un tirage biaisé.
  for (const [nom, of] of [['coiffure', (l) => l.hairStyle], ['haut', (l) => l.top.id],
    ['bas', (l) => l.bottom.id], ['yeux', (l) => l.eyes]]) {
    const counts = {};
    for (const { l } of looks) counts[of(l)] = (counts[of(l)] ?? 0) + 1;
    const top = Math.max(...Object.values(counts));
    check(`aucune ${nom} ne domine`, top < looks.length * 0.4,
      `la plus fréquente : ${Math.round((top / looks.length) * 100)} %`);
  }
}

console.log('\n— Personne n\'est habillé n\'importe comment —');
{
  const faults = [];
  for (const { p, l } of looks) {
    if (p.gender !== 'f' && (l.top.dress || l.bottom.skirt)) faults.push(`${p.name} en jupe`);
    if (p.gender === 'f' && l.beard) faults.push(`${p.name} barbue`);
    if (p.age < 12 && ['cravate', 'montre', 'collier', 'bretelles'].includes(l.accessory)) {
      faults.push(`${p.name}, ${p.age} ans, en ${l.accessory}`);
    }
    if (l.top.bib && l.bottom.length < 1) faults.push(`${p.name} en salopette et short`);
    if (l.hairStyle === 5 && p.age < 30) faults.push(`${p.name} chauve à ${p.age} ans`);
  }
  check('aucune tenue incohérente', faults.length === 0, faults.slice(0, 4).join(', '));

  const jeunesGris = looks.filter(({ p, l }) => p.age < 45
    && ['#a8a29c', '#d8d4ce', '#ded9d2', '#bdb7ae'].includes(l.hair));
  check('personne n\'a les cheveux blancs à trente ans', jeunesGris.length === 0,
    jeunesGris.slice(0, 3).map(({ p }) => `${p.name} (${p.age})`).join(', '));
}

console.log('\n— La morphologie suit l\'âge —');
{
  const bad = looks.filter(({ p, l }) => l.morpho !== morphoKey(p));
  check('chaque habitant a bien son gabarit', bad.length === 0);
  const enfants = looks.filter(({ p }) => p.age < 12);
  check('les enfants ont une grosse tête', enfants.every(({ l }) => l.proportions.head > 1.2));
  check('les enfants sont petits', enfants.every(({ p }) => heightFactor(p.age) < 0.9));
  const seniors = looks.filter(({ p }) => p.age >= 68);
  check('les seniors sont voûtés', seniors.every(({ l }) => l.proportions.posture > 0.1));
}

console.log('\n— L\'apparence est stable —');
{
  const p = people[5];
  const a = appearance(p);
  const b = appearance(p);
  check('deux appels donnent le même habitant', a === b);
  // L'apparence ne doit dépendre que de l'habitant, jamais d'un hasard de
  // tirage : on vide le cache et on recompose. Le compteur d'identifiants
  // étant global au processus, comparer deux mondes ne prouverait rien —
  // le même habitant y porte deux identifiants différents.
  p._look = null;
  const recalcule = appearance(p);
  check('recomposer donne exactement le même habitant',
    ['hairStyle', 'jaw', 'eyes', 'nose', 'mouth', 'beard', 'topColor', 'bottomColor',
      'accessory', 'pattern'].every((k) => recalcule[k] === a[k])
    && recalcule.top.id === a.top.id && recalcule.bottom.id === a.bottom.id);
}

console.log(`\n${failures ? '✗' : '✓'} ${checks - failures}/${checks} vérifications passées\n`);
process.exit(failures ? 1 : 0);
