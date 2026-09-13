import * as THREE from 'three';
import { makeDotTexture } from '../core/glutils.js';

/** Pale dust rising through the air, plus low mist banks. */
export function createAtmosphere() {
  const group = new THREE.Group();

  /* ---------- dust ---------- */
  const N = 110;
  const pos = new Float32Array(N * 3);
  const speed = new Float32Array(N);
  const phase = new Float32Array(N);

  let seed = 90210;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let i = 0; i < N; i++) {
    pos[i * 3] = (rnd() - 0.5) * 14;
    pos[i * 3 + 1] = -2 + rnd() * 4.6;
    pos[i * 3 + 2] = -7 + rnd() * 10;
    speed[i] = 0.05 + rnd() * 0.14;
    phase[i] = rnd() * Math.PI * 2;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

  const embers = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      color: 0xe9dfcd,
      size: 0.022,
      map: makeDotTexture(),
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
      toneMapped: false,
    })
  );
  embers.userData = { pos, speed, phase };
  group.add(embers);

  /* ---------- mist banks ---------- */
  const mistTex = makeDotTexture();
  const mist = [];
  for (let i = 0; i < 3; i++) {
    const mat = new THREE.MeshBasicMaterial({
      map: mistTex,
      color: 0xd9cdb8,
      transparent: true,
      opacity: [0.045, 0.06, 0.04][i],
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(30, 8), mat);
    plane.position.set((i - 1) * 3, -2.1 + i * 0.2, -8 + i * 5);
    plane.userData.baseX = plane.position.x;
    plane.userData.phase = i * 2.1;
    mist.push(plane);
    group.add(plane);
  }

  function update(_t, dt, time) {
    const { pos: arr, speed: sp, phase: ph } = embers.userData;
    for (let i = 0; i < N; i++) {
      const i3 = i * 3;
      arr[i3 + 1] += dt * sp[i];
      arr[i3] += Math.sin(time * 0.3 + ph[i]) * dt * 0.06;
      if (arr[i3 + 1] > 2.6) {
        arr[i3 + 1] = -2.2;
        arr[i3] = (rnd() - 0.5) * 14;
      }
    }
    embers.geometry.attributes.position.needsUpdate = true;

    for (const plane of mist) {
      plane.position.x = plane.userData.baseX + Math.sin(time * 0.05 + plane.userData.phase) * 1.8;
    }
  }

  return { group, update };
}
