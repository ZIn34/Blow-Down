// Chapter 2: bigger contracts. Same rules as chapter 1, new twists: two buildings
// in one job, chain blasts, several towers at once, upper-floor-only rigging.

function waterTower(b, cx, cz) {
  for (const [dx, dz] of [[-2.5, -2.5], [2.5, -2.5], [-2.5, 2.5], [2.5, 2.5]]) {
    b.col(cx + dx, cz + dz, 0, 4, 0.5, 'steel', { rig: true });
    b.col(cx + dx, cz + dz, 4, 4, 0.5, 'steel');
  }
  const br = { role: 'clad', color: 0x5e6873 };
  b.box(cx, 3.8, cz - 2.5, 5, 0.4, 0.3, 'steel', br);
  b.box(cx, 3.8, cz + 2.5, 5, 0.4, 0.3, 'steel', br);
  b.box(cx - 2.5, 3.8, cz, 0.3, 0.4, 5, 'steel', br);
  b.box(cx + 2.5, 3.8, cz, 0.3, 0.4, 5, 'steel', br);
  b.slab(cx - 3.2, cz - 3.2, cx + 3.2, cz + 3.2, 8, 0.4, 'steel', 3.2);
  b.cyl(cx, 8.4, cz, 2.9, 4.5, 'steel', { role: 'wall', color: 0xc9d3db });
  b.cone(cx, 12.9, cz, 3.1, 1.6, 'steel', { color: 0x8a949d });
}

function lightTower(b, cx, cz) {
  for (const [dx, dz] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]])
    b.col(cx + dx, cz + dz, 0, 2.5, 0.6, 'steel', { rig: true, color: 0x6a737d });
  for (let k = 0; k < 3; k++) b.col(cx, cz, 2.5 + 7 * k, 7, 1.3, 'steel', { color: 0x9aa3ad });
  b.box(cx, 23.5, cz, 7, 3.2, 0.8, 'steel', { role: 'clad', skin: 'lamp', color: 0xffffff });
}

