// Daily contracts: a fresh demolition job every day, the same for everyone.
// The date seeds a generator that picks a building type, its size and materials,
// which way the job wants it to go (tip into a lot, or implode), and what's packed
// around it. Before anyone sees it, the solver has to find a 3-star rig; that rig
// also sets par and powers Sparky's hint.
import { mulberry32, solve } from './solver.js';

const EPOCH = Date.UTC(2026, 8, 1);   // 1 Sep 2026 is contract #1

export function dayNumber(d = new Date()) {
  return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - EPOCH) / 86400000) + 1;
}

const pick = (r, a) => a[Math.floor(r() * a.length)];
const range = (r, a, b) => a + r() * (b - a);
const irange = (r, a, b) => Math.floor(a + r() * (b - a + 1));

const ADJ = ['Old', 'Rusty', 'Crumbling', 'Condemned', 'Leaning', 'Forgotten', 'Derelict', 'Tired', 'Grim', 'Unloved', 'Soggy', 'Creaky'];
const SHOP_NAMES = ['Bakery', 'Café', 'Barber', 'Bookshop', 'Pharmacy', 'Pizzeria', 'Florist', 'Laundrette', 'Pub', 'Toy shop', 'Butcher', 'Bike shop', 'Chippy', 'Tailor'];
const HOUSE_NAMES = ['Farmhouse', 'Cottage', 'Bungalow', "Gran's house", 'Guest house'];
const CONCRETE = [0xcfd6dc, 0xd9d2c3, 0xc9c1b4, 0xb8c4cc, 0xe0d6c4, 0xa8b3ba];
const BRICK = [0xb88a5a, 0x9c5a3c, 0xa8664a, 0xc49a74, 0x8e4f36];
const SHOP_COLORS = [0xc98f5a, 0x7fa3c4, 0xd98fa0, 0x9fc28a, 0xe8c07a, 0xb9b2a6, 0xc4a484, 0x8fb0c9];
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function waterTower(b, s, h) {
  for (const [dx, dz] of [[-s, -s], [s, -s], [-s, s], [s, s]]) {
    b.col(dx, dz, 0, h / 2, 0.5, 'steel', { rig: true });
    b.col(dx, dz, h / 2, h / 2, 0.5, 'steel');
  }
  const br = { role: 'clad', color: 0x5e6873 };
  b.box(0, h / 2 - 0.2, -s, 2 * s, 0.4, 0.3, 'steel', br);
  b.box(0, h / 2 - 0.2, s, 2 * s, 0.4, 0.3, 'steel', br);
  b.box(-s, h / 2 - 0.2, 0, 0.3, 0.4, 2 * s, 'steel', br);
  b.box(s, h / 2 - 0.2, 0, 0.3, 0.4, 2 * s, 'steel', br);
  b.slab(-s - 0.7, -s - 0.7, s + 0.7, s + 0.7, h, 0.4, 'steel', s + 0.7);
  b.cyl(0, h + 0.4, 0, s + 0.4, 4.5, 'steel', { role: 'wall', color: 0xc9d3db });
  b.cone(0, h + 4.9, 0, s + 0.6, 1.6, 'steel', { color: 0x8a949d });
  return h + 6.5;
}

