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
    // Distant mountain ranges are static in scene space (player stays at origin).

    // ---- Material palette (shared across instances) ----
    // Warm, saturated desert palette -> readable day and night.
    this.mat = {
      ground : new THREE.MeshStandardMaterial({ color: 0xc68548, roughness: 0.95 }),                                                  // warm sand
      stripe : new THREE.MeshStandardMaterial({ color: 0xffe27a, roughness: 0.5, emissive: 0x5a4200, emissiveIntensity: 0.6 }),        // bright yellow stripe
      rail   : new THREE.MeshStandardMaterial({ color: 0xd8c9a0, roughness: 0.4, metalness: 0.6 }),                                   // polished bronze
      rock   : new THREE.MeshStandardMaterial({ color: 0xa06848, roughness: 1.0 }),                                                   // red-rock canyon
      cactus : new THREE.MeshStandardMaterial({ color: 0x4fbf5a, roughness: 0.65, emissive: 0x0a3514, emissiveIntensity: 0.25 }),      // vivid green
      bark   : new THREE.MeshStandardMaterial({ color: 0x8a5a2a, roughness: 0.9 }),                                                   // warm bark
      tumble : new THREE.MeshStandardMaterial({ color: 0xd8a84a, roughness: 1.0, flatShading: true }),                                 // golden straw
      bone   : new THREE.MeshStandardMaterial({ color: 0xfaf2d4, roughness: 0.55, emissive: 0x2a2418, emissiveIntensity: 0.15 }),      // bright bone
      coyote : new THREE.MeshStandardMaterial({ color: 0xd88a3a, roughness: 0.75 }),                                                  // fiery tan
      coyoteL: new THREE.MeshStandardMaterial({ color: 0xffdc9a, roughness: 0.75 }),                                                  // cream belly
      roadrn : new THREE.MeshStandardMaterial({ color: 0x8acb52, roughness: 0.65 }),                                                  // lime plumage
      roadrnB: new THREE.MeshStandardMaterial({ color: 0xffc05c, roughness: 0.65 }),                                                  // orange beak/legs
      horse  : new THREE.MeshStandardMaterial({ color: 0xb8532a, roughness: 0.7 }),                                                   // chestnut bay
      horseM : new THREE.MeshStandardMaterial({ color: 0x221410, roughness: 0.9 }),                                                   // black mane
      wood   : new THREE.MeshStandardMaterial({ color: 0xaa6a38, roughness: 0.8 }),                                                   // lighter wood
      paper  : new THREE.MeshStandardMaterial({ color: 0xfae4a0, roughness: 0.85 }),                                                  // cream sign
      flame  : new THREE.MeshStandardMaterial({ color: 0xffb247, emissive: 0xff7a1a, emissiveIntensity: 2.4, roughness: 0.3 }),
      train  : new THREE.MeshStandardMaterial({ color: 0xff4f8a, roughness: 0.3, metalness: 0.5, emissive: 0x6a0028, emissiveIntensity: 0.5 }),
      barrier: new THREE.MeshStandardMaterial({ color: 0xffbf2a, roughness: 0.45, emissive: 0x6a3a00, emissiveIntensity: 0.65 }),
      dark   : new THREE.MeshStandardMaterial({ color: 0x2a1a14, roughness: 0.8 }),
      neon   : new THREE.MeshStandardMaterial({ color: 0x7df9ff, emissive: 0x7df9ff, emissiveIntensity: 1.8 }),
      bird   : new THREE.MeshStandardMaterial({ color: 0xb08a5a, roughness: 0.65 }),                                                  // warm pterodactyl
      birdM  : new THREE.MeshStandardMaterial({ color: 0x6a3a1a, roughness: 0.85, side: THREE.DoubleSide }),                           // tan membrane
      egg    : new THREE.MeshStandardMaterial({ color: 0xfff8c0, roughness: 0.22, metalness: 0.15, emissive: 0xffd86b, emissiveIntensity: 1.1 }),
      eggHalo: new THREE.MeshBasicMaterial({ color: 0xffd86b, transparent: true, opacity: 0.4, side: THREE.DoubleSide }),
      // (build/window now live in this.buildPalette / this.windowPalette below)
      petalA : new THREE.MeshStandardMaterial({ color: 0xff5a8a, roughness: 0.5, emissive: 0x5a1030, emissiveIntensity: 0.2 }),
      petalB : new THREE.MeshStandardMaterial({ color: 0xa25bff, roughness: 0.5, emissive: 0x2a0a5a, emissiveIntensity: 0.2 }),
      petalC : new THREE.MeshStandardMaterial({ color: 0xffd83a, roughness: 0.5, emissive: 0x5a4a00, emissiveIntensity: 0.25 }),
      petalD : new THREE.MeshStandardMaterial({ color: 0xff7a3a, roughness: 0.5, emissive: 0x5a2000, emissiveIntensity: 0.25 }),
      stem   : new THREE.MeshStandardMaterial({ color: 0x3fa860, roughness: 0.75 }),
      crystalA: new THREE.MeshStandardMaterial({ color: 0x7df9ff, emissive: 0x7df9ff, emissiveIntensity: 1.4, roughness: 0.25, metalness: 0.2, transparent: true, opacity: 0.85 }),
      crystalB: new THREE.MeshStandardMaterial({ color: 0xff5bff, emissive: 0xff5bff, emissiveIntensity: 1.4, roughness: 0.25, metalness: 0.2, transparent: true, opacity: 0.85 }),
      crystalC: new THREE.MeshStandardMaterial({ color: 0xaaff5a, emissive: 0xaaff5a, emissiveIntensity: 1.4, roughness: 0.25, metalness: 0.2, transparent: true, opacity: 0.85 }),
      lamp   : new THREE.MeshStandardMaterial({ color: 0xffcf5a, emissive: 0xffcf5a, emissiveIntensity: 2.2, roughness: 0.35 }),
      metal  : new THREE.MeshStandardMaterial({ color: 0xbcbfc8, roughness: 0.4, metalness: 0.85 }),
      blade  : new THREE.MeshStandardMaterial({ color: 0xfae4b0, roughness: 0.6 }),
      canvasM: new THREE.MeshStandardMaterial({ color: 0xf4e8c4, roughness: 0.9 }),
      wagonBody: new THREE.MeshStandardMaterial({ color: 0x8a3a20, roughness: 0.75 }),
      totemA : new THREE.MeshStandardMaterial({ color: 0xe06a3a, roughness: 0.85 }),
      totemB : new THREE.MeshStandardMaterial({ color: 0x4fd6a0, roughness: 0.85 }),
      totemC : new THREE.MeshStandardMaterial({ color: 0xffd65a, roughness: 0.85 }),
      // Distant mountain layers (fog-tinted automatically)
      mtFar  : new THREE.MeshStandardMaterial({ color: 0x6a4a7a, roughness: 1.0, flatShading: true }),                                // violet far
      mtMid  : new THREE.MeshStandardMaterial({ color: 0x8a5040, roughness: 1.0, flatShading: true }),                                // red canyon mid
      mtNear : new THREE.MeshStandardMaterial({ color: 0xb8704a, roughness: 1.0, flatShading: true }),                                // warm near hills
    };

    // Shared static geometries
    this.geoGround = new THREE.BoxGeometry(14, 0.4, CHUNK);
    this.geoStripe = new THREE.BoxGeometry(0.12, 0.01, 2);
    this.geoRail   = new THREE.BoxGeometry(0.08, 0.08, CHUNK);

    // Exposed material for external day/night control
    // Building + window palettes (per-instance random pick for colorful skyline)
    this.buildPalette = [
      new THREE.MeshStandardMaterial({ color: 0x8a4aff, roughness: 0.55, metalness: 0.2 }),
      new THREE.MeshStandardMaterial({ color: 0x4aa0ff, roughness: 0.55, metalness: 0.2 }),
      new THREE.MeshStandardMaterial({ color: 0xff6a8a, roughness: 0.55, metalness: 0.2 }),
      new THREE.MeshStandardMaterial({ color: 0x4fd6a0, roughness: 0.55, metalness: 0.2 }),
      new THREE.MeshStandardMaterial({ color: 0xffb23a, roughness: 0.55, metalness: 0.2 }),
      new THREE.MeshStandardMaterial({ color: 0xd75aff, roughness: 0.55, metalness: 0.2 }),
    ];
    this.windowPalette = [
      new THREE.MeshStandardMaterial({ color: 0xffd65a, emissive: 0xffd65a, emissiveIntensity: 1.5, roughness: 0.4 }),
      new THREE.MeshStandardMaterial({ color: 0x7df9ff, emissive: 0x7df9ff, emissiveIntensity: 1.5, roughness: 0.4 }),
      new THREE.MeshStandardMaterial({ color: 0xff5aff, emissive: 0xff5aff, emissiveIntensity: 1.5, roughness: 0.4 }),
      new THREE.MeshStandardMaterial({ color: 0xaaff5a, emissive: 0xaaff5a, emissiveIntensity: 1.5, roughness: 0.4 }),
      new THREE.MeshStandardMaterial({ color: 0xff9a4a, emissive: 0xff9a4a, emissiveIntensity: 1.5, roughness: 0.4 }),
    ];
    // winMat retained for day/night scaling hook (uses the gold one)
    this.winMat = this.windowPalette[0];

    this.chunks       = [];
    this.travelled    = 0;
    this._lastOpenLane = 1;
    this._anim        = []; // tumbleweeds rolling + flames flickering
    for (let i = 0; i < BEHIND + AHEAD; i++) this._spawnChunk(CHUNK * BEHIND - i * CHUNK);
    this.mountains = this._buildMountains(scene);
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

  // ---- Background mountains (static horizon, fog-tinted) -------------
  _buildMountains(scene) {
    const layers = [
      { z: -260, count: 46, minH: 34, maxH: 78, spread: 260, mat: this.mat.mtFar  },
      { z: -190, count: 38, minH: 20, maxH: 50, spread: 230, mat: this.mat.mtMid  },
      { z: -130, count: 32, minH: 10, maxH: 28, spread: 210, mat: this.mat.mtNear },
    ];
    const root = new THREE.Group();
    for (const L of layers) {
      for (let i = 0; i < L.count; i++) {
        const h = L.minH + Math.random() * (L.maxH - L.minH);
        const r = h * (0.55 + Math.random() * 0.3);
        const seg = 5 + Math.floor(Math.random() * 3);
        const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), L.mat);
        const side = Math.random() < 0.5 ? -1 : 1;
        // Clear a corridor in front of the player so mountains don't cover the track.
        const xMin = 22;
        cone.position.set(
          side * (xMin + Math.random() * L.spread),
          h / 2 - 2,
          L.z + (Math.random() - 0.5) * 14
        );
        cone.rotation.y = Math.random() * Math.PI;
        cone.scale.x = 0.9 + Math.random() * 0.5;
        cone.scale.z = 0.9 + Math.random() * 0.5;
        cone.receiveShadow = false; cone.castShadow = false; // too far to matter
        root.add(cone);
      }
    }
    // Also a central far ridge behind the mountains, spanning the corridor,
    // so the horizon is never a flat gap even if the corridor is wide.
    for (let i = 0; i < 18; i++) {
      const h = 40 + Math.random() * 40;
      const r = h * 0.7;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 5), this.mat.mtFar);
      cone.position.set((Math.random() - 0.5) * 60, h / 2 - 2, -320 + Math.random() * 20);
      cone.rotation.y = Math.random() * Math.PI;
      root.add(cone);
    }
    scene.add(root);
    return root;
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
      for (let i = 0; i < 12; i++) {
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
    if (r < 0.13) return this._saguaro;
    if (r < 0.21) return this._barrelCactus;
    if (r < 0.30) return this._rock;
    if (r < 0.38) return this._deadTree;
    if (r < 0.45) return this._tumbleweed;
    if (r < 0.51) return this._flowers;
    if (r < 0.57) return this._skull;
    if (r < 0.64) return this._coyote;
    if (r < 0.71) return this._roadrunner;
    if (r < 0.77) return this._horse;
    if (r < 0.82) return this._signpost;
    if (r < 0.86) return this._campfire;
    if (r < 0.91) return this._windmill;
    if (r < 0.95) return this._wagon;
    if (r < 0.98) return this._crystal;
    if (r < 0.99) return this._lampPost;
    return this._totem;
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
    const h = 8 + Math.random() * 26;
    const w = 2.2 + Math.random() * 3.5;
    const d = 2.2 + Math.random() * 3.5;
    const bodyMat = this.buildPalette[(Math.random() * this.buildPalette.length) | 0];
    const winMat  = this.windowPalette[(Math.random() * this.windowPalette.length) | 0];
    const b = this._box(w, h, d, bodyMat); b.position.y = h / 2 - 0.2; g.add(b);
    for (const s of [-1, 1]) {
      const rows = Math.max(2, Math.floor(h / 2.2));
      const cols = Math.max(2, Math.floor(w / 1.4));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (Math.random() < 0.35) continue;
          const sw = (w / cols) * 0.55;
          const sh = (h / rows) * 0.55;
          const wn = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), winMat);
          wn.position.set(
            s * (d / 2 + 0.02),
            (r + 0.5) * (h / rows) - 0.2,
            ((c + 0.5) / cols - 0.5) * w
          );
          wn.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2;
          g.add(wn);
        }
      }
    }
    if (Math.random() < 0.45) {
      const poleH = 1.2 + Math.random() * 1.5;
      const pole = this._cyl(0.04, 0.04, poleH, this.mat.metal, 6);
      pole.position.y = h - 0.2 + poleH / 2;
      g.add(pole);
      const beacon = this._sph(0.18, this.mat.lamp, 10);
      beacon.position.y = h - 0.2 + poleH;
      g.add(beacon);
    }
    return g;
  }

  _barrelCactus() {
    const g = new THREE.Group();
    const h = 0.9 + Math.random() * 0.6;
    const body = this._cyl(0.55, 0.65, h, this.mat.cactus, 14);
    body.position.y = h / 2; g.add(body);
    const petalSet = [this.mat.petalA, this.mat.petalC, this.mat.petalD];
    const petal = petalSet[(Math.random() * petalSet.length) | 0];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const p = this._sph(0.1, petal, 8);
      p.position.set(Math.cos(a) * 0.18, h + 0.05, Math.sin(a) * 0.18);
      g.add(p);
    }
    const center = this._sph(0.08, this.mat.petalC, 8); center.position.y = h + 0.1; g.add(center);
    return g;
  }
  _flowers() {
    const g = new THREE.Group();
    const n = 3 + Math.floor(Math.random() * 4);
    const petalMats = [this.mat.petalA, this.mat.petalB, this.mat.petalC, this.mat.petalD];
    for (let i = 0; i < n; i++) {
      const stemH = 0.35 + Math.random() * 0.25;
      const stem = this._cyl(0.015, 0.025, stemH, this.mat.stem, 5);
      const sx = (Math.random() - 0.5) * 0.9, sz = (Math.random() - 0.5) * 0.9;
      stem.position.set(sx, stemH / 2, sz);
      g.add(stem);
      const pm = petalMats[(Math.random() * petalMats.length) | 0];
      const bloom = this._sph(0.08 + Math.random() * 0.06, pm, 8);
      bloom.position.set(sx, stemH + 0.05, sz);
      g.add(bloom);
    }
    return g;
  }
  _windmill() {
    const g = new THREE.Group();
    const h = 3.5 + Math.random() * 1.5;
    for (const [sx, sz] of [[-0.4,-0.4],[0.4,-0.4],[-0.4,0.4],[0.4,0.4]]) {
      const leg = this._cyl(0.04, 0.06, h, this.mat.wood, 5);
      leg.position.set(sx * 0.8, h / 2, sz * 0.8);
      leg.rotation.x = sz > 0 ? 0.08 : -0.08;
      leg.rotation.z = sx > 0 ? -0.08 : 0.08;
      g.add(leg);
    }
    for (let lvl = 0; lvl < 3; lvl++) {
      const y = (lvl + 1) * h / 4;
      const brace = this._box(0.9, 0.04, 0.04, this.mat.wood); brace.position.y = y; g.add(brace);
      const brace2 = brace.clone(); brace2.rotation.y = Math.PI / 2; g.add(brace2);
    }
    const hub = this._sph(0.12, this.mat.metal, 8); hub.position.y = h + 0.1; g.add(hub);
    const bladeRoot = new THREE.Group(); bladeRoot.position.set(0, h + 0.1, 0.12);
    for (let i = 0; i < 6; i++) {
      const blade = this._box(0.08, 0.9, 0.02, this.mat.blade);
      blade.position.y = 0.4;
      const holder = new THREE.Group();
      holder.rotation.z = (i / 6) * Math.PI * 2;
      holder.add(blade); bladeRoot.add(holder);
    }
    bladeRoot.userData._spin = 1.5 + Math.random();
    g.add(bladeRoot);
    this._anim.push(bladeRoot);
    return g;
  }
  _wagon() {
    const g = new THREE.Group();
    const body = this._box(1.4, 0.6, 2.6, this.mat.wagonBody); body.position.y = 0.85; g.add(body);
    for (let i = 0; i < 4; i++) {
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.04, 5, 10, Math.PI), this.mat.wood);
      hoop.position.set(0, 1.2, -1.0 + i * 0.7);
      hoop.rotation.y = Math.PI / 2;
      g.add(hoop);
    }
    const canopy = this._box(1.35, 0.05, 2.5, this.mat.canvasM); canopy.position.y = 1.85; g.add(canopy);
    for (const [sx, sz] of [[-0.65,-0.9],[0.65,-0.9],[-0.65,0.9],[0.65,0.9]]) {
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.07, 6, 14), this.mat.wood);
      wheel.position.set(sx, 0.4, sz); wheel.rotation.y = Math.PI / 2; g.add(wheel);
      for (let j = 0; j < 6; j++) {
        const spoke = this._box(0.05, 0.7, 0.04, this.mat.wood);
        spoke.position.set(sx, 0.4, sz); spoke.rotation.x = (j / 6) * Math.PI;
        g.add(spoke);
      }
    }
    return g;
  }
  _crystal() {
    const g = new THREE.Group();
    const mats = [this.mat.crystalA, this.mat.crystalB, this.mat.crystalC];
    const n = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const h = 0.8 + Math.random() * 1.4;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.18 + Math.random() * 0.15, h, 6), mats[i % mats.length]);
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      cone.position.set(Math.cos(a) * 0.3, h / 2, Math.sin(a) * 0.3);
      cone.rotation.z = (Math.random() - 0.5) * 0.3;
      cone.rotation.x = (Math.random() - 0.5) * 0.3;
      cone.castShadow = true;
      g.add(cone);
    }
    return g;
  }
  _lampPost() {
    const g = new THREE.Group();
    const post = this._cyl(0.06, 0.06, 3.2, this.mat.metal, 6); post.position.y = 1.6; g.add(post);
    const arm  = this._box(0.6, 0.06, 0.06, this.mat.metal); arm.position.set(0.3, 3.15, 0); g.add(arm);
    const orb  = this._sph(0.22, this.mat.lamp, 10); orb.position.set(0.6, 3.05, 0); g.add(orb);
    return g;
  }
  _totem() {
    const g = new THREE.Group();
    const mats = [this.mat.totemA, this.mat.totemB, this.mat.totemC];
    let y = 0;
    for (let i = 0; i < 4; i++) {
      const h = 0.6 + Math.random() * 0.3;
      const block = this._cyl(0.3, 0.3, h, mats[i % mats.length], 8);
      block.position.y = y + h / 2; g.add(block);
      for (const sx of [-0.12, 0.12]) {
        const eye = this._sph(0.05, this.mat.dark, 6);
        eye.position.set(sx, y + h * 0.55, 0.3);
        g.add(eye);
      }
      y += h;
    }
    const top = this._box(0.9, 0.1, 0.25, this.mat.totemA); top.position.y = y + 0.05; g.add(top);
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

  // Pterodactyl-style flying creature — light pastel palette, varied per instance
  _bird(x, z, parent) {
    const palettes = [
      { body: 0xfff2a8, memb: 0xffd65a, beak: 0xff9a4a },
      { body: 0xffc8d8, memb: 0xff7fb0, beak: 0xd84a7a },
      { body: 0xc8e8ff, memb: 0x7fc8ff, beak: 0x4a9ae0 },
      { body: 0xd8f4c8, memb: 0x8fe28a, beak: 0x4aa050 },
      { body: 0xe8d8ff, memb: 0xc89aff, beak: 0x8a5bff },
      { body: 0xffe0c8, memb: 0xff9a7a, beak: 0xd85a3a },
    ];
    const P = palettes[(Math.random() * palettes.length) | 0];
    const bodyMat = new THREE.MeshStandardMaterial({ color: P.body, roughness: 0.6 });
    const membMat = new THREE.MeshStandardMaterial({ color: P.memb, roughness: 0.8, side: THREE.DoubleSide });
    const beakMat = new THREE.MeshStandardMaterial({ color: P.beak, roughness: 0.5 });

    const g = new THREE.Group();
    const body  = this._sph(0.28, bodyMat, 10); body.scale.z = 2.0; g.add(body);
    const neck  = this._cyl(0.07, 0.1, 0.3, bodyMat, 8); neck.position.set(0, 0.06, -0.35); neck.rotation.x = -1.0; g.add(neck);
    const head  = this._sph(0.17, bodyMat, 8); head.position.set(0, 0.18, -0.55); head.scale.z = 1.2; g.add(head);
    const crest = this._box(0.05, 0.22, 0.22, membMat); crest.position.set(0, 0.35, -0.5); crest.rotation.x = -0.4; g.add(crest);
    const beak  = this._cyl(0.02, 0.06, 0.45, beakMat, 6); beak.position.set(0, 0.12, -0.88); beak.rotation.x = Math.PI / 2; g.add(beak);
    for (const sx of [-0.09, 0.09]) {
      const eye = this._sph(0.04, this.mat.dark, 6); eye.position.set(sx, 0.22, -0.62); g.add(eye);
    }
    const wingL = new THREE.Group(); wingL.position.set(-0.2, 0.05, 0);
    const wingLBone = this._box(0.9, 0.05, 0.4, bodyMat); wingLBone.position.x = -0.45; wingL.add(wingLBone);
    const wingLOuter = new THREE.Group(); wingLOuter.position.x = -0.9;
    const membraneL = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.7), membMat);
    membraneL.rotation.x = -Math.PI / 2; membraneL.position.set(-0.55, 0, 0.05);
    wingLOuter.add(membraneL);
    wingL.add(wingLOuter);
    g.add(wingL);
    const wingR = wingL.clone(); wingR.position.x = 0.2; wingR.scale.x = -1; g.add(wingR);
    const tail = this._cyl(0.02, 0.08, 0.5, bodyMat, 6); tail.position.set(0, 0, 0.45); tail.rotation.x = Math.PI / 2; g.add(tail);

    g.position.set(x, 1.9, z);
    g.userData.kind  = 'bird';
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
      } else if (a.userData._spin) {
        a.rotation.z += dt * a.userData._spin;
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
