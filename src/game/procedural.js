import * as THREE from "three";
import { hashNoise, randomRange } from "../utils/random.js";

export function createShip() {
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

export function createStarField(count, radius, brightness) {
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

export function createDustField(count) {
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

export function resetDustParticle(positions, speeds, index, scatter) {
  const i3 = index * 3;
  positions[i3] = randomRange(-80, 80);
  positions[i3 + 1] = randomRange(-48, 48);
  positions[i3 + 2] = scatter ? randomRange(-280, 50) : randomRange(-300, -240);
  speeds[index] = randomRange(8, 42);
}

export function createNebula() {
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

export function createAsteroidGeometry(radius, seed) {
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
  geometry.computeBoundingSphere();
  return geometry;
}
