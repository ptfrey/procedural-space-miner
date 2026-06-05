import * as THREE from "three";
import "./styles.css";

const canvas = document.querySelector("#game");
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance",
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x03070f);
scene.fog = new THREE.FogExp2(0x061120, 0.0048);

const camera = new THREE.PerspectiveCamera(
  64,
  window.innerWidth / window.innerHeight,
  0.1,
  1300,
);
camera.position.set(0, 4, 12);

const timer = new THREE.Timer();
timer.connect(document);
const raycaster = new THREE.Raycaster();

const ui = {
  gems: document.querySelector("#gems"),
  range: document.querySelector("#range"),
  speed: document.querySelector("#speed"),
  energyValue: document.querySelector("#energy-value"),
  energyFill: document.querySelector("#energy-fill"),
  reticle: document.querySelector("#reticle"),
  toast: document.querySelector("#toast"),
  buttons: [...document.querySelectorAll("[data-upgrade]")],
  meta: {
    speed: document.querySelector("#speed-meta"),
    strength: document.querySelector("#strength-meta"),
    duration: document.querySelector("#duration-meta"),
  },
};

const game = {
  gems: 0,
  distance: 0,
  energy: 120,
  energyMax: 120,
  firing: false,
  lastToastAt: 0,
  laserPulse: 0,
  upgrades: {
    speed: 1,
    strength: 1,
    duration: 1,
  },
};

const keys = new Set();
const tapLaserPulse = 0.42;
const pointer = {
  x: window.innerWidth * 0.5,
  y: window.innerHeight * 0.5,
  ndc: new THREE.Vector2(0, 0),
  firing: false,
  fireLatch: 0,
  lastMove: 0,
};

const bounds = {
  x: 34,
  y: 21,
};

const player = {
  position: new THREE.Vector3(0, 0, 0),
  velocity: new THREE.Vector3(0, 0, 0),
  target: new THREE.Vector3(0, 0, 0),
  forwardSpeed: 22,
};

const asteroids = [];
const gems = [];
const particles = [];
let nextAsteroidZ = -34;
let nextDustRecycle = 0;

const reusable = {
  vecA: new THREE.Vector3(),
  vecB: new THREE.Vector3(),
  vecC: new THREE.Vector3(),
  vecD: new THREE.Vector3(),
  vecE: new THREE.Vector3(),
  quat: new THREE.Quaternion(),
  mat4: new THREE.Matrix4(),
};

const asteroidMaterials = [
  new THREE.MeshStandardMaterial({
    color: 0x7c817c,
    roughness: 0.92,
    metalness: 0.05,
    flatShading: true,
  }),
  new THREE.MeshStandardMaterial({
    color: 0x6f6670,
    roughness: 0.96,
    metalness: 0.03,
    flatShading: true,
  }),
  new THREE.MeshStandardMaterial({
    color: 0x5f6e76,
    roughness: 0.9,
    metalness: 0.08,
    flatShading: true,
  }),
];

const gemMaterials = [
  new THREE.MeshStandardMaterial({
    color: 0x5fe6ff,
    emissive: 0x0a7490,
    emissiveIntensity: 0.75,
    roughness: 0.18,
    metalness: 0.12,
  }),
  new THREE.MeshStandardMaterial({
    color: 0xff7dad,
    emissive: 0x7f123c,
    emissiveIntensity: 0.72,
    roughness: 0.16,
    metalness: 0.1,
  }),
  new THREE.MeshStandardMaterial({
    color: 0xffc65a,
    emissive: 0x8a4c08,
    emissiveIntensity: 0.65,
    roughness: 0.2,
    metalness: 0.1,
  }),
  new THREE.MeshStandardMaterial({
    color: 0xb9ff6a,
    emissive: 0x3b7a12,
    emissiveIntensity: 0.7,
    roughness: 0.18,
    metalness: 0.08,
  }),
];

const sparkGeometry = new THREE.SphereGeometry(0.09, 8, 6);
const gemGeometry = new THREE.OctahedronGeometry(0.62, 0);
const beamGeometry = new THREE.CylinderGeometry(0.055, 0.1, 1, 18, 1, true);
const beamCoreGeometry = new THREE.CylinderGeometry(0.025, 0.038, 1, 14, 1, true);

