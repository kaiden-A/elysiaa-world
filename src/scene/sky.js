import * as THREE from 'three';
import pointer from '../core/pointer.js';
import { makeDotTexture } from '../core/glutils.js';

/* the light the post pass aims its rays at — set to the authored sunset */
const SUN_ANCHOR = new THREE.Vector3(6.26, 3.6, -28);

/* where the sunset's painted sun sits in world space through its own
 * transform; the night plate is framed onto the same point so the painted
 * light barely moves while the sky crossfades beneath it */
const PAINTED_LIGHT = new THREE.Vector3(6.84, -4.32, -28);

const SKY_Z = -30;
const PLATE_H = 42;

/* The two painted skies. Sunset keeps the exact transform it shipped with;
 * night preserves its own aspect and is framed so its painted moon lands on
 * PAINTED_LIGHT. `light` is that light's [u, v] inside the plate, `bot` the
 * texture v below which the bottom row stretches downward. */
const SUNSET = 0;
const NIGHT = 1;
const PLATES = [
  {
    url: '/plates/sky.jpg',
    legacy: { x: -31.1, y: 1.27, w: 140, h: PLATE_H },
    bot: 0.3, sat: 0.82, tint: [0.95, 0.99, 1.07],
  },
  {
    url: '/plates/sky-night.jpg',
    light: [0.7, 0.43],
    bot: 0.1, sat: 1.0, tint: [1.0, 1.01, 1.05],
  },
];

/* the additive halo that blooms over the painted light, per plate */
const HALO = [
  { halo: 5, core: 1.6, haloOp: 0.5, coreOp: 0.82 },
  { halo: 7, core: 2.6, haloOp: 0.22, coreOp: 0.5 },
];
const HALO_COLOR = [new THREE.Color(0xffe0a8), new THREE.Color(0xd6e2ff)];
const CORE_COLOR = [new THREE.Color(0xfff3d6), new THREE.Color(0xe8f0ff)];