export const CHAPTER2 = [
  {
    name: 'Twin Towers', theme: 'day',
    intro: 'Two water towers and a farmhouse in the middle. Every charge goes on one timeline, so plan both at once.',
    hint: 'Rig the two legs on the outside of each tower so they both fall away from the house.',
    maxCharges: 6, par: 4, stars: ['zone', 'budget', 'clean'],
    zones: [[7, -6, 26, 6], [-26, -6, -7, 6]], zoneReq: 0.55, downHeight: 6.6,
    camera: { target: [0, 6, 0], dist: 55, yaw: 0, pitch: 0.3 },
    build(b) {
      waterTower(b, 10, 0);
      waterTower(b, -10, 0);
      b.prop('house', 0, 0, { protect: 'Farmhouse', color: 0xf0e6d0 });
      b.prop('dirt', 0, 0, { x0: -28, z0: -8, x1: 28, z1: 8, color: 0x9a8058 });
      b.prop('fence', 0, 0, { x0: -30, z0: 12, x1: 30, z1: 12 });
      for (const [x, z] of [[-6, 16], [8, 18], [-30, -10], [30, -12], [0, -16]]) b.prop('tree', x, z, { s: 1.1 });
    },
  },

  {
    name: 'Radio Mast', theme: 'day',
    intro: 'Thirty metres of steel and a narrow strip to land it in. There are houses on both sides.',
    hint: "Both legs on the side facing the strip. One leg alone sends it off at an angle.",
    maxCharges: 3, par: 2, stars: ['zone', 'budget', 'clean'],
    zone: [3, -3.5, 40, 3.5], zoneReq: 0.55, downHeight: 5,
    camera: { target: [15, 8, 0], dist: 64, yaw: 0.12, pitch: 0.36 },
    build(b) {
      for (const [x, z] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]])
        for (let k = 0; k < 6; k++) b.col(x, z, 5 * k, 5, 0.45, 'steel', { rig: k === 0, color: k % 2 ? 0xeeeeee : 0xd9412b });
      for (let k = 1; k < 6; k++) {
        const br = { role: 'clad', color: 0x9aa3ad }, y = 5 * k - 0.2;
        b.box(0, y, -1.5, 3, 0.4, 0.25, 'steel', br);
        b.box(0, y, 1.5, 3, 0.4, 0.25, 'steel', br);
        b.box(-1.5, y, 0, 0.25, 0.4, 3, 'steel', br);
        b.box(1.5, y, 0, 0.25, 0.4, 3, 'steel', br);
      }
      b.slab(-1.9, -1.9, 1.9, 1.9, 30, 0.3, 'steel', 3.8, { color: 0x6d747c });
      b.col(0, 0, 30.3, 6, 0.3, 'steel', { color: 0xd9412b });
      b.prop('dirt', 0, 0, { x0: 2, z0: -4, x1: 42, z1: 4, color: 0x94a45a });
      b.prop('house', 16, 11, { protect: 'North house', color: 0xe9dcc3 });
      b.prop('house', 16, -11, { protect: 'South house', color: 0xd9e3ea, roof: 0x5a6b7a });
      b.prop('fence', 0, 0, { x0: 4, z0: 5, x1: 40, z1: 5 });
      b.prop('fence', 0, 0, { x0: 4, z0: -5, x1: 40, z1: -5 });
      for (const [x, z] of [[-10, 8], [-12, -6], [30, 12], [32, -12]]) b.prop('tree', x, z, {});
    },
  },

  {
    name: 'Cooling Tower', theme: 'dusk',
    intro: 'Each charge takes out the leg it sits on and the legs next to it. Space them out.',
    hint: 'Four charges on every third leg. Nothing is left standing, so nothing can tip it.',
    maxCharges: 5, par: 4, blastRadius: 4.5, minSupport: 0.2, stars: ['zone', 'budget', 'clean'],
    zone: [-10.5, -10.5, 10.5, 10.5], zoneReq: 0.75, downHeight: 8,
    camera: { target: [0, 13, 0], dist: 74, yaw: 0.3, pitch: 0.3 },
    build(b) {
      const N = 12;
      for (let i = 0; i < N; i++) {
        const a = (i + 0.5) / N * Math.PI * 2;
        b.col(8 * Math.cos(a), 8 * Math.sin(a), 0, 4, 1.1, 'concrete', { rig: true, color: 0xb8b2a6 });
      }
      [7.8, 7.2, 6.7, 6.5, 6.6, 7.0, 7.5].forEach((r, k) =>
        b.ring(0, 0, r, 4 + 4 * k, 4, N, 0.6, 'concrete', { color: k % 2 ? 0xd8d4cc : 0xd0cbc1 }));
      b.prop('warehouse', 0, 23, { w: 30, d: 10, h: 12, protect: 'Turbine hall', color: 0x9aa7b0 });
      b.prop('dirt', 0, 0, { x0: -12, z0: -12, x1: 12, z1: 12, color: 0x857a6a });
      b.prop('fence', 0, 0, { x0: -30, z0: -22, x1: 30, z1: -22 });
    },
  },

  {
    name: 'Office Block', setting: 'city', theme: 'day',
    intro: "There's an empty lot out front, and a train parked behind. Tipping it takes a lot fewer charges than dropping it.",
    hint: 'Only the front row of columns, on the side facing the empty lot. Five charges.',
    maxCharges: 10, par: 5, stars: ['zone', 'budget', 'clean'],
    zone: [-11, -30, 11, 0], zoneReq: 0.6, downHeight: 8,
    camera: { target: [0, 8, -6], dist: 62, yaw: 0.4, pitch: 0.33 },
    build(b) {
      b.frame({ x0: -10, z0: -4, nx: 4, nz: 1, bay: 5, bayZ: 8, floors: 6, fh: 3.4, col: 0.7,
        rig: [0], clad: { mat: 'concrete', color: 0xcfd6dc, skin: 'window' }, glassGround: true, tag: 'o' });
      b.prop('shop', -20.4, 0, { w: 12, d: 12, h: 10, color: 0xc4a484, protect: 'Apartments' });
      b.prop('shop', 20.4, 0, { w: 12, d: 12, h: 6, color: 0x8fb0c9, awning: 0x333333, protect: 'Car showroom' });
      b.prop('rail', 0, 0, { x0: -80, x1: 80, z: 14 });
      b.prop('train', 0, 14, { cars: 3, protect: 'Train' });
      b.prop('dirt', 0, 0, { x0: -12, z0: -32, x1: 12, z1: -6, color: 0x8a7a60 });
      b.prop('road', 0, 0, { x0: -80, z0: -40, x1: 80, z1: -33 });
    },
  },

  {
    name: 'Stadium Lights', setting: 'city', theme: 'dusk',
    intro: 'Three floodlight towers, one timeline. All three have to land on the pitch, not in the stands.',
    hint: 'A falling tower goes toward the side you cut. Put charges on the pitch side of each base, two per tower.',
    maxCharges: 8, par: 6, stars: ['zone', 'budget', 'clean'],
    zone: [-30, -34, 30, -2], zoneReq: 0.6, downHeight: 5,
    camera: { target: [0, 8, -6], dist: 76, yaw: 0.2, pitch: 0.42 },
    build(b) {
      for (const x of [-18, 0, 18]) lightTower(b, x, 0);
      b.prop('stand', 0, 12, { w: 56, d: 12, protect: 'Grandstand' });
      b.prop('pitch', 0, 0, { x0: -32, z0: -36, x1: 32, z1: -2 });
    },
  },

  {
    name: 'Lighthouse', setting: 'coast', theme: 'dusk',
    intro: "Old brick again. Put it in the sea, not on the keeper's cottage or the boathouse.",
    hint: 'Two charges, side by side, on the side facing the sea.',
    maxCharges: 4, par: 2, minSupport: 0.3, stars: ['zone', 'budget', 'clean'],
    zone: [-5, 6, 5, 36], zoneReq: 0.5, downHeight: 6.5,
    camera: { target: [0, 9, 6], dist: 58, yaw: 0.35, pitch: 0.3 },
    build(b) {
      const white = 0xeeeae0;
      b.ring(0, 0, 2.6, 0, 3, 10, 0.7, 'brick', { rig: true, color: white });
      b.ring(0, 0, 2.6, 3, 3, 10, 0.7, 'brick', { color: white });
      for (let k = 0; k < 6; k++)
        b.cyl(0, 6 + 3 * k, 0, 2.9 - 0.1 * k, 3, 'brick', { role: 'wall', crush: 0.4, color: k % 2 ? 0xd9412b : 0xf2eee6 });
      b.cyl(0, 24, 0, 3.3, 0.4, 'steel', { role: 'slab', color: 0x333333 });
      b.cyl(0, 24.4, 0, 1.8, 2.6, 'steel', { role: 'clad', skin: 'lamp', color: 0xffffff });
      b.cone(0, 27, 0, 2.1, 1.8, 'steel', { color: 0xd9412b });
      b.prop('water', 0, 0, { x0: -700, z0: 6, x1: 700, z1: 700 });
      b.prop('house', -10, -2, { w: 7, d: 6, h: 3.5, protect: "Keeper's cottage", color: 0xf2eee6, roof: 0x3f5f7a });
      b.prop('shop', 11, 0.5, { w: 6, d: 6, h: 4, color: 0x8a6a4a, awning: 0x3f5f7a, protect: 'Boathouse' });
      b.prop('rocks', -6, 4, { n: 6 });
      b.prop('rocks', 5, -5, { n: 4 });
    },
  },

  {
    name: 'Flour Mill', theme: 'day',
    intro: "It's market day and the wind is blowing toward the stalls. Keep the flour dust off the shoppers.",
    hint: 'Blow the row of columns on the side away from the market. It falls that way and takes the dust with it.',
    maxCharges: 9, par: 3, stars: ['zone', 'clean', 'air'],
    zone: [-6, 4.5, 6, 30], zoneReq: 0.55, downHeight: 10, wind: [0, -3],
    camera: { target: [0, 9, -2], dist: 60, yaw: 0.4, pitch: 0.3 },
    build(b) {
      b.frame({ x0: -4, z0: -4, nx: 2, nz: 2, bay: 4, floors: 6, fh: 3.5, col: 0.6,
        rig: [0], clad: { mat: 'brick', color: 0x9c5a3c, skin: 'window' }, tag: 'mill' });
      b.box(0, 21, 0, 4, 3, 4, 'brick', { role: 'clad', color: 0x8a4a30 });
      b.prop('crowd', 0, -27, { w: 26, d: 6, n: 90, facing: 'north', protect: 'Market' });
      b.prop('stalls', 0, -21, { n: 5 });
      b.prop('warehouse', -15, 2, { w: 10, d: 16, h: 7, protect: 'Grain store' });
      b.prop('house', 13, 8, { protect: "Miller's house" });
      b.prop('dirt', 0, 0, { x0: -7, z0: -6, x1: 7, z1: 32, color: 0x9a8a68 });
    },
  },

  {
    name: 'Clock Tower', setting: 'city', theme: 'day',
    intro: 'The bottom three floors are a listed monument and have to stay. Only the top comes down, and you can only rig four columns.',
    hint: 'The two columns on the side facing the square. The top half tips into the square and leaves the bottom standing.',
    maxCharges: 4, par: 2, stars: ['zone', 'budget', 'clean'],
    zone: [-7, 4, 7, 34], zoneReq: 0.5, downHeight: 13,
    camera: { target: [0, 12, 6], dist: 58, yaw: 0.35, pitch: 0.3 },
    build(b) {
      b.frame({ x0: -3, z0: -3, nx: 1, nz: 1, bay: 6, floors: 8, fh: 3.5, col: 0.8,
        rig: [3], clad: { mat: 'brick', color: 0xb88a5a, skin: 'window' }, cladFrom: 0, tag: 'clk' });
      const y = 6 * 3.5 + 0.2, face = { role: 'clad', skin: 'clock', color: 0xffffff };
      b.box(0, y, -3.25, 3.2, 3.1, 0.2, 'steel', face);
      b.box(0, y, 3.25, 3.2, 3.1, 0.2, 'steel', face);
      b.box(-3.25, y, 0, 0.2, 3.1, 3.2, 'steel', face);
      b.box(3.25, y, 0, 0.2, 3.1, 3.2, 'steel', face);
      b.cone(0, 28, 0, 4.4, 4, 'steel', { color: 0x4f5663 });
      b.prop('shop', -13, 2, { w: 12, d: 14, h: 12, color: 0xd9cfbb, awning: 0x7a2b2b, protect: 'Town hall' });
      b.prop('shop', 11.5, 0, { w: 9, d: 8, h: 5, color: 0xe8b8a0, awning: 0x2f6b4f, protect: 'Café' });
      b.prop('pavement', 0, 0, { x0: -8, z0: -8, x1: 8, z1: 36 });
      for (const [x, z] of [[-9, 20], [9, 22], [-9, 32], [9, 32]]) b.prop('tree', x, z, { s: 0.9 });
    },
  },

  {
    name: 'Twin Apartments', setting: 'city', theme: 'night',
    intro: "Two apartment blocks with a playground between them. Both have to go tonight, and neither can touch the swings.",
    hint: 'Rig the outer row of each block, the sides facing away from the playground. Both tip outward.',
    maxCharges: 14, par: 10, stars: ['zone', 'budget', 'clean'],
    zones: [[-44, -11, -8.5, 11], [8.5, -11, 44, 11]], zoneReq: 0.6, downHeight: 9,
    camera: { target: [0, 10, 0], dist: 78, yaw: 0.15, pitch: 0.33 },
    build(b) {
      const common = { z0: -10, nx: 1, nz: 4, bay: 8, bayZ: 5, floors: 8, fh: 3.2, col: 0.6, rig: [0], glassGround: true };
      b.frame({ ...common, x0: -16, clad: { mat: 'concrete', color: 0xd9c7a8, skin: 'window' }, tag: 'a' });
      b.frame({ ...common, x0: 8, clad: { mat: 'concrete', color: 0xa8c1d9, skin: 'window' }, tag: 'b' });
      b.prop('playground', 0, 0, { w: 11, d: 14, protect: 'Playground' });
      b.prop('dirt', 0, 0, { x0: -46, z0: -13, x1: -9, z1: 13, color: 0x3d4a36 });
      b.prop('dirt', 0, 0, { x0: 9, z0: -13, x1: 46, z1: 13, color: 0x3d4a36 });
      b.prop('floodlight', -28, -18, { h: 10 });
      b.prop('floodlight', 28, 18, { h: 10 });
    },
  },

  {
    name: 'The Skyscraper', setting: 'city', theme: 'dusk',
    intro: 'Fourteen floors, a museum, an office tower and apartments packed around it, and the whole city watching. This is the big one.',
    hint: 'Implode it: the middle ground-floor columns at 0.0s and the rest about 0.3s later. Charges on floor 2 are optional.',
    maxCharges: 24, par: 16, maxDelay: 3, stars: ['zone', 'budget', 'clean'],
    zone: [-12, -10, 12, 10.5], zoneReq: 0.7, downHeight: 14, tv: true,
    camera: { target: [0, 16, 0], dist: 95, yaw: 0.35, pitch: 0.26 },
    build(b) {
      b.frame({ x0: -7.5, z0: -5, nx: 3, nz: 2, bay: 5, floors: 14, fh: 3.2, col: 0.9, slabT: 0.4,
        rig: [0, 1], clad: { mat: 'concrete', color: 0x9fb8cc, skin: 'window' }, glassGround: true, tag: 's' });
      b.prop('shop', -21, 0, { w: 14, d: 16, h: 12, color: 0xd9cfbb, awning: 0x7a2b2b, protect: 'Museum' });
      b.prop('shop', 22.5, 0, { w: 14, d: 14, h: 18, color: 0x7f8f9f, awning: 0x333333, protect: 'Office tower' });
      b.prop('shop', 0, 17.5, { w: 20, d: 12, h: 16, color: 0xc9a88a, awning: 0x2f6b4f, protect: 'Apartments' });
      b.prop('pavement', 0, 0, { x0: -30, z0: -14, x1: 30, z1: -5.5 });
      b.prop('road', 0, 0, { x0: -90, z0: -24, x1: 90, z1: -15 });
      b.prop('crowd', 0, -34, { w: 34, d: 6, n: 130, facing: 'north', protect: 'Crowd' });
      b.prop('van', -14, -28, {});
      b.prop('tv', -8, -27, {});
    },
  },
];
