// Scene, lights, themes, and the instanced renderer for building chunks.
import * as THREE from 'three';

const THEMES = {
  day:   { sky: 0x9fd3f0, fog: 0xcfe6f2, ground: 0x7fae5a, hemiSky: 0xdff1ff, hemiGround: 0x5d7a3a, hemi: 1.1, sun: 0xfff1d6, sunI: 2.4, night: false },
  dusk:  { sky: 0xf0a878, fog: 0xe8b894, ground: 0x6f9150, hemiSky: 0xffd2b0, hemiGround: 0x4d5a36, hemi: 0.9, sun: 0xffb070, sunI: 2.0, night: false },
  night: { sky: 0x101a33, fog: 0x1a2440, ground: 0x2c3f2a, hemiSky: 0x5a6f9f, hemiGround: 0x1a2218, hemi: 0.55, sun: 0xaabfff, sunI: 0.7, night: true },
};

export class View3D {
  constructor(canvas) {
    const mobile = matchMedia('(pointer: coarse)').matches;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'high-performance' });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, 9 / 16, 0.3, 800);

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    this.sun = new THREE.DirectionalLight(0xffffff, 2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.hemi, this.sun, this.sun.target);

    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshLambertMaterial({ map: groundTexture() }));
    this.ground.material.map.repeat.set(90, 90);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    this.level = new THREE.Group();
    this.scene.add(this.level);
    this.theme = THEMES.day;
  }

  setTheme(name, span = 40) {
    const t = this.theme = THEMES[name] || THEMES.day;
    this.scene.background = new THREE.Color(t.sky);
    this.scene.fog = new THREE.Fog(t.fog, 90, 320);
    this.hemi.color.setHex(t.hemiSky);
    this.hemi.groundColor.setHex(t.hemiGround);
    this.hemi.intensity = t.hemi;
    this.sun.color.setHex(t.sun);
    this.sun.intensity = t.sunI;
    this.sun.position.set(-span * 0.8, span * 1.4, -span * 0.6);
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

  render() { this.renderer.render(this.scene, this.camera); }
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
  } else {
    mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
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

function windowTexture() {
  return canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(0, h - 8, w, 8);
    g.fillStyle = '#e8e8e8'; g.fillRect(14, 12, 36, 34);
    g.fillStyle = '#3c5670'; g.fillRect(17, 15, 30, 28);
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(17, 15, 10, 28);
    g.fillStyle = '#e8e8e8'; g.fillRect(31, 15, 2, 28);
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
  return canvasTex(64, 64, (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#fff'; g.fillRect(17, 15, 30, 28);
  });
}

function groundTexture() {
  return canvasTex(64, 64, (g, w, h) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const v = 200 + Math.random() * 55 | 0;
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  }, true);
}

export function spriteTexture(draw, size = 128) {
  const t = canvasTex(size, size, draw);
  t.anisotropy = 1;
  return t;
}
