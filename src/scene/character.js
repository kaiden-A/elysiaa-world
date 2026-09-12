import * as THREE from 'three';
import { desaturateTexture } from '../core/glutils.js';

const LIGHT_DIR = new THREE.Vector3(0.45, 0.5, 0.75).normalize();

const paintVertex = /* glsl */ `
#include <skinning_pars_vertex>

varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vPosW;

void main() {
  vUv = uv;
  #include <beginnormal_vertex>
  #include <skinbase_vertex>
  #include <skinnormal_vertex>

  vec3 transformed = vec3(position);
  #include <skinning_vertex>

  vec4 wp = modelMatrix * vec4(transformed, 1.0);
  vPosW = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * objectNormal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const paintFragment = /* glsl */ `
precision highp float;

uniform sampler2D uMap;
uniform sampler2D uRamp;
uniform vec3 uLightDir;
uniform float uRim;
uniform float uShadowLift;
uniform float uRimLight;

varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vPosW;

void main() {
  vec3 N = normalize(vNormalW);
  vec3 L = normalize(uLightDir);
  float ndl = clamp(dot(N, L), 0.0, 1.0);

  // toon banding via the gradient ramp
  float ramp = texture2D(uRamp, vec2(ndl * 0.98 + 0.01, 0.5)).r;

  vec3 base = texture2D(uMap, vUv).rgb;
  vec3 V = normalize(cameraPosition - vPosW);
  float rim = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 2.2);

  vec3 col = base * mix(0.30 + uShadowLift, 1.12, ramp);
  col *= 1.0 - rim * uRim;

  // soft fresnel edge light (oil-painted highlight)
  float fr = pow(1.0 - abs(dot(N, V)), 1.5);
  col += vec3(0.9) * fr * uRimLight;

  gl_FragColor = vec4(col, 1.0);
}
`;

const grayCanvas = (() => {
  let c = null;
  return () => {
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = 2;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#9a9890';
    ctx.fillRect(0, 0, 2, 2);
    return c;
  };
})();

/** Build a shared oil-paint ShaderMaterial for a source material */
export function paintMaterial(srcMat, ramp, opts = {}) {
  const map =
    (srcMat && srcMat.map && desaturateTexture(srcMat.map, opts.contrast ?? 1.25, 0.06)) ||
    new THREE.CanvasTexture(grayCanvas());

  const mat = new THREE.ShaderMaterial({
    vertexShader: paintVertex,
    fragmentShader: paintFragment,
    uniforms: {
      uMap: { value: map },
      uRamp: { value: ramp },
      uLightDir: { value: LIGHT_DIR.clone() },
      uRim: { value: opts.rim ?? 0.45 },
      uShadowLift: { value: opts.shadowLift ?? 0.0 },
      uRimLight: { value: opts.rimLight ?? 0.0 },
    },
    side: THREE.DoubleSide,
  });
  if (srcMat && srcMat.name) mat.name = srcMat.name;
  return mat;
}

/** Replace every mesh material in a glTF scene with oil-paint materials */
export function applyPaintToScene(root, ramp, opts) {
  const seen = new Map();
  root.traverse((o) => {
    if (!o.isMesh) return;
    const src = Array.isArray(o.material) ? o.material[0] : o.material;
    let mat = seen.get(src);
    if (!mat) {
      mat = paintMaterial(src, ramp, opts);
      seen.set(src, mat);
    }
    o.material = mat;
  });
}
