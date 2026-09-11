// Everything the game remembers between sessions: stars, cash, purchases, the
// daily streak. Stored in localStorage; every access is wrapped because some
// browsers refuse storage (private mode) and the game must still run.

const KEY = 'blowdown.v1';

export const RANKS = [
  { at: 0, name: 'Rookie', icon: '🧑‍🔧' },
  { at: 1500, name: 'Blaster', icon: '💥' },
  { at: 5000, name: 'Foreman', icon: '🦺' },
  { at: 12000, name: 'Contractor', icon: '🚧' },
  { at: 30000, name: 'Demolition Boss', icon: '🏗️' },
  { at: 70000, name: 'Tycoon', icon: '👑' },
];

export class Profile {
  constructor(data, nLevels) {
    const d = data || {};
    this.best = Array.isArray(d.best) ? d.best : [];
    this.expert = Array.isArray(d.expert) ? d.expert : [];
    while (this.best.length < nLevels) this.best.push(0);
    while (this.expert.length < nLevels) this.expert.push(false);
    this.remix = d.remix || {};
    this.cash = d.cash || 0;
    this.earned = d.earned || 0;
    this.owned = d.owned || {};
    this.equip = { fx: 'classic', det: 'red', crew: 'sparky', ...(d.equip || {}) };
    this.daily = { streak: 0, bestStreak: 0, last: null, results: {}, ...(d.daily || {}) };
  }

  static load(nLevels) {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(KEY)); } catch { /* storage unavailable */ }
    return new Profile(d, nLevels);
  }

  save() {
    const { best, expert, remix, cash, earned, owned, equip, daily } = this;
    try { localStorage.setItem(KEY, JSON.stringify({ best, expert, remix, cash, earned, owned, equip, daily })); } catch { /* ignore */ }
  }

  unlockedCount() {
    let i = 0;
    while (i < this.best.length && this.best[i] > 0) i++;
    return Math.min(this.best.length, i + 1);
  }

  totalStars() { return this.best.reduce((a, b) => a + b, 0); }

  rank() {
    let i = 0;
    while (i + 1 < RANKS.length && this.earned >= RANKS[i + 1].at) i++;
    const r = RANKS[i], next = RANKS[i + 1];
    return { ...r, index: i, next, progress: next ? (this.earned - r.at) / (next.at - r.at) : 1 };
  }

  pay(amount) {
    this.cash += amount;
    this.earned += amount;
  }

  has(id) { return !!this.owned[id]; }

  buy(item) {
    if (this.has(item.id) || this.cash < item.price) return false;
    this.cash -= item.price;
    this.owned[item.id] = true;
    this.save();
    return true;
  }

  // Record a finished attempt and pay out. Returns what happened, for the result screen.
  award(job, res) {
    const out = { cash: 0, notes: [], rankUp: null };
    const before = this.rank().index;
    const pay = (n, why) => { if (n > 0) { this.pay(n); out.cash += n; out.notes.push(why); } };

    if (job.kind === 'campaign') {
      const i = job.index, prev = this.best[i] || 0;
      if (res.count > prev) {
        pay((res.count - prev) * (250 + 50 * i), `${res.count - prev} new star${res.count - prev > 1 ? 's' : ''}`);
        this.best[i] = res.count;
      } else if (res.passed) pay(50, 'salvage');
      if (res.expert && !this.expert[i]) { this.expert[i] = true; pay(800 + 100 * i, 'Expert goal'); }
    } else if (job.kind === 'remix') {
      const key = `${job.index}:${job.remix}`, prev = this.remix[key] || 0;
      if (res.count > prev) { pay((res.count - prev) * 350, 'remix stars'); this.remix[key] = res.count; }
      else if (res.passed) pay(50, 'salvage');
    } else if (job.kind === 'daily') {
      const r = this.daily.results[job.day] || { stars: 0, tries: 0 };
      r.tries = (r.tries || 0) + 1;
      if (res.passed) {
        if (!r.done) pay(500, "today's contract");
        if (res.count > (r.stars || 0)) pay((res.count - (r.stars || 0)) * 250, 'daily stars');
        if (!r.done) {
          this.daily.streak = this.daily.last === job.day - 1 ? this.daily.streak + 1 : this.daily.last === job.day ? this.daily.streak : 1;
          this.daily.bestStreak = Math.max(this.daily.bestStreak, this.daily.streak);
          this.daily.last = job.day;
        }
        if (!r.done || res.count > (r.stars || 0)) Object.assign(r, { stars: res.count, used: res.used, zone: res.zonePct, clean: !res.damaged.length });
        r.done = true;
      }
      this.daily.results[job.day] = r;
    }
    const after = this.rank();
    if (after.index > before) out.rankUp = after;
    this.save();
    return out;
  }

  // The streak only counts if the last finished daily was yesterday or today.
  currentStreak(today) {
    return this.daily.last === today || this.daily.last === today - 1 ? this.daily.streak : 0;
  }
}
