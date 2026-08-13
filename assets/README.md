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
| **Poids** | **300 ko** par image, **1,4 Mo** pour une planche de personnage. Voir « Le fichier unique » plus bas : au-delà d'un certain total, `behind.html` ne peut plus tout embarquer. |
| **Nom** | exactement celui du tableau, en minuscules, sans accent. C'est le nom qui fait le branchement. |
| **Style** | Celui de la charte : animation urbaine française, trait d'encre sombre, aplats francs, couleurs chaudes et contrastées. **Création originale — ne reproduire directement aucune œuvre existante.** |

---

## Les habitants aussi sont des images

**Livrez une planche, elle remplace le pantin.** C'est la règle depuis la
bible : dès qu'une planche existe pour un gabarit et une animation, c'est
elle qui s'affiche, à l'image près, sans retouche du jeu — pas de teinte
appliquée, pas de recoloriage de tenue, pas de bras rapporté. Ce que le
dessinateur livre est ce qu'on voit.

Le dessin par code n'a pas disparu pour autant, et il ne faut pas qu'il
disparaisse : c'est lui qui tient les emplacements vides. Un immeuble a cent
trente habitants qui naissent, vieillissent, changent de tenue selon la
saison et portent quarante expressions ; tant que les 360 planches ne sont
pas toutes livrées, ce sont les gabarits manquants qui continuent d'être
animés par le code, et le raccord se fait sans un mot.

