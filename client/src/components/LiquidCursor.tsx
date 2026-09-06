/*
 * LiquidCursor — real Navier-Stokes fluid sim in a transparent overlay.
 *
 * Ported from @whatisjery/react-fluid-distortion (MIT, Jeremie Nallet):
 * full GPU fluid pipeline — splat → curl → vorticity confinement →
 * divergence → pressure (Jacobi) → gradient subtraction → advection —
 * running in half-float framebuffers, rendered as transparent Volt-green
 * soda over the page (the original distorts a 3D scene; our output is DOM,
 * so the dye itself is the visual).
 *
 * Scoping: splats only spawn while the cursor is inside a watched section.
 * Disabled on touch-only devices / reduced-motion; fails soft if the GPU
 * can't host half-float render targets; parks the loop when idle.
 */
import { useEffect, useRef } from "react";

type Props = {
  targets: string[];
  tint?: [number, number, number];
};

/* ---------- tunables (from the library defaults, Volt-tuned) ---------- */
const FORCE = 1.15; // pointer velocity → fluid impulse
const RADIUS = 0.32; // splat radius (÷100)
const CURL = 2.2; // vorticity confinement (swirliness)
const SWIRL = 5; // pressure Jacobi iterations
const PRESSURE = 0.8; // pressure decay
const DENSITY_DISSIPATION = 0.965; // trail fade per frame
const VELOCITY_DISSIPATION = 0.99; // fluid slows down slowly
const SIM_RES = 160; // velocity/pressure grid
const DYE_RES = 512; // dye/density grid
const DISPLAY_INTENSITY = 120; // alpha = dyeLength × intensity × 0.0001 — the demo's
// 2.0 was tuned for its HDR postprocessing chain; over a dark DOM overlay it
// computes ~0.02 alpha (invisible). 120 puts a mid-speed stroke at ~0.7 alpha.
const MAX_DPR = 1.5;
const BUBBLE_CAP = 200;
const IDLE_PARK_MS = 2600;

/* ---------- shaders (ported from the library's GLSL) ---------- */

const VERT = `
precision highp float;
attribute vec2 aPos;
varying vec2 vUv;
varying vec2 vL;
varying vec2 vR;
varying vec2 vT;
varying vec2 vB;
uniform vec2 texelSize;
void main() {
  vUv = aPos * 0.5 + 0.5;
  vL = vUv - vec2(texelSize.x, 0.0);
  vR = vUv + vec2(texelSize.x, 0.0);
  vT = vUv + vec2(0.0, texelSize.y);
  vB = vUv - vec2(0.0, texelSize.y);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const SPLAT_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTarget;
uniform float aspectRatio;
uniform vec3 uColor;
uniform vec2 uPointer;
uniform float uRadius;
void main() {
  vec2 p = vUv - uPointer;
  p.x *= aspectRatio;
  vec3 splat = exp(-dot(p, p) / uRadius) * uColor;
  vec3 base = texture2D(uTarget, vUv).xyz;
  gl_FragColor = vec4(base + splat, 1.0);
}`;

