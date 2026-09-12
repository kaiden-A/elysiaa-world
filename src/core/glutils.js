import * as THREE from 'three';

/** 256x256 monochrome noise texture (for grain / paper feel) */
export function makeNoiseTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(256, 256);
  const d = img.data;
  let v = 0;
  for (let i = 0; i < d.length; i += 4) {
    v = (Math.random() * 255) | 0;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** 4-stop toon ramp gradient map (charcoal -> ink) */
export function makeToonRamp() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 1;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 64, 0);
  g.addColorStop(0.0, '#101014');
  g.addColorStop(0.34, '#34343c');
  g.addColorStop(0.68, '#9c988e');
  g.addColorStop(1.0, '#f8f5ee');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 1);
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}

/** Desaturate an image into an ink-wash style canvas texture (flipY=false, glTF compatible) */
export function desaturate(image, contrast = 1.25, clampDark = 0.05) {
  const c = document.createElement('canvas');
  c.width = image.width;
  c.height = image.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(image, 0, 0);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    let v = (g - 128) * contrast + 128;
    v = clampDark * 255 + v * (1 - clampDark);
    v = Math.min(255, Math.max(0, v));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.flipY = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Desaturate a loaded THREE.Texture's source image */
export function desaturateTexture(tex, contrast, clampDark) {
  if (!tex || !tex.image) return null;
  return desaturate(tex.image, contrast, clampDark);
}


/** Soft radial dot sprite (dust motes) */
export function makeDotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/** True if WebGL is available */
export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}