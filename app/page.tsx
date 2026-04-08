"use client";

import { useState, useEffect, useRef } from "react";
import CameraFeed from "@/components/CameraFeed";
import GestureIntelligencePanel, {
  type GestureEntry,
} from "@/components/GestureIntelligencePanel";

// ─── Mock gesture data ──────────────────────────────────────────
const MOCK_GESTURES: Omit<GestureEntry, "id" | "timestamp">[] = [
  {
    name: "Swipe Right",
    icon: "swipe_right",
    action: "Navigate Forward",
    confidence: 97,
  },
  {
    name: "Swipe Left",
    icon: "swipe_left",
    action: "Navigate Back",
    confidence: 94,
  },
  { name: "Swipe Up", icon: "swipe_up", action: "Scroll Up", confidence: 91 },
  {
    name: "Swipe Down",
    icon: "swipe_down",
    action: "Scroll Down",
    confidence: 89,
  },
  { name: "Pinch", icon: "pinch", action: "Zoom In", confidence: 88 },
  { name: "Hold", icon: "back_hand", action: "System Pause", confidence: 100 },
];

let gestureSeq = 0;

const makeEntry = (
  base: Omit<GestureEntry, "id" | "timestamp">,
): GestureEntry => {
  return { ...base, id: `g-${++gestureSeq}`, timestamp: new Date() };
};

// ─── Sensitivity slider row ─────────────────────────────────────
const SensitivitySlider = ({
  label,
  defaultValue,
}: {
  label: string;
  defaultValue: number;
}) => {
  const [val, setVal] = useState(defaultValue);
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-xs font-headline uppercase tracking-wider text-on-surface-variant/70">
          {label}
        </span>
        <span className="text-xs font-headline text-primary tabular-nums w-10 text-right">
          {(val / 100).toFixed(2)}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={val}
        onChange={(e) => setVal(Number(e.target.value))}
        className="w-full"
        style={{ accentColor: "#89ceff" }}
      />
    </div>
  );
};

// ─── Pill toggle ────────────────────────────────────────────────
const PillToggle = ({
  label,
  defaultOn = false,
}: {
  label: string;
  defaultOn?: boolean;
}) => {
  const [on, setOn] = useState(defaultOn);
  return (
    <label className="flex items-center justify-between group cursor-pointer">
      <span className="text-on-surface-variant group-hover:text-primary transition-colors duration-200 text-sm">
        {label}
      </span>
      <button
        role="switch"
        aria-checked={on}
        onClick={() => setOn(!on)}
        className={`relative w-10 h-5 rounded-full transition-all duration-300
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40
                    ${on ? "bg-secondary-container" : "bg-surface-container-highest"}`}
      >
        <span
          className={`absolute top-0.5 w-4 h-4 rounded-full transition-all duration-300
                      ${on ? "right-0.5 bg-on-surface" : "left-0.5 bg-on-surface-variant"}`}
        />
      </button>
    </label>
  );
};

// ─── Page ───────────────────────────────────────────────────────
const DashboardPage = () => {
  const [handDetected, setHandDetected] = useState(false);
  const [fps, setFps] = useState(30.0);
  const [debugMode, setDebugMode] = useState(false);
  const [currentGesture, setCurrentGesture] = useState<GestureEntry | null>(
    null,
  );
  const [gestureHistory, setGestureHistory] = useState<GestureEntry[]>([]);
  const [actionKey, setActionKey] = useState(0);

  const handDetectedRef = useRef(handDetected);
  const gestureIndexRef = useRef(0);

  useEffect(() => {
    handDetectedRef.current = handDetected;
  }, [handDetected]);

  useEffect(() => {
    // Simulate hand appearing after 2 s
    const handTimer = setTimeout(() => setHandDetected(true), 2000);

    // Mock gesture recognition every 3 s
    const gestureInterval = setInterval(() => {
      if (!handDetectedRef.current) return;
      const base =
        MOCK_GESTURES[gestureIndexRef.current % MOCK_GESTURES.length];
      gestureIndexRef.current += 1;
      const entry = makeEntry(base);
      setCurrentGesture(entry);
      setGestureHistory((prev) => [entry, ...prev].slice(0, 8));
      setActionKey((k) => k + 1);
    }, 3000);

    // Simulate occasional hand loss
    const detectionInterval = setInterval(() => {
      if (Math.random() < 0.04) {
        setHandDetected(false);
        setTimeout(() => setHandDetected(true), 2500);
      }
    }, 4000);

    // FPS simulation
    const fpsInterval = setInterval(() => {
      setFps(27 + Math.random() * 6);
    }, 1000);

    return () => {
      clearTimeout(handTimer);
      clearInterval(gestureInterval);
      clearInterval(detectionInterval);
      clearInterval(fpsInterval);
    };
  }, []);

  return (
    <div className="relative">
      {/* Page heading */}
      <div className="mb-8">
        <h1 className="font-headline text-4xl font-black text-on-surface tracking-tight leading-none">
          Live Dashboard
        </h1>
        <p className="text-on-surface-variant text-sm mt-2 font-body">
          Real-time gesture recognition — Kinetic Ether engine
        </p>
      </div>

      {/*
       * Asymmetric two-column grid:
       *   lg  → 1fr / 400px
       *   md  → equal two columns
       *   sm  → single column
       */}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-[1fr_400px]">
        {/* ─── Left column ────────────────────────────────────── */}
        <section className="space-y-6 min-w-0">
          {/* Camera feed */}
          <CameraFeed
            handDetected={handDetected}
            debugMode={debugMode}
            fps={fps}
          />

          {/* Sensitivity + sensor controls */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {/* Gesture Sensitivity */}
            <div
              className="bg-surface-variant/40 backdrop-blur-xl p-6 rounded-2xl
                         border border-outline-variant/10"
            >
              <h3 className="font-headline text-base mb-5 text-on-surface-variant flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-lg">
                  tune
                </span>
                Sensitivity
              </h3>
              <div className="space-y-5">
                <SensitivitySlider label="Motion Threshold" defaultValue={85} />
                <SensitivitySlider
                  label="Speed Sensitivity"
                  defaultValue={72}
                />
                <SensitivitySlider label="Smoothing" defaultValue={45} />
              </div>
            </div>

            {/* Active Sensors */}
            <div
              className="bg-surface-variant/40 backdrop-blur-xl p-6 rounded-2xl
                         border border-outline-variant/10"
            >
              <h3 className="font-headline text-base mb-5 text-on-surface-variant flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-lg">
                  sensors
                </span>
                Active Sensors
              </h3>
              <div className="space-y-4">
                <PillToggle label="Swipe Detection" defaultOn={true} />
                <PillToggle label="Pinch to Zoom" defaultOn={true} />
                <PillToggle label="Hold & Drag" defaultOn={false} />
                <PillToggle label="Debug Overlay" defaultOn={debugMode} />
              </div>
            </div>
          </div>
        </section>

        {/* ─── Right column: Gesture Intelligence ─────────────── */}
        <section className="min-w-0">
          <GestureIntelligencePanel
            currentGesture={currentGesture}
            gestureHistory={gestureHistory}
            actionKey={actionKey}
          />
        </section>
      </div>
    </div>
  );
};

export default DashboardPage;
