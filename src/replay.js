// Records every chunk's transform at 30 Hz plus effect events, and plays them back.
const RATE = 1 / 30, MAX_T = 24;

export class Recorder {
  constructor(view) {
    this.view = view;
    this.frames = [];
    this.events = [];
    this.t = 0;
  }

  start() {
    this.frames = [{ t: 0, data: this.view.capture() }];
    this.events = [];
    this.t = 0;
    this.acc = 0;
  }

  tick(dt) {
    this.t += dt;
    this.acc += dt;
    if (this.acc >= RATE && this.t < MAX_T) {
      this.acc -= RATE;
      this.frames.push({ t: this.t, data: this.view.capture() });
    }
  }

  // capture the final resting state too
  close() { this.frames.push({ t: this.t, data: this.view.capture() }); }

  event(type, p, d) { this.events.push({ t: this.t, type, p: p.clone(), d }); }

  get duration() { return this.frames.length ? this.frames[this.frames.length - 1].t : 0; }
}

export class Player {
  constructor(rec, view, fx) {
    this.rec = rec; this.view = view; this.fx = fx;
    this.t = 0; this.f = 0; this.e = 0;
    fx.clear();
    view.restore(rec.frames[0].data);
  }

  // returns true when finished
  update(dt) {
    this.t += dt;
    const F = this.rec.frames;
    while (this.f < F.length - 2 && F[this.f + 1].t <= this.t) this.f++;
    const a = F[this.f], b = F[Math.min(this.f + 1, F.length - 1)];
    const k = b.t > a.t ? Math.min(1, (this.t - a.t) / (b.t - a.t)) : 1;
    this.view.restore(a.data, b.data, k);
    const E = this.rec.events;
    while (this.e < E.length && E[this.e].t <= this.t) {
      const ev = E[this.e++];
      this.fx.handle(ev.type, ev.p, ev.d);
    }
    return this.t >= this.rec.duration + 0.8;
  }

  finish() {
    const F = this.rec.frames;
    this.view.restore(F[F.length - 1].data);
  }
}
