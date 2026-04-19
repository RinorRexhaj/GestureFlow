"use client";

import { useState } from "react";

// ─── Types ──────────────────────────────────────────────────────
interface TutorialCard {
  id: string;
  gesture: string;
  icon: string;
  description: string;
  steps: string[];
  tip: string;
}

// ─── Static data ────────────────────────────────────────────────
const TUTORIALS: TutorialCard[] = [
  {
    id: "swipe-right",
    gesture: "Swipe Right",
    icon: "swipe_right",
    description: "Navigate forward in your browser or scroll right.",
    steps: [
      "Face your open palm toward the camera.",
      "Hold your hand still for 0.5 s to initialize tracking.",
      "Move your hand smoothly to the right.",
      'Complete the arc — GestureFlow fires "Navigate Forward".',
    ],
    tip: "Keep your wrist loose for a cleaner trajectory.",
  },
  {
    id: "swipe-left",
    gesture: "Swipe Left",
    icon: "swipe_left",
    description: "Navigate back or scroll left.",
    steps: [
      "Open palm facing camera, fingers pointing right.",
      'Wait for the "Hand Detected" indicator to turn green.',
      "Smoothly sweep your hand to the left.",
      'GestureFlow fires "Navigate Back".',
    ],
    tip: "The motion arc should be at least 15 cm.",
  },
  {
    id: "swipe-up",
    gesture: "Swipe Up",
    icon: "swipe_up",
    description: "Scroll up or move selection upwards.",
    steps: [
      "Position open palm at chest height facing camera.",
      "Extend all fingers upward.",
      "Sweep your hand upward at a steady pace.",
      "Action triggers when the velocity exceeds the threshold.",
    ],
    tip: "Higher speed = more scroll distance (configurable).",
  },
  {
    id: "swipe-down",
    gesture: "Swipe Down",
    icon: "swipe_down",
    description: "Scroll down or move selection downwards.",
    steps: [
      "Open palm at eye level facing camera.",
      "Fingers extended, pointing upward.",
      "Sweep your hand downward.",
      'GestureFlow fires "Scroll Down".',
    ],
    tip: "Pair with Speed Sensitivity for fine-grained scrolling.",
  },
  {
    id: "pinch",
    gesture: "Pinch",
    icon: "pinch",
    description: "Zoom in or zoom out using a pinch gesture.",
    steps: [
      "Hold thumb and index finger apart, ~5 cm, facing camera.",
      "Hold pose for 0.3 s to enter Pinch Mode.",
      "Bring thumb and index together to zoom in.",
      "Spread apart to zoom out.",
    ],
    tip: "Combine with both hands for precise two-hand pinch.",
  },
  {
    id: "hold",
    gesture: "Hold",
    icon: "back_hand",
    description: "Pause the gesture engine by holding your hand still.",
    steps: [
      "Show open palm directly in front of camera.",
      "Keep all 5 fingers spread.",
      "Hold perfectly still for 1 full second.",
      "System pauses — repeat to resume.",
    ],
    tip: "Useful when you need a break without moving away.",
  },
];

const GESTURE_CHIPS = [
  "Swipe Left",
  "Swipe Right",
  "Swipe Up",
  "Swipe Down",
  "Pinch",
  "Hold",
];

// ─── Sub-components ─────────────────────────────────────────────
const SectionLabel = ({ children }: { children: React.ReactNode }) => {
  return (
    <p className="font-headline text-xs text-on-surface-variant uppercase tracking-widest">
      {children}
    </p>
  );
};

