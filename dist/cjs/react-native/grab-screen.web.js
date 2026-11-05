"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReactNativeGrabScreen = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_native_1 = require("react-native");
// React Native Grab doesn't support web yet, so the screen only preserves layout.
// `id` identifies a selection owner, not a DOM node, so it is not forwarded.
const ReactNativeGrabScreen = ({ id, style, ...props }) => {
    return (0, jsx_runtime_1.jsx)(react_native_1.View, { ...props, style: [{ flex: 1 }, style] });
};
exports.ReactNativeGrabScreen = ReactNativeGrabScreen;
//# sourceMappingURL=grab-screen.web.js.map