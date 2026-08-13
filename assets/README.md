# Les images

**Ce dossier peut rester vide.** Behind tourne entièrement sur son dessin
procédural : chaque emplacement non rempli retombe dessus, silencieusement.
On peut livrer une seule image et voir la différence sur un seul écran.

```
node tools/check-assets.js   # ce qui est là, ce qui manque
npm run build                # embarque tout dans behind.html
```

Il n'y a rien d'autre à faire. Poser un fichier au bon nom suffit.

---

## Les règles qui valent pour tout

| | |
|---|---|
| **Format** | `.png` (ou `.webp`, mieux compressé). Les deux marchent. |
| **Poids** | **300 ko maximum par image.** Tout finit en base64 dans `behind.html`, et le base64 gonfle de 33 %. |
| **Nom** | exactement celui du tableau, en minuscules, sans accent. C'est le nom qui fait le branchement. |
| **Style** | Celui de la charte : animation urbaine française, trait d'encre sombre, aplats francs, couleurs chaudes et contrastées. **Création originale — ne reproduire directement aucune œuvre existante.** |

---

## 1. Les douze décors — `decors/`

**C'est de loin le meilleur rapport qualité / effort.** Douze images, et
tout l'intérieur du jeu change de visage. Les habitants continuent d'être
dessinés par-dessus : ils bougent, le décor non.

`1600 × 900`, opaque (pas de transparence).

### La contrainte qui compte

L'appartement est vu **en coupe**, comme une maison de poupée : mur retiré,
caméra bien en face, aucune perspective de fuite.

```
┌──────────────────────────────────────┐  ← haut de l'image
│                                      │
│   le mur, les meubles, la fenêtre    │
│                                      │
│ ─────────────────────────────────────│  ← LE SOL est ici, à 86 % de la hauteur
│   plinthe / parquet                  │     (1600 × 900 → y = 774 px)
└──────────────────────────────────────┘
```

**Les pieds des habitants se posent sur cette ligne.** Si elle est ailleurs,
tout le monde flotte ou s'enfonce. C'est la seule contrainte vraiment dure
de tout le dossier.

Deux autres, plus souples :
- **aucun personnage** dans l'image — le jeu les ajoute ;
- **lumière neutre, plutôt jour** : le jeu repose lui-même la nuit, la lampe
  allumée et le clignotement de la télé par-dessus.

### La liste

| Fichier | Ce que la pièce raconte |
|---|---|
| `studio_etudiant.png` | Une pièce, un lit, des cartons jamais défaits, des livres en pile |
| `salon_familial.png` | Canapé fatigué, jouets par terre, panier de linge |
| `cuisine_populaire.png` | Grande cuisine qui sert de salon, casseroles, épices, table centrale |
| `chambre_ado.png` | Affiches, ampli, skate, lit défait, désordre revendiqué |
| `couple.png` | Rangé, deux tasses, un bouquet, sans enfant |
| `retraite.png` | Napperons, buffet, tricot, photos encadrées, télé imposante |
| `gamer.png` | Double écran, bandeau LED, manettes, rideaux fermés |
| `artiste.png` | Chevalet, toiles retournées contre le mur, pots de peinture |
| `colocation.png` | Meubles dépareillés, bouteilles, tas de chaussures à l'entrée |
| `bureau_domicile.png` | Bureau sérieux, imprimante, chaise correcte, plante |
| `sport_maison.png` | Vélo d'appartement, haltères, tapis de yoga, miroir |
| `vide.png` | Personne n'habite là : meubles sous des draps, volets mi-clos |

---

## 2. Les six ambiances — `ambiances/`

Le fond derrière l'immeuble : le ciel et le quartier. `1920 × 1080`, opaque.

L'immeuble est dessiné **par-dessus, au centre**, sur environ 90 % de la
largeur — donc le milieu de l'image sera caché. Ce qui compte, c'est le
ciel en haut et les côtés.

| Fichier | Moment |
|---|---|
| `nuit.png` | Nuit calme. Ciel profond, quelques fenêtres lointaines. |
| `soiree.png` | Début de soirée, lumières chaudes qui s'allument. |
| `aube.png` | Aube, rose et bleu, rue encore vide. |
| `pluie.png` | Jour pluvieux, gris lavé. (Sert aussi pour la neige.) |
| `canicule.png` | Lumière blanche écrasante, ciel délavé. |
| `hiver.png` | Ciel bas, froid, sans soleil. |

En plein jour ordinaire, aucune image n'est utilisée : le ciel dégradé du
jeu suffit, et il suit l'heure minute par minute.

---

## 3. Les trente-six portraits — `portraits/`

Le visage d'un habitant dans sa fiche, quand on clique sur son nom.

`512 × 512`, **fond transparent**, cadrage buste (épaules comprises), regard
vers le joueur ou légèrement de trois quarts.

**Ce ne sont pas des personnages nommés, c'est une troupe.** Chaque habitant
se voit attribuer un comédien de son gabarit, une fois pour toutes, et le
garde toute la partie. Six comédiens par gabarit suffisent : on n'ouvre
qu'une fiche à la fois.

| Gabarit | Fichiers | Qui |
|---|---|---|
| `enfant-01` … `-06` | 6 | moins de 12 ans |
| `ado-01` … `-06` | 6 | 12 à 19 ans |
| `homme-01` … `-06` | 6 | homme, 20 à 49 ans |
| `femme-01` … `-06` | 6 | femme, 20 à 53 ans |
| `mature-01` … `-06` | 6 | 50 à 67 ans |
| `senior-01` … `-06` | 6 | 68 ans et plus |

Variez les carnations, les coiffures et les tenues à l'intérieur de chaque
gabarit : c'est un immeuble de quartier populaire, pas un catalogue.

Un gabarit incomplet fonctionne : s'il n'y a que deux portraits d'enfant,
les enfants se les partagent, et les autres gabarits gardent leur dessin.

---

## Ce qui ne peut PAS être remplacé par une image

Les habitants **dans** l'appartement restent dessinés par le code, et ce
n'est pas un choix d'économie.

Ils marchent, se retournent, s'assoient, se couchent, vieillissent, changent
de tenue selon la saison, portent douze expressions, et il y en a cent
trente qui naissent, déménagent et meurent pendant la partie. Les figer en
images demanderait, pour chaque comédien, une planche par pose × par
direction × par tenue — et il n'y aurait toujours pas de vieillissement.

Le compromis retenu est celui-ci : **décor peint, habitants animés.** C'est
exactement la répartition d'un film d'animation.
