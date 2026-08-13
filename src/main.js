// Behind.
//
// Point d'entrée : une horloge, un immeuble, une caméra, et une boucle.
// Le joueur n'a que trois gestes — regarder, s'approcher, effleurer.

import { World } from './sim/world.js';
import { TICKS_PER_DAY } from './core/clock.js';
import { TONE } from './core/events.js';
import {
  FacadeLayout, buildStaticLayer, drawFacade, syncWindows, drawWeather,
} from './render/facade.js';
import { drawInterior, updatePositions } from './render/apartment.js';
import {
  Camera, VIEW, interiorTarget, finaleTarget, lerpRect, facadeTransform, drawVignette, isNarrow,
} from './render/camera.js';
import { drawFinale, TOTAL as FINALE_TOTAL } from './render/finale.js';
import { startle } from './render/anim.js';
import { Hud, toast } from './ui/hud.js';
import { ChronicleView } from './ui/chronicle.js';
import { Inspector } from './ui/inspector.js';
import { InterventionBar } from './ui/interventions.js';
import { Guide } from './ui/guide.js';
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
let guide = null;

let speed = 1;
let accumulator = 0;
let lastFrame = 0;
let clock = 0;          // temps d'animation, en secondes
let finaleTime = null;  // scène de l'appartement caché
let hoverApt = null;
let dpr = 1;
let narrow = false;      // téléphone ou petit écran : l'interface change de forme
let bottomSheet = false; // portrait : les panneaux remontent du bas
let usingTouch = false;  // dès le premier doigt, on abandonne le survol

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
  chronicle = new ChronicleView(world, {
    onFocus: focusBeat,
    onExpand: () => guide?.accomplir('pourquoi'),
  });
  inspector = new Inspector(world, { onSelectPerson, onClose: () => leave() });
  interventions = new InterventionBar(world);
  guide = new Guide({ onNeedsLayout: () => updateChrome() });

  hud.show();
  chronicle.show();

  world.bus.on('intervention', () => guide?.accomplir('agir'));
  world.bus.on('secret', ({ title }) => toast(`Secret découvert — ${title}`, 'secret'));
  world.bus.on('hidden-unlocked', () => {
    toast('Quelque chose a changé. La fenêtre éteinte n\'est plus tout à fait éteinte.', 'secret');
  });
  world.bus.on('beat', (b) => {
    // On ne signale que le très rare : sinon plus rien n'est rare.
    if (b.tone === TONE.GRAVE && b.weight >= 0.9) toast(b.text);
    // Le visage réagit à ce qui vient d'arriver. Une expression de surprise
    // ne peut pas naître de l'état intérieur : il faut que le monde le dise.
    const reaction = b.tone === TONE.GRAVE ? 'choque'
      : b.tone === TONE.TENDU ? 'effraye'
        : b.tone === TONE.DROLE ? 'surpris' : null;
    if (!reaction || b.weight < 0.4) return;
    for (const id of b.actors ?? []) startle(world.people.get(id), reaction, 4);
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
  const w = window.innerWidth;
  const h = window.innerHeight;
  narrow = isNarrow(w, h);
  // En paysage court, une feuille du bas ne laisserait rien à la scène :
  // on repasse aux panneaux latéraux, simplement plus étroits.
  bottomSheet = narrow && h > w;
  // Un téléphone a souvent une densité de 3 : rendre 3× serait joli et
  // injouable. On plafonne à 2 sur grand écran, 1,75 sur mobile.
  dpr = Math.min(narrow ? 1.75 : 2, window.devicePixelRatio || 1);
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  layout.resize(w, h);
  cache = buildStaticLayer(world, layout);
  applyLayout();
}

/**
 * Bascule bureau / mobile.
 *
 * Sur téléphone la barre d'interventions est déplacée à l'intérieur de la
 * fiche d'habitant : deux panneaux flottants qui se disputent le bas d'un
 * écran de 390 px, ça ne marche pas. On déplace le nœud plutôt que d'en
 * entretenir deux copies.
 */
function applyLayout() {
  document.body.classList.toggle('mobile', narrow);
  const interv = document.getElementById('interventions');
  const inspectorEl = document.getElementById('inspector');
  const body = document.getElementById('inspector-body');
  if (narrow) {
    if (interv.parentElement !== inspectorEl) inspectorEl.insertBefore(interv, body);
    // La chronique démarre repliée : elle recouvrirait l'immeuble.
    document.getElementById('chronicle').classList.add('folded');
  } else if (interv.parentElement !== document.body) {
    document.body.appendChild(interv);
    document.getElementById('chronicle').classList.remove('folded');
  }
  updateChrome();
}

/** Boutons qui n'existent que dans certaines situations. */
/**
 * Place réellement occupée par l'interface autour de la scène.
 * On lit le DOM : c'est la seule source fiable une fois que le contenu des
 * panneaux change de hauteur.
 */
function reservedSpace() {
  const hud = document.getElementById('hud');
  const top = hud.classList.contains('hidden')
    ? 20 : hud.getBoundingClientRect().bottom + 10;

  const sheet = document.getElementById('inspector');
  const chron = document.getElementById('chronicle');
  let bottom = 16;
  let right = 16;

  const visible = (el) => el && !el.classList.contains('hidden')
    && !el.classList.contains('folded') && el.getBoundingClientRect().height > 1;

  if (bottomSheet) {
    if (visible(sheet)) bottom = Math.max(bottom, layout.height - sheet.getBoundingClientRect().top + 8);
    else if (visible(chron)) bottom = Math.max(bottom, layout.height - chron.getBoundingClientRect().top + 8);
    else bottom = 80; // place du bouton « la façade »
    if (guide?.courant) bottom = Math.max(bottom, 120);
  } else if (narrow) {
    if (visible(sheet)) right = Math.max(right, layout.width - sheet.getBoundingClientRect().left + 10);
    else if (visible(chron)) right = Math.max(right, layout.width - chron.getBoundingClientRect().left + 10);
    bottom = 56; // place du bouton « la façade »
  } else {
    if (visible(sheet)) right = Math.max(right, layout.width - sheet.getBoundingClientRect().left + 12);
    if (visible(chron)) bottom = Math.max(bottom, 150);
    if (guide?.courant) bottom = Math.max(bottom, 90);
  }
  // On ne laisse jamais l'interface avaler plus des deux tiers de l'écran.
  bottom = Math.min(bottom, layout.height * 0.66);
  right = Math.min(right, layout.width * 0.5);
  return { top, right, bottom };
}

function updateChrome() {
  const zoomed = camera && (camera.zoomed || camera.busy) && finaleTime === null;
  document.getElementById('btn-retour').classList.toggle('hidden', !zoomed);
  const sheetOpen = narrow && (!document.getElementById('inspector').classList.contains('hidden')
    || !document.getElementById('chronicle').classList.contains('folded'));
  document.body.classList.toggle('sheet-open', sheetOpen);
}

// ------------------------------------------------------------------ entrées

function installInput() {
  canvas.addEventListener('pointermove', (e) => {
    // Un doigt ne survole pas : il touche. Le liseré de survol n'a de sens
    // qu'à la souris.
    if (e.pointerType === 'touch') {
      usingTouch = true;
      hoverApt = null;
      return;
    }
    if (camera.zoomed || camera.busy) {
      hoverApt = null;
      return;
    }
    hoverApt = layout.hit(e.clientX, e.clientY);
    canvas.style.cursor = hoverApt ? 'pointer' : 'default';
  });

  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') usingTouch = true;
  });

  canvas.addEventListener('click', (e) => {
    if (finaleTime !== null) return;
    if (camera.busy) return;

    if (camera.zoomed) {
      // Un clic hors de la pièce ressort ; à l'intérieur on ne fait rien.
      const target = interiorTarget(layout.width, layout.height, reservedSpace());
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
      if (guide?.panelOuvert) {
        guide.closePanel();
        return;
      }
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

  document.getElementById('btn-retour').addEventListener('click', leave);
  document.getElementById('btn-chronique').addEventListener('click', () => {
    const el = document.getElementById('chronicle');
    const opening = el.classList.contains('folded');
    if (opening) inspector.close();
    el.classList.toggle('folded');
    updateChrome();
  });
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
  guide?.accomplir('entrer');
  if (!apt.hidden) interventions.setTarget(null);
  // Sur mobile, la fiche et la chronique ne cohabitent pas.
  if (narrow) document.getElementById('chronicle').classList.add('folded');
  updateChrome();
}

function leave() {
  if (finaleTime !== null) return;
  camera.leave();
  inspector.close();
  interventions.hide();
  updateChrome();
}

function onSelectPerson(person) {
  if (person) guide?.accomplir('habitant');
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
  // La scène finale prend tout l'écran : elle ignore les marges.
  const reserve = finaleTime !== null ? null : reservedSpace();
  const targetFn = finaleTime !== null
    ? finaleTarget
    : (ww, hh) => interiorTarget(ww, hh, reserve);

  // --- Façade, éventuellement rapprochée ---
  ctx.save();
  if (u > 0 && apt) {
    const from = layout.windowRect(apt);
    const to = targetFn(W, H);
    facadeTransform(ctx, from, to, u);
  }
  drawFacade(ctx, world, layout, clock, cache);
  drawWeather(ctx, world.weather, W, H, performance.now() / 1000);

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
    drawInterior(ctx, world, apt, rect, clock, { detail: reveal, dt });
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
