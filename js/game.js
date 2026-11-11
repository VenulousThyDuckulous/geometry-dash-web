import * as C from './constants.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export class Game {
  constructor(level, practice = false) {
    this.level = level;
    this.columns = level.columns;
    this.practice = practice;
    this.attempts = 0;
    this.checkpoint = null;
    this.onSfx = null;
    this.reset(null);
  }

  reset(checkpoint) {
    const cp = checkpoint ? { ...checkpoint } : null;
    this.p = {
      x: cp ? cp.x : 0,
      y: cp ? cp.y : 15,
      vy: cp ? cp.vy : 0,
      gdir: cp ? cp.gdir : 1,
      mode: cp ? cp.mode : 'cube',
      speed: cp ? cp.speed : 1,
      mini: cp ? cp.mini : false,
      rot: 0,
      onGround: true,
      prevY: cp ? cp.y : 15,
      wasDown: false,
      ticksHeld: 0,
      holdTime: 0,
      gravityOff: false,
      robotActive: false,
      dead: false,
      won: false,
    };
    this.p.prevY = this.p.y;
    this.touchingPads = new Set();
    this.orbArmed = new Set();
    this.fx = [];
    this.progress = 0;
    this.maxProgress = 0;
    this.cpTimer = 0;
    this.deadTimer = 0;
    this.time = 0;
    this.shake = 0;
    this.trailTick = 0;
  }

  restart() {
    this.attempts++;
    this.reset(this.practice ? this.checkpoint : null);
  }

  get solidHalf() {
    const base = C.HITBOX[this.p.mode].solid;
    return this.p.mini ? base * C.MINI_SCALE : base;
  }

  get hazHalf() {
    const base = C.HITBOX[this.p.mode].haz;
    return this.p.mini ? base * C.MINI_SCALE : base;
  }

  nearby(x0, x1) {
    const out = [];
    const seen = new Set();
    const c0 = Math.floor(x0 / C.BLOCK) - 1;
    const c1 = Math.floor(x1 / C.BLOCK) + 1;
    for (let c = c0; c <= c1; c++) {
      const arr = this.columns.get(c);
      if (!arr) continue;
      for (const o of arr) {
        if (seen.has(o.id)) continue;
        seen.add(o.id);
        out.push(o);
      }
    }
    return out;
  }

  sfx(name) {
    if (this.onSfx) this.onSfx(name);
  }

  // ---------------------------------------------------------------------
  tick(down) {
    const p = this.p;
    if (p.dead || p.won) {
      this.deadTimer += C.DT;
      return;
    }
    const dt = C.DT;
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 4);

    const click = down && !p.wasDown;
    p.wasDown = down;
    if (down) p.ticksHeld++;
    else p.ticksHeld = 0;
    const needed = C.MODE_INFO[p.mode].ticks || 1;
    const press = down && p.ticksHeld >= needed;

    // horizontal scroll
    p.x += C.SPEEDS[p.speed].units * dt;

    this.applyObjects(press, click);

    const info = C.MODE_INFO[p.mode];
    const sp = C.SPEEDS[p.speed];

    p.gravityOff = false;
    switch (p.mode) {
      case 'cube':
        if (down && p.onGround) this.jump(sp.jump * 60);
        break;

      case 'ship':
        if (press) p.vy += C.SHIP_THRUST * p.gdir * dt * (p.ticksHeld > 2 ? 1 : 0.5);
        break;

      case 'ball':
        if (press && p.onGround) {
          p.vy = sp.ball * 60 * p.gdir;
          p.gdir *= -1;
          this.sfx('jump');
        }
        break;

      case 'ufo':
        if (press && click) {
          p.vy = C.UFO_IMPULSE * p.gdir;
          this.sfx('jump');
        }
        break;

      case 'wave':
        p.vy = (down ? 1 : -1) * sp.wave * 60 * p.gdir;
        break;

      case 'robot':
        if (down && p.onGround) {
          p.robotActive = true;
          p.holdTime = 0;
          this.sfx('jump');
        }
        if (down && p.robotActive && p.holdTime < C.ROBOT_MAX_HOLD) {
          p.vy = sp.robot * 60 * p.gdir;
          p.gravityOff = true;
          p.holdTime += dt;
        } else {
          p.robotActive = false;
        }
        break;

      case 'spider':
        if (press && click && p.onGround) this.spiderTeleport();
        break;

      case 'swing':
        if (press && click) {
          p.vy *= C.SWING_DAMP;
          p.gdir *= -1;
          this.sfx('jump');
        }
        break;
    }

    // gravity
    if (!p.gravityOff) {
      let g = C.GRAVITY;
      if (p.mode === 'ufo') g = C.UFO_GRAVITY;
      if (p.mode === 'wave') g = 0;
      p.vy -= g * p.gdir * dt;
    }

    // velocity limits
    let maxUp = C.MAX_FALL;
    let maxDown = C.MAX_FALL;
    if (p.mode === 'ship') { maxUp = C.SHIP_MAX_UP; maxDown = C.SHIP_MAX_DOWN; }
    else if (p.mode === 'ufo') { maxUp = C.UFO_MAX_UP; maxDown = C.UFO_MAX_DOWN; }
    else if (p.mode === 'swing') { maxUp = C.SWING_MAX; maxDown = C.SWING_MAX; }
    else if (p.mode === 'wave') { maxUp = C.MAX_FALL; maxDown = C.MAX_FALL; }
    p.vy = clamp(p.vy, -maxDown, maxUp);

    // integrate
    p.prevY = p.y;
    p.y += p.vy * dt;

    // rotation
    if (p.mode === 'cube') {
      if (!p.onGround) p.rot += 440 * p.gdir * dt;
      else p.rot = Math.round(p.rot / 90) * 90;
    } else if (p.mode === 'ball') {
      p.rot += p.vy * dt * 4;
    } else if (p.mode === 'ship' || p.mode === 'swing') {
      const target = clamp(p.vy * 0.055 * p.gdir, -42, 42);
      p.rot += (target - p.rot) * Math.min(1, dt * 14);
    } else if (p.mode === 'wave') {
      p.rot = p.vy > 0 ? 45 * p.gdir : -45 * p.gdir;
    }

    p.onGround = false;
    this.collide();
    if (this.p.dead) return;

    // trail
    this.trailTick++;
    if ((p.mode === 'ship' || p.mode === 'wave' || p.mode === 'swing') && this.trailTick % 2 === 0) {
      this.fx.push({ t: 'trail', x: p.x, y: p.y, life: 0.35, max: 0.35, mode: p.mode });
    }

    // progress
    this.progress = clamp(p.x / this.level.length, 0, 1);
    this.maxProgress = Math.max(this.maxProgress, this.progress);

    // practice checkpoints
    if (this.practice) {
      this.cpTimer += dt;
      if (this.cpTimer > 1.1 && p.onGround) {
        this.cpTimer = 0;
        this.checkpoint = { ...p };
      }
    }

    if (p.x >= this.level.length) {
      p.won = true;
      this.sfx('win');
    }
  }

  jump(vel) {
    this.p.vy = vel * this.p.gdir;
    this.p.onGround = false;
    this.sfx('jump');
  }

  // ---------------------------------------------------------------------
  applyObjects(press, click) {
    const p = this.p;
    const h = this.solidHalf;
    const objs = this.nearby(p.x - h, p.x + h);

    for (const o of objs) {
      if (o.t === 'portal') {
        if (p.x + h > o.x0 && p.x - h < o.x1 && p.y + h > o.y0 && p.y - h < o.y1) {
          this.applyPortal(o);
        }
      } else if (o.t === 'orb') {
        const dx = p.x - o.cx;
        const dy = p.y - o.cy;
        const inRange = dx * dx + dy * dy < (C.ORB_RADIUS + h) * (C.ORB_RADIUS + h);
        if (!inRange) this.orbArmed.delete(o.id);
        else if (press && !this.orbArmed.has(o.id)) {
          this.orbArmed.add(o.id);
          this.useOrb(o.color);
        }
      }
    }

    // pads: trigger once per contact
    const touching = new Set();
    for (const o of objs) {
      if (o.t !== 'pad') continue;
      if (p.x + h > o.x0 && p.x - h < o.x1 && p.y + h > o.y0 && p.y - h < o.y1) {
        touching.add(o.id);
        if (!this.touchingPads.has(o.id)) this.usePad(o.color);
      }
    }
    this.touchingPads = touching;
    void click;
  }

  applyPortal(o) {
    const p = this.p;
    if (o.kind === 'mode') {
      if (p.mode !== o.value) {
        p.mode = o.value;
        p.robotActive = false;
        p.holdTime = 0;
        p.vy = clamp(p.vy, -C.MAX_FALL, C.MAX_FALL);
        this.sfx('portal');
      }
    } else if (o.kind === 'gravity') {
      if (p.gdir !== o.value) { p.gdir = o.value; this.sfx('portal'); }
    } else if (o.kind === 'speed') {
      if (p.speed !== o.value) { p.speed = o.value; this.sfx('portal'); }
    } else if (o.kind === 'size') {
      const mini = o.value === 'mini';
      if (p.mini !== mini) { p.mini = mini; this.sfx('portal'); }
    }
  }

  useOrb(color) {
    const p = this.p;
    if (color === 'black') {
      p.vy = -C.BLACK_ORB_VELS[p.mode] * 60 * p.gdir;
    } else {
      const mul = C.ORB_MUL[p.mode][color];
      if (mul === undefined) return;
      p.vy = mul * C.jumpVel(p.speed) * p.gdir;
      if (color === 'blue' || color === 'green') p.gdir *= -1;
    }
    p.onGround = false;
    this.sfx('orb');
  }

  usePad(color) {
    const p = this.p;
    if (!C.PAD_VELS[p.mode] || C.PAD_VELS[p.mode][color] === undefined) {
      if (p.mode === 'wave' && color === 'blue') {
        p.gdir *= -1;
        this.sfx('pad');
      }
      return;
    }
    p.vy = C.PAD_VELS[p.mode][color] * 60 * p.gdir;
    if (color === 'blue') p.gdir *= -1;
    p.onGround = false;
    this.sfx('pad');
  }

  // ---------------------------------------------------------------------
  spiderTeleport() {
    const p = this.p;
    const h = this.solidHalf;
    const dir = p.gdir; // search direction: opposite gravity
    let target = dir > 0 ? C.CEILING_Y : 0;

    for (const o of this.nearby(p.x - h, p.x + h)) {
      if (o.t !== 'block') continue;
      if (Math.min(p.x + h, o.x1) - Math.max(p.x - h, o.x0) <= 0) continue;
      if (dir > 0) {
        if (o.y0 >= p.y + h - 0.5 && o.y0 < target) target = o.y0;
      } else {
        if (o.y1 <= p.y - h + 0.5 && o.y1 > target) target = o.y1;
      }
    }

    if (dir > 0) { p.y = target - h; p.gdir = -1; }
    else { p.y = target + h; p.gdir = 1; }
    p.vy = 0;
    p.prevY = p.y;
    p.onGround = true;
    this.sfx('jump');
    this.checkHazards();
  }

  // ---------------------------------------------------------------------
  collide() {
    const p = this.p;
    const h = this.solidHalf;

    // world floor
    if (p.y - h < 0) {
      p.y = h;
      if (p.vy < 0) p.vy = 0;
      p.onGround = true;
    }
    // world ceiling: lethal for the flying modes, solid otherwise
    if (p.y + h > C.CEILING_Y) {
      if (p.mode === 'ship' || p.mode === 'ufo' || p.mode === 'wave') {
        this.die();
        return;
      }
      p.y = C.CEILING_Y - h;
      if (p.vy > 0) p.vy = 0;
      p.onGround = true;
    }

    for (const o of this.nearby(p.x - h, p.x + h)) {
      if (o.t !== 'block') continue;
      const ox = Math.min(p.x + h, o.x1) - Math.max(p.x - h, o.x0);
      if (ox <= 0) continue;
      const oy = Math.min(p.y + h, o.y1) - Math.max(p.y - h, o.y0);
      if (oy <= 0) continue;

      const prevBottom = p.prevY - h;
      const prevTop = p.prevY + h;

      if (p.gdir === 1 && prevBottom >= o.y1 - 0.6) {
        p.y = o.y1 + h;
        if (p.vy < 0) p.vy = 0;
        p.onGround = true;
      } else if (p.gdir === -1 && prevTop <= o.y0 + 0.6) {
        p.y = o.y0 - h;
        if (p.vy > 0) p.vy = 0;
        p.onGround = true;
      } else {
        this.die();
        return;
      }
    }

    this.checkHazards();
  }

  checkHazards() {
    const p = this.p;
    const h = this.hazHalf;
    for (const o of this.nearby(p.x - h, p.x + h)) {
      if (o.t !== 'spike') continue;
      const z = o.hz;
      if (p.x + h > z.x0 && p.x - h < z.x1 && p.y + h > z.y0 && p.y - h < z.y1) {
        this.die();
        return;
      }
    }
  }

  die() {
    if (this.p.dead) return;
    this.p.dead = true;
    this.deadTimer = 0;
    this.shake = 1;
    this.sfx('die');
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 90 + Math.random() * 420;
      this.fx.push({
        t: 'shard',
        x: this.p.x,
        y: this.p.y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.5 + Math.random() * 0.45,
        max: 0.9,
        size: 3 + Math.random() * 7,
      });
    }
  }

  updateFx(dt) {
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      f.life -= dt;
      if (f.life <= 0) { this.fx.splice(i, 1); continue; }
      if (f.t === 'shard') {
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.vy -= 1400 * dt;
      }
    }
  }
}
