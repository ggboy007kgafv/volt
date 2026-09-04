/*
 * AboutExperience — a 360° product viewer for the VOLT can.
 *
 * Clicking "Explore flavors" on the film page glides here. The camera first
 * zooms down from high above the can, then every pixel of scroll drives a
 * full 360° orbit while the camera descends from near the top of the can to
 * slightly below its middle — Active Theory style — with a slow idle spin
 * so the can always feels alive.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import * as THREE from "three";
import "./AboutExperience.css";

const CAN_URL = "/models/volt-can.glb";

const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);
const deg = (d: number) => (d * Math.PI) / 180;

/* ------------------------------------------------------------------ */
/* Can model loading (streamed, with progress + error handling)        */
/* ------------------------------------------------------------------ */

// Normalize size/center and tune materials so the can sits nicely on stage.
function poseCan(scene: THREE.Group) {
  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());
  const scale = 2.75 / Math.max(size.y, 1e-5);
  const midY = box.getCenter(new THREE.Vector3()).y * scale;
  scene.scale.setScalar(scale);
  scene.position.y = -midY;
  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      const mat = mesh.material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[];
      const mats = Array.isArray(mat) ? mat : [mat];
      mats.forEach((m) => {
        if (m && m.isMaterial) {
          m.metalness = Math.min(m.metalness ?? 0, 0.5);
          m.roughness = THREE.MathUtils.clamp(m.roughness ?? 1, 0.15, 0.9);
          m.envMapIntensity = 1.5;
        }
      });
    }
  });
  return scene;
}

// Fetch the GLB ourselves (instead of useLoader/Suspense) so we can report a
// real % while a 42MB file streams in, and surface failures as a Retry state
// rather than silently hanging on "Zooming to the can".
async function loadCan(onPct: (pct: number) => void): Promise<THREE.Group> {
  const res = await fetch(CAN_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const total = Number(res.headers.get("content-length")) || 0;
  let data: ArrayBuffer;
  if (res.body && total > 0) {
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        received += value.length;
        onPct(Math.min(99, Math.round((received / total) * 100)));
      }
    }
    const merged = new Uint8Array(received);
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.length;
    }
    data = merged.buffer;
  } else {
    data = await res.arrayBuffer();
  }
  const gltf = await new Promise<THREE.Group>((resolve, reject) => {
    new GLTFLoader().parse(
      data,
      "",
      (g) => resolve(g.scene),
      (err) => reject(err instanceof Error ? err : new Error(String(err))),
    );
  });
  onPct(100);
  return poseCan(gltf);
}

/* ------------------------------------------------------------------ */
/* The can — idle spin + gentle float so it never looks static        */
/* ------------------------------------------------------------------ */
function CanRig({ model }: { model: THREE.Group | null }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const t = clock.getElapsedTime();
    g.rotation.y = t * 0.05;
    g.rotation.z = Math.sin(t * 0.5) * 0.02;
    g.position.y = Math.sin(t * 0.8) * 0.05;
  });
  return <group ref={ref}>{model ? <primitive object={model} /> : null}</group>;
}

/* ------------------------------------------------------------------ */
/* Camera choreography                                                 */
/* ------------------------------------------------------------------ */
function OrbitCam({ progressRef }: { progressRef: React.RefObject<number> }) {
  const { camera } = useThree();
  const st = useRef({
    intro: 0, // 0..1 — the opening zoom from high above
    az: 0, // azimuth (radians), scroll drives a full 450° sweep
    el: deg(70), // elevation (radians)
    rad: 3.1,
    lookY: 0.1,
  });

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const p = progressRef.current ?? 0;

    // Intro always plays once on mount — a controlled zoom down from the top.
    const introTarget = 1;
    st.current.intro += (introTarget - st.current.intro) * 0.08;
    const k = st.current.intro;

    // Scroll drives azimuth a bit past a full turn (1.25×) so the same
    // scroll distance feels more responsive, while the camera sinks from
    // high above to slightly below mid-can.
    const targetAz = p * Math.PI * 2 * 1.25;
    st.current.az = THREE.MathUtils.damp(st.current.az, targetAz, 6, 0.05);

    const scrollElev = THREE.MathUtils.lerp(deg(46), deg(-8), p);
    const targetEl = THREE.MathUtils.lerp(deg(74), scrollElev, k);
    st.current.el = THREE.MathUtils.damp(st.current.el, targetEl, 6, 0.05);

    // Cinematic orbit — close enough to feel premium, with room for the
    // card helix to sweep around the can.
    const scrollRad = THREE.MathUtils.lerp(5.0, 4.0, p);
    const targetRad = THREE.MathUtils.lerp(2.6, scrollRad, k);
    st.current.rad = THREE.MathUtils.damp(st.current.rad, targetRad, 6, 0.05);

    // Gentle handheld sway
    const sway = Math.sin(t * 0.2) * 0.05;

    const el = st.current.el;
    const az = st.current.az + sway * 0.4;
    const rad = st.current.rad;
    st.current.lookY = 0.1 + Math.sin(p * Math.PI) * 0.15;

    camera.position.set(
      rad * Math.cos(el) * Math.sin(az),
      rad * Math.sin(el),
      rad * Math.cos(el) * Math.cos(az),
    );
    camera.lookAt(0, st.current.lookY, 0);
  });

  return null;
}

/* ------------------------------------------------------------------ */
/* Atmosphere                                                          */
/* ------------------------------------------------------------------ */
function Particles({
  count,
  color,
  size,
  opacity,
  speed,
}: {
  count: number;
  color: string;
  size: number;
  opacity: number;
  speed: number;
}) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const r = 5 + Math.random() * 7;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = (Math.random() - 0.5) * 9;
      arr[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    return arr;
  }, [count]);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.getElapsedTime() * speed;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={size} color={color} transparent opacity={opacity} sizeAttenuation depthWrite={false} />
    </points>
  );
}

/* ------------------------------------------------------------------ */
/* Red hand-drawn annotation marks (designer-markup style)             */
/* ------------------------------------------------------------------ */
type MarkKind = "ellipse" | "bracket" | "squiggle" | "arrow";

interface RedMarkDef {
  kind: MarkKind;
  /** World size of the mark plane (width x height). */
  w: number;
  h: number;
  /** Offset from the can axis toward the camera (keeps the mark just in
   *  front of the can surface at every orbit angle). */
  front: number;
  /** Horizontal offset in the camera's frame (screen left/right). */
  lx: number;
  /** Height above the can center. */
  ly: number;
  /** Idle bob amplitude / speed. */
  bobAmp: number;
  bobSpd: number;
  /** Slow wobble of the plane itself (hand-drawn life). */
  wobble: number;
}

const RED_MARKS: RedMarkDef[] = [
  {
    kind: "ellipse", w: 2.9, h: 1.85, front: 0.03, lx: 0.12, ly: 0.55,
    bobAmp: 0.035, bobSpd: 1.1, wobble: 0.045,
  },
  {
    kind: "bracket", w: 0.85, h: 1.15, front: 0.08, lx: 1.05, ly: 0.12,
    bobAmp: 0.05, bobSpd: 0.8, wobble: 0.05,
  },
  {
    kind: "squiggle", w: 2.75, h: 0.62, front: 0.06, lx: 0.05, ly: -1.08,
    bobAmp: 0.03, bobSpd: 0.95, wobble: 0.035,
  },
  {
    kind: "arrow", w: 1.05, h: 1.05, front: 0.1, lx: -1.1, ly: 0.85,
    bobAmp: 0.05, bobSpd: 0.7, wobble: 0.055,
  },
];

const MARK_PX = 1024;
const RED = "rgba(255, 60, 60, 0.98)";
const RED_GLOW = "rgba(255, 40, 40, 0.6)";

/* Paint a single hand-drawn red mark (wobbly marker strokes) to a
   transparent canvas -> WebGL texture. */
function makeMarkTexture(kind: MarkKind): THREE.CanvasTexture {
  const W = MARK_PX;
  const H = kind === "squiggle" ? 256 : kind === "ellipse" ? 640 : MARK_PX;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d");
  if (ctx) {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = RED_GLOW;
    ctx.shadowBlur = 26;

    const jitter = (amp: number) => (Math.random() - 0.5) * amp;
    const stroke = (width: number, alpha = 1) => {
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = RED;
      ctx.lineWidth = width;
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    if (kind === "ellipse") {
      const cx = W / 2;
      const cy = H / 2;
      const rx = W * 0.44;
      const ry = H * 0.44;
      // hand-drawn ellipse: wobbled samples, drawn twice for a marker feel
      for (let pass = 0; pass < 2; pass += 1) {
        ctx.beginPath();
        const n = 72;
        for (let i = 0; i <= n; i += 1) {
          const a = (i / n) * Math.PI * 2;
          const x = cx + Math.cos(a) * rx + jitter(9);
          const y = cy + Math.sin(a) * ry + jitter(9);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        stroke(pass === 0 ? 15 : 9, pass === 0 ? 0.95 : 0.5);
      }
    } else if (kind === "bracket") {
      // corner bracket: short top bar + vertical side, like [ ] corners
      for (let pass = 0; pass < 2; pass += 1) {
        ctx.beginPath();
        ctx.moveTo(W * 0.22 + jitter(8), H * 0.3 + jitter(8));
        ctx.lineTo(W * 0.72 + jitter(8), H * 0.3 + jitter(8));
        ctx.lineTo(W * 0.72 + jitter(8), H * 0.72 + jitter(8));
        stroke(pass === 0 ? 15 : 9, pass === 0 ? 0.98 : 0.5);
      }
    } else if (kind === "squiggle") {
      const cy = H / 2;
      for (let pass = 0; pass < 2; pass += 1) {
        ctx.beginPath();
        const n = 40;
        for (let i = 0; i <= n; i += 1) {
          const x = (i / n) * W;
          const y = cy + Math.sin((i / n) * Math.PI * 4) * H * 0.22 + jitter(6);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        stroke(pass === 0 ? 14 : 8, pass === 0 ? 0.95 : 0.5);
      }
    } else {
      // arrow: diagonal shaft + head, wobbled
      for (let pass = 0; pass < 2; pass += 1) {
        const x0 = W * 0.2 + jitter(8);
        const y0 = H * 0.78 + jitter(8);
        const x1 = W * 0.72 + jitter(8);
        const y1 = H * 0.3 + jitter(8);
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.lineTo(x1 - 22, y1 + 16);
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 - 16, y1 - 22);
        stroke(pass === 0 ? 15 : 9, pass === 0 ? 0.98 : 0.5);
      }
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  try {
    tex.colorSpace = THREE.SRGBColorSpace;
  } catch {
    /* older three */
  }
  tex.anisotropy = 4;
  return tex;
}

function RedMark({ def, compact }: { def: RedMarkDef; compact: boolean }) {
  const group = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const tex = useMemo(() => makeMarkTexture(def.kind), [def.kind]);
  useEffect(() => () => tex.dispose(), [tex]);

  const scale = compact ? 0.8 : 1;
  const w = def.w * scale;
  const h = def.h * scale;

  useFrame(({ clock }) => {
    const g = group.current;
    if (!g || !camera) return;
    const t = clock.getElapsedTime();
    // Anchor the mark in the camera's frame so it always sits just in
    // front of the can, like a designer's red markup on the product.
    const camAz = Math.atan2(camera.position.x, camera.position.z);
    const forwardX = Math.sin(camAz);
    const forwardZ = Math.cos(camAz);
    const rightX = Math.cos(camAz);
    const rightZ = -Math.sin(camAz);
    const bob = Math.sin(t * def.bobSpd + def.lx * 3) * def.bobAmp * scale;
    const x = forwardX * def.front + rightX * def.lx;
    const z = forwardZ * def.front + rightZ * def.lx;
    g.position.set(x, def.ly * scale + bob, z);
    g.lookAt(camera.position);
    // gentle wobble so the stroke feels hand-drawn
    g.rotation.z = Math.sin(t * 0.7 + def.ly) * def.wobble;
  });

  return (
    <group ref={group} position={[0, def.ly, 0]}>
      <mesh>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={tex} transparent side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

function RedMarks({ compact }: { compact: boolean }) {
  return (
    <group>
      {RED_MARKS.map((def, i) => (
        <RedMark key={`${def.kind}-${i}`} def={def} compact={compact} />
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Four large glass cards on a scroll-driven helix around the can      */
/* ------------------------------------------------------------------ */
interface CardDef {
  idx: string;
  tag: string;
  title: string;
  body: string;
  /** Base helix angle offset (radians). */
  offset: number;
  /** Distance from the can axis. */
  radius: number;
  /** Vertical start above the can center. */
  yBase: number;
  /** Vertical travel across the full scroll (the helix rises/falls). */
  yRise: number;
  /** Helix revolutions per full scroll (slower than the camera's 1.25). */
  spin: number;
  /** Static screen tilt for composition. */
  tilt: number;
  /** Idle bob / wobble. */
  bobAmp: number;
}

const CARDS: CardDef[] = [
  {
    idx: "01", tag: "PURE ENERGY",
    title: "Clean energy. Maximum momentum.",
    body: "A new generation of energy designed for people who never stop moving.",
    offset: 0.25, radius: 2.45, yBase: 1.5, yRise: -2.4, spin: 0.5, tilt: -0.05, bobAmp: 0.05,
  },
  {
    idx: "02", tag: "BOLD FLAVOR",
    title: "Every sip hits different.",
    body: "Powerful flavors designed to stand out.",
    offset: 1.9, radius: 2.15, yBase: 0.6, yRise: -0.9, spin: 0.62, tilt: 0.04, bobAmp: 0.06,
  },
  {
    idx: "03", tag: "ZERO LIMITS",
    title: "FOR GAMERS. CREATORS. ATHLETES. DREAMERS.",
    body: "Energy without limits.",
    offset: 3.4, radius: 2.3, yBase: -0.6, yRise: 1.5, spin: 0.55, tilt: -0.04, bobAmp: 0.05,
  },
  {
    idx: "04", tag: "VOLT DIFFERENCE",
    title: "MORE THAN ENERGY.",
    body: "A completely new experience built for the next generation.",
    offset: 5.0, radius: 2.6, yBase: -1.55, yRise: 2.5, spin: 0.68, tilt: 0.06, bobAmp: 0.07,
  },
];

const CARD_PX_W = 1024;
const CARD_PX_H = 640;

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/* Paint one premium glass card (dark translucent, thin border, soft
   purple/green glow) to an offscreen canvas -> WebGL texture. */
function makeCardTexture(def: CardDef): THREE.CanvasTexture {
  const W = CARD_PX_W;
  const H = CARD_PX_H;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d");
  if (ctx) {
    const R = 92;
    const pad = 72;

    // glass body
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "rgba(22, 18, 34, 0.6)");
    g.addColorStop(0.5, "rgba(10, 14, 10, 0.62)");
    g.addColorStop(1, "rgba(4, 8, 5, 0.74)");
    roundRectPath(ctx, 0, 0, W, H, R);
    ctx.fillStyle = g;
    ctx.fill();

    // sheen + speckle noise
    ctx.save();
    roundRectPath(ctx, 0, 0, W, H, R);
    ctx.clip();
    const sheen = ctx.createLinearGradient(0, 0, W * 0.7, H);
    sheen.addColorStop(0, "rgba(200, 170, 255, 0.05)");
    sheen.addColorStop(0.35, "rgba(200, 170, 255, 0)");
    sheen.addColorStop(1, "rgba(120, 255, 178, 0.035)");
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 150; i += 1) {
      ctx.fillStyle = `rgba(${150 + Math.random() * 80}, ${220 + Math.random() * 35}, ${180 + Math.random() * 75}, ${0.02 + Math.random() * 0.04})`;
      const s = 1 + Math.random() * 2;
      ctx.fillRect(Math.random() * W, Math.random() * H, s, s);
    }
    ctx.restore();

    // thin border + soft glow
    roundRectPath(ctx, 2.5, 2.5, W - 5, H - 5, R);
    ctx.strokeStyle = "rgba(170, 150, 255, 0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.save();
    ctx.shadowColor = "rgba(150, 120, 255, 0.35)";
    ctx.shadowBlur = 30;
    roundRectPath(ctx, 3.5, 3.5, W - 7, H - 7, R);
    ctx.strokeStyle = "rgba(120, 255, 178, 0.2)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    // tag chip
    const chipY = pad + 30;
    ctx.font = "700 25px 'DM Sans', sans-serif";
    const tagW = ctx.measureText(def.tag).width + 58;
    roundRectPath(ctx, pad, chipY - 21, tagW, 46, 23);
    ctx.fillStyle = "rgba(150, 120, 255, 0.14)";
    ctx.fill();
    ctx.strokeStyle = "rgba(170, 150, 255, 0.45)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "#c9b8ff";
    ctx.letterSpacing = "2px";
    ctx.fillText(def.tag, pad + 26, chipY + 7);
    ctx.letterSpacing = "0px";

    // title (Bebas), shrink until it fits on at most two lines
    let titlePx = 72;
    const setTitleFont = (px: number) => {
      ctx.font = `400 ${px}px 'Bebas Neue', 'Arial Narrow', sans-serif`;
    };
    setTitleFont(titlePx);
    let titleLines = wrapText(ctx, def.title, W - pad * 2);
    while (titleLines.length > 2 && titlePx > 40) {
      titlePx -= 2;
      setTitleFont(titlePx);
      titleLines = wrapText(ctx, def.title, W - pad * 2);
    }
    ctx.fillStyle = "#f4f0ff";
    ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
    ctx.shadowBlur = 14;
    let ty = pad + 104;
    for (const ln of titleLines.slice(0, 2)) {
      ctx.fillText(ln, pad, ty);
      ty += titlePx + 10;
    }
    ctx.shadowBlur = 0;

    // ghost index numeral behind the body area
    ctx.font = "400 240px 'Bebas Neue', 'Arial Narrow', sans-serif";
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(190, 170, 255, 0.09)";
    ctx.fillText(def.idx, W - pad + 6, H - pad + 62);
    ctx.textAlign = "left";

    // divider + body copy
    ctx.strokeStyle = "rgba(170, 150, 255, 0.3)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pad, H - pad - 118);
    ctx.lineTo(pad + 58, H - pad - 118);
    ctx.stroke();

    ctx.fillStyle = "#d8e9dd";
    ctx.font = "400 30px 'DM Sans', sans-serif";
    const lines = wrapText(ctx, def.body, W - pad * 2).slice(0, 2);
    let bodyY = H - pad - 58;
    for (const ln of lines) {
      ctx.fillText(ln, pad, bodyY);
      bodyY += 40;
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  try {
    tex.colorSpace = THREE.SRGBColorSpace;
  } catch {
    /* older three */
  }
  tex.anisotropy = 4;
  return tex;
}

/* One card: positioned on the helix by scroll progress, always facing the
   camera, gentle idle wobble. Real 3D depth — the opaque can occludes
   cards that travel behind it and cards in front draw over it naturally. */
function SpiralCard({
  def,
  progressRef,
  compact,
}: {
  def: CardDef;
  progressRef: React.RefObject<number>;
  compact: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const tex = useMemo(() => makeCardTexture(def), [def]);
  useEffect(() => () => tex.dispose(), [tex]);

  const scale = compact ? 0.72 : 1;
  const cardW = 1.85 * scale;
  const cardH = (cardW * CARD_PX_H) / CARD_PX_W;

  useFrame(({ clock }) => {
    const g = group.current;
    if (!g || !camera) return;
    const t = clock.getElapsedTime();
    const p = progressRef.current ?? 0;
    // Helix: angle wraps around the can as the story plays, height drifts.
    const az = def.offset + p * def.spin * Math.PI * 2;
    const radius = def.radius * (1 + Math.sin(p * Math.PI * 2 + def.offset) * 0.07);
    const bob = Math.sin(t * 0.6 + def.offset * 3) * def.bobAmp * scale;
    const y = def.yBase * scale + p * def.yRise * scale + bob;
    g.position.set(radius * Math.sin(az), y, radius * Math.cos(az));
    g.lookAt(camera.position);
    // tilt + hand-held wobble about the view axis
    g.rotation.z = def.tilt + Math.sin(t * 0.45 + def.offset * 2) * 0.02;
  });

  return (
    <group ref={group} position={[def.radius, def.yBase, 0]}>
      <mesh>
        <planeGeometry args={[cardW, cardH]} />
        <meshBasicMaterial map={tex} transparent side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

function CardHelix({
  progressRef,
  compact,
}: {
  progressRef: React.RefObject<number>;
  compact: boolean;
}) {
  return (
    <group>
      {CARDS.map((def) => (
        <SpiralCard key={def.idx} def={def} progressRef={progressRef} compact={compact} />
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Scene                                                               */
/* ------------------------------------------------------------------ */
function Scene({
  progressRef,
  model,
  compact,
}: {
  progressRef: React.RefObject<number>;
  model: THREE.Group | null;
  compact: boolean;
}) {
  const { gl, scene } = useThree();

  // Studio reflections without any network assets
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = env.texture;
    scene.environmentIntensity = 0.9;
    return () => {
      env.texture.dispose();
      pmrem.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene]);

  return (
    <>
      {/* deep, endless atmosphere */}
      <fogExp2 attach="fog" args={["#020604", 0.035]} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[6, 8, 4]} intensity={1.7} color="#eafff4" />
      <directionalLight position={[-7, 3, -5]} intensity={0.7} color="#7dffa8" />
      <spotLight position={[0, 9, -5]} intensity={0.6} angle={0.55} penumbra={1} color="#9dffc2" />
      <CanRig model={model} />
      <CardHelix progressRef={progressRef} compact={compact} />
      <RedMarks compact={compact} />
      <Particles count={800} color="#39ff88" size={0.05} opacity={0.42} speed={0.018} />
      <Particles count={220} color="#b48cff" size={0.07} opacity={0.3} speed={-0.012} />
      <OrbitCam progressRef={progressRef} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Page wrapper                                                        */
/* ------------------------------------------------------------------ */
interface AboutExperienceProps {
  /** Full-screen on-demand mode: renders inside a locked overlay scroller. */
  overlay?: boolean;
  /** The overlay's internal scroll container (overlay mode). */
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  /** Live progress callback (0..100) for overlay choreography. */
  onProgress?: (pct: number) => void;
}

export default function AboutExperience({ overlay = false, scrollRef, onProgress }: AboutExperienceProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const progressRef = useRef(0);
  const [pct, setPct] = useState(0);
  const pctShown = useRef(-1);
  const rafRef = useRef<number | null>(null);
  const [active, setActive] = useState(overlay);
  // Compact layout for narrow screens: tighter card ring + smaller cards.
  const [compact, setCompact] = useState(() => typeof window !== "undefined" && window.innerWidth < 840);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 839px)");
    const sync = () => setCompact(mq.matches);
    sync();
    mq.addEventListener?.("change", sync);
    return () => mq.removeEventListener?.("change", sync);
  }, []);

  // Can-model load lifecycle: streamed fetch with % progress, and a Retry
  // action on failure — never a silent endless "loading" hang.
  const [model, setModel] = useState<THREE.Group | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadPct, setLoadPct] = useState(0);
  const [loadErr, setLoadErr] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setLoadState("loading");
    setLoadPct(0);
    setLoadErr("");
    loadCan((pct) => {
      if (!cancelled) setLoadPct(pct);
    })
      .then((scene) => {
        if (cancelled) return;
        setModel(scene);
        setLoadState("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadErr(err instanceof Error ? err.message : String(err));
        setLoadState("error");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, loadAttempt]);

  // Inline mode: mount the WebGL canvas only while the section is near the
  // viewport. Overlay mode is always active because it only exists while open.
  useEffect(() => {
    if (overlay) {
      setActive(true);
      return;
    }
    const el = sectionRef.current;
    if (!el || !("IntersectionObserver" in window)) {
      setActive(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => setActive(entries.some((e) => e.isIntersecting)),
      { rootMargin: "1800px 0px 1800px 0px", threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlay]);

  // Scroll progress (overlay: measured on the internal scroller)
  useEffect(() => {
    const tick = () => {
      rafRef.current = window.requestAnimationFrame(tick);
      if (!active) return;
      if (overlay && scrollRef) {
        const sc = scrollRef.current;
        if (sc) {
          const total = Math.max(sc.scrollHeight - sc.clientHeight, 1);
          const raw = clamp01(sc.scrollTop / total);
          progressRef.current = raw;
          const shown = Math.round(raw * 100);
          if (shown !== pctShown.current) {
            pctShown.current = shown;
            setPct(shown);
            onProgress?.(shown);
          }
        }
        return;
      }
      const sec = sectionRef.current;
      if (!sec) return;
      const rect = sec.getBoundingClientRect();
      const total = Math.max(sec.offsetHeight - window.innerHeight, 1);
      const raw = clamp01(-rect.top / total);
      progressRef.current = raw;
      const shown = Math.round(raw * 100);
      if (shown !== pctShown.current) {
        pctShown.current = shown;
        setPct(shown);
        onProgress?.(shown);
      }
    };
    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, overlay, scrollRef, onProgress]);

  return (
    <section ref={sectionRef} id="about-experience" className="volt-exp" aria-label="Volt can — 360 view">
      <div className={`volt-exp-sticky${active ? "" : " volt-exp-idle"}`}>
        {active && (
          <Canvas
            dpr={[1, 1.75]}
            camera={{ position: [0, 4.1, 1.6], fov: 40, near: 0.1, far: 80 }}
            gl={{ antialias: true, powerPreference: "high-performance" }}
            className="volt-exp-canvas"
          >
            <Scene progressRef={progressRef} model={model} compact={compact} />
          </Canvas>
        )}

        <div className="volt-vignette" aria-hidden="true" />
        <div className="volt-grain" aria-hidden="true" />

        {active && loadState === "loading" && (
          <div className="volt-exp-loading" role="status">
            <span className="volt-exp-loading-dot" />
            <span>
              {loadPct > 0 ? `Loading the can — ${loadPct}%` : "Zooming to the can"}
            </span>
          </div>
        )}

        {active && loadState === "error" && (
          <div className="volt-exp-loading volt-exp-loading--error" role="alert">
            <span>
              Couldn't load the 3D can{loadErr ? ` — ${loadErr}` : ""}
            </span>
            <button
              type="button"
              className="volt-exp-retry"
              onClick={() => setLoadAttempt((attempt) => attempt + 1)}
            >
              Try again
            </button>
          </div>
        )}

        {active && (
          <div className="volt-exp-bottom volt-bottom-bar">
            <span>
              {loadState === "ready"
                ? pct < 2
                  ? "Spin the can — keep scrolling"
                  : "Volt · 360°"
                : loadState === "error"
                  ? "Couldn't load the can"
                  : loadPct > 0
                    ? `Loading the can — ${loadPct}%`
                    : "Zooming to the can"}
            </span>
            <span className="volt-bottom-line" />
            <span>{String(Math.max(1, Math.min(100, pct + 1))).padStart(3, "0")} / 100</span>
          </div>
        )}
      </div>
    </section>
  );
}
