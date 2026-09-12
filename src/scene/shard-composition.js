import * as THREE from 'three';
import { range, track, clamp, lerp, smooth } from '../core/timeline.js';

const RING_RADIUS = 2.32;
const RING_CENTER = new THREE.Vector3(0, 0.12, -1.25);

/** seeded rng */
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** jagged glass polygon (box of w x h, zigzag edges) */
function jagged(w, h, rnd, jag) {
  const pts = [];
  const push = (x, y) => pts.push(new THREE.Vector2(x, y));
  const n = 3;
  const j = () => (rnd() - 0.5) * jag;

  push(0, j());
  for (let i = 1; i < n; i++) push((w * i) / n + j() * 0.6, (rnd() - 0.5) * jag);
  push(w + j(), 0);
  for (let i = 1; i < n; i++) push(w + (rnd() - 0.5) * jag, (h * i) / n + j() * 0.6);
  push(w + j(), h);
  for (let i = n - 1; i >= 1; i--) push((w * i) / n + j() * 0.6, h + (rnd() - 0.5) * jag);
  push(j(), h);
  for (let i = n - 1; i >= 1; i--) push((rnd() - 0.5) * jag, (h * i) / n + j() * 0.6);
  return pts;
}

const shardVertex = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vPosW;

void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vPosW = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const shardFragment = /* glsl */ `
precision highp float;

uniform sampler2D uShot;   // portrait of the knight
uniform float uTime;
uniform float uAlpha;
uniform float uGlint;
uniform float uPortrait;   // 1 portrait ... 0 dark frame glass

varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vPosW;

void main() {
  float shot = texture2D(uShot, vUv).r;
  float ink  = shot * uPortrait;

  vec3 V = normalize(cameraPosition - vPosW);
  vec3 N = normalize(vNormalW);
  float rim = pow(1.0 - abs(dot(N, V)), 1.7);

  vec3 col = vec3(0.055, 0.055, 0.065);
  vec3 inkColor = vec3(0.94, 0.92, 0.87);
  col = mix(col, inkColor, ink * uAlpha);

  float sheen = (0.3 + 0.7 * ink) * rim;
  col += vec3(0.82) * sheen * 0.55;

  // lit broken edge — burns brighter as the piece becomes frame glass
  float edge = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
  float outline = smoothstep(0.055, 0.012, edge);
  col += vec3(0.92) * outline * (0.28 + (1.0 - uPortrait) * 0.5) * (0.65 + 0.35 * sin(uTime * 1.2 + vUv.x * 34.0));

  float g1 = pow(max(sin(vUv.x * 40.0 + uTime * 2.0) * sin(vUv.y * 40.0 - uTime * 1.6), 0.0), 26.0);
  col += vec3(0.95) * g1 * 0.2;

  col += vec3(1.0) * uGlint;

  gl_FragColor = vec4(col, 1.0);
}
`;

/**
 * Hand-composed constellation of large glass shards.
 * Each carries one portrait of the knight; at the end of the page they fly
 * into a broken ring framing the Gate to Elysium, portraits fading to glass.
 *
 * portraitTex: array of CanvasTextures (8 shots)
 */
export function createShardComposition({ portraitTex }) {
  const group = new THREE.Group();
  const rnd = makeRng(778899);
  const mobile = window.innerWidth < 760;

  /*
   * Authored hero composition — breathing space kept around the knight:
   * body |x| < 0.55, head top y ~0.85, sword arm to the right.
   * Big portraits hold the edges, supports sit high, accents mark the far corners.
   */
  const LAYOUT = [
    { shot: 0, x: -2.3, y: 0.5, z: 0.28, rx: 0.05, ry: 0.44, rz: -0.1, s: 1.5 },
    { shot: 1, x: 2.2, y: 0.3, z: 0.12, rx: 0.0, ry: -0.42, rz: 0.12, s: 1.42 },
    { shot: 2, x: 0.05, y: 1.72, z: -1.3, rx: 0.0, ry: 0.08, rz: 0.05, s: 1.5 },
    { shot: 3, x: -1.42, y: -0.78, z: 0.44, rx: 0.14, ry: 0.3, rz: 0.18, s: 1.02 },
    { shot: 4, x: 1.5, y: -0.72, z: 0.4, rx: 0.07, ry: -0.26, rz: -0.16, s: 1.06 },
    { shot: 5, x: -1.18, y: 1.38, z: -1.0, rx: 0.0, ry: 0.14, rz: -0.08, s: 0.92 },
    { shot: 6, x: 1.22, y: 1.5, z: -1.1, rx: 0.0, ry: -0.2, rz: 0.09, s: 0.88 },
    { shot: 7, x: -2.85, y: -0.28, z: 0.62, rx: 0.22, ry: 0.5, rz: 0.3, s: 0.62 },
    { shot: 7, x: 2.8, y: 0.88, z: 0.66, rx: -0.18, ry: -0.5, rz: -0.34, s: 0.54 },
  ];

  const items = mobile ? LAYOUT.slice(0, 5) : LAYOUT;
  const mobileScale = mobile ? 0.72 : 1;

  items.forEach((cfg, idx) => {
    const isAccent = idx >= 7;
    const w = 1.0 * cfg.s;
    const h = (isAccent ? 0.8 : 1.0) * cfg.s;

    const pts = jagged(w, h, rnd, w * 0.16);
    const shape = new THREE.Shape(pts);
    const geo = new THREE.ShapeGeometry(shape);

    const pos = geo.attributes.position;
    const uvs = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      uvs[i * 2] = pos.getX(i) / w;
      uvs[i * 2 + 1] = pos.getY(i) / h;
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

    const mat = new THREE.ShaderMaterial({
      vertexShader: shardVertex,
      fragmentShader: shardFragment,
      uniforms: {
        uShot: { value: portraitTex[cfg.shot % portraitTex.length] },
        uTime: { value: 0 },
        uAlpha: { value: 0.72 },
        uGlint: { value: 0 },
        uPortrait: { value: 1 },
      },
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geo, mat);
    const hero = {
      pos: new THREE.Vector3(cfg.x * mobileScale, cfg.y * mobileScale, cfg.z),
      rot: new THREE.Euler(cfg.rx, cfg.ry, cfg.rz),
      s: cfg.s * (mobile ? 0.82 : 1),
    };

    // ring slot around the portal
    let target = null;
    if (!isAccent) {
      const a = (-90 + idx * (360 / 7)) * (Math.PI / 180);
      target = {
        pos: new THREE.Vector3(
          RING_CENTER.x + Math.cos(a) * RING_RADIUS,
          RING_CENTER.y + Math.sin(a) * RING_RADIUS * 0.92,
          RING_CENTER.z
        ),
        rot: new THREE.Euler(0, 0, a + Math.PI / 2),
        s: mobile ? 0.62 : 0.78,
      };
    }

    mesh.userData = {
      hero,
      target,
      delay: idx * 0.05 + rnd() * 0.14,
      phase: rnd() * Math.PI * 2,
      bow: (rnd() - 0.5) * 1.2,
      bowAxis: new THREE.Vector3(rnd() - 0.5, rnd() * 0.6 + 0.4, rnd() - 0.5).normalize(),
      isAccent,
      idx,
    };

    group.add(mesh);
  });

  /* ---------- pointer parallax ---------- */
  const pointer = { x: 0, y: 0 };
  window.addEventListener('pointermove', (e) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  });

  /* ---------- timeline ---------- */
  const alphaTrack = [
    { t: 0.0, value: 0.72 },
    { t: 0.84, value: 0.72 },
    { t: 0.95, value: 0.78 },
    { t: 1.0, value: 0.78 },
  ];

  const _p = new THREE.Vector3();
  const _rot = new THREE.Euler();

  function update(t, dt, time) {
    const p = range(t, 0.86, 0.97);
    const alpha = track(alphaTrack, t);
    group.rotation.y = pointer.x * 0.05 * (1 - p);
    group.rotation.x = pointer.y * 0.03 * (1 - p);

    for (const m of group.children) {
      const d = m.userData;
      const { hero, target } = d;

      if (target) {
        const l = smooth(clamp((p - d.delay) / 0.7, 0, 1));
        _p.lerpVectors(hero.pos, target.pos, l);
        const arc = Math.sin(Math.PI * l) * d.bow * 0.5;
        _p.addScaledVector(d.bowAxis, arc);

        m.position.copy(_p);
        const drift = (1 - l) * 0.075;
        m.position.x += Math.sin(time * 0.42 + d.phase) * drift + pointer.x * 0.16 * (1 - l);
        m.position.y += Math.cos(time * 0.36 + d.phase * 1.3) * drift - pointer.y * 0.12 * (1 - l);

        _rot.set(
          lerp(hero.rot.x, target.rot.x, l),
          lerp(hero.rot.y, target.rot.y, l),
          lerp(hero.rot.z, target.rot.z, l) + Math.sin(time * 0.5 + d.phase) * 0.05 * (1 - l)
        );
        m.rotation.copy(_rot);
        m.scale.setScalar(lerp(hero.s, target.s, l));

        const u = m.material.uniforms;
        u.uGlint.value = Math.exp(-Math.pow((p - (d.delay + 0.5)) * 3.6, 2)) * 0.5;
        u.uAlpha.value = alpha;
        u.uTime.value = time;
      } else {
        const dir = new THREE.Vector3(hero.pos.x, hero.pos.y, 0).normalize();
        const out = p * 0.8;
        m.position.set(
          hero.pos.x + dir.x * out + Math.sin(time * 0.3 + d.phase) * 0.1 + pointer.x * 0.2,
          hero.pos.y + dir.y * out + Math.cos(time * 0.26 + d.phase * 1.7) * 0.09 - pointer.y * 0.14,
          hero.pos.z
        );
        m.rotation.set(
          hero.rot.x + Math.sin(time * 0.22 + d.phase) * 0.06,
          hero.rot.y + Math.cos(time * 0.18 + d.phase) * 0.08,
          hero.rot.z + Math.sin(time * 0.3 + d.phase * 1.2) * 0.07
        );
        m.scale.setScalar(hero.s * (1 + p * 0.06));
        const u = m.material.uniforms;
        u.uAlpha.value = alpha * (1 - p * 0.4);
        u.uTime.value = time;
      }
    }
  }

  return { group, update };
}