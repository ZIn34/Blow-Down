// Blowdown: game state, level loading, rigging, detonation, results.
import * as THREE from 'three';
import RAPIER from '../lib/rapier.es.js';
import { Builder } from './builder.js';
import { Structure } from './structure.js';
import { View3D, ChunkView, spriteTexture } from './render.js';
import { buildProps, markHit } from './props.js';
import { LEVELS } from './levels.js';
import { FX } from './fx.js';
import { OrbitCam } from './camera.js';
import { Input } from './input.js';
import { Sfx } from './audio.js';
import { Recorder, Player } from './replay.js';
import { evaluate, starLabel, loadProgress, saveProgress, unlockedCount, zonesOf } from './scoring.js';
import { UI } from './ui.js';

const FIXED = 1 / 60;
const SEED = 1337;

function mulberry32(a) {
  return () => {
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

class Game {
  async init() {
    await RAPIER.init();
    this.frameEl = document.getElementById('frame');
    this.canvas = document.getElementById('view');
    this.view = new View3D(this.canvas);
    this.cam = new OrbitCam(this.view.camera);
    this.fx = new FX(this.view.scene);
    this.sfx = new Sfx();
    this.ui = new UI(this);
    this.progress = loadProgress(LEVELS.length);
    this.markers = new THREE.Group();
    this.view.scene.add(this.markers);
    this.spotTex = ringTexture();
    this.charges = [];
    this.selected = null;
    this.lastDelay = 0;
    this.slowmo = false;
    this.debugOn = false;
    this.fails = 0;
    this.attempts = 0;
    this.input = new Input(this.canvas, {
      onTap: (x, y) => this.onTap(x, y),
      onOrbit: (dx, dy) => { if (this.state !== 'replay') this.cam.orbit(dx, dy); },
      onPan: (dx, dy) => this.cam.pan(dx, dy),
      onZoom: f => this.cam.zoom(f),
      onKey: (code, e) => this.onKey(code, e),
      onAny: () => this.sfx.unlock(),
    });
    addEventListener('resize', () => this.resize());
    this.resize();
    this.loadLevel(0);
    this.openMenu();
    document.getElementById('loading').hidden = true;
    this.last = performance.now();
    this.fps = 60;
    requestAnimationFrame(t => this.frame(t));
  }

  resize() {
    // phones and narrow windows fill the screen; wide screens get a phone-shaped frame
    const W = innerWidth, H = innerHeight;
    let w = W, h = H;
    if (W / H > 0.72) { h = H; w = Math.round(H * 9 / 16); }
    this.frameEl.style.width = w + 'px';
    this.frameEl.style.height = h + 'px';
    this.view.resize(w, h);
    this.fx.setViewport(h * Math.min(devicePixelRatio, 2), this.view.camera.fov);
  }

  starText(k) { return starLabel(k, this.level); }

  // ---- levels -----------------------------------------------------------

  loadLevel(i, rig = null) {
    this.levelIdx = i;
    const L = this.level = LEVELS[i];
    this.view.clearLevel();
    this.clearMarkers();
    if (this.world) this.world.free();
    const R = RAPIER;
    this.world = new R.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = FIXED;
    const ground = this.world.createRigidBody(R.RigidBodyDesc.fixed());
    this.world.createCollider(R.ColliderDesc.cuboid(450, 1, 450).setTranslation(0, -1, 0).setFriction(0.9), ground);

    const b = new Builder();
    L.build(b);
    this.view.setTheme(L.theme, Math.max(30, L.camera.dist * 0.75), L.setting);
    const protect = buildProps(b.props, { root: this.view.level, R, world: this.world });
    this.chunkView = new ChunkView(this.view.level, b.chunks, this.view.theme.night);
    this.rng = mulberry32(SEED + i);
    this.structure = new Structure(R, this.world, this.chunkView, b.chunks, {
      minSupport: L.minSupport, blastRadius: L.blastRadius, protect,
      rng: () => this.rng(), onEvent: (t, p, d) => this.onStructEvent(t, p, d),
    });
    this.structure.sync();
    for (const z of zonesOf(L)) this.drawZone(z);
    this.fx.reset(L);
    const crowd = protect.find(p => p.crowd);
    if (crowd) this.fx.setCrowd(crowd.crowd);
    this.cam.setView(L.camera);
    this.cam.auto = 0;
    this.recorder = new Recorder(this.chunkView);

    this.charges = [];
    this.selected = null;
    this.lastDelay = 0;
    this.makeSpots();
    const preset = rig || (L.preset || []).map(tag => ({ id: this.structure.chunks.find(c => c.tag === tag).id, delay: 0 }));
    for (const r of preset) this.placeCharge(this.structure.chunks[r.id], r.delay, true);
    this.selected = null;
    this.state = 'rig';
    this.acc = 0;
  }

  startLevel(i, keepRig = false) {
    if (!keepRig || i !== this.levelIdx) { this.fails = 0; this.attempts = 0; }
    this.loadLevel(i, keepRig ? this.lastRig : null);
    this.ui.setLevel(this.level, i);
    this.refreshCharges();
    this.ui.countdown(null);
    this.ui.replayBadge(false);
    if (keepRig) this.ui.hideBubble();
    else this.ui.bubble(this.level.intro);
  }

  retry() { this.startLevel(this.levelIdx, true); }
  next() { if (this.levelIdx < LEVELS.length - 1) this.startLevel(this.levelIdx + 1); }

  openMenu() {
    if (this.state !== 'rig' && this.state !== 'menu') this.loadLevel(this.levelIdx);
    this.state = 'menu';
    this.cam.auto = 0.08;
    this.ui.countdown(null);
    this.ui.replayBadge(false);
    this.ui.hideBubble();
    this.ui.showMenu(LEVELS, this.progress, unlockedCount(this.progress));
  }

  pause() {
    if (!['rig', 'blast', 'countdown'].includes(this.state)) return;
    this.pausedFrom = this.state;
    this.state = 'paused';
    this.ui.showPause(true);
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = this.pausedFrom;
    this.ui.showPause(false);
  }

  drawZone(z) {
    if (!z) return;
    const [x0, z0, x1, z1] = z;
    const green = 0x3ddc84;
    const plane = (w, d, x, zc, opacity) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({
        color: green, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.05, zc);
      m.renderOrder = 1;
      this.view.level.add(m);
    };
    plane(x1 - x0, z1 - z0, (x0 + x1) / 2, (z0 + z1) / 2, 0.16);
    const t = 0.35;
    plane(x1 - x0, t, (x0 + x1) / 2, z0, 0.85);
    plane(x1 - x0, t, (x0 + x1) / 2, z1, 0.85);
    plane(t, z1 - z0, x0, (z0 + z1) / 2, 0.85);
    plane(t, z1 - z0, x1, (z0 + z1) / 2, 0.85);
  }

  // ---- rigging ----------------------------------------------------------

  makeSpots() {
    this.spots = new Map();
    this.spotMat = new THREE.SpriteMaterial({ map: this.spotTex, depthTest: false, transparent: true, sizeAttenuation: false });
    const rig = this.structure.rigChunks();
    // crowded buildings get smaller markers so they don't pile on top of each other
    this.markerScale = rig.length > 12 ? 0.7 : 1;
    for (const c of rig) {
      const s = new THREE.Sprite(this.spotMat);
      s.renderOrder = 10;
      s.scale.setScalar(0.05 * this.markerScale);
      s.position.copy(this.structure.worldPos(c));
      this.markers.add(s);
      this.spots.set(c, s);
    }
  }

  clearMarkers() {
    for (const ch of this.charges) ch.sprite.material.dispose();
    this.spotMat?.dispose();
    this.markers.clear();
  }

  placeCharge(c, delay = this.lastDelay, silent = false) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, transparent: true, sizeAttenuation: false }));
    sprite.renderOrder = 11;
    sprite.scale.setScalar(0.06);
    sprite.position.copy(this.structure.worldPos(c));
    this.markers.add(sprite);
    const ch = { chunk: c, delay: this.clampDelay(delay), n: 0, sprite };
    this.charges.push(ch);
    this.spots.get(c).visible = false;
    this.selected = ch;
    if (!silent) this.sfx.click();
    this.refreshCharges();
    return ch;
  }

  removeCharge(ch) {
    this.markers.remove(ch.sprite);
    ch.sprite.material.dispose();
    this.charges.splice(this.charges.indexOf(ch), 1);
    this.spots.get(ch.chunk).visible = true;
    if (this.selected === ch) this.selected = null;
    this.refreshCharges();
  }

  clearCharges() {
    if (this.level.locked || this.state !== 'rig') return;
    for (const ch of this.charges.slice()) this.removeCharge(ch);
    this.lastDelay = 0;
  }

  select(ch) {
    this.selected = ch;
    if (ch) this.lastDelay = ch.delay;
    this.refreshCharges();
  }

  clampDelay(d) {
    const max = this.level.maxDelay || 2;
    return Math.min(max, Math.max(0, Math.round(d / 0.05) * 0.05));
  }

  setDelay(ch, d) {
    if (this.level.locked || this.state !== 'rig') return;
    const v = this.clampDelay(d);
    if (v === ch.delay) return;
    ch.delay = v;
    this.lastDelay = v;
    this.refreshCharges();
  }

  refreshCharges() {
    this.charges.forEach((ch, i) => { ch.n = i + 1; });
    for (const ch of this.charges) {
      ch.sprite.material.map = chargeTex(ch.n, ch === this.selected);
      ch.sprite.material.needsUpdate = true;
    }
    this.ui.setCharges(this.charges, this.selected, this.level);
  }

  onTap(x, y) {
    this.sfx.unlock();
    if (this.state === 'replay') { this.endReplay(); return; }
    if (this.state !== 'rig') return;
    this.ui.hideBubble();
    const hit = this.pick(x, y);
    if (!hit) { if (this.selected) this.select(null); return; }
    if (this.level.locked) { this.ui.toast('Already rigged: just hit DETONATE'); return; }
    const existing = this.charges.find(ch => ch.chunk === hit);
    if (existing) { this.removeCharge(existing); this.sfx.click(); return; }
    if (this.charges.length >= this.level.maxCharges) { this.ui.toast(`Out of charges (${this.level.maxCharges} max)`); return; }
    this.placeCharge(hit);
  }

  // Nearest rig spot on screen, within a finger-sized radius.
  pick(x, y) {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    let best = null, bd = Math.max(26, h * 0.042);
    const v = new THREE.Vector3();
    for (const c of this.structure.rigChunks()) {
      this.structure.worldPos(c, null, v).project(this.view.camera);
      if (v.z > 1) continue;
      const d = Math.hypot((v.x + 1) / 2 * w - x, (1 - v.y) / 2 * h - y);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  onKey(code) {
    this.sfx.unlock();
    const s = this.state;
    if (code === 'F1') { this.debugOn = !this.debugOn; if (!this.debugOn) this.ui.debug(null); return; }
    if (code === 'BracketLeft') return this.startLevel((this.levelIdx + LEVELS.length - 1) % LEVELS.length);
    if (code === 'BracketRight') return this.startLevel((this.levelIdx + 1) % LEVELS.length);
    if (code === 'KeyT') { this.slowmo = !this.slowmo; this.ui.toast(this.slowmo ? 'Slow-mo on' : 'Slow-mo off', 900); return; }
    if (s === 'menu') {
      if (code === 'Space' || code === 'Enter') this.startLevel(unlockedCount(this.progress) - 1);
      return;
    }
    if (code === 'Escape') {
      if (s === 'paused') this.resume();
      else if (s === 'replay') this.endReplay();
      else this.pause();
      return;
    }
    if (s === 'paused') return;
    if (code === 'KeyR') return this.retry();
    if (s === 'rig') {
      const sel = this.selected;
      if (code === 'Space' || code === 'Enter') this.detonate();
      else if (code === 'Tab' && this.charges.length) {
        const i = sel ? this.charges.indexOf(sel) : -1;
        this.select(this.charges[(i + 1) % this.charges.length]);
      } else if (sel && !this.level.locked && ['Delete', 'Backspace', 'KeyX'].includes(code)) this.removeCharge(sel);
      else if (sel && code === 'ArrowLeft') this.setDelay(sel, sel.delay - 0.05);
      else if (sel && code === 'ArrowRight') this.setDelay(sel, sel.delay + 0.05);
    } else if (s === 'result') {
      if (code === 'KeyV') this.replay();
      else if (code === 'Space' || code === 'Enter') {
        if (this.result.down && this.levelIdx < LEVELS.length - 1) this.next(); else this.retry();
      }
    } else if (s === 'replay') {
      if (['Space', 'Enter', 'KeyV'].includes(code)) this.endReplay();
    }
  }

  // ---- demolition ---------------------------------------------------------

  detonate() {
    if (this.state !== 'rig' || !this.charges.length) return;
    this.lastRig = this.charges.map(ch => ({ id: ch.chunk.id, delay: ch.delay }));
    this.ui.hideBubble();
    this.selected = null;
    this.refreshCharges();
    for (const s of this.spots.values()) s.visible = false;
    this.state = 'countdown';
    this.cdStep = this.level.tv ? 0.85 : 0.45;
    this.cd = 3;
    this.cdT = this.cdStep;
    this.ui.setMode('blast');
    this.ui.countdown(3, this.level.tv ? '● LIVE' : '');
    this.sfx.beep();
  }

  startBlast() {
    this.ui.countdown(null);
    this.state = 'blast';
    this.blastT = 0;
    this.acc = 0;
    this.settleT = 0;
    this.rng = mulberry32(SEED + this.levelIdx);   // same rig, same result
    this.pending = this.charges.slice().sort((a, b) => a.delay - b.delay);
    this.lastFire = this.pending[this.pending.length - 1].delay;
    this.recorder.start();
  }

  stepBlast() {
    this.blastT += FIXED;
    const now = [];
    while (this.pending.length && this.pending[0].delay <= this.blastT + 1e-6) now.push(this.pending.shift());
    if (now.length) {
      for (const ch of now) ch.sprite.visible = false;
      this.structure.blast(now.map(ch => ch.chunk));
      this.sfx.boom();
    }
    this.world.step();
    this.structure.step(FIXED);
    this.recorder.tick(FIXED);
    if (this.pending.length) return;
    const since = this.blastT - this.lastFire;
    if (!this.structure.anyDynamic() && since > 2) return this.finish();
    // after a while, stop waiting on the odd piece still rolling around
    if (since > 1.2 && !this.structure.moving(since > 5 ? 1.2 : 0.3)) this.settleT += FIXED; else this.settleT = 0;
    if (this.settleT > 0.7 || since > 10) this.finish();
  }

  onStructEvent(type, p, d) {
    this.fx.handle(type, p, d);
    this.recorder.event(type, p, d);
    if (type === 'shatter') this.sfx.rumble(Math.min(1, d.count / 80));
    else if (type === 'glass') this.sfx.glass();
    else if (type === 'damage') {
      markHit(this.structure.protect[d.index]);
      this.ui.toast(`💥 ${d.name} hit!`);
    }
  }

  finish() {
    this.state = 'result';
    this.recorder.close();
    for (const ch of this.charges) ch.sprite.visible = false;
    const L = this.level;
    const res = this.result = evaluate(L, this.structure, this.fx, this.charges.length);
    this.attempts++;
    if (res.down) {
      this.fails = 0;
      if (res.count > (this.progress.best[this.levelIdx] || 0)) {
        this.progress.best[this.levelIdx] = res.count;
        saveProgress(this.progress);
      }
      this.sfx.cheer();
    } else {
      this.fails++;
      this.sfx.fail();
    }
    const hint = (!res.down && this.fails >= 2) || (res.count < 3 && this.attempts >= 3) ? L.hint : null;
    this.resultOpts = { hasNext: this.levelIdx < LEVELS.length - 1, hint };
    this.ui.showResult(res, L, this.resultOpts);
  }

  replay() {
    if (this.state !== 'result' || this.recorder.frames.length < 2) return;
    this.state = 'replay';
    this.ui.hideResult();
    this.ui.setMode('replay');
    this.ui.replayBadge(true);
    this.player = new Player(this.recorder, this.chunkView, this.fx);
    this.cam.auto = 0.12;
  }

  endReplay() {
    if (this.state !== 'replay') return;
    this.player.finish();
    this.fx.clear();
    this.cam.auto = 0;
    this.state = 'result';
    this.ui.replayBadge(false);
    this.ui.showResult(this.result, this.level, this.resultOpts);
  }

  // ---- frame --------------------------------------------------------------

  frame(now) {
    requestAnimationFrame(t => this.frame(t));
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.fps = this.fps * 0.95 + (1 / Math.max(dt, 1e-3)) * 0.05;
    const scale = this.slowmo ? 0.3 : 1;
    const s = this.state;
    let physMs = 0;

    if (s === 'countdown') {
      this.cdT -= dt;
      if (this.cdT <= 0) {
        this.cd--;
        this.cdT = this.cdStep;
        if (this.cd > 0) { this.ui.countdown(this.cd, this.level.tv ? '● LIVE' : ''); this.sfx.beep(); }
        else { this.sfx.beep(true); this.startBlast(); }
      }
    } else if (s === 'blast') {
      const t0 = performance.now();
      this.acc += dt * scale;
      let steps = 0;
      while (this.acc >= FIXED && steps < 4 && this.state === 'blast') { this.acc -= FIXED; steps++; this.stepBlast(); }
      if (steps === 4) this.acc = 0;
      this.structure.sync();
      physMs = performance.now() - t0;
    } else if (s === 'replay') {
      if (this.player.update(dt * 0.5)) this.endReplay();
    }

    this.fx.update(dt * (s === 'replay' ? 0.5 : s === 'blast' ? scale : 1));
    this.updateMarkers(now);
    this.markers.visible = s !== 'menu' && s !== 'replay';
    this.input.keys.nudge = s === 'rig' && !!this.selected;
    this.cam.update(dt, s === 'menu' || s === 'paused' ? new Set() : this.input.keys,
      s === 'blast' || s === 'replay' ? this.fx.shake : 0);
    if (this.level.wind) this.ui.wind(this.cam.screenAngle(this.level.wind[0], this.level.wind[1]));
    if (this.debugOn) {
      const st = this.structure.stats();
      this.ui.debug(`FPS ${this.fps.toFixed(0)}\nphysics ${physMs.toFixed(1)} ms\nbodies ${st.bodies}  moving groups ${st.dynamic}\n` +
        `chunks ${st.alive}/${st.total}\ndust ${this.fx.puffs.length}  bits ${this.fx.bits.length}\n` +
        `state ${s}${this.slowmo ? '  (slow-mo)' : ''}`);
    }
    this.view.render(dt);
  }

  // Dev helper for tuning: run a whole attempt instantly from the console.
  //   game.sim(4, [[c => c.gj === 0, 0], [c => c.gj === 1, 0.4]])
  sim(i, rig) {
    this.startLevel(i);
    if (rig) {
      this.clearCharges();
      for (const [sel, delay] of rig) {
        const list = typeof sel === 'function' ? this.structure.rigChunks().filter(sel) : [this.structure.chunks[sel]];
        for (const c of list) if (this.charges.length < this.level.maxCharges) this.placeCharge(c, delay, true);
      }
    }
    if (!this.charges.length) throw new Error(`sim: that rig matched no charge spots on level ${i + 1}`);
    this.detonate();
    this.startBlast();
    let n = 0;
    while (this.state === 'blast' && n < 60 * 20) { this.stepBlast(); this.fx.update(FIXED); n++; }
    this.structure.sync();
    const r = this.result;
    return { secs: +(n / 60).toFixed(2), charges: this.charges.length, down: r.down, maxTop: +r.maxTop.toFixed(2),
      standing: +r.standing.toFixed(2),
      zone: +r.zonePct.toFixed(2), damaged: r.damaged, dust: r.crowdDust,
      touched: this.structure.protect.map(p => `${p.name} ${((p.mass || 0) / this.structure.totalMass * 100).toFixed(1)}%`).join(', '),
      stars: r.stars.map(s => s.key + (s.got ? ' ✔' : ' ✘')).join(', '), ...this.structure.stats() };
  }

  updateMarkers(now) {
    const k = this.markerScale;
    if (this.state === 'rig') {
      const pulse = (0.046 + Math.sin(now * 0.006) * 0.007) * k;
      for (const sp of this.spots.values()) sp.scale.setScalar(pulse);
    }
    for (const ch of this.charges) {
      if (!ch.sprite.visible) continue;
      if (ch.chunk.dead) { ch.sprite.visible = false; continue; }
      if (this.state === 'blast') this.structure.worldPos(ch.chunk, null, ch.sprite.position);
      ch.sprite.scale.setScalar((ch === this.selected ? 0.075 : 0.06) * k);
    }
  }
}

function ringTexture() {
  return spriteTexture((g, w) => {
    g.lineWidth = w * 0.11;
    g.strokeStyle = 'rgba(20,20,20,0.6)';
    g.beginPath(); g.arc(w / 2, w / 2, w * 0.37, 0, Math.PI * 2); g.stroke();
    g.lineWidth = w * 0.08;
    g.strokeStyle = 'rgba(255,212,40,1)';
    g.beginPath(); g.arc(w / 2, w / 2, w * 0.37, 0, Math.PI * 2); g.stroke();
    g.fillStyle = 'rgba(255,212,40,0.45)';
    g.beginPath(); g.arc(w / 2, w / 2, w * 0.2, 0, Math.PI * 2); g.fill();
  });
}

const chargeCache = new Map();
function chargeTex(n, sel) {
  const key = n + (sel ? 's' : '');
  if (!chargeCache.has(key)) chargeCache.set(key, spriteTexture((g, w) => {
    g.fillStyle = sel ? '#ffffff' : '#1a1a1a';
    g.beginPath(); g.arc(w / 2, w / 2, w * 0.47, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#e23b2e';
    g.beginPath(); g.arc(w / 2, w / 2, w * 0.38, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff';
    g.font = `900 ${Math.round(w * 0.4)}px "Arial Black", Arial, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(n), w / 2, w / 2 + w * 0.02);
  }));
  return chargeCache.get(key);
}

const game = new Game();
window.game = game;
game.init().catch(err => {
  console.error(err);
  document.querySelector('#loading .tag').textContent = 'Failed to start: ' + err.message;
});
