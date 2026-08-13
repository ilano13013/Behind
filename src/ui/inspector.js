// La fiche.
//
// Ce que le joueur peut savoir d'un habitant. Volontairement lisible et
// humain plutôt que chiffré : on montre le caractère, l'histoire, les
// relations. Les chiffres restent en second plan.

import { NEED_LABEL, NEEDS } from '../sim/needs.js';
import { linkLabel } from '../sim/relations.js';
import { traitInfo, traitLabel } from '../sim/traits.js';
import { jobLabel } from '../content/jobs.js';
import { COMMERCE_PHRASES } from '../sim/world.js';
import { g } from '../core/text.js';
import { ASSET_BASE, EMBEDDED, portraitFor } from '../render/assets.js';

export class Inspector {
  constructor(world, { onSelectPerson, onClose }) {
    this.world = world;
    this.onSelectPerson = onSelectPerson;
    this.onClose = onClose;
    this.root = document.getElementById('inspector');
    this.body = document.getElementById('inspector-body');
    this.apartment = null;
    this.person = null;
    this.expanded = new Set();
    // Refermer la fiche, c'est ressortir de l'appartement : garder la
    // caméra collée à une pièce dont on a fermé la fiche n'a aucun sens.
    document.getElementById('inspector-close').addEventListener('click', () => {
      if (this.onClose) this.onClose();
      else this.close();
    });
  }

  open(apt) {
    this.apartment = apt;
    this.root.classList.remove('hidden');
    this.render();
  }

  close() {
    this.root.classList.add('hidden');
    this.apartment = null;
    this.person = null;
    this.onSelectPerson?.(null);
  }

  get isOpen() {
    return this.apartment !== null;
  }

  refresh() {
    if (this.isOpen) this.render();
  }

  render() {
    const w = this.world;
    const apt = this.apartment;
    if (!apt) return;
    const residents = apt.residents.map((id) => w.people.get(id)).filter((p) => p?.alive);

    const frag = document.createDocumentFragment();
    frag.appendChild(el('div', 'apt-title', w.aptName(apt)));
    frag.appendChild(el('div', 'apt-sub',
      apt.hidden
        ? 'Aucun nom sur la boîte aux lettres.'
        : apt.commerce
          // « 0 pièce · 0 € · aucun habitant » pour une boulangerie, ce
          // n'est pas une information, c'est un bug d'écriture.
          ? 'Au rez-de-chaussée, sur la rue'
          : `${apt.rooms} pièce${apt.rooms > 1 ? 's' : ''} · ${apt.rent} € · ${residents.length || 'aucun'} habitant${residents.length > 1 ? 's' : ''}`));

    if (apt.hidden) {
      frag.appendChild(el('div', 'blurb',
        'Personne n\'y habite. Personne ne se souvient de quelqu\'un qui y aurait habité. La fenêtre ne s\'allume jamais.'));
      this.body.replaceChildren(frag);
      return;
    }

    if (!residents.length) {
      frag.appendChild(el('div', 'blurb', apt.commerce
        ? (COMMERCE_PHRASES[apt.commerce] ?? 'Le rez-de-chaussée du quartier.')
        : apt.haunted
          ? 'Vide depuis longtemps. On raconte des choses sur ce logement.'
          : 'Logement vide. Il finira par se relouer.'));
      this.body.replaceChildren(frag);
      return;
    }

    for (const p of residents) frag.appendChild(this.personCard(p));
    this.body.replaceChildren(frag);
  }

