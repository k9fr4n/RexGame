// -----------------------------------------------------------------------------
// player.js — stylized Rex: rounded ellipsoids + capsules + cones (less boxy),
//             with lane/jump/slide state machine and AABB collider.
// -----------------------------------------------------------------------------
import * as THREE from 'three';

export const LANES = [-2.6, 0, 2.6];

export class Player {
  constructor(scene, sfx) {
    this.scene = scene;
    this.sfx   = sfx;
    this.group = new THREE.Group();
    this.body  = new THREE.Group();
    this.group.add(this.body);

    const skin   = new THREE.MeshStandardMaterial({ color: 0x5fd873, roughness: 0.55, metalness: 0.05 });
    const belly  = new THREE.MeshStandardMaterial({ color: 0xe6f2a8, roughness: 0.8 });
    const dark   = new THREE.MeshStandardMaterial({ color: 0x1a3a20, roughness: 0.6 });
    const claw   = new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.45 });
    const eyeW   = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, emissive: 0xffffff, emissiveIntensity: 0.2 });
    const eyeB   = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.15 });
    const spikeM = new THREE.MeshStandardMaterial({ color: 0x3fa860, roughness: 0.6 });

    const sph = (r, mat, s = 16) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, s, Math.max(8, s - 4)), mat); m.castShadow = true; m.receiveShadow = true; return m; };
    const cap = (r, l, mat) => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, l, 6, 10), mat); m.castShadow = true; m.receiveShadow = true; return m; };
    const cyl = (rt, rb, h, mat, seg = 12) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.castShadow = true; m.receiveShadow = true; return m; };

    // Torso
    this.torso = sph(0.55, skin, 20); this.torso.scale.set(1.05, 1.15, 1.4); this.torso.position.y = 1.25; this.body.add(this.torso);
    const bell = sph(0.48, belly, 18); bell.scale.set(0.9, 0.9, 1.2); bell.position.set(0, 1.12, 0.08); this.body.add(bell);

    const neck = cap(0.24, 0.3, skin); neck.position.set(0, 1.78, -0.32); neck.rotation.x = 0.55; this.body.add(neck);

    this.head = sph(0.5, skin, 18); this.head.scale.set(0.95, 0.85, 1.05); this.head.position.set(0, 2.2, -0.55); this.body.add(this.head);

    const snout = cyl(0.28, 0.4, 0.9, skin, 14); snout.rotation.x = Math.PI / 2; snout.position.set(0, 2.02, -1.15); this.body.add(snout);
    const jaw   = cyl(0.18, 0.26, 0.75, dark, 12); jaw.rotation.x = Math.PI / 2; jaw.position.set(0, 1.84, -1.1); this.body.add(jaw);

    for (const sx of [-0.12, 0.12]) { const n = sph(0.04, eyeB, 8); n.position.set(sx, 2.1, -1.55); this.body.add(n); }

    const eyeL = sph(0.14, eyeW, 12); eyeL.position.set(-0.28, 2.38, -1.0); this.body.add(eyeL);
    const eyeR = eyeL.clone(); eyeR.position.x = 0.28; this.body.add(eyeR);
    const pupL = sph(0.07, eyeB, 10); pupL.position.set(-0.26, 2.36, -1.11); this.body.add(pupL);
    const pupR = pupL.clone(); pupR.position.x = 0.3; this.body.add(pupR);

    for (const sx of [-0.28, 0.28]) {
      const brow = sph(0.15, skin, 10); brow.scale.set(1.2, 0.4, 0.7);
      brow.position.set(sx, 2.55, -1.0); brow.rotation.z = sx < 0 ? -0.2 : 0.2;
      this.body.add(brow);
    }

    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.12 - t * 0.04, 0.26 - t * 0.14, 4), spikeM);
      spike.position.set(0, 1.95 - t * 0.25, 0.1 + t * 0.95); spike.castShadow = true;
      this.body.add(spike);
    }

    this.tail = new THREE.Group(); this.tail.position.set(0, 1.3, 0.9); this.body.add(this.tail);
    this.tailSegs = [];
    let prev = this.tail;
    for (let i = 0; i < 6; i++) {
      const rt = 0.35 - i * 0.05, rb = 0.4 - i * 0.05, len = 0.4;
      const seg = cyl(rt, rb, len, skin, 10); seg.rotation.x = Math.PI / 2; seg.position.z = len / 2;
      const pivot = new THREE.Group(); pivot.position.z = i === 0 ? 0 : 0.4;
      pivot.add(seg); prev.add(pivot); prev = pivot; this.tailSegs.push(pivot);
    }

    const makeArm = (side) => {
      const shoulder = new THREE.Group(); shoulder.position.set(side * 0.5, 1.55, -0.25);
      const upper = cap(0.1, 0.25, skin); upper.position.y = -0.18; shoulder.add(upper);
      const hand  = sph(0.12, skin, 10);  hand.position.y  = -0.42; shoulder.add(hand);
      for (let j = -1; j <= 1; j++) {
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 5), claw);
        c.position.set(j * 0.065, -0.52, -0.08); c.rotation.x = Math.PI;
        shoulder.add(c);
      }
      return shoulder;
    };
    this.armL = makeArm(-1); this.armR = makeArm(1);
    this.body.add(this.armL); this.body.add(this.armR);

    const makeLeg = (side) => {
      const root = new THREE.Group(); root.position.set(side * 0.38, 0.75, 0.12);
      const thigh = cap(0.22, 0.4, skin); thigh.position.y = -0.12; root.add(thigh);
      const shin  = cap(0.17, 0.3, skin); shin.position.y  = -0.78; root.add(shin);
      const foot  = sph(0.22, dark, 12);  foot.scale.set(1.1, 0.55, 1.8); foot.position.set(0, -1.08, 0.18); root.add(foot);
      for (const sx of [-0.13, 0, 0.13]) {
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.18, 5), claw);
        c.position.set(sx, -1.13, 0.48); c.rotation.x = -Math.PI / 2;
        root.add(c);
      }
      return root;
    };
    this.legL = makeLeg(-1); this.legR = makeLeg(1);
    this.body.add(this.legL); this.body.add(this.legR);

    scene.add(this.group);

    this.laneIndex  = 1; this.targetX = LANES[1];
    this.vy = 0; this.jumping = false;
    this.sliding = false; this.slideTimer = 0;
    this.dead = false;
    this.runTime = 0; this.lastStep = 0;
    this.radius = 0.7; this.heightStand = 2.6; this.heightSlide = 1.2;
  }

  moveLeft()  { if (this.laneIndex > 0) { this.laneIndex--; this.targetX = LANES[this.laneIndex]; } }
  moveRight() { if (this.laneIndex < 2) { this.laneIndex++; this.targetX = LANES[this.laneIndex]; } }
  jump()  { if (this.dead) return; if (!this.jumping) { this.vy = 11; this.jumping = true; this.sliding = false; this.slideTimer = 0; this.sfx.jump(); } }
  slide() { if (this.dead) return; if (!this.sliding && !this.jumping) { this.sliding = true; this.slideTimer = 0.7; this.sfx.slide(); } }
  die()   { if (this.dead) return; this.dead = true; this.sfx.hit(); }

  update(dt, speed) {
    this.group.position.x += (this.targetX - this.group.position.x) * Math.min(1, dt * 12);
    const leanTarget = (this.targetX - this.group.position.x) * 0.12;
    this.body.rotation.z += (leanTarget - this.body.rotation.z) * 0.15;

    const g = 28;
    this.group.position.y += this.vy * dt; this.vy -= g * dt;
    if (this.group.position.y <= 0) { this.group.position.y = 0; this.vy = 0; this.jumping = false; }

    if (this.sliding) { this.slideTimer -= dt; if (this.slideTimer <= 0) this.sliding = false; }
    const slideBlend = this.sliding ? 1 : 0;
    this.body.scale.y += ((1 - slideBlend * 0.55) - this.body.scale.y) * 0.25;
    this.body.scale.z += ((1 + slideBlend * 0.35) - this.body.scale.z) * 0.25;
    this.body.rotation.x += (slideBlend * 0.4 - this.body.rotation.x) * 0.2;

    if (!this.dead) {
      this.runTime += dt * (speed * 0.35);
      const t = this.runTime;
      const swing = Math.sin(t * 2) * 0.9;
      this.legL.rotation.x =  swing;
      this.legR.rotation.x = -swing;
      this.armL.rotation.x = -swing * 0.4;
      this.armR.rotation.x =  swing * 0.4;
      for (let i = 0; i < this.tailSegs.length; i++) {
        this.tailSegs[i].rotation.y = Math.sin(t * 2 - i * 0.6) * 0.2;
      }
      this.head.position.y = 2.2 + Math.sin(t * 2) * 0.04;
      if (!this.jumping && this.group.position.y < 0.05) {
        const phase = (Math.sin(t * 2) + 1) / 2;
        if (phase < 0.1 && this.lastStep > 0.5) { this.sfx.step(); this.lastStep = 0; }
        this.lastStep += dt;
      }
    } else {
      this.body.rotation.z += dt * 3;
    }
  }

  getAABB() {
    const halfW = 0.55, halfD = 0.9;
    const y0 = this.group.position.y;
    const h  = this.sliding ? this.heightSlide : this.heightStand;
    return {
      minX: this.group.position.x - halfW, maxX: this.group.position.x + halfW,
      minY: y0, maxY: y0 + h,
      minZ: this.group.position.z - halfD, maxZ: this.group.position.z + halfD,
    };
  }
}
