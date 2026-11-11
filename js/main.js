import * as C from './constants.js';
import { LEVELS, LevelBuilder, THEMES } from './level.js';
import { Game } from './game.js';
import { Renderer } from './render.js';
import { Sound, TRACKS } from './audio.js';
import { compileLevel } from './objects.js';
import { Editor, blankLevel } from './editor.js';
import { cloud } from './cloud.js';

const SAVE_KEY = 'gdweb.progress.v1';
const ED_KEY = 'gdweb.editor.levels.v1';

const canvas = document.getElementById('game');
const renderer = new Renderer(canvas);
const sound = new Sound();

const el = {
  menu: document.getElementById('menu'),
  hud: document.getElementById('hud'),
  pause: document.getElementById('pause'),
  complete: document.getElementById('complete'),
  auth: document.getElementById('auth'),
  community: document.getElementById('community'),
  editor: document.getElementById('editor'),
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
  accountBtn: document.getElementById('open-account'),
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
      <div class="lc-meta"><span>${lv.sandbox ? 'Free play sandbox' : 'Best ' + best + '%'}</span><span>${lv.length / 30 | 0} blocks</span></div>
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
  const inGame = screen === 'playing' || screen === 'paused' || screen === 'complete';
  el.menu.classList.toggle('hidden', screen !== 'menu');
  el.hud.classList.toggle('hidden', !inGame);
  el.pause.classList.toggle('hidden', screen !== 'paused');
  el.complete.classList.toggle('hidden', screen !== 'complete');
  el.auth.classList.toggle('hidden', screen !== 'auth');
  el.community.classList.toggle('hidden', screen !== 'community');
  el.editor.classList.toggle('hidden', screen !== 'editor');
}

function beginRun(level, usePractice, index = -1) {
  levelIndex = index;
  practice = usePractice || !!level.sandbox;
  save.practice = practice;
  persist();
  game = new Game(level, practice);
  game.onSfx = (n) => sound[n] && sound[n]();
  el.levelTitle.textContent = level.name;
  el.practiceTag.classList.toggle('hidden', !practice || level.sandbox);
  el.sandboxHint.classList.toggle('hidden', !level.sandbox);
  sound.start(TRACKS[level.track] || TRACKS.neon);
  sound.setMusic(sound.musicOn);
  show('playing');
  if (level.sandbox) el.modeBadge.textContent = 'CUBE';
}

function startLevel(i, usePractice) {
  beginRun(LEVELS[i], usePractice, i);
}

function levelFromData(data) {
  const builder = new LevelBuilder(
    (data.name || 'Custom level').slice(0, 40),
    data.difficulty || 'Normal',
    THEMES[data.theme] || THEMES.stereo,
    data.track || 'neon'
  );
  return compileLevel(data, builder);
}

function playData(data) {
  beginRun(levelFromData(data), false, -1);
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
  el.complete.querySelector('[data-act="next"]').classList.toggle('hidden', levelIndex < 0 || next >= LEVELS.length);
  show('complete');
}

el.complete.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  sound.click();
  if (b.dataset.act === 'next') startLevel(Math.min(levelIndex + 1, LEVELS.length - 1), false);
  else if (b.dataset.act === 'retry') beginRun(game.level, practice, levelIndex);
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
// Accounts
// ---------------------------------------------------------------------------
const authMsg = document.getElementById('auth-msg');
const authUser = document.getElementById('auth-user');
const authPass = document.getElementById('auth-pass');

function renderAuth() {
  const signedIn = !!cloud.user;
  document.getElementById('auth-current').classList.toggle('hidden', !signedIn);
  document.getElementById('auth-form').classList.toggle('hidden', signedIn);
  document.getElementById('auth-mode').textContent = cloud.mode === 'firebase'
    ? 'Firebase accounts'
    : 'Local accounts (this browser only) — add your Firebase config to enable shared uploads';
  if (signedIn) {
    document.getElementById('auth-who').textContent = `Signed in as ${cloud.user.username}`;
    el.accountBtn.textContent = `Account: ${cloud.user.username}`;
  } else {
    el.accountBtn.textContent = 'Account';
  }
}

async function doAuth(kind) {
  const u = authUser.value.trim();
  const p = authPass.value;
  if (!u || !p) { authMsg.textContent = 'Enter a username and password.'; return; }
  authMsg.textContent = 'Working…';
  try {
    const user = kind === 'up' ? await cloud.signUp(u, p) : await cloud.signIn(u, p);
    authMsg.textContent = `Signed in as ${user.username}`;
    authPass.value = '';
    renderAuth();
  } catch (e) {
    authMsg.textContent = e.message;
  }
}

document.getElementById('auth-signin').onclick = () => doAuth('in');
document.getElementById('auth-signup').onclick = () => doAuth('up');
document.getElementById('auth-signout').onclick = async () => {
  await cloud.signOut();
  authMsg.textContent = 'Signed out.';
  renderAuth();
};
document.getElementById('auth-close').onclick = () => show('menu');
document.getElementById('auth-back').onclick = () => show('menu');
el.accountBtn.onclick = () => {
  show('auth');
  renderAuth();
};

// ---------------------------------------------------------------------------
// Local level drafts
// ---------------------------------------------------------------------------
function localLevels() {
  try { return JSON.parse(localStorage.getItem(ED_KEY)) || []; } catch (e) { return []; }
}

function writeLocalLevels(list) {
  try { localStorage.setItem(ED_KEY, JSON.stringify(list.slice(0, 50))); } catch (e) { /* quota */ }
}

function saveEditorLevel() {
  const data = editor.snapshot();
  const all = localLevels();
  const i = all.findIndex((l) => l.name === data.name);
  if (i >= 0) all[i] = data; else all.unshift(data);
  writeLocalLevels(all);
  editor.el.status.textContent = `Saved "${data.name}" in this browser.`;
}

async function publishEditorLevel() {
  const data = editor.snapshot();
  editor.el.status.textContent = 'Uploading…';
  try {
    await cloud.upload(data);
    editor.el.status.textContent = `Uploaded "${data.name}".`;
  } catch (e) {
    editor.el.status.textContent = e.message;
  }
}

// ---------------------------------------------------------------------------
// Community
// ---------------------------------------------------------------------------
const communityList = document.getElementById('community-list');
const communityMsg = document.getElementById('community-msg');

function levelCard(opts) {
  const card = document.createElement('div');
  card.className = 'level-card';
  card.innerHTML = `
    <div class="lc-head">
      <span class="lc-name">${opts.name}</span>
      <span class="lc-diff d-${(opts.difficulty || 'normal').toLowerCase()}">${opts.difficulty || 'Normal'}</span>
    </div>
    <div class="lc-meta"><span class="lc-author">by ${opts.author}</span><span>${opts.blocks | 0} blocks</span></div>
    <div class="lc-actions"></div>`;
  const actions = card.querySelector('.lc-actions');
  for (const a of opts.actions) {
    const b = document.createElement('button');
    b.className = `btn ${a.primary ? 'primary' : 'ghost'}`;
    b.textContent = a.label;
    b.onclick = a.onClick;
    actions.appendChild(b);
  }
  return card;
}

async function refreshCommunity() {
  communityList.innerHTML = '';
  communityMsg.textContent = 'Loading…';
  try {
    const remote = await cloud.list();
    communityMsg.textContent = remote.length ? '' : 'No uploaded levels yet.';
    for (const rec of remote) {
      let data = null;
      try { data = JSON.parse(rec.data); } catch (e) { data = null; }
      if (!data) continue;
      communityList.appendChild(levelCard({
        name: rec.name,
        difficulty: rec.difficulty,
        author: rec.author,
        blocks: data.length,
        actions: [{ label: 'Play', primary: true, onClick: () => playData(data) }],
      }));
    }
  } catch (e) {
    communityMsg.textContent = `Could not load community levels: ${e.message}`;
  }

  const mine = localLevels();
  if (mine.length) {
    const head = document.createElement('p');
    head.className = 'auth-msg';
    head.textContent = 'Your local drafts';
    communityList.appendChild(head);
  }
  for (const data of mine) {
    communityList.appendChild(levelCard({
      name: data.name,
      difficulty: data.difficulty,
      author: 'you',
      blocks: data.length,
      actions: [
        { label: 'Play', primary: true, onClick: () => playData(data) },
        { label: 'Edit', onClick: () => openEditor(data) },
        {
          label: 'Delete',
          onClick: () => {
            writeLocalLevels(localLevels().filter((l) => l.name !== data.name));
            refreshCommunity();
          },
        },
      ],
    }));
  }
}

document.getElementById('open-community').onclick = () => {
  show('community');
  refreshCommunity();
};
document.getElementById('community-refresh').onclick = () => refreshCommunity();
document.getElementById('community-back').onclick = () => show('menu');

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------
const editor = new Editor({ author: () => (cloud.user ? cloud.user.username : 'you') });

function openEditor(data) {
  show('editor');
  editor.open(data || blankLevel());
}

document.getElementById('open-editor').onclick = () => openEditor(null);
document.getElementById('ed-back').onclick = () => {
  editor.close();
  buildMenu();
  show('menu');
};
document.getElementById('ed-play').onclick = () => {
  editor.close();
  playData(editor.snapshot());
};
document.getElementById('ed-save').onclick = () => saveEditorLevel();
document.getElementById('ed-publish').onclick = () => publishEditorLevel();

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
    if (state === 'menu' || state === 'editor' || state === 'auth' || state === 'community') return;
    e.preventDefault();
    if (state === 'paused') resume();
    press();
  } else if (k === 'Escape' || k === 'KeyP') {
    if (state === 'playing') { e.preventDefault(); pause(); }
    else if (state === 'paused') { e.preventDefault(); resume(); }
  } else if (k === 'KeyR') {
    if (state === 'playing') restartAttempt();
  } else if (k === 'KeyH') {
    showHitboxes = !showHitboxes;
  } else if (k === 'KeyM') {
    sound.setMusic(!sound.musicOn);
  } else if (e.key >= '1' && e.key <= '8' && game && game.level.sandbox && state === 'playing') {
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

  if (state !== 'editor') {
    renderer.draw(game || { p: { x: 0, y: 15, rot: 0, mode: 'cube', dead: true }, level: LEVELS[0], fx: [], shake: 0, solidHalf: 15, hazHalf: 15 }, now / 1000, { hitboxes: showHitboxes });
  }
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
buildMenu();
el.practiceBtn.textContent = practice ? 'Practice: on' : 'Practice: off';
el.practiceBtn.classList.toggle('on', practice);
show('menu');
cloud.init().then(() => renderAuth()).catch(() => renderAuth());
requestAnimationFrame(frame);
