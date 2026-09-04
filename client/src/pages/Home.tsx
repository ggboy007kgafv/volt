/*
 * Verdant Kinetic direction: cinematic product-film composition, dark green-black depth,
 * Volt Acid accents, compressed display type, and motion that gives the can physical weight.
 * This page owns the sticky canvas stage and maps scroll progress to a buffered image sequence.
 */
import { MutableRefObject, useEffect, useRef, useState } from "react";
import { ArrowDown, Check, ChevronLeft, ChevronRight, Zap, Volume2, VolumeX } from "lucide-react";
import CountUp from "@/components/CountUp";
import GlassSurface from "@/components/GlassSurface";
import MaskedHeading from "@/components/MaskedHeading";
import LiquidTransition, { LiquidTransitionHandle } from "@/components/LiquidTransition";
import AboutExperience from "@/components/AboutExperience";
import SupportChat from "@/components/SupportChat";

import { SECTION2_FRAME_SOURCES } from "@/lib/section2FrameSources";
import { VOLT_FRAME_SOURCES } from "@/lib/voltFrameSources";
import { ABOUT_FRAME_SOURCES } from "@/lib/aboutFrameSources";
import { STRIKE_FRAME_SOURCES } from "@/lib/strikeFrameSources";
import { FACTORY_FRAME_SOURCES } from "@/lib/factoryFrameSources";

const FRAME_SOURCES = VOLT_FRAME_SOURCES;

const nutritionRows = [
  { label: "Calories", value: 160, unit: "kcal" },
  { label: "Total fat", value: 0, unit: "g" },
  { label: "Sodium", value: 250, unit: "mg" },
  { label: "Total carbohydrates", value: 40, unit: "g" },
  { label: "Total sugars", value: 38, unit: "g" },
  { label: "Protein", value: 0, unit: "g" },
  { label: "Caffeine", value: 160, unit: "mg" },
] as const;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

// True once the watched section gets close to the viewport (used to defer the
// heavy per-section frame preloads so a cold visit doesn't download all ~850
// frames at once — on a slow connection that starves the lower sections).
function useNearViewport(elRef: { current: HTMLElement | null }, margin = 2000): boolean {
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = elRef.current;
    if (!el || !("IntersectionObserver" in window)) {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: `${margin}px 0px` },
    );
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return near;
}

const products = [
  {
    id: "strawberry",
    name: "Strawberry Strike",
    image: "/products/strawberry.png",
    accent: "#ff5b7f",
    description: "Bright, jammy strawberry rush with a clean electric finish.",
    price: "$3.49",
    rating: 4.9,
    reviews: 430,
  },
  {
    id: "orange",
    name: "Orange Strike",
    image: "/products/orange.png",
    accent: "#ff9330",
    description: "Bold sun-ripened orange heat with a sharp, zesty buzz.",
    price: "$3.49",
    rating: 4.9,
    reviews: 290,
  },
  {
    id: "lemon",
    name: "Lemon Strike",
    image: "/products/lemon.png",
    accent: "#ffd23c",
    description: "Crisp, sour lemon voltage that cuts clean through the charge.",
    price: "$3.49",
    rating: 4.8,
    reviews: 240,
  },
  {
    id: "grape",
    name: "Grape Strike",
    image: "/products/grape.png",
    accent: "#a05bff",
    description: "Cold, heavy grape with a dark-fruit depth that lingers.",
    price: "$3.49",
    rating: 4.9,
    reviews: 287,
  },
] as const;

/* ---- Product review rating: interactive bubbles instead of star icons ---- */
function BubbleRating({
  name,
  rating,
  count,
}: {
  name: string;
  rating: number;
  count: number;
}) {
  const [mine, setMine] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const total = 5;
  const active = mine ?? Math.round(rating);

  let caption: string;
  if (hover !== null) {
    caption = mine === null ? `Rate it: ${hover}` : `Change to ${hover}`;
  } else if (mine !== null) {
    caption = `Your rating: ${mine}`;
  } else {
    caption = `${rating.toFixed(1)} · ${count.toLocaleString()} reviews`;
  }

  return (
    <div
      className="volt-bub-row"
      role="group"
      aria-label={`${name} rating`}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      onMouseLeave={() => setHover(null)}
    >
      <div className="volt-bubs">
        {Array.from({ length: total }, (_, i) => {
          const n = i + 1;
          const lit = hover !== null ? n <= hover : n <= active;
          return (
            <button
              type="button"
              key={n}
              className={`volt-bub${lit ? " on" : ""}`}
              aria-label={`${n} of ${total}`}
              onClick={() => setMine(n)}
              onMouseEnter={() => setHover(n)}
              onFocus={() => setHover(n)}
              onBlur={() => setHover(null)}
            />
          );
        })}
      </div>
      <span className="volt-bub-caption" aria-live="polite">
        {caption}
      </span>
    </div>
  );
}

const reviews = [
  {
    id: "s1",
    name: "Maya Reyes",
    loc: "Austin, TX",
    when: "2 weeks ago",
    flavor: "Strawberry Strike",
    stars: 5,
    quote:
      "First energy drink that doesn't taste like a lab experiment. The strawberry hits clean and the fizz actually feels alive — no chalk, no crash.",
  },
  {
    id: "o1",
    name: "Dev Patel",
    loc: "Chicago, IL",
    when: "3 weeks ago",
    flavor: "Orange Strike",
    stars: 5,
    quote:
      "Caffeine that kicks in before my alarm does. Zero sugar crash on my early sessions, and the orange is dangerously good.",
  },
  {
    id: "l1",
    name: "Sofia Lindqvist",
    loc: "Seattle, WA",
    when: "1 month ago",
    flavor: "Lemon Strike",
    stars: 4,
    quote:
      "Sharp, sour, and honestly addictive. It's the only can I keep on my desk — knocked a star only because I keep running out.",
  },
  {
    id: "g1",
    name: "Marcus Tillman",
    loc: "Brooklyn, NY",
    when: "1 month ago",
    flavor: "Grape Strike",
    stars: 5,
    quote:
      "The grape tastes like cold dark fruit, not candy. This is what an energy drink should be — bold, clean, and properly chilled.",
  },
  {
    id: "s2",
    name: "Aisha Noura",
    loc: "Phoenix, AZ",
    when: "2 months ago",
    flavor: "Strawberry Strike",
    stars: 5,
    quote:
      "Tastes like a real soda, not a formula. My whole shift crew switched to Volt and we've stopped re-buying anything else.",
  },
  {
    id: "o2",
    name: "Leo Price",
    loc: "London, UK",
    when: "2 months ago",
    flavor: "Orange Strike",
    stars: 4,
    quote:
      "Smooth kick, clean label, gorgeous can on the desk. Orange beats everything else they make — I just wish it came in bigger packs.",
  },
] as const;

// share of each star level across all reviews (weighted average ≈ 4.9)
const RATING_DIST = [
  { stars: 5, pct: 91 },
  { stars: 4, pct: 6 },
  { stars: 3, pct: 2 },
  { stars: 2, pct: 0.6 },
  { stars: 1, pct: 0.4 },
] as const;

/* ------------------------------------------------------------------ */
/* Shared soda-fizz bubble background — Products & Reviews pages.   */
/* Bubbles rise like carbonation and dodge away from the cursor.    */
/* Returns a cleanup function.                                      */
/* ------------------------------------------------------------------ */
function runBubbleCanvas(
  canvas: HTMLCanvasElement,
  reducedMotion: boolean,
  activityRef: { current: number },
): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
  let w = 0;
  let h = 0;
  let raf = 0;
  let last = 0;
  let frameSkip = false;
  let mx = -1e4;
  let my = -1e4;
  let mouseIn = false;

  let bubbles: {
    x: number;
    y: number;
    r: number;
    rise: number;
    sp: number;
    ph: number;
    a: number;
    rvx: number;
    rvy: number;
  }[] = [];

  const build = () => {
    const parent = canvas.parentElement;
    if (!parent) return;
    w = parent.clientWidth;
    h = parent.clientHeight;
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const count = Math.min(Math.max(Math.floor((w * h) / 11000), 34), 120);
    bubbles = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.pow(Math.random(), 1.8) * 6.5 + 1,
      rise: 0,
      sp: 1 + Math.random() * 2.4,
      ph: Math.random() * Math.PI * 2,
      a: Math.random() * 0.4 + 0.3,
      rvx: 0,
      rvy: 0,
    }));
    for (const b of bubbles) {
      // small fizz rises fastest; big bubbles drift slower
      b.rise = Math.max(10, 30 + Math.random() * 55 + (5 - b.r) * 7);
    }
  };

  const drawBubble = (b: (typeof bubbles)[number], t: number) => {
    const cx = b.x + Math.cos(t * b.sp + b.ph) * b.r * 0.9;
    // glassy highlight
    ctx.globalAlpha = b.a * 0.85;
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.beginPath();
    ctx.arc(cx - b.r * 0.35, b.y - b.r * 0.35, Math.max(0.6, b.r * 0.22), 0, Math.PI * 2);
    ctx.fill();
    // crisp fizz rim
    ctx.globalAlpha = b.a * 0.5;
    ctx.strokeStyle = "#b8ffd4";
    ctx.lineWidth = b.r > 3 ? 1.1 : 0.7;
    ctx.beginPath();
    ctx.arc(cx, b.y, b.r, 0, Math.PI * 2);
    ctx.stroke();
    // faint body
    ctx.globalAlpha = b.a * 0.08;
    ctx.fillStyle = "#9dffc2";
    ctx.beginPath();
    ctx.arc(cx, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawOnce = () => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const t = 1.2;
    for (const b of bubbles) drawBubble(b, t);
    ctx.globalAlpha = 1;
  };

  const tick = (now: number) => {
    // Pause while the section is off-screen; scroll restarts us.
    const vr = canvas.getBoundingClientRect();
    if (vr.bottom < -80 || vr.top > window.innerHeight + 80) {
      raf = 0;
      return;
    }
    if (!last) last = now;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const t = now / 1000;
    // Idle freeze: the glass cards use an SVG displacement backdrop filter that
    // re-runs on the CPU whenever this canvas repaints. When the user hasn't
    // scrolled or moved the pointer recently, hold the last frame (no draw, no
    // filter invalidation) and cheaply re-check; any activity restarts the fizz.
    if (now - activityRef.current > 2600) {
      raf = requestAnimationFrame(tick);
      return;
    }
    // Ambient background: render every other frame
    frameSkip = !frameSkip;
    if (frameSkip) {
      raf = requestAnimationFrame(tick);
      return;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // pointer position inside this section
    let px = mx;
    let py = my;
    let rect: DOMRect | null = null;
    if (mouseIn) {
      rect = canvas.getBoundingClientRect();
      px = mx - rect.left;
      py = my - rect.top;
    }

    const damp = Math.exp(-dt * 2.6);

    for (const b of bubbles) {
      // natural upward fizz
      b.y -= b.rise * dt;

      // cursor repulsion: bubbles glide away from the pointer
      if (mouseIn && rect) {
        const dx = b.x - px;
        const dy = b.y - py;
        const dist2 = dx * dx + dy * dy;
        const radius = 90 + b.r * 10;
        if (dist2 < radius * radius && dist2 > 0.01) {
          const dist = Math.sqrt(dist2);
          const f = 1 - dist / radius;
          const push = f * f * 2400 * dt;
          b.rvx += (dx / dist) * push;
          b.rvy += (dy / dist) * push;
        }
      }

      b.rvx *= damp;
      b.rvy *= damp;
      const speed = Math.hypot(b.rvx, b.rvy);
      const cap = 380;
      if (speed > cap) {
        b.rvx = (b.rvx / speed) * cap;
        b.rvy = (b.rvy / speed) * cap;
      }
      b.x += b.rvx * dt;
      b.y += b.rvy * dt;

      if (b.y < -10) {
        // resurface at the bottom like fresh carbonation
        b.y = h + 10 + Math.random() * 40;
        b.x = Math.random() * w;
        b.rvx = 0;
        b.rvy = 0;
      }
      if (b.x < -10) b.x = w + 10;
      else if (b.x > w + 10) b.x = -10;

      drawBubble(b, t);
    }
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(tick);
  };

  const onMove = (e: PointerEvent) => {
    mx = e.clientX;
    my = e.clientY;
    mouseIn = true;
  };
  const onLeave = () => {
    mouseIn = false;
  };

  const restart = () => {
    if (!raf) raf = requestAnimationFrame(tick);
  };
  window.addEventListener("scroll", restart, { passive: true });

  build();
  if (reducedMotion) {
    drawOnce();
  } else {
    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave, { passive: true });
    raf = requestAnimationFrame(tick);
  }
  const onResize = () => {
    build();
    if (reducedMotion) drawOnce();
  };
  window.addEventListener("resize", onResize);
  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("scroll", restart);
    window.removeEventListener("resize", onResize);
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerleave", onLeave);
  };
}

export default function Home() {
  const sectionRef = useRef<HTMLElement>(null);
  const nutritionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameImagesRef = useRef<(HTMLImageElement | null)[]>([]);
  const rafRef = useRef<number | null>(null);
  const targetProgressRef = useRef(0);
  const displayedProgressRef = useRef(0);
  const [progress, setProgress] = useState(0);
  const [soundOn, setSoundOn] = useState(false);
  const liqRef = useRef<LiquidTransitionHandle>(null);
  const lerpStopRef = useRef<(() => void) | null>(null);
  // Set while the 360 viewer overlay is open so the cinematic wheel-lerp
  // stands down and the overlay's own scroller receives native wheel input.
  const expOpenRef = useRef(false);
  const [loadedFrames, setLoadedFrames] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [nutritionVisible, setNutritionVisible] = useState(false);

  // ---- Products page: can selector carousel ----
  const [canIdx, setCanIdx] = useState(0);
  const [prevCanIdx, setPrevCanIdx] = useState<number | null>(null);
  const [canDir, setCanDir] = useState(1);
  const [canHover, setCanHover] = useState(false);
  const [canAutoTick, setCanAutoTick] = useState(0);
  const [canSectionVisible, setCanSectionVisible] = useState(false);

  // live mirrors so the auto-rotate timer never reads stale state
  const canIdxRef = useRef(0);
  const prevCanRef = useRef<number | null>(null);
  useEffect(() => {
    canIdxRef.current = canIdx;
  }, [canIdx]);
  useEffect(() => {
    prevCanRef.current = prevCanIdx;
  }, [prevCanIdx]);

  const selectCan = (index: number) => {
    if (index === canIdx || prevCanIdx !== null) return;
    setCanDir(index > canIdx ? 1 : -1);
    setPrevCanIdx(canIdx);
    setCanIdx(index);
    setCanAutoTick((t) => t + 1); // restart the auto-rotate countdown after a manual pick
  };

  const stepCan = (delta: number) => {
    if (prevCanIdx !== null) return;
    selectCan((canIdx + delta + products.length) % products.length);
  };

  // ---- Product lineup cards: 3D tilt + glare that follows the cursor ----
  const tiltCards = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch") return;
    const grid = e.currentTarget;
    for (const el of Array.from(grid.querySelectorAll<HTMLElement>(".volt-product"))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const relX = (e.clientX - r.left) / r.width;
      const relY = (e.clientY - r.top) / r.height;
      // glare position
      el.style.setProperty("--gx", `${(relX * 100).toFixed(1)}%`);
      el.style.setProperty("--gy", `${(relY * 100).toFixed(1)}%`);
      // subtle 3D tilt (degrees), toward the cursor
      el.style.setProperty("--rx", `${((0.5 - relY) * 10).toFixed(2)}deg`);
      el.style.setProperty("--ry", `${((relX - 0.5) * 12).toFixed(2)}deg`);
    }
  };

  const flattenCards = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch") return;
    const grid = e.currentTarget;
    for (const el of Array.from(grid.querySelectorAll<HTMLElement>(".volt-product"))) {
      el.style.setProperty("--rx", "0deg");
      el.style.setProperty("--ry", "0deg");
    }
  };

  const autoAdvance = () => {
    if (prevCanRef.current !== null) return;
    const next = (canIdxRef.current + 1) % products.length;
    setCanDir(1);
    setPrevCanIdx(canIdxRef.current);
    setCanIdx(next);
  };

  // auto-rotate: only while the section is visible, not hovered, and motion is allowed
  useEffect(() => {
    if (reducedMotion || !canSectionVisible || canHover) return;
    const id = window.setInterval(autoAdvance, 4200);
    return () => window.clearInterval(id);
  }, [reducedMotion, canSectionVisible, canHover, canAutoTick]);

  // watch whether the products section is on screen
  useEffect(() => {
    const el = document.getElementById("products");
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setCanSectionVisible(entry.isIntersecting), {
      threshold: 0.05,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // staggered reveal-on-scroll for the products & reviews layouts
  useEffect(() => {
    const els = Array.from(document.querySelectorAll(".volt-reveal"));
    if (!els.length) return;
    if (reducedMotion) {
      els.forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14, rootMargin: "0px 0px -6% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [reducedMotion]);

  // ---- Second-section (nutrition-left-panel) scroll canvas ----
  const nutritionSectionRef = useRef<HTMLElement>(null);
  const sec2CanvasRef = useRef<HTMLCanvasElement>(null);
  const sec2FrameImagesRef = useRef<(HTMLImageElement | null)[]>([]);
  const sec2RafRef = useRef<number | null>(null);
  const sec2TargetRef = useRef(0);
  const sec2DisplayRef = useRef(0);
  const [sec2Progress, setSec2Progress] = useState(0);
  const [sec2Loaded, setSec2Loaded] = useState(0);
  const [isScrolled, setIsScrolled] = useState(false);
  const particleContainerRef = useRef<HTMLDivElement>(null);

  // ---- Third section (about) scroll canvas ----
  const aboutSectionRef = useRef<HTMLElement>(null);
  const aboutCanvasRef = useRef<HTMLCanvasElement>(null);
  const aboutFrameImagesRef = useRef<(HTMLImageElement | null)[]>([]);
  const aboutRafRef = useRef<number | null>(null);
  const aboutTargetRef = useRef(0);
  const aboutDisplayRef = useRef(0);
  const [aboutProgress, setAboutProgress] = useState(0);
  const [aboutLoaded, setAboutLoaded] = useState(0);
  const productsBubblesRef = useRef<HTMLCanvasElement>(null);
  const bubblesRef = useRef<HTMLCanvasElement>(null);

  // ---- Fourth section (strike can) scroll canvas ----
  const strikeSectionRef = useRef<HTMLElement>(null);
  const strikeCanvasRef = useRef<HTMLCanvasElement>(null);
  const strikeFrameImagesRef = useRef<(HTMLImageElement | null)[]>([]);
  const strikeRafRef = useRef<number | null>(null);
  const strikeTargetRef = useRef(0);
  const strikeDisplayRef = useRef(0);
  const [strikeProgress, setStrikeProgress] = useState(0);
  const [strikeLoaded, setStrikeLoaded] = useState(0);

  // ---- Factory scroll-canvas sequence ----
  const factorySectionRef = useRef<HTMLElement>(null);
  const factoryCanvasRef = useRef<HTMLCanvasElement>(null);
  const factoryFrameImagesRef = useRef<(HTMLImageElement | null)[]>([]);
  const factoryRafRef = useRef<number | null>(null);
  const factoryTargetRef = useRef(0);
  const factoryDisplayRef = useRef(0);
  const [factoryProgress, setFactoryProgress] = useState(0);
  const [factoryLoaded, setFactoryLoaded] = useState(0);
  // Factory film — on-demand overlay (opened only from the end-menu).
  const [factoryOpen, setFactoryOpen] = useState(false);
  const factoryOpenRef = useRef(false);
  const factoryScroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncReducedMotion = () => setReducedMotion(mediaQuery.matches);
    syncReducedMotion();
    mediaQuery.addEventListener("change", syncReducedMotion);
    return () => mediaQuery.removeEventListener("change", syncReducedMotion);
  }, []);

  // ---- Interactive soda-fizz bubble background (Products + Reviews) ----
  // Bubbles float upward like carbonation and gently dodge away from the cursor.
  const bubbleActivityRef = useRef(0);

  useEffect(() => {
    const canvas = productsBubblesRef.current;
    if (!canvas) return;
    return runBubbleCanvas(canvas, reducedMotion, bubbleActivityRef);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  useEffect(() => {
    const canvas = bubblesRef.current;
    if (!canvas) return;
    return runBubbleCanvas(canvas, reducedMotion, bubbleActivityRef);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  // Pointer moves / presses keep the fizz alive; after a quiet beat it freezes
  // so the glass displacement filters stay cached (see idle freeze in the tick).
  useEffect(() => {
    const poke = () => {
      bubbleActivityRef.current = performance.now();
    };
    window.addEventListener("pointermove", poke, { passive: true });
    window.addEventListener("pointerdown", poke, { passive: true });
    return () => {
      window.removeEventListener("pointermove", poke);
      window.removeEventListener("pointerdown", poke);
    };
  }, []);

  // While the page is actively scrolling, mark it so the glass surfaces ease
  // onto cheap GPU blur (scroll motion re-rasterizes the SVG displacement on
  // the CPU every frame); the liquid look returns once scrolling stops.
  useEffect(() => {
    let idleTimer: number | undefined;
    const markScrolling = () => {
      bubbleActivityRef.current = performance.now();
      document.body.classList.add("volt-is-scrolling");
      if (idleTimer !== undefined) window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        document.body.classList.remove("volt-is-scrolling");
      }, 260);
    };
    window.addEventListener("scroll", markScrolling, { passive: true });
    return () => {
      window.removeEventListener("scroll", markScrolling);
      if (idleTimer !== undefined) window.clearTimeout(idleTimer);
    };
  }, []);

  // ---- Track scroll for navbar shape: pill when scrolled past hero ----
  useEffect(() => {
    const handleScroll = () => {
      // Hero is 240vh; transition happens ~85% through
      const heroEnd = window.innerHeight * 2.4 * 0.85;
      setIsScrolled(window.scrollY > heroEnd);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // ---- Cinematic lerp smooth scroll (slower, fluid wheel scrolling) ----
  useEffect(() => {
    if (reducedMotion) return;
    // Keep native touch / trackpad momentum on touch devices
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    if (!finePointer) return;

    let targetY = window.scrollY;
    let currentY = window.scrollY;
    let rafId: number | null = null;
    let animating = false;
    // Responsive cinematic feel: a brisk ease that stays one rAF per frame so
    // the page tracks the wheel at full 60fps. A per-frame step cap keeps fast
    // wheel flicks from teleporting, while the stronger catch-up ends the glide
    // almost immediately after the wheel stops (no rubber-band tail).
    const EASE = 0.14;
    const MAX_STEP = 140;

    const maxScroll = () =>
      Math.max(document.documentElement.scrollHeight - window.innerHeight, 0);

    const tick = () => {
      const diff = targetY - currentY;
      let step = diff * EASE;
      if (step > MAX_STEP) step = MAX_STEP;
      else if (step < -MAX_STEP) step = -MAX_STEP;
      currentY += step;
      if (Math.abs(diff) < 0.5) {
        currentY = targetY;
        window.scrollTo({ top: currentY, behavior: "instant" as ScrollBehavior });
        animating = false;
        rafId = null;
        return;
      }
      window.scrollTo({ top: currentY, behavior: "instant" as ScrollBehavior });
      rafId = requestAnimationFrame(tick);
    };

    const start = () => {
      if (!animating) {
        animating = true;
        rafId = requestAnimationFrame(tick);
      }
    };

    // Hard stop: cancel any in-flight easing and resync to where the page
    // actually is, so an instant nav jump isn't dragged back by the lerp.
    const stop = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
      animating = false;
      targetY = window.scrollY;
      currentY = window.scrollY;
    };
    lerpStopRef.current = stop;

    const onWheel = (e: WheelEvent) => {
      // While the 360 viewer or factory overlay is open it owns its own
      // internal scroller — let the browser handle wheel input natively.
      if (expOpenRef.current || factoryOpenRef.current) return;
      e.preventDefault();
      targetY += e.deltaY;
      targetY = Math.min(Math.max(targetY, 0), maxScroll());
      start();
    };

    // Keep target in sync when scrolling natively (keyboard, scrollbar, anchor jumps)
    const onScroll = () => {
      if (!animating) {
        targetY = window.scrollY;
        currentY = window.scrollY;
      }
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (lerpStopRef.current === stop) lerpStopRef.current = null;
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("scroll", onScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [reducedMotion]);

  // ---- Nav clicks: green particles -> liquid sweep -> jump to section -> reveal ----
  const liqBusyRef = useRef(false);
  // Points at the latest open360 so the (once-mounted) nav listener can open
  // the immersive About experience when the ABOUT link is clicked.
  const open360Ref = useRef<(() => void) | null>(null);
  useEffect(() => {
    let lastSpawn = 0;
    const handleClick = (e: Event) => {
      if (liqBusyRef.current) return;
      const target = (e.target as HTMLElement)?.closest?.('.volt-nav-link, .volt-nav-brand');
      if (!target) return;
      const href = (target as HTMLAnchorElement).getAttribute('href');
      if (!href || !href.startsWith('#')) return;
      e.preventDefault();

      // About Volt -> the immersive 3D About experience (same overlay as the
      // film-page CTA), not a scroll.
      if (href === '#aboutvolt') {
        open360Ref.current?.();
        return;
      }

      const now = Date.now();
      if (now - lastSpawn >= 300) {
        lastSpawn = now;
        const rect = target.getBoundingClientRect();
        spawnParticles(rect.left + rect.width / 2, rect.top + rect.height / 2);
      }

      const jumpTo = () => {
        // Kill the cinematic lerp so its easing loop can't drag the page back
        // after the instant jump underneath the liquid cover.
        lerpStopRef.current?.();
        const section = document.querySelector<HTMLElement>(href);
        if (section) {
          window.scrollTo({
            top: section.getBoundingClientRect().top + window.scrollY,
            behavior: "instant" as ScrollBehavior,
          });
        }
      };

      const liq = liqRef.current;
      if (!liq) {
        jumpTo();
        return;
      }
      liqBusyRef.current = true;
      liq.play(jumpTo, () => {
        liqBusyRef.current = false;
      });
    };
    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, []);

  useEffect(() => {
    const section = nutritionRef.current;
    if (!section) return;
    if (reducedMotion) {
      setNutritionVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setNutritionVisible(entry.isIntersecting),
      { threshold: 0.18 },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, [reducedMotion]);

  // ---- Load hero frames ----
  useEffect(() => {
    let cancelled = false;
    let nextBatchTimer: number | undefined;
    const images: (HTMLImageElement | null)[] = FRAME_SOURCES.map(() => null);
    frameImagesRef.current = images;

    const loadFrame = (index: number) => {
      if (cancelled || images[index]) return;
      const image = new Image();
      image.decoding = "async";
      image.fetchPriority = index === 0 ? "high" : "low";
      image.onload = () => {
        if (cancelled) return;
        images[index] = image;
        frameImagesRef.current[index] = image;
        setLoadedFrames((current) => current + 1);
      };
      image.onerror = () => {
        if (!cancelled && index !== 0) {
          images[index] = images[0];
          frameImagesRef.current[index] = images[0];
        }
      };
      image.src = FRAME_SOURCES[index];
    };

    loadFrame(0);
    let batchStart = 1;
    const loadNextBatch = () => {
      const batchEnd = Math.min(batchStart + 14, FRAME_SOURCES.length);
      for (let index = batchStart; index < batchEnd; index += 1) loadFrame(index);
      batchStart = batchEnd;
      if (batchStart < FRAME_SOURCES.length) {
        nextBatchTimer = window.setTimeout(loadNextBatch, 80);
      }
    };
    nextBatchTimer = window.setTimeout(loadNextBatch, 80);

    return () => {
      cancelled = true;
      if (nextBatchTimer) window.clearTimeout(nextBatchTimer);
      images.forEach((image) => {
        if (image) {
          image.onload = null;
          image.onerror = null;
        }
      });
    };
  }, []);

  const sec2Near = useNearViewport(nutritionSectionRef);
  const aboutNear = useNearViewport(aboutSectionRef);
  const strikeNear = useNearViewport(strikeSectionRef);
  const factoryNear = useNearViewport(factorySectionRef);

  // ---- Load second-section frames (deferred until the section nears the viewport) ----
  useEffect(() => {
    if (!sec2Near) return;
    let cancelled = false;
    let nextBatchTimer: number | undefined;
    const images: (HTMLImageElement | null)[] = SECTION2_FRAME_SOURCES.map(() => null);
    sec2FrameImagesRef.current = images;

    const loadFrame = (index: number) => {
      if (cancelled || images[index]) return;
      const image = new Image();
      image.decoding = "async";
      image.fetchPriority = index === 0 ? "high" : "low";
      image.onload = () => {
        if (cancelled) return;
        images[index] = image;
        sec2FrameImagesRef.current[index] = image;
        setSec2Loaded((c) => c + 1);
      };
      image.onerror = () => {
        if (!cancelled && index !== 0) {
          images[index] = images[0];
          sec2FrameImagesRef.current[index] = images[0];
        }
      };
      image.src = SECTION2_FRAME_SOURCES[index];
    };

    loadFrame(0);
    let batchStart = 1;
    const loadNextBatch = () => {
      const batchEnd = Math.min(batchStart + 14, SECTION2_FRAME_SOURCES.length);
      for (let i = batchStart; i < batchEnd; i += 1) loadFrame(i);
      batchStart = batchEnd;
      if (batchStart < SECTION2_FRAME_SOURCES.length) {
        nextBatchTimer = window.setTimeout(loadNextBatch, 80);
      }
    };
    nextBatchTimer = window.setTimeout(loadNextBatch, 80);

    return () => {
      cancelled = true;
      if (nextBatchTimer) window.clearTimeout(nextBatchTimer);
      images.forEach((img) => {
        if (img) {
          img.onload = null;
          img.onerror = null;
        }
      });
    };
  }, [sec2Near]);

  // ---- Load third-section (about) frames (deferred until the section nears the viewport) ----
  useEffect(() => {
    if (!aboutNear) return;
    let cancelled = false;
    let nextBatchTimer: number | undefined;
    const images: (HTMLImageElement | null)[] = ABOUT_FRAME_SOURCES.map(() => null);
    aboutFrameImagesRef.current = images;

    const loadFrame = (index: number) => {
      if (cancelled || images[index]) return;
      const image = new Image();
      image.decoding = "async";
      image.fetchPriority = index === 0 ? "high" : "low";
      image.onload = () => {
        if (cancelled) return;
        images[index] = image;
        aboutFrameImagesRef.current[index] = image;
        setAboutLoaded((c) => c + 1);
      };
      image.onerror = () => {
        if (!cancelled && index !== 0) {
          images[index] = images[0];
          aboutFrameImagesRef.current[index] = images[0];
        }
      };
      image.src = ABOUT_FRAME_SOURCES[index];
    };

    loadFrame(0);
    let batchStart = 1;
    const loadNextBatch = () => {
      const batchEnd = Math.min(batchStart + 14, ABOUT_FRAME_SOURCES.length);
      for (let i = batchStart; i < batchEnd; i += 1) loadFrame(i);
      batchStart = batchEnd;
      if (batchStart < ABOUT_FRAME_SOURCES.length) {
        nextBatchTimer = window.setTimeout(loadNextBatch, 80);
      }
    };
    nextBatchTimer = window.setTimeout(loadNextBatch, 80);

    return () => {
      cancelled = true;
      if (nextBatchTimer) window.clearTimeout(nextBatchTimer);
      images.forEach((img) => {
        if (img) {
          img.onload = null;
          img.onerror = null;
        }
      });
    };
  }, [aboutNear]);

  // ---- Load fourth-section (strike) frames (deferred until the section nears the viewport) ----
  useEffect(() => {
    if (!strikeNear) return;
    let cancelled = false;
    let nextBatchTimer: number | undefined;
    const images: (HTMLImageElement | null)[] = STRIKE_FRAME_SOURCES.map(() => null);
    strikeFrameImagesRef.current = images;

    const loadFrame = (index: number) => {
      if (cancelled || images[index]) return;
      const image = new Image();
      image.decoding = "async";
      image.fetchPriority = index === 0 ? "high" : "low";
      image.onload = () => {
        if (cancelled) return;
        images[index] = image;
        strikeFrameImagesRef.current[index] = image;
        setStrikeLoaded((c) => c + 1);
      };
      image.onerror = () => {
        if (!cancelled && index !== 0) {
          images[index] = images[0];
          strikeFrameImagesRef.current[index] = images[0];
        }
      };
      image.src = STRIKE_FRAME_SOURCES[index];
    };

    loadFrame(0);
    let batchStart = 1;
    const loadNextBatch = () => {
      const batchEnd = Math.min(batchStart + 14, STRIKE_FRAME_SOURCES.length);
      for (let i = batchStart; i < batchEnd; i += 1) loadFrame(i);
      batchStart = batchEnd;
      if (batchStart < STRIKE_FRAME_SOURCES.length) {
        nextBatchTimer = window.setTimeout(loadNextBatch, 80);
      }
    };
    nextBatchTimer = window.setTimeout(loadNextBatch, 80);

    return () => {
      cancelled = true;
      if (nextBatchTimer) window.clearTimeout(nextBatchTimer);
      images.forEach((img) => {
        if (img) {
          img.onload = null;
          img.onerror = null;
        }
      });
    };
  }, [strikeNear]);

  // ---- Load factory frames (deferred until the section nears the viewport) ----
  useEffect(() => {
    if (!factoryNear) return;
    let cancelled = false;
    let nextBatchTimer: number | undefined;
    const images: (HTMLImageElement | null)[] = FACTORY_FRAME_SOURCES.map(() => null);
    factoryFrameImagesRef.current = images;

    const loadFrame = (index: number) => {
      if (cancelled || images[index]) return;
      const image = new Image();
      image.decoding = "async";
      image.fetchPriority = index === 0 ? "high" : "low";
      image.onload = () => {
        if (cancelled) return;
        images[index] = image;
        factoryFrameImagesRef.current[index] = image;
        setFactoryLoaded((c) => c + 1);
      };
      image.onerror = () => {
        if (!cancelled && index !== 0) {
          images[index] = images[0];
          factoryFrameImagesRef.current[index] = images[0];
        }
      };
      image.src = FACTORY_FRAME_SOURCES[index];
    };

    loadFrame(0);
    let batchStart = 1;
    const loadNextBatch = () => {
      const batchEnd = Math.min(batchStart + 14, FACTORY_FRAME_SOURCES.length);
      for (let i = batchStart; i < batchEnd; i += 1) loadFrame(i);
      batchStart = batchEnd;
      if (batchStart < FACTORY_FRAME_SOURCES.length) {
        nextBatchTimer = window.setTimeout(loadNextBatch, 80);
      }
    };
    nextBatchTimer = window.setTimeout(loadNextBatch, 80);

    return () => {
      cancelled = true;
      if (nextBatchTimer) window.clearTimeout(nextBatchTimer);
      images.forEach((img) => {
        if (img) {
          img.onload = null;
          img.onerror = null;
        }
      });
    };
  }, [factoryNear]);

  // ---- Hero canvas render loop ----
  useEffect(() => {
    const canvas = canvasRef.current;
    const section = sectionRef.current;
    if (!canvas || !section) return;
    let lastHeroDrawn = -1;
    let lastHeroPct = -1;

    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    const render = () => {
      const rect = section.getBoundingClientRect();
      // Pause when far off-screen — the scroll listener restarts us on the way back.
      if (rect.bottom < -160 || rect.top > window.innerHeight + 160) {
        rafRef.current = null;
        return;
      }
      const scrollableDistance = Math.max(section.offsetHeight - window.innerHeight, 1);
      const rawProgress = clamp(-rect.top / scrollableDistance, 0, 1);
      targetProgressRef.current = reducedMotion ? rawProgress : rawProgress;

      const difference = targetProgressRef.current - displayedProgressRef.current;
      displayedProgressRef.current = reducedMotion
        ? targetProgressRef.current
        : displayedProgressRef.current + difference * 0.11;
      const nextProgress = displayedProgressRef.current;

      const frameIndex = Math.round(nextProgress * (FRAME_SOURCES.length - 1));
      const pct = Math.round(nextProgress * 100);
      if (pct !== lastHeroPct) {
        lastHeroPct = pct;
        if (Math.abs(difference) > 0.0005 || reducedMotion) {
          setProgress(nextProgress);
        }
      }
      const image = frameImagesRef.current[frameIndex] ?? frameImagesRef.current[0];
      let drew = false;
      if (image && image.naturalWidth > 0) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const width = window.innerWidth;
        const height = window.innerHeight;
        const pixelWidth = Math.floor(width * dpr);
        const pixelHeight = Math.floor(height * dpr);
        if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
          canvas.width = pixelWidth;
          canvas.height = pixelHeight;
          canvas.style.width = `${width}px`;
          canvas.style.height = `${height}px`;
        }

        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        context.fillStyle = "#07150f";
        context.fillRect(0, 0, width, height);

        const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
        const drawWidth = image.naturalWidth * scale;
        const drawHeight = image.naturalHeight * scale;
        const drawX = (width - drawWidth) / 2;
        const drawY = (height - drawHeight) / 2;
        context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
        drew = true;
      }
      if (drew && Math.abs(difference) <= 0.0005 && frameIndex === lastHeroDrawn) {
        rafRef.current = null;
        return;
      }
      lastHeroDrawn = frameIndex;
      rafRef.current = window.requestAnimationFrame(render);
    };

    const onScroll = () => {
      if (rafRef.current === null) rafRef.current = window.requestAnimationFrame(render);
    };
    const onResize = () => {
      if (rafRef.current === null) rafRef.current = window.requestAnimationFrame(render);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    rafRef.current = window.requestAnimationFrame(render);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [reducedMotion]);

  // ---- Second-section canvas render loop ----
  useEffect(() => {
    const canvas = sec2CanvasRef.current;
    const section = nutritionSectionRef.current;
    if (!canvas || !section) return;
    let lastSec2Drawn = -1;
    let lastSec2Pct = -1;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    const render = () => {
      const rect = section.getBoundingClientRect();
      // Pause when far off-screen — the scroll listener restarts us on the way back.
      if (rect.bottom < -160 || rect.top > window.innerHeight + 160) {
        sec2RafRef.current = null;
        return;
      }
      const scrollable = Math.max(section.offsetHeight - window.innerHeight, 1);
      const raw = clamp(-rect.top / scrollable, 0, 1);
      sec2TargetRef.current = raw;
      const diff = sec2TargetRef.current - sec2DisplayRef.current;
      sec2DisplayRef.current += diff * 0.11;
      const p = sec2DisplayRef.current;
      const pct = Math.round(p * 100);
      if (pct !== lastSec2Pct) {
        lastSec2Pct = pct;
        if (Math.abs(diff) > 0.0005) setSec2Progress(p);
      }

      const idx = Math.round(p * (SECTION2_FRAME_SOURCES.length - 1));
      const img = sec2FrameImagesRef.current[idx] ?? sec2FrameImagesRef.current[0];
      let drew = false;
      if (img && img.naturalWidth > 0) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = canvas.parentElement?.clientWidth ?? 400;
        const h = canvas.parentElement?.clientHeight ?? 600;
        const pw = Math.floor(w * dpr);
        const ph = Math.floor(h * dpr);
        if (canvas.width !== pw || canvas.height !== ph) {
          canvas.width = pw;
          canvas.height = ph;
          canvas.style.width = `${w}px`;
          canvas.style.height = `${h}px`;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = "#07150f";
        ctx.fillRect(0, 0, w, h);
        const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
        const dw = img.naturalWidth * scale;
        const dh = img.naturalHeight * scale;
        ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
        drew = true;
      }
      if (drew && Math.abs(diff) <= 0.0005 && idx === lastSec2Drawn) {
        sec2RafRef.current = null;
        return;
      }
      lastSec2Drawn = idx;
      sec2RafRef.current = requestAnimationFrame(render);
    };

    const onScroll = () => {
      if (sec2RafRef.current === null) sec2RafRef.current = requestAnimationFrame(render);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    sec2RafRef.current = requestAnimationFrame(render);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (sec2RafRef.current !== null) cancelAnimationFrame(sec2RafRef.current);
      sec2RafRef.current = null;
    };
  }, []);

  // ---- Third-section (about) canvas render loop ----
  useEffect(() => {
    const canvas = aboutCanvasRef.current;
    const section = aboutSectionRef.current;
    if (!canvas || !section) return;
    let lastAboutDrawn = -1;
    let lastAboutPct = -1;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    const render = () => {
      const rect = section.getBoundingClientRect();
      // Pause when far off-screen — the scroll listener restarts us on the way back.
      if (rect.bottom < -160 || rect.top > window.innerHeight + 160) {
        aboutRafRef.current = null;
        return;
      }
      const scrollable = Math.max(section.offsetHeight - window.innerHeight, 1);
      const raw = clamp(-rect.top / scrollable, 0, 1);
      aboutTargetRef.current = raw;
      const diff = aboutTargetRef.current - aboutDisplayRef.current;
      aboutDisplayRef.current += diff * 0.11;
      const p = aboutDisplayRef.current;
      const pct = Math.round(p * 100);
      if (pct !== lastAboutPct) {
        lastAboutPct = pct;
        if (Math.abs(diff) > 0.0005) setAboutProgress(p);
      }

      const idx = Math.round(p * (ABOUT_FRAME_SOURCES.length - 1));
      const img = aboutFrameImagesRef.current[idx] ?? aboutFrameImagesRef.current[0];
      let drew = false;
      if (img && img.naturalWidth > 0) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = canvas.parentElement?.clientWidth ?? 400;
        const h = canvas.parentElement?.clientHeight ?? 600;
        const pw = Math.floor(w * dpr);
        const ph = Math.floor(h * dpr);
        if (canvas.width !== pw || canvas.height !== ph) {
          canvas.width = pw;
          canvas.height = ph;
          canvas.style.width = `${w}px`;
          canvas.style.height = `${h}px`;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = "#07150f";
        ctx.fillRect(0, 0, w, h);
        const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
        const dw = img.naturalWidth * scale;
        const dh = img.naturalHeight * scale;
        ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
        drew = true;
      }
      if (drew && Math.abs(diff) <= 0.0005 && idx === lastAboutDrawn) {
        aboutRafRef.current = null;
        return;
      }
      lastAboutDrawn = idx;
      aboutRafRef.current = requestAnimationFrame(render);
    };

    const onScroll = () => {
      if (aboutRafRef.current === null) aboutRafRef.current = requestAnimationFrame(render);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    aboutRafRef.current = requestAnimationFrame(render);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (aboutRafRef.current !== null) cancelAnimationFrame(aboutRafRef.current);
      aboutRafRef.current = null;
    };
  }, []);

  // ---- Fourth-section (strike) canvas render loop ----
  useEffect(() => {
    const canvas = strikeCanvasRef.current;
    const section = strikeSectionRef.current;
    if (!canvas || !section) return;
    let lastStrikeDrawn = -1;
    let lastStrikePct = -1;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    const render = () => {
      const rect = section.getBoundingClientRect();
      // Pause when far off-screen — the scroll listener restarts us on the way back.
      if (rect.bottom < -160 || rect.top > window.innerHeight + 160) {
        strikeRafRef.current = null;
        return;
      }
      const scrollable = Math.max(section.offsetHeight - window.innerHeight, 1);
      const raw = clamp(-rect.top / scrollable, 0, 1);
      strikeTargetRef.current = raw;
      const diff = strikeTargetRef.current - strikeDisplayRef.current;
      strikeDisplayRef.current += diff * 0.11;
      const p = strikeDisplayRef.current;
      const pct = Math.round(p * 100);
      if (pct !== lastStrikePct) {
        lastStrikePct = pct;
        if (Math.abs(diff) > 0.0005) setStrikeProgress(p);
      }

      const idx = Math.round(p * (STRIKE_FRAME_SOURCES.length - 1));
      const img = strikeFrameImagesRef.current[idx] ?? strikeFrameImagesRef.current[0];
      let drew = false;
      if (img && img.naturalWidth > 0) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = canvas.parentElement?.clientWidth ?? 400;
        const h = canvas.parentElement?.clientHeight ?? 600;
        const pw = Math.floor(w * dpr);
        const ph = Math.floor(h * dpr);
        if (canvas.width !== pw || canvas.height !== ph) {
          canvas.width = pw;
          canvas.height = ph;
          canvas.style.width = `${w}px`;
          canvas.style.height = `${h}px`;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = "#07150f";
        ctx.fillRect(0, 0, w, h);
        const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
        const dw = img.naturalWidth * scale;
        const dh = img.naturalHeight * scale;
        ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
        drew = true;
      }
      if (drew && Math.abs(diff) <= 0.0005 && idx === lastStrikeDrawn) {
        strikeRafRef.current = null;
        return;
      }
      lastStrikeDrawn = idx;
      strikeRafRef.current = requestAnimationFrame(render);
    };

    const onScroll = () => {
      if (strikeRafRef.current === null) strikeRafRef.current = requestAnimationFrame(render);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    strikeRafRef.current = requestAnimationFrame(render);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (strikeRafRef.current !== null) cancelAnimationFrame(strikeRafRef.current);
      strikeRafRef.current = null;
    };
  }, []);

  // ---- Factory canvas render loop ----
  useEffect(() => {
    const canvas = factoryCanvasRef.current;
    const section = factorySectionRef.current;
    if (!canvas || !section) return;
    let lastFactoryDrawn = -1;
    let lastFactoryPct = -1;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    const render = () => {
      const rect = section.getBoundingClientRect();
      // Pause when far off-screen — the scroll listener restarts us on the way back.
      if (rect.bottom < -160 || rect.top > window.innerHeight + 160) {
        factoryRafRef.current = null;
        return;
      }
      const scrollable = Math.max(section.offsetHeight - window.innerHeight, 1);
      const raw = clamp(-rect.top / scrollable, 0, 1);
      factoryTargetRef.current = raw;
      const diff = factoryTargetRef.current - factoryDisplayRef.current;
      factoryDisplayRef.current += diff * 0.11;
      const p = factoryDisplayRef.current;
      const pct = Math.round(p * 100);
      if (pct !== lastFactoryPct) {
        lastFactoryPct = pct;
        if (Math.abs(diff) > 0.0005) setFactoryProgress(p);
      }

      const idx = Math.round(p * (FACTORY_FRAME_SOURCES.length - 1));
      const img = factoryFrameImagesRef.current[idx] ?? factoryFrameImagesRef.current[0];
      let drew = false;
      if (img && img.naturalWidth > 0) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = canvas.parentElement?.clientWidth ?? 400;
        const h = canvas.parentElement?.clientHeight ?? 600;
        const pw = Math.floor(w * dpr);
        const ph = Math.floor(h * dpr);
        if (canvas.width !== pw || canvas.height !== ph) {
          canvas.width = pw;
          canvas.height = ph;
          canvas.style.width = `${w}px`;
          canvas.style.height = `${h}px`;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = "#07150f";
        ctx.fillRect(0, 0, w, h);
        const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
        const dw = img.naturalWidth * scale;
        const dh = img.naturalHeight * scale;
        ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
        drew = true;
      }
      if (drew && Math.abs(diff) <= 0.0005 && idx === lastFactoryDrawn) {
        factoryRafRef.current = null;
        return;
      }
      lastFactoryDrawn = idx;
      factoryRafRef.current = requestAnimationFrame(render);
    };

    // The factory film lives inside its own overlay scroller, so scroll
    // events come from that element (not the window) while it is open.
    const scroller = factoryScroller.current;
    const onScroll = () => {
      if (factoryRafRef.current === null) factoryRafRef.current = requestAnimationFrame(render);
    };
    scroller?.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    factoryRafRef.current = requestAnimationFrame(render);
    return () => {
      scroller?.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (factoryRafRef.current !== null) cancelAnimationFrame(factoryRafRef.current);
      factoryRafRef.current = null;
    };
    // The section only exists while the overlay is open, so re-attach the
    // loop each time it mounts.
  }, [factoryOpen]);

  const copyOpacity = 1 - clamp(progress / 0.3, 0, 1);
  const progressPercent = Math.round(progress * 100);
  const frameNumber = String(Math.min(FRAME_SOURCES.length, Math.max(1, Math.round(progress * (FRAME_SOURCES.length - 1)) + 1))).padStart(3, "0");

  const sec2FrameNumber = String(
    Math.min(SECTION2_FRAME_SOURCES.length, Math.max(1, Math.round(sec2Progress * (SECTION2_FRAME_SOURCES.length - 1)) + 1)),
  ).padStart(3, "0");

  const aboutFrameNumber = String(
    Math.min(ABOUT_FRAME_SOURCES.length, Math.max(1, Math.round(aboutProgress * (ABOUT_FRAME_SOURCES.length - 1)) + 1)),
  ).padStart(3, "0");

  const strikeFrameNumber = String(
    Math.min(STRIKE_FRAME_SOURCES.length, Math.max(1, Math.round(strikeProgress * (STRIKE_FRAME_SOURCES.length - 1)) + 1)),
  ).padStart(3, "0");

  const factoryFrameNumber = String(
    Math.min(FACTORY_FRAME_SOURCES.length, Math.max(1, Math.round(factoryProgress * (FACTORY_FRAME_SOURCES.length - 1)) + 1)),
  ).padStart(3, "0");

  const spawnParticles = (centerX: number, centerY: number) => {
    const container = particleContainerRef.current;
    if (!container) return;
    const count = 24;
    for (let i = 0; i < count; i++) {
      const el = document.createElement('span');
      el.className = 'volt-nav-particle';
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const distance = 25 + Math.random() * 70;
      const size = 5 + Math.random() * 10;
      const tx = Math.cos(angle) * distance;
      const ty = Math.sin(angle) * distance;
      el.style.left = `${centerX}px`;
      el.style.top = `${centerY}px`;
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.setProperty('--tx', `${tx}px`);
      el.style.setProperty('--ty', `${ty}px`);
      el.style.animationDuration = `${1.0 + Math.random() * 0.8}s`;
      container.appendChild(el);
      setTimeout(() => el.remove(), 2000);
    }
  };

  // handleNavClick removed — native click listener handles particles + smooth scroll via CSS

  // ---- 360 product viewer — on-demand overlay (not part of the main page) ----
  const [expOpen, setExpOpen] = useState(false);
  const expRestoreY = useRef(0);
  const expScroller = useRef<HTMLDivElement>(null);
  const expDoneAt = useRef<number | null>(null);
  // True after the orbit scroll reaches 100% — reveals the
  // "What are you looking for?" destination menu inside the overlay.
  const [expEnded, setExpEnded] = useState(false);
  // Interactive soda-fizz bubbles behind the end-of-orbit menu.
  const menuBubblesRef = useRef<HTMLCanvasElement>(null);

  const open360 = () => {
    expRestoreY.current = window.scrollY;
    expDoneAt.current = null;
    setExpEnded(false);
    // (re)start the fizz the moment the viewer opens
    bubbleActivityRef.current = performance.now();
    lerpStopRef.current?.(); // don't let a mid-flight glide fight the overlay
    const liq = liqRef.current;
    if (liq) {
      liq.play(() => {
        expOpenRef.current = true;
        setExpOpen(true);
      }, () => {});
    } else {
      expOpenRef.current = true;
      setExpOpen(true);
    }
  };
  open360Ref.current = open360;

  const close360 = (restore = true) => {
    setExpOpen(false);
    expOpenRef.current = false;
    if (restore) {
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: expRestoreY.current, behavior: "instant" as ScrollBehavior });
      });
    }
  };

  const openFactory = () => {
    // close the end-menu overlay (if open) and open the factory film
    setExpOpen(false);
    expOpenRef.current = false;
    factoryOpenRef.current = true;
    setFactoryOpen(true);
  };

  const closeFactory = () => {
    setFactoryOpen(false);
    factoryOpenRef.current = false;
  };

  const on360Progress = (pct: number) => {
    if (pct >= 100) {
      // At the end of the orbit, reveal the destination menu (once).
      if (expDoneAt.current === null) {
        expDoneAt.current = Date.now();
        window.setTimeout(() => {
          setExpEnded((v) => (v ? v : true));
        }, 650);
      }
    } else {
      expDoneAt.current = null;
    }
  };

  // Menu option: close the overlay (no restore — the liquid wipe is already
  // rising over the page) and let the shared nav listener play the green
  // particles + liquid transition + jump to the section.
  const close360ForNav = () => close360(false);

  // Interactive fizz behind the end-of-orbit menu (same bubbles as Products /
  // Reviews — they rise like carbonation and dodge the cursor).
  useEffect(() => {
    if (!expEnded) return;
    const canvas = menuBubblesRef.current;
    if (!canvas) return;
    bubbleActivityRef.current = performance.now();
    return runBubbleCanvas(canvas, reducedMotion, bubbleActivityRef);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expEnded, reducedMotion]);

  // Lock the page while the viewer is open; Escape closes it.
  useEffect(() => {
    if (!expOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close360(true);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expOpen]);

  // Lock the page while the factory film is open; Escape closes it.
  useEffect(() => {
    if (!factoryOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeFactory();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [factoryOpen]);

  const renderNavContent = () => (
    <>
      <a href="#hero" className="volt-nav-brand">
        <Zap size={16} className="volt-nav-brand-icon" />
        VOLT
      </a>
      <div className="volt-nav-links">
        <a href="#ingredients" className="volt-nav-link">Ingredients</a>
        <a href="#aboutvolt" className="volt-nav-link">About Volt</a>
        <a href="#strike" className="volt-nav-link">Flavors</a>
        <a href="#products" className="volt-nav-link">Products</a>
        <a href="#reviews" className="volt-nav-link">Reviews</a>
      </div>
      <div className="volt-nav-controls">
        <div className="volt-nav-meta">
          <span>Energy</span>
          <span className="volt-nav-live" />
          <span>01</span>
        </div>
        <button
          className="volt-nav-sound"
          onClick={() => setSoundOn((s) => !s)}
          aria-label={soundOn ? "Mute sound" : "Play sound"}
        >
          {soundOn ? <Volume2 size={14} /> : <VolumeX size={14} />}
          <span>{soundOn ? "Sound On" : "Sound Off"}</span>
        </button>
      </div>
    </>
  );

  return (
    <main className="volt-page">
      <nav className={`volt-nav ${isScrolled ? 'volt-nav--scrolled' : ''}`}>
        <div ref={particleContainerRef} className="volt-nav-particle-container" />
        {!isScrolled ? (
          <div className="volt-nav-glass-full">
            <GlassSurface
              width="100%"
              height={64}
              borderRadius={0}
              borderWidth={0.06}
              brightness={12}
              opacity={0.9}
              blur={14}
              displace={1.1}
              backgroundOpacity={0.07}
              saturation={1.15}
              distortionScale={-90}
              redOffset={4}
              greenOffset={9}
              blueOffset={15}
              xChannel="R"
              yChannel="G"
              mixBlendMode="screen"
              className="volt-nav-glass-surface"
            >
              <div className="volt-nav-inner">
                {renderNavContent()}
              </div>
            </GlassSurface>
          </div>
        ) : (
          <div className="volt-nav-pill-glass">
            <GlassSurface
              width="100%"
              height={52}
              borderRadius={100}
              borderWidth={0.05}
              brightness={10}
              opacity={0.85}
              blur={14}
              displace={1}
              backgroundOpacity={0.06}
              saturation={1.1}
              distortionScale={-80}
              redOffset={3}
              greenOffset={8}
              blueOffset={15}
              xChannel="R"
              yChannel="G"
              mixBlendMode="screen"
              className="volt-nav-glass-surface"
            >
              <div className="volt-nav-pill-content">
                {renderNavContent()}
              </div>
            </GlassSurface>
          </div>
        )}
      </nav>

      <section ref={sectionRef} id="hero" className="volt-hero" aria-label="Volt energy drink hero">
        <div className="volt-sticky-stage">
          <canvas ref={canvasRef} className="volt-canvas" aria-label="Volt can product animation" />
          <div className="volt-vignette" aria-hidden="true" />
          <div className="volt-grain" aria-hidden="true" />


          <div className="volt-copy" style={{ opacity: copyOpacity }}>
            <p className="volt-eyebrow"><span /> Charge, held in frame</p>
            <h1>Volt energy drink</h1>
            <p className="volt-subheading">gives you power <span>.</span></p>
          </div>

          <div className="volt-caption volt-caption-left">
            <span className="volt-caption-index">01</span>
            <span>Carbonated<br />energy drink</span>
          </div>
          <div className="volt-caption volt-caption-right">
            <span>Built for the<br />next move</span>
            <span className="volt-caption-index">V / 2026</span>
          </div>

          <aside className="volt-progress" aria-label={`Animation progress ${progressPercent}%`}>
            <div className="volt-progress-track"><span style={{ height: `${progressPercent}%` }} /></div>
            <div className="volt-progress-labels">
              <span>Scroll</span>
              <span>{frameNumber} / {String(FRAME_SOURCES.length).padStart(3, "0")}</span>
            </div>
          </aside>

          <div className="volt-bottom-bar">
            <span>{loadedFrames < FRAME_SOURCES.length ? "Loading product film" : "Product film ready"}</span>
            <span className="volt-bottom-line" />
            <span>Scroll to explore <ArrowDown size={13} strokeWidth={1.8} /></span>
          </div>
        </div>
      </section>

      {/* Small interstitial page: big bold ingredients statement */}
      <section id="ingredients" className="volt-ingredients" aria-label="Ingredients of Volt">
        <div className="volt-ingredients-inner">
          <p className="volt-eyebrow"><span /> What powers the charge</p>
          <MaskedHeading
            text="Ingredients of Volt"
            tag="h2"
            mediaType="video"
            src="/ingredients-macro.mp4"
            fillScale={1.35}
            parallax={22}
            drift={10}
            brightness={1.05}
            saturation={1.15}
            reveal="rise"
            trigger="view"
            duration={1.2}
            stagger={0.14}
            align="center"
            weight={400}
            tracking={0.005}
            lineHeight={0.9}
            textScale={0.135}
            className="volt-ingredients-heading"
          />
          <p className="volt-ingredients-sub">The formula behind the charge</p>
          <ArrowDown size={18} strokeWidth={1.8} className="volt-ingredients-arrow" />
        </div>
      </section>

      {/* Full-screen scroll canvas section with glass overlay */}
      <section
        ref={(el) => {
          (nutritionRef as MutableRefObject<HTMLElement | null>).current = el;
          (nutritionSectionRef as MutableRefObject<HTMLElement | null>).current = el;
        }}
        id="nutrition"
        className="volt-fullscreen-section"
        aria-label="Volt nutrition facts and ingredients"
      >
        <div className="volt-fullscreen-stage">
          <canvas ref={sec2CanvasRef} className="volt-fullscreen-canvas" aria-label="Volt product sequence" />
          <div className="volt-vignette" aria-hidden="true" />
          <div className="volt-grain" aria-hidden="true" />

          {/* Overlay text */}
          <div className="volt-fullscreen-copy">
            <p className="volt-eyebrow"><span /> The charge continues</p>
            <h2>Power, in motion.</h2>
            <p className="volt-subheading">Scroll to play the sequence <span>.</span></p>
          </div>

          {/* Floating glass nutrition panel */}
          <div className="volt-glass-panel">
            <GlassSurface
              width="100%"
              height="100%"
              borderRadius={20}
              borderWidth={0.05}
              brightness={14}
              opacity={0.82}
              blur={16}
              displace={1.5}
              backgroundOpacity={0.08}
              saturation={1.2}
              distortionScale={-100}
              redOffset={4}
              greenOffset={10}
              blueOffset={18}
              xChannel="R"
              yChannel="G"
              mixBlendMode="screen"
              className="volt-glass-surface"
            >
              <div className="volt-glass-content">
                <div className="volt-facts-panel">
                  <div className="volt-panel-heading">
                    <div>
                      <span className="volt-panel-kicker">01 / Nutrition facts</span>
                      <h3>Per serving</h3>
                    </div>
                    <span className="volt-panel-status">Pending label</span>
                  </div>
                  <div className="volt-facts-list">
                    {nutritionRows.map((row, i) => (
                      <div className="volt-fact-row" key={row.label}>
                        <span>{row.label}</span>
                        <strong className="volt-fact-value">
                          <CountUp
                            from={0}
                            to={row.value}
                            separator=","
                            duration={1.5}
                            delay={i * 0.15}
                            className="count-up-text"
                          />
                          <span className="volt-fact-unit">{row.unit}</span>
                        </strong>
                      </div>
                    ))}
                  </div>
                  <p className="volt-panel-footnote">Final quantities should be entered directly from the approved product label.</p>
                </div>
              </div>
            </GlassSurface>
          </div>

          {/* Bottom bar */}
          <div className="volt-bottom-bar">
            <span>{sec2Loaded < SECTION2_FRAME_SOURCES.length ? "Loading sequence" : "Sequence ready"}</span>
            <span className="volt-bottom-line" />
            <span>
              {sec2FrameNumber} / {String(SECTION2_FRAME_SOURCES.length).padStart(3, "0")}
            </span>
          </div>
        </div>
      </section>

      {/* Small interstitial page: About Volt intro before the story */}
      <section id="aboutvolt" className="volt-ingredients volt-about-intro" aria-label="About Volt">
        <div className="volt-ingredients-inner">
          <p className="volt-eyebrow"><span /> About the brand</p>
          <MaskedHeading
            text="About Volt"
            tag="h2"
            mediaType="video"
            src="/ingredients-macro.mp4"
            fillScale={1.35}
            parallax={22}
            drift={10}
            brightness={1.05}
            saturation={1.15}
            reveal="rise"
            trigger="view"
            duration={1.2}
            stagger={0.14}
            align="center"
            weight={400}
            tracking={0.005}
            lineHeight={0.9}
            textScale={0.14}
            className="volt-ingredients-heading"
          />
          <p className="volt-ingredients-sub">The story behind the charge</p>
          <ArrowDown size={18} strokeWidth={1.8} className="volt-ingredients-arrow" />
        </div>
      </section>

      {/* Third section: about scroll-canvas sequence */}
      <section
        ref={(el) => {
          (aboutSectionRef as MutableRefObject<HTMLElement | null>).current = el;
        }}
        id="about"
        className="volt-about-section"
        aria-label="About Volt"
      >
        <div className="volt-about-stage">
          <canvas ref={aboutCanvasRef} className="volt-about-canvas" aria-label="Volt about sequence" />
          <div className="volt-vignette" aria-hidden="true" />
          <div className="volt-grain" aria-hidden="true" />

          {/* Overlay copy */}
          <div className="volt-about-copy">
            <p className="volt-eyebrow"><span /> About the brand</p>
            <h2>Fueled by<br />Volt.</h2>
            <p className="volt-subheading">Scroll to explore the story <span>.</span></p>
          </div>

          {/* Left side story text */}
          <div className="volt-about-story">
            <p>
              Born from raw energy and bold design,<br />
              Volt is built for the ones who move —<br />
              engineered to charge every moment,<br />
              and made to keep the current alive.
            </p>
          </div>

          {/* CTA to the next page — Flavors */}
          <button
            type="button"
            onClick={open360}
            className="volt-about-cta volt-about-film-cta"
            aria-label="Open the Volt can 360 view"
          >
            Explore flavors
            <ChevronRight size={22} strokeWidth={2} aria-hidden="true" />
          </button>

          {/* Bottom bar */}
          <div className="volt-bottom-bar">
            <span>{aboutLoaded < ABOUT_FRAME_SOURCES.length ? "Loading story" : "Story ready"}</span>
            <span className="volt-bottom-line" />
            <span>
              {aboutFrameNumber} / {String(ABOUT_FRAME_SOURCES.length).padStart(3, "0")}
            </span>
          </div>
        </div>
      </section>

      {/* Fourth section: strike-can scroll-canvas sequence */}
      <section
        ref={(el) => {
          (strikeSectionRef as MutableRefObject<HTMLElement | null>).current = el;
        }}
        id="strike"
        className="volt-strike-section"
        aria-label="Volt strike energy can"
      >
        <div className="volt-strike-stage">
          <canvas ref={strikeCanvasRef} className="volt-strike-canvas" aria-label="Volt strike can sequence" />
          <div className="volt-vignette" aria-hidden="true" />
          <div className="volt-grain" aria-hidden="true" />

          {/* Overlay copy */}
          <div className="volt-strike-copy">
            <h2>Flavors</h2>
            <p className="volt-subheading">Scroll to play the sequence <span>.</span></p>
          </div>

          {/* Bottom bar */}
          <div className="volt-bottom-bar">
            <span>{strikeLoaded < STRIKE_FRAME_SOURCES.length ? "Loading sequence" : "Strike sequence ready"}</span>
            <span className="volt-bottom-line" />
            <span>
              {strikeFrameNumber} / {String(STRIKE_FRAME_SOURCES.length).padStart(3, "0")}
            </span>
          </div>
        </div>
      </section>

      {/* Products page: liquid-glass cards over interactive soda-fizz bubbles */}
      <section id="products" className="volt-products" aria-label="Volt products to buy">
        <canvas ref={productsBubblesRef} className="volt-bubbles" aria-hidden="true" />
        <div className="volt-products-inner">
          <header className="volt-products-head volt-reveal">
            <p className="volt-eyebrow"><span /> Volt strike energy</p>
            <h2>Products</h2>
            <p className="volt-subheading">Pick your flavor — priced per can <span>.</span></p>
          </header>

          <div
            className="volt-can-carousel volt-reveal"
            style={{ transitionDelay: "120ms" }}
            onPointerEnter={() => setCanHover(true)}
            onPointerLeave={() => setCanHover(false)}
          >
            <div className="volt-can-stage">
              <div
                className="volt-can-glow"
                style={{ backgroundColor: products[canIdx].accent }}
                aria-hidden="true"
              />
              {prevCanIdx !== null && (
                <img
                  key={`prev-${prevCanIdx}`}
                  src={products[prevCanIdx].image}
                  alt=""
                  draggable={false}
                  className={`volt-can-img volt-can-leave ${canDir > 0 ? "leave-next" : "leave-prev"}`}
                  onAnimationEnd={() => setPrevCanIdx(null)}
                />
              )}
              <img
                key={`cur-${canIdx}`}
                src={products[canIdx].image}
                alt={`${products[canIdx].name} can`}
                draggable={false}
                className={`volt-can-img ${prevCanIdx !== null ? (canDir > 0 ? "enter-next" : "enter-prev") : ""}`}
              />
              <button className="volt-can-nav volt-can-prev" onClick={() => stepCan(-1)} aria-label="Previous flavor">
                <ChevronLeft size={24} strokeWidth={1.6} />
              </button>
              <button className="volt-can-nav volt-can-next" onClick={() => stepCan(1)} aria-label="Next flavor">
                <ChevronRight size={24} strokeWidth={1.6} />
              </button>
            </div>

            <div className="volt-can-details" key={`info-${canIdx}`}>
              <p className="volt-product-kicker">Volt strike energy</p>
              <h3 className="volt-can-name">{products[canIdx].name}</h3>
              <p className="volt-product-desc">{products[canIdx].description}</p>
              <BubbleRating
                name={products[canIdx].name}
                rating={products[canIdx].rating}
                count={products[canIdx].reviews}
              />
              <div className="volt-product-foot volt-can-price-row">
                <strong className="volt-product-price">{products[canIdx].price}</strong>
                <span className="volt-product-unit">355 ml</span>
              </div>
              <div className="volt-can-dots" role="tablist" aria-label="Choose flavor">
                {products.map((p, i) => (
                  <button
                    key={p.id}
                    role="tab"
                    aria-selected={i === canIdx}
                    aria-label={p.name}
                    className={`volt-can-dot ${i === canIdx ? "active" : ""}`}
                    onClick={() => selectCan(i)}
                  />
                ))}
              </div>
            </div>
          </div>

          <p className="volt-grid-label volt-reveal" style={{ transitionDelay: "60ms" }}>
            The full lineup — choose a can to preview it above
          </p>
          <div className="volt-products-grid" onPointerMove={tiltCards} onPointerLeave={flattenCards}>
            {products.map((p, i) => (
              <article
                className="volt-product volt-reveal"
                data-active={i === canIdx ? "true" : "false"}
                style={{ transitionDelay: `${i * 90}ms` }}
                key={p.id}
                onClick={() => selectCan(i)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    selectCan(i);
                  }
                }}
                aria-label={`Preview ${p.name}`}
              >
                <div className="volt-product-tilt">
                <GlassSurface
                  width="100%"
                  height="100%"
                  borderRadius={26}
                  borderWidth={0.05}
                  brightness={16}
                  opacity={0.82}
                  blur={16}
                  displace={1.3}
                  backgroundOpacity={0.08}
                  saturation={1.3}
                  distortionScale={-90}
                  redOffset={4}
                  greenOffset={10}
                  blueOffset={16}
                  xChannel="R"
                  yChannel="G"
                  mixBlendMode="screen"
                  className="volt-product-glass"
                >
                  <div className="volt-product-inner">
                    <div
                      className="volt-product-media"
                      style={{
                        background: `radial-gradient(circle at 50% 52%, ${p.accent}2e, transparent 72%)`,
                      }}
                    >
                      <img src={p.image} alt={`${p.name} can`} loading="lazy" draggable={false} />
                    </div>
                    <p className="volt-product-kicker">Volt strike energy</p>
                    <h3 className="volt-product-name">{p.name}</h3>
                    <p className="volt-product-desc">{p.description}</p>
                    <BubbleRating
                      name={p.name}
                      rating={p.rating}
                      count={p.reviews}
                    />
                    <div className="volt-product-foot">
                      <strong className="volt-product-price">{p.price}</strong>
                      <span className="volt-product-unit">355 ml</span>
                    </div>
                  </div>
                </GlassSurface>
                <span className="volt-product-glare" aria-hidden="true" />
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Customer reviews — soda-fizz bubbles + fluid glass cards */}
      <section id="reviews" className="volt-reviews" aria-label="Customer reviews">
        <canvas ref={bubblesRef} className="volt-bubbles" aria-hidden="true" />
        <div className="volt-reviews-inner">
          <header className="volt-reviews-head volt-reveal">
            <p className="volt-eyebrow"><span /> Volt strike energy</p>
            <h2>Reviews</h2>
            <p className="volt-subheading">What the charged ones say <span>.</span></p>
          </header>

          <div className="volt-reviews-summary volt-reveal" style={{ transitionDelay: "70ms" }}>
            <GlassSurface
              width="100%"
              height="100%"
              borderRadius={26}
              borderWidth={0.05}
              brightness={16}
              opacity={0.82}
              blur={16}
              displace={1.3}
              backgroundOpacity={0.08}
              saturation={1.3}
              distortionScale={-90}
              redOffset={4}
              greenOffset={10}
              blueOffset={16}
              xChannel="R"
              yChannel="G"
              mixBlendMode="screen"
              className="volt-rating-glass"
            >
              <div className="volt-rating-inner">
                <div className="volt-rating-left">
                  <span className="volt-reviews-big">4.9</span>
                  <span className="volt-reviews-stars" aria-label="Rated 4.9 out of 5">★★★★★</span>
                  <span className="volt-reviews-count">1,247 verified reviews</span>
                </div>
                <div
                  className="volt-rating-bars"
                  role="img"
                  aria-label="Rated 4.9 out of 5 stars across 1,247 verified reviews"
                >
                  {RATING_DIST.map((row) => (
                    <div className="volt-rating-row" key={row.stars}>
                      <span className="volt-rating-label">
                        {row.stars}
                        <span aria-hidden="true">★</span>
                      </span>
                      <span className="volt-rating-track">
                        <span className="volt-rating-fill" style={{ width: `${row.pct}%` }} />
                      </span>
                      <span className="volt-rating-pct">{row.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </GlassSurface>
          </div>

          <div className="volt-reviews-grid">
            {reviews.map((r, i) => (
              <article
                className="volt-review volt-reveal"
                style={{ transitionDelay: `${120 + i * 80}ms` }}
                key={r.id}
              >
                <GlassSurface
                  width="100%"
                  height="100%"
                  borderRadius={26}
                  borderWidth={0.05}
                  brightness={16}
                  opacity={0.82}
                  blur={16}
                  displace={1.3}
                  backgroundOpacity={0.08}
                  saturation={1.3}
                  distortionScale={-90}
                  redOffset={4}
                  greenOffset={10}
                  blueOffset={16}
                  xChannel="R"
                  yChannel="G"
                  mixBlendMode="screen"
                  className="volt-review-glass"
                >
                  <div className="volt-review-inner">
                    <div className="volt-review-top">
                      <span className="volt-review-stars" aria-label={`${r.stars} out of 5 stars`}>
                        <span aria-hidden="true">{"★★★★★".slice(0, r.stars)}</span>
                        <span aria-hidden="true" className="volt-review-stars-dim">
                          {"★★★★★".slice(r.stars)}
                        </span>
                      </span>
                      <span className="volt-review-meta-col">
                        <span className="volt-review-flavor">{r.flavor}</span>
                        <span className="volt-review-when">{r.when}</span>
                      </span>
                    </div>
                    <p className="volt-review-quote">“{r.quote}”</p>
                    <div className="volt-review-author">
                      <span className="volt-review-avatar" aria-hidden="true">
                        {r.name.charAt(0)}
                      </span>
                      <div className="volt-review-who">
                        <strong>{r.name}</strong>
                        <span className="volt-review-meta">
                          <Check size={10} strokeWidth={3} className="volt-review-check" aria-hidden="true" />
                          Verified buyer · {r.loc}
                        </span>
                      </div>
                    </div>
                  </div>
                </GlassSurface>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Footer — same liquid-transition nav as the top bar */}
      <footer className="volt-footer">
        <div className="volt-footer-inner">
          <a href="#hero" className="volt-footer-brand volt-nav-brand">
            <Zap size={14} className="volt-nav-brand-icon" />
            VOLT
          </a>
          <nav className="volt-footer-links" aria-label="Footer">
            <a href="#hero" className="volt-nav-link">Film</a>
            <a href="#nutrition" className="volt-nav-link">Sequence</a>
            <a href="#about" className="volt-nav-link">Inside</a>
            <a href="#products" className="volt-nav-link">Shop</a>
          </nav>
          <p className="volt-footer-note">Charge responsibly — © 2026 Volt Strike Energy</p>
        </div>
      </footer>

      <LiquidTransition ref={liqRef} />

      {/* On-demand 360 product viewer */}
      {expOpen && (
        <div className="volt-360-overlay" role="dialog" aria-modal="true" aria-label="Volt can 360 view">
          <div className="volt-360-head">
            <button type="button" className="volt-360-exit" onClick={() => close360(true)} aria-label="Close the 360 view">
              <span aria-hidden="true">✕</span> Exit
            </button>
            <span className="volt-360-badge">VOLT · 360°</span>
          </div>
          <div ref={expScroller} className="volt-360-scroller">
            <AboutExperience overlay scrollRef={expScroller} onProgress={on360Progress} />
          </div>

          {/* End-of-orbit destination menu */}
          {expEnded && (
            <div className="volt-menu-screen" role="dialog" aria-modal="true" aria-label="Choose a destination">
              <canvas ref={menuBubblesRef} className="volt-bubbles" aria-hidden="true" />
              <div className="volt-grain" aria-hidden="true" />
              <div className="volt-menu-inner">
                <nav className="volt-menu-list" aria-label="Choose a destination">
                  <button type="button" className="volt-menu-opt volt-menu-opt-btn" onClick={openFactory}>
                    <span className="volt-menu-arrow" aria-hidden="true">-&gt;</span> Factory
                  </button>
                  <a href="#strike" className="volt-nav-link volt-menu-opt" onClick={close360ForNav}>
                    <span className="volt-menu-arrow" aria-hidden="true">-&gt;</span> Stock
                  </a>
                  <a href="#products" className="volt-nav-link volt-menu-opt" onClick={close360ForNav}>
                    <span className="volt-menu-arrow" aria-hidden="true">-&gt;</span> Sales
                  </a>
                </nav>
              </div>
            </div>
          )}
        </div>
      )}

      {/* On-demand Factory film (opened only from the end-menu) */}
      {factoryOpen && (
        <div className="volt-factory-overlay" role="dialog" aria-modal="true" aria-label="Volt factory">
          <div className="volt-360-head">
            <button type="button" className="volt-360-exit" onClick={closeFactory} aria-label="Close the factory view">
              <span aria-hidden="true">✕</span> Exit
            </button>
            <span className="volt-360-badge">VOLT · FACTORY</span>
          </div>
          <div ref={factoryScroller} className="volt-360-scroller">
            <section
              ref={(el) => {
                (factorySectionRef as MutableRefObject<HTMLElement | null>).current = el;
              }}
              id="factory"
              className="volt-about-section volt-factory-section"
              aria-label="Volt factory"
            >
              <div className="volt-about-stage">
                <canvas ref={factoryCanvasRef} className="volt-about-canvas" aria-label="Volt factory sequence" />
                <div className="volt-vignette" aria-hidden="true" />
                <div className="volt-grain" aria-hidden="true" />

                {/* Overlay copy */}
                <div className="volt-about-copy">
                  <p className="volt-eyebrow"><span /> Inside the plant</p>
                  <h2>Factory</h2>
                  <p className="volt-subheading">Scroll to play the sequence <span>.</span></p>
                </div>

                {/* Bottom bar */}
                <div className="volt-bottom-bar">
                  <span>{factoryLoaded < FACTORY_FRAME_SOURCES.length ? "Loading factory" : "Factory sequence ready"}</span>
                  <span className="volt-bottom-line" />
                  <span>
                    {factoryFrameNumber} / {String(FACTORY_FRAME_SOURCES.length).padStart(3, "0")}
                  </span>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* Floating AI support assistant */}
      <SupportChat />
    </main>
  );
}
