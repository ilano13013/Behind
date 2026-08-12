// Noms de l'immeuble.
// Un quartier populaire français : plusieurs générations, plusieurs origines,
// et des prénoms qui datent visiblement leur porteur.

export const FIRST_NAMES_F = {
  ancien: ['Simone', 'Huguette', 'Georgette', 'Paulette', 'Yvette', 'Micheline', 'Suzanne', 'Odette', 'Denise', 'Colette', 'Renée', 'Jacqueline', 'Josette', 'Lucienne'],
  boomer: ['Martine', 'Chantal', 'Brigitte', 'Nicole', 'Catherine', 'Dominique', 'Véronique', 'Sylvie', 'Patricia', 'Corinne', 'Nadia', 'Fatima', 'Maria', 'Danielle'],
  milieu: ['Sandrine', 'Céline', 'Nathalie', 'Karine', 'Aurélie', 'Émilie', 'Julie', 'Delphine', 'Samira', 'Leïla', 'Yamina', 'Sonia', 'Isabelle', 'Christelle'],
  jeune: ['Manon', 'Camille', 'Inès', 'Sarah', 'Chloé', 'Léa', 'Amina', 'Fatou', 'Yasmine', 'Océane', 'Jade', 'Louise', 'Maëva', 'Assia', 'Alice', 'Rania'],
  enfant: ['Lina', 'Emma', 'Jade', 'Alba', 'Nour', 'Rose', 'Anna', 'Zoé', 'Maya', 'Lou', 'Aya', 'Iris', 'Naïa', 'Mila'],
};

export const FIRST_NAMES_M = {
  ancien: ['Marcel', 'René', 'Roger', 'Raymond', 'Gilbert', 'Lucien', 'Maurice', 'André', 'Robert', 'Henri', 'Fernand', 'Albert', 'Gaston'],
  boomer: ['Gérard', 'Patrick', 'Michel', 'Alain', 'Bernard', 'Daniel', 'Jean-Claude', 'Christian', 'Mohamed', 'Antonio', 'Serge', 'Didier', 'Francis'],
  milieu: ['Stéphane', 'Sébastien', 'Fabrice', 'Laurent', 'Karim', 'Youssef', 'Bruno', 'Franck', 'Olivier', 'Cédric', 'Rachid', 'Manuel', 'Thierry'],
  jeune: ['Kylian', 'Théo', 'Enzo', 'Mehdi', 'Ibrahim', 'Lucas', 'Nathan', 'Sofiane', 'Bilal', 'Antoine', 'Maxime', 'Yanis', 'Léo', 'Gabriel', 'Amine'],
  enfant: ['Noé', 'Adam', 'Élio', 'Ayoub', 'Timéo', 'Sacha', 'Malo', 'Marius', 'Ilyes', 'Naël', 'Gaspard', 'Aaron'],
};

export const FIRST_NAMES_NB = {
  jeune: ['Sacha', 'Camille', 'Charlie', 'Alix', 'Andréa', 'Maxence', 'Swann', 'Louison'],
};

export const SURNAMES = [
  'Boulanger', 'Mercier', 'Nkoulou', 'Benali', 'Torres', 'Lefèvre', 'Da Silva', 'Kaczmarek',
  'Ouedraogo', 'Petit', 'Marchand', 'Nguyen', 'Ferrand', 'Bouziane', 'Kowalski', 'Rossi',
  'Diallo', 'Lambert', 'Ferreira', 'Chevalier', 'Barbosa', 'Traoré', 'Roussel', 'Vidal',
  'Papadopoulos', 'Ben Salah', 'Marchetti', 'Guérin', 'Cissé', 'Fontaine', 'Delaunay',
  'Sanchez', 'Hoarau', 'Grosjean', 'Camara', 'Leroy', 'Andrade', 'Zerbib', 'Mbaye', 'Pichon',
  'Colombo', 'Berthier', 'Sissoko', 'Vasseur', 'Amrani', 'Tanguy', 'Lorenzi', 'Doucet',
];

export const NICKNAME_SUFFIX = [
  'du 3e', 'des poubelles', 'la Sirène', 'Deux-Voitures', 'Radio-Palier', 'Ciseaux',
  'le Ministre', 'Grand-Pied', 'la Perceuse', 'Trois-Chats', 'Bon-Pied', 'Micro-Ondes',
];

const GENERATION_BOUNDS = [
  { key: 'enfant', max: 14 },
  { key: 'jeune', max: 34 },
  { key: 'milieu', max: 52 },
  { key: 'boomer', max: 70 },
  { key: 'ancien', max: 200 },
];

export function generationFor(age) {
  for (const g of GENERATION_BOUNDS) if (age <= g.max) return g.key;
  return 'ancien';
}

export function pickFirstName(rng, gender, age, taken = new Set()) {
  const gen = generationFor(age);
  let pool;
  if (gender === 'f') pool = FIRST_NAMES_F[gen] ?? FIRST_NAMES_F.milieu;
  else if (gender === 'm') pool = FIRST_NAMES_M[gen] ?? FIRST_NAMES_M.milieu;
  else pool = FIRST_NAMES_NB.jeune;

  // On évite les doublons tant que c'est possible : un immeuble avec trois
  // Kylian est drôle une fois, pas trente.
  const free = pool.filter((n) => !taken.has(n));
  return (free.length ? free : pool)[Math.floor(rng.next() * (free.length ? free.length : pool.length))];
}

export function pickSurname(rng) {
  return rng.pick(SURNAMES);
}
