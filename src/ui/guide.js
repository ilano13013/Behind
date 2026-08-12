// Le mode d'emploi.
//
// Behind ne ressemble à rien de familier : on n'y dirige personne, on n'y
// perd pas, et le bouton le plus important est une fenêtre. Sans un mot
// d'explication, on reste devant une façade sans savoir quoi en faire.
//
// Deux choses ici : une page « Comment jouer » consultable à tout moment,
// et quatre conseils qui apparaissent un par un à la première partie, dans
// l'ordre où on en a besoin — chacun disparaît dès qu'on a fait le geste.

const STORAGE = 'behind.guide.v1';

/** Les quatre gestes qui suffisent à comprendre le jeu. */
export const STEPS = [
  {
    id: 'entrer',
    texte: 'Choisissez une fenêtre et touchez-la. Le mur disparaît, et vous voyez vivre les gens qui habitent là.',
  },
  {
    id: 'habitant',
    texte: 'Touchez un nom dans la fiche : vous verrez son caractère, ce qu\'il cherche, ses relations et ce qu\'il n\'oublie pas.',
  },
  {
    id: 'pourquoi',
    texte: 'Dans la chronique, chaque ligne s\'ouvre d\'une pression. Elle vous dit pourquoi c\'est arrivé — rien n\'est laissé au hasard.',
  },
  {
    id: 'agir',
    texte: 'Les losanges ◆ sont votre influence. Elle se recharge toute seule. Tentez un geste : on peut très bien vous dire non.',
  },
];

const SECTIONS = [
  {
    titre: 'Vous n\'êtes personne',
    corps: `Il n'y a pas de personnage à diriger. Vous observez un immeuble où
    tout le monde décide seul, en fonction de son caractère, de ses besoins et
    de ses souvenirs. Les quatre-vingts appartements vivent en même temps,
    y compris ceux que vous ne regardez pas.`,
  },
  {
    titre: 'Regarder',
    corps: `Touchez une fenêtre pour entrer, « ‹ La façade » pour ressortir.
    Dans la fiche à droite, touchez un nom pour tout savoir d'un habitant.
    Les fenêtres allumées sont celles où il se passe quelque chose.`,
  },
  {
    titre: 'Comprendre',
    corps: `La chronique en bas note ce qui arrive. Chaque ligne s'ouvre et
    montre sa chaîne de causes : le trait de caractère, le souvenir ou la
    dispute qui a mené là. Si une histoire vous surprend, ouvrez-la.`,
  },
  {
    titre: 'Agir un peu',
    corps: `Vous ne commandez à personne, mais vous pouvez poser quelque chose
    dans une vie : un cadeau, une lettre, une occasion. Chaque geste coûte de
    l'influence ◆, qui se recharge avec le temps. L'habitant décide ensuite.
    Un orgueilleux refuse l'argent, un méfiant se retourne contre son voisin,
    et une fête réussie peut coûter une amitié à l'étage au-dessus.`,
  },
  {
    titre: 'Le but',
    corps: `Faire monter le bonheur de l'immeuble, en haut de l'écran. Il
    dépend de la famille, de l'amour, de l'amitié, du travail, de l'argent,
    de la santé, de la sécurité, du logement, de la solitude et du stress.
    Il n'y a pas de fin : il y a des vies qui durent.`,
  },
  {
    titre: 'Le temps',
    corps: `Les boutons ▶ règlent la vitesse ; ❚❚ met en pause. Les journées
    sont entières, mais une année ne dure que vingt-quatre jours de
    simulation — sinon personne ne vieillirait jamais et il n'y aurait pas
    d'histoires sur trois générations.`,
  },
  {
    titre: 'Les secrets',
    corps: `Il y en a dix. La plupart arrivent tout seuls si l'immeuble va
    dans la bonne direction. Un seul se mérite : quelque part, une fenêtre ne
    s'allume jamais, et les habitants en parlent parfois. On ne vous dira pas
    comment y entrer.`,
  },
];

export class Guide {
  constructor({ onNeedsLayout } = {}) {
    this.onNeedsLayout = onNeedsLayout;
    this.done = new Set(this.load());
    this.panel = document.getElementById('guide-panel');
    this.body = document.getElementById('guide-body');
    this.coach = document.getElementById('coach');
    this.coachText = document.getElementById('coach-text');

    document.getElementById('btn-aide').addEventListener('click', () => this.openPanel());
    document.getElementById('guide-close').addEventListener('click', () => this.closePanel());
    document.getElementById('coach-close').addEventListener('click', () => {
      // Passer un conseil, c'est passer tous les conseils : quelqu'un qui
      // referme la bulle n'a pas envie qu'on lui en propose une autre.
      for (const s of STEPS) this.done.add(s.id);
      this.save();
      this.refresh();
    });

    this.buildPanel();
    this.refresh();
  }

  load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE) ?? '[]');
    } catch {
      return [];
    }
  }

  save() {
    try {
      localStorage.setItem(STORAGE, JSON.stringify([...this.done]));
    } catch {
      // Navigation privée ou file:// verrouillé : les conseils réapparaîtront
      // à la prochaine partie, ce n'est pas grave.
    }
  }

  /** Marque un geste comme acquis et passe au conseil suivant. */
  accomplir(id) {
    if (this.done.has(id)) return;
    this.done.add(id);
    this.save();
    this.refresh();
  }

  /** Le premier conseil pas encore acquis, ou rien. */
  get courant() {
    return STEPS.find((s) => !this.done.has(s.id)) ?? null;
  }

  refresh() {
    const step = this.courant;
    if (!step) {
      this.coach.classList.add('hidden');
    } else {
      this.coachText.textContent = step.texte;
      this.coach.classList.remove('hidden');
    }
    this.onNeedsLayout?.();
  }

  buildPanel() {
    const frag = document.createDocumentFragment();
    for (const s of SECTIONS) {
      const h = document.createElement('h3');
      h.textContent = s.titre;
      const p = document.createElement('p');
      p.textContent = s.corps.replace(/\s+/g, ' ').trim();
      frag.append(h, p);
    }
    this.body.replaceChildren(frag);
  }

  openPanel() {
    this.panel.classList.remove('hidden');
  }

  closePanel() {
    this.panel.classList.add('hidden');
  }

  get panelOuvert() {
    return !this.panel.classList.contains('hidden');
  }
}
