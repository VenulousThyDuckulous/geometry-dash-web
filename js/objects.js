// Shared object catalog: the editor palette, the level compiler and the
// documentation all read from this one table, so anything you can place is
// something the engine actually understands.
//
// Every editor level is plain JSON:
//   { name, author, difficulty, theme, track, length, objects: [ {t, x, y, ...} ] }
// and `compileLevel()` turns that into a LevelBuilder for the simulation.

import { BLOCK, SPEEDS, GRAVITY } from './constants.js';

export const CATEGORIES = [
  { id: 'terrain', label: 'Terrain' },
  { id: 'hazard', label: 'Hazards' },
  { id: 'orb', label: 'Orbs' },
  { id: 'pad', label: 'Pads' },
  { id: 'portal', label: 'Portals' },
  { id: 'special', label: 'Special' },
  { id: 'trigger', label: 'Triggers' },
  { id: 'deco', label: 'Decoration' },
];

// ---------------------------------------------------------------------------
// Palette entries.
//   shape:  how the editor draws it
//   params: editable trigger/property schema { key: {label, min, max, step, def} }
//   note:   shown in the editor when the runtime only handles it partially
// ---------------------------------------------------------------------------
export const OBJECTS = [
  // --- terrain -----------------------------------------------------------
  { id: 'block', label: 'Block', cat: 'terrain', kind: 'block', w: 1, h: 1, shape: 'block' },
  { id: 'slab', label: 'Slab', cat: 'terrain', kind: 'block', w: 2, h: 1, shape: 'block' },
  { id: 'pillar', label: 'Pillar', cat: 'terrain', kind: 'block', w: 1, h: 2, shape: 'block' },
  { id: 'bigblock', label: 'Big Block', cat: 'terrain', kind: 'block', w: 2, h: 2, shape: 'block' },
  { id: 'platform', label: 'Thin Platform', cat: 'terrain', kind: 'block', w: 3, h: 0.5, shape: 'block' },
  {
    id: 'customblock', label: 'Custom Block', cat: 'terrain', kind: 'block', w: 1, h: 1, shape: 'block',
    params: { w: { label: 'w', min: 0.5, max: 20, step: 0.5, def: 1 }, h: { label: 'h', min: 0.5, max: 20, step: 0.5, def: 1 } },
  },

  // --- hazards -----------------------------------------------------------
  { id: 'spike', label: 'Spike', cat: 'hazard', kind: 'spike', dir: 1, shape: 'spike' },
  { id: 'spikeSmall', label: 'Small Spike', cat: 'hazard', kind: 'spike', dir: 1, small: true, shape: 'spike' },
  { id: 'spikeDown', label: 'Ceiling Spike', cat: 'hazard', kind: 'spike', dir: -1, shape: 'spike' },
  { id: 'spikeDownSmall', label: 'Ceiling Spike (small)', cat: 'hazard', kind: 'spike', dir: -1, small: true, shape: 'spike' },
  { id: 'saw', label: 'Saw (small)', cat: 'hazard', kind: 'saw', r: 0.6, shape: 'saw' },
  { id: 'sawBig', label: 'Saw (large)', cat: 'hazard', kind: 'saw', r: 1.1, shape: 'saw' },

  // --- orbs --------------------------------------------------------------
  { id: 'orbYellow', label: 'Yellow Orb', cat: 'orb', kind: 'orb', color: 'yellow', shape: 'orb' },
  { id: 'orbPink', label: 'Pink Orb', cat: 'orb', kind: 'orb', color: 'pink', shape: 'orb' },
  { id: 'orbBlue', label: 'Blue Orb', cat: 'orb', kind: 'orb', color: 'blue', shape: 'orb' },
  { id: 'orbGreen', label: 'Green Orb', cat: 'orb', kind: 'orb', color: 'green', shape: 'orb' },
  { id: 'orbBlack', label: 'Black Orb', cat: 'orb', kind: 'orb', color: 'black', shape: 'orb' },
  { id: 'orbRed', label: 'Red Orb', cat: 'orb', kind: 'orb', color: 'red', shape: 'orb' },

  // --- pads --------------------------------------------------------------
  { id: 'padYellow', label: 'Yellow Pad', cat: 'pad', kind: 'pad', color: 'yellow', shape: 'pad' },
  { id: 'padPink', label: 'Pink Pad', cat: 'pad', kind: 'pad', color: 'pink', shape: 'pad' },
  { id: 'padBlue', label: 'Blue Pad', cat: 'pad', kind: 'pad', color: 'blue', shape: 'pad' },
  { id: 'padRed', label: 'Red Pad', cat: 'pad', kind: 'pad', color: 'red', shape: 'pad' },

  // --- portals -----------------------------------------------------------
  { id: 'pCube', label: 'Portal: Cube', cat: 'portal', kind: 'portal', pkind: 'mode', value: 'cube', shape: 'portal' },
  { id: 'pShip', label: 'Portal: Ship', cat: 'portal', kind: 'portal', pkind: 'mode', value: 'ship', shape: 'portal' },
  { id: 'pBall', label: 'Portal: Ball', cat: 'portal', kind: 'portal', pkind: 'mode', value: 'ball', shape: 'portal' },
  { id: 'pUfo', label: 'Portal: UFO', cat: 'portal', kind: 'portal', pkind: 'mode', value: 'ufo', shape: 'portal' },
  { id: 'pWave', label: 'Portal: Wave', cat: 'portal', kind: 'portal', pkind: 'mode', value: 'wave', shape: 'portal' },
  { id: 'pRobot', label: 'Portal: Robot', cat: 'portal', kind: 'portal', pkind: 'mode', value: 'robot', shape: 'portal' },
  { id: 'pSpider', label: 'Portal: Spider', cat: 'portal', kind: 'portal', pkind: 'mode', value: 'spider', shape: 'portal' },
  { id: 'pSwing', label: 'Portal: Swing', cat: 'portal', kind: 'portal', pkind: 'mode', value: 'swing', shape: 'portal' },
  { id: 'gDown', label: 'Gravity: Down', cat: 'portal', kind: 'portal', pkind: 'gravity', value: -1, shape: 'portal' },
  { id: 'gUp', label: 'Gravity: Up', cat: 'portal', kind: 'portal', pkind: 'gravity', value: 1, shape: 'portal' },
  { id: 's005', label: 'Speed: 0.5x', cat: 'portal', kind: 'portal', pkind: 'speed', value: 0, shape: 'portal' },
  { id: 's1', label: 'Speed: 1x', cat: 'portal', kind: 'portal', pkind: 'speed', value: 1, shape: 'portal' },
  { id: 's2', label: 'Speed: 2x', cat: 'portal', kind: 'portal', pkind: 'speed', value: 2, shape: 'portal' },
  { id: 's3', label: 'Speed: 3x', cat: 'portal', kind: 'portal', pkind: 'speed', value: 3, shape: 'portal' },
  { id: 's4', label: 'Speed: 4x', cat: 'portal', kind: 'portal', pkind: 'speed', value: 4, shape: 'portal' },
  { id: 'zMini', label: 'Size: Mini', cat: 'portal', kind: 'portal', pkind: 'size', value: 'mini', shape: 'portal' },
  { id: 'zNormal', label: 'Size: Normal', cat: 'portal', kind: 'portal', pkind: 'size', value: 'normal', shape: 'portal' },
  { id: 'mirror', label: 'Mirror (visual)', cat: 'portal', kind: 'portal', pkind: 'mirror', value: 1, shape: 'portal', note: 'stored, but the sim never mirrors gameplay' },
  { id: 'dual', label: 'Dual (visual)', cat: 'portal', kind: 'portal', pkind: 'dual', value: 1, shape: 'portal', note: 'single-player sim only' },
  {
    id: 'customPortal', label: 'Portal (custom height)', cat: 'portal', kind: 'portal', pkind: 'mode', value: 'cube', shape: 'portal',
    params: { h: { label: 'height', min: 30, max: 320, step: 30, def: 240 } },
  },

  // --- special -----------------------------------------------------------
  { id: 'coin', label: 'Secret Coin', cat: 'special', kind: 'coin', shape: 'coin' },
  { id: 'key', label: 'Key', cat: 'special', kind: 'coin', shape: 'coin' },
  { id: 'checkpoint', label: 'Checkpoint', cat: 'special', kind: 'checkpoint', shape: 'checkpoint' },
  { id: 'finish', label: 'Finish Line', cat: 'special', kind: 'finish', shape: 'finish' },
  {
    id: 'teleport', label: 'Teleport In', cat: 'special', kind: 'teleport', shape: 'teleport',
    params: { to: { label: 'radius', min: 1, max: 5, step: 0.5, def: 2 } },
  },

  // --- triggers ----------------------------------------------------------
  {
    id: 'trMove', label: 'Move', cat: 'trigger', kind: 'trigger', tt: 'move', shape: 'trigger',
    params: {
      target: { label: 'group', min: 1, max: 999, step: 1, def: 1 },
      dx: { label: 'dx', min: -30, max: 30, step: 0.5, def: 0 },
      dy: { label: 'dy', min: -10, max: 10, step: 0.5, def: 2 },
      dur: { label: 'seconds', min: 0.1, max: 10, step: 0.1, def: 1 },
    },
  },
  {
    id: 'trRotate', label: 'Rotate', cat: 'trigger', kind: 'trigger', tt: 'rotate', shape: 'trigger',
    params: {
      target: { label: 'group', min: 1, max: 999, step: 1, def: 1 },
      deg: { label: 'degrees', min: -720, max: 720, step: 15, def: 90 },
      dur: { label: 'seconds', min: 0.1, max: 10, step: 0.1, def: 1 },
    },
  },
  {
    id: 'trScale', label: 'Scale', cat: 'trigger', kind: 'trigger', tt: 'scale', shape: 'trigger',
    params: {
      target: { label: 'group', min: 1, max: 999, step: 1, def: 1 },
      factor: { label: 'factor', min: 0.2, max: 3, step: 0.1, def: 1.5 },
      dur: { label: 'seconds', min: 0.1, max: 10, step: 0.1, def: 1 },
    },
  },
  {
    id: 'trAlpha', label: 'Alpha', cat: 'trigger', kind: 'trigger', tt: 'alpha', shape: 'trigger',
    params: {
      target: { label: 'group', min: 1, max: 999, step: 1, def: 1 },
      alpha: { label: 'alpha', min: 0, max: 1, step: 0.05, def: 0.4 },
      dur: { label: 'seconds', min: 0.1, max: 10, step: 0.1, def: 0.5 },
    },
  },
  {
    id: 'trToggle', label: 'Toggle', cat: 'trigger', kind: 'trigger', tt: 'toggle', shape: 'trigger',
    params: { target: { label: 'group', min: 1, max: 999, step: 1, def: 1 } },
  },
  {
    id: 'trSpawn', label: 'Spawn', cat: 'trigger', kind: 'trigger', tt: 'spawn', shape: 'trigger',
    params: { target: { label: 'group', min: 1, max: 999, step: 1, def: 1 } },
  },
  {
    id: 'trStop', label: 'Stop', cat: 'trigger', kind: 'trigger', tt: 'stop', shape: 'trigger',
    params: { target: { label: 'group', min: 1, max: 999, step: 1, def: 1 } },
  },
  {
    id: 'trPulse', label: 'Pulse', cat: 'trigger', kind: 'trigger', tt: 'pulse', shape: 'trigger',
    params: {
      target: { label: 'group', min: 1, max: 999, step: 1, def: 1 },
      color: { label: 'hue', min: 0, max: 360, step: 10, def: 190 },
      dur: { label: 'seconds', min: 0.1, max: 5, step: 0.1, def: 0.6 },
    },
  },
  {
    id: 'trColor', label: 'Colour', cat: 'trigger', kind: 'trigger', tt: 'color', shape: 'trigger',
    params: {
      target: { label: 'group', min: 1, max: 999, step: 1, def: 1 },
      color: { label: 'hue', min: 0, max: 360, step: 10, def: 330 },
    },
  },

  // --- decoration --------------------------------------------------------
  { id: 'decoGlow', label: 'Glow Orb', cat: 'deco', kind: 'deco', shape: 'glow' },
  { id: 'decoLine', label: 'Pulse Line', cat: 'deco', kind: 'deco', shape: 'line' },
  { id: 'decoText', label: 'Text Plate', cat: 'deco', kind: 'deco', shape: 'label' },
];

