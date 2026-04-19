/** How long (ms) to wait before the same gesture can fire again. */
export const GESTURE_ACTION_COOLDOWN_MS = 1500;

type BrowserAction = () => void;

const GESTURE_ACTION_MAP: Record<string, BrowserAction> = {
  Pinch: () => window.alert("Pinch Action Executed"),
};

/**
 * Executes the browser action mapped to `gestureName`.
 * Returns `true` if an action was found and fired.
 */
export const executeGestureAction = (gestureName: string): boolean => {
  const action = GESTURE_ACTION_MAP[gestureName];
  if (!action) return false;
  action();
  return true;
};
