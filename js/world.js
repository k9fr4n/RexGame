// -----------------------------------------------------------------------------
// world.js — streaming endless world: ground chunks, side props (desert+neon city
// hybrid), clouds, spawner of obstacles & collectibles across 3 lanes.
// -----------------------------------------------------------------------------
import * as THREE from 'three';
import { LANES } from './player.js';

const CHUNK = 40;          // length of one ground chunk
const AHEAD = 6;            // chunks ahead of camera
const BEHIND = 2;           // chunks kept behind

export class World {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group(); scene.add(this.root);

    // Palettes
    this.matGround  = new THREE.MeshStandardMaterial({ color: 0x1a2030, roughness: 0.95, metalness: 0.0 });
    this.matStripe  = new THREE.MeshStandardMaterial({ color: 0xffd86b, roughness: 0.6, emissive: 0x3a2a00, emissiveIntensity: 0.4 });
    this.matRail    = new THREE.MeshStandardMaterial({ color: 0x88a0b8, roughness: 0.3, metalness: 0.8 });
    this.matRock    = new THREE.MeshStandardMaterial({ color: 0x3a3230, roughness: 1.0 });
    this.matCactus  = new THREE.MeshStandardMaterial({ color: 0x2e7d4f, roughness: 0.7 });
    this.matTrain   = new THREE.MeshStandardMaterial({ color: 0xff3e7f, roughness: 0.3, metalness: 0.5, emissive: 0x5a0020, emissiveIntensity: 0.35 });
    this.matBarrier = new THREE.MeshStandardMaterial({ color: 0xffaa00, roughness: 0.5, emissive: 0x552200, emissiveIntensity: 0.5 });
    this.matBird    = new THREE.MeshStandardMaterial({ color: 0xe0e0ff, roughness: 0.6 });
    this.matEgg     = new THREE.MeshStandardMaterial({ color: 0xfff4b6, roughness: 0.25, metalness: 0.1, emissive: 0xffd86b, emissiveIntensity: 0.8 });
    this.matBuilding = new THREE.MeshStandardMaterial({ color: 0x0e1526, roughness: 0.8, metalness: 0.1 });
    this.matWindow  = new THREE.MeshStandardMaterial({ color: 0x7df9ff, emissive: 0x7df9ff, emissiveIntensity: 1.4, roughness: 0.4 });

    // Shared geometries
    this.geoGround = new THREE.BoxGeometry(14, 0.4, CHUNK);
    this.geoStripe = new THREE.BoxGeometry(0.12, 0.01, 2);
    this.geoRail   = new THREE.BoxGeometry(0.08, 0.08, CHUNK);

    this.chunks = [];     // {z, group, obstacles:[], pickups:[], props:[]}
    this.travelled = 0;