const ADVECTION_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 texelSize;
uniform float dt;
uniform float uDissipation;
void main() {
  vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
  gl_FragColor = uDissipation * texture2D(uSource, coord);
  gl_FragColor.a = 1.0;
}`;

const CURL_FRAG = `
precision highp float;
varying vec2 vUv;
varying vec2 vL;
varying vec2 vR;
varying vec2 vT;
varying vec2 vB;
uniform sampler2D uVelocity;
void main() {
  float L = texture2D(uVelocity, vL).y;
  float R = texture2D(uVelocity, vR).y;
  float T = texture2D(uVelocity, vT).x;
  float B = texture2D(uVelocity, vB).x;
  float vorticity = R - L - T + B;
  gl_FragColor = vec4(vorticity, 0.0, 0.0, 1.0);
}`;

const VORTICITY_FRAG = `
precision highp float;
varying vec2 vUv;
varying vec2 vL;
varying vec2 vR;
varying vec2 vT;
varying vec2 vB;
uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform float uCurlValue;
uniform float dt;
void main() {
  float L = texture2D(uCurl, vL).x;
  float R = texture2D(uCurl, vR).x;
  float T = texture2D(uCurl, vT).x;
  float B = texture2D(uCurl, vB).x;
  float C = texture2D(uCurl, vUv).x;
  vec2 force = vec2(abs(T) - abs(B), abs(R) - abs(L)) * 0.5;
  force /= length(force) + 1.0;
  force *= uCurlValue * C;
  force.y *= -1.0;
  vec2 vel = texture2D(uVelocity, vUv).xy;
  gl_FragColor = vec4(vel + force * dt, 0.0, 1.0);
}`;

const DIVERGENCE_FRAG = `
precision highp float;
varying vec2 vUv;
varying vec2 vL;
varying vec2 vR;
varying vec2 vT;
varying vec2 vB;
uniform sampler2D uVelocity;
void main() {
  float L = texture2D(uVelocity, vL).x;
  float R = texture2D(uVelocity, vR).x;
  float T = texture2D(uVelocity, vT).y;
  float B = texture2D(uVelocity, vB).y;
  vec2 C = texture2D(uVelocity, vUv).xy;
  if (vL.x < 0.0) { L = -C.x; }
  if (vR.x > 1.0) { R = -C.x; }
  if (vT.y > 1.0) { T = -C.y; }
  if (vB.y < 0.0) { B = -C.y; }
  float div = 0.5 * (R - L + T - B);
  gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
}`;

const CLEAR_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTexture;
uniform float uClearValue;
void main() { gl_FragColor = uClearValue * texture2D(uTexture, vUv); }`;

const PRESSURE_FRAG = `
precision highp float;
varying vec2 vUv;
varying vec2 vL;
varying vec2 vR;
varying vec2 vT;
varying vec2 vB;
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
void main() {
  float L = texture2D(uPressure, vL).x;
  float R = texture2D(uPressure, vR).x;
  float T = texture2D(uPressure, vT).x;
  float B = texture2D(uPressure, vB).x;
  float C = texture2D(uPressure, vUv).x;
  float divergence = texture2D(uDivergence, vUv).x;
  float pressure = (L + R + B + T - divergence) * 0.25;
  gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
}`;

const GRADIENT_SUB_FRAG = `
precision highp float;
varying vec2 vUv;
varying vec2 vL;
varying vec2 vR;
varying vec2 vT;
varying vec2 vB;
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
void main() {
  float L = texture2D(uPressure, vL).x;
  float R = texture2D(uPressure, vR).x;
  float T = texture2D(uPressure, vT).x;
  float B = texture2D(uPressure, vB).x;
  vec2 velocity = texture2D(uVelocity, vUv).xy;
  velocity -= vec2(R - L, T - B);
  gl_FragColor = vec4(velocity, 0.0, 1.0);
}`;

/* Display — faithful port of the library's composite.frag math with
 * showBackground=false (transparent) so the page shows through:
 *   intensity = length(dye) * uIntensity * 0.0001
 *   color     = uColor * length(dye) * intensity   (premultiplied)
 *   alpha     = intensity
 * uColor is the Volt-green tint; blending is (ONE, ONE_MINUS_SRC_ALPHA). */
