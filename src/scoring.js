// Stars, results, and saved progress.

export function starLabel(key, level) {
  return {
    down: 'Bring it down',
    zone: 'Land it in the zone',
    budget: `${level.par} charge${level.par === 1 ? '' : 's'} or fewer`,
    clean: 'No damage',
    air: 'Keep the dust off the crowd',
  }[key];
}

// a level has one target zone (`zone`) or several (`zones`)
export function zonesOf(level) {
  return level.zones || (level.zone ? [level.zone] : []);
}

export const STAR_ICON ={ down: '⬇', zone: '🎯', budget: '💣', clean: '🏠', air: '🌬' };

const AIR_LIMIT = 8;   // dust puffs allowed to drift through the crowd

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
  const got = {
    down,
    zone: down && (!z || zonePct >= (level.zoneReq ?? 0.7)),
    budget: down && used <= level.par,
    clean: down && !damaged.length,
    air: down && fx.crowdDust < AIR_LIMIT,
  };
  const stars = level.stars.map(k => ({ key: k, label: starLabel(k, level), got: got[k] }));
  return { down, zonePct, maxTop, standing, damaged, stars, count: stars.filter(s => s.got).length, used,
           crowdDust: fx.crowdDust };
}

const KEY = 'blowdown.v1';

export function loadProgress(n) {
  let p = null;
  try { p = JSON.parse(localStorage.getItem(KEY)); } catch {}
  if (!p || !Array.isArray(p.best)) p = { best: [] };
  while (p.best.length < n) p.best.push(0);
  return p;
}

export function saveProgress(p) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch {}
}

export function unlockedCount(p) {
  let i = 0;
  while (i < p.best.length && p.best[i] > 0) i++;
  return Math.min(p.best.length, i + 1);
}
