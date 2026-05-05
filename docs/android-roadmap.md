# Android Mars Colony Builder Roadmap

This project should aim for an original Mars survival colony builder rather than a direct copy of any existing game. The reference point is the genre mix: dome/city planning, life-support logistics, resource chains, disasters, colonist needs, and long-form colony growth.

## Current target

The first Android target is a high-end-device progressive web app:

- Installable from Chrome on Android via the web app manifest.
- Fullscreen, landscape-first layout with safe-area handling.
- Offline-capable static assets through the service worker.
- High-DPI canvas rendering capped to a practical pixel ratio for performance.
- Touch/pointer input for tile selection and construction.

This keeps the prototype lightweight while preserving a migration path to native Android later.

## High-end Android assumptions

- Modern Chromium-based WebView or Chrome.
- 8 GB RAM class device or better.
- Recent Snapdragon/Dimensity flagship or upper-midrange GPU.
- Landscape play as the primary experience.
- Touch controls first, with mouse/keyboard as secondary support on tablets and desktop.

## Native Android path

If the game outgrows the browser shell, the next packaging step should be either:

1. Trusted Web Activity for Play Store distribution of the PWA, or
2. Capacitor if native Android APIs such as storage, haptics, or billing become necessary.

A full native engine rewrite should wait until the design needs 3D terrain, large colony simulation, or GPU-heavy effects beyond what Canvas/WebGL can comfortably support.

## Gameplay systems to add next

- Dome placement and pressure/comfort zones.
- Colonist traits, jobs, age groups, and sanity/health needs.
- Shuttle/drone logistics distinct from conveyor infrastructure.
- Multi-stage resources such as concrete, machine parts, polymers, electronics, fuel, and rare metals.
- Research tree with unlocks for life support, terraforming, robotics, and defense.
- Disaster stack: cold waves, dust storms, meteor showers, supply delays, and system failures.
- Sector scanning and expedition map.
- Save/load using IndexedDB for browser/PWA builds.

## Performance guardrails

- Keep simulation ticks deterministic and independent from render frame rate.
- Avoid per-frame DOM rebuilds for unchanged panels once the UI grows.
- Use sprite atlases or WebGL before adding many animated entities.
- Cap device pixel ratio and expose a quality setting.
- Profile on physical Android hardware before raising map size or entity count.
