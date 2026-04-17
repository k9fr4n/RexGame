// -----------------------------------------------------------------------------
// main.js — bootstrap: renderer, scene, lights, camera, postprocessing,
//           game loop, state machine, UI wiring.
// -----------------------------------------------------------------------------
import * as THREE from 'three';
import { EffectComposer }    from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }        from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass }   from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass }        from 'three/addons/postprocessing/OutputPass.js';
import { Player }            from './player.js';
import { World }             from './world.js';
import { Input }             from './input.js';
import { Sfx }               from './audio.js';

// ---------- DOM ----------
const canvas        = document.getElementById('game');
const $score        = document.getElementById('score');
const $hi           = document.getElementById('hi');
const $eggs         = document.getElementById('eggs');
const $combo        = document.getElementById('combo');
const $comboVal     = document.getElementById('comboVal');
const $startScreen  = document.getElementById('startScreen');
const $gameOver     = document.getElementById('gameOver');
const $pauseScreen  = document.getElementById('pauseScreen');
const $finalScore   = document.getElementById('finalScore');
const $finalEggs    = document.getElementById('finalEggs');
const $finalHi      = document.getElementById('finalHi');
const $startBtn     = document.getElementById('startBtn');
const $retryBtn     = document.getElementById('retryBtn');
const $resumeBtn    = document.getElementById('resumeBtn');

// ---------- Renderer ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// ---------- Scene ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07101c);
scene.fog = new THREE.Fog(0x07101c, 40, 180);

// ---------- Camera ----------
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 400);
camera.position.set(0, 5.2, 9.5);
camera.lookAt(0, 1.4, 0);

// ---------- Lights ----------
const hemi = new THREE.HemisphereLight(0x88aaff, 0x221a1a, 0.55);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff1d6, 1.25);
sun.position.set(12, 22, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 80;
sun.shadow.camera.left = -22; sun.shadow.camera.right = 22;
sun.shadow.camera.top = 22;   sun.shadow.camera.bottom = -10;
sun.shadow.bias = -0.0005;
scene.add(sun);
scene.add(sun.target);

const rim = new THREE.DirectionalLight(0x7df9ff, 0.6);
rim.position.set(-10, 6, -12);
scene.add(rim);

// Starfield (skydome speckle)
{
  const g = new THREE.BufferGeometry();
  const N = 900; const arr = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const r = 180 + Math.random() * 40;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1) * 0.6 + 0.2;
    arr[i * 3]     = r * Math.sin(ph) * Math.cos(th);
    arr[i * 3 + 1] = r * Math.cos(ph) * 0.7 + 20;
    arr[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
  }
  g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, sizeAttenuation: true, transparent: true, opacity: 0.85 }));
  scene.add(stars);
}

// ---------- Postprocessing ----------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.65, 0.8, 0.75);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------- Game objects ----------
const sfx    = new Sfx();
const input  = new Input();
const world  = new World(scene);
const player = new Player(scene, sfx);

// ---------- State ----------
const HI_KEY = 'rexrush.hi';
const state = {
  phase: 'menu',       // 'menu' | 'playing' | 'dead' | 'paused'
  speed: 18,
  score: 0,
  eggs: 0,
  combo: 1,
  comboTimer: 0,
  shake: 0,
  hi: Number(localStorage.getItem(HI_KEY) || 0),
};
$hi.textContent = state.hi;

// ---------- Particles (pickup & hit) ----------
const fxPool = [];
function spawnFX(x, y, z, color, count = 14) {
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.12, 0.12),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.2, roughness: 0.3 })
    );
    m.position.set(x, y, z);
    m.userData.vel = new THREE.Vector3((Math.random() - 0.5) * 8, Math.random() * 6 + 2, (Math.random() - 0.5) * 8);
    m.userData.life = 0.8;
    scene.add(m);
    fxPool.push(m);
  }
}
function updateFX(dt) {
  for (let i = fxPool.length - 1; i >= 0; i--) {
    const p = fxPool[i];
    p.userData.life -= dt;
    if (p.userData.life <= 0) { scene.remove(p); p.geometry.dispose(); p.material.dispose(); fxPool.splice(i, 1); continue; }
    p.userData.vel.y -= 18 * dt;
    p.position.addScaledVector(p.userData.vel, dt);
    p.rotation.x += dt * 6; p.rotation.y += dt * 4;
    p.material.opacity = p.userData.life;
  }
}

