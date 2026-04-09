"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import useHandDetectionStore from "@/store/handDetection";
import type { NormalizedLandmark } from "@/util/MediaPipe";
import { startCamera } from "@/util/camera";
import { initHandLandmarker } from "@/util/MediaPipe";
import { drawLoop } from "@/util/drawLoop";

interface CameraFeedProps {
  debugMode: boolean;
}

const CameraFeed = ({ debugMode }: CameraFeedProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handLandmarkerRef = useRef<any>(null);
  const landmarksRef = useRef<NormalizedLandmark[][]>([]);
  const lastVideoTimeRef = useRef<number>(-1);
  const prevHandDetectedRef = useRef<boolean>(false);

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraFps, setCameraFps] = useState<number | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const onboardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { handDetected, setHandDetected, setCurrentGesture, cameraEnabled } =
    useHandDetectionStore();

  // ─── Camera stream lifecycle ────────────────────────────────────
  useEffect(() => {
    if (!cameraEnabled) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setCameraReady(false);
      setCameraFps(null);
      setHandDetected(false);
      setCurrentGesture(null);
      return;
    }
    let active = true;
    startCamera(
      active,
      videoRef,
      streamRef,
      setCameraError,
      setCameraFps,
      setCameraReady,
    );
    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [cameraEnabled, setHandDetected, setCurrentGesture]);

  // ─── MediaPipe HandLandmarker initialisation ───────────────────
  useEffect(() => {
    let cancelled = false;
    initHandLandmarker(cancelled, handLandmarkerRef);
    return () => {
      cancelled = true;
      handLandmarkerRef.current?.close();
      handLandmarkerRef.current = null;
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

  // ─── Main render loop ──────────────────────────────────────────
  const draw = useCallback(() => {
    if (!cameraEnabled) return;
    drawLoop(
      canvasRef,
      containerRef,
      videoRef,
      handLandmarkerRef,
      landmarksRef,
      lastVideoTimeRef,
      prevHandDetectedRef,
      setHandDetected,
      setCurrentGesture,
      debugMode,
    );
  }, [debugMode, setHandDetected, cameraEnabled]);

  useEffect(() => {
    const loop = () => {
      draw();
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
        {/* Live camera feed — mirrored so it feels like a selfie view */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
          style={{ transform: "scaleX(-1)" }}
        />

        {/* Camera disabled overlay */}
        {!cameraEnabled && (
          <div className="absolute inset-0 bg-gradient-to-br from-surface-container-lowest via-[#08101e] to-surface-container-lowest flex flex-col items-center justify-center gap-3">
            <span className="material-symbols-outlined text-outline text-5xl">
              no_photography
            </span>
            <p className="text-sm text-on-surface-variant font-headline">
              Camera is off
            </p>
            <p className="text-xs text-outline text-center max-w-[200px]">
              Click the camera icon in the nav to turn it back on.
            </p>
          </div>
        )}

        {/* Initializing overlay — shown while waiting for camera permission */}
        {!cameraReady && !cameraError && (
          <div className="absolute inset-0 bg-gradient-to-br from-surface-container-lowest via-[#08101e] to-surface-container-lowest flex flex-col items-center justify-center gap-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-8 h-8 text-primary animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              />
            </svg>
            <p className="text-sm text-on-surface-variant font-headline">
              Initializing camera…
            </p>
            <p className="text-xs text-outline text-center max-w-[200px]">
              Please allow camera access when prompted.
            </p>
          </div>
        )}

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
          <div className="absolute bottom-5 right-6 pointer-events-none animate-tooltip-appear">
            <div className="bg-surface-variant/40 backdrop-blur-xl px-6 py-3 rounded-2xl border border-primary/20 text-center">
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
