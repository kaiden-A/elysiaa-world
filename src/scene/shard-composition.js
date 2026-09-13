import * as THREE from 'three';
import { range } from '../core/timeline.js';
import pointer from '../core/pointer.js';

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

uniform sampler2D uShot;
uniform float uTime;
uniform float uAlpha;
uniform float uGlint;

varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vPosW;

void main() {
  vec3 shot = texture2D(uShot, vUv).rgb;
  vec3 V = normalize(cameraPosition - vPosW);
  vec3 N = normalize(vNormalW);
  float rim = pow(1.0 - abs(dot(N, V)), 1.7);

  vec3 glass = vec3(0.075, 0.08, 0.09);
  vec3 ink = shot * vec3(1.38, 1.32, 1.2);
  vec3 col = mix(glass, ink, 0.92);

  float sheen = (0.3 + 0.7 * length(shot)) * rim;
  col += vec3(1.0, 0.94, 0.78) * sheen * 0.42;

  // lit broken edge catching the light
  float edge = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
  float outline = smoothstep(0.06, 0.012, edge);
  col += vec3(1.0, 0.95, 0.8) * outline * (0.26 + 0.12 * sin(uTime * 1.2 + vUv.x * 34.0));

  float g1 = pow(max(sin(vUv.x * 40.0 + uTime * 2.0) * sin(vUv.y * 40.0 - uTime * 1.6), 0.0), 26.0);
  col += vec3(1.0, 0.97, 0.86) * g1 * 0.15;

  col += vec3(1.0, 0.95, 0.82) * uGlint;

  gl_FragColor = vec4(col, uAlpha);
}
`;

/**
 * A constellation of large mirror shards, each carrying one fragment of the
 * wanderer or a reflection of the world. They hold the composition, drift with
 * the pointer, then fly past the camera as the journey begins.
 */
export function createShardComposition({ shardTextures }) {
  const group = new THREE.Group();
  const rnd = makeRng(778899);
  const mobile = window.innerWidth < 760;

  /*
   * Authored hero composition — breathing space kept around the wanderer:
   * body |x| < 0.55, head top y ~0.85, spear arm to the right.
   * Big fragments hold the edges, reflections sit high, accents mark the corners.
   */
  const LAYOUT = [
    { shot: 0, x: -2.45, y: 0.5, z: 0.35, rx: 0.04, ry: 0.42, rz: -0.1, s: 1.5 },
    { shot: 1, x: -2.0, y: 2.0, z: -1.6, rx: 0.0, ry: 0.18, rz: 0.06, s: 1.0 },
    { shot: 2, x: 1.9, y: 2.2, z: -2.6, rx: 0.0, ry: -0.06, rz: 0.04, s: 1.2 },
    { shot: 3, x: 2.3, y: 1.6, z: -1.3, rx: 0.0, ry: -0.24, rz: -0.08, s: 0.95 },
    { shot: 4, x: 2.55, y: 0.35, z: 0.3, rx: 0.0, ry: -0.46, rz: 0.12, s: 1.5 },
    { shot: 5, x: -2.8, y: -1.35, z: 0.6, rx: 0.16, ry: 0.3, rz: 0.2, s: 1.15 },
    { shot: 6, x: 2.25, y: -1.05, z: 0.45, rx: 0.08, ry: -0.3, rz: -0.18, s: 1.1 },
    { shot: 7, x: -3.2, y: -0.25, z: 0.7, rx: 0.2, ry: 0.5, rz: 0.3, s: 0.6 },
    { shot: 8, x: 0.4, y: -1.7, z: 0.5, rx: 0.1, ry: -0.1, rz: 0.16, s: 0.6 },
  ];

  const items = mobile ? LAYOUT.slice(0, 5) : LAYOUT;
  const mobileScale = mobile ? 0.72 : 1;

  items.forEach((cfg, idx) => {
    const isAccent = idx >= 7;
    const entry = shardTextures[cfg.shot % shardTextures.length];
    const ar = Math.min(1.5, Math.max(0.72, entry.ar || 1));
    const w = 1.0 * cfg.s;
    const h = (isAccent ? 0.8 : 1.0) * cfg.s * ar;

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
        uShot: { value: entry.tex },
        uTime: { value: 0 },
        uAlpha: { value: 1 },
        uGlint: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geo, mat);

    const dir = new THREE.Vector2(cfg.x, cfg.y);
    if (dir.lengthSq() < 0.001) dir.set(0.3, 0.25);
    dir.normalize();

    mesh.userData = {
      hero: {
        pos: new THREE.Vector3(cfg.x * mobileScale, cfg.y * mobileScale, cfg.z),
        rot: new THREE.Euler(cfg.rx, cfg.ry, cfg.rz),
        s: cfg.s * (mobile ? 0.82 : 1),
      },
      dir,
      delay: idx * 0.04 + rnd() * 0.12,
      phase: rnd() * Math.PI * 2,
    };

    group.add(mesh);
  });

  function update(t, _dt, time) {
    group.rotation.y = pointer.x * 0.05;
    group.rotation.x = pointer.y * 0.03;

    for (const m of group.children) {
      const d = m.userData;
      const { hero } = d;
      const out = range(t, 0.5 + d.delay * 0.3, 1);

      const px =
        hero.pos.x + d.dir.x * out * 3.2 + Math.sin(time * 0.42 + d.phase) * 0.08 + pointer.x * 0.18 * (1 - out);
      const py =
        hero.pos.y + d.dir.y * out * 2.2 + Math.cos(time * 0.36 + d.phase * 1.3) * 0.08 - pointer.y * 0.14 * (1 - out);
      const pz = hero.pos.z + out * 4.6;
      m.position.set(px, py, pz);

      m.rotation.set(
        hero.rot.x + Math.sin(time * 0.22 + d.phase) * 0.05,
        hero.rot.y + Math.cos(time * 0.18 + d.phase) * 0.07,
        hero.rot.z + Math.sin(time * 0.3 + d.phase * 1.2) * 0.06 + d.dir.x * out * 0.5
      );

      m.scale.setScalar(hero.s * (1 + out * 0.7));

      const u = m.material.uniforms;
      u.uTime.value = time;
      u.uAlpha.value = 1 - out * 0.85;
      u.uGlint.value = Math.exp(-Math.pow((out - 0.22) * 4.0, 2)) * 0.32;
    }
  }

  return { group, update };
}
