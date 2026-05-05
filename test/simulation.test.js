import test from "node:test";
import assert from "node:assert/strict";

import {
  BUILDINGS,
  advanceSimulation,
  buildStructure,
  canBuild,
  createInitialState,
  getBuildOptions,
  getTile,
  updateConnectivity,
} from "../src/simulation.js";

function hubPosition(state) {
  return { x: Math.floor(state.width / 2), y: Math.floor(state.height / 2) };
}

test("builds structures only when affordable, explored, and unoccupied", () => {
  const state = createInitialState({ seed: 12 });
  const hub = hubPosition(state);
  const target = getTile(state, hub.x + 1, hub.y);

  assert.equal(buildStructure(state, "solar", target.x, target.y).ok, true);
  assert.equal(target.building.type, "solar");

  assert.equal(buildStructure(state, "solar", target.x, target.y).ok, false);

  state.resources.metal = 0;
  const nextTile = getTile(state, hub.x - 1, hub.y);
  assert.equal(canBuild(state, "greenhouse", nextTile.x, nextTile.y).ok, false);
});

test("connected extractors produce resources for the colony", () => {
  const state = createInitialState({ seed: 1 });
  const hub = hubPosition(state);
  const target = getTile(state, hub.x + 1, hub.y);
  target.terrain = "ice";
  state.resources.water = 0;

  assert.equal(buildStructure(state, "iceExtractor", target.x, target.y).ok, true);
  advanceSimulation(state, 8);

  assert.equal(target.building.connected, true);
  assert.ok(state.resources.water > 0);
});

test("remote industry waits for a conveyor connection", () => {
  const state = createInitialState({ seed: 3 });
  const hub = hubPosition(state);
  const remote = getTile(state, hub.x + 3, hub.y);
  remote.terrain = "ore";
  remote.explored = true;

  assert.equal(buildStructure(state, "oreDrill", remote.x, remote.y).ok, false);

  assert.equal(buildStructure(state, "conveyor", hub.x + 1, hub.y).ok, true);
  assert.equal(buildStructure(state, "conveyor", hub.x + 2, hub.y).ok, true);
  assert.equal(buildStructure(state, "oreDrill", remote.x, remote.y).ok, true);

  state.resources.metal = 0;
  advanceSimulation(state, 8);

  assert.equal(remote.building.connected, true);
  assert.ok(state.resources.metal > 0);
});

test("survival shortages reduce morale", () => {
  const state = createInitialState({ seed: 4 });
  state.resources.oxygen = 0;
  state.resources.food = 0;
  state.resources.water = 0;
  const moraleBefore = state.morale;

  advanceSimulation(state, 3);

  assert.ok(state.morale < moraleBefore);
  assert.ok(state.events.some((event) => event.message.includes("Life support shortage")));
});

test("storage buildings expand resource capacity only when connected", () => {
  const state = createInitialState({ seed: 6 });
  const hub = hubPosition(state);
  const target = getTile(state, hub.x + 1, hub.y);

  const storageBefore = state.storage.power;
  assert.equal(buildStructure(state, "battery", target.x, target.y).ok, true);

  assert.ok(state.storage.power > storageBefore);
});

test("structure catalogue exposes colony, logistics, and defense roles", () => {
  const types = new Set(getBuildOptions().map((structure) => structure.type));

  for (const required of [
    "conveyor",
    "solar",
    "battery",
    "iceExtractor",
    "oreDrill",
    "siliconKiln",
    "greenhouse",
    "habitat",
    "turret",
  ]) {
    assert.equal(types.has(required), true);
  }

  assert.equal(BUILDINGS.hub.storage.oxygen, 100);
  assert.equal(typeof updateConnectivity, "function");
});
