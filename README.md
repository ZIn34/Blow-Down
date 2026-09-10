# Blowdown

A demolition puzzle game for phones and browsers. Rig a building with charges, set
when each one fires, and bring it down inside the target zone without hitting anything
next to it. Twenty jobs in two chapters, from an old shed to a 14-storey skyscraper on live TV.

Built with plain JavaScript, [Three.js](https://threejs.org) for graphics, and
[Rapier](https://rapier.rs) for physics. The game needs no build step.

## Run it

```
node serve.js
```

- On this computer, open http://localhost:5190
- On a phone on the same Wi-Fi, open the "phone" address the server prints, e.g. http://192.168.1.45:5190.
  If the phone can't connect, allow Node through Windows Firewall for private networks.

On a wide screen the game shows in a phone-shaped frame so the layout matches a phone.

## Controls

| Action | Mouse and keyboard | Touch |
|---|---|---|
| Place or remove a charge | Click a glowing spot | Tap a glowing spot |
| Rotate camera | Drag, right-drag, or A / D | Drag one finger |
| Zoom | Wheel, or W / S | Pinch |
| Move camera | Middle-drag or Shift-drag | Two-finger drag |
| Set when a charge fires | Drag its dot on the timeline, or scroll over it | Drag its dot |
| Select a charge / change its delay / remove it | Tab / ← → / Delete | Tap its dot |
| Detonate | Space or Enter | DETONATE button |
| Replay, retry, pause | V, R, Esc | Buttons |

Testing keys: **F1** stats overlay (frame rate, physics time, body count), **[ ]** previous/next
job, **T** slow motion.

## How the physics works

`src/structure.js` holds the core logic. Buildings are made of chunks (columns, slabs, walls,
facade panels) held together in rigid groups. When charges destroy chunks, whatever sits above
each blasted height is checked:

- **Not enough support left** (below `minSupport`, default 40% of the original area): the
  rest buckles and the building drops straight down.
- **Enough support, but the centre of mass is outside what's left:** the remaining supports
  act as a hinge and it tips toward the cut.
- A falling block that hits hard or comes to rest breaks into single pieces. Most
  columns turn to dust, and pieces crumble inward, so rigged buildings pancake.

Results are deterministic, so the same rig always gives the same collapse.

## Files

| File | What it does |
|---|---|
| `src/levels.js`, `src/levels2.js` | Chapter 1 and chapter 2: geometry, target zone(s), par, hints, camera |
| `src/builder.js` | Geometry helpers (`frame`, `ring`, `slab`, `wall`) and materials |
| `src/structure.js` | Support, tipping, shattering, damage detection |
| `src/props.js` | Scenery; the `protect` ones are watched for damage |
| `src/main.js` | Game states, rigging, detonation, results |
| `src/ui.js`, `style.css`, `index.html` | HUD, timeline, menus |
| `src/fx.js`, `src/audio.js`, `src/replay.js` | Dust and debris, synthesized sound, slow-mo replay |
| `src/devtests.js` | Tuning harness (below) |

## Tuning levels

Every job has a known good rig and a known bad one in `src/devtests.js`. Run them all
instantly from the browser console:

```js
const t = await import('./src/devtests.js'); t.run()
```

Each line reports whether the level behaves as designed: good rigs get 3 stars, bad rigs
don't. After changing physics constants or a level, run it again. The collapses are
chaotic, so a small change in one place can move a result somewhere else.

`game.sim(level, rig)` runs a single attempt, for example
`game.sim(4, [[c => c.gj === 0, 0]])` (the motel's front row at 0 s).
