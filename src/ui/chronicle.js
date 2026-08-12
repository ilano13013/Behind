// La chronique.
//
// La liste de ce qui arrive dans l'immeuble. Chaque ligne peut être
// dépliée pour montrer sa chaîne causale : c'est la promesse du jeu —
// rien n'est arrivé au hasard, et on peut le vérifier.

import { TONE } from '../core/events.js';

const FILTERS = {
  tous: () => true,
  marquant: (b) => b.weight >= 0.45,
  drole: (b) => b.tone === TONE.DROLE,
  grave: (b) => b.tone === TONE.GRAVE || b.tone === TONE.TENDU,
};

export class ChronicleView {
  constructor(world, { onFocus }) {
    this.world = world;
    this.onFocus = onFocus;
    this.filter = 'tous';
    this.max = 90;
    this.root = document.getElementById('chronicle');
    this.list = document.getElementById('beats');

    for (const b of this.root.querySelectorAll('.filters button')) {
      b.addEventListener('click', () => {
        this.root.querySelectorAll('.filters button').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        this.filter = b.dataset.tone;
        this.rebuild();
      });
    }
    document.getElementById('chronicle-toggle').addEventListener('click', () => {
      this.root.classList.toggle('folded');
    });

    world.bus.on('beat', (beat) => this.add(beat));
  }

  show() {
    this.root.classList.remove('hidden');
    this.rebuild();
  }

  rebuild() {
    this.list.innerHTML = '';
    const beats = this.world.chronicle.recent(this.max, FILTERS[this.filter]);
    for (const b of beats.reverse()) this.append(b);
    this.list.scrollTop = this.list.scrollHeight;
  }

  add(beat) {
    if (!FILTERS[this.filter](beat)) return;
    this.append(beat);
    while (this.list.children.length > this.max) this.list.removeChild(this.list.firstChild);
    // On ne suit le fil que si le joueur ne l'a pas remonté lui-même.
    const atBottom = this.list.scrollHeight - this.list.scrollTop - this.list.clientHeight < 60;
    if (atBottom) this.list.scrollTop = this.list.scrollHeight;
  }

  append(beat) {
    const li = document.createElement('li');
    li.className = `tone-${beat.tone}`;
    const stamp = document.createElement('span');
    stamp.className = 'stamp';
    stamp.textContent = beat.stamp;
    const text = document.createElement('span');
    text.textContent = beat.text;
    li.append(stamp, text);

    li.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = li.querySelector('.causes');
      if (open) {
        open.remove();
        return;
      }
      li.appendChild(buildCauses(beat));
      if (beat.apartment !== null && this.onFocus) this.onFocus(beat);
    });

    this.list.appendChild(li);
  }
}

function buildCauses(beat) {
  const ul = document.createElement('ul');
  ul.className = 'causes';
  const head = document.createElement('li');
  head.className = 'why';
  head.textContent = beat.causes.length ? 'Pourquoi c\'est arrivé' : 'Aucune cause enregistrée';
  ul.appendChild(head);
  for (const c of beat.causes) {
    const li = document.createElement('li');
    li.textContent = c;
    ul.appendChild(li);
  }
  return ul;
}
