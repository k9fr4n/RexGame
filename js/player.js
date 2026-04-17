// -----------------------------------------------------------------------------
// player.js — stylized Rex built from primitives + lane/jump/slide state machine.
// -----------------------------------------------------------------------------
import * as THREE from 'three';

export const LANES = [-2.6, 0, 2.6];

export class Player {
  constructor(scene, sfx) {
    this.scene = scene;
    this.sfx = sfx;
    this.group = new THREE.Group();
    this.body = new THREE.Group();
    this.group.add(this.body);

    // Materials — single PBR dino palette
    const skin = new THREE.MeshStandardMaterial({ color: 0x58d86a, roughness: 0.55, metalness: 0.05 });
    const belly = new THREE.MeshStandardMaterial({ color: 0xcdeb8b, roughness: 0.8, metalness: 0.02 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1a3a20, roughness: 0.5 });
    const eyeW = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, emissive: 0xffffff, emissiveIntensity: 0.15 });
    const eyeB = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2 });

    const box = (w, h, d, mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d, 1, 1, 1), mat); m.castShadow = true; m.receiveShadow = true; return m; };

    // Torso
    this.torso = box(1.1, 1.2, 1.5, skin); this.torso.position.y = 1.2; this.body.add(this.torso);
    const bell = box(0.9, 0.9, 1.3, belly); bell.position.set(0, 1.1, 0.08); this.body.add(bell);

    // Head
    this.head = box(1.0, 0.95, 1.2, skin); this.head.position.set(0, 2.2, -0.55); this.body.add(this.head);
    const snout = box(0.75, 0.55, 0.9, skin); snout.position.set(0, 2.05, -1.15); this.body.add(snout);
    const mouth = box(0.6, 0.08, 0.7, dark); mouth.position.set(0, 1.92, -1.2); this.body.add(mouth);
    // Eyes
    const eyeL = box(0.22, 0.22, 0.1, eyeW); eyeL.position.set(-0.3, 2.4, -1.05); this.body.add(eyeL);
    const eyeR = eyeL.clone(); eyeR.position.x = 0.3; this.body.add(eyeR);
    const pupL = box(0.09, 0.12, 0.05, eyeB); pupL.position.set(-0.28, 2.38, -1.1); this.body.add(pupL);
    const pupR = pupL.clone(); pupR.position.x = 0.32; this.body.add(pupR);

    // Tail (segmented)
    this.tail = new THREE.Group(); this.tail.position.set(0, 1.3, 0.85); this.body.add(this.tail);
    let prev = this.tail;
    this.tailSegs = [];
    for (let i = 0; i < 5; i++) {
      const s = 0.9 - i * 0.14;
      const seg = box(s, s, 0.5, skin); seg.position.z = 0.35;
      const pivot = new THREE.Group(); pivot.position.z = 0.1;
      pivot.add(seg); prev.add(pivot); prev = pivot;
      this.tailSegs.push(pivot);
    }

    // Arms (tiny T-rex arms)
    this.armL = box(0.18, 0.5, 0.18, skin); this.armL.position.set(-0.55, 1.5, -0.3); this.body.add(this.armL);
    this.armR = this.armL.clone(); this.armR.position.x = 0.55; this.body.add(this.armR);

    // Legs
    this.legL = new THREE.Group(); this.legR = new THREE.Group();
    this.legL.position.set(-0.35, 0.65, 0.1); this.legR.position.set(0.35, 0.65, 0.1);
    const thighL = box(0.45, 0.9, 0.55, skin); thighL.position.y = -0.1; this.legL.add(thighL);
    const shinL  = box(0.35, 0.55, 0.5, skin); shinL.position.y = -0.75; this.legL.add(shinL);
    const footL  = box(0.45, 0.18, 0.7, dark); footL.position.set(0, -1.08, 0.1); this.legL.add(footL);
    const thighR = thighL.clone(); const shinR = shinL.clone(); const footR = footL.clone();
    this.legR.add(thighR); this.legR.add(shinR); this.legR.add(footR);
    this.body.add(this.legL); this.body.add(this.legR);

    scene.add(this.group);

    // State
    this.laneIndex = 1;
    this.targetX = LANES[1];
    this.vy = 0;
    this.jumping = false;
    this.sliding = false;
    this.slideTimer = 0;
    this.dead = false;
    this.runTime = 0;
    this.lastStep = 0;

    // Collider (AABB-ish)
    this.radius = 0.7;
    this.heightStand = 2.6;
    this.heightSlide = 1.2;
  }

  moveLeft()  { if (this.laneIndex > 0) { this.laneIndex--; this.targetX = LANES[this.laneIndex]; } }
  moveRight() { if (this.laneIndex < 2) { this.laneIndex++; this.targetX = LANES[this.laneIndex]; } }
  jump() {
    if (this.dead) return;
    if (!this.jumping) { this.vy = 11; this.jumping = true; this.sliding = false; this.slideTimer = 0; this.sfx.jump(); }
  }
  slide() {
    if (this.dead) return;
    if (!this.sliding && !this.jumping) { this.sliding = true; this.slideTimer = 0.7; this.sfx.slide(); }
  }
  die() { if (this.dead) return; this.dead = true; this.sfx.hit(); }

  update(dt, speed) {
    // Lane lerp
    this.group.position.x += (this.targetX - this.group.position.x) * Math.min(1, dt * 12);
    // Slight lean on lane change
    const leanTarget = (this.targetX - this.group.position.x) * 0.12;
    this.body.rotation.z += (leanTarget - this.body.rotation.z) * 0.15;

    // Gravity / jump
    const g = 28;
    this.group.position.y += this.vy * dt;
    this.vy -= g * dt;
    if (this.group.position.y <= 0) { this.group.position.y = 0; this.vy = 0; this.jumping = false; }

    // Slide timer
    if (this.sliding) {
      this.slideTimer -= dt;
      if (this.slideTimer <= 0) this.sliding = false;
    }
    const slideBlend = this.sliding ? 1 : 0;
    // Squash for slide
    this.body.scale.y += ((1 - slideBlend * 0.55) - this.body.scale.y) * 0.25;
    this.body.scale.z += ((1 + slideBlend * 0.35) - this.body.scale.z) * 0.25;
    this.body.rotation.x += (slideBlend * 0.4 - this.body.rotation.x) * 0.2;

    // Run cycle
    if (!this.dead) {
      this.runTime += dt * (speed * 0.35);
      const t = this.runTime;
      const swing = Math.sin(t * 2) * 0.9;
      this.legL.rotation.x =  swing;
      this.legR.rotation.x = -swing;
      this.armL.rotation.x = -swing * 0.4;
      this.armR.rotation.x =  swing * 0.4;
      // Tail wag chained
      for (let i = 0; i < this.tailSegs.length; i++) {
        this.tailSegs[i].rotation.y = Math.sin(t * 2 - i * 0.6) * 0.2;
      }
      // Head bob
      this.head.position.y = 2.2 + Math.sin(t * 2) * 0.04;

      // Step SFX
      if (!this.jumping && this.group.position.y < 0.05) {
        const phase = (Math.sin(t * 2) + 1) / 2;
        if (phase < 0.1 && this.lastStep > 0.5) { this.sfx.step(); this.lastStep = 0; }
        this.lastStep += dt;
      }
    } else {
      // Death flop
      this.body.rotation.z += dt * 3;
    }
  }

  // Collider box based on current pose
  getAABB() {
    const halfW = 0.55;
    const halfD = 0.9;
    const y0 = this.group.position.y;
    const h = this.sliding ? this.heightSlide : this.heightStand;
    return {
      minX: this.group.position.x - halfW, maxX: this.group.position.x + halfW,
      minY: y0, maxY: y0 + h,
      minZ: this.group.position.z - halfD, maxZ: this.group.position.z + halfD,
    };
  }
}