Concrètement, sur un même écran, un gabarit livré et un gabarit non livré
cohabitent. **Livrez donc par gabarit complet** (les soixante animations
d'un même gabarit) plutôt que par animation : un gabarit à moitié fait
passe du dessin à la planche en plein mouvement, et ça se voit.

## Le fichier unique, et sa limite

`npm run build` fabrique `behind.html` : un seul fichier, tout dedans, en
base64 — qui gonfle de 33 %. Ça marche très bien pour les décors, les
ambiances et les portraits.

**Les 360 planches de personnages n'y tiendront pas.** Comptez, en dessin
définitif, 300 ko à 1 Mo par planche : entre 100 et 350 Mo de PNG, donc
130 à 470 Mo de base64. Aucun navigateur n'ouvrira ça.

Il y a donc deux distributions, et c'est assumé :

| | Ce qu'elle contient | Pour qui |
|---|---|---|
| **Le dossier** (`npm start`, ou un hébergement) | tout, planches comprises | la vraie version |
| **`behind.html`** | décors, ambiances, portraits, expressions, usures — et les habitants dessinés par le code | à envoyer par mail, à ouvrir hors ligne |

`node tools/check-assets.js` affiche le total livré en mégaoctets et
signale ce qui dépasse le budget du fichier unique.

---

# Le catalogue complet — 651 emplacements

`node tools/check-assets.js` liste l'état de chacun. Ce qui suit est le
détail des sept familles.

## 1. Les quarante décors — `decors/` · 1600 × 900 · opaque

Le décor n'est pas choisi au hasard : il est **déduit** de qui habite là.
Un tatoueur a un atelier, un accumulateur a des cartons jusqu'au plafond,
un logement sans locataire a ses meubles sous un drap. `npm test` vérifie
que les quarante peuvent tous sortir sur un immeuble simulé — aucune image
ne serait payée pour n'être jamais vue.

| Fichier | Qui vit là |
|---|---|
| `vide.png` | Personne. Meubles sous des draps, volets mi-clos |
| `squat_alternatif.png` | Des gens sans un sou et couverts de dettes |
| `en_renovation.png` | Un bricoleur et un chantier qui dure |
| `airbnb_meuble.png` | Des inconnus arrivés il y a moins de trois semaines |
| `tatoueur.png` | Un artiste tatoué : table, flashs au mur, autoclave |
| `coiffeur.png` | Salon improvisé : bac, fauteuil, miroir professionnel |
| `musicien.png` | Instruments, ampli, mousse acoustique posée de travers |
| `cabinet_psychologue.png` | Cabinet à domicile : divan, bibliothèque, lumière douce |
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
| `plantes_partout.png` | Une jungle, et un passage étroit |
| `aquariums.png` | Plusieurs bacs, lumière bleue, filtres qui ronronnent |
| `appartement_religieux_oriental.png` | Images pieuses, napperons, ordre ancien |
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

Le jeu recadre le décor pour remplir la pièce, et il le recadre **sur cette
ligne**, pas sur le centre de l'image : le parquet dessiné tombe donc
toujours sous les pieds, quelle que soit la forme de l'appartement. Le
débordement se fait en haut, dans le plafond. Ne mettez rien d'important
dans les 8 % supérieurs de l'image.

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

## 6. Les trois cent soixante planches — `personnages/` · **transparent**

**Six gabarits × soixante animations.** C'est le gros de la commande, et
c'est la famille qui remplace le dessin par code.

| Gabarit | Qui | Taille à l'écran |
|---|---|---|
| `enfant` | moins de 12 ans | petit, tête proportionnellement grosse |
| `ado` | 12 à 19 ans | dégingandé, légèrement voûté |
| `homme` | homme, 20 à 49 ans | référence |
| `femme` | femme, 20 à 53 ans | référence |
| `mature` | 50 à 67 ans | épaissi, posture qui s'affaisse |
| `senior` | 68 ans et plus | tassé, appui plus large |

Nom de fichier : **`gabarit-animation.png`** — `homme-marcher.png`,
`senior-prier.png`, `enfant-danser.png`. Rien d'autre.

### La case, et la seule contrainte dure

Une planche est **une bande horizontale**, une image par case, de gauche à
droite :

```
┌────────┬────────┬────────┬────────┐   case : 256 × 384
│  img1  │  img2  │  img3  │  img4  │   personnage CENTRÉ horizontalement
│        │        │        │        │   PIEDS SUR LE BORD DU BAS
└────────┴────────┴────────┴────────┘   fond transparent
```

**Les pieds touchent le bord du bas.** C'est la règle qui ne se négocie
pas : le jeu pose le bas de la case sur la ligne de sol de la pièce. Si le
personnage flotte de dix pixels dans la case, il flottera de dix pixels dans
l'appartement — et ça ne se voit pas en regardant la planche, seulement en
jeu, sur tous les écrans à la fois.

Le personnage regarde **vers la droite**. Le jeu retourne l'image quand il
va vers la gauche ; ne livrez pas les deux sens.

La largeur totale doit être un multiple exact du nombre d'images. Une
planche à 300 px la case au lieu de 256 marche : le jeu découpe d'après la
largeur réelle du fichier, pas d'après la spécification.
`node tools/check-assets.js` refuse en revanche une largeur qui ne tombe pas
juste — le découpage tremblerait à chaque case.

### Les soixante animations

Le nombre d'images et la cadence sont ceux de la bible.
`node tools/check-assets.js` les rappelle emplacement par emplacement.

| # | | | |
|---|---|---|---|
| **Déplacements** | `marcher` 8·12 · `courir` 8·16 · `monter_escaliers` 8·10 · `descendre_escaliers` 8·10 | `s_asseoir` 6·10 · `se_lever` 6·10 | `se_pencher` 4·8 · `porter_objet` 6·10 |
| **Quotidien** | `cuisiner` 6·8 · `manger` 6·6 · `boire` 6·6 · `lire` 4·4 | `ecrire` 6·8 · `telephoner` 6·6 · `regarder_tele` 4·4 | `faire_menage` 6·8 · `faire_lessive` 6·8 · `bricoler` 6·10 · `arroser_plantes` 6·6 · `fumer` 6·5 |
| **Social** | `parler` 6·8 · `discuter_anime` 8·10 · `ecouter` 4·5 | `se_disputer` 8·12 · `se_reconcilier` 6·7 · `embrasser` 4·4 | `saluer` 6·10 · `faire_calin` 4·4 · `donner_objet` 5·8 · `recevoir_objet` 5·8 |
| **Loisirs** | `jouer_video` 6·8 · `jouer_guitare` 6·10 · `peindre` 6·7 · `dessiner` 6·8 | `faire_sport` 8·12 · `yoga` 4·3 · `danser` 8·12 | `ecouter_musique` 6·8 · `jardiner` 6·7 · `bricoler_creatif` 6·8 |
| **États** | `heureux` 4·5 · `triste` 4·4 · `en_colere` 6·12 · `fatigue` 4·4 | `stresse` 6·10 · `peur` 6·12 · `malade` 4·4 | `ivre` 6·6 · `amoureux` 4·5 · `deprime` 4·3 |
| **Spéciales** | `dormir` 4·3 · `se_reveiller` 6·8 · `se_coucher` 6·8 | `pleurer` 6·8 · `crise_de_rire` 6·12 · `prier` 4·3 | `surprise` 5·12 · `regarder_fenetre` 4·4 · `ecouter_porte` 4·4 · `feter` 8·12 |

*(lire « `marcher` 8·12 » : huit images, douze par seconde.)*

Toutes doivent **boucler proprement** sauf celles qui ont un début et une
fin — `s_asseoir`, `se_lever`, `se_coucher`, `se_reveiller`, `surprise`,
`donner_objet`, `recevoir_objet` — que le jeu joue en boucle lente le temps
que l'action dure.

`heureux` est la plus vue de toutes : c'est elle qui sert de repos quand un
habitant ne fait rien de particulier. Soignez-la avant les autres.

`npm test` vérifie que les soixante sont **réclamées par un état réel de la
simulation** : aucune planche ne serait payée pour n'être jamais jouée.

## 7. Les quarante expressions — `expressions/` · 512 × 512 · **transparent**

Un gros plan de visage par émotion, pour l'interface — la fiche d'un
habitant, un moment de chronique. Ce ne sont **pas** les visages des
planches d'animation : sur une planche, le visage est déjà dessiné dedans.

`neutre` · `heureuse` · `rire` · `fou_rire` · `amusee` · `euphorique` ·
`fiere` · `soulagee` · `attendrie` · `amoureuse` · `timide` ·
`nostalgique` · `songeuse` · `concentree` · `determinee` · `curieuse` ·
`confuse` · `douteuse` · `suspicieuse` · `ennui` · `surprise` · `choquee` ·
`irritee` · `colere` · `menace` · `mepris` · `degout` · `jalousie` ·
`triste` · `honteuse` · `resignee` · `inquiete` · `stressee` · `peur` ·
`panique` · `fatiguee` · `assoupie` · `endormie` · `malade` · `ivre`

Même cadrage pour toutes les quarante : c'est la comparaison entre elles qui
fait l'expression, pas chaque image prise seule.
