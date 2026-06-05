import * as THREE from "three";

export function getUiElements() {
  return {
    gems: document.querySelector("#gems"),
    range: document.querySelector("#range"),
    speed: document.querySelector("#speed"),
    energyValue: document.querySelector("#energy-value"),
    energyFill: document.querySelector("#energy-fill"),
    reticle: document.querySelector("#reticle"),
    toast: document.querySelector("#toast"),
    goldenChoice: document.querySelector("#golden-choice"),
    goldenCards: document.querySelector("#golden-cards"),
    buttons: [...document.querySelectorAll("[data-upgrade]")],
    meta: {
      speed: document.querySelector("#speed-meta"),
      strength: document.querySelector("#strength-meta"),
      duration: document.querySelector("#duration-meta"),
    },
  };
}

export function updateUi({ ui, game, player, pointer, time }) {
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

export function updateUpgradeUi(ui, game) {
  const costs = getUpgradeCosts(game);
  ui.meta.speed.textContent = `Lv ${game.upgrades.speed} - ${costs.speed}`;
  ui.meta.strength.textContent = `Lv ${game.upgrades.strength} - ${costs.strength}`;
  ui.meta.duration.textContent = `Lv ${game.upgrades.duration} - ${costs.duration}`;

  ui.buttons.forEach((button) => {
    const key = button.dataset.upgrade;
    button.disabled = game.gems < costs[key];
  });
}

export function getUpgradeCosts(game) {
  const discount = game.perks?.upgradeDiscount ?? 0;
  const discountCost = (value) => Math.max(1, Math.floor(value * (1 - discount)));

  return {
    speed: discountCost(8 * Math.pow(game.upgrades.speed, 1.48)),
    strength: discountCost(10 * Math.pow(game.upgrades.strength, 1.52)),
    duration: discountCost(12 * Math.pow(game.upgrades.duration, 1.5)),
  };
}

export function showToast(ui, game, time, message) {
  ui.toast.textContent = message;
  ui.toast.classList.add("visible");
  game.lastToastAt = time;
}

export function showGoldenChoice(ui, choices, onChoose) {
  ui.goldenCards.replaceChildren();

  for (const choice of choices) {
    const button = document.createElement("button");
    button.className = "golden-card";
    button.type = "button";
    button.dataset.upgradeId = choice.id;
    button.innerHTML = `
      <span class="golden-card-code">${choice.code}</span>
      <strong>${choice.name}</strong>
      <span>${choice.summary}</span>
    `;
    button.addEventListener("click", () => onChoose(choice.id), { once: true });
    ui.goldenCards.append(button);
  }

  ui.goldenChoice.hidden = false;
  requestAnimationFrame(() => {
    ui.goldenChoice.classList.add("visible");
    ui.goldenCards.querySelector("button")?.focus();
  });
}

export function hideGoldenChoice(ui) {
  ui.goldenChoice.classList.remove("visible");
  ui.goldenChoice.hidden = true;
  ui.goldenCards.replaceChildren();
}
