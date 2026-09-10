// Structural model: chunks glued into rigid groups that stand, tip, fall and shatter.
//
// A "group" is one Rapier rigid body holding the colliders of a connected set of
// chunks. Everything starts in fixed groups. When charges destroy chunks, each
// affected group is split into connected components and every component is checked
// for support at each blasted height band: if what sits above a band has lost too
// much support area, or its centre of mass is outside the remaining supports, it
// becomes a dynamic compound and tips or drops. A compound that takes a hard knock
// shatters into one body per chunk, crushing columns on the way.

import * as THREE from 'three';
import { MATERIALS } from './builder.js';

const V3 = THREE.Vector3, Q = THREE.Quaternion;
const UP = new V3(0, 1, 0);
const EPS = 0.06;            // adjacency tolerance, m
const SHATTER_DV = 2.2;      // velocity jump in one step that counts as an impact, m/s
const MAX_COMPOUND_AGE = 6;  // a falling block breaks up after this long regardless
const _p = new V3(), _q = new Q();

export class Structure {
  constructor(R, world, view, defs, opts = {}) {
    this.R = R;
    this.world = world;
    this.view = view;
    this.minSupport = opts.minSupport ?? 0.4;
    this.blastRadius = opts.blastRadius ?? 0;
    this.rng = opts.rng || Math.random;
    this.emit = opts.onEvent || (() => {});
    this.protect = opts.protect || [];
    this.dmgTick = 0;
    this.byHandle = new Map();
    this.groups = new Set();
    this.chunks = defs.map(d => this.initChunk(d));
    this.totalMass = this.chunks.reduce((m, c) => m + c.mass, 0);
    this.buildAdjacency();
    this.buildings = [];
    for (const comp of this.components(this.chunks)) {
      const b = { id: this.buildings.length, height: 0 };
      for (const c of comp) { c.building = b.id; b.height = Math.max(b.height, c.max.y); }
      this.buildings.push(b);
      this.makeGroup(comp, null, false);
    }
  }

  initChunk(d) {
    const c = { ...d, dead: false, group: null, collider: null };
    c.hx = d.sx / 2; c.hy = d.sy / 2; c.hz = d.sz / 2;
    c.lp = new V3(d.x, d.y, d.z);                       // pose relative to its group's body
    c.lq = new Q().setFromAxisAngle(UP, d.yaw);
    const vol = d.shape === 'box' ? d.sx * d.sy * d.sz
      : Math.PI * d.r * d.r * d.sy * (d.shape === 'cone' ? 1 / 3 : 1);
    c.mass = vol * MATERIALS[d.mat].density;
    const cs = Math.cos(d.yaw), sn = Math.sin(d.yaw);
    const ex = Math.abs(cs) * c.hx + Math.abs(sn) * c.hz, ez = Math.abs(sn) * c.hx + Math.abs(cs) * c.hz;
    c.min = { x: d.x - ex, y: d.y - c.hy, z: d.z - ez };
    c.max = { x: d.x + ex, y: d.y + c.hy, z: d.z + ez };
    c.area = d.shape === 'box' ? d.sx * d.sz : Math.PI * d.r * d.r;
    c.corners = [];
    if (d.shape === 'box') {
      for (const [lx, lz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const x = lx * c.hx, z = lz * c.hz;
        c.corners.push([d.x + x * cs + z * sn, d.z - x * sn + z * cs]);
      }
    } else {
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2;
        c.corners.push([d.x + Math.cos(a) * d.r, d.z + Math.sin(a) * d.r]);
      }
    }
    c.rad = Math.hypot(c.hx, c.hy, c.hz);
    this.view.add(c);
    return c;
  }

  buildAdjacency() {
    const cs = this.chunks;
    for (const c of cs) c.adj = [];
    for (let i = 0; i < cs.length; i++) {
      const a = cs[i];
      for (let j = i + 1; j < cs.length; j++) {
        const b = cs[j];
        if (a.min.x > b.max.x + EPS || b.min.x > a.max.x + EPS ||
            a.min.y > b.max.y + EPS || b.min.y > a.max.y + EPS ||
            a.min.z > b.max.z + EPS || b.min.z > a.max.z + EPS) continue;
        a.adj.push(b); b.adj.push(a);
      }
    }
  }