const laserBeam = new THREE.Group();
const beamShell = new THREE.Mesh(
  beamGeometry,
  new THREE.MeshBasicMaterial({
    color: 0x58f1ff,
    transparent: true,
    opacity: 0.24,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }),
);
const beamCore = new THREE.Mesh(
  beamCoreGeometry,
  new THREE.MeshBasicMaterial({
    color: 0xe9ffff,
    transparent: true,
    opacity: 0.88,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }),
);
laserBeam.add(beamShell, beamCore);
laserBeam.visible = false;
scene.add(laserBeam);

const hitGlow = new THREE.Mesh(
  new THREE.SphereGeometry(0.5, 18, 12),
  new THREE.MeshBasicMaterial({
    color: 0xaff9ff,
    transparent: true,
    opacity: 0.72,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  }),
);
hitGlow.visible = false;
scene.add(hitGlow);

const ship = createShip();
scene.add(ship);

const engineLight = new THREE.PointLight(0x54d9ff, 4, 16);
engineLight.position.set(0, 0.35, 3);
ship.add(engineLight);

scene.add(new THREE.HemisphereLight(0x8edcff, 0x080b14, 1.05));

const sun = new THREE.DirectionalLight(0xfff0cf, 3.2);
sun.position.set(34, 38, 22);
scene.add(sun);

const rim = new THREE.DirectionalLight(0x7ee7ff, 1.5);
rim.position.set(-24, -8, -42);
scene.add(rim);

const starField = createStarField(2300, 620, 1.0);
const farStarField = createStarField(1500, 1100, 0.45);
scene.add(starField, farStarField);

const dust = createDustField(480);
scene.add(dust.points);

const nebula = createNebula();
scene.add(nebula);

setupEvents();
updateUpgradeUi();
showToast("Mining run active");
timer.reset();
requestAnimationFrame(animate);

function createShip() {
  const group = new THREE.Group();

  const hullMaterial = new THREE.MeshStandardMaterial({
    color: 0xd8f1ff,
    roughness: 0.42,
    metalness: 0.62,
  });
  const darkMaterial = new THREE.MeshStandardMaterial({
    color: 0x123044,
    roughness: 0.5,
    metalness: 0.5,
  });
  const glassMaterial = new THREE.MeshStandardMaterial({
    color: 0x86e8ff,
    emissive: 0x0b7f9a,
    emissiveIntensity: 0.46,
    roughness: 0.06,
    metalness: 0.02,
    transparent: true,
    opacity: 0.9,
  });
  const engineMaterial = new THREE.MeshBasicMaterial({
    color: 0x53e5ff,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
  });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 1.05, 3.3, 6), hullMaterial);
  body.rotation.x = Math.PI * 0.5;
  body.position.z = 0.18;
  group.add(body);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.82, 1.85, 7), hullMaterial);
  nose.rotation.x = -Math.PI * 0.5;
  nose.position.z = -2.25;
  group.add(nose);

  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.48, 24, 12), glassMaterial);
  cockpit.scale.set(0.78, 0.45, 1.18);
  cockpit.position.set(0, 0.45, -0.86);
  group.add(cockpit);

  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 2.35), darkMaterial);
  spine.position.set(0, -0.64, 0.15);
  group.add(spine);

  const wingGeometry = new THREE.BoxGeometry(2.2, 0.14, 1.15);
  const leftWing = new THREE.Mesh(wingGeometry, hullMaterial);
  leftWing.position.set(-1.42, -0.15, 0.38);
  leftWing.rotation.z = -0.22;
  leftWing.rotation.y = 0.28;
  group.add(leftWing);

  const rightWing = leftWing.clone();
  rightWing.position.x *= -1;
  rightWing.rotation.z *= -1;
  rightWing.rotation.y *= -1;
  group.add(rightWing);

  const finGeometry = new THREE.BoxGeometry(0.22, 1.05, 1.1);
  const topFin = new THREE.Mesh(finGeometry, darkMaterial);
  topFin.position.set(0, 0.78, 0.72);
  topFin.rotation.x = -0.25;
  group.add(topFin);

  const cannonGeometry = new THREE.CylinderGeometry(0.08, 0.11, 1.7, 10);
  const leftCannon = new THREE.Mesh(cannonGeometry, darkMaterial);
  leftCannon.rotation.x = Math.PI * 0.5;
  leftCannon.position.set(-0.38, -0.38, -1.55);
  group.add(leftCannon);

  const rightCannon = leftCannon.clone();
  rightCannon.position.x *= -1;
  group.add(rightCannon);

  const engineGeometry = new THREE.CylinderGeometry(0.32, 0.42, 0.8, 18);
  const leftEngine = new THREE.Mesh(engineGeometry, darkMaterial);
  leftEngine.rotation.x = Math.PI * 0.5;
  leftEngine.position.set(-0.48, -0.08, 1.95);
  group.add(leftEngine);

  const rightEngine = leftEngine.clone();
  rightEngine.position.x *= -1;
  group.add(rightEngine);

  const flameGeometry = new THREE.ConeGeometry(0.34, 1.1, 18);
  const leftFlame = new THREE.Mesh(flameGeometry, engineMaterial);
  leftFlame.rotation.x = Math.PI * 0.5;
  leftFlame.position.set(-0.48, -0.08, 2.74);
  leftFlame.name = "engineFlame";
  group.add(leftFlame);

  const rightFlame = leftFlame.clone();
  rightFlame.position.x *= -1;
  group.add(rightFlame);

  group.scale.setScalar(0.92);
  return group;
}

function createStarField(count, radius, brightness) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const color = new THREE.Color();

  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3;
    positions[i3] = randomRange(-radius, radius);
    positions[i3 + 1] = randomRange(-radius * 0.6, radius * 0.6);
    positions[i3 + 2] = randomRange(-radius, radius);

    const warmth = Math.random();
    color.setHSL(0.55 + warmth * 0.12, 0.35 + Math.random() * 0.35, brightness);
    colors[i3] = color.r;
    colors[i3 + 1] = color.g;
    colors[i3 + 2] = color.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      size: brightness > 0.9 ? 1.15 : 0.78,
      vertexColors: true,
      transparent: true,
      opacity: brightness > 0.9 ? 0.92 : 0.52,
      depthWrite: false,
    }),
  );
}

function createDustField(count) {
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  const color = new THREE.Color(0xb5efff);

  for (let i = 0; i < count; i += 1) {
    resetDustParticle(positions, speeds, i, true);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  return {
    points: new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color,
        size: 0.12,
        transparent: true,
        opacity: 0.44,
        depthWrite: false,
      }),
    ),
    positions,
    speeds,
  };
}

function resetDustParticle(positions, speeds, index, scatter) {
  const i3 = index * 3;
  positions[i3] = randomRange(-80, 80);
  positions[i3 + 1] = randomRange(-48, 48);
  positions[i3 + 2] = scatter ? randomRange(-280, 50) : randomRange(-300, -240);
  speeds[index] = randomRange(8, 42);
}

