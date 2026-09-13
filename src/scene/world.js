import * as THREE from 'three';
import { postVertex, postFragment } from '../shaders/post.js';
import { clamp, smooth } from '../core/timeline.js';
import { createShardComposition } from './shard-composition.js';
import { createWanderer } from './wanderer.js';
import { createSky } from './sky.js';
import { createPlates } from './plates.js';
import { createAtmosphere } from './atmosphere.js';

/* scroll choreography: the walk toward the citadel */
const CAM_POS = [
  { t: 0.0, v: new THREE.Vector3(0, 0.05, 6.2) },
  { t: 0.35, v: new THREE.Vector3(0.35, 0.12, 4.7) },
  { t: 0.7, v: new THREE.Vector3(-0.4, 0.2, 3.0) },
  { t: 1.0, v: new THREE.Vector3(0.3, 0.55, 2.8) },
];

const CAM_LOOK = [
  { t: 0.0, v: new THREE.Vector3(0.12, 0.06, 0) },
  { t: 0.35, v: new THREE.Vector3(0.2, 0.08, -1) },
  { t: 0.7, v: new THREE.Vector3(0.6, 0.35, -3) },
  { t: 1.0, v: new THREE.Vector3(2.4, 0.85, -10) },
];

/* sheet fragments + their panel aspect ratios */
const FRAGMENTS = [
  ['face', 300 / 305],
  ['cloak', 145 / 255],
  ['hand', 150 / 140],
  ['spear', 150 / 400],
  ['castle', 245 / 265],
  ['mirrors', 220 / 240],
  ['ground', 170 / 150],
];

function sampleVec(keys, t, out) {
  if (t <= keys[0].t) return out.copy(keys[0].v);
  const last = keys[keys.length - 1];
  if (t >= last.t) return out.copy(last.v);
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i].t) {
      const a = keys[i - 1];
      const b = keys[i];
      const k = smooth(clamp((t - a.t) / (b.t - a.t), 0, 1));
      return out.copy(a.v).lerp(b.v, k);
    }
  }
  return out.copy(last.v);
}

export function createWorld({ noiseTex, manager }) {
  const canvas = document.getElementById('world');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setClearColor(0x0a0f14, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 80);
  camera.position.set(0, 0.05, 6.2);
  camera.lookAt(0, 0, 0);

  const state = {
    wanderer: null,
    shards: null,
    sky: null,
    plates: null,
    atmosphere: null,
    portrait: false,
  };

  /* ---------- post pass ---------- */
  const postUniforms = {
    uScene: { value: null },
    uNoise: { value: noiseTex },
    uTime: { value: 0 },
    uAspect: { value: 1 },
    uDim: { value: 1 },
    uRays: { value: 0 },
    uSun: { value: new THREE.Vector2(0.7, 0.65) },
    uRes: { value: new THREE.Vector2(1, 1) },
  };
  const postMat = new THREE.ShaderMaterial({
    vertexShader: postVertex,
    fragmentShader: postFragment,
    uniforms: postUniforms,
    depthTest: false,
    depthWrite: false,
  });
  const postQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat);
  const postScene = new THREE.Scene();
  postScene.add(postQuad);
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  let rt = null;

  /* ---------- sizing ---------- */
  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const aspect = w / h;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    state.portrait = aspect < 0.95;

    renderer.setSize(w, h, false);
    if (rt) rt.dispose();
    rt = new THREE.WebGLRenderTarget(w, h, {
      samples: renderer.capabilities.isWebGL2 ? 4 : 0,
    });
    postUniforms.uRes.value.set(w, h);
    postUniforms.uAspect.value = aspect;
    postUniforms.uScene.value = rt.texture;
  }
  window.addEventListener('resize', resize);
  resize();

  /* ---------- world reflections for the mirrors ---------- */
  /** Render two character-free views of the golden world for the shard faces. */
  function captureWorldViews() {
    const SIZE = 640;
    const rt2 = new THREE.WebGLRenderTarget(SIZE, SIZE, { samples: 0 });
    const buffer = new Uint8Array(SIZE * SIZE * 4);
    const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 80);
    const views = [
      { pos: new THREE.Vector3(-0.2, 0.35, 3.4), look: new THREE.Vector3(5.2, 1.7, -22) },
      { pos: new THREE.Vector3(0.4, 0.3, 3.0), look: new THREE.Vector3(10.4, 2.6, -21) },
    ];

    const textures = [];
    renderer.setRenderTarget(rt2);
    for (const v of views) {
      cam.position.copy(v.pos);
      cam.lookAt(v.look);
      renderer.render(scene, cam);
      renderer.readRenderTargetPixels(rt2, 0, 0, SIZE, SIZE, buffer);

      const id = new ImageData(new Uint8ClampedArray(buffer), SIZE, SIZE);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = SIZE;
      const ctx = canvas.getContext('2d');
      const flip = ctx.createImageData(SIZE, SIZE);
      const row = SIZE * 4;
      for (let y = 0; y < SIZE; y++) {
        flip.data.set(id.data.subarray((SIZE - 1 - y) * row, (SIZE - y) * row), y * row);
      }
      ctx.putImageData(flip, 0, 0);

      // melt the reflection into the glass
      const g = ctx.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.22, SIZE / 2, SIZE / 2, SIZE * 0.8);
      g.addColorStop(0, 'rgba(8, 8, 9, 0)');
      g.addColorStop(1, 'rgba(8, 8, 9, 0.92)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, SIZE, SIZE);

      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      textures.push(tex);
    }
    renderer.setRenderTarget(null);
    rt2.dispose();
    return textures;
  }

  /* ---------- load & assemble ---------- */
  async function init() {
    // the golden-hour world (real plates if provided, painted fallbacks otherwise)
    state.sky = createSky({ manager });
    state.plates = createPlates({ manager });
    state.atmosphere = createAtmosphere();
    scene.add(state.plates.group, state.sky.group, state.atmosphere.group);

    // let the sky/plates finish so the mirror reflections show the real world
    await new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(cap);
        resolve();
      };
      const cap = setTimeout(finish, 2200);
      manager.onLoad = finish;
    });

    const worldViews = captureWorldViews();

    const loader = new THREE.TextureLoader(manager);
    const fragTextures = await Promise.all(
      FRAGMENTS.map(
        ([name, ar]) =>
          new Promise((resolve) => {
            loader.load(
              `/fragments/${name}.jpg`,
              (tex) => {
                tex.colorSpace = THREE.SRGBColorSpace;
                tex.anisotropy = 4;
                resolve({ tex, ar });
              },
              undefined,
              () => resolve({ tex: null, ar })
            );
          })
      )
    );

    const shardTextures = [
      ...fragTextures,
      { tex: worldViews[0], ar: 1 },
      { tex: worldViews[1], ar: 1 },
    ];

    state.wanderer = createWanderer({ manager });
    scene.add(state.wanderer.group);

    state.shards = await createShardComposition({ shardTextures, manager });
    scene.add(state.shards.group);
  }

  /* ---------- per-frame ---------- */
  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();
  const sunNdc = new THREE.Vector3();

  function update(t, dt, time) {
    if (!state.wanderer) return;

    postUniforms.uTime.value = time;
    postUniforms.uDim.value = 1;

    // the wanderer breathes, then falls away as the journey begins
    state.wanderer.update(t, dt, time);

    // shard constellation: drift, then fly past the camera
    state.shards.update(t, dt, time);

    // the world layers
    state.sky.update(t, dt, time);
    state.plates.update(t, dt, time);
    state.atmosphere.update(t, dt, time);

    // camera: gentle breath along the authored journey
    sampleVec(CAM_POS, t, camPos);
    sampleVec(CAM_LOOK, t, camLook);
    camera.position.copy(camPos);
    if (state.portrait) {
      camera.position.z += 2.9;
      camera.position.y += 0.10;
    }
    camera.position.x += Math.sin(time * 0.4) * 0.05;
    camera.position.y += Math.sin(time * 0.3) * 0.04;
    camera.lookAt(camLook);

    // god rays follow the sun
    sunNdc.copy(state.sky.sunPos).project(camera);
    postUniforms.uSun.value.set(sunNdc.x * 0.5 + 0.5, sunNdc.y * 0.5 + 0.5);
    postUniforms.uRays.value = sunNdc.z < 1 ? 1 : 0;

    // render scene -> post -> screen
    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(postScene, postCam);
  }

  return { init, update, resize, renderer };
}
