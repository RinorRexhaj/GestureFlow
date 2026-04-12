"use client";

import { useState, useEffect } from "react";
import useHandDetectionStore from "@/store/handDetection";

export interface GestureEntry {
  id: string;
  name: string;
  icon: string;
  action: string;
  confidence: number;
  timestamp: Date;
}

const formatTime = (d: Date): string => {
  return d.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

const GestureIntelligencePanel = () => {
  const [flashActive, setFlashActive] = useState(false);

  const { currentGesture, gestureHistory, actionKey } = useHandDetectionStore();

  // Flash the action feed whenever a new action fires
  useEffect(() => {
    if (actionKey === 0) return;
    setFlashActive(true);
    const t = setTimeout(() => setFlashActive(false), 650);
    return () => clearTimeout(t);
  }, [actionKey]);

  return (
    <div className="flex flex-col gap-6">
      {/* ── A. Current Gesture Card ─────────────────────────────── */}
      <div className="bg-surface-container rounded-2xl p-6 relative overflow-hidden">
        {/* Ambient radial glow */}
        <div className="absolute -top-8 -right-8 w-40 h-40 bg-primary/10 blur-[50px] rounded-full pointer-events-none" />

        <span className="text-xs font-headline uppercase tracking-[0.3em] text-primary-fixed-dim block mb-4">
          Detected Gesture
        </span>

        <div className="h-36">
          {currentGesture ? (
            <>
              <div className="flex items-center gap-5 mb-6 relative z-10">
                {/* Icon with radial pulse background */}
                <div className="relative flex-shrink-0">
                  <div className="absolute inset-0 bg-primary/10 rounded-2xl animate-ar-pulse" />
                  <div className="relative w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <span
                      className="material-symbols-outlined text-primary text-4xl"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      {currentGesture.icon}
                    </span>
                  </div>
                </div>

                <div className="min-w-0">
                  <h2 className="font-headline text-3xl font-black text-on-surface leading-tight truncate">
                    {currentGesture.name}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className="material-symbols-outlined text-secondary text-base"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      verified
                    </span>
                    <span className="text-secondary font-medium text-sm tabular-nums">
                      {currentGesture.confidence}% Confidence
                    </span>
                  </div>
                </div>
              </div>

              {/* Triggered action row */}
              <div
                className={`p-4 bg-surface-container-low rounded-xl border border-outline-variant/10
                            flex items-center justify-between gap-4 transition-colors duration-300
                            ${flashActive ? "bg-secondary/10" : ""}`}
              >
                <span className="text-on-surface-variant text-sm">
                  Action Triggered
                </span>
                <span className="px-3 py-1 bg-secondary/10 text-secondary rounded-xl text-xs font-headline font-bold uppercase flex-shrink-0">
                  {currentGesture.action}
                </span>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center py-8 text-on-surface-variant">
              <span className="material-symbols-outlined text-4xl mb-3 opacity-40">
                front_hand
              </span>
              <p className="text-sm font-body">Waiting for gesture input…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GestureIntelligencePanel;
