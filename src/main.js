import * as THREE from 'three';
import { createTimeline } from './core/timeline.js';
import { daynight } from './core/daynight.js';
import { makeNoiseTexture, webglAvailable } from './core/glutils.js';
import { createWorld } from './scene/world.js';
import { initUI, setLoadProgress, hideLoader, showNoWebgl } from './ui.js';
import './styles.css';

async function boot() {
  if (!webglAvailable()) {
    showNoWebgl();
    return;
  }

  initUI();

  const timeline = createTimeline();
  const noiseTex = makeNoiseTexture();

  const manager = new THREE.LoadingManager();
  manager.onProgress = (_url, loaded, total) => {
    setLoadProgress(loaded / Math.max(1, total));
  };

  await document.fonts.ready;

  const world = createWorld({ noiseTex, manager });
  await world.init();

  hideLoader();

  const clock = new THREE.Clock();
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function frame() {
    requestAnimationFrame(frame);
    if (document.hidden) return;

    const dt = Math.min(clock.getDelta(), 0.05);
    const t = timeline.update(dt);
    daynight.update(dt);
    world.update(t, dt, reduced ? 0 : clock.elapsedTime, daynight.state.night);
  }
  requestAnimationFrame(frame);
}

boot().catch((err) => {
  console.error('[elysiaa] failed to start', err.stack || err);
  const loader = document.getElementById('loader');
  if (loader) loader.classList.add('done');
});
