// Métiers, horaires et argent.
//
// Le métier détermine les horaires, donc les fenêtres allumées, donc
// qui croise qui dans l'escalier. C'est une des sources principales
// d'histoires : deux personnes qui ne se croisent jamais ne tombent
// jamais amoureuses.

/**
 * schedule: [heureDébut, heureFin] ; nightShift inverse la journée.
 * prestige 0..1 influe sur l'ego, stress 0..1 sur l'usure nerveuse.
 */
// label = masculin, labelF = féminin, labelN = forme inclusive.
// On accorde les métiers : « Martine a perdu son poste de mécanicien » est
// exactement le genre de détail qui casse l'illusion.
export const JOBS = [
  { id: 'caissier', label: 'caissier', labelF: 'caissière', labelN: 'caissier·ère', pay: 1450, schedule: [9, 18], stress: 0.55, prestige: 0.2, weekend: true },
  { id: 'infirmier', label: 'infirmier', labelF: 'infirmière', labelN: 'infirmier·ère', pay: 2100, schedule: [7, 19], stress: 0.85, prestige: 0.6, weekend: true, shifts: true },
  { id: 'prof', label: 'professeur', labelF: 'professeure', labelN: 'professeur·e', pay: 2200, schedule: [8, 17], stress: 0.6, prestige: 0.6 },
  { id: 'boulanger', label: 'boulanger', labelF: 'boulangère', labelN: 'boulanger·ère', pay: 1900, schedule: [4, 13], stress: 0.5, prestige: 0.4, weekend: true },
  { id: 'chauffeur', label: 'chauffeur VTC', labelF: 'chauffeuse VTC', labelN: 'chauffeur·se VTC', pay: 1700, schedule: [14, 2], stress: 0.6, prestige: 0.25, weekend: true },
  { id: 'developpeur', label: 'développeur', labelF: 'développeuse', labelN: 'développeur·se', pay: 3200, schedule: [10, 19], stress: 0.45, prestige: 0.65, remote: true },
  { id: 'comptable', label: 'comptable', pay: 2400, schedule: [9, 18], stress: 0.4, prestige: 0.45 },
  { id: 'serveur', label: 'serveur', labelF: 'serveuse', labelN: 'serveur·se', pay: 1500, schedule: [17, 1], stress: 0.65, prestige: 0.2, weekend: true },
  { id: 'artiste', label: 'artiste', pay: 900, schedule: [13, 23], stress: 0.5, prestige: 0.5, remote: true, precarious: true },
  { id: 'musicien', label: 'musicien', labelF: 'musicienne', labelN: 'musicien·ne', pay: 1100, schedule: [15, 1], stress: 0.45, prestige: 0.45, remote: true, precarious: true, noisy: true },
  { id: 'agent_secu', label: 'agent de sécurité', labelF: 'agente de sécurité', labelN: 'agent·e de sécurité', pay: 1650, schedule: [21, 6], stress: 0.5, prestige: 0.25, nightShift: true, weekend: true },
  { id: 'menage', label: 'agent d\'entretien', labelF: 'agente d\'entretien', labelN: 'agent·e d\'entretien', pay: 1350, schedule: [5, 12], stress: 0.6, prestige: 0.15 },
  { id: 'coiffeur', label: 'coiffeur', labelF: 'coiffeuse', labelN: 'coiffeur·se', pay: 1600, schedule: [9, 19], stress: 0.4, prestige: 0.3, weekend: true },
  { id: 'plombier', label: 'plombier', labelF: 'plombière', labelN: 'plombier·ère', pay: 2300, schedule: [7, 17], stress: 0.5, prestige: 0.4, noisy: true },
  { id: 'livreur', label: 'livreur', labelF: 'livreuse', labelN: 'livreur·se', pay: 1400, schedule: [11, 22], stress: 0.7, prestige: 0.15, weekend: true, precarious: true },
  { id: 'cadre', label: 'cadre', pay: 3800, schedule: [8, 20], stress: 0.8, prestige: 0.8 },
  { id: 'vendeur', label: 'vendeur', labelF: 'vendeuse', labelN: 'vendeur·se', pay: 1500, schedule: [10, 19], stress: 0.45, prestige: 0.25, weekend: true },
  { id: 'cuisinier', label: 'cuisinier', labelF: 'cuisinière', labelN: 'cuisinier·ère', pay: 1800, schedule: [10, 23], stress: 0.75, prestige: 0.4, weekend: true },
  { id: 'pharmacien', label: 'pharmacien', labelF: 'pharmacienne', labelN: 'pharmacien·ne', pay: 2900, schedule: [9, 19], stress: 0.45, prestige: 0.7 },
  { id: 'assistante', label: 'assistant social', labelF: 'assistante sociale', labelN: 'assistant·e social·e', pay: 1900, schedule: [9, 18], stress: 0.8, prestige: 0.5 },
  { id: 'facteur', label: 'facteur', labelF: 'factrice', labelN: 'facteur·rice', pay: 1550, schedule: [6, 14], stress: 0.35, prestige: 0.3 },
  { id: 'mecanicien', label: 'mécanicien', labelF: 'mécanicienne', labelN: 'mécanicien·ne', pay: 1850, schedule: [8, 18], stress: 0.45, prestige: 0.35, noisy: true },
  { id: 'journaliste', label: 'journaliste', pay: 2200, schedule: [9, 20], stress: 0.7, prestige: 0.6, precarious: true },
];

