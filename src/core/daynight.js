/**
 * Day/night theme. `state.night` eases 0 (the authored sunset world) -> 1
 * (night); dusk and dawn cross the evening plate on the way through. A manual
 * toggle overrides the real clock for the rest of the visit — nothing is
 * stored, so every new visit starts from the time of day.
 *
 * Listeners hear about mode changes (the soundtrack follows the theme).
 *
 * `?hour=18.5` forces a clock hour; `?theme=night` forces an override.
 */

const DUSK_START = 18;
const NIGHT_FULL = 19;
const DAWN_START = 6;
const DAY_FULL = 7;

/* a toggle crossfades the whole world over this many seconds */
const TOGGLE_SECONDS = 1.2;

function smoothstep(x) {
  const k = Math.min(1, Math.max(0, x));
  return k * k * (3 - 2 * k);
}

function nightAt(hour) {
  if (hour >= DUSK_START && hour < NIGHT_FULL) {
    return smoothstep((hour - DUSK_START) / (NIGHT_FULL - DUSK_START));
  }
  if (hour >= NIGHT_FULL || hour < DAWN_START) return 1;
  return 1 - smoothstep((hour - DAWN_START) / (DAY_FULL - DAWN_START));
}

function clockNight() {
  if (fixedHour !== null) return nightAt(fixedHour);
  const d = new Date();
  return nightAt(d.getHours() + d.getMinutes() / 60);
}

const params = new URLSearchParams(window.location.search);
const forced = parseFloat(params.get('hour'));
const fixedHour = Number.isFinite(forced) ? ((forced % 24) + 24) % 24 : null;
const forcedTheme = params.get('theme');

const state = { night: 0, mode: 'sunset' };
let override = forcedTheme === 'night' || forcedTheme === 'sunset' ? forcedTheme : null;
let announced = null;
const listeners = new Set();

function targetNight() {
  if (override === 'night') return 1;
  if (override === 'sunset') return 0;
  return clockNight();
}

/* start at the target so the first paint is already right */
state.night = targetNight();
state.mode = override ?? (state.night >= 0.5 ? 'night' : 'sunset');
document.body.dataset.phase = state.night >= 0.5 ? 'night' : 'sunset';
announced = state.mode;

let lastPhase = document.body.dataset.phase;

function update(dt) {
  const target = targetNight();
  const step = dt / TOGGLE_SECONDS;
  state.night += Math.max(-step, Math.min(step, target - state.night));

  state.mode = override ?? (target >= 0.5 ? 'night' : 'sunset');

  const phase = state.night >= 0.5 ? 'night' : 'sunset';
  if (phase !== lastPhase) {
    lastPhase = phase;
    document.body.dataset.phase = phase;
  }

  if (state.mode !== announced) {
    announced = state.mode;
    for (const fn of listeners) fn(state.mode);
  }
}

function toggle() {
  override = state.mode === 'night' ? 'sunset' : 'night';
}

function subscribe(fn) {
  listeners.add(fn);
  fn(state.mode);
  return () => listeners.delete(fn);
}

export const daynight = { state, update, toggle, subscribe };
