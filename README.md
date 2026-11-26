[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/c/best-flight-game-20261126-0057)
[![make.fun rank](https://make.fun/badge/best-flight-game-20261126-0057/L200150013/best-flight-game-entry/rank.svg)](https://make.fun/c/best-flight-game-20261126-0057)
[![make.fun reward](https://make.fun/badge/best-flight-game-20261126-0057/L200150013/best-flight-game-entry/reward.svg)](https://make.fun/c/best-flight-game-20261126-0057)

# POS LANGIT — Sky Post

A bush-mail flight game for the [make.fun best flight game bounty](https://make.fun/c/best-flight-game-20261126-0057).
Fly the **Merpati K-7**, a small high-wing mail plane, between airstrips across a
low-poly Indonesian archipelago: deliver the post, race the rings, and land
in a crosswind on a quarter tank of fuel.

## Missions

1. **Mail Run** — deliver parcels to three airstrips in order, against the
   clock and the fuel gauge. Cruise at 60–70% throttle to save fuel, or push
   it and risk arriving on fumes.
2. **Ring Rally** — fly through 8 rings in sequence. Precision against
   momentum: a hard bank bleeds the speed you need for the next ring.
3. **Storm Landing** — one shot at a short strip in a crosswind with 25%
   fuel. Crab, flare, touch down soft.

## Systems

- **Fuel** — burn scales with throttle; empty means an engine-out glide to
  the nearest strip.
- **Damage** — hard landings bend the gear (more drag, worse handling),
  overspeed past Vne hurts the controls, a terrain strike ends the sortie.
- **Flight model** — lift, drag, stall, flap/gear drag and a ground-effect
  cushion; coordinated turns are rewarded, sloppy banks cost speed.
- **Cameras** — spring-damped chase cam and a cockpit cam with three live
  3D gauges (airspeed, altimeter, heading) plus the full HUD.
- **Sound** — fully procedural WebAudio: engine drone, wind rush, gear
  clunk, touchdown thud, checkpoint chimes. No audio files.

## Controls

| Key | Action |
| --- | --- |
| W / S | Throttle up / down |
| ↑ / ↓ | Pitch |
| ← / → | Roll |
| A / D | Rudder |
| F | Flaps (up / 1 / 2) |
| G | Landing gear |
| B | Brakes |
| C | Camera (chase / cockpit) |
| P | Autopilot (holds heading, altitude, speed) |
| R | Restart mission |
| Esc | Pause |
| Mouse drag | Look around (chase view) |

## Play locally

```sh
node serve.ts        # serves game/ at http://127.0.0.1:8080
```

Open `game/index.html` through any static server; the game makes no network
requests at runtime. Screenshots in `screenshots/` are real renders of the
game, taken in Chromium with scripted input on the game's own code.

## Tech

- Three.js **0.160.0**, vendored at `game/vendor/three.module.min.js`
  (downloaded from `https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js`,
  sha256 `3e690ac7d180b0aadf0891bea39eec643e29e2d3e75c99b18689518665f69ba6`).
- Original code throughout: the terrain, aircraft, flight model, missions,
  gauges and sounds are all written for this entry. No copied assets.
- `main.ts` (Node 22, stdlib only) copies `game/` and `screenshots/` to the
  output directory and writes `dossier.json` via `vendor/makefun-game.ts`.

## License

MIT — see [LICENSE](LICENSE).