export const OBJECT_BY_ID = new Map(OBJECTS.map((o) => [o.id, o]));

// ---------------------------------------------------------------------------
// Construction helpers
// ---------------------------------------------------------------------------
export function makeObject(def, x, y, extra = {}) {
  const o = { t: def.kind, id: def.id, x, y, ...extra };
  if (def.kind === 'block') { o.w = extra.w ?? def.w; o.h = extra.h ?? def.h; }
  if (def.kind === 'spike') { o.dir = def.dir; o.small = !!def.small; }
  if (def.kind === 'orb' || def.kind === 'pad') o.color = def.color;
  if (def.kind === 'portal') { o.pkind = def.pkind; o.value = def.value; }
  if (def.kind === 'saw') o.r = def.r;
  if (def.kind === 'trigger') {
    o.tt = def.tt;
    o.p = {};
    for (const [k, spec] of Object.entries(def.params || {})) o.p[k] = extra.p?.[k] ?? spec.def;
  }
  if (extra.grp) o.grp = extra.grp;
  return o;
}

// ---------------------------------------------------------------------------
// Compiler: editor JSON -> LevelBuilder
// ---------------------------------------------------------------------------
export function compileLevel(data, builder) {
  const l = builder;
  let finishX = 0;
  for (const o of data.objects || []) {
    l.setGroup(o.grp || 0);
    switch (o.t) {
      case 'finish':
        finishX = Math.max(finishX, o.x || 0);
        break;
      case 'block':
        l.block(o.x, o.y, o.w ?? 1, o.h ?? 1);
        break;
      case 'spike':
        l.spike(o.x, o.y ?? 0, o.dir ?? 1, !!o.small);
        break;
      case 'orb':
        l.orb(o.x, o.y, o.color);
        break;
      case 'pad':
        l.pad(o.x, o.y, o.color);
        break;
      case 'portal':
        l.portal(o.x, o.y ?? 0, o.pkind, o.value, o.h ?? 240);
        break;
      case 'saw':
        l.saw(o.x, o.y, o.r ?? 0.6);
        break;
      case 'coin':
        l.coin(o.x, o.y);
        break;
      case 'checkpoint':
        l.checkpoint(o.x, o.y ?? 0);
        break;
      case 'trigger':
        l.trigger(o.x, o.y ?? 0, o.tt, o.p || {}, o.grp || 0);
        break;
      case 'teleport':
        l.teleport(o.x, o.y ?? 0, o.p?.to ?? 2);
        break;
      case 'deco':
        l.deco(o.x, o.y, o.shape || o.id);
        break;
      default:
        break;
    }
  }
  l.finish(Math.max(finishX, data.length || 200));
  return l.done();
}

