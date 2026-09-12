export const postVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

export const postFragment = /* glsl */ `
precision highp float;

uniform sampler2D uScene;
uniform sampler2D uNoise;
uniform float uTime;
uniform float uAspect;
uniform float uDim;
uniform vec2 uRes;

varying vec2 vUv;

void main() {
  vec2 uv = vUv;

  // oil-painting: subtle brush wobble distortion
  float wob = 0.0016 * sin(uv.y * 220.0 + uTime * 0.9)
            + 0.0011 * sin(uv.x * 180.0 - uTime * 0.7 + uv.y * 40.0);
  uv += vec2(wob, -wob * 0.7);

  vec3 col = texture2D(uScene, uv).rgb;

  // painterly grain (film of oil)
  float n = texture2D(uNoise, uv * 0.35 + uTime * 0.02).r;
  col += (n - 0.5) * 0.05;

  // soft contrast curve
  col = col * 0.55 + col * col * 0.45;

  // vignette
  vec2 q = vUv - 0.5;
  q.x *= uAspect;
  float vig = smoothstep(0.95, 0.32, length(q));
  col *= mix(0.62, 1.0, vig);

  col *= uDim;

  gl_FragColor = vec4(col, 1.0);
}
`;