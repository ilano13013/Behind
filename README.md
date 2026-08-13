# Behind

**Un immeuble. Des dizaines de vies. Aucune n'est la vôtre.**

Behind est un simulateur de vies humaines. Le joueur n'incarne personne : il
observe un grand immeuble rempli d'habitants autonomes, et il ne peut
influencer leur quotidien qu'à la marge — un cadeau anonyme, une lettre, une
occasion. Chaque partie raconte des centaines d'histoires différentes, et
aucune n'est écrite à l'avance.

## Y jouer

**Le plus simple : `behind.html`.** Un seul fichier, à la racine du dépôt.
Téléchargez-le et ouvrez-le — double-clic, glissé dans un navigateur, ou
envoyé par message à quelqu'un. Pas de serveur, pas d'installation, pas de
connexion : tout le jeu tient dedans, y compris le CSS et les icônes.

C'est aussi le fichier à déposer tel quel sur n'importe quel hébergement
statique si vous voulez une adresse à partager.

```bash
npm start          # serveur local : http://localhost:8000
                   # affiche aussi l'adresse à taper sur le téléphone
npm run build      # reconstruit behind.html depuis les sources
npm run sim        # fait tourner l'immeuble 5 ans sans écran et raconte
npm run sim 20 ma-graine
npm test           # 42 vérifications : simulation et animation
```

Aucune dépendance, aucune compilation nécessaire pour développer : le jeu
est du JavaScript natif, et `npm start` ne fait que servir le dossier.
`npm run build` n'existe que pour produire le fichier unique.

> **Pourquoi un build alors qu'il n'y a rien à compiler ?**
> Le code est écrit en modules ES. Un navigateur refuse de charger des
> modules depuis un `file://` : ouvrir `index.html` en double-cliquant ne
> donnerait rien. `tools/build.js` assemble les trente-deux modules dans un
> seul script classique, ce qui rend le fichier ouvrable partout. Il vérifie
> au passage ses propres hypothèses — imports nommés uniquement, pas
> d'export par défaut, pas d'import dynamique, pas de cycle — et s'arrête
> net si l'une d'elles tombe, plutôt que de produire un fichier cassé.

Une page GitHub Pages est configurée dans `.github/workflows/pages.yml` :
elle lance les tests, reconstruit le fichier unique et publie le dépôt.
Il reste une case à cocher une seule fois, côté GitHub :
**Settings → Pages → Source → « GitHub Actions »**.

---

## Apprendre à y jouer

Behind ne ressemble à rien de familier : on n'y dirige personne, on n'y perd
pas, et le bouton le plus important est une fenêtre. Le jeu explique donc
lui-même :

- **Quatre conseils** apparaissent un par un à la première partie, dans
  l'ordre où on en a besoin. Chacun disparaît dès qu'on a fait le geste —
  pas au bout d'un minuteur.
- Le bouton **?** ouvre « Comment jouer » à tout moment : ce qu'on est, ce
  qu'on regarde, comment lire les causes, ce que coûte un geste, et le but.

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
| `src/render/anim.js` | le squelette animé : poses, lissage, mouvement secondaire |
| `src/render/wardrobe.js` | la charte graphique : morphologies, visages, coiffures, tenues |

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

Animation 2D. Tout est dessiné au canvas, forme par forme — et tout peut
être remplacé par de vrais dessins, habitants compris : `assets/` est la
prise, et le code n'est que ce qui tient les emplacements vides.
Couleurs chaudes de quartier populaire — ocres, terres cuites, verts fanés,
bleus de nuit.

Le trait est celui de l'animation urbaine française : **contours à l'encre
épais**, aplats francs, une seule ombre portée par volume. Personne n'est
joli, tout le monde est reconnaissable : mâchoire, nez, oreilles, coupe,
carrure, col, manches et démarche sont tirés de l'identifiant de l'habitant,
donc stables pour toute la partie.

### La charte graphique

Les habitants ne sont pas six modèles recolorés. `src/render/wardrobe.js`
tient un **catalogue de pièces**, et chaque habitant en tire une dans chaque
rayon :

