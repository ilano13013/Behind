// Le régisseur.
//
// Il n'écrit aucune histoire. Il ne déclenche rien qui ne soit déjà prêt
// à arriver : chaque évènement rare a des conditions causales strictes que
// la simulation doit avoir produite d'elle-même. Le régisseur ne fait
// qu'une chose — dire « pas trop souvent ». C'est ce qui préserve le poids
// des évènements graves : ils restent possibles partout, et rares partout.

import { TONE } from '../core/events.js';
import { die } from './lifecycle.js';
import { LINK } from './relations.js';
import { traitLabel } from './traits.js';
import { g, pronom } from '../core/text.js';
import { TICKS_PER_DAY, DAYS_PER_YEAR } from '../core/clock.js';

export class Director {
  constructor(world) {
    this.world = world;
    this.lastGrave = -99999;
    this.graveCount = 0;
    this.lastByKind = new Map();
    // Un capital de gravité qui se recharge très lentement. Sans lui,
    // une année de malchance pourrait transformer l'immeuble en fait divers.
    this.graveBudget = 1;
  }

  cooldownOk(kind, days) {
    const last = this.lastByKind.get(kind) ?? -99999;
    return this.world.clock.tick - last > days * TICKS_PER_DAY;
  }

  spend(kind, cost = 1) {
    this.lastByKind.set(kind, this.world.clock.tick);
    this.lastGrave = this.world.clock.tick;
    this.graveBudget = Math.max(0, this.graveBudget - cost);
    this.graveCount++;
  }

  /** Appelé une fois par jour. */
  daily() {
    const w = this.world;
    // Rechargement : environ un point tous les deux ans.
    this.graveBudget = Math.min(2, this.graveBudget + 1 / (DAYS_PER_YEAR * 2));

    this.tryDomestic();      // les petites catastrophes, fréquentes et drôles
    this.tryBurglary();
    this.tryDisappearance();
    this.tryViolence();
  }

  // --- Catastrophes domestiques : l'immeuble vit, donc l'immeuble casse ---
  tryDomestic() {
    const w = this.world;
    const rng = w.rng;

    // Dégât des eaux : quelqu'un de désordonné ou un bricoleur trop confiant.
    if (this.cooldownOk('degat_eaux', 40) && rng.chance(0.02)) {
      const candidates = w.livingPeople().filter((p) =>
        p.personality.has('desordonne') || p.personality.has('bricoleur') || p.age > 78);
      const p = rng.pick(candidates);
      if (p && p.apartment !== null) {
        const apt = w.apartments[p.apartment];
        const below = w.apartmentBelow(apt);
        if (below && below.residents.length) {
          const victim = w.people.get(below.residents[0]);
          apt.condition = Math.max(0, apt.condition - 0.15);
          below.condition = Math.max(0, below.condition - 0.25);
          victim.needs.add('confort', -30);
          const relV = victim.relations.get(p.id);
          const relP = p.relations.get(victim.id);
          relV.adjust({ tension: 0.35, affinity: -0.15, familiarity: 0.15 });
          relP.adjust({ tension: 0.15, familiarity: 0.15 });
          victim.remember({ kind: 'degat', text: `l'eau de ${p.shortName} dans son plafond`, valence: -0.6, strength: 0.6, about: p.id, tick: w.clock.tick });
          this.spend('degat_eaux', 0);
          w.beat({
            kind: 'immeuble.degat_eaux',
            text: `${p.shortName} a inondé ${victim.shortName}. Le plafond du ${w.aptName(below)} fait une carte du monde.`,
            tone: TONE.DROLE, weight: 0.45, actors: [p.id, victim.id], apartment: below.id,
            causes: [
              p.personality.has('bricoleur') ? `${p.shortName} a voulu réparer ${g(p, 'tout seul', 'toute seule')}` : `${p.shortName} est ${traitLabel('desordonne', p)}`,
              `${victim.shortName} habite juste en dessous`,
            ],
          });
        }
      }
    }

    // Panne d'ascenseur : tout le monde râle, les vieux souffrent.
    if (w.floors >= 5 && this.cooldownOk('ascenseur', 25) && rng.chance(0.03)) {
      w.elevatorBroken = true;
      w.elevatorFixDay = w.clock.day + rng.int(2, 9);
      this.spend('ascenseur', 0);
      w.beat({
        kind: 'immeuble.ascenseur',
        text: `L'ascenseur est en panne. Le mot du syndic dit « intervention rapide ». Personne n'y croit.`,
        tone: TONE.DROLE, weight: 0.4, actors: [], apartment: null,
        causes: ['un immeuble ancien', 'un contrat d\'entretien au rabais'],
      });
      for (const p of w.livingPeople()) {
        if (p.apartment === null) continue;
        const floor = w.apartments[p.apartment].floor;
        if (floor >= 3) {
          p.externalStress = Math.min(70, p.externalStress + (p.isOld ? 14 : 5) + floor);
        }
      }
    }

    // Barbecue sur balcon : très mauvaise idée, très bonne scène.
    if (w.clock.season === 2 && this.cooldownOk('barbecue', 20) && rng.chance(0.05)) {
      const p = rng.pick(w.livingPeople().filter((x) => x.age > 18 && x.personality.get('extraversion') > 0.5
        && x.apartment !== null && w.apartments[x.apartment].balcony));
      if (p) {
        const apt = w.apartments[p.apartment];
        const above = w.apartmentAbove(apt);
        this.spend('barbecue', 0);
        const victim = above?.residents.length ? w.people.get(above.residents[0]) : null;
        w.setNoise(apt.id, 0.7);
        if (victim) {
          victim.relations.get(p.id).adjust({ tension: 0.2, familiarity: 0.1 });
          victim.needs.add('confort', -12);
        }
        w.beat({
          kind: 'immeuble.barbecue',
          text: victim
            ? `${p.shortName} fait un barbecue sur un balcon d'un mètre carré. ${victim.shortName} a rentré son linge en urgence.`
            : `${p.shortName} fait un barbecue sur un balcon d'un mètre carré. La fumée monte jusqu'au 7e.`,
          tone: TONE.DROLE, weight: 0.4, actors: [p.id, victim?.id].filter(Boolean), apartment: apt.id,
          causes: ['il fait beau', `${p.shortName} est du genre à inviter tout le monde`],
        });
      }
    }
  }

  // --- Cambriolage : il faut une occasion, pas un dé ---
  tryBurglary() {
    const w = this.world;
    const rng = w.rng;
    if (this.graveBudget < 0.5) return;
    if (!this.cooldownOk('cambriolage', DAYS_PER_YEAR * 1.2)) return;

    // Une cible plausible : de l'argent, une absence longue, une porte connue
    // pour être fragile, et un immeuble mal sécurisé.
    const targets = w.occupiedApartments().filter((apt) => {
      const res = apt.residents.map((id) => w.people.get(id)).filter((p) => p?.alive);
      if (!res.length) return false;
      const away = res.every((p) => p.location !== 'home');
      const wealth = res.reduce((s, p) => s + p.money, 0);
      return away && wealth > 2500 && apt.condition < 0.75;
    });
    if (!targets.length) return;
    // Une chance sur mille par jour, même quand tout est réuni.
    if (!rng.chance(0.012 * (1 - w.security))) return;

    const apt = rng.weighted(targets, (a) => 1 + (1 - a.condition));
    const victims = apt.residents.map((id) => w.people.get(id)).filter((p) => p?.alive);
    const loss = Math.round(victims.reduce((s, p) => s + p.money, 0) * rng.float(0.3, 0.7));
    for (const v of victims) {
      v.money = Math.max(0, v.money - loss / victims.length);
      v.externalStress = Math.min(95, v.externalStress + 40);
      v.moodBias -= 22;
      v.remember({ kind: 'cambriolage', text: 'rentrer et voir la porte ouverte', valence: -0.85, strength: 0.95, tick: w.clock.tick, core: true });
      v.tags.add('cambriole');
    }
    this.spend('cambriolage', 0.7);
    w.security = Math.min(1, w.security + 0.15); // l'immeuble réagit
    w.beat({
      kind: 'crime.cambriolage',
      text: `On est entré chez ${victims[0].shortName}. La porte n'a pas résisté longtemps.`,
      tone: TONE.GRAVE, weight: 0.9, actors: victims.map((v) => v.id), apartment: apt.id,
      causes: [
        'l\'appartement était vide toute la journée',
        `la porte du ${w.aptName(apt)} est en mauvais état`,
        w.security < 0.4 ? 'le hall ne ferme plus depuis des mois' : 'l\'immeuble est mal gardé',
      ],
    });

    // Et le vrai poison : le soupçon. Il tombe sur quelqu'un, souvent à tort.
    const suspects = w.livingPeople().filter((p) =>
      p.apartment !== apt.id && (p.money < 200 || p.personality.has('menteur') || p.tags.has('crise')));
    const suspect = rng.pick(suspects);
    if (suspect) {
      for (const v of victims) {
        v.relations.get(suspect.id).adjust({ trust: -0.5, affinity: -0.3, tension: 0.3 });
        v.remember({ kind: 'soupcon', text: `le soupçon envers ${suspect.shortName}`, valence: -0.6, strength: 0.7, about: suspect.id, tick: w.clock.tick });
      }
      w.beat({
        kind: 'crime.soupcon',
        text: `Dans l'immeuble, on regarde ${suspect.shortName} autrement. Il n'a rien fait.`,
        tone: TONE.TENDU, weight: 0.6, actors: [suspect.id, ...victims.map((v) => v.id)], apartment: suspect.apartment,
        causes: [
          suspect.tags.has('crise') ? `${suspect.shortName} a des dettes, tout le monde le sait` : `${suspect.shortName} n'inspire pas confiance`,
          'il fallait bien accuser quelqu\'un',
        ],
      });
    }
  }

