"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isReviewFlowActive = exports.configureReview = exports.setFocusEffect = exports.enableGrabbing = exports.ReactNativeGrabContextProvider = exports.ReactNativeGrabSurface = exports.ReactNativeGrabScreen = exports.ReactNativeGrabRoot = void 0;
const noop = () => { };
const Passthrough = ({ children }) => children;
exports.ReactNativeGrabRoot = __DEV__
    ? require("./grab-root").ReactNativeGrabRoot
    : Passthrough;
exports.ReactNativeGrabScreen = __DEV__
    ? require("./grab-screen").ReactNativeGrabScreen
    : Passthrough;
exports.ReactNativeGrabSurface = __DEV__
    ? require("./grab-surface").ReactNativeGrabSurface
    : Passthrough;
exports.ReactNativeGrabContextProvider = __DEV__ ? require("./grab-context").ReactNativeGrabContextProvider : Passthrough;
exports.enableGrabbing = __DEV__
    ? require("./grab-controller").enableGrabbing
    : noop;
exports.setFocusEffect = __DEV__
    ? require("./focus-effect").setFocusEffect
    : noop;
exports.configureReview = __DEV__
    ? require("./review/host").configureReview
    : noop;
/**
 * True while a review pairing is active in the configured review host - i.e.
 * while the review flow that mounts a shared composer sheet is live. Native
 * side code (e.g. the app's Modal lifecycle coordinator) reads this to know
 * when an app Modal's close must be held until its native dismissal completed,
 * so the grab surface lifecycle never observes a half-dismissed Modal.
 */
exports.isReviewFlowActive = __DEV__
    ? require("./review/store").isReviewPaired
    : () => false;
//# sourceMappingURL=index.js.map