"use client";

import { useRef, useEffect, useState, useCallback } from "react";

// ─── Mock 21-point MediaPipe hand landmarks (normalized x, y) ───
const BASE_LM: [number, number][] = [
  [0.5, 0.7], // 0  wrist
  [0.47, 0.62], // 1  thumb cmc
  [0.44, 0.55], // 2  thumb mcp
  [0.41, 0.49], // 3  thumb ip
  [0.39, 0.44], // 4  thumb tip
  [0.51, 0.55], // 5  index mcp
  [0.52, 0.46], // 6  index pip
  [0.53, 0.39], // 7  index dip
  [0.54, 0.34], // 8  index tip
  [0.56, 0.54], // 9  middle mcp
  [0.58, 0.44], // 10 middle pip
  [0.59, 0.37], // 11 middle dip
  [0.6, 0.32], // 12 middle tip
  [0.62, 0.55], // 13 ring mcp
  [0.64, 0.45], // 14 ring pip
  [0.65, 0.38], // 15 ring dip
  [0.66, 0.33], // 16 ring tip
  [0.67, 0.57], // 17 pinky mcp
  [0.69, 0.49], // 18 pinky pip
  [0.7, 0.43], // 19 pinky dip
  [0.71, 0.38], // 20 pinky tip
];

const CONNECTIONS: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [0, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [0, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [5, 9],
  [9, 13],
  [13, 17],
];

interface CameraFeedProps {
  handDetected: boolean;
  debugMode: boolean;
}

const CameraFeed = ({ handDetected, debugMode }: CameraFeedProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraFps, setCameraFps] = useState<number | null>(null);
  const onboardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Camera stream lifecycle ────────────────────────────────────
  useEffect(() => {
    let active = true;
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        console.log("Camera stream started:", stream);
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        const trackFps = stream.getVideoTracks()[0]?.getSettings().frameRate;
        setCameraFps(trackFps ?? null);
        setCameraError(null);
      } catch (err) {
        if (!active) return;
        const msg = err instanceof Error ? err.message : "Camera unavailable";
        setCameraError(msg);
      }
    }
    startCamera();
    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  // ─── Onboarding tooltip after 5 s without a hand ───────────────
  useEffect(() => {
    if (handDetected) {
      setShowOnboarding(false);
      if (onboardTimerRef.current) clearTimeout(onboardTimerRef.current);
    } else {
      onboardTimerRef.current = setTimeout(() => setShowOnboarding(true), 5000);
    }
    return () => {
      if (onboardTimerRef.current) clearTimeout(onboardTimerRef.current);
    };
  }, [handDetected]);

  // ─── Draw arrow helper ─────────────────────────────────────────
  const drawArrow = (
    ctx: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: string,
  ) => {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headLen = 10;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(
      x2 - headLen * Math.cos(angle - Math.PI / 6),
      y2 - headLen * Math.sin(angle - Math.PI / 6),
    );
    ctx.moveTo(x2, y2);
    ctx.lineTo(
      x2 - headLen * Math.cos(angle + Math.PI / 6),
      y2 - headLen * Math.sin(angle + Math.PI / 6),
    );
    ctx.stroke();
  };

  // ─── Main render loop ──────────────────────────────────────────
  const draw = useCallback(
    (time: number) => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const w = container.clientWidth;
      const h = container.clientHeight;
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);

      if (!handDetected) return;

      const t = time / 1000;

      // Animate landmarks with subtle breathing motion
      const lm = BASE_LM.map(([px, py], i) => ({
        x: px * w + Math.sin(t * 0.9 + i * 0.45) * 3.5,
        y: py * h + Math.cos(t * 0.7 + i * 0.35) * 3.5,
      }));

      // Connections
      ctx.strokeStyle = "rgba(137, 206, 255, 0.45)";
      ctx.lineWidth = 1.5;
      CONNECTIONS.forEach(([a, b]) => {
        ctx.beginPath();
        ctx.moveTo(lm[a].x, lm[a].y);
        ctx.lineTo(lm[b].x, lm[b].y);
        ctx.stroke();
      });

      // Landmark dots
      lm.forEach((pt, i) => {
        const r = i === 0 ? 5 : 3.5;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
        ctx.fillStyle =
          i === 0 ? "rgba(137, 206, 255, 0.95)" : "rgba(137, 206, 255, 0.75)";
        ctx.fill();
      });

      // Bounding box
      const xs = lm.map((p) => p.x);
      const ys = lm.map((p) => p.y);
      const pad = 18;
      const bx = Math.min(...xs) - pad;
      const by = Math.min(...ys) - pad;
      const bw = Math.max(...xs) - Math.min(...xs) + pad * 2;
      const bh = Math.max(...ys) - Math.min(...ys) + pad * 2;

      ctx.strokeStyle = "rgba(137, 206, 255, 0.4)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 6]);
      ctx.strokeRect(bx, by, bw, bh);
      ctx.setLineDash([]);

      // ─── Debug overlay: velocity vectors ──────────────────────
      if (debugMode) {
        const cx = bx + bw / 2;
        const cy = by + bh / 2;
        const vx = Math.sin(t) * 45;
        const vy = Math.cos(t * 0.7) * 35;
        drawArrow(ctx, cx, cy, cx + vx, cy + vy, "rgba(255, 185, 95, 0.9)");

        ctx.fillStyle = "rgba(255, 185, 95, 0.85)";
        ctx.font = "11px Inter, sans-serif";
        ctx.fillText(
          `dx: ${vx.toFixed(1)}  dy: ${vy.toFixed(1)}`,
          bx + 6,
          by - 8,
        );
      }
    },
    [handDetected, debugMode],
  );

  useEffect(() => {
    const loop = (time: number) => {
      draw(time);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  return (
    <div className="relative group">
      {/* Ambient glow layer — pulses when hand is detected */}
      <div
        className={`absolute -inset-0.5 bg-gradient-to-r from-primary to-primary-container
                    blur-xl rounded-3xl transition-opacity duration-500
                    ${handDetected ? "opacity-40 animate-kinetic-ring" : "opacity-20"}`}
      />

      {/* Card */}
      <div
        ref={containerRef}
        className="relative rounded-3xl overflow-hidden aspect-video bg-surface-container-lowest
                   border border-outline-variant/15"
      >
        {/* Live camera feed */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Fallback dark background shown when camera is unavailable */}
        {cameraError && (
          <div className="absolute inset-0 bg-gradient-to-br from-surface-container-lowest via-[#08101e] to-surface-container-lowest flex flex-col items-center justify-center gap-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-10 h-10 text-outline"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9A2.25 2.25 0 0013.5 5.25h-9A2.25 2.25 0 002.25 7.5v9A2.25 2.25 0 004.5 18.75z"
              />
            </svg>
            <p className="text-sm text-on-surface-variant font-headline">
              Camera access denied
            </p>
            <p className="text-xs text-outline text-center max-w-[200px]">
              {cameraError}
            </p>
          </div>
        )}

        {/* Subtle grid lines — AR aesthetic */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(137,206,255,1) 1px, transparent 1px)," +
              "linear-gradient(90deg, rgba(137,206,255,1) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        {/* AR pulse ring behind centre */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className={`w-48 h-48 rounded-full bg-primary/5 animate-ar-pulse
                        ${handDetected ? "block" : "hidden"}`}
          />
        </div>

        {/* Landmark canvas */}
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

        {/* HUD overlay */}
        <div className="absolute inset-0 p-6 flex flex-col justify-between pointer-events-none">
          {/* Top row — status pill + FPS */}
          <div className="flex justify-between items-start">
            <div
              className="bg-surface-variant/40 backdrop-blur-xl px-4 py-2 rounded-full
                         border border-outline-variant/15 flex items-center gap-3"
            >
              <span
                className={`w-2 h-2 rounded-full transition-all duration-500 flex-shrink-0
                            ${
                              handDetected
                                ? "bg-secondary shadow-[0_0_8px_rgba(78,222,163,0.8)] animate-pulse"
                                : "bg-outline"
                            }`}
              />
              <span className="text-sm font-headline tracking-widest text-on-surface whitespace-nowrap">
                {handDetected ? "Hand Detected" : "No Hand Detected"}
              </span>
            </div>

            <div
              className="bg-surface-variant/40 backdrop-blur-xl px-4 py-2 rounded-full
                         border border-outline-variant/15"
            >
              <span className="text-sm font-headline text-on-surface-variant uppercase tracking-tight tabular-nums">
                FPS: {cameraFps !== null ? cameraFps.toFixed(1) : "--"}
              </span>
            </div>
          </div>

          {/* Bottom — engine badge */}
          <div className="flex justify-center">
            <div
              className="bg-surface-variant/40 backdrop-blur-xl px-6 py-2 rounded-xl
                         border border-outline-variant/15"
            >
              <span className="text-xs font-headline text-primary-fixed-dim uppercase tracking-[0.2em]">
                Spatial Engine Active
              </span>
            </div>
          </div>
        </div>

        {/* Onboarding tooltip */}
        {showOnboarding && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 pointer-events-none animate-tooltip-appear">
            <div
              className="bg-surface-variant/40 backdrop-blur-xl px-6 py-3 rounded-2xl
                         border border-primary/20 text-center"
            >
              <p className="text-sm font-headline text-primary">
                Show your hand to start
              </p>
              <p className="text-xs text-on-surface-variant mt-1">
                Try swiping left / right
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CameraFeed;
