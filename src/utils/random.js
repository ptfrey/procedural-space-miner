import * as THREE from "three";

export function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

export function randomUnitVector() {
  const z = randomRange(-1, 1);
  const angle = Math.random() * Math.PI * 2;
  const radius = Math.sqrt(1 - z * z);
  return new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, z);
}

export function hashNoise(x, y, z, seed) {
  const value = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed * 0.113) * 43758.5453;
  return value - Math.floor(value);
}
