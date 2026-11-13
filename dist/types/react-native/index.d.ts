import type { ReactNativeGrabRootProps } from "./grab-root";
import type { ReactNativeGrabScreenProps } from "./grab-screen";
import type { ReactNativeGrabSurfaceProps } from "./grab-surface";
import type { ReactNativeGrabContextProviderProps } from "./grab-context";
import type { ReviewHost } from "./review/host";
export type { ReactNativeGrabRootProps } from "./grab-root";
export type { ReactNativeGrabScreenProps } from "./grab-screen";
export type { ReactNativeGrabSurfaceProps } from "./grab-surface";
export type { ReactNativeGrabContextProviderProps, ReactNativeGrabContextValue, } from "./grab-context";
export type { ReviewHost, ReviewScreenshot } from "./review/host";
export declare const ReactNativeGrabRoot: React.ComponentType<ReactNativeGrabRootProps>;
export declare const ReactNativeGrabScreen: React.ComponentType<ReactNativeGrabScreenProps>;
export declare const ReactNativeGrabSurface: React.ComponentType<ReactNativeGrabSurfaceProps>;
export declare const ReactNativeGrabContextProvider: React.ComponentType<ReactNativeGrabContextProviderProps>;
export declare const enableGrabbing: () => void;
export declare const setFocusEffect: (impl: (cb: () => void) => void) => void;
export declare const configureReview: (host: ReviewHost) => void;
/**
 * True while a review pairing is active in the configured review host - i.e.
 * while the review flow that mounts a shared composer sheet is live. Native
 * side code (e.g. the app's Modal lifecycle coordinator) reads this to know
 * when an app Modal's close must be held until its native dismissal completed,
 * so the grab surface lifecycle never observes a half-dismissed Modal.
 */
export declare const isReviewFlowActive: () => boolean;
//# sourceMappingURL=index.d.ts.map