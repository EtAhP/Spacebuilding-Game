import type {
  ActionLogEntry,
  Building,
  BuildingType,
  ChatMessage,
  CompanionConfig,
  EmpirePriority,
  EmpireState,
  Fleet,
  GameAction,
  OfflineReport,
  Planet,
  ResearchProgress,
  Resources,
  ShipType,
  TickResult,
} from './types.js';
import {
  BUILDINGS,
  RESEARCH_TREE,
  SHIPS,
  TICK_MINUTES,
} from './types.js';

const STARTER_PLANETS: Omit<Planet, 'buildingIds'>[] = [
  {
    id: 'home',
    name: 'Nova Prime',
    type: 'terran',
    population: 1200,
    maxPopulation: 5000,
    morale: 72,
    discovered: true,
  },
  {
    id: 'frontier',
    name: 'Cinder Reach',
    type: 'desert',
    population: 0,
    maxPopulation: 3000,
    morale: 50,
    discovered: false,
  },
  {
    id: 'ice',
    name: 'Glacier IV',
    type: 'ice',
    population: 0,
    maxPopulation: 2500,
    morale: 45,
    discovered: false,
  },
];

function nowIso(): string {
  return new Date().toISOString();
}

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function cloneResources(resources: Resources): Resources {
  return { ...resources };
}

function canAfford(resources: Resources, cost: Partial<Resources>): boolean {
  return (Object.entries(cost) as [keyof Resources, number][]).every(
    ([key, amount]) => resources[key] >= amount,
  );
}

function spend(resources: Resources, cost: Partial<Resources>): Resources {
  const next = cloneResources(resources);
  for (const [key, amount] of Object.entries(cost) as [keyof Resources, number][]) {
    next[key] -= amount;
  }
  return next;
}

function addResources(resources: Resources, delta: Partial<Resources>): Resources {
  const next = cloneResources(resources);
  for (const [key, amount] of Object.entries(delta) as [keyof Resources, number][]) {
    next[key] += amount;
  }
  return next;
}

function buildingCost(type: BuildingType, level: number): Partial<Resources> {
  const def = BUILDINGS[type];
  const multiplier = Math.pow(1.5, level - 1);
  const cost: Partial<Resources> = {};
  for (const [key, amount] of Object.entries(def.baseCost) as [keyof Resources, number][]) {
    cost[key] = Math.floor(amount * multiplier);
  }
  return cost;
}

function shipCost(type: ShipType, completedResearch: string[]): Partial<Resources> {
  const def = SHIPS[type];
  const cost = { ...def.cost };
  if (completedResearch.includes('fleet_doctrine') && type === 'frigate') {
    cost.minerals = Math.floor((cost.minerals ?? 0) * 0.8);
    cost.credits = Math.floor((cost.credits ?? 0) * 0.8);
  }
  return cost;
}

function getPlanetBuildings(state: EmpireState, planetId: string): Building[] {
  return state.buildings.filter((building) => building.planetId === planetId);
}

function hasShipyard(state: EmpireState, planetId: string): boolean {
  return getPlanetBuildings(state, planetId).some((b) => b.type === 'shipyard');
}

function logAction(
  state: EmpireState,
  actor: 'player' | 'companion',
  action: GameAction,
  summary: string,
): ActionLogEntry {
  return {
    tick: state.tick,
    timestamp: nowIso(),
    actor,
    action,
    summary,
  };
}

export function createNewEmpire(empireName: string, playerName: string): EmpireState {
  const homeBuildings: Building[] = [
    { id: uid('building'), type: 'power_plant', level: 1, planetId: 'home' },
    { id: uid('building'), type: 'mine', level: 1, planetId: 'home' },
    { id: uid('building'), type: 'habitat', level: 1, planetId: 'home' },
  ];

  const planets: Planet[] = STARTER_PLANETS.map((planet) => ({
    ...planet,
    buildingIds: planet.id === 'home' ? homeBuildings.map((b) => b.id) : [],
  }));

  const companion: CompanionConfig = {
    name: 'Astra',
    personality: 'Strategic, warm, and fiercely loyal to the empire.',
    mode: 'co_ruler',
    priority: 'balanced',
    autoBuild: true,
    autoResearch: true,
    autoFleet: false,
  };

  const welcome: ChatMessage = {
    id: uid('chat'),
    role: 'companion',
    content: `Commander ${playerName}, I am ${companion.name}, your imperial advisor. I'll help you grow ${empireName} while you're here — and keep things running when you're away. What should we focus on first?`,
    timestamp: nowIso(),
  };

  return {
    id: uid('empire'),
    empireName,
    tick: 0,
    lastActiveAt: nowIso(),
    resources: {
      energy: 120,
      minerals: 90,
      credits: 150,
      research: 0,
    },
    planets,
    buildings: homeBuildings,
    fleet: { scouts: 1, freighters: 0, frigates: 0 },
    research: { current: null, completed: [], progress: 0 },
    companion,
    companionMemory: {
      playerName,
      recentTopics: [],
      lastAdvice: null,
    },
    actionLog: [],
    chatHistory: [welcome],
    threats: 12,
    stability: 78,
  };
}

function applyProductionMultiplier(
  production: Partial<Resources>,
  research: ResearchProgress,
): Partial<Resources> {
  const next = { ...production };
  if (research.completed.includes('advanced_mining') && next.minerals) {
    next.minerals = Math.floor(next.minerals * 1.25);
  }
  if (research.completed.includes('efficient_fusion') && next.energy) {
    next.energy = Math.floor(next.energy * 1.25);
  }
  return next;
}

function applyUpkeepMultiplier(
  upkeep: Partial<Resources>,
  level: number,
): Partial<Resources> {
  const next: Partial<Resources> = {};
  for (const [key, amount] of Object.entries(upkeep) as [keyof Resources, number][]) {
    next[key] = amount * level;
  }
  return next;
}

export function simulateTick(state: EmpireState): TickResult {
  const events: string[] = [];
  const resourceDelta: Partial<Resources> = {
    energy: 0,
    minerals: 0,
    credits: 0,
    research: 0,
  };

  let resources = cloneResources(state.resources);
  let research = { ...state.research };
  let planets = state.planets.map((planet) => ({ ...planet }));
  let threats = state.threats;
  let stability = state.stability;

  for (const building of state.buildings) {
    const def = BUILDINGS[building.type];
    const production = applyProductionMultiplier(def.production, state.research);
    const scaledProduction: Partial<Resources> = {};
    for (const [key, amount] of Object.entries(production) as [keyof Resources, number][]) {
      scaledProduction[key] = amount * building.level;
    }
    resources = addResources(resources, scaledProduction);
    for (const [key, amount] of Object.entries(scaledProduction) as [keyof Resources, number][]) {
      resourceDelta[key] = (resourceDelta[key] ?? 0) + amount;
    }

    const upkeep = applyUpkeepMultiplier(def.upkeep, building.level);
    resources = addResources(
      resources,
      Object.fromEntries(
        Object.entries(upkeep).map(([key, amount]) => [key, -(amount as number)]),
      ) as Partial<Resources>,
    );
    for (const [key, amount] of Object.entries(upkeep) as [keyof Resources, number][]) {
      resourceDelta[key] = (resourceDelta[key] ?? 0) - amount;
    }
  }

  for (const planet of planets) {
    if (planet.population > 0) {
      const tax = Math.floor(planet.population / 400);
      resources.credits += tax;
      resourceDelta.credits = (resourceDelta.credits ?? 0) + tax;
    }
  }

  resources.credits += state.fleet.freighters * 2;
  resourceDelta.credits = (resourceDelta.credits ?? 0) + state.fleet.freighters * 2;

  if (research.current) {
    const labOutput = state.buildings
      .filter((b) => b.type === 'research_lab')
      .reduce((sum, b) => sum + b.level * 2, 0);
    const gain = 2 + labOutput;
    research.progress += gain;
    resourceDelta.research = (resourceDelta.research ?? 0) + gain;

    const currentDef = RESEARCH_TREE.find((r) => r.id === research.current);
    if (currentDef && research.progress >= currentDef.cost) {
      research.completed = [...research.completed, currentDef.id];
      research.current = null;
      research.progress = 0;
      events.push(`Research complete: ${currentDef.name}`);
      stability = Math.min(100, stability + 3);
    }
  }

  if (
    state.fleet.scouts > 0 &&
    Math.random() < 0.08 + (state.research.completed.includes('deep_space_scanning') ? 0.05 : 0)
  ) {
    const hidden = planets.find((p) => !p.discovered);
    if (hidden) {
      hidden.discovered = true;
      events.push(`Scouts discovered ${hidden.name}.`);
    }
  }

  const defenseRating = state.buildings
    .filter((b) => b.type === 'defense_grid')
    .reduce((sum, b) => sum + b.level * 4, 0);
  const fleetDefense = state.fleet.frigates * 5;
  const threatRoll = Math.random() * 100;
  if (threatRoll < state.threats - defenseRating - fleetDefense) {
    const loss = Math.floor(Math.random() * 8) + 4;
    resources.minerals = Math.max(0, resources.minerals - loss);
    resources.energy = Math.max(0, resources.energy - Math.floor(loss / 2));
    resourceDelta.minerals = (resourceDelta.minerals ?? 0) - loss;
    resourceDelta.energy = (resourceDelta.energy ?? 0) - Math.floor(loss / 2);
    stability = Math.max(0, stability - 4);
    events.push(`Raiders struck a supply convoy. Lost ${loss} minerals.`);
  } else if (defenseRating + fleetDefense > 10) {
    threats = Math.max(0, threats - 1);
  }

  for (const planet of planets) {
    if (planet.population > 0) {
      const growth = Math.floor(planet.morale / 40);
      planet.population = Math.min(planet.maxPopulation, planet.population + growth);
      planet.morale = Math.max(20, Math.min(100, planet.morale + (stability > 70 ? 1 : -1)));
    }
  }

  if (resources.energy < 0) {
    stability = Math.max(0, stability - 2);
    events.push('Energy shortages are hurting morale.');
  }

  return {
    state: {
      ...state,
      tick: state.tick + 1,
      lastActiveAt: nowIso(),
      resources,
      planets,
      research,
      threats,
      stability,
    },
    events,
    resourceDelta,
  };
}

export function applyAction(
  state: EmpireState,
  action: GameAction,
  actor: 'player' | 'companion' = 'player',
): { state: EmpireState; summary: string; ok: boolean } {
  switch (action.type) {
    case 'build': {
      if (!action.planetId || !action.buildingType) {
        return { state, summary: 'Missing build target.', ok: false };
      }
      const planet = state.planets.find((p) => p.id === action.planetId);
      if (!planet || !planet.discovered) {
        return { state, summary: 'Planet unavailable.', ok: false };
      }
      const cost = buildingCost(action.buildingType, 1);
      if (!canAfford(state.resources, cost)) {
        return { state, summary: 'Insufficient resources.', ok: false };
      }
      const building: Building = {
        id: uid('building'),
        type: action.buildingType,
        level: 1,
        planetId: action.planetId,
      };
      const summary = `Built ${BUILDINGS[action.buildingType].name} on ${planet.name}.`;
      const entry = logAction(state, actor, action, summary);
      return {
        ok: true,
        summary,
        state: {
          ...state,
          resources: spend(state.resources, cost),
          buildings: [...state.buildings, building],
          planets: state.planets.map((p) =>
            p.id === planet.id ? { ...p, buildingIds: [...p.buildingIds, building.id] } : p,
          ),
          actionLog: [entry, ...state.actionLog].slice(0, 200),
        },
      };
    }
    case 'upgrade_building': {
      if (!action.buildingId) {
        return { state, summary: 'Missing building.', ok: false };
      }
      const building = state.buildings.find((b) => b.id === action.buildingId);
      if (!building) {
        return { state, summary: 'Building not found.', ok: false };
      }
      const def = BUILDINGS[building.type];
      if (building.level >= def.maxLevel) {
        return { state, summary: 'Building is max level.', ok: false };
      }
      const cost = buildingCost(building.type, building.level + 1);
      if (!canAfford(state.resources, cost)) {
        return { state, summary: 'Insufficient resources.', ok: false };
      }
      const planet = state.planets.find((p) => p.id === building.planetId);
      const summary = `Upgraded ${def.name} to level ${building.level + 1} on ${planet?.name ?? 'unknown'}.`;
      const entry = logAction(state, actor, action, summary);
      return {
        ok: true,
        summary,
        state: {
          ...state,
          resources: spend(state.resources, cost),
          buildings: state.buildings.map((b) =>
            b.id === building.id ? { ...b, level: b.level + 1 } : b,
          ),
          actionLog: [entry, ...state.actionLog].slice(0, 200),
        },
      };
    }
    case 'start_research': {
      if (!action.researchId) {
        return { state, summary: 'Missing research.', ok: false };
      }
      if (state.research.current) {
        return { state, summary: 'Research already in progress.', ok: false };
      }
      if (state.research.completed.includes(action.researchId)) {
        return { state, summary: 'Research already completed.', ok: false };
      }
      const def = RESEARCH_TREE.find((r) => r.id === action.researchId);
      if (!def) {
        return { state, summary: 'Unknown research.', ok: false };
      }
      const summary = `Started research: ${def.name}.`;
      const entry = logAction(state, actor, action, summary);
      return {
        ok: true,
        summary,
        state: {
          ...state,
          research: { ...state.research, current: def.id, progress: 0 },
          actionLog: [entry, ...state.actionLog].slice(0, 200),
        },
      };
    }
    case 'build_ship': {
      if (!action.shipType || !action.planetId) {
        return { state, summary: 'Missing ship order.', ok: false };
      }
      if (!hasShipyard(state, action.planetId)) {
        return { state, summary: 'Shipyard required.', ok: false };
      }
      const cost = shipCost(action.shipType, state.research.completed);
      if (!canAfford(state.resources, cost)) {
        return { state, summary: 'Insufficient resources.', ok: false };
      }
      const fleet: Fleet = { ...state.fleet };
      const shipKey = `${action.shipType}s` as keyof Fleet;
      fleet[shipKey] = fleet[shipKey] + (action.quantity ?? 1);
      const summary = `Constructed ${action.quantity ?? 1} ${SHIPS[action.shipType].name}(s).`;
      const entry = logAction(state, actor, action, summary);
      return {
        ok: true,
        summary,
        state: {
          ...state,
          resources: spend(state.resources, cost),
          fleet,
          actionLog: [entry, ...state.actionLog].slice(0, 200),
        },
      };
    }
    case 'discover_planet': {
      const hidden = state.planets.find((p) => !p.discovered);
      if (!hidden) {
        return { state, summary: 'No hidden worlds remain.', ok: false };
      }
      if (state.fleet.scouts < 1) {
        return { state, summary: 'Scouts required.', ok: false };
      }
      const summary = `Scouts charted ${hidden.name}.`;
      const entry = logAction(state, actor, action, summary);
      return {
        ok: true,
        summary,
        state: {
          ...state,
          planets: state.planets.map((p) =>
            p.id === hidden.id ? { ...p, discovered: true } : p,
          ),
          actionLog: [entry, ...state.actionLog].slice(0, 200),
        },
      };
    }
    case 'set_priority': {
      if (!action.priority) {
        return { state, summary: 'Missing priority.', ok: false };
      }
      const summary = `Imperial priority set to ${action.priority}.`;
      const entry = logAction(state, actor, action, summary);
      return {
        ok: true,
        summary,
        state: {
          ...state,
          companion: { ...state.companion, priority: action.priority },
          actionLog: [entry, ...state.actionLog].slice(0, 200),
        },
      };
    }
    case 'set_mode': {
      if (!action.mode) {
        return { state, summary: 'Missing mode.', ok: false };
      }
      const summary = `Companion mode set to ${action.mode}.`;
      const entry = logAction(state, actor, action, summary);
      return {
        ok: true,
        summary,
        state: {
          ...state,
          companion: { ...state.companion, mode: action.mode },
          actionLog: [entry, ...state.actionLog].slice(0, 200),
        },
      };
    }
    case 'message':
    default:
      return { state, summary: 'Message recorded.', ok: true };
  }
}

function chooseCompanionAction(state: EmpireState): GameAction | null {
  const { companion } = state;
  if (companion.mode === 'advisory') {
    return null;
  }

  const home = state.planets.find((p) => p.id === 'home');
  if (!home) return null;

  const homeBuildings = getPlanetBuildings(state, home.id);
  const power = homeBuildings.filter((b) => b.type === 'power_plant');
  const mines = homeBuildings.filter((b) => b.type === 'mine');
  const labs = homeBuildings.filter((b) => b.type === 'research_lab');
  const shipyards = homeBuildings.filter((b) => b.type === 'shipyard');
  const habitats = homeBuildings.filter((b) => b.type === 'habitat');
  const defenses = homeBuildings.filter((b) => b.type === 'defense_grid');

  const priority = companion.priority;

  if (companion.autoResearch && !state.research.current) {
    const next = RESEARCH_TREE.find((r) => !state.research.completed.includes(r.id));
    if (next) {
      return { type: 'start_research', researchId: next.id };
    }
  }

  if (priority === 'research' && companion.autoBuild && labs.length < 2) {
    const cost = buildingCost('research_lab', 1);
    if (canAfford(state.resources, cost)) {
      return { type: 'build', planetId: home.id, buildingType: 'research_lab' };
    }
  }

  if (priority === 'defense') {
    if (companion.autoFleet && shipyards.length > 0 && state.fleet.frigates < 2) {
      const cost = shipCost('frigate', state.research.completed);
      if (canAfford(state.resources, cost)) {
        return { type: 'build_ship', planetId: home.id, shipType: 'frigate' };
      }
    }
    if (companion.autoBuild && defenses.length < 1) {
      const cost = buildingCost('defense_grid', 1);
      if (canAfford(state.resources, cost)) {
        return { type: 'build', planetId: home.id, buildingType: 'defense_grid' };
      }
    }
  }

  if (priority === 'expand') {
    const hidden = state.planets.find((p) => !p.discovered);
    if (hidden && state.fleet.scouts > 0) {
      return { type: 'discover_planet' };
    }
    const colonyTarget = state.planets.find(
      (p) => p.discovered && p.id !== 'home' && p.population === 0,
    );
    if (colonyTarget && companion.autoBuild && habitats.length < 2) {
      const cost = buildingCost('habitat', 1);
      if (canAfford(state.resources, cost)) {
        return { type: 'build', planetId: colonyTarget.id, buildingType: 'habitat' };
      }
    }
  }

  if (state.resources.energy < 40 && companion.autoBuild) {
    const upgradeTarget = power.sort((a, b) => a.level - b.level)[0];
    if (upgradeTarget && upgradeTarget.level < BUILDINGS.power_plant.maxLevel) {
      const cost = buildingCost('power_plant', upgradeTarget.level + 1);
      if (canAfford(state.resources, cost)) {
        return { type: 'upgrade_building', buildingId: upgradeTarget.id };
      }
    }
    const cost = buildingCost('power_plant', 1);
    if (canAfford(state.resources, cost)) {
      return { type: 'build', planetId: home.id, buildingType: 'power_plant' };
    }
  }

  if (state.resources.minerals < 50 && companion.autoBuild) {
    const upgradeTarget = mines.sort((a, b) => a.level - b.level)[0];
    if (upgradeTarget && upgradeTarget.level < BUILDINGS.mine.maxLevel) {
      const cost = buildingCost('mine', upgradeTarget.level + 1);
      if (canAfford(state.resources, cost)) {
        return { type: 'upgrade_building', buildingId: upgradeTarget.id };
      }
    }
    const cost = buildingCost('mine', 1);
    if (canAfford(state.resources, cost)) {
      return { type: 'build', planetId: home.id, buildingType: 'mine' };
    }
  }

  if (priority === 'economy' && companion.autoBuild && habitats.length < 3) {
    const cost = buildingCost('habitat', 1);
    if (canAfford(state.resources, cost)) {
      return { type: 'build', planetId: home.id, buildingType: 'habitat' };
    }
  }

  if (shipyards.length === 0 && companion.autoBuild) {
    const cost = buildingCost('shipyard', 1);
    if (canAfford(state.resources, cost)) {
      return { type: 'build', planetId: home.id, buildingType: 'shipyard' };
    }
  }

  return null;
}

export function runCompanionTurn(state: EmpireState): EmpireState {
  if (state.companion.mode === 'advisory') {
    return state;
  }

  const action = chooseCompanionAction(state);
  if (!action) {
    return state;
  }

  const result = applyAction(state, action, 'companion');
  return result.ok ? result.state : state;
}

export function advanceEmpire(state: EmpireState, ticks: number): EmpireState {
  let current = state;
  for (let i = 0; i < ticks; i += 1) {
    const tickResult = simulateTick(current);
    current = tickResult.state;
    if (current.companion.mode !== 'advisory') {
      current = runCompanionTurn(current);
    }
  }
  return current;
}

export function simulateOfflineProgress(state: EmpireState, now = new Date()): OfflineReport {
  const lastActive = new Date(state.lastActiveAt);
  const msAway = Math.max(0, now.getTime() - lastActive.getTime());
  const hoursAway = msAway / (1000 * 60 * 60);
  const ticksSimulated = Math.min(Math.floor(hoursAway * (60 / TICK_MINUTES)), 96);

  const startResources = cloneResources(state.resources);
  let current = state;
  const actionsTaken: ActionLogEntry[] = [];
  const events: string[] = [];

  for (let i = 0; i < ticksSimulated; i += 1) {
    const beforeActions = current.actionLog.length;
    const tickResult = simulateTick(current);
    current = tickResult.state;
    events.push(...tickResult.events);

    if (current.companion.mode !== 'advisory') {
      current = runCompanionTurn(current);
    }

    const newEntries = current.actionLog.slice(0, current.actionLog.length - beforeActions);
    actionsTaken.push(...newEntries);
  }

  const resourceDelta: Partial<Resources> = {};
  for (const key of ['energy', 'minerals', 'credits', 'research'] as const) {
    resourceDelta[key] = current.resources[key] - startResources[key];
  }

  const companionMessage =
    ticksSimulated === 0
      ? `${state.companion.name} stands ready at your side.`
      : buildOfflineMessage(state, ticksSimulated, actionsTaken, resourceDelta, events);

  const reportMessage: ChatMessage = {
    id: uid('chat'),
    role: 'companion',
    content: companionMessage,
    timestamp: nowIso(),
  };

  current = {
    ...current,
    lastActiveAt: now.toISOString(),
    chatHistory: [reportMessage, ...current.chatHistory].slice(0, 100),
  };

  return {
    ticksSimulated,
    hoursAway: Math.round(hoursAway * 10) / 10,
    events: events.slice(0, 12),
    actionsTaken: actionsTaken.slice(0, 20),
    resourceDelta,
    companionMessage,
    updatedState: current,
  };
}

