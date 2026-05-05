import {
  BUILDINGS,
  TERRAIN_TYPES,
  advanceSimulation,
  buildStructure,
  canBuild,
  createInitialState,
  getBuildOptions,
  getTileSummary,
} from "./simulation.js";

const canvas = document.querySelector("#game-canvas");
const context = canvas.getContext("2d");
const resourceBar = document.querySelector("#resource-bar");
const buildMenu = document.querySelector("#build-menu");
const statusPanel = document.querySelector("#status-panel");
const tilePanel = document.querySelector("#tile-panel");
const eventLog = document.querySelector("#event-log");

const state = createInitialState();
let hoveredTile = null;

const terrainColors = {
  [TERRAIN_TYPES.BASALT]: "#594943",
  [TERRAIN_TYPES.REGOLITH]: "#765240",
  [TERRAIN_TYPES.ICE]: "#8fd8ff",
  [TERRAIN_TYPES.ORE]: "#c6854b",
  [TERRAIN_TYPES.SILICA]: "#d3c58f",
  [TERRAIN_TYPES.RIFT]: "#2c1b24",
};

const buildingColors = {
  hub: "#e8f1ff",
  conveyor: "#f7c948",
  solar: "#ffd166",
  battery: "#70d6ff",
  iceExtractor: "#69c8ff",
  oreDrill: "#d48a48",
  siliconKiln: "#d3c58f",
  greenhouse: "#83e377",
  habitat: "#c39df2",
  turret: "#ff7a90",
};

const buildingGlyphs = {
  hub: "H",
  conveyor: "+",
  solar: "S",
  battery: "B",
  iceExtractor: "I",
  oreDrill: "O",
  siliconKiln: "K",
  greenhouse: "G",
  habitat: "A",
  turret: "T",
};

function formatCost(cost = {}) {
  const entries = Object.entries(cost);
  if (!entries.length) return "free";
  return entries.map(([resource, amount]) => `${amount} ${resource}`).join(" / ");
}

function renderBuildMenu() {
  buildMenu.innerHTML = "";

  for (const option of getBuildOptions()) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `build-button${option.type === state.selectedBuild ? " selected" : ""}`;
    button.innerHTML = `
      <strong>${buildingGlyphs[option.type]} ${option.name}</strong>
      <small>${option.description}</small>
      <small>Cost: ${formatCost(option.cost)}</small>
    `;
    button.addEventListener("click", () => {
      state.selectedBuild = option.type;
      renderBuildMenu();
      renderTilePanel();
      drawBoard();
    });
    buildMenu.append(button);
  }
}

function renderResources() {
  resourceBar.innerHTML = "";
  for (const [resource, amount] of Object.entries(state.resources)) {
    const item = document.createElement("div");
    item.className = "resource-pill";
    item.innerHTML = `<span>${resource}</span><strong>${Math.floor(amount)}</strong>`;
    resourceBar.append(item);
  }
}

function renderStatus() {
  const metrics = {
    sol: state.sol,
    time: `${Math.floor(state.timeOfDay).toString().padStart(2, "0")}:00`,
    colonists: state.population,
    morale: `${Math.round(state.morale)}%`,
    threat: state.threat.toFixed(1),
    event: state.activeEvent ? state.activeEvent.label : "clear",
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
  for (const entry of state.events.slice(0, 9)) {
    const item = document.createElement("li");
    item.textContent = `[Sol ${Math.max(1, state.sol)} | T${entry.tick}] ${entry.message}`;
    eventLog.append(item);
  }
}

function renderTilePanel() {
  const selected = BUILDINGS[state.selectedBuild];
  const summary = hoveredTile ? getTileSummary(state, hoveredTile.x, hoveredTile.y) : null;

  if (!summary) {
    tilePanel.innerHTML = `
      <strong>Selected:</strong> ${buildingGlyphs[state.selectedBuild]} ${selected.name}
      <span>${selected.description}</span>
    `;
    return;
  }

  const occupant = summary.buildingName || "Empty";
  const health = summary.building ? ` (${Math.ceil(summary.building.health)} hp)` : "";
  tilePanel.innerHTML = `
    <strong>Tile ${summary.x + 1}.${summary.y + 1}</strong>
    <span>${occupant}${health} on ${summary.terrain}</span>
    <span>${summary.explored ? summary.canBuildSelected.reason : "Unexplored sector"}</span>
  `;
}

function drawBoard() {
  const tileSize = Math.min(canvas.width / state.width, canvas.height / state.height);
  context.clearRect(0, 0, canvas.width, canvas.height);

  for (const row of state.map) {
    for (const tile of row) {
      drawTile(tile, tileSize);
    }
  }

  if (hoveredTile) {
    const preview = canBuild(state, state.selectedBuild, hoveredTile.x, hoveredTile.y);
    context.fillStyle = preview.ok ? "rgba(93, 214, 255, 0.18)" : "rgba(255, 96, 96, 0.2)";
    context.fillRect(hoveredTile.x * tileSize, hoveredTile.y * tileSize, tileSize, tileSize);
  }
}

function drawTile(tile, tileSize) {
  const x = tile.x * tileSize;
  const y = tile.y * tileSize;

  context.fillStyle = tile.explored ? terrainColors[tile.terrain] : "#171923";
  context.fillRect(x, y, tileSize, tileSize);

  if (tile.terrain !== TERRAIN_TYPES.REGOLITH && tile.terrain !== TERRAIN_TYPES.BASALT && tile.explored) {
    context.fillStyle = "rgba(255, 255, 255, 0.2)";
    context.beginPath();
    context.arc(x + tileSize / 2, y + tileSize / 2, tileSize * 0.18, 0, Math.PI * 2);
    context.fill();
  }

  if (tile.building) {
    drawBuilding(tile, x, y, tileSize);
  }

  if (tile.building && tile.building.type !== "hub") {
    context.fillStyle = tile.building.connected ? "rgba(80, 255, 170, 0.16)" : "rgba(255, 96, 96, 0.2)";
    context.fillRect(x, y, tileSize, tileSize);
  }

  context.strokeStyle = "rgba(255, 255, 255, 0.08)";
  context.strokeRect(x, y, tileSize, tileSize);
}

function drawBuilding(tile, x, y, tileSize) {
  const type = tile.building.type;
  context.fillStyle = buildingColors[type] || "#ffffff";

  if (type === "conveyor") {
    context.fillRect(x + tileSize * 0.18, y + tileSize * 0.4, tileSize * 0.64, tileSize * 0.2);
    context.fillRect(x + tileSize * 0.4, y + tileSize * 0.18, tileSize * 0.2, tileSize * 0.64);
    return;
  }

  context.beginPath();
  context.roundRect(x + tileSize * 0.16, y + tileSize * 0.16, tileSize * 0.68, tileSize * 0.68, 8);
  context.fill();
  context.fillStyle = "#111520";
  context.font = `700 ${tileSize * 0.35}px sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(buildingGlyphs[type] || "?", x + tileSize / 2, y + tileSize / 2 + 1);
}

function getPointerTile(event) {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor(((event.clientX - rect.left) / rect.width) * state.width);
  const y = Math.floor(((event.clientY - rect.top) / rect.height) * state.height);
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
  buildStructure(state, state.selectedBuild, tile.x, tile.y);
  renderBuildMenu();
  refresh();
});

renderBuildMenu();
refresh();

let previousTime = performance.now();
function frame(now) {
  const elapsed = now - previousTime;
  if (elapsed > 700) {
    previousTime = now;
    advanceSimulation(state, 1);
    refresh();
  }
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