  personCard(p) {
    const w = this.world;
    const box = el('div', 'person');
    const open = this.expanded.has(p.id);

    const head = el('div', 'person-head');
    head.appendChild(el('span', 'person-name', p.firstName));
    head.appendChild(el('span', 'person-meta',
      `${p.lastName} · ${Math.floor(p.age)} ans · ${jobLabel(p.job, p)}`));
    head.addEventListener('click', () => {
      if (open) this.expanded.delete(p.id);
      else this.expanded.add(p.id);
      this.person = open ? null : p;
      this.onSelectPerson?.(open ? null : p);
      this.render();
    });
    box.appendChild(head);

    box.appendChild(el('div', 'person-doing', p.statusLine()));

    // Bonheur, toujours visible : c'est l'objectif du joueur.
    box.appendChild(barRow('bonheur', p.happiness, 100));

    if (!open) {
      box.appendChild(el('div', 'apt-sub', 'Cliquer sur le nom pour tout voir.'));
      return box;
    }

    // Le portrait dessiné, s'il existe. Sinon la fiche reste telle qu'elle
    // a toujours été : rien ne manque, il y a seulement quelque chose en
    // moins.
    const portrait = portraitFor(p);
    if (portrait) {
      const fig = el('div', 'portrait');
      const img = document.createElement('img');
      img.src = EMBEDDED[portrait] ?? `${ASSET_BASE}portraits/${portrait.split('/')[1]}.png`;
      img.alt = '';
      fig.appendChild(img);
      box.appendChild(fig);
    }

    // Caractère.
    box.appendChild(el('div', 'section-title', 'Caractère'));
    const chips = el('div', 'chips');
    for (const q of p.personality.qualities) {
      chips.appendChild(el('span', 'chip', traitLabel(q, p)));
    }
    for (const d of p.personality.defects) {
      chips.appendChild(el('span', 'chip bad', traitLabel(d, p)));
    }
    box.appendChild(chips);

    if (p.ambition) {
      box.appendChild(el('div', 'section-title', 'Ce qu\'il ou elle cherche'));
      box.appendChild(el('div', 'rel-row', p.ambition.label));
      box.appendChild(barRow('avancement', p.ambitionProgress * 100, 100));
    }

    // Besoins.
    box.appendChild(el('div', 'section-title', 'État'));
    const bars = el('div', 'bars');
    for (const n of NEEDS) bars.appendChild(barRow(NEED_LABEL[n], p.needs.get(n), 100));
    bars.appendChild(barRow('santé', p.health, 100));
    bars.appendChild(barRow('stress', 100 - p.stress, 100));
    box.appendChild(bars);

    const money = el('div', 'rel-row');
    money.appendChild(el('span', '', 'argent'));
    money.appendChild(el('b', '', `${Math.round(p.money)} €${p.debt > 0 ? ` · ${Math.round(p.debt)} € de dettes` : ''}`));
    box.appendChild(money);

    // Relations.
    const rels = p.relations.top(6).filter((r) => w.people.get(r.other)?.alive);
    if (rels.length) {
      box.appendChild(el('div', 'section-title', 'Relations'));
      for (const r of rels) {
        const other = w.people.get(r.other);
        const row = el('div', 'rel-row');
        row.appendChild(el('b', '', other.firstName));
        row.appendChild(el('span', 'rel-link', linkLabel(r)));
        box.appendChild(row);
      }
    }

    // Souvenirs.
    const mems = p.memory.highlights(5);
    if (mems.length) {
      box.appendChild(el('div', 'section-title', 'Ce qu\'il ou elle n\'oublie pas'));
      for (const m of mems) {
        box.appendChild(el('div', `mem-row ${m.valence >= 0 ? 'pos' : 'neg'}`, m.text));
      }
    }

    // Son histoire, telle qu'écrite dans la chronique.
    const story = w.chronicle.forActor(p.id, 6);
    if (story.length) {
      box.appendChild(el('div', 'section-title', 'Son histoire'));
      for (const b of story) {
        const row = el('div', 'mem-row');
        row.appendChild(el('span', 'stamp', `${b.stamp} — `));
        row.appendChild(document.createTextNode(b.text));
        box.appendChild(row);
      }
    }

    return box;
  }
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function barRow(label, value, max) {
  const row = el('div', 'bar-row');
  row.appendChild(el('span', '', label));
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const bar = el('div', `bar ${pct > 66 ? 'good' : pct > 33 ? 'warn' : 'bad'}`);
  const fill = el('div');
  fill.style.width = `${pct}%`;
  bar.appendChild(fill);
  row.appendChild(bar);
  row.appendChild(el('span', '', String(Math.round(value))));
  return row;
}
