// Explosions, dust clouds, flying bits. Purely visual except for the dust that
// drifts over a crowd, which is counted for the "clean air" star.
//
// A charge going off layers: a white-hot flash, a rolling fireball, sparks, a
// shockwave ring along the ground, chunks of debris, and dark smoke that rises
// and thins out into the lighter dust cloud of the collapse.
import * as THREE from 'three';
import { spriteTexture } from './render.js';

const MAX_PUFFS = 1400, MAX_BITS = 500, MAX_SPARKS = 400;

const DUST_VERT = `
attribute float size; attribute float alpha; attribute vec3 tint; attribute float spin;
uniform float scale; varying float vA; varying vec3 vC; varying float vS;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = size * scale / -mv.z;
  vA = alpha; vC = tint; vS = spin;
}`;
const DUST_FRAG = `
uniform sampler2D map; varying float vA; varying vec3 vC; varying float vS;
void main() {
  // rotate each puff so the billows don't all line up
  vec2 c = gl_PointCoord - 0.5;
  float s = sin(vS), k = cos(vS);
  vec2 uv = vec2(c.x * k - c.y * s, c.x * s + c.y * k) + 0.5;
  vec4 t = texture2D(map, uv);
  // a touch of self-shadowing: lower part of each puff is darker
  float shade = 0.78 + 0.32 * (1.0 - gl_PointCoord.y);
  gl_FragColor = vec4(vC * shade, t.a * vA);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const PALETTES = {
  classic: { fire: ['255,240,200', '255,170,60', '220,70,20', '120,30,10'], spark: [0xffc860], light: 0xffa050 },
  blue:    { fire: ['225,242,255', '90,170,255', '40,80,220', '10,20,90'], spark: [0x9fd8ff, 0xe0f4ff], light: 0x6aa8ff },
  toxic:   { fire: ['235,255,205', '150,255,80', '40,180,40', '10,60,10'], spark: [0xb6ff6a], light: 0x7aff5a },
  party:   { fire: ['255,232,250', '255,90,200', '140,60,255', '40,20,120'], spark: [0xff4fa3, 0x4fd2ff, 0xffe14f, 0x7dff6a, 0xb56bff], light: 0xff6ad5 },
  gold:    { fire: ['255,250,222', '255,215,90', '220,150,20', '110,70,0'], spark: [0xffe27a, 0xfff2b0], light: 0xffd060 },
};

let seed = 11;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

// Billowy puff: a cluster of soft blobs rather than one smooth disc.
const billow = () => spriteTexture((g, w) => {
  for (let i = 0; i < 11; i++) {
    const a = rnd() * Math.PI * 2, d = rnd() * w * 0.16;
    const x = w / 2 + Math.cos(a) * d, y = w / 2 + Math.sin(a) * d, r = w * (0.2 + rnd() * 0.14);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.42)');
    gr.addColorStop(0.6, 'rgba(255,255,255,0.18)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, w);
  }
}, 128);

const radial = stops => spriteTexture((g, w) => {
  const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  for (const [o, c] of stops) r.addColorStop(o, c);
  g.fillStyle = r;
  g.fillRect(0, 0, w, w);
});

export class FX {
  constructor(scene) {
    this.scene = scene;

    // dust and smoke
    this.puffs = [];
    const geo = new THREE.BufferGeometry();
    this.pPos = new Float32Array(MAX_PUFFS * 3);
    this.pSize = new Float32Array(MAX_PUFFS);
    this.pAlpha = new Float32Array(MAX_PUFFS);
    this.pTint = new Float32Array(MAX_PUFFS * 3);
    this.pSpin = new Float32Array(MAX_PUFFS);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(this.pSize, 1));
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.pAlpha, 1));
    geo.setAttribute('tint', new THREE.BufferAttribute(this.pTint, 3));
    geo.setAttribute('spin', new THREE.BufferAttribute(this.pSpin, 1));
    this.dustMat = new THREE.ShaderMaterial({
      vertexShader: DUST_VERT, fragmentShader: DUST_FRAG,
      uniforms: { map: { value: billow() }, scale: { value: 600 } },
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

    // sparks: unlit, so they glow
    this.sparks = [];
    this.sparkMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), MAX_SPARKS);
    this.sparkMesh.frustumCulled = false;
    this.sparkMesh.count = 0;
    scene.add(this.sparkMesh);

    // flash, fireball, shockwave
    this.sprites = [];
    this.ringGeo = new THREE.RingGeometry(0.82, 1, 48);
    this.ringGeo.rotateX(-Math.PI / 2);
    this.rings = [];
    this.light = new THREE.PointLight(0xffa050, 0, 45, 1.5);
    scene.add(this.light);

    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.s = new THREE.Vector3();
    this.c = new THREE.Color(); this.v = new THREE.Vector3(); this.up = new THREE.Vector3(0, 1, 0);
    this.shake = 0;
    this.setPalette('classic');
    this.reset({});
  }

  // Explosion colours (bought in the shop).
  setPalette(name) {
    const p = this.palette = PALETTES[name] || PALETTES.classic;
    this.flashTex?.dispose();
    this.fireTex?.dispose();
    this.flashTex = radial([[0, `rgba(${p.fire[0]},1)`], [0.3, `rgba(${p.fire[1]},0.9)`], [1, `rgba(${p.fire[2]},0)`]]);
    this.fireTex = radial([[0, `rgba(${p.fire[0]},1)`], [0.25, `rgba(${p.fire[1]},0.95)`], [0.6, `rgba(${p.fire[2]},0.55)`], [1, `rgba(${p.fire[3]},0)`]]);
    this.light.color.setHex(p.light);
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
    this.sparks.length = 0;
    for (const f of this.sprites) { this.scene.remove(f.sprite); f.sprite.material.dispose(); }
    this.sprites.length = 0;
    for (const r of this.rings) { this.scene.remove(r.mesh); r.mesh.material.dispose(); }
    this.rings.length = 0;
    this.light.intensity = 0;
    this.shake = 0;
  }

  handle(type, p, d = {}) {
    if (type === 'blast') {
      const k = 0.8 + Math.min(1.5, (d.size || 1) * 0.5);
      this.sprite(p, this.flashTex, 3 * k, 7 * k, 0.22, 0, THREE.AdditiveBlending);
      for (let i = 0; i < 4; i++) {
        const q = p.clone().add(rv(1.6 * k, 1.2 * k));
        this.sprite(q, this.fireTex, 2 * k, (5 + rnd() * 3) * k, 0.5 + rnd() * 0.3, 2.5 + rnd() * 2, THREE.AdditiveBlending);
      }
      for (let i = 0; i < 26; i++) {
        const dir = rv(1, 0.9).normalize().multiplyScalar(9 + rnd() * 12);
        this.spark(p, dir);
      }
      if (p.y < 10) this.ring(new THREE.Vector3(p.x, 0.12, p.z), 7 + 3 * k);
      for (let i = 0; i < 7; i++) this.puff(p, rv(3, 2.5).add(this.v.set(0, 1.5, 0)), 3 + rnd() * 3, 0x3b3733, 4.5);
      for (let i = 0; i < 12; i++) this.bit(p, rv(10, 8), 0.12 + rnd() * 0.25, 0x3f3a35);
      this.light.position.copy(p);
      this.light.intensity = 1400;
      this.shake = Math.min(1.6, this.shake + 0.55);
    } else if (type === 'crumble') {
      const col = this.c.setHex(d.color ?? 0x999999).lerp(new THREE.Color(0xc2b8a6), 0.6).getHex();
      for (let i = 0; i < 3; i++) this.puff(p, rv(1.4, 1), 3 + rnd() * 3, col, 5.5);
      for (let i = 0; i < 5; i++) this.bit(p, rv(4.5, 3), 0.15 + rnd() * 0.35, d.color ?? 0x999999);
    } else if (type === 'glass') {
      for (let i = 0; i < 8; i++) this.bit(p, rv(6, 3), 0.08 + rnd() * 0.12, 0xd8f0ff, 1.2);
      for (let i = 0; i < 4; i++) this.spark(p, rv(6, 2), 0xcfeaff, 0.35);
    } else if (type === 'shatter') {
      // the rolling dust cloud that spreads out along the ground
      const n = Math.min(60, 14 + (d.count || 10) / 3 | 0);
      const r = Math.sqrt(d.count || 10) * 0.6;
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2;
        const q = new THREE.Vector3(p.x + Math.cos(a) * r, 0.8 + rnd() * 2, p.z + Math.sin(a) * r);
        const out = 3 + rnd() * 5;
        this.puff(q, new THREE.Vector3(Math.cos(a) * out, 0.6 + rnd() * 1.2, Math.sin(a) * out), 6 + rnd() * 5, 0xbdb3a1, 8);
      }
      if ((d.count || 0) > 20) this.ring(new THREE.Vector3(p.x, 0.12, p.z), 6 + r * 1.5, 0xd8cdb8, 0.3);
      this.shake = Math.min(2, this.shake + 0.4 + Math.min(1, (d.speed || 0) / 10));
    } else if (type === 'damage') {
      for (let i = 0; i < 5; i++) this.puff(p, rv(1.5, 1.5), 2 + rnd() * 2, 0x9a8f80, 3);
    }
  }

  puff(p, v, size, color, life) {
    if (this.puffs.length >= MAX_PUFFS) this.puffs.shift();
    this.c.setHex(color);
    this.puffs.push({ x: p.x, y: p.y, z: p.z, vx: v.x, vy: v.y, vz: v.z, size, age: 0,
      life: life * (0.8 + rnd() * 0.4), r: this.c.r, g: this.c.g, b: this.c.b, counted: false,
      spin: rnd() * 6.28, spinV: (rnd() - 0.5) * 0.6 });
  }

  bit(p, v, size, color, life = 3) {
    if (this.bits.length >= MAX_BITS) this.bits.shift();
    this.bits.push({ p: p.clone(), v, size, color, life, age: 0,
      axis: new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(), ang: 0, spin: 5 + rnd() * 10 });
  }

  spark(p, v, color = this.palette.spark[Math.floor(rnd() * this.palette.spark.length)], life = 0.5 + rnd() * 0.5) {
    if (this.sparks.length >= MAX_SPARKS) this.sparks.shift();
    this.sparks.push({ p: p.clone(), v, color, life, age: 0 });
  }

  sprite(p, tex, s0, s1, life, rise, blending) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending, depthWrite: false, transparent: true }));
    s.position.copy(p);
    s.renderOrder = 6;
    this.scene.add(s);
    this.sprites.push({ sprite: s, age: 0, s0, s1, life, rise, spin: (rnd() - 0.5) * 2 });
  }

  ring(p, radius, color = 0xffe2b0, opacity = 0.28) {
    // several charges firing together would stack into a white-out; a few rings are plenty
    if (this.rings.length >= 3 || this.rings.some(r => r.age < 0.15 && r.mesh.position.distanceTo(p) < 8)) return;
    const mesh = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    mesh.position.copy(p);
    mesh.renderOrder = 4;
    this.scene.add(mesh);
    this.rings.push({ mesh, age: 0, radius, opacity, life: 0.55 });
  }

  update(dt) {
    // dust and smoke
    const w = this.wind, P = this.puffs;
    for (let i = P.length - 1; i >= 0; i--) {
      const u = P[i];
      u.age += dt;
      if (u.age > u.life) { P.splice(i, 1); continue; }
      const drag = Math.exp(-1.6 * dt);
      u.vx = w.x + (u.vx - w.x) * drag;
      u.vz = w.z + (u.vz - w.z) * drag;
      u.vy = 0.3 + (u.vy - 0.3) * drag;
      u.x += u.vx * dt; u.y = Math.max(0.3, u.y + u.vy * dt); u.z += u.vz * dt;
      u.spin += u.spinV * dt;
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
      this.pSize[i] = u.size * (0.55 + Math.sqrt(t) * 1.9);
      this.pAlpha[i] = Math.min(1, u.age * 5) * Math.pow(1 - t, 1.3) * 0.85;
      // smoke lightens toward dust colour as it thins
      const lift = t * 0.35;
      this.pTint[i * 3] = u.r + (0.75 - u.r) * lift; this.pTint[i * 3 + 1] = u.g + (0.72 - u.g) * lift; this.pTint[i * 3 + 2] = u.b + (0.66 - u.b) * lift;
      this.pSpin[i] = u.spin;
    }
    const geo = this.dust.geometry;
    geo.setDrawRange(0, n);
    for (const k of ['position', 'size', 'alpha', 'tint', 'spin']) geo.attributes[k].needsUpdate = true;

    // debris bits
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

    // sparks: stretched along their direction of travel, fading from white-hot to orange
    const S = this.sparks;
    for (let i = S.length - 1; i >= 0; i--) {
      const s = S[i];
      s.age += dt;
      if (s.age > s.life) { S.splice(i, 1); continue; }
      s.v.y -= 9.8 * dt;
      s.v.multiplyScalar(Math.exp(-1.5 * dt));
      s.p.addScaledVector(s.v, dt);
      if (s.p.y < 0.05) { s.p.y = 0.05; s.v.y *= -0.35; }
    }
    for (let i = 0; i < S.length; i++) {
      const s = S[i], t = s.age / s.life, len = Math.min(1.6, s.v.length() * 0.06) + 0.1;
      this.q.setFromUnitVectors(this.up, this.v.copy(s.v).normalize());
      this.sparkMesh.setMatrixAt(i, this.m.compose(s.p, this.q, this.s.set(0.07, len, 0.07)));
      this.sparkMesh.setColorAt(i, this.c.setHex(s.color).multiplyScalar(2.2 * (1 - t) + 0.3));
    }
    this.sparkMesh.count = S.length;
    this.sparkMesh.instanceMatrix.needsUpdate = true;
    if (this.sparkMesh.instanceColor) this.sparkMesh.instanceColor.needsUpdate = true;

    // flashes and fireballs
    for (let i = this.sprites.length - 1; i >= 0; i--) {
      const f = this.sprites[i];
      f.age += dt;
      const t = f.age / f.life;
      if (t >= 1) { this.scene.remove(f.sprite); f.sprite.material.dispose(); this.sprites.splice(i, 1); continue; }
      f.sprite.scale.setScalar(f.s0 + (f.s1 - f.s0) * Math.sqrt(t));
      f.sprite.material.opacity = (1 - t) * (1 - t);
      f.sprite.material.rotation += f.spin * dt;
      f.sprite.position.y += f.rise * dt;
    }

    // shockwave rings
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.age += dt;
      const t = r.age / r.life;
      if (t >= 1) { this.scene.remove(r.mesh); r.mesh.material.dispose(); this.rings.splice(i, 1); continue; }
      r.mesh.scale.setScalar(1 + r.radius * (1 - Math.pow(1 - t, 3)));
      r.mesh.material.opacity = r.opacity * (1 - t);
    }

    this.light.intensity *= Math.exp(-8 * dt);
    this.shake *= Math.exp(-3 * dt);
  }
}

function rv(h, up) {
  return new THREE.Vector3((rnd() - 0.5) * h, rnd() * up, (rnd() - 0.5) * h);
}
