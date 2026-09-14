import * as THREE from 'three';
import pointer from '../core/pointer.js';

/** soft painted-warm glow helper */
function glow(ctx, x, y, r, color) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color.replace('ALPHA', '0.55'));
  g.addColorStop(0.45, color.replace('ALPHA', '0.18'));
  g.addColorStop(1, color.replace('ALPHA', '0'));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** The citadel on the horizon — silhouette with backlight, towers and a waterfall. */
function makeCastleTexture() {
  const W = 1024;
  const H = 640;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');

  glow(ctx, 540, 360, 300, 'rgba(247,217,160,ALPHA)');

  // cliff mass
  ctx.fillStyle = '#0c141b';
  ctx.beginPath();
  ctx.moveTo(40, H);
  ctx.lineTo(120, 560);
  ctx.lineTo(230, 500);
  ctx.lineTo(320, 445);
  ctx.lineTo(420, 428);
  ctx.lineTo(520, 432);
  ctx.lineTo(620, 420);
  ctx.lineTo(720, 428);
  ctx.lineTo(820, 440);
  ctx.lineTo(900, 505);
  ctx.lineTo(980, H);
  ctx.closePath();
  ctx.fill();

  // sun-side rim on the cliff
  ctx.strokeStyle = 'rgba(224,164,94,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(320, 445);
  ctx.lineTo(420, 428);
  ctx.lineTo(520, 432);
  ctx.lineTo(620, 420);
  ctx.lineTo(720, 428);
  ctx.lineTo(820, 440);
  ctx.stroke();

  // far towers on the left shoulder
  const farTowers = [
    { x: 250, top: 430, w: 18 },
    { x: 300, top: 400, w: 22 },
  ];
  for (const t of farTowers) {
    ctx.fillStyle = '#0d151c';
    ctx.fillRect(t.x, t.top, t.w, 460 - t.top);
    ctx.beginPath();
    ctx.moveTo(t.x - 3, t.top);
    ctx.lineTo(t.x + t.w / 2, t.top - 28);
    ctx.lineTo(t.x + t.w + 3, t.top);
    ctx.closePath();
    ctx.fill();
  }

  // main towers
  const towers = [
    { x: 470, top: 300, w: 34 },
    { x: 540, top: 250, w: 42 },
    { x: 620, top: 285, w: 34 },
    { x: 690, top: 330, w: 26 },
  ];

  for (const t of towers) {
    ctx.fillStyle = '#0d151c';
    ctx.fillRect(t.x, t.top, t.w, 428 - t.top);

    // lit right edge
    ctx.fillStyle = 'rgba(224,164,94,0.3)';
    ctx.fillRect(t.x + t.w - 2, t.top, 2, 428 - t.top);

    // spire
    ctx.fillStyle = '#0d151c';
    ctx.beginPath();
    ctx.moveTo(t.x - 4, t.top);
    ctx.lineTo(t.x + t.w / 2, t.top - 42);
    ctx.lineTo(t.x + t.w + 4, t.top);
    ctx.closePath();
    ctx.fill();

    // windows
    for (let i = 0; i < 3; i++) {
      const wy = t.top + 34 + i * 38;
      const wx = t.x + t.w * 0.4;
      ctx.fillStyle = 'rgba(247,217,160,0.8)';
      ctx.shadowColor = 'rgba(247,217,160,0.8)';
      ctx.shadowBlur = 6;
      ctx.fillRect(wx, wy, 3, 5);
      ctx.shadowBlur = 0;
    }
  }

  // gate arch
  ctx.fillStyle = '#f7d9a0';
  ctx.beginPath();
  ctx.arc(556, 396, 9, Math.PI, 0);
  ctx.rect(547, 396, 18, 32);
  ctx.fill();
  ctx.shadowColor = 'rgba(247,217,160,1)';
  ctx.shadowBlur = 16;
  ctx.fill();
  ctx.shadowBlur = 0;

  // waterfall from the plateau's right edge
  const wf = ctx.createLinearGradient(0, 430, 0, H);
  wf.addColorStop(0, 'rgba(235,242,248,0.7)');
  wf.addColorStop(0.7, 'rgba(210,225,235,0.3)');
  wf.addColorStop(1, 'rgba(210,225,235,0)');
  ctx.fillStyle = wf;
  ctx.fillRect(812, 442, 10, H - 442);
  ctx.fillStyle = 'rgba(255,250,240,0.45)';
  ctx.fillRect(814, 442, 3, H - 442);
  glow(ctx, 817, H - 30, 90, 'rgba(220,232,240,ALPHA)');

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A floating rock island with a lit grass-capped top. */
function makeIslandTexture(seed = 1) {
  const W = 640;
  const H = 420;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');

  let s = seed * 7919 + 13;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };

  const top = 120;
  const pts = [];
  const n = 9;
  for (let i = 0; i <= n; i++) {
    pts.push([40 + (i * (W - 80)) / n, top + (rnd() - 0.5) * 26]);
  }

  ctx.fillStyle = '#0c141b';
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (const [x, y] of pts) ctx.lineTo(x, y);
  ctx.lineTo(W - 120, 300);
  ctx.lineTo(W / 2 + 40, 400);
  ctx.lineTo(W / 2 - 60, 330);
  ctx.lineTo(140, 360);
  ctx.lineTo(60, 260);
  ctx.closePath();
  ctx.fill();

  // warm rim along the top
  ctx.strokeStyle = 'rgba(224,164,94,0.45)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (const [x, y] of pts) ctx.lineTo(x, y);
  ctx.stroke();

  // detached stones
  for (let i = 0; i < 4; i++) {
    const x = 180 + rnd() * 280;
    const y = 350 + rnd() * 50;
    const r = 4 + rnd() * 9;
    ctx.fillStyle = '#0c141b';
    ctx.beginPath();
    ctx.moveTo(x - r, y);
    ctx.lineTo(x + r * 0.7, y - r * 0.5);
    ctx.lineTo(x + r, y + r * 0.8);
    ctx.closePath();
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Almost-black foreground rocks that frame the composition. */
function makeRocksTexture(seed = 3) {
  const W = 900;
  const H = 420;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');

  let s = seed * 104729 + 7;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };

  const pts = [[0, H]];
  const n = 10;
  for (let i = 0; i <= n; i++) {
    pts.push([(i * W) / n, 160 + rnd() * 190]);
  }
  pts.push([W, H]);

  ctx.fillStyle = '#070b0f';
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (const [x, y] of pts) ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(224,164,94,0.22)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pts[1][0], pts[1][1]);
  for (let i = 1; i < pts.length - 1; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function fitWidth(mesh) {
  const img = mesh.material.map && mesh.material.map.image;
  if (!img) return;
  const scaleY = mesh.userData.cfg.w / (img.width / img.height);
  mesh.userData.baseScale = { x: mesh.userData.cfg.w, y: scaleY };
  mesh.scale.set(mesh.userData.cfg.w, scaleY, 1);
}

function makeLayer(fallback, cfg) {
  const mat = new THREE.MeshBasicMaterial({
    map: fallback,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    color: new THREE.Color().setScalar(cfg.dim ?? 0.85),
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  mesh.position.set(cfg.x, cfg.y, cfg.z);
  mesh.userData.cfg = cfg;
  mesh.userData.baseY = cfg.y;
  mesh.userData.phase = (cfg.x * 13.7) % (Math.PI * 2);
  fitWidth(mesh);
  return mesh;
}

export function createPlates({ manager }) {
  const group = new THREE.Group();
  const smooth = new THREE.Vector2();

  const layers = [
    makeLayer(makeCastleTexture(), {
      x: 10.2, y: 2.3, z: -21, w: 8.7, parallax: 0.1, brighten: true, dim: 0.98,
    }),
    makeLayer(makeIslandTexture(1), {
      x: -6.2, y: 3.4, z: -16, w: 5.0, parallax: 0.16, bob: 0.06, dim: 0.95,
    }),
    makeLayer(makeIslandTexture(2), {
      x: -1.6, y: 4.6, z: -20, w: 3.6, parallax: 0.12, bob: 0.05, dim: 0.92,
    }),
    makeLayer(makeIslandTexture(5), {
      x: 4.6, y: 2.6, z: -22, w: 1.2, parallax: 0.1, bob: 0.04, dim: 0.92,
    }),
    makeLayer(makeRocksTexture(3), {
      x: -4.8, y: -2.6, z: 0.9, w: 11, parallax: -0.55, dim: 1,
    }),
    makeLayer(makeRocksTexture(5), {
      x: 5.6, y: -2.4, z: 1.0, w: 4.7, parallax: -0.65, dim: 1,
    }),
  ];

  const loader = new THREE.TextureLoader(manager);

  const urls = [
    '/plates/castle.png',
    '/plates/islands.png',
    '/plates/islands-2.png',
    '/plates/islands-3.png',
    '/plates/rocks.png',
    '/plates/rocks-2.png',
  ];

  layers.forEach((mesh, i) => {
    group.add(mesh);
    loader.load(
      urls[i],
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        mesh.material.map = tex;
        mesh.material.needsUpdate = true;
        fitWidth(mesh);
      },
      undefined,
      () => {}
    );
  });

  function update(t, dt, time) {
    smooth.x += (pointer.x - smooth.x) * Math.min(1, dt * 1.5);
    smooth.y += (pointer.y - smooth.y) * Math.min(1, dt * 1.5);

    for (const mesh of layers) {
      const cfg = mesh.userData.cfg;
      mesh.position.x = cfg.x + smooth.x * cfg.parallax;
      if (cfg.bob) {
        mesh.position.y =
          mesh.userData.baseY + Math.sin(time * 0.35 + mesh.userData.phase) * cfg.bob;
      }
      if (cfg.brighten && mesh.userData.baseScale) {
        // the citadel draws closer and burns brighter near the end of the journey
        const near = t * t;
        mesh.position.z = cfg.z + near * 4.2;
        const b = mesh.userData.baseScale;
        mesh.scale.set(b.x * (1 + near * 0.25), b.y * (1 + near * 0.25), 1);
        mesh.material.color.setScalar(0.72 + near * 0.5);
        mesh.material.opacity = 0.85 + near * 0.15;
      }
    }
  }

  return { group, update };
}
