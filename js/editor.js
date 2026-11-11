// In-browser level editor.
//
// Everything placeable comes from objects.js, so the palette is the same table
// the compiler and the validator use. Levels are plain JSON, which is what gets
// saved locally and uploaded to the backend.

import * as C from './constants.js';
import { OBJECTS, OBJECT_BY_ID, CATEGORIES, makeObject } from './objects.js';
import { THEMES } from './level.js';

export function blankLevel() {
  return {
    name: 'Untitled level',
    author: 'you',
    difficulty: 'Normal',
    theme: 'stereo',
    track: 'neon',
    length: 200,
    objects: [{ t: 'finish', id: 'finish', x: 200, y: 0 }],
  };
}

const clone = (o) => JSON.parse(JSON.stringify(o));

export class Editor {
  constructor(hooks = {}) {
    this.hooks = hooks;
    this.data = blankLevel();
    this.def = OBJECT_BY_ID.get('block');
    this.tool = 'place';
    this.grp = 0;
    this.camX = -120;
    this.zoom = 1;
    this.hover = null;
    this.selected = null;
    this.drag = null;
    this.running = false;
    this.history = [];
    this.mounted = false;
    this.last = 0;
  }

  // ------------------------------------------------------------------ setup
  mount() {
    if (this.mounted) return;
    this.mounted = true;
    const $ = (id) => document.getElementById(id);
    this.el = {
      screen: $('editor'),
      canvas: $('ed-canvas'),
      name: $('ed-name'),
      diff: $('ed-diff'),
      theme: $('ed-theme'),
      track: $('ed-track'),
      search: $('ed-search'),
      cats: $('ed-cats'),
      items: $('ed-items'),
      group: $('ed-group'),
      props: $('ed-props'),
      status: $('ed-status'),
    };
    this.ctx = this.el.canvas.getContext('2d');

    // categories
    this.el.cats.innerHTML = '';
    for (const c of CATEGORIES) {
      const b = document.createElement('button');
      b.className = 'ed-cat';
      b.textContent = c.label;
      b.dataset.cat = c.id;
      b.onclick = () => {
        this.cat = c.id;
        this.renderPalette();
      };
      this.el.cats.appendChild(b);
    }
    this.cat = CATEGORIES[0].id;
    this.renderPalette();

    this.el.search.oninput = () => this.renderPalette();
    this.el.name.oninput = () => { this.data.name = this.el.name.value.slice(0, 60); };
    this.el.diff.onchange = () => { this.data.difficulty = this.el.diff.value; };
    this.el.theme.onchange = () => { this.data.theme = this.el.theme.value; };
    this.el.track.onchange = () => { this.data.track = this.el.track.value; };
    this.el.group.oninput = () => { this.grp = Math.max(0, Math.min(999, parseInt(this.el.group.value, 10) || 0)); };

    document.getElementById('ed-tool-place').onclick = () => this.setTool('place');
    document.getElementById('ed-tool-erase').onclick = () => this.setTool('erase');
    document.getElementById('ed-tool-select').onclick = () => this.setTool('select');
    document.getElementById('ed-undo').onclick = () => this.undo();
    document.getElementById('ed-clear').onclick = () => {
      this.push();
      this.data.objects = [{ t: 'finish', id: 'finish', x: this.data.length, y: 0 }];
      this.selected = null;
      this.renderProps();
    };
    document.getElementById('ed-zoom-in').onclick = () => { this.zoom = Math.min(4, this.zoom * 1.25); };
    document.getElementById('ed-zoom-out').onclick = () => { this.zoom = Math.max(0.25, this.zoom / 1.25); };
    document.getElementById('ed-length').oninput = (e) => {
      const v = Math.max(30, parseInt(e.target.value, 10) || 200);
      this.data.length = v;
      const fin = this.data.objects.find((o) => o.t === 'finish');
      if (fin) fin.x = v;
    };

    // canvas input
    const cv = this.el.canvas;
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('pointerdown', (e) => this.onDown(e));
    cv.addEventListener('pointermove', (e) => this.onMove(e));
    window.addEventListener('pointerup', () => { this.drag = null; });
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        this.zoom = Math.max(0.25, Math.min(4, this.zoom * (e.deltaY < 0 ? 1.12 : 0.89)));
      } else {
        this.camX += (e.deltaY + e.deltaX) * 0.6 / this.S();
      }
    }, { passive: false });

    window.addEventListener('keydown', (e) => {
      if (!this.running) return;
      if (e.key === '1') this.setTool('place');
      if (e.key === '2') this.setTool('erase');
      if (e.key === '3') this.setTool('select');
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); this.undo(); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && this.selected) {
        this.push();
        this.data.objects = this.data.objects.filter((o) => o !== this.selected);
        this.selected = null;
        this.renderProps();
      }
    });
  }

  S() {
    return (this.el.canvas.height / (C.VIEW_H + 45)) * this.zoom;
  }

  setTool(t) {
    this.tool = t;
    for (const k of ['place', 'erase', 'select']) {
      document.getElementById(`ed-tool-${k}`).classList.toggle('on', k === t);
    }
  }

  renderPalette() {
    const q = (this.el.search.value || '').toLowerCase();
    this.el.items.innerHTML = '';
    for (const b of this.el.cats.children) b.classList.toggle('on', !q && b.dataset.cat === this.cat);
    // A search covers every category, not just the open tab.
    const list = OBJECTS.filter((o) => (q ? o.label.toLowerCase().includes(q) : o.cat === this.cat));
    if (!list.length) {
      this.el.items.innerHTML = '<p class="ed-empty">No objects match.</p>';
      return;
    }
    for (const def of list) {
      const b = document.createElement('button');
      b.className = 'ed-item';
      b.dataset.id = def.id;
      b.classList.toggle('on', this.def && this.def.id === def.id);
      b.innerHTML = `<i class="sw sw-${def.kind}"></i><span>${def.label}</span>`;
      b.title = def.note || def.label;
      b.onclick = () => {
        this.def = def;
        this.setTool('place');
        this.renderPalette();
        this.renderProps();
      };
      this.el.items.appendChild(b);
    }
  }

  renderProps() {
    const box = this.el.props;
    box.innerHTML = '';
    const row = (label, node) => {
      const d = document.createElement('div');
      d.className = 'ed-row';
      const l = document.createElement('span');
      l.textContent = label;
      d.append(l, node);
      box.appendChild(d);
    };

    if (this.selected) {
      const o = this.selected;
      const def = OBJECT_BY_ID.get(o.id) || { label: o.t };
      const head = document.createElement('h4');
      head.textContent = def.label || o.t;
      box.appendChild(head);

      const grp = document.createElement('input');
      grp.type = 'number';
      grp.min = 0; grp.max = 999; grp.value = o.grp || 0;
      grp.oninput = () => { o.grp = Math.max(0, parseInt(grp.value, 10) || 0); };
      row('group', grp);

      for (const [k, spec] of Object.entries(def.params || {})) {
        const inp = document.createElement('input');
        inp.type = 'number';
        inp.min = spec.min; inp.max = spec.max; inp.step = spec.step;
        inp.value = o.p?.[k] ?? spec.def;
        inp.oninput = () => {
          if (!o.p) o.p = {};
          o.p[k] = parseFloat(inp.value) || 0;
        };
        row(spec.label, inp);
      }

      if (o.t === 'block') {
        for (const k of ['w', 'h']) {
          const inp = document.createElement('input');
          inp.type = 'number'; inp.min = 0.5; inp.max = 40; inp.step = 0.5;
          inp.value = o[k] ?? 1;
          inp.oninput = () => { o[k] = Math.max(0.5, parseFloat(inp.value) || 1); };
          row(k, inp);
        }
      }

      const del = document.createElement('button');
      del.className = 'btn ghost';
      del.textContent = 'Delete object';
      del.onclick = () => {
        this.push();
        this.data.objects = this.data.objects.filter((x) => x !== o);
        this.selected = null;
        this.renderProps();
      };
      box.appendChild(del);
      return;
    }

    const info = document.createElement('p');
    info.className = 'ed-hint';
    info.textContent = this.def ? `Placing: ${this.def.label}` : 'Pick an object from the palette.';
    box.appendChild(info);

    const grp = document.createElement('input');
    grp.type = 'number';
    grp.min = 0; grp.max = 999; grp.value = this.grp;
    grp.oninput = () => { this.grp = Math.max(0, parseInt(grp.value, 10) || 0); this.el.group.value = this.grp; };
    row('group for new', grp);

    const len = document.createElement('input');
    len.type = 'number';
    len.min = 30; len.max = 5000; len.step = 10;
    len.value = this.data.length;
    len.oninput = () => {
      this.data.length = Math.max(30, parseInt(len.value, 10) || 200);
      const fin = this.data.objects.find((o) => o.t === 'finish');
      if (fin) fin.x = this.data.length;
    };
    row('length (blocks)', len);

    const count = document.createElement('p');
    count.className = 'ed-hint';
    count.textContent = `${this.data.objects.length} objects placed`;
    box.appendChild(count);
  }

  // ------------------------------------------------------------------ state
  push() {
    this.history.push(JSON.stringify(this.data.objects));
    if (this.history.length > 80) this.history.shift();
  }

  undo() {
    const prev = this.history.pop();
    if (!prev) return;
    this.data.objects = JSON.parse(prev);
    this.selected = null;
    this.renderProps();
  }

  open(data) {
    this.mount();
    this.data = data ? clone(data) : blankLevel();
    this.history = [];
    this.selected = null;
    this.camX = -120;
    this.zoom = 1;
    this.el.name.value = this.data.name;
    this.el.diff.value = this.data.difficulty || 'Normal';
    this.el.theme.value = this.data.theme || 'stereo';
    this.el.track.value = this.data.track || 'neon';
    this.el.group.value = this.grp;
    this.el.status.textContent = '';
    this.renderProps();
    this.setTool('place');
    this.running = true;
    this.loop(performance.now());
  }

  close() {
    this.running = false;
  }

  // ------------------------------------------------------------------ input
  worldAt(e) {
    const r = this.el.canvas.getBoundingClientRect();
    const px = (e.clientX - r.left) * (this.el.canvas.width / r.width);
    const py = (e.clientY - r.top) * (this.el.canvas.height / r.height);
    const S = this.S();
    return { x: this.camX + px / S, y: (this.el.canvas.height - py) / S - 45 };
  }

  cellAt(e) {
    const w = this.worldAt(e);
    return { x: Math.floor(w.x / 30), y: Math.floor(w.y / 30) };
  }

  onDown(e) {
    if (!this.running) return;
    const c = this.cellAt(e);
    if (e.button === 1 || e.shiftKey) {
      this.drag = { pan: true, startX: e.clientX, camX: this.camX };
      return;
    }
    if (e.button === 2 || this.tool === 'erase') { this.eraseAt(c); this.drag = { erase: true }; return; }
    if (this.tool === 'select') { this.selectAt(c); return; }
    this.placeAt(c);
    this.drag = { place: true };
  }

  onMove(e) {
    if (!this.running) return;
    const c = this.cellAt(e);
    this.hover = c;
    if (!this.drag) return;
    if (this.drag.pan) {
      const r = this.el.canvas.getBoundingClientRect();
      const dx = (e.clientX - this.drag.startX) * (this.el.canvas.width / r.width);
      this.camX = this.drag.camX - dx / this.S();
    } else if (this.drag.erase) this.eraseAt(c);
    else if (this.drag.place) this.placeAt(c);
  }

  objectAt(c) {
    for (let i = this.data.objects.length - 1; i >= 0; i--) {
      const o = this.data.objects[i];
      const w = o.w || o.r * 2 || 1;
      const h = o.h || o.r * 2 || 1;
      const ox = o.t === 'saw' ? o.x : o.x;
      const oy = o.t === 'saw' ? o.y : o.y;
      if (c.x >= ox && c.x < ox + w && c.y >= oy && c.y < oy + h) return o;
    }
    return null;
  }

  placeAt(c) {
    if (!this.def) return;
    if (this.lastPlace && this.lastPlace.x === c.x && this.lastPlace.y === c.y) return;
    this.lastPlace = c;
    this.push();

    const def = this.def;
    if (def.kind === 'finish') {
      this.data.objects = this.data.objects.filter((o) => o.t !== 'finish');
      this.data.objects.push({ t: 'finish', id: 'finish', x: Math.max(10, c.x), y: 0 });
      this.data.length = Math.max(30, c.x);
      const fin = document.getElementById('ed-length');
      if (fin) fin.value = this.data.length;
      this.renderProps();
      return;
    }

    // one trigger per cell keeps accidental stacks out
    if (def.kind === 'trigger') {
      this.data.objects = this.data.objects.filter((o) => !(o.t === 'trigger' && o.x === c.x && o.y === c.y));
    }

    const o = makeObject(def, c.x, c.y, { grp: this.grp });
    if (def.kind === 'portal' && (!c.y || def.pkind !== 'gravity')) o.y = Math.max(0, c.y);
    this.data.objects.push(o);
  }

  eraseAt(c) {
    const o = this.objectAt(c);
    if (!o) return;
    this.push();
    this.data.objects = this.data.objects.filter((x) => x !== o);
    if (this.selected === o) { this.selected = null; this.renderProps(); }
  }

  selectAt(c) {
    const o = this.objectAt(c);
    this.selected = o;
    this.renderProps();
  }

  // ------------------------------------------------------------------ draw
  loop(now) {
    if (!this.running) return;
    this.draw(now / 1000);
    requestAnimationFrame((t) => this.loop(t));
  }

  bx(x) { return (x * 30 - this.camX) * this.S(); }
  by(y) { return this.el.canvas.height - (y * 30 + 45) * this.S(); }

  draw(t) {
    const ctx = this.ctx;
    const cv = this.el.canvas;
    const S = this.S();
    const theme = THEMES[this.data.theme] || THEMES.stereo;

    const g = ctx.createLinearGradient(0, 0, 0, cv.height);
    g.addColorStop(0, theme.bg1);
    g.addColorStop(1, theme.bg2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cv.width, cv.height);

    const leftBlock = Math.floor(this.camX / 30) - 1;
    const rightBlock = Math.ceil(this.camX / 30 + cv.width / S / 30) + 1;

    // grid
    ctx.lineWidth = 1;
    for (let x = leftBlock; x <= rightBlock; x++) {
      const isMajor = x % 10 === 0;
      ctx.strokeStyle = isMajor ? 'rgba(120,190,255,0.16)' : 'rgba(120,190,255,0.06)';
      ctx.beginPath();
      ctx.moveTo(this.bx(x), 0);
      ctx.lineTo(this.bx(x), this.by(0));
      ctx.stroke();
    }
    for (let y = 0; y <= 10; y++) {
      ctx.strokeStyle = 'rgba(120,190,255,0.06)';
      ctx.beginPath();
      ctx.moveTo(0, this.by(y));
      ctx.lineTo(cv.width, this.by(y));
      ctx.stroke();
    }

    // ground
    ctx.fillStyle = theme.ground;
    ctx.fillRect(0, this.by(0), cv.width, 45 * S);
    ctx.strokeStyle = theme.groundLine;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, this.by(0));
    ctx.lineTo(cv.width, this.by(0));
    ctx.stroke();

    // objects
    for (const o of this.data.objects) this.drawObject(ctx, o, theme, S, t);

    // finish
    const fx = this.bx(this.data.length);
    ctx.fillStyle = theme.accent;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(fx - 2, this.by(10), 4, (10 + 45) * S);
    ctx.globalAlpha = 1;

    // hover ghost
    if (this.hover && this.def && this.tool === 'place') {
      ctx.save();
      ctx.globalAlpha = 0.45;
      const ghost = {
        t: this.def.kind, x: this.hover.x, y: this.hover.y,
        w: this.def.w, h: this.def.h, dir: this.def.dir, small: this.def.small,
        color: this.def.color, r: this.def.r, shape: this.def.shape, id: this.def.id,
        tt: this.def.tt,
      };
      this.drawObject(ctx, ghost, theme, S, t);
      ctx.restore();
    }

    // selection
    if (this.selected) {
      const o = this.selected;
      const w = o.w || (o.r ? o.r * 2 : 1);
      const h = o.h || (o.r ? o.r * 2 : 1);
      ctx.strokeStyle = '#ffd23f';
      ctx.lineWidth = 2;
      ctx.strokeRect(this.bx(o.x), this.by(o.y + h), w * 30 * S, h * 30 * S);
    }

    // ruler
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = `${11}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    for (let x = leftBlock; x <= rightBlock; x++) {
      if (x % 10 !== 0) continue;
      ctx.fillText(String(x), this.bx(x), cv.height - 6);
    }
  }

  drawObject(ctx, o, theme, S, t) {
    const bx = (v) => this.bx(v);
    const by = (v) => this.by(v);
    switch (o.t) {
      case 'block': {
        const w = (o.w || 1) * 30 * S;
        const h = (o.h || 1) * 30 * S;
        ctx.fillStyle = theme.block;
        ctx.fillRect(bx(o.x), by(o.y + (o.h || 1)), w, h);
        ctx.strokeStyle = theme.edge;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(bx(o.x), by(o.y + (o.h || 1)), w, h);
        break;
      }
      case 'spike': {
        const down = o.dir === -1;
        const base = down ? by(o.y + 1) : by(o.y);
        const tip = down ? base + (o.small ? 14 : 26) * S : base - (o.small ? 14 : 26) * S;
        const x0 = bx(o.x);
        const x1 = bx(o.x + 1);
        ctx.fillStyle = theme.spike;
        ctx.beginPath();
        ctx.moveTo((x0 + x1) / 2, tip);
        ctx.lineTo(x1, base);
        ctx.lineTo(x0, base);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'orb': {
        const col = { yellow: '#ffd23f', pink: '#ff5fbf', blue: '#4aa8ff', green: '#3fe07a', black: '#8a5cff', red: '#ff4a4a' }[o.color] || '#fff';
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(bx(o.x + 0.5), by(o.y + 0.5), 11 * S, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'pad': {
        const col = { yellow: '#ffd23f', pink: '#ff5fbf', blue: '#4aa8ff', red: '#ff4a4a' }[o.color] || '#fff';
        ctx.fillStyle = col;
        ctx.fillRect(bx(o.x) + 2, by(o.y) - 5 * S, 30 * S - 4, 6 * S);
        break;
      }
      case 'portal': {
        const col = o.pkind === 'mode'
          ? (C.MODE_INFO[o.value]?.color || '#8ef6ff')
          : o.pkind === 'gravity' ? '#6aa8ff' : o.pkind === 'speed' ? '#63ff9a' : '#ff7ad9';
        ctx.globalAlpha = 0.75;
        ctx.fillStyle = col;
        ctx.fillRect(bx(o.x) + 8 * S, by(o.y + 3), 14 * S, 3 * 30 * S);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = col;
        ctx.strokeRect(bx(o.x) + 8 * S, by(o.y + 3), 14 * S, 3 * 30 * S);
        break;
      }
      case 'saw': {
        const r = (o.r || 0.6) * 30 * S;
        const cx = bx(o.x + (o.r || 0.6));
        const cy = by(o.y + (o.r || 0.6));
        ctx.strokeStyle = '#ff8a7a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
          ctx.lineTo(cx + Math.cos(a) * r * 1.3, cy + Math.sin(a) * r * 1.3);
          ctx.stroke();
        }
        break;
      }
      case 'coin': {
        ctx.fillStyle = '#ffd23f';
        ctx.beginPath();
        ctx.arc(bx(o.x + 0.5), by(o.y + 0.5), 9 * S, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#7a5a00';
        ctx.font = `bold ${10 * S}px system-ui`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★', bx(o.x + 0.5), by(o.y + 0.5));
        ctx.textBaseline = 'alphabetic';
        break;
      }
      case 'trigger': {
        const col = '#63ff9a';
        ctx.globalAlpha = 0.8;
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(bx(o.x + 0.5), by(o.y) - 10 * S);
        ctx.lineTo(bx(o.x + 1), by(o.y + 0.5) - 10 * S);
        ctx.lineTo(bx(o.x + 0.5), by(o.y + 1) - 10 * S);
        ctx.lineTo(bx(o.x), by(o.y + 0.5) - 10 * S);
        ctx.closePath();
        ctx.stroke();
        ctx.fillStyle = col;
        ctx.font = `bold ${8 * S}px system-ui`;
        ctx.textAlign = 'center';
        ctx.fillText(String(o.tt || '?').toUpperCase().slice(0, 4), bx(o.x + 0.5), by(o.y) - 14 * S);
        ctx.globalAlpha = 1;
        break;
      }
      case 'checkpoint': {
        ctx.strokeStyle = '#63ff9a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bx(o.x), by(o.y));
        ctx.lineTo(bx(o.x), by(o.y) - 60 * S);
        ctx.stroke();
        break;
      }
      case 'teleport': {
        ctx.strokeStyle = '#c084ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(bx(o.x + 0.5), by(o.y + 0.5), 18 * S, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'deco': {
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = theme.glow;
        ctx.fillRect(bx(o.x) + 4, by(o.y + 1) + 4, 30 * S - 8, 30 * S - 8);
        ctx.globalAlpha = 1;
        break;
      }
      case 'finish': {
        for (let i = 0; i < 12; i++) {
          ctx.fillStyle = i % 2 ? theme.accent : 'rgba(255,255,255,0.75)';
          ctx.fillRect(bx(o.x) - 10 * S, by(10) + i * (55 * S / 12), 20 * S, 55 * S / 12);
        }
        break;
      }
      default:
        break;
    }
  }

  snapshot() {
    return clone({ ...this.data, author: this.hooks.author ? this.hooks.author() : this.data.author });
  }
}
