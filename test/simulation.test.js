import test from "node:test";
import assert from "node:assert/strict";

import {
  BUILDINGS,
  GameState,
  STRUCTURES,
  canAfford,
  getBuildCost,
} from "../src/simulation.js";

test("builds structures only when affordable and unoccupied", () => {
  const game = new GameState({ seed: 12 });
  const iron = game.map.tiles.find((tile) => tile.deposit === "iron");

  assert.equal(game.build("extractor", iron.x, iron.y).ok, true);
  assert.equal(game.tileAt(iron.x, iron.y).building.type, "extractor");

  assert.equal(game.build("extractor", iron.x, iron.y).ok, false);

  game.resources.polymer = 0;
  const freeTile = game.map.tiles.find((tile) => !tile.building && !tile.deposit);
  assert.equal(canAfford(game.resources, getBuildCost("greenhouse")), false);
  assert.equal(game.build("greenhouse", freeTile.x, freeTile.y).ok, false);
});

test("connected extractors and conveyor links move resources into the colony", () => {
  const game = new GameState({ seed: 1 });
  const hub = game.getHub();
  const target = game.tileAt(hub.x - 1, hub.y);

  target.deposit = "ice";
  game.build("extractor", target.x, target.y);
  const waterBefore = game.resources.water;

  for (let i = 0; i < 60; i += 1) {
    game.tick(1);
  }

  assert.equal(target.connected, true);
  assert.ok(game.resources.water > waterBefore);
});

test("unconnected industry does not operate until logistics reach it", () => {
  const game = new GameState({ seed: 3 });
  const hub = game.getHub();
  const remote = game.tileAt(hub.x + 3, hub.y);
  remote.deposit = "iron";

  game.build("extractor", remote.x, remote.y);
  const metalBefore = game.resources.metal;

  for (let i = 0; i < 40; i += 1) {
    game.tick(1);
  }

  assert.equal(remote.connected, false);
  assert.equal(game.resources.metal, metalBefore);

  game.build("conveyor", hub.x + 1, hub.y);
  game.build("conveyor", hub.x + 2, hub.y);

  for (let i = 0; i < 40; i += 1) {
    game.tick(1);
  }

  assert.equal(remote.connected, true);
  assert.ok(game.resources.metal > metalBefore);
});

test("power shortages reduce production and damage morale", () => {
  const game = new GameState({ seed: 4 });
  const hub = game.getHub();
  const greenhouse = game.tileAt(hub.x + 1, hub.y);
  game.build("greenhouse", greenhouse.x, greenhouse.y);

  game.resources.power = 0;
  const foodBefore = game.resources.food;
  const moraleBefore = game.morale;

  for (let i = 0; i < 10; i += 1) {
    game.tick(1);
  }

  assert.equal(game.resources.food, foodBefore);
  assert.ok(game.morale < moraleBefore);
  assert.ok(game.alerts.some((alert) => alert.includes("Power grid")));
});

test("raider wave damages exposed buildings", () => {
  const game = new GameState({ seed: 5 });
  const hub = game.getHub();
  const target = game.tileAt(hub.x + 1, hub.y);
  game.build("solar", target.x, target.y);

  const hpBefore = target.building.hp;
  game.raiderDamage = 30;
  game.triggerRaiderWave();

  assert.ok(target.building.hp < hpBefore);
  assert.ok(game.alerts[0].includes("Raider drones"));
});

test("structure catalogue exposes strategic roles", () => {
  const types = new Set(STRUCTURES.map((structure) => structure.type));

  for (const required of [
    "solar",
    "extractor",
    "conveyor",
    "smelter",
    "habitat",
    "greenhouse",
    "waterReclaimer",
    "oxygenGenerator",
    "turret",
  ]) {
    assert.equal(types.has(required), true);
  }

  assert.equal(BUILDINGS.hub.provides.shelter, 8);
});
