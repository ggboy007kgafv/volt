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
    az: 0, // azimuth (radians), scroll drives a full 360°
    el: deg(70), // elevation (radians)
    rad: 4.3,
    lookY: 0.1,
  });

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const p = progressRef.current ?? 0;

    // Intro always plays once on mount — a controlled zoom down from the top.
    const introTarget = 1;
    st.current.intro += (introTarget - st.current.intro) * 0.05;
    const k = st.current.intro;

    // Scroll drives azimuth 0 -> 360° while the camera sinks from high to low.
    const targetAz = p * Math.PI * 2;
    st.current.az = THREE.MathUtils.damp(st.current.az, targetAz, 3, 0.05);

    const scrollElev = THREE.MathUtils.lerp(deg(46), deg(-8), p);
    const introElev = deg(74) - Math.sin(Math.min(k, 1) * Math.PI) * 0.0;
    const targetEl = THREE.MathUtils.lerp(deg(74), scrollElev, k);
    st.current.el = THREE.MathUtils.damp(st.current.el, targetEl, 4, 0.05);

    // Push in slightly through the story
    const scrollRad = THREE.MathUtils.lerp(6.2, 4.9, p);
    const targetRad = THREE.MathUtils.lerp(3.6, scrollRad, k);
    st.current.rad = THREE.MathUtils.damp(st.current.rad, targetRad, 4, 0.05);

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
/* Scene                                                               */
/* ------------------------------------------------------------------ */
function Scene({
  progressRef,
  model,
}: {
  progressRef: React.RefObject<number>;
  model: THREE.Group | null;
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
            camera={{ position: [0, 4.1, 1.6], fov: 45, near: 0.1, far: 80 }}
            gl={{ antialias: true, powerPreference: "high-performance" }}
            className="volt-exp-canvas"
          >
            <Scene progressRef={progressRef} model={model} />
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
