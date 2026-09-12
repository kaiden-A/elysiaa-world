import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { postVertex, postFragment } from '../shaders/post.js';
import { track, range } from '../core/timeline.js';
import { makeDotTexture } from '../core/glutils.js';
import { applyPaintToScene } from './character.js';
import { createShardComposition } from './shard-composition.js';
import { createPortal } from './portal.js';

const MODELS = {
  knight: '/models/knight.glb',
};

export function createWorld({ ramp, noiseTex, manager }) {
  const canvas = document.getElementById('world');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setClearColor(0x050506, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 60);
  camera.position.set(0, 0, 6);
  camera.lookAt(0, 0, 0);

  const loader = new GLTFLoader(manager);
  const load = (url) =>
    new Promise((res, rej) => loader.load(url, res, undefined, rej));

  const state = {
    guard: null,
    guardBaseY: -1.15,
    shards: null,
    dust: null,
    backlight: null,
    portal: null,
    eyeGlow: null,
  };

  /* ---------- dust ---------- */
  {
    const N = 150;
    const pos = new Float32Array(N * 3);
    const seed2 = { s: 99 };
    const rnd2 = () => {
      seed2.s = (seed2.s * 16807) % 2147483647;
      return (seed2.s - 1) / 2147483646;
    };
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (rnd2() - 0.5) * 6.4;
      pos[i * 3 + 1] = (rnd2() - 0.5) * 4.2;
      pos[i * 3 + 2] = -3 + rnd2() * 3.4;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xc9c6bd,
      size: 0.02,
      transparent: true,
      opacity: 0.5,
      map: makeDotTexture(),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    state.dust = new THREE.Points(geo, mat);
    scene.add(state.dust);
    state.dust.userData = { pos, N };
  }

  /* ---------- post pass ---------- */
  const postUniforms = {
    uScene: { value: null },
    uNoise: { value: noiseTex },
    uTime: { value: 0 },
    uAspect: { value: 1 },
    uDim: { value: 1 },
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

  /* ---------- capture helpers ---------- */
  function setPaintBoost(guard, on) {
    guard.traverse((o) => {
      if (!o.isMesh || !o.material || !o.material.uniforms) return;
      const u = o.material.uniforms;
      if (!u.uShadowLift) return;
      if (on) {
        if (u._baseLift === undefined) {
          u._baseLift = u.uShadowLift.value;
          u._baseRim = u.uRimLight.value;
        }
        u.uShadowLift.value = Math.min(0.55, u._baseLift + 0.26);
        u.uRimLight.value = u._baseRim + 0.24;
      } else if (u._baseLift !== undefined) {
        u.uShadowLift.value = u._baseLift;
        u.uRimLight.value = u._baseRim;
      }
    });
  }

  /** Render eight dramatic portraits of the knight — one per shard. */
  function capturePortraits(guard) {
    const SIZE = 640;
    const rt2 = new THREE.WebGLRenderTarget(SIZE, SIZE, { samples: 0 });
    const buffer = new Uint8Array(SIZE * SIZE * 4);
    const tmp = document.createElement('canvas');
    tmp.width = tmp.height = SIZE;
    const tmpCtx = tmp.getContext('2d');
    const cam = new THREE.PerspectiveCamera(32, 1, 0.05, 60);

    const bones = {};
    guard.traverse((o) => {
      if (o.isBone) bones[o.name] = o;
    });
    guard.updateMatrixWorld(true);

    const bonePos = (name, fallback) => {
      const b = bones[name];
      if (!b) return fallback;
      return b.getWorldPosition(new THREE.Vector3());
    };
    const meshTarget = (matName) => {
      let found = null;
      guard.traverse((o) => {
        if (!found && o.isMesh && o.material && o.material.name === matName) found = o;
      });
      if (!found) return null;
      return new THREE.Box3().setFromObject(found).getCenter(new THREE.Vector3());
    };

    const head = bonePos('head.x_5', new THREE.Vector3(0, 0.7, 0));
    const spine = bonePos('spine_01.x_57', new THREE.Vector3(0, 0.35, 0));
    const sword = meshTarget('sword_mat') || bonePos('hand.r_53', new THREE.Vector3(-0.3, 0.1, 0.1));
    const cloak = meshTarget('cloak_mat') || bonePos('c_tail_02.x_2', new THREE.Vector3(0, 0.2, -0.3));
    const roses = meshTarget('roses_mat') || null;

    const shots = [
      { target: head.clone().add(new THREE.Vector3(0.1, 0.0, 0)), off: [0.02, 0.03, 0.5], fov: 26 },
      { target: head.clone().add(new THREE.Vector3(0, 0.02, 0)), off: [0.42, 0.1, 0.42], fov: 28 },
      { target: head.clone().add(new THREE.Vector3(0, 0.05, 0)), off: [0.0, 0.08, 0.95], fov: 30 },
      { target: spine.clone().add(new THREE.Vector3(0, 0.1, 0)), off: [0.06, 0.02, 0.68], fov: 34 },
      { target: sword.clone().add(new THREE.Vector3(0, 0.22, 0)), off: [0.34, 0.14, 0.5], fov: 33 },
      { target: cloak.clone().add(new THREE.Vector3(0, 0.25, 0)), off: [0.55, 0.2, 0.6], fov: 40 },
      { target: (roses || spine).clone().add(new THREE.Vector3(0, 0.05, 0)), off: [0.3, 0.06, 0.5], fov: 30 },
      { target: spine.clone().add(new THREE.Vector3(0, -0.45, 0)), off: [0.1, 0.05, 0.75], fov: 36 },
    ];

    const dustVisible = state.dust ? state.dust.visible : false;
    if (state.dust) state.dust.visible = false;
    setPaintBoost(guard, true);

    const textures = [];
    renderer.setRenderTarget(rt2);
    for (const shot of shots) {
      cam.fov = shot.fov;
      cam.updateProjectionMatrix();
      cam.position.set(shot.target.x + shot.off[0], shot.target.y + shot.off[1], shot.target.z + shot.off[2]);
      cam.lookAt(shot.target);
      renderer.render(scene, cam);
      renderer.readRenderTargetPixels(rt2, 0, 0, SIZE, SIZE, buffer);

      const id = new ImageData(new Uint8ClampedArray(buffer), SIZE, SIZE);
      const flip = tmpCtx.createImageData(SIZE, SIZE);
      const row = SIZE * 4;
      for (let y = 0; y < SIZE; y++) {
        flip.data.set(id.data.subarray((SIZE - 1 - y) * row, (SIZE - y) * row), y * row);
      }
      tmpCtx.putImageData(flip, 0, 0);

      // portrait grading: deepen shadows, warm the lights slightly
      const g = tmpCtx.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.2, SIZE / 2, SIZE / 2, SIZE * 0.78);
      g.addColorStop(0, 'rgba(5,5,6,0)');
      g.addColorStop(1, 'rgba(5,5,6,0.85)');
      tmpCtx.fillStyle = g;
      tmpCtx.fillRect(0, 0, SIZE, SIZE);

      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = SIZE;
      canvas.getContext('2d').drawImage(tmp, 0, 0);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      textures.push(tex);
    }
    renderer.setRenderTarget(null);
    setPaintBoost(guard, false);
    if (state.dust) state.dust.visible = dustVisible;
    rt2.dispose();
    if (window.__elysiaaDebug) window.__elysiaaDebug.portraits = textures;
    return textures;
  }

  /* ---------- load & assemble ---------- */
  async function init() {
    const [knightGltf] = await Promise.all([load(MODELS.knight)]);

    // auto-face: detect where the eyes sit, turn the knight toward the camera
    let facesCamera = true;
    knightGltf.scene.traverse((o) => {
      if (o.isMesh && o.material && o.material.name === 'eye_plug_mat') {
        const p = o.getWorldPosition(new THREE.Vector3());
        if (p.z < 0) facesCamera = false;
      }
    });

    applyPaintToScene(knightGltf.scene, ramp, {
      contrast: 1.45,
      rim: 0.3,
      shadowLift: 0.3,
      rimLight: 0.4,
    });

    const guard = knightGltf.scene;
    const box = new THREE.Box3().setFromObject(guard);
    const h = box.max.y - box.min.y;
    const s = 1.9 / h;
    guard.scale.setScalar(s);
    const box2 = new THREE.Box3().setFromObject(guard);
    state.guardBaseY = -1.15 - box2.min.y;
    guard.position.y = state.guardBaseY;
    if (!facesCamera) guard.rotation.y = Math.PI;
    guard.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = false;
        o.receiveShadow = false;
      }
    });

    // the guardian's eyes catch the light
    guard.updateMatrixWorld(true);
    let eyeMesh = null;
    guard.traverse((o) => {
      if (o.isMesh && o.material && o.material.name === 'eye_plug_mat') {
        o.material = new THREE.MeshBasicMaterial({ color: 0xfff3d8 });
        eyeMesh = o;
      }
    });
    if (eyeMesh) {
      const c = new THREE.Box3().setFromObject(eyeMesh).getCenter(new THREE.Vector3());
      const glow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: makeDotTexture(),
          color: 0xf5efdf,
          transparent: true,
          opacity: 0.45,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      glow.position.copy(guard.worldToLocal(c.clone()));
      glow.scale.setScalar(0.5);
      guard.add(glow);
      state.eyeGlow = glow;
    }

    // knight materials — kept as-is; he stands before the gate at the end
    scene.add(guard);
    state.guard = guard;

    // painter's backlight: a soft radial glow silhouetting the guardian
    const backlight = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: makeDotTexture(),
        color: 0xe6dfd0,
        transparent: true,
        opacity: 0.2,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    backlight.position.set(0, 0.25, -1.8);
    backlight.scale.set(6.6, 4.1, 1);
    scene.add(backlight);
    state.backlight = backlight;

    // eight portraits, then the hand-composed shard constellation
    const portraits = capturePortraits(guard);
    state.shards = createShardComposition({ portraitTex: portraits });
    scene.add(state.shards.group);

    // the gate to elysium, waiting behind the glass
    state.portal = createPortal({ ramp, manager });
    scene.add(state.portal.group);
  }

  /* ---------- per-frame ---------- */
  const pushTrack = [
    { t: 0.0, value: 0 },
    { t: 0.86, value: 0 },
    { t: 1.0, value: 1 },
  ];

  function update(t, dt, time) {
    if (!state.guard) return;

    postUniforms.uTime.value = time;
    postUniforms.uDim.value = 1;

    // guardian: breathing
    state.guard.position.y = state.guardBaseY + Math.sin(time * 0.7) * 0.015;
    state.guard.rotation.z = Math.sin(time * 0.55) * 0.006;

    // shard constellation: drift, then fly into the ring at the end
    state.shards.update(t, dt, time);

    // the ending: he walks to the threshold and stands before the gate
    const walk = range(t, 0.9, 1.0);
    state.guard.position.z = -walk * 0.7;
    if (state.eyeGlow) {
      state.eyeGlow.material.opacity = 0.38 + Math.sin(time * 1.6) * 0.12;
      state.eyeGlow.scale.setScalar(0.48 + Math.sin(time * 0.9) * 0.05);
    }

    // the gate to elysium: opens as the ring closes
    state.portal.update(t, dt, time, renderer);

    // dust drift
    const d = state.dust;
    if (d) {
      const arr = d.userData.pos;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i + 1] += dt * 0.02;
        arr[i] += Math.sin(time * 0.4 + i) * dt * 0.004;
        if (arr[i + 1] > 2.4) arr[i + 1] = -2.4;
      }
      d.geometry.attributes.position.needsUpdate = true;
    }

    // camera: gentle breath, then a slow push-in for the mending
    const push = track(pushTrack, t);
    camera.position.x = Math.sin(time * 0.4) * 0.05;
    camera.position.y = Math.sin(time * 0.3) * 0.04;
    camera.position.z = 6 - push * 0.55;
    camera.lookAt(0, 0, 0);

    // render scene -> post -> screen
    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(postScene, postCam);
  }

  return { init, update, resize, renderer };
}