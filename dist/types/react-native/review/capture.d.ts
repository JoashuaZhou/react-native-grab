import { type ReviewScreenshot } from "./host";
/**
 * Hides grab UI by marking the controller as capturing, waits two frames plus
 * a settle delay so the toolbar and highlight leave the rendered output, then
 * captures through the host. Returns null when the host has no capture
 * function or the capture fails; the capturing flag is always restored.
 */
export declare const captureForReview: () => Promise<ReviewScreenshot | null>;
//# sourceMappingURL=capture.d.ts.map