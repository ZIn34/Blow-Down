// A known good rig and a known bad rig for every hand-made job, as
// [label, levelIndex, rig, shouldGet3Stars]. A rig is [[filter, delay, type?], ...],
// where filter picks charge spots. Used by the tuning harness, and the first good
// rig of each level is the "designed solution" Sparky can show you.

const mid = c => c.gj === 1 && c.gi > 0 && c.gi < 3;

export const CASES = [
  ['1 good: all four posts', 0, [[c => true, 0]], true],
  ['2 good: east pair', 1, [[c => c.x > 0, 0]], true],
  ['2 bad: west pair, off the field', 1, [[c => c.x < 0, 0]], false],
  ['3 good: two east segments', 2, [[c => c.x > 1, 0]], true],
  ['3 bad: west, onto barn', 2, [[c => c.x < -1, 0]], false],
  ['4 good: north pair', 3, [[c => c.z > 0, 0]], true],
  ['4 bad: south pair, onto diner', 3, [[c => c.z < 0, 0]], false],
  ['5 good: front row', 4, [[c => c.gj === 0, 0]], true],
  ['5 bad: back row, into pool', 4, [[c => c.gj === 1, 0]], false],
  ['6 good: middle first, 8', 5, [[mid, 0], [c => c.gj !== 1 && c.gi > 0 && c.gi < 3, 0.3], [c => c.gj === 1 && (c.gi === 0 || c.gi === 3), 0.3]], true],
  ['6 bad: west half only, tips', 5, [[c => c.gi <= 1, 0]], false],
  ['7 good: two north segments', 6, [[c => c.z > 1.5, 0]], true],
  ['7 bad: four charges', 6, [[c => true, 0]], false],
  ['8 good: all of floor 1', 7, [[c => c.floor === 1, 0]], true],
  ['8 bad: floor 1 front only', 7, [[c => c.floor === 1 && c.gj === 0, 0]], false],
  ['9 good: far side of each silo', 8, [[c => c.z > 2, 0]], true],
  ['9 bad: crowd side', 8, [[c => c.z < -2, 0]], false],
  ['10 good: middle first', 9, [[c => c.floor === 0 && mid(c), 0], [c => c.floor === 0 && !mid(c), 0.3]], true],
  ['10 good: east first', 9, [[c => c.floor === 0 && c.gi >= 2, 0], [c => c.floor === 0 && c.gi < 2, 0.3]], true],
  ['10 bad: west only, onto church', 9, [[c => c.floor === 0 && c.gi < 2, 0]], false],
  ['11 good: outer legs of both', 10, [[c => Math.abs(c.x) > 11, 0]], true],
  ['11 bad: inner legs, onto house', 10, [[c => Math.abs(c.x) < 9, 0]], false],
  ['12 good: both strip-side legs', 11, [[c => c.x > 0, 0]], true],
  ['12 bad: one leg, goes diagonal', 11, [[c => c.x > 0 && c.z > 0, 0]], false],
  ['13 good: every third leg', 12, [[(c, i) => i % 3 === 0, 0]], true],
  ['13 bad: three bunched, tips', 12, [[(c, i) => i === 0 || i === 3 || i === 6, 0]], false],
  ['13 bad: three spread, still standing', 12, [[(c, i) => i % 4 === 0, 0]], false],
  ['14 good: front row, tips into lot', 13, [[c => c.gj === 0, 0]], true],
  ['14 bad: back row, onto train', 13, [[c => c.gj === 1, 0]], false],
  ['15 good: pitch side of each base', 14, [[c => c.z < 0, 0]], true],
  ['15 bad: stand side', 14, [[c => c.z > 0, 0]], false],
  ['16 good: two sea-side segments', 15, [[c => c.z > 1.5 && Math.abs(c.x) > 0.5, 0]], true],
  ['16 bad: cottage side', 15, [[c => c.x < -1.5, 0]], false],
  ['17 good: far row from market', 16, [[c => c.gj === 2, 0]], true],
  ['17 bad: market row', 16, [[c => c.gj === 0, 0]], false],
  ['18 good: square-side pair', 17, [[c => c.gj === 1, 0]], true],
  ['18 bad: café-side pair', 17, [[c => c.gi === 1, 0]], false],
  ['19 good: outer rows', 18, [[c => Math.abs(c.x) > 12, 0]], true],
  ['19 bad: inner rows, playground', 18, [[c => Math.abs(c.x) < 12, 0]], false],
  ['20 good: middle first', 19, [[c => c.floor === 0 && mid(c), 0], [c => c.floor === 0 && !mid(c), 0.3]], true],
  ['20 bad: west only', 19, [[c => c.floor === 0 && c.gi < 2, 0]], false],
  // chapter 3
  ['21 good: river-side legs', 20, [[c => c.z > 0, 0]], true],
  ['21 bad: village-side legs', 20, [[c => c.z < 0, 0]], false],
  ['22 good: every third column', 21, [[(c, i) => i % 3 === 0, 0]], true],
  ['22 bad: every fourth, still standing', 21, [[(c, i) => i % 4 === 0, 0]], false],
  ['23 good: pond-side posts', 22, [[c => c.z < 0, 0]], true],
  ['23 bad: gate-side posts', 22, [[c => c.z > 0, 0]], false],
  ['24 good: alley side of both', 23, [[c => c.z > 1.5 && Math.abs(c.x - Math.sign(c.x) * 5) > 0.5, 0]], true],
  ['24 bad: into each other', 23, [[c => Math.abs(c.z) < 1 && Math.abs(c.x) < 4, 0]], false],
  ['25 good: legs away from ship', 24, [[c => c.x < 0, 0]], true],
  ['25 bad: ship-side legs', 24, [[c => c.x > 0, 0]], false],
  ['26 good: moat side, eight', 25, [[c => c.z < 0.5, 0]], true],
  ['26 bad: chapel side', 25, [[c => c.z > 0, 0]], false],
  ['27 good: front pair', 26, [[c => c.gj === 0, 0]], true],
  ['27 bad: back pair, onto school', 26, [[c => c.gj === 1, 0]], false],
  ['28 good: outer legs of all three', 27, [[c => outward(c) > 0.5, 0]], true],
  ['28 bad: inner legs', 27, [[c => outward(c) < -0.5, 0]], false],
  ['29 good: middle first', 28, [[c => c.gj === 1 && c.gi > 0 && c.gi < 4, 0], [c => !(c.gj === 1 && c.gi > 0 && c.gi < 4), 0.3]], true],
  ['29 bad: tower side only', 28, [[c => c.gi >= 3, 0]], false],
  ['30 good: implode both', 29, [[c => c.gi === 1 && c.gj === 1, 0], [c => !(c.gi === 1 && c.gj === 1), 0.3]], true],
  ['30 bad: one side of one tower', 29, [[c => c.x < -13, 0]], false],
];

// Tower Trio: how far a leg sits from its tower's centre, measured away from the farmhouse.
function outward(c) {
  const a = [90, 210, 330].map(d => d * Math.PI / 180).sort((p, q) =>
    Math.hypot(c.x - 12 * Math.cos(p), c.z - 12 * Math.sin(p)) - Math.hypot(c.x - 12 * Math.cos(q), c.z - 12 * Math.sin(q)))[0];
  return (c.x - 12 * Math.cos(a)) * Math.cos(a) + (c.z - 12 * Math.sin(a)) * Math.sin(a);
}

export function solutionFor(index) {
  const c = CASES.find(([, lvl, , good]) => lvl === index && good);
  return c ? c[2] : null;
}
