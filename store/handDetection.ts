import { create } from "zustand";
import { GestureEntry } from "@/components/GestureIntelligencePanel";

interface HandDetectionState {
  handDetected: boolean;
  setHandDetected: (detected: boolean) => void;
  currentGesture: GestureEntry | null;
  setCurrentGesture: (gesture: GestureEntry | null) => void;
  gestureHistory: GestureEntry[];
  addGestureToHistory: (gesture: GestureEntry) => void;
  actionKey: number; // Incremented whenever a new gesture is detected, to trigger UI updates
  setActionKey: (key: number) => void;
  cameraEnabled: boolean;
  toggleCamera: () => void;
}

const useHandDetectionStore = create<HandDetectionState>((set) => ({
  handDetected: false,
  setHandDetected: (detected) => set({ handDetected: detected }),
  currentGesture: null,
  setCurrentGesture: (gesture) => set({ currentGesture: gesture }),
  gestureHistory: [],
  addGestureToHistory: (gesture) =>
    set((state) => ({ gestureHistory: [gesture, ...state.gestureHistory] })),
  actionKey: 0,
  setActionKey: (key) => set({ actionKey: key }),
  cameraEnabled: true,
  toggleCamera: () => set((state) => ({ cameraEnabled: !state.cameraEnabled })),
}));

export default useHandDetectionStore;
