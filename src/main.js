import * as THREE from 'three';
import { createTimeline, range } from './core/timeline.js';
import { makeNoiseTexture, makeToonRamp, webglAvailable } from './core/glutils.js';
import { createWorld } from './scene/world.js';
import { initUI, setLoadProgress, hideLoader, showNoWebgl, setNodesOpacity } from './ui.js';
import './styles.css';

async function boot() {
  if (!webglAvailable()) {
    showNoWebgl();
    return;
  }

  initUI();

  const timeline = createTimeline();
  const ramp = makeToonRamp();
  const noiseTex = makeNoiseTexture();

  // models + word texture load together
  const manager = new THREE.LoadingManager();
  manager.onProgress = (_url, loaded, total) => {
    setLoadProgress(loaded / Math.max(1, total));
  };

  await document.fonts.ready;

  const world = createWorld({ ramp, noiseTex, manager });
  await world.init();

  hideLoader();

  const clock = new THREE.Clock();
  let lastT = 0;

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = timeline.update(dt);
    const time = clock.elapsedTime;

    world.update(t, dt, time);
    setNodesOpacity((1 - range(t, 0.1, 0.2)) * Math.min(1, Math.max(0, (time - 0.6) / 1.4)));
    lastT = t;

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

boot().catch((err) => {
  console.error('[elysiaa] failed to start', err.stack || err);
  const loader = document.getElementById('loader');
  if (loader) loader.classList.add('done');
});