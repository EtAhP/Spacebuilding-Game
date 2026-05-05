import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Android PWA shell references manifest, service worker, and icon", async () => {
  const [html, manifestText, sw] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../manifest.webmanifest", import.meta.url), "utf8"),
    readFile(new URL("../sw.js", import.meta.url), "utf8"),
  ]);
  const manifest = JSON.parse(manifestText);

  assert.match(html, /<link rel="manifest" href="\.\/manifest\.webmanifest"/);
  assert.match(html, /id="install-button"/);
  assert.match(html, /id="fullscreen-button"/);
  assert.equal(manifest.display, "fullscreen");
  assert.equal(manifest.orientation, "landscape");
  assert.equal(manifest.icons[0].src, "assets/icon.svg");
  assert.match(sw, /\.\/assets\/icon\.svg/);
  assert.match(sw, /\.\/src\/simulation\.js/);
});
