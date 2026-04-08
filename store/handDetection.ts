import { create } from "zustand";

interface HandDetectionState {
  handDetected: boolean;
  setHandDetected: (detected: boolean) => void;
}

const useHandDetectionStore = create<HandDetectionState>((set) => ({
  handDetected: false,
  setHandDetected: (detected) => set({ handDetected: detected }),
}));

export default useHandDetectionStore;
