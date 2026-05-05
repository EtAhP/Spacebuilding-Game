# Ares Outpost Prototype

A small browser-playable survival automation prototype inspired by colony builders, conveyor factory games, and Mars survival management.

## Core loop

- Place extractors on resource deposits.
- Connect every structure back to the command hub with conveyors.
- Mine ore, ice, and silica to feed construction and life support.
- Balance power, oxygen, water, food, and housing while colonists arrive.
- Survive dust storms and raider waves as threat pressure rises.

## Run locally

```bash
npm run serve
```

Open `http://localhost:8080` in a browser.

## Run tests

```bash
npm test
```

The tests cover the simulation layer that powers production, logistics connectivity, construction costs, and hostile events.

## Prototype controls

1. Choose a structure from the build menu.
2. Click a tile on the map to build it.
3. Use conveyors to connect new structures to the hub.
4. Watch the colony status panel and event log for warnings.

Resource deposits are color coded on the map. Extractors and kilns only work on matching terrain, and all production structures must stay connected to the hub over the logistics network.