| Rayon | Variantes |
|---|---|
| Morphologies | **6** — enfant, adolescent, homme adulte, femme, mature, senior |
| Formes de têtes | **30** |
| Coiffures | **50** — afro, tresses, dreads, chignon, queue, banane, mulet, frange, crête, rasé, dégarni, chauve… |
| Paires d'yeux | **30** — ronds, en amande, tombants, cernés, maquillés, à paupière lourde… |
| Nez | **25** |
| Bouches | **40** |
| Barbes et moustaches | **30** — collier, barbe pleine, bouc, chevron, gauloise, favoris, mouche… |
| Pantalons | **50** — jean, chino, jogging, cargo, costume, velours, jupe (5 coupes), short, bermuda, cycliste, treillis, baggy… chacun en slim, droit ou ample |
| Chaussures | **40** — baskets basses et montantes, bottines, mocassins, talons, sandales, tongs, chaussons, chaussures de chantier, pieds nus |
| Accessoires | **60** — répartis sur neuf emplacements (tête, yeux, cou, poignet, oreilles, mains, peau, divers) |
| Hauts | 23, combinés en **7 tenues** par habitant |
| Couvre-chefs | 11, dont trois qu'on ne croise presque jamais |
| Lunettes | 8, de vue et de soleil |
| Motifs | uni, rayures, carreaux, pois |
| Décors intérieurs | **40** |

Le tirage est stable (il découle de l'identifiant de l'habitant, donc il ne
change jamais) mais il n'est **pas aveugle** : l'âge, le genre, le métier et
le caractère orientent chaque rayon. Un plombier ne s'habille pas comme une
notaire, un enfant ne porte pas de cravate, et la calvitie ne frappe pas les
étudiants. Les pièces incompatibles sont retirées du sac *avant* le tirage —
corriger après coup laissait toujours passer trois hommes en jupe, et le
joueur ne voyait plus que ça.

Résultat sur un immeuble neuf : **130 apparences distinctes pour
130 habitants**, aucune pièce ne dépassant 17 % de présence. `npm test`
vérifie chaque compte du tableau ci-dessus — si un rayon rétrécit, le test
casse — ainsi que la cohérence de toutes les tenues.

### Sept tenues, pas une

Une tenue n'est pas une propriété de l'habitant, c'est un **contexte**. Le
même voisin a sept garde-robes : quotidien, travail, sport, soirée, été,
hiver, maison. Il dort en pyjama, va au chantier en salopette ou au cabinet
en chemise selon son métier, sort en tenue de soirée, met un manteau en
janvier et des sandales en juillet. C'est la simulation qui choisit —
l'action en cours d'abord, la saison ensuite.

Quelques pièces existent en un ou deux exemplaires dans tout l'immeuble et
ne se signalent nulle part : une couronne, un casque intégral qu'on ne
retire jamais, un masque d'alien, une paire de baskets dorées, un canard en
plastique dans une salle de bain, une licorne gonflable dans un salon. Ils
sont là. Le jeu ne le dira pas.

### Douze intérieurs qui parlent

Un appartement n'est plus seulement meublé au hasard : il est **typé** par
qui l'habite. Studio d'étudiant, salon familial, cuisine populaire, chambre
d'ado, couple sans enfant, retraité, gamer, atelier d'artiste, colocation,
bureau à domicile, salle de sport improvisée — et le logement vide, meubles
sous un drap. Chaque type apporte ses objets : le double écran et le
bandeau LED du streamer, les toiles retournées contre le mur de l'artiste,
le tas de chaussures de la colocation, le vélo d'appartement, le tricot du
retraité.

### Brancher de vrais dessins

Tout Behind est tracé par du code, forme par forme. Ça a une limite dure :
un trait de code ne remplacera jamais un trait de dessinateur.

`assets/` est la prise. **Elle peut rester vide** — c'est même l'état par
défaut, et le jeu tourne entièrement sur son dessin procédural. Chaque
emplacement rempli remplace un morceau de dessin, et un seul fichier suffit
à voir la différence sur un écran.

```
node tools/fake-assets.js    des images de test, pour vérifier la tuyauterie
npm run assets               ce qui est là, ce qui manque
npm run build                embarque tout en base64 dans behind.html
```

