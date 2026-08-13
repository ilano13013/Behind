// Vérifications de l'animation.
//
// anim.js ne touche ni au DOM ni au canvas : on peut donc vérifier hors
// navigateur les trois propriétés qui font la différence entre « ça bouge »
// et « ça saute » — le cycle, le fondu entre poses, et le retard des
// parties lourdes sur les parties légères.
//
//   node tools/test-anim.js

import {
  updateRig, POSES, poseFor, EXPRESSIONS, EXPRESSION_ALIAS,
} from '../src/render/anim.js';
import { emotionOf } from '../src/render/character.js';
import { World } from '../src/sim/world.js';

let failures = 0;
let checks = 0;
function check(label, ok, detail = '') {
  checks++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

const world = new World({ seed: 'anim' });
const people = world.livingPeople();
const neutral = { kind: 'neutre', force: 0.3 };

/** Fait tourner un pantin pendant `secs` secondes à 60 images/s. */
function run(person, pose, secs, sample = null, t0 = 0) {
  const dt = 1 / 60;
  const out = [];
  for (let i = 0; i < secs * 60; i++) {
    const t = t0 + i * dt;
    const c = updateRig(person, pose, POSES[pose] ?? POSES.idle, t, dt, neutral);
    if (sample) out.push(sample(c));
  }
  return out;
}

console.log('\n— Le cycle de marche bouge vraiment —');
{
  const p = people[0];
  const legs = run(p, 'marche', 2, (c) => c.legL);
  const min = Math.min(...legs.slice(30));
  const max = Math.max(...legs.slice(30));
  check('les jambes balancent d\'une vraie amplitude', max - min > 0.6,
    `amplitude ${(max - min).toFixed(2)} rad`);
  const arms = run(p, 'marche', 1, (c) => c.armL);
  check('les bras balancent aussi', Math.max(...arms) - Math.min(...arms) > 0.4);
  // Bras et jambes opposés : sinon on marche comme un pingouin.
  // On ignore la première demi-seconde, le temps que le lissage rattrape
  // le cycle, puis on compte sur ce qui reste — et seulement sur ça.
  const both = run(p, 'marche', 1, (c) => [c.legL, c.armL]).slice(30);
  const opposed = both.filter(([l, a]) => Math.sign(l) !== Math.sign(a)).length;
  check('bras et jambes vont en sens opposés', opposed > both.length * 0.9,
    `${Math.round((opposed / both.length) * 100)}% du cycle`);
}

console.log('\n— Un changement de pose se fond, il ne claque pas —');
{
  const p = people[1];
  run(p, 'idle', 2);                       // installé au repos
  const before = p._rig.cur.armR;
  // Une seule image de la nouvelle pose : la valeur ne doit pas y sauter.
  const oneFrame = run(p, 'colere', 1 / 60, (c) => c.armR).pop();
  const targetish = POSES.colere(0).armR;
  const jumped = Math.abs(oneFrame - before) / Math.abs(targetish - before);
  check('une image ne suffit pas à atteindre la pose', jumped < 0.35,
    `${Math.round(jumped * 100)}% du chemin en une image`);
  // En revanche, en une demi-seconde on doit y être.
  run(p, 'colere', 0.5);
  const arrived = Math.abs(p._rig.cur.armR - targetish);
  check('la pose est atteinte en une demi-seconde', arrived < 0.35,
    `écart ${arrived.toFixed(2)} rad`);
}

console.log('\n— Les parties lourdes traînent sur les légères —');
{
  const p = people[2];
  run(p, 'idle', 2);
  const startTilt = p._rig.cur.headTilt;
  const startHand = p._rig.cur.handL;
  // On bascule vers une pose qui change les deux d'un coup.
  run(p, 'colere', 0.1);
  const dHand = Math.abs(p._rig.cur.handL - startHand);
  const dTilt = Math.abs(p._rig.cur.headTilt - startTilt);
  const targetHand = Math.abs(POSES.colere(0).handL - startHand);
  const progHand = targetHand > 0.01 ? dHand / targetHand : 1;
  check('la main réagit vite', progHand > 0.5, `${Math.round(progHand * 100)}% en 0,1 s`);
  check('la tête a du retard sur la main', dTilt < dHand,
    `tête ${dTilt.toFixed(3)} vs main ${dHand.toFixed(3)}`);
}

console.log('\n— Rien ne part en vrille —');
{
  const p = people[3];
  const poses = Object.keys(POSES);
  let finite = true;
  let bounded = true;
  for (let i = 0; i < poses.length * 4; i++) {
    const c = run(p, poses[i % poses.length], 0.3, (x) => ({ ...x })).pop();
    for (const [k, v] of Object.entries(c)) {
      if (!Number.isFinite(v)) finite = false;
      if (Math.abs(v) > 12) bounded = false;
    }
  }
  check('toutes les valeurs restent finies', finite);
  check('aucune articulation ne diverge', bounded);
  check('l\'écrasement reste crédible',
    p._rig.cur.squash > 0.7 && p._rig.cur.squash < 1.3,
    p._rig.cur.squash.toFixed(3));
}

console.log('\n— Chaque action a bien une pose —');
{
  const ids = ['dormir', 'insomnie', 'manger', 'cuisiner', 'douche', 'menage', 'tv',
    'musique', 'jeu', 'lire', 'sport', 'bricoler', 'travailler', 'teletravail',
    'chercher_emploi', 'ecole', 'sortir', 'courses', 'promener', 'rien', 'ruminer',
    'boire', 'soigner', 'telephoner', 'espionner', 'visiter', 'fete', 'plaindre',
    'confronter', 'reconcilier', 'flirter', 'famille_temps', 'betise'];

  // On collecte ce que poseFor peut réellement renvoyer. Une pose qu'aucun
  // état du monde n'atteint est du code mort déguisé en fonctionnalité.
  const vues = new Set(['marche', 'courir', 'bebe', 'couche', 'releve', 'reveil',
    'habille', 'conduit']);   // celles-là sont choisies par le rendu, pas par poseFor
  const inconnues = [];
  for (const p of people) {
    for (const id of ids) {
      p.action = { id };
      // Chaque facteur testé SEUL : ensemble, le plus prioritaire masque
      // les autres et on conclurait à tort qu'une pose est morte.
      for (const etat of [{}, { mood: 15 }, { debt: 2000 }, { addiction: 0.6 },
        { stress: 90 }, { mood: 40 }]) {
        Object.assign(p, { mood: 60, debt: 0, addiction: 0, stress: 20 }, etat);
        const pose = poseFor(p);
        if (!POSES[pose]) inconnues.push(`${id}→${pose}`);
        vues.add(pose);
      }
    }
    Object.assign(p, { mood: 60, debt: 0, addiction: 0, stress: 20 });
    p._startle = { kind: 'surprise', ttl: 4, max: 4 };
    vues.add(poseFor(p));
    p._startle = null;
    p.action = null;
  }
  check('aucune action ne tombe sur une pose inexistante', inconnues.length === 0,
    inconnues.slice(0, 3).join(', '));

  // Un habitant sans identifiant n'existe pas dans le jeu, mais existe dans
  // les outils : poseFor doit tenir debout quand même.
  check('un habitant sans identifiant ne casse rien',
    POSES[poseFor({ action: { id: 'menage' }, walking: false })] !== undefined);

  const toutes = Object.keys(POSES);
  const mortes = toutes.filter((x) => !vues.has(x));
  check(`les ${toutes.length} poses sont toutes atteignables`, mortes.length === 0,
    mortes.join(', '));
  check('soixante poses, comme l\'asset bible', toutes.length === 60, `${toutes.length}`);
  check('marcher prime sur le reste', poseFor({ action: { id: 'tv' }, walking: true }) === 'marche');
  check('courir prime sur marcher',
    poseFor({ action: { id: 'tv' }, walking: true, running: true }) === 'courir');
}

console.log('\n— Les quarante expressions sont vraiment quarante —');
{
  const noms = Object.keys(EXPRESSIONS);
  check('quarante expressions', noms.length === 40, `${noms.length}`);
  const empreintes = new Set(noms.map((k) => JSON.stringify(EXPRESSIONS[k])));
  check('aucune n\'est le sosie d\'une autre', empreintes.size === noms.length,
    `${empreintes.size} visages distincts`);

  // Les alias sont la seule passerelle entre les états de la simulation et
  // les visages de la planche : aucun ne doit pointer dans le vide.
  const perdus = Object.entries(EXPRESSION_ALIAS).filter(([, v]) => !EXPRESSIONS[v]);
  check('tous les alias mènent à un visage', perdus.length === 0,
    perdus.map(([k]) => k).join(', '));

  // Et chaque visage que la simulation demande doit exister.
  const manquants = new Set();
  const portes = new Set();
  for (const p of world.livingPeople()) {
    for (const id of ['dormir', 'confronter', 'flirter', 'espionner', 'ruminer',
      'boire', 'sport', 'fete', 'lire', 'visiter', 'reconcilier', 'bricoler', 'rien']) {
      p.action = { id };
      for (const etat of [{}, { mood: 15 }, { stress: 95 }, { health: 30 },
        { mood: 90 }, { debt: 2000 }, { mood: 30 }]) {
        Object.assign(p, { mood: 60, stress: 20, health: 90, debt: 0 }, etat);
        const k = emotionOf(p).kind;
        portes.add(k);
        if (!EXPRESSIONS[k] && !EXPRESSION_ALIAS[k]) manquants.add(k);
      }
    }
    p.action = null;
  }
  check('la simulation ne demande que des visages qui existent',
    manquants.size === 0, [...manquants].join(', '));
  check('l\'immeuble en porte une bonne moitié', portes.size >= 18,
    `${portes.size} visages différents sur un immeuble`);
}

console.log(`\n${failures === 0 ? '✓' : '✗'} ${checks - failures}/${checks} vérifications passées\n`);
process.exit(failures === 0 ? 0 : 1);