/** Hand-painted golden-hour sky, used until the plate files are provided. */
function makeSkyTexture() {
  const W = 1024;
  const H = 512;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');

  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0.0, '#0a141d');
  g.addColorStop(0.34, '#22313c');
  g.addColorStop(0.52, '#55606a');
  g.addColorStop(0.62, '#b07a49');
  g.addColorStop(0.68, '#f0c078');
  g.addColorStop(0.72, '#f7d9a0');
  g.addColorStop(0.76, '#a86e3a');
  g.addColorStop(0.84, '#243038');
  g.addColorStop(1.0, '#0c141b');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const sx = W * 0.63;
  const sy = H * 0.66;
  const sun = ctx.createRadialGradient(sx, sy, 0, sx, sy, H * 0.52);
  sun.addColorStop(0, 'rgba(255, 240, 200, 0.95)');
  sun.addColorStop(0.08, 'rgba(255, 225, 165, 0.72)');
  sun.addColorStop(0.3, 'rgba(240, 185, 110, 0.26)');
  sun.addColorStop(1, 'rgba(240, 185, 110, 0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, W, H);

  let seed = 20260913;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const bands = [
    { y: 0.24, n: 9, scale: 1.0, alpha: 0.5, light: 'rgba(214,196,170,' },
    { y: 0.4, n: 8, scale: 1.2, alpha: 0.55, light: 'rgba(226,196,158,' },
    { y: 0.55, n: 7, scale: 1.4, alpha: 0.6, light: 'rgba(247,217,160,' },
    { y: 0.63, n: 6, scale: 1.1, alpha: 0.45, light: 'rgba(247,225,180,' },
  ];

  for (const band of bands) {
    for (let i = 0; i < band.n; i++) {
      const bx = rnd() * W;
      const by = H * band.y + (rnd() - 0.5) * H * 0.08;
      const bw = (60 + rnd() * 150) * band.scale;
      const bh = (10 + rnd() * 26) * band.scale;
      const warm = Math.min(1, Math.max(0, (sx - bx) / (W * 0.5)));
      const grad = ctx.createRadialGradient(bx, by, 0, bx, by, Math.max(bw, bh));
      grad.addColorStop(0, band.light + (band.alpha * (0.5 + warm * 0.5)).toFixed(2) + ')');
      grad.addColorStop(0.6, 'rgba(40,48,56,0.16)');
      grad.addColorStop(1, 'rgba(40,48,56,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(bx, by, bw, bh, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const haze = ctx.createLinearGradient(0, H * 0.54, 0, H * 0.82);
  haze.addColorStop(0, 'rgba(240,200,140,0)');
  haze.addColorStop(0.5, 'rgba(240,200,140,0.2)');
  haze.addColorStop(1, 'rgba(240,200,140,0)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, W, H);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/* how much each plate contributes at a given night factor */
function weights(night) {
  const n = clamp01(night);
  return [1 - n, n];
}

function makeColorMix(out, colors, w) {
  out.setRGB(
    colors[0].r * w[0] + colors[1].r * w[1],
    colors[0].g * w[0] + colors[1].g * w[1],
    colors[0].b * w[0] + colors[1].b * w[1]
  );
}

export function createSky({ manager }) {
  const group = new THREE.Group();

  /* shared across every plate: one time, one pointer drift */
  const uTime = { value: 0 };
  const uParallax = { value: new THREE.Vector2() };

  function frame(plane, cfg, aspect) {
    const h = PLATE_H;
    const w = h * aspect;
    plane.scale.set(w, h, 1);
    plane.position.set(
      PAINTED_LIGHT.x - (cfg.light[0] - 0.5) * w,
      PAINTED_LIGHT.y - (cfg.light[1] - 0.5) * h,
      SKY_Z
    );
  }

  const planes = PLATES.map((cfg, i) => {
    const uniforms = {
      uMap: { value: makeSkyTexture() },
      uTime,
      uParallax,
      uBot: { value: cfg.bot },
      uSat: { value: cfg.sat },
      uTint: { value: new THREE.Vector3(...cfg.tint) },
      uOpacity: { value: i === SUNSET ? 1 : 0 },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D uMap;
        uniform float uTime;
        uniform vec2 uParallax;
        uniform float uBot;
        uniform float uSat;
        uniform vec3 uTint;
        uniform float uOpacity;
        varying vec2 vUv;
        void main() {
          vec2 uv = vUv;
          uv.x += uTime * 0.0012 + uParallax.x * 0.012;
          // below the painted panel, stretch the dark bottom edge downward
          uv.y = mix(0.0, 1.0, clamp((uv.y - uBot) / max(0.0001, 1.0 - uBot), 0.0, 1.0));
          uv.y += uParallax.y * 0.006;
          vec3 col = texture2D(uMap, uv).rgb;
          // tame the painted saturation, then a gentle colour cast
          float grey = dot(col, vec3(0.299, 0.587, 0.114));
          col = mix(vec3(grey), col, uSat);
          col *= uTint;
          float side = abs(vUv.x - 0.5) * 2.0;
          col *= 1.0 - 0.16 * side * side;
          float vert = abs(vUv.y - 0.5) * 2.0;
          col *= 1.0 - 0.1 * vert * vert;
          gl_FragColor = vec4(col, uOpacity);
        }
      `,
      transparent: i !== SUNSET,
      depthWrite: false,
      toneMapped: false,
    });

    const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    if (cfg.legacy) {
      plane.scale.set(cfg.legacy.w, cfg.legacy.h, 1);
      plane.position.set(cfg.legacy.x, cfg.legacy.y, SKY_Z);
    } else {
      frame(plane, cfg, 2);
    }
    /* negative render order: the sky always sits behind the shards, wanderer
     * and atmosphere, which all render in the default transparent batch */
    plane.renderOrder = i - PLATES.length;
    plane.userData = { cfg, mat };
    group.add(plane);
    return plane;
  });

  const loader = new THREE.TextureLoader(manager);
  planes.forEach((plane) => {
    const { cfg, mat } = plane.userData;
    loader.load(
      cfg.url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.anisotropy = 4;

        const old = mat.uniforms.uMap.value;
        mat.uniforms.uMap.value = tex;
        old.dispose();
        if (!cfg.legacy) frame(plane, cfg, tex.image.width / tex.image.height);
      },
      undefined,
      () => {}
    );
  });

  const dot = makeDotTexture();

  const haloMat = new THREE.SpriteMaterial({
    map: dot,
    color: HALO_COLOR[SUNSET].clone(),
    transparent: true,
    opacity: HALO[SUNSET].haloOp,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const halo = new THREE.Sprite(haloMat);
  halo.position.copy(SUN_ANCHOR);
  group.add(halo);

  const coreMat = haloMat.clone();
  coreMat.color.copy(CORE_COLOR[SUNSET]);
  coreMat.opacity = HALO[SUNSET].coreOp;
  const core = new THREE.Sprite(coreMat);
  core.position.copy(SUN_ANCHOR);
  group.add(core);

  const smooth = new THREE.Vector2();

  function update(_t, dt, time, night = 0) {
    const w = weights(night);

    uTime.value = time;
    smooth.x += (pointer.x - smooth.x) * Math.min(1, dt * 1.6);
    smooth.y += (pointer.y - smooth.y) * Math.min(1, dt * 1.6);
    uParallax.value.copy(smooth);
    group.position.x = smooth.x * -0.55;
    group.position.y = smooth.y * -0.22;

    for (let i = 0; i < planes.length; i++) {
      planes[i].material.uniforms.uOpacity.value = w[i];
    }

    const haloSize = HALO[0].halo * w[0] + HALO[1].halo * w[1];
    const coreSize = HALO[0].core * w[0] + HALO[1].core * w[1];
    halo.scale.set(haloSize, haloSize, 1);
    core.scale.set(coreSize, coreSize, 1);

    haloMat.opacity =
      (HALO[0].haloOp * w[0] + HALO[1].haloOp * w[1]) * (0.9 + Math.sin(time * 0.35) * 0.1);
    coreMat.opacity =
      (HALO[0].coreOp * w[0] + HALO[1].coreOp * w[1]) * (1 + Math.sin(time * 0.6) * 0.08);

    makeColorMix(haloMat.color, HALO_COLOR, w);
    makeColorMix(coreMat.color, CORE_COLOR, w);
  }

  return { group, update, sunPos: SUN_ANCHOR.clone() };
}
