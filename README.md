# Behind

**Un immeuble. Des dizaines de vies. Aucune n'est la vôtre.**

Behind est un simulateur de vies humaines. Le joueur n'incarne personne : il
observe un grand immeuble rempli d'habitants autonomes, et il ne peut
influencer leur quotidien qu'à la marge — un cadeau anonyme, une lettre, une
occasion. Chaque partie raconte des centaines d'histoires différentes, et
aucune n'est écrite à l'avance.

```bash
npm start          # http://localhost:8000
```

Aucune dépendance, aucune compilation. Le jeu est du JavaScript natif servi
tel quel ; `npm start` ne fait que lancer un serveur statique.

```bash
npm run sim        # fait tourner l'immeuble 5 ans sans écran et raconte
npm run sim 20 ma-graine
npm test           # 30 vérifications sur la simulation
```

---

## Le principe

Au lancement, on ne voit que la façade. Elle vit en permanence : lumières qui
s'allument, rideaux, télés qui clignotent, musique, silhouettes derrière les
vitres, linge sur les balcons, minuterie de la cage d'escalier, un chat qui
passe. Il ne se passe *rien* et il se passe déjà tout.

On choisit une fenêtre. La caméra s'approche, le mur s'efface, et on regarde
vivre l'occupant. Pendant ce temps les quatre-vingts autres appartements
continuent leur vie exactement comme avant : la simulation ne s'arrête jamais
sur ce que le joueur regarde.

---

## Ce qui fait tenir l'illusion

### Les habitants ne sont pas des automates

Chaque habitant possède un nom, un âge, un métier, une situation financière,
une santé, des qualités, des défauts, des besoins, des habitudes, une
mémoire, des relations, une ambition et une histoire personnelle.

Aucun comportement important n'est scripté. À chaque décision, un habitant
note **toutes** les actions possibles selon ce qui lui manque, ce qu'il est,
l'heure qu'il est et qui se trouve autour de lui — puis il choisit. Changer
un trait de caractère change toute une journée sans qu'une ligne de scénario
n'ait été écrite.

| Fichier | Rôle |
|---|---|
| `src/sim/traits.js` | cinq axes de personnalité + trente qualités et défauts nommés |
| `src/sim/needs.js` | énergie, faim, hygiène, plaisir, social, confort — et le stress qui en découle |
| `src/sim/memory.js` | mémoire épisodique : chaque souvenir a une charge et s'érode |
| `src/sim/relations.js` | affinité, confiance, romance, tension, familiarité — quatre axes séparés |
| `src/sim/actions.js` | le catalogue d'actions et le choix par utilité |
| `src/sim/interactions.js` | ce qui se passe réellement quand deux personnes se retrouvent |
| `src/sim/lifecycle.js` | vieillir, travailler, aimer, se séparer, tomber malade, mourir |

### La rancune n'est pas une variable

Un habitant n'a pas de compteur « déteste son voisin ». Il a des **souvenirs**
datés, chargés émotionnellement, qui s'effacent d'autant plus lentement qu'il
est rancunier. C'est la relecture de ces souvenirs qui produit la rancune, la
nostalgie ou la confiance. Un souvenir fort peut ressortir des années plus
tard et gâcher une journée sans raison apparente — sauf qu'il y en a une.

### Les rumeurs se déforment

Quand un habitant répète ce qu'il croit savoir, la phrase se dégrade d'un
cran. Au bout de quelques paliers, « a reçu la visite d'un plombier » est
devenu « a un amant », puis « va divorcer ». C'est le générateur de
quiproquos de l'immeuble, et il fabrique de vraies brouilles à partir de
rien.

### Rien n'arrive sans raison

Chaque évènement de la chronique transporte sa **chaîne causale**. Cliquer
dessus remonte jusqu'au trait de caractère, au souvenir ou à la dispute qui
l'a rendu inévitable :

> **Ça a crié sur le palier entre Céline et Serge. 23:40, quand même.**
> ← Serge écoutait de la musique
> ← Céline supporte mal le bruit (28 %)
> ← Serge n'accepte pas la remarque (têtu)

C'est la promesse du jeu, et elle est vérifiable ligne par ligne. Les tests
échouent si un évènement marquant arrive sans cause.

### Les évènements graves sont rares, et le restent

Un « régisseur » (`src/sim/director.js`) n'écrit aucune histoire. Il ne
déclenche rien qui ne soit déjà prêt à arriver : chaque évènement rare a des
conditions causales strictes que la simulation doit avoir produites
d'elle-même. Le régisseur ne fait qu'une chose — dire *pas trop souvent*.

Un meurtre, par exemple, exige **tout** à la fois : un caractère violent, une
haine à plus de 96 %, un souvenir traumatique précis et encore vif, une vie
déjà écroulée, un budget de gravité disponible, et huit ans écoulés depuis le
dernier. Sur dix ans de simulation, il n'arrive presque jamais. C'est fait
pour.

---

## Le rôle du joueur

Le joueur ne contrôle jamais personne. Il dépose quelque chose dans une vie
et regarde ce que cette personne en fait.

| Intervention | Ce que ça coûte | Ce que ça peut donner |
|---|---|---|
| Déposer un cadeau anonyme | ◆ | un sourire dans le couloir — ou un méfiant qui soupçonne son voisin |
| Glisser une lettre | ◆ | une réconciliation — ou une porte qu'on referme plus fort |
| Proposer une opportunité | ◆◆ | une carrière relancée — ou un poste trop dur pour lui |
| Aider financièrement | ◆◆ | un loyer payé — ou une rechute chez quelqu'un de fragile |
| Favoriser une rencontre | ◆◆ | une histoire d'amour — ou vingt minutes très longues |
| Organiser un évènement | ◆◆◆ | un immeuble ressoudé — ou ceux qui ne sont pas descendus |
| Réparer un équipement commun | ◆◆ | tout le monde respire — sauf le bricoleur, vexé |
| Afficher un mot dans le hall | ◆ | l'arme la plus puissante de la copropriété |

Un habitant orgueilleux refuse l'argent. Un habitant méfiant retourne le
cadeau contre son voisin. Une fête réussie peut coûter une amitié au sixième
étage. **Chaque intervention peut améliorer une vie et en abîmer une autre.**

L'objectif est le bonheur général, qui dépend de la famille, de l'amour, de
l'amitié, du travail, de l'argent, de la santé, de la sécurité, du logement,
de la solitude et du stress.

---

## Direction artistique

Animation 2D dessinée entièrement au canvas, sans une seule image importée.
Couleurs chaudes de quartier populaire — ocres, terres cuites, verts fanés,
bleus de nuit. Personnages très expressifs : grosse tête, petit corps,
sourcils et bouche qui portent l'émotion, silhouettes lisibles à trois
centimètres de haut derrière une vitre.

Chaque appartement est meublé d'après ses occupants : le désordre suit le
besoin de confort et le caractère, le nombre de cadres au mur suit le nombre
d'habitants, l'usure suit l'entretien de l'immeuble.

L'humour est partout et sort de la simulation elle-même : le barbecue sur un
balcon d'un mètre carré, le dégât des eaux du bricoleur trop confiant, le mot
A4 scotché dans le hall, l'ado qui explique qu'il y avait grève, et
« Je mange sain à partir de demain » à 7 h 50 devant un placard vide.

---

## Les secrets

Le jeu contient dix secrets très rares. La plupart arrivent tout seuls, si
l'immeuble va dans la bonne direction : le concert de 4 h où personne n'a
appelé la police, la nuit où toutes les fenêtres se sont éteintes en même
temps, la lettre écrite et jamais envoyée, la fête spontanée dans la cour, le
locataire fantôme là où quelqu'un a disparu.

Et il y a **l'appartement éteint**.

Il existe dans chaque partie. Sa fenêtre ne s'allume jamais. Personne n'y
habite, personne ne se souvient de quelqu'un qui y aurait habité, et les
habitants en parlent parfois comme d'une légende — la gardienne, la vieille
dame du 7e, celui qui a cru voir un écran allumé un soir où il avait bu.

Quatre conditions le déverrouillent. Aucune n'est affichée en clair, aucune
ne s'obtient en une partie pressée. Ensuite, il reste à trouver le bon
moment.

*Ce qui se passe à l'intérieur n'est pas décrit ici.*

---

## Structure

```
index.html            l'écran, et rien d'autre
styles/main.css       papier chaud, encre brune, un seul accent orange
src/
  core/               aléatoire déterministe, horloge, bus d'évènements, français
  content/            noms, métiers, dialogues, déformations de rumeurs
  sim/                la simulation entière — aucune dépendance au navigateur
  render/             façade, intérieurs, personnages, caméra, scène finale
  ui/                 bandeau, chronique, fiche d'habitant, interventions
tools/                serveur statique, simulation sans écran, tests
```

`src/sim/` ne connaît ni le DOM ni le canvas : c'est ce qui permet de faire
tourner l'immeuble vingt ans en trente secondes dans un terminal, et de
tester la simulation sans navigateur.

### Le temps

Une seconde réelle vaut dix minutes de simulation à vitesse normale. Les
journées sont entières — 24 h, avec un vrai rythme matin / travail / soir /
nuit — mais une année ne dure que 24 jours de simulation : sans cette
compression, personne ne vieillirait jamais et il n'y aurait pas d'histoires
sur trois générations.

---

## Commandes

| | |
|---|---|
| Clic sur une fenêtre | entrer |
| Clic à l'extérieur, ou Échap | ressortir |
| Espace | pause |
| 1 2 3 4 | vitesses |
| Clic sur un nom | la fiche complète d'un habitant |
| Clic sur une ligne de chronique | *pourquoi c'est arrivé* |

Dans la console : `behind.avance(30)` fait passer trente jours d'un coup.
