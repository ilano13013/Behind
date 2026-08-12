// Behind.
//
// Point d'entrée : une horloge, un immeuble, une caméra, et une boucle.
// Le joueur n'a que trois gestes — regarder, s'approcher, effleurer.

import { World } from './sim/world.js';
import { TICKS_PER_DAY } from './core/clock.js';
import { TONE } from './core/events.js';
import {
  FacadeLayout, buildStaticLayer, drawFacade, syncWindows,
} from './render/facade.js';
import { drawInterior, updatePositions } from './render/apartment.js';
import {
  Camera, VIEW, interiorTarget, finaleTarget, lerpRect, facadeTransform, drawVignette,
} from './render/camera.js';
import { drawFinale, TOTAL as FINALE_TOTAL } from './render/finale.js';
import { Hud, toast } from './ui/hud.js';
import { ChronicleView } from './ui/chronicle.js';
import { Inspector } from './ui/inspector.js';
import { InterventionBar } from './ui/interventions.js';
import { SECRET_LIST } from './sim/secrets.js';

// Une seconde réelle = dix minutes de simulation à vitesse normale.
const TICKS_PER_SECOND = 2;
const MAX_TICKS_PER_FRAME = 60;

const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d', { alpha: false });

let world = null;
let layout = null;
let cache = null;
let camera = null;
let hud = null;
let chronicle = null;
let inspector = null;
let interventions = null;

let speed = 1;
let accumulator = 0;
let lastFrame = 0;
let clock = 0;          // temps d'animation, en secondes
let finaleTime = null;  // scène de l'appartement caché
let hoverApt = null;
let dpr = 1;

// --------------------------------------------------------------- démarrage

document.getElementById('start').addEventListener('click', start);
document.getElementById('seed').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') start();
});

function start() {
  const seed = document.getElementById('seed').value.trim() || 'behind';
  document.getElementById('intro').classList.add('hidden');

  world = new World({ seed });
  camera = new Camera();
  layout = new FacadeLayout(world);

  hud = new Hud(world, { onSpeed: setSpeed });
  chronicle = new ChronicleView(world, { onFocus: focusBeat });
  inspector = new Inspector(world, { onSelectPerson: onSelectPerson });
  interventions = new InterventionBar(world);

  hud.show();
  chronicle.show();

  world.bus.on('secret', ({ title }) => toast(`Secret découvert — ${title}`, 'secret'));
  world.bus.on('hidden-unlocked', () => {
    toast('Quelque chose a changé. La fenêtre éteinte n\'est plus tout à fait éteinte.', 'secret');
  });
  world.bus.on('beat', (b) => {
    // On ne signale que le très rare : sinon plus rien n'est rare.
    if (b.tone === TONE.GRAVE && b.weight >= 0.9) toast(b.text);
  });

  resize();
  window.addEventListener('resize', resize);
  installInput();

  // Accès au monde depuis la console : très pratique pour regarder
  // l'immeuble vieillir sans attendre.
  window.behind = { world, camera, layout, avance: (jours) => {
    const n = jours * 288;
    for (let i = 0; i < n; i++) world.tick();
  } };

  lastFrame = performance.now();
  requestAnimationFrame(frame);
}

function setSpeed(v) {
  speed = v;
  hud.setSpeedButton(v);
}

function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  layout.resize(w, h);
  cache = buildStaticLayer(world, layout);
}

// ------------------------------------------------------------------ entrées

function installInput() {
  canvas.addEventListener('mousemove', (e) => {
    if (camera.zoomed || camera.busy) {
      hoverApt = null;
      return;
    }
    hoverApt = layout.hit(e.clientX, e.clientY);
    canvas.style.cursor = hoverApt ? 'pointer' : 'default';
  });

  canvas.addEventListener('click', (e) => {
    if (finaleTime !== null) return;
    if (camera.busy) return;

    if (camera.zoomed) {
      // Un clic hors de la pièce ressort ; à l'intérieur on ne fait rien.
      const target = interiorTarget(layout.width, layout.height);
      const inside = e.clientX >= target.x && e.clientX <= target.x + target.w
        && e.clientY >= target.y && e.clientY <= target.y + target.h;
      if (!inside) leave();
      return;
    }

    const apt = layout.hit(e.clientX, e.clientY);
    if (!apt) return;
    enterApartment(apt);
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!document.getElementById('secrets-panel').classList.contains('hidden')) {
        toggleSecrets(false);
        return;
      }
      leave();
    }
    if (e.code === 'Space') {
      e.preventDefault();
      setSpeed(speed === 0 ? 1 : 0);
    }
    if (e.key >= '1' && e.key <= '4') setSpeed([0, 1, 3, 8][Number(e.key) - 1]);
  });

  document.getElementById('btn-secrets').addEventListener('click', () => toggleSecrets(true));
  document.getElementById('secrets-close').addEventListener('click', () => toggleSecrets(false));
}

function enterApartment(apt) {
  // L'appartement caché : c'est là que tout se joue, ou pas.
  if (apt.hidden) {
    if (world.secrets.canEnter()) {
      world.secrets.enterHidden();
      finaleTime = 0;
      setSpeed(0);
      inspector.close();
      interventions.hide();
      // On efface toute l'interface : la scène ne se partage pas.
      document.body.classList.add('finale');
      camera.enter(apt);
      return;
    }
    if (apt.sealed) {
      toast('La fenêtre est éteinte. Elle le restera.');
      return;
    }
  }

  camera.enter(apt);
  inspector.open(apt);
  if (!apt.hidden) interventions.setTarget(null);
}

