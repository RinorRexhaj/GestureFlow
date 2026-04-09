// ─── MediaPipe Hand Landmark Utilities ────────────────────────────────────────
// Landmark layout follows the MediaPipe Hands 21-point model:
//   https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker
//
// All x / y values are normalized to [0, 1] relative to the image frame.
// z represents depth relative to the wrist (negative = closer to camera).

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface NormalizedLandmark {
  x: number;
  y: number;
  z: number;
}

export type Landmarks = NormalizedLandmark[];

export type Handedness = "Left" | "Right";

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point2D {
  x: number;
  y: number;
}

// ─── Landmark Index Map ────────────────────────────────────────────────────────

export const LM = {
  WRIST: 0,
  THUMB_CMC: 1,
  THUMB_MCP: 2,
  THUMB_IP: 3,
  THUMB_TIP: 4,
  INDEX_MCP: 5,
  INDEX_PIP: 6,
  INDEX_DIP: 7,
  INDEX_TIP: 8,
  MIDDLE_MCP: 9,
  MIDDLE_PIP: 10,
  MIDDLE_DIP: 11,
  MIDDLE_TIP: 12,
  RING_MCP: 13,
  RING_PIP: 14,
  RING_DIP: 15,
  RING_TIP: 16,
  PINKY_MCP: 17,
  PINKY_PIP: 18,
  PINKY_DIP: 19,
  PINKY_TIP: 20,
} as const;

export type FingerName = "thumb" | "index" | "middle" | "ring" | "pinky";

/** MCP, PIP, DIP, TIP indices for each finger. */
const FINGER_INDICES: Record<FingerName, [number, number, number, number]> = {
  thumb: [LM.THUMB_CMC, LM.THUMB_MCP, LM.THUMB_IP, LM.THUMB_TIP],
  index: [LM.INDEX_MCP, LM.INDEX_PIP, LM.INDEX_DIP, LM.INDEX_TIP],
  middle: [LM.MIDDLE_MCP, LM.MIDDLE_PIP, LM.MIDDLE_DIP, LM.MIDDLE_TIP],
  ring: [LM.RING_MCP, LM.RING_PIP, LM.RING_DIP, LM.RING_TIP],
  pinky: [LM.PINKY_MCP, LM.PINKY_PIP, LM.PINKY_DIP, LM.PINKY_TIP],
};

// ─── Coordinate Helpers ────────────────────────────────────────────────────────

/**
 * Returns the landmark at the given index.
 * Throws if the index is out of range.
 */
export function getLandmark(
  landmarks: Landmarks,
  index: number,
): NormalizedLandmark {
  const lm = landmarks[index];
  if (!lm)
    throw new RangeError(
      `Landmark index ${index} out of range (got ${landmarks.length} landmarks).`,
    );
  return lm;
}

/**
 * Converts a normalized landmark (x/y in [0,1]) to canvas pixel coordinates.
 * Pass `mirrorX = true` when the video feed is mirrored (default for selfie cams).
 */
export function toCanvasPoint(
  lm: NormalizedLandmark,
  canvasWidth: number,
  canvasHeight: number,
  mirrorX = false,
): Point2D {
  return {
    x: (mirrorX ? 1 - lm.x : lm.x) * canvasWidth,
    y: lm.y * canvasHeight,
  };
}

/**
 * Converts all landmarks to canvas pixel coordinates.
 */
export function toCanvasPoints(
  landmarks: Landmarks,
  canvasWidth: number,
  canvasHeight: number,
  mirrorX = false,
): Point2D[] {
  return landmarks.map((lm) =>
    toCanvasPoint(lm, canvasWidth, canvasHeight, mirrorX),
  );
}

// ─── Geometry ──────────────────────────────────────────────────────────────────

/** Euclidean distance between two normalized landmarks (2D, ignores z). */
export function distance2D(
  a: NormalizedLandmark,
  b: NormalizedLandmark,
): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Euclidean distance including the z axis. */
export function distance3D(
  a: NormalizedLandmark,
  b: NormalizedLandmark,
): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

/**
 * Angle (radians) at vertex `b` in the triangle a–b–c.
 * Useful for measuring joint bend angles.
 */
export function angleBetween(
  a: NormalizedLandmark,
  b: NormalizedLandmark,
  c: NormalizedLandmark,
): number {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const magAB = Math.hypot(ab.x, ab.y);
  const magCB = Math.hypot(cb.x, cb.y);
  if (magAB === 0 || magCB === 0) return 0;
  return Math.acos(Math.min(1, Math.max(-1, dot / (magAB * magCB))));
}

// ─── Hand Geometry ─────────────────────────────────────────────────────────────

/**
 * Axis-aligned bounding box (normalized) that contains all 21 landmarks.
 */
