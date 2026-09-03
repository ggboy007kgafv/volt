import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import "./LiquidTransition.css";

export type LiquidAction = () => void;

export interface LiquidTransitionHandle {
  play: (action: LiquidAction, onDone?: () => void) => void;
}

/* ---------------------------------------------------------------
   Procedural liquid page sweep.
   A gooey green "sheet" rises from the bottom of the viewport; its
   top edge is two layered drifting SVG wave surfaces. When it fully
   covers the screen the caller swaps the page behind it, then the
   sheet keeps moving upward and exits through the top, revealing the
   new page from the bottom.
   --------------------------------------------------------------- */

const RISE_MS = 800;
const SWAP_AT_MS = RISE_MS + 60;
const EXIT_MS = 820;
const END_AT_MS = SWAP_AT_MS + EXIT_MS + 60;

// Sheet geometry (see CSS): the sheet is 100% + 320px tall, anchored at the
// viewport top, so translateY places its top edge:
//   idle : calc(100% - 240px)  -> top edge just below the viewport bottom
//   cover: -210px              -> wave band (200px) fully above the top edge
//   exit : calc(-100% - 60px)  -> entire sheet above the viewport
const POS_IDLE = "translate3d(0, calc(100% - 240px), 0)";
const POS_COVER = "translate3d(0, -210px, 0)";
const POS_EXIT = "translate3d(0, calc(-100% - 60px), 0)";

/* --- Build a seamless periodic wave (2 periods, drift-safe under -50%) --- */

interface WaveOpts {
  mid: number;
  a1: number;
  a2: number;
  p1: number;
  p2: number;
}

function buildWave({ mid, a1, a2, p1, p2 }: WaveOpts): { fill: string; line: string } {
  const W = 2400; // 2 periods of 1200
  const step = 16;
  const pts: string[] = [];
  for (let x = 0; x <= W; x += step) {
    const y =
      mid +
      a1 * Math.sin((x / 1200) * Math.PI * 2 + p1) +
      a2 * Math.sin((x / 600) * Math.PI * 2 + p2);
    pts.push(`${x},${y.toFixed(1)}`);
  }
  const edge = pts.join(" L ");
  return {
    line: `M ${edge}`,
    fill: `M ${edge} L 2400,200 L 0,200 Z`,
  };
}

const FRONT = buildWave({ mid: 118, a1: 32, a2: 10, p1: 1.2, p2: 0.4 });
const BACK = buildWave({ mid: 58, a1: 40, a2: 12, p1: 3.1, p2: 1.9 });

const LiquidTransition = forwardRef<LiquidTransitionHandle>(function LiquidTransition(_props, ref) {
  const rootRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);
  const timersRef = useRef<number[]>([]);

  const clearTimers = () => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  };

  useImperativeHandle(
    ref,
    () => ({
      play(action: LiquidAction, onDone?: () => void) {
        if (busyRef.current) return;
        const root = rootRef.current;
        const sheet = sheetRef.current;
        if (!root || !sheet) {
          action?.();
          onDone?.();
          return;
        }
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          action?.();
          onDone?.();
          return;
        }

        busyRef.current = true;
        clearTimers();

        const finish = () => {
          clearTimers();
          // teleport back below the viewport while hidden, then release
          sheet.classList.add("volt-liq__no-anim");
          sheet.style.transform = POS_IDLE;
          root.classList.remove("volt-liq--active");
          busyRef.current = false;
          onDone?.();
        };

        const swapPage = () => {
          try {
            action?.();
          } catch (err) {
            // eslint-disable-next-line no-console
            console.error("[liquid-transition]", err);
          }
        };

        // ensure a clean idle base before animating
        sheet.classList.add("volt-liq__no-anim");
        sheet.style.transform = POS_IDLE;
        root.classList.add("volt-liq--active");

        const begin = () => {
          // phase 1 — liquid rises from the bottom
          sheet.classList.remove("volt-liq__no-anim");
          sheet.style.transform = POS_COVER;

          // phase 2 — fully covered: swap the page, hold a beat, exit upward
          timersRef.current.push(
            window.setTimeout(() => {
              swapPage();
              sheet.style.transform = POS_EXIT;
            }, SWAP_AT_MS),
          );

          // phase 3 — finished: reset hidden
          timersRef.current.push(window.setTimeout(finish, END_AT_MS));
        };

        // double rAF so the idle base paints before the rise transition starts
        requestAnimationFrame(() => {
          requestAnimationFrame(begin);
        });
      },
    }),
    [],
  );

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, []);

  return (
    <div ref={rootRef} className="volt-liq" aria-hidden="true">
      <div ref={sheetRef} className="volt-liq__sheet">
        <svg
          className="volt-liq__wave volt-liq__wave--back"
          viewBox="0 0 2400 200"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="voltLiqBack" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a7ffc9" />
              <stop offset="55%" stopColor="#2ee97c" />
              <stop offset="100%" stopColor="#16a34a" />
            </linearGradient>
          </defs>
          <path d={BACK.fill} fill="url(#voltLiqBack)" />
          <path
            d={BACK.line}
            fill="none"
            stroke="rgba(190, 255, 216, 0.55)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
        <svg
          className="volt-liq__wave volt-liq__wave--front"
          viewBox="0 0 2400 200"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="voltLiqFront" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2ee97c" />
              <stop offset="45%" stopColor="#1fb45c" />
              <stop offset="100%" stopColor="#16a34a" />
            </linearGradient>
          </defs>
          <path d={FRONT.fill} fill="url(#voltLiqFront)" />
          <path
            d={FRONT.line}
            fill="none"
            stroke="rgba(222, 255, 236, 0.95)"
            strokeWidth="5"
            strokeLinecap="round"
          />
        </svg>
        <div className="volt-liq__body" />
      </div>
    </div>
  );
});

export default LiquidTransition;
