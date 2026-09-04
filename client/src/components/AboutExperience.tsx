/*
 * AboutExperience — a 360° product viewer for the VOLT can.
 *
 * Clicking "About Volt" (nav) or "Explore flavors" (film page) glides here.
 * The VOLT can floats above a metallic platform with a glowing green ring,
 * surrounded by curved holographic glass panels arranged in a circle
 * (01 PURE ENERGY in the foreground, 02 SUSTAINABLE POWER, 03 JOIN THE
 * GRID, 04 VOLT DIFFERENCE). Scroll drives a cinematic 450° camera orbit
 * that descends from high above the can to below mid-can, so the panels
 * sweep past in front of and behind the can with true depth occlusion.
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
    lookY: -0.05,
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

    const scrollElev = THREE.MathUtils.lerp(deg(52), deg(-6), p);
    const targetEl = THREE.MathUtils.lerp(deg(72), scrollElev, k);
    st.current.el = THREE.MathUtils.damp(st.current.el, targetEl, 6, 0.05);

    // Cinematic orbit — close enough to feel premium, with room for the
    // panel ring to sweep around the can.
    const scrollRad = THREE.MathUtils.lerp(5.1, 4.0, p);
    const targetRad = THREE.MathUtils.lerp(2.7, scrollRad, k);
    st.current.rad = THREE.MathUtils.damp(st.current.rad, targetRad, 6, 0.05);

    // Gentle handheld sway
    const sway = Math.sin(t * 0.2) * 0.05;

    const el = st.current.el;
    const az = st.current.az + sway * 0.4;
    const rad = st.current.rad;
    st.current.lookY = -0.05 + Math.sin(p * Math.PI) * 0.12;

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

// A ring of dust circling the platform — the "particles in orbit" look.
function RingParticles() {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const count = 560;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const r = 2.6 + Math.random() * 1.15;
      const a = Math.random() * Math.PI * 2;
      arr[i * 3] = r * Math.cos(a);
      arr[i * 3 + 1] = -1.0 + Math.random() * 1.7;
      arr[i * 3 + 2] = r * Math.sin(a);
    }
    return arr;
  }, []);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.getElapsedTime() * 0.05;
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.06} color="#39ff88" transparent opacity={0.55} sizeAttenuation depthWrite={false} />
    </points>
  );
}

/* ------------------------------------------------------------------ */
/* Platform — metallic disc with a pulsing green ring under the can    */
/* ------------------------------------------------------------------ */
function Platform() {
  const ringRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const s = 1 + Math.sin(t * 1.2) * 0.045;
    if (glowRef.current) glowRef.current.scale.set(s, s, 1);
    if (ringRef.current) {
      const m = ringRef.current.material as THREE.MeshBasicMaterial;
      m.opacity = 0.75 + Math.sin(t * 1.2) * 0.25;
    }
  });
  return (
    <group>
      {/* metallic base */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.64, 0]}>
        <cylinderGeometry args={[2.5, 2.66, 0.14, 64]} />
        <meshStandardMaterial color="#0d1110" metalness={0.85} roughness={0.3} envMapIntensity={1.2} />
      </mesh>
      {/* glowing green ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.54, 0]}>
        <ringGeometry args={[2.06, 2.2, 80]} />
        <meshBasicMaterial color="#39ff88" transparent opacity={0.85} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      {/* inner hairline ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.53, 0]}>
        <ringGeometry args={[1.62, 1.67, 80]} />
        <meshBasicMaterial color="#39ff88" transparent opacity={0.35} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      {/* soft glow disc */}
      <mesh ref={glowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.52, 0]}>
        <circleGeometry args={[1.6, 64]} />
        <meshBasicMaterial color="#39ff88" transparent opacity={0.07} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Curved holographic panels — a ring of glass screens around the can  */
/* ------------------------------------------------------------------ */
interface PanelDef {
  idx: string; // "01"
  head: string; // white line, e.g. "PURE"
  sub: string; // green line, e.g. "ENERGY"
  /** Distance of the panel arc from the can axis. */
  radius: number;
  /** Angle around the can axis (0 = +x, PI/2 = +z front). */
  theta: number;
  /** Height above the can center. */
  y: number;
  /** Arc width (world units). */
  w: number;
  /** Panel height (world units). */
  h: number;
  /** Extra local rotation so the panel angles toward/away from camera. */
  tiltY: number;
  /** Idle bob. */
  bobAmp: number;
  bobSpd: number;
}

const PANELS: PanelDef[] = [
  {
    idx: "01", head: "PURE", sub: "ENERGY",
    radius: 2.7, theta: Math.PI / 2, y: -0.4, w: 3.1, h: 1.62,
    tiltY: 0.05, bobAmp: 0.05, bobSpd: 0.6,
  },
  {
    idx: "02", head: "SUSTAINABLE", sub: "POWER",
    radius: 3.05, theta: 2.62, y: 1.32, w: 2.3, h: 1.26,
    tiltY: -0.3, bobAmp: 0.06, bobSpd: 0.75,
  },
  {
    idx: "03", head: "JOIN THE", sub: "GRID",
    radius: 3.1, theta: 0.55, y: 1.42, w: 2.2, h: 1.2,
    tiltY: 0.28, bobAmp: 0.05, bobSpd: 0.65,
  },
  {
    idx: "04", head: "VOLT", sub: "DIFFERENCE",
    radius: 3.3, theta: -0.35, y: 0.05, w: 2.1, h: 1.16,
    tiltY: -0.35, bobAmp: 0.06, bobSpd: 0.7,
  },
];

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

/* Paint one holographic glass panel (transparent body, glowing rounded
   border, white head line + neon-green sub line) to a canvas texture. */
function makePanelTexture(def: PanelDef): THREE.CanvasTexture {
  const W = 1024;
  const H = Math.max(420, Math.round((W * def.h) / def.w));
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d");
  if (ctx) {
    const R = Math.min(90, H * 0.16);

    // holographic glass body — near-invisible so the can always reads
    // through it (edge-on panels become faint glass, never dark slabs)
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "rgba(26, 42, 32, 0.13)");
    g.addColorStop(0.5, "rgba(12, 24, 16, 0.15)");
    g.addColorStop(1, "rgba(6, 14, 9, 0.2)");
    roundRectPath(ctx, 0, 0, W, H, R);
    ctx.fillStyle = g;
    ctx.fill();

    // sheen + speckle noise
    ctx.save();
    roundRectPath(ctx, 0, 0, W, H, R);
    ctx.clip();
    const sheen = ctx.createLinearGradient(0, 0, W * 0.72, H);
    sheen.addColorStop(0, "rgba(220, 255, 240, 0.06)");
    sheen.addColorStop(0.4, "rgba(220, 255, 240, 0)");
    sheen.addColorStop(1, "rgba(57, 255, 136, 0.05)");
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 120; i += 1) {
      ctx.fillStyle = `rgba(${170 + Math.random() * 85}, ${240 + Math.random() * 15}, ${190 + Math.random() * 65}, ${0.02 + Math.random() * 0.035})`;
      const s = 1 + Math.random() * 2;
      ctx.fillRect(Math.random() * W, Math.random() * H, s, s);
    }
    ctx.restore();

    // glowing rounded border (white-green)
    ctx.save();
    ctx.shadowColor = "rgba(57, 255, 136, 0.6)";
    ctx.shadowBlur = 30;
    roundRectPath(ctx, 4, 4, W - 8, H - 8, R - 4);
    ctx.strokeStyle = "rgba(235, 255, 243, 0.6)";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
    roundRectPath(ctx, 11, 11, W - 22, H - 22, R - 11);
    ctx.strokeStyle = "rgba(57, 255, 136, 0.35)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // text (no dark shadows — they smear into a dark band when a panel
    // passes edge-on in front of the can; light-on-dark needs none)
    const cx = W / 2;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";

    // white head line: "01 — PURE"
    ctx.font = `400 ${Math.round(H * 0.145)}px 'Bebas Neue', 'Arial Narrow', sans-serif`;
    ctx.fillStyle = "#f4fff8";
    ctx.fillText(`${def.idx} — ${def.head}`, cx, H * 0.52);

    // neon-green sub line: "ENERGY" — soft green glow only
    ctx.font = `400 ${Math.round(H * 0.215)}px 'Bebas Neue', 'Arial Narrow', sans-serif`;
    ctx.fillStyle = "#39ff88";
    ctx.shadowColor = "rgba(57, 255, 136, 0.35)";
    ctx.shadowBlur = 10;
    ctx.fillText(def.sub, cx, H * 0.78);
    ctx.shadowBlur = 0;

    // small ghost index mark
    ctx.font = `400 ${Math.round(H * 0.2)}px 'Bebas Neue', 'Arial Narrow', sans-serif`;
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(120, 255, 178, 0.1)";
    ctx.fillText(def.idx, W - H * 0.3, H - H * 0.22);
    ctx.textAlign = "center";
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

/* One curved panel: a slice of a cylinder (so it truly curves), placed on
   the ring around the can, facing radially outward. Real 3D depth — the
   opaque can occludes panels behind it and front panels draw over it. */
function CurvedPanel({ def, compact }: { def: PanelDef; compact: boolean }) {
  const group = useRef<THREE.Group>(null);
  const tex = useMemo(() => makePanelTexture(def), [def]);
  useEffect(() => () => tex.dispose(), [tex]);

  const s = compact ? 0.78 : 1;
  const radius = def.radius * s;
  const h = def.h * s;
  const thetaLen = (def.w * s) / radius;
  const segments = Math.max(14, Math.round(thetaLen * 18));

  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    const t = clock.getElapsedTime();
    g.position.y = def.y * s + Math.sin(t * def.bobSpd + def.theta * 2) * def.bobAmp * s;
  });

  return (
    <group
      ref={group}
      position={[radius * Math.cos(def.theta), def.y * s, radius * Math.sin(def.theta)]}
      rotation={[0, def.theta + def.tiltY, 0]}
    >
      <mesh>
        <cylinderGeometry args={[radius, radius, h, segments, 1, true, -thetaLen / 2, thetaLen]} />
        <meshBasicMaterial map={tex} transparent side={THREE.FrontSide} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

function PanelRing({ compact }: { compact: boolean }) {
  return (
    <group>
      {PANELS.map((def) => (
        <CurvedPanel key={def.idx} def={def} compact={compact} />
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
      <fogExp2 attach="fog" args={["#020604", 0.028]} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[6, 8, 4]} intensity={1.7} color="#eafff4" />
      <directionalLight position={[-7, 3, -5]} intensity={0.7} color="#7dffa8" />
      <spotLight position={[0, 9, -5]} intensity={0.6} angle={0.55} penumbra={1} color="#9dffc2" />
      <CanRig model={model} />
      <PanelRing compact={compact} />
      <Platform />
      <RingParticles />
      <Particles count={600} color="#39ff88" size={0.045} opacity={0.4} speed={0.018} />
      <Particles count={180} color="#b48cff" size={0.06} opacity={0.28} speed={-0.012} />
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
  // Compact layout for narrow screens: tighter panel ring + smaller panels.
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