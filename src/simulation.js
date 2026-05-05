const TERRAIN_TYPES = {
  BASALT: "basalt",
  REGOLITH: "regolith",
  ICE: "ice",
  ORE: "ore",
  SILICA: "silica",
  RIFT: "rift",
};

const RESOURCE_KEYS = ["metal", "silicon", "water", "food", "oxygen", "power"];

export const BUILDINGS = {
  hub: {
    name: "Command Hub",
    description: "The colony anchor. All logistics routes must ultimately reach this structure.",
    cost: {},
    maxHealth: 700,
    buildable: false,
    produces: { oxygen: 0.9, power: 2.5 },
    consumes: {},
    storage: { metal: 120, silicon: 50, water: 80, food: 80, oxygen: 100, power: 60 },
  },
  conveyor: {
    name: "Maglev Conveyor",
    description: "Links distant buildings into the colony logistics grid.",
    cost: { metal: 3 },
    maxHealth: 60,
    logistic: true,
  },
  solar: {
    name: "Solar Array",
    description: "Cheap daytime power that weakens during dust storms.",
    cost: { metal: 14, silicon: 8 },
    maxHealth: 110,
    produces: { power: 4.2 },
  },
  battery: {
    name: "Battery Vault",
    description: "Increases stored power for nights, storms, and raids.",
    cost: { metal: 20, silicon: 16 },
    maxHealth: 130,
    storage: { power: 120 },
  },
  iceExtractor: {
    name: "Ice Extractor",
    description: "Mines water from icy ground. Requires power.",
    cost: { metal: 18 },
    maxHealth: 115,
    requiresTerrain: [TERRAIN_TYPES.ICE],
    consumes: { power: 1.4 },
    produces: { water: 2.4 },
  },
  oreDrill: {
    name: "Ore Drill",
    description: "Extracts metal from ore fields. Requires power.",
    cost: { metal: 12 },
    maxHealth: 110,
    requiresTerrain: [TERRAIN_TYPES.ORE],
    consumes: { power: 1.2 },
    produces: { metal: 2.2 },
  },
  siliconKiln: {
    name: "Silicon Kiln",
    description: "Turns silica into electronics-grade silicon for advanced infrastructure.",
    cost: { metal: 16 },
    maxHealth: 105,
    requiresTerrain: [TERRAIN_TYPES.SILICA],
    consumes: { power: 1.3 },
    produces: { silicon: 1.5 },
  },
  greenhouse: {
    name: "Greenhouse Dome",
    description: "Consumes water and power to grow food and release oxygen.",
    cost: { metal: 24, silicon: 10, water: 8 },
    maxHealth: 160,
    consumes: { water: 0.9, power: 1.6 },
    produces: { food: 1.7, oxygen: 0.7 },
  },
  habitat: {
    name: "Habitat Module",
    description: "Adds living space, increasing workforce and survival needs.",
    cost: { metal: 28, silicon: 12, oxygen: 8 },
    maxHealth: 190,
    populationCap: 6,
    consumes: { power: 0.9 },
  },
  turret: {
    name: "Coil Turret",
    description: "Defends against raider drones. Needs power and a connected network.",
    cost: { metal: 26, silicon: 14 },
    maxHealth: 140,
    consumes: { power: 1.1 },
    defense: 4,
  },
};

const BUILD_ORDER = [
  "conveyor",
  "solar",
  "battery",
  "iceExtractor",
  "oreDrill",
  "siliconKiln",
  "greenhouse",
  "habitat",
  "turret",
];

const DIRECTIONS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function createSeededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function cloneResourceMap(source = {}) {
  return Object.fromEntries(RESOURCE_KEYS.map((key) => [key, Number(source[key] || 0)]));
}

function addResources(target, delta, multiplier = 1) {
  for (const [resource, amount] of Object.entries(delta || {})) {
    target[resource] = Number((target[resource] || 0) + amount * multiplier);
  }
}