**Six cent cinquante et un emplacements**, en sept familles :

| Famille | Combien | Ce que ça remplace |
|---|---|---|
| `personnages/` | **360** | Les habitants eux-mêmes : 6 gabarits × 60 animations |
| `portraits/` | **170** | Le visage d'un habitant dans sa fiche |
| `decors/` | **40** | Tout l'intérieur d'un appartement, par type d'habitant |
| `expressions/` | **40** | Un gros plan de visage, pour l'interface |
| `ambiances/` | **25** | Le ciel et le quartier derrière l'immeuble |
| `commerces/` | **10** | Le rez-de-chaussée, où l'on peut entrer |
| `batiment/` | **6** | Un calque d'usure, selon l'âge de l'immeuble |

**Aucune de ces images n'est décorative, et aucune n'est inatteignable.**
Le décor d'un appartement est *déduit* de qui l'habite — un tatoueur a un
atelier, un accumulateur ne voit plus son sol, un logement sans locataire a
ses meubles sous un drap. `npm test` simule plusieurs années d'immeuble et
vérifie que les quarante sortent au moins une fois : on ne fait pas payer
un dessin que personne ne verrait jamais.

Le cahier des charges complet — tailles, cadrages, et la ligne de sol à
86 % de la hauteur sur laquelle les habitants posent les pieds — est dans
`assets/README.md`.

**Les habitants aussi sont des images.** Une planche livrée pour un
gabarit et une animation remplace le pantin, telle quelle, sans que le jeu
la retouche — pas de teinte, pas de recoloriage de tenue. Une planche est
une bande horizontale de cases de 256 × 384, personnage centré, **pieds sur
le bord du bas**, fond transparent.

Le dessin par code reste, et il doit rester : c'est lui qui tient les
gabarits pas encore livrés, sans un raccord visible. Livrez donc par
gabarit complet plutôt que par animation.

Une limite honnête : **les 360 planches ne tiendront pas dans
`behind.html`.** En dessin définitif, c'est plus de cent mégaoctets, et le
base64 les gonfle d'un tiers. Il y a donc deux distributions — le dossier
servi (`npm start` ou un hébergement) qui a tout, et le fichier unique qui
a les décors, les portraits, les ambiances et les habitants dessinés par le
code. `npm run assets` affiche le total livré et ce qui dépasse.

### La météo, le calendrier, la lune

Douze temps différents, tirés chaque jour selon la saison : pluie, orage,
neige, petite neige, brouillard, canicule, grand froid, vent fort, tempête,
pollution, et l'arc-en-ciel qui ne peut arriver **que** le lendemain d'une
pluie. Deux jours sur trois, il ne se passe rien dans le ciel — un immeuble
sous la tempête tous les trois jours ne serait plus un immeuble, ce serait
un décor de catastrophe, et les habitants vivraient sous une pluie de malus
permanente.

Ça se voit sur la façade, et ça se **sent** : la canicule use et stresse,
le grand froid épuise, la pollution abîme la santé, la pluie enferme,
l'arc-en-ciel remonte tout le monde de deux points.

Quatre fêtes tombent chaque année — Noël, le nouvel an, Halloween, le feu
d'artifice — et ce sont les seuls évènements du jeu qui touchent tout
l'immeuble dans le même sens. La lune est pleine tous les trente jours. Et
une fois par décennie environ, le ciel prend une couleur dont personne ne
reparle le lendemain.

### Comment un corps est construit

Un membre entier est **un seul tracé**. C'est la règle qui décide de tout :
tant que la cuisse et le mollet étaient deux capsules autonomes, chaque
articulation laissait voir deux bouts arrondis superposés — la rotule du
pantin articulé. En assemblant les segments dans le même chemin, en encrant
le contour d'un trait épais puis en remplissant par-dessus, les coutures
internes disparaissent et le membre devient continu.

Le reste suit le même principe — on construit le corps, on l'habille
ensuite :

- **Un buste, pas un trapèze.** Trapèzes qui remontent vers le cou,
  deltoïdes, creux de taille, hanches.
- **Un cou**, dessiné avant le buste, que le col vient recouvrir à la base.
- **Des vêtements.** Le bras est tracé en entier couleur peau, puis la
  manche est posée dessus : on obtient une vraie manche avec un bord, courte
  ou longue, au lieu d'un tube bicolore. Col rond, en V ou de chemise, bas de
  vêtement marqué d'une ligne, ourlet de pantalon au-dessus de la chaussure.
- **De la profondeur.** Le bras du fond passe derrière le buste.
- **Un visage qui se lit sur toutes les carnations.** Sourcils, nez et
  paupières sont à l'encre, pas en teinte de peau ou de cheveux — sinon ils
  disparaissent sur les peaux foncées et sur les blonds.

### L'animation

`src/render/anim.js` tient un petit squelette par habitant. Chaque
articulation a une valeur courante qui **court après** sa valeur cible, à une
vitesse propre. Trois choses en découlent, sans être écrites nulle part :

- **Les changements de pose se fondent.** Passer de « dort » à « cuisine »
  prend une demi-seconde, pas une image.
- **Le mouvement secondaire est gratuit.** Les mains sont réglées à 18, la
  tête à 4,5 : la tête traîne donc systématiquement derrière le corps, ce qui
  donne du poids. Le buste se vrille d'après la vitesse réelle des bras.
- **L'écrasement suit la physique.** Le squash est calculé à partir de la
  vitesse verticale mesurée, pas d'une courbe scriptée.

Par-dessus, une couche vivante en permanence : clignements irréguliers
(plus rapides sous stress), coups d'œil spontanés, respiration, transfert de
poids d'une jambe sur l'autre, et une posture de repos différente pour
chaque habitant — personne ne se tient droit comme un i. Quand quelqu'un
parle, la bouche s'anime et les mains accompagnent.

Soixante poses couvrent les actions : marche à cycle complet (bras et
jambes opposés, double rebond), course avec les deux pieds en l'air au
passage, cuisiner, manger, boire, fumer, faire la vaisselle, repasser,
étendre le linge, jardiner, arroser, porter un carton, rentrer les courses,
soulever, bricoler, écrire, lire, pianoter, faire défiler son téléphone,
téléphoner, discuter avec les mains, écouter en hochant la tête, saluer,
applaudir, hausser les épaules, croiser les bras, pointer du doigt, frapper
à une porte, chercher quelque chose, s'accouder au balcon, danser, rire,
pleurer, embrasser, se battre en garde de boxeur, bouder, sursauter, tomber,
avoir peur, bercer, recompter ses sous, s'asseoir par terre, s'allonger,
se réveiller en bâillant, s'habiller à cloche-pied, conduire, se relever.

Une action ne donne pas une pose, elle donne une **famille** de poses : on
ne fait pas le ménage de la même façon si on repasse, si on fait la
vaisselle ou si on étend du linge. Le choix à l'intérieur d'une famille est
stable — dérivé de l'identifiant — pour qu'un habitant garde ses habitudes
au lieu de changer de geste toutes les cinq secondes. Les expansifs dansent
sur la musique, les autres hochent la tête ; un enfant joue par terre, un
adulte sur le canapé ; ruminer devient pleurer quand le moral tombe, et
recompter ses sous quand ce sont les dettes qui rongent.

`npm test` vérifie que les soixante sont **toutes atteignables** : une pose
qu'aucun état du monde ne déclenche est du code mort déguisé en
fonctionnalité.

Les poses « main au visage » ne sont pas réglées à l'estime : l'épaule et le
coude sont **résolus** pour que le poignet arrive devant la bouche ou à
l'oreille. Au jugé, le bras partait sur le côté et l'habitant téléphonait
dans le vide.

`npm test` vérifie tout ça hors navigateur : amplitude du cycle de marche,
opposition bras/jambes, fondu entre poses, retard de la tête sur la main, et
absence de divergence sur l'ensemble des poses.

Pour juger à l'œil, `tools/planche.html` sort une planche de contrôle —
visages en très gros plan, six habitants en pied, quarante silhouettes, les
douze expressions et toutes les poses. Lancez `npm start` et ouvrez
`/tools/planche.html` (on peut passer une graine : `?seed=quartier`).

