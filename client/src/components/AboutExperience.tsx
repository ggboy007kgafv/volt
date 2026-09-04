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
    rad: 3.6,
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

    // Closer, tighter orbit — the can fills more of the frame and the
    // camera pushes in as the story completes.
    const scrollRad = THREE.MathUtils.lerp(5.6, 4.5, p);
    const targetRad = THREE.MathUtils.lerp(2.9, scrollRad, k);
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
function Particles() {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const n = 300;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i += 1) {
      const r = 5.5 + Math.random() * 6;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = (Math.random() - 0.5) * 9;
      arr[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    return arr;
  }, []);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.getElapsedTime() * 0.02;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.05} color="#39ff88" transparent opacity={0.4} sizeAttenuation depthWrite={false} />
    </points>
  );
}

/* ------------------------------------------------------------------ */
/* Floating glass info cards (Active-Theory-style ring around the can) */
/* ------------------------------------------------------------------ */
interface RingCardDef {
  /** Start azimuth (radians) on the ring around the can (0 = +Z front). */
  az: number;
  /** Distance from the can axis. */
  radius: number;
  /** Height above the can center. */
  y: number;
  /** Constant revolution speed (rad/s) — the cards slowly orbit the can. */
  spin: number;
  /** Idle bob amplitude / speed. */
  bobAmp: number;
  bobSpd: number;
  idx: string;
  kicker: string;
  title: string;
  body: string;
}

