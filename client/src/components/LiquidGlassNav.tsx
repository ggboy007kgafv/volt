/*
 * LiquidGlassNav — fixed navigation bar with a fluid glass effect.
 * Uses the GlassSurface component for the displacement-map glass look,
 * adapted for the Volt dark theme.
 */
import { useEffect, useState } from "react";
import { Volume2, VolumeX, Zap } from "lucide-react";
import GlassSurface from "./GlassSurface";

interface LiquidGlassNavProps {
  soundOn: boolean;
  onToggleSound: () => void;
}

export default function LiquidGlassNav({ soundOn, onToggleSound }: LiquidGlassNavProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className="liquid-glass-nav" data-scrolled={scrolled || undefined}>
      <GlassSurface
        width="100%"
        height="100%"
        borderRadius={0}
        borderWidth={0.04}
        brightness={12}
        opacity={0.85}
        blur={14}
        displace={1.2}
        backgroundOpacity={0.12}
        saturation={1.3}
        distortionScale={-120}
        redOffset={5}
        greenOffset={12}
        blueOffset={22}
        xChannel="R"
        yChannel="G"
        mixBlendMode="screen"
        className="liquid-glass-nav__surface"
      >
        <div className="liquid-glass-nav__inner">
          {/* Brand */}
          <a className="liquid-glass-nav__brand" href="#top" aria-label="Volt home">
            <Zap size={16} strokeWidth={2.2} className="liquid-glass-nav__brand-icon" />
            <span>VOLT</span>
          </a>

          {/* Center nav links */}
          <div className="liquid-glass-nav__links">
            <a href="#hero" className="liquid-glass-nav__link liquid-glass-nav__link--active">
              <span className="liquid-glass-nav__link-dot" />
              Film
            </a>
            <a href="#after-hero" className="liquid-glass-nav__link">
              Sequence
            </a>
            <a href="#nutrition" className="liquid-glass-nav__link">
              Inside
            </a>
          </div>

          {/* Right controls */}
          <div className="liquid-glass-nav__controls">
            <span className="liquid-glass-nav__meta">Energy / 01</span>
            <button
              className="liquid-glass-nav__sound"
              type="button"
              aria-label={soundOn ? "Mute ambient sound" : "Enable ambient sound"}
              aria-pressed={soundOn}
              onClick={onToggleSound}
            >
              {soundOn ? <Volume2 size={14} strokeWidth={1.8} /> : <VolumeX size={14} strokeWidth={1.8} />}
              <span>{soundOn ? "Sound on" : "Sound off"}</span>
            </button>
          </div>
        </div>
      </GlassSurface>
    </nav>
  );
}
