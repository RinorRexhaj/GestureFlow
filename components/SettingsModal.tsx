"use client";

import { useState, useEffect, useRef } from "react";

type Section = "camera" | "appearance" | "advanced";

interface SettingsModalProps {
  onClose: () => void;
}

const PillToggle = ({
  label,
  description,
  defaultOn = false,
}: {
  label: string;
  description?: string;
  defaultOn?: boolean;
}) => {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-on-surface font-body text-sm">{label}</p>
        {description && (
          <p className="text-on-surface-variant text-xs mt-0.5">
            {description}
          </p>
        )}
      </div>
      <button
        role="switch"
        aria-checked={on}
        onClick={() => setOn(!on)}
        className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-all duration-300
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40
                    ${on ? "bg-secondary-container" : "bg-surface-container-highest"}`}
      >
        <span
          className={`absolute top-1 w-4 h-4 rounded-full transition-all duration-300
                      ${on ? "right-1 bg-on-surface" : "left-1 bg-on-surface-variant"}`}
        />
      </button>
    </div>
  );
};

const SliderRow = ({
  label,
  defaultValue,
  min,
  max,
}: {
  label: string;
  defaultValue: number;
  min: number;
  max: number;
}) => {
  const [val, setVal] = useState(defaultValue);
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <label className="text-xs font-headline uppercase tracking-widest text-on-surface-variant">
          {label}
        </label>
        <span className="text-xs font-headline text-primary tabular-nums w-8 text-right">
          {val}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={val}
        onChange={(e) => setVal(Number(e.target.value))}
        className="w-full"
        style={{ accentColor: "#89ceff" }}
      />
    </div>
  );
};

const SettingsModal = ({ onClose }: SettingsModalProps) => {
  const [section, setSection] = useState<Section>("camera");
  const backdropRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const SECTIONS: Section[] = ["camera", "appearance", "advanced"];

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/60 backdrop-blur-xl px-4"
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
    >
      <div
        className="w-full max-w-lg bg-surface-container rounded-3xl p-8
                   shadow-[0_0_60px_rgba(137,206,255,0.08)]"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="font-headline text-2xl font-bold text-on-surface">
              Settings
            </h2>
            <p className="text-xs font-headline text-on-surface-variant mt-0.5">
              GestureFlow v2.4.0
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="p-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/30
                       transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Section tabs */}
        <div className="flex gap-1 mb-8 bg-surface-container-lowest rounded-xl p-1">
          {SECTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setSection(s)}
              className={`flex-1 py-2 px-3 rounded-xl text-sm font-headline capitalize transition-all duration-300
                          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40
                          ${
                            section === s
                              ? "bg-gradient-to-r from-primary to-primary-container text-on-primary font-bold"
                              : "text-on-surface-variant hover:text-on-surface"
                          }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Camera */}
        {section === "camera" && (
          <div className="space-y-6">
            {[
              {
                label: "Input Source",
                options: [
                  "Integrated FaceTime HD Camera",
                  "OBS Virtual Camera",
                  "External 4K Sensor",
                ],
              },
              {
                label: "Resolution",
                options: [
                  "1920×1080 (Full HD)",
                  "1280×720 (HD)",
                  "640×480 (SD)",
                ],
              },
              { label: "Frame Rate", options: ["60 fps", "30 fps", "120 fps"] },
            ].map(({ label, options }) => (
              <div key={label} className="space-y-2">
                <label className="text-xs font-headline uppercase tracking-widest text-on-surface-variant block">
                  {label}
                </label>
                <div className="relative">
                  <select
                    className="w-full bg-surface-container-lowest text-on-surface rounded-xl p-4 font-body
                               appearance-none focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    {options.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant">
                    expand_more
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Appearance */}
        {section === "appearance" && (
          <div className="space-y-5">
            <PillToggle
              label="Show Landmarks"
              description="Draw hand skeleton on camera feed"
              defaultOn={true}
            />
            <PillToggle
              label="Debug Mode"
              description="Overlay velocity vectors and debug info"
              defaultOn={false}
            />
            <PillToggle
              label="Performance Mode"
              description="Reduce visual effects for lower-end devices"
              defaultOn={false}
            />
            <PillToggle
              label="AR Pulse Rings"
              description="Slow ambient glow on interactive zones"
              defaultOn={true}
            />
          </div>
        )}

        {/* Advanced */}
        {section === "advanced" && (
          <div className="space-y-6">
            {[
              { label: "Confidence Threshold", value: 85, min: 50, max: 100 },
              { label: "Buffer Frame Size", value: 12, min: 4, max: 32 },
              { label: "Latency Compensation", value: 30, min: 0, max: 100 },
            ].map(({ label, value, min, max }) => (
              <SliderRow
                key={label}
                label={label}
                defaultValue={value}
                min={min}
                max={max}
              />
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 mt-10">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl font-headline font-medium
                       bg-surface-variant/40 backdrop-blur-xl text-on-surface
                       border border-outline-variant/15
                       hover:bg-surface-variant/60 transition-all duration-300
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            Cancel
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl font-headline font-bold
                       bg-gradient-to-br from-primary to-primary-container text-on-primary
                       hover:shadow-[0_0_20px_rgba(137,206,255,0.3)] transition-all duration-300
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