export function makeDaily(day, attempt = 0) {
  const r = mulberry32(day * 7919 + attempt * 104729 + 17);
  const roll = r();
  const kind = roll < 0.5 ? 'frame' : roll < 0.78 ? 'tower' : 'legs';
  const theme = r() < 0.6 ? 'day' : r() < 0.6 ? 'dusk' : 'night';
  let setting = 'country';
  const adj = pick(r, ADJ);
  let noun, H, half = { x: 2, z: 2 }, mode = 'tip', blastRadius, minSupport, downHeight;
  const dirIndex = irange(r, 0, 3), dir = DIRS[dirIndex];
  let body;   // (b) => void, the building itself

  if (kind === 'frame') {
    const floors = irange(r, 2, 7), nx = irange(r, 1, 3), nz = irange(r, 1, 2);
    const bay = range(r, 4, 5.5), bayZ = nz === 1 ? range(r, 5, 8) : bay, fh = range(r, 3, 3.5), col = 0.6;
    const brick = r() < 0.4;
    const clad = { mat: brick ? 'brick' : 'concrete', color: pick(r, brick ? BRICK : CONCRETE), skin: 'window' };
    const glassGround = r() < 0.6;
    const rig = floors >= 5 && r() < 0.3 ? [0, 1] : [0];
    const x0 = -nx * bay / 2, z0 = -nz * bayZ / 2;
    H = floors * fh;
    half = { x: nx * bay / 2 + col / 2, z: nz * bayZ / 2 + col / 2 };
    mode = r() < 0.4 ? 'implode' : 'tip';
    setting = r() < 0.7 ? 'city' : 'country';
    noun = floors >= 6 ? pick(r, ['Tower Block', 'Hotel', 'Office Tower']) : floors >= 4 ? pick(r, ['Office Block', 'Apartments', 'Department Store'])
      : pick(r, ['Motel', 'Car Showroom', 'Warehouse Offices', 'Row of Shops']);
    downHeight = Math.max(4, H * 0.32);
    body = b => b.frame({ x0, z0, nx, nz, bay, bayZ, floors, fh, col, rig, clad, glassGround, tag: 'd' });
  } else if (kind === 'tower') {
    const rad = range(r, 1.8, 2.8), segs = pick(r, [6, 8, 10]), ringH = range(r, 2.5, 3), n = irange(r, 3, 6);
    const mat = r() < 0.55 ? 'brick' : 'concrete';
    const color = mat === 'brick' ? pick(r, BRICK) : pick(r, CONCRETE);
    H = 2 * ringH + n * 2.8 + 0.6;
    half = { x: rad + 0.3, z: rad + 0.3 };
    blastRadius = 2 * rad * Math.sin(Math.PI / segs) * 1.05;
    minSupport = 0.3;
    downHeight = 2 * (rad + 0.4) + 1.4;
    noun = mat === 'brick' ? pick(r, ['Chimney', 'Kiln Stack', 'Mill Chimney']) : pick(r, ['Silo', 'Grain Silo', 'Feed Tower']);
    body = b => {
      b.ring(0, 0, rad, 0, ringH, segs, 0.6, mat, { rig: true, color });
      b.ring(0, 0, rad, ringH, ringH, segs, 0.6, mat, { color });
      for (let k = 0; k < n; k++) b.cyl(0, 2 * ringH + 2.8 * k, 0, rad + 0.25 - k * 0.08, 2.8, mat, { role: 'wall', crush: mat === 'brick' ? 0.5 : undefined, color: k % 2 ? color : (color & 0xfefefe) >> 0 });
      b.cyl(0, 2 * ringH + 2.8 * n, 0, rad - 0.1, 0.6, 'concrete', { role: 'slab', color: 0x4a4a4a });
    };
  } else {
    const s = range(r, 2, 3), h = pick(r, [8, 10, 12]);
    H = h + 6.5;
    half = { x: s + 0.8, z: s + 0.8 };
    downHeight = 2 * (s + 0.4) + 1.5;
    noun = pick(r, ['Water Tower', 'Water Tank', 'Farm Tank']);
    body = b => waterTower(b, s, h);
  }

  // Neighbours. When tipping, the side opposite the lot always has one, so tipping the wrong way costs you.
  const names = [...(setting === 'city' ? SHOP_NAMES : HOUSE_NAMES.concat(SHOP_NAMES.slice(0, 4)))];
  const props = [];
  DIRS.forEach(([dx, dz], i) => {
    if (mode === 'tip' && i === dirIndex) return;
    const behind = mode === 'tip' && dx === -dir[0] && dz === -dir[1];
    if (!behind && r() > (mode === 'implode' ? 0.85 : 0.6)) return;
    const w = range(r, 8, 12), d = range(r, 7, 10), h = range(r, 4, 9);
    const gap = mode === 'implode' ? range(r, 4.5, 6.5) : range(r, 4, 7) + (behind ? 0 : 1);
    const along = dx !== 0 ? d : d;
    const x = dx ? dx * (half.x + gap + (dx ? w / 2 : 0)) : range(r, -2, 2);
    const z = dz ? dz * (half.z + gap + d / 2) : range(r, -2, 2);
    const name = names.splice(Math.floor(r() * names.length), 1)[0] || 'Shed';
    const type = setting === 'city' || !HOUSE_NAMES.includes(name) ? 'shop' : 'house';
    props.push(type === 'shop'
      ? ['shop', x, z, { w, d: along, h, color: pick(r, SHOP_COLORS), awning: pick(r, SHOP_COLORS), protect: name }]
      : ['house', x, z, { protect: name, color: pick(r, [0xf0e6d0, 0xe9dcc3, 0xd9e3ea]) }]);
  });

  // Target zone: the footprint (implode) or a lot on the open side, long enough for the fall.
  let zone;
  if (mode === 'implode') zone = [-half.x - 2.5, -half.z - 2.5, half.x + 2.5, half.z + 2.5];
  else {
    const len = H * 1.1 + 2, wide = (dir[0] ? half.z : half.x) + 3;
    zone = dir[0]
      ? (dir[0] > 0 ? [0, -wide, half.x + len, wide] : [-half.x - len, -wide, 0, wide])
      : (dir[1] > 0 ? [-wide, 0, wide, half.z + len] : [-wide, -half.z - len, wide, 0]);
  }
  const zc = [(zone[0] + zone[2]) / 2, (zone[1] + zone[3]) / 2];
  const span = Math.max(zone[2] - zone[0], zone[3] - zone[1], H);
  const yaw = (r() < 0.5 ? -1 : 1) * range(r, 0.25, 0.7);

  return {
    daily: true, day, attempt,
    name: `${adj} ${noun}`, theme, setting,
    intro: `Today's contract: a ${adj.toLowerCase()} ${noun.toLowerCase()}. ` + (mode === 'implode'
      ? 'Neighbours on every side, so it has to come straight down.'
      : 'Put it in the zone and keep it off the neighbours.'),
    hint: null,   // filled in from the solver's rig
    maxCharges: 12, par: 12, blastRadius, minSupport,
    stars: ['down', 'zone', 'budget'], zone, zoneReq: mode === 'implode' ? 0.7 : 0.55, downHeight,
    camera: { target: [zc[0] * 0.35, H * 0.35, zc[1] * 0.35], dist: Math.min(95, Math.max(30, H * 1.5 + span * 0.7)), yaw, pitch: 0.33 },
    seed: 5000 + day,
    build(b) {
      body(b);
      if (setting === 'city') {
        b.prop('pavement', 0, 0, { x0: zone[0] - 3, z0: zone[1] - 3, x1: zone[2] + 3, z1: zone[3] + 3 });
      } else {
        b.prop('dirt', 0, 0, { x0: zone[0] - 1, z0: zone[1] - 1, x1: zone[2] + 1, z1: zone[3] + 1, color: 0x9a8a68 });
        for (let i = 0; i < 5; i++) {
          const a = i * 1.3 + day, rr = 30 + (i * 7) % 12;
          b.prop('tree', Math.cos(a) * rr, Math.sin(a) * rr, { s: 1 });
        }
      }
      for (const [t, x, z, o] of props) b.prop(t, x, z, o);
    },
  };
}

