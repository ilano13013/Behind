// Horloge de la simulation.
//
// Le temps de Behind est compressé : on garde des journées lisibles
// (24 h, matin / travail / soir / nuit) mais une année ne dure que
// 24 jours de simulation, sinon personne ne vieillirait jamais.

export const MINUTES_PER_TICK = 5;
export const TICKS_PER_HOUR = 60 / MINUTES_PER_TICK; // 12
export const TICKS_PER_DAY = TICKS_PER_HOUR * 24; // 288
export const DAYS_PER_MONTH = 2;
export const MONTHS_PER_YEAR = 12;
export const DAYS_PER_YEAR = DAYS_PER_MONTH * MONTHS_PER_YEAR; // 24

export const MONTH_NAMES = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

export const WEEKDAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

export class Clock {
  constructor(startTick = 7 * TICKS_PER_HOUR) {
    this.tick = startTick;
  }

  advance(n = 1) {
    this.tick += n;
  }

  get minuteOfDay() {
    return (this.tick % TICKS_PER_DAY) * MINUTES_PER_TICK;
  }

  get hour() {
    return Math.floor(this.minuteOfDay / 60);
  }

  get minute() {
    return this.minuteOfDay % 60;
  }

  /** Position dans la journée, 0 = minuit, 1 = minuit suivant. */
  get dayFraction() {
    return (this.tick % TICKS_PER_DAY) / TICKS_PER_DAY;
  }

  get day() {
    return Math.floor(this.tick / TICKS_PER_DAY);
  }

  get weekday() {
    return this.day % 7;
  }

  get isWeekend() {
    return this.weekday >= 5;
  }

  get year() {
    return Math.floor(this.day / DAYS_PER_YEAR);
  }

  get monthIndex() {
    return Math.floor((this.day % DAYS_PER_YEAR) / DAYS_PER_MONTH);
  }

  get season() {
    // 0 hiver, 1 printemps, 2 été, 3 automne
    return Math.floor(((this.monthIndex + 1) % 12) / 3);
  }

  /** Créneau de la journée, utilisé partout par l'IA. */
  get phase() {
    const h = this.hour;
    if (h < 5) return 'nuit';
    if (h < 9) return 'matin';
    if (h < 12) return 'matinée';
    if (h < 14) return 'midi';
    if (h < 18) return 'après-midi';
    if (h < 22) return 'soirée';
    return 'nuit';
  }

  get isNight() {
    const h = this.hour;
    return h >= 22 || h < 6;
  }

  timeString() {
    return `${String(this.hour).padStart(2, '0')}:${String(this.minute).padStart(2, '0')}`;
  }

  dateString() {
    const dayOfMonth = (this.day % DAYS_PER_MONTH) + 1;
    return `${WEEKDAYS[this.weekday]} ${dayOfMonth} ${MONTH_NAMES[this.monthIndex]} — an ${this.year + 1}`;
  }

  stamp() {
    return `${this.dateString()}, ${this.timeString()}`;
  }
}

export const ticksToDays = (t) => t / TICKS_PER_DAY;
export const daysToTicks = (d) => Math.round(d * TICKS_PER_DAY);
export const yearsToTicks = (y) => daysToTicks(y * DAYS_PER_YEAR);
