// Petits outils de français.
//
// Un immeuble français où tout le monde est « allé » au masculin, ça se
// voit tout de suite. On accorde.

/** Accord en genre : g(p, 'allé') → « allée » si elle, « allé·e » si iel. */
export function g(person, masc, fem = null, neutral = null) {
  const f = fem ?? `${masc}e`;
  if (person?.gender === 'f') return f;
  if (person?.gender === 'x') return neutral ?? `${masc}·e`;
  return masc;
}

/** Article défini élidé : le/la/l'. */
export function laLe(person, word) {
  if (/^[aeiouéèêhAEIOU]/.test(word)) return `l'${word}`;
  return person?.gender === 'f' ? `la ${word}` : `le ${word}`;
}

/** « il », « elle », « iel ». */
export function pronom(person) {
  if (person?.gender === 'f') return 'elle';
  if (person?.gender === 'x') return 'iel';
  return 'il';
}

/** « Il », « Elle », « Iel » en début de phrase. */
export function Pronom(person) {
  const p = pronom(person);
  return p.charAt(0).toUpperCase() + p.slice(1);
}

/** Liste à la française : « a, b et c ». */
export function liste(items) {
  const a = items.filter(Boolean);
  if (a.length === 0) return '';
  if (a.length === 1) return a[0];
  return `${a.slice(0, -1).join(', ')} et ${a[a.length - 1]}`;
}

/** Étage ordinal : 1er, 2e, 3e… */
export function ordinal(n) {
  return n === 1 ? '1er' : `${n}e`;
}

/** « de » élidé : de facteur, mais d'agent de sécurité. */
export function de(word) {
  if (!word) return 'de';
  return /^[aeiouyéèêàâîïôöûùh]/i.test(word) ? `d'${word}` : `de ${word}`;
}