// Describe a solver rig in Sparky's words.
function hintFor(name, def) {
  if (name.startsWith('middle')) return 'Middle supports first, and the rest a moment later. It caves in on itself.';
  if (name.startsWith('all')) return 'Everything at once. It drops straight down.';
  if (name.startsWith('every')) return 'Space the charges evenly around the base.';
  if (name.startsWith('fold')) return 'One side first, then the rest a beat later.';
  return 'Rig the side facing the zone. A building falls toward the side you cut.';
}

const CACHE = 'blowdown.daily';

// Generate today's contract and make sure it's winnable. The result is cached, so
// only the first open of the day waits for the solver.
export async function prepareDaily(day, onProgress) {
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem(CACHE)); } catch { /* no storage */ }
  if (cached && cached.day === day && cached.v === 2) return finish(makeDaily(day, cached.attempt), cached);
  let def = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    def = makeDaily(day, attempt);
    const { best } = await solve(def, { onProgress: (i, n) => onProgress?.(attempt, i, n) });
    if (best) {
      const info = { v: 2, day, attempt, par: best.rig.length, rig: best.rig, hint: hintFor(best.name, def) };
      try { localStorage.setItem(CACHE, JSON.stringify(info)); } catch { /* ignore */ }
      return finish(def, info);
    }
  }
  return finish(def, { par: def.maxCharges, rig: null, hint: 'Look at where the zone is, and cut the side facing it.' });
}

function finish(def, info) {
  def.par = info.par;
  def.maxCharges = Math.min(12, info.par + 2);
  def.solutionRig = info.rig;
  def.hint = info.hint;
  return def;
}
