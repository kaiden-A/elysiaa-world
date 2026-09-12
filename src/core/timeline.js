export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);

/** progress of `t` within [a, b], clamped and smoothed */
export function range(t, a, b) {
  return smooth(clamp((t - a) / (b - a), 0, 1));
}

/**
 * Keyframe track: array of { t, value:number } sorted by t.
 * Returns interpolated value at time t with smoothstep between keys.
 */
export function track(keys, t) {
  if (!keys.length) return 0;
  if (t <= keys[0].t) return keys[0].value;
  const last = keys[keys.length - 1];
  if (t >= last.t) return last.value;
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i].t) {
      const a = keys[i - 1];
      const b = keys[i];
      const k = smooth(clamp((t - a.t) / (b.t - a.t), 0, 1));
      return lerp(a.value, b.value, k);
    }
  }
  return last.value;
}

/** Scroll timeline: smoothed normalized progress 0..1 across the whole page. */
export function createTimeline() {
  const state = {
    target: 0,
    value: 0,
    velocity: 0,
    scrollY: 0,
  };

  const updateTarget = () => {
    const doc = document.documentElement;
    const max = Math.max(1, doc.scrollHeight - window.innerHeight);
    state.target = clamp(window.scrollY / max, 0, 1);
  };

  window.addEventListener('scroll', updateTarget, { passive: true });
  window.addEventListener('resize', updateTarget);
  updateTarget();

  return {
    state,
    /** call every frame; returns smoothed t */
    update(dt = 1 / 60) {
      const prev = state.value;
      state.value += (state.target - state.value) * Math.min(1, dt * 5);
      state.velocity = state.value - prev;
      return state.value;
    },
    reset() {
      state.value = state.target;
    },
  };
}