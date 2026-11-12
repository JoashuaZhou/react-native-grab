"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.captureForReview = void 0;
const grab_controller_1 = require("../grab-controller");
const host_1 = require("./host");
const CAPTURE_FRAME_COUNT = 2;
const CAPTURE_SETTLE_DELAY_MS = 50;
const waitForSettle = () => new Promise((resolve) => {
    const waitForFrame = (remaining) => {
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
const captureForReview = async () => {
    const captureScreen = (0, host_1.getReviewHost)()?.captureScreen;
    if (!captureScreen) {
        return null;
    }
    (0, grab_controller_1.setGrabCapturing)(true);
    try {
        await waitForSettle();
        return await captureScreen();
    }
    catch {
        return null;
    }
    finally {
        (0, grab_controller_1.setGrabCapturing)(false);
    }
};
exports.captureForReview = captureForReview;
//# sourceMappingURL=capture.js.map