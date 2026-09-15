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
uniform float uNight;
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

  // god rays — radial blur from the sun or moon, only while it is on screen
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
    vec3 rayTint = mix(vec3(1.0, 0.95, 0.85), vec3(0.78, 0.86, 1.12), uNight);
    float mask = smoothstep(1.15, 0.05, length(vUv - uSun));
    col += acc * rayTint * mask * mix(0.2, 0.09, uNight);
  }

  // golden hour, cooling to moonlight after dark
  float luma = dot(col, vec3(0.299, 0.587, 0.114));
  vec3 cool = mix(vec3(0.84, 0.93, 1.12), vec3(0.60, 0.70, 1.05), uNight);
  vec3 warm = mix(vec3(1.1, 1.02, 0.88), vec3(0.72, 0.82, 1.05), uNight);
  col *= mix(cool, warm, smoothstep(0.06, 0.70, luma));

  // pull chroma out of the shadows; keep the golden light
  float grey = dot(col, vec3(0.299, 0.587, 0.114));
  float keep = mix(
    mix(0.82, 0.97, smoothstep(0.25, 0.85, grey)),
    mix(0.9, 1.0, smoothstep(0.25, 0.85, grey)),
    uNight
  );
  col = mix(vec3(grey), col, keep);

  // soft contrast curve, sitting a little deeper at night
  col = col * 0.72 + col * col * 0.28;
  col *= mix(1.0, 0.9, uNight);

  // painterly grain
  float n = texture2D(uNoise, uv * 0.5 + uTime * 0.015).r;
  col += (n - 0.5) * 0.045;

  // vignette, centered toward the light and heavier at night
  vec2 q = vUv - vec2(0.55, 0.5);
  q.x *= uAspect;
  float vig = smoothstep(1.05, 0.35, length(q));
  col *= mix(mix(0.55, 0.68, uNight), 1.0, vig);

  gl_FragColor = vec4(col, 1.0);
}
`;