  components(list) {
    const inSet = new Set(list), seen = new Set(), out = [];
    for (const s of list) {
      if (seen.has(s) || s.dead) continue;
      const comp = [], stack = [s];
      seen.add(s);
      while (stack.length) {
        const c = stack.pop();
        comp.push(c);
        for (const o of c.adj) if (!o.dead && inSet.has(o) && !seen.has(o)) { seen.add(o); stack.push(o); }
      }
      out.push(comp);
    }
    return out;
  }

  // ---- poses -------------------------------------------------------------

  pose(g) {
    const t = g.body.translation(), q = g.body.rotation();
    return { t: new V3(t.x, t.y, t.z), q: new Q(q.x, q.y, q.z, q.w) };
  }

  snapshot(g) {
    const s = this.pose(g);
    const l = g.body.linvel(), a = g.body.angvel();
    s.lin = new V3(l.x, l.y, l.z);
    s.ang = new V3(a.x, a.y, a.z);
    s.com = this.comOf(g.chunks.filter(c => !c.dead), s);
    return s;
  }

  worldPos(c, pose = null, out = new V3()) {
    pose = pose || (c.group ? this.pose(c.group) : null);
    out.copy(c.lp);
    if (pose) out.applyQuaternion(pose.q).add(pose.t);
    return out;
  }

  worldQuat(c, out = new Q()) {
    const q = c.group.body.rotation();
    return out.set(q.x, q.y, q.z, q.w).multiply(c.lq);
  }

  comOf(chunks, pose) {
    const com = new V3(), p = new V3();
    let m = 0;
    for (const c of chunks) { this.worldPos(c, pose, p); com.addScaledVector(p, c.mass); m += c.mass; }
    return m ? com.divideScalar(m) : com;
  }

  // ---- groups ------------------------------------------------------------

  makeGroup(chunks, from, dynamic) {
    const R = this.R;
    const desc = dynamic ? R.RigidBodyDesc.dynamic() : R.RigidBodyDesc.fixed();
    if (from) desc.setTranslation(from.t.x, from.t.y, from.t.z).setRotation(from.q);
    // round pieces get heavy angular damping so fallen drums don't roll for ever
    const single = chunks.length === 1;
    if (dynamic) desc.setLinearDamping(0.02).setAngularDamping(!single ? 0.1 : chunks[0].shape === 'box' ? 0.6 : 2.5);
    const body = this.world.createRigidBody(desc);
    const g = { body, chunks, dynamic, single, age: 0, dirty: true,
                prevV: new V3(), prevW: new V3(), radius: 1 };
    for (const c of chunks) { c.group = g; this.attach(c, body); }
    if (dynamic) {
      const com = this.comOf(chunks, from);
      let r = 0;
      for (const c of chunks) r = Math.max(r, this.worldPos(c, from, _p).distanceTo(com));
      g.radius = Math.max(1, r);
      if (from) {
        // velocity of the old body evaluated at this piece's centre of mass
        const v = from.lin.clone().add(from.ang.clone().cross(com.clone().sub(from.com)));
        body.setLinvel(v, true);
        body.setAngvel(from.ang, true);
        g.prevV.copy(v);
        g.prevW.copy(from.ang);
      }
    }
    this.groups.add(g);
    return g;
  }

  attach(c, body) {
    const R = this.R, m = MATERIALS[c.mat];
    const cd = c.shape === 'box' ? R.ColliderDesc.cuboid(c.hx, c.hy, c.hz)
      : c.shape === 'cyl' ? R.ColliderDesc.cylinder(c.hy, c.r)
      : R.ColliderDesc.cone(c.hy, c.r);
    cd.setTranslation(c.lp.x, c.lp.y, c.lp.z).setRotation(c.lq)
      .setDensity(m.density).setFriction(m.friction).setRestitution(0.05);
    c.collider = this.world.createCollider(cd, body);
    this.byHandle.set(c.collider.handle, c);
  }