function buildOfflineMessage(
  state: EmpireState,
  ticks: number,
  actions: ActionLogEntry[],
  delta: Partial<Resources>,
  events: string[],
): string {
  const name = state.companion.name;
  const actionText =
    actions.length > 0
      ? `While you were away I completed ${actions.length} orders, including ${actions
          .slice(0, 3)
          .map((a) => a.summary.toLowerCase())
          .join('; ')}.`
      : 'I held the line and kept production steady — no major orders were needed.';

  const deltaText = `Net change: ${formatDelta(delta)}.`;
  const eventText =
    events.length > 0 ? `Notable events: ${events.slice(0, 2).join(' ')}` : 'The frontier stayed quiet.';

  return `Welcome back, Commander. I managed the empire for ${ticks} cycles (~${TICK_MINUTES} min each). ${actionText} ${deltaText} ${eventText}`;
}

function formatDelta(delta: Partial<Resources>): string {
  return (
    (Object.entries(delta) as [keyof Resources, number][])
      .filter(([, value]) => value !== 0)
      .map(([key, value]) => `${value > 0 ? '+' : ''}${value} ${key}`)
      .join(', ') || 'stable resources'
  );
}

export function getAvailableResearch(state: EmpireState): string[] {
  return RESEARCH_TREE.filter((r) => !state.research.completed.includes(r.id)).map((r) => r.id);
}

export function summarizeEmpire(state: EmpireState): string {
  const discovered = state.planets.filter((p) => p.discovered).length;
  return [
    `Empire: ${state.empireName}`,
    `Tick: ${state.tick}`,
    `Resources: E${state.resources.energy} M${state.resources.minerals} C${state.resources.credits} R${state.resources.research}`,
    `Planets discovered: ${discovered}/${state.planets.length}`,
    `Fleet: ${state.fleet.scouts} scouts, ${state.fleet.frigates} frigates, ${state.fleet.freighters} freighters`,
    `Research: ${state.research.current ?? 'none in progress'}`,
    `Threats: ${state.threats}, Stability: ${state.stability}`,
    `Companion: ${state.companion.name} (${state.companion.mode}, priority ${state.companion.priority})`,
  ].join('\n');
}

export function setCompanionPriority(state: EmpireState, priority: EmpirePriority): EmpireState {
  return applyAction(state, { type: 'set_priority', priority }, 'player').state;
}
