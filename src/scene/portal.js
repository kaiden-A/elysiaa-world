import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { range } from '../core/timeline.js';
import { makeDotTexture } from '../core/glutils.js';
import { applyPaintToScene } from './character.js';

const PORTAL_POS = new THREE.Vector3(0, 0.3, -1.3);
const PORTAL_RADIUS = 2.05;

/** "elysiaa" engraved on the gate lintel */
async function makeEngravingTexture() {
  await document.fonts.load('500 120px Cinzel');
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 192;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 1024, 192);
  ctx.font = '500 118px Cinzel, Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(245,242,234,0.9)';
  ctx.shadowColor = 'rgba(255,255,255,0.35)';
  ctx.shadowBlur = 16;
  ctx.fillText('e l y s i a a', 512, 100);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const discVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const discFragment = /* glsl */ `
precision highp float;

uniform sampler2D uShrine;
uniform float uOpen;    // 0 closed ... 1 fully open
uniform float uTime;

varying vec2 vUv;

void main() {
  vec2 uv = vUv;
  vec3 shrine = texture2D(uShrine, uv).rgb;

  float d = length(uv - 0.5) * 2.0; // 0 center ... 1 rim

  // iris reveal
  float open = clamp(uOpen, 0.0, 1.2);
  float iris = smoothstep(open, open - 0.3, d);

  vec3 col = shrine * iris * 1.05;

  // trembling rim of light at the threshold
  float rim = exp(-pow((d - open * 0.98) * 5.5, 2.0));
  col += vec3(0.85, 0.84, 0.8) * rim * 0.32 * smoothstep(0.02, 0.2, uOpen) * (0.7 + 0.3 * sin(uTime * 2.2));

  // glass darkening toward the rim
  col *= mix(1.0, 0.3, smoothstep(0.72, 1.0, d));

  gl_FragColor = vec4(col, 1.0);
}
`;

/**
 * The Gate to Elysium: a shrine (torii + light beyond) rendered to a texture,
 * revealed through a mirror-portal disc as the shards form its ring at the end.
 */
export function createPortal({ ramp, manager }) {
  const group = new THREE.Group();
  group.position.copy(PORTAL_POS);

  /* ---------- shrine scene (rendered to texture) ---------- */
  const shrine = new THREE.Scene();
  shrine.background = new THREE.Color(0x0a0a0c);
  const shrineCam = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
  shrineCam.position.set(0, 1.7, 4.6);
  shrineCam.lookAt(0, 1.5, 0);

  // soft ground
  {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
    g.addColorStop(0, 'rgba(120,118,110,0.85)');
    g.addColorStop(0.5, 'rgba(60,59,56,0.5)');
    g.addColorStop(1, 'rgba(10,10,12,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(c);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    shrine.add(ground);
  }

  // the light of elysium, beyond the gate
  {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 256, 0, 0);
    g.addColorStop(0, 'rgba(250,247,238,0.62)');
    g.addColorStop(0.45, 'rgba(190,186,175,0.28)');
    g.addColorStop(1, 'rgba(10,10,12,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(c);
    const light = new THREE.Mesh(
      new THREE.PlaneGeometry(6.2, 6.6),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
    );
    light.position.set(0, 2.4, -3.0);
    shrine.add(light);

    const core = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 2.6),
      new THREE.MeshBasicMaterial({
        map: makeDotTexture(),
        color: 0xfffaf0,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    core.position.set(0, 1.5, -2.4);
    shrine.add(core);
  }

  // motes of light
  let motes = null;
  {
    const N = 90;
    const pos = new Float32Array(N * 3);
    let s = 4141;
    const rnd = () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (rnd() - 0.5) * 7;
      pos[i * 3 + 1] = rnd() * 5;
      pos[i * 3 + 2] = -2.8 + rnd() * 5;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    motes = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: 0xf0ece0,
        size: 0.06,
        map: makeDotTexture(),
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      })
    );
    motes.userData = { pos, N };
    shrine.add(motes);
  }

  /* ---------- the gate ---------- */
  const loader = new GLTFLoader(manager);
  const gatePromise = new Promise((res, rej) => loader.load('/models/gate.glb', res, undefined, rej));

  gatePromise
    .then(async (gltf) => {
      applyPaintToScene(gltf.scene, ramp, { contrast: 1.35, rim: 0.3, shadowLift: 0.34, rimLight: 0.4 });
      const gate = gltf.scene;

      // normalize: width on X, grounded, sized to the light
      gate.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(gate);
      const size = new THREE.Vector3();
      box.getSize(size);
      if (size.z > size.x) gate.rotation.y = Math.PI / 2;
      const box2 = new THREE.Box3().setFromObject(gate);
      const h = box2.max.y - box2.min.y;
      const s = 3.4 / h;
      gate.scale.setScalar(s);
      const box3 = new THREE.Box3().setFromObject(gate);
      const c = new THREE.Vector3();
      box3.getCenter(c);
      gate.position.x -= c.x;
      gate.position.z -= c.z;
      gate.position.y -= box3.min.y;
      shrine.add(gate);

      // engrave elysiaa on the lintel
      const engraving = await makeEngravingTexture();
      const box4 = new THREE.Box3().setFromObject(gate);
      const lintelY = box4.max.y * 0.87;
      const frontZ = box4.max.z;
      const plate = new THREE.Mesh(
        new THREE.PlaneGeometry(2.35, 0.44),
        new THREE.MeshBasicMaterial({
          map: engraving,
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      );
      plate.position.set(0, lintelY, frontZ + 0.03);
      shrine.add(plate);
    })
    .catch((e) => console.warn('[elysiaa] gate failed to load', e));

  /* ---------- portal disc (in the main scene) ---------- */
  const RT_SIZE = 1024;
  const rt = new THREE.WebGLRenderTarget(RT_SIZE, RT_SIZE, { samples: 0 });

  const discMat = new THREE.ShaderMaterial({
    vertexShader: discVertex,
    fragmentShader: discFragment,
    uniforms: {
      uShrine: { value: rt.texture },
      uOpen: { value: 0 },
      uTime: { value: 0 },
    },
  });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(PORTAL_RADIUS, 64), discMat);
  group.add(disc);

  // a soft glow bleeding out of the threshold onto the guardian
  const bleed = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      map: makeDotTexture(),
      color: 0xf2ede0,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  bleed.scale.set(6.4, 4.4, 1);
  bleed.position.z = 0.05;
  group.add(bleed);


  function update(t, dt, time, renderer) {
    const open = range(t, 0.9, 0.99);

    discMat.uniforms.uOpen.value = open;
    discMat.uniforms.uTime.value = time;
    bleed.material.opacity = open * 0.16;

    // render the shrine into the portal while it matters
    if (t > 0.8) {
      shrineCam.position.x = Math.sin(time * 0.09) * 0.4;
      shrineCam.position.y = 1.68 + Math.sin(time * 0.12) * 0.08;
      shrineCam.lookAt(0, 1.5, 0);

      if (motes) {
        const arr = motes.userData.pos;
        for (let i = 0; i < arr.length; i += 3) {
          arr[i + 1] += dt * 0.12;
          if (arr[i + 1] > 5) arr[i + 1] = 0;
        }
        motes.geometry.attributes.position.needsUpdate = true;
      }

      const prevTarget = renderer.getRenderTarget();
      renderer.setRenderTarget(rt);
      renderer.render(shrine, shrineCam);
      renderer.setRenderTarget(prevTarget);
    }
    return { open };
  }

  return { group, update, discMat };
}