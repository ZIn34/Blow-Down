// Scenery around the buildings. Props are static: they get fixed colliders, and
// the ones marked `protect` are watched for damage.
import * as THREE from 'three';

const mat = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });

function box(parent, w, h, d, color, x, y0, z, shadow = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y0 + h / 2, z);
  m.castShadow = shadow; m.receiveShadow = true;
  parent.add(m);
  return m;
}

function cyl(parent, r, h, color, x, y0, z, seg = 12, rTop = r) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, r, h, seg), mat(color));
  m.position.set(x, y0 + h / 2, z);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}

// Triangular roof with the ridge along x.
function gable(parent, w, d, h, color, x, y0, z) {
  const s = new THREE.Shape();
  s.moveTo(-d / 2, 0); s.lineTo(d / 2, 0); s.lineTo(0, h); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false });
  g.translate(0, 0, -w / 2);
  g.rotateY(Math.PI / 2);
  const m = new THREE.Mesh(g, mat(color));
  m.position.set(x, y0, z);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}

function decal(parent, x0, z0, x1, z1, color, y = 0.02, map = null) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0),
    mat(color, { map, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.rotation.x = -Math.PI / 2;
  m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

const BUILDERS = {
  house(g, o) {
    const w = o.w || 8, d = o.d || 7, h = o.h || 4.5;
    box(g, w, h, d, o.color || 0xe9dcc3, 0, 0, 0);
    gable(g, w + 0.6, d + 0.6, 2.4, o.roof || 0x8a4b3a, 0, h, 0);
    box(g, 1.2, 2.2, 0.1, 0x6b4a33, 0, 0, -d / 2 - 0.05);
    return [[0, 0, 0, w, h + 2.4, d]];
  },

  diner(g, o) {
    const w = o.w || 14, d = o.d || 8;
    box(g, w, 4, d, 0xd8dde2, 0, 0, 0);
    box(g, w + 0.05, 0.6, d + 0.05, 0xd13b3b, 0, 0.4, 0);
    box(g, w + 0.06, 1.4, d + 0.06, 0x35536e, 0, 1.6, 0);
    box(g, w + 0.8, 0.3, d + 0.8, 0xeeeeee, 0, 4, 0);
    // the giant hot-dog mascot
    const dog = new THREE.Group();
    dog.position.set(0, 4.3, 0);
    box(dog, 6, 1.2, 2.2, 0xe2b25c, 0, 0, 0);
    const sausage = new THREE.Mesh(new THREE.CapsuleGeometry(0.75, 6, 6, 12), mat(0xc4512c));
    sausage.rotation.z = Math.PI / 2; sausage.position.y = 1.4; sausage.castShadow = true;
    dog.add(sausage);
    box(dog, 5.4, 0.18, 0.3, 0xf2d13a, 0, 2.15, 0);
    g.add(dog);
    g.userData.onHit = () => { dog.rotation.x = 1.3; dog.position.y = 3.4; dog.position.z = d / 3; };
    return [[0, 0, 0, w, 4.3, d], [0, 4.3, 0, 6, 2.2, 2.2]];
  },

  barn(g, o) {
    const w = o.w || 10, d = o.d || 12, h = 6;
    box(g, w, h, d, 0xa8322a, 0, 0, 0);
    gable(g, w + 0.6, d + 0.8, 3.4, 0x4a3a33, 0, h, 0);
    const door = box(g, 4, 4.2, 0.1, 0xf2ece0, 0, 0, -d / 2 - 0.06);
    door.scale.set(1, 1, 1);
    box(g, 3.2, 3.6, 0.12, 0x8e2a23, 0, 0.3, -d / 2 - 0.1);
    return [[0, 0, 0, w, h + 3.4, d]];
  },

  gas(g) {
    box(g, 12, 0.7, 8, 0xf4f4f4, 0, 5, 0);
    box(g, 12.05, 0.3, 8.05, 0xd94a2b, 0, 5.2, 0);
    for (const [x, z] of [[-5, -3], [5, -3], [-5, 3], [5, 3]]) box(g, 0.4, 5, 0.4, 0xdddddd, x, 0, z);
    for (const x of [-3, 0, 3]) { box(g, 0.8, 1.7, 0.6, 0xd94a2b, x, 0.2, 0); box(g, 1.2, 0.2, 1.2, 0xbbbbbb, x, 0, 0); }
    return [[0, 0, 0, 12, 5.7, 8]];
  },

  van(g) {
    box(g, 5.6, 2.3, 2.3, 0xf4f4f4, 0, 0.5, 0);
    box(g, 5.62, 0.5, 2.32, 0x2d6fd1, 0, 1.2, 0);
    box(g, 1.6, 0.4, 1.8, 0x444444, 1.5, 2.8, 0);
    const dish = cyl(g, 0.9, 0.2, 0xdddddd, 1.5, 3.3, 0, 16);
    dish.rotation.z = 0.8;
    cyl(g, 0.08, 1.6, 0x999999, -1.5, 2.8, 0, 6);
    for (const [x, z] of [[-1.8, -1.1], [1.8, -1.1], [-1.8, 1.1], [1.8, 1.1]]) {
      const w = cyl(g, 0.45, 0.35, 0x222222, x, 0.1, z, 12);
      w.rotation.x = Math.PI / 2; w.position.y = 0.45;
    }
    g.userData.onHit = () => { g.rotation.z = 0.25; };
    return [[0, 0, 0, 5.6, 3.2, 2.3]];
  },

  church(g, o) {
    const w = o.w || 9, d = o.d || 16;
    box(g, w, 8, d, 0xd9cfbb, 0, 0, 0);
    const roof = gable(g, d + 0.6, w + 0.8, 4.5, 0x4f5663, 0, 8, 0);
    roof.rotation.y = Math.PI / 2;
    box(g, 4.4, 16, 4.4, 0xd2c7b2, 0, 0, -d / 2 - 1.6);
    const spire = cyl(g, 3, 8, 0x4f5663, 0, 16, -d / 2 - 1.6, 4, 0.01);
    spire.rotation.y = Math.PI / 4;
    const win = cyl(g, 1.2, 0.1, 0x7aa0d8, 0, 0, -d / 2 - 3.85, 16);
    win.rotation.x = Math.PI / 2; win.position.y = 11;
    box(g, 0.15, 1.6, 0.15, 0xe8c64a, 0, 24, -d / 2 - 1.6);
    box(g, 0.9, 0.15, 0.15, 0xe8c64a, 0, 24.9, -d / 2 - 1.6);
    return [[0, 0, 0, w, 12.5, d], [0, 0, -d / 2 - 1.6, 4.4, 24, 4.4]];
  },

  shop(g, o) {
    const w = o.w || 10, d = o.d || 10, h = o.h || 7;
    box(g, w, h, d, o.color || 0xc98f5a, 0, 0, 0);
    box(g, w + 0.05, 2.4, d + 0.05, 0x3a4d60, 0, 0.3, 0);
    box(g, w + 0.1, 0.25, d + 0.1, 0xeeeeee, 0, h, 0);
    box(g, w * 0.9, 0.2, 1.6, o.awning || 0x2f9b6b, 0, 2.9, -d / 2 - 0.8);
    return [[0, 0, 0, w, h, d]];
  },

  warehouse(g, o) {
    const w = o.w || 12, d = o.d || 28, h = o.h || 8;
    box(g, w, h, d, o.color || 0xa9b3ba, 0, 0, 0);
    const roof = gable(g, d + 0.4, w + 0.4, 2, 0x7d8790, 0, h, 0);
    roof.rotation.y = Math.PI / 2;
    for (let z = -d / 2 + 4; z < d / 2; z += 8) box(g, 0.1, 5, 4.5, 0x6d7780, (o.doorSide || 1) * (w / 2 + 0.05), 0, z);
    return [[0, 0, 0, w, h + 2, d]];
  },

  pool(g, o) {
    const w = o.w || 12, d = o.d || 7;
    box(g, w + 2, 0.35, d + 2, 0xe6ddc9, 0, 0, 0);
    const water = decal(g, -w / 2, -d / 2, w / 2, d / 2, 0x3fb6e0, 0.37);
    water.material.emissive = new THREE.Color(0x0b4a66);
    box(g, 0.8, 0.5, 1.8, 0xffffff, w / 2 - 1, 0.35, d / 2 + 0.6);
    return [[0, 0, 0, w + 2, 0.6, d + 2]];
  },

  crowd(g, o) {
    const w = o.w || 16, d = o.d || 5, n = o.n || 60;
    const people = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.28, 0.9, 3, 8), mat(0xffffff), n);
    const m = new THREE.Matrix4(), c = new THREE.Color();
    const shirts = [0xd94a4a, 0x3a7bd5, 0xf2c14e, 0x4caf50, 0xffffff, 0x9c6ade, 0xff8a3d, 0x333333];
    for (let i = 0; i < n; i++) {
      const x = (Math.random() - 0.5) * w, z = (Math.random() - 0.5) * d;
      m.makeTranslation(x, 0.75 + Math.random() * 0.15, z);
      people.setMatrixAt(i, m);
      people.setColorAt(i, c.setHex(shirts[i % shirts.length]));
    }
    people.castShadow = true;
    g.add(people);
    const fz = o.facing === 'north' ? d / 2 + 0.8 : -d / 2 - 0.8;
    for (let x = -w / 2; x <= w / 2; x += 2) box(g, 0.1, 1.1, 0.1, 0xb0b0b0, x, 0, fz);
    box(g, w, 0.12, 0.08, 0xd8d8d8, 0, 1.0, fz);
    box(g, w, 0.12, 0.08, 0xd8d8d8, 0, 0.5, fz);
    return [[0, 0, fz, w, 1.1, 0.2]];
  },

  tree(g, o) {
    const s = o.s || 1;
    cyl(g, 0.25 * s, 2.2 * s, 0x6b4a33, 0, 0, 0, 8);
    const top = new THREE.Mesh(new THREE.IcosahedronGeometry(1.8 * s, 0), mat(o.color || 0x4f8a3c, { flatShading: true }));
    top.position.y = 3.4 * s; top.castShadow = true;
    g.add(top);
    return [[0, 0, 0, 0.5 * s, 2.2 * s, 0.5 * s]];
  },

  pine(g, o) {
    const s = o.s || 1;
    cyl(g, 0.25 * s, 1.5 * s, 0x6b4a33, 0, 0, 0, 8);
    cyl(g, 1.8 * s, 3.2 * s, 0x3f7040, 0, 1.2 * s, 0, 8, 0.1);
    cyl(g, 1.3 * s, 2.6 * s, 0x467a45, 0, 3.2 * s, 0, 8, 0.1);
    return [[0, 0, 0, 0.5 * s, 2 * s, 0.5 * s]];
  },

  car(g, o) {
    const along = o.along === 'z';
    const L = 4.2, W = 1.9;
    box(g, along ? W : L, 0.9, along ? L : W, o.color || 0xc23b3b, 0, 0.35, 0);
    box(g, along ? W * 0.9 : L * 0.55, 0.7, along ? L * 0.55 : W * 0.9, 0x2e3e4e, 0, 1.25, 0);
    g.userData.onHit = () => { g.scale.y = 0.55; };
    return [[0, 0, 0, along ? W : L, 1.95, along ? L : W]];
  },

  tv(g) {
    for (const a of [0, 2.1, 4.2]) { const l = box(g, 0.06, 1.6, 0.06, 0x333333, Math.cos(a) * 0.4, 0, Math.sin(a) * 0.4); l.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25); }
    box(g, 0.5, 0.5, 1.1, 0x222222, 0, 1.6, 0);
    box(g, 0.4, 1.7, 0.4, 0x3a7bd5, 0.9, 0, 0);
    return [];
  },

  floodlight(g, o) {
    const h = o.h || 12;
    cyl(g, 0.15, h, 0x777777, 0, 0, 0, 8);
    const head = box(g, 2.2, 1, 0.5, 0xfff6d8, 0, h, 0, false);
    head.material.emissive = new THREE.Color(0xfff2c0);
    const light = new THREE.PointLight(0xfff0cc, 220, 60, 1.6);
    light.position.set(0, h - 0.5, 0);
    g.add(light);
    return [];
  },

  // stadium grandstand: rising tiers of seats under a roof
  stand(g, o) {
    const w = o.w || 50, d = o.d || 12, tiers = 6, th = 1.1, td = d / tiers;
    const solids = [];
    const seats = [0xd94a4a, 0x3a7bd5, 0xf2c14e];
    for (let i = 0; i < tiers; i++) {
      const z = -d / 2 + td * (i + 0.5), h = th * (i + 1);
      box(g, w, h, td, 0x9aa0a6, 0, 0, z);
      box(g, w, 0.35, td * 0.5, seats[i % 3], 0, h, z - td * 0.15);
      solids.push([0, 0, z, w, h, td]);
    }
    box(g, w, 1.5, 0.4, 0x7d858d, 0, tiers * th, d / 2 - 0.2);
    for (let x = -w / 2 + 2; x <= w / 2 - 2; x += 8) box(g, 0.35, 10, 0.35, 0xcccccc, x, 0, d / 2 - 0.4);
    box(g, w + 2, 0.4, d + 2, 0xe8e8e8, 0, 10, 0);
    return solids;
  },

  pitch(g, o) {
    decal(g, o.x0, o.z0, o.x1, o.z1, 0x4f9a45, 0.012);
    const cx = (o.x0 + o.x1) / 2, cz = (o.z0 + o.z1) / 2, t = 0.18;
    decal(g, o.x0 + 2, o.z0 + 2, o.x1 - 2, o.z0 + 2 + t, 0xffffff, 0.02);
    decal(g, o.x0 + 2, o.z1 - 2 - t, o.x1 - 2, o.z1 - 2, 0xffffff, 0.02);
    decal(g, o.x0 + 2, o.z0 + 2, o.x0 + 2 + t, o.z1 - 2, 0xffffff, 0.02);
    decal(g, o.x1 - 2 - t, o.z0 + 2, o.x1 - 2, o.z1 - 2, 0xffffff, 0.02);
    decal(g, cx - t / 2, o.z0 + 2, cx + t / 2, o.z1 - 2, 0xffffff, 0.02);
    return [];
  },

  water(g, o) {
    const m = decal(g, o.x0, o.z0, o.x1, o.z1, 0x2f7fb8, 0.02);
    m.material.emissive = new THREE.Color(0x0a2a44);
    decal(g, o.x0, o.z0 - 2, o.x1, o.z0, 0xd8c99a, 0.015);   // beach
    return [];
  },

  rocks(g, o) {
    for (let i = 0; i < (o.n || 5); i++) {
      const r = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8 + (i * 37 % 10) / 10, 0), mat(0x8a8780, { flatShading: true }));
      r.position.set((i * 53 % 7) - 3, 0.3, (i * 31 % 5) - 2);
      r.castShadow = true;
      g.add(r);
    }
    return [];
  },

  rail(g, o) {
    decal(g, o.x0, o.z - 2, o.x1, o.z + 2, 0x8f8578, 0.012);
    decal(g, o.x0, o.z - 0.8, o.x1, o.z - 0.65, 0x5d5d62, 0.03);
    decal(g, o.x0, o.z + 0.65, o.x1, o.z + 0.8, 0x5d5d62, 0.03);
    for (let x = o.x0; x < o.x1; x += 1.4) decal(g, x, o.z - 1.2, x + 0.3, o.z + 1.2, 0x6b5a48, 0.022);
    return [];
  },

  train(g, o) {
    const n = o.cars || 3, L = 13;
    const solids = [];
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * (L + 0.8);
      box(g, L, 3, 3, i === 0 ? 0xc0392b : 0x2e7d4f, x, 0.8, 0);
      box(g, L + 0.02, 0.8, 3.02, 0x2a3a4a, x, 2.3, 0);
      box(g, L - 1, 0.3, 2.6, 0x444444, x, 3.8, 0);
      solids.push([x, 0, 0, L, 4.1, 3]);
    }
    g.userData.onHit = () => { g.rotation.x = 0.12; };
    return solids;
  },

  // supply ship moored alongside, bow pointing along z
  ship(g) {
    box(g, 7, 3, 26, 0x2a4a6a, 0, 0, 0);
    box(g, 7.05, 0.6, 26.05, 0xc0392b, 0, 0, 0);
    box(g, 6, 0.4, 24, 0xd8d8d8, 0, 3, 0);
    box(g, 5.5, 5, 6, 0xf2f2f2, 0, 3.4, 7);
    box(g, 5.6, 1, 6.1, 0x2a3a4a, 0, 7, 7);
    box(g, 0.6, 5, 0.6, 0xd94a2b, 0, 3.4, -6);
    box(g, 4, 1.5, 3, 0xf2c14e, 0, 3.4, -2);
    g.userData.onHit = () => { g.rotation.z = 0.12; };
    return [[0, 0, 0, 7, 8.4, 26]];
  },

  stalls(g, o) {
    const cols = [0xd94a4a, 0x3a7bd5, 0xf2c14e, 0x4caf50];
    for (let i = 0; i < (o.n || 4); i++) {
      const x = (i - ((o.n || 4) - 1) / 2) * 4.5;
      box(g, 3.4, 1, 2, 0xa07850, x, 0, 0);
      for (const px of [-1.6, 1.6]) box(g, 0.1, 2.4, 0.1, 0x777777, x + px, 0, 0.9);
      box(g, 3.8, 0.15, 2.6, cols[i % 4], x, 2.4, 0);
    }
    return [];
  },

  playground(g, o) {
    const w = o.w || 12, d = o.d || 10;
    decal(g, -w / 2, -d / 2, w / 2, d / 2, 0xd8b98a, 0.015);
    const solids = [];
    // low fence all round
    for (const [x, z, sx, sz] of [[0, -d / 2, w, 0.1], [0, d / 2, w, 0.1], [-w / 2, 0, 0.1, d], [w / 2, 0, 0.1, d]]) {
      box(g, sx, 0.9, sz, 0x3a7bd5, x, 0, z);
      solids.push([x, 0, z, Math.max(sx, 0.3), 0.9, Math.max(sz, 0.3)]);
    }
    // swings
    for (const x of [-4, -1]) box(g, 0.15, 2.6, 0.15, 0xd94a4a, x, 0, -2);
    box(g, 3.3, 0.15, 0.15, 0xd94a4a, -2.5, 2.6, -2);
    // slide
    box(g, 1.2, 2.2, 1.2, 0xf2c14e, 3, 0, 1);
    const slide = box(g, 1, 0.15, 3.6, 0x4caf50, 3, 1.1, 3);
    slide.rotation.x = -0.55;
    solids.push([-2.5, 0, -2, 3.5, 2.8, 0.4], [3, 0, 1, 1.2, 2.2, 1.2]);
    return solids;
  },

  road(g, o) {
    decal(g, o.x0, o.z0, o.x1, o.z1, 0x4a4a4e, 0.015);
    const alongX = (o.x1 - o.x0) > (o.z1 - o.z0);
    const cx = (o.x0 + o.x1) / 2, cz = (o.z0 + o.z1) / 2;
    const len = alongX ? o.x1 - o.x0 : o.z1 - o.z0;
    for (let s = -len / 2 + 2; s < len / 2 - 1; s += 6)
      alongX ? decal(g, cx + s, cz - 0.12, cx + s + 3, cz + 0.12, 0xf2d13a, 0.025)
             : decal(g, cx - 0.12, cz + s, cx + 0.12, cz + s + 3, 0xf2d13a, 0.025);
    return [];
  },

  lot(g, o) {
    decal(g, o.x0, o.z0, o.x1, o.z1, 0x55575c, 0.012);
    for (let x = o.x0 + 3; x < o.x1 - 0.5; x += 3) decal(g, x - 0.06, o.z1 - 5.5, x + 0.06, o.z1 - 0.5, 0xeeeeee, 0.02);
    return [];
  },

  dirt(g, o) { decal(g, o.x0, o.z0, o.x1, o.z1, o.color || 0x8a6f4d, 0.01); return []; },

  pavement(g, o) { decal(g, o.x0, o.z0, o.x1, o.z1, 0xb5b0a6, 0.013); return []; },

  fence(g, o) {
    const alongX = Math.abs(o.x1 - o.x0) > Math.abs(o.z1 - o.z0);
    const len = alongX ? o.x1 - o.x0 : o.z1 - o.z0;
    for (let s = 0; s <= len; s += 2.5) box(g, 0.15, 1.2, 0.15, 0x8a6a4a, alongX ? o.x0 + s : o.x0, 0, alongX ? o.z0 : o.z0 + s);
    const mx = (o.x0 + o.x1) / 2, mz = (o.z0 + o.z1) / 2;
    box(g, alongX ? len : 0.08, 0.12, alongX ? 0.08 : len, 0x9a7a5a, mx, 0.9, mz);
    box(g, alongX ? len : 0.08, 0.12, alongX ? 0.08 : len, 0x9a7a5a, mx, 0.45, mz);
    return [];
  },
};

// Build every prop in the level. Returns the protected ones with world AABBs.
export function buildProps(list, ctx) {
  const protect = [];
  for (const o of list) {
    const g = new THREE.Group();
    const local = /^(road|lot|dirt|pavement|fence|pitch|water|rail)$/.test(o.type);
    if (!local) g.position.set(o.x, 0, o.z);
    const solids = BUILDERS[o.type](g, o) || [];
    ctx.root.add(g);
    if (!solids.length) continue;
    const body = ctx.world.createRigidBody(ctx.R.RigidBodyDesc.fixed());
    const boxes = [];
    for (const [x, y0, z, w, h, d] of solids) {
      const c = { x: o.x + x, y: y0 + h / 2, z: o.z + z }, hh = { x: w / 2, y: h / 2, z: d / 2 };
      ctx.world.createCollider(ctx.R.ColliderDesc.cuboid(hh.x, hh.y, hh.z).setTranslation(c.x, c.y, c.z).setFriction(0.8), body);
      boxes.push({ c, h: hh });
    }
    if (o.protect) {
      let crowd = null;
      if (o.type === 'crowd') {
        // the crowd's protected area is the people, not just the barrier
        const w = o.w || 16, d = o.d || 5;
        crowd = { min: { x: o.x - w / 2, z: o.z - d / 2 - 1 }, max: { x: o.x + w / 2, z: o.z + d / 2 + 1 } };
        boxes.length = 0;
        boxes.push({ c: { x: o.x, y: 1, z: o.z }, h: { x: w / 2, y: 1, z: d / 2 + 1 } });
      }
      protect.push({ name: o.protect, boxes, hit: false, group: g, crowd });
    }
  }
  return protect;
}

export function markHit(p) {
  p.group.traverse(o => {
    if (o.material && o.material.emissive) { o.material = o.material.clone(); o.material.emissive.setHex(0x7a1010); }
  });
  p.group.userData.onHit?.();
}
