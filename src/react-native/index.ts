import type { ReactNativeGrabRootProps } from "./grab-root";
import type { ReactNativeGrabScreenProps } from "./grab-screen";
import type { ReactNativeGrabSurfaceProps } from "./grab-surface";
import type { ReactNativeGrabContextProviderProps } from "./grab-context";
import type { ReviewHost, ReviewScreenshot } from "./review/host";
import type { ReactNode } from "react";

export type { ReactNativeGrabRootProps } from "./grab-root";
export type { ReactNativeGrabScreenProps } from "./grab-screen";
export type { ReactNativeGrabSurfaceProps } from "./grab-surface";
export type {
  ReactNativeGrabContextProviderProps,
  ReactNativeGrabContextValue,
} from "./grab-context";
export type { ReviewHost, ReviewScreenshot } from "./review/host";

const noop = () => {};
const Passthrough = ({ children }: { children?: ReactNode }) => children;

export const ReactNativeGrabRoot: React.ComponentType<ReactNativeGrabRootProps> = __DEV__
  ? require("./grab-root").ReactNativeGrabRoot
  : Passthrough;

export const ReactNativeGrabScreen: React.ComponentType<ReactNativeGrabScreenProps> = __DEV__
  ? require("./grab-screen").ReactNativeGrabScreen
  : Passthrough;

export const ReactNativeGrabSurface: React.ComponentType<ReactNativeGrabSurfaceProps> = __DEV__
  ? require("./grab-surface").ReactNativeGrabSurface
  : Passthrough;

export const ReactNativeGrabContextProvider: React.ComponentType<ReactNativeGrabContextProviderProps> =
  __DEV__ ? require("./grab-context").ReactNativeGrabContextProvider : Passthrough;

export const enableGrabbing: () => void = __DEV__
  ? require("./grab-controller").enableGrabbing
  : noop;

export const setFocusEffect: (impl: (cb: () => void) => void) => void = __DEV__
  ? require("./focus-effect").setFocusEffect
  : noop;

export const configureReview: (host: ReviewHost) => void = __DEV__
  ? require("./review/host").configureReview
  : noop;

/**
 * True while a review pairing is active in the configured review host - i.e.
 * while the review flow that mounts a shared composer sheet is live. Native
 * side code (e.g. the app's Modal lifecycle coordinator) reads this to know
 * when an app Modal's close must be held until its native dismissal completed,
 * so the grab surface lifecycle never observes a half-dismissed Modal.
 */
export const isReviewFlowActive: () => boolean = __DEV__
  ? require("./review/store").isReviewPaired
  : () => false;
