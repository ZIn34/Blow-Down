// Everything beyond the level: sky dome, sun glow, clouds, stars, and a distant
// backdrop (hills and tree lines, or a city skyline) so the world doesn't end in
// a flat green plane.
import * as THREE from 'three';

const SKY_VERT = `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const SKY_FRAG = `
uniform vec3 top, horizon, bottom, sunColor, sunDir;
uniform float sunSize, glow;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = h > 0.0 ? mix(horizon, top, pow(h, 0.55)) : mix(horizon, bottom, pow(-h, 0.4));
  float s = max(dot(d, normalize(sunDir)), 0.0);
  col += sunColor * (pow(s, sunSize) * 1.6 + pow(s, 8.0) * glow);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export const SKIES = {
  day:   { top: 0x3f7fd0, horizon: 0xcfe3f0, bottom: 0xb9cbb0, sun: 0xfff4d6, sunSize: 900, glow: 0.25, clouds: 0xffffff },
  dusk:  { top: 0x2e3a6e, horizon: 0xf7a766, bottom: 0x6a5a58, sun: 0xffc27a, sunSize: 300, glow: 0.7, clouds: 0xffc6a8 },
  night: { top: 0x040816, horizon: 0x1d2a4a, bottom: 0x0b1020, sun: 0xbfd0ff, sunSize: 2500, glow: 0.08, clouds: null },
};

function canvasTex(size, draw) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  draw(cv.getContext('2d'), size);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Soft lumpy cloud made of overlapping blobs.
function cloudTexture() {
  return canvasTex(256, (g, s) => {
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 26; i++) {
      const x = s * (0.18 + rnd() * 0.64), y = s * (0.42 + rnd() * 0.22), r = s * (0.08 + rnd() * 0.14);
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,0.55)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, s, s);
    }
  });
}

export class Scenery {
  constructor(scene) {
    this.scene = scene;
    this.skyMat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, bottom: { value: new THREE.Color() },
        sunColor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) },
        sunSize: { value: 800 }, glow: { value: 0.3 },
      },
    });
    // the sky and stars travel with the camera so they're always "infinitely" far away
    this.skyGroup = new THREE.Group();
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(700, 32, 16), this.skyMat);
    this.sky.renderOrder = -10;
    this.sky.frustumCulled = false;
    this.skyGroup.add(this.sky);
    scene.add(this.skyGroup);

    this.cloudTex = cloudTexture();
    this.group = new THREE.Group();   // per-level backdrop
    scene.add(this.group);
    this.clouds = [];
  }

  set(themeName, sunDir, setting = 'country') {
    const t = SKIES[themeName] || SKIES.day;
    const u = this.skyMat.uniforms;
    u.top.value.setHex(t.top); u.horizon.value.setHex(t.horizon); u.bottom.value.setHex(t.bottom);
    u.sunColor.value.setHex(t.sun); u.sunDir.value.copy(sunDir).normalize();
    u.sunSize.value = t.sunSize; u.glow.value = t.glow;

    for (const grp of [this.group, this.skyGroup]) {
      for (const o of [...grp.children]) {
        if (o === this.sky) continue;
        o.traverse(x => { x.geometry?.dispose(); x.material?.dispose?.(); });
        grp.remove(o);
      }
    }
    this.clouds = [];
    const night = themeName === 'night';
    let seed = 1234;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

    if (night) this.skyGroup.add(stars(rnd));
    if (t.clouds) {
      for (let i = 0; i < 16; i++) {
        const m = new THREE.SpriteMaterial({ map: this.cloudTex, color: t.clouds, transparent: true, depthWrite: false, fog: false, opacity: 0.9 });
        const s = new THREE.Sprite(m);
        const a = rnd() * Math.PI * 2, r = 180 + rnd() * 250;
        s.position.set(Math.cos(a) * r, 70 + rnd() * 70, Math.sin(a) * r);
        s.scale.set(90 + rnd() * 90, 35 + rnd() * 25, 1);
        s.renderOrder = -9;
        this.group.add(s);
        this.clouds.push(s);
      }
    }
    if (setting === 'city') this.group.add(skyline(rnd, night));
    else this.group.add(countryside(rnd, setting === 'coast', themeName));
  }

  update(dt, camera) {
    this.skyGroup.position.copy(camera.position);
    for (const c of this.clouds) {
      c.position.x += dt * 1.5;
      if (c.position.x > 450) c.position.x -= 900;
    }
  }
}

function stars(rnd) {
  const n = 900, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, y = 0.08 + rnd() * 0.92, r = Math.sqrt(1 - y * y);
    pos.set([Math.cos(a) * r * 650, y * 650, Math.sin(a) * r * 650], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xdfe8ff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 }));
  p.renderOrder = -9;
  return p;
}

// Rolling hills on the horizon and clumps of trees in the middle distance.
function countryside(rnd, coast, theme) {
  const g = new THREE.Group();
  const hillCol = theme === 'night' ? 0x1d2a22 : theme === 'dusk' ? 0x5d6a48 : 0x6f9a58;
  const nh = 34;
  const hills = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshLambertMaterial({ color: hillCol, flatShading: true }), nh);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  let k = 0;
  for (let i = 0; i < nh; i++) {
    const a = i / nh * Math.PI * 2 + rnd() * 0.15;
    if (coast && Math.sin(a) > -0.1) continue;          // the sea is to the north
    const r = 230 + rnd() * 90;
    p.set(Math.cos(a) * r, -4, Math.sin(a) * r);
    s.set(45 + rnd() * 50, 14 + rnd() * 22, 45 + rnd() * 50);
    hills.setMatrixAt(k++, m.compose(p, q, s));
  }
  hills.count = k;
  g.add(hills);

  const nt = 140;
  const trees = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 6), new THREE.MeshLambertMaterial({ color: theme === 'night' ? 0x16241a : 0x3d6b3a, flatShading: true }), nt);
  const c = new THREE.Color();
  k = 0;
  for (let i = 0; i < nt; i++) {
    const a = rnd() * Math.PI * 2;
    if (coast && Math.sin(a) > -0.1) continue;
    const r = 95 + rnd() * 110, h = 7 + rnd() * 9;
    p.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
    s.set(h * 0.35, h, h * 0.35);
    trees.setMatrixAt(k, m.compose(p, q, s));
    trees.setColorAt(k++, c.setHex(0xffffff).multiplyScalar(0.8 + rnd() * 0.35));
  }
  trees.count = k;
  trees.castShadow = false;
  g.add(trees);
  return g;
}

// Towers of all sizes around the edge of town, windows lit at night.
function skyline(rnd, night) {
  const n = 90;
  const lit = [];
  const tex = canvasTex(64, (g, w) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, w);
    for (let y = 4; y < w; y += 10) for (let x = 4; x < w; x += 10) {
      const on = rnd() < 0.5;
      if (on) lit.push([x, y]);
      g.fillStyle = night ? (on ? '#fff0c0' : '#2a3040') : '#8ea2b6';
      g.fillRect(x, y, 5, 6);
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 6);
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, map: tex });
  if (night) {
    // only the lit windows glow; the walls stay dark
    const glow = canvasTex(64, g => {
      g.fillStyle = '#000'; g.fillRect(0, 0, 64, 64);
      g.fillStyle = '#ffd98a';
      for (const [x, y] of lit) g.fillRect(x, y, 5, 6);
    });
    glow.wrapS = glow.wrapT = THREE.RepeatWrapping;
    glow.repeat.set(3, 6);
    mat.color.setHex(0x3a4458);
    mat.emissive = new THREE.Color(0xffffff);
    mat.emissiveMap = glow;
    mat.emissiveIntensity = 0.9;
  }
  const city = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
  const tones = [0xb9c2cc, 0xd6cfc4, 0x9aa8b6, 0xc8b8a4, 0xe4e6e8];
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, r = 140 + rnd() * 180;
    const h = 18 + Math.pow(rnd(), 2) * 80, w = 10 + rnd() * 16;
    p.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * Math.PI);
    s.set(w, h, w * (0.7 + rnd() * 0.6));
    city.setMatrixAt(i, m.compose(p, q, s));
    city.setColorAt(i, c.setHex(tones[i % tones.length]));
  }
  return city;
}