// Le gardien n'est pas tiré au sort : il y en a un seul, il habite la loge.
export const KEEPER = { id: 'gardien', label: 'gardien d\'immeuble', labelF: 'gardienne d\'immeuble', labelN: 'gardien·ne d\'immeuble', pay: 1600, schedule: [7, 19], stress: 0.5, prestige: 0.35, onSite: true };

// Bourse plus petit boulot : de quoi tenir, pas de quoi vivre.
export const STUDENT = { id: 'etudiant', label: 'étudiant', labelF: 'étudiante', labelN: 'étudiant·e', pay: 820, schedule: [9, 17], stress: 0.4, prestige: 0.3, precarious: true };
export const RETIRED = { id: 'retraite', label: 'retraité', labelF: 'retraitée', labelN: 'retraité·e', pay: 1250, schedule: null, stress: 0.1, prestige: 0.3 };
export const UNEMPLOYED = { id: 'chomage', label: 'sans emploi', pay: 850, schedule: null, stress: 0.7, prestige: 0.1, precarious: true };
export const CHILD_JOB = { id: 'ecole', label: 'écolier', labelF: 'écolière', labelN: 'écolier·ère', pay: 0, schedule: [8, 16], stress: 0.3, prestige: 0.1 };
export const PARENT_HOME = { id: 'foyer', label: 'au foyer', pay: 0, schedule: null, stress: 0.5, prestige: 0.2 };

export const ALL_JOBS = [...JOBS, KEEPER, STUDENT, RETIRED, UNEMPLOYED, CHILD_JOB, PARENT_HOME];

/** Le métier, accordé avec la personne qui l'exerce. */
export function jobLabel(job, person) {
  if (!job) return 'sans emploi';
  if (person?.gender === 'f') return job.labelF ?? job.label;
  if (person?.gender === 'x') return job.labelN ?? job.label;
  return job.label;
}
export function jobById(id) {
  return ALL_JOBS.find((j) => j.id === id) ?? UNEMPLOYED;
}

/** Le loyer dépend de l'étage et de la surface : plus haut = plus cher, sauf sous les toits. */
export function rentFor(apartment, floors) {
  const height = apartment.floor / Math.max(1, floors - 1);
  const base = 420 + apartment.rooms * 180;
  const view = 1 + height * 0.28;
  const attic = apartment.floor === floors - 1 ? 0.88 : 1;
  return Math.round(base * view * attic);
}

/** Un habitant travaille-t-il maintenant ? */
export function isWorkTime(job, clock) {
  if (!job.schedule) return false;
  if (clock.isWeekend && !job.weekend) return false;
  const [start, end] = job.schedule;
  const h = clock.hour;
  if (end > start) return h >= start && h < end;
  return h >= start || h < end; // service de nuit
}
