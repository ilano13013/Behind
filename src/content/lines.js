// Le texte de l'immeuble.
//
// Bulles de dialogue, formulations d'évènements, déformations de rumeurs.
// Tout est écrit en gabarits : {a} l'acteur, {b} la cible, {x} un détail.
// C'est ici que vit l'humour, mais aussi les moments graves — l'immeuble
// doit pouvoir passer de la vanne au silence en une seconde.

export const SPEECH = {
  dormir: ['Zzz…', 'mmh…', '…encore cinq minutes', 'Zzz… non… pas le formulaire…', '…pas les impôts…', '…la porte… j\'ai fermé la porte ?', 'Zzz… non, pas le 4e…', 'mmh… deux minutes'],
  reveil: ['Déjà ?', 'Non.', 'Il est quelle heure là', 'J\'ai dormi 20 minutes.', 'Qui a inventé le lundi'],
  manger: ['Miam', 'C\'est froid.', 'Je mange sain à partir de demain', 'Encore des pâtes', 'Y\'a plus de pain', 'Ça se mange encore ça ?', 'Debout devant le frigo, comme un roi', 'Y\'a que du fromage'],
  cuisiner: ['Ça va être bon ça', 'J\'improvise', 'C\'est pas censé fumer', 'Recette de mamie', 'Bon. C\'est carbonisé.', 'J\'ai mis quoi déjà ?', 'On verra bien', 'Ça sent bon quand même', 'Bon. On commande.'],
  douche: ['♪♪♪', 'L\'eau est glacée', 'Y\'a jamais de pression', 'Je chante pas fort quand même', 'Encore une coupure'],
  tv: ['Mais bien sûr…', 'Il va se faire avoir', 'Rediffusion. Encore.', 'C\'était mieux avant', 'Chut, ça commence', 'Encore lui', 'C\'est quoi ce programme', 'Je dormais pas, je réfléchissais', 'Trois chaînes, rien à voir'],
  musique: ['♪', '♫', 'Cette basse !', 'Je baisse dans dix minutes', '♪ ♫ ♪', 'C\'est pas si fort'],
  menage: ['Ça se voit que je viens de faire ?', 'D\'où vient cette chaussette', 'Trois heures pour ça', 'Bon, j\'ai poussé sous le lit', 'Qui met du sable ici', 'Ça sert à rien, ça revient', 'Et voilà, cassé'],
  travail: ['Encore un mail', 'Je réponds demain', 'Ils sont sérieux ?', 'Bon. Je m\'y mets.', 'Réunion pour dire qu\'on refera une réunion', 'Je réponds lundi', 'C\'était urgent hier'],
  ennui: ['Bon.', '…', 'Il se passe rien', 'Je vais regarder par la fenêtre', 'J\'ai fini internet', 'Bon…', 'Faudrait que je fasse un truc', 'Je vais ranger. Bientôt.', 'Il pleut, tiens', 'Rien du tout'],
  telephone: ['Ouiii je sais', 'Maman je te rappelle', 'Non j\'ai pas oublié', 'Allô ? Allô ? Je te perds', 'C\'est une arnaque, encore', 'Oui maman', 'Non j\'ai mangé', 'Je te rappelle, quelqu\'un sonne', 'Ça capte mal chez moi'],
  lecture: ['Deux pages, et je dors', 'Ah quand même', 'Je relis la même ligne', 'Qui est ce personnage déjà'],
  sport: ['Trois. Quatre. …Trois.', 'Demain j\'y retourne', 'Ça compte les escaliers ?', 'Ça brûle'],
  jeu: ['NON !', 'C\'était pas moi', 'Dernière partie', 'Dernière partie (2)', 'Cette manette est cassée', 'Non mais NON', 'Une dernière', 'Une dernière (3)', 'C\'est la manette'],
  fete: ['SANTÉ !', 'On baisse un peu ?', 'Qui a invité lui ?', 'Il est 3h ?!', 'Le voisin va monter'],
  invite: ['Entre, entre', 'Excuse le bazar', 'T\'as mangé ?', 'Assieds-toi, pas là, la chaise est cassée'],
  flirt: ['…', 'Tu fais quoi ce soir ?', 'J\'ai pensé à toi', 'C\'est bête, hein', 'Tu veux monter ?'],
  dispute: ['Non mais VAS-Y', 'C\'est toujours pareil', 'Je rêve', 'Baisse d\'un ton', 'Trente ans que ça dure'],
  plainte: ['IL EST MINUIT !', 'Y\'a des gens qui travaillent !', 'Je monte, moi', 'C\'est la dernière fois'],
  espionnage: ['Tiens tiens…', 'Il rentre à cette heure-là', 'Je regarde pas, je passais', 'Elle a changé de voiture', 'À cette heure-ci…', 'Je passais, hein', 'Encore un colis, elle'],
  bricolage: ['Je vais juste resserrer un truc', 'C\'était pas censé faire ça', 'Bon. Faut couper l\'eau.', 'Presque'],
  betise: ['C\'est pas moi', 'C\'était déjà comme ça', 'Le chat l\'a fait', 'Je testais', 'Ça part au lavage non ?'],
  excuse_ado: ['Y\'avait grève', 'Mon tel était mort', 'On révisait', 'C\'est ma prof qui m\'a agressé', 'Je te jure sur ma vie'],
  triste: ['…', 'Ça va aller', 'C\'est rien', 'Je suis fatigué c\'est tout', 'Je suis juste fatigué', 'Ça passera'],
  stresse: ['Ça va, ça va, ça va', 'Faut que je réfléchisse', 'Je gère.', 'Je gère pas.', 'Ça va aller. Ça va aller.', 'Je gère pas du tout', 'Demain je m\'en occupe'],
  heureux: ['Belle journée', '♪', 'Franchement, ça va', 'J\'ai bien fait de rester', 'Belle lumière aujourd\'hui', 'Tiens, le chat est revenu'],
  bebe: ['OUIN', 'OUIIIN', 'areuh', 'OUIN OUIN', '…', 'AREUH'],
  vieux: ['De mon temps…', 'Le quartier a changé', 'J\'ai connu ça vide, ici', 'Faut que je m\'assoie'],
  barbecue: ['Un mètre carré, ça suffit', 'Fenêtres fermées les gars !', 'C\'est de la fumée aromatique', 'Le syndic peut rien dire'],
  chat: ['Miaou', '…', 'Le chat me juge', 'Il a encore renversé la plante'],
  malade: ['Ça va passer', 'Je tousse depuis mardi', 'C\'est juste un coup de froid', 'Je vais m\'allonger'],
  argent: ['Faut que ça tienne jusqu\'au 30', 'Les pâtes, encore les pâtes', 'Je compte pas, ça déprime', 'Ah. Découvert.'],
};

