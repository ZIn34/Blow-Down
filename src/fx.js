// Explosions, dust clouds, flying bits. Purely visual except for the dust that
// drifts over a crowd, which is counted for the "clean air" star.
import * as THREE from 'three';
import { spriteTexture } from './render.js';

const MAX_PUFFS = 1400, MAX_BITS = 500;

const DUST_VERT = `
attribute float size; attribute float alpha; attribute vec3 tint;
uniform float scale; varying float vA; varying vec3 vC;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = size * scale / -mv.z;
  vA = alpha; vC = tint;
}`;
const DUST_FRAG = `
uniform sampler2D map; varying float vA; varying vec3 vC;
void main() {
  vec4 t = texture2D(map, gl_PointCoord);
  gl_FragColor = vec4(vC, t.a * vA);
}`;

const soft = () => spriteTexture((g, w) => {
  const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.45, 'rgba(255,255,255,0.6)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, w, w);
}, 64);

export class FX {
  constructor(scene) {
    this.scene = scene;
    // dust
    this.puffs = [];
    const geo = new THREE.BufferGeometry();
    this.pPos = new Float32Array(MAX_PUFFS * 3);
    this.pSize = new Float32Array(MAX_PUFFS);
    this.pAlpha = new Float32Array(MAX_PUFFS);
    this.pTint = new Float32Array(MAX_PUFFS * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(this.pSize, 1));
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.pAlpha, 1));
    geo.setAttribute('tint', new THREE.BufferAttribute(this.pTint, 3));
    this.dustMat = new THREE.ShaderMaterial({
      vertexShader: DUST_VERT, fragmentShader: DUST_FRAG,
      uniforms: { map: { value: soft() }, scale: { value: 600 } },
      transparent: true, depthWrite: false,
    });
    this.dust = new THREE.Points(geo, this.dustMat);
    this.dust.frustumCulled = false;
    this.dust.renderOrder = 5;
    scene.add(this.dust);

    // debris bits
    this.bits = [];
    this.bitMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff }), MAX_BITS);
    this.bitMesh.frustumCulled = false;
    this.bitMesh.castShadow = true;
    this.bitMesh.count = 0;
    scene.add(this.bitMesh);

    // flashes
    this.flashTex = spriteTexture((g, w) => {
      const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
      r.addColorStop(0, 'rgba(255,255,230,1)');
      r.addColorStop(0.25, 'rgba(255,200,90,0.9)');
      r.addColorStop(0.6, 'rgba(255,110,30,0.35)');
      r.addColorStop(1, 'rgba(255,80,0,0)');
      g.fillStyle = r; g.fillRect(0, 0, w, w);
    });
    this.flashes = [];
    this.light = new THREE.PointLight(0xffb060, 0, 40, 1.5);
    scene.add(this.light);

    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.s = new THREE.Vector3(); this.c = new THREE.Color();
    this.shake = 0;
    this.reset({});
  }

  setViewport(heightPx, fovDeg) {
    this.dustMat.uniforms.scale.value = heightPx / (2 * Math.tan(fovDeg * Math.PI / 360));
  }

  reset(level) {
    this.wind = level.wind ? new THREE.Vector3(level.wind[0], 0, level.wind[1]) : new THREE.Vector3(0.4, 0, 0.3);
    this.crowd = null;
    this.crowdDust = 0;
    this.clear();
  }

  setCrowd(box) { this.crowd = box; }

  clear() {
    this.puffs.length = 0;
    this.bits.length = 0;
    for (const f of this.flashes) this.scene.remove(f.sprite);
    this.flashes.length = 0;
    this.light.intensity = 0;
    this.shake = 0;
  }

  handle(type, p, d = {}) {
    if (type === 'blast') {
      this.flash(p, 4 + (d.size || 1) * 2);
      for (let i = 0; i < 6; i++) this.puff(p, rv(3, 2.5), 2.5 + Math.random() * 2, 0x7a746c, 2.8);
      for (let i = 0; i < 10; i++) this.bit(p, rv(9, 7), 0.12 + Math.random() * 0.2, 0x4a4540);
      this.shake = Math.min(1.5, this.shake + 0.5);
    } else if (type === 'crumble') {
      const col = this.c.setHex(d.color ?? 0x999999).lerp(new THREE.Color(0xbdb3a3), 0.55).getHex();
      for (let i = 0; i < 3; i++) this.puff(p, rv(1.2, 1), 2.5 + Math.random() * 2.5, col, 5);
      for (let i = 0; i < 4; i++) this.bit(p, rv(4, 3), 0.15 + Math.random() * 0.3, d.color ?? 0x999999);
    } else if (type === 'glass') {
      for (let i = 0; i < 6; i++) this.bit(p, rv(5, 3), 0.08 + Math.random() * 0.12, 0xd8f0ff, 1.2);
    } else if (type === 'shatter') {
      const n = Math.min(46, 10 + (d.count || 10) / 3 | 0);
      const r = Math.sqrt(d.count || 10) * 0.6;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const q = new THREE.Vector3(p.x + Math.cos(a) * r, 0.8 + Math.random() * 1.5, p.z + Math.sin(a) * r);
        const out = 3 + Math.random() * 4;
        this.puff(q, new THREE.Vector3(Math.cos(a) * out, 0.5 + Math.random(), Math.sin(a) * out), 5 + Math.random() * 4, 0xb7ad9c, 7);
      }
      this.shake = Math.min(2, this.shake + 0.4 + Math.min(1, (d.speed || 0) / 10));
    } else if (type === 'damage') {
      for (let i = 0; i < 4; i++) this.puff(p, rv(1.5, 1.5), 2 + Math.random() * 2, 0x9a8f80, 3);
    }
  }

  puff(p, v, size, color, life) {
    if (this.puffs.length >= MAX_PUFFS) this.puffs.shift();
    this.c.setHex(color);
    this.puffs.push({ x: p.x, y: p.y, z: p.z, vx: v.x, vy: v.y, vz: v.z, size, age: 0,
      life: life * (0.8 + Math.random() * 0.4), r: this.c.r, g: this.c.g, b: this.c.b, counted: false });
  }

  bit(p, v, size, color, life = 3) {
    if (this.bits.length >= MAX_BITS) this.bits.shift();
    this.bits.push({ p: p.clone(), v, size, color, life, age: 0,
      axis: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
      ang: 0, spin: 5 + Math.random() * 10 });
  }

  flash(p, size) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.flashTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    s.position.copy(p);
    s.renderOrder = 6;
    this.scene.add(s);
    this.flashes.push({ sprite: s, age: 0, size });
    this.light.position.copy(p);
    this.light.intensity = 900;
  }

  update(dt) {
    // dust
    const w = this.wind, P = this.puffs;
    for (let i = P.length - 1; i >= 0; i--) {
      const u = P[i];
      u.age += dt;
      if (u.age > u.life) { P.splice(i, 1); continue; }
      const drag = Math.exp(-1.6 * dt);
      u.vx = w.x + (u.vx - w.x) * drag;
      u.vz = w.z + (u.vz - w.z) * drag;
      u.vy = 0.25 + (u.vy - 0.25) * drag;
      u.x += u.vx * dt; u.y = Math.max(0.3, u.y + u.vy * dt); u.z += u.vz * dt;
      if (this.crowd && !u.counted && u.age / u.life < 0.8 && u.y < 5 &&
          u.x > this.crowd.min.x && u.x < this.crowd.max.x && u.z > this.crowd.min.z && u.z < this.crowd.max.z) {
        u.counted = true;
        this.crowdDust++;
      }
    }
    const n = P.length;
    for (let i = 0; i < n; i++) {
      const u = P[i], t = u.age / u.life;
      this.pPos[i * 3] = u.x; this.pPos[i * 3 + 1] = u.y; this.pPos[i * 3 + 2] = u.z;
      this.pSize[i] = u.size * (0.6 + t * 1.6);
      this.pAlpha[i] = Math.min(1, u.age * 6) * (1 - t) * 0.7;
      this.pTint[i * 3] = u.r; this.pTint[i * 3 + 1] = u.g; this.pTint[i * 3 + 2] = u.b;
    }
    const geo = this.dust.geometry;
    geo.setDrawRange(0, n);
    for (const k of ['position', 'size', 'alpha', 'tint']) geo.attributes[k].needsUpdate = true;

    // bits
    const B = this.bits;
    for (let i = B.length - 1; i >= 0; i--) {
      const b = B[i];
      b.age += dt;
      if (b.age > b.life) { B.splice(i, 1); continue; }
      b.v.y -= 9.8 * dt;
      b.p.addScaledVector(b.v, dt);
      if (b.p.y < b.size / 2) { b.p.y = b.size / 2; b.v.y *= -0.3; b.v.x *= 0.6; b.v.z *= 0.6; b.spin *= 0.6; }
      b.ang += b.spin * dt;
    }
    for (let i = 0; i < B.length; i++) {
      const b = B[i], k = b.size * Math.min(1, (b.life - b.age) * 2);
      this.q.setFromAxisAngle(b.axis, b.ang);
      this.bitMesh.setMatrixAt(i, this.m.compose(b.p, this.q, this.s.set(k, k, k)));
      this.bitMesh.setColorAt(i, this.c.setHex(b.color));
    }
    this.bitMesh.count = B.length;
    this.bitMesh.instanceMatrix.needsUpdate = true;
    if (this.bitMesh.instanceColor) this.bitMesh.instanceColor.needsUpdate = true;

    // flashes
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.age += dt;
      const t = f.age / 0.45;
      if (t >= 1) { this.scene.remove(f.sprite); f.sprite.material.dispose(); this.flashes.splice(i, 1); continue; }
      f.sprite.scale.setScalar(f.size * (0.5 + t * 1.2));
      f.sprite.material.opacity = 1 - t;
    }
    this.light.intensity *= Math.exp(-9 * dt);
    this.shake *= Math.exp(-3 * dt);
  }
}

function rv(h, up) {
  return new THREE.Vector3((Math.random() - 0.5) * h, Math.random() * up, (Math.random() - 0.5) * h);
}
