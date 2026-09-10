// DOM overlay: HUD, timeline, results, menus. Uses Pointer Events throughout so
// mouse and touch go through the same code.
import { STAR_ICON, zonesOf } from './scoring.js';
import { CHAPTERS } from './levels.js';

const $ = id => document.getElementById(id);

export class UI {
  constructor(game) {
    this.g = game;
    this.track = $('tl-track');
    this.dots = new Map();
    this.max = 2;
    this.toastTimer = 0;

    const on = (id, fn) => $(id).addEventListener('click', e => { e.stopPropagation(); game.sfx.unlock(); fn(); });
    on('btn-detonate', () => game.detonate());
    on('btn-pause', () => game.pause());
    on('btn-resume', () => game.resume());
    on('btn-p-retry', () => game.retry());
    on('btn-p-levels', () => game.openMenu());
    on('btn-replay', () => game.replay());
    on('btn-retry', () => game.retry());
    on('btn-next', () => game.next());
    on('btn-levels', () => game.openMenu());
    on('btn-skip', () => game.endReplay());
    on('btn-clear', () => game.clearCharges());
    $('bubble').addEventListener('click', () => this.hideBubble());

    // tapping the empty track moves the selected charge there
    this.track.addEventListener('pointerdown', e => {
      if (e.target !== this.track || !game.selected) return;
      this.startDrag(e, game.selected, this.track);
      this.dragTo(e);
    });
    this.track.addEventListener('pointermove', e => this.dragTo(e));
    this.track.addEventListener('pointerup', () => { this.drag = null; });
    this.track.addEventListener('pointercancel', () => { this.drag = null; });
  }

  // ---- menu -------------------------------------------------------------

  showMenu(levels, progress, unlocked) {
    const grid = $('level-grid');
    grid.innerHTML = '';
    levels.forEach((L, i) => {
      const ch = CHAPTERS.find(c => c.from === i);
      if (ch) {
        const h = document.createElement('div');
        h.className = 'chapter';
        h.textContent = ch.name;
        grid.appendChild(h);
      }
      const b = document.createElement('button');
      b.className = 'lvl';
      b.disabled = i >= unlocked;
      const best = progress.best[i] || 0;
      b.innerHTML = `<span class="n">${i + 1}</span><span class="nm">${L.name}</span>
        <span class="st">${'★'.repeat(best)}<i>${'★'.repeat(3 - best)}</i></span>`;
      b.addEventListener('click', () => { this.g.sfx.unlock(); this.g.startLevel(i); });
      grid.appendChild(b);
    });
    const total = progress.best.reduce((a, b) => a + b, 0);
    $('menu-stars').textContent = `★ ${total} / ${levels.length * 3}`;
    $('menu').hidden = false;
    $('hud').hidden = true;
    $('result').hidden = true;
    $('pause').hidden = true;
  }

  // ---- HUD --------------------------------------------------------------

  setLevel(L, i) {
    $('menu').hidden = true;
    $('result').hidden = true;
    $('pause').hidden = true;
    $('hud').hidden = false;
    $('lvl-num').textContent = `JOB ${i + 1}`;
    $('lvl-name').textContent = L.name;
    $('goals').innerHTML = L.stars.map(k =>
      `<div class="goal" data-key="${k}"><b>${STAR_ICON[k]}</b>${this.g.starText(k)}</div>`).join('');
    this.max = L.maxDelay || 2;
    const ticks = $('tl-ticks');
    ticks.innerHTML = '';
    for (let t = 0; t <= this.max + 1e-6; t += 0.5) {
      const d = document.createElement('span');
      d.style.left = (t / this.max * 100) + '%';
      d.textContent = t.toFixed(1) + 's';
      ticks.appendChild(d);
    }
    for (const el of this.dots.values()) el.remove();
    this.dots.clear();
    $('wind').hidden = !L.wind;
    this.setMode('rig');
  }

  setMode(mode) { $('hud').dataset.mode = mode; }

  setCharges(charges, selected, L) {
    $('charges').textContent = `💣 ${charges.length} / ${L.maxCharges}`;
    $('btn-detonate').disabled = !charges.length;
    $('btn-clear').hidden = !!L.locked || !charges.length;
    for (const [ch, el] of this.dots) if (!charges.includes(ch)) { el.remove(); this.dots.delete(ch); }
    // stack dots that share a spot on the track into lanes
    const sorted = charges.slice().sort((a, b) => a.delay - b.delay);
    const lanes = [];
    for (const ch of sorted) {
      let lane = lanes.findIndex(last => (ch.delay - last) / this.max > 0.07);
      if (lane < 0) { lane = lanes.length < 3 ? lanes.length : sorted.indexOf(ch) % 3; }
      lanes[lane] = ch.delay;
      let el = this.dots.get(ch);
      if (!el) { el = this.makeDot(ch); this.dots.set(ch, el); }
      el.textContent = ch.n;
      el.style.left = (ch.delay / this.max * 100) + '%';
      el.style.top = (4 + lane * 30) + 'px';
      el.style.background = delayColor(ch.delay / this.max);
      el.classList.toggle('sel', ch === selected);
    }
    const sel = $('tl-sel');
    if (L.locked) sel.textContent = 'Already rigged: just hit DETONATE';
    else if (selected) sel.textContent = `Charge ${selected.n} fires at ${selected.delay.toFixed(2)} s`;
    else if (charges.length) sel.textContent = 'Drag a dot to change when it fires';
    else sel.textContent = 'Tap a glowing spot to place a charge';
  }

  makeDot(ch) {
    const el = document.createElement('div');
    el.className = 'dot';
    el.addEventListener('pointerdown', e => {
      e.stopPropagation();
      this.g.select(ch);
      if (!this.g.level.locked) this.startDrag(e, ch, el);
    });
    el.addEventListener('pointermove', e => this.dragTo(e));
    el.addEventListener('pointerup', () => { this.drag = null; });
    el.addEventListener('pointercancel', () => { this.drag = null; });
    el.addEventListener('wheel', e => {
      e.preventDefault();
      if (!this.g.level.locked) this.g.setDelay(ch, ch.delay + (e.deltaY < 0 ? 0.05 : -0.05));
    }, { passive: false });
    this.track.appendChild(el);
    return el;
  }

  startDrag(e, ch, el) {
    try { el.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
    this.drag = { ch, id: e.pointerId };
  }

  dragTo(e) {
    if (!this.drag || this.drag.id !== e.pointerId) return;
    const r = this.track.getBoundingClientRect();
    this.g.setDelay(this.drag.ch, (e.clientX - r.left) / r.width * this.max);
  }

  bubble(text) {
    $('bubble-text').textContent = text;
    $('bubble').hidden = false;
  }

  hideBubble() { $('bubble').hidden = true; }

  toast(text, ms = 1800) {
    const t = $('toast');
    t.textContent = text;
    t.hidden = false;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { t.hidden = true; }, ms);
  }

  countdown(n, caption = '') {
    const el = $('countdown');
    el.hidden = n === null;
    if (n === null) return;
    el.innerHTML = `<div class="num">${n}</div>${caption ? `<div class="cap">${caption}</div>` : ''}`;
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
  }

  wind(angle) {
    $('wind-arrow').style.transform = `rotate(${angle}rad)`;
  }

  // ---- results ----------------------------------------------------------

  showResult(res, L, opts) {
    const r = $('result');
    const title = !res.down ? (res.damaged.length ? 'WRONG WAY!' : 'STILL STANDING')
      : res.count === 3 ? 'PERFECT BLOWDOWN!' : 'DOWN IT GOES!';
    $('res-title').textContent = title;
    r.classList.toggle('fail', !res.down);
    $('res-stars').innerHTML = res.stars.map((s, i) =>
      `<span class="bigstar ${s.got ? 'got' : ''}" style="animation-delay:${0.25 + i * 0.35}s">★</span>`).join('');
    const lines = res.stars.map(s => `<li class="${s.got ? 'ok' : 'no'}">${s.got ? '✔' : '✘'} ${s.label}${this.detail(s.key, res, L)}</li>`);
    if (!res.down) lines.unshift(res.damaged.length
      ? `<li class="no">It came down on the ${res.damaged.join(' and ').toLowerCase()}!</li>`
      : `<li class="no">${Math.round(res.standing * 100)}% of it is still more than ${L.downHeight} m up</li>`);
    $('res-list').innerHTML = lines.join('');
    const hint = $('res-hint');
    hint.hidden = !opts.hint;
    if (opts.hint) $('res-hint-text').textContent = opts.hint;
    $('btn-next').hidden = !(res.down && opts.hasNext);
    $('btn-next').textContent = 'Next job ▶';
    r.hidden = false;
    this.setMode('result');
    res.stars.forEach((s, i) => { if (s.got) setTimeout(() => this.g.sfx.ding(i), 250 + i * 350); });
  }

  detail(key, res, L) {
    if (key === 'zone' && zonesOf(L).length) return ` <em>${Math.round(res.zonePct * 100)}% in (need ${Math.round((L.zoneReq ?? 0.7) * 100)}%)</em>`;
    if (key === 'budget') return ` <em>used ${res.used}</em>`;
    if (key === 'clean' && res.damaged.length) return ` <em>hit: ${res.damaged.join(', ')}</em>`;
    if (key === 'air') return ` <em>${res.crowdDust} puffs reached them</em>`;
    return '';
  }

  hideResult() { $('result').hidden = true; }
  showPause(on) { $('pause').hidden = !on; }
  replayBadge(on) { $('replay-badge').hidden = !on; }

  debug(text) {
    const d = $('debug');
    d.hidden = text === null;
    if (text !== null) d.textContent = text;
  }
}

function delayColor(t) {
  const h = 52 - Math.min(1, t) * 48;
  return `hsl(${h}, 92%, 52%)`;
}
