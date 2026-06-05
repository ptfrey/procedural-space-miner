export const GOLDEN_ASTEROID_BASE_CHANCE = 1 / 50;

export const GOLDEN_UPGRADES = [
  {
    id: "prism-lance",
    code: "PRISM",
    name: "Prism Lance",
    summary: "The mining beam pierces two extra asteroids.",
    apply(perks) {
      perks.laserPierce += 2;
    },
  },
  {
    id: "siphon-coupler",
    code: "SIPHN",
    name: "Siphon Coupler",
    summary: "Laser contact feeds energy back into the core.",
    apply(perks) {
      perks.energySiphon += 0.12;
    },
  },
  {
    id: "shatter-core",
    code: "BLAST",
    name: "Shatter Core",
    summary: "Destroyed asteroids crack nearby rocks with a shockwave.",
    apply(perks) {
      perks.shatterDamage += 42;
    },
  },
  {
    id: "gem-refinery",
    code: "VALUE",
    name: "Gem Refinery",
    summary: "Every collected gem is worth one extra gem.",
    apply(perks) {
      perks.gemValueBonus += 1;
    },
  },
  {
    id: "quantum-scoop",
    code: "SCOOP",
    name: "Quantum Scoop",
    summary: "Vacuumed gems fly faster and collect from farther away.",
    apply(perks) {
      perks.collectorRadiusMultiplier *= 1.45;
      perks.vacuumSpeedMultiplier *= 1.55;
    },
  },
  {
    id: "phase-rudder",
    code: "PHASE",
    name: "Phase Rudder",
    summary: "The ship can drift wider and answer steering faster.",
    apply(perks) {
      perks.boundScale *= 1.18;
      perks.steeringMultiplier *= 1.22;
    },
  },
  {
    id: "black-market-firmware",
    code: "CHEAP",
    name: "Black-Market Firmware",
    summary: "Standard gem upgrades cost 25 percent less.",
    apply(perks) {
      perks.upgradeDiscount = Math.max(perks.upgradeDiscount, 0.25);
    },
  },
  {
    id: "golden-compass",
    code: "AURIC",
    name: "Golden Compass",
    summary: "Golden asteroids become twice as common.",
    apply(perks) {
      perks.goldenChanceMultiplier *= 2;
    },
  },
  {
    id: "escort-foundry",
    code: "DRONE",
    name: "Escort Foundry",
    summary: "Deploy two drones that orbit the ship and shoot asteroids.",
    apply(perks) {
      perks.combatDroneCount += 2;
    },
  },
  {
    id: "rocket-printer",
    code: "RKT",
    name: "Rocket Printer",
    summary: "Periodically launches seeking rockets at asteroids.",
    apply(perks) {
      perks.rocketSalvo += 1;
    },
  },
  {
    id: "emergency-reservoir",
    code: "CELL",
    name: "Emergency Reservoir",
    summary: "Breaking any asteroid restores a burst of laser energy.",
    apply(perks) {
      perks.asteroidEnergyRestore += 34;
    },
  },
];

export function createDefaultPerks() {
  return {
    laserPierce: 0,
    energySiphon: 0,
    shatterDamage: 0,
    gemValueBonus: 0,
    collectorRadiusMultiplier: 1,
    vacuumSpeedMultiplier: 1,
    boundScale: 1,
    steeringMultiplier: 1,
    upgradeDiscount: 0,
    goldenChanceMultiplier: 1,
    asteroidEnergyRestore: 0,
    combatDroneCount: 0,
    rocketSalvo: 0,
  };
}

export function getGoldenUpgradeChoices(game, count = 3) {
  const owned = new Set(game.goldenUpgrades);
  const available = GOLDEN_UPGRADES.filter((upgrade) => !owned.has(upgrade.id));
  return shuffle(available).slice(0, count);
}

export function applyGoldenUpgrade(game, upgradeId) {
  const upgrade = GOLDEN_UPGRADES.find((candidate) => candidate.id === upgradeId);
  if (!upgrade || game.goldenUpgrades.includes(upgrade.id)) {
    return null;
  }

  upgrade.apply(game.perks);
  game.goldenUpgrades.push(upgrade.id);
  return upgrade;
}

function shuffle(items) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const swapIndex = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[i]];
  }
  return shuffled;
}