function createNebula() {
  const group = new THREE.Group();
  const palettes = [0x144861, 0x4b2462, 0x59631d, 0x17493f];

  for (let i = 0; i < 32; i += 1) {
    const material = new THREE.MeshBasicMaterial({
      color: palettes[i % palettes.length],
      transparent: true,
      opacity: randomRange(0.018, 0.045),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(randomRange(16, 42), 18, 12), material);
    mesh.position.set(randomRange(-230, 230), randomRange(-120, 130), randomRange(-520, 80));
    mesh.scale.set(randomRange(1.4, 3.8), randomRange(0.4, 1.2), randomRange(0.5, 1.6));
    group.add(mesh);
  }

  return group;
}

function createAsteroidGeometry(radius, seed) {
  const geometry = new THREE.IcosahedronGeometry(radius, 3);
  const position = geometry.attributes.position;
  const vertex = new THREE.Vector3();

  for (let i = 0; i < position.count; i += 1) {
    vertex.fromBufferAttribute(position, i);
    const normal = vertex.clone().normalize();
    const ridge =
      hashNoise(normal.x * 4.1, normal.y * 3.8, normal.z * 4.6, seed) * 0.34 +
      hashNoise(normal.x * 9.5, normal.y * 8.4, normal.z * 9.1, seed + 17) * 0.16;
    vertex.copy(normal.multiplyScalar(radius * (0.78 + ridge)));
    position.setXYZ(i, vertex.x, vertex.y, vertex.z);
  }

  geometry.computeVertexNormals();
  return geometry;
}

function spawnAsteroid(z) {
  const radius = randomRange(1.8, 5.8);
  const seed = Math.random() * 10000;
  const geometry = createAsteroidGeometry(radius, seed);
  const baseMaterial = asteroidMaterials[Math.floor(Math.random() * asteroidMaterials.length)];
  const material = baseMaterial.clone();
  const mesh = new THREE.Mesh(geometry, material);

  mesh.position.set(randomRange(-bounds.x, bounds.x), randomRange(-bounds.y, bounds.y), z);
  mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  scene.add(mesh);

  const hp = radius * 14 + 18;
  asteroids.push({
    mesh,
    radius,
    hp,
    maxHp: hp,
    spin: new THREE.Vector3(randomRange(-0.55, 0.55), randomRange(-0.5, 0.5), randomRange(-0.45, 0.45)),
    drift: new THREE.Vector3(randomRange(-0.22, 0.22), randomRange(-0.18, 0.18), 0),
    hot: 0,
  });
}

function spawnGems(position, count, asteroidRadius) {
  for (let i = 0; i < count; i += 1) {
    const material = gemMaterials[Math.floor(Math.random() * gemMaterials.length)];
    const mesh = new THREE.Mesh(gemGeometry, material);
    const offset = randomUnitVector().multiplyScalar(randomRange(0.3, asteroidRadius * 0.42));
    mesh.position.copy(position).add(offset);
    const scale = randomRange(0.72, 1.18);
    mesh.scale.setScalar(scale);
    scene.add(mesh);

    gems.push({
      mesh,
      velocity: randomUnitVector().multiplyScalar(randomRange(1.8, 5.4)),
      spin: new THREE.Vector3(randomRange(-2.4, 2.4), randomRange(-2.8, 2.8), randomRange(-2.2, 2.2)),
      value: Math.random() > 0.86 ? 2 : 1,
      age: 0,
      vacuumed: false,
    });
  }
}

function spawnSpark(position, color, count, power = 1) {
  const cap = Math.min(count, 18);
  for (let i = 0; i < cap; i += 1) {
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.82,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(sparkGeometry, material);
    mesh.position.copy(position);
    const size = randomRange(0.42, 1.2) * power;
    mesh.scale.setScalar(size);
    scene.add(mesh);

    particles.push({
      mesh,
      velocity: randomUnitVector().multiplyScalar(randomRange(5, 17) * power),
      life: randomRange(0.28, 0.78),
      maxLife: 0,
    });
    particles[particles.length - 1].maxLife = particles[particles.length - 1].life;
  }
}

function setupEvents() {
  window.addEventListener("resize", resize);
  window.addEventListener("keydown", (event) => {
    if ([" ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
      event.preventDefault();
    }
    const key = event.key.toLowerCase();
    if ((key === " " || key === "f") && !keys.has(key)) {
      pointer.fireLatch = Math.max(pointer.fireLatch, tapLaserPulse);
    }
    keys.add(key);
  });
  window.addEventListener("keyup", (event) => {
    keys.delete(event.key.toLowerCase());
  });

  canvas.addEventListener("pointermove", (event) => {
    updatePointer(event);
  });
  canvas.addEventListener("pointerdown", (event) => {
    updatePointer(event);
    pointer.firing = true;
    pointer.fireLatch = Math.max(pointer.fireLatch, tapLaserPulse);
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointerup", (event) => {
    pointer.firing = false;
    canvas.releasePointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointercancel", () => {
    pointer.firing = false;
  });

  ui.buttons.forEach((button) => {
    button.addEventListener("click", () => {
      buyUpgrade(button.dataset.upgrade);
    });
  });
}

function updatePointer(event) {
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  pointer.ndc.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.ndc.y = -(event.clientY / window.innerHeight) * 2 + 1;
  pointer.lastMove = performance.now();
}

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

function animate(timestamp) {
  timer.update(timestamp);
  const dt = Math.min(timer.getDelta(), 0.045);
  const time = timer.getElapsed();

  updatePlayer(dt, time);
  updateSpawning();
  updateAsteroids(dt);
  updateGems(dt, time);
  updateParticles(dt);
  updateLaser(dt, time);
  updateEnvironment(dt, time);
  updateCamera(dt);
  updateUi(time);

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function updatePlayer(dt, time) {
  const speedLevel = game.upgrades.speed;
  player.forwardSpeed = 19 + speedLevel * 4.2;
  const lateralAccel = 34 + speedLevel * 4.5;
  const damping = Math.pow(0.035, dt);

  const inputX =
    (keys.has("d") || keys.has("arrowright") ? 1 : 0) -
    (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
  const inputY =
    (keys.has("w") || keys.has("arrowup") ? 1 : 0) -
    (keys.has("s") || keys.has("arrowdown") ? 1 : 0);

  player.velocity.x += inputX * lateralAccel * dt;
  player.velocity.y += inputY * lateralAccel * dt;

  const pointerFresh = performance.now() - pointer.lastMove < 1700;
  if (pointerFresh) {
    const targetX = pointer.ndc.x * bounds.x * 0.72;
    const targetY = pointer.ndc.y * bounds.y * 0.68;
    player.velocity.x += (targetX - player.position.x) * 3.5 * dt;
    player.velocity.y += (targetY - player.position.y) * 3.5 * dt;
  }

  player.velocity.x *= damping;
  player.velocity.y *= damping;
  player.velocity.z = -player.forwardSpeed;

  player.position.addScaledVector(player.velocity, dt);
  player.position.x = THREE.MathUtils.clamp(player.position.x, -bounds.x, bounds.x);
  player.position.y = THREE.MathUtils.clamp(player.position.y, -bounds.y, bounds.y);

  const bank = THREE.MathUtils.clamp(-player.velocity.x * 0.035, -0.58, 0.58);
  const pitch = THREE.MathUtils.clamp(player.velocity.y * 0.025, -0.35, 0.35);
  ship.position.copy(player.position);
  ship.rotation.z = THREE.MathUtils.lerp(ship.rotation.z, bank, 0.12);
  ship.rotation.x = THREE.MathUtils.lerp(ship.rotation.x, pitch, 0.1);
  ship.rotation.y = THREE.MathUtils.lerp(ship.rotation.y, -bank * 0.24, 0.1);

  ship.traverse((child) => {
    if (child.name === "engineFlame") {
      const pulse = 0.9 + Math.sin(time * 18 + child.position.x) * 0.16;
      child.scale.set(1, pulse, 1 + player.forwardSpeed * 0.012);
    }
  });

  game.distance = Math.max(game.distance, Math.abs(player.position.z) * 0.08);
}

function updateSpawning() {
  while (nextAsteroidZ > player.position.z - 430) {
    spawnAsteroid(nextAsteroidZ);
    nextAsteroidZ -= randomRange(14, 32);
  }
}

function updateAsteroids(dt) {
  for (let i = asteroids.length - 1; i >= 0; i -= 1) {
    const asteroid = asteroids[i];
    asteroid.mesh.rotation.x += asteroid.spin.x * dt;
    asteroid.mesh.rotation.y += asteroid.spin.y * dt;
    asteroid.mesh.rotation.z += asteroid.spin.z * dt;
    asteroid.mesh.position.addScaledVector(asteroid.drift, dt);

    if (asteroid.hot > 0) {
      asteroid.hot = Math.max(0, asteroid.hot - dt * 2.4);
      asteroid.mesh.material.emissive = new THREE.Color(0xff7b3d);
      asteroid.mesh.material.emissiveIntensity = asteroid.hot * 0.7;
    } else {
      asteroid.mesh.material.emissiveIntensity = 0;
    }

    if (asteroid.mesh.position.z > player.position.z + 42) {
      scene.remove(asteroid.mesh);
      asteroid.mesh.geometry.dispose();
      asteroid.mesh.material.dispose();
      asteroids.splice(i, 1);
    }
  }
}

function updateGems(dt, time) {
  for (let i = gems.length - 1; i >= 0; i -= 1) {
    const gem = gems[i];
    gem.age += dt;
    gem.mesh.rotation.x += gem.spin.x * dt;
    gem.mesh.rotation.y += gem.spin.y * dt;
    gem.mesh.rotation.z += gem.spin.z * dt;

    const toPlayer = reusable.vecA.copy(player.position).sub(gem.mesh.position);
    const distance = toPlayer.length();
    const attractRadius = 8 + game.upgrades.speed * 0.8;

    if (gem.vacuumed || distance < attractRadius) {
      const pullStrength = gem.vacuumed
        ? Math.min(160, 46 + distance * 2.6)
        : (attractRadius - distance) * 18;
      const pull = toPlayer.normalize().multiplyScalar(pullStrength * dt);
      gem.velocity.add(pull);
    }

    if (gem.vacuumed && gem.velocity.lengthSq() > 4900) {
      gem.velocity.setLength(70);
    }

    gem.velocity.multiplyScalar(Math.pow(gem.vacuumed ? 0.88 : 0.72, dt));
    gem.mesh.position.addScaledVector(gem.velocity, dt);
    gem.mesh.position.z += player.forwardSpeed * (gem.vacuumed ? 0.38 : 0.18) * dt;
    gem.mesh.scale.setScalar((gem.value === 2 ? 1.18 : 1) * (1 + Math.sin(time * 6 + gem.age) * 0.06));

    if (gem.mesh.position.distanceTo(player.position) < 1.75) {
      game.gems += gem.value;
      spawnSpark(gem.mesh.position, 0xb9ff6a, 5, 0.45);
      scene.remove(gem.mesh);
      gems.splice(i, 1);
      updateUpgradeUi();
      continue;
    }

    if ((!gem.vacuumed && gem.mesh.position.z > player.position.z + 34) || gem.age > (gem.vacuumed ? 45 : 22)) {
      scene.remove(gem.mesh);
      gems.splice(i, 1);
    }
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const particle = particles[i];
    particle.life -= dt;
    particle.velocity.multiplyScalar(Math.pow(0.58, dt));
    particle.mesh.position.addScaledVector(particle.velocity, dt);
    particle.mesh.scale.multiplyScalar(Math.pow(0.18, dt));
    particle.mesh.material.opacity = Math.max(0, particle.life / particle.maxLife) * 0.82;

    if (particle.life <= 0) {
      scene.remove(particle.mesh);
      particle.mesh.material.dispose();
      particles.splice(i, 1);
    }
  }
}

function updateLaser(dt, time) {
  pointer.fireLatch = Math.max(0, pointer.fireLatch - dt);
  const wantsFire = pointer.firing || pointer.fireLatch > 0 || keys.has(" ") || keys.has("f");
  const durationLevel = game.upgrades.duration;
  const strengthLevel = game.upgrades.strength;
  game.energyMax = 92 + durationLevel * 28;
  const drainRate = Math.max(12, 35 - durationLevel * 1.7);
  const rechargeRate = wantsFire ? 0 : 24 + durationLevel * 3;
  game.firing = wantsFire && game.energy > 0.8;

  if (game.firing) {
    game.energy = Math.max(0, game.energy - drainRate * dt);
  } else {
    game.energy = Math.min(game.energyMax, game.energy + rechargeRate * dt);
  }

  if (!game.firing) {
    laserBeam.visible = false;
    hitGlow.visible = false;
    return;
  }

  raycaster.setFromCamera(pointer.ndc, camera);
  const origin = reusable.vecA.set(0, -0.12, -2.25);
  ship.localToWorld(origin);
  const targetFromCamera = reusable.vecB
    .copy(raycaster.ray.direction)
    .multiplyScalar(140)
    .add(raycaster.ray.origin);
  const direction = reusable.vecC.copy(targetFromCamera).sub(origin).normalize();
  const range = 66 + strengthLevel * 7;
  const hit = traceAsteroid(origin, direction, range);
  let beamEnd = targetFromCamera.copy(direction).multiplyScalar(range).add(origin);

  if (hit) {
    beamEnd = hit.point;
    const damage = (40 + strengthLevel * 20) * dt;
    hit.asteroid.hp -= damage;
    hit.asteroid.hot = 1;
    hit.asteroid.mesh.scale.setScalar(1 + Math.sin(time * 24) * 0.012);
    hitGlow.visible = true;
    hitGlow.position.copy(hit.point);
    hitGlow.scale.setScalar(0.7 + strengthLevel * 0.09 + Math.sin(time * 18) * 0.12);

    game.laserPulse += dt;
    if (game.laserPulse > 0.045) {
      game.laserPulse = 0;
      spawnSpark(hit.point, 0x7fffff, 2, 0.36);
    }

    if (hit.asteroid.hp <= 0) {
      destroyAsteroid(hit.asteroid);
    }
  } else {
    hitGlow.visible = false;
  }

  updateBeam(origin, beamEnd, strengthLevel, time);
}

function traceAsteroid(origin, direction, range) {
  let best = null;
  let bestT = Infinity;
  const laserRadius = 0.25 + game.upgrades.strength * 0.06;

  for (const asteroid of asteroids) {
    const toAsteroid = reusable.vecD.copy(asteroid.mesh.position).sub(origin);
    const t = toAsteroid.dot(direction);
    if (t < 0 || t > range || t > bestT) {
      continue;
    }

    const closest = reusable.vecE.copy(direction).multiplyScalar(t).add(origin);
    const distance = closest.distanceTo(asteroid.mesh.position);
    if (distance <= asteroid.radius + laserRadius) {
      bestT = t;
      best = {
        asteroid,
        point: closest.clone(),
      };
    }
  }

  return best;
}

function updateBeam(origin, end, strengthLevel, time) {
  const mid = reusable.vecD.copy(origin).lerp(end, 0.5);
  const direction = reusable.vecE.copy(end).sub(origin);
  const length = direction.length();

  laserBeam.visible = true;
  laserBeam.position.copy(mid);
  reusable.quat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  laserBeam.quaternion.copy(reusable.quat);
  laserBeam.scale.set(1 + strengthLevel * 0.15, length, 1 + strengthLevel * 0.15);

  beamShell.material.opacity = 0.2 + Math.sin(time * 31) * 0.045;
  beamCore.material.opacity = 0.78 + Math.sin(time * 45) * 0.12;
}

function destroyAsteroid(asteroid) {
  const index = asteroids.indexOf(asteroid);
  if (index === -1) {
    return;
  }

  const position = asteroid.mesh.position.clone();
  const dropCount = Math.floor(randomRange(3, 7) + asteroid.radius * 0.6);
  spawnGems(position, dropCount, asteroid.radius);
  spawnSpark(position, 0xffc65a, 16, Math.min(1.4, asteroid.radius * 0.28));
  vacuumAllGems();

  scene.remove(asteroid.mesh);
  asteroid.mesh.geometry.dispose();
  asteroid.mesh.material.dispose();
  asteroids.splice(index, 1);
}

function vacuumAllGems() {
  for (const gem of gems) {
    gem.vacuumed = true;
    const toPlayer = reusable.vecA.copy(player.position).sub(gem.mesh.position);
    if (toPlayer.lengthSq() > 0.001) {
      gem.velocity.add(toPlayer.normalize().multiplyScalar(18));
    }
  }
}

function updateEnvironment(dt, time) {
  starField.position.copy(player.position).multiplyScalar(0.05);
  farStarField.position.copy(player.position).multiplyScalar(0.02);
  nebula.position.z = player.position.z * 0.13;
  nebula.rotation.y = Math.sin(time * 0.025) * 0.04;

  dust.points.position.copy(player.position);
  const positions = dust.positions;
  for (let i = 0; i < dust.speeds.length; i += 1) {
    const i3 = i * 3;
    positions[i3 + 2] += (dust.speeds[i] + player.forwardSpeed * 1.7) * dt;
    if (positions[i3 + 2] > 70) {
      resetDustParticle(positions, dust.speeds, i, false);
      nextDustRecycle += 1;
    }
  }

  dust.points.geometry.attributes.position.needsUpdate = true;
  nextDustRecycle = 0;
}

function updateCamera(dt) {
  const desired = reusable.vecA.set(
    player.position.x * 0.32,
    player.position.y * 0.32 + 5.2,
    player.position.z + 14.5,
  );
  camera.position.lerp(desired, 1 - Math.pow(0.006, dt));

  const lookAt = reusable.vecB.set(
    player.position.x * 0.58,
    player.position.y * 0.52,
    player.position.z - 28,
  );
  camera.lookAt(lookAt);
}

function updateUi(time) {
  const energyPct = game.energyMax > 0 ? game.energy / game.energyMax : 0;
  ui.gems.textContent = String(game.gems);
  ui.range.textContent = `${Math.floor(game.distance)} km`;
  ui.speed.textContent = Math.round(player.forwardSpeed).toString();
  ui.energyValue.textContent = `${Math.max(0, Math.round(energyPct * 100))}%`;
  ui.energyFill.style.transform = `scaleX(${THREE.MathUtils.clamp(energyPct, 0, 1)})`;

  if (game.firing) {
    ui.energyFill.style.background = "linear-gradient(90deg, var(--rose), var(--cyan))";
  } else {
    ui.energyFill.style.background = "linear-gradient(90deg, var(--cyan), var(--lime))";
  }

  const reticleX = THREE.MathUtils.clamp(pointer.x, 20, window.innerWidth - 20);
  const reticleY = THREE.MathUtils.clamp(pointer.y, 20, window.innerHeight - 20);
  ui.reticle.style.left = `${reticleX}px`;
  ui.reticle.style.top = `${reticleY}px`;
  ui.reticle.style.transform = game.firing
    ? "translate(-50%, -50%) scale(0.82)"
    : "translate(-50%, -50%) scale(1)";

  if (ui.toast.classList.contains("visible") && time - game.lastToastAt > 2) {
    ui.toast.classList.remove("visible");
  }
}

function updateUpgradeUi() {
  const costs = getUpgradeCosts();
  ui.meta.speed.textContent = `Lv ${game.upgrades.speed} - ${costs.speed}`;
  ui.meta.strength.textContent = `Lv ${game.upgrades.strength} - ${costs.strength}`;
  ui.meta.duration.textContent = `Lv ${game.upgrades.duration} - ${costs.duration}`;

  ui.buttons.forEach((button) => {
    const key = button.dataset.upgrade;
    button.disabled = game.gems < costs[key];
  });
}

function buyUpgrade(type) {
  const costs = getUpgradeCosts();
  const cost = costs[type];
  if (game.gems < cost) {
    showToast("More gems needed");
    return;
  }

  game.gems -= cost;
  game.upgrades[type] += 1;

  if (type === "duration") {
    game.energyMax = 92 + game.upgrades.duration * 28;
    game.energy = Math.min(game.energyMax, game.energy + 34);
  }

  const names = {
    speed: "Flight speed upgraded",
    strength: "Laser strength upgraded",
    duration: "Laser duration upgraded",
  };
  showToast(names[type]);
  updateUpgradeUi();
}

function getUpgradeCosts() {
  return {
    speed: Math.floor(8 * Math.pow(game.upgrades.speed, 1.48)),
    strength: Math.floor(10 * Math.pow(game.upgrades.strength, 1.52)),
    duration: Math.floor(12 * Math.pow(game.upgrades.duration, 1.5)),
  };
}

function showToast(message) {
  ui.toast.textContent = message;
  ui.toast.classList.add("visible");
  game.lastToastAt = timer.getElapsed();
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function randomUnitVector() {
  const z = randomRange(-1, 1);
  const angle = Math.random() * Math.PI * 2;
  const radius = Math.sqrt(1 - z * z);
  return new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, z);
}

function hashNoise(x, y, z, seed) {
  const value = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed * 0.113) * 43758.5453;
  return value - Math.floor(value);
}