/** Petits gags de fond visibles depuis la façade. */
export const FACADE_GAGS = [
  'un slip oublié sur le fil du 4e',
  'une plante qui a clairement renoncé',
  'un vélo accroché à un balcon d\'un mètre carré',
  'une guirlande de Noël encore allumée en juillet',
  'trois paraboles pointées dans trois directions différentes',
  'un carton « À DONNER » qui n\'intéresse personne depuis six mois',
  'un chat qui surveille la rue comme un vigile',
  'un panneau « INTERDIT DE JOUER AU BALLON » criblé de traces de ballon',
];

/** Formulations des évènements de la chronique. */
export const BEAT = {
  'romance.regard': ['{a} et {b} se sont croisés dans l\'escalier. Personne n\'a rien dit. Ça compte quand même.'],
  'romance.flirt': ['{a} a trouvé un prétexte très transparent pour parler à {b}.'],
  'romance.couple': ['{a} et {b} sont ensemble. Tout l\'immeuble le savait avant eux.'],
  'romance.mariage': ['{a} et {b} se sont mariés. Le buffet était dans la cour.'],
  'romance.rupture': ['{a} et {b}, c\'est fini. Les cartons descendent déjà.'],
  'romance.infidelite': ['{a} a fait une bêtise. {b} ne le sait pas encore.'],
  'famille.naissance': ['{a} est né. L\'immeuble ne dormira plus avant deux ans.'],
  'famille.dispute': ['Ça hurle chez {a}. On entend tout depuis le palier.'],
  'famille.reconciliation': ['{a} et {b} se sont reparlé. Ça a pris le temps que ça a pris.'],
  'travail.promotion': ['{a} a été promu. Il essaie de ne pas trop le montrer. Il le montre.'],
  'travail.licenciement': ['{a} a perdu son travail.'],
  'travail.embauche': ['{a} a retrouvé du travail. Enfin.'],
  'argent.crise': ['{a} ne s\'en sort plus. Le courrier s\'entasse près de la porte.'],
  'sante.maladie': ['{a} ne va pas bien. Il dit que ça va.'],
  'sante.mort': ['{a} s\'est éteint. La lumière du {x} restera éteinte un moment.'],
  'voisinage.bruit': ['{b} est monté chez {a}. Il est minuit passé.'],
  'voisinage.conflit': ['{a} et {b} ne se saluent plus.'],
  'voisinage.entraide': ['{a} a dépanné {b}. Sans le dire à personne.'],
  'fete.debut': ['Il y a du monde chez {a}. Ça commence bien.'],
  'fete.derapage': ['La fête chez {a} a dérapé. Quelqu\'un dort dans l\'escalier.'],
  'secret.rumeur': ['On raconte dans l\'immeuble que {x}.'],
};

