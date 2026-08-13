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
import { SLOTS, ambianceFor, batimentFor } from '../src/render/assets.js';
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
  check('les quarante décors intérieurs', ARCHETYPES.length === 40, `${ARCHETYPES.length}`);

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
  // Un décor qu'aucune règle ne peut atteindre serait un mensonge dans le
  // catalogue d'images : on paierait un dessin que personne ne verrait
  // jamais. On simule donc, et on relève ce qui sort.
  const vus = new Map();
  for (const seed of ['decors', 'quartier']) {
    const w = new World({ seed });
    for (let pas = 0; pas < 6 * 24 / 4; pas++) {
      for (let i = 0; i < 288 * 4; i++) w.tick();
      for (const a of w.apartments) {
        if (a.special) continue;
        const t = archetypeFor(w, a, w.occupancy.get(a.id) ?? []);
        vus.set(t, (vus.get(t) ?? 0) + 1);
      }
    }
  }
  const jamais = ARCHETYPES.filter((a) => !vus.has(a));
  check(`les ${ARCHETYPES.length} décors sont tous atteignables`, jamais.length === 0,
    jamais.join(', '));
  const total = [...vus.values()].reduce((a, b) => a + b, 0);
  const top = Math.max(...vus.values());
  check('aucun décor n\'écrase les autres', top < total * 0.16,
    `le plus fréquent : ${Math.round((top / total) * 100)} %`);

  const vide = new World({ seed: 'decors' }).apartments
    .find((a) => !a.special && !a.residents.length);
  if (vide) {
    check('un logement vide a ses meubles sous un drap',
      propsFor(new World({ seed: 'decors' }), vide, []).includes('drap_meuble'));
  } else {
    check('un logement vide a ses meubles sous un drap', true, 'aucun vide au départ');
  }
}

console.log('\n— Chaque image du catalogue peut être vue —');
{
  const par = (f) => SLOTS.filter((s) => s.id.startsWith(`${f}/`)).map((s) => s.id);
  check('251 emplacements, comme l\'asset bible', SLOTS.length === 251, `${SLOTS.length}`);
  check('40 décors', par('decor').length === 40);
  check('25 ambiances', par('ambiance').length === 25);
  check('170 portraits', par('portrait').length === 170);
  check('10 commerces', par('commerce').length === 10);
  check('6 calques d\'usure', par('batiment').length === 6);

  // Les ambiances ordinaires : trois ans suffisent à toutes les voir.
  const vues = new Set();
  for (const seed of ['ciel', 'meteo']) {
    const w = new World({ seed });
    for (let i = 0; i < 288 * 24 * 3; i++) { w.tick(); if (i % 24 === 0) vues.add(ambianceFor(w)); }
  }
  // Trois ciels sont censés être rares — une tempête, une panne de courant,
  // et celui dont personne ne reparle. Les exiger sur trois ans de
  // simulation reviendrait à exiger qu'ils ne soient pas rares. On vérifie
  // donc leur chemin de code plutôt que leur fréquence.
  const rares = ['ambiance/tempete', 'ambiance/coupure_courant', 'ambiance/apocalyptique'];
  const manque = par('ambiance').filter((a) => !vues.has(a) && !rares.includes(a));
  check('toutes les ambiances ordinaires arrivent en trois ans', manque.length === 0,
    manque.map((m) => m.split('/')[1]).join(', ') || 'aucune ne manque');

  const w = new World({ seed: 'rares' });
  w.apocalypse = true;
  check('le ciel de fin du monde est atteignable',
    ambianceFor(w) === 'ambiance/apocalyptique');
  w.apocalypse = false;
  w.forcedBlackoutDay = w.clock.day;
  w.clock.tick = Math.floor(w.clock.tick / 288) * 288 + 288 * 0.1;  // une heure du matin
  check('la panne de courant est atteignable',
    ambianceFor(w) === 'ambiance/coupure_courant', ambianceFor(w));
  w.forcedBlackoutDay = -1;
  w.weather = { id: 'tempete', intensity: 1 };
  check('la tempête est atteignable', ambianceFor(w) === 'ambiance/tempete');

  // Les commerces : tirés à la génération, donc il suffit de compter.
  const boutiques = new Set();
  for (const seed of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
    for (const a of new World({ seed }).apartments) if (a.commerce) boutiques.add(a.commerce);
  }
  check('les commerces se tirent bien au hasard', boutiques.size >= 6,
    `${boutiques.size} types sur huit immeubles`);

  // L'usure : l'immeuble n'a pas le même âge d'une partie à l'autre.
  const usures = new Set();
  for (const seed of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']) {
    const w = new World({ seed });
    usures.add(batimentFor(w));
    w.clock.tick += 288 * 24 * 30;
    usures.add(batimentFor(w));
  }
  check('les six âges de façade sont atteignables', usures.size === 6, `${usures.size}`);
}

console.log('\n— La météo tourne —');
{
  const w = new World({ seed: 'meteo' });
  const vus = new Map();
  const fetes = new Set();
  for (let j = 0; j < 24 * 3; j++) {
    for (let i = 0; i < 288; i++) w.tick();
    vus.set(w.weather.id, (vus.get(w.weather.id) ?? 0) + 1);
    if (w.fete) fetes.add(w.fete);
  }
  check('le ciel change vraiment', vus.size >= 6, `${vus.size} temps différents`);
  // Un immeuble sous la pluie deux jours sur trois, ce n'est plus un
  // immeuble : c'est un décor de catastrophe, et tout le monde y déprime.
  const clair = (vus.get('clair') ?? 0) / (24 * 3);
  check('il fait beau la plupart du temps', clair > 0.5,
    `${Math.round(clair * 100)} % de jours clairs`);
  check('les quatre fêtes de l\'année tombent', fetes.size === 4, [...fetes].join(', '));
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
