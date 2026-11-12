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
export declare const configureReview: (host: ReviewHost) => void;
export declare const getReviewHost: () => ReviewHost | null;
//# sourceMappingURL=host.d.ts.map