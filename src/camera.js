// Orbit camera around a target. yaw 0 = looking north from the south.
import * as THREE from 'three';

export class OrbitCam {
  constructor(cam) {
    this.cam = cam;
    this.target = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0.3; this.dist = 30;
    this.minDist = 5; this.maxDist = 120;
    this.auto = 0;
  }

  setView(v) {
    // narrow portrait screens see less sideways, so back the camera off a little
    const k = Math.min(1.5, Math.max(1, 0.6 / this.cam.aspect));
    v = { ...v, dist: v.dist * k };
    this.target.set(...v.target);
    this.home = v;
    this.yaw = v.yaw; this.pitch = v.pitch; this.dist = v.dist;
    this.maxDist = v.dist * 2.2;
    this.minDist = Math.max(5, v.dist * 0.25);
  }

  orbit(dx, dy) {
    this.yaw -= dx * 0.006;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dy * 0.005, 0.04, 1.45);
  }

  zoom(f) {
    this.dist = THREE.MathUtils.clamp(this.dist * f, this.minDist, this.maxDist);
  }

  pan(dx, dy) {
    const s = this.dist * 0.0016, c = Math.cos(this.yaw), n = Math.sin(this.yaw);
    // screen right is (-cos, 0, -sin); screen forward is (-sin, 0, cos)
    this.target.x += (dx * c - dy * n) * s;
    this.target.z += (dx * n + dy * c) * s;
    if (this.home) {
      const h = this.home.target, lim = this.home.dist * 0.6;
      this.target.x = THREE.MathUtils.clamp(this.target.x, h[0] - lim, h[0] + lim);
      this.target.z = THREE.MathUtils.clamp(this.target.z, h[2] - lim, h[2] + lim);
    }
  }

  // Screen-space direction of a world-space horizontal vector, as a CSS angle (0 = up).
  screenAngle(x, z) {
    const c = Math.cos(this.yaw), n = Math.sin(this.yaw);
    const sx = -x * c - z * n, sy = -x * n + z * c;
    return Math.atan2(sx, sy);
  }

  update(dt, keys, shake = 0) {
    const k = dt * 60;
    if (keys.has('KeyA') || keys.has('ArrowLeft') && !keys.nudge) this.orbit(-6 * k, 0);
    if (keys.has('KeyD') || keys.has('ArrowRight') && !keys.nudge) this.orbit(6 * k, 0);
    if (keys.has('KeyW')) this.zoom(Math.pow(0.985, k));
    if (keys.has('KeyS')) this.zoom(Math.pow(1 / 0.985, k));
    if (keys.has('KeyQ')) this.orbit(0, -4 * k);
    if (keys.has('KeyE')) this.orbit(0, 4 * k);
    this.yaw += this.auto * dt;
    const cp = Math.cos(this.pitch);
    this.cam.position.set(
      this.target.x + Math.sin(this.yaw) * cp * this.dist,
      this.target.y + Math.sin(this.pitch) * this.dist,
      this.target.z - Math.cos(this.yaw) * cp * this.dist);
    if (shake > 0.01) {
      const a = shake * 0.25;
      this.cam.position.x += (Math.random() - 0.5) * a;
      this.cam.position.y += (Math.random() - 0.5) * a;
    }
    this.cam.position.y = Math.max(0.6, this.cam.position.y);
    this.cam.lookAt(this.target);
  }
}