    // Chunks span: z = +CHUNK*BEHIND (behind player) down to -(CHUNK*AHEAD) (ahead, -Z).
    for (let i = 0; i < BEHIND + AHEAD; i++) this._spawnChunk(CHUNK * BEHIND - i * CHUNK);
  }

  reset() {
    for (const c of this.chunks) this.root.remove(c.group);
    this.chunks = [];
    this.travelled = 0;
    this.root.position.z = 0;
    for (let i = 0; i < BEHIND + AHEAD; i++) this._spawnChunk(CHUNK * BEHIND - i * CHUNK);
  }

  _spawnChunk(z) {
    const g = new THREE.Group();
    g.position.z = z;

    // Ground
    const ground = new THREE.Mesh(this.geoGround, this.matGround);
    ground.receiveShadow = true; ground.position.y = -0.2;
    g.add(ground);

    // Lane stripes
    for (const lx of [-1.3, 1.3]) {
      for (let s = -CHUNK / 2 + 1; s < CHUNK / 2; s += 4) {
        const st = new THREE.Mesh(this.geoStripe, this.matStripe);
        st.position.set(lx, 0.01, s);
        g.add(st);
      }
    }
    // Outer rails
    for (const rx of [-4.2, 4.2]) {
      const rail = new THREE.Mesh(this.geoRail, this.matRail);
      rail.position.set(rx, 0.3, 0); rail.castShadow = true;
      g.add(rail);
    }

    // Side props: buildings / rocks / cacti
    const props = [];
    const isCity = Math.floor((z / CHUNK) % 4) !== 0;
    for (let side of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        const zz = (Math.random() - 0.5) * CHUNK;
        const xx = side * (6 + Math.random() * 14);
        if (isCity && Math.random() < 0.7) {
          // building
          const h = 6 + Math.random() * 22;
          const w = 2 + Math.random() * 3;
          const d = 2 + Math.random() * 3;
          const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.matBuilding);
          b.position.set(xx, h / 2 - 0.2, zz); b.castShadow = true; b.receiveShadow = true;
          g.add(b); props.push(b);
          // windows (instanced-ish: random emissive patches)
          const wn = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.8, h * 0.8), this.matWindow);
          wn.position.set(xx + (side === -1 ? d / 2 + 0.01 : -d / 2 - 0.01), h / 2, zz);
          wn.rotation.y = side === -1 ? -Math.PI / 2 : Math.PI / 2;
          g.add(wn); props.push(wn);
        } else if (Math.random() < 0.6) {
          const r = 0.5 + Math.random() * 1.4;
          const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), this.matRock);
          rock.position.set(xx, r * 0.4, zz); rock.rotation.y = Math.random() * Math.PI;
          rock.castShadow = true; rock.receiveShadow = true;
          g.add(rock); props.push(rock);
        } else {
          const cactus = this._cactus();
          cactus.position.set(xx, 0, zz);
          g.add(cactus); props.push(cactus);
        }
      }
    }

    // Obstacles & pickups on lanes
    const obstacles = [];
    const pickups = [];
    // Avoid placing anything too close to chunk boundaries
    const slotsZ = [];
    for (let s = -CHUNK / 2 + 6; s < CHUNK / 2 - 6; s += 6) slotsZ.push(s);
    // Never block all 3 lanes at the same z
    for (const sz of slotsZ) {
      const openLane = Math.floor(Math.random() * 3);
      for (let li = 0; li < 3; li++) {
        if (li === openLane) {
          // Maybe spawn a pickup in the open lane
          if (Math.random() < 0.35) pickups.push(this._egg(LANES[li], sz, g));
          continue;
        }
        if (Math.random() < 0.55) {
          const kind = Math.random();
          let ob;
          if (kind < 0.4) ob = this._barrier(LANES[li], sz, g);         // duck under? no → jump over (low barrier)
          else if (kind < 0.75) ob = this._train(LANES[li], sz, g);     // must change lane
          else ob = this._bird(LANES[li], sz, g);                        // must slide
          obstacles.push(ob);
        }
      }
    }

    this.root.add(g);
    this.chunks.push({ z, group: g, obstacles, pickups, props });
  }

  _cactus() {
    const grp = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 2.2, 8), this.matCactus);
    trunk.position.y = 1.1; trunk.castShadow = true; grp.add(trunk);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 1.2, 8), this.matCactus);
    arm.position.set(0.35, 1.4, 0); arm.rotation.z = -0.8; arm.castShadow = true; grp.add(arm);
    return grp;
  }

  _barrier(x, z, parent) {
    // low orange barrier → jump
    const grp = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.9, 0.5), this.matBarrier);
    base.position.y = 0.45; base.castShadow = true; base.receiveShadow = true; grp.add(base);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.15, 0.52), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 }));
    stripe.position.y = 0.45; grp.add(stripe);
    grp.position.set(x, 0, z);
    grp.userData.kind = 'barrier';
    grp.userData.aabb = { w: 1.8, h: 0.9, d: 0.5, yOff: 0 };
    parent.add(grp);
    return grp;
  }

  _train(x, z, parent) {
    // tall hot-pink neon train → must change lane
    const grp = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 3.2, 7), this.matTrain);
    body.position.y = 1.6; body.castShadow = true; body.receiveShadow = true; grp.add(body);
    const glow = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.3, 7.05), new THREE.MeshStandardMaterial({ color: 0x7df9ff, emissive: 0x7df9ff, emissiveIntensity: 1.5 }));
    glow.position.y = 2.9; grp.add(glow);
    grp.position.set(x, 0, z);
    grp.userData.kind = 'train';
    grp.userData.aabb = { w: 2.1, h: 3.2, d: 7, yOff: 0 };
    parent.add(grp);
    return grp;
  }

  _bird(x, z, parent) {
    // flying bird → must slide
    const grp = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), this.matBird);
    body.castShadow = true; grp.add(body);
    const wingL = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.45), this.matBird);
    wingL.position.x = -0.7; grp.add(wingL);
    const wingR = wingL.clone(); wingR.position.x = 0.7; grp.add(wingR);
    grp.userData.wings = [wingL, wingR];
    grp.userData.phase = Math.random() * Math.PI * 2;
    grp.position.set(x, 1.9, z);
    grp.userData.kind = 'bird';
    grp.userData.aabb = { w: 1.6, h: 0.6, d: 0.8, yOff: 1.9 };
    parent.add(grp);
    return grp;
  }

  _egg(x, z, parent) {
    const grp = new THREE.Group();
    const egg = new THREE.Mesh(new THREE.SphereGeometry(0.35, 14, 10), this.matEgg);
    egg.scale.y = 1.3;
    egg.castShadow = true; grp.add(egg);
    const halo = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.7, 24), new THREE.MeshBasicMaterial({ color: 0xffd86b, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
    halo.rotation.x = -Math.PI / 2; halo.position.y = -0.4; grp.add(halo);
    grp.position.set(x, 1.1, z);
    grp.userData.kind = 'egg';
    grp.userData.aabb = { w: 0.7, h: 0.9, d: 0.7, yOff: 0.8 };
    parent.add(grp);
    return grp;
  }

  // Move world toward camera (-Z means coming at player)
  update(dt, speed, cameraZ) {
    const dz = speed * dt;
    this.root.position.z += dz;
    this.travelled += dz;

    // Recycle old, spawn new based on chunk world-Z
    // Chunk world-Z = chunk.z + root.z
    for (let i = this.chunks.length - 1; i >= 0; i--) {
      const c = this.chunks[i];
      const worldZ = c.z + this.root.position.z;
      if (worldZ > cameraZ + CHUNK * (BEHIND + 1)) {
        this.root.remove(c.group);
        // dispose geometries of props generated uniquely (rocks/buildings)
        c.group.traverse(o => { if (o.isMesh && o.geometry && o.geometry !== this.geoGround && o.geometry !== this.geoStripe && o.geometry !== this.geoRail) o.geometry.dispose?.(); });
        this.chunks.splice(i, 1);
      }
    }
    while (this.chunks.length < BEHIND + AHEAD) {
      // Find the most forward (smallest z) chunk and spawn one further ahead.
      let minZ = Infinity;
      for (const cc of this.chunks) if (cc.z < minZ) minZ = cc.z;
      this._spawnChunk(minZ - CHUNK);
    }

    // Animate birds & eggs
    for (const c of this.chunks) {
      for (const ob of c.obstacles) {
        if (ob.userData.kind === 'bird') {
          ob.userData.phase += dt * 10;
          const f = Math.sin(ob.userData.phase) * 0.8;
          ob.userData.wings[0].rotation.z =  f;
          ob.userData.wings[1].rotation.z = -f;
        }
      }
      for (const p of c.pickups) {
        p.rotation.y += dt * 2;
        p.position.y = 1.1 + Math.sin((this.travelled + p.position.z) * 0.1) * 0.1;
      }
    }
  }

  // Check collisions — returns { kind, object } or null
  collide(playerAABB) {
    for (const c of this.chunks) {
      const cz = c.group.position.z + this.root.position.z; // world-z of chunk center
      // quick cull
      if (Math.abs(cz) > CHUNK) continue;
      // obstacles
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
      // pickups
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
