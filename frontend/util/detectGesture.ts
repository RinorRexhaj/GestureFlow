import type { NormalizedLandmark } from "@/util/MediaPipe";
import { isFingerExtended, LM } from "@/util/MediaPipe";
import { GestureEntry } from "@/components/GestureIntelligencePanel";

export const detectGesture = (
  landmarks: NormalizedLandmark[][],
): GestureEntry | null => {
  if (landmarks.length === 0) return null;
  const hand = landmarks[0]; // Only consider the first detected hand

  // Pinch gesture: thumb tip (4) and index tip (8) are close together
  const thumbTip = hand[4];
  const indexTip = hand[8];
  const distance = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
  const gestureName = distance < 0.05 ? "Pinch" : "";

  return gestureEntryFromName(gestureName);
};

const gestureEntryFromName = (gestureName: string): GestureEntry | null => {
  if (!gestureName) {
    return null;
  }

  const gestureNameIconMap: Record<string, { icon: string; action: string }> = {
    Pinch: { icon: "pinch", action: "Pinch Action" },
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
