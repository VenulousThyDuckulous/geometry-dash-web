// Headless checks: physics sanity + a fuzz simulation over every level.
// Run with: node tools/validate.mjs

import * as C from '../js/constants.js';
import { LEVELS, LevelBuilder, THEMES } from '../js/level.js';
import { Game } from '../js/game.js';

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) failures++;
}

// ---------------------------------------------------------------------------
// 1. Physics measurements through the real simulation
// ---------------------------------------------------------------------------
function flatLevel() {
  const l = new LevelBuilder('flat', 'Test', THEMES.neon, 'neon');
  l.finish(400);
  return l.done();
}

function measureJump(speedIdx) {
  const g = new Game(flatLevel(), false);
  g.p.speed = speedIdx;
  let t = 0;
  let apex = 0;
  let startX = null;
  // settle one tick on the ground
  g.tick(false);
  const y0 = g.p.y;
  let pressed = false;
  while (t < 2) {
    // hold for one tick only (a plain tap)
    const down = !pressed;
    pressed = true;
    g.tick(down);
    t += C.DT;
    if (startX === null && g.p.vy > 0) startX = g.p.x;
    apex = Math.max(apex, g.p.y - y0);
    if (g.p.onGround && t > 0.05) break;
    if (g.p.dead) break;
  }
  return { apex: apex / C.BLOCK, dist: (g.p.x - startX) / C.BLOCK };
}

const expected = {
  0: { apex: 2.11, dist: 3.26 },
  1: { apex: 2.41, dist: 4.47 },
  2: { apex: 2.52, dist: 5.56 },
  3: { apex: 2.44, dist: 6.71 },
  4: { apex: 2.44, dist: 8.25 },
};

for (let i = 0; i < C.SPEEDS.length; i++) {
  const m = measureJump(i);
  const e = expected[i];
  check(
    `cube jump @ ${C.SPEEDS[i].label}`,
    Math.abs(m.apex - e.apex) < 0.12 && Math.abs(m.dist - e.dist) < 0.2,
    `apex ${m.apex.toFixed(2)} blocks (want ~${e.apex}), length ${m.dist.toFixed(2)} blocks (want ~${e.dist})`
  );
}

// horizontal speed: units travelled in one second
{
  const g = new Game(flatLevel(), false);
  const x0 = g.p.x;
  for (let i = 0; i < C.TPS; i++) g.tick(false);
  const bps = (g.p.x - x0) / C.BLOCK;
  check('1x horizontal speed', Math.abs(bps - 10.386) < 0.05, `${bps.toFixed(3)} blocks/sec (documented 10.386)`);
}

// terminal fall speed
{
  const g = new Game(flatLevel(), false);
  g.p.y = 315;
  g.p.onGround = false;
  let vmax = 0;
  for (let i = 0; i < 200; i++) {
    g.tick(false);
    vmax = Math.max(vmax, Math.abs(g.p.vy));
  }
  check(
    'terminal fall speed clamps at 15 vels',
    Math.abs(vmax - C.MAX_FALL) < 1,
    `${(vmax / 60).toFixed(2)} vels (documented 15)`
  );
}

// wave is exactly 45 degrees
{
  const g = new Game(flatLevel(), false);
  g.p.mode = 'wave';
  g.p.y = 160;
  g.p.onGround = false;
  const x0 = g.p.x;
  const y0 = g.p.y;
  for (let i = 0; i < C.TPS / 4; i++) g.tick(true);
  const dx = g.p.x - x0;
  const dy = g.p.y - y0;
  check('wave angle', Math.abs(Math.abs(dy / dx) - 1) < 0.02, `${(Math.atan2(dy, dx) * 180 / Math.PI).toFixed(2)} deg`);
}

// ship velocity clamps
{
  const g = new Game(flatLevel(), false);
  g.p.mode = 'ship';
  g.p.y = 160;
  g.p.onGround = false;
  for (let i = 0; i < C.TPS; i++) g.tick(true);
  check('ship climb clamp', g.p.vy <= C.SHIP_MAX_UP + 1, `${(g.p.vy / 60).toFixed(2)} vels (max 8)`);
}

// ---------------------------------------------------------------------------
// 2. Level structure
// ---------------------------------------------------------------------------
const MODE_VALUES = new Set(C.MODES);
for (const lv of LEVELS) {
  check(`${lv.name}: has finish`, lv.length > 0, `${(lv.length / C.BLOCK) | 0} blocks`);
  check(`${lv.name}: no object past the level end`, lv.objects.every((o) => o.x0 <= lv.length + 1));
  const badPortals = lv.objects.filter(
    (o) => o.t === 'portal' && o.kind === 'mode' && !MODE_VALUES.has(o.value)
  );
  check(`${lv.name}: mode portals valid`, badPortals.length === 0);
  const offGround = lv.objects.filter((o) => o.t === 'portal' && o.kind !== 'gravity' && o.y0 !== 0 && o.y0 !== 90);
  check(`${lv.name}: portals placed on the floor/easy reach`, offGround.length === 0, `${offGround.length} high portals`);
  // spawn area must be clear
  const nearSpawn = lv.objects.filter((o) => o.x0 < 5 * C.BLOCK);
  check(`${lv.name}: spawn clear`, nearSpawn.length === 0);
}

// every gamemode appears somewhere
const used = new Set();
for (const lv of LEVELS) for (const o of lv.objects) if (o.t === 'portal' && o.kind === 'mode') used.add(o.value);
check('all 8 gamemodes present in the level set', C.MODES.every((m) => used.has(m)), [...used].join(','));

const orbColors = new Set();
const padColors = new Set();
for (const lv of LEVELS) for (const o of lv.objects) {
  if (o.t === 'orb') orbColors.add(o.color);
  if (o.t === 'pad') padColors.add(o.color);
}
check('orbs used', orbColors.size >= 4, [...orbColors].join(','));
check('pads used', padColors.size >= 4, [...padColors].join(','));

// ---------------------------------------------------------------------------
// 3. Fuzz run: random input through every level, no exceptions, no NaNs
// ---------------------------------------------------------------------------
for (const lv of LEVELS) {
  const g = new Game(lv, true);
  let err = null;
  let deaths = 0;
  let wasDead = false;
  let down = false;
  let maxX = 0;
  try {
    for (let i = 0; i < 240 * 70; i++) {
      if (i % 37 === 0) down = Math.random() < 0.55;
      g.tick(down);
      if (!Number.isFinite(g.p.x) || !Number.isFinite(g.p.y)) throw new Error('non-finite position');
      if (g.p.y < -10 || g.p.y > 340) throw new Error(`player out of bounds at ${g.p.x | 0},${g.p.y | 0}`);
      maxX = Math.max(maxX, g.p.x);
      if (g.p.dead && !wasDead) { deaths++; wasDead = true; }
      if (g.p.dead && g.deadTimer > 0.5) { g.restart(); wasDead = false; down = false; }
      if (g.p.won) break;
    }
  } catch (e) {
    err = e;
  }
  check(`${lv.name}: 70s fuzz run`, !err, err ? err.message : `${deaths} deaths, reached ${(maxX / C.BLOCK) | 0} blocks`);
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
