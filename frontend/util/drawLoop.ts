import { detectGesture } from "./detectGesture";
import { NormalizedLandmark } from "./MediaPipe";
import { GestureEntry } from "@/components/GestureIntelligencePanel";
import { executeGestureAction, GESTURE_ACTION_COOLDOWN_MS } from "./actions";

// Standard MediaPipe Hands 21-point skeleton connections
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

export const drawLoop = (
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  containerRef: React.RefObject<HTMLDivElement | null>,
  videoRef: React.RefObject<HTMLVideoElement | null>,
  handLandmarkerRef: React.RefObject<any>,
  landmarksRef: React.RefObject<NormalizedLandmark[][]>,
  lastVideoTimeRef: React.RefObject<number>,
  prevHandDetectedRef: React.RefObject<boolean>,
  setHandDetected: (detected: boolean) => void,
  setCurrentGesture: (gesture: GestureEntry | null) => void,
  debugMode: boolean,
  addGestureToHistory: (gesture: GestureEntry) => void,
  setActionKey: (key: number) => void,
  actionKeyRef: React.RefObject<number>,
  lastActionGestureRef: React.RefObject<string>,
  lastActionTimeRef: React.RefObject<number>,
) => {
  const canvas = canvasRef.current;
  const container = containerRef.current;
  const video = videoRef.current;
  if (!canvas || !container || !video) return;

  const w = container.clientWidth;
  const h = container.clientHeight;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);

  // Run detection when a new video frame is available
  if (
    handLandmarkerRef.current &&
    video.readyState >= 2 &&
    video.currentTime !== lastVideoTimeRef.current
  ) {
    lastVideoTimeRef.current = video.currentTime;
    const result = handLandmarkerRef.current.detectForVideo(
      video,
      performance.now(),
    );
    landmarksRef.current = result.landmarks as NormalizedLandmark[][];
    const detected = result.landmarks.length > 0;
    prevHandDetectedRef.current = detected;
    setHandDetected(detected);
    const gesture = detectGesture(result.landmarks);
    setCurrentGesture(gesture);

    // Execute browser action with debounce
    if (gesture) {
      const now = performance.now();
      const isNewGesture = gesture.name !== lastActionGestureRef.current;
      const cooldownElapsed =
        now - lastActionTimeRef.current > GESTURE_ACTION_COOLDOWN_MS;

      if (isNewGesture || cooldownElapsed) {
        const fired = executeGestureAction(gesture.name);
        if (fired) {
          lastActionGestureRef.current = gesture.name;
          lastActionTimeRef.current = now;
          addGestureToHistory(gesture);
          setActionKey((actionKeyRef.current ?? 0) + 1);
        }
      }
    } else {
      // Reset tracked gesture when hand is no longer showing a known gesture
      lastActionGestureRef.current = "";
    }
  }

  drawLandmarks(landmarksRef, ctx, w, h, debugMode);
};

const drawLandmarks = (
  landmarksRef: React.RefObject<NormalizedLandmark[][]>,
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  debugMode: boolean,
) => {
  const allLandmarks = landmarksRef.current;
  if (allLandmarks.length === 0 || !debugMode) return;

  allLandmarks.forEach((lm) => {
    // Mirror X so the overlay matches the CSS-mirrored video element
    const pts = lm.map((p) => ({ x: (1 - p.x) * w, y: p.y * h }));

    // Connections
    ctx.strokeStyle = "rgba(137, 206, 255, 0.45)";
    ctx.lineWidth = 1.5;
    CONNECTIONS.forEach(([a, b]) => {
      ctx.beginPath();
      ctx.moveTo(pts[a].x, pts[a].y);
      ctx.lineTo(pts[b].x, pts[b].y);
      ctx.stroke();
    });

    // Landmark dots
    pts.forEach((pt, i) => {
      const r = i === 0 ? 5 : 3.5;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
      ctx.fillStyle =
        i === 0 ? "rgba(137, 206, 255, 0.95)" : "rgba(137, 206, 255, 0.75)";
      ctx.fill();
    });

    // Bounding box
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
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

    // ─── Debug overlay: wrist depth + landmark indices ─────────
    if (debugMode) {
      const wrist = lm[0];
      ctx.fillStyle = "rgba(255, 185, 95, 0.85)";
      ctx.font = "11px Inter, sans-serif";
      ctx.fillText(
        `z: ${wrist.z.toFixed(3)}  x: ${wrist.x.toFixed(2)}  y: ${wrist.y.toFixed(2)}`,
        bx + 6,
        by - 8,
      );
      pts.forEach((pt, i) => {
        ctx.fillStyle = "rgba(255, 185, 95, 0.7)";
        ctx.font = "9px Inter, sans-serif";
        ctx.fillText(String(i), pt.x + 5, pt.y - 4);
      });
    }
  });
};
