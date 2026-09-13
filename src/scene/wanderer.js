import * as THREE from 'three';
import pointer from '../core/pointer.js';
import { range } from '../core/timeline.js';
import { makeDotTexture } from '../core/glutils.js';

/**
 * The Wanderer — the concept-sheet tableau placed as a three-layer painted
 * stack (back / mid / front) so the figure gains depth under pointer drift.
 *
 * All three planes carry the same painting at slightly different depths; their
 * alphas are authored so that, at rest, the composite is exactly the original
 * plate (the back pass holds the full plate, the mid/front passes hold masked
 * detail). The cursor offset is scaled per layer: the front most, the cloak
 * barely, so the figure reads as volume rather than a flat cutout.
 */
export function createWanderer({ manager }) {
  const group = new THREE.Group();
  const pivot = new THREE.Group();
  group.add(pivot);

  const BASE = new THREE.Vector3(0.6, -0.25, -1.1);
  const CAM = new THREE.Vector3(0, 0.05, 6.2);
  const HEIGHT = 5.0;
  const AR = 877 / 2032;

  /* depth offset + pointer response (world units); front moves most, <=2% screen */
  const LAYERS = [
    { file: '/plates/wanderer-back.png', dz: -0.06, kx: 0.05, ky: 0.02 },
    { file: '/plates/wanderer-mid.png', dz: 0.0, kx: 0.085, ky: 0.035 },
    { file: '/plates/wanderer-front.png', dz: 0.06, kx: 0.12, ky: 0.05 },
  ];
  const KX_MAX = LAYERS[LAYERS.length - 1].kx;
  const KY_MAX = LAYERS[LAYERS.length - 1].ky;

  const meshes = [];
  const offsets = [];

  for (const cfg of LAYERS) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xfff4e4,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      opacity: 0,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);

    /* keep every plane on the exact projected footprint of the base plate */
    const z = BASE.z + cfg.dz;
    const k = (CAM.z - z) / (CAM.z - BASE.z);
    const local = BASE.clone().sub(CAM).multiplyScalar(k - 1);
    mesh.position.set(local.x, local.y, cfg.dz);
    mesh.scale.set(HEIGHT * AR * k, HEIGHT * k, 1);
    offsets.push(new THREE.Vector2(local.x, local.y));
    meshes.push(mesh);
    pivot.add(mesh);

    new THREE.TextureLoader(manager).load(
      cfg.file,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        mat.map = tex;
        mat.opacity = 1;
        mat.needsUpdate = true;
        const aspect = tex.image.width / tex.image.height;
        mesh.scale.set(HEIGHT * aspect * k, HEIGHT * k, 1);
      },
      undefined,
      () => {}
    );
  }

  const backlightMat = new THREE.MeshBasicMaterial({
    map: makeDotTexture(),
    color: 0xffe8c2,
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const backlight = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), backlightMat);
  backlight.position.set(BASE.x, 0.0, BASE.z - 0.9);
  backlight.scale.set(3.2, 4.4, 1);
  group.add(backlight);

  const smooth = new THREE.Vector2();

  function update(t, dt, time) {
    smooth.x += (pointer.x - smooth.x) * Math.min(1, dt * 1.5);
    smooth.y += (pointer.y - smooth.y) * Math.min(1, dt * 1.5);

    const out = range(t, 0.18, 0.6);

    pivot.position.x = BASE.x + smooth.x * KX_MAX - out * 0.4;
    pivot.position.y = BASE.y + Math.sin(time * 0.55) * 0.025 - smooth.y * KY_MAX;
    pivot.position.z = BASE.z - out * 2.4;
    pivot.rotation.y = smooth.x * 0.04;
    pivot.rotation.z = Math.sin(time * 0.3) * 0.004;

    const vis = Math.min(1, 1.12 * (1 - out));
    for (let i = 0; i < meshes.length; i++) {
      const m = meshes[i];
      m.position.x = offsets[i].x + smooth.x * (LAYERS[i].kx - KX_MAX);
      m.position.y = offsets[i].y - smooth.y * (LAYERS[i].ky - KY_MAX);
      m.material.opacity = vis;
    }

    backlight.position.x = pivot.position.x;
    backlight.position.z = pivot.position.z - 0.7;
    backlightMat.opacity = (0.3 + Math.sin(time * 0.4) * 0.04) * (1 - out);
  }

  return { group, update };
}
