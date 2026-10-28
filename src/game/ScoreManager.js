// Score, combo and run statistics. All balance numbers live in config/gameConfig.js (SCORING).
import { SCORING } from '../config/gameConfig.js';
import { loadBest, saveBest } from './Storage.js';

// Bangla + English labels for score pop-ups
export const AWARD_LABELS = {
  nearMiss:   { bn: 'নিয়ার মিস!', en: 'Near miss' },
  oncoming:   { bn: 'উল্টো পথে ফাঁক!', en: 'Oncoming squeeze' },
  tightGap:   { bn: 'ফাঁক গলে গেলেন!', en: 'Tight gap' },
  ram:        { bn: 'ধাক্কা!', en: 'Shove' },
  pickup:     { bn: 'যাত্রী উঠেছে', en: 'Passengers aboard' },
  escape:     { bn: 'পুলিশ ফাঁকি!', en: 'Police escaped' },
  survive:    { bn: 'টিকে আছেন!', en: 'Survival bonus' },
  route:      { bn: 'রুট সম্পূর্ণ!', en: 'Route complete' },
  routeBonus: { bn: 'যাত্রী বোনাস', en: 'Passenger bonus' },
};

export class ScoreManager {
  /** @param {(evt:object)=>void} onEvent receives { type, points?, label?, multiplier? } for HUD pop-ups */
  constructor(onEvent = () => {}) {
    this.onEvent = onEvent;
    this.best = loadBest();
    this.reset();
  }

  reset() {
    this.score = 0;
    this.combo = 0;            // number of successive maneuvers
    this.comboTimer = 0;
    this.multiplier = 1;
    this.surviveTimer = 0;
    this.newBest = false;
    this.stats = {
      time: 0, distance: 0, nearMisses: 0, tightGaps: 0, rams: 0, passengers: 0,
      escapes: 0, maxCombo: 0, maxMultiplier: 1, penalties: 0, routes: 0, topSpeed: 0,
    };
  }

  get bestShown() { return Math.max(this.best, Math.round(this.score)); }

  addDistance(meters) {
    if (meters <= 0) return;
    this.stats.distance += meters;
    this.score += meters * SCORING.distancePerMeter;
  }

  /** Award a maneuver. Multiplier applies; combo is extended. Returns the points actually added. */
  award(kind, base, opts = {}) {
    const pts = Math.round(base * this.multiplier);
    this.score += pts;
    if (opts.combo !== false) this.bumpCombo();
    const label = AWARD_LABELS[opts.label || kind] || AWARD_LABELS[kind] || { bn: kind, en: kind };
    this.onEvent({ type: 'award', kind, points: pts, label, multiplier: this.multiplier, combo: this.combo, extra: opts.extra });
    return pts;
  }

  bumpCombo() {
    const c = SCORING.combo;
    this.combo++;
    this.comboTimer = c.timeout;
    const m = Math.min(c.maxMultiplier, 1 + Math.floor(this.combo / c.stepEvery) * c.stepSize);
    if (m > this.multiplier) this.onEvent({ type: 'multiplier', multiplier: m });
    this.multiplier = m;
    this.stats.maxCombo = Math.max(this.stats.maxCombo, this.combo);
    this.stats.maxMultiplier = Math.max(this.stats.maxMultiplier, this.multiplier);
  }

  breakCombo() {
    if (this.combo > 0 || this.multiplier > 1) this.onEvent({ type: 'comboBreak' });
    this.combo = 0; this.multiplier = 1; this.comboTimer = 0;
  }

  /** Severe collision penalty. impulse in N*s. Returns points removed. */
  collisionPenalty(impulse) {
    const p = SCORING.penalty;
    let lost = 0;
    if (impulse > p.threshold) lost = ((impulse - p.threshold) / 1000) * p.perThousandImpulse;
    if (lost > 0) {
      lost = Math.min(lost, Math.max(0, this.score));
      this.score -= lost;
      this.stats.penalties++;
      this.onEvent({ type: 'penalty', points: -Math.round(lost) });
    }
    if (impulse > p.comboBreakImpulse) this.breakCombo();
    return lost;
  }

  wallPenalty() {
    const lost = Math.min(SCORING.penalty.wall, Math.max(0, this.score));
    this.score -= lost;
    this.breakCombo();
  }

  update(dt, playing) {
    if (!playing) return;
    this.stats.time += dt;
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.breakCombo();
    }
    const sb = SCORING.surviveBonus;
    this.surviveTimer += dt;
    if (this.surviveTimer >= sb.every) {
      this.surviveTimer -= sb.every;
      this.award('survive', sb.points, { combo: false });
    }
  }

  /** Call once when the run ends. Persists the best score. */
  finish() {
    const final = Math.round(this.score);
    this.newBest = final > this.best;
    if (this.newBest) { this.best = final; saveBest(final); }
    return { score: final, best: this.best, newBest: this.newBest, stats: { ...this.stats } };
  }
}