// Four glass cards on a ring around the can. They revolve slowly on their
// own (a carousel), so as the scroll orbit swings the camera around the can
// some cards pass in front of it and others slip behind — real parallax and
// depth, Active-Theory style — while each card keeps facing the viewer.
const RING_CARDS: RingCardDef[] = [
  {
    az: -2.6, radius: 2.9, y: 1.25, spin: 0.07, bobAmp: 0.09, bobSpd: 0.9,
    idx: "01", kicker: "PURE ENERGY",
    title: "Charge, held in frame",
    body: "Clean, refreshing energy engineered to keep your momentum moving.",
  },
  {
    az: -1.15, radius: 2.55, y: 0.45, spin: -0.055, bobAmp: 0.11, bobSpd: 0.7,
    idx: "02", kicker: "BOLD FLAVOR",
    title: "Taste the voltage",
    body: "A sharp, vivid flavor burst with every single sip — never flat.",
  },
  {
    az: 1.25, radius: 2.6, y: -0.6, spin: 0.08, bobAmp: 0.1, bobSpd: 0.8,
    idx: "03", kicker: "ZERO LIMITS",
    title: "Built for the ones who move",
    body: "For creators, gamers, athletes — everyone who keeps pushing forward.",
  },
  {
    az: 2.7, radius: 3.0, y: -1.3, spin: -0.065, bobAmp: 0.12, bobSpd: 0.65,
    idx: "04", kicker: "CHARGED DIFFERENT",
    title: "A new generation of energy",
    body: "More than a drink — a signal. Volt is built to charge every moment.",
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

/* Paint one glass card to an offscreen canvas -> WebGL texture. */
function makeCardTexture(def: RingCardDef): THREE.CanvasTexture {
  const W = CARD_PX_W;
  const H = CARD_PX_H;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d");
  if (ctx) {
    const R = 92;
    const pad = 72;

    // frosty glass body
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "rgba(18, 42, 26, 0.62)");
    g.addColorStop(0.55, "rgba(7, 20, 12, 0.66)");
    g.addColorStop(1, "rgba(3, 10, 6, 0.72)");
    roundRectPath(ctx, 0, 0, W, H, R);
    ctx.fillStyle = g;
    ctx.fill();

    // sheen streaks
    ctx.save();
    roundRectPath(ctx, 0, 0, W, H, R);
    ctx.clip();
    const sheen = ctx.createLinearGradient(0, 0, W * 0.7, H);
    sheen.addColorStop(0, "rgba(160, 255, 200, 0.05)");
    sheen.addColorStop(0.35, "rgba(160, 255, 200, 0)");
    sheen.addColorStop(1, "rgba(160, 255, 200, 0.035)");
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, W, H);
    // faint speckle noise
    for (let i = 0; i < 150; i += 1) {
      ctx.fillStyle = `rgba(${160 + Math.random() * 60}, 255, ${190 + Math.random() * 65}, ${0.02 + Math.random() * 0.04})`;
      const s = 1 + Math.random() * 2;
      ctx.fillRect(Math.random() * W, Math.random() * H, s, s);
    }
    ctx.restore();

    // rim + soft glow border
    roundRectPath(ctx, 2.5, 2.5, W - 5, H - 5, R);
    ctx.strokeStyle = "rgba(150, 255, 196, 0.55)";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.save();
    ctx.shadowColor = "rgba(57, 255, 136, 0.4)";
    ctx.shadowBlur = 34;
    roundRectPath(ctx, 2.5, 2.5, W - 5, H - 5, R);
    ctx.strokeStyle = "rgba(57, 255, 136, 0.22)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    // kicker chip
    const chipY = pad + 30;
    ctx.font = "700 25px 'DM Sans', sans-serif";
    const kickerW = ctx.measureText(def.kicker).width + 58;
    roundRectPath(ctx, pad, chipY - 21, kickerW, 46, 23);
    ctx.fillStyle = "rgba(57, 255, 136, 0.12)";
    ctx.fill();
    ctx.strokeStyle = "rgba(120, 255, 178, 0.4)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "#8df8b8";
    ctx.letterSpacing = "2px";
    ctx.fillText(def.kicker, pad + 26, chipY + 7);
    ctx.letterSpacing = "0px";

    // big title (Bebas), auto-shrink to one line
    let titlePx = 74;
    ctx.font = `400 ${titlePx}px 'Bebas Neue', 'Arial Narrow', sans-serif`;
    while (ctx.measureText(def.title).width > W - pad * 2 && titlePx > 44) {
      titlePx -= 2;
      ctx.font = `400 ${titlePx}px 'Bebas Neue', 'Arial Narrow', sans-serif`;
    }
    ctx.fillStyle = "#f2fff6";
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = 14;
    ctx.fillText(def.title, pad, pad + 96);
    ctx.shadowBlur = 0;

    // ghost index numeral behind the body area
    ctx.font = "400 240px 'Bebas Neue', 'Arial Narrow', sans-serif";
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(157, 255, 194, 0.07)";
    ctx.fillText(def.idx, W - pad + 6, H - pad + 62);
    ctx.textAlign = "left";

    // divider + body copy
    ctx.strokeStyle = "rgba(150, 255, 196, 0.28)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pad, H - pad - 118);
    ctx.lineTo(pad + 58, H - pad - 118);
    ctx.stroke();

    ctx.fillStyle = "#cfe9d8";
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

function FloatingCard({
  def,
  compact,
}: {
  def: RingCardDef;
  compact: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const tex = useMemo(() => makeCardTexture(def), [def]);
  useEffect(() => () => tex.dispose(), [tex]);

  // World width of the card: 1.8 (1.4 compact). Texture is 16:10.
  const scale = compact ? 0.78 : 1;
  const cardW = 1.8 * scale;
  const cardH = (cardW * CARD_PX_H) / CARD_PX_W;
  const radius = def.radius * (compact ? 0.82 : 1);

  useFrame(({ clock }) => {
    const g = group.current;
    if (!g || !camera) return;
    const t = clock.getElapsedTime();
    // Slow constant revolution around the can + gentle idle bob.
    const az = def.az + t * def.spin;
    const bob = Math.sin(t * def.bobSpd + def.az * 3) * def.bobAmp * scale;
    g.position.set(radius * Math.sin(az), def.y * 0.9 * scale + bob, radius * Math.cos(az));
    // Face the camera (plane's +Z toward the viewer, up preserved) so text
    // always reads upright while the can spins beneath the card ring.
    g.lookAt(camera.position);
  });

  return (
    <group ref={group} position={[radius, def.y * scale, 0]}>
      <mesh>
        <planeGeometry args={[cardW, cardH]} />
        <meshBasicMaterial map={tex} transparent side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

function CardRing({ compact }: { compact: boolean }) {
  return (
    <group>
      {RING_CARDS.map((def) => (
        <FloatingCard key={def.idx} def={def} compact={compact} />
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
      <ambientLight intensity={0.4} />
      <directionalLight position={[6, 8, 4]} intensity={1.7} color="#eafff4" />
      <directionalLight position={[-7, 3, -5]} intensity={0.7} color="#7dffa8" />
      <spotLight position={[0, 9, -5]} intensity={0.6} angle={0.55} penumbra={1} color="#9dffc2" />
      <CanRig model={model} />
      <CardRing compact={compact} />
      <Particles />
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
            camera={{ position: [0, 4.1, 1.6], fov: 42, near: 0.1, far: 80 }}
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
