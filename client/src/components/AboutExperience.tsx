/*
 * AboutExperience — an immersive, scroll-driven 3D product story.
 *
 * The VOLT can (GLB) is the hero at center stage. Four glass info cards sit
 * on a vertical helix around it. Scroll progress (0..1 across the tall
 * section) drives a full cinematic rotation of the card spiral plus a subtle
 * camera push-in, so the cards orbit the can — passing in front and behind it
 * with true depth-tested occlusion — while the can slowly spins on its axis.
 */
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import * as THREE from "three";
import "./AboutExperience.css";

const CAN_URL = "/models/volt-can.glb";

interface AboutCardData {
  index: string;
  title: string;
  desc: string;
}

const CARDS: AboutCardData[] = [
  { index: "01", title: "PURE ENERGY", desc: "Clean, refreshing energy designed to keep your momentum going." },
  { index: "02", title: "BOLD FLAVOR", desc: "A powerful burst of flavor with every single sip." },
  { index: "03", title: "ZERO LIMITS", desc: "Built for creators, gamers, athletes, and everyone who keeps moving forward." },
  { index: "04", title: "CHARGED DIFFERENT", desc: "More than an energy drink. A new generation of energy." },
];

/* Helix layout: 4 cards spread vertically at 90° intervals around the can. */
const CARD_ANGLE = [0.55, 2.12, 3.72, 5.28];
const CARD_Y = [1.95, 0.65, -0.65, -1.95];
const CARD_RADIUS = 3.75;

const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);

function roundedPath(ctx: CanvasRenderingContext2D, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(w - r, 0);
  ctx.quadraticCurveTo(w, 0, w, r);
  ctx.lineTo(w, h - r);
  ctx.quadraticCurveTo(w, h, w - r, h);
  ctx.lineTo(r, h);
  ctx.quadraticCurveTo(0, h, 0, h - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
}

/* Paint one premium glass card to a canvas → used as a 3D plane texture. */
function drawCardTexture(card: AboutCardData): THREE.CanvasTexture {
  const W = 1024;
  const H = 680;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d");
  if (ctx) {
    const R = 52;
    const body = () => roundedPath(ctx, W, H, R);

    // Frosted dark-glass body
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "rgba(15, 27, 19, 0.82)");
    grad.addColorStop(0.5, "rgba(8, 16, 11, 0.66)");
    grad.addColorStop(1, "rgba(6, 12, 9, 0.84)");
    body();
    ctx.fillStyle = grad;
    ctx.fill();

    // Glass top highlight
    const sheen = ctx.createLinearGradient(0, 0, 0, H * 0.32);
    sheen.addColorStop(0, "rgba(255,255,255,0.11)");
    sheen.addColorStop(1, "rgba(255,255,255,0)");
    body();
    ctx.fillStyle = sheen;
    ctx.fill();

    // Thin border + very subtle green glow
    body();
    ctx.shadowColor = "rgba(57,255,136,0.4)";
    ctx.shadowBlur = 26;
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(196,255,220,0.55)";
    ctx.stroke();
    ctx.shadowBlur = 0;
    body();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.stroke();

    // Kicker
    ctx.fillStyle = "#8dffb4";
    ctx.font = "600 30px 'DM Sans', Arial, sans-serif";
    ctx.fillText("VOLT STRIKE ENERGY", 72, 96);

    // Ghost index
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(185,244,74,0.22)";
    ctx.font = "400 190px 'Bebas Neue', Impact, sans-serif";
    ctx.fillText(card.index, W - 56, 210);
    ctx.textAlign = "left";

    // Title (auto-fit width)
    ctx.fillStyle = "#f4f8f1";
    let size = 150;
    for (; size > 56; size -= 4) {
      ctx.font = `400 ${size}px 'Bebas Neue', Impact, sans-serif`;
      if (ctx.measureText(card.title).width <= 860) break;
    }
    ctx.fillText(card.title, 72, 292);

    // Divider
    ctx.strokeStyle = "rgba(157,255,194,0.4)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(72, 338);
    ctx.lineTo(W - 72, 338);
    ctx.stroke();

    // Description (wrapped)
    ctx.fillStyle = "rgba(216,237,222,0.96)";
    ctx.font = "400 34px 'DM Sans', Arial, sans-serif";
    const words = card.desc.split(" ");
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > 880 && line) {
        lines.push(line);
        line = w;
      } else line = test;
    }
    if (line) lines.push(line);
    lines.slice(0, 3).forEach((l, i) => ctx.fillText(l, 72, 398 + i * 52));
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/* Radial soft-shadow sprite under the can */
function makeShadowTexture(): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = 256;
  cv.height = 256;
  const ctx = cv.getContext("2d");
  if (ctx) {
    const g = ctx.createRadialGradient(128, 128, 20, 128, 128, 126);
    g.addColorStop(0, "rgba(0,0,0,0.55)");
    g.addColorStop(0.55, "rgba(0,0,0,0.25)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
  }
  return new THREE.CanvasTexture(cv);
}