const PillToggle = ({
  label,
  defaultOn = false,
}: {
  label: string;
  defaultOn?: boolean;
}) => {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="flex items-center justify-between">
      <span className="text-on-surface text-sm font-body">{label}</span>
      <button
        role="switch"
        aria-checked={on}
        onClick={() => setOn(!on)}
        className={`relative w-11 h-6 rounded-full transition-all duration-300
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

const CollapsibleTutorial = ({ card }: { card: TutorialCard }) => {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={`bg-surface-container-low rounded-2xl overflow-hidden transition-all duration-300
                  hover:bg-surface-container hover:scale-[1.01]`}
    >
      {/* Header — always visible */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-4 p-5 text-left
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-2xl"
      >
        <div className="w-10 h-10 rounded-xl bg-surface-container-highest flex items-center justify-center flex-shrink-0">
          <span
            className="material-symbols-outlined text-primary text-2xl"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            {card.icon}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-headline font-bold text-on-surface">
            {card.gesture}
          </p>
          <p className="text-xs text-on-surface-variant truncate">
            {card.description}
          </p>
        </div>
        <span
          className={`material-symbols-outlined text-on-surface-variant transition-transform duration-300 flex-shrink-0
                      ${open ? "rotate-180" : ""}`}
        >
          expand_more
        </span>
      </button>

      {/* Expandable content */}
      {open && (
        <div className="px-5 pb-6 space-y-4">
          {/* Animation preview area */}
          <div className="aspect-video bg-surface-container-lowest rounded-2xl flex items-center justify-center relative overflow-hidden">
            {/* Background grid */}
            <div
              className="absolute inset-0 opacity-[0.04]"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(137,206,255,1) 1px, transparent 1px)," +
                  "linear-gradient(90deg, rgba(137,206,255,1) 1px, transparent 1px)",
                backgroundSize: "32px 32px",
              }}
            />
            <div className="relative flex flex-col items-center gap-3">
              <div className="w-20 h-20 border-2 border-primary/30 border-dashed rounded-full flex items-center justify-center animate-pulse">
                <span
                  className="material-symbols-outlined text-primary text-4xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  {card.icon}
                </span>
              </div>
              <span className="text-xs font-headline text-primary uppercase tracking-widest">
                Gesture Preview
              </span>
            </div>
          </div>

          {/* Step-by-step */}
          <ol className="space-y-3">
            {card.steps.map((step, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span
                  className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 border border-primary/20
                                 flex items-center justify-center text-primary text-[10px] font-headline font-bold mt-0.5"
                >
                  {i + 1}
                </span>
                <span className="text-on-surface-variant leading-relaxed">
                  {step}
                </span>
              </li>
            ))}
          </ol>

          {/* Tip callout */}
          <div className="bg-surface-variant/40 backdrop-blur-xl px-4 py-3 rounded-xl border border-outline-variant/15 flex items-start gap-3">
            <span className="material-symbols-outlined text-tertiary text-base flex-shrink-0 mt-0.5">
              lightbulb
            </span>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              {card.tip}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Page ───────────────────────────────────────────────────────
const SettingsPage = () => {
  const [activeGestures, setActiveGestures] = useState<string[]>([
    "Swipe Left",
    "Swipe Right",
    "Pinch",
  ]);

  const toggleGesture = (g: string) =>
    setActiveGestures((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g],
    );

  return (
    <div className="relative">
      {/* Page heading */}
      <div className="mb-8">
        <h1 className="font-headline text-4xl font-black text-on-surface tracking-tight leading-none">
          Settings & Tutorials
        </h1>
        <p className="text-on-surface-variant text-sm mt-2 font-body">
          Configure sensors, calibrate sensitivity, and master every gesture.
        </p>
      </div>

      {/*
       * Two-column grid:
       *   default → 300px settings / 1fr tutorials
       *   sm      → single column
       */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[300px_1fr]">
        {/* ─── Left: Settings Panel ─────────────────────────── */}
        <aside className="space-y-8 min-w-0">
          <div className="bg-surface-container rounded-2xl p-6 space-y-8">
            {/* Camera source */}
            <div className="space-y-3">
              <SectionLabel>Camera</SectionLabel>
              <div className="relative">
                <select
                  className="w-full bg-surface-container-lowest text-on-surface rounded-xl p-3.5 pr-10
                             font-body text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/40"
                >
                  <option>Integrated FaceTime HD Camera</option>
                  <option>OBS Virtual Camera</option>
                  <option>External 4K Neural Sensor</option>
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant">
                  expand_more
                </span>
              </div>
            </div>

            {/* Toggles */}
            <div className="space-y-4">
              <SectionLabel>Display</SectionLabel>
              <PillToggle label="Show Landmarks" defaultOn={true} />
              <PillToggle label="Debug Mode" defaultOn={false} />
              <PillToggle label="Performance Mode" defaultOn={false} />
              <PillToggle label="Dark Theme" defaultOn={true} />
            </div>

            {/* Gesture Sensitivity sliders */}
            <div className="space-y-4">
              <SectionLabel>Gesture Sensitivity</SectionLabel>
              <SliderRow label="Motion Threshold" defaultValue={85} />
              <SliderRow label="Speed Sensitivity" defaultValue={72} />
              <SliderRow label="Smoothing" defaultValue={45} />
            </div>
          </div>

          {/* Gesture enable/disable chips */}
          <div className="bg-surface-container rounded-2xl p-6 space-y-4">
            <SectionLabel>Active Gestures</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {GESTURE_CHIPS.map((g) => {
                const active = activeGestures.includes(g);
                return (
                  <button
                    key={g}
                    onClick={() => toggleGesture(g)}
                    className={`px-4 py-1.5 rounded-full text-sm font-label font-medium transition-all duration-200
                                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40
                                ${
                                  active
                                    ? "bg-secondary-container text-on-secondary-container"
                                    : "bg-surface-container-highest text-on-surface-variant hover:bg-surface-container-high"
                                }`}
                  >
                    {g}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* ─── Right: Tutorials Panel ───────────────────────── */}
        <section className="min-w-0">
          <div className="bg-surface-container-low rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h2 className="font-headline text-xl font-bold text-on-surface">
                  Tutorial Canvas
                </h2>
                <p className="text-xs text-on-surface-variant mt-1">
                  Expand any gesture to learn the motion and calibrate your
                  workspace.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-secondary/10 text-secondary px-3 py-1 rounded-full text-[10px] font-bold border border-secondary/20 uppercase tracking-widest">
                  Sensor: Active
                </span>
              </div>
            </div>

            {/* Tutorial cards */}
            <div className="space-y-3 mt-2">
              {TUTORIALS.map((card) => (
                <CollapsibleTutorial key={card.id} card={card} />
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default SettingsPage;