function hasResources(resources, cost) {
  return Object.entries(cost || {}).every(([resource, amount]) => (resources[resource] || 0) >= amount);
}

function adjacentKey(x, y) {
  return `${x},${y}`;
}

function createMap(width, height, random) {
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);

  return Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => {
      const distance = Math.hypot(x - centerX, y - centerY);
      const noise = random();
      let terrain = TERRAIN_TYPES.REGOLITH;

      if (noise > 0.91 || (distance > 8 && (x + y) % 11 === 0)) terrain = TERRAIN_TYPES.ORE;
      if (noise < 0.09 || (distance > 5 && (x * 3 + y) % 17 === 0)) terrain = TERRAIN_TYPES.ICE;
      if (noise > 0.76 && noise < 0.84) terrain = TERRAIN_TYPES.SILICA;
      if (noise > 0.975 && distance > 4) terrain = TERRAIN_TYPES.RIFT;
      if (distance < 2.4) terrain = TERRAIN_TYPES.BASALT;

      return {
        x,
        y,
        terrain,
        building: null,
        explored: distance < 7,
      };
    }),
  );
}

function getTile(map, x, y) {
  return map[y]?.[x] || null;
}

function createInitialState(options = {}) {
  const width = options.width || 24;
  const height = options.height || 16;
  const random = createSeededRandom(options.seed || 7331);
  const map = createMap(width, height, random);
  const hubX = Math.floor(width / 2);
  const hubY = Math.floor(height / 2);
  const hubTile = getTile(map, hubX, hubY);

  hubTile.building = {
    type: "hub",
    health: BUILDINGS.hub.maxHealth,
    connected: true,
    active: true,
  };

  return {
    width,
    height,
    tick: 0,
    sol: 1,
    timeOfDay: 8,
    threat: 0,
    population: 6,
    morale: 76,
    resources: {
      metal: 70,
      silicon: 24,
      water: 46,
      food: 44,
      oxygen: 62,
      power: 22,
    },
    storage: cloneResourceMap(BUILDINGS.hub.storage),
    map,
    selectedBuild: BUILD_ORDER[0],
    selectedTile: { x: hubX, y: hubY },
    events: [
      {
        tick: 0,
        type: "system",
        message: "Command hub deployed. Build conveyors to connect extractors, farms, habitats, and defenses.",
      },
    ],
    activeEvent: null,
    gameOver: false,
    victory: false,
    randomSeed: options.seed || 7331,
  };
}

function getBuildings(state) {
  const buildings = [];
  for (const row of state.map) {
    for (const tile of row) {
      if (tile.building) {
        buildings.push({ tile, building: tile.building, spec: BUILDINGS[tile.building.type] });
      }
    }
  }
  return buildings;
}

function updateExploration(state) {
  for (const { tile } of getBuildings(state)) {
    for (let y = tile.y - 3; y <= tile.y + 3; y += 1) {
      for (let x = tile.x - 3; x <= tile.x + 3; x += 1) {
        const candidate = getTile(state.map, x, y);
        if (candidate) candidate.explored = true;
      }
    }
  }
}

function updateConnectivity(state) {
  const hub = getBuildings(state).find(({ building }) => building.type === "hub");
  if (!hub) return;

  const queue = [hub.tile];
  const connectedKeys = new Set([adjacentKey(hub.tile.x, hub.tile.y)]);

  while (queue.length) {
    const tile = queue.shift();
    for (const [dx, dy] of DIRECTIONS) {
      const next = getTile(state.map, tile.x + dx, tile.y + dy);
      if (!next?.building) continue;
      const key = adjacentKey(next.x, next.y);
      if (connectedKeys.has(key)) continue;

      const nextSpec = BUILDINGS[next.building.type];
      const currentSpec = BUILDINGS[tile.building.type];
      const canCarry =
        nextSpec.logistic ||
        currentSpec.logistic ||
        next.building.type === "hub" ||
        tile.building.type === "hub";

      if (canCarry) {
        connectedKeys.add(key);
        queue.push(next);
      }
    }
  }

  for (const { tile, building } of getBuildings(state)) {
    building.connected = connectedKeys.has(adjacentKey(tile.x, tile.y));
  }
}

function recalculateStorage(state) {
  state.storage = cloneResourceMap(BUILDINGS.hub.storage);
  for (const { building, spec } of getBuildings(state)) {
    if (!building.connected || !spec.storage || building.health <= 0) continue;
    addResources(state.storage, spec.storage);
  }

  for (const resource of RESOURCE_KEYS) {
    state.resources[resource] = clamp(state.resources[resource] || 0, 0, state.storage[resource] || 0);
  }
}

function terrainAllowsBuild(tile, spec) {
  if (!spec.requiresTerrain) return tile.terrain !== TERRAIN_TYPES.RIFT;
  return spec.requiresTerrain.includes(tile.terrain);
}

function isAdjacentToNetwork(state, tile) {
  return DIRECTIONS.some(([dx, dy]) => {
    const neighbor = getTile(state.map, tile.x + dx, tile.y + dy);
    return neighbor?.building?.connected;
  });
}

function canBuild(state, type, x, y) {
  const spec = BUILDINGS[type];
  const tile = getTile(state.map, x, y);
  if (!spec) return { ok: false, reason: "Unknown structure." };
  if (!spec.buildable && type === "hub") return { ok: false, reason: "The command hub is unique." };
  if (!tile) return { ok: false, reason: "That tile is outside the mission zone." };
  if (!tile.explored) return { ok: false, reason: "Scout this area by expanding nearby first." };
  if (tile.building) return { ok: false, reason: "That tile is already occupied." };
  if (!terrainAllowsBuild(tile, spec)) return { ok: false, reason: `${spec.name} cannot be placed on ${tile.terrain}.` };
  if (!hasResources(state.resources, spec.cost)) return { ok: false, reason: `Not enough resources to build ${spec.name}.` };
  if (type !== "conveyor" && !isAdjacentToNetwork(state, tile)) {
    return { ok: false, reason: "Structures must touch a connected building or conveyor." };
  }
  if (type === "conveyor" && !isAdjacentToNetwork(state, tile)) {
    return { ok: false, reason: "Conveyors must extend from the existing network." };
  }

  return { ok: true, reason: "Ready to build." };
}

function buildStructure(state, type, x, y) {
  const result = canBuild(state, type, x, y);
  if (!result.ok) {
    pushEvent(state, "warning", result.reason);
    return result;
  }

  const spec = BUILDINGS[type];
  const tile = getTile(state.map, x, y);
  addResources(state.resources, spec.cost, -1);
  tile.building = {
    type,
    health: spec.maxHealth,
    connected: false,
    active: false,
  };
  state.selectedTile = { x, y };

  updateConnectivity(state);
  updateExploration(state);
  recalculateStorage(state);
  pushEvent(state, "build", `${spec.name} online at sector ${x + 1}.${y + 1}.`);
  return { ok: true, reason: `${spec.name} built.` };
}

function pushEvent(state, type, message) {
  const last = state.events[0];
  if (last?.message === message && state.tick - last.tick < 8) return;
  state.events.unshift({ tick: state.tick, type, message });
  state.events = state.events.slice(0, 12);
}

function activeMultiplier(state) {
  if (!state.activeEvent) return 1;
  if (state.activeEvent.type === "dustStorm") return 0.55;
  if (state.activeEvent.type === "coldSnap") return 0.85;
  return 1;
}

function consumeResource(state, resource, amount) {
  const available = state.resources[resource] || 0;
  const consumed = Math.min(available, amount);
  state.resources[resource] = available - consumed;
  return consumed / Math.max(amount, 0.001);
}

function applyProduction(state) {
  const buildings = getBuildings(state);
  let powerDemand = 0;
  let powerGeneration = 0;

  for (const { building, spec } of buildings) {
    if (!building.connected || building.health <= 0) {
      building.active = false;
      continue;
    }
    powerGeneration += spec.produces?.power || 0;
    powerDemand += spec.consumes?.power || 0;
  }

  const daylight = state.timeOfDay >= 6 && state.timeOfDay <= 18 ? 1 : 0.22;
  const eventPowerModifier = state.activeEvent?.type === "dustStorm" ? 0.35 : 1;
  const netGeneratedPower = powerGeneration * daylight * eventPowerModifier;
  state.resources.power = clamp(
    (state.resources.power || 0) + netGeneratedPower - powerDemand,
    0,
    state.storage.power,
  );

  const powerRatio = powerDemand <= 0 ? 1 : clamp((state.resources.power + netGeneratedPower) / powerDemand, 0.2, 1);

  for (const { building, spec } of buildings) {
    if (!building.connected || building.health <= 0) {
      building.active = false;
      continue;
    }

    let efficiency = activeMultiplier(state) * powerRatio * clamp(building.health / spec.maxHealth, 0.2, 1);
    for (const [resource, amount] of Object.entries(spec.consumes || {})) {
      if (resource === "power") continue;
      efficiency *= consumeResource(state, resource, amount);
    }

    building.active = efficiency > 0.35;
    for (const [resource, amount] of Object.entries(spec.produces || {})) {
      if (resource === "power") continue;
      state.resources[resource] = clamp(
        (state.resources[resource] || 0) + amount * efficiency,
        0,
        state.storage[resource],
      );
    }
  }
}

function applyPopulationNeeds(state) {
  const oxygenNeed = state.population * 0.23;
  const foodNeed = state.population * 0.09;
  const waterNeed = state.population * 0.11;
  const oxygenMet = consumeResource(state, "oxygen", oxygenNeed);
  const foodMet = consumeResource(state, "food", foodNeed);
  const waterMet = consumeResource(state, "water", waterNeed);
  const support = (oxygenMet + foodMet + waterMet) / 3;

  if (support < 0.65) {
    state.morale = clamp(state.morale - 1.9, 0, 100);
    pushEvent(state, "danger", "Life support shortage is hurting morale.");
  } else {
    state.morale = clamp(state.morale + 0.18, 0, 100);
  }

  if (state.morale <= 0) {
    state.population = Math.max(0, state.population - 1);
    state.morale = 18;
    pushEvent(state, "danger", "A colonist was lost after prolonged shortages.");
  }
}

function maybeStartEvent(state, random) {
  if (state.activeEvent) {
    state.activeEvent.remaining -= 1;
    if (state.activeEvent.remaining <= 0) {
      pushEvent(state, "system", `${state.activeEvent.label} has passed.`);
      state.activeEvent = null;
    }
    return;
  }

  const roll = random();
  const eventChance = 0.018 + state.threat * 0.002;
  if (roll > eventChance) return;

  if (roll < eventChance * 0.4) {
    state.activeEvent = { type: "dustStorm", label: "Dust storm", remaining: 18 };
    pushEvent(state, "warning", "Dust storm incoming: solar output and production efficiency reduced.");
    return;
  }

  if (roll < eventChance * 0.72) {
    state.activeEvent = { type: "coldSnap", label: "Cold snap", remaining: 14 };
    pushEvent(state, "warning", "Cold snap detected: colony operations are less efficient.");
    return;
  }

  triggerRaid(state, random);
}

