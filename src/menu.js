// Main menu: rank and cash, today's contract, and tabs for the campaign, remixes,
// sandbox and the shop.
import { LEVELS, CHAPTERS } from './levels.js';
import { campaignJob, remixJob, sandboxJob, availableRemixes, REMIXES } from './jobs.js';
import { dayNumber } from './dailygen.js';
import { SHOP, ownsItem } from './shop.js';

const $ = id => document.getElementById(id);
const money = n => '$' + Math.round(n).toLocaleString('en-US');
const stars = (n, of = 3) => `${'★'.repeat(n)}<i>${'★'.repeat(Math.max(0, of - n))}</i>`;

export class Menu {
  constructor(game) {
    this.g = game;
    this.tab = 'jobs';
    for (const b of document.querySelectorAll('#menu-tabs button'))
      b.addEventListener('click', () => { game.sfx.unlock(); game.sfx.click(); this.show(b.dataset.tab); });
    $('daily-card').addEventListener('click', () => { game.sfx.unlock(); game.startDaily(); });
  }

  hide() { $('menu').hidden = true; }

  busy(text, progress = 0) {
    const b = $('busy');
    b.hidden = text === null;
    if (text === null) return;
    $('busy-text').textContent = text;
    $('busy-bar').style.width = Math.round(progress * 100) + '%';
  }

  show(tab = this.tab) {
    this.tab = tab;
    $('menu').hidden = false;
    for (const b of document.querySelectorAll('#menu-tabs button')) b.classList.toggle('on', b.dataset.tab === tab);
    this.renderHeader();
    this.renderDaily();
    const body = $('menu-body');
    body.innerHTML = '';
    body.scrollTop = 0;
    ({ jobs: () => this.jobs(body), remix: () => this.remix(body), sandbox: () => this.sandbox(body), shop: () => this.shop(body) })[tab]();
  }

  renderHeader() {
    const p = this.g.profile, r = p.rank();
    $('menu-rank').innerHTML = `
      <div class="rank"><span class="ri">${r.icon}</span><div><b>${r.name}</b>
        <div class="rbar"><i style="width:${Math.round(r.progress * 100)}%"></i></div>
        <small>${r.next ? `${money(r.next.at - p.earned)} to ${r.next.name}` : 'Top of the trade'}</small></div></div>
      <div class="cash">${money(p.cash)}</div>`;
  }

  renderDaily() {
    const p = this.g.profile, day = dayNumber(), res = p.daily.results[day], streak = p.currentStreak(day);
    const status = res?.done
      ? `<span class="st">${stars(res.stars)}</span> Done · a new one tomorrow`
      : 'A new building every day · $500 + stars';
    $('daily-card').innerHTML = `
      <div class="dc-l"><b>📅 DAILY CONTRACT #${day}</b><span>${status}</span></div>
      <div class="dc-r">${streak ? `🔥<b>${streak}</b>` : '▶'}</div>`;
    $('daily-card').classList.toggle('done', !!res?.done);
  }

  card(parent, { n, name, sub, disabled, onClick, cls = '' }) {
    const b = document.createElement('button');
    b.className = 'lvl ' + cls;
    b.disabled = !!disabled;
    b.innerHTML = `<span class="n">${n}</span><span class="nm">${name}</span><span class="st">${sub}</span>`;
    b.addEventListener('click', () => { this.g.sfx.unlock(); onClick(); });
    parent.appendChild(b);
    return b;
  }

  grid(body) {
    const g = document.createElement('div');
    g.className = 'grid';
    body.appendChild(g);
    return g;
  }

  jobs(body) {
    const p = this.g.profile, unlocked = p.unlockedCount();
    const total = p.totalStars(), ex = p.expert.filter(Boolean).length;
    body.insertAdjacentHTML('beforeend', `<div class="summary">★ ${total} / ${LEVELS.length * 3} · ◆ ${ex} expert</div>`);
    const grid = this.grid(body);
    LEVELS.forEach((L, i) => {
      const ch = CHAPTERS.find(c => c.from === i);
      if (ch) grid.insertAdjacentHTML('beforeend', `<div class="chapter">${ch.name}</div>`);
      this.card(grid, { n: i + 1, name: L.name, disabled: i >= unlocked,
        sub: stars(p.best[i] || 0) + (p.expert[i] ? ' <b class="ex">◆</b>' : ''),
        onClick: () => this.g.play(campaignJob(i)) });
    });
  }

  remix(body) {
    const p = this.g.profile;
    const done = LEVELS.map((L, i) => i).filter(i => p.best[i] > 0 && availableRemixes(i).length);
    if (!done.length) {
      body.insertAdjacentHTML('beforeend', '<div class="empty">Finish a job to unlock its remixes: the same building with a twist.</div>');
      return;
    }
    body.insertAdjacentHTML('beforeend', `<div class="summary">${Object.entries(REMIXES).map(([, r]) => `${r.icon} ${r.name}`).join(' · ')}</div>`);
    for (const i of done) {
      const row = document.createElement('div');
      row.className = 'rmx';
      row.innerHTML = `<div class="rn"><span>${i + 1}</span>${LEVELS[i].name}</div><div class="rb"></div>`;
      for (const key of availableRemixes(i)) {
        const b = document.createElement('button');
        const got = p.remix[`${i}:${key}`] || 0;
        b.innerHTML = `<span>${REMIXES[key].icon}</span><small>${stars(got)}</small>`;
        b.title = `${REMIXES[key].name}: ${REMIXES[key].desc}`;
        b.addEventListener('click', () => { this.g.sfx.unlock(); this.g.play(remixJob(i, key)); });
        row.querySelector('.rb').appendChild(b);
      }
      body.appendChild(row);
    }
  }

  sandbox(body) {
    const unlocked = this.g.profile.unlockedCount();
    body.insertAdjacentHTML('beforeend', '<div class="summary">Any building you have reached. Charges on anything, no score.</div>');
    const grid = this.grid(body);
    LEVELS.forEach((L, i) => this.card(grid, { n: '💥', name: L.name, sub: `Job ${i + 1}`, disabled: i >= unlocked,
      onClick: () => this.g.play(sandboxJob(i)) }));
  }

  shop(body) {
    const p = this.g.profile;
    body.insertAdjacentHTML('beforeend', `<div class="summary">Your cash: <b>${money(p.cash)}</b></div>`);
    for (const cat of [...new Set(SHOP.map(s => s.cat))]) {
      body.insertAdjacentHTML('beforeend', `<div class="chapter">${cat}</div>`);
      for (const item of SHOP.filter(s => s.cat === cat)) {
        const owned = ownsItem(p, item), equipped = item.slot && p.equip[item.slot] === item.value;
        const row = document.createElement('div');
        row.className = 'item' + (equipped ? ' eq' : '');
        const label = equipped ? 'Equipped' : owned ? (item.slot ? 'Equip' : 'Owned') : money(item.price);
        row.innerHTML = `<span class="ii">${item.icon}</span><div class="id"><b>${item.name}</b><small>${item.desc}</small></div>
          <button ${equipped || (owned && !item.slot) || (!owned && p.cash < item.price) ? 'disabled' : ''}>${label}</button>`;
        row.querySelector('button').addEventListener('click', () => {
          this.g.sfx.unlock();
          if (this.g.buy(item)) this.show('shop');
        });
        body.appendChild(row);
      }
    }
  }
}
