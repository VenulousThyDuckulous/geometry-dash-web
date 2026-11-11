import { BLOCK, SPEEDS, GRAVITY } from './constants.js';

// A level is authored on a 30-unit block grid. y=0 is the ground surface.
// Everything is compiled to unit-space rects plus a per-column index so the
// collision code can query a few columns per tick instead of the whole level.

export class LevelBuilder {
  constructor(name, difficulty, theme, track, sandbox = false) {
    this.name = name;
    this.difficulty = difficulty;
    this.theme = theme;
    this.track = track;
    this.sandbox = sandbox;
    this.objects = [];
    this.length = 0;
    this.maxX = 0;
    this.columns = new Map();
  }

  _push(obj, x0, x1) {
    obj.id = this.objects.length;
    this.objects.push(obj);
    this.maxX = Math.max(this.maxX, x1);
    const c0 = Math.floor(x0 / BLOCK) - 1;
    const c1 = Math.floor(x1 / BLOCK) + 1;
    for (let c = c0; c <= c1; c++) {
      if (!this.columns.has(c)) this.columns.set(c, []);
      this.columns.get(c).push(obj);
    }
    return this;
  }

  // Solid block(s). x,y in blocks, w,h in blocks.
  block(x, y, w = 1, h = 1) {
    return this._push(
      { t: 'block', x0: x * BLOCK, y0: y * BLOCK, x1: (x + w) * BLOCK, y1: (y + h) * BLOCK },
      x * BLOCK, (x + w) * BLOCK
    );
  }

  // dir 1 = points up from row y, dir -1 = hangs down from the top of row y.
  spike(x, y = 0, dir = 1, small = false) {
    const base = dir === 1 ? y * BLOCK : (y + 1) * BLOCK;
    const cx = (x + 0.5) * BLOCK;
    const hh = small ? 12 : 22;
    const hw = small ? 7 : 6;
    const y0 = dir === 1 ? base + 3 : base - 3 - hh;
    return this._push(
      {
        t: 'spike', dir, small,
        x0: x * BLOCK, y0: dir === 1 ? base : base - BLOCK,
        x1: (x + 1) * BLOCK, y1: dir === 1 ? base + BLOCK : base,
        hz: { x0: cx - hw, y0, x1: cx + hw, y1: y0 + hh },
      },
      x * BLOCK, (x + 1) * BLOCK
    );
  }

  orb(x, y, color) {
    const cx = (x + 0.5) * BLOCK;
    const cy = (y + 0.5) * BLOCK;
    return this._push({ t: 'orb', color, cx, cy, x0: cx - 30, x1: cx + 30 }, cx - 30, cx + 30);
  }

  pad(x, y, color) {
    return this._push(
      { t: 'pad', color, x0: x * BLOCK, y0: y * BLOCK, x1: (x + 1) * BLOCK, y1: y * BLOCK + 10 },
      x * BLOCK, (x + 1) * BLOCK
    );
  }

  // kind: 'mode' | 'gravity' | 'speed' | 'size'
  // Portals default to tall gates so a section change lands even when the
  // player arrives high up out of a flight sequence.
  portal(x, y, kind, value, height = 240) {
    return this._push(
      {
        t: 'portal', kind, value,
        x0: x * BLOCK, y0: y * BLOCK, x1: (x + 1) * BLOCK, y1: y * BLOCK + height,
      },
      x * BLOCK, (x + 1) * BLOCK
    );
  }

  finish(x) {
    this.length = x * BLOCK;
    this.maxX = Math.max(this.maxX, this.length);
    return this;
  }

  done() {
    if (!this.length) this.length = this.maxX + 20 * BLOCK;
    this.maxX = Math.max(this.maxX, this.length + 12 * BLOCK);
    return this;
  }
}

// ---------------------------------------------------------------------------
// Themes. One per level, roughly following the palette of the original.
// ---------------------------------------------------------------------------
const T = (bg1, bg2, ground, line, block, edge, spike, glow, accent) =>
  ({ bg1, bg2, ground, groundLine: line, block, edge, spike, glow, accent });

export const THEMES = {
  stereo:   T('#071a3d', '#0e3a7a', '#0a2450', '#57d0ff', '#123566', '#8ce6ff', '#d8f4ff', '#3fb8ff', '#ffd23f'),
  back:     T('#062033', '#0d4a5c', '#0a2a3c', '#4fe6d0', '#0f3a4a', '#8afff0', '#d6fff8', '#3fe0c0', '#ffcf4d'),
  polar:    T('#0b1430', '#22307a', '#111c44', '#8fb6ff', '#1a2a5c', '#bcd4ff', '#e6efff', '#7aa8ff', '#9b7bff'),
  dry:      T('#2a1405', '#6b3208', '#3a1e0a', '#ffb04d', '#4a270c', '#ffcf8a', '#ffe9c8', '#ff9a2b', '#ffe066'),
  base:     T('#0a1c2e', '#1b4060', '#102a40', '#7fd4ff', '#153650', '#a8e6ff', '#e0f6ff', '#59c2f0', '#ff8a4d'),
  cantlet:  T('#24081f', '#5c1038', '#32102a', '#ff6fbf', '#43163a', '#ffa6dd', '#ffe3f6', '#ff5fa8', '#ffd166'),
  jumper:   T('#06240f', '#11521f', '#0c2e16', '#5dff8a', '#13401f', '#9dffbc', '#e2ffee', '#3fe07a', '#ffe066'),
  time:     T('#081e2a', '#0d4a57', '#0b2b36', '#5ff0ff', '#103844', '#a6f4ff', '#e2fdff', '#4fd8ff', '#ff7ad9'),
  cycles:   T('#0a2418', '#0f4a2a', '#0c3020', '#3dffa0', '#12402a', '#8dffc6', '#e0fff0', '#2fe08a', '#ffe066'),
  xstep:    T('#2a0b2f', '#5e1650', '#331040', '#ff6fd8', '#431a52', '#ffa8ea', '#ffe0f6', '#ff4fd8', '#63ff9a'),
  clutter:  T('#0c1233', '#2a1f6b', '#101a45', '#8f9bff', '#182458', '#b8c2ff', '#e6eaff', '#7a8bff', '#ff9a3c'),
  toe:      T('#170a33', '#3a1470', '#1d0f42', '#b07bff', '#281456', '#d0a8ff', '#f0e2ff', '#9b5cff', '#4dffa8'),
  electro:  T('#041c26', '#0a4250', '#06242e', '#6ff5ff', '#0a3040', '#b0fbff', '#e8ffff', '#4fe0ff', '#ff4fd8'),
  club:     T('#04140c', '#0a3318', '#061c10', '#3dff7a', '#0a2a16', '#8dffab', '#daffe6', '#2fd85a', '#c6ff4d'),
  dynamix:  T('#001f2e', '#0a4a66', '#032836', '#7ef0ff', '#073848', '#b6f8ff', '#e6ffff', '#3fd8ff', '#ff9a3c'),
  hexa:     T('#0a1b3a', '#1f3f8a', '#0e2450', '#ffb35c', '#152f66', '#ffd39c', '#fff0d8', '#ff9a3c', '#4fd8ff'),
  blast:    T('#2a0608', '#641013', '#37080c', '#ff5a4d', '#4a0e12', '#ff9a8d', '#ffe0d8', '#ff3a2b', '#ffe066'),
  toe2:     T('#120a2e', '#33146b', '#180f3f', '#9a7bff', '#221452', '#c8b0ff', '#efe2ff', '#8a5cff', '#3dffa0'),
  geo:      T('#03262a', '#0a5158', '#063238', '#5fffe0', '#0b3f45', '#a6fff0', '#e6fffa', '#2fe0c0', '#ffd166'),
  dead:     T('#1f0408', '#4a0a10', '#2a060a', '#ff3b3b', '#3d0a10', '#ff8a7a', '#ffdad4', '#ff2b2b', '#3dff7a'),
  finger:   T('#1a0a2e', '#3a1060', '#200d38', '#c46bff', '#2a1248', '#e0a6ff', '#f6e2ff', '#b45cff', '#63ff9a'),
  dash:     T('#0c0a2e', '#241370', '#120e42', '#7b8dff', '#1a1556', '#b6c0ff', '#e6eaff', '#6b7bff', '#ff4fd8'),
  neon:     T('#0a0f2e', '#1b1150', '#141a3c', '#45f0ff', '#1b2350', '#5ff4ff', '#c8f7ff', '#45f0ff', '#ff4fd8'),
};

