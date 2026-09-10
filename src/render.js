// Scene, lights, themes, and the instanced renderer for building chunks.
import * as THREE from 'three';
import { Scenery, SKIES } from './scenery.js';

const THEMES = {
  day:   { ground: 0x86b560, hemiSky: 0xd8ecff, hemiGround: 0x6d8a48, hemi: 1.5, sun: 0xfff0d8, sunI: 3.4, exposure: 1.05, night: false },
  dusk:  { ground: 0x7a9a55, hemiSky: 0xffcfa8, hemiGround: 0x5a5a44, hemi: 1.2, sun: 0xffa860, sunI: 3.0, exposure: 1.1, night: false },
  night: { ground: 0x34503a, hemiSky: 0x6a82b8, hemiGround: 0x1c2418, hemi: 0.9, sun: 0xb4c8ff, sunI: 0.9, exposure: 1.2, night: true },
};

export class View3D {
  constructor(canvas) {
    const mobile = matchMedia('(pointer: coarse)').matches;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'high-performance' });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;   // filmic colour grading
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, 9 / 16, 0.3, 900);
    this.scenery = new Scenery(this.scene);

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    this.sun = new THREE.DirectionalLight(0xffffff, 2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.hemi, this.sun, this.sun.target);

    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshLambertMaterial({ map: groundTexture() }));
    this.ground.material.map.repeat.set(70, 70);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    this.level = new THREE.Group();
    this.scene.add(this.level);
    this.theme = THEMES.day;
  }

  setTheme(name, span = 40, setting = 'country') {
    const t = this.theme = THEMES[name] || THEMES.day;
    const sky = SKIES[name] || SKIES.day;
    // fog fades into the sky's horizon colour so the world has no hard edge
    this.scene.background = new THREE.Color(sky.horizon);
    this.scene.fog = new THREE.Fog(sky.horizon, 150, 520);
    this.renderer.toneMappingExposure = t.exposure;
    this.hemi.color.setHex(t.hemiSky);
    this.hemi.groundColor.setHex(t.hemiGround);
    this.hemi.intensity = t.hemi;
    this.sun.color.setHex(t.sun);
    this.sun.intensity = t.sunI;
    // low sun at dusk, high sun by day
    const low = name === 'dusk' ? 0.55 : name === 'night' ? 1.1 : 1.4;
    this.sun.position.set(-span * 0.8, span * low, -span * 0.6);
    this.scenery.set(name, this.sun.position.clone(), setting);
    const s = this.sun.shadow.camera;
    s.left = s.bottom = -span; s.right = s.top = span; s.near = 1; s.far = span * 5;
    s.updateProjectionMatrix();
    this.ground.material.color.setHex(t.ground);
  }

  clearLevel() {
    this.level.traverse(o => {
      if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
      if (o.material && !o.material.userData?.shared) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
    });
    this.level.clear();
  }

  resize(w, h) {
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  render(dt = 0) {
    this.scenery.update(dt, this.camera);
    this.renderer.render(this.scene, this.camera);
  }
}

// ---- chunk rendering -----------------------------------------------------

const GEOMS = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 18),
  cone: new THREE.ConeGeometry(0.5, 1, 18),
};
Object.values(GEOMS).forEach(g => { g.userData.shared = true; });

export class ChunkView {
  constructor(parent, defs, night) {
    // one InstancedMesh per (shape, skin)
    const buckets = new Map();
    for (const d of defs) {
      const key = d.shape + '|' + d.skin;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(d.id);
    }
    this.meshes = [];
    this.slot = new Map();      // chunk id -> [mesh, index]
    const color = new THREE.Color();
    for (const [key, ids] of buckets) {
      const [shape, skin] = key.split('|');
      const mesh = new THREE.InstancedMesh(GEOMS[shape], skinMaterial(skin, night), ids.length);
      mesh.castShadow = skin !== 'glass';
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      ids.forEach((id, i) => {
        const d = defs[id];
        const jitter = 0.92 + ((id * 7919) % 17) / 17 * 0.16;
        mesh.setColorAt(i, color.setHex(d.color).multiplyScalar(jitter));
        this.slot.set(id, [mesh, i]);
      });
      mesh.instanceColor.needsUpdate = true;
      parent.add(mesh);
      this.meshes.push(mesh);
    }
    this.m = new THREE.Matrix4();
    this.s = new THREE.Vector3();
    this.zero = new THREE.Matrix4().makeScale(0, 0, 0);
  }

  add() {}

  set(c, p, q) {
    const [mesh, i] = this.slot.get(c.id);
    if (c.shape === 'box') this.s.set(c.sx, c.sy, c.sz);
    else this.s.set(c.r * 2, c.sy, c.r * 2);
    mesh.setMatrixAt(i, this.m.compose(p, q, this.s));
    mesh.userData.dirty = true;
  }

  hide(c) {
    const [mesh, i] = this.slot.get(c.id);
    mesh.setMatrixAt(i, this.zero);
    mesh.userData.dirty = true;
  }

  flush() {
    for (const m of this.meshes) if (m.userData.dirty) { m.instanceMatrix.needsUpdate = true; m.userData.dirty = false; }
  }

  // replay support: all instance matrices as one flat array
  capture() {
    const size = this.meshes.reduce((n, m) => n + m.instanceMatrix.array.length, 0);
    const out = new Float32Array(size);
    let o = 0;
    for (const m of this.meshes) { out.set(m.instanceMatrix.array, o); o += m.instanceMatrix.array.length; }
    return out;
  }

  restore(a, b = null, t = 0) {
    let o = 0;
    for (const m of this.meshes) {
      const arr = m.instanceMatrix.array;
      if (b) for (let i = 0; i < arr.length; i++) arr[i] = a[o + i] + (b[o + i] - a[o + i]) * t;
      else arr.set(a.subarray(o, o + arr.length));
      o += arr.length;
      m.instanceMatrix.needsUpdate = true;
    }
  }
}

const skinCache = {};
function skinMaterial(skin, night) {
  const key = skin + (night ? 'n' : 'd');
  if (skinCache[key]) return skinCache[key];
  let mat;
  if (skin === 'glass') {
    mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.55,
      emissive: night ? 0xffd98a : 0x000000, emissiveIntensity: night ? 0.5 : 0 });
  } else if (skin === 'window') {
    const tex = windowTexture();
    mat = new THREE.MeshLambertMaterial({ color: 0xffffff, map: tex });
    if (night) { mat.emissive = new THREE.Color(0xffd27a); mat.emissiveMap = windowGlowTexture(); mat.emissiveIntensity = 0.9; }
  } else if (skin === 'lamp') {
    mat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xfff2c0, emissiveIntensity: night ? 1.2 : 0.7 });
  } else if (skin === 'clock') {
    mat = new THREE.MeshLambertMaterial({ color: 0xffffff, map: clockTexture() });
  } else if (skin === 'brick') {
    mat = new THREE.MeshLambertMaterial({ color: 0xffffff, map: brickTexture() });
  } else {
    mat = new THREE.MeshLambertMaterial({ color: 0xffffff, map: blockTexture() });
  }
  mat.userData.shared = true;
  return skinCache[key] = mat;
}

// ---- procedural textures ------------------------------------------------

function canvasTex(w, h, draw, repeat = false) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Faint grain so flat faces don't look like plastic.
function grain(g, w, h, n, dark = 0.06, light = 0.05) {
  let seed = 99;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < n; i++) {
    g.fillStyle = rnd() < 0.5 ? `rgba(0,0,0,${dark * rnd()})` : `rgba(255,255,255,${light * rnd()})`;
    g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 1 + rnd() * 3);
  }
}

// Darkened edges and a lit top rim, so every chunk reads as a solid block.
function bevel(g, w, h, k = 1) {
  const e = Math.round(w * 0.09);
  const edge = (x0, y0, x1, y1, a) => {
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    gr.addColorStop(0, `rgba(0,0,0,${a * k})`);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
  };
  edge(0, h, 0, h - e, 0.32); g.fillRect(0, h - e, w, e);
  edge(0, 0, e, 0, 0.22); g.fillRect(0, 0, e, h);
  edge(w, 0, w - e, 0, 0.22); g.fillRect(w - e, 0, e, h);
  g.fillStyle = `rgba(255,255,255,${0.18 * k})`; g.fillRect(0, 0, w, Math.max(2, e * 0.35));
  g.strokeStyle = `rgba(0,0,0,${0.35 * k})`; g.lineWidth = 2; g.strokeRect(1, 1, w - 2, h - 2);
}

function blockTexture() {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    grain(g, w, h, 900);
    bevel(g, w, h);
  });
}

function brickTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#d9d2c8'; g.fillRect(0, 0, w, h);          // mortar
    const rows = 12, cols = 5, bh = h / rows, bw = w / cols;
    let seed = 5;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let r = 0; r < rows; r++) {
      for (let c = -1; c <= cols; c++) {
        const x = c * bw + (r % 2) * bw / 2, v = 200 + rnd() * 55 | 0;
        g.fillStyle = `rgb(${v},${v - 8},${v - 12})`;
        g.fillRect(x + 2, r * bh + 2, bw - 4, bh - 4);
      }
    }
    grain(g, w, h, 1400, 0.1, 0.05);
    bevel(g, w, h, 0.8);
  });
}

function windowTexture() {
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    grain(g, w, h, 700);
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(24, 90, 80, 6);           // sill shadow
    g.fillStyle = '#ececec'; g.fillRect(24, 20, 80, 70);                   // frame
    const gr = g.createLinearGradient(0, 26, 0, 84);
    gr.addColorStop(0, '#6f8fae'); gr.addColorStop(1, '#2c4058');
    g.fillStyle = gr; g.fillRect(30, 26, 68, 58);                          // glass
    g.fillStyle = 'rgba(255,255,255,0.28)';
    g.beginPath(); g.moveTo(30, 26); g.lineTo(58, 26); g.lineTo(30, 62); g.fill();  // reflection
    g.fillStyle = '#ececec'; g.fillRect(62, 26, 4, 58); g.fillRect(30, 52, 68, 3);
    g.fillStyle = '#f6f6f6'; g.fillRect(20, 88, 88, 5);                    // sill
    bevel(g, w, h, 0.9);
  });
}

function clockTexture() {
  return canvasTex(128, 128, (g, w) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, w);
    g.fillStyle = '#f4efe2'; g.beginPath(); g.arc(64, 64, 50, 0, Math.PI * 2); g.fill();
    g.lineWidth = 5; g.strokeStyle = '#2b2b2b'; g.stroke();
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      g.fillStyle = '#2b2b2b';
      g.fillRect(64 + Math.cos(a) * 40 - 3, 64 + Math.sin(a) * 40 - 3, 6, 6);
    }
    g.lineWidth = 6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(64, 64); g.lineTo(64, 30); g.stroke();
    g.lineWidth = 4;
    g.beginPath(); g.moveTo(64, 64); g.lineTo(88, 72); g.stroke();
  });
}

function windowGlowTexture() {
  return canvasTex(128, 128, (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, 128, 128);
    let seed = 3;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const gr = g.createLinearGradient(0, 26, 0, 84);
    gr.addColorStop(0, '#fff'); gr.addColorStop(1, '#b08040');
    g.fillStyle = gr; g.fillRect(30, 26, 68, 58);
    g.fillStyle = `rgba(0,0,0,${0.3 + rnd() * 0.3})`; g.fillRect(62, 26, 36, 58);   // curtain
  });
}

// Grass with tufts and patches at two scales so the tiling doesn't show.
function groundTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#e6e6e6'; g.fillRect(0, 0, w, h);
    let seed = 42;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 14; i++) {
      const x = rnd() * w, y = rnd() * h, r = 20 + rnd() * 50;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      const v = rnd() < 0.5 ? '0,0,0' : '255,255,255';
      gr.addColorStop(0, `rgba(${v},0.10)`); gr.addColorStop(1, `rgba(${v},0)`);
      g.fillStyle = gr;
      for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) { g.save(); g.translate(dx, dy); g.fillRect(x - r, y - r, r * 2, r * 2); g.restore(); }
    }
    for (let i = 0; i < 2600; i++) {
      const v = 175 + rnd() * 80 | 0;
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 1.5, 2 + rnd() * 3);
    }
  }, true);
}

export function spriteTexture(draw, size = 128) {
  const t = canvasTex(size, size, draw);
  t.anisotropy = 1;
  return t;
}
