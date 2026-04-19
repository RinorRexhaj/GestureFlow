import React from "react";
import PillToggle from "./PillToggle";

interface SensorsProps {
  debugMode: boolean;
  setDebugMode: (value: boolean) => void;
}

const Sensors = ({ debugMode, setDebugMode }: SensorsProps) => {
  return (
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
  );
};

export default Sensors;
