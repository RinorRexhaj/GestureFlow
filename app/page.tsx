"use client";

import { useState, useEffect, useRef } from "react";
import CameraFeed from "@/components/CameraFeed";
import GestureIntelligencePanel, {
  type GestureEntry,
} from "@/components/GestureIntelligencePanel";

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
  checked,
  onChange,
}: {
  label: string;
  defaultOn?: boolean;
  checked?: boolean;
  onChange?: (value: boolean) => void;
}) => {
  const [internal, setInternal] = useState(defaultOn);
  const on = checked !== undefined ? checked : internal;
  const toggle = () => {
    const next = !on;
    setInternal(next);
    onChange?.(next);
  };
  return (
    <label className="flex items-center justify-between group cursor-pointer">
      <span className="text-on-surface-variant group-hover:text-primary transition-colors duration-200 text-sm">
        {label}
      </span>
      <button
        role="switch"
        aria-checked={on}
        onClick={toggle}
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
  const [debugMode, setDebugMode] = useState(false);
  const [currentGesture, setCurrentGesture] = useState<GestureEntry | null>(
    null,
  );
  const [gestureHistory, setGestureHistory] = useState<GestureEntry[]>([]);
  const [actionKey, setActionKey] = useState(0);

  const gestureIndexRef = useRef(0);

  return (
    <div className="relative">
      {/* Page heading */}
      {/* <div className="mb-8">
        <h1 className="font-headline text-4xl font-black text-on-surface tracking-tight leading-none">
          Live Dashboard
        </h1>
        <p className="text-on-surface-variant text-sm mt-2 font-body">
          Real-time gesture recognition — Kinetic Ether engine
        </p>
      </div> */}

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
          <CameraFeed debugMode={debugMode} />

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
                <PillToggle
                  label="Debug Overlay"
                  checked={debugMode}
                  onChange={setDebugMode}
                />
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
