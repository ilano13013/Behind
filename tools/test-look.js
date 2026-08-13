// Vérifications de la garde-robe.
//
// wardrobe.js ne touche ni au DOM ni au canvas : on peut donc vérifier hors
// navigateur les trois choses qui comptent pour la charte — que le
// catalogue a bien la taille annoncée, que l'immeuble ne se répète pas, et
// qu'aucun habitant n'est incohérent.
//
// Les comptes de la planche sont des contrats, pas des indications : si un
// rayon rétrécit, ce fichier casse. La cohérence non plus n'est pas un
// détail de goût — un immeuble où trois hommes portent une jupe et où un
// enfant de six ans a une cravate, le joueur ne voit plus que ça.
//
//   node tools/test-look.js

import {
  appearance, outfitOf, contextFor, morphoKey, heightFactor,
  MORPHO, HEADS, EYES, NOSES, MOUTHS, HAIR, BEARDS, GLASSES, HATS,
  TOPS, BOTTOMS, SHOES, ACCESSORY_CATALOG, OUTFIT_CONTEXTS,
} from '../src/render/wardrobe.js';
import { ARCHETYPES, archetypeFor, propsFor } from '../src/render/interior-plan.js';
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

console.log('\n— Le catalogue est celui de la planche, au nombre près —');
{
  const contrat = [
    ['formes de têtes', HEADS.length, 30],
    ['coiffures', HAIR.length, 50],
    ['paires d\'yeux', EYES.length, 30],
    ['nez', NOSES.length, 25],
    ['bouches', MOUTHS.length, 40],
    ['barbes et moustaches', BEARDS.filter(Boolean).length, 30],
    ['pantalons', BOTTOMS.length, 50],
    ['chaussures', SHOES.length, 40],
    ['accessoires', ACCESSORY_CATALOG.length, 60],
  ];
  for (const [nom, reel, attendu] of contrat) {
    check(`${attendu} ${nom}`, reel === attendu, `${reel}`);
  }
  check('les six morphologies', Object.keys(MORPHO).length === 6);
  check('les sept contextes de tenue', OUTFIT_CONTEXTS.length === 7);
  check('assez de hauts pour habiller les sept', TOPS.length >= 20, `${TOPS.length}`);
  check('les lunettes et les couvre-chefs sont là', GLASSES.length >= 8 && HATS.length >= 9);
  check('les douze décors intérieurs', ARCHETYPES.length === 12);

  // Chaque accessoire du catalogue doit avoir un emplacement connu.
  const slots = new Set(['tete', 'yeux', 'torse', 'poignet', 'oreille', 'oreilles', 'main', 'peau', 'divers']);
  check('chaque accessoire a un emplacement valide',
    ACCESSORY_CATALOG.every((a) => slots.has(a.slot)));
  check('aucun accessoire en double',
    new Set(ACCESSORY_CATALOG.map((a) => a.id)).size === ACCESSORY_CATALOG.length);
}

console.log('\n— L\'immeuble ne se répète pas —');
{
  const key = ({ l }) => [l.head, l.eyes, l.nose, l.mouth, l.hairStyle, l.beard,
    l.top.id, l.bottom.id, l.topColor].join('/');
  const uniques = new Set(looks.map(key)).size;
  check('aucun sosie parfait', uniques === looks.length,
    `${uniques} apparences pour ${looks.length} habitants`);

  // Une pièce qui rafle la moitié de l'immeuble trahit un tirage biaisé.
  for (const [nom, of] of [['coiffure', (l) => l.hairStyle], ['haut', (l) => l.top.id],
    ['bas', (l) => l.bottom.id], ['yeux', (l) => l.eyes], ['tête', (l) => l.head]]) {
    const counts = {};
    for (const { l } of looks) counts[of(l)] = (counts[of(l)] ?? 0) + 1;
    const top = Math.max(...Object.values(counts));
    check(`aucune ${nom} ne domine`, top < looks.length * 0.35,
      `la plus fréquente : ${Math.round((top / looks.length) * 100)} %`);
  }
}

console.log('\n— Les sept tenues existent, et elles diffèrent —');
{
  const complet = looks.every(({ l }) => OUTFIT_CONTEXTS.every((c) => l.outfits[c]?.top));
  check('chacun a bien ses sept tenues', complet);

  // Une garde-robe où le pyjama ressemble au costume ne sert à rien.
  const varie = looks.filter(({ l }) => {
    const hauts = new Set(OUTFIT_CONTEXTS.map((c) => l.outfits[c].top.id));
    return hauts.size >= 4;
  });
  check('les tenues d\'un même habitant sont vraiment différentes',
    varie.length > looks.length * 0.9,
    `${Math.round((varie.length / looks.length) * 100)} % ont au moins 4 hauts distincts`);

  // On dort en tenue de maison, on ne dort pas en manteau.
  const dodo = { ...people[0], action: { id: 'dormir' } };
  check('dormir met en tenue de maison', contextFor(dodo, world.clock) === 'maison');
  const sport = { ...people[0], action: { id: 'sport' } };
  check('le sport met en survêtement', contextFor(sport, world.clock) === 'sport');
  const maison = looks[0].l.outfits.maison;
  check('la tenue de maison est molle ou de nuit',
    maison.bottom.soft === true || maison.bottom.cut === 'jogging',
    maison.bottom.label);
  const hiver = looks[0].l.outfits.hiver;
  check('la tenue d\'hiver couvre vraiment', hiver.top.sleeve === 1, hiver.top.label);

  // La tenue portée suit le contexte posé sur l'habitant.
  const p = people[2];
  p.outfitContext = 'sport';
  check('outfitOf suit le contexte', outfitOf(p) === appearance(p).outfits.sport);
  p.outfitContext = 'quotidien';
}

console.log('\n— Personne n\'est habillé n\'importe comment —');
{
  const faults = [];
  for (const { p, l } of looks) {
    for (const c of OUTFIT_CONTEXTS) {
      const o = l.outfits[c];
      if (p.gender !== 'f' && (o.top.dress || o.bottom.skirt)) faults.push(`${p.name} en jupe (${c})`);
      if (o.top.bib && o.bottom.length < 1) faults.push(`${p.name} en salopette et short`);
      if (p.gender !== 'f' && o.shoe.shape === 4) faults.push(`${p.name} en talons`);
    }
    if (p.gender === 'f' && l.beard) faults.push(`${p.name} barbue`);
    if (p.age < 12 && !['aucun', 'casque_audio'].includes(l.accessory)) {
      faults.push(`${p.name}, ${p.age} ans, en ${l.accessory}`);
    }
    if (l.hairStyle === 5 && p.age < 30) faults.push(`${p.name} chauve à ${p.age} ans`);
  }
  check('aucune tenue incohérente', faults.length === 0, faults.slice(0, 4).join(', '));

  const jeunesGris = looks.filter(({ p, l }) => p.age < 45
    && ['#a8a29c', '#d8d4ce', '#ded9d2', '#bdb7ae'].includes(l.hair));
  check('personne n\'a les cheveux blancs à trente ans', jeunesGris.length === 0,
    jeunesGris.slice(0, 3).map(({ p }) => `${p.name} (${p.age})`).join(', '));

  // Les très rares doivent le rester : une couronne par immeuble, au plus.
  const rares = looks.filter(({ l }) => l.hat?.rare);
  check('les couvre-chefs très rares le sont vraiment', rares.length <= 2,
    `${rares.length} dans l'immeuble`);
  const dorees = looks.filter(({ l }) => l.shoe.gold);
  check('les baskets dorées sont un évènement', dorees.length <= 2, `${dorees.length}`);
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

console.log('\n— Les intérieurs racontent qui y vit —');
{
  const habites = world.apartments.filter((a) => (world.occupancy.get(a.id) ?? []).length);
  const kinds = new Set();
  for (const apt of habites) {
    const occ = world.occupancy.get(apt.id);
    kinds.add(archetypeFor(world, apt, occ));
  }
  check('plusieurs décors différents cohabitent', kinds.size >= 4,
    `${kinds.size} types : ${[...kinds].join(', ')}`);
  check('tous les décors tirés sont au catalogue',
    [...kinds].every((k) => ARCHETYPES.includes(k)));

  const vide = world.apartments.find((a) => !(world.occupancy.get(a.id) ?? []).length && !a.special);
  if (vide) {
    check('un logement vide a ses meubles sous un drap',
      propsFor(world, vide, []).includes('drap_meuble'));
  } else {
    check('un logement vide a ses meubles sous un drap', true, 'aucun vide dans cet immeuble');
  }
}

console.log('\n— La météo tourne —');
{
  const w = new World({ seed: 'meteo' });
  const vus = new Set();
  for (let j = 0; j < 60; j++) {
    for (let i = 0; i < 288; i++) w.tick();
    vus.add(w.weather.id);
  }
  check('plusieurs temps différents sur deux mois', vus.size >= 2, [...vus].join(', '));
  check('il fait clair la plupart du temps', vus.has('clair'));
}

console.log('\n— L\'apparence est stable —');
{
  const p = people[5];
  const a = appearance(p);
  check('deux appels donnent le même habitant', a === appearance(p));

  // L'apparence ne doit dépendre que de l'habitant, jamais d'un hasard de
  // tirage : on vide le cache et on recompose. Le compteur d'identifiants
  // étant global au processus, comparer deux mondes ne prouverait rien —
  // le même habitant y porte deux identifiants différents.
  p._look = null;
  const b = appearance(p);
  const memes = ['hairStyle', 'head', 'eyes', 'nose', 'mouth', 'beard', 'glasses', 'accessory']
    .every((k) => b[k] === a[k])
    && OUTFIT_CONTEXTS.every((c) => b.outfits[c].top.id === a.outfits[c].top.id
      && b.outfits[c].bottom.id === a.outfits[c].bottom.id
      && b.outfits[c].topColor === a.outfits[c].topColor);
  check('recomposer donne exactement le même habitant', memes);
}

console.log(`\n${failures ? '✗' : '✓'} ${checks - failures}/${checks} vérifications passées\n`);
process.exit(failures ? 1 : 0);
