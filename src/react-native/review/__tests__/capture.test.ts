import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const capture = vi.hoisted(() => ({ calls: [] as boolean[] }));
const frames = vi.hoisted(() => ({ count: 0 }));

vi.mock("../../grab-controller", () => ({
  setGrabCapturing: (value: boolean): void => {
    capture.calls.push(value);
  },
}));

describe("captureForReview", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    capture.calls.length = 0;
    frames.count = 0;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback): number => {
      frames.count += 1;
      callback(0);
      return 0;
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("returns null without a host", async () => {
    const { captureForReview } = await vi.importActual<typeof import("../capture")>("../capture");

    await expect(captureForReview()).resolves.toBeNull();
    expect(capture.calls).toEqual([]);
  });

  it("returns null when the host has no capture function", async () => {
    const host = await vi.importActual<typeof import("../host")>("../host");
    const { captureForReview } = await vi.importActual<typeof import("../capture")>("../capture");
    host.configureReview({});

    await expect(captureForReview()).resolves.toBeNull();
    expect(capture.calls).toEqual([]);
  });

  it("waits two frames plus 50 ms and returns the host screenshot", async () => {
    const host = await vi.importActual<typeof import("../host")>("../host");
    const { captureForReview } = await vi.importActual<typeof import("../capture")>("../capture");
    const screenshot = { jpegBase64: "aGVsbG8=", width: 402, height: 874, scale: 3 };
    host.configureReview({ captureScreen: async () => screenshot });

    const promise = captureForReview();
    await vi.advanceTimersByTimeAsync(50);
    await expect(promise).resolves.toBe(screenshot);

    expect(frames.count).toBe(2);
    expect(capture.calls).toEqual([true, false]);
  });

  it("clears isCapturing and returns null when the capture throws", async () => {
    const host = await vi.importActual<typeof import("../host")>("../host");
    const { captureForReview } = await vi.importActual<typeof import("../capture")>("../capture");
    host.configureReview({
      captureScreen: async () => {
        throw new Error("capture failed");
      },
    });

    const promise = captureForReview();
    await vi.advanceTimersByTimeAsync(50);
    await expect(promise).resolves.toBeNull();
    expect(capture.calls).toEqual([true, false]);
  });
});