/**
 * Déformations de rumeurs.
 * Quand un habitant répète ce qu'il croit savoir, la phrase se dégrade.
 * C'est le générateur de quiproquos de l'immeuble : au bout de quatre
 * paliers, un plombier devient un amant.
 */
export const RUMOUR_DISTORTIONS = [
  { from: /a reçu la visite d'un plombier/, to: 'reçoit quelqu\'un en cachette' },
  { from: /reçoit quelqu'un en cachette/, to: 'a un amant' },
  { from: /a un amant/, to: 'va divorcer' },
  { from: /va divorcer/, to: 'déménage en secret' },
  { from: /a perdu son travail/, to: 'ne paie plus son loyer' },
  { from: /ne paie plus son loyer/, to: 'va se faire expulser' },
  { from: /a rangé son appartement/, to: 'vend son appartement' },
  { from: /vend son appartement/, to: 'part à l\'étranger' },
  { from: /s'est disputé avec sa mère/, to: 'est brouillé avec toute sa famille' },
  { from: /a acheté beaucoup de courses/, to: 'stocke pour la fin du monde' },
  { from: /est rentré très tard/, to: 'a des fréquentations douteuses' },
  { from: /a des fréquentations douteuses/, to: 'est recherché par la police' },
  { from: /a pleuré dans l'escalier/, to: 'traverse un drame' },
  { from: /a une nouvelle plante/, to: 'fait pousser des choses illégales' },
];

export function distortRumour(text, rng) {
  for (const d of RUMOUR_DISTORTIONS) {
    if (d.from.test(text)) return text.replace(d.from, d.to);
  }
  // Sinon on ajoute juste une couche de certitude non méritée.
  const amp = ['et c\'est confirmé', 'tout le monde le sait', 'je tiens ça de source sûre',
    'mais faut pas le répéter', 'la gardienne l\'a dit'];
  return rng.chance(0.5) ? `${text}, ${rng.pick(amp)}` : text;
}

/** Petites nouvelles anodines qui alimentent les commérages. */
export const GOSSIP_SEEDS = [
  'a reçu la visite d\'un plombier',
  'a rangé son appartement',
  'est rentré très tard',
  'a acheté beaucoup de courses',
  'a une nouvelle plante',
  'a repeint son couloir',
  'a changé de coiffure',
  'a refusé de dire bonjour ce matin',
];

export function fill(tpl, vars) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}

export function beatText(kind, vars, rng) {
  const pool = BEAT[kind];
  if (!pool) return null;
  return fill(rng ? rng.pick(pool) : pool[0], vars);
}

export function speech(kind, rng) {
  const pool = SPEECH[kind];
  if (!pool) return null;
  return rng.pick(pool);
}
