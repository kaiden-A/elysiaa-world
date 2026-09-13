import * as THREE from 'three';
import pointer from '../core/pointer.js';
import { makeDotTexture } from '../core/glutils.js';

/* fallback sun sits where the procedural sky paints it; the plate has its own */
const SUN_FALLBACK = new THREE.Vector3(10.4, -2.1, -28);
const SUN_PLATE = new THREE.Vector3(6.26, 3.6, -28);

/** Hand-painted golden-hour sky, used until public/plates/sky.jpg is provided. */
export function makeSkyTexture() {
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

export function createSky({ manager }) {
  const group = new THREE.Group();

  const uniforms = {
    uMap: { value: makeSkyTexture() },
    uTime: { value: 0 },
    uParallax: { value: new THREE.Vector2() },
    uBot: { value: 0 },
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
      varying vec2 vUv;
      void main() {
        vec2 uv = vUv;
        uv.x += uTime * 0.0012 + uParallax.x * 0.012;
        // below the painted panel, stretch the dark bottom edge downward
        uv.y = mix(0.0, 1.0, clamp((uv.y - uBot) / max(0.0001, 1.0 - uBot), 0.0, 1.0));
        uv.y += uParallax.y * 0.006;
        vec3 col = texture2D(uMap, uv).rgb;
        // tame the painted saturation: a little less orange, a little more dusk
        float grey = dot(col, vec3(0.299, 0.587, 0.114));
        col = mix(vec3(grey), col, 0.82);
        col *= vec3(0.95, 0.99, 1.07);
        float side = abs(vUv.x - 0.5) * 2.0;
        col *= 1.0 - 0.16 * side * side;
        float vert = abs(vUv.y - 0.5) * 2.0;
        col *= 1.0 - 0.1 * vert * vert;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    depthWrite: false,
    toneMapped: false,
  });

  const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  plane.scale.set(80, 42, 1);
  plane.position.set(0, 4.6, -30);
  group.add(plane);

  const dot = makeDotTexture();

  const haloMat = new THREE.SpriteMaterial({
    map: dot,
    color: 0xffe0a8,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const halo = new THREE.Sprite(haloMat);
  halo.scale.set(15, 15, 1);
  group.add(halo);

  const coreMat = haloMat.clone();
  coreMat.color.setHex(0xfff3d6);
  coreMat.opacity = 0.85;
  const core = new THREE.Sprite(coreMat);
  core.scale.set(4.6, 4.6, 1);
  group.add(core);

  const sunPos = SUN_FALLBACK.clone();

  function setSun(v, haloSize, coreSize) {
    sunPos.copy(v);
    halo.position.copy(v);
    core.position.copy(v);
    halo.scale.set(haloSize, haloSize, 1);
    core.scale.set(coreSize, coreSize, 1);
  }
  setSun(SUN_FALLBACK, 15, 4.6);

  new THREE.TextureLoader(manager).load(
    '/plates/sky.jpg',
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;

      // frame the painted sun right of center, horizon at mid-screen
      plane.scale.set(140, 42, 1);
      plane.position.set(-31.1, 1.27, -30);

      uniforms.uMap.value.dispose();
      uniforms.uMap.value = tex;
      uniforms.uBot.value = 0.3;
      setSun(SUN_PLATE, 5, 1.6);
      haloMat.opacity = 0.4;
    },
    undefined,
    () => {}
  );

  const smooth = new THREE.Vector2();

  function update(_t, dt, time) {
    uniforms.uTime.value = time;
    smooth.x += (pointer.x - smooth.x) * Math.min(1, dt * 1.6);
    smooth.y += (pointer.y - smooth.y) * Math.min(1, dt * 1.6);
    uniforms.uParallax.value.copy(smooth);
    group.position.x = smooth.x * -0.55;
    group.position.y = smooth.y * -0.22;

    haloMat.opacity = 0.5 * (0.9 + Math.sin(time * 0.35) * 0.1);
    coreMat.opacity = 0.82 + Math.sin(time * 0.6) * 0.07;
  }

  return { group, update, sunPos };
}
