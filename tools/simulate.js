// Simulation sans écran.
//
// Fait tourner l'immeuble pendant des années et raconte ce qui s'est passé.
// C'est l'outil qui permet de vérifier la seule chose qui compte vraiment :
// est-ce que des histoires sortent toutes seules ?
//
//   node tools/simulate.js [années] [graine]

import { World } from '../src/sim/world.js';
import { TICKS_PER_DAY, DAYS_PER_YEAR } from '../src/core/clock.js';
import { TONE } from '../src/core/events.js';

const years = Number(process.argv[2] ?? 5);
const seed = process.argv[3] ?? 'immeuble-01';

const t0 = Date.now();
const world = new World({ seed });

console.log(`\n=== BEHIND — ${seed} ===`);
console.log(`${world.floors} étages × ${world.cols} colonnes`);
console.log(`${world.occupiedApartments().length} logements occupés, ${world.vacantApartments().length} vides`);
console.log(`${world.livingPeople().length} habitants au départ`);
console.log(`Appartement caché : ${world.aptName(world.apartments[world.hiddenApartmentId])} (secret)\n`);

const totalTicks = Math.round(years * DAYS_PER_YEAR * TICKS_PER_DAY);
for (let i = 0; i < totalTicks; i++) world.tick();

const elapsed = (Date.now() - t0) / 1000;
const ticksPerSec = Math.round(totalTicks / elapsed);

// --- Ce que l'immeuble a vécu ---
const byKind = new Map();
for (const b of world.chronicle.beats) byKind.set(b.kind, (byKind.get(b.kind) ?? 0) + 1);

console.log(`--- ${years} ans plus tard (${elapsed.toFixed(1)}s, ${ticksPerSec} ticks/s) ---`);
console.log(`${world.clock.stamp()}`);
console.log(`Population : ${world.livingPeople().length}`);
console.log(`Bonheur moyen : ${world.averageHappiness().toFixed(1)}/100`);
console.log(`Naissances ${world.stats.births} · Décès ${world.stats.deaths} · Couples ${world.stats.couples} · Ruptures ${world.stats.breakups}`);
console.log(`Emménagements ${world.stats.moveIns} · Départs ${world.stats.moveOuts}`);
console.log(`Évènements enregistrés : ${world.chronicle.beats.length}\n`);

console.log('--- Répartition des évènements ---');
[...byKind.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, n]) => {
  console.log(`  ${String(n).padStart(4)}  ${k}`);
});

console.log('\n--- Évènements graves (doivent rester rares) ---');
const graves = world.chronicle.beats.filter((b) => b.tone === TONE.GRAVE);
if (!graves.length) console.log('  aucun');
for (const b of graves) console.log(`  [${b.stamp}] ${b.text}`);

console.log('\n--- Secrets ---');
const sec = world.secrets.progress();
console.log(`  ${sec.found}/${sec.total} découverts par la simulation seule`);
for (const s of sec.list.filter((x) => x.found)) console.log(`   · ${s.title}`);
console.log(`  Conditions de l'appartement caché : ${sec.hidden.conditions.filter((c) => c.done).length}/${sec.hidden.conditions.length}`);
for (const c of sec.hidden.conditions) console.log(`   [${c.done ? 'x' : ' '}] ${c.label}`);

console.log('\n--- Dix moments choisis ---');
const notable = world.chronicle.beats
  .filter((b) => b.weight >= 0.5)
  .sort(() => 0)
  .slice(-10);
for (const b of notable) {
  console.log(`\n  [${b.stamp}]`);
  console.log(`  ${b.text}`);
  for (const c of b.causes) console.log(`     ← ${c}`);
}

// --- Une vie, en entier ---
const people = world.livingPeople().sort((a, b) =>
  world.chronicle.forActor(b.id, 99).length - world.chronicle.forActor(a.id, 99).length);
const star = people[0];
if (star) {
  console.log(`\n\n=== La vie de ${star.name} ===`);
  console.log(`${Math.floor(star.age)} ans · ${star.job.label} · ${world.aptName(world.apartments[star.apartment])}`);
  const d = star.personality.describe();
  console.log(`Qualités : ${d.qualities.join(', ') || '—'}`);
  console.log(`Défauts  : ${d.defects.join(', ') || '—'}`);
  console.log(`Ambition : ${star.ambition?.label} (${Math.round(star.ambitionProgress * 100)}%)`);
  console.log(`Bonheur  : ${Math.round(star.happiness)}/100 · santé ${Math.round(star.health)} · ${Math.round(star.money)} €`);
  console.log('\nRelations :');
  for (const r of star.relations.top(6)) {
    const o = world.people.get(r.other);
    if (!o) continue;
    console.log(`  ${o.shortName.padEnd(12)} ${r.describe().padEnd(16)} affinité ${(r.affinity * 100).toFixed(0).padStart(4)}  tension ${(r.tension * 100).toFixed(0).padStart(3)}`);
  }
  console.log('\nSouvenirs marquants :');
  for (const m of star.memory.highlights(6)) {
    console.log(`  ${m.valence > 0 ? '+' : '-'} ${m.text} (${Math.round(m.strength * 100)}%)`);
  }
  console.log('\nSon histoire :');
  for (const b of world.chronicle.forActor(star.id, 12).reverse()) {
    console.log(`  [${b.stamp}] ${b.text}`);
  }
}

console.log('\n');
