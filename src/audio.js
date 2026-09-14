import { MUSIC } from './content.js';

const FADE_MS = 800;
const BASE_VOLUME = 0.45;

const KEYS = {
  enabled: 'elysiaa:music:enabled',
  track: 'elysiaa:music:track',
  shuffle: 'elysiaa:music:shuffle',
};

const store = {
  get(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* storage unavailable — the choice just won't persist */
    }
  },
};

const readBool = (key, fallback) => {
  const value = store.get(key);
  return value === null ? fallback : value === '1';
};

const SOUND_ICON = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" aria-hidden="true">
    <path class="music-bar" d="M4 14.5v-5" />
    <path class="music-bar" d="M8 17V7" />
    <path class="music-bar" d="M12 20V4" />
    <path class="music-bar" d="M16 17V7" />
    <path class="music-bar" d="M20 14.5v-5" />
  </svg>
`;

const CARET_ICON = `
  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M2.5 4.5 6 8l3.5-3.5" />
  </svg>
`;

export function initAudio() {
  const host = document.getElementById('music');
  if (!host || !MUSIC.length) return;

  const audio = new Audio();
  audio.preload = 'metadata';
  audio.loop = false;
  audio.volume = 0.5;
  const volumeSupported = Math.abs(audio.volume - 0.5) < 0.01;
  audio.volume = 0;

  const state = {
    enabled: readBool(KEYS.enabled, true),
    shuffle: readBool(KEYS.shuffle, false),
    playing: false,
    started: false,
    index: 0,
  };

  const failed = new Set();

  let index = MUSIC.findIndex((t) => t.file === store.get(KEYS.track));
  if (index < 0) index = MUSIC.findIndex((t) => t.default);
  if (index < 0) index = 0;
  state.index = index;
  audio.src = MUSIC[index].file;

  /* ---------- markup ---------- */

  host.innerHTML = `
    <button class="music-toggle" type="button" aria-label="Turn sound on" aria-pressed="false">
      ${SOUND_ICON}
    </button>
    <button class="music-open" type="button" aria-label="Choose music" aria-expanded="false" aria-controls="music-panel">
      ${CARET_ICON}
    </button>
    <div id="music-panel" class="music-panel" role="group" aria-label="Soundtrack" tabindex="-1" hidden>
      <p class="music-heading">Soundtrack</p>
      <ul class="music-list">
        ${MUSIC.map(
          (t, i) => `
          <li>
            <button class="music-track" type="button" data-index="${i}">
              <span class="music-track-title">${t.title}</span>
              ${t.credit ? `<span class="music-credit">${t.credit}</span>` : ''}
            </button>
          </li>`
        ).join('')}
      </ul>
      <button class="music-shuffle" type="button" aria-pressed="false">Shuffle</button>
    </div>
  `;

  const toggle = host.querySelector('.music-toggle');
  const openBtn = host.querySelector('.music-open');
  const panel = host.querySelector('.music-panel');
  const trackButtons = [...host.querySelectorAll('.music-track')];
  const shuffleBtn = host.querySelector('.music-shuffle');

  /* ---------- state helpers ---------- */

  const render = () => {
    const on = state.enabled && state.playing;
    toggle.setAttribute('aria-pressed', String(on));
    toggle.setAttribute('aria-label', on ? 'Turn sound off' : 'Turn sound on');
    shuffleBtn.setAttribute('aria-pressed', String(state.shuffle));
    trackButtons.forEach((btn, i) => {
      if (i === state.index) btn.setAttribute('aria-current', 'true');
      else btn.removeAttribute('aria-current');
    });
  };

  const persist = () => {
    store.set(KEYS.enabled, state.enabled ? '1' : '0');
    store.set(KEYS.shuffle, state.shuffle ? '1' : '0');
    if (MUSIC[state.index]) store.set(KEYS.track, MUSIC[state.index].file);
  };

  const wrap = (i) => ((i % MUSIC.length) + MUSIC.length) % MUSIC.length;

  const pick = (step) => {
    const n = MUSIC.length;
    if (n === 1) return failed.has(0) ? -1 : 0;
    if (state.shuffle) {
      const pool = [];
      for (let i = 0; i < n; i += 1) {
        if (i !== state.index && !failed.has(i)) pool.push(i);
      }
      if (!pool.length) return -1;
      return pool[Math.floor(Math.random() * pool.length)];
    }
    for (let k = 1; k <= n; k += 1) {
      const i = wrap(state.index + step * k);
      if (!failed.has(i)) return i;
    }
    return -1;
  };

  let fadeToken = 0;
  let loadToken = 0;

  const fadeTo = (target) => {
    if (!volumeSupported) {
      audio.volume = target;
      return Promise.resolve();
    }
    const token = ++fadeToken;
    const from = audio.volume;
    const start = performance.now();
    return new Promise((resolve) => {
      const step = (now) => {
        if (token !== fadeToken) {
          resolve();
          return;
        }
        const k = Math.min(1, (now - start) / FADE_MS);
        audio.volume = from + (target - from) * k;
        if (k < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  };

  const load = async (i, shouldPlay = true) => {
    const token = ++loadToken;
    state.index = wrap(i);
    persist();

    if (!shouldPlay) {
      fadeToken += 1;
      audio.pause();
      audio.src = MUSIC[state.index].file;
      state.playing = false;
      render();
      return;
    }

    fadeToken += 1;
    audio.pause();
    audio.src = MUSIC[state.index].file;
    if (volumeSupported) audio.volume = 0;

    try {
      await audio.play();
    } catch {
      if (token === loadToken) {
        state.playing = false;
        render();
      }
      return;
    }

    if (token !== loadToken) return;

    state.playing = true;
    render();
    await fadeTo(BASE_VOLUME);
  };

  const stop = async () => {
    state.enabled = false;
    persist();
    if (state.playing) {
      await fadeTo(0);
      audio.pause();
    }
    state.playing = false;
    render();
  };

  const start = async () => {
    state.enabled = true;
    persist();
    await load(state.index);
  };

  /* ---------- panel ---------- */

  const closePanel = () => {
    if (panel.hidden) return;
    panel.hidden = true;
    openBtn.setAttribute('aria-expanded', 'false');
  };

  const openPanel = () => {
    panel.hidden = false;
    openBtn.setAttribute('aria-expanded', 'true');
    panel.focus({ preventScroll: true });
  };

  openBtn.addEventListener('click', () => {
    if (panel.hidden) openPanel();
    else closePanel();
  });

  document.addEventListener('pointerdown', (e) => {
    if (!panel.hidden && !host.contains(e.target)) closePanel();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.hidden) {
      closePanel();
      openBtn.focus();
    }
  });

  /* ---------- controls ---------- */

  toggle.addEventListener('click', () => {
    state.started = true;
    if (state.enabled && state.playing) stop();
    else start();
  });

  trackButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      state.started = true;
      const i = Number(btn.dataset.index);
      if (state.enabled) load(i);
      else load(i, false);
    });
  });

  shuffleBtn.addEventListener('click', () => {
    state.shuffle = !state.shuffle;
    persist();
    render();
  });

  audio.addEventListener('ended', () => {
    if (!state.enabled || !state.playing) return;
    const next = pick(1);
    if (next === -1) {
      state.playing = false;
      render();
      return;
    }
    load(next);
  });

  audio.addEventListener('error', () => {
    if (!audio.src) return;
    failed.add(state.index);
    if (failed.size >= MUSIC.length) {
      audio.pause();
      state.enabled = false;
      state.playing = false;
      persist();
      render();
      return;
    }
    const next = pick(1);
    if (next !== -1 && state.enabled) load(next);
  });

  /* ---------- first gesture ---------- */

  const onFirstGesture = (e) => {
    window.removeEventListener('pointerdown', onFirstGesture);
    window.removeEventListener('keydown', onFirstGesture);
    if (host.contains(e.target)) return;
    state.started = true;
    if (state.enabled) load(state.index);
  };

  window.addEventListener('pointerdown', onFirstGesture);
  window.addEventListener('keydown', onFirstGesture);

  render();
}
