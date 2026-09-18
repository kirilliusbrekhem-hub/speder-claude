# Solace City — Web Runner

An **original**, browser-playable 3D web-swinging action prototype built with
[Three.js](https://threejs.org/). This is not a copy of any existing
commercial game — the hero, city, enemies, and story are original creations
made for this project. No third-party characters, artwork, audio, or code
from any licensed franchise are used.

## Story

You are **VOLT**, an amateur inventor whose experimental grapple-web harness
turned you into Solace City's unofficial guardian. Rogue Sentinel drones are
swarming the skyline — swing between the towers, take them down, and reach
the Beacon Tower to secure the city.

## How to run

No build step or dependencies are required — it's a static site.

1. Serve the folder with any static file server (recommended, so the
   Pointer Lock API works reliably), e.g.:
   ```bash
   npx http-server .
   # or
   python3 -m http.server 8080
   ```
2. Open the served URL (e.g. `http://localhost:8080`) in a modern desktop
   browser (Chrome, Edge, or Firefox).
3. Click **"Click to Begin"** to capture the mouse and start playing.

You can also open `index.html` directly by double-clicking it, but running
it through a local server avoids any browser quirks with pointer lock and
module loading.

## Controls

| Input | Action |
|---|---|
| `W A S D` | Move |
| Mouse | Look around / aim camera |
| `Shift` | Sprint |
| `Space` | Jump (on ground) / release web-swing (in air) |
| Hold `Left Mouse Button` (while airborne, aimed at a building) | Fire web and swing |
| `W` / `S` while swinging | Shorten / lengthen the web rope (climb or descend) |
| `F` | Melee strike |
| `Esc` | Pause / resume |

## Gameplay systems

- **Procedurally generated city** — a grid of varied-height skyscrapers with
  neon accent strips and rooftop antennas, generated from a seeded random
  function so the layout is consistent between sessions.
- **Web-swing traversal** — a raycast-based anchor system finds a building
  point ahead of the camera; swinging is simulated with a constrained
  pendulum (verlet-style) integrator, with player-steerable tangential
  force and rope-length control.
- **Rooftop/street collision** — the player can run and jump across street
  level or land directly on rooftops; simple AABB collision handles both
  vertical support and side pushout against building facades.
- **Melee combat** — arc-based strikes against nearby enemies, with a combo
  counter that resets after a short window without a hit.
- **Enemy AI** — Sentinel drones patrol, aggro when the player gets close,
  chase, and attack in a simple finite-state machine.
- **Wave-based mission structure** — three escalating waves of drones,
  followed by a final objective: reach the glowing Beacon Tower at the edge
  of the city.
- **HUD** — health bar, web-fluid resource (drains while swinging,
  regenerates while grounded), live mission text, and a combo counter.

## Project structure

```
index.html   Page shell, HUD markup, start/pause overlays
style.css    All HUD and overlay styling
game.js      Scene setup, city generation, player controller, physics,
             combat, enemy AI, mission/wave manager, camera rig, HUD updates
```

## Notes / possible next steps

This is a single-session prototype, not a finished game. Natural next steps
would be: wall-running, a stealth/takedown mechanic, more enemy archetypes,
collectibles, a minimap, sound design, and mobile/gamepad input support.
