import * as THREE from 'three';
import pointer from '../core/pointer.js';
import { range } from '../core/timeline.js';
import { makeDotTexture } from '../core/glutils.js';

/* moonlight: the figure and its glow cool down after dark */
const FIGURE_WARM = new THREE.Color(0xfff4e4);
const FIGURE_NIGHT = new THREE.Color(0x93a4c9);
const GLOW_WARM = new THREE.Color(0xffe8c2);
const GLOW_NIGHT = new THREE.Color(0x9db0d8);

/**
 * The Wanderer — the concept-sheet tableau placed as a three-layer painted
 * stack (back / mid / front) so the figure gains depth under pointer drift.
 *
 * All three planes carry the same painting at slightly different depths; their
 * alphas are authored so that, at rest, the composite is exactly the original
 * plate (the back pass holds the full plate, the mid/front passes hold masked
 * detail). The cursor offset is scaled per layer: the front most, the cloak
 * barely, so the figure reads as volume rather than a flat cutout.
 *
 * The cloak (mid) and hair (front) planes are subdivided and rippled with a
 * luma-weighted travelling wave — the paint that is bright and opaque moves,
 * the feathered silhouette and the spear hold still. `time` is already frozen
 * to 0 under prefers-reduced-motion, so the cloth freezes with everything else.
 */
