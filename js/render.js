import * as C from './constants.js';

const TAU = Math.PI * 2;
const GROUND_UNITS = 45; // ground band under y=0

const PORTAL_STYLE = {
  mode: { label: 'M', color: '#8ef6ff' },
  gravity: { label: 'G', color: '#6aa8ff' },
  speed: { label: 'S', color: '#63ff9a' },
  size: { label: 'Z', color: '#ff7ad9' },
};

const ORB_STYLE = {
  yellow: '#ffd23f', pink: '#ff5fbf', blue: '#4aa8ff',
  green: '#3fe07a', black: '#8a5cff', red: '#ff4a4a',
};
const PAD_STYLE = {
  yellow: '#ffd23f', pink: '#ff5fbf', blue: '#4aa8ff', red: '#ff4a4a',
};

function rr(ctx, x, y, w, h, r) {
  const k = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.lineTo(x + w - k, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + k);
  ctx.lineTo(x + w, y + h - k);
  ctx.quadraticCurveTo(x + w, y + h, x + w - k, y + h);
  ctx.lineTo(x + k, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - k);
  ctx.lineTo(x, y + k);
  ctx.quadraticCurveTo(x, y, x + k, y);
  ctx.closePath();
}

export class Renderer {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = canvas.width;
    this.H = canvas.height;
    this.S = this.H / (C.VIEW_H + GROUND_UNITS);
    this.viewW = this.W / this.S;
    this.camX = 0;
  }

  sx(x) { return (x - this.camX) * this.S; }
  sy(y) { return this.H - (y + GROUND_UNITS) * this.S; }

  draw(game, t, opts = {}) {
    const ctx = this.ctx;
    const p = game.p;
    const theme = game.level.theme;
    this.camX = p.x - this.viewW * 0.33;
    this.t = t;

    ctx.save();
    if (game.shake > 0) {
      const s = game.shake * 9;
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }

    this.drawBackground(theme, t);
    this.drawGround(theme);
    this.drawObjects(game, theme, opts);
    this.drawFx(game);
    if (!p.dead && !p.won) this.drawPlayer(game);
    this.drawFinish(game, theme);
    ctx.restore();

    if (opts.hitboxes) this.drawHitboxes(game);
  }

  // ---------------------------------------------------------------------
  drawBackground(theme, t) {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, this.H);
    g.addColorStop(0, theme.bg1);
    g.addColorStop(1, theme.bg2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.W, this.H);

    // parallax grid
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = theme.glow;
    ctx.lineWidth = 1;
    const step = 60 * this.S;
    const off = (-this.camX * 0.55 * this.S) % step;
    for (let x = off; x < this.W + step; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.sy(0));
      ctx.stroke();
    }
    const stepY = step;
    for (let y = 0; y < this.sy(0); y += stepY) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.W, y);
      ctx.stroke();
    }
    ctx.restore();

    // pulsing horizon glow
    const hg = ctx.createRadialGradient(this.W * 0.3, this.sy(0), 10, this.W * 0.3, this.sy(0), this.W * 0.7);
    hg.addColorStop(0, theme.glow + '44');
    hg.addColorStop(1, 'transparent');
    ctx.fillStyle = hg;
    ctx.fillRect(0, 0, this.W, this.sy(0));

    // drifting diagonal speed lines
    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 2;
    const gap = 140;
    const offx = (-this.camX * 0.8) % gap;
    for (let x = offx - gap; x < this.W + gap; x += gap) {
      const ph = (t * 40 + x) % 120;
      ctx.beginPath();
      ctx.moveTo(x, ph);
      ctx.lineTo(x + 26, ph - 40);
      ctx.stroke();
    }
    ctx.restore();
    void t;
  }

  drawGround(theme) {
    const ctx = this.ctx;
    const y0 = this.sy(0);
    const g = ctx.createLinearGradient(0, y0, 0, this.H);
    g.addColorStop(0, theme.ground);
    g.addColorStop(1, '#05060f');
    ctx.fillStyle = g;
    ctx.fillRect(0, y0, this.W, this.H - y0);

    // moving hatching
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, y0, this.W, this.H - y0);
    ctx.clip();
    ctx.strokeStyle = theme.groundLine;
    ctx.globalAlpha = 0.18;
    ctx.lineWidth = 2;
    const step = 46;
    const off = (-this.camX * this.S) % step;
    for (let x = off - step; x < this.W + step * 2; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.lineTo(x - 90, this.H);
      ctx.stroke();
    }
    ctx.restore();

    // bright surface line
    ctx.save();
    ctx.shadowColor = theme.groundLine;
    ctx.shadowBlur = 18;
    ctx.strokeStyle = theme.groundLine;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, y0);
    ctx.lineTo(this.W, y0);
    ctx.stroke();
    ctx.restore();
  }

  visible(o) {
    return o.x1 > this.camX - 80 && o.x0 < this.camX + this.viewW + 80;
  }

  drawObjects(game, theme, opts) {
    const ctx = this.ctx;
    const t = this.t;
    const objs = game.level.objects;

    // blocks
    for (const o of objs) {
      if (o.t !== 'block' || !this.visible(o)) continue;
      const x = this.sx(o.x0);
      const y = this.sy(o.y1);
      const w = (o.x1 - o.x0) * this.S;
      const h = (o.y1 - o.y0) * this.S;
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, theme.block);
      g.addColorStop(1, '#0a0d1d');
      ctx.fillStyle = g;
      rr(ctx, x, y, w, h, 3);
      ctx.fill();
      ctx.strokeStyle = theme.edge;
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.globalAlpha = 1;
      // inner grid
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = theme.edge;
      ctx.globalAlpha = 0.14;
      ctx.lineWidth = 1;
      for (let gx = x; gx < x + w; gx += 30 * this.S) {
        ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx, y + h); ctx.stroke();
      }
      for (let gy = y; gy < y + h; gy += 30 * this.S) {
        ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); ctx.stroke();
      }
      ctx.restore();
      // lit top edge
      ctx.strokeStyle = theme.glow;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(x + 2, y + 1.5);
      ctx.lineTo(x + w - 2, y + 1.5);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // spikes
    for (const o of objs) {
      if (o.t !== 'spike' || !this.visible(o)) continue;
      const x0 = this.sx(o.x0);
      const x1 = this.sx(o.x1);
      const cx = (x0 + x1) / 2;
      const baseY = o.dir === 1 ? this.sy(o.y0) : this.sy(o.y1);
      const tipY = o.dir === 1 ? this.sy(o.y1) : this.sy(o.y0);
      ctx.save();
      ctx.shadowColor = theme.glow;
      ctx.shadowBlur = 10;
      const g = ctx.createLinearGradient(0, tipY, 0, baseY);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(1, theme.spike);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(cx, tipY);
      ctx.lineTo(x1 - 1, baseY);
      ctx.lineTo(x0 + 1, baseY);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = theme.glow;
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // orbs
    for (const o of objs) {
      if (o.t !== 'orb' || !this.visible(o)) continue;
      const x = this.sx(o.cx);
      const y = this.sy(o.cy);
      const col = ORB_STYLE[o.color] || '#fff';
      const pulse = 1 + Math.sin(t * 5 + o.id) * 0.08;
      const r = 13 * this.S * pulse;
      ctx.save();
      ctx.shadowColor = col;
      ctx.shadowBlur = 20;
      ctx.fillStyle = 'rgba(6,10,24,0.75)';
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = col;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 0.55;
      ctx.beginPath(); ctx.arc(x, y, r * 0.45, 0, TAU); ctx.fillStyle = col; ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, r * 1.55, t * 2, t * 2 + 2.2); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // pads
    for (const o of objs) {
      if (o.t !== 'pad' || !this.visible(o)) continue;
      const x = this.sx(o.x0);
      const y = this.sy(o.y1);
      const w = (o.x1 - o.x0) * this.S;
      const h = Math.max(6, (o.y1 - o.y0) * this.S);
      const col = PAD_STYLE[o.color] || '#fff';
      ctx.save();
      ctx.shadowColor = col;
      ctx.shadowBlur = 16;
      ctx.fillStyle = col;
      rr(ctx, x + 1, y - 2, w - 2, h + 2, 4);
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#fff';
      rr(ctx, x + 4, y, w - 8, 2.5, 1);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // portals
    for (const o of objs) {
      if (o.t !== 'portal' || !this.visible(o)) continue;
      const st = PORTAL_STYLE[o.kind] || PORTAL_STYLE.mode;
      let col = st.color;
      if (o.kind === 'mode') col = C.MODE_INFO[o.value].color;
      if (o.kind === 'gravity') col = o.value === -1 ? '#6aa8ff' : '#ffd23f';
      if (o.kind === 'speed') col = ['#7ce7ff', '#63ff9a', '#ffd23f', '#ff9a3c', '#ff4a4a'][o.value] || st.color;
      const x = this.sx(o.x0);
      const y = this.sy(o.y1);
      const w = (o.x1 - o.x0) * this.S;
      const h = (o.y1 - o.y0) * this.S;
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, col + '22');
      g.addColorStop(0.5, col + '99');
      g.addColorStop(1, col + '22');
      ctx.save();
      ctx.shadowColor = col;
      ctx.shadowBlur = 22;
      ctx.fillStyle = g;
      rr(ctx, x + w * 0.2, y, w * 0.6, h, w * 0.3);
      ctx.fill();
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.5;
      rr(ctx, x + w * 0.2, y, w * 0.6, h, w * 0.3);
      ctx.stroke();
      ctx.restore();

      // inner arrows
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      const cy = y + h / 2;
      const n = 3;
      for (let i = 0; i < n; i++) {
        const yy = cy + (i - 1) * h * 0.2 + Math.sin(t * 4) * 2;
        ctx.beginPath();
        ctx.moveTo(x + w * 0.32, yy + 5);
        ctx.lineTo(x + w * 0.5, yy - 4);
        ctx.lineTo(x + w * 0.68, yy + 5);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawFinish(game, theme) {
    const ctx = this.ctx;
    const x = this.sx(game.level.length);
    if (x < -60 || x > this.W + 60) return;
    const yTop = this.sy(C.VIEW_H);
    const yBot = this.sy(0);
    ctx.save();
    ctx.globalAlpha = 0.85;
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = i % 2 ? theme.accent : 'rgba(255,255,255,0.7)';
      const hh = (yBot - yTop) / 14;
      ctx.fillRect(x - 12, yTop + i * hh, 24, hh);
    }
    ctx.restore();
    ctx.save();
    ctx.shadowColor = theme.accent;
    ctx.shadowBlur = 26;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('FINISH', x, yTop - 10);
    ctx.restore();
  }

  drawFx(game) {
    const ctx = this.ctx;
    for (const f of game.fx) {
      const a = Math.max(0, f.life / f.max);
      if (f.t === 'shard') {
        ctx.globalAlpha = a;
        ctx.fillStyle = '#8ef6ff';
        const s = f.size * (0.4 + a * 0.6);
        ctx.fillRect(this.sx(f.x) - s / 2, this.sy(f.y) - s / 2, s, s);
      } else if (f.t === 'trail') {
        ctx.globalAlpha = a * 0.5;
        ctx.fillStyle = C.MODE_INFO[f.mode].color;
        const r = 9 * this.S * a;
        ctx.beginPath();
        ctx.arc(this.sx(f.x), this.sy(f.y), r, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------------
  drawPlayer(game) {
    const ctx = this.ctx;
    const p = game.p;
    const S = this.S * (p.mini ? C.MINI_SCALE : 1);
    const col = C.MODE_INFO[p.mode].color;

    ctx.save();
    ctx.translate(this.sx(p.x), this.sy(p.y));
    ctx.shadowColor = col;
    ctx.shadowBlur = 16;
    ctx.rotate((p.rot || 0) * (Math.PI / 180));

    if (p.mode === 'cube' || p.mode === 'robot' || p.mode === 'spider') {
      const half = 15 * S;
      const g = ctx.createLinearGradient(-half, -half, half, half);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.35, col);
      g.addColorStop(1, '#0b2233');
      ctx.fillStyle = g;
      rr(ctx, -half, -half, half * 2, half * 2, 4 * S);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2 * S;
      ctx.stroke();

      // face
      ctx.fillStyle = '#04121c';
      const ey = -3 * S;
      ctx.beginPath(); ctx.ellipse(-5 * S, ey, 2.4 * S, 3.4 * S, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(5 * S, ey, 2.4 * S, 3.4 * S, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#04121c';
      ctx.lineWidth = 2 * S;
      ctx.beginPath();
      ctx.arc(0, 3 * S, 5 * S, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();

      if (p.mode === 'robot') {
        ctx.fillStyle = col;
        ctx.fillRect(-8 * S, half, 5 * S, 6 * S);
        ctx.fillRect(3 * S, half, 5 * S, 6 * S);
        ctx.fillRect(-1.5 * S, -half - 6 * S, 3 * S, 6 * S);
      }
      if (p.mode === 'spider') {
        ctx.strokeStyle = col;
        ctx.lineWidth = 2.4 * S;
        for (const s of [-1, 1]) {
          for (const k of [0.4, 1]) {
            ctx.beginPath();
            ctx.moveTo(s * half * 0.7, half * 0.5);
            ctx.lineTo(s * (half + 4 * S) * k, half + 5 * S);
            ctx.stroke();
          }
        }
      }
    } else if (p.mode === 'ship' || p.mode === 'swing') {
      const g = ctx.createLinearGradient(-14 * S, 0, 14 * S, 0);
      g.addColorStop(0, '#0b2233');
      g.addColorStop(0.6, col);
      g.addColorStop(1, '#ffffff');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(17 * S, 0);
      ctx.lineTo(-10 * S, -11 * S);
      ctx.lineTo(-15 * S, 0);
      ctx.lineTo(-10 * S, 11 * S);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.8 * S;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.arc(1 * S, -1 * S, 4.2 * S, 0, TAU); ctx.fill();
      if (p.mode === 'swing') {
        ctx.strokeStyle = col;
        ctx.lineWidth = 2 * S;
        ctx.beginPath(); ctx.arc(0, 0, 19 * S, 0, TAU); ctx.stroke();
      }
    } else if (p.mode === 'ball') {
      const r = 14 * S;
      const g = ctx.createRadialGradient(-4 * S, -4 * S, 1, 0, 0, r);
      g.addColorStop(0, '#fff');
      g.addColorStop(1, col);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#0b2233';
      ctx.lineWidth = 2.4 * S;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.6, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.stroke();
    } else if (p.mode === 'ufo') {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(0, 5 * S, 15 * S, 6 * S, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#eaffff';
      ctx.beginPath();
      ctx.arc(0, -1 * S, 8 * S, Math.PI, 0);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#0b2233';
      ctx.lineWidth = 1.6 * S;
      ctx.beginPath(); ctx.arc(0, -1 * S, 8 * S, Math.PI, 0); ctx.stroke();
    } else if (p.mode === 'wave') {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(11 * S, 0);
      ctx.lineTo(0, -9 * S);
      ctx.lineTo(-11 * S, 0);
      ctx.lineTo(0, 9 * S);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.6 * S;
      ctx.stroke();
    }
    ctx.restore();
  }

  drawHitboxes(game) {
    const ctx = this.ctx;
    const p = game.p;
    if (!p.dead) {
      const hs = game.solidHalf;
      const hh = game.hazHalf;
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#38e8ff';
      ctx.strokeRect(this.sx(p.x - hs), this.sy(p.y + hs), hs * 2 * this.S, hs * 2 * this.S);
      ctx.strokeStyle = '#ff3b3b';
      ctx.strokeRect(this.sx(p.x - hh), this.sy(p.y + hh), hh * 2 * this.S, hh * 2 * this.S);
    }
    ctx.strokeStyle = '#ff3b3b';
    for (const o of game.level.objects) {
      if (!this.visible(o)) continue;
      if (o.t === 'spike') {
        const z = o.hz;
        ctx.strokeRect(this.sx(z.x0), this.sy(z.y1), (z.x1 - z.x0) * this.S, (z.y1 - z.y0) * this.S);
      } else if (o.t === 'block') {
        ctx.strokeStyle = 'rgba(54,255,138,0.85)';
        ctx.strokeRect(this.sx(o.x0), this.sy(o.y1), (o.x1 - o.x0) * this.S, (o.y1 - o.y0) * this.S);
        ctx.strokeStyle = '#ff3b3b';
      }
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.moveTo(0, this.sy(C.VIEW_H));
    ctx.lineTo(this.W, this.sy(C.VIEW_H));
    ctx.stroke();
  }
}
