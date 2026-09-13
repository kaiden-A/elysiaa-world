# Blender asset plan — Elysiaa world

Work order for a fresh agent session. Read this file first, then run Phase 0.
Do not skip the phase gates: each phase ends with an acceptance check, and the
user is shown results before the next phase starts.

## How to use this file

1. Read this whole file.
2. Run Phase 0 (MCP smoke test) before touching any asset.
3. Work phases 1-4 in order. Phase 3 can run in parallel with 2 if the user wants.
4. Keep the style guardrails at all times.
5. Report per-phase with screenshots, then wait for user feedback.

Repo: `C:\Users\Kaiden-A\experiments\elysiaa-world`
Temp/work dir: `C:\Users\Kaiden-A\AppData\Local\Temp\opencode`
Shell: Windows PowerShell 5.1. No ImageMagick/ffmpeg/PIL — image ops use
PowerShell + `Add-Type` C# (GDI+). Watch the negative-stride bug in LockBits:
`row = stride > 0 ? y : (h - 1 - y)`.

## User decisions (locked)

- **Stay painterly, no lit 3D.** No lights, no env maps, no PBR, no re-style.
  Everything stays unlit plates / fake-glass shaders / camera-projection.
- **Safari must have parity.** Any animation/enhancement needs a Safari-safe
  path (layered stills + procedural motion). Alpha WebM is enhancement only.
- **Parallax is subtle** (~1-2% screen shift). Bigger shifts reveal missing
  painted data behind layers.
- Requested scope: wanderer parallax layers, real 3D mirror shards, wanderer
  motion. (GLB rescue/delete is separate and still pending user word.)

## Ground truth (verified 2026-09-13)

- Stack: three ^0.170.0 + vite ^6. `npm run dev|build|preview`. No other deps.
- **Everything is unlit 2D planes + custom shaders.** No lights, no env, no
  `GLTFLoader` anywhere in `src/`. Renderer clear color `0x0a0f14`.
- Hero camera: `CAM_POS` / `CAM_LOOK` at `src/scene/world.js:11-23`. At t=0:
  pos `(0, 0.05, 6.2)`, look `(0.12, 0.06, 0)`, fov 45. Wanderer plane sits
  at `z = -1.1` → distance 7.3, visible height ≈ 6.05 world units.
- Wanderer (`src/scene/wanderer.js`): single flat PNG plane
  `public/plates/wanderer.png` 585×1355, `MeshBasicMaterial` color `0xfff4e4`,
  scale `(5.0*ar, 5.0)`, pos `(0.6, -0.25, -1.1)`; additive backlight
  `0xffe8c2` opacity `0.3 + sin*0.04`, scale `(3.2, 4.4, 1)` at z offset -0.7;
  update fades `out = range(t, 0.18, 0.6)`, drifts `z -  out*2.4`, opacity
  `min(1, 1.12*(1-out))`. Pointer drift `smooth.x*0.12`, bob ±0.025.
- Plate bake recipe (PowerShell GDI+): crop `(175,140,585,1355)` from
  `ChatGPT Image Sep 13, 2026, 11_16_23 AM.png` (repo root; the wanderer art
  sheet). Mask: radial ellipse feather 110, cx 0.47, cy 0.50, rx 0.44,
  ry 0.52, floor 0.02. Final bake gain 1.3, alpha = mask only (solid).
  Source sheet's own alpha is mottled (mean 222) — do NOT multiply it in.
  Bake scripts `assets3.ps1`/`assets4.ps1` may still be in the temp dir.
- Shards (`src/scene/shard-composition.js`): flat `ShapeGeometry` from a seeded
  `jagged(w,h,rnd,jag)` (seed 778899, line ~92), 9-item LAYOUT (lines 100-110),
  fake-glass ShaderMaterial (rim from view-normal, UV edge outline, sin glints,
  `uGlint` flash at out≈0.22). Transparency: `depthWrite:false`, DoubleSide,
  no renderOrder set. Motion: `out = range(t, 0.5+delay*0.3, 1)` drifts along
  `dir*out` (+z 4.6), scale `*(1+out*0.7)`, alpha `1-out*0.85`.
- Fragments: `public/fragments/*.jpg` (face, cloak, hand, spear, castle,
  mirrors, ground), with aspect ratios at `src/scene/world.js:26-34`.
- Unused models: `public/models/knight.glb` 8.9MB, `spear.glb` 9.5MB,
  `gate.glb` 1.2MB. Nothing references them (character.js/portal.js deleted).
- Other scene facts: sky plane 140×42 at `(-31.1, 1.27, -30)` mapping the
  painted sun (u=0.775 measured in `sky.jpg`) to world x 7.4 (matches
  `SUN_PLATE`). Adding 2D layers must not alter this.

## Phase 0 — MCP smoke test (do first)

- Config already present: `~/.config/opencode/opencode.jsonc` defines
  `mcp.blender-mcp` (`uvx blender-mcp`, `BLENDER_HOST=localhost`,
  `BLENDER_PORT=9876`). Blender 5.2 was running with the addon socket live on
  `127.0.0.1:9876` at planning time.
- The fresh session should now see blender-mcp tools. Tool names depend on the
  server version; typical set: scene info, object info, `execute_blender_code`,
  viewport screenshot. Use whatever appears.
- Smoke test:
  1. get scene info
  2. `execute_blender_code`: print `bpy.app.version_string` and
     `bpy.context.scene.render.engine`
  3. take a viewport screenshot and confirm bytes come back
  4. transparency/alpha test: render 10 frames of a plane with alpha, then a
     WebM VP9 export attempt; confirm alpha survives muxing
- Blender 5.2 is newer than most blender-mcp releases — a protocol mismatch is
  likely to surface here. If calls fail, options: update the addon/py package,
  pin a compatible pair, or fall back to generating `.py` scripts the user runs
  manually in Blender (Blender's Scripting tab) and sends renders back.
- Do not start asset work until this passes or the fallback is agreed.

## Phase 1 — Reference prep (no Blender strictly needed)

1. Re-bake `wanderer.png` from the sheet at 2× (1170×2710) using the recipe
   above; keep the 1× file for comparison.
2. Author 3 sub-masks as starting material: cloak/haze (lower + outer), body
   (core silhouette), hair+spear (upper + right arm line). Luma + edge-aware
   thresholds first; refine with Blender projection if needed.
3. Calibrate a Blender camera to the hero view exactly: pos `(0, 0.05, 6.2)`,
   look `(0.12, 0.06, 0)`, fov 45 (Blender: `cam.angle = radians(45)` with the
   film fit matched to the web viewport aspect used for comparison).
4. Acceptance: a Blender render of the plate as a textured plane, through the
   calibrated camera, overlays the source crop within a few pixels. Verify with
   a GDI+ difference pass (mean abs diff) on a capture pair.

## Phase 2 — Wanderer parallax layers (user priority #1)

Goal: the hero figure gets real depth at pointer drift without breaking the
painted look.

1. In Blender, build rough relief from the painting using camera projection
   (a.k.a. camera mapping): subdivided cloak billow, body mass, hood/head,
   hair mass, spear shaft. UV-project the plate from the Phase 1 camera.
2. Isolate and render 3 transparent passes (back / mid / front) from that same
   camera, EEVEE, transparent film, no lights needed (use emission/unlit
   shading of the projected image), e.g. 1170×2710.
3. Deliverables: `public/plates/wanderer-back.png`, `-mid.png`, `-front.png`
   (target total ≤ 4MB, run a PNG quantize/optimize pass if over).
4. `src/scene/wanderer.js`: replace the single mesh with 3 stacked planes at
   z offsets (-0.06, 0, +0.06 world), each with pointer offset scaled by its
   depth (front moves most, ≤2% screen). Keep: bob, `out` fade, backlight,
   opacity math. Set explicit `renderOrder` back→front and keep
   `depthWrite:false`.
5. Acceptance:
   - At rest the composite is indistinguishable from the current hero
     (compare screenshots side by side).
   - Pointer-left vs pointer-right probe screenshots show visible depth shift,
     no gaps/tears at layer edges, no popped transparency.
   - 60fps parity within ~10% on the capture machine.
   - Mobile (portrait) capture still composes correctly.

Risk: 2.5D reveals unpainted area behind front layers. Mitigation: subtle
offsets only; the plate's haze/mask already softens edges; if a gap shows,
extend the layer in Blender by projecting from a slightly offset camera.

## Phase 3 — Real 3D mirror shards

Goal: replace flat polygons with beveled meshes, keep the fake-glass look.

1. Dump the seeded outlines: small Node script that imports the same
   `jagged()` math (or re-implements with seed 778899) and writes the polygon
   points per LAYOUT item to JSON.
2. `bpy` script: for each outline, build a face, extrude thickness ≈ 4% of the
   shard size, add a 2-segment bevel, apply slight vertex noise/plane warp so
   each shard is non-flat. Reuse 3-4 unique meshes across the 9 instances.
3. Export `public/models/shards.glb` (plain GLB). Skip Draco/meshopt unless the
   file exceeds ~300KB; if compressed, copy the decoder wasm from
   `node_modules/three/examples/jsm/libs/` into `public/` (no CDN).
4. `src/scene/shard-composition.js`: add `GLTFLoader`, keep the LAYOUT and all
   motion math, keep the ShaderMaterial but upgrade it to use real normals and
   object-space thickness for edge highlights. Optional: sample `sky.jpg` in
   the shader for a tint of real sunset in reflections. Still unlit.
5. Sorting: with real geometry, back faces must draw before front faces;
   either two meshes per shard (BackSide + FrontSide) or `renderOrder` by
   shard depth. Keep `depthWrite:false`. Watch the drift-out (`out→1`) for
   z-pop between overlapping shards.
6. Acceptance: silhouette/positions identical in screenshots; glints move
   with geometry; no z-pop during drift; bundle growth ≤ ~300KB + loader.

## Phase 4 — Wanderer motion (two tiers)

**Tier A — ships everywhere (required).**
- Subdivide the cloak layer plane (~32×64) and displace vertices with a
  luma-weighted travelling wave (amplitude tiny, no silhouette swim).
  Hair layer gets a slow sway; spear stays rigid.
- Freeze all motion under `prefers-reduced-motion` (project already passes
  `time = 0` in `main.js` — confirm it covers this).
- Acceptance: subtle cloth read at hero; no visible mesh faceting; no gap at
  layer seams while waving.

**Tier B — progressive enhancement (Blender).**
- Cloth-sim the cloak relief (pinned at shoulders), render 60-96 frames
  512×1024 transparent in EEVEE, encode VP9-alpha WebM (~2-4MB).
- If Blender's FFmpeg cannot mux VP9 alpha: fall back to a reduced PNG sprite
  atlas (e.g. 48 frames, ~128px tall cells packed to ≤3072², ~2-4MB) or drop
  Tier B. Decide only after the Phase 0 alpha test.
- Integration: `VideoTexture` replaces the front/mid stack only on browsers
  with alpha-video support (not Safari) and not `save-data`/`reduced-motion`;
  Safari and everyone else gets the layered still + Tier A motion.
- Acceptance: seamless loop, no silhouette jitter between video and layers,
  no decode-induced frame drops on the capture machine.

## Phase 5 — Verify & ship (after each phase, and at the end)

Verification harness (in temp dir; recreate if missing — all are small Node
scripts speaking Chrome DevTools Protocol over ws):
- Start: `npx vite preview --port 4173 --strictPort` (hidden process) and
  headless Chrome with `--remote-debugging-port=9222
  --enable-unsafe-swiftshader --user-data-dir=<temp>\chrome-profile`.
- `shot.mjs` — desktop sections → `cdp_*.png`; `shot-wide.mjs 1910 987` — wide
  aspect (the user's window); `shot-mobile.mjs` → `m_*.png`; `probe.mjs
  <exprfile> <outname> [wait] [after]` — CDP eval + screenshot for pointer
  and scene probes.
- **Critical gotcha: `vite preview` serves `dist/` — run `npm run build`
  after every asset bake/code change or captures are stale.**
- Always: `Network.setCacheDisabled` + fresh page load; screenshot at rest;
  check console for errors (scripts already log page errors).
- Sizes to watch: total `public/` payload (currently ≈ 14MB plates+fragments),
  hero LCP texture weight, mobile transfer.

## Style guardrails for the implementing agent

- Do not add lights, environment maps, or PBR; do not swap plates for
  conventional 3D models.
- Do not touch the sky mapping (painted sun pinned to world x 7.4 at z -30) or
  the camera choreography unless the phase requires it.
- Do not commit; the user asks explicitly when ready.
- Keep assets in `public/plates` + `public/models`; keep bake scripts and
  one-off tooling in temp, not the repo (except this plan file).
- If a phase can't meet acceptance after ~2 iterations, stop and report with
  evidence rather than piling on hacks.

## Open items (ask the user, don't assume)

- Whether to delete the unused GLBs (`knight.glb`, `spear.glb`, `gate.glb`).
- Final Labs/Writing copy and the real LinkedIn URL (unrelated to Blender).