  kill(c, why, pose = null) {
    if (c.dead) return;
    const p = this.worldPos(c, pose);
    c.dead = true;
    if (c.collider) { this.world.removeCollider(c.collider, true); this.forget(c); }
    this.view.hide(c);
    this.emit(why, p, { color: c.color, mat: c.mat, size: c.rad });
  }

  // release a collider we're about to lose along with its body
  forget(c) {
    if (c.collider) this.byHandle.delete(c.collider.handle);
    c.collider = null;
  }

  // ---- demolition --------------------------------------------------------

  blast(targets) {
    const killed = new Set(), points = [];
    for (const c of targets) {
      if (c.dead) continue;
      const p = this.worldPos(c);
      points.push(p);
      this.emit('blast', p, { size: c.rad });
      killed.add(c);
      const rad = Math.max(this.blastRadius, MATERIALS[c.mat].blast || 0);
      if (rad > 0) for (const o of this.chunks)
        if (!o.dead && o.rig && o.building === c.building && !killed.has(o) &&
            this.worldPos(o, null, _p).distanceTo(p) < rad) killed.add(o);
    }
    const groups = new Set(), bands = [];
    for (const c of killed) {
      if (!c.group.dynamic) bands.push({ a: c.min.y, b: c.max.y, building: c.building });
      groups.add(c.group);
      this.kill(c, 'crumble');
    }
    this.regroup(groups, bands);
    for (const g of this.groups) {
      if (!g.dynamic || !g.single) continue;
      const t = g.body.translation();
      for (const p of points) {
        const dx = t.x - p.x, dy = t.y - p.y, dz = t.z - p.z, d = Math.hypot(dx, dy, dz);
        if (d > 4 || d < 0.01) continue;
        const k = g.body.mass() * 3 * (1 - d / 4) / d;
        g.body.applyImpulse({ x: dx * k, y: (dy + 0.5) * k, z: dz * k }, true);
      }
    }
    return killed.size;
  }

  regroup(groups, bands = []) {
    for (const g of groups) {
      if (!this.groups.has(g)) continue;
      const alive = g.chunks.filter(c => !c.dead);
      const from = this.snapshot(g);
      this.world.removeRigidBody(g.body);
      this.groups.delete(g);
      for (const c of g.chunks) this.forget(c);
      for (const comp of this.components(alive)) {
        if (g.dynamic) this.makeGroup(comp, from, true);
        else this.settle(comp, from, bands);
      }
    }
  }

  grounded(chunks) {
    return chunks.some(c => c.support && c.min.y < 0.05);
  }

  // Split a fixed component into what still stands and what falls.
  settle(comp, from, bands) {
    if (!this.grounded(comp)) { this.release(comp, from); return; }
    const bs = bands.filter(b => b.building === comp[0].building).sort((p, q) => p.a - q.a);
    for (const band of bs) {
      let upper = comp.filter(c => c.min.y >= band.a - EPS);
      if (!upper.length) continue;
      const verdict = this.supported(upper, band);
      if (verdict === 'ok') continue;
      let tip = null;
      // the blast blows out the facade of the storey it's on, so the walls don't prop it up
      for (const c of upper) if (c.role === 'clad' && c.min.y >= band.a - EPS && c.max.y <= band.b + EPS) this.kill(c, 'crumble', from);
      upper = upper.filter(c => !c.dead);
      if (verdict === 'area') {
        // too few supports left: they buckle and the whole thing drops straight down.
        for (const c of upper) if (c.buckle) this.kill(c, 'crumble', from);
        upper = upper.filter(c => !c.dead);
      } else if (verdict === 'com') {
        // off balance: the surviving supports act as a hinge and it tips toward the cut
        tip = this.tipDir;
      }
      this.release(upper, from, tip);
      const us = new Set(upper);
      for (const part of this.components(comp.filter(c => !us.has(c)))) {
        if (this.grounded(part)) this.makeGroup(part, from, false);
        else this.release(part, from);
      }
      return;
    }
    this.makeGroup(comp, from, false);
  }