export function getBoundingBox(landmarks: Landmarks): BoundingBox {
  const xs = landmarks.map((l) => l.x);
  const ys = landmarks.map((l) => l.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return {
    x,
    y,
    width: Math.max(...xs) - x,
    height: Math.max(...ys) - y,
  };
}

/**
 * Centroid of the palm using the five MCP joints and the wrist.
 */
export function getPalmCenter(landmarks: Landmarks): NormalizedLandmark {
  const indices = [
    LM.WRIST,
    LM.INDEX_MCP,
    LM.MIDDLE_MCP,
    LM.RING_MCP,
    LM.PINKY_MCP,
  ];
  const n = indices.length;
  const sum = indices.reduce(
    (acc, i) => {
      const lm = getLandmark(landmarks, i);
      acc.x += lm.x;
      acc.y += lm.y;
      acc.z += lm.z;
      return acc;
    },
    { x: 0, y: 0, z: 0 },
  );
  return { x: sum.x / n, y: sum.y / n, z: sum.z / n };
}

/**
 * Returns the tip landmark for the requested finger.
 */
export function getFingerTip(
  landmarks: Landmarks,
  finger: FingerName,
): NormalizedLandmark {
  const [, , , tipIdx] = FINGER_INDICES[finger];
  return getLandmark(landmarks, tipIdx);
}

/**
 * Returns all four joint landmarks for a finger in [mcp, pip, dip, tip] order.
 */
export function getFingerJoints(
  landmarks: Landmarks,
  finger: FingerName,
): [
  NormalizedLandmark,
  NormalizedLandmark,
  NormalizedLandmark,
  NormalizedLandmark,
] {
  const [a, b, c, d] = FINGER_INDICES[finger].map((i) =>
    getLandmark(landmarks, i),
  );
  return [a, b, c, d];
}

// ─── Finger State ──────────────────────────────────────────────────────────────

/**
 * Returns `true` when the finger tip is above (lower y value than) its MCP joint,
 * using a configurable threshold to avoid jitter.
 *
 * Note: y increases downward in normalized image coordinates.
 */
export function isFingerExtended(
  landmarks: Landmarks,
  finger: FingerName,
  threshold = 0.04,
): boolean {
  const [mcpIdx, , , tipIdx] = FINGER_INDICES[finger];
  const mcp = getLandmark(landmarks, mcpIdx);
  const tip = getLandmark(landmarks, tipIdx);
  // For the thumb, compare x axis (horizontal extension) instead of y
  if (finger === "thumb") {
    return Math.abs(tip.x - mcp.x) > threshold;
  }
  return mcp.y - tip.y > threshold;
}

/**
 * Returns an object describing which fingers are currently extended.
 */
export function getExtendedFingers(
  landmarks: Landmarks,
  threshold = 0.04,
): Record<FingerName, boolean> {
  const fingers: FingerName[] = ["thumb", "index", "middle", "ring", "pinky"];
  return Object.fromEntries(
    fingers.map((f) => [f, isFingerExtended(landmarks, f, threshold)]),
  ) as Record<FingerName, boolean>;
}

/**
 * Counts how many fingers (thumb included) are extended.
 */
export function countExtendedFingers(
  landmarks: Landmarks,
  threshold = 0.04,
): number {
  return Object.values(getExtendedFingers(landmarks, threshold)).filter(Boolean)
    .length;
}

// ─── Pinch & Gesture Metrics ───────────────────────────────────────────────────

/**
 * Normalized distance between the thumb tip and index tip.
 * Values below ~0.05 indicate a pinch.
 */
export function pinchDistance(landmarks: Landmarks): number {
  return distance2D(
    getLandmark(landmarks, LM.THUMB_TIP),
    getLandmark(landmarks, LM.INDEX_TIP),
  );
}

/**
 * Returns `true` when the thumb and index finger are pinching.
 */
export function isPinching(landmarks: Landmarks, threshold = 0.05): boolean {
  return pinchDistance(landmarks) < threshold;
}

/**
 * Midpoint between the thumb tip and index tip — useful as a drag / cursor point.
 */
export function pinchMidpoint(landmarks: Landmarks): NormalizedLandmark {
  const thumb = getLandmark(landmarks, LM.THUMB_TIP);
  const index = getLandmark(landmarks, LM.INDEX_TIP);
  return {
    x: (thumb.x + index.x) / 2,
    y: (thumb.y + index.y) / 2,
    z: (thumb.z + index.z) / 2,
  };
}

/**
 * Estimates the approximate hand scale as the distance from the wrist to the
 * middle finger MCP. Useful for normalizing other distances dynamically.
 */
export function handScale(landmarks: Landmarks): number {
  return distance2D(
    getLandmark(landmarks, LM.WRIST),
    getLandmark(landmarks, LM.MIDDLE_MCP),
  );
}

export async function initHandLandmarker(
  cancelled: boolean,
  handLandmarkerRef: React.MutableRefObject<any>,
) {
  try {
    const { FilesetResolver, HandLandmarker } =
      await import("@mediapipe/tasks-vision");
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm",
    );
    const landmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numHands: 2,
    });
    if (!cancelled) {
      handLandmarkerRef.current = landmarker;
    }
  } catch (err) {
    console.error("HandLandmarker init failed:", err);
  }
}