// ---------------------------------------------------------------------------
// Fairness maths, shared by the generator, the editor and the validator.
// A jump clears a hazard cluster if the player's body stays above the hazard
// for long enough to cross it. Everything is derived from the physics tables.
// ---------------------------------------------------------------------------
export const HAZ_TOP = 25; // spike hazard top (units): y0 3 + 22 tall

export function jumpWindow(speedIdx, minHeight = HAZ_TOP) {
  const sp = SPEEDS[speedIdx];
  const v = sp.jump * 60;
  const g = GRAVITY;
  // time with the player's bottom above `minHeight` (feet start at y=0)
  const disc = v * v - 2 * g * minHeight;
  if (disc <= 0) return 0;
  const dt = (2 * Math.sqrt(disc)) / g;
  return dt * sp.units; // horizontal units covered while clear
}

// Units of travel needed to cross `count` adjacent spikes with a given player
// half-width. Spike hazards are 12 wide inside each 30-unit cell.
export function clusterNeed(count, halfWidth) {
  const firstLeft = 0.5 * BLOCK - 6;
  const lastRight = (count - 0.5) * BLOCK + 6;
  return lastRight - firstLeft + halfWidth * 2;
}

// Timing slack in seconds for a cluster of `count` spikes at a speed portal.
export function clusterSlack(count, speedIdx, halfWidth = 15) {
  const window = jumpWindow(speedIdx);
  const need = clusterNeed(count, halfWidth);
  const covered = window - need;
  return covered / SPEEDS[speedIdx].units;
}
