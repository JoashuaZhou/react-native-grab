"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setFocusEffect = exports.enableGrabbing = exports.ReactNativeGrabContextProvider = exports.ReactNativeGrabSurface = exports.ReactNativeGrabScreen = exports.ReactNativeGrabRoot = void 0;
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
//# sourceMappingURL=index.js.map