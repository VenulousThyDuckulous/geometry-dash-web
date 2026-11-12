# Geometry Dash — Web Edition

A browser Geometry Dash clone: all **8 gamemodes**, GD-accurate physics, orbs, pads,
portals, speed changes, mini mode, practice mode and per-level best percentages.
Includes a **level editor** with every object and trigger, and a **level-sharing
backend** (Firebase) with username/password accounts that never ask for an email.
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

## Level editor

**Level editor** on the menu opens a grid-based editor:

| Action | Input |
| --- | --- |
| Place / paint | left click or drag |
| Erase | right click (or the Erase tool) |
| Select and edit properties | Select tool, then click an object |
| Scroll | wheel |
| Zoom | `Ctrl` + wheel, or the `−` / `+` buttons |
| Pan | `Shift` + drag, or middle-drag |
| Tools | `1` place, `2` erase, `3` select |
| Undo | `Ctrl` + `Z` |
| Delete selection | `Delete` |

Every object and trigger lives in [`js/objects.js`](js/objects.js), which the
palette, the compiler and the validator all read from:

- **Terrain** — block, slab, pillar, big block, thin platform, custom width/height
- **Hazards** — spike, small spike, ceiling spikes, small and large saws
- **Orbs** — yellow, pink, blue, green, black, red
- **Pads** — yellow, pink, blue, red
- **Portals** — all 8 gamemode portals, both gravity directions, 0.5x–4x speed,
  mini/normal size, plus mirror and dual (stored; the sim stays unmirrored and
  single-player)
- **Special** — secret coin, key, checkpoint, finish line, teleport
- **Triggers** — move, rotate, scale, alpha, toggle, spawn, stop, pulse, colour,
  each with target group and duration/offset parameters
- **Decoration** — glow orb, pulse line, text plate

Objects can be assigned to a **group**; triggers act on a group (translate, hide,
spawn, stop), and `move` updates collision as well as the drawing. The `alpha`,
`rotate`, `scale`, `pulse` and `colour` triggers are authored and round-tripped but
not simulated yet.

**Playtest** runs the level immediately, **Save** keeps a draft in this browser and
**Upload** publishes it to the community list.

## Accounts and uploading

Accounts are **username + password, no email**. Firebase Auth has no native
username-only sign-up, so the app derives an internal address
`username@gdweb.local`; the player never sees it.

- With a Firebase config in [`js/firebase-config.js`](js/firebase-config.js): real
  accounts and a shared community list.
- Without one: identical behaviour backed by `localStorage`, so the editor, sign-up
  and upload flow work offline in a single browser.

Setup steps, the Firestore data model and the security rules are in
[`firebase/README.md`](firebase/README.md); the rules themselves live in
[`firebase/firestore.rules`](firebase/firestore.rules). Levels are readable by
anyone and writable only by their author.

## Project layout

```
index.html          shell + menu/hud/editor/account overlays
styles.css          neon UI + editor chrome
js/constants.js     physics constants, per-speed and per-mode tables
js/level.js         level builder + the 22 main levels + sandbox + themes
js/objects.js       object + trigger catalog, level compiler, fairness maths
js/editor.js        grid editor: palette, placement, properties, undo
js/cloud.js         accounts + level uploads (Firebase, localStorage fallback)
js/firebase-config.js  your Firebase web config (null = local-only mode)
js/official-levels.js  exact copies imported from level data (empty by default)
js/game.js          240 Hz simulation, collisions, portals, orbs, pads, triggers
js/render.js        canvas renderer (gamemode icons, portals, saws, coins, hitboxes)
js/audio.js         procedural soundtrack + SFX via WebAudio
js/main.js          screens, input, fixed-timestep loop, localStorage progress
firebase/           Firestore rules + backend setup guide
tools/validate.mjs  headless physics, fairness and fuzz checks
tools/gdimport.mjs  imports exact levels from Geometry Dash level data
```

## Checks

```bash
node tools/validate.mjs   # physics, spike-cluster fairness, level structure, fuzz run
npm run check             # syntax check every module
```

The fairness check is the one that caught the playability bug: a jump only keeps
the player above a spike for `jumpWindow()` units, so a cluster of N adjacent
spikes is only legal if it fits with a human-sized timing margin. Three adjacent
spikes leave 0.02 s at 1x and are **impossible** at 0.5x, so the generator caps
clusters at two and the validator fails the build if any level regresses.

## Exact official levels

The 22 levels in [js/level.js](js/level.js) are rebuilt from the real gamemode
sequences, speeds and difficulties, but they are reconstructions built from the
section list. To play the **exact** layouts, import the level data that ships
with the game:

1. Copy `Resources/LevelData.plist` out of your Geometry Dash install (Steam:
   `steamapps/common/Geometry Dash/Resources/`), or export a level as `.gmd`.
2. Put it anywhere in the project, e.g. `levels/gd/LevelData.plist`.
3. Import it:

```bash
node tools/gdimport.mjs levels/gd/LevelData.plist
```

The importer decodes the base64 + zlib level strings, maps the gameplay objects
(blocks, spikes, orbs, pads, gamemode/gravity/speed portals, end wall) onto the
block grid, shifts the ground to `y = 0` and writes `js/official-levels.js`.
Each imported level replaces the generated level with the same name and keeps
its difficulty and palette; decoration is skipped. Re-run it any time to refresh.

The official level data belongs to RobTop, so it is not in this repository —
`js/official-levels.js` ships empty and the game falls back to the generated
levels. `node tools/validate.mjs` round-trips a level string through the
importer on every run, so the decoding path stays tested.

## Local server

```bash
python3 -m http.server 3004
# then open http://localhost:3004
```

## Deploying

Hosted with GitHub Pages from the `main` branch root — no Actions needed.
