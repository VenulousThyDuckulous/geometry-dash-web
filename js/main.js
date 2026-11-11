import * as C from './constants.js';
import { LEVELS } from './level.js';
import { Game } from './game.js';
import { Renderer } from './render.js';
import { Sound, TRACKS } from './audio.js';

const SAVE_KEY = 'gdweb.progress.v1';

const canvas = document.getElementById('game');
const renderer = new Renderer(canvas);
const sound = new Sound();

const el = {
  menu: document.getElementById('menu'),
  hud: document.getElementById('hud'),
  pause: document.getElementById('pause'),
  complete: document.getElementById('complete'),
  grid: document.getElementById('level-grid'),
  attempts: document.getElementById('attempts'),
  progressFill: document.getElementById('progress-fill'),
  progressPct: document.getElementById('progress-pct'),
  modeBadge: document.getElementById('mode-badge'),
  speedBadge: document.getElementById('speed-badge'),
  levelTitle: document.getElementById('level-title'),
  practiceTag: document.getElementById('practice-tag'),
  completeTitle: document.getElementById('complete-title'),
  completeStats: document.getElementById('complete-stats'),
  bestList: document.getElementById('best-list'),
  practiceBtn: document.getElementById('practice-toggle'),
  sandboxHint: document.getElementById('sandbox-hint'),
};

let save = { best: {}, practice: false };
try {
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw) save = { ...save, ...JSON.parse(raw) };
} catch (e) { /* ignore */ }

function persist() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ }
}

let state = 'menu';
let game = null;
let levelIndex = 0;
let practice = !!save.practice;
let showHitboxes = false;
const input = { down: false };

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------
function buildMenu() {
  el.grid.innerHTML = '';
  LEVELS.forEach((lv, i) => {
    const best = save.best[lv.name] || 0;
    const card = document.createElement('div');
    card.className = 'level-card';
    card.style.setProperty('--accent', lv.theme.glow);
    card.innerHTML = `
      <div class="lc-head">
        <span class="lc-name">${lv.name}</span>
        <span class="lc-diff d-${lv.difficulty.toLowerCase()}">${lv.difficulty}</span>
      </div>
      <div class="lc-bar"><i style="width:${best}%"></i></div>
      <div class="lc-meta"><span>${lv.sandbox ? 'Free play sandbox' : 'Best ' + best + '%'}</span><span>${LEVELS[i].length / 30 | 0} blocks</span></div>
      <div class="lc-actions">
        <button class="btn primary" data-act="play" data-i="${i}">${lv.sandbox ? 'Enter' : 'Play'}</button>
        <button class="btn ghost" data-act="practice" data-i="${i}">Practice</button>
      </div>`;
    el.grid.appendChild(card);
  });
  el.bestList.textContent = `${Object.keys(save.best).filter((k) => save.best[k] >= 100).length} / ${LEVELS.length} complete`;
}

el.grid.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  sound.init();
  sound.click();
  const i = parseInt(b.dataset.i, 10);
  startLevel(i, b.dataset.act === 'practice');
});

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------
function show(screen) {
  state = screen;
  el.menu.classList.toggle('hidden', screen !== 'menu');
  el.hud.classList.toggle('hidden', screen === 'menu');
  el.pause.classList.toggle('hidden', screen !== 'paused');
  el.complete.classList.toggle('hidden', screen !== 'complete');
}

function startLevel(i, usePractice) {
  levelIndex = i;
  practice = usePractice || LEVELS[i].sandbox;
  save.practice = practice;
  persist();
  game = new Game(LEVELS[i], practice);
  game.onSfx = (n) => sound[n] && sound[n]();
  el.levelTitle.textContent = LEVELS[i].name;
  el.practiceTag.classList.toggle('hidden', !practice || LEVELS[i].sandbox);
  el.sandboxHint.classList.toggle('hidden', !LEVELS[i].sandbox);
  sound.start(TRACKS[LEVELS[i].track] || TRACKS.neon);
  sound.setMusic(sound.musicOn);
  show('playing');
  if (LEVELS[i].sandbox) el.modeBadge.textContent = 'CUBE';
}

function restartAttempt() {
  if (!game) return;
  saveBest();
  game.restart();
  updateHud();
}

function saveBest() {
  if (!game) return;
  const pct = Math.floor(game.maxProgress * 100);
  const name = game.level.name;
  if (!save.best[name] || pct > save.best[name]) {
    save.best[name] = pct;
    persist();
  }
}

function updateHud() {
  if (!game) return;
  el.attempts.textContent = `Attempt ${game.attempts + 1}`;
  const pct = Math.round(game.progress * 100);
  el.progressFill.style.width = `${pct}%`;
  el.progressPct.textContent = `${pct}%`;
  el.modeBadge.textContent = C.MODE_INFO[game.p.mode].label.toUpperCase();
  el.modeBadge.style.color = C.MODE_INFO[game.p.mode].color;
  el.speedBadge.textContent = C.SPEEDS[game.p.speed].label;
  el.speedBadge.style.color = ['#7ce7ff', '#63ff9a', '#ffd23f', '#ff9a3c', '#ff4a4a'][game.p.speed];
}

function pause() {
  if (state !== 'playing') return;
  state = 'paused';
  el.pause.classList.remove('hidden');
  sound.stop();
}

function resume() {
  if (state !== 'paused') return;
  state = 'playing';
  el.pause.classList.add('hidden');
  if (sound.playing === false) sound.playing = true;
}

function toMenu() {
  saveBest();
  sound.stop();
  state = 'menu';
  buildMenu();
  show('menu');
}

function completeLevel() {
  saveBest();
  save.best[game.level.name] = 100;
  persist();
  sound.stop();
  el.completeTitle.textContent = `${game.level.name} complete!`;
  el.completeStats.textContent = `${game.attempts + 1} attempt${game.attempts ? 's' : ''}${practice ? ' · practice' : ''}`;
  const next = levelIndex + 1;
  el.complete.querySelector('[data-act="next"]').classList.toggle('hidden', next >= LEVELS.length);
  show('complete');
}

el.complete.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  sound.click();
  if (b.dataset.act === 'next') startLevel(Math.min(levelIndex + 1, LEVELS.length - 1), false);
  else if (b.dataset.act === 'retry') startLevel(levelIndex, practice);
  else toMenu();
});

el.pause.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  sound.click();
  if (b.dataset.act === 'resume') resume();
  else if (b.dataset.act === 'restart') { resume(); restartAttempt(); }
  else if (b.dataset.act === 'menu') toMenu();
  else if (b.dataset.act === 'hitbox') {
    showHitboxes = !showHitboxes;
    b.classList.toggle('on', showHitboxes);
  } else if (b.dataset.act === 'music') {
    sound.setMusic(!sound.musicOn);
    b.classList.toggle('on', sound.musicOn);
    b.textContent = sound.musicOn ? 'Music: on' : 'Music: off';
  } else if (b.dataset.act === 'sfx') {
    sound.setSfx(!sound.sfxOn);
    b.classList.toggle('on', sound.sfxOn);
    b.textContent = sound.sfxOn ? 'SFX: on' : 'SFX: off';
  }
});

document.getElementById('pause-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  sound.click();
  if (state === 'playing') pause();
});

el.practiceBtn.addEventListener('click', () => {
  practice = !practice;
  save.practice = practice;
  persist();
  el.practiceBtn.textContent = practice ? 'Practice: on' : 'Practice: off';
  el.practiceBtn.classList.toggle('on', practice);
});

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
function press() {
  input.down = true;
  if (state === 'playing' && game && game.p.dead && game.deadTimer > 0.12) restartAttempt();
}
function release() { input.down = false; }

window.addEventListener('keydown', (e) => {
  if (e.repeat) {
    if (e.code === 'Space' || e.code === 'ArrowUp') e.preventDefault();
    return;
  }
  const k = e.code;
  if (k === 'Space' || k === 'ArrowUp' || k === 'KeyW' || k === 'KeyZ') {
    e.preventDefault();
    if (state === 'menu') return;
    if (state === 'paused') resume();
    press();
  } else if (k === 'Escape' || k === 'KeyP') {
    e.preventDefault();
    if (state === 'playing') pause();
    else if (state === 'paused') resume();
  } else if (k === 'KeyR') {
    if (state === 'playing') restartAttempt();
  } else if (k === 'KeyH') {
    showHitboxes = !showHitboxes;
  } else if (k === 'KeyM') {
    sound.setMusic(!sound.musicOn);
  } else if (e.key >= '1' && e.key <= '8' && game && game.level.sandbox) {
    const m = C.MODES[parseInt(e.key, 10) - 1];
    if (m) {
      game.p.mode = m;
      game.p.onGround = false;
      game.p.vy = 0;
      game.p.ticksHeld = 0;
      game.p.robotActive = false;
      updateHud();
    }
  }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'KeyZ') release();
});
canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); sound.init(); press(); });
window.addEventListener('pointerup', release);
window.addEventListener('blur', () => { release(); if (state === 'playing') pause(); });

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------
let last = performance.now();
let acc = 0;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (state === 'playing' && game) {
    acc += dt;
    let steps = 0;
    while (acc >= C.DT && steps < 12) {
      game.tick(input.down);
      acc -= C.DT;
      steps++;
    }
    if (acc > C.DT * 12) acc = 0;
    game.updateFx(dt);

    if (game.p.dead && game.deadTimer > 0.45) restartAttempt();
    if (game.p.won && state === 'playing') completeLevel();
    updateHud();
  }

  renderer.draw(game || { p: { x: 0, y: 15, rot: 0, mode: 'cube', dead: true }, level: LEVELS[0], fx: [], shake: 0, solidHalf: 15, hazHalf: 15 }, now / 1000, { hitboxes: showHitboxes });
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
buildMenu();
el.practiceBtn.textContent = practice ? 'Practice: on' : 'Practice: off';
el.practiceBtn.classList.toggle('on', practice);
show('menu');
requestAnimationFrame(frame);
