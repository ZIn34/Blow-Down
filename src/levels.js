// The first ten jobs. North is +z; the default camera looks north from the south.
// zone: [x0, z0, x1, z1] target area on the ground.

import { CHAPTER2 } from './levels2.js';

const ADS = [0xf2c14e, 0xd94a4a, 0xf2c14e, 0x3a7bd5];

const CHAPTER1 = [
  {
    name: 'The Old Shed', theme: 'day',
    intro: 'Easy one to start. Tap the glowing spot on each post to place a charge, then hit the big red button.',
    hint: 'Put a charge on all four posts so the whole shack drops straight down.',
    maxCharges: 4, par: 4, stars: ['down', 'zone', 'budget'],
    zone: [-5, -5, 5, 5], zoneReq: 0.6, downHeight: 2.5,
    camera: { target: [0, 2, 0], dist: 16, yaw: 0.6, pitch: 0.35 },
    build(b) {
      [[-2, -1.5], [2, -1.5], [-2, 1.5], [2, 1.5]].forEach(([x, z], i) =>
        b.col(x, z, 0, 1.4, 0.35, 'wood', { rig: true, tag: 'post' + i }));
      b.slab(-2.3, -1.8, 2.3, 1.8, 1.4, 0.2, 'wood', 2.3);
      const w = { role: 'wall', color: 0x8b5e3c, crush: 0.75 };
      b.wall(-2.3, -1.8, 2.3, -1.8, 1.6, 2.4, 0.15, 'wood', 1.5, w);
      b.wall(-2.3, 1.8, 2.3, 1.8, 1.6, 2.4, 0.15, 'wood', 1.5, w);
      b.wall(-2.3, -1.8, -2.3, 1.8, 1.6, 2.4, 0.15, 'wood', 1.8, w);
      b.wall(2.3, -1.8, 2.3, 1.8, 1.6, 2.4, 0.15, 'wood', 1.8, w);
      b.slab(-2.7, -2.2, 2.7, 2.2, 4.0, 0.2, 'wood', 2.7, { color: 0x5b4636 });
      b.prop('dirt', 0, 0, { x0: -6, z0: -6, x1: 6, z1: 6 });
      b.prop('fence', 0, 0, { x0: -9, z0: 8, x1: 9, z1: 8 });
      for (const [x, z, s] of [[-10, 4, 1.2], [9, 5, 1], [-8, -9, 0.9], [12, -3, 1.3], [-14, -2, 1.1]]) b.prop('pine', x, z, { s });
    },
  },

  {
    name: 'Water Tower', theme: 'day',
    intro: "Tap a charge again to take it off. You won't always need to blow every leg.",
    hint: "You don't need to blow every leg. Take out the legs on one side and it'll tip that way.",
    maxCharges: 4, par: 2, stars: ['down', 'budget', 'clean'],
    zone: null, downHeight: 6.6,
    camera: { target: [0, 6, 0], dist: 34, yaw: 0.5, pitch: 0.3 },
    build(b) {
      for (const [x, z] of [[-2.5, -2.5], [2.5, -2.5], [-2.5, 2.5], [2.5, 2.5]]) {
        b.col(x, z, 0, 4, 0.5, 'steel', { rig: true });
        b.col(x, z, 4, 4, 0.5, 'steel');
      }
      const br = { role: 'clad', color: 0x5e6873 };
      b.box(0, 3.8, -2.5, 5, 0.4, 0.3, 'steel', br);
      b.box(0, 3.8, 2.5, 5, 0.4, 0.3, 'steel', br);
      b.box(-2.5, 3.8, 0, 0.3, 0.4, 5, 'steel', br);
      b.box(2.5, 3.8, 0, 0.3, 0.4, 5, 'steel', br);
      b.slab(-3.2, -3.2, 3.2, 3.2, 8, 0.4, 'steel', 3.2);
      b.cyl(0, 8.4, 0, 2.9, 4.5, 'steel', { role: 'wall', color: 0xc9d3db });
      b.cone(0, 12.9, 0, 3.1, 1.6, 'steel', { color: 0x8a949d });
      b.prop('dirt', 0, 0, { x0: -8, z0: -8, x1: 8, z1: 8, color: 0x9a8058 });
      b.prop('house', -26, 18, { color: 0xf0e6d0 });
      for (const [x, z] of [[-16, 6], [15, 10], [18, -6], [-12, -12], [8, 22]]) b.prop('tree', x, z, { s: 1.1 });
    },
  },

  {
    name: 'Farm Silo', theme: 'day',
    intro: 'See the green zone? A building falls toward the side you cut. Keep it off the barn.',
    hint: 'Put both charges on the side facing the zone, right next to each other.',
    maxCharges: 3, par: 2, blastRadius: 2.8, minSupport: 0.3, stars: ['zone', 'budget', 'clean'],
    zone: [3, -5.5, 23, 5.5], zoneReq: 0.55, downHeight: 6.6,
    camera: { target: [3, 6, 0], dist: 40, yaw: 0.15, pitch: 0.3 },
    build(b) {
      b.ring(0, 0, 2.6, 0, 3, 6, 0.5, 'concrete', { rig: true, color: 0xcfc8b8 });
      for (let k = 0; k < 4; k++) b.cyl(0, 3 + 3 * k, 0, 2.85, 3, 'concrete', { role: 'wall', color: k % 2 ? 0xd8d2c4 : 0xd0c9ba });
      b.cone(0, 15, 0, 3.0, 2.2, 'steel', { color: 0x8a939c });
      b.prop('barn', -17, 0, { protect: 'Barn' });
      b.prop('dirt', 12, 0, { x0: -6, z0: -8, x1: 26, z1: 8, color: 0x9a8058 });
      b.prop('fence', 0, 0, { x0: -24, z0: -12, x1: 28, z1: -12 });
      for (const [x, z] of [[-26, 10], [-8, 16], [14, 16], [30, 6], [30, -9]]) b.prop('tree', x, z, { s: 1.2 });
    },
  },

  {
    name: 'Highway Billboard', theme: 'day',
    intro: 'Look around before you rig anything. Drag to spin the camera.',
    hint: "Charges on the side facing the diner will drop it on the diner. Rig the far side so it falls into the field.",
    maxCharges: 3, par: 2, stars: ['zone', 'budget', 'clean'],
    zone: [-8, 2, 8, 20], zoneReq: 0.55, downHeight: 4,
    camera: { target: [0, 6, -3], dist: 38, yaw: 0.25, pitch: 0.3 },
    build(b) {
      for (const [x, z] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]])
        b.col(x, z, 0, 2.5, 0.5, 'steel', { rig: true, color: 0x6a737d });
      for (let k = 0; k < 3; k++) b.col(0, 0, 2.5 + 3 * k, 3, 1.1, 'steel');
      for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++)
        b.box(-4.5 + 3 * i, 11.5 + 2.25 * j, 0, 3, 2.25, 0.4, 'steel', { role: 'clad', color: ADS[(i + j) % 4] });
      b.prop('diner', 0, -12, { protect: 'Diner' });
      b.prop('lot', 0, 0, { x0: -14, z0: -20, x1: 14, z1: -16.5 });
      b.prop('road', 0, 0, { x0: -80, z0: -28, x1: 80, z1: -21 });
      b.prop('car', -8, -18.5, { color: 0x3a7bd5, along: 'z' });
      b.prop('car', 6, -18.5, { color: 0xf2c14e, along: 'z' });
      b.prop('dirt', 0, 0, { x0: -10, z0: 1, x1: 10, z1: 22, color: 0x94a45a });
      for (const [x, z] of [[-18, 6], [16, 12], [-14, 20], [20, -4]]) b.prop('tree', x, z, {});
    },
  },

  {
    name: 'Roadside Motel', theme: 'day',
    intro: "New tool: the timeline. Drag a charge's dot to choose when it goes off. Front row first and it folds forward into the lot.",
    hint: 'Front row (the side facing the lot) at 0.0s. If you rig the back row too, give it about 0.8s so the front has time to fold.',
    maxCharges: 12, par: 8, stars: ['zone', 'budget', 'clean'],
    zone: [-11, -13, 11, 0.5], zoneReq: 0.6, downHeight: 3.6,
    camera: { target: [0, 3, -3], dist: 36, yaw: 0.5, pitch: 0.38 },
    build(b) {
      b.frame({ x0: -10, z0: -3, nx: 5, nz: 1, bay: 4, bayZ: 6, floors: 2, fh: 3.2, col: 0.5, slabT: 0.35,
        rig: [0], clad: { mat: 'brick', color: 0xe9d7b5, skin: 'window' }, glassGround: true, tag: 'm' });
      b.prop('pool', 0, 10.5, { protect: 'Pool' });
      b.prop('lot', 0, 0, { x0: -14, z0: -16, x1: 14, z1: -4 });
      b.prop('road', 0, 0, { x0: -80, z0: -26, x1: 80, z1: -19 });
      b.prop('car', -9, -13.5, { color: 0x4caf50, along: 'z' });
      b.prop('car', 9, -13.5, { color: 0xd94a4a, along: 'z' });
      for (const [x, z] of [[-16, 6], [16, 8], [-18, 16], [14, 18]]) b.prop('tree', x, z, {});
    },
  },

  {
    name: 'Corner Bank', theme: 'day',
    intro: 'No room to tip this one. Blow the middle columns first and it caves in on itself.',
    hint: 'The two middle columns at 0.0s, then the outer ones about 0.3s later. You only need 8 charges.',
    maxCharges: 12, par: 8, stars: ['zone', 'budget', 'clean'],
    zone: [-8.3, -8, 8.3, 6.3], zoneReq: 0.7, downHeight: 6,
    camera: { target: [0, 5, 0], dist: 40, yaw: 0.35, pitch: 0.35 },
    build(b) {
      b.frame({ x0: -6, z0: -4, nx: 3, nz: 2, bay: 4, floors: 4, fh: 3.4, col: 0.6,
        rig: [0], clad: { mat: 'concrete', color: 0xd9d2c3, skin: 'window' }, glassGround: true, tag: 'b' });
      b.prop('shop', -15.3, 0, { w: 10, d: 10, h: 7, color: 0xc98f5a, protect: 'Bakery' });
      b.prop('shop', 15.3, 0, { w: 10, d: 10, h: 6, color: 0x7fa3c4, awning: 0xd94a4a, protect: 'Barber' });
      b.prop('shop', 0, 13.3, { w: 16, d: 10, h: 9, color: 0xb9b2a6, awning: 0x555555, protect: 'Offices' });
      b.prop('pavement', 0, 0, { x0: -30, z0: -9, x1: 30, z1: -4.4 });
      b.prop('road', 0, 0, { x0: -80, z0: -17, x1: 80, z1: -9 });
      b.prop('car', -16, -11, { color: 0xf2c14e });
      b.prop('car', 17, -15, { color: 0x333333 });
    },
  },

  {
    name: 'Brick Chimney', theme: 'dusk',
    intro: 'Old brick crumbles. Too much bang and it goes wherever it likes. Drop it down the gap.',
    hint: 'Two charges, side by side, on the side facing up the gap. It falls like a tree.',
    maxCharges: 4, par: 2, minSupport: 0.3, stars: ['zone', 'budget', 'clean'],
    zone: [-4.8, 2.5, 4.8, 32], zoneReq: 0.5, downHeight: 6.5,
    camera: { target: [0, 8, 8], dist: 52, yaw: 0.3, pitch: 0.42 },
    build(b) {
      b.ring(0, 0, 2.0, 0, 2.5, 8, 0.6, 'brick', { rig: true });
      b.ring(0, 0, 2.0, 2.5, 2.5, 8, 0.6, 'brick');
      for (let k = 0; k < 7; k++)
        b.cyl(0, 5 + 2.8 * k, 0, 2.25 - k * 0.13, 2.8, 'brick', { role: 'wall', crush: 0.55, color: k % 2 ? 0xa0523a : 0x96492f });
      b.cyl(0, 24.6, 0, 1.55, 0.6, 'concrete', { role: 'slab', color: 0x4a4a4a });
      b.prop('warehouse', -11, 11, { d: 30, protect: 'West warehouse', doorSide: 1 });
      b.prop('warehouse', 11, 11, { d: 30, color: 0x9aa7a0, protect: 'East warehouse', doorSide: -1 });
      b.prop('dirt', 0, 0, { x0: -5, z0: -4, x1: 5, z1: 34, color: 0x7d7468 });
      for (const [x, z] of [[-20, -6], [20, -8], [-6, -14], [9, -16]]) b.prop('tree', x, z, {});
    },
  },

  {
    name: 'Parking Garage', theme: 'day',
    intro: "The shops downstairs are still open, so nothing goes on the ground floor. Rig the floors above. And mind that news van.",
    hint: 'Rig every column on floor 1 and fire them all together. It drops straight onto the ground floor. If one side goes first, it lurches onto the van.',
    maxCharges: 8, par: 6, stars: ['zone', 'budget', 'clean'],
    zone: [-8.6, -5.4, 8.6, 5.6], zoneReq: 0.7, downHeight: 8,
    camera: { target: [0, 6, 0], dist: 38, yaw: 0.6, pitch: 0.35 },
    build(b) {
      b.frame({ x0: -7, z0: -3.5, nx: 2, nz: 1, bay: 7, floors: 5, fh: 3, col: 0.7, slabT: 0.4,
        rig: [1, 2], glassGround: true, tag: 'g', color: 0xc4c0b6 });
      // edge beams / parapets around each deck
      const e = { role: 'clad', color: 0xd9d5cc };
      for (let f = 1; f <= 5; f++) {
        const y = f * 3 - 0.4;
        b.box(0, y, -3.5 - 0.35 - 0.15, 14.7, 1.4, 0.3, 'concrete', e);
        b.box(0, y, 3.5 + 0.35 + 0.15, 14.7, 1.4, 0.3, 'concrete', e);
        b.box(-7 - 0.35 - 0.15, y, 0, 0.3, 1.4, 7.7, 'concrete', e);
        b.box(7 + 0.35 + 0.15, y, 0, 0.3, 1.4, 7.7, 'concrete', e);
      }
      b.prop('van', 3, -8.4, { protect: 'News van' });
      b.prop('shop', 0, 12.3, { w: 16, d: 10, h: 6, color: 0xd98fa0, awning: 0xf2c14e, protect: 'Florist' });
      b.prop('pavement', 0, 0, { x0: -30, z0: -11, x1: 30, z1: -4.2 });
      b.prop('road', 0, 0, { x0: -80, z0: -19, x1: 80, z1: -11 });
      b.prop('tv', 7, -12.5, {});
    },
  },

  {
    name: 'Grain Elevator', theme: 'night',
    intro: "Night job with a crowd. The wind's blowing toward them, so keep the dust off.",
    hint: 'One charge on the side of each silo facing away from the crowd. It falls away from them, and the dust lands too far off to reach them.',
    maxCharges: 6, par: 4, blastRadius: 2.8, minSupport: 0.3, stars: ['zone', 'clean', 'air'],
    zone: [-13, 2, 13, 24], zoneReq: 0.55, downHeight: 7.5, wind: [0, -3.5],
    camera: { target: [0, 7, -2], dist: 50, yaw: 0.45, pitch: 0.3 },
    build(b) {
      for (const x of [-8.55, -2.85, 2.85, 8.55]) {
        b.ring(x, 0, 2.6, 0, 3, 6, 0.5, 'concrete', { rig: true, color: 0xcfc8b8 });
        for (let k = 0; k < 4; k++) b.cyl(x, 3 + 3 * k, 0, 2.85, 3, 'concrete', { role: 'wall', color: 0xd3ccbd });
      }
      b.slab(-11.4, -2.85, 11.4, 2.85, 15, 0.4, 'concrete', 5.7);
      b.wall(-6, -2.2, 6, -2.2, 15.4, 3, 0.3, 'steel', 3, { role: 'clad', skin: 'window', color: 0xb8b0a0 });
      b.wall(-6, 2.2, 6, 2.2, 15.4, 3, 0.3, 'steel', 3, { role: 'clad', skin: 'window', color: 0xb8b0a0 });
      b.wall(-6, -2.2, -6, 2.2, 15.4, 3, 0.3, 'steel', 4.4, { role: 'clad', color: 0xb8b0a0 });
      b.wall(6, -2.2, 6, 2.2, 15.4, 3, 0.3, 'steel', 4.4, { role: 'clad', color: 0xb8b0a0 });
      b.slab(-6.3, -2.5, 6.3, 2.5, 18.4, 0.3, 'steel', 4.2, { color: 0x6d747c });
      b.prop('crowd', 0, -24, { w: 26, d: 5, n: 90, facing: 'north', protect: 'Crowd' });
      b.prop('floodlight', -15, -12, { h: 12 });
      b.prop('floodlight', 15, -12, { h: 12 });
      b.prop('dirt', 0, 0, { x0: -14, z0: -6, x1: 14, z1: 26, color: 0x5d5446 });
    },
  },

  {
    name: 'The Grand Hotel', theme: 'dusk',
    intro: "Live TV. A hundred-year-old church on one side, parked cars on the other. Don't embarrass me.",
    hint: 'Middle columns first and the rest about 0.3s later, and it caves in. Or fire the street side first so it leans away from the church.',
    maxCharges: 24, par: 16, maxDelay: 3, stars: ['zone', 'budget', 'clean'],
    zone: [-10, -8.5, 12, 8.5], zoneReq: 0.7, downHeight: 10, tv: true,
    camera: { target: [0, 12, 0], dist: 72, yaw: 0.35, pitch: 0.26 },
    build(b) {
      b.frame({ x0: -7.5, z0: -5, nx: 3, nz: 2, bay: 5, floors: 10, fh: 3.2, col: 0.8, slabT: 0.4,
        rig: [0, 1], clad: { mat: 'brick', color: 0xe6d3b0, skin: 'window' }, glassGround: true, tag: 'h' });
      b.box(0, 32, -4.6, 9, 2.2, 0.4, 'steel', { role: 'clad', color: 0xc0392b });
      b.prop('church', -17, 3, { protect: 'Church' });
      b.prop('road', 0, 0, { x0: 13, z0: -80, x1: 21, z1: 80 });
      b.prop('pavement', 0, 0, { x0: -30, z0: -9, x1: 13, z1: -5.5 });
      b.prop('car', 14.6, -3, { color: 0x3a7bd5, along: 'z', protect: 'Parked car' });
      b.prop('car', 14.6, 6, { color: 0xf2f2f2, along: 'z', protect: 'Parked car' });
      b.prop('crowd', 0, -28, { w: 30, d: 6, n: 120, facing: 'north', protect: 'Crowd' });
      b.prop('van', -12, -21, {});
      b.prop('tv', -6, -20, {});
    },
  },
];

export const LEVELS = [...CHAPTER1, ...CHAPTER2];

export const CHAPTERS = [
  { from: 0, name: 'Chapter 1 · Local jobs' },
  { from: CHAPTER1.length, name: 'Chapter 2 · Big contracts' },
];
