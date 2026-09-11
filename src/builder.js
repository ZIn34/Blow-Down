// Level geometry builder. Everything is in metres, ground at y = 0, north = +z.
// Buildings are made of "chunks": boxes, cylinders and cones that the structure
// system glues together and breaks apart.

export const MATERIALS = {
  wood:     { color: 0x9a6b45, density: 0.7, crush: 0.6,  friction: 0.9 },
  concrete: { color: 0xbdb8ad, density: 2.4, crush: 0.95, friction: 0.8 },
  brick:    { color: 0xa0523a, density: 1.9, crush: 0.5,  friction: 0.9, blast: 2.2 },
  steel:    { color: 0x7a8490, density: 3.0, crush: 0.15, friction: 0.6 },
  glass:    { color: 0x9fd0e0, density: 1.0, crush: 1,    friction: 0.5, fragile: true },
};

// Roles decide how a chunk behaves structurally:
//   col  - column, carries load, usually crushed when the building hits the ground
//   wall - bearing wall, carries load
//   slab - floor/roof tile
//   clad - facade panel, never carries load
const SUPPORT_ROLES = new Set(['col', 'wall']);

export class Builder {
  constructor() {
    this.chunks = [];
    this.props = [];
  }

  // y0 is the bottom of the box; x, z are its centre.
  box(x, y0, z, sx, sy, sz, mat = 'concrete', o = {}) {
    const m = MATERIALS[mat];
    const role = o.role || 'wall';
    const c = {
      id: this.chunks.length, shape: 'box',
      x, y: y0 + sy / 2, z, sx, sy, sz, yaw: o.yaw || 0,
      mat, role, rig: !!o.rig, tag: o.tag || null,
      color: o.color ?? m.color, skin: o.skin || (m.fragile ? 'glass' : mat === 'brick' ? 'brick' : 'plain'),
      fragile: o.fragile ?? !!m.fragile,
      support: o.support ?? SUPPORT_ROLES.has(role),
    };
    if (o.crush !== undefined) c.crush = o.crush;
    this.chunks.push(c);
    return c;
  }

  cyl(x, y0, z, r, h, mat = 'concrete', o = {}) {
    const c = this.box(x, y0, z, 2 * r, h, 2 * r, mat, o);
    c.shape = 'cyl'; c.r = r;
    return c;
  }

  cone(x, y0, z, r, h, mat = 'steel', o = {}) {
    const c = this.box(x, y0, z, 2 * r, h, 2 * r, mat, { role: 'slab', ...o });
    c.shape = 'cone'; c.r = r;
    return c;
  }

  col(x, z, y0, h, w, mat = 'concrete', o = {}) {
    return this.box(x, y0, z, w, h, w, mat, { role: 'col', ...o });
  }

  slab(x0, z0, x1, z1, y0, t, mat = 'concrete', tile = 4, o = {}) {
    const nx = Math.max(1, Math.round((x1 - x0) / tile));
    const nz = Math.max(1, Math.round((z1 - z0) / tile));
    const sx = (x1 - x0) / nx, sz = (z1 - z0) / nz;
    const out = [];
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++)
      out.push(this.box(x0 + sx * (i + 0.5), y0, z0 + sz * (j + 0.5), sx, t, sz, mat, { role: 'slab', ...o }));
    return out;
  }

  // Axis-aligned wall of panels from (x0, z0) to (x1, z1).
  wall(x0, z0, x1, z1, y0, h, t, mat = 'brick', panel = 3, o = {}) {
    const alongX = Math.abs(x1 - x0) >= Math.abs(z1 - z0);
    const len = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
    const n = Math.max(1, Math.round(len / panel)), w = len / n;
    const nh = Math.max(1, Math.round(h / (o.panelH || h))), hh = h / nh;
    const out = [];
    for (let k = 0; k < nh; k++) for (let i = 0; i < n; i++) {
      const f = (i + 0.5) / n;
      out.push(this.box(x0 + (x1 - x0) * f, y0 + k * hh, z0 + (z1 - z0) * f,
        alongX ? w : t, hh, alongX ? t : w, mat, o));
    }
    return out;
  }

  // Segmented ring so a charge can take out one side of a round structure.
  ring(cx, cz, r, y0, h, segs, t, mat = 'concrete', o = {}) {
    const w = 2 * r * Math.sin(Math.PI / segs) * 1.04;
    const out = [];
    for (let i = 0; i < segs; i++) {
      const a = (i + 0.5) / segs * Math.PI * 2;
      out.push(this.box(cx + Math.cos(a) * r, y0, cz + Math.sin(a) * r, w, h, t, mat,
        { role: 'wall', yaw: -a - Math.PI / 2, ...o }));
    }
    return out;
  }

  // Multi-storey concrete frame: a grid of columns per floor with a slab on top.
  // clad: { mat, color, skin } adds facade panels from floor `cladFrom` upward.
  // glassGround: fragile shop-window panels on the ground floor.
  // base: height the frame stands on (to stack a tower on a podium).
  frame({ x0, z0, nx, nz, bay, bayZ = bay, floors, fh = 3.2, col = 0.6, slabT = 0.4,
          mat = 'concrete', color, rig = [0], clad = null, cladFrom = 1,
          glassGround = false, tag = 'f', base = 0 }) {
    const X = i => x0 + i * bay, Z = j => z0 + j * bayZ;
    const ch = fh - slabT;
    for (let f = 0; f < floors; f++) {
      const y0 = base + f * fh;
      for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) {
        const c = this.col(X(i), Z(j), y0, ch, col, mat, { rig: rig.includes(f), color, tag: `${tag}${f}_${i}_${j}` });
        c.floor = f; c.gi = i; c.gj = j;
      }
      this.slab(X(0) - col / 2, Z(0) - col / 2, X(nx) + col / 2, Z(nz) + col / 2, y0 + ch, slabT, mat, bay, { color });
      const panel = (f >= cladFrom && clad) ? clad
        : (f === 0 && glassGround) ? { mat: 'glass', skin: 'glass' } : null;
      if (!panel) continue;
      const t = panel.t || 0.3;
      const opts = { role: 'clad', skin: panel.skin || 'window', color: panel.color, fragile: panel.mat === 'glass' };
      for (let i = 0; i < nx; i++) {
        const cx = (X(i) + X(i + 1)) / 2, w = bay - col;
        this.box(cx, y0, Z(0), w, ch, t, panel.mat, opts);
        this.box(cx, y0, Z(nz), w, ch, t, panel.mat, opts);
      }
      for (let j = 0; j < nz; j++) {
        const cz = (Z(j) + Z(j + 1)) / 2, w = bayZ - col;
        this.box(X(0), y0, cz, t, ch, w, panel.mat, opts);
        this.box(X(nx), y0, cz, t, ch, w, panel.mat, opts);
      }
    }
    return { x0: X(0), x1: X(nx), z0: Z(0), z1: Z(nz), h: base + floors * fh };
  }

  prop(type, x, z, o = {}) {
    this.props.push({ type, x, z, ...o });
  }
}
