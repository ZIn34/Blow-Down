// In-game DOM overlay: HUD, timeline, results, pause. (The main menu is menu.js.)
// Uses Pointer Events throughout so mouse and touch go through the same code.
import { STAR_ICON, zonesOf } from './scoring.js';
import { SPARKY_SVG } from './avatar.js';

const $ = id => document.getElementById(id);
const money = n => '$' + Math.round(n).toLocaleString('en-US');

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
    on('btn-clip', () => game.saveClip());
    on('btn-share', () => game.shareDaily());
    on('btn-showme', () => game.showMe());
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
    this.setCrew(null);
  }

  // The foreman who gives hints: Sparky's portrait, or a mascot bought in the shop.
  setCrew(emoji) {
    // each copy gets its own gradient ids; a hidden copy's ids would otherwise blank the visible one
    [...document.querySelectorAll('.avatar')].forEach((a, i) => {
      a.innerHTML = emoji ? `<span>${emoji}</span>` : SPARKY_SVG.replace(/\bsp(Bg|Hat|Skin|Clip)\b/g, `sp${i}$1`);
      a.classList.toggle('portrait', !emoji);
    });
  }

  setDetonator(skin) { $('btn-detonate').dataset.skin = skin; }

  hideHud() {
    $('hud').hidden = true;
    $('result').hidden = true;
    $('pause').hidden = true;
  }

  // ---- HUD --------------------------------------------------------------

  setLevel(L, label, { expert = null, types = [], type = 'std' } = {}) {
    $('result').hidden = true;
    $('pause').hidden = true;
    $('hud').hidden = false;
    $('lvl-num').textContent = label;
    $('lvl-name').textContent = L.name;
    $('goals').innerHTML = (L.stars || []).map(k =>
      `<div class="goal"><b>${STAR_ICON[k]}</b>${this.g.starText(k)}</div>`).join('') +
      (expert ? `<div class="goal expert"><b>◆</b>Expert: ${expert}</div>` : '') +
      (L.sandbox ? '<div class="goal"><b>💥</b>Sandbox: no score, no limits</div>' : '');
    this.max = L.maxDelay || 2;
    const ticks = $('tl-ticks');
    ticks.innerHTML = '';
    const step = this.max > 3 ? 1 : 0.5;
    for (let t = 0; t <= this.max + 1e-6; t += step) {
      const d = document.createElement('span');
      d.style.left = (t / this.max * 100) + '%';
      d.textContent = t.toFixed(step < 1 ? 1 : 0) + 's';
      ticks.appendChild(d);
    }
    for (const el of this.dots.values()) el.remove();
    this.dots.clear();
    $('wind').hidden = !L.wind;
    const box = $('ctypes');
    box.hidden = types.length < 2;
    box.innerHTML = types.map((t, i) => `<button data-type="${t.id}" title="Key ${i + 1}">${t.icon} ${t.name}</button>`).join('');
    for (const b of box.querySelectorAll('button'))
      b.addEventListener('click', e => { e.stopPropagation(); this.g.setChargeType(b.dataset.type); });
    this.setChargeType(type);
    this.setMode('rig');
  }

  setChargeType(id) {
    for (const b of $('ctypes').querySelectorAll('button')) b.classList.toggle('on', b.dataset.type === id);
  }

  setMode(mode) { $('hud').dataset.mode = mode; }

  setCharges(charges, selected, L) {
    $('charges').textContent = `💣 ${charges.length} / ${L.sandbox ? '∞' : L.maxCharges}`;
    $('btn-detonate').disabled = !charges.length;
    $('btn-clear').hidden = !charges.length;
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
      el.className = `dot t-${ch.type}` + (ch === selected ? ' sel' : '');
    }
    const sel = $('tl-sel');
    if (selected) sel.textContent = `Charge ${selected.n} fires at ${selected.delay.toFixed(2)} s`;
    else if (charges.length) sel.textContent = 'Drag a dot to change when it fires';
    else sel.textContent = 'Tap a glowing spot to place a charge';
  }

  makeDot(ch) {
    const el = document.createElement('div');
    el.className = 'dot';
    el.addEventListener('pointerdown', e => {
      e.stopPropagation();
      this.g.select(ch);
      this.startDrag(e, ch, el);
    });
    el.addEventListener('pointermove', e => this.dragTo(e));
    el.addEventListener('pointerup', () => { this.drag = null; });
    el.addEventListener('pointercancel', () => { this.drag = null; });
    el.addEventListener('wheel', e => {
      e.preventDefault();
      this.g.setDelay(ch, ch.delay + (e.deltaY < 0 ? 0.05 : -0.05));
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

  showResult(res, L, o, replayed = false) {
    const r = $('result');
    let title;
    if (L.sandbox) title = 'BOOM!';
    else if (res.damaged.length) title = 'WRONG WAY!';
    else if (!res.down) title = 'STILL STANDING';
    else title = res.count === res.stars.length ? 'PERFECT BLOWDOWN!' : 'DOWN IT GOES!';
    $('res-title').textContent = title;
    r.classList.toggle('fail', !L.sandbox && !res.passed);
    $('res-stars').innerHTML = res.stars.map((s, i) =>
      `<span class="bigstar ${s.got ? 'got' : ''}" style="animation-delay:${0.25 + i * 0.35}s">★</span>`).join('');
    const lines = res.stars.map(s => `<li class="${s.got ? 'ok' : 'no'}">${s.got ? '✔' : '✘'} ${s.label}${this.detail(s.key, res, L)}</li>`);
    if (res.damaged.length) lines.unshift(`<li class="no">💥 You hit the ${res.damaged.join(' and the ')}. That's an instant fail.</li>`);
    else if (!res.down && !L.sandbox) lines.unshift(`<li class="no">${Math.round(res.standing * 100)}% of it is still more than ${L.downHeight} m up</li>`);
    if (o.expert) lines.push(`<li class="${o.expert.got ? 'ok' : 'no'} exp">◆ Expert: ${o.expert.text}${o.expert.before && !o.expert.got ? ' <em>(already earned)</em>' : ''}</li>`);
    if (L.sandbox) lines.push(`<li class="ok">💣 ${res.used} charges · ${Math.round(res.zonePct * 100)}% in the zone</li>`);
    $('res-list').innerHTML = lines.join('');

    const cash = $('res-cash');
    cash.hidden = !o.cash && !o.rankUp;
    cash.innerHTML = (o.cash ? `<b>+${money(o.cash)}</b> <span>${o.notes.join(' · ')}</span>` : '') +
      (o.rankUp ? `<div class="rankup">${o.rankUp.icon} Promoted to ${o.rankUp.name}!</div>` : '');
    const streak = $('res-streak');
    streak.hidden = !o.streak;
    streak.textContent = `🔥 Daily streak: ${o.streak}`;

    const hint = $('res-hint');
    hint.hidden = !o.hint;
    if (o.hint) $('res-hint-text').textContent = o.hint;
    $('btn-showme').hidden = !o.canShowMe;
    $('btn-showme').textContent = `Show me how (${money(o.hintPrice)})`;
    $('btn-next').hidden = !o.hasNext;
    $('btn-next').textContent = o.nextLabel;
    $('btn-share').hidden = !o.canShare;
    $('btn-clip').hidden = !o.canClip;
    r.hidden = false;
    this.setMode('result');
    if (!replayed) res.stars.forEach((s, i) => { if (s.got) setTimeout(() => this.g.sfx.ding(i), 250 + i * 350); });
  }

  detail(key, res, L) {
    if (key === 'zone' && zonesOf(L).length) return ` <em>${Math.round(res.zonePct * 100)}% in (need ${Math.round((L.zoneReq ?? 0.7) * 100)}%)</em>`;
    if (key === 'budget') return ` <em>used ${res.used}</em>`;
    if (key === 'air') return ` <em>${res.crowdDust} puffs reached them</em>`;
    return '';
  }

  hideResult() { $('result').hidden = true; }
  showPause(on) { $('pause').hidden = !on; }

  replayBadge(on, recording = false) {
    $('replay-badge').hidden = !on;
    $('replay-label').textContent = recording ? '● RECORDING CLIP' : '▶ REPLAY · SLOW-MO';
    $('btn-skip').hidden = recording;
  }

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
