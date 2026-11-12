// Geometry Dash level-data decoding and mapping.
//
// A level is stored as a base64 blob (gzip or zlib compressed) whose payload is
// a ";"-separated list of objects, each a comma-separated key,value stream:
//
//   1 = object ID, 2 = x position, 3 = y position, 6 = rotation, 21 = colour
//
// Coordinates are in GD units: 30 units per block, and x/y are the object's
// CENTRE, with y increasing upward. The importer converts that into the block
// grid this game uses (bottom-left corners, ground at y = 0).
//
// Shared by tools/gdimport.mjs and the round-trip test in tools/validate.mjs.

import zlib from 'node:zlib';

export const BLOCK = 30;

// ---------------------------------------------------------------------------
// Encoding
// ---------------------------------------------------------------------------

/** Decodes a compressed level string (or passes a plain object string through). */
export function decodeLevelString(raw) {
  const s = String(raw || '').replace(/\s+/g, '');
  if (!s) throw new Error('empty level string');
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const buf = Buffer.from(b64, 'base64');
  let text;
  if (buf[0] === 0x1f && buf[1] === 0x8b) {
    text = zlib.gunzipSync(buf).toString('utf8');
  } else if ((buf[0] & 0x0f) === 8 && (((buf[0] << 8) | buf[1]) % 31) === 0) {
    text = zlib.inflateSync(buf).toString('utf8');
  } else {
    text = s; // already a plain "id,x,y;..." string
  }
  if (!text.includes(';') && !text.includes(',')) throw new Error('not a level string');
  return text;
}

/** Compresses a level string the way Geometry Dash stores it. */
export function encodeLevelString(text) {
  return zlib
    .gzipSync(Buffer.from(text, 'utf8'))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/** Splits a level string into objects with numeric id/x/y/rotation. */
export function parseObjects(levelString) {
  const out = [];
  for (const chunk of String(levelString).split(';')) {
    if (!chunk) continue;
    const parts = chunk.split(',');
    const kv = Object.create(null);
    for (let i = 0; i + 1 < parts.length; i += 2) kv[parts[i]] = parts[i + 1];
    const id = parseInt(kv['1'], 10);
    if (!Number.isFinite(id)) continue;
    out.push({
      id,
      x: parseFloat(kv['2'] ?? '0') || 0,
      y: parseFloat(kv['3'] ?? '0') || 0,
      rot: parseFloat(kv['6'] ?? '0') || 0,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Object IDs (names from the community object-ID index)
// ---------------------------------------------------------------------------

// Every 30x30 square that behaves as solid ground.
export const SOLID_IDS = new Set([1, 2, 3, 4, 5, 6, 7, 40, 192]);

// id -> 'normal' | 'half' | 'small'
export const SPIKE_IDS = new Map([
  [8, 'normal'], [39, 'half'], [103, 'small'],
  [177, 'normal'], [178, 'half'], [179, 'small'],
]);

export const ORB_IDS = new Map([
  [36, 'yellow'], [141, 'pink'], [84, 'blue'],
  [1022, 'green'], [1333, 'red'], [1330, 'black'],
]);

export const PAD_IDS = new Map([
  [35, 'yellow'], [140, 'pink'], [67, 'blue'], [1332, 'red'],
]);

export const MODE_PORTALS = new Map([
  [12, 'cube'], [13, 'ship'], [47, 'ball'], [111, 'ufo'],
  [660, 'wave'], [745, 'robot'], [1331, 'spider'], [1933, 'swing'],
]);

// Blue gravity portal = normal gravity (down), yellow = flipped.
export const GRAVITY_PORTALS = new Map([[10, 1], [11, -1]]);

export const SPEED_PORTALS = new Map([[200, 0], [201, 1], [202, 2], [203, 3], [1334, 4]]);

export const FINISH_IDS = new Set([34, 1931, 3600]);
export const START_IDS = new Set([31]);

// ---------------------------------------------------------------------------
// Mapping to this game's level format
// ---------------------------------------------------------------------------

const round = (n) => Math.round(n * 1000) / 1000;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Converts parsed GD objects into the editor/level JSON this game compiles.
 *
 * @param {Array<{id:number,x:number,y:number,rot:number}>} objects
 * @param {{name?:string, difficulty?:string, theme?:string, track?:string}} meta
 * @returns {{data:object, stats:{mapped:number, ignored:number, byType:object}}}
 */
export function toEditorLevel(objects, meta = {}) {
  const items = [];
  const byType = {};
  let ignored = 0;
  let finishX = 0;

  for (const o of objects) {
    // GD centres -> block corners on the same grid.
    const x = o.x / BLOCK - 0.5;
    const y = o.y / BLOCK - 0.5;

    if (SOLID_IDS.has(o.id)) {
      items.push({ t: 'block', id: 'block', x, y, w: 1, h: 1 });
    } else if (SPIKE_IDS.has(o.id)) {
      const spin = ((o.rot % 360) + 360) % 360;
      const down = Math.abs(spin - 180) < 1;
      const size = SPIKE_IDS.get(o.id);
      items.push({
        t: 'spike',
        id: down ? (size === 'normal' ? 'spikeDown' : 'spikeDownSmall') : size === 'normal' ? 'spike' : 'spikeSmall',
        x,
        y,
        dir: down ? -1 : 1,
        small: size !== 'normal',
      });
    } else if (ORB_IDS.has(o.id)) {
      const color = ORB_IDS.get(o.id);
      items.push({ t: 'orb', id: `orb${cap(color)}`, x, y, color });
    } else if (PAD_IDS.has(o.id)) {
      const color = PAD_IDS.get(o.id);
      items.push({ t: 'pad', id: `pad${cap(color)}`, x, y, color });
    } else if (MODE_PORTALS.has(o.id)) {
      items.push({ t: 'portal', id: 'customPortal', x, y, pkind: 'mode', value: MODE_PORTALS.get(o.id), h: 240 });
    } else if (GRAVITY_PORTALS.has(o.id)) {
      items.push({ t: 'portal', id: 'customPortal', x, y, pkind: 'gravity', value: GRAVITY_PORTALS.get(o.id), h: 240 });
    } else if (SPEED_PORTALS.has(o.id)) {
      items.push({ t: 'portal', id: 'customPortal', x, y, pkind: 'speed', value: SPEED_PORTALS.get(o.id), h: 240 });
    } else if (FINISH_IDS.has(o.id)) {
      finishX = Math.max(finishX, x);
      items.push({ t: 'finish', id: 'finish', x, y: 0 });
      byType.finish = (byType.finish || 0) + 1;
      continue;
    } else if (START_IDS.has(o.id)) {
      // spawn point: this game always spawns at x = 0
      continue;
    } else {
      ignored++;
      continue;
    }
    const kind = items[items.length - 1].t;
    byType[kind] = (byType[kind] || 0) + 1;
  }

  // GD stores the ground at an absolute y; this engine puts it at y = 0, so
  // shift everything down by the lowest solid/hazard row.
  const floors = items.filter((it) => it.t === 'block' || it.t === 'spike' || it.t === 'pad').map((it) => it.y);
  const offset = floors.length ? Math.min(...floors) : 0;
  for (const it of items) {
    it.x = round(it.x);
    if (it.t !== 'finish') it.y = round(it.y - offset);
  }

  const maxX = items.reduce((m, it) => Math.max(m, it.x), 0);
  if (!finishX) items.push({ t: 'finish', id: 'finish', x: round(maxX + 4), y: 0 });
  const length = Math.max(30, Math.round(finishX || maxX + 4));

  const data = {
    name: meta.name || 'Imported level',
    author: 'RobTop',
    difficulty: meta.difficulty || 'Insane',
    theme: meta.theme || 'stereo',
    track: meta.track || 'neon',
    length,
    objects: items,
  };

  return { data, stats: { mapped: items.length, ignored, byType } };
}
