import type { NormalizedLandmark } from "@/util/MediaPipe";
import { isFingerExtended, LM } from "@/util/MediaPipe";
import { GestureEntry } from "@/components/GestureIntelligencePanel";

export const detectGesture = (
  landmarks: NormalizedLandmark[][],
): GestureEntry | null => {
  if (landmarks.length === 0) return null;
  const hand = landmarks[0]; // Only consider the first detected hand

  // Example gesture: "Thumbs Up" = thumb extended, other fingers curled
  const thumbExtended = isFingerExtended(hand, "thumb");

  const indexExtended = isFingerExtended(hand, "index");

  const middleExtended = isFingerExtended(hand, "middle");

  const ringExtended = isFingerExtended(hand, "ring");

  const pinkyExtended = isFingerExtended(hand, "pinky");

  let gestureName = "";

  if (
    thumbExtended &&
    !indexExtended &&
    !middleExtended &&
    !ringExtended &&
    !pinkyExtended
  ) {
    gestureName = "Thumbs Up";
  }

  // Example gesture: "OK Sign" = thumb and index touching, other fingers extended
  const thumbTip = hand[LM.THUMB_TIP];
  const indexTip = hand[LM.INDEX_TIP];
  const thumbIndexDistance = Math.sqrt(
    (thumbTip.x - indexTip.x) ** 2 + (thumbTip.y - indexTip.y) ** 2,
  );
  if (
    thumbIndexDistance < 0.05 && // Threshold for thumb-index touch
    !middleExtended &&
    !ringExtended &&
    !pinkyExtended
  ) {
    gestureName = "OK Sign";
  }

  return gestureEntryFromName(gestureName);
};

const gestureEntryFromName = (gestureName: string): GestureEntry | null => {
  console.log(gestureName);
  if (!gestureName) {
    return null;
  }

  const gestureNameIconMap: Record<string, { icon: string; action: string }> = {
    "Thumbs Up": { icon: "thumb_up", action: "Like / Approve" },
    "OK Sign": { icon: "check", action: "OK / Perfect" },
  };

  return {
    id: gestureName.toLowerCase().replace(/\s/g, "_") + "_" + Date.now(), // e.g. "Thumbs Up" -> "thumbs_up_1234567890"
    name: gestureName,
    icon: gestureNameIconMap[gestureName].icon,
    action: gestureNameIconMap[gestureName].action,
    confidence: 1, // Placeholder confidence value
    timestamp: new Date(),
  };
};
