// Tuning harness. In the browser console:
//   const t = await import('./src/devtests.js'); t.run()
// Runs each level's intended solution and a known-bad rig, instantly, and reports stars.

const mid = c => c.gj === 1 && c.gi > 0 && c.gi < 3;

export const CASES = [
  ['1 good: all four posts', 0, [[c => true, 0]], true],
  ['2 good: east pair', 1, [[c => c.x > 0, 0]], true],
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
  // chapter 2
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
];

// filter: a level index, or [first, last] range
export function run(filter = null) {
  const game = window.game;
  const out = {};
  for (const [name, lvl, rig, shouldPass] of CASES) {
    if (typeof filter === 'number' && lvl !== filter) continue;
    if (Array.isArray(filter) && (lvl < filter[0] || lvl > filter[1])) continue;
    const r = game.sim(lvl, rig);
    const three = r.stars.split(',').every(s => s.includes('✔'));
    const verdict = shouldPass ? (three ? 'OK' : 'EXPECTED 3★') : (three ? 'EXPECTED FAIL' : 'OK');
    out[name] = `${verdict} | ${r.stars} | stand=${r.standing} zone=${r.zone} touched: ${r.touched || '-'} dust=${r.dust} ${r.secs}s`;
  }
  return out;
}
