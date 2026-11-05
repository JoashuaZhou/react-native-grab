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
//# sourceMappingURL=index.js.map