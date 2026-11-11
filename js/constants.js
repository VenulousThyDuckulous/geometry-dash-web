// Geometry Dash physics constants.
// Units: 1 block = 30 units. 1 "vel" = 60 units/sec. 240 ticks/sec (GD 2.2 physics).
// Sources: gd-docs (boomlings.dev/reference/player_physics) - gamemodes, hitboxes, orbs/pads.

export const BLOCK = 30;
export const TPS = 240;
export const DT = 1 / TPS;
export const VIEW_H = 320; // 10.67 blocks tall playfield

// Gravity: 0.216 vels per tick at 240 tps -> 0.216 * 60 * 240 units/sec^2
export const GRAVITY = 3110.4;
// Max fall speed = 15 vels
export const MAX_FALL = 900;

// Ship
export const SHIP_THRUST = 5650; // net upward accel = thrust - gravity
export const SHIP_MAX_UP = 480; // 8 vels
export const SHIP_MAX_DOWN = 384; // 6.4 vels

// UFO
export const UFO_GRAVITY = 1500;
export const UFO_IMPULSE = 420; // 7 vels
export const UFO_MAX_UP = 420;
export const UFO_MAX_DOWN = 384; // 6.4 vels

// Robot: gravity is suspended while holding, capped hold time gives ~4 blocks
export const ROBOT_MAX_HOLD = 0.36;

// Swing: velocity is multiplied by 0.8 then gravity flips
export const SWING_DAMP = 0.8;
export const SWING_MAX = 480; // 8 vels

export const MINI_SCALE = 0.6;

// Speed portals. Horizontal speeds in blocks/sec (measured in-game), and the
// per-portal jump/ball/robot/wave velocities documented for each speed.
export const SPEEDS = [
  { label: '0.5x', bps: 8.372, units: 251.16, jump: 10.62, ball: 3.186, robot: 5.31, wave: 4.186 },
  { label: '1x', bps: 10.386, units: 311.58, jump: 11.18, ball: 3.354, robot: 5.59, wave: 5.193 },
  { label: '2x', bps: 12.914, units: 387.42, jump: 11.42, ball: 3.426, robot: 5.71, wave: 6.457 },
  { label: '3x', bps: 15.594, units: 467.82, jump: 11.23, ball: 3.369, robot: 5.615, wave: 7.8 },
  { label: '4x', bps: 19.185, units: 575.55, jump: 11.23, ball: 3.369, robot: 5.615, wave: 9.6 },
];

// Jump velocity for the *cube* at a given speed index, in units/sec.
export const jumpVel = (speedIdx) => SPEEDS[speedIdx].jump * 60;

export const MODES = ['cube', 'ship', 'ball', 'ufo', 'wave', 'robot', 'spider', 'swing'];

export const MODE_INFO = {
  cube: { label: 'Cube', color: '#38e8ff', hotkey: '1', midair: false, ticks: 1 },
  ship: { label: 'Ship', color: '#ff5fa2', hotkey: '2', midair: true, ticks: 2 },
  ball: { label: 'Ball', color: '#ffb03a', hotkey: '3', midair: false, ticks: 1 },
  ufo: { label: 'UFO', color: '#a06bff', hotkey: '4', midair: true, ticks: 2 },
  wave: { label: 'Wave', color: '#4dffa8', hotkey: '5', midair: true, ticks: 2 },
  robot: { label: 'Robot', color: '#d7f5ff', hotkey: '6', midair: false, ticks: 1 },
  spider: { label: 'Spider', color: '#c084ff', hotkey: '7', midair: false, ticks: 1 },
  swing: { label: 'Swing', color: '#ffe066', hotkey: '8', midair: true, ticks: 2 },
};

export const ORB_COLORS = ['yellow', 'pink', 'blue', 'green', 'black', 'red'];
export const PAD_COLORS = ['yellow', 'pink', 'blue', 'red'];

// Orb strength as a multiple of the cube jump velocity at the current speed
// (per the documented per-gamemode tables). Blue/green flip gravity.
export const ORB_MUL = {
  cube: { yellow: 1, pink: 0.72, red: 1.38, blue: 0.4, green: -1 },
  ship: { yellow: 0.7157, pink: 0.37, red: 1, blue: 0.4, green: -0.7 },
  ball: { yellow: 0.7, pink: 0.539, red: 0.938, blue: 0.4, green: -1 },
  ufo: { yellow: 0.7157, pink: 0.42, red: 1.02, blue: 0.4, green: -0.7157 },
  wave: {},
  robot: { yellow: 0.9, pink: 0.72, red: 1.28, blue: 0.4, green: -1 },
  spider: { yellow: 0.7, pink: 0.539, red: 0.938, blue: 0.4, green: -1 },
  swing: { yellow: 0.6, pink: 0.432, red: 0.828, blue: 0.4, green: -1 },
};

// Black orbs set velocity to -N vels (towards gravity), in vels.
export const BLACK_ORB_VELS = { cube: 15, ship: 14, ball: 15, ufo: 11.2, robot: 15, spider: 15, swing: 14 };

// Pads set velocity to a documented number of vels (away from gravity).
export const PAD_VELS = {
  cube: { yellow: 16, pink: 10.4, red: 20, blue: 6.4 },
  ship: { yellow: 16, pink: 5.6, red: 10.08, blue: 6.4 },
  ball: { yellow: 9.6, pink: 6.72, red: 12, blue: 3.84 },
  ufo: { yellow: 16, pink: 6.4, red: 9.6, blue: 6.4 },
  wave: {},
  robot: { yellow: 16, pink: 10.4, red: 20, blue: 6.4 },
  spider: { yellow: 9.6, pink: 6.72, red: 12, blue: 3.84 },
  swing: { yellow: 9.6, pink: 6.24, red: 12, blue: 3.84 },
};

// Player colliders (half-extents, in units) per gamemode.
export const HITBOX = {
  cube: { solid: 15, haz: 15 },
  ship: { solid: 15, haz: 15 },
  ball: { solid: 15, haz: 15 },
  ufo: { solid: 15, haz: 15 },
  wave: { solid: 9, haz: 5 },
  robot: { solid: 15, haz: 15 },
  spider: { solid: 14, haz: 14 },
  swing: { solid: 15, haz: 15 },
};

export const ORB_RADIUS = 30;
export const PAD_W = 30;
export const PAD_H = 8;
export const GROUND_Y = 0;
export const CEILING_Y = VIEW_H;