function triggerRaid(state, random) {
  const defense = getBuildings(state).reduce((total, { building, spec }) => {
    if (!building.connected || !building.active) return total;
    return total + (spec.defense || 0);
  }, 0);
  const attack = 3 + state.threat * 0.7 + random() * 4;

  if (defense >= attack) {
    state.threat = clamp(state.threat + 1.1, 0, 20);
    pushEvent(state, "combat", "Raider drones intercepted by coil turrets.");
    return;
  }

  const damage = Math.ceil((attack - defense) * 22);
  const targets = getBuildings(state).filter(({ building }) => building.type !== "hub");
  const target = targets[Math.floor(random() * targets.length)] || getBuildings(state)[0];
  if (target) {
    target.building.health -= damage;
    pushEvent(state, "danger", `${BUILDINGS[target.building.type].name} took ${damage} raid damage.`);
    if (target.building.health <= 0) {
      target.tile.building = null;
      pushEvent(state, "danger", `${BUILDINGS[target.building.type].name} was destroyed.`);
    }
  }
  state.threat = clamp(state.threat + 1.7, 0, 20);
}

function applyWearAndThreat(state) {
  for (const { tile, building, spec } of getBuildings(state)) {
    if (building.type === "hub") continue;
    const decay = state.activeEvent?.type === "dustStorm" ? 0.18 : 0.04;
    building.health -= decay;
    if (building.health <= 0) {
      tile.building = null;
      pushEvent(state, "danger", `${spec.name} failed from accumulated wear.`);
    }
  }
  state.threat = clamp(state.threat + 0.012, 0, 20);
}

function updatePopulationCap(state) {
  const capacity =
    6 +
    getBuildings(state).reduce((total, { building, spec }) => {
      if (!building.connected || building.health <= 0) return total;
      return total + (spec.populationCap || 0);
    }, 0);

  if (state.population < capacity && state.morale > 68 && state.resources.food > state.population * 2) {
    state.population += 1;
    pushEvent(state, "system", "A new colonist arrived from orbit.");
  }
  if (state.population > capacity) {
    state.morale = clamp(state.morale - 1, 0, 100);
  }
}

function checkEndConditions(state) {
  const hub = getBuildings(state).find(({ building }) => building.type === "hub");
  if (!hub || state.population <= 0) {
    state.gameOver = true;
    pushEvent(state, "danger", "Mission failed. The outpost can no longer function.");
  }

  const hasCoreInfrastructure = ["iceExtractor", "oreDrill", "greenhouse", "habitat", "turret"].every((type) =>
    getBuildings(state).some(({ building }) => building.type === type && building.connected),
  );

  if (!state.victory && state.sol >= 12 && state.population >= 12 && hasCoreInfrastructure) {
    state.victory = true;
    pushEvent(state, "system", "Colony charter achieved: the settlement is self-sustaining.");
  }
}

function advanceSimulation(state, steps = 1) {
  const random = createSeededRandom(state.randomSeed + state.tick + 1);

  for (let i = 0; i < steps; i += 1) {
    if (state.gameOver) break;
    state.tick += 1;
    state.timeOfDay += 0.35;
    if (state.timeOfDay >= 24) {
      state.timeOfDay -= 24;
      state.sol += 1;
      pushEvent(state, "system", `Sol ${state.sol} begins.`);
    }

    updateConnectivity(state);
    updateExploration(state);
    recalculateStorage(state);
    applyProduction(state);
    applyPopulationNeeds(state);
    updatePopulationCap(state);
    maybeStartEvent(state, random);
    applyWearAndThreat(state);
    checkEndConditions(state);
  }

  return state;
}

function getTileSummary(state, x, y) {
  const tile = getTile(state.map, x, y);
  if (!tile) return null;
  const building = tile.building;
  const spec = building ? BUILDINGS[building.type] : null;
  return {
    x,
    y,
    terrain: tile.terrain,
    explored: tile.explored,
    building,
    buildingName: spec?.name || null,
    canBuildSelected: canBuild(state, state.selectedBuild, x, y),
  };
}

function getBuildOptions() {
  return BUILD_ORDER.map((type) => ({ type, ...BUILDINGS[type] }));
}

export {
  RESOURCE_KEYS,
  TERRAIN_TYPES,
  advanceSimulation,
  buildStructure,
  canBuild,
  createInitialState,
  getBuildOptions,
  getTile,
  getTileSummary,
  updateConnectivity,
};