  // Does what sits above this band still have enough support underneath it?
  supported(upper, band) {
    const crosses = c => c.support && c.min.y < band.b - EPS && c.max.y > band.a + EPS && c.min.y >= band.a - EPS;
    for (const c of upper) c.buckle = false;
    const feet = upper.filter(crosses);
    if (!feet.length) return 'none';
    let orig = 0, area = 0;
    for (const c of this.chunks) if (c.building === band.building && crosses(c)) orig += c.area;
    for (const c of feet) { area += c.area; c.buckle = true; }
    if (area < this.minSupport * orig) return 'area';
    let m = 0, cx = 0, cz = 0;
    for (const c of upper) { m += c.mass; cx += c.x * c.mass; cz += c.z * c.mass; }
    const hull = convexHull(feet.flatMap(c => c.corners));
    const margin = Math.max(0.15, 0.015 * this.buildings[band.building].height);
    if (insideHull(hull, cx / m, cz / m, margin)) return 'ok';
    // which way it will go: from the middle of the remaining supports toward the centre of mass
    let fx = 0, fz = 0;
    for (const c of feet) { fx += c.x; fz += c.z; }
    this.tipDir = new V3(cx / m - fx / feet.length, 0, cz / m - fz / feet.length);
    if (this.tipDir.lengthSq() < 1e-6) this.tipDir.set(this.rng() - 0.5, 0, this.rng() - 0.5);
    this.tipDir.normalize();
    return 'com';
  }

  release(chunks, from, tip = null) {
    const keep = [];
    for (const c of chunks) {
      if (c.fragile) this.kill(c, 'glass', from);
      else keep.push(c);
    }
    if (!keep.length) return;
    const g = this.makeGroup(keep, from, true);
    if (tip) {
      // a small push to start the fall; gravity does the rest
      const w = UP.clone().cross(tip).multiplyScalar(0.3);
      g.body.setAngvel(w, true);
      g.prevW.copy(w);
      // tall, slender things fall like a tree and shouldn't break up on the first knock
      let x0 = Infinity, x1 = -Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity, y0 = Infinity;
      for (const c of keep) {
        x0 = Math.min(x0, c.min.x); x1 = Math.max(x1, c.max.x); z0 = Math.min(z0, c.min.z); z1 = Math.max(z1, c.max.z);
        y0 = Math.min(y0, c.min.y); y1 = Math.max(y1, c.max.y);
      }
      g.tipping = y1 - y0 > 1.8 * Math.min(x1 - x0, z1 - z0);
    }
  }

