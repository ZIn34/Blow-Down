// Blowdown: game state, job loading, rigging, detonation, results.
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
import { evaluate, starLabel, zonesOf, expertText } from './scoring.js';
import { UI } from './ui.js';
import { Menu } from './menu.js';
import { Profile } from './profile.js';
import { campaignJob, dailyJob, remixJob, availableRemixes } from './jobs.js';
import { dayNumber, prepareDaily } from './dailygen.js';
import { mulberry32, rigFromFilters, FIXED } from './solver.js';
import { chargeTypes } from './shop.js';
import { clipSupported, recordClip, shareClip, shareText } from './clip.js';

const HINT_PRICE = 300;
const GAME_URL = 'https://zin34.github.io/Blow-Down/';

class Game {
  async init() {
    await RAPIER.init();
    this.frameEl = document.getElementById('frame');
    this.canvas = document.getElementById('view');
    this.view = new View3D(this.canvas);
    this.cam = new OrbitCam(this.view.camera);
    this.fx = new FX(this.view.scene);
    this.sfx = new Sfx();
    this.profile = Profile.load(LEVELS.length);
    this.ui = new UI(this);
    this.menu = new Menu(this);
    this.markers = new THREE.Group();
    this.view.scene.add(this.markers);
    this.spotTex = ringTexture();
    this.charges = [];
    this.selected = null;
    this.lastDelay = 0;
    this.chargeType = 'std';
    this.slowmo = false;
    this.debugOn = false;
    this.fails = 0;
    this.attempts = 0;
    this.applyEquipment();
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
    this.loadJob(campaignJob(Math.max(0, this.profile.unlockedCount() - 1)));
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

  applyEquipment() {
    const e = this.profile.equip;
    this.fx.setPalette(e.fx);
    this.ui.setDetonator(e.det);
    this.ui.setCrew(e.crew === 'sparky' ? null : e.crew);
  }

  // ---- jobs -------------------------------------------------------------

  loadJob(job, rig = null) {
    this.job = job;
    const def = { ...job.def };
    if (this.profile.has('longfuse')) def.maxDelay = Math.max(def.maxDelay || 2, 5);
    const L = this.level = def;
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
    if (L.sandbox) for (const c of b.chunks) if (c.support) c.rig = true;
    this.view.setTheme(L.theme, Math.max(30, L.camera.dist * 0.75), L.setting);
    const protect = buildProps(b.props, { root: this.view.level, R, world: this.world });
    this.chunkView = new ChunkView(this.view.level, b.chunks, this.view.theme.night);
    this.rng = mulberry32(L.seed);
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
    for (const r of rig || []) {
      const c = this.structure.chunks[r.id];
      if (c && c.rig && this.charges.length < L.maxCharges) this.placeCharge(c, r.delay, true, r.type || 'std');
    }
    this.selected = null;
    this.state = 'rig';
    this.acc = 0;
  }

  play(job, keepRig = false) {
    if (!job.def) { this.ui.toast('That one isn\'t available yet'); return; }
    const same = this.job && keepRig;
    if (!same) { this.fails = 0; this.attempts = 0; }
    this.loadJob(job, keepRig ? this.lastRig : null);
    const types = chargeTypes(this.profile);
    if (!types.some(t => t.id === this.chargeType)) this.chargeType = 'std';
    this.menu.hide();
    this.ui.setLevel(this.level, job.label, { expert: expertText(this.level.expert), types, type: this.chargeType });
    this.refreshCharges();
    this.ui.countdown(null);
    this.ui.replayBadge(false);
    if (keepRig) this.ui.hideBubble();
    else this.ui.bubble(job.intro || this.level.intro);
  }

  retry() { this.play(this.job, true); }

  next() {
    const j = this.job;
    if (j.kind === 'campaign' && j.index < LEVELS.length - 1) return this.play(campaignJob(j.index + 1));
    if (j.kind === 'remix') {
      const keys = availableRemixes(j.index), k = keys.indexOf(j.remix);
      if (k >= 0 && k < keys.length - 1) return this.play(remixJob(j.index, keys[k + 1]));
      return this.openMenu('remix');
    }
    this.openMenu(j.kind === 'sandbox' ? 'sandbox' : 'jobs');
  }

  async startDaily() {
    const day = dayNumber();
    this.menu.busy(`Surveying today's site…`, 0);
    try {
      const def = await prepareDaily(day, (attempt, i, n) =>
        this.menu.busy(attempt ? 'Finding a better site…' : `Surveying today's site…`, i / n));
      this.menu.busy(null);
      this.play(dailyJob(day, def));
    } catch (err) {
      console.error(err);
      this.menu.busy(null);
      this.ui.toast("Couldn't set up today's contract");
    }
  }

  openMenu(tab) {
    if (this.state !== 'rig' && this.state !== 'menu') this.loadJob(this.job);
    this.state = 'menu';
    this.cam.auto = 0.08;
    this.ui.countdown(null);
    this.ui.replayBadge(false);
    this.ui.hideBubble();
    this.ui.hideHud();
    this.menu.show(tab);
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

  buy(item) {
    if (item.slot && (item.price === 0 || this.profile.has(item.id))) {
      this.profile.equip[item.slot] = item.value;
      this.profile.save();
      this.applyEquipment();
      this.sfx.click();
      return true;
    }
    if (!this.profile.buy(item)) { this.ui.toast('Not enough cash yet'); return false; }
    if (item.slot) { this.profile.equip[item.slot] = item.value; this.profile.save(); this.applyEquipment(); }
    this.sfx.ding(2);
    this.ui.toast(`Bought: ${item.name}`);
    return true;
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
    this.markerScale = rig.length > 40 ? 0.55 : rig.length > 12 ? 0.7 : 1;
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

  placeCharge(c, delay = this.lastDelay, silent = false, type = this.chargeType) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, transparent: true, sizeAttenuation: false }));
    sprite.renderOrder = 11;
    sprite.scale.setScalar(0.06);
    sprite.position.copy(this.structure.worldPos(c));
    this.markers.add(sprite);
    const ch = { chunk: c, delay: this.clampDelay(delay), n: 0, sprite, type };
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
    if (this.state !== 'rig') return;
    for (const ch of this.charges.slice()) this.removeCharge(ch);
    this.lastDelay = 0;
  }

  setChargeType(id) {
    this.chargeType = id;
    if (this.selected && this.state === 'rig') { this.selected.type = id; }
    this.refreshCharges();
    this.ui.setChargeType(id);
  }

  select(ch) {
    this.selected = ch;
    if (ch) { this.lastDelay = ch.delay; this.chargeType = ch.type; this.ui.setChargeType(ch.type); }
    this.refreshCharges();
  }

  clampDelay(d) {
    const max = this.level.maxDelay || 2;
    return Math.min(max, Math.max(0, Math.round(d / 0.05) * 0.05));
  }

  setDelay(ch, d) {
    if (this.state !== 'rig') return;
    const v = this.clampDelay(d);
    if (v === ch.delay) return;
    ch.delay = v;
    this.lastDelay = v;
    this.refreshCharges();
  }

  refreshCharges() {
    this.charges.forEach((ch, i) => { ch.n = i + 1; });
    for (const ch of this.charges) {
      ch.sprite.material.map = chargeTex(ch.n, ch === this.selected, ch.type);
      ch.sprite.material.needsUpdate = true;
    }
    this.ui.setCharges(this.charges, this.selected, this.level);
  }

  // Sparky rigs the known solution for you, for a fee.
  showMe() {
    const L = this.level;
    const rig = L.solutionRig || (L.solution ? rigFromFilters(L, L.solution) : null);
    if (!rig) { this.ui.toast("Sparky's stumped on this one"); return; }
    if (this.profile.cash < HINT_PRICE) { this.ui.toast(`Sparky charges $${HINT_PRICE}. Earn a bit more first.`); return; }
    this.profile.cash -= HINT_PRICE;
    this.profile.save();
    this.lastRig = rig;
    this.play(this.job, true);
    this.ui.bubble('Here, like this. Now hit the button.');
  }

  onTap(x, y) {
    this.sfx.unlock();
    if (this.state === 'replay') { if (!this.recording) this.endReplay(); return; }
    if (this.state !== 'rig') return;
    this.ui.hideBubble();
    const hit = this.pick(x, y);
    if (!hit) { if (this.selected) this.select(null); return; }
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
    if (code === 'KeyT') { this.slowmo = !this.slowmo; this.ui.toast(this.slowmo ? 'Slow-mo on' : 'Slow-mo off', 900); return; }
    if ((code === 'BracketLeft' || code === 'BracketRight') && s !== 'replay') {
      const i = this.job?.kind === 'campaign' ? this.job.index : 0, n = LEVELS.length;
      return this.play(campaignJob((i + (code === 'BracketLeft' ? n - 1 : 1)) % n));
    }
    if (s === 'menu') {
      if (code === 'Space' || code === 'Enter') this.play(campaignJob(this.profile.unlockedCount() - 1));
      return;
    }
    if (code === 'Escape') {
      if (s === 'paused') this.resume();
      else if (s === 'replay') { if (!this.recording) this.endReplay(); }
      else this.pause();
      return;
    }
    if (s === 'paused') return;
    if (code === 'KeyR' && s !== 'replay') return this.retry();
    if (s === 'rig') {
      const sel = this.selected;
      const types = chargeTypes(this.profile);
      if (code === 'Space' || code === 'Enter') this.detonate();
      else if (/^Digit[1-3]$/.test(code) && types[+code.slice(5) - 1]) this.setChargeType(types[+code.slice(5) - 1].id);
      else if (code === 'Tab' && this.charges.length) {
        const i = sel ? this.charges.indexOf(sel) : -1;
        this.select(this.charges[(i + 1) % this.charges.length]);
      } else if (sel && ['Delete', 'Backspace', 'KeyX'].includes(code)) this.removeCharge(sel);
      else if (sel && code === 'ArrowLeft') this.setDelay(sel, sel.delay - 0.05);
      else if (sel && code === 'ArrowRight') this.setDelay(sel, sel.delay + 0.05);
    } else if (s === 'result') {
      if (code === 'KeyV') this.replay();
      else if (code === 'Space' || code === 'Enter') { if (this.result.passed) this.next(); else this.retry(); }
    } else if (s === 'replay' && !this.recording) {
      if (['Space', 'Enter', 'KeyV'].includes(code)) this.endReplay();
    }
  }

  // ---- demolition ---------------------------------------------------------

  detonate() {
    if (this.state !== 'rig' || !this.charges.length) return;
    this.lastRig = this.charges.map(ch => ({ id: ch.chunk.id, delay: ch.delay, type: ch.type }));
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
    this.failAt = null;
    this.rng = mulberry32(this.level.seed);   // same rig, same result
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
      this.structure.blast(now.map(ch => ({ chunk: ch.chunk, type: ch.type })));
      this.sfx.boom();
    }
    this.world.step();
    this.structure.step(FIXED);
    this.recorder.tick(FIXED);
    // hit something you had to protect: that's the job over, just long enough to see it
    if (this.failAt !== null && this.blastT >= this.failAt) return this.finish();
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
      if (this.state === 'blast' && !this.level.sandbox) {
        this.ui.toast(`💥 You hit the ${d.name}!`, 2500);
        if (this.failAt === null) this.failAt = this.blastT + 0.9;
      }
    }
  }

  finish() {
    this.state = 'result';
    this.recorder.close();
    for (const ch of this.charges) ch.sprite.visible = false;
    const L = this.level, job = this.job;
    const res = this.result = evaluate(L, this.structure, this.fx, this.charges.length);
    this.attempts++;
    const hadExpert = job.kind === 'campaign' && this.profile.expert[job.index];
    const award = job.kind === 'sandbox' ? { cash: 0, notes: [] } : this.profile.award(job, res);
    if (res.passed) { this.fails = 0; this.sfx.cheer(); } else { this.fails++; this.sfx.fail(); }
    const hint = (!res.passed && this.fails >= 2) || (res.count < 3 && this.attempts >= 3) ? L.hint : null;
    const canShowMe = !!(L.solutionRig || L.solution) && hint && !L.sandbox;
    let hasNext = false, nextLabel = 'Next job ▶';
    if (job.kind === 'campaign') hasNext = res.passed && job.index < LEVELS.length - 1;
    else if (job.kind === 'remix') { hasNext = res.passed; nextLabel = 'Next remix ▶'; }
    this.resultOpts = {
      kind: job.kind, hasNext, nextLabel, hint, canShowMe, hintPrice: HINT_PRICE,
      cash: award.cash, notes: award.notes, rankUp: award.rankUp, balance: this.profile.cash,
      expert: L.expert ? { text: expertText(L.expert), got: res.expert, before: hadExpert } : null,
      canShare: job.kind === 'daily' && res.passed, canClip: clipSupported(),
      streak: job.kind === 'daily' ? this.profile.currentStreak(job.day) : 0,
    };
    this.ui.showResult(res, L, this.resultOpts);
  }

  replay(onEnd = null) {
    if (this.state !== 'result' || this.recorder.frames.length < 2) return;
    this.state = 'replay';
    this.replayEnd = onEnd;
    this.ui.hideResult();
    this.ui.setMode('replay');
    this.ui.replayBadge(true, !!onEnd);
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
    this.ui.showResult(this.result, this.level, this.resultOpts, true);
    const cb = this.replayEnd;
    this.replayEnd = null;
    cb?.();
  }

  async saveClip() {
    if (this.state !== 'result' || this.recording) return;
    this.recording = true;
    try {
      const blob = await recordClip(this.canvas, () => new Promise(res => this.replay(res)));
      const how = await shareClip(blob, `blowdown-${(this.level.name || 'job').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`);
      if (how === 'saved') this.ui.toast('Clip saved to your downloads');
    } catch (err) {
      console.error(err);
      this.ui.toast("Couldn't record a clip on this device");
    } finally {
      this.recording = false;
    }
  }

  async shareDaily() {
    const job = this.job, res = this.result;
    if (job.kind !== 'daily') return;
    const r = this.profile.daily.results[job.day] || {};
    const text = [
      `Blowdown Daily #${job.day} ${'⭐'.repeat(res.count)}${'☆'.repeat(3 - res.count)}`,
      `💣${res.used}/${this.level.par} 🎯${Math.round(res.zonePct * 100)}% ${res.passed ? '🏠✔' : '💥'}${r.tries > 1 ? ` · ${r.tries} tries` : ''}`,
      `🔥 Streak ${this.profile.currentStreak(job.day)}`,
      GAME_URL,
    ].join('\n');
    const how = await shareText(text);
    if (how === 'copied') this.ui.toast('Result copied: paste it anywhere');
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
      ch.sprite.scale.setScalar((ch === this.selected ? 0.075 : 0.06) * Math.max(k, 0.7));
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

const CHARGE_COLORS = { std: '#e23b2e', cutter: '#2f7de0', heavy: '#2a2a2a' };
const chargeCache = new Map();
function chargeTex(n, sel, type = 'std') {
  const key = `${n}|${sel}|${type}`;
  if (!chargeCache.has(key)) chargeCache.set(key, spriteTexture((g, w) => {
    g.fillStyle = sel ? '#ffffff' : type === 'heavy' ? '#f5c518' : '#1a1a1a';
    g.beginPath(); g.arc(w / 2, w / 2, w * 0.47, 0, Math.PI * 2); g.fill();
    g.fillStyle = CHARGE_COLORS[type];
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