  // --- Disparition : personne ne sait, et c'est ça qui reste ---
  tryDisappearance() {
    const w = this.world;
    const rng = w.rng;
    if (this.graveBudget < 0.6) return;
    if (!this.cooldownOk('disparition', DAYS_PER_YEAR * 3)) return;

    const candidates = w.livingPeople().filter((p) => {
      if (p.age < 18 || p.age > 60) return false;
      const ties = p.relations.all().filter((r) => r.affinity > 0.45).length;
      return ties <= 1 && (p.stress > 70 || p.debt > 1500 || p.ambition?.id === 'partir')
        && p.mood < 42;
    });
    if (!candidates.length) return;
    if (!rng.chance(0.006)) return;

    const p = rng.pick(candidates);
    this.spend('disparition', 1);
    const apt = w.apartments[p.apartment];
    w.beat({
      kind: 'mystere.disparition',
      text: `${p.name} n'est pas rentré. Sa fenêtre est restée allumée trois nuits, puis quelqu'un a coupé le compteur.`,
      tone: TONE.GRAVE, weight: 1, actors: [p.id], apartment: p.apartment,
      causes: [
        p.debt > 1500 ? `${Math.round(p.debt)} € de dettes` : null,
        p.stress > 70 ? 'un stress que personne n\'avait vu' : null,
        'presque personne ne lui parlait',
      ].filter(Boolean),
    });
    for (const rel of p.relations.all()) {
      const o = w.people.get(rel.other);
      if (!o?.alive || rel.familiarity < 0.2) continue;
      o.remember({ kind: 'disparition', text: `la disparition de ${p.shortName}`, valence: -0.6, strength: 0.8, about: p.id, tick: w.clock.tick, core: true });
      o.externalStress = Math.min(70, o.externalStress + 10);
    }
    if (apt) apt.haunted = true; // l'appartement gardera une réputation
    w.removeResident(p, 'disparu');
    w.secrets.notifyDisappearance(p);
  }

  // --- Violence : le seuil le plus haut du jeu ---
  tryViolence() {
    const w = this.world;
    const rng = w.rng;
    if (this.graveBudget < 1.6) return;
    if (!this.cooldownOk('meurtre', DAYS_PER_YEAR * 8)) return;

    // Il faut absolument tout : un caractère, une haine ancienne, un
    // souvenir traumatique précis, une proximité, et une vie déjà écroulée.
    for (const p of w.livingPeople()) {
      if (p.personality.violence < 0.55) continue;
      if (p.stress < 82 || p.mood > 25) continue;
      for (const rel of p.relations.all()) {
        if (rel.tension < 0.96 || rel.affinity > -0.75) continue;
        const target = w.people.get(rel.other);
        if (!target?.alive) continue;
        const scar = p.memory.strongestAbout(target.id);
        if (!scar || scar.valence > -0.8 || scar.strength < 0.8) continue;
        const daysOfHate = (w.clock.tick - rel.lastConflict) / TICKS_PER_DAY;
        if (daysOfHate > 30) continue; // la haine doit être vive, pas ancienne
        if (!rng.chance(0.02)) continue;

        this.spend('meurtre', 2);
        const causes = [
          `${p.shortName} est ${p.personality.defects.map((d) => traitLabel(d, p)).join(', ')}`,
          `${scar.text} — il n'a jamais digéré`,
          `une haine à ${Math.round(rel.tension * 100)}% depuis des mois`,
          `${p.shortName} n'avait plus rien à perdre (moral ${Math.round(p.mood)})`,
        ];
        die(w, target, 'violence');
        w.beat({
          kind: 'crime.meurtre',
          text: `Il s'est passé quelque chose de grave chez ${target.shortName}. L'immeuble est silencieux depuis ce matin.`,
          tone: TONE.GRAVE, weight: 1, actors: [p.id, target.id], apartment: target.apartment,
          causes,
        });
        p.tags.add('coupable');
        p.remember({ kind: 'crime', text: 'ce qu\'il a fait cette nuit-là', valence: -1, strength: 1, about: target.id, tick: w.clock.tick, core: true });
        p.externalStress = 100;
        w.secrets.notifyCrime(p, target);
        return;
      }
    }
  }
}