  shatter(g) {
    const from = this.snapshot(g);
    this.world.removeRigidBody(g.body);
    this.groups.delete(g);
    const alive = g.chunks.filter(c => !c.dead);
    this.emit('shatter', from.com, { count: alive.length, speed: from.lin.length() });
    const rnd = () => this.rng() - 0.5;
    // Slender blocks keep toppling as they break up, rather than leaving a stack of
    // loose pieces standing. Wide ones crumble inward.
    let lean = null, y0 = Infinity, y1 = -Infinity, x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const c of alive) {
      const p = this.worldPos(c, from, _p);
      y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z);
    }
    const upright = UP.clone().applyQuaternion(from.q).y > 0.96 && from.ang.length() < 0.35;
    if (alive.filter(c => c.role === 'slab').length <= 4) {   // towers, poles, chimneys; not framed buildings
      if (y1 - y0 > 1.8 * Math.max(1.5, Math.min(x1 - x0, z1 - z0))) {
        const up = UP.clone().applyQuaternion(from.q);
        const d = new V3(up.x, 0, up.z);
        if (d.lengthSq() < 0.01) d.set(rnd(), 0, rnd());
        d.normalize();
        lean = { w: UP.clone().cross(d).multiplyScalar(0.55), base: new V3(from.com.x, y0, from.com.z) };
      }
    }
    for (const c of alive) {
      this.forget(c);
      const p = c.lp.clone().applyQuaternion(from.q).add(from.t);
      // height above the bottom of the block, if it came down upright (a tipped block is lying down)
      const up = upright ? p.y - y0 : 0;
      let crush = c.crush ?? { col: MATERIALS[c.mat].crush, wall: MATERIALS[c.mat].crush * 0.3, clad: 0.4 }[c.role] ?? 0.05;
      // the top of a tall building pancakes into dust rather than raining big pieces around
      if (c.crush === undefined && c.role !== 'col') crush += 0.35 * Math.min(1, Math.max(0, (up - 8) / 20));
      if (c.fragile || this.rng() < crush) { this.kill(c, 'crumble', from); continue; }
      const q = from.q.clone().multiply(c.lq);
      const v = from.lin.clone().add(from.ang.clone().cross(p.clone().sub(from.com)));
      // crumble inward, the way a well-rigged building folds into itself; more so higher up
      const inward = new V3(from.com.x - p.x, 0, from.com.z - p.z);
      if (inward.lengthSq() > 0.01) v.addScaledVector(inward.normalize(), upright ? 0.5 + 0.04 * up : 0.3);
      v.x += rnd() * 0.5; v.y += this.rng() * 0.5; v.z += rnd() * 0.5;
      if (lean) v.add(lean.w.clone().cross(p.clone().sub(lean.base)));
      const ang = new V3(rnd() * 1.5, rnd() * 1.5, rnd() * 1.5);
      if (c.hy > 0.6 && c.hy > 1.6 * Math.min(c.hx, c.hz)) {
        // tall, thin pieces fall over (inward) instead of standing on the rubble
        const up = UP.clone().applyQuaternion(q);
        const d = inward.lengthSq() > 0.01 ? inward.clone() : new V3(rnd(), 0, rnd()).normalize();
        d.addScaledVector(up, -d.dot(up)).normalize();
        ang.addScaledVector(up.cross(d), 1.2 + this.rng() * 1.4);
      }
      c.lp.set(0, 0, 0);
      c.lq.identity();
      this.makeGroup([c], { t: p, q, lin: v, ang, com: p.clone() }, true);
    }
  }

  // ---- per-step ----------------------------------------------------------

  step(dt) {
    for (const g of [...this.groups]) {
      if (!g.dynamic || g.single) continue;
      g.age += dt;
      const v = g.body.linvel(), w = g.body.angvel();
      const dv = Math.hypot(v.x - g.prevV.x, v.y - g.prevV.y, v.z - g.prevV.z)
        + Math.hypot(w.x - g.prevW.x, w.y - g.prevW.y, w.z - g.prevW.z) * g.radius * 0.5;
      g.prevV.set(v.x, v.y, v.z);
      g.prevW.set(w.x, w.y, w.z);
      let limit = SHATTER_DV;
      if (g.tipping) {
        // something falling like a tree stays in one piece until it's well over
        const r = g.body.rotation();
        const upY = 1 - 2 * (r.x * r.x + r.z * r.z);
        if (upY > 0.6) limit = SHATTER_DV * 3;
      }
      // a block that has come to rest in one piece breaks up too
      const still = g.age > 0.6 && Math.hypot(v.x, v.y, v.z) < 0.4 && Math.hypot(w.x, w.y, w.z) < 0.25;
      g.restT = still ? (g.restT || 0) + dt : 0;
      if ((g.age > 0.05 && dv > limit) || g.restT > 0.25 || g.age > MAX_COMPOUND_AGE) this.shatter(g);
    }
    this.checkDamage();
  }

  // A protected prop counts as hit once falling pieces touching it add up to more
  // than a sliver of the building, so a stray brick bouncing off doesn't ruin a run.
  checkDamage() {
    if (++this.dmgTick % 3 || !this.protect.some(p => !p.hit)) return;
    const R = this.R, rot = { x: 0, y: 0, z: 0, w: 1 };
    this.protect.forEach((pr, index) => {
      if (pr.hit) return;
      pr.touched ??= new Set();
      pr.mass ??= 0;
      let last = null;
      for (const b of pr.boxes) {
        this.world.intersectionsWithShape(b.c, rot, new R.Cuboid(b.h.x + 0.05, b.h.y + 0.05, b.h.z + 0.05), col => {
          const c = this.byHandle.get(col.handle);
          if (c && !c.dead && !pr.touched.has(c)) { pr.touched.add(c); pr.mass += c.mass; last = c; }
          return true;
        }, R.QueryFilterFlags.EXCLUDE_FIXED);
      }
      if (last && pr.mass > (pr.crowd ? 0.004 : 0.025) * this.totalMass) {
        pr.hit = true;
        this.emit('damage', this.worldPos(last), { index, name: pr.name });
      }
    });
  }

  sync() {
    for (const g of this.groups) {
      if (!g.dirty && (!g.dynamic || g.body.isSleeping())) continue;
      g.dirty = false;
      const pose = this.pose(g);
      for (const c of g.chunks) {
        if (c.dead) continue;
        _p.copy(c.lp).applyQuaternion(pose.q).add(pose.t);
        _q.copy(pose.q).multiply(c.lq);
        this.view.set(c, _p, _q);
      }
    }
    this.view.flush();
  }

  // ---- queries -----------------------------------------------------------

  rigChunks() { return this.chunks.filter(c => c.rig && !c.dead); }

  moving(speed = 0.3) {
    for (const g of this.groups) {
      if (g.dynamic && !g.single) return true;   // a block that hasn't broken up yet
      if (!g.dynamic || g.body.isSleeping()) continue;
      const v = g.body.linvel(), w = g.body.angvel();
      if (Math.hypot(v.x, v.y, v.z) > speed || Math.hypot(w.x, w.y, w.z) > speed * 1.6) return true;
    }
    return false;
  }

  anyDynamic() {
    for (const g of this.groups) if (g.dynamic) return true;
    return false;
  }

  // Alive chunks with world centre, top height and mass, for scoring.
  survey() {
    const out = [];
    for (const g of this.groups) {
      const pose = this.pose(g);
      const q = pose.q;
      for (const c of g.chunks) {
        if (c.dead) continue;
        const p = this.worldPos(c, pose);
        const cq = q.clone().multiply(c.lq);
        // y components of the rotated local axes
        const ax = 2 * (cq.x * cq.y + cq.w * cq.z), ay = 1 - 2 * (cq.x * cq.x + cq.z * cq.z), az = 2 * (cq.y * cq.z - cq.w * cq.x);
        const top = p.y + Math.abs(ax) * c.hx + Math.abs(ay) * c.hy + Math.abs(az) * c.hz;
        out.push({ p, top, mass: c.mass, chunk: c });
      }
    }
    return out;
  }

  stats() {
    let dyn = 0, alive = 0;
    for (const g of this.groups) if (g.dynamic) dyn++;
    for (const c of this.chunks) if (!c.dead) alive++;
    return { bodies: this.groups.size, dynamic: dyn, alive, total: this.chunks.length };
  }
}

// Monotone-chain convex hull, counter-clockwise.
function convexHull(pts) {
  if (pts.length < 3) return [];
  pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop(); lower.pop();
  return lower.concat(upper);
}

// Is (x, z) inside the CCW hull by at least `margin`?
function insideHull(hull, x, z, margin) {
  if (hull.length < 3) return false;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i], b = hull[(i + 1) % hull.length];
    const ex = b[0] - a[0], ez = b[1] - a[1], len = Math.hypot(ex, ez) || 1;
    if ((ex * (z - a[1]) - ez * (x - a[0])) / len < margin) return false;
  }
  return true;
}
