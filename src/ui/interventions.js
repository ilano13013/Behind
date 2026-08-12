// Le panneau d'interventions.
//
// Sept gestes, pas un de plus. Chacun coûte de l'influence, et aucun ne
// garantit quoi que ce soit : l'habitant décide. Le texte des boutons dit
// bien ce qu'on fait, jamais ce qui va arriver.

import { INTERVENTIONS, performIntervention } from '../sim/interventions.js';
import { toast } from './hud.js';

export class InterventionBar {
  constructor(world) {
    this.world = world;
    this.root = document.getElementById('interventions');
    this.list = document.getElementById('interv-list');
    this.head = this.root.querySelector('.interv-head');
    this.target = null;
    this.build();
  }

  build() {
    this.list.innerHTML = '';
    this.buttons = [];
    for (const def of INTERVENTIONS) {
      const b = document.createElement('button');
      b.className = 'interv';
      b.innerHTML = `${def.label}<span class="cost">${'◆'.repeat(def.cost)}</span>`;
      b.title = def.desc;
      b.addEventListener('click', () => this.run(def));
      this.list.appendChild(b);
      this.buttons.push({ def, el: b });
    }
  }

  /** @param {object|null} person habitant visé, ou null pour l'immeuble seul */
  setTarget(person) {
    this.target = person;
    this.head.textContent = person
      ? `Vous pouvez agir sur ${person.firstName}, un peu.`
      : 'Vous pouvez agir sur l\'immeuble, un peu.';
    this.root.classList.remove('hidden');
    this.refresh();
  }

  hide() {
    this.root.classList.add('hidden');
    this.target = null;
  }

  refresh() {
    if (this.root.classList.contains('hidden')) return;
    const w = this.world;
    for (const { def, el } of this.buttons) {
      let ok = w.influence.can(def.cost);
      if (def.scope === 'personne') {
        ok = ok && !!this.target && this.target.alive
          && (!def.condition || def.condition(this.target))
          && this.target.interventionCooldown <= w.clock.tick;
      }
      el.disabled = !ok;
    }
  }

  run(def) {
    const res = performIntervention(this.world, def.id, this.target?.id ?? null);
    if (!res) return;
    if (res.error) {
      toast(res.error);
      return;
    }
    toast(res.text);
    this.refresh();
  }
}