/* ------------------------------------------------------------------ */
/* The can                                                             */
/* ------------------------------------------------------------------ */
function CanModel({ onReady }: { onReady: () => void }) {
  const gltf = useLoader(GLTFLoader, CAN_URL);
  const group = useRef<THREE.Group>(null);
  const done = useRef(false);

  useMemo(() => {
    const scene = gltf.scene;
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const scale = 2.75 / Math.max(size.y, 1e-5);
    const midY = box.getCenter(new THREE.Vector3()).y * scale;
    scene.scale.setScalar(scale);
    scene.position.y = -midY;
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
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
  }, [gltf]);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const t = window.setTimeout(onReady, 80);
    return () => window.clearTimeout(t);
  }, [onReady]);

  return <group ref={group}><primitive object={gltf.scene} /></group>;
}

/* ------------------------------------------------------------------ */
/* The four glass cards on their helix                                 */
/* ------------------------------------------------------------------ */
function CardsOrbit({ progressRef, textures }: { progressRef: React.RefObject<number>; textures: THREE.Texture[] }) {
  const group = useRef<THREE.Group>(null);
  const eased = useRef(0);
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    const raw = progressRef.current ?? 0;
    eased.current += (raw - eased.current) * 0.09;
    const p = eased.current;
    // Whole helix turns with the scroll; cards keep their own gentle float.
    const target = p * Math.PI * 2 + (1 - p) * 0.62;
    g.rotation.y += (target - g.rotation.y) * 0.12;
    const t = clock.getElapsedTime();
    g.children.forEach((child, i) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.position.y = CARD_Y[i] + Math.sin(t * 0.7 + i * 1.9) * 0.12;
      const front = Math.cos(CARD_ANGLE[i] + g.rotation.y) > 0;
      const targetScale = front ? 1 : 0.88;
      const s = THREE.MathUtils.damp(mesh.scale.x, targetScale, 3, 0.05);
      mesh.scale.setScalar(s);
    });
  });
  return (
    <group ref={group}>
      {CARDS.map((card, i) => (
        <mesh
          key={card.index}
          position={[Math.cos(CARD_ANGLE[i]) * CARD_RADIUS, CARD_Y[i], Math.sin(CARD_ANGLE[i]) * CARD_RADIUS]}
          renderOrder={1}
        >
          <planeGeometry args={[2.9, 1.93]} />
          <meshBasicMaterial map={textures[i]} transparent depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Atmosphere: particles, ground glow, soft shadow                     */
/* ------------------------------------------------------------------ */
function Particles() {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const n = 260;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i += 1) {
      const r = 5 + Math.random() * 5.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = (Math.random() - 0.5) * 8;
      arr[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta) - 1.5;
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
      <pointsMaterial size={0.045} color="#39ff88" transparent opacity={0.4} sizeAttenuation depthWrite={false} />
    </points>
  );
}

function GroundGlow() {
  const shadowTex = useMemo(() => makeShadowTexture(), []);
  return (
    <>
      <mesh position={[0, -1.7, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.3, 48]} />
        <meshBasicMaterial color="#0d3a20" transparent opacity={0.5} depthWrite={false} />
      </mesh>
      <mesh position={[0, -1.69, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4.6, 4.6]} />
        <meshBasicMaterial map={shadowTex} transparent opacity={0.6} depthWrite={false} />
      </mesh>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Scene rig: responsive scale + camera push                           */
/* ------------------------------------------------------------------ */
function SceneRig({
  progressRef,
  textures,
}: {
  progressRef: React.RefObject<number>;
  textures: THREE.Texture[];
}) {
  const world = useRef<THREE.Group>(null);
  const { viewport, camera, gl, scene } = useThree();
  const envRef = useRef<THREE.Texture | null>(null);
  const eased = useRef(0.12);

  // Studio reflections without any network assets
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = env.texture;
    scene.environmentIntensity = 0.9;
    envRef.current = env.texture;
    return () => {
      env.texture.dispose();
      pmrem.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene]);

  useFrame(() => {
    const w = world.current;
    if (!w) return;
    const raw = progressRef.current ?? 0;
    eased.current += (raw - eased.current) * 0.06;
    const p = eased.current;

    // Responsive composition scale
    const targetS = THREE.MathUtils.clamp(viewport.width / 11.8, 0.5, 1.04);
    w.scale.setScalar(THREE.MathUtils.damp(w.scale.x, targetS, 4, 0.05));

    // Camera: gentle push-in and rise through the story
    const targetZ = 8.7 - p * 1.0;
    const targetY = 0.25 + Math.sin(p * Math.PI) * 0.55;
    camera.position.z = THREE.MathUtils.damp(camera.position.z, targetZ, 3, 0.05);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, targetY, 3, 0.05);
    camera.lookAt(0, 0.1, 0);
  });

  return (
    <group ref={world}>
      <CardsOrbit progressRef={progressRef} textures={textures} />
      <Particles />
      <GroundGlow />
    </group>
  );
}

function SceneInner({
  progressRef,
  textures,
  onCanReady,
}: {
  progressRef: React.RefObject<number>;
  textures: THREE.Texture[];
  onCanReady: () => void;
}) {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[6, 8, 4]} intensity={1.7} color="#eafff4" />
      <directionalLight position={[-7, 3, -5]} intensity={0.7} color="#7dffa8" />
      <spotLight position={[0, 9, -5]} intensity={0.6} angle={0.55} penumbra={1} color="#9dffc2" />
      <Suspense fallback={null}>
        <CanSpinBridge progressRef={progressRef} onReady={onCanReady} />
      </Suspense>
      <SceneRig progressRef={progressRef} textures={textures} />
    </>
  );
}

/* Can spin inside Suspense, with the load-complete callback */
function CanSpinBridge({ progressRef, onReady }: { progressRef: React.RefObject<number>; onReady: () => void }) {
  const ref = useRef<THREE.Group>(null);
  const eased = useRef(0);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    const t = clock.getElapsedTime();
    const raw = progressRef.current ?? 0;
    eased.current += (raw - eased.current) * 0.08;
    const p = eased.current;
    g.rotation.y = p * Math.PI * 2 + t * 0.07;
    g.rotation.x = Math.sin(p * Math.PI * 1.4) * 0.1;
    g.rotation.z = Math.cos(p * Math.PI * 2) * 0.05;
  });
  return (
    <group ref={ref}>
      <CanModel onReady={onReady} />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Page wrapper: sticky stage + scroll progress                        */
/* ------------------------------------------------------------------ */
export default function AboutExperience() {
  const sectionRef = useRef<HTMLElement>(null);
  const progressRef = useRef(0);
  const [canReady, setCanReady] = useState(false);
  const [textures, setTextures] = useState<THREE.Texture[]>([]);
  const [pct, setPct] = useState(0);
  const pctShown = useRef(-1);
  const rafRef = useRef<number | null>(null);
  const [active, setActive] = useState(false);

  const onCanReady = useCallback(() => setCanReady(true), []);

  // Mount the WebGL canvas only while this section is near the viewport, so
  // the renderer never runs for far-away sections.
  useEffect(() => {
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
  }, []);

  useEffect(() => {
    const tick = () => {
      rafRef.current = window.requestAnimationFrame(tick);
      if (!active) return;
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
      }
    };
    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    };
  }, [active]);

  // Paint the four card textures once the display fonts are available.
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const build = () => {
      if (cancelled) return;
      setTextures(CARDS.map(drawCardTexture));
    };
    if (typeof document !== "undefined" && "fonts" in document) {
      document.fonts.ready.then(() => window.setTimeout(build, 40));
    } else build();
    return () => {
      cancelled = true;
    };
  }, [active]);

  // Dispose card textures on unmount.
  useEffect(() => {
    return () => {
      textures.forEach((t) => t.dispose());
    };
  }, [textures]);

  return (
    <section ref={sectionRef} id="about-experience" className="volt-exp" aria-label="About Volt — the story">
      <div className={`volt-exp-sticky${active ? "" : " volt-exp-idle"}`}>
        {active && (
          <Canvas
            dpr={[1, 1.75]}
            camera={{ position: [0, 0.25, 8.7], fov: 42, near: 0.1, far: 80 }}
            gl={{ antialias: true, powerPreference: "high-performance" }}
            className="volt-exp-canvas"
          >
            <SceneInner progressRef={progressRef} textures={textures} onCanReady={onCanReady} />
          </Canvas>
        )}

        <div className="volt-vignette" aria-hidden="true" />
        <div className="volt-grain" aria-hidden="true" />

        {active && !canReady && (
          <div className="volt-exp-loading" role="status">
            <span className="volt-exp-loading-dot" />
            <span>Charging the can</span>
          </div>
        )}

        {active && (
          <div className="volt-exp-bottom volt-bottom-bar">
            <span>{canReady ? "The story of Volt" : "Rendering the can"}</span>
            <span className="volt-bottom-line" />
            <span>{String(Math.max(1, Math.min(100, pct + 1))).padStart(3, "0")} / 100</span>
          </div>
        )}
      </div>
    </section>
  );
}