export function createWanderer({ manager }) {
  const group = new THREE.Group();
  const pivot = new THREE.Group();
  group.add(pivot);

  const BASE = new THREE.Vector3(0.6, -0.25, -1.1);
  const CAM = new THREE.Vector3(0, 0.05, 6.2);
  const HEIGHT = 5.0;
  const AR = 877 / 2032;

  /* depth offset, pointer response (world units), and cloth/hair wave config */
  const LAYERS = [
    { file: '/plates/wanderer-back.png', dz: -0.06, kx: 0.05, ky: 0.02 },
    { file: '/plates/wanderer-mid.png', dz: 0.0, kx: 0.085, ky: 0.035, wave: { kind: 'cloth', seg: [32, 64] } },
    { file: '/plates/wanderer-front.png', dz: 0.06, kx: 0.12, ky: 0.05, wave: { kind: 'hair', seg: [32, 64] } },
  ];
  const KX_MAX = LAYERS[LAYERS.length - 1].kx;
  const KY_MAX = LAYERS[LAYERS.length - 1].ky;

  /**
   * Vertex ripple for a subdivided plane. Weights come from the painted layer
   * itself (both detail passes are faint overlays): alpha modulated by luma,
   * so soft silhouette edges and dark haze stay put (no swim) while bright
   * folds carry the motion. In-plane x/y displacement is used because the
   * pipeline is unlit — z alone would not be visible; amplitudes are a couple
   * of screen pixels at hero distance.
   */
  function makeWave(mesh, kind, segX, segY) {
    const geo = mesh.geometry;
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    const base = new Float32Array(pos.array);
    const weights = new Float32Array(pos.count);
    let ready = false;

    function onTexture(tex) {
      const c = document.createElement('canvas');
      c.width = segX + 1;
      c.height = segY + 1;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(tex.image, 0, 0, c.width, c.height);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      for (let i = 0; i < pos.count; i++) {
        const u = uv.getX(i);
        const v = uv.getY(i);
        const px = Math.min(segX, Math.max(0, Math.round(u * segX)));
        const py = Math.min(segY, Math.max(0, Math.round((1 - v) * segY)));
        const o = (py * (segX + 1) + px) * 4;
        const alpha = d[o + 3] / 255;
        const luma = (0.299 * d[o] + 0.587 * d[o + 1] + 0.114 * d[o + 2]) / 255;
        let w;
        if (kind === 'hair') {
          w = Math.min(1, alpha * 2.6) * THREE.MathUtils.smoothstep(v, 0.62, 0.85);
        } else {
          w = alpha * (0.3 + 0.7 * luma);
        }
        weights[i] = w;
      }
      ready = true;
    }

    function update(time) {
      if (!ready) return;
      const arr = pos.array;
      const ax = 1 / mesh.scale.x;
      const ay = 1 / mesh.scale.y;
      const A = kind === 'cloth' ? 0.014 : 0.016;
      for (let i = 0; i < pos.count; i++) {
        const w = weights[i];
        if (w < 0.004) {
          arr[i * 3] = base[i * 3];
          arr[i * 3 + 1] = base[i * 3 + 1];
          continue;
        }
        const u = uv.getX(i);
        const v = uv.getY(i);
        let dx;
        let dy;
        if (kind === 'cloth') {
          dx = A * w * Math.sin(u * 4.2 + v * 1.8 + time * 0.75);
          dy = A * 0.45 * w * Math.sin(v * 3.6 - time * 0.6 + 1.7);
        } else {
          dx = A * w * Math.sin(time * 0.45 + v * 2.6);
          dy = A * 0.3 * w * Math.sin(time * 0.4 + 2.1);
        }
        arr[i * 3] = base[i * 3] + dx * ax;
        arr[i * 3 + 1] = base[i * 3 + 1] + dy * ay;
      }
      pos.needsUpdate = true;
    }

    return { onTexture, update };
  }

  const meshes = [];
  const offsets = [];
  const waves = [];

  for (const cfg of LAYERS) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xfff4e4,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      opacity: 0,
    });
    const geo = cfg.wave
      ? new THREE.PlaneGeometry(1, 1, cfg.wave.seg[0], cfg.wave.seg[1])
      : new THREE.PlaneGeometry(1, 1);
    const mesh = new THREE.Mesh(geo, mat);
    const wave = cfg.wave ? makeWave(mesh, cfg.wave.kind, cfg.wave.seg[0], cfg.wave.seg[1]) : null;

    /* keep every plane on the exact projected footprint of the base plate */
    const z = BASE.z + cfg.dz;
    const k = (CAM.z - z) / (CAM.z - BASE.z);
    const local = BASE.clone().sub(CAM).multiplyScalar(k - 1);
    mesh.position.set(local.x, local.y, cfg.dz);
    mesh.scale.set(HEIGHT * AR * k, HEIGHT * k, 1);
    offsets.push(new THREE.Vector2(local.x, local.y));
    meshes.push(mesh);
    waves.push(wave);
    pivot.add(mesh);

    new THREE.TextureLoader(manager).load(
      cfg.file,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        mat.map = tex;
        mat.opacity = 1;
        mat.needsUpdate = true;
        const aspect = tex.image.width / tex.image.height;
        mesh.scale.set(HEIGHT * aspect * k, HEIGHT * k, 1);
        if (wave) wave.onTexture(tex);
      },
      undefined,
      () => {}
    );
  }

  const backlightMat = new THREE.MeshBasicMaterial({
    map: makeDotTexture(),
    color: 0xffe8c2,
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const backlight = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), backlightMat);
  backlight.position.set(BASE.x, 0.0, BASE.z - 0.9);
  backlight.scale.set(3.2, 4.4, 1);
  group.add(backlight);

  /*
   * Tier B: the figure is a 32-frame moving pass (green-screen render keyed to
   * alpha, 0-4s) packed into a WebP sprite atlas and crossfaded inside the
   * material (4s cycle, driven by `time`). No <video> element involved, so
   * browser media heuristics can never freeze it, it carries its own alpha, and
   * it runs in Safari and Firefox too. Reduced motion, save-data and
   * `?cloak=still` keep the layered stills; `window.__cloak.stat()` reports
   * what happened.
   */
  const saveData = !!(navigator.connection && navigator.connection.saveData);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cloakParam = new URLSearchParams(window.location.search).get('cloak');

  const ATLAS_COLS = 8;
  const ATLAS_ROWS = 4;
  const ATLAS_FRAMES = ATLAS_COLS * ATLAS_ROWS;
  const LOOP_SECONDS = 4.0;
  /* sized/placed so the keyed figure stands exactly on the painted figure */
  const ATLAS_SIZE = new THREE.Vector2(2.234, 3.97);
  const ATLAS_OFFSET = new THREE.Vector2(0, -0.037);
  /* a hair of blur so the moving pass sits in the painted world */
  const BLUR_TEXEL = 0.007;

  const atlasMat = new THREE.MeshBasicMaterial({
    color: 0xfff4e4,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    opacity: 0,
  });
  let atlasShader = null;
  atlasMat.onBeforeCompile = (shader) => {
    shader.uniforms.uAtlasA = { value: new THREE.Vector2(0, 0) };
    shader.uniforms.uAtlasB = { value: new THREE.Vector2(0, 0) };
    shader.uniforms.uAtlasBlend = { value: 0 };
    atlasShader = shader;
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform vec2 uAtlasA;
uniform vec2 uAtlasB;
uniform float uAtlasBlend;
vec2 atlasUvOff(vec2 uv, vec2 cell, vec2 off) {
  vec2 local = clamp(uv + off, vec2(0.0), vec2(1.0));
  vec2 origin = vec2(cell.x, ${ATLAS_ROWS}.0 - 1.0 - cell.y) / vec2(${ATLAS_COLS}.0, ${ATLAS_ROWS}.0);
  return origin + local / vec2(${ATLAS_COLS}.0, ${ATLAS_ROWS}.0);
}`
      )
      .replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
  float blurR = ${BLUR_TEXEL.toFixed(4)};
  vec4 atlasAcc = texture2D(map, atlasUvOff(vMapUv, uAtlasA, vec2(0.0)));
  atlasAcc += texture2D(map, atlasUvOff(vMapUv, uAtlasA, vec2(blurR, 0.0)));
  atlasAcc += texture2D(map, atlasUvOff(vMapUv, uAtlasA, vec2(-blurR, 0.0)));
  atlasAcc += texture2D(map, atlasUvOff(vMapUv, uAtlasA, vec2(0.0, blurR)));
  atlasAcc += texture2D(map, atlasUvOff(vMapUv, uAtlasA, vec2(0.0, -blurR)));
  vec4 atlasBAcc = texture2D(map, atlasUvOff(vMapUv, uAtlasB, vec2(0.0)));
  atlasBAcc += texture2D(map, atlasUvOff(vMapUv, uAtlasB, vec2(blurR, 0.0)));
  atlasBAcc += texture2D(map, atlasUvOff(vMapUv, uAtlasB, vec2(-blurR, 0.0)));
  atlasBAcc += texture2D(map, atlasUvOff(vMapUv, uAtlasB, vec2(0.0, blurR)));
  atlasBAcc += texture2D(map, atlasUvOff(vMapUv, uAtlasB, vec2(0.0, -blurR)));
  vec4 sampledDiffuseColor = mix(atlasAcc * 0.2, atlasBAcc * 0.2, uAtlasBlend);
  diffuseColor *= sampledDiffuseColor;
#endif`
      );
  };
  const atlasMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), atlasMat);
  atlasMesh.scale.set(ATLAS_SIZE.x, ATLAS_SIZE.y, 1);
  atlasMesh.visible = false;
  pivot.add(atlasMesh);

  const debug = (window.__cloak = {
    saveData,
    reduced,
    state: 'off',
    active: false,
    frame: 0,
    blend: 0,
    stat() {
      return {
        state: this.state,
        active: this.active,
        frame: this.frame,
        blend: +this.blend.toFixed(3),
      };
    },
  });

  let motionFade = 0;
  const wantAtlas = cloakParam !== 'still' && !saveData && !reduced;
  if (wantAtlas) {
    debug.state = 'loading';
    new THREE.TextureLoader(manager).load(
      '/plates/wanderer-cloak-atlas.webp',
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        /* no mipmaps: they would blend across atlas cells at a distance */
        tex.generateMipmaps = false;
        tex.minFilter = THREE.LinearFilter;
        atlasMat.map = tex;
        atlasMat.needsUpdate = true;
        atlasMesh.visible = true;
        debug.active = true;
        debug.state = 'active';
      },
      undefined,
      () => {
        debug.state = 'error';
      }
    );
  } else {
    debug.state = cloakParam === 'still'
      ? 'forced-still'
      : reduced ? 'reduced-motion' : saveData ? 'save-data' : 'off';
  }

  const smooth = new THREE.Vector2();

  function update(t, dt, time, night = 0) {
    smooth.x += (pointer.x - smooth.x) * Math.min(1, dt * 1.5);
    smooth.y += (pointer.y - smooth.y) * Math.min(1, dt * 1.5);

    const out = range(t, 0.18, 0.6);

    pivot.position.x = BASE.x + smooth.x * KX_MAX - out * 0.4;
    pivot.position.y = BASE.y + Math.sin(time * 0.55) * 0.025 - smooth.y * KY_MAX;
    pivot.position.z = BASE.z - out * 2.4;
    pivot.rotation.y = smooth.x * 0.04;
    pivot.rotation.z = Math.sin(time * 0.3) * 0.004;

    const vis = Math.min(1, 1.12 * (1 - out));
    if (atlasMesh.visible) motionFade = Math.min(1, motionFade + dt * 1.6);
    const stillFade = 1 - motionFade;
    for (let i = 0; i < meshes.length; i++) {
      const m = meshes[i];
      m.position.x = offsets[i].x + smooth.x * (LAYERS[i].kx - KX_MAX);
      m.position.y = offsets[i].y - smooth.y * (LAYERS[i].ky - KY_MAX);
      m.material.opacity = vis * stillFade;
      m.material.color.lerpColors(FIGURE_WARM, FIGURE_NIGHT, night);
      if (waves[i] && stillFade > 0.02) waves[i].update(time);
    }
    if (atlasMesh.visible) {
      atlasMesh.position.copy(meshes[1].position);
      atlasMesh.position.x += ATLAS_OFFSET.x;
      atlasMesh.position.y += ATLAS_OFFSET.y;
      atlasMat.opacity = vis * motionFade;
      atlasMat.color.lerpColors(FIGURE_WARM, FIGURE_NIGHT, night);
      if (atlasShader) {
        const phase = ((time / LOOP_SECONDS) % 1 + 1) % 1;
        const x = phase * ATLAS_FRAMES;
        const i0 = Math.floor(x) % ATLAS_FRAMES;
        const i1 = (i0 + 1) % ATLAS_FRAMES;
        atlasShader.uniforms.uAtlasA.value.set(i0 % ATLAS_COLS, Math.floor(i0 / ATLAS_COLS));
        atlasShader.uniforms.uAtlasB.value.set(i1 % ATLAS_COLS, Math.floor(i1 / ATLAS_COLS));
        const blend = x - Math.floor(x);
        atlasShader.uniforms.uAtlasBlend.value = blend;
        debug.frame = i0;
        debug.blend = blend;
      }
    }

    backlight.position.x = pivot.position.x;
    backlight.position.z = pivot.position.z - 0.7;
    backlightMat.color.lerpColors(GLOW_WARM, GLOW_NIGHT, night);
    backlightMat.opacity = (0.3 + Math.sin(time * 0.4) * 0.04) * (1 - out) * (1 - night * 0.45);
  }

  return { group, update };
}
