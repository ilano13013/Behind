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

## Ce qui ne peut PAS être remplacé par une image

Les habitants **dans** l'appartement restent dessinés par le code, et ce
n'est pas un choix d'économie.

Ils marchent, se retournent, s'assoient, se couchent, vieillissent, changent
de tenue selon la saison, portent quarante expressions, et il y en a cent
trente qui naissent, déménagent et meurent pendant la partie. Les figer en
images demanderait, pour chaque comédien, une planche par pose × par
direction × par tenue — et il n'y aurait toujours pas de vieillissement.

Le compromis retenu est celui-ci : **décor peint, habitants animés.** C'est
exactement la répartition d'un film d'animation.

---

# Le catalogue complet — 251 emplacements

`node tools/check-assets.js` liste l'état de chacun. Ce qui suit est le
détail des cinq familles.

## 1. Les quarante décors — `decors/` · 1600 × 900 · opaque

Le décor n'est pas choisi au hasard : il est **déduit** de qui habite là.
Un tatoueur a un atelier, un accumulateur a des cartons jusqu'au plafond,
un logement sans locataire a ses meubles sous un drap. `npm test` vérifie
que les quarante peuvent tous sortir sur un immeuble simulé — aucune image
ne serait payée pour n'être jamais vue.

| Fichier | Qui vit là |
|---|---|
| `vide.png` | Personne. Meubles sous des draps, volets mi-clos |
| `squat.png` | Des gens sans un sou et couverts de dettes |
| `en_renovation.png` | Un bricoleur et un chantier qui dure |
| `airbnb.png` | Des inconnus arrivés il y a moins de trois semaines |
| `tatoueur.png` | Un artiste tatoué : table, flashs au mur, autoclave |
| `coiffeur.png` | Salon improvisé : bac, fauteuil, miroir professionnel |
| `musicien.png` | Instruments, ampli, mousse acoustique posée de travers |
| `psychologue.png` | Cabinet à domicile : divan, bibliothèque, lumière douce |
| `militaire.png` | Rangé au cordeau, lit au carré, malles |
| `artiste.png` | Chevalet, toiles retournées, pots de peinture |
| `bureau_domicile.png` | Bureau sérieux, imprimante, chaise correcte |
| `couple_toxique.png` | Deux vies qui cohabitent mal : deux camps dans la pièce |
| `famille_recomposee.png` | Un enfant, un adulte qui n'est pas son parent |
| `etudiant_erasmus.png` | Valises encore là, drapeau, cartes postales |
| `studio_etudiant.png` | Une pièce, un lit, des cartons jamais défaits |
| `jeune_parent.png` | Berceau, tapis d'éveil, linge partout |
| `colocation.png` | Meubles dépareillés, tas de chaussures à l'entrée |
| `fete_permanente.png` | Ça ne s'arrête jamais : bouteilles, guirlandes, enceinte |
| `accumulateur.png` | On ne voit plus le sol |
| `ultra_propre.png` | Rien ne dépasse. Rien du tout |
| `minimaliste.png` | Trois objets, choisis |
| `collectionneur.png` | Vitrines, séries complètes, étiquettes |
| `rempli_de_plantes.png` | Une jungle, et un passage étroit |
| `aquariums.png` | Plusieurs bacs, lumière bleue, filtres qui ronronnent |
| `tres_religieux.png` | Images pieuses, napperons, ordre ancien |
| `boheme.png` | Tapis au mur, coussins par terre, tentures |
| `brocante.png` | Rien n'a été acheté neuf |
| `fan_de_foot.png` | Écharpes, écran géant, canapé face au match |
| `fan_de_mangas.png` | Figurines, murs d'affiches, étagères de tomes |
| `gamer.png` | Double écran, bandeau LED, rideaux fermés |
| `influenceur.png` | Anneau lumineux, fond neutre, désordre hors cadre |
| `ancien_boxeur.png` | Sac de frappe, coupes, photos jaunies |
| `sport_maison.png` | Vélo d'appartement, haltères, tapis, miroir |
| `chambre_ado.png` | Affiches, ampli, skate, lit défait |
| `retraite.png` | Napperons, buffet, tricot, télé imposante |
| `cuisine_populaire.png` | Grande cuisine qui sert de salon, table centrale |
| `salon_familial.png` | Canapé fatigué, jouets, panier de linge |
| `couple.png` | Rangé, deux tasses, un bouquet |
| `micro_appartement.png` | Neuf mètres carrés, tout est plié |
| `loft_industriel.png` | Volume, verrière, poutres apparentes |

**La ligne de sol est à 86 % de la hauteur** (y = 774 px sur 900). Les
pieds des habitants s'y posent. C'est la seule contrainte dure.

## 2. Les vingt-cinq ambiances — `ambiances/` · 1920 × 1080 · opaque

L'ordre de priorité du jeu : ce qui frappe l'immeuble l'emporte sur ce
qu'il traverse — une panne de courant avant une fête, une fête avant la
météo, la météo avant l'heure.

`jour_clair` · `soiree` · `nuit` · `aube` · `coucher_soleil` · `pluie` ·
`orage` · `neige` · `petite_neige` · `brouillard` · `canicule` ·
`grand_froid` · `vent_fort` · `tempete` · `pollution` · `arc_en_ciel` ·
`coupure_courant` · `pleine_lune` · `feu_artifice` · `noel` · `halloween` ·
`nouvel_an` · `printemps` · `automne` · `apocalyptique`

L'immeuble est dessiné **par-dessus, au centre**, sur ~90 % de la largeur :
le milieu sera caché. Ce qui compte, c'est le ciel et les côtés.

Trois sont volontairement rares : `tempete`, `coupure_courant`,
`apocalyptique`. Ce dernier arrive une fois par décennie environ, sans
explication, et personne n'en reparle le lendemain.

## 3. Les cent soixante-dix portraits — `portraits/` · 512 × 512 · **transparent**

Une troupe, pas des personnages nommés. Chaque habitant se voit attribuer
un comédien de son gabarit, une fois pour toutes.

| Gabarit | Fichiers | Qui |
|---|---|---|
| `enfant-01` … `-20` | 20 | moins de 12 ans |
| `ado-01` … `-20` | 20 | 12 à 19 ans |
| `homme-01` … `-40` | 40 | homme, 20 à 49 ans |
| `femme-01` … `-40` | 40 | femme, 20 à 53 ans |
| `mature-01` … `-25` | 25 | 50 à 67 ans |
| `senior-01` … `-25` | 25 | 68 ans et plus |

Cadrage buste, épaules comprises, regard vers le joueur ou de trois quarts.
Un gabarit incomplet marche : avec deux portraits d'enfant, les enfants se
les partagent.

## 4. Les dix commerces — `commerces/` · 1600 × 900 · opaque

Le rez-de-chaussée. Chaque immeuble tire le sien à la génération, et on
peut y entrer comme dans un appartement.

`cafe` · `pharmacie` · `boulangerie` · `tabac` · `salon_coiffure` ·
`laverie` · `salle_de_sport` · `supermarche` · `ecole` · `bibliotheque`

Mêmes règles que les décors, **ligne de sol à 86 %** comprise.

## 5. Les six usures — `batiment/` · 1920 × 1080 · **transparent**

`0ans` · `5ans` · `15ans` · `25ans` · `40ans` · `60ans`

**Ce ne sont pas des façades**, ce sont des **calques de traces** : taches,
coulures sous les appuis, fissures, mousse, peinture qui cloque. La
géométrie de l'immeuble est tirée au sort à chaque partie — étages,
colonnes, largeur — donc une façade peinte en entier ne tomberait jamais en
face. Le calque, lui, se pose sur n'importe quelle maçonnerie.

`0ans` peut rester vide : un immeuble ravalé de la veille n'a pas de trace.

L'immeuble commence la partie avec un âge tiré au sort entre 0 et 45 ans,
puis vieillit avec elle.
