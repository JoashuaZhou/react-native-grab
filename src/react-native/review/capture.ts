import { setGrabCapturing } from "../grab-controller";
import { getReviewHost, type ReviewScreenshot } from "./host";

const CAPTURE_FRAME_COUNT = 2;
const CAPTURE_SETTLE_DELAY_MS = 50;

const waitForSettle = (): Promise<void> =>
  new Promise((resolve) => {
    const waitForFrame = (remaining: number): void => {
      if (remaining === 0) {
        setTimeout(resolve, CAPTURE_SETTLE_DELAY_MS);
        return;
      }
      requestAnimationFrame(() => {
        waitForFrame(remaining - 1);
      });
    };
    waitForFrame(CAPTURE_FRAME_COUNT);
  });

/**
 * Hides grab UI by marking the controller as capturing, waits two frames plus
 * a settle delay so the toolbar and highlight leave the rendered output, then
 * captures through the host. Returns null when the host has no capture
 * function or the capture fails; the capturing flag is always restored.
 */
export const captureForReview = async (): Promise<ReviewScreenshot | null> => {
  const captureScreen = getReviewHost()?.captureScreen;
  if (!captureScreen) {
    return null;
  }

  setGrabCapturing(true);
  try {
    await waitForSettle();
    return await captureScreen();
  } catch {
    return null;
  } finally {
    setGrabCapturing(false);
  }
};
