export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const smooth = (t) => t * t * (3 - 2 * t);

/** progress of `t` within [a, b], clamped and smoothed */
export function range(t, a, b) {
  return smooth(clamp((t - a) / (b - a), 0, 1));
}

/** Scroll timeline: smoothed normalized progress 0..1 across the whole page. */
export function createTimeline() {
  const state = {
    target: 0,
    value: 0,
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
    /** call every frame; returns smoothed t */
    update(dt = 1 / 60) {
      state.value += (state.target - state.value) * Math.min(1, dt * 5);
      return state.value;
    },
  };
}