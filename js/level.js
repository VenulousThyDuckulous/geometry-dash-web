import { BLOCK } from './constants.js';

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
  portal(x, y, kind, value) {
    return this._push(
      {
        t: 'portal', kind, value,
        x0: x * BLOCK, y0: y * BLOCK, x1: (x + 1) * BLOCK, y1: y * BLOCK + 90,
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

export const THEMES = {
  neon: {
    bg1: '#0a0f2e', bg2: '#1b1150', ground: '#141a3c', groundLine: '#45f0ff',
    block: '#1b2350', edge: '#5ff4ff', spike: '#c8f7ff', glow: '#45f0ff', accent: '#ff4fd8',
  },
  shift: {
    bg1: '#2a0a2f', bg2: '#4c1040', ground: '#2d0f36', groundLine: '#ff5fd0',
    block: '#3a1545', edge: '#ff8ae2', spike: '#ffe3f8', glow: '#ff5fd0', accent: '#ffd166',
  },
  hyper: {
    bg1: '#2b0b06', bg2: '#54190a', ground: '#33110a', groundLine: '#ff9a3c',
    block: '#40160c', edge: '#ffc07a', spike: '#fff0d6', glow: '#ff8a2b', accent: '#ffe066',
  },
  toxic: {
    bg1: '#061f14', bg2: '#0b3a22', ground: '#0a2a1b', groundLine: '#4dffa8',
    block: '#0e3322', edge: '#8fffc6', spike: '#e6fff2', glow: '#4dffa8', accent: '#c6ff4d',
  },
};

// ---------------------------------------------------------------------------
// Level 1 - Neon Prelude. Cube only. Teaches jump timing, orbs and pads.
// ---------------------------------------------------------------------------
function neonPrelude() {
  const l = new LevelBuilder('Neon Prelude', 'Easy', THEMES.neon, 'neon');

  l.spike(14).spike(21).spike(28);
  l.spike(35).spike(36);
  l.spike(43);
  l.spike(49, 0, 1, true);
  l.spike(56).spike(57).spike(58);

  l.block(64, 0, 3, 1);
  l.spike(70);
  l.block(74, 0, 3, 1);
  l.spike(80);

  l.orb(88, 2, 'yellow').orb(92, 2, 'yellow').orb(96, 2, 'yellow');
  l.spike(101);

  l.pad(110, 0, 'yellow');
  l.spike(113).spike(114).spike(115);

  l.orb(124, 2, 'pink');
  l.spike(128);

  l.portal(136, 0, 'speed', 2);
  l.spike(144).spike(151).spike(158).spike(159);
  l.portal(168, 0, 'speed', 1);

  l.spike(176);
  l.block(182, 0, 4, 1);
  l.spike(189);
  l.spike(196);
  l.spike(203, 0, 1, true);
  l.spike(210).spike(211);
  l.finish(218);
  return l.done();
}

// ---------------------------------------------------------------------------
// Level 2 - Modal Shift. Every gamemode, gently.
// ---------------------------------------------------------------------------
function modalShift() {
  const l = new LevelBuilder('Modal Shift', 'Normal', THEMES.shift, 'shift');

  l.spike(10).spike(17).spike(24).spike(31).spike(32);
  l.block(38, 0, 2, 1);

  // --- SHIP: hold to rise, release to sink -------------------------------
  l.portal(46, 0, 'mode', 'ship');
  l.spike(56).spike(64);
  l.block(70, 7, 3, 3); // roof chunk at y 210..300 - fly under it
  l.spike(80);
  l.block(86, 0, 3, 2);
  l.spike(96);
  l.block(110, 6, 3, 3);
  l.portal(122, 0, 'mode', 'cube');
  l.spike(132);

  // --- BALL: click flips gravity ----------------------------------------
  l.block(140, 6, 60, 2); // roof to roll along
  l.portal(144, 0, 'mode', 'ball');
  l.spike(152).spike(160);
  l.spike(170, 5, -1); // roof spike: be on the floor
  l.portal(188, 0, 'mode', 'cube');
  l.spike(200);

  // --- UFO: tap for a hop, midair allowed --------------------------------
  l.portal(208, 0, 'mode', 'ufo');
  l.spike(218).spike(226).spike(234).spike(242);
  l.block(248, 0, 2, 2);
  l.spike(258);
  l.portal(266, 0, 'mode', 'cube');

  // --- WAVE: hold = 45 deg up, release = 45 deg down ---------------------
  l.block(274, 6, 38, 2);
  l.portal(278, 0, 'mode', 'wave');
  l.spike(286);
  l.spike(291, 5, -1);
  l.spike(296);
  l.spike(301, 5, -1);
  l.portal(310, 0, 'mode', 'cube');

  // --- ROBOT: hold for a higher jump -------------------------------------
  l.portal(320, 0, 'mode', 'robot');
  l.spike(328).spike(336);
  l.block(342, 0, 2, 2);
  l.spike(350).spike(358);
  l.block(364, 0, 2, 2);
  l.spike(372);
  l.portal(380, 0, 'mode', 'cube');

  // --- SPIDER: click teleports to the next surface ----------------------
  l.block(388, 6, 38, 2);
  l.portal(392, 0, 'mode', 'spider');
  l.spike(400);
  l.spike(410, 5, -1);
  l.spike(418);
  l.spike(424, 5, -1);
  l.portal(432, 0, 'mode', 'cube');

  // --- SWING: click flips gravity, velocity damped ----------------------
  l.block(440, 6, 30, 2);
  l.portal(444, 0, 'mode', 'swing');
  l.spike(452);
  l.spike(459, 5, -1);
  l.spike(466);
  l.portal(474, 0, 'mode', 'cube');

  l.spike(484);
  l.spike(492).spike(493);
  l.finish(502);
  return l.done();
}

// ---------------------------------------------------------------------------
// Level 3 - Hyperflux. Fast, all modes, gravity + mini portals.
// ---------------------------------------------------------------------------
function hyperflux() {
  const l = new LevelBuilder('Hyperflux', 'Hard', THEMES.hyper, 'hyper');

  l.portal(8, 0, 'speed', 2);
  l.spike(18).spike(25).spike(32).spike(33).spike(40);

  // inverted cube run: roof spikes hang from the playfield ceiling (y 300)
  l.portal(48, 0, 'gravity', -1);
  l.spike(56, 9, -1).spike(63, 9, -1);
  l.orb(72, 8, 'blue'); // blue orb flips gravity back
  l.spike(84);

  // mini cube section
  l.portal(96, 0, 'size', 'mini');
  l.spike(104).spike(111).spike(118).spike(119);
  l.portal(130, 0, 'size', 'normal');

  // ship at 3x
  l.portal(138, 0, 'speed', 3);
  l.portal(142, 0, 'mode', 'ship');
  l.spike(152);
  l.block(158, 7, 3, 3);
  l.spike(168);
  l.block(174, 0, 2, 2);
  l.spike(184);
  l.block(190, 6, 3, 3);
  l.spike(200);
  l.portal(212, 0, 'mode', 'cube');
  l.portal(216, 0, 'speed', 2);

  // UFO hops at 2x
  l.portal(226, 0, 'mode', 'ufo');
  l.spike(236).spike(244).spike(252).spike(260);
  l.portal(270, 0, 'mode', 'cube');

  // ball flip corridor
  l.block(278, 6, 56, 2);
  l.portal(282, 0, 'mode', 'ball');
  l.spike(290).spike(300);
  l.spike(312, 5, -1);
  l.portal(326, 0, 'mode', 'cube');
  l.spike(336);

  // wave tunnel at 3x
  l.block(344, 6, 40, 2);
  l.portal(348, 0, 'speed', 3);
  l.portal(352, 0, 'mode', 'wave');
  l.spike(360);
  l.spike(365, 5, -1);
  l.spike(370);
  l.spike(375, 5, -1);
  l.portal(386, 0, 'mode', 'cube');
  l.portal(390, 0, 'speed', 2);

  // robot pillars
  l.portal(398, 0, 'mode', 'robot');
  l.spike(406);
  l.block(412, 0, 2, 2);
  l.spike(420);
  l.block(426, 0, 2, 2);
  l.spike(434);
  l.portal(442, 0, 'mode', 'cube');

  // spider between floor and roof
  l.block(448, 6, 38, 2);
  l.portal(452, 0, 'mode', 'spider');
  l.spike(460);
  l.spike(470, 5, -1);
  l.spike(478);
  l.spike(484, 5, -1);
  l.portal(492, 0, 'mode', 'cube');

  // swing finish
  l.block(500, 6, 30, 2);
  l.portal(504, 0, 'mode', 'swing');
  l.spike(512);
  l.spike(519, 5, -1);
  l.spike(526);
  l.portal(534, 0, 'mode', 'cube');

  l.portal(540, 0, 'speed', 4);
  l.spike(548).spike(557);
  l.finish(568);
  return l.done();
}

// ---------------------------------------------------------------------------
// Physics Lab - a sandbox: press 1-8 to switch gamemode anywhere.
// ---------------------------------------------------------------------------
function physicsLab() {
  const l = new LevelBuilder('Physics Lab', 'Sandbox', THEMES.toxic, 'shift', true);
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

export const LEVELS = [neonPrelude(), modalShift(), hyperflux(), physicsLab()];
