const noop = () => { };
const Passthrough = ({ children }) => children;
export const ReactNativeGrabRoot = __DEV__
    ? require("./grab-root").ReactNativeGrabRoot
    : Passthrough;
export const ReactNativeGrabScreen = __DEV__
    ? require("./grab-screen").ReactNativeGrabScreen
    : Passthrough;
export const ReactNativeGrabSurface = __DEV__
    ? require("./grab-surface").ReactNativeGrabSurface
    : Passthrough;
export const ReactNativeGrabContextProvider = __DEV__ ? require("./grab-context").ReactNativeGrabContextProvider : Passthrough;
export const enableGrabbing = __DEV__
    ? require("./grab-controller").enableGrabbing
    : noop;
export const setFocusEffect = __DEV__
    ? require("./focus-effect").setFocusEffect
    : noop;
export const configureReview = __DEV__
    ? require("./review/host").configureReview
    : noop;
/**
 * True while a review pairing is active in the configured review host - i.e.
 * while the review flow that mounts a shared composer sheet is live. Native
 * side code (e.g. the app's Modal lifecycle coordinator) reads this to know
 * when an app Modal's close must be held until its native dismissal completed,
 * so the grab surface lifecycle never observes a half-dismissed Modal.
 */
export const isReviewFlowActive = __DEV__
    ? require("./review/store").isReviewPaired
    : () => false;
//# sourceMappingURL=index.js.map