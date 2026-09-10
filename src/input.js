// One input path for mouse, touch and pen (Pointer Events), plus keyboard.
//   tap / click            -> onTap
//   drag (left, right, 1 finger) -> onOrbit
//   middle-drag, shift-drag, 2-finger drag -> onPan
//   wheel, pinch           -> onZoom
export class Input {
  constructor(el, h) {
    this.el = el;
    this.h = h;
    this.pointers = new Map();
    this.keys = new Set();
    this.multi = false;

    el.addEventListener('pointerdown', e => this.down(e));
    el.addEventListener('pointermove', e => this.move(e));
    el.addEventListener('pointerup', e => this.up(e));
    el.addEventListener('pointercancel', e => { this.pointers.delete(e.pointerId); if (!this.pointers.size) this.multi = false; });
    el.addEventListener('wheel', e => { e.preventDefault(); h.onZoom(Math.exp(e.deltaY * 0.0012)); }, { passive: false });
    el.addEventListener('contextmenu', e => e.preventDefault());

    addEventListener('keydown', e => {
      if (['Space', 'Tab', 'F1', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Backspace'].includes(e.code)) e.preventDefault();
      if (!e.repeat) h.onKey(e.code, e);
      else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') h.onKey(e.code, e);
      this.keys.add(e.code);
    });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
  }

  local(e) {
    const r = this.el.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  down(e) {
    this.h.onAny?.();
    try { this.el.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY,
      button: e.button, shift: e.shiftKey, moved: false });
    if (this.pointers.size >= 2) {
      this.multi = true;
      this.pinch = this.pinchState();
    }
  }

  pinchState() {
    const [a, b] = [...this.pointers.values()];
    return { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
  }

  move(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (this.pointers.size === 1 && !this.multi) {
      if (!p.moved && Math.hypot(p.x - p.sx, p.y - p.sy) > 7) p.moved = true;
      if (!p.moved) return;
      if (p.button === 1 || p.shift) this.h.onPan(dx, dy);
      else this.h.onOrbit(dx, dy);
    } else if (this.pointers.size >= 2) {
      const s = this.pinchState(), o = this.pinch;
      if (o && s.d > 0) {
        this.h.onZoom(o.d / s.d);
        this.h.onPan(s.mx - o.mx, s.my - o.my);
      }
      this.pinch = s;
    }
  }

  up(e) {
    const p = this.pointers.get(e.pointerId);
    this.pointers.delete(e.pointerId);
    if (p && !p.moved && !this.multi && e.button !== 2) this.h.onTap(...this.local(e));
    if (this.pointers.size < 2) this.pinch = null;
    if (!this.pointers.size) this.multi = false;
  }
}
