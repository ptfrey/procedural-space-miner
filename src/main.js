import * as THREE from "three";
import {
  applyGoldenUpgrade,
  createDefaultPerks,
  getGoldenUpgradeChoices,
  GOLDEN_ASTEROID_BASE_CHANCE,
} from "./game/golden-upgrades.js";
import {
  createAsteroidGeometry,
  createDustField,
  createNebula,
  createShip,
  createStarField,
  resetDustParticle,
} from "./game/procedural.js";
import {
  getUpgradeCosts,
  getUiElements,
  hideGoldenChoice,
  showGoldenChoice,
  showToast,
  updateUi,
  updateUpgradeUi,
} from "./game/ui.js";
import { randomRange, randomUnitVector } from "./utils/random.js";
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

const ui = getUiElements();

const game = {
  gems: 0,
  distance: 0,
  energy: 120,
  energyMax: 120,
  firing: false,
  paused: false,
  lastToastAt: 0,
  laserPulse: 0,
  goldenUpgradeLevels: {},
  perks: createDefaultPerks(),
  upgrades: {
    speed: 1,
    strength: 1,
    duration: 1,
  },
};

const keys = new Set();
const tapLaserPulse = 0.42;
const laserAimDistance = 260;
const laserBaseRange = 145;
const laserRangePerStrength = 18;
const droneRange = 132;
const droneBaseDamage = 18;
const gemAirtimeBoostDelay = 0.45;
const gemAirtimeBoostRate = 0.3;
const gemAirtimeBoostMax = 3.2;
const gemTrailDistance = 5.8;
const gemTrailApproachDistance = 9.5;
const gemTrailBrake = 0.16;
const rocketLaunchInterval = 3.6;
const rocketRange = 190;
const rocketSpeed = 76;
const rocketTurnRate = 5.8;
const rocketBlastRadius = 10.5;
const rocketBlastDamage = 86;
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
  forwardSpeed: 22,
};

const asteroids = [];
const gems = [];
const particles = [];
const drones = [];
const rockets = [];
let nextAsteroidZ = -34;
let rocketCooldown = 1.4;

const reusable = {
  vecA: new THREE.Vector3(),
  vecB: new THREE.Vector3(),
  vecC: new THREE.Vector3(),
  vecD: new THREE.Vector3(),
  vecE: new THREE.Vector3(),
  quat: new THREE.Quaternion(),
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

const goldenAsteroidMaterial = new THREE.MeshStandardMaterial({
  color: 0xffc65a,
  emissive: 0x8a4c08,
  emissiveIntensity: 0.68,
  roughness: 0.5,
  metalness: 0.38,
  flatShading: true,
});

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
const droneBeamGeometry = new THREE.CylinderGeometry(0.025, 0.045, 1, 12, 1, true);
const droneCoreGeometry = new THREE.CylinderGeometry(0.012, 0.02, 1, 10, 1, true);
const droneBodyGeometry = new THREE.OctahedronGeometry(0.48, 0);
const droneWingGeometry = new THREE.BoxGeometry(0.86, 0.08, 0.28);
const rocketBodyGeometry = new THREE.CylinderGeometry(0.11, 0.16, 1.05, 10);
const rocketNoseGeometry = new THREE.ConeGeometry(0.16, 0.38, 10);
const rocketFinGeometry = new THREE.BoxGeometry(0.34, 0.05, 0.18);
const droneBodyMaterial = new THREE.MeshStandardMaterial({
  color: 0xd8f1ff,
  emissive: 0x0a5f7a,
  emissiveIntensity: 0.28,
  roughness: 0.34,
  metalness: 0.62,
  flatShading: true,
});
const droneAccentMaterial = new THREE.MeshBasicMaterial({
  color: 0x5fe6ff,
  transparent: true,
  opacity: 0.9,
  blending: THREE.AdditiveBlending,
});
const rocketBodyMaterial = new THREE.MeshStandardMaterial({
  color: 0xf6f2e8,
  roughness: 0.38,
  metalness: 0.42,
});
const rocketFlameMaterial = new THREE.MeshBasicMaterial({
  color: 0xff7dad,
  transparent: true,
  opacity: 0.86,
  blending: THREE.AdditiveBlending,
});

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
updateUpgradeUi(ui, game);
showToast(ui, game, timer.getElapsed(), "Mining run active");
timer.reset();
requestAnimationFrame(animate);

function spawnAsteroid(z) {
  const radius = randomRange(1.8, 5.8);
  const seed = Math.random() * 10000;
  const geometry = createAsteroidGeometry(radius, seed);
  const goldenChance = Math.min(0.2, GOLDEN_ASTEROID_BASE_CHANCE * game.perks.goldenChanceMultiplier);
  const golden = Math.random() < goldenChance;
  const baseMaterial = golden
    ? goldenAsteroidMaterial
    : asteroidMaterials[Math.floor(Math.random() * asteroidMaterials.length)];
  const material = baseMaterial.clone();
  const mesh = new THREE.Mesh(geometry, material);
  const hitRadius = geometry.boundingSphere.radius * (golden ? 1.18 : 1.12);

  mesh.position.set(randomRange(-bounds.x, bounds.x), randomRange(-bounds.y, bounds.y), z);
  mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  if (golden) {
    const aura = new THREE.Mesh(
      new THREE.SphereGeometry(hitRadius * 1.08, 18, 12),
      new THREE.MeshBasicMaterial({
        color: 0xffd46c,
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    aura.name = "goldenAura";
    mesh.add(aura);
  }

  scene.add(mesh);

  const hp = (radius * 14 + 18) * (golden ? 1.18 : 1);
  asteroids.push({
    mesh,
    radius,
    hitRadius,
    golden,
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
      value: (Math.random() > 0.86 ? 2 : 1) + game.perks.gemValueBonus,
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
    if (game.paused) {
      return;
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
    if (game.paused) {
      return;
    }
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

  if (game.paused) {
    game.firing = false;
    pointer.firing = false;
    pointer.fireLatch = 0;
    laserBeam.visible = false;
    hitGlow.visible = false;
  } else {
    updatePlayer(dt, time);
    updateSpawning();
    updateAsteroids(dt, time);
    updateGems(dt, time);
    updateParticles(dt);
    updateLaser(dt, time);
    updateDrones(dt, time);
    updateRockets(dt, time);
    updateEnvironment(dt, time);
    updateCamera(dt);
  }

  updateUi({ ui, game, player, pointer, time });

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function updatePlayer(dt, time) {
  const speedLevel = game.upgrades.speed;
  player.forwardSpeed = 19 + speedLevel * 4.2;
  const lateralAccel = (34 + speedLevel * 4.5) * game.perks.steeringMultiplier;
  const damping = Math.pow(0.035, dt);
  const currentBounds = {
    x: bounds.x * game.perks.boundScale,
    y: bounds.y * game.perks.boundScale,
  };

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
    const targetX = pointer.ndc.x * currentBounds.x * 0.72;
    const targetY = pointer.ndc.y * currentBounds.y * 0.68;
    player.velocity.x += (targetX - player.position.x) * 3.5 * dt;
    player.velocity.y += (targetY - player.position.y) * 3.5 * dt;
  }

  player.velocity.x *= damping;
  player.velocity.y *= damping;
  player.velocity.z = -player.forwardSpeed;

  player.position.addScaledVector(player.velocity, dt);
  player.position.x = THREE.MathUtils.clamp(player.position.x, -currentBounds.x, currentBounds.x);
  player.position.y = THREE.MathUtils.clamp(player.position.y, -currentBounds.y, currentBounds.y);

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

function updateAsteroids(dt, time) {
  for (let i = asteroids.length - 1; i >= 0; i -= 1) {
    const asteroid = asteroids[i];
    asteroid.mesh.rotation.x += asteroid.spin.x * dt;
    asteroid.mesh.rotation.y += asteroid.spin.y * dt;
    asteroid.mesh.rotation.z += asteroid.spin.z * dt;
    asteroid.mesh.position.addScaledVector(asteroid.drift, dt);

    if (asteroid.golden) {
      asteroid.hot = Math.max(0, asteroid.hot - dt * 2.4);
      asteroid.mesh.material.emissiveIntensity = 0.55 + Math.sin(time * 4.4 + asteroid.radius) * 0.16 + asteroid.hot * 0.55;
      const aura = asteroid.mesh.getObjectByName("goldenAura");
      if (aura) {
        aura.material.opacity = 0.14 + Math.sin(time * 5.8 + asteroid.radius) * 0.035;
      }
    } else if (asteroid.hot > 0) {
      asteroid.hot = Math.max(0, asteroid.hot - dt * 2.4);
      asteroid.mesh.material.emissive = new THREE.Color(0xff7b3d);
      asteroid.mesh.material.emissiveIntensity = asteroid.hot * 0.7;
    } else {
      asteroid.mesh.material.emissiveIntensity = 0;
    }

    if (asteroid.mesh.position.z > player.position.z + 42) {
      scene.remove(asteroid.mesh);
      disposeObject(asteroid.mesh);
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
    const attractRadius = (8 + game.upgrades.speed * 0.8) * game.perks.collectorRadiusMultiplier;
    const airtimeBoost =
      1 + Math.min(gemAirtimeBoostMax - 1, Math.max(0, gem.age - gemAirtimeBoostDelay) * gemAirtimeBoostRate);
    const trailBlend = gem.vacuumed
      ? THREE.MathUtils.clamp((distance - 1.9) / gemTrailApproachDistance, 0, 1)
      : 0;
    const pullTarget = reusable.vecB.copy(player.position);
    pullTarget.z += gemTrailDistance * trailBlend;
    const toPullTarget = reusable.vecC.copy(pullTarget).sub(gem.mesh.position);
    const pullDistance = toPullTarget.length();

    if (gem.vacuumed || distance < attractRadius) {
      const basePullStrength = gem.vacuumed
        ? Math.min(
            142 * game.perks.vacuumSpeedMultiplier,
            (34 + pullDistance * 2.15) * game.perks.vacuumSpeedMultiplier,
          )
        : (attractRadius - distance) * 18;
      const pullStrength = basePullStrength * airtimeBoost;
      if (pullDistance > 0.001) {
        const pull = toPullTarget.normalize().multiplyScalar(pullStrength * dt);
        gem.velocity.add(pull);
      }
    }

    const vacuumSpeedLimit = 70 * game.perks.vacuumSpeedMultiplier * airtimeBoost;
    if (gem.vacuumed && gem.velocity.lengthSq() > vacuumSpeedLimit * vacuumSpeedLimit) {
      gem.velocity.setLength(vacuumSpeedLimit);
    }

    if (gem.vacuumed && gem.mesh.position.z > player.position.z + gemTrailDistance && gem.velocity.z > 0) {
      gem.velocity.z *= Math.pow(gemTrailBrake, dt);
    }

    gem.velocity.multiplyScalar(Math.pow(gem.vacuumed ? 0.88 : 0.72, dt));
    gem.mesh.position.addScaledVector(gem.velocity, dt);
    gem.mesh.position.z += player.forwardSpeed * (gem.vacuumed ? 0.16 : 0.18) * dt;
    gem.mesh.scale.setScalar((gem.value === 2 ? 1.18 : 1) * (1 + Math.sin(time * 6 + gem.age) * 0.06));

    if (gem.mesh.position.distanceTo(player.position) < 1.75 * game.perks.collectorRadiusMultiplier) {
      game.gems += gem.value;
      spawnSpark(gem.mesh.position, 0xb9ff6a, 5, 0.45);
      scene.remove(gem.mesh);
      gems.splice(i, 1);
      updateUpgradeUi(ui, game);
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

function syncDrones() {
  while (drones.length < game.perks.combatDroneCount) {
    const drone = createDrone(drones.length);
    drones.push(drone);
    scene.add(drone.group, drone.beam);
  }
}

function createDrone(index) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(droneBodyGeometry, droneBodyMaterial);
  body.rotation.y = Math.PI * 0.25;
  group.add(body);

  const wing = new THREE.Mesh(droneWingGeometry, droneBodyMaterial);
  wing.position.y = -0.05;
  group.add(wing);

  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), droneAccentMaterial);
  eye.position.set(0, 0.1, -0.45);
  group.add(eye);

  const beam = new THREE.Group();
  beam.add(
    new THREE.Mesh(
      droneBeamGeometry,
      new THREE.MeshBasicMaterial({
        color: 0x5fe6ff,
        transparent: true,
        opacity: 0.26,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    ),
    new THREE.Mesh(
      droneCoreGeometry,
      new THREE.MeshBasicMaterial({
        color: 0xf2ffff,
        transparent: true,
        opacity: 0.82,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    ),
  );
  beam.visible = false;

  return {
    group,
    beam,
    index,
    sparkTimer: Math.random() * 0.12,
  };
}

function updateDrones(dt, time) {
  syncDrones();

  for (const drone of drones) {
    const orbitSpacing = (Math.PI * 2) / Math.max(1, drones.length);
    const orbitAngle = time * 1.35 + drone.index * orbitSpacing;
    const desired = reusable.vecD.set(
      player.position.x + Math.cos(orbitAngle) * 3.3,
      player.position.y + 1.1 + Math.sin(time * 1.9 + drone.index) * 0.75,
      player.position.z + 1.8 + Math.sin(orbitAngle) * 1.4,
    );

    drone.group.position.lerp(desired, 1 - Math.pow(0.002, dt));
    drone.group.rotation.y = -orbitAngle + Math.PI * 0.5;
    drone.group.rotation.z = Math.sin(time * 3 + drone.index) * 0.18;

    const target = findDroneTarget(drone.group.position);
    if (!target) {
      drone.beam.visible = false;
      continue;
    }

    const origin = reusable.vecA.copy(drone.group.position);
    const hitPoint = reusable.vecB.copy(target.mesh.position);
    const toTarget = reusable.vecC.copy(hitPoint).sub(origin);
    if (toTarget.lengthSq() > 0.001) {
      const surfaceOffset = Math.min(target.hitRadius * 0.65, toTarget.length() * 0.35);
      hitPoint.add(toTarget.normalize().multiplyScalar(-surfaceOffset));
    }

    drone.group.lookAt(target.mesh.position);
    setBeamBetween(drone.beam, origin, hitPoint, 1);
    drone.beam.visible = true;

    const damage = (droneBaseDamage + game.upgrades.strength * 3.5) * dt;
    target.hp -= damage;
    target.hot = 1;
    drone.sparkTimer += dt;
    if (drone.sparkTimer > 0.12) {
      drone.sparkTimer = 0;
      spawnSpark(hitPoint, 0x5fe6ff, 1, 0.28);
    }

    if (target.hp <= 0) {
      drone.beam.visible = false;
      destroyAsteroid(target);
    }
  }
}

function findDroneTarget(dronePosition) {
  let best = null;
  let bestScore = Infinity;
  const maxRange = droneRange + game.upgrades.strength * 8;

  for (const asteroid of asteroids) {
    const distance = dronePosition.distanceTo(asteroid.mesh.position);
    const ahead = asteroid.mesh.position.z < player.position.z + 18;
    if (!ahead || distance > maxRange) {
      continue;
    }

    const score = distance + Math.max(0, asteroid.mesh.position.z - player.position.z) * 3;
    if (score < bestScore) {
      bestScore = score;
      best = asteroid;
    }
  }

  return best;
}

function updateRockets(dt, time) {
  if (game.perks.rocketSalvo > 0) {
    rocketCooldown -= dt;
    if (rocketCooldown <= 0) {
      launchRocketSalvo(time);
      rocketCooldown = Math.max(1.25, rocketLaunchInterval - (game.perks.rocketSalvo - 1) * 0.45);
    }
  }

  for (let i = rockets.length - 1; i >= 0; i -= 1) {
    const rocket = rockets[i];
    rocket.age += dt;

    if (!rocket.target || !asteroids.includes(rocket.target)) {
      rocket.target = findRocketTarget(rocket.mesh.position);
    }

    if (rocket.target) {
      const desired = reusable.vecA.copy(rocket.target.mesh.position).sub(rocket.mesh.position).normalize();
      rocket.velocity.lerp(desired.multiplyScalar(rocketSpeed), 1 - Math.pow(0.004, dt * rocketTurnRate));
    }

    rocket.mesh.position.addScaledVector(rocket.velocity, dt);
    if (rocket.velocity.lengthSq() > 0.001) {
      reusable.vecB.copy(rocket.mesh.position).add(rocket.velocity);
      rocket.mesh.lookAt(reusable.vecB);
    }

    const flame = rocket.mesh.getObjectByName("rocketFlame");
    if (flame) {
      flame.scale.setScalar(0.75 + Math.sin(time * 24 + rocket.age * 8) * 0.12);
    }

    rocket.trailTimer += dt;
    if (rocket.trailTimer > 0.035) {
      rocket.trailTimer = 0;
      const trailPosition = reusable.vecC.copy(rocket.mesh.position).addScaledVector(rocket.velocity, -0.018);
      spawnSpark(trailPosition, 0xff7dad, 1, 0.24);
    }

    const hit = rocket.target && rocket.mesh.position.distanceTo(rocket.target.mesh.position) < rocket.target.hitRadius + 0.7;
    const expired = rocket.age > 5.2 || rocket.mesh.position.z > player.position.z + 48;
    if (hit || expired) {
      explodeRocket(rocket, hit ? rocket.target.mesh.position : rocket.mesh.position);
      rockets.splice(i, 1);
    }
  }
}

function launchRocketSalvo(time) {
  const salvoCount = Math.min(4, game.perks.rocketSalvo);
  for (let i = 0; i < salvoCount; i += 1) {
    const delayOffset = (i - (salvoCount - 1) * 0.5) * 0.34;
    const side = (rockets.length + i) % 2 === 0 ? -1 : 1;
    const origin = reusable.vecA.set(side * 1.15, -0.32, -0.9 + delayOffset);
    ship.localToWorld(origin);
    const target = findRocketTarget(origin);
    if (!target) {
      continue;
    }

    const rocket = createRocket();
    rocket.mesh.position.copy(origin);
    rocket.velocity
      .copy(target.mesh.position)
      .sub(origin)
      .normalize()
      .multiplyScalar(rocketSpeed * (0.78 + i * 0.05));
    rocket.target = target;
    rocket.age = Math.max(0, -i * 0.08);
    rocket.trailTimer = Math.random() * 0.03;
    rocket.mesh.rotation.z = Math.sin(time + i) * 0.2;
    rockets.push(rocket);
    scene.add(rocket.mesh);
  }
}

function createRocket() {
  const mesh = new THREE.Group();
  const body = new THREE.Mesh(rocketBodyGeometry, rocketBodyMaterial);
  body.rotation.x = Math.PI * 0.5;
  mesh.add(body);

  const nose = new THREE.Mesh(rocketNoseGeometry, rocketBodyMaterial);
  nose.rotation.x = -Math.PI * 0.5;
  nose.position.z = -0.7;
  mesh.add(nose);

  const leftFin = new THREE.Mesh(rocketFinGeometry, rocketBodyMaterial);
  leftFin.position.set(-0.18, -0.02, 0.42);
  mesh.add(leftFin);

  const rightFin = leftFin.clone();
  rightFin.position.x *= -1;
  mesh.add(rightFin);

  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.46, 12), rocketFlameMaterial);
  flame.name = "rocketFlame";
  flame.rotation.x = Math.PI * 0.5;
  flame.position.z = 0.78;
  mesh.add(flame);

  return {
    mesh,
    velocity: new THREE.Vector3(),
    target: null,
    age: 0,
    trailTimer: 0,
  };
}

function findRocketTarget(origin) {
  let best = null;
  let bestScore = Infinity;

  for (const asteroid of asteroids) {
    const offset = reusable.vecD.copy(asteroid.mesh.position).sub(origin);
    const distance = offset.length();
    const forwardDistance = player.position.z - asteroid.mesh.position.z;
    if (distance > rocketRange || forwardDistance < -20) {
      continue;
    }

    const score = distance + Math.abs(asteroid.mesh.position.x - player.position.x) * 0.45;
    if (score < bestScore) {
      bestScore = score;
      best = asteroid;
    }
  }

  return best;
}

function explodeRocket(rocket, positionLike) {
  const position = reusable.vecA.copy(positionLike);
  scene.remove(rocket.mesh);
  disposeRocket(rocket.mesh);
  spawnSpark(position, 0xff7dad, 18, 1.08);

  const destroyed = [];
  for (const asteroid of asteroids) {
    const distance = asteroid.mesh.position.distanceTo(position);
    if (distance > rocketBlastRadius + asteroid.hitRadius) {
      continue;
    }

    const falloff = THREE.MathUtils.clamp(1 - distance / (rocketBlastRadius + asteroid.hitRadius), 0.18, 1);
    asteroid.hp -= rocketBlastDamage * falloff;
    asteroid.hot = 1;
    if (asteroid.hp <= 0) {
      destroyed.push(asteroid);
    }
  }

  for (const asteroid of destroyed) {
    destroyAsteroid(asteroid);
  }
}

function disposeRocket(mesh) {
  mesh.traverse((child) => {
    if (child.name === "rocketFlame") {
      child.geometry?.dispose();
    }
  });
}

function updateLaser(dt, time) {
  pointer.fireLatch = Math.max(0, pointer.fireLatch - dt);
  const wantsFire = pointer.firing || pointer.fireLatch > 0 || keys.has(" ") || keys.has("f");
  const durationLevel = game.upgrades.duration;
  const strengthLevel = game.upgrades.strength;
  game.energyMax = 92 + durationLevel * 28;
  const drainRate = Math.max(12, 35 - durationLevel * 1.7);
  const baseRechargeRate = 24 + durationLevel * 3;
  const rechargeRate = wantsFire ? 0 : baseRechargeRate;
  game.firing = wantsFire && game.energy > 0.8;

  if (game.firing) {
    game.energy = Math.max(0, Math.min(game.energyMax, game.energy - drainRate * dt + rechargeRate * dt));
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
    .multiplyScalar(laserAimDistance)
    .add(raycaster.ray.origin);
  const direction = reusable.vecC.copy(targetFromCamera).sub(origin).normalize();
  const range = laserBaseRange + strengthLevel * laserRangePerStrength;
  const hits = traceAsteroids(origin, direction, range, 1 + game.perks.laserPierce);
  let beamEnd = targetFromCamera.copy(direction).multiplyScalar(range).add(origin);

  if (hits.length > 0) {
    beamEnd = hits[hits.length - 1].point;
    const destroyed = new Set();

    hits.forEach((hit, index) => {
      const damageFalloff = Math.max(0.58, 1 - index * 0.18);
      const damage = (40 + strengthLevel * 20) * damageFalloff * dt;
      hit.asteroid.hp -= damage;
      hit.asteroid.hot = 1;
      hit.asteroid.mesh.scale.setScalar(1 + Math.sin(time * 24) * 0.012);

      if (game.perks.energySiphon > 0) {
        game.energy = Math.min(game.energyMax, game.energy + damage * game.perks.energySiphon);
      }

      if (hit.asteroid.hp <= 0) {
        destroyed.add(hit.asteroid);
      }
    });

    const primaryHit = hits[0];
    hitGlow.visible = true;
    hitGlow.position.copy(primaryHit.point);
    hitGlow.scale.setScalar(0.7 + strengthLevel * 0.09 + Math.sin(time * 18) * 0.12);

    game.laserPulse += dt;
    if (game.laserPulse > 0.045) {
      game.laserPulse = 0;
      spawnSpark(primaryHit.point, 0x7fffff, 2 + Math.min(hits.length - 1, 3), 0.36);
    }

    for (const asteroid of destroyed) {
      destroyAsteroid(asteroid);
    }
  } else {
    hitGlow.visible = false;
  }

  updateBeam(origin, beamEnd, strengthLevel, time);
}

function traceAsteroids(origin, direction, range, maxHits) {
  const hits = [];
  const laserRadius = 0.25 + game.upgrades.strength * 0.06;

  for (const asteroid of asteroids) {
    const toAsteroid = reusable.vecD.copy(asteroid.mesh.position).sub(origin);
    const t = toAsteroid.dot(direction);
    if (t < 0 || t > range) {
      continue;
    }

    const closest = reusable.vecE.copy(direction).multiplyScalar(t).add(origin);
    const distance = closest.distanceTo(asteroid.mesh.position);
    if (distance <= asteroid.hitRadius * asteroid.mesh.scale.x + laserRadius) {
      hits.push({
        asteroid,
        point: closest.clone(),
        t,
      });
    }
  }

  return hits.sort((a, b) => a.t - b.t).slice(0, maxHits);
}

function updateBeam(origin, end, strengthLevel, time) {
  setBeamBetween(laserBeam, origin, end, 1 + strengthLevel * 0.15);
  laserBeam.visible = true;
  beamShell.material.opacity = 0.2 + Math.sin(time * 31) * 0.045;
  beamCore.material.opacity = 0.78 + Math.sin(time * 45) * 0.12;
}

function setBeamBetween(beam, origin, end, radialScale) {
  const mid = reusable.vecD.copy(origin).lerp(end, 0.5);
  const direction = reusable.vecE.copy(end).sub(origin);
  const length = direction.length();

  beam.position.copy(mid);
  reusable.quat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  beam.quaternion.copy(reusable.quat);
  beam.scale.set(radialScale, length, radialScale);
}

function destroyAsteroid(asteroid) {
  destroyAsteroidWithOptions(asteroid, { shockwave: true });
}

function destroyAsteroidWithOptions(asteroid, options) {
  const index = asteroids.indexOf(asteroid);
  if (index === -1) {
    return;
  }

  const position = asteroid.mesh.position.clone();
  const dropMultiplier = asteroid.golden ? 1.8 : 1;
  const dropCount = Math.floor((randomRange(3, 7) + asteroid.radius * 0.6) * dropMultiplier);
  spawnGems(position, dropCount, asteroid.radius);
  spawnSpark(position, 0xffc65a, 16, Math.min(1.4, asteroid.radius * 0.28));
  vacuumAllGems();

  if (game.perks.asteroidEnergyRestore > 0) {
    game.energy = Math.min(game.energyMax, game.energy + game.perks.asteroidEnergyRestore);
  }

  scene.remove(asteroid.mesh);
  disposeObject(asteroid.mesh);
  asteroids.splice(index, 1);

  if (options.shockwave && game.perks.shatterDamage > 0) {
    damageAsteroidsNear(position, asteroid.radius);
  }

  if (asteroid.golden) {
    openGoldenChoice();
  }
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

function damageAsteroidsNear(position, sourceRadius) {
  const blastRadius = 15 + sourceRadius * 1.8;
  const destroyed = [];

  for (const asteroid of asteroids) {
    const distance = asteroid.mesh.position.distanceTo(position);
    if (distance > blastRadius) {
      continue;
    }

    const falloff = 1 - distance / blastRadius;
    asteroid.hp -= game.perks.shatterDamage * (0.45 + falloff * 0.75);
    asteroid.hot = 1;
    spawnSpark(asteroid.mesh.position, asteroid.golden ? 0xffd46c : 0xffc65a, 4, 0.38);

    if (asteroid.hp <= 0) {
      destroyed.push(asteroid);
    }
  }

  for (const asteroid of destroyed) {
    destroyAsteroidWithOptions(asteroid, { shockwave: false });
  }
}

function openGoldenChoice() {
  const choices = getGoldenUpgradeChoices(game);
  if (choices.length === 0) {
    game.gems += 40;
    updateUpgradeUi(ui, game);
    showToast(ui, game, timer.getElapsed(), "Golden cache converted to gems");
    return;
  }

  game.paused = true;
  showGoldenChoice(ui, choices, chooseGoldenUpgrade);
}

function chooseGoldenUpgrade(upgradeId) {
  const upgrade = applyGoldenUpgrade(game, upgradeId);
  if (!upgrade) {
    return;
  }

  hideGoldenChoice(ui);
  game.paused = false;
  syncDrones();
  updateUpgradeUi(ui, game);
  showToast(
    ui,
    game,
    timer.getElapsed(),
    `${upgrade.name} Lv ${upgrade.level}/${upgrade.maxLevel} installed`,
  );
}

function disposeObject(object) {
  object.traverse((child) => {
    child.geometry?.dispose();
    if (Array.isArray(child.material)) {
      child.material.forEach((material) => material.dispose());
    } else {
      child.material?.dispose();
    }
  });
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
    }
  }

  dust.points.geometry.attributes.position.needsUpdate = true;
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

function buyUpgrade(type) {
  const costs = getUpgradeCosts(game);
  const cost = costs[type];
  if (game.gems < cost) {
    showToast(ui, game, timer.getElapsed(), "More gems needed");
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
  showToast(ui, game, timer.getElapsed(), names[type]);
  updateUpgradeUi(ui, game);
}
