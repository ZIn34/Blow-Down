// A "job" is one thing to play: a campaign level, a remix of one, today's daily
// contract, or a sandbox. Each carries a level definition (see levels.js) plus a
// physics seed, so the same rig always gives the same collapse.
import { LEVELS } from './levels.js';
import { solutionFor } from './cases.js';
import { BAKED } from './baked.js';

export const SEED = 1337;
export const REMIX_KEYS = ['tight', 'close', 'pinpoint'];
export const REMIXES = {
  tight: { name: 'Tight budget', icon: '💣', desc: 'Only just enough charges. Nothing to spare.' },
  close: { name: 'Close quarters', icon: '🏚️', desc: "The neighbours have moved in closer, and it's dark." },
  pinpoint: { name: 'Pinpoint', icon: '🎯', desc: 'A smaller zone, and more of it has to land inside.' },
};

export function campaignDef(i) {
  return { ...LEVELS[i], seed: SEED + i, solution: solutionFor(i), expert: BAKED[i]?.expert || null };
}

// A remix before its par is known (the baking step uses this to find par).
export function remixBase(i, key) {
  const def = { ...campaignDef(i), expert: null, solution: null };
  if (key === 'close') {
    const build = def.build;
    def.theme = 'night';
    def.build = b => {
      build(b);
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (const c of b.chunks) { x0 = Math.min(x0, c.x); x1 = Math.max(x1, c.x); z0 = Math.min(z0, c.z); z1 = Math.max(z1, c.z); }
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      for (const p of b.props) if (p.protect) { p.x = cx + (p.x - cx) * 0.8; p.z = cz + (p.z - cz) * 0.8; }
    };
  } else if (key === 'pinpoint') {
    const shrink = z => {
      const cx = (z[0] + z[2]) / 2, cz = (z[1] + z[3]) / 2, hx = (z[2] - z[0]) * 0.4, hz = (z[3] - z[1]) * 0.4;
      return [cx - hx, cz - hz, cx + hx, cz + hz];
    };
    def.zones = (def.zones || [def.zone]).map(shrink);
    def.zone = undefined;
    def.zoneReq = Math.min(0.9, (def.zoneReq ?? 0.7) + 0.1);
  }
  return def;
}

export function remixDef(i, key) {
  const data = BAKED[i]?.remix?.[key];
  if (!data) return null;
  const def = remixBase(i, key);
  if (key === 'tight') { def.maxCharges = data.n; def.par = data.n; }
  else def.par = Math.min(def.maxCharges, data.par);
  return def;
}

export const availableRemixes = i => REMIX_KEYS.filter(k => BAKED[i]?.remix?.[k]);

export const campaignJob = i => ({ kind: 'campaign', index: i, def: campaignDef(i), label: `JOB ${i + 1}` });

export const remixJob = (i, key) => ({ kind: 'remix', index: i, remix: key, def: remixDef(i, key),
  label: `REMIX · ${REMIXES[key].name.toUpperCase()}`, intro: REMIXES[key].desc });

export const sandboxJob = i => ({ kind: 'sandbox', index: i, label: 'SANDBOX',
  def: { ...campaignDef(i), sandbox: true, maxCharges: 40, par: 40, stars: [], expert: null, maxDelay: 5,
    intro: 'Sandbox: charges go on anything that holds the building up. No score, just boom.' } });

export const dailyJob = (day, def) => ({ kind: 'daily', day, def, label: `DAILY #${day}` });
