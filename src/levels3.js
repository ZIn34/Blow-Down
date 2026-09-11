// Chapter 3: world tour. Stranger structures: steel pylons over a river, a gasholder
// cage, a pagoda, an offshore rig, a castle, and a pair of linked skyscrapers.

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
  b.cyl(cx, 8.4, cz, 2.9, 4.5, 'steel', { role: 'wall', color: 0xd9c9a8 });
  b.cone(cx, 12.9, cz, 3.1, 1.6, 'steel', { color: 0x8a5a44 });
}

function pylon(b, x) {
  for (const z of [-4, 4]) for (let k = 0; k < 5; k++) b.col(x, z, 5 * k, 5, 1.2, 'steel', { rig: k === 0, color: 0x8a949d });
  for (const y of [11.6, 23.6]) b.box(x, y, 0, 1, 1.2, 8, 'steel', { role: 'clad', color: 0x6d747c });
  b.box(x, 25, 0, 1.4, 0.8, 11, 'steel', { role: 'clad', color: 0x6d747c });
}

function chimney(b, cx) {
  b.ring(cx, 0, 1.8, 0, 2.5, 8, 0.6, 'brick', { rig: true });
  b.ring(cx, 0, 1.8, 2.5, 2.5, 8, 0.6, 'brick');
  for (let k = 0; k < 5; k++)
    b.cyl(cx, 5 + 2.8 * k, 0, 2.05 - k * 0.12, 2.8, 'brick', { role: 'wall', crush: 0.55, color: k % 2 ? 0xa0523a : 0x96492f });
  b.cyl(cx, 19, 0, 1.45, 0.6, 'concrete', { role: 'slab', color: 0x4a4a4a });
}

const TRIO = [90, 210, 330].map(a => {
  const r = a * Math.PI / 180;
  return { x: Math.cos(r) * 12, z: Math.sin(r) * 12, dx: Math.cos(r), dz: Math.sin(r) };
});