// ---------- Input wiring ----------
input.on('left',    () => { if (state.phase === 'playing') player.moveLeft(); });
input.on('right',   () => { if (state.phase === 'playing') player.moveRight(); });
input.on('jump',    () => { if (state.phase === 'playing') player.jump(); });
input.on('slide',   () => { if (state.phase === 'playing') player.slide(); });
input.on('pause',   () => {
  if (state.phase === 'playing') { state.phase = 'paused'; $pauseScreen.classList.remove('hidden'); }
  else if (state.phase === 'paused') { state.phase = 'playing'; $pauseScreen.classList.add('hidden'); }
});
input.on('confirm', () => {
  if (state.phase === 'menu') startGame();
  else if (state.phase === 'dead') startGame();
  else if (state.phase === 'paused') { state.phase = 'playing'; $pauseScreen.classList.add('hidden'); }
});

$startBtn .addEventListener('click', () => { sfx.resume(); startGame(); });
$retryBtn .addEventListener('click', () => { sfx.resume(); startGame(); });
$resumeBtn.addEventListener('click', () => { state.phase = 'playing'; $pauseScreen.classList.add('hidden'); });

// ---------- Resize ----------
function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);
onResize();

// ---------- Game lifecycle ----------
function startGame() {
  state.phase = 'playing';
  state.speed = 18;
  state.score = 0;
  state.eggs = 0;
  state.combo = 1;
  state.comboTimer = 0;
  $score.textContent = '0';
  $eggs.textContent  = '0';
  $combo.classList.add('hidden');
  $startScreen.classList.add('hidden');
  $gameOver   .classList.add('hidden');
  $pauseScreen.classList.add('hidden');
  // Reset player
  player.group.position.set(0, 0, 0);
  player.targetX = 0; player.laneIndex = 1;
  player.vy = 0; player.jumping = false; player.sliding = false; player.slideTimer = 0;
  player.dead = false;
  player.body.rotation.set(0, 0, 0); player.body.scale.set(1, 1, 1);
  world.reset();
}

function gameOver() {
  if (state.phase !== 'playing') return;
  state.phase = 'dead';
  player.die();
  state.shake = 0.6;
  spawnFX(player.group.position.x, 1.2, player.group.position.z, 0xff4477, 30);
  // Update best
  const finalScore = Math.floor(state.score);
  if (finalScore > state.hi) {
    state.hi = finalScore;
    localStorage.setItem(HI_KEY, String(finalScore));
    $hi.textContent = finalScore;
  }
  $finalScore.textContent = finalScore;
  $finalEggs .textContent = state.eggs;
  $finalHi   .textContent = state.hi;
  setTimeout(() => $gameOver.classList.remove('hidden'), 650);
}

// ---------- Main loop ----------
const clock = new THREE.Clock();
function tick() {
  let dt = Math.min(clock.getDelta(), 1 / 30);

  if (state.phase === 'playing') {
    // Difficulty ramp
    state.speed = Math.min(55, state.speed + dt * 0.35);

    world.update(dt, state.speed, camera.position.z);
    player.update(dt, state.speed);

    // Collisions
    const hit = world.collide(player.getAABB());
    if (hit) {
      if (hit.kind === 'egg') {
        state.eggs += 1;
        state.combo = Math.min(10, state.combo + 1);
        state.comboTimer = 2.5;
        state.score += 50 * state.combo;
        $eggs.textContent = state.eggs;
        $comboVal.textContent = state.combo;
        $combo.classList.remove('hidden');
        spawnFX(hit.object.position.x, 1.4, hit.object.position.z + hit.parent.group.position.z + world.root.position.z, 0xffd86b, 18);
        sfx.pickup();
        world.removePickup(hit.object, hit.parent);
      } else {
        gameOver();
      }
    }

    // Score from distance
    state.score += dt * state.speed * 1.5;
    $score.textContent = Math.floor(state.score);

    // Combo decay
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) { state.combo = 1; $combo.classList.add('hidden'); }
    }

  } else if (state.phase === 'dead') {
    player.update(dt, 0);
    updateFX(dt);
  } else if (state.phase === 'menu') {
    // slow cinematic rotation of scene
    world.update(dt, 6, camera.position.z);
    player.update(dt, 6);
    camera.position.x = Math.sin(performance.now() * 0.0003) * 1.2;
    camera.lookAt(0, 1.4, 0);
  }

  updateFX(dt);

  // Camera shake
  if (state.shake > 0) {
    state.shake -= dt;
    camera.position.x += (Math.random() - 0.5) * 0.4 * state.shake;
    camera.position.y += (Math.random() - 0.5) * 0.3 * state.shake;
  } else if (state.phase === 'playing') {
    // subtle camera follow
    camera.position.x += (player.group.position.x * 0.25 - camera.position.x) * 0.08;
    camera.position.y += (5.2 + player.group.position.y * 0.2 - camera.position.y) * 0.1;
    camera.lookAt(player.group.position.x * 0.4, 1.4 + player.group.position.y * 0.3, 0);
  }

  composer.render();
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