function leave() {
  if (finaleTime !== null) return;
  camera.leave();
  inspector.close();
  interventions.hide();
}

function onSelectPerson(person) {
  if (!person) {
    if (camera.zoomed && camera.apartment && !camera.apartment.hidden) {
      interventions.setTarget(null);
    }
    return;
  }
  interventions.setTarget(person);
}

function focusBeat(beat) {
  const apt = world.apartments[beat.apartment];
  if (!apt) return;
  enterApartment(apt);
}

function toggleSecrets(open) {
  const panel = document.getElementById('secrets-panel');
  if (!open) {
    panel.classList.add('hidden');
    return;
  }
  const prog = world.secrets.progress();
  const list = document.getElementById('secrets-list');
  list.innerHTML = '';
  for (const s of prog.list) {
    const li = document.createElement('li');
    if (s.found) li.className = 'found';
    const b = document.createElement('b');
    b.textContent = s.found ? s.title : '? ? ?';
    const small = document.createElement('small');
    small.textContent = s.found ? s.hint : 'Pas encore trouvé.';
    li.append(b, small);
    list.appendChild(li);
  }
  const hp = document.getElementById('hidden-progress');
  hp.innerHTML = '';
  const head = document.createElement('div');
  head.textContent = prog.hidden.entered
    ? 'Vous y êtes entré. Une seule fois, comme tout le monde.'
    : prog.hidden.unlocked
      ? 'La porte peut s\'ouvrir. Reste à trouver le bon moment.'
      : 'Une fenêtre de cet immeuble ne s\'allume jamais.';
  hp.appendChild(head);
  for (const c of prog.hidden.conditions) {
    const d = document.createElement('div');
    d.className = `cond${c.done ? ' done' : ''}`;
    d.textContent = c.done ? c.label : '— ';
    hp.appendChild(d);
  }
  panel.classList.remove('hidden');
}

// -------------------------------------------------------------------- boucle

function frame(now) {
  const dtRaw = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;
  clock += dtRaw;

  // --- Simulation ---
  if (finaleTime === null && speed > 0) {
    accumulator += dtRaw * TICKS_PER_SECOND * speed;
    let n = 0;
    while (accumulator >= 1 && n < MAX_TICKS_PER_FRAME) {
      world.tick();
      accumulator -= 1;
      n++;
    }
    if (accumulator > MAX_TICKS_PER_FRAME) accumulator = 0;
  }

  camera.update(dtRaw);

  // Le joueur regarde-t-il la fenêtre éteinte ? Le jeu le sait.
  const hidden = world.apartments[world.hiddenApartmentId];
  const watching = (camera.apartment === hidden && camera.zoomed)
    || (hoverApt === hidden);
  if (watching && finaleTime === null) {
    world.secrets.observeHidden(dtRaw * 60);
  }

  syncWindows(world);
  render(dtRaw);

  hud.update();
  interventions.refresh();

  // La fiche se rafraîchit deux fois par seconde : assez pour être vivante.
  if (!frame.nextSheet || now > frame.nextSheet) {
    frame.nextSheet = now + 500;
    inspector.refresh();
  }

  requestAnimationFrame(frame);
}

function render(dt) {
  const W = layout.width;
  const H = layout.height;
  const u = camera.progress();
  const apt = camera.apartment;
  const targetFn = finaleTime !== null ? finaleTarget : interiorTarget;

  // --- Façade, éventuellement rapprochée ---
  ctx.save();
  if (u > 0 && apt) {
    const from = layout.windowRect(apt);
    const to = targetFn(W, H);
    facadeTransform(ctx, from, to, u);
  }
  drawFacade(ctx, world, layout, clock, cache);

  // Surlignage de la fenêtre survolée : discret, juste un liseré.
  if (hoverApt && u === 0) {
    const r = layout.windowRect(hoverApt);
    ctx.strokeStyle = 'rgba(255,235,200,0.85)';
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4);
  }
  ctx.restore();

  if (!apt || u <= 0) return;

  // --- Le mur s'efface, la pièce apparaît ---
  const from = layout.windowRect(apt);
  const target = targetFn(W, H);
  const rect = lerpRect(from, target, u);

  drawVignette(ctx, W, H, rect, u);

  const reveal = Math.max(0, (u - 0.28) / 0.72);
  if (reveal <= 0) return;

  ctx.save();
  ctx.globalAlpha = reveal;

  if (finaleTime !== null) {
    finaleTime += dt;
    drawFinale(ctx, world, rect, finaleTime);
    if (finaleTime >= FINALE_TOTAL) endFinale();
  } else {
    updatePositions(world, apt, dt);
    drawInterior(ctx, world, apt, rect, clock, { detail: reveal });
    drawRoomFrame(ctx, rect);
  }
  ctx.restore();
}

/** Un cadre autour de la pièce : on regarde à travers un mur ouvert. */
function drawRoomFrame(ctx, rect) {
  ctx.save();
  ctx.strokeStyle = 'rgba(60,42,30,0.55)';
  ctx.lineWidth = 3;
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

function endFinale() {
  finaleTime = null;
  document.body.classList.remove('finale');
  world.secrets.sealHidden();
  camera.leave();
  setSpeed(1);
  toast('La fenêtre s\'est éteinte. Elle ne se rallumera plus.', 'secret');
}