export const CHAPTER3 = [
  {
    name: 'Pylon Pair', theme: 'dusk',
    intro: 'Two steel pylons by the river. The village is on this side, so both have to go in the water.',
    hint: 'One charge per pylon, on the leg nearest the river.',
    maxCharges: 4, par: 2, stars: ['down', 'zone', 'budget'],
    zone: [-20, 9, 20, 36], zoneReq: 0.55, downHeight: 5,
    camera: { target: [0, 10, 4], dist: 72, yaw: 0.3, pitch: 0.3 },
    build(b) {
      pylon(b, -12);
      pylon(b, 12);
      b.prop('water', 0, 0, { x0: -90, z0: 8, x1: 90, z1: 40 });
      b.prop('house', -13, -15, { protect: 'Cottage', color: 0xf0e6d0 });
      b.prop('shop', 0, -17, { w: 9, d: 7, h: 5, color: 0xd98f5a, protect: 'Post office' });
      b.prop('house', 13, -15, { protect: 'Pub', color: 0xe9dcc3, roof: 0x3f5f7a });
      for (const [x, z] of [[-26, -8], [26, -6], [-30, 2], [30, 3]]) b.prop('tree', x, z, {});
    },
  },

  {
    name: 'Gasholder', theme: 'day',
    intro: 'A steel cage with houses all round. Each charge takes out its column and the two beside it.',
    hint: 'Six charges, on every third column. That takes out all sixteen and it drops straight in.',
    maxCharges: 7, par: 6, blastRadius: 5, minSupport: 0.2, stars: ['down', 'zone', 'budget'],
    zone: [-14, -14, 14, 14], zoneReq: 0.75, downHeight: 5,
    camera: { target: [0, 8, 0], dist: 72, yaw: 0.4, pitch: 0.38 },
    build(b) {
      const N = 16, R = 12;
      for (let i = 0; i < N; i++) {
        const a = (i + 0.5) / N * Math.PI * 2;
        for (let k = 0; k < 3; k++) b.col(R * Math.cos(a), R * Math.sin(a), 6 * k, 6, 0.8, 'steel', { rig: k === 0, color: 0x6b7f8f });
      }
      for (let k = 1; k <= 3; k++) b.ring(0, 0, R, 6 * k - 0.5, 1, N, 0.5, 'steel', { role: 'clad', color: 0x566a7a });
      b.prop('dirt', 0, 0, { x0: -15, z0: -15, x1: 15, z1: 15, color: 0x7d7468 });
      for (const [a, name] of [[45, 'Terrace'], [135, 'Corner shop'], [225, 'Allotment shed'], [315, 'Bungalow']]) {
        const r = a * Math.PI / 180;
        b.prop('house', Math.cos(r) * 22, Math.sin(r) * 22, { protect: name, w: 7, d: 7 });
      }
    },
  },

  {
    name: 'Pagoda', theme: 'dusk',
    intro: 'Five tiers of old timber. Into the pond, please, and nowhere near the shrine or the tea house.',
    hint: 'Two charges, on the posts on the pond side.',
    maxCharges: 4, par: 2, stars: ['down', 'zone', 'budget'],
    zone: [-9, -28, 9, -5], zoneReq: 0.5, downHeight: 7,
    camera: { target: [0, 8, -4], dist: 56, yaw: 0.55, pitch: 0.3 },
    build(b) {
      let y = 0;
      for (let k = 0; k < 5; k++) {
        const s = 3.6 - k * 0.55, h = 3.2;
        for (const [x, z] of [[-s, -s], [s, -s], [-s, s], [s, s]]) b.col(x, z, y, h, 0.5, 'wood', { rig: k === 0, color: 0x8e2b22 });
        const wall = { role: 'clad', color: 0xe6cf9f };
        b.box(0, y, -s, 2 * s - 0.5, h, 0.2, 'wood', wall);
        b.box(0, y, s, 2 * s - 0.5, h, 0.2, 'wood', wall);
        b.box(-s, y, 0, 0.2, h, 2 * s - 0.5, 'wood', wall);
        b.box(s, y, 0, 0.2, h, 2 * s - 0.5, 'wood', wall);
        const e = s + 1.7;
        b.slab(-e, -e, e, e, y + h, 0.4, 'wood', e, { color: 0x3d4a3a });
        y += h + 0.4;
      }
      b.cyl(0, y, 0, 0.25, 4, 'steel', { role: 'wall', color: 0xd4af37 });
      b.prop('water', 0, 0, { x0: -12, z0: -30, x1: 12, z1: -6 });
      b.prop('house', 15, 0, { w: 8, d: 8, h: 4, protect: 'Shrine', color: 0xd9412b, roof: 0x3d4a3a });
      b.prop('house', -15, 0, { w: 8, d: 7, h: 3.5, protect: 'Tea house', color: 0xf2eee6, roof: 0x3d4a3a });
      b.prop('shop', 0, 14, { w: 10, d: 4, h: 6, color: 0xd9412b, awning: 0x3d4a3a, protect: 'Temple gate' });
      for (const [x, z] of [[-10, 12], [10, 12], [-20, -12], [20, -12]]) b.prop('tree', x, z, { color: 0xd98fa0 });
    },
  },

  {
    name: 'Twin Chimneys', theme: 'day',
    intro: 'Two old brick chimneys, one alley between the warehouses. They have to fall side by side, not into each other.',
    hint: 'Two charges on each chimney, on the side facing up the alley.',
    maxCharges: 6, par: 4, minSupport: 0.3, stars: ['down', 'zone', 'budget'],
    zone: [-8.5, 3, 8.5, 34], zoneReq: 0.55, downHeight: 5.5,
    camera: { target: [0, 7, 8], dist: 56, yaw: 0.3, pitch: 0.38 },
    build(b) {
      chimney(b, -5);
      chimney(b, 5);
      b.prop('warehouse', -15, 16, { d: 34, protect: 'West warehouse', doorSide: 1 });
      b.prop('warehouse', 15, 16, { d: 34, color: 0x9aa7a0, protect: 'East warehouse', doorSide: -1 });
      b.prop('shop', 0, -14, { w: 16, d: 8, h: 6, color: 0xb9b2a6, awning: 0x7a2b2b, protect: 'Factory office' });
      b.prop('dirt', 0, 0, { x0: -9, z0: -5, x1: 9, z1: 36, color: 0x7d7468 });
    },
  },

  {
    name: 'Offshore Rig', setting: 'coast', theme: 'day',
    intro: "An old oil platform. It's all sea out here, but the supply ship is moored on one side.",
    hint: 'Blow the two legs on the far side from the ship.',
    maxCharges: 4, par: 2, stars: ['down', 'zone', 'budget'],
    zone: [-36, -13, 1, 13], zoneReq: 0.55, downHeight: 8,
    camera: { target: [-4, 10, 0], dist: 70, yaw: 0.45, pitch: 0.32 },
    build(b) {
      for (const [x, z] of [[-5, -5], [5, -5], [-5, 5], [5, 5]])
        for (let k = 0; k < 3; k++) b.col(x, z, 5 * k, 5, 1.2, 'steel', { rig: k === 0, color: 0xd9a441 });
      const br = { role: 'clad', color: 0x8a6a2a };
      for (const y of [4.6, 9.6]) {
        b.box(0, y, -5, 10, 0.6, 0.5, 'steel', br);
        b.box(0, y, 5, 10, 0.6, 0.5, 'steel', br);
        b.box(-5, y, 0, 0.5, 0.6, 10, 'steel', br);
        b.box(5, y, 0, 0.5, 0.6, 10, 'steel', br);
      }
      b.slab(-8, -8, 8, 8, 15, 0.8, 'steel', 4, { color: 0x5d6770 });
      b.box(-3, 15.8, -3, 6, 4, 6, 'steel', { role: 'clad', color: 0xd9a441 });
      b.box(4, 15.8, 3, 5, 3, 7, 'steel', { role: 'clad', color: 0xcfd6dc, skin: 'window' });
      b.col(4, -4, 15.8, 12, 1, 'steel', { role: 'clad', color: 0xd94a2b });
      b.prop('water', 0, 0, { x0: -400, z0: -400, x1: 400, z1: 400 });
      b.prop('ship', 14, 0, { protect: 'Supply ship' });
    },
  },

  {
    name: 'Castle Keep', theme: 'dusk',
    intro: 'Solid stone walls a metre thick, and a moat on one side. It will only tip if you cut away enough of the moat side.',
    hint: "The whole moat-side wall, plus the front two panels of each side wall. That's eight.",
    maxCharges: 10, par: 8, stars: ['down', 'zone', 'budget'],
    zone: [-10, -30, 10, 0], zoneReq: 0.5, downHeight: 6,
    camera: { target: [0, 8, -6], dist: 64, yaw: 0.55, pitch: 0.33 },
    build(b) {
      const S = 6, T = 1.2, stone = { color: 0x9a9384 };
      for (const z of [-S, S]) {
        b.wall(-S - T / 2, z, S + T / 2, z, 0, 4, T, 'brick', 3.3, { ...stone, rig: true });
        b.wall(-S - T / 2, z, S + T / 2, z, 4, 12, T, 'brick', 3.3, { ...stone, panelH: 4 });
      }
      for (const x of [-S, S]) {
        b.wall(x, -S + T / 2, x, S - T / 2, 0, 4, T, 'brick', 3.6, { ...stone, rig: true });
        b.wall(x, -S + T / 2, x, S - T / 2, 4, 12, T, 'brick', 3.6, { ...stone, panelH: 4 });
      }
      for (const y of [4, 8, 12]) b.slab(-S + T / 2, -S + T / 2, S - T / 2, S - T / 2, y - 0.4, 0.4, 'wood', 5.4, { color: 0x6b4a33 });
      const bat = { role: 'clad', color: 0x8a8374 };
      for (let i = -2; i <= 2; i++) {
        b.box(i * 2.9, 16, -S, 1.2, 1.1, T, 'brick', bat);
        b.box(i * 2.9, 16, S, 1.2, 1.1, T, 'brick', bat);
      }
      b.prop('water', 0, 0, { x0: -14, z0: -32, x1: 14, z1: -7.5 });
      b.prop('church', 0, 24, { protect: 'Chapel' });
      b.prop('house', 20, 3, { protect: 'Tavern', color: 0xe9dcc3, roof: 0x5a3a2a });
      b.prop('barn', -20, 3, { protect: 'Stables' });
    },
  },

  {
    name: 'Tight Squeeze', setting: 'city', theme: 'day',
    intro: 'Eight floors crammed between two taller buildings, with a school out the back. The only way out is the street.',
    hint: 'Just the two front columns. It tips forward into the street.',
    maxCharges: 4, par: 2, stars: ['down', 'zone', 'budget'],
    zone: [-6.5, -34, 6.5, 4.5], zoneReq: 0.55, downHeight: 10,
    camera: { target: [0, 10, -8], dist: 66, yaw: 0.55, pitch: 0.3 },
    build(b) {
      b.frame({ x0: -3, z0: -4, nx: 1, nz: 1, bay: 6, bayZ: 8, floors: 8, fh: 3.2, col: 0.6,
        rig: [0], clad: { mat: 'brick', color: 0xc49a74, skin: 'window' }, glassGround: true, tag: 'sq' });
      b.prop('shop', -12, 0, { w: 12, d: 14, h: 30, color: 0xb9b2a6, awning: 0x333333, protect: 'Apartments' });
      b.prop('shop', 12, 0, { w: 12, d: 14, h: 26, color: 0x8fb0c9, awning: 0x7a2b2b, protect: 'Hotel' });
      b.prop('shop', 0, 16.5, { w: 18, d: 10, h: 8, color: 0xe8c07a, awning: 0x2f6b4f, protect: 'School' });
      b.prop('road', 0, 0, { x0: -80, z0: -36, x1: 80, z1: -5 });
    },
  },

  {
    name: 'Tower Trio', theme: 'day',
    intro: 'Three water towers around one farmhouse. All three have to fall away from it.',
    hint: 'On each tower, the two legs furthest from the house.',
    maxCharges: 9, par: 6, stars: ['down', 'zone', 'budget'],
    zones: TRIO.map(t => [t.x + t.dx * 9 - 7.5, t.z + t.dz * 9 - 7.5, t.x + t.dx * 9 + 7.5, t.z + t.dz * 9 + 7.5]),
    zoneReq: 0.5, downHeight: 6.6,
    camera: { target: [0, 6, 0], dist: 68, yaw: 0.2, pitch: 0.42 },
    build(b) {
      for (const t of TRIO) waterTower(b, t.x, t.z);
      b.prop('house', 0, 0, { protect: 'Farmhouse', color: 0xf0e6d0 });
      b.prop('dirt', 0, 0, { x0: -30, z0: -24, x1: 30, z1: 34, color: 0x9a8058 });
    },
  },

  {
    name: 'Mall Tower', setting: 'city', theme: 'dusk',
    intro: 'A shopping mall with an eight-storey tower stacked on one end. All the weight is on one side.',
    hint: 'Middle podium columns first, the rest about 0.3s later. Blow one side on its own and the tower drags it over.',
    maxCharges: 18, par: 15, stars: ['down', 'zone', 'budget'],
    zone: [-15.5, -9.5, 15.5, 9.5], zoneReq: 0.7, downHeight: 8,
    camera: { target: [0, 12, 0], dist: 88, yaw: 0.4, pitch: 0.28 },
    build(b) {
      b.frame({ x0: -12, z0: -6, nx: 4, nz: 2, bay: 6, floors: 2, fh: 4, col: 0.8,
        rig: [0], clad: { mat: 'concrete', color: 0xe0d6c4, skin: 'window' }, glassGround: true, tag: 'mall' });
      b.frame({ x0: 0, z0: -6, nx: 2, nz: 2, bay: 6, floors: 8, fh: 3.2, col: 0.8, base: 8,
        rig: [], clad: { mat: 'concrete', color: 0x9fb8cc, skin: 'window' }, cladFrom: 0, tag: 'mt' });
      b.prop('shop', -24, 0, { w: 12, d: 14, h: 10, color: 0x7a5a8a, awning: 0xf2c14e, protect: 'Cinema' });
      b.prop('shop', 25, 0, { w: 10, d: 12, h: 6, color: 0x8fb0c9, awning: 0x333333, protect: 'Bus station' });
      b.prop('shop', 0, 18, { w: 26, d: 12, h: 8, color: 0xb9b2a6, awning: 0x555555, protect: 'Car park' });
      b.prop('pavement', 0, 0, { x0: -30, z0: -14, x1: 30, z1: -6.4 });
      b.prop('road', 0, 0, { x0: -90, z0: -24, x1: 90, z1: -15 });
    },
  },

  {
    name: 'Twin Spires', setting: 'city', theme: 'night',
    intro: 'Two ten-storey towers joined by a skybridge, and a crowd out front. They come down together or not at all.',
    hint: 'Implode both: the middle column of each tower at 0.0s, then every other ground-floor column about 0.3s later.',
    maxCharges: 24, par: 18, maxDelay: 3, stars: ['down', 'zone', 'budget'],
    zone: [-18, -8.5, 18, 8.5], zoneReq: 0.7, downHeight: 10, tv: true,
    camera: { target: [0, 14, 0], dist: 100, yaw: 0.3, pitch: 0.26 },
    build(b) {
      const tower = (x0, color, tag) => b.frame({ x0, z0: -5, nx: 2, nz: 2, bay: 5, floors: 10, fh: 3.2, col: 0.7,
        rig: [0], clad: { mat: 'concrete', color, skin: 'window' }, glassGround: true, tag });
      tower(-14, 0xc9c1b4, 'ta');
      tower(4, 0xb8c4cc, 'tb');
      b.slab(-3.65, -2, 3.65, 2, 18.8, 0.4, 'concrete', 3.7);
      b.box(0, 19.2, -1.9, 7.3, 2.8, 0.2, 'glass', { role: 'clad' });
      b.box(0, 19.2, 1.9, 7.3, 2.8, 0.2, 'glass', { role: 'clad' });
      b.slab(-3.65, -2, 3.65, 2, 22, 0.4, 'concrete', 3.7);
      b.prop('shop', -27, 0, { w: 14, d: 16, h: 12, color: 0xd9cfbb, awning: 0x7a2b2b, protect: 'Museum' });
      b.prop('shop', 27, 0, { w: 14, d: 14, h: 16, color: 0x7f8f9f, awning: 0x333333, protect: 'Bank' });
      b.prop('shop', 0, 18, { w: 34, d: 12, h: 14, color: 0xc9a88a, awning: 0x2f6b4f, protect: 'Apartments' });
      b.prop('pavement', 0, 0, { x0: -34, z0: -14, x1: 34, z1: -5.5 });
      b.prop('road', 0, 0, { x0: -90, z0: -24, x1: 90, z1: -15 });
      b.prop('crowd', 0, -34, { w: 40, d: 6, n: 140, facing: 'north', protect: 'Crowd' });
      b.prop('floodlight', -22, -26, { h: 11 });
      b.prop('floodlight', 22, -26, { h: 11 });
    },
  },
];
