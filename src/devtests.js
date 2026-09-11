// Tuning harness. In the browser console:
//   const t = await import('./src/devtests.js'); await t.run()        every level
//   await t.run(4)  or  await t.run([10, 19])                         one level / a range
// Fires each level's known good and bad rigs headlessly and reports whether each
// behaves as designed. bake() recomputes the Expert goals and remix pars in baked.js.
import { CASES } from './cases.js';
import { LEVELS } from './levels.js';
import { simulate, rigFromFilters, solve, yieldNow } from './solver.js';
import { campaignDef, remixBase, REMIX_KEYS } from './jobs.js';

export async function run(filter = null) {
  const out = {};
  for (const [name, lvl, rig, shouldPass] of CASES) {
    if (typeof filter === 'number' && lvl !== filter) continue;
    if (Array.isArray(filter) && (lvl < filter[0] || lvl > filter[1])) continue;
    const def = campaignDef(lvl);
    const r = simulate(def, rigFromFilters(def, rig));
    const three = r.stars.every(s => s.got);
    const verdict = shouldPass ? (three ? 'OK' : 'EXPECTED 3★') : (three ? 'EXPECTED FAIL' : 'OK');
    const touched = Object.entries(r.touched).filter(([, v]) => v > 0.001).map(([k, v]) => `${k} ${(v * 100).toFixed(1)}%`).join(', ');
    out[name] = `${verdict} | ${r.stars.map(s => s.key + (s.got ? ' ✔' : ' ✘')).join(', ')} | stand=${r.standing.toFixed(2)} zone=${r.zonePct.toFixed(2)} touched: ${touched || '-'} dust=${r.crowdDust}`;
    await yieldNow();
  }
  return out;
}

// Search each level for its cheapest and tidiest 3-star rigs, and derive the Expert
// goal and each remix's par from them. Paste the printed object into baked.js.
export async function bake(from = 0, to = LEVELS.length - 1, log = console.log) {
  const out = {};
  for (let i = from; i <= to; i++) {
    const def = campaignDef(i);
    const base = await solve(def);
    if (!base.best) { log(i, 'no 3-star rig found'); out[i] = { expert: null, remix: {} }; continue; }
    const minN = base.best.rig.length;
    const three = base.results.filter(r => r.res.stars.every(s => s.got) && r.rig.length === minN);
    const bestZone = Math.max(...three.map(r => r.res.zonePct));
    const expert = minN < def.par ? { type: 'charges', n: minN }
      : { type: 'zone', pct: Math.min(0.96, Math.max((def.zoneReq ?? 0.7) + 0.05, Math.floor(bestZone * 100 - 2) / 100)) };
    const remix = {};
    for (const key of REMIX_KEYS) {
      if (key === 'tight') { remix.tight = minN < def.maxCharges ? { n: minN } : null; continue; }
      const r = await solve(remixBase(i, key));
      remix[key] = r.best ? { par: r.best.rig.length } : null;
    }
    out[i] = { expert, remix, found: three.length, tried: base.tried };
    log(i, JSON.stringify(out[i]));
  }
  return out;
}
