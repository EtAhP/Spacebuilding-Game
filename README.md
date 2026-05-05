# Ares Colony Prototype

A small browser-playable Mars survival colony builder prototype. It is designed as original gameplay in the same broad genre as Mars colony management games, with installable Android PWA support for high-end devices.

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

On Android Chrome, use the in-game **Install on Android** prompt or the browser menu to install it as a fullscreen app.

## Run tests

```bash
npm test
```

For syntax checks plus tests:

```bash
npm run validate
```

The tests cover the simulation layer that powers production, logistics connectivity, construction costs, hostile events, and Android PWA file wiring.

## Prototype controls

1. Choose a structure from the build menu.
2. Click a tile on the map to build it.
3. Use conveyors to connect new structures to the hub.
4. Watch the colony status panel and event log for warnings.

Resource deposits are color coded on the map. Extractors and kilns only work on matching terrain, and all production structures must stay connected to the hub over the logistics network.

## Android direction

See [`docs/android-roadmap.md`](docs/android-roadmap.md) for the high-end Android roadmap, packaging options, performance targets, and guidance on staying original while building a Mars survival city-builder.
