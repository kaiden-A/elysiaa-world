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
 *
 * The cloak (mid) and hair (front) planes are subdivided and rippled with a
 * luma-weighted travelling wave — the paint that is bright and opaque moves,
 * the feathered silhouette and the spear hold still. `time` is already frozen
 * to 0 under prefers-reduced-motion, so the cloth freezes with everything else.
 */
export function createWanderer({ manager }) {
  const group = new THREE.Group();
  const pivot = new THREE.Group();
  group.add(pivot);

  const BASE = new THREE.Vector3(0.6, -0.25, -1.1);
  const CAM = new THREE.Vector3(0, 0.05, 6.2);
  const HEIGHT = 5.0;
  const AR = 877 / 2032;

  /* depth offset, pointer response (world units), and cloth/hair wave config */
  const LAYERS = [
    { file: '/plates/wanderer-back.png', dz: -0.06, kx: 0.05, ky: 0.02 },
    { file: '/plates/wanderer-mid.png', dz: 0.0, kx: 0.085, ky: 0.035, wave: { kind: 'cloth', seg: [32, 64] } },
    { file: '/plates/wanderer-front.png', dz: 0.06, kx: 0.12, ky: 0.05, wave: { kind: 'hair', seg: [32, 64] } },
  ];
  const KX_MAX = LAYERS[LAYERS.length - 1].kx;
  const KY_MAX = LAYERS[LAYERS.length - 1].ky;

  /**
   * Vertex ripple for a subdivided plane. Weights come from the painted layer
   * itself (both detail passes are faint overlays): alpha modulated by luma,
   * so soft silhouette edges and dark haze stay put (no swim) while bright
   * folds carry the motion. In-plane x/y displacement is used because the
   * pipeline is unlit — z alone would not be visible; amplitudes are a couple
   * of screen pixels at hero distance.
   */
  function makeWave(mesh, kind, segX, segY) {
    const geo = mesh.geometry;
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    const base = new Float32Array(pos.array);
    const weights = new Float32Array(pos.count);
    let ready = false;

    function onTexture(tex) {
      const c = document.createElement('canvas');
      c.width = segX + 1;
      c.height = segY + 1;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(tex.image, 0, 0, c.width, c.height);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      for (let i = 0; i < pos.count; i++) {
        const u = uv.getX(i);
        const v = uv.getY(i);
        const px = Math.min(segX, Math.max(0, Math.round(u * segX)));
        const py = Math.min(segY, Math.max(0, Math.round((1 - v) * segY)));
        const o = (py * (segX + 1) + px) * 4;
        const alpha = d[o + 3] / 255;
        const luma = (0.299 * d[o] + 0.587 * d[o + 1] + 0.114 * d[o + 2]) / 255;
        let w;
        if (kind === 'hair') {
          w = Math.min(1, alpha * 2.6) * THREE.MathUtils.smoothstep(v, 0.62, 0.85);
        } else {
          w = alpha * (0.3 + 0.7 * luma);
        }
        weights[i] = w;
      }
      ready = true;
    }

    function update(time) {
      if (!ready) return;
      const arr = pos.array;
      const ax = 1 / mesh.scale.x;
      const ay = 1 / mesh.scale.y;
      const A = kind === 'cloth' ? 0.014 : 0.016;
      for (let i = 0; i < pos.count; i++) {
        const w = weights[i];
        if (w < 0.004) {
          arr[i * 3] = base[i * 3];
          arr[i * 3 + 1] = base[i * 3 + 1];
          continue;
        }
        const u = uv.getX(i);
        const v = uv.getY(i);
        let dx;
        let dy;
        if (kind === 'cloth') {
          dx = A * w * Math.sin(u * 4.2 + v * 1.8 + time * 0.75);
          dy = A * 0.45 * w * Math.sin(v * 3.6 - time * 0.6 + 1.7);
        } else {
          dx = A * w * Math.sin(time * 0.45 + v * 2.6);
          dy = A * 0.3 * w * Math.sin(time * 0.4 + 2.1);
        }
        arr[i * 3] = base[i * 3] + dx * ax;
        arr[i * 3 + 1] = base[i * 3 + 1] + dy * ay;
      }
      pos.needsUpdate = true;
    }

    return { onTexture, update };
  }

  const meshes = [];
  const offsets = [];
  const waves = [];

  for (const cfg of LAYERS) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xfff4e4,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      opacity: 0,
    });
    const geo = cfg.wave
      ? new THREE.PlaneGeometry(1, 1, cfg.wave.seg[0], cfg.wave.seg[1])
      : new THREE.PlaneGeometry(1, 1);
    const mesh = new THREE.Mesh(geo, mat);
    const wave = cfg.wave ? makeWave(mesh, cfg.wave.kind, cfg.wave.seg[0], cfg.wave.seg[1]) : null;

    /* keep every plane on the exact projected footprint of the base plate */
    const z = BASE.z + cfg.dz;
    const k = (CAM.z - z) / (CAM.z - BASE.z);
    const local = BASE.clone().sub(CAM).multiplyScalar(k - 1);
    mesh.position.set(local.x, local.y, cfg.dz);
    mesh.scale.set(HEIGHT * AR * k, HEIGHT * k, 1);
    offsets.push(new THREE.Vector2(local.x, local.y));
    meshes.push(mesh);
    waves.push(wave);
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
        if (wave) wave.onTexture(tex);
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

  /*
   * Tier B: a baked cloth-sim pass of the cloak (alpha WebM) replaces the mid
   * still wherever alpha video decodes for real. The video element is attached
   * to a 2x2px in-DOM holder — Chrome suspends frame delivery for detached
   * media, which leaves the WebGL texture frozen on its last frame. Safari,
   * save-data, reduced-motion and anything whose decoder drops the alpha keep
   * the layered still + Tier A. `?cloak=video|still` forces either path and
   * `window.__cloak.stat()` reports what happened.
   */
  const ua = navigator.userAgent;
  const webkitOnly = /Safari/.test(ua) && !/Chrome|Chromium|CriOS|Edg|Firefox|FxiOS/.test(ua);
  const saveData = !!(navigator.connection && navigator.connection.saveData);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cloakParam = new URLSearchParams(window.location.search).get('cloak');

  const videoMat = new THREE.MeshBasicMaterial({
    color: 0xfff4e4,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    opacity: 0,
  });
  const videoMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), videoMat);
  videoMesh.visible = false;
  pivot.add(videoMesh);

  const debug = (window.__cloak = {
    webkitOnly,
    saveData,
    reduced,
    state: 'off',
    video: null,
    stat() {
      const v = this.video;
      if (!v) return { state: this.state, inDom: false };
      const q = v.getVideoPlaybackQuality ? v.getVideoPlaybackQuality() : {};
      return {
        state: this.state,
        inDom: document.body.contains(v),
        paused: v.paused,
        readyState: v.readyState,
        currentTime: +v.currentTime.toFixed(2),
        totalFrames: q.totalVideoFrames ?? -1,
        droppedFrames: q.droppedVideoFrames ?? -1,
      };
    },
  });

  let videoFade = 0;
  const wantVideo = cloakParam === 'video' || (cloakParam !== 'still' && !webkitOnly && !saveData && !reduced);
  if (wantVideo) {
    const holder = document.createElement('div');
    holder.setAttribute('aria-hidden', 'true');
    holder.style.cssText =
      'position:fixed;left:0;bottom:0;width:2px;height:2px;opacity:0.01;overflow:hidden;pointer-events:none';
    const video = document.createElement('video');
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.autoplay = true;
    video.playsInline = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('disablepictureinpicture', '');
    video.preload = 'auto';
    video.style.cssText = 'width:2px;height:2px';
    video.src = '/plates/wanderer-cloak.webm';
    holder.appendChild(video);
    (document.body || document.documentElement).appendChild(holder);
    debug.video = video;
    debug.state = 'loading';

    let tries = 0;
    const giveUp = (state) => {
      debug.state = state;
      video.removeAttribute('src');
      video.load();
      holder.remove();
      debug.video = null;
    };
    const activate = () => {
      /* decode one real frame: confirms frames flow and the alpha survived */
      const c = document.createElement('canvas');
      c.width = video.videoWidth;
      c.height = video.videoHeight;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(video, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let semi = 0;
      let painted = 0;
      for (let i = 3; i < d.length; i += 4) {
        const a = d[i];
        if (a > 0) {
          painted++;
          if (a < 250) semi++;
        }
      }
      if (painted < 256) {
        if (++tries < 8) window.setTimeout(attempt, 250);
        else giveUp('no-frames');
        return;
      }
      if (semi < 64) {
        giveUp('alpha-unsupported');
        return;
      }
      const tex = new THREE.VideoTexture(video);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      videoMat.map = tex;
      videoMat.needsUpdate = true;
      videoMesh.visible = true;
      debug.state = 'playing';
      video.play().catch(() => {
        debug.state = 'play-blocked';
      });
    };
    const attempt = () => {
      if (debug.state === 'playing' || debug.state === 'alpha-unsupported') return;
      if (video.readyState >= 2 && video.videoWidth) activate();
      else if (++tries < 8) window.setTimeout(attempt, 250);
      else giveUp('no-data');
    };
    video.addEventListener('loadeddata', attempt);
    video.addEventListener('canplay', attempt);
    video.addEventListener('error', () => giveUp('error'));
    video.addEventListener('pause', () => {
      if (!videoMesh.visible) return;
      window.setTimeout(() => {
        if (video.paused && videoMesh.visible) {
          video.play().catch(() => {
            debug.state = 'play-blocked';
          });
        }
      }, 400);
    });
    const kick = () => {
      document.removeEventListener('pointerdown', kick);
      document.removeEventListener('touchstart', kick);
      if (video.paused) {
        video.play().then(() => {
          if (debug.state === 'play-blocked') debug.state = 'playing';
        }, () => {});
      }
    };
    document.addEventListener('pointerdown', kick);
    document.addEventListener('touchstart', kick);
  } else {
    debug.state = cloakParam === 'still'
      ? 'forced-still'
      : reduced ? 'reduced-motion' : saveData ? 'save-data' : webkitOnly ? 'webkit' : 'off';
  }

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
    if (videoMesh.visible) videoFade = Math.min(1, videoFade + dt * 1.6);
    const stillFade = 1 - videoFade;
    for (let i = 0; i < meshes.length; i++) {
      const m = meshes[i];
      m.position.x = offsets[i].x + smooth.x * (LAYERS[i].kx - KX_MAX);
      m.position.y = offsets[i].y - smooth.y * (LAYERS[i].ky - KY_MAX);
      m.material.opacity = vis * (i === 1 ? stillFade : 1);
      if (waves[i] && (i !== 1 || stillFade > 0.02)) waves[i].update(time);
    }
    if (videoMesh.visible) {
      videoMesh.position.copy(meshes[1].position);
      videoMesh.scale.copy(meshes[1].scale);
      videoMesh.material.opacity = vis * videoFade;
    }

    backlight.position.x = pivot.position.x;
    backlight.position.z = pivot.position.z - 0.7;
    backlightMat.opacity = (0.3 + Math.sin(time * 0.4) * 0.04) * (1 - out);
  }

  return { group, update };
}
