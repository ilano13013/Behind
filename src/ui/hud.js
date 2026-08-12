// Le bandeau du haut : l'heure, la vitesse, le bonheur, l'influence.

export class Hud {
  constructor(world, { onSpeed }) {
    this.world = world;
    this.el = {
      root: document.getElementById('hud'),
      date: document.getElementById('date'),
      time: document.getElementById('time'),
      bar: document.getElementById('happy-bar'),
      value: document.getElementById('happy-value'),
      dots: document.getElementById('influence-dots'),
      secrets: document.getElementById('secret-count'),
    };
    this.lastHappy = -1;
    this.lastDots = -1;

    for (const b of document.querySelectorAll('.speed-card button')) {
      b.addEventListener('click', () => {
        document.querySelectorAll('.speed-card button').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        onSpeed(Number(b.dataset.speed));
      });
    }
  }

  show() {
    this.el.root.classList.remove('hidden');
  }

  setSpeedButton(speed) {
    document.querySelectorAll('.speed-card button').forEach((b) => {
      b.classList.toggle('active', Number(b.dataset.speed) === speed);
    });
  }

  update() {
    const w = this.world;
    this.el.date.textContent = w.clock.dateString();
    this.el.time.textContent = w.clock.timeString();

    // Le bonheur est coûteux à calculer : une fois par seconde suffit.
    const now = performance.now();
    if (!this._nextHappy || now > this._nextHappy) {
      this._nextHappy = now + 1000;
      const h = w.averageHappiness();
      if (Math.abs(h - this.lastHappy) > 0.3) {
        this.lastHappy = h;
        this.el.bar.style.width = `${Math.max(2, Math.min(100, h))}%`;
        this.el.value.textContent = `${Math.round(h)} / 100 · ${w.livingPeople().length} habitants`;
      }
      this.el.secrets.textContent = String(w.secrets.discovered.size);
    }

    const pts = w.influence.points;
    if (pts !== this.lastDots) {
      this.lastDots = pts;
      this.el.dots.innerHTML = '';
      for (let i = 0; i < w.influence.max; i++) {
        const d = document.createElement('div');
        d.className = `dot${i < pts ? ' on' : ''}`;
        this.el.dots.appendChild(d);
      }
    }
  }
}

let toastTimer = null;

/** Message court, en haut. Utilisé avec parcimonie. */
export function toast(text, kind = '') {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.className = `toast ${kind}`;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), kind === 'secret' ? 6000 : 4200);
}