// ---------------------------------------------------------------------------
// Spacing helpers. Gap sizes are derived from the documented physics rather
// than guessed: a cube's airtime is 2*v/g, so the distance covered during one
// jump is horizontal_speed * 2*v/g. Everything else scales off that.
// ---------------------------------------------------------------------------
const jumpSpan = (s) => (SPEEDS[s].units * ((2 * SPEEDS[s].jump * 60) / GRAVITY)) / BLOCK;
const lerp = (a, b, t) => a + (b - a) * t;

function makeRng(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Section generators. Each fills [st.x, st.x + len) and returns the end.
// ---------------------------------------------------------------------------
function cubeRun(l, st, len) {
  const end = st.x + len;
  const inv = st.grav === -1;
  const span = jumpSpan(st.speed) * (st.mini ? 0.82 : 1);
  let x = st.x + (inv ? 14 : 4);
  let guard = 0;

  while (x < end - 7 && guard++ < 400) {
    const r = st.rng();
    let next;

    if (inv) {
      // Hanging hazards: jump towards the floor to slip underneath them.
      if (r < 0.5) l.spike(x, 9, -1);
      else if (r < 0.78) { l.spike(x, 9, -1); l.spike(x + 1, 9, -1); }
      else l.block(x, 9, 1, 1);
      next = x + span * (st.tier >= 5 ? 1.0 : 1.2);
    } else if (r < 0.28) {
      l.spike(x);
      next = x + span * 1.15;
    } else if (r < 0.47) {
      l.spike(x);
      if (st.tier >= 3) l.spike(x + 1);
      next = x + span * 1.15;
    } else if (r < 0.58 && st.tier >= 5) {
      l.spike(x); l.spike(x + 1); l.spike(x + 2);
      next = x + span * 1.3;
    } else if (r < 0.7) {
      const h = st.tier >= 5 ? 2 : 1;
      l.block(x, 0, 1 + (st.tier >= 5 ? 1 : 0), h);
      next = x + span * 1.25;
    } else if (r < 0.8 && st.tier >= 2) {
      l.orb(x, 2, st.rng() < 0.5 ? 'yellow' : 'pink');
      l.spike(x + 2);
      next = x + span * 1.45;
    } else if (r < 0.88 && st.tier >= 2) {
      l.pad(x, 0, st.rng() < 0.5 ? 'yellow' : 'red');
      l.spike(x + 3); l.spike(x + 4);
      next = x + span * 1.6;
    } else if (st.tier >= 3) {
      // stair then drop
      l.block(x, 0, 2, 1);
      l.spike(x + 4);
      next = x + span * 1.5;
    } else {
      l.spike(x + 2, 0, 1, true);
      next = x + span * 1.1;
    }
    x = next;
  }
  return end;
}

// Shared corridor builder for the free-flight modes (ship, wave, swing).
function corridor(l, st, len, opt) {
  const end = st.x + len;
  const startX = st.x + 10;
  const hw = 3;
  const ramp = opt.ramp || 4;
  let x = startX;
  let chunk = 0;

  while (x < end - 1) {
    const along = x - startX;
    const cy = opt.mid + opt.amp * Math.sin(along / opt.period * Math.PI * 2 + st.phase);
    const k = Math.min(1, chunk / ramp);
    const top = Math.round(lerp(10, cy - opt.half, k));
    const bot = Math.round(lerp(0, cy + opt.half, k));
    if (bot > 0) l.block(x, 0, hw, bot);
    if (top < 10) l.block(x, top, hw, 10 - top);
    x += hw;
    chunk++;
  }
  return end;
}

function shipRun(l, st, len) {
  const half = Math.max(2.0, 3.1 - st.tier * 0.16);
  corridor(l, st, len, { mid: 5, amp: 2.1, period: 30, half, ramp: 5 });
  // A few loose hazards inside wider stretches.
  return st.x + len;
}

function swingRun(l, st, len) {
  const half = Math.max(2.4, 3.6 - st.tier * 0.16);
  corridor(l, st, len, { mid: 5, amp: 1.8, period: 34, half, ramp: 5 });
  return st.x + len;
}

function waveRun(l, st, len) {
  const half = Math.max(1.5, 2.7 - st.tier * 0.14) + Math.max(0, st.speed - 2) * 0.2;
  corridor(l, st, len, { mid: 5, amp: 1.5, period: 26, half, ramp: 4 });
  return st.x + len;
}

function ballRun(l, st, len) {
  const end = st.x + len;
  const gap = Math.max(4.5, jumpSpan(st.speed) * 1.3);
  let x = st.x + 7;
  let onFloor = true;
  while (x < end - 7) {
    if (onFloor) { l.spike(x); if (st.tier >= 4) l.spike(x + 1); }
    else { l.spike(x, 9, -1); if (st.tier >= 4) l.spike(x + 1, 9, -1); }
    x += gap;
    onFloor = !onFloor;
  }
  return end;
}

function ufoRun(l, st, len) {
  const end = st.x + len;
  const hop = ((2 * 420) / 1500) * (SPEEDS[st.speed].units / BLOCK);
  const gap = hop * 1.1;
  let x = st.x + 7;
  while (x < end - 7) {
    const r = st.rng();
    if (r < 0.66) l.spike(x);
    else if (r < 0.88) l.block(x, 0, 1, 1);
    else { l.spike(x); l.spike(x + 1); }
    x += gap;
  }
  return end;
}

function robotRun(l, st, len) {
  const end = st.x + len;
  const span = jumpSpan(st.speed) * (st.mini ? 0.9 : 1.25);
  let x = st.x + 7;
  while (x < end - 7) {
    const r = st.rng();
    if (r < 0.45) l.spike(x);
    else if (r < 0.75) l.block(x, 0, 1, 1);
    else if (r < 0.9) { l.spike(x); if (st.tier >= 4) l.spike(x + 1); }
    else l.pad(x, 0, 'yellow');
    x += span;
  }
  return end;
}

function spiderRun(l, st, len) {
  const end = st.x + len;
  const gap = Math.max(7, jumpSpan(st.speed) * 1.7);
  let x = st.x + 7;
  let onFloor = true;
  while (x < end - 7) {
    if (onFloor) l.spike(x);
    else l.spike(x, 9, -1);
    x += gap;
    onFloor = !onFloor;
  }
  return end;
}

const SECTION = {
  cube: cubeRun,
  ship: shipRun,
  ball: ballRun,
  ufo: ufoRun,
  wave: waveRun,
  robot: robotRun,
  spider: spiderRun,
  swing: swingRun,
};

// ---------------------------------------------------------------------------
// Driver: walks the section list, dropping the manipulation portals that the
// original level uses, then fills each section with mode-appropriate hazards.
// ---------------------------------------------------------------------------
function build(cfg) {
  const l = new LevelBuilder(cfg.name, cfg.difficulty, THEMES[cfg.theme] || THEMES.stereo, cfg.track);
  const st = {
    x: 9, speed: 1, mini: false, grav: 1, mode: 'cube',
    tier: cfg.tier, rng: makeRng(cfg.seed), phase: 0,
  };

  for (const [mode, pct, speed = 1, flags = ''] of cfg.sections) {
    const mini = flags.includes('mini');
    const inv = flags.includes('inv');
    const len = Math.max(12, Math.round((pct / 100) * cfg.secs * SPEEDS[speed].bps));
    st.phase = st.rng() * Math.PI * 2;

    let x = st.x;
    let settled = false;

    // Climbing back down out of an inverted run: restore gravity first, then
    // leave room to land before the rest of the transition stack.
    if (st.grav === -1) {
      l.portal(x, 8, 'gravity', 1, 90);
      st.grav = 1;
      x += 16;
      settled = true;
    }

    // The remaining portals fire as one stack in the same column.
    if (speed !== st.speed) { l.portal(x, 0, 'speed', speed); st.speed = speed; settled = true; }
    if (mini !== st.mini) { l.portal(x, 0, 'size', mini ? 'mini' : 'normal'); st.mini = mini; }
    if (inv) { l.portal(x, 0, 'gravity', -1); st.grav = -1; settled = true; }
    if (mode !== st.mode) { l.portal(x, 0, 'mode', mode); st.mode = mode; settled = true; }
    st.x = x + (settled ? 14 : 4);

    st.x = SECTION[st.mode](l, st, len);
  }

  if (st.grav === -1) { l.portal(st.x, 8, 'gravity', 1, 90); st.x += 10; }
  l.finish(st.x + 6);
  return l.done();
}

// ---------------------------------------------------------------------------
// The 22 official main levels. Percentages, gamemode order, speed portals and
// difficulties follow the Geometry Dash wiki entries for each level.
// ---------------------------------------------------------------------------
const MAIN = [
  {
    name: 'Stereo Madness', difficulty: 'Easy', theme: 'stereo', track: 'neon',
    tier: 1, seed: 101, secs: 89,
    sections: [
      ['cube', 30], ['ship', 18], ['cube', 37], ['ship', 15],
    ],
  },
  {
    name: 'Back On Track', difficulty: 'Easy', theme: 'back', track: 'neon',
    tier: 1, seed: 202, secs: 84,
    sections: [
      ['cube', 49], ['ship', 17], ['cube', 34],
    ],
  },
  {
    name: 'Polargeist', difficulty: 'Normal', theme: 'polar', track: 'shift',
    tier: 2, seed: 303, secs: 76,
    sections: [
      ['cube', 34], ['ship', 13], ['cube', 53],
    ],
  },
  {
    name: 'Dry Out', difficulty: 'Normal', theme: 'dry', track: 'shift',
    tier: 2, seed: 404, secs: 75,
    sections: [
      ['cube', 34], ['cube', 16, 1, 'inv'], ['cube', 17], ['ship', 16], ['cube', 17],
    ],
  },
  {
    name: 'Base After Base', difficulty: 'Hard', theme: 'base', track: 'neon',
    tier: 3, seed: 505, secs: 86,
    sections: [
      ['cube', 52], ['ship', 17], ['cube', 15, 1, 'inv'], ['cube', 16],
    ],
  },
  {
    name: "Can't Let Go", difficulty: 'Hard', theme: 'cantlet', track: 'shift',
    tier: 3, seed: 606, secs: 80,
    sections: [
      ['cube', 57], ['ship', 13], ['cube', 15, 1, 'inv'], ['cube', 15],
    ],
  },
  {
    name: 'Jumper', difficulty: 'Harder', theme: 'jumper', track: 'neon',
    tier: 3, seed: 707, secs: 75,
    sections: [
      ['cube', 25], ['ship', 12], ['cube', 25, 1, 'inv'], ['ship', 13], ['cube', 25],
    ],
  },
  {
    name: 'Time Machine', difficulty: 'Harder', theme: 'time', track: 'shift',
    tier: 4, seed: 808, secs: 99,
    sections: [
      ['cube', 35], ['ship', 8], ['cube', 49], ['ship', 8],
    ],
  },
  {
    name: 'Cycles', difficulty: 'Harder', theme: 'cycles', track: 'neon',
    tier: 4, seed: 909, secs: 84,
    sections: [
      ['cube', 36], ['ball', 18], ['ship', 17], ['cube', 3], ['ball', 26],
    ],
  },
  {
    name: 'xStep', difficulty: 'Insane', theme: 'xstep', track: 'hyper',
    tier: 4, seed: 1010, secs: 84,
    sections: [
      ['cube', 8], ['ball', 9], ['ship', 9], ['cube', 9], ['ship', 18],
      ['cube', 18], ['ball', 18], ['ship', 11],
    ],
  },
  {
    name: 'Clutterfunk', difficulty: 'Insane', theme: 'clutter', track: 'hyper',
    tier: 5, seed: 1111, secs: 99,
    sections: [
      ['cube', 14], ['cube', 15, 1, 'mini'], ['ship', 7], ['ball', 17, 1, 'mini'],
      ['ship', 14, 1, 'mini'], ['cube', 33, 1, 'mini'],
    ],
  },
  {
    name: 'Theory of Everything', difficulty: 'Insane', theme: 'toe', track: 'shift',
    tier: 4, seed: 1212, secs: 80,
    sections: [
      ['cube', 8], ['ship', 8], ['cube', 10], ['ufo', 8], ['cube', 10], ['ball', 9],
      ['ship', 4], ['cube', 7], ['ufo', 17], ['cube', 10], ['ball', 4], ['ship', 5],
    ],
  },
  {
    name: 'Electroman Adventures', difficulty: 'Insane', theme: 'electro', track: 'hyper',
    tier: 5, seed: 1313, secs: 85,
    sections: [
      ['cube', 13], ['ship', 13, 1, 'mini'], ['cube', 7], ['ball', 7], ['cube', 6],
      ['ufo', 7], ['ship', 7], ['ufo', 6, 1, 'mini'], ['ship', 7, 1, 'mini'],
      ['cube', 13, 1, 'mini'], ['ball', 7, 1, 'mini'], ['cube', 7],
    ],
  },
  {
    name: 'Clubstep', difficulty: 'Demon', theme: 'club', track: 'hyper',
    tier: 5, seed: 1414, secs: 90,
    sections: [
      ['cube', 25], ['ship', 8], ['cube', 10], ['ball', 8, 1, 'mini'],
      ['ufo', 5, 1, 'mini'], ['ship', 2, 1, 'mini'], ['cube', 6],
      ['ship', 4, 1, 'mini'], ['ufo', 5, 1, 'mini'], ['ship', 9, 1, 'mini'],
      ['cube', 3], ['ship', 5, 1, 'mini'], ['cube', 4, 1, 'mini'], ['ship', 6, 1, 'mini'],
    ],
  },
  {
    name: 'Electrodynamix', difficulty: 'Insane', theme: 'dynamix', track: 'hyper',
    tier: 5, seed: 1515, secs: 85,
    sections: [
      ['cube', 7], ['cube', 17, 2], ['ship', 8, 2], ['ufo', 10, 2], ['cube', 7, 2],
      ['ball', 4, 2], ['cube', 6, 2], ['ship', 6, 3], ['ball', 5, 3], ['ship', 6, 3],
      ['ball', 5, 3], ['cube', 11, 3], ['ship', 8, 3],
    ],
  },
  {
    name: 'Hexagon Force', difficulty: 'Insane', theme: 'hexa', track: 'neon',
    tier: 5, seed: 1616, secs: 85,
    sections: [
      ['cube', 12, 2], ['ship', 7, 2], ['ball', 7, 2], ['cube', 15, 2], ['ship', 7, 2],
      ['cube', 7, 2], ['ufo', 6, 2, 'mini'], ['ball', 4, 2, 'mini'], ['ship', 11, 2, 'mini'],
      ['cube', 14, 2], ['ship', 10, 0],
    ],
  },
  {
    name: 'Blast Processing', difficulty: 'Harder', theme: 'blast', track: 'hyper',
    tier: 4, seed: 1717, secs: 75,
    sections: [
      ['cube', 14], ['wave', 14], ['ship', 7], ['ball', 7], ['wave', 16], ['cube', 7],
      ['ufo', 8], ['ship', 3], ['ball', 4], ['ufo', 3], ['ship', 4], ['cube', 13],
    ],
  },
  {
    name: 'Theory of Everything 2', difficulty: 'Demon', theme: 'toe2', track: 'shift',
    tier: 5, seed: 1818, secs: 85,
    sections: [
      ['cube', 11], ['ship', 5, 2, 'mini'], ['ufo', 3, 0], ['ball', 5, 2], ['ufo', 4, 2],
      ['cube', 8], ['ship', 7], ['cube', 7], ['wave', 5, 2], ['ball', 5, 2],
      ['wave', 5, 2], ['ship', 4, 2, 'mini'], ['cube', 7, 0], ['ship', 4], ['cube', 5, 2],
      ['ufo', 5, 2, 'mini'], ['wave', 3, 0, 'mini'], ['cube', 4, 2],
    ],
  },
  {
    name: 'Geometrical Dominator', difficulty: 'Harder', theme: 'geo', track: 'neon',
    tier: 4, seed: 1919, secs: 90,
    sections: [
      ['cube', 5], ['robot', 13], ['ship', 6], ['wave', 6], ['cube', 6],
      ['robot', 16, 2], ['ship', 8, 2], ['ufo', 8, 2], ['cube', 12], ['wave', 4, 2],
      ['ufo', 2, 0, 'mini'], ['ball', 4, 2], ['ship', 3, 1, 'mini'], ['robot', 7],
    ],
  },
  {
    name: 'Deadlocked', difficulty: 'Demon', theme: 'dead', track: 'hyper',
    tier: 5, seed: 2020, secs: 100,
    sections: [
      ['cube', 2], ['wave', 1, 1, 'mini'], ['cube', 9], ['wave', 5, 4], ['ship', 4, 2, 'mini'],
      ['ball', 3, 2], ['ufo', 4, 2, 'mini'], ['cube', 4, 4], ['robot', 4, 2],
      ['ball', 6, 2, 'mini'], ['cube', 7], ['robot', 7, 2], ['wave', 6, 3], ['ufo', 6, 3],
      ['ship', 6, 3, 'mini'], ['cube', 6], ['wave', 6, 4, 'mini'], ['ball', 4, 4],
      ['ship', 5, 3, 'mini'], ['cube', 5],
    ],
  },
  {
    name: 'Fingerdash', difficulty: 'Insane', theme: 'finger', track: 'hyper',
    tier: 4, seed: 2121, secs: 85,
    sections: [
      ['cube', 38], ['spider', 11], ['ship', 9], ['robot', 10], ['wave', 11, 2],
      ['spider', 6, 2], ['wave', 2, 1, 'mini'], ['ufo', 3, 2, 'mini'], ['cube', 10],
    ],
  },
  {
    name: 'Dash', difficulty: 'Insane', theme: 'dash', track: 'neon',
    tier: 4, seed: 2222, secs: 90,
    sections: [
      ['cube', 3], ['spider', 2], ['cube', 2], ['spider', 2], ['ball', 1, 4],
      ['cube', 7, 1, 'mini'], ['swing', 6, 2], ['cube', 3, 0, 'mini'], ['robot', 2, 2],
      ['ball', 6, 2], ['swing', 6, 2], ['spider', 2, 2], ['cube', 28, 2],
      ['ship', 8, 4], ['robot', 8, 4], ['cube', 8, 2, 'mini'], ['wave', 2, 2],
      ['cube', 4, 2, 'mini'],
    ],
  },
];

// ---------------------------------------------------------------------------
// Bonus sandbox: press 1-8 anywhere to swap gamemode.
// ---------------------------------------------------------------------------
function physicsLab() {
  const l = new LevelBuilder('Physics Lab', 'Sandbox', THEMES.neon, 'shift', true);
  l.portal(10, 0, 'speed', 2);
  for (let i = 0; i < 6; i++) {
    const x = 24 + i * 26;
    l.spike(x).spike(x + 1).spike(x + 2);
  }
  l.pad(190, 0, 'yellow').pad(196, 0, 'pink').pad(202, 0, 'red').pad(208, 0, 'blue');
  l.orb(230, 2, 'yellow').orb(238, 2, 'pink').orb(246, 2, 'blue').orb(254, 2, 'black');
  l.block(270, 0, 4, 1).block(278, 0, 4, 2).block(286, 0, 4, 3);
  l.finish(320);
  return l.done();
}

export const LEVELS = [...MAIN.map(build), physicsLab()];
