import type { DeviceInfo } from "../../review-core/types";

export type ReviewScreenshot = {
  jpegBase64: string;
  width: number;
  height: number;
  scale: number;
};

export type ReviewHostStorage = {
  get: (key: string) => string | null;
  set: (key: string, value: string) => void;
};

export type ReviewHost = {
  captureScreen?: () => Promise<ReviewScreenshot>;
  storage?: ReviewHostStorage;
  getDeviceInfo?: () => Promise<DeviceInfo>;
};

let reviewHost: ReviewHost | null = null;

export const configureReview = (host: ReviewHost): void => {
  reviewHost = host;
};

export const getReviewHost = (): ReviewHost | null => reviewHost;
