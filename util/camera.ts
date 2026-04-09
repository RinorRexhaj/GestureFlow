export async function startCamera(
  active: boolean,
  videoRef: React.RefObject<HTMLVideoElement | null>,
  streamRef: React.MutableRefObject<MediaStream | null>,
  setCameraError: (msg: string | null) => void,
  setCameraFps: (fps: number | null) => void,
  setCameraReady?: (ready: boolean) => void,
) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });
    console.log("Camera stream started:", stream);
    if (!active) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
    const trackFps = stream.getVideoTracks()[0]?.getSettings().frameRate;
    setCameraFps(trackFps ?? null);
    setCameraError(null);
    setCameraReady?.(true);
  } catch (err) {
    if (!active) return;
    const msg = err instanceof Error ? err.message : "Camera unavailable";
    setCameraError(msg);
  }
}
