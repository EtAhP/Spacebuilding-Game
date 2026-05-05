import {
  BUILDINGS,
  RESOURCE_DEPOSIT_TYPES,
  createGame,
  getTile,
  placeBuilding,
  tickGame
} from "./simulation.js";

const canvas = document.querySelector("#game-canvas");
const context = canvas.getContext("2d");
const resourceBar = document.querySelector("#resource-bar");
const buildMenu = document.querySelector("#build-menu");
const statusPanel = document.querySelector("#status-panel");
const tilePanel = document.querySelector("#tile-panel");
const eventLog = document.querySelector("#event-log");

const game = createGame();
let selectedBuilding = "conveyor";
let hoveredTile = null;

const colors = {
  regolith: "#6f5244",
  grid: "rgba(255, 255, 255, 0.08)",
  range: "rgba(93, 214, 255, 0.16)",
  connected: "rgba(80, 255, 170, 0.18)",
  disconnected: "rgba(255, 96, 96, 0.2)",
  ore: "#b98051",
  ice: "#9bd9ff",
  fertile: "#8ccf7e"
};

const buildingColors = {
  hub: "#e8f1ff",
  conveyor: "#f7c948",
  solar: "#ffd166",
  drill: "#d48a48",
  iceHarvester: "#69c8ff",
  greenhouse: "#83e377",
  habitat: "#c39df2",
  turret: "#ff7a90"
};