const DISPLAY_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uFluid;
uniform vec3 uTint;
uniform float uIntensity;
void main() {
  vec3 fluidColor = texture2D(uFluid, vUv).rgb;
  float len = length(fluidColor);
  float intensity = clamp(len * uIntensity * 0.0001, 0.0, 1.0);
  if (intensity < 0.004) discard;
  // Premultiplied dye: color scales with alpha (never clips to white), with
  // a subtle hot core on the fastest fluid.
  vec3 col = mix(uTint, vec3(0.92, 1.0, 0.95), pow(intensity, 3.0) * 0.35) * intensity;
  gl_FragColor = vec4(col, intensity);
}`;

/* bubble point sprites (unchanged from the previous version) */
const BUBBLE_VERT = `
attribute vec2 aPos;
attribute float aSize;
attribute float aAlpha;
varying float vAlpha;
uniform vec2 uRes;
void main() {
  vAlpha = aAlpha;
  gl_Position = vec4(aPos * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = aSize * (uRes.y / 720.0);
}`;

const BUBBLE_FRAG = `
precision mediump float;
varying float vAlpha;
uniform vec3 uTint;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d);
  if (r > 0.5) discard;
  float body = smoothstep(0.5, 0.18, r);
  float hi = smoothstep(0.26, 0.0, length(d + vec2(0.13, -0.13)));
  vec3 col = mix(uTint, vec3(1.0), 0.55) * body + vec3(1.0) * hi * 0.9;
  gl_FragColor = vec4(col, body * vAlpha * 0.85);
}`;

function build(gl: WebGLRenderingContext, vertSrc: string, fragSrc: string) {
  const mk = (type: number, src: string) => {
    const sh = gl.createShader(type);
    if (!sh) return null;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) return null;
    return sh;
  };
  const vs = mk(gl.VERTEX_SHADER, vertSrc);
  const fs = mk(gl.FRAGMENT_SHADER, fragSrc);
  const p = gl.createProgram();
  if (!vs || !fs || !p) return null;
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return null;
  return p;
}

export default function LiquidCursor({ targets, tint = [0.18, 0.95, 0.5] }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lensRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const coarse = window.matchMedia("(hover: none), (pointer: coarse)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (coarse.matches || reduced.matches) return;

    // WebGL2 preferred (native half-float rendering), WebGL1 fallback.
    const gl2 = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: false, antialias: false, depth: false, stencil: false }) as WebGL2RenderingContext | null;
    const gl = (gl2 ?? canvas.getContext("webgl", { alpha: true, premultipliedAlpha: false, antialias: false, depth: false, stencil: false })) as WebGLRenderingContext | null;
    if (!gl) return;
    const isGL2 = !!gl2;

    let intFmt: number, texType: number;
    if (isGL2) {
      if (!gl.getExtension("EXT_color_buffer_float")) return;
      intFmt = (gl as WebGL2RenderingContext).RGBA16F;
      texType = (gl as unknown as { HALF_FLOAT: number }).HALF_FLOAT;
    } else {
      const hf = gl.getExtension("OES_texture_half_float");
      if (!hf) return;
      intFmt = gl.RGBA;
      texType = (gl as unknown as { HALF_FLOAT_OES: number }).HALF_FLOAT_OES;
    }

    // ---- programs ----
    const progs = {
      splat: build(gl, VERT, SPLAT_FRAG),
      advection: build(gl, VERT, ADVECTION_FRAG),
      curl: build(gl, VERT, CURL_FRAG),
      vorticity: build(gl, VERT, VORTICITY_FRAG),
      divergence: build(gl, VERT, DIVERGENCE_FRAG),
      clear: build(gl, VERT, CLEAR_FRAG),
      pressure: build(gl, VERT, PRESSURE_FRAG),
      gradSub: build(gl, VERT, GRADIENT_SUB_FRAG),
      display: build(gl, VERT, DISPLAY_FRAG),
      bubble: build(gl, BUBBLE_VERT, BUBBLE_FRAG),
    };
    for (const p of Object.values(progs)) if (!p) { (window as unknown as { __voltFluid?: string }).__voltFluid = "programs-failed"; return; } // fail soft

    const uni = <T extends Record<string, WebGLProgram | null>>(p: T) => {
      const out: Record<string, Record<string, WebGLUniformLocation | null>> = {};
      for (const name in p) {
        const prog = p[name]!;
        const u: Record<string, WebGLUniformLocation | null> = {};
        const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < n; i++) {
          const info = gl.getActiveUniform(prog, i);
          if (info) u[info.name] = gl.getUniformLocation(prog, info.name);
        }
        out[name] = u;
      }
      return out as Record<keyof T, Record<string, WebGLUniformLocation | null>>;
    };
    const U = uni(progs);

    // fullscreen triangle
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const bindQuad = (prog: WebGLProgram) => {
      const loc = gl.getAttribLocation(prog, "aPos");
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    };

    // ---- framebuffers ----
    const complete = (w: number, h: number) => {
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, intFmt, w, h, 0, gl.RGBA, texType, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fbo = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      if (!ok) { gl.deleteTexture(tex); gl.deleteFramebuffer(fbo); return null; }
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return { tex, fbo, w, h };
    };
    // probe: GPU must be able to render to half-float, else fail soft
    if (!complete(4, 4)) { (window as unknown as { __voltFluid?: string }).__voltFluid = "fbo-failed"; return; }
    (window as unknown as { __voltFluid?: string }).__voltFluid = "running";

    type Target = { tex: WebGLTexture; fbo: WebGLFramebuffer; w: number; h: number };
    type Double = { read: Target; write: Target; swap(): void; w: number; h: number };
    const doubleFBO = (w: number, h: number): Double => {
      const a = complete(w, h)!, b = complete(w, h)!;
      return {
        read: a, write: b, w, h,
        swap() { const r = this.read; this.read = this.write; this.write = r; },
      };
    };
    const singleFBO = (w: number, h: number) => ({ ...complete(w, h)!, w, h });

    let velocity = doubleFBO(SIM_RES, SIM_RES);
    let density = doubleFBO(DYE_RES, DYE_RES);
    let pressureT = doubleFBO(SIM_RES, SIM_RES);
    let divergenceT = singleFBO(SIM_RES, SIM_RES);
    let curlT = singleFBO(SIM_RES, SIM_RES);

    // ---- pointer ----
    const sections: HTMLElement[] = [];
    const collect = () => {
      sections.length = 0;
      for (const sel of targets) {
        const el = document.querySelector(sel);
        if (el instanceof HTMLElement) sections.push(el);
      }
    };
    collect();

    type Splat = { x: number; y: number; vx: number; vy: number };
    const splats: Splat[] = [];
    let lastX = -1, lastY = -1;
    let lastActivity = performance.now();
    let bubbleSpeed = 0; // smoothed, for bubble spawn

    const onMove = (e: PointerEvent) => {
      let inside = false;
      for (const s of sections) {
        const r = s.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) { inside = true; break; }
      }
      if (lastX < 0 || !inside) { lastX = e.clientX; lastY = e.clientY; return; }
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      if (dx === 0 && dy === 0) return;
      bubbleSpeed = bubbleSpeed * 0.8 + Math.hypot(dx, dy) * 0.2;
      lastActivity = performance.now();
      if (splats.length < 32) {
        splats.push({
          x: e.clientX / window.innerWidth,
          y: 1 - e.clientY / window.innerHeight,
          vx: Math.max(-40, Math.min(40, dx)) * FORCE,
          vy: Math.max(-40, Math.min(40, -dy)) * FORCE,
        });
      }
      ensureLoop();
    };

    window.addEventListener("pointermove", onMove, { passive: true });

    // ---- bubbles (CPU-simmed, GPU-drawn) ----
    type Bub = { x: number; y: number; vy: number; vx: number; size: number; life: number; max: number; wob: number };
    const bubbles: Bub[] = [];
    const bubPos = new Float32Array(BUBBLE_CAP * 2);
    const bubSize = new Float32Array(BUBBLE_CAP);
    const bubAlpha = new Float32Array(BUBBLE_CAP);
    const bubPosBuf = gl.createBuffer();
    const bubSizeBuf = gl.createBuffer();
    const bubAlphaBuf = gl.createBuffer();

    // ---- sizing ----
    const resize = () => {
      if (!window.innerWidth || !window.innerHeight) return;
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = "100%";
      canvas.style.height = "100%";
    };
    resize();
    window.addEventListener("resize", resize);

    // ---- passes ----
    const blit = (target: { fbo: WebGLFramebuffer; w: number; h: number } | null) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
      // The viewport must match the target size — sim FBOs are small grids
      // (SIM_RES/DYE_RES), the display target is the full canvas.
      if (target) gl.viewport(0, 0, target.w, target.h);
      else gl.viewport(0, 0, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    const useTex = (unit: number, tex: WebGLTexture, loc: WebGLUniformLocation | null) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(loc, unit);
    };
    const norm = (value: number, dt: number) => Math.pow(value, dt * 60); // hz-normalize

    let running = false;
    let raf = 0;
    let lastT = 0;
    let idleMs = 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!canvas.width || !canvas.height) { resize(); return; }
      const dt = Math.min((now - (lastT || now)) / 1000, 0.033);
      lastT = now;
      const simTexel = [1 / SIM_RES, 1 / SIM_RES];

      // park when nothing has happened for a while
      if (now - lastActivity > IDLE_PARK_MS && bubbles.length === 0) {
        idleMs += dt * 1000;
        if (idleMs > 500) { running = false; cancelAnimationFrame(raf); return; }
      } else {
        idleMs = 0;
      }

      // ---- splats ----
      gl.disable(gl.BLEND);
      if (splats.length) {
        const p = progs.splat!;
        gl.useProgram(p);
        bindQuad(p);
        gl.uniform1f(U.splat.aspectRatio, window.innerWidth / window.innerHeight);
        gl.uniform1f(U.splat.uRadius, (RADIUS * RADIUS) / 100);
        for (const s of splats) {
          gl.uniform2f(U.splat.uPointer, s.x, s.y);
          gl.uniform3f(U.splat.uColor, s.vx, s.vy, 10.0);
          useTex(0, velocity.read.tex, U.splat.uTarget);
          blit(velocity.write);
          velocity.swap();
          useTex(0, density.read.tex, U.splat.uTarget);
          blit(density.write);
          density.swap();
        }
        splats.length = 0;

        // spawn soda bubbles proportional to stroke speed
        const n = Math.min(3, Math.floor(bubbleSpeed / 14) + (bubbleSpeed > 3 ? 1 : 0));
        for (let i = 0; i < n; i++) {
          if (bubbles.length >= BUBBLE_CAP) bubbles.shift();
          bubbles.push({
            x: lastX / window.innerWidth + (Math.random() - 0.5) * 0.04,
            y: 1 - lastY / window.innerHeight + (Math.random() - 0.5) * 0.04,
            vy: 0.0009 + Math.random() * 0.0016,
            vx: (Math.random() - 0.5) * 0.0006,
            size: 2.5 + Math.random() * 5.5,
            life: 0,
            max: 1.1 + Math.random() * 1.3,
            wob: Math.random() * Math.PI * 2,
          });
        }
        bubbleSpeed *= 0.75;
      }

      // ---- curl ----
      let p = progs.curl!;
      gl.useProgram(p);
      bindQuad(p);
      gl.uniform2f(U.curl.texelSize, simTexel[0], simTexel[1]);
      useTex(0, velocity.read.tex, U.curl.uVelocity);
      blit(curlT);

      // ---- vorticity confinement ----
      p = progs.vorticity!;
      gl.useProgram(p);
      bindQuad(p);
      gl.uniform2f(U.vorticity.texelSize, simTexel[0], simTexel[1]);
      useTex(0, velocity.read.tex, U.vorticity.uVelocity);
      useTex(1, curlT.tex, U.vorticity.uCurl);
      gl.uniform1f(U.vorticity.uCurlValue, CURL);
      gl.uniform1f(U.vorticity.dt, dt);
      blit(velocity.write);
      velocity.swap();

      // ---- divergence ----
      p = progs.divergence!;
      gl.useProgram(p);
      bindQuad(p);
      gl.uniform2f(U.divergence.texelSize, simTexel[0], simTexel[1]);
      useTex(0, velocity.read.tex, U.divergence.uVelocity);
      blit(divergenceT);

      // ---- pressure decay ----
      p = progs.clear!;
      gl.useProgram(p);
      bindQuad(p);
      useTex(0, pressureT.read.tex, U.clear.uTexture);
      gl.uniform1f(U.clear.uClearValue, norm(PRESSURE, dt));
      blit(pressureT.write);
      pressureT.swap();

      // ---- pressure Jacobi ----
      p = progs.pressure!;
      gl.useProgram(p);
      bindQuad(p);
      gl.uniform2f(U.pressure.texelSize, simTexel[0], simTexel[1]);
      useTex(1, divergenceT.tex, U.pressure.uDivergence);
      for (let i = 0; i < SWIRL; i++) {
        useTex(0, pressureT.read.tex, U.pressure.uPressure);
        blit(pressureT.write);
        pressureT.swap();
      }

      // ---- subtract pressure gradient → divergence-free velocity ----
      p = progs.gradSub!;
      gl.useProgram(p);
      bindQuad(p);
      gl.uniform2f(U.gradSub.texelSize, simTexel[0], simTexel[1]);
      useTex(0, pressureT.read.tex, U.gradSub.uPressure);
      useTex(1, velocity.read.tex, U.gradSub.uVelocity);
      blit(velocity.write);
      velocity.swap();

      // ---- advect velocity ----
      p = progs.advection!;
      gl.useProgram(p);
      bindQuad(p);
      gl.uniform2f(U.advection.texelSize, simTexel[0], simTexel[1]);
      gl.uniform1f(U.advection.dt, dt);
      useTex(0, velocity.read.tex, U.advection.uVelocity);
      useTex(1, velocity.read.tex, U.advection.uSource);
      gl.uniform1f(U.advection.uDissipation, norm(VELOCITY_DISSIPATION, dt));
      blit(velocity.write);
      velocity.swap();

      // ---- advect dye ----
      useTex(0, velocity.read.tex, U.advection.uVelocity);
      useTex(1, density.read.tex, U.advection.uSource);
      gl.uniform1f(U.advection.uDissipation, norm(DENSITY_DISSIPATION, dt));
      blit(density.write);
      density.swap();

      // ---- display: demo composite math, transparent background ----
      // The shader outputs premultiplied color, so blend ONE / ONE_MINUS_SRC_ALPHA.
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      p = progs.display!;
      gl.useProgram(p);
      bindQuad(p);
      useTex(0, density.read.tex, U.display.uFluid);
      gl.uniform3f(U.display.uTint, tint[0], tint[1], tint[2]);
      gl.uniform1f(U.display.uIntensity, DISPLAY_INTENSITY);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // ---- bubbles ----
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        b.life += dt;
        if (b.life > b.max) { bubbles.splice(i, 1); continue; }
        b.wob += dt * 5;
        b.y += b.vy * dt * 60;
        b.x += b.vx * dt * 60 + Math.sin(b.wob) * 0.00035;
      }
      if (bubbles.length) {
        for (let i = 0; i < bubbles.length; i++) {
          const b = bubbles[i];
          bubPos[i * 2] = b.x;
          bubPos[i * 2 + 1] = b.y;
          bubSize[i] = b.size;
          bubAlpha[i] = Math.sin((b.life / b.max) * Math.PI);
        }
        p = progs.bubble!;
        gl.useProgram(p);
        gl.uniform2f(U.bubble.uRes, canvas.width, canvas.height);
        gl.uniform3f(U.bubble.uTint, tint[0], tint[1], tint[2]);
        gl.bindBuffer(gl.ARRAY_BUFFER, bubPosBuf);
        gl.bufferData(gl.ARRAY_BUFFER, bubPos, gl.DYNAMIC_DRAW);
        const aPos = gl.getAttribLocation(p, "aPos");
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, bubSizeBuf);
        gl.bufferData(gl.ARRAY_BUFFER, bubSize, gl.DYNAMIC_DRAW);
        const aSize = gl.getAttribLocation(p, "aSize");
        gl.enableVertexAttribArray(aSize);
        gl.vertexAttribPointer(aSize, 1, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, bubAlphaBuf);
        gl.bufferData(gl.ARRAY_BUFFER, bubAlpha, gl.DYNAMIC_DRAW);
        const aAlpha = gl.getAttribLocation(p, "aAlpha");
        gl.enableVertexAttribArray(aAlpha);
        gl.vertexAttribPointer(aAlpha, 1, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.POINTS, 0, bubbles.length);
      }
      gl.disable(gl.BLEND);

      // glass lens follows the raw cursor
      const lens = lensRef.current;
      if (lens && lastX >= 0) {
        lens.style.transform = `translate3d(${lastX}px, ${lastY}px, 0) translate(-50%, -50%)`;
        lens.style.opacity = "0.35";
      }
    };

    const ensureLoop = () => {
      if (running) return;
      running = true;
      lastT = 0;
      idleMs = 0;
      raf = requestAnimationFrame(frame);
    };
    ensureLoop();

    const onVis = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else {
        ensureLoop();
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
      // Deliberately do NOT lose the context: the canvas survives React
      // StrictMode remounts, and a lost context can never be recovered.
      void gl;
    };
  }, [targets, tint]);

  return (
    <>
      <canvas ref={canvasRef} className="volt-liquid-canvas" aria-hidden="true" />
      <div ref={lensRef} className="volt-liquid-lens" aria-hidden="true" />
    </>
  );
}
