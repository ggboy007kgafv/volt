/*
 * ScrollCanvasSection — a self-contained sticky-canvas block that maps scroll
 * progress to a buffered image sequence, mirroring the hero behaviour but
 * accepting any frame array via props.
 */
import { useEffect, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

interface ScrollCanvasSectionProps {
  /** Ordered list of image URLs to play through on scroll. */
  frameSources: readonly string[];
  /** Unique id used for the section element (for anchor links). */
  id?: string;
  /** CSS class applied to the outer <section>. */
  className?: string;
  /** Small kicker / eyebrow text above the main heading. */
  eyebrow?: string;
  /** Large heading displayed over the canvas (fades out as you scroll). */
  heading?: string;
  /** Subtitle beneath the heading. */
  subtitle?: string;
  /** Text shown in the bottom-left caption area. */
  captionLeft?: string;
  /** Text shown in the bottom-right caption area. */
  captionRight?: string;
  /** Label for the loading state indicator at the bottom. */
  loadingLabel?: string;
  /** Label shown once all frames have loaded. */
  readyLabel?: string;
}

export default function ScrollCanvasSection({
  frameSources,
  id,
  className = "",
  eyebrow = "Scroll-driven sequence",
  heading = "Product film",
  subtitle = "Scroll to play",
  captionLeft = "Scroll-driven",
  captionRight = "Frame sequence",
  loadingLabel = "Loading sequence",
  readyLabel = "Sequence ready",
}: ScrollCanvasSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameImagesRef = useRef<(HTMLImageElement | null)[]>([]);
  const rafRef = useRef<number | null>(null);
  const targetProgressRef = useRef(0);
  const displayedProgressRef = useRef(0);
  const [progress, setProgress] = useState(0);
  const [loadedFrames, setLoadedFrames] = useState(0);

  /* ---- frame loading --------------------------------------------------- */
  useEffect(() => {
    let cancelled = false;
    let nextBatchTimer: number | undefined;
    const images: (HTMLImageElement | null)[] = frameSources.map(() => null);
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
        setLoadedFrames((c) => c + 1);
      };
      image.onerror = () => {
        if (!cancelled && index !== 0) {
          images[index] = images[0];
          frameImagesRef.current[index] = images[0];
        }
      };
      image.src = frameSources[index];
    };

    loadFrame(0);
    let batchStart = 1;
    const loadNextBatch = () => {
      const batchEnd = Math.min(batchStart + 14, frameSources.length);
      for (let i = batchStart; i < batchEnd; i += 1) loadFrame(i);
      batchStart = batchEnd;
      if (batchStart < frameSources.length) {
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
  }, [frameSources]);

  /* ---- scroll → canvas render ----------------------------------------- */
  useEffect(() => {
    const canvas = canvasRef.current;
    const section = sectionRef.current;
    if (!canvas || !section) return;

    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return;

    const render = () => {
      const rect = section.getBoundingClientRect();
      const scrollableDistance = Math.max(section.offsetHeight - window.innerHeight, 1);
      const rawProgress = clamp(-rect.top / scrollableDistance, 0, 1);
      targetProgressRef.current = rawProgress;

      const diff = targetProgressRef.current - displayedProgressRef.current;
      displayedProgressRef.current += diff * 0.11;
      const nextProgress = displayedProgressRef.current;

      if (Math.abs(diff) > 0.0005) setProgress(nextProgress);

      const frameIndex = Math.round(nextProgress * (frameSources.length - 1));
      const image = frameImagesRef.current[frameIndex] ?? frameImagesRef.current[0];
      if (image && image.naturalWidth > 0) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const width = window.innerWidth;
        const height = window.innerHeight;
        const pw = Math.floor(width * dpr);
        const ph = Math.floor(height * dpr);
        if (canvas.width !== pw || canvas.height !== ph) {
          canvas.width = pw;
          canvas.height = ph;
          canvas.style.width = `${width}px`;
          canvas.style.height = `${height}px`;
        }
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        context.fillStyle = "#07150f";
        context.fillRect(0, 0, width, height);

        const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
        const dw = image.naturalWidth * scale;
        const dh = image.naturalHeight * scale;
        context.drawImage(image, (width - dw) / 2, (height - dh) / 2, dw, dh);
      }

      rafRef.current = window.requestAnimationFrame(render);
    };

    const onScroll = () => {
      if (rafRef.current === null) rafRef.current = window.requestAnimationFrame(render);
    };
    const onResize = onScroll;

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    rafRef.current = window.requestAnimationFrame(render);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [frameSources]);

  /* ---- derived UI values ----------------------------------------------- */
  const copyOpacity = 1 - clamp(progress / 0.3, 0, 1);
  const progressPercent = Math.round(progress * 100);
  const frameNumber = String(
    Math.min(frameSources.length, Math.max(1, Math.round(progress * (frameSources.length - 1)) + 1)),
  ).padStart(3, "0");

  return (
    <section
      ref={sectionRef}
      id={id}
      className={`volt-hero ${className}`}
      aria-label={heading}
    >
      <div className="volt-sticky-stage">
        <canvas ref={canvasRef} className="volt-canvas" aria-label={heading} />
        <div className="volt-vignette" aria-hidden="true" />
        <div className="volt-grain" aria-hidden="true" />

        <div className="volt-copy" style={{ opacity: copyOpacity }}>
          <p className="volt-eyebrow">
            <span /> {eyebrow}
          </p>
          <h2>{heading}</h2>
          <p className="volt-subheading">{subtitle} <span>.</span></p>
        </div>

        <div className="volt-caption volt-caption-left">
          <span className="volt-caption-index">02</span>
          <span>{captionLeft}</span>
        </div>
        <div className="volt-caption volt-caption-right">
          <span>{captionRight}</span>
          <span className="volt-caption-index">
            {frameNumber} / {String(frameSources.length).padStart(3, "0")}
          </span>
        </div>

        <aside className="volt-progress" aria-label={`Animation progress ${progressPercent}%`}>
          <div className="volt-progress-track">
            <span style={{ height: `${progressPercent}%` }} />
          </div>
          <div className="volt-progress-labels">
            <span>Scroll</span>
            <span>
              {frameNumber} / {String(frameSources.length).padStart(3, "0")}
            </span>
          </div>
        </aside>

        <div className="volt-bottom-bar">
          <span>{loadedFrames < frameSources.length ? loadingLabel : readyLabel}</span>
          <span className="volt-bottom-line" />
          <span>
            Scroll to explore <ArrowDown size={13} strokeWidth={1.8} />
          </span>
        </div>
      </div>
    </section>
  );
}