function renderBuildMenu() {
  buildMenu.innerHTML = "";

  for (const building of Object.values(BUILDINGS)) {
    if (building.id === "hub") {
      continue;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = building.id === selectedBuilding ? "selected" : "";
    button.innerHTML = `
      <span>${building.icon} ${building.name}</span>
      <small>${formatCost(building.cost)}</small>
    `;
    button.addEventListener("click", () => {
      selectedBuilding = building.id;
      renderBuildMenu();
      renderTilePanel();
    });
    buildMenu.append(button);
  }
}

function formatCost(cost) {
  return Object.entries(cost)
    .map(([resource, amount]) => `${amount} ${resource}`)
    .join(" / ");
}

function renderResources() {
  resourceBar.innerHTML = "";
  for (const [resource, amount] of Object.entries(game.resources)) {
    const item = document.createElement("div");
    item.className = "resource-pill";
    item.innerHTML = `<strong>${resource}</strong><span>${Math.floor(amount)}</span>`;
    resourceBar.append(item);
  }
}

function renderStatus() {
  const metrics = {
    sol: Math.floor(game.sol),
    colonists: game.colonists,
    health: `${Math.round(game.health)}%`,
    morale: `${Math.round(game.morale)}%`,
    "threat level": game.threatLevel,
    next wave: `${Math.max(0, Math.ceil(game.nextWaveSol - game.sol))} sols`
  };

  statusPanel.innerHTML = "";
  for (const [label, value] of Object.entries(metrics)) {
    const card = document.createElement("div");
    card.className = "status-card";
    card.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
    statusPanel.append(card);
  }
}

function renderEventLog() {
  eventLog.innerHTML = "";
  for (const entry of game.log.slice(0, 8)) {
    const item = document.createElement("li");
    item.textContent = `[Sol ${entry.sol}] ${entry.message}`;
    eventLog.append(item);
  }
}

function renderTilePanel() {
  const tile = hoveredTile ? getTile(game, hoveredTile.x, hoveredTile.y) : null;
  const building = BUILDINGS[selectedBuilding];

  if (!tile) {
    tilePanel.innerHTML = `
      <strong>Selected:</strong> ${building.icon} ${building.name}
      <span>${building.description}</span>
    `;
    return;
  }

  const occupant = tile.building ? BUILDINGS[tile.building] : null;
  const deposit = tile.deposit ? `${tile.deposit} deposit` : "no deposit";
  tilePanel.innerHTML = `
    <strong>Tile ${tile.x},${tile.y}</strong>
    <span>${occupant ? `${occupant.icon} ${occupant.name}` : "Empty"} - ${deposit}</span>
    <span>${tile.connected ? "Connected to hub" : "Needs logistics link"}</span>
  `;
}

function drawBoard() {
  const tileSize = canvas.width / game.width;
  context.clearRect(0, 0, canvas.width, canvas.height);

  for (const tile of game.tiles) {
    const x = tile.x * tileSize;
    const y = tile.y * tileSize;

    context.fillStyle = colors.regolith;
    context.fillRect(x, y, tileSize, tileSize);

    if (tile.deposit) {
      context.fillStyle = colors[tile.deposit];
      context.beginPath();
      context.arc(x + tileSize / 2, y + tileSize / 2, tileSize * 0.22, 0, Math.PI * 2);
      context.fill();
    }

    if (tile.building) {
      drawBuilding(tile, x, y, tileSize);
    }

    if (tile.building && tile.building !== "hub") {
      context.fillStyle = tile.connected ? colors.connected : colors.disconnected;
      context.fillRect(x, y, tileSize, tileSize);
    }

    context.strokeStyle = colors.grid;
    context.strokeRect(x, y, tileSize, tileSize);
  }

  if (hoveredTile) {
    const building = BUILDINGS[selectedBuilding];
    context.fillStyle = canPreviewBuild(hoveredTile) ? colors.range : colors.disconnected;
    context.fillRect(hoveredTile.x * tileSize, hoveredTile.y * tileSize, tileSize, tileSize);

    if (building.range) {
      drawRange(hoveredTile, building.range, tileSize);
    }
  }
}

function canPreviewBuild(tilePosition) {
  const tile = getTile(game, tilePosition.x, tilePosition.y);
  if (!tile || tile.building) {
    return false;
  }

  const building = BUILDINGS[selectedBuilding];
  if (building.requiresDeposit && tile.deposit !== building.requiresDeposit) {
    return false;
  }

  return RESOURCE_DEPOSIT_TYPES.has(tile.deposit) || !tile.deposit;
}

function drawBuilding(tile, x, y, tileSize) {
  const building = BUILDINGS[tile.building];
  context.fillStyle = buildingColors[tile.building] || "#ffffff";

  if (tile.building === "conveyor") {
    context.fillRect(x + tileSize * 0.18, y + tileSize * 0.38, tileSize * 0.64, tileSize * 0.24);
    context.fillRect(x + tileSize * 0.38, y + tileSize * 0.18, tileSize * 0.24, tileSize * 0.64);
    return;
  }

  context.beginPath();
  context.roundRect(x + tileSize * 0.16, y + tileSize * 0.16, tileSize * 0.68, tileSize * 0.68, 8);
  context.fill();
  context.fillStyle = "#1f2937";
  context.font = `${tileSize * 0.35}px sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(building.icon, x + tileSize / 2, y + tileSize / 2 + 1);
}

function drawRange(tile, range, tileSize) {
  context.strokeStyle = "rgba(255, 122, 144, 0.55)";
  context.lineWidth = 2;
  context.beginPath();
  context.arc(
    tile.x * tileSize + tileSize / 2,
    tile.y * tileSize + tileSize / 2,
    range * tileSize,
    0,
    Math.PI * 2
  );
  context.stroke();
  context.lineWidth = 1;
}

function getPointerTile(event) {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor(((event.clientX - rect.left) / rect.width) * game.width);
  const y = Math.floor(((event.clientY - rect.top) / rect.height) * game.height);
  return { x, y };
}

function refresh() {
  renderResources();
  renderStatus();
  renderEventLog();
  renderTilePanel();
  drawBoard();
}

canvas.addEventListener("mousemove", (event) => {
  hoveredTile = getPointerTile(event);
  renderTilePanel();
  drawBoard();
});

canvas.addEventListener("mouseleave", () => {
  hoveredTile = null;
  renderTilePanel();
  drawBoard();
});

canvas.addEventListener("click", (event) => {
  const tile = getPointerTile(event);
  const result = placeBuilding(game, selectedBuilding, tile.x, tile.y);

  if (!result.ok) {
    game.log.unshift({ sol: Math.floor(game.sol), message: result.reason });
  }

  refresh();
});

renderBuildMenu();
refresh();

let previousTime = performance.now();
function frame(now) {
  const deltaSeconds = Math.min(0.25, (now - previousTime) / 1000);
  previousTime = now;
  tickGame(game, deltaSeconds);
  refresh();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
