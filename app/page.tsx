"use client";

import { useState, useEffect, useRef } from "react";
import CameraFeed from "@/components/CameraFeed";
import GestureIntelligencePanel, {
  type GestureEntry,
} from "@/components/GestureIntelligencePanel";
import SensitivitySlider from "@/components/SensitivitySlider";
import Sensors from "@/components/Sensors";

// ─── Page ───────────────────────────────────────────────────────
const DashboardPage = () => {
  const [debugMode, setDebugMode] = useState(false);

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
        </section>

        {/* ─── Right column: Gesture Intelligence ─────────────── */}
        <section className="min-w-0 flex flex-col gap-6">
          <GestureIntelligencePanel />
          <Sensors debugMode={debugMode} setDebugMode={setDebugMode} />
        </section>
      </div>
    </div>
  );
};

export default DashboardPage;
