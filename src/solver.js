// Headless demolition: builds a level's physics without any graphics, fires a rig,
// and scores it. It creates the same physics objects in the same order as the
// game, so results match what a player would see.
//
// It also generates sensible rigs for any building (all at once, middle first,
// tip toward each side, every k-th leg...) and searches them. That's how daily
// contracts and remixes are checked solvable before anyone plays them, and how
// par and Expert goals are set.
import * as THREE from 'three';
import RAPIER from '../lib/rapier.es.js';
import { Builder } from './builder.js';
import { Structure } from './structure.js';
import { buildProps } from './props.js';
import { evaluate } from './scoring.js';
import { FX } from './fx.js';

export const FIXED = 1 / 60;

// Let the page breathe between simulations. A message channel isn't throttled the
// way timers are in background tabs.
export const yieldNow = () => new Promise(r => {
  const c = new MessageChannel();
  c.port1.onmessage = () => r();
  c.port2.postMessage(0);
});

export function mulberry32(a) {
  return () => {
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const NULL_VIEW = { add() {}, set() {}, hide() {}, flush() {} };
let headlessFx = null;

// Physics-only copy of a level.
export function buildWorld(def) {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = FIXED;
  const ground = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(RAPIER.ColliderDesc.cuboid(450, 1, 450).setTranslation(0, -1, 0).setFriction(0.9), ground);
  const b = new Builder();
  def.build(b);
  if (def.sandbox) for (const c of b.chunks) if (c.support) c.rig = true;
  const root = new THREE.Group();
  const protect = buildProps(b.props, { root, R: RAPIER, world });
  const box = { rng: mulberry32(def.seed ?? 1337) };
  const structure = new Structure(RAPIER, world, NULL_VIEW, b.chunks, {
    minSupport: def.minSupport, blastRadius: def.blastRadius, protect, rng: () => box.rng(),
  });
  return { world, structure, root, box, defs: b.chunks };
}

function dispose(w) {
  w.world.free();
  w.root.traverse(o => { o.geometry?.dispose(); o.material?.dispose?.(); });
}

// Fire a rig ([{ id, delay, type }]) and return the scored result.
export function simulate(def, rig) {
  const w = buildWorld(def);
  const S = w.structure;
  headlessFx ??= new FX(new THREE.Scene());
  const fx = headlessFx;
  fx.reset(def);
  const crowd = S.protect.find(p => p.crowd);
  if (crowd) fx.setCrowd(crowd.crowd);
  let hitAt = null;   // hitting anything protected fails the job, so stop shortly after
  S.emit = (type, p, d) => { fx.handle(type, p, d); if (type === 'damage' && hitAt === null) hitAt = t; };
  w.box.rng = mulberry32(def.seed ?? 1337);
  const pending = rig.map(r => ({ chunk: S.chunks[r.id], delay: r.delay, type: r.type || 'std' }))
    .sort((a, b) => a.delay - b.delay);
  const lastFire = pending.length ? pending[pending.length - 1].delay : 0;
  let t = 0, settle = 0;
  for (let n = 0; n < 60 * 25; n++) {
    t += FIXED;
    const now = [];
    while (pending.length && pending[0].delay <= t + 1e-6) now.push(pending.shift());
    if (now.length) S.blast(now);
    w.world.step();
    S.step(FIXED);
    fx.update(FIXED);
    if (hitAt !== null && t - hitAt > 0.9) break;
    if (pending.length) continue;
    const since = t - lastFire;
    if (!S.anyDynamic() && since > 2) break;
    if (since > 1.2 && !S.moving(since > 5 ? 1.2 : 0.3)) settle += FIXED; else settle = 0;
    if (settle > 0.7 || since > 10) break;
  }
  const res = evaluate(def, S, fx, rig.length);
  res.touched = Object.fromEntries(S.protect.map(p => [p.name, (p.mass || 0) / S.totalMass]));
  dispose(w);
  return res;
}

// Turn a level's `solution` (list of [filter, delay]) into a concrete rig.
export function rigFromFilters(def, filters) {
  const w = buildWorld(def);
  const rigChunks = w.structure.rigChunks();
  const rig = [];
  for (const [sel, delay, type] of filters)
    for (const c of rigChunks.filter(sel)) if (rig.length < def.maxCharges) rig.push({ id: c.id, delay, type });
  dispose(w);
  return rig;
}

// ---- rig candidates ------------------------------------------------------

const centroid = list => {
  let x = 0, z = 0;
  for (const c of list) { x += c.x; z += c.z; }
  return { x: x / list.length, z: z / list.length };
};

const DIRS = [0, 1, 2, 3, 4, 5, 6, 7].map(i => ({ x: Math.cos(i * Math.PI / 4), z: Math.sin(i * Math.PI / 4), i }));

function side(list, C, dir, frac) {
  const proj = list.map(c => (c.x - C.x) * dir.x + (c.z - C.z) * dir.z);
  const max = Math.max(...proj);
  if (max < 0.05) return [];
  return list.filter((c, i) => proj[i] > 0.05 && proj[i] >= max * frac - 1e-6);
}

function middleFirst(list, C) {
  const s = list.slice().sort((a, b) => Math.hypot(a.x - C.x, a.z - C.z) - Math.hypot(b.x - C.x, b.z - C.z));
  const k = Math.max(1, Math.round(s.length / 6));
  return s.map((c, i) => [c, i < k ? 0 : 0.3]);
}

function everyKth(list, C, k) {
  const s = list.slice().sort((a, b) => Math.atan2(a.z - C.z, a.x - C.x) - Math.atan2(b.z - C.z, b.x - C.x));
  return s.filter((c, i) => i % k === 0);
}

// Sensible rigs for this level, cheapest first.
export function candidates(def) {
  const w = buildWorld(def);
  const S = w.structure;
  const rig = S.rigChunks();
  dispose(w);
  if (!rig.length) return [];
  const site = centroid(rig);
  const buildings = [];
  const byB = new Map();
  for (const c of rig) { if (!byB.has(c.building)) byB.set(c.building, []); byB.get(c.building).push(c); }
  for (const list of byB.values()) {
    const bands = [...new Set(list.map(c => Math.round(c.min.y * 10) / 10))].sort((a, b) => a - b)
      .map(y => list.filter(c => Math.abs(c.min.y - y) < 0.06));
    const own = S.chunks.filter(c => c.building === list[0].building);
    const C = centroid(own);
    buildings.push({ bands, C, ring: list.some(c => c.yaw !== 0) });
  }

  const out = [], seen = new Set();
  const add = (name, parts) => {
    if (!parts.length || parts.length > def.maxCharges) return;
    const key = parts.map(([c, d]) => c.id + '@' + d).sort().join(',');
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ name, rig: parts.map(([c, d]) => ({ id: c.id, delay: d })) });
  };
  const zero = list => list.map(c => [c, 0]);
  const each = fn => buildings.flatMap(b => fn(b));

  for (let band = 0; band < Math.max(...buildings.map(b => b.bands.length)); band++) {
    const L = b => b.bands[Math.min(band, b.bands.length - 1)];
    const tag = band ? ` (floor band ${band + 1})` : '';
    add('all at once' + tag, each(b => zero(L(b))));
    add('middle first' + tag, each(b => middleFirst(L(b), b.C)));
    for (const frac of [0, 0.5]) {
      for (const d of DIRS) add(`tip ${d.i}${frac ? ' outer' : ''}${tag}`, each(b => zero(side(L(b), b.C, d, frac))));
      if (buildings.length > 1) {
        for (const away of [1, -1]) add(`${away > 0 ? 'outward' : 'inward'}${frac ? ' outer' : ''}${tag}`, each(b => {
          const v = { x: b.C.x - site.x, z: b.C.z - site.z }, l = Math.hypot(v.x, v.z) || 1;
          return zero(side(L(b), b.C, { x: away * v.x / l, z: away * v.z / l }, frac));
        }));
      }
    }
    for (const d of DIRS.filter(d => d.i % 2 === 0)) add(`fold ${d.i}${tag}`, each(b => {
      const s = new Set(side(L(b), b.C, d, 0));
      return L(b).map(c => [c, s.has(c) ? 0 : 0.8]);
    }));
    if (buildings.some(b => b.ring)) for (const k of [2, 3, 4]) add(`every ${k}th${tag}`, each(b => zero(everyKth(L(b), b.C, k))));
  }
  return out.sort((a, b) => a.rig.length - b.rig.length);
}

const threeStars = res => res.stars.length && res.stars.every(s => s.got);

// Cheapest 3-star rig among the candidates (and the level's own solution, if any).
// yieldEvery lets a caller keep the page responsive between simulations.
export async function solve(def, { onProgress, all = false, yieldEvery = true } = {}) {
  const list = candidates(def);
  if (def.solution) list.unshift({ name: 'designed solution', rig: rigFromFilters(def, def.solution) });
  let best = null;
  const results = [];
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (!all && best && c.rig.length > best.rig.length) break;
    const res = simulate(def, c.rig);
    results.push({ ...c, res });
    if (threeStars(res) && (!best || c.rig.length < best.rig.length ||
        (c.rig.length === best.rig.length && res.zonePct > best.res.zonePct))) best = { ...c, res };
    onProgress?.(i + 1, list.length);
    if (yieldEvery) await yieldNow();
  }
  return { best, results, tried: results.length };
}
