// Vérifications de la simulation.
//
// On ne teste pas « est-ce que le jeu est beau » mais « est-ce que
// l'immeuble tient debout » : population stable, évènements graves rares,
// causalité présente, déterminisme respecté.
//
//   node tools/test-sim.js

import { World } from '../src/sim/world.js';
import { TICKS_PER_DAY, DAYS_PER_YEAR } from '../src/core/clock.js';
import { TONE } from '../src/core/events.js';
import { INTERVENTIONS, performIntervention } from '../src/sim/interventions.js';

let failures = 0;
let checks = 0;

function check(label, condition, detail = '') {
  checks++;
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    failures++;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function run(seed, years) {
  const w = new World({ seed });
  const ticks = Math.round(years * DAYS_PER_YEAR * TICKS_PER_DAY);
  for (let i = 0; i < ticks; i++) w.tick();
  return w;
}

console.log('\n— Déterminisme —');
{
  const a = run('graine-test', 2);
  const b = run('graine-test', 2);
  check('même graine, même population', a.livingPeople().length === b.livingPeople().length,
    `${a.livingPeople().length} vs ${b.livingPeople().length}`);
  check('même graine, même chronique', a.chronicle.beats.length === b.chronicle.beats.length,
    `${a.chronicle.beats.length} vs ${b.chronicle.beats.length}`);
  check('même graine, mêmes textes',
    a.chronicle.beats.every((x, i) => x.text === b.chronicle.beats[i]?.text));
  const c = run('une-autre-graine', 2);
  check('graine différente, immeuble différent',
    c.chronicle.beats[0]?.text !== a.chronicle.beats[0]?.text
    || c.livingPeople().length !== a.livingPeople().length);
}

console.log('\n— L\'immeuble tient sur la durée —');
const w = run('immeuble-long', 10);
{
  const pop = w.livingPeople().length;
  check('population viable après 10 ans', pop > 60 && pop < 260, `${pop} habitants`);
  check('des logements restent occupés', w.occupiedApartments().length > 30);
  check('bonheur dans une plage plausible',
    w.averageHappiness() > 35 && w.averageHappiness() < 95,
    `${w.averageHappiness().toFixed(1)}`);
  check('personne n\'a un besoin hors bornes',
    w.livingPeople().every((p) => ['energie', 'faim', 'hygiene', 'plaisir', 'social', 'confort']
      .every((n) => p.needs.get(n) >= 0 && p.needs.get(n) <= 100)));
  check('les âges restent cohérents',
    w.livingPeople().every((p) => p.age >= 0 && p.age < 115));
  check('aucun habitant sans appartement dans l\'index',
    w.livingPeople().every((p) => p.apartment === null || w.apartments[p.apartment]));
  check('les morts ne sont plus logés',
    w.dead.every((p) => !w.apartments.some((a) => a.residents.includes(p.id))));
}

console.log('\n— La vie passe —');
{
  check('des gens naissent', w.stats.births > 0, `${w.stats.births}`);
  check('des gens meurent', w.stats.deaths > 0, `${w.stats.deaths}`);
  check('des couples se forment', w.stats.couples > 0, `${w.stats.couples}`);
  check('des gens emménagent', w.stats.moveIns > 0, `${w.stats.moveIns}`);
  const kinds = new Set(w.chronicle.beats.map((b) => b.kind));
  check('la chronique est variée', kinds.size >= 14, `${kinds.size} types d'évènements`);
  const amitie = w.chronicle.beats.filter((b) => b.kind === 'amitie.debut').length;
  check('des amitiés naissent', amitie > 0, `${amitie}`);
}

console.log('\n— Les évènements graves restent rares —');
{
  const graves = w.chronicle.beats.filter((b) => b.tone === TONE.GRAVE);
  const perYear = graves.length / 10;
  check('moins de 8 évènements graves par an', perYear < 8, `${perYear.toFixed(1)}/an`);
  const meurtres = w.chronicle.countOf('crime.meurtre');
  check('au plus un meurtre en 10 ans', meurtres <= 1, `${meurtres}`);
  const cambriolages = w.chronicle.countOf('crime.cambriolage');
  check('cambriolages exceptionnels', cambriolages <= 6, `${cambriolages}`);
}

console.log('\n— Rien n\'arrive sans raison —');
{
  const notable = w.chronicle.beats.filter((b) => b.weight >= 0.5);
  const withCauses = notable.filter((b) => b.causes.length > 0);
  check('tout évènement marquant a une chaîne causale',
    notable.length > 0 && withCauses.length === notable.length,
    `${withCauses.length}/${notable.length}`);
  check('les causes sont des phrases, pas des identifiants',
    notable.every((b) => b.causes.every((c) => typeof c === 'string' && c.length > 3)));
}

console.log('\n— Les habitants restent libres —');
{
  // On propose de l'argent à tout le monde : les orgueilleux doivent refuser.
  const test = run('interventions', 1);
  let refus = 0;
  let acceptations = 0;
  for (const p of test.livingPeople().slice(0, 60)) {
    test.influence.points = 5;
    p.interventionCooldown = -1;
    const res = performIntervention(test, 'argent', p.id);
    if (!res || res.error) continue;
    if (res.accepted) acceptations++;
    else refus++;
  }
  check('certains acceptent l\'aide', acceptations > 0, `${acceptations}`);
  check('d\'autres la refusent', refus > 0, `${refus}`);
  check('toutes les interventions sont exécutables',
    INTERVENTIONS.every((i) => typeof i.apply === 'function'));
}

console.log('\n— Les secrets —');
{
  check('un appartement caché existe', w.hiddenApartmentId !== null);
  check('sa fenêtre n\'est jamais allumée', w.apartments[w.hiddenApartmentId].lightOn === false);
  check('personne n\'y habite', w.apartments[w.hiddenApartmentId].residents.length === 0);
  check('la légende circule', w.secrets.legendTellers.size > 0, `${w.secrets.legendTellers.size} habitants`);
  check('on ne peut pas y entrer sans les conditions', !w.secrets.canEnter() || w.secrets.hiddenUnlocked);
}

console.log(`\n${failures === 0 ? '✓' : '✗'} ${checks - failures}/${checks} vérifications passées\n`);
process.exit(failures === 0 ? 0 : 1);
