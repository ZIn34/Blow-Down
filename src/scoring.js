// Stars and results.
//
// Hitting anything you're meant to protect is an instant fail. The first star is
// always "bring it down safely"; the others are the level's goals.

export function starLabel(key, level) {
  return {
    down: 'Bring it down safely',
    zone: 'Land it in the zone',
    budget: `${level.par} charge${level.par === 1 ? '' : 's'} or fewer`,
    air: 'Keep the dust off the crowd',
  }[key];
}

export const STAR_ICON = { down: '⬇', zone: '🎯', budget: '💣', air: '🌬' };

const AIR_LIMIT = 8;   // dust puffs allowed to drift through the crowd

// a level has one target zone (`zone`) or several (`zones`)
export function zonesOf(level) {
  return level.zones || (level.zone ? [level.zone] : []);
}

export function expertText(e) {
  if (!e) return null;
  if (e.type === 'charges') return `3 stars using ${e.n} charge${e.n === 1 ? '' : 's'} or fewer`;
  return `3 stars with ${Math.round(e.pct * 100)}% or more in the zone`;
}

export function evaluate(level, structure, fx, used) {
  let total = 0, inZone = 0, maxTop = 0, above = 0;
  const zs = zonesOf(level), z = zs.length;
  for (const it of structure.survey()) {
    total += it.mass;
    maxTop = Math.max(maxTop, it.top);
    if (it.top > level.downHeight) above += it.mass;
    if (zs.some(q => it.p.x > q[0] && it.p.x < q[2] && it.p.z > q[1] && it.p.z < q[3])) inZone += it.mass;
  }
  // a stray leaning piece or two doesn't count as still standing
  const standing = total ? above / total : 0;
  const down = standing < 0.08;
  const zonePct = total ? inZone / total : 0;
  const damaged = [...new Set(structure.protect.filter(p => p.hit).map(p => p.name))];
  const passed = down && !damaged.length;
  const got = {
    down: passed,
    zone: passed && (!z || zonePct >= (level.zoneReq ?? 0.7)),
    budget: passed && used <= level.par,
    air: passed && fx.crowdDust < AIR_LIMIT,
  };
  const stars = (level.stars || []).map(k => ({ key: k, label: starLabel(k, level), got: got[k] }));
  const count = stars.filter(s => s.got).length;
  const e = level.expert;
  const expert = !!e && count === stars.length && stars.length > 0 &&
    (e.type === 'charges' ? used <= e.n : zonePct >= e.pct);
  return { down, passed, zonePct, maxTop, standing, damaged, stars, count, used, expert,
           crowdDust: fx.crowdDust };
}
