# Geometry Dash — Web Edition

A browser Geometry Dash clone: all **8 gamemodes**, GD-accurate physics, orbs, pads,
portals, speed changes, mini mode, practice mode and per-level best percentages.
No build step, no dependencies — plain ES modules and a canvas.

## Play

Open `index.html` (or the GitHub Pages URL). Everything runs client-side.

| Action | Input |
| --- | --- |
| Jump / hold to fly | `Space`, `↑`, `W`, `Z`, click or tap |
| Pause | `Esc` / `P` |
| Restart | `R` |
| Toggle hitboxes | `H` |
| Toggle music | `M` |
| Switch gamemode (Physics Lab) | `1`–`8` |

## Gamemodes

| Mode | Control | Behaviour |
| --- | --- | --- |
| **Cube** | hold to jump | jumps only on the ground, hold auto-jumps |
| **Ship** | hold to rise | thrust vs gravity, ±8 / −6.4 vels clamped |
| **Ball** | click flips gravity | small velocity in the new gravity direction |
| **UFO** | click midair | discrete 7-vel hop, 6.4-vel terminal fall |
| **Wave** | hold up / release down | constant 45° at every speed |
| **Robot** | hold for height | gravity suspended while held, capped hold time |
| **Spider** | click teleports | raycasts to the next surface and flips gravity |
| **Swing** | click flips gravity | velocity × 0.8 each flip |

Also implemented: gravity portals, 0.5x/1x/2x/3x/4x speed portals, mini/normal size
portals, all six orb colours (yellow, pink, red, blue, green, black) with per-mode
strengths, four pad colours, and the two-hitbox model.

## Physics accuracy

The engine runs at **240 ticks/sec** like GD 2.2 and uses the documented unit system:
1 block = 30 units, 1 vel = 60 units/sec.

| Quantity | Value | Source |
| --- | --- | --- |
| Gravity | 0.216 vels/tick → 3110.4 units/s² | gd-docs, 240 TPS figure |
| Terminal fall | 15 vels (900 units/s) | gd-docs gamemode table |
| Cube jump @ 1x | 11.18 vels → 2.41 blocks apex, 4.47 blocks long | gd-docs per-speed table |
| 1x scroll | 10.386 blocks/sec (311.58 units/s) | measured in-game |
| Ship | +8 / −6.4 vels | gd-docs |
| UFO | 7-vel impulse, 6.4-vel terminal | gd-docs |
| Wave | 5.193 vels @ 1x = exactly 45° | gd-docs |
| Robot | 5.59 vels held, gravity off while holding | gd-docs |
| Spike hitbox | 12×22 units inside a 30-unit cell | gd-docs hitbox page |
| Player hitboxes | solid 30 (wave 9), hazard 30 (wave 10) | gd-docs hitbox table |

Jump velocities are taken per speed portal (10.62 / 11.18 / 11.42 / 11.23 / 11.23 vels),
so jump arcs stay ~2.4 blocks tall while covering more ground at higher speeds, which is
how the real game behaves. Orb strengths use the documented per-mode multipliers
(e.g. cube pink = 0.72 × jump, robot yellow = 0.9 × jump, ship yellow = 8 vels).

Practice mode drops checkpoints every ~1.1s of grounded progress, like GD's practice run.

## Levels

The 22 main levels of Geometry Dash, in release order, each rebuilt with its real
gamemode sequence, speed portals and difficulty rating:

| # | Level | Difficulty | Gamemodes |
| --- | --- | --- | --- |
| 1 | Stereo Madness | Easy | cube, ship |
| 2 | Back On Track | Easy | cube, ship |
| 3 | Polargeist | Normal | cube, ship |
| 4 | Dry Out | Normal | cube (inverted) |
| 5 | Base After Base | Hard | cube, ship |
| 6 | Can't Let Go | Hard | cube, ship (inverted) |
| 7 | Jumper | Harder | cube, ship (inverted) |
| 8 | Time Machine | Harder | cube, ship |
| 9 | Cycles | Harder | cube, ball, ship |
| 10 | xStep | Insane | cube, ball, ship |
| 11 | Clutterfunk | Insane | cube, ship, ball (mini) |
| 12 | Theory of Everything | Insane | cube, ship, ball, UFO (mini) |
| 13 | Electroman Adventures | Insane | cube, ship, ball, UFO (mini) |
| 14 | Clubstep | Demon | cube, ship, ball, UFO (mini) |
| 15 | Electrodynamix | Insane | cube, ship, ball, UFO (2x → 3x) |
| 16 | Hexagon Force | Insane | cube, ship, ball, UFO (2x, mini, 0.5x finish) |
| 17 | Blast Processing | Harder | cube, ship, ball, UFO, wave |
| 18 | Theory of Everything 2 | Demon | cube, ship, ball, UFO, wave (mini, 2x/0.5x) |
| 19 | Geometrical Dominator | Harder | cube, ship, ball, UFO, wave, robot |
| 20 | Deadlocked | Demon | cube, ship, ball, UFO, wave, robot (mini, 3x/4x) |
| 21 | Fingerdash | Insane | cube, ship, UFO, wave, robot, spider |
| 22 | Dash | Insane | all seven plus swing (4x sections) |

Plus **Physics Lab** (Sandbox) — a flat playground with pads, orbs and steps where
`1`–`8` swap gamemodes anywhere.

Each level is a list of sections in [js/level.js](js/level.js):

```js
['ship', 8, 2, 'mini'],   // mode, % of the level, speed portal index, 'mini'/'inv'
```

A per-gamemode motif library fills each section, and obstacle spacing is computed
from the physics constants rather than hand-tuned: a cube jump covers
`speed × 2·v/g` blocks, so gaps scale automatically when a speed portal changes.
Portal stacks are tall gates, so a section change still lands when the player
arrives high out of a flight sequence.

*Not reproduced: mirror portals (Time Machine, Cycles, Blast Processing) — those
sections play in the normal direction — and dual mode (Hexagon Force, Blast
Processing, Dash).*

## Project layout

```
index.html        shell + menu/hud overlays
styles.css        neon UI
js/constants.js   physics constants, per-speed and per-mode tables
js/level.js       level builder + the 22 main levels + sandbox + themes
js/game.js        240 Hz simulation, collisions, portals, orbs, pads, checkpoints
js/render.js      canvas renderer (all gamemode icons, portals, particles, hitboxes)
js/audio.js       procedural soundtrack + SFX via WebAudio
js/main.js        screens, input, fixed-timestep loop, localStorage progress
tools/validate.mjs headless physics + fuzz checks
```

## Checks

```bash
node tools/validate.mjs   # physics measurements, level structure, fuzz run
npm run check             # syntax check every module
```

## Local server

```bash
python3 -m http.server 3004
# then open http://localhost:3004
```

## Deploying

Hosted with GitHub Pages from the `main` branch root — no Actions needed.
