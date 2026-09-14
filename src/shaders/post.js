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
uniform float uRays;
uniform vec2 uSun;
uniform vec2 uRes;

varying vec2 vUv;

void main() {
  vec2 uv = vUv;

  // oil-painting: subtle brush wobble distortion
  // (amplitude stays << texture detail scale, or fine painted detail smears)
  float wob = 0.00038 * sin(uv.y * 220.0 + uTime * 0.9)
            + 0.00028 * sin(uv.x * 180.0 - uTime * 0.7 + uv.y * 40.0);
  uv += vec2(wob, -wob * 0.7);

  vec3 col = texture2D(uScene, uv).rgb;

  // god rays — radial blur from the sun, only while it is on screen
  if (uRays > 0.5) {
    vec2 dir = (uSun - uv) * 0.016;
    vec3 acc = vec3(0.0);
    float w = 1.0;
    vec2 p = uv;
    for (int i = 0; i < 28; i++) {
      p += dir;
      acc += texture2D(uScene, p).rgb * w;
      w *= 0.94;
    }
    acc *= 0.0357;
    float mask = smoothstep(1.15, 0.05, length(vUv - uSun));
    col += acc * mask * 0.2;
  }

  // golden-hour grade: cool shadows, warm light
  float luma = dot(col, vec3(0.299, 0.587, 0.114));
  vec3 cool = vec3(0.84, 0.93, 1.12);
  vec3 warm = vec3(1.1, 1.02, 0.88);
  col *= mix(cool, warm, smoothstep(0.06, 0.70, luma));

  // pull chroma out of the shadows; keep the golden light
  float grey = dot(col, vec3(0.299, 0.587, 0.114));
  float keep = mix(0.82, 0.97, smoothstep(0.25, 0.85, grey));
  col = mix(vec3(grey), col, keep);

  // soft contrast curve
  col = col * 0.72 + col * col * 0.28;

  // painterly grain
  float n = texture2D(uNoise, uv * 0.5 + uTime * 0.015).r;
  col += (n - 0.5) * 0.045;

  // warm vignette, centered toward the sun
  vec2 q = vUv - vec2(0.55, 0.5);
  q.x *= uAspect;
  float vig = smoothstep(1.05, 0.35, length(q));
  col *= mix(0.55, 1.0, vig);

  gl_FragColor = vec4(col, 1.0);
}
`;
