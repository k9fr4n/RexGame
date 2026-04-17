// -----------------------------------------------------------------------------
// world.js — streaming endless world: ground chunks + rich side props
//           (desert fauna + neon city), obstacles, collectibles, day/night hooks.
// -----------------------------------------------------------------------------
import * as THREE from 'three';
import { LANES } from './player.js';

const CHUNK  = 40;
const AHEAD  = 6;
const BEHIND = 2;

export class World {
  constructor(scene) {
    this.scene = scene;
    this.root  = new THREE.Group(); scene.add(this.root);

    // ---- Material palette (shared across instances) ----
    this.mat = {
      ground : new THREE.MeshStandardMaterial({ color: 0x1a2030, roughness: 0.95 }),
      stripe : new THREE.MeshStandardMaterial({ color: 0xffd86b, roughness: 0.6, emissive: 0x3a2a00, emissiveIntensity: 0.4 }),
      rail   : new THREE.MeshStandardMaterial({ color: 0x88a0b8, roughness: 0.3, metalness: 0.8 }),
      rock   : new THREE.MeshStandardMaterial({ color: 0x3a3230, roughness: 1.0 }),
      cactus : new THREE.MeshStandardMaterial({ color: 0x2e7d4f, roughness: 0.7 }),
      bark   : new THREE.MeshStandardMaterial({ color: 0x3a2618, roughness: 0.95 }),
      tumble : new THREE.MeshStandardMaterial({ color: 0x8a6a2a, roughness: 1.0, flatShading: true }),
      bone   : new THREE.MeshStandardMaterial({ color: 0xe8e1cc, roughness: 0.6 }),
      coyote : new THREE.MeshStandardMaterial({ color: 0x8a6a3f, roughness: 0.8 }),
      coyoteL: new THREE.MeshStandardMaterial({ color: 0xd8b880, roughness: 0.8 }),
      roadrn : new THREE.MeshStandardMaterial({ color: 0x5a6a3a, roughness: 0.7 }),
      roadrnB: new THREE.MeshStandardMaterial({ color: 0xe6d6a3, roughness: 0.7 }),
      horse  : new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.75 }),
      horseM : new THREE.MeshStandardMaterial({ color: 0x201410, roughness: 0.9 }),
      wood   : new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.85 }),
      paper  : new THREE.MeshStandardMaterial({ color: 0xe0c27a, roughness: 0.85 }),
      flame  : new THREE.MeshStandardMaterial({ color: 0xffb247, emissive: 0xff7a1a, emissiveIntensity: 2.2, roughness: 0.3 }),
      train  : new THREE.MeshStandardMaterial({ color: 0xff3e7f, roughness: 0.3, metalness: 0.5, emissive: 0x5a0020, emissiveIntensity: 0.35 }),
      barrier: new THREE.MeshStandardMaterial({ color: 0xffaa00, roughness: 0.5, emissive: 0x552200, emissiveIntensity: 0.5 }),
      dark   : new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 }),
      neon   : new THREE.MeshStandardMaterial({ color: 0x7df9ff, emissive: 0x7df9ff, emissiveIntensity: 1.5 }),
      bird   : new THREE.MeshStandardMaterial({ color: 0x6a5a48, roughness: 0.7 }),
      birdM  : new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.9, side: THREE.DoubleSide }),
      egg    : new THREE.MeshStandardMaterial({ color: 0xfff4b6, roughness: 0.25, metalness: 0.1, emissive: 0xffd86b, emissiveIntensity: 0.8 }),
      eggHalo: new THREE.MeshBasicMaterial({ color: 0xffd86b, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
      build  : new THREE.MeshStandardMaterial({ color: 0x0e1526, roughness: 0.8, metalness: 0.1 }),
      window : new THREE.MeshStandardMaterial({ color: 0x7df9ff, emissive: 0x7df9ff, emissiveIntensity: 1.4, roughness: 0.4 }),
    };

    // Shared static geometries
    this.geoGround = new THREE.BoxGeometry(14, 0.4, CHUNK);
    this.geoStripe = new THREE.BoxGeometry(0.12, 0.01, 2);
    this.geoRail   = new THREE.BoxGeometry(0.08, 0.08, CHUNK);

    // Exposed material for external day/night control
    this.winMat = this.mat.window;

    this.chunks       = [];
    this.travelled    = 0;
    this._lastOpenLane = 1;
    this._anim        = []; // tumbleweeds rolling + flames flickering
    for (let i = 0; i < BEHIND + AHEAD; i++) this._spawnChunk(CHUNK * BEHIND - i * CHUNK);
  }

  reset() {
    for (const c of this.chunks) this.root.remove(c.group);
    this.chunks = [];
    this._anim = [];
    this.travelled = 0;
    this._lastOpenLane = 1;
    this.root.position.z = 0;
    for (let i = 0; i < BEHIND + AHEAD; i++) this._spawnChunk(CHUNK * BEHIND - i * CHUNK);
  }

  // ---- Difficulty -----------------------------------------------------
  _difficultyFor(reachDist) {
    const GRACE_DIST = 150, RAMP_END = 1200, MAX_OBST = 0.55;
    const t = Math.max(0, Math.min(1, (reachDist - GRACE_DIST) / (RAMP_END - GRACE_DIST)));
    const eased = t * t * (3 - 2 * t);
    return {
      obstacleProb: MAX_OBST * eased,
      eggProb: 0.28 + 0.12 * eased,
      skipObstacles: reachDist < GRACE_DIST,
    };
  }

  // ---- Chunk spawning -------------------------------------------------
  _spawnChunk(z) {
    const g = new THREE.Group();
    g.position.z = z;
    const reachDist = -z;
    const diff = this._difficultyFor(reachDist);

    // Ground
    const ground = new THREE.Mesh(this.geoGround, this.mat.ground);
    ground.receiveShadow = true; ground.position.y = -0.2;
    g.add(ground);
    // Lane stripes
    for (const lx of [-1.3, 1.3]) {
      for (let s = -CHUNK / 2 + 1; s < CHUNK / 2; s += 4) {
        const st = new THREE.Mesh(this.geoStripe, this.mat.stripe);
        st.position.set(lx, 0.01, s);
        g.add(st);
      }
    }
    // Outer rails
    for (const rx of [-4.2, 4.2]) {
      const rail = new THREE.Mesh(this.geoRail, this.mat.rail);
      rail.position.set(rx, 0.3, 0); rail.castShadow = true;
      g.add(rail);
    }

    // Side props — varied desert + occasional neon city chunk
    const props = [];
    const isCity = (Math.abs(Math.round(z / CHUNK)) % 6) === 0;
    for (const side of [-1, 1]) {
      for (let i = 0; i < 8; i++) {
        const zz = (Math.random() - 0.5) * CHUNK;
        const xx = side * (6 + Math.random() * 16);
        const builder = isCity && Math.random() < 0.55 ? this._pickCityProp() : this._pickDesertProp();
        const m = builder.call(this, side);
        m.position.x = xx; m.position.z = zz;
        m.rotation.y += Math.random() * Math.PI * 2;
        g.add(m); props.push(m);
      }
    }

    // Obstacles & pickups
    const obstacles = [], pickups = [];
    const slotsZ = [];
    for (let s = -CHUNK / 2 + 6; s < CHUNK / 2 - 6; s += 6) slotsZ.push(s);
    for (const sz of slotsZ) {
      const drift = Math.floor(Math.random() * 3) - 1;
      const openLane = Math.max(0, Math.min(2, this._lastOpenLane + drift));
      this._lastOpenLane = openLane;
      for (let li = 0; li < 3; li++) {
        if (li === openLane) {
          if (Math.random() < diff.eggProb) pickups.push(this._egg(LANES[li], sz, g));
          continue;
        }
        if (diff.skipObstacles) continue;
        if (Math.random() < diff.obstacleProb) {
          const kind = Math.random();
          let ob;
          if (kind < 0.4)       ob = this._barrier(LANES[li], sz, g);
          else if (kind < 0.75) ob = this._train  (LANES[li], sz, g);
          else                  ob = this._bird   (LANES[li], sz, g);
          obstacles.push(ob);
        }
      }
    }

    this.root.add(g);
    this.chunks.push({ z, group: g, obstacles, pickups, props });
  }

  _pickDesertProp() {
    const r = Math.random();
    if (r < 0.20) return this._saguaro;
    if (r < 0.35) return this._rock;
    if (r < 0.47) return this._deadTree;
    if (r < 0.57) return this._tumbleweed;
    if (r < 0.66) return this._skull;
    if (r < 0.75) return this._coyote;
    if (r < 0.83) return this._roadrunner;
    if (r < 0.90) return this._horse;
    if (r < 0.95) return this._signpost;
    return this._campfire;
  }
  _pickCityProp() {
    const r = Math.random();
    if (r < 0.70) return this._building;
    if (r < 0.90) return this._rock;
    return this._saguaro;
  }

  // ---- Primitive helpers ---------------------------------------------
  _box(w, h, d, mat) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.castShadow = true; m.receiveShadow = true; return m; }
  _cyl(rt, rb, h, mat, seg = 8) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.castShadow = true; m.receiveShadow = true; return m; }
  _sph(r, mat, s = 10) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, s, Math.max(6, s - 2)), mat); m.castShadow = true; return m; }

  // ---- Prop builders --------------------------------------------------
  _saguaro() {
    const g = new THREE.Group();
    const h = 3 + Math.random() * 3;
    const trunk = this._cyl(0.3, 0.38, h, this.mat.cactus, 10);
    trunk.position.y = h / 2; g.add(trunk);
    const arms = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < arms; i++) {
      const ah = 0.8 + Math.random() * 1.2;
      const sign = Math.random() < 0.5 ? -1 : 1;
      const base = this._cyl(0.18, 0.22, ah, this.mat.cactus, 8);
      base.position.set(sign * 0.35, h * (0.45 + Math.random() * 0.35), 0);
      base.rotation.z = sign * (0.6 + Math.random() * 0.3);
      g.add(base);
      const tip = this._cyl(0.16, 0.2, 0.8, this.mat.cactus, 8);
      tip.position.set(sign * 0.55, base.position.y + ah * 0.6, 0);
      g.add(tip);
    }
    return g;
  }
  _rock() {
    const r = 0.5 + Math.random() * 1.8;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), this.mat.rock);
    rock.position.y = r * 0.35; rock.castShadow = true; rock.receiveShadow = true;
    return rock;
  }
  _deadTree() {
    const g = new THREE.Group();
    const h = 2.5 + Math.random() * 2;
    const trunk = this._cyl(0.18, 0.28, h, this.mat.bark, 7);
    trunk.position.y = h / 2; g.add(trunk);
    const nb = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < nb; i++) {
      const bl = 0.6 + Math.random() * 1.1;
      const br = this._cyl(0.05, 0.1, bl, this.mat.bark, 6);
      const sign = Math.random() < 0.5 ? -1 : 1;
      br.position.set(sign * 0.2, h * (0.5 + Math.random() * 0.4), 0);
      br.rotation.z = sign * (0.8 + Math.random() * 0.4);
      br.rotation.y = Math.random() * Math.PI;
      g.add(br);
    }
    return g;
  }
  _tumbleweed() {
    const r = 0.35 + Math.random() * 0.25;
    const geo = new THREE.IcosahedronGeometry(r, 1);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const f = 1 + (Math.random() - 0.5) * 0.35;
      p.setXYZ(i, p.getX(i) * f, p.getY(i) * f, p.getZ(i) * f);
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, this.mat.tumble);
    m.castShadow = true;
    m.position.y = r;
    m.userData._roll = { r, spin: (Math.random() < 0.5 ? -1 : 1) * (0.8 + Math.random() * 1.2) };
    this._anim.push(m);
    return m;
  }
  _skull() {
    const g = new THREE.Group();
    const s = this._sph(0.35, this.mat.bone, 10);
    s.position.y = 0.35; s.scale.z = 1.3; g.add(s);
    const hornL = this._cyl(0.03, 0.09, 0.7, this.mat.bone, 6);
    hornL.position.set(-0.3, 0.55, 0.05); hornL.rotation.z = 1.1; g.add(hornL);
    const hornR = hornL.clone(); hornR.position.x = 0.3; hornR.rotation.z = -1.1; g.add(hornR);
    return g;
  }
  _coyote(side = -1) {
    const g = new THREE.Group();
    const body  = this._box(0.35, 0.35, 0.9, this.mat.coyote); body.position.y = 0.7; g.add(body);
    const belly = this._box(0.3, 0.2, 0.75, this.mat.coyoteL); belly.position.y = 0.55; g.add(belly);
    const neck  = this._box(0.22, 0.22, 0.3, this.mat.coyote); neck.position.set(0, 0.85, -0.55); neck.rotation.x = 0.4; g.add(neck);
    const head  = this._box(0.28, 0.3, 0.35, this.mat.coyote); head.position.set(0, 1.05, -0.75); g.add(head);
    const snout = this._box(0.18, 0.16, 0.28, this.mat.coyote); snout.position.set(0, 1.0, -0.98); g.add(snout);
    const earL  = this._box(0.08, 0.18, 0.04, this.mat.coyote); earL.position.set(-0.1, 1.26, -0.65); earL.rotation.z = -0.2; g.add(earL);
    const earR  = earL.clone(); earR.position.x = 0.1; earR.rotation.z = 0.2; g.add(earR);
    for (const [px, pz] of [[-0.12, -0.35], [0.12, -0.35], [-0.12, 0.35], [0.12, 0.35]]) {
      const leg = this._box(0.1, 0.55, 0.12, this.mat.coyote); leg.position.set(px, 0.3, pz); g.add(leg);
    }
    const tail = this._box(0.1, 0.1, 0.6, this.mat.coyote); tail.position.set(0, 0.85, 0.6); tail.rotation.x = -0.5; g.add(tail);
    g.rotation.y = side < 0 ? -Math.PI / 2 : Math.PI / 2;
    return g;
  }
  _roadrunner(side = -1) {
    const g = new THREE.Group();
    const body  = this._box(0.28, 0.35, 0.6, this.mat.roadrn); body.position.y = 0.7; g.add(body);
    const neck  = this._cyl(0.06, 0.09, 0.45, this.mat.roadrn, 8); neck.position.set(0, 1.0, -0.2); neck.rotation.x = 0.5; g.add(neck);
    const head  = this._box(0.2, 0.2, 0.25, this.mat.roadrn); head.position.set(0, 1.22, -0.35); g.add(head);
    const crest = this._box(0.05, 0.22, 0.18, this.mat.roadrn); crest.position.set(0, 1.4, -0.32); crest.rotation.x = -0.3; g.add(crest);
    const beak  = this._cyl(0.01, 0.06, 0.22, this.mat.roadrnB, 6); beak.position.set(0, 1.2, -0.55); beak.rotation.x = Math.PI / 2; g.add(beak);
    const tail  = this._box(0.08, 0.1, 0.7, this.mat.roadrn); tail.position.set(0, 0.75, 0.55); tail.rotation.x = -0.3; g.add(tail);
    const legL  = this._cyl(0.03, 0.04, 0.7, this.mat.roadrnB, 6); legL.position.set(-0.08, 0.35, 0); g.add(legL);
    const legR  = legL.clone(); legR.position.x = 0.08; g.add(legR);
    g.rotation.y = (side < 0 ? -Math.PI / 2 : Math.PI / 2) + (Math.random() - 0.5) * 0.5;
    return g;
  }
  _horse(side = -1) {
    const g = new THREE.Group();
    const body = this._box(0.5, 0.55, 1.3, this.mat.horse); body.position.y = 1.1; g.add(body);
    const neck = this._box(0.32, 0.6, 0.32, this.mat.horse); neck.position.set(0, 1.45, -0.6); neck.rotation.x = 0.5; g.add(neck);
    const head = this._box(0.3, 0.3, 0.55, this.mat.horse); head.position.set(0, 1.75, -0.85); head.rotation.x = 0.3; g.add(head);
    const mane = this._box(0.1, 0.6, 0.5, this.mat.horseM); mane.position.set(0, 1.55, -0.45); mane.rotation.x = 0.5; g.add(mane);
    for (const [px, pz] of [[-0.2, -0.45], [0.2, -0.45], [-0.2, 0.45], [0.2, 0.45]]) {
      const leg = this._box(0.14, 0.9, 0.16, this.mat.horse); leg.position.set(px, 0.45, pz); g.add(leg);
      const hoof = this._box(0.18, 0.1, 0.2, this.mat.horseM); hoof.position.set(px, 0.05, pz); g.add(hoof);
    }
    const tail = this._box(0.12, 0.08, 0.8, this.mat.horseM); tail.position.set(0, 1.25, 0.7); tail.rotation.x = -0.4; g.add(tail);
    g.rotation.y = side < 0 ? -Math.PI / 2 : Math.PI / 2;
    return g;
  }
  _signpost() {
    const g = new THREE.Group();
    const post  = this._cyl(0.06, 0.06, 2.2, this.mat.wood, 6); post.position.y = 1.1; g.add(post);
    const plank = this._box(1.2, 0.35, 0.05, this.mat.paper); plank.position.set(0.4, 1.6, 0); g.add(plank);
    return g;
  }
  _campfire() {
    const g = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const log = this._cyl(0.08, 0.08, 0.7, this.mat.wood, 6);
      log.position.y = 0.1; log.rotation.z = Math.PI / 2;
      log.rotation.y = (i / 5) * Math.PI;
      g.add(log);
    }
    for (let i = 0; i < 6; i++) {
      const r = this._sph(0.15, this.mat.rock, 6);
      const a = (i / 6) * Math.PI * 2;
      r.position.set(Math.cos(a) * 0.5, 0.1, Math.sin(a) * 0.5);
      g.add(r);
    }
    const flame = this._sph(0.25, this.mat.flame, 8);
    flame.position.y = 0.45;
    flame.userData._flame = { phase: Math.random() * Math.PI * 2 };
    g.add(flame);
    this._anim.push(flame);
    return g;
  }
  _building() {
    const g = new THREE.Group();
    const h = 6 + Math.random() * 22;
    const w = 2 + Math.random() * 3;
    const d = 2 + Math.random() * 3;
    const b = this._box(w, h, d, this.mat.build); b.position.y = h / 2 - 0.2; g.add(b);
    for (const s of [-1, 1]) {
      const wn = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.8, h * 0.8), this.mat.window);
      wn.position.set(s * (d / 2 + 0.01), h / 2, 0);
      wn.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2;
      g.add(wn);
    }
    return g;
  }

  // ---- Lane-aligned obstacles ----------------------------------------
  _barrier(x, z, parent) {
    const g = new THREE.Group();
    const base = this._box(1.8, 0.9, 0.5, this.mat.barrier); base.position.y = 0.45; g.add(base);
    const stripe = this._box(1.82, 0.15, 0.52, this.mat.dark); stripe.position.y = 0.45; g.add(stripe);
    g.position.set(x, 0, z);
    g.userData.kind = 'barrier'; g.userData.aabb = { w: 1.8, h: 0.9, d: 0.5, yOff: 0 };
    parent.add(g); return g;
  }
  _train(x, z, parent) {
    const g = new THREE.Group();
    const body = this._box(2.1, 3.2, 7, this.mat.train); body.position.y = 1.6; g.add(body);
    const glow = this._box(2.2, 0.3, 7.05, this.mat.neon); glow.position.y = 2.9; g.add(glow);
    g.position.set(x, 0, z);
    g.userData.kind = 'train'; g.userData.aabb = { w: 2.1, h: 3.2, d: 7, yOff: 0 };
    parent.add(g); return g;
  }

  // Pterodactyl-style flying creature (thematic with the Rex)
  _bird(x, z, parent) {
    const g = new THREE.Group();
    const body = this._sph(0.28, this.mat.bird, 10); body.scale.z = 2.0; g.add(body);
    const neck = this._cyl(0.07, 0.1, 0.3, this.mat.bird, 8); neck.position.set(0, 0.06, -0.35); neck.rotation.x = -1.0; g.add(neck);
    const head = this._sph(0.17, this.mat.bird, 8); head.position.set(0, 0.18, -0.55); head.scale.z = 1.2; g.add(head);
    const crest = this._box(0.05, 0.22, 0.22, this.mat.bird); crest.position.set(0, 0.35, -0.5); crest.rotation.x = -0.4; g.add(crest);
    const beak = this._cyl(0.02, 0.06, 0.45, this.mat.birdM, 6); beak.position.set(0, 0.12, -0.88); beak.rotation.x = Math.PI / 2; g.add(beak);
    // Wings with two segments + membrane plane
    const wingL = new THREE.Group(); wingL.position.set(-0.2, 0.05, 0);
    const wingLBone = this._box(0.9, 0.05, 0.4, this.mat.bird); wingLBone.position.x = -0.45; wingL.add(wingLBone);
    const wingLOuter = new THREE.Group(); wingLOuter.position.x = -0.9;
    const membraneL = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.7), this.mat.birdM);
    membraneL.rotation.x = -Math.PI / 2; membraneL.position.set(-0.55, 0, 0.05);
    wingLOuter.add(membraneL);
    wingL.add(wingLOuter);
    g.add(wingL);
    const wingR = wingL.clone(); wingR.position.x = 0.2; wingR.scale.x = -1; g.add(wingR);
    const tail = this._cyl(0.02, 0.08, 0.5, this.mat.bird, 6); tail.position.set(0, 0, 0.45); tail.rotation.x = Math.PI / 2; g.add(tail);

    g.position.set(x, 1.9, z);
    g.userData.kind = 'bird';
    g.userData.wings = [wingL, wingR];
    g.userData.phase = Math.random() * Math.PI * 2;
    g.userData.aabb  = { w: 1.6, h: 0.6, d: 0.8, yOff: 1.9 };
    parent.add(g); return g;
  }

  _egg(x, z, parent) {
    const g = new THREE.Group();
    const egg = this._sph(0.35, this.mat.egg, 14); egg.scale.y = 1.3; g.add(egg);
    const halo = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.7, 24), this.mat.eggHalo);
    halo.rotation.x = -Math.PI / 2; halo.position.y = -0.4; g.add(halo);
    g.position.set(x, 1.1, z);
    g.userData.kind = 'egg';
    g.userData.aabb = { w: 0.7, h: 0.9, d: 0.7, yOff: 0.8 };
    parent.add(g); return g;
  }

  // ---- Update loop ---------------------------------------------------
  update(dt, speed, cameraZ) {
    const dz = speed * dt;
    this.root.position.z += dz;
    this.travelled += dz;

    for (let i = this.chunks.length - 1; i >= 0; i--) {
      const c = this.chunks[i];
      const worldZ = c.z + this.root.position.z;
      if (worldZ > cameraZ + CHUNK * (BEHIND + 1)) {
        this.root.remove(c.group);
        c.group.traverse(o => {
          if (o.isMesh && o.geometry && o.geometry !== this.geoGround && o.geometry !== this.geoStripe && o.geometry !== this.geoRail) {
            o.geometry.dispose?.();
          }
        });
        this.chunks.splice(i, 1);
      }
    }
    // Drop anims whose root is no longer attached to this.root
    this._anim = this._anim.filter(a => {
      let cur = a; while (cur.parent) cur = cur.parent; return cur === this.root;
    });
    while (this.chunks.length < BEHIND + AHEAD) {
      let minZ = Infinity; for (const cc of this.chunks) if (cc.z < minZ) minZ = cc.z;
      this._spawnChunk(minZ - CHUNK);
    }

    // Bird wings + pickups
    for (const c of this.chunks) {
      for (const ob of c.obstacles) {
        if (ob.userData.kind === 'bird') {
          ob.userData.phase += dt * 9;
          const f = Math.sin(ob.userData.phase) * 0.9;
          ob.userData.wings[0].rotation.z =  f;
          ob.userData.wings[1].rotation.z = -f;
        }
      }
      for (const p of c.pickups) {
        p.rotation.y += dt * 2;
        p.position.y = 1.1 + Math.sin((this.travelled + p.position.z) * 0.1) * 0.1;
      }
    }
    // Side-prop animations (tumbleweeds + flames)
    const now = performance.now() * 0.001;
    for (const a of this._anim) {
      if (a.userData._roll) {
        a.rotation.x += dt * a.userData._roll.spin * 4;
        a.position.y = a.userData._roll.r + Math.abs(Math.sin(now * 3 + a.id * 0.1)) * 0.06;
      } else if (a.userData._flame) {
        const s = 1 + Math.sin(now * 8 + a.userData._flame.phase) * 0.15 + Math.sin(now * 19) * 0.08;
        a.scale.set(s, s * 1.4, s);
      }
    }
  }

  collide(playerAABB) {
    for (const c of this.chunks) {
      const cz = c.group.position.z + this.root.position.z;
      if (Math.abs(cz) > CHUNK) continue;
      for (const ob of c.obstacles) {
        if (!ob.parent) continue;
        const wx = ob.position.x;
        const wz = ob.position.z + cz;
        const a = ob.userData.aabb;
        const box = {
          minX: wx - a.w / 2, maxX: wx + a.w / 2,
          minY: a.yOff, maxY: a.yOff + a.h,
          minZ: wz - a.d / 2, maxZ: wz + a.d / 2,
        };
        if (aabbOverlap(playerAABB, box)) return { kind: 'obstacle', object: ob, parent: c };
      }
      for (const p of c.pickups) {
        if (!p.parent) continue;
        const wx = p.position.x;
        const wz = p.position.z + cz;
        const a = p.userData.aabb;
        const box = {
          minX: wx - a.w / 2, maxX: wx + a.w / 2,
          minY: a.yOff, maxY: a.yOff + a.h,
          minZ: wz - a.d / 2, maxZ: wz + a.d / 2,
        };
        if (aabbOverlap(playerAABB, box)) return { kind: 'egg', object: p, parent: c };
      }
    }
    return null;
  }

  removePickup(p, chunk) {
    const i = chunk.pickups.indexOf(p);
    if (i >= 0) chunk.pickups.splice(i, 1);
    p.parent?.remove(p);
  }
}

function aabbOverlap(a, b) {
  return a.minX < b.maxX && a.maxX > b.minX &&
         a.minY < b.maxY && a.maxY > b.minY &&
         a.minZ < b.maxZ && a.maxZ > b.minZ;
}