### Aucun appartement n'en répète un autre

Tous les logements partageaient la même disposition : mêmes meubles, mêmes
places, dans le même ordre de gauche à droite. Seules les couleurs
changeaient, et au bout de cinq fenêtres on avait tout vu.

Chaque appartement tire maintenant son propre plan
(`src/render/interior-plan.js`), une fois pour toutes, à partir de son
identifiant — donc stable pendant la partie, et différent d'une partie à
l'autre : une disposition parmi cinq, un sens de lecture, des largeurs de
bandes inégales, des variantes de canapé, de lit, de table et de cuisine, un
meuble secondaire (bibliothèque, penderie, bureau, commode, buffet), un
papier peint et un type de décor mural.

Surtout, la pièce se remplit d'objets qui **appartiennent à ses habitants** :
la guitare du musicien, le chevalet de l'artiste, l'établi du bricoleur, les
jouets s'il y a des enfants, le berceau s'il y a un bébé, les cartons de
l'étudiant, les bouteilles de celui qui boit trop, le courrier qui s'entasse
chez celui qui a des dettes. On doit pouvoir deviner qui vit là sans lire la
fiche.

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
tools/                serveur statique, simulation sans écran, tests, planche graphique
assets/               images dessinées à la main, s'il y en a (facultatif)
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

## Mobile et ordinateur

Le même fichier, servi tel quel, se joue au doigt comme à la souris. Il n'y
a pas de version mobile : il y a **trois mises en page** que le jeu choisit
selon la place disponible.

| | Panneaux | Sortir d'un appartement |
|---|---|---|
| Ordinateur | fiche à droite, chronique en bas à gauche | Échap, clic hors de la pièce, ou « ‹ La façade » |
| Téléphone en portrait | feuilles qui remontent du bas | bouton « ‹ La façade », ou la croix |
| Téléphone en paysage | panneau latéral étroit | idem |

Le paysage mérite son propre traitement : un téléphone couché fait 390 px de
haut, et une feuille remontant du bas ne laisserait rien à la scène.

Trois détails qui décident si c'est jouable ou non :

- **La place occupée par l'interface est mesurée, pas devinée.** La hauteur
  d'une fiche dépend de son contenu ; en réservant un pourcentage fixe, le
  panneau finissait par couper les jambes des personnages. Le cadre de la
  pièce se calcule à partir des rectangles réels lus dans le DOM.
- **Un doigt ne survole pas.** Le liseré de survol et son suivi ne
  s'activent qu'au pointeur fin ; au tactile, on touche et on entre.
- **Sans clavier, il faut des boutons.** Échap et Espace n'existent pas sur
  téléphone : le retour à la façade est un vrai bouton, et les vitesses sont
  déjà cliquables. Sous 430 px on sacrifie la date et une vitesse
  intermédiaire — jamais l'heure ni la jauge de bonheur, qui est l'objectif.

Le jeu est aussi **installable** (manifeste + icône) : « Ajouter à l'écran
d'accueil » sur iOS, « Installer » sur Android et Chrome, et il s'ouvre en
plein écran sans barre de navigateur. La densité de pixels est plafonnée à
1,75 sur mobile — rendre en 3× serait joli et injouable.

Pour y jouer depuis un téléphone sur le même réseau que la machine qui sert
le jeu, `npm start` écoute sur toutes les interfaces : ouvrez
`http://<adresse-ip-de-la-machine>:8000`.

---

## Commandes

| | Ordinateur | Téléphone |
|---|---|---|
| Entrer dans un appartement | clic sur une fenêtre | toucher une fenêtre |
| Ressortir | Échap, ou clic hors de la pièce | « ‹ La façade », ou la croix |
| Pause | Espace | bouton ❚❚ |
| Vitesses | 1 2 3 4 | boutons ▶ |
| Fiche complète d'un habitant | clic sur le nom | toucher le nom |
| *Pourquoi c'est arrivé* | clic sur une ligne de chronique | idem |
| Chronique | toujours visible | bouton ☰ |
| Comment jouer | bouton ? | bouton ? |

Dans la console : `behind.avance(30)` fait passer trente jours d'un coup.
