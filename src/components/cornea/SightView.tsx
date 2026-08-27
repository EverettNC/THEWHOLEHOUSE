import { useEffect, useRef, useState } from "react";
import { WORLDS, type CorneaParams, type OpticalReport } from "@/lib/cornea/optics";
import { makeFallbackWorld } from "@/lib/cornea/textures";
import {
  attachClipboardData,
  attachDroppedFiles,
  focusSeeWindow,
  flipCamera,
  isEmbeddedFrame,
  liveSourceReady,
  startDeviceCamera,
  stopLiveFeed,
  useLiveFeed,
} from "@/lib/cornea/live-feed";
import { useCornea, useCorneaParams, useOptics } from "@/lib/cornea/store";
import { LightAsk } from "./LightAsk";

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAG = `
precision highp float;
uniform sampler2D uWorld;
uniform vec2 uRes;
uniform float uTime;
uniform float uAstig;
uniform float uAxis;
uniform float uQ;
uniform float uScatter;
uniform float uTear;
uniform float uFocus;
uniform float uChroma;
uniform float uPupil;
uniform float uKerato;
uniform float uTransmission;
uniform float uCompare;
uniform float uMosaic;
varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

vec2 rotate(vec2 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  p.x *= uRes.x / max(uRes.y, 1.0);
  float r = length(p);
  float split = uCompare > 0.5 && vUv.x < 0.5 ? 1.0 : 0.0;

  vec2 uv = vUv;
  vec3 col;

  if (split > 0.5) {
    col = texture2D(uWorld, uv).rgb;
  } else {
    float k = 1.0 + uQ * r * r * 0.42;
    vec2 mapped = p * k;

    float cone = uKerato * exp(-pow(length(p - vec2(0.0, -0.28)), 2.0) / 0.18);
    mapped *= 1.0 - cone * 0.28;
    mapped += vec2(cone * 0.08, cone * 0.14);

    vec2 rot = rotate(mapped, uAxis);
    rot.x *= 1.0 + uAstig * 0.035;
    mapped = rotate(rot, -uAxis);

    float aspect = uRes.x / max(uRes.y, 1.0);
    vec2 q = vec2(mapped.x / aspect, mapped.y);
    uv = q * 0.5 + 0.5;

    float wobble = (1.0 - uTear) * 0.012;
    uv += vec2(
      sin(uTime * 1.7 + vUv.y * 28.0) * wobble,
      cos(uTime * 1.3 + vUv.x * 24.0) * wobble * 0.7
    );

    vec2 uvR = 0.5 + (uv - 0.5) * (1.0 + uChroma * r);
    vec2 uvB = 0.5 + (uv - 0.5) * (1.0 - uChroma * r);

    float blur = clamp(abs(uFocus) * 0.9, 0.0, 7.0);
    vec2 px = blur / uRes;

    vec3 acc = vec3(0.0);
    acc += vec3(texture2D(uWorld, uvR).r, texture2D(uWorld, uv).g, texture2D(uWorld, uvB).b);
    acc += vec3(texture2D(uWorld, uvR + vec2(px.x, 0.0)).r, texture2D(uWorld, uv + vec2(px.x, 0.0)).g, texture2D(uWorld, uvB + vec2(px.x, 0.0)).b);
    acc += vec3(texture2D(uWorld, uvR - vec2(px.x, 0.0)).r, texture2D(uWorld, uv - vec2(px.x, 0.0)).g, texture2D(uWorld, uvB - vec2(px.x, 0.0)).b);
    acc += vec3(texture2D(uWorld, uvR + vec2(0.0, px.y)).r, texture2D(uWorld, uv + vec2(0.0, px.y)).g, texture2D(uWorld, uvB + vec2(0.0, px.y)).b);
    acc += vec3(texture2D(uWorld, uvR - vec2(0.0, px.y)).r, texture2D(uWorld, uv - vec2(0.0, px.y)).g, texture2D(uWorld, uvB - vec2(0.0, px.y)).b);
    acc += vec3(texture2D(uWorld, uvR + px).r, texture2D(uWorld, uv + px).g, texture2D(uWorld, uvB + px).b);
    acc += vec3(texture2D(uWorld, uvR - px).r, texture2D(uWorld, uv - px).g, texture2D(uWorld, uvB - px).b);
    col = acc / 7.0;

    vec3 haze = vec3(0.78, 0.81, 0.8);
    col = mix(col, haze * (0.35 + 0.65 * col), uScatter * 0.72);
    col *= uTransmission * 1.18;
    col += vec3(0.08, 0.1, 0.11) * uTear * smoothstep(0.72, 0.2, r) * 0.18;

    float aperture = smoothstep(uPupil + 0.08, uPupil - 0.02, r / 1.15);
    col *= mix(0.05, 1.0, aperture);
  }

  if (uMosaic > 0.5) {
    float pitch = mix(220.0, 140.0, split);
    vec2 g = floor(vUv * pitch);
    vec2 cell = fract(vUv * pitch);
    float bayer = mod(g.x + g.y, 2.0);
    col *= 0.92 + 0.08 * bayer;
    col *= 0.88 + 0.12 * smoothstep(0.08, 0.22, min(cell.x, cell.y) * min(1.0 - cell.x, 1.0 - cell.y));
  }

  if (uCompare > 0.5) {
    float line = smoothstep(0.003, 0.0, abs(vUv.x - 0.5));
    col = mix(col, vec3(0.77, 0.82, 0.83), line);
  }

  col += (hash(vUv * uRes + uTime) - 0.5) * 0.025;
  gl_FragColor = vec4(pow(clamp(col, 0.0, 1.0), vec3(0.96)), 1.0);
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type);
  if (!sh) throw new Error("shader");
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(info || "compile");
  }
  return sh;
}

interface FrameState {
  params: CorneaParams;
  optics: OpticalReport;
  compare: boolean;
  mosaic: boolean;
  live: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | null;
  demo: HTMLImageElement | HTMLCanvasElement | null;
}

function IncomingPip() {
  const live = useLiveFeed();
  const src = liveSourceReady(live);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !src) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const draw = () => {
      try {
        ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
      } catch {
        /* keep last */
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [src]);

  if (!src) return null;
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 overflow-hidden rounded-md shadow-[var(--shadow-border)]">
      <canvas ref={canvasRef} width={168} height={96} className="block h-16 w-28 object-cover sm:h-20 sm:w-36" />
      <span className="absolute top-1 left-1 font-mono text-[10px] tracking-wide text-fg/80">INCOMING</span>
    </div>
  );
}

export function SightView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | HTMLCanvasElement | null>(null);
  const params = useCorneaParams();
  const optics = useOptics();
  const worldId = useCornea((s) => s.worldId);
  const demoWorld = useCornea((s) => s.demoWorld);
  const compare = useCornea((s) => s.compare);
  const mosaic = useCornea((s) => s.mosaic);
  const setCameraOn = useCornea((s) => s.setCameraOn);
  const setDemoWorld = useCornea((s) => s.setDemoWorld);
  const live = useLiveFeed();
  const liveSrc = liveSourceReady(live);
  const [hover, setHover] = useState(false);
  const frame = useRef<FrameState>({
    params,
    optics,
    compare,
    mosaic,
    live: liveSrc,
    demo: null,
  });
  frame.current = {
    params,
    optics,
    compare,
    mosaic,
    live: liveSrc,
    demo: demoWorld ? imgRef.current : null,
  };

  useEffect(() => {
    setCameraOn(live.status === "live", live.error);
  }, [live.status, live.error, setCameraOn]);

  useEffect(() => {
    if (live.status === "live") setDemoWorld(false);
  }, [live.status, setDemoWorld]);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      void attachClipboardData(e.clipboardData);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  useEffect(() => {
    if (isEmbeddedFrame()) return;
    void startDeviceCamera("environment", { silent: true });
  }, []);

  useEffect(() => {
    if (!demoWorld) {
      imgRef.current = null;
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = WORLDS.find((w) => w.id === worldId)?.src ?? WORLDS[0].src;
    img.onload = () => {
      imgRef.current = img;
    };
    img.onerror = () => {
      imgRef.current = makeFallbackWorld();
    };
  }, [worldId, demoWorld]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl =
      canvas.getContext("webgl", { premultipliedAlpha: false, alpha: false, antialias: false }) ||
      (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);

    const sizeCanvas = () => {
      const parent = canvas.parentElement;
      const w = Math.max(2, parent?.clientWidth ?? 640);
      const h = Math.max(2, parent?.clientHeight ?? 360);
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      const tw = Math.floor(w * dpr);
      const th = Math.floor(h * dpr);
      if (canvas.width !== tw || canvas.height !== th) {
        canvas.width = tw;
        canvas.height = th;
      }
      return { tw, th, w, h };
    };

    const blank = document.createElement("canvas");
    blank.width = 4;
    blank.height = 4;
    const blankCtx = blank.getContext("2d");
    if (blankCtx) {
      blankCtx.fillStyle = "#09090b";
      blankCtx.fillRect(0, 0, 4, 4);
    }

    const pickSource = (): HTMLCanvasElement | HTMLImageElement | HTMLVideoElement => {
      const state = frame.current;
      if (state.live) return state.live;
      if (state.demo) return state.demo;
      return blank;
    };

    if (!gl) {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      let raf = 0;
      const draw2d = () => {
        const { tw, th } = sizeCanvas();
        const source = pickSource();
        ctx.fillStyle = "#09090b";
        ctx.fillRect(0, 0, tw, th);
        ctx.save();
        ctx.beginPath();
        ctx.arc(tw / 2, th / 2, Math.min(tw, th) * 0.46, 0, Math.PI * 2);
        ctx.clip();
        try {
          ctx.filter = `blur(${Math.min(6, Math.abs(frame.current.optics.defocusD))}px)`;
          ctx.drawImage(source, 0, 0, tw, th);
        } catch {
          /* keep last frame */
        }
        ctx.restore();
        raf = requestAnimationFrame(draw2d);
      };
      raf = requestAnimationFrame(draw2d);
      return () => cancelAnimationFrame(raf);
    }

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    const prog = gl.createProgram();
    if (!prog) return;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.bindAttribLocation(prog, 0, "aPos");
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      return;
    }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      2,
      2,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([8, 8, 9, 255, 8, 8, 9, 255, 8, 8, 9, 255, 8, 8, 9, 255]),
    );

    const loc = (name: string) => gl.getUniformLocation(prog, name);
    gl.uniform1i(loc("uWorld"), 0);

    let raf = 0;
    const start = performance.now();

    const draw = () => {
      const { tw, th } = sizeCanvas();
      gl.viewport(0, 0, tw, th);

      const state = frame.current;
      const source = pickSource();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
      try {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      } catch {
        /* keep last frame if upload fails */
      }

      const { params: pr, optics: op } = state;
      const pupilNorm = Math.min(1.35, (pr.pupilMm / 8) * 1.65);
      gl.uniform2f(loc("uRes"), tw, th);
      gl.uniform1f(loc("uTime"), (performance.now() - start) / 1000);
      gl.uniform1f(loc("uAstig"), pr.astigmatismD);
      gl.uniform1f(loc("uAxis"), (pr.axisDeg * Math.PI) / 180);
      gl.uniform1f(loc("uQ"), pr.qAnterior);
      gl.uniform1f(loc("uScatter"), op.scatter);
      gl.uniform1f(loc("uTear"), pr.tearFilm);
      gl.uniform1f(loc("uFocus"), op.defocusD);
      gl.uniform1f(loc("uChroma"), 0.012 + Math.abs(pr.astigmatismD) * 0.004 + pr.keratoconus * 0.02);
      gl.uniform1f(loc("uPupil"), pupilNorm);
      gl.uniform1f(loc("uKerato"), pr.keratoconus);
      gl.uniform1f(loc("uTransmission"), op.transmission);
      gl.uniform1f(loc("uCompare"), state.compare ? 1 : 0);
      gl.uniform1f(loc("uMosaic"), state.mosaic ? 1 : 0);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buf);
      gl.deleteTexture(tex);
    };
  }, []);

  const liveLabel = liveSrc
    ? live.kind === "screen"
      ? "YOUR SCREEN THROUGH CORNEA"
      : live.kind === "file"
        ? "YOUR PHOTO THROUGH CORNEA"
        : "YOUR SIGHT THROUGH CORNEA"
    : live.eyeOpen
      ? "SIGHT IS IN THE EYE WINDOW"
      : "SILICON RETINA";

  return (
    <div className="relative h-full w-full overflow-hidden bg-bg">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {live.status !== "live" && !live.eyeOpen && !live.embedded ? (
        <div
          className="absolute inset-0 z-[5]"
          onDragOver={(e) => {
            e.preventDefault();
            setHover(true);
          }}
          onDragLeave={() => setHover(false)}
          onDrop={(e) => {
            e.preventDefault();
            setHover(false);
            void attachDroppedFiles(e.dataTransfer.files);
          }}
          onClick={() => void startDeviceCamera()}
        />
      ) : live.eyeOpen && !liveSrc ? (
        <div className="absolute inset-0 z-[5]" onClick={() => focusSeeWindow()} />
      ) : null}
      {hover ? (
        <div className="pointer-events-none absolute inset-0 z-[6] flex items-center justify-center bg-bg/50">
          <p className="text-sm text-fg">Drop still light only if you need it</p>
        </div>
      ) : null}
      {compare ? (
        <>
          <span className="pointer-events-none absolute top-3 left-3 font-mono text-xs tracking-wide text-fg/70">
            RAW
          </span>
          <span className="pointer-events-none absolute top-3 right-3 font-mono text-xs tracking-wide text-fg/70">
            THROUGH CORNEA
          </span>
        </>
      ) : (
        <span className="pointer-events-none absolute top-3 left-3 font-mono text-xs tracking-wide text-fg/70">
          {liveLabel}
        </span>
      )}
      {!compare ? <IncomingPip /> : null}
      <LightAsk />
      {live.status === "live" || live.eyeOpen ? (
        <div className="absolute right-3 bottom-3 z-10 flex gap-2">
          {live.kind === "camera" ? (
            <button
              type="button"
              className="h-11 rounded-md px-3 text-sm text-muted shadow-[var(--shadow-border)] hover:text-fg"
              onClick={() => void flipCamera()}
            >
              Flip
            </button>
          ) : null}
          <button
            type="button"
            className="h-11 rounded-md px-3 text-sm text-muted shadow-[var(--shadow-border)] hover:text-fg"
            onClick={() => stopLiveFeed()}
          >
            Change light
          </button>
        </div>
      ) : null}
    </div>
  );
}
