export type ResourceType = 'energy' | 'minerals' | 'credits' | 'research';

export type BuildingType =
  | 'power_plant'
  | 'mine'
  | 'shipyard'
  | 'research_lab'
  | 'habitat'
  | 'defense_grid';

export type ShipType = 'scout' | 'freighter' | 'frigate';

export type EmpirePriority = 'expand' | 'economy' | 'research' | 'defense' | 'balanced';

export type CompanionMode = 'advisory' | 'co_ruler' | 'autonomous';

export interface Resources {
  energy: number;
  minerals: number;
  credits: number;
  research: number;
}

export interface Building {
  id: string;
  type: BuildingType;
  level: number;
  planetId: string;
}

export interface Planet {
  id: string;
  name: string;
  type: 'terran' | 'desert' | 'ice' | 'gas_moon';
  population: number;
  maxPopulation: number;
  morale: number;
  buildingIds: string[];
  discovered: boolean;
}

export interface Fleet {
  scouts: number;
  freighters: number;
  frigates: number;
}

export interface ResearchProgress {
  current: string | null;
  completed: string[];
  progress: number;
}

export interface CompanionMemory {
  playerName: string;
  recentTopics: string[];
  lastAdvice: string | null;
}

export interface CompanionConfig {
  name: string;
  personality: string;
  mode: CompanionMode;
  priority: EmpirePriority;
  autoBuild: boolean;
  autoResearch: boolean;
  autoFleet: boolean;
}

export interface GameAction {
  type:
    | 'build'
    | 'upgrade_building'
    | 'start_research'
    | 'build_ship'
    | 'discover_planet'
    | 'set_priority'
    | 'set_mode'
    | 'message';
  planetId?: string;
  buildingType?: BuildingType;
  buildingId?: string;
  shipType?: ShipType;
  researchId?: string;
  priority?: EmpirePriority;
  mode?: CompanionMode;
  text?: string;
  quantity?: number;
}

export interface ActionLogEntry {
  tick: number;
  timestamp: string;
  actor: 'player' | 'companion';
  action: GameAction;
  summary: string;
}

export interface ChatMessage {
  id: string;
  role: 'player' | 'companion' | 'system';
  content: string;
  timestamp: string;
  actions?: GameAction[];
}

export interface EmpireState {
  id: string;
  empireName: string;
  tick: number;
  lastActiveAt: string;
  resources: Resources;
  planets: Planet[];
  buildings: Building[];
  fleet: Fleet;
  research: ResearchProgress;
  companion: CompanionConfig;
  companionMemory: CompanionMemory;
  actionLog: ActionLogEntry[];
  chatHistory: ChatMessage[];
  threats: number;
  stability: number;
}

export interface TickResult {
  state: EmpireState;
  events: string[];
  resourceDelta: Partial<Resources>;
}

export interface OfflineReport {
  ticksSimulated: number;
  hoursAway: number;
  events: string[];
  actionsTaken: ActionLogEntry[];
  resourceDelta: Partial<Resources>;
  companionMessage: string;
  updatedState?: EmpireState;
}

export interface ResearchDefinition {
  id: string;
  name: string;
  cost: number;
  description: string;
  unlocks?: BuildingType;
}

export interface BuildingDefinition {
  type: BuildingType;
  name: string;
  description: string;
  baseCost: Partial<Resources>;
  production: Partial<Resources>;
  upkeep: Partial<Resources>;
  maxLevel: number;
}

export interface ShipDefinition {
  type: ShipType;
  name: string;
  cost: Partial<Resources>;
  role: string;
}

export const BUILDINGS: Record<BuildingType, BuildingDefinition> = {
  power_plant: {
    type: 'power_plant',
    name: 'Fusion Reactor',
    description: 'Generates energy for your colony.',
    baseCost: { minerals: 80, credits: 40 },
    production: { energy: 12 },
    upkeep: { minerals: 1 },
    maxLevel: 5,
  },
  mine: {
    type: 'mine',
    name: 'Orbital Mine',
    description: 'Extracts minerals from the planet.',
    baseCost: { energy: 20, credits: 30 },
    production: { minerals: 8 },
    upkeep: { energy: 3 },
    maxLevel: 5,
  },
  shipyard: {
    type: 'shipyard',
    name: 'Orbital Shipyard',
    description: 'Constructs starships for exploration and defense.',
    baseCost: { minerals: 120, energy: 40, credits: 80 },
    production: {},
    upkeep: { energy: 5, credits: 2 },
    maxLevel: 3,
  },
  research_lab: {
    type: 'research_lab',
    name: 'Research Nexus',
    description: 'Advances your empire through science.',
    baseCost: { minerals: 100, energy: 30, credits: 60 },
    production: { research: 4 },
    upkeep: { energy: 4, credits: 1 },
    maxLevel: 5,
  },
  habitat: {
    type: 'habitat',
    name: 'Habitat Dome',
    description: 'Houses colonists and raises morale.',
    baseCost: { minerals: 60, energy: 15, credits: 40 },
    production: { credits: 3 },
    upkeep: { energy: 2 },
    maxLevel: 5,
  },
  defense_grid: {
    type: 'defense_grid',
    name: 'Planetary Defense Grid',
    description: 'Protects against raids and stabilizes the empire.',
    baseCost: { minerals: 90, energy: 25, credits: 50 },
    production: {},
    upkeep: { energy: 4, credits: 3 },
    maxLevel: 3,
  },
};

export const RESEARCH_TREE: ResearchDefinition[] = [
  {
    id: 'advanced_mining',
    name: 'Advanced Mining',
    cost: 50,
    description: 'Mines produce 25% more minerals.',
  },
  {
    id: 'efficient_fusion',
    name: 'Efficient Fusion',
    cost: 60,
    description: 'Reactors produce 25% more energy.',
  },
  {
    id: 'deep_space_scanning',
    name: 'Deep Space Scanning',
    cost: 80,
    description: 'Scouts discover new worlds faster.',
  },
  {
    id: 'modular_habitats',
    name: 'Modular Habitats',
    cost: 70,
    description: 'Habitats support 50% more population.',
  },
  {
    id: 'fleet_doctrine',
    name: 'Fleet Doctrine',
    cost: 90,
    description: 'Frigates are 20% cheaper to build.',
  },
];

export const SHIPS: Record<ShipType, ShipDefinition> = {
  scout: {
    type: 'scout',
    name: 'Scout Vessel',
    cost: { minerals: 40, energy: 10, credits: 20 },
    role: 'Explore and discover new planets.',
  },
  freighter: {
    type: 'freighter',
    name: 'Freighter',
    cost: { minerals: 60, energy: 15, credits: 35 },
    role: 'Boost trade income between colonies.',
  },
  frigate: {
    type: 'frigate',
    name: 'Frigate',
    cost: { minerals: 100, energy: 25, credits: 60 },
    role: 'Defend your borders and respond to threats.',
  },
};

export const TICK_MINUTES = 15;
