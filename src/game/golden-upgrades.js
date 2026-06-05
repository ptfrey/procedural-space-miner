export const GOLDEN_ASTEROID_BASE_CHANCE = 1 / 50;

export const GOLDEN_UPGRADE_MAX_LEVEL = 10;

export const GOLDEN_UPGRADES = [
  {
    id: "prism-lance",
    code: "PRISM",
    name: "Prism Lance",
    summary: "The mining beam pierces one extra asteroid per level.",
    apply(perks) {
      perks.laserPierce += 1;
    },
  },
  {
    id: "siphon-coupler",
    code: "SIPHN",
    name: "Siphon Coupler",
    summary: "Laser contact feeds more energy back into the core each level.",
    apply(perks) {
      perks.energySiphon += 0.06;
    },
  },
  {
    id: "shatter-core",
    code: "BLAST",
    name: "Shatter Core",
    summary: "Destroyed asteroids crack nearby rocks harder each level.",
    apply(perks) {
      perks.shatterDamage += 22;
    },
  },
  {
    id: "gem-refinery",
    code: "VALUE",
    name: "Gem Refinery",
    summary: "Every collected gem is worth one extra gem per level.",
    apply(perks) {
      perks.gemValueBonus += 1;
    },
  },
  {
    id: "quantum-scoop",
    code: "SCOOP",
    name: "Quantum Scoop",
    summary: "Vacuumed gems fly faster and collect from farther away each level.",
    apply(perks) {
      perks.collectorRadiusMultiplier *= 1.12;
      perks.vacuumSpeedMultiplier *= 1.14;
    },
  },
  {
    id: "phase-rudder",
    code: "PHASE",
    name: "Phase Rudder",
    summary: "The ship drifts wider and answers steering faster each level.",
    apply(perks) {
      perks.boundScale *= 1.07;
      perks.steeringMultiplier *= 1.08;
    },
  },
  {
    id: "black-market-firmware",
    code: "CHEAP",
    name: "Black-Market Firmware",
    summary: "Standard gem upgrades cost an extra 5 percent less each level.",
    apply(perks) {
      perks.upgradeDiscount = Math.min(0.7, perks.upgradeDiscount + 0.05);
    },
  },
  {
    id: "golden-compass",
    code: "AURIC",
    name: "Golden Compass",
    summary: "Golden asteroids grow more common each level.",
    apply(perks) {
      perks.goldenChanceMultiplier += 0.25;
    },
  },
  {
    id: "escort-foundry",
    code: "DRONE",
    name: "Escort Foundry",
    summary: "Deploy one more orbiting combat drone per level.",
    apply(perks) {
      perks.combatDroneCount += 1;
    },
  },
  {
    id: "rocket-printer",
    code: "RKT",
    name: "Rocket Printer",
    summary: "Launches one more seeking rocket per salvo each level.",
    apply(perks) {
      perks.rocketSalvo += 1;
    },
  },
  {
    id: "emergency-reservoir",
    code: "CELL",
    name: "Emergency Reservoir",
    summary: "Breaking any asteroid restores more laser energy each level.",
    apply(perks) {
      perks.asteroidEnergyRestore += 18;
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

export function getGoldenUpgradeLevel(game, upgradeId) {
  return game.goldenUpgradeLevels[upgradeId] ?? 0;
}

export function getGoldenUpgradeChoices(game, count = 3) {
  const available = GOLDEN_UPGRADES.filter(
    (upgrade) => getGoldenUpgradeLevel(game, upgrade.id) < GOLDEN_UPGRADE_MAX_LEVEL,
  );
  return shuffle(available)
    .slice(0, count)
    .map((upgrade) => {
      const level = getGoldenUpgradeLevel(game, upgrade.id);
      return {
        id: upgrade.id,
        code: upgrade.code,
        name: upgrade.name,
        summary: upgrade.summary,
        level,
        nextLevel: level + 1,
        maxLevel: GOLDEN_UPGRADE_MAX_LEVEL,
      };
    });
}

export function applyGoldenUpgrade(game, upgradeId) {
  const upgrade = GOLDEN_UPGRADES.find((candidate) => candidate.id === upgradeId);
  const level = getGoldenUpgradeLevel(game, upgradeId);
  if (!upgrade || level >= GOLDEN_UPGRADE_MAX_LEVEL) {
    return null;
  }

  upgrade.apply(game.perks);
  const newLevel = level + 1;
  game.goldenUpgradeLevels[upgradeId] = newLevel;
  return { ...upgrade, level: newLevel, maxLevel: GOLDEN_UPGRADE_MAX_LEVEL };
}

function shuffle(items) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const swapIndex = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[i]];
  }
  return shuffled;
}
