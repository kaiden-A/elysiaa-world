import * as THREE from 'three';
import { createTimeline } from './core/timeline.js';
import { daynight } from './core/daynight.js';
import { makeNoiseTexture, webglAvailable } from './core/glutils.js';
import { createWorld } from './scene/world.js';
import { initUI, setLoadProgress, hideLoader, showNoWebgl } from './ui.js';
import './styles.css';

async function boot() {
  initUI();

  const loaderTimer = window.setTimeout(hideLoader, 2600);

  if (!webglAvailable()) {
    window.clearTimeout(loaderTimer);
    showNoWebgl();
    return;
  }

  const timeline = createTimeline();
  const noiseTex = makeNoiseTexture();

  const manager = new THREE.LoadingManager();
  manager.onProgress = (_url, loaded, total) => {
    setLoadProgress(loaded / Math.max(1, total));
  };

  await document.fonts.ready;

  const world = createWorld({ noiseTex, manager });
  await world.init();

  window.clearTimeout(loaderTimer);
  hideLoader();

  const clock = new THREE.Clock();
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let lastFrame = 0;

  function frame(now = 0) {
    requestAnimationFrame(frame);
    if (document.hidden) return;

    // Once the hero is out of view the world is backdrop, not focal point:
    // render it at ~30fps instead of 60 to keep long reads smooth.
    const offHero = window.scrollY > window.innerHeight * 1.2;
    if (offHero && now - lastFrame < 33) return;
    lastFrame = now;

    const dt = Math.min(clock.getDelta(), 0.05);
    const t = timeline.update(dt);
    daynight.update(dt);
    world.update(t, dt, reduced ? 0 : clock.elapsedTime, daynight.state.night);
  }
  requestAnimationFrame(frame);
}

boot().catch((err) => {
  console.error('[elysiaa] failed to start', err.stack || err);
  hideLoader();
  const loader = document.getElementById('loader');
  if (loader) loader.style.display = 'none';
});
