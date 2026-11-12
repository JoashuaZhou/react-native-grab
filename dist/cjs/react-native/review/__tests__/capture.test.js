"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const capture = vitest_1.vi.hoisted(() => ({ calls: [] }));
const frames = vitest_1.vi.hoisted(() => ({ count: 0 }));
vitest_1.vi.mock("../../grab-controller", () => ({
    setGrabCapturing: (value) => {
        capture.calls.push(value);
    },
}));
(0, vitest_1.describe)("captureForReview", () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.resetModules();
        vitest_1.vi.useFakeTimers();
        capture.calls.length = 0;
        frames.count = 0;
        vitest_1.vi.stubGlobal("requestAnimationFrame", (callback) => {
            frames.count += 1;
            callback(0);
            return 0;
        });
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.clearAllTimers();
        vitest_1.vi.useRealTimers();
        vitest_1.vi.unstubAllGlobals();
    });
    (0, vitest_1.it)("returns null without a host", async () => {
        const { captureForReview } = await vitest_1.vi.importActual("../capture");
        await (0, vitest_1.expect)(captureForReview()).resolves.toBeNull();
        (0, vitest_1.expect)(capture.calls).toEqual([]);
    });
    (0, vitest_1.it)("returns null when the host has no capture function", async () => {
        const host = await vitest_1.vi.importActual("../host");
        const { captureForReview } = await vitest_1.vi.importActual("../capture");
        host.configureReview({});
        await (0, vitest_1.expect)(captureForReview()).resolves.toBeNull();
        (0, vitest_1.expect)(capture.calls).toEqual([]);
    });
    (0, vitest_1.it)("waits two frames plus 50 ms and returns the host screenshot", async () => {
        const host = await vitest_1.vi.importActual("../host");
        const { captureForReview } = await vitest_1.vi.importActual("../capture");
        const screenshot = { jpegBase64: "aGVsbG8=", width: 402, height: 874, scale: 3 };
        host.configureReview({ captureScreen: async () => screenshot });
        const promise = captureForReview();
        await vitest_1.vi.advanceTimersByTimeAsync(50);
        await (0, vitest_1.expect)(promise).resolves.toBe(screenshot);
        (0, vitest_1.expect)(frames.count).toBe(2);
        (0, vitest_1.expect)(capture.calls).toEqual([true, false]);
    });
    (0, vitest_1.it)("clears isCapturing and returns null when the capture throws", async () => {
        const host = await vitest_1.vi.importActual("../host");
        const { captureForReview } = await vitest_1.vi.importActual("../capture");
        host.configureReview({
            captureScreen: async () => {
                throw new Error("capture failed");
            },
        });
        const promise = captureForReview();
        await vitest_1.vi.advanceTimersByTimeAsync(50);
        await (0, vitest_1.expect)(promise).resolves.toBeNull();
        (0, vitest_1.expect)(capture.calls).toEqual([true, false]);
    });
});
//# sourceMappingURL=capture.test.js.map