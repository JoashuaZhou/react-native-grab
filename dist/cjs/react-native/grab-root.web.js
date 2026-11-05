"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReactNativeGrabRoot = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_native_1 = require("react-native");
// React Native Grab doesn't support web yet, so the root only preserves layout.
const ReactNativeGrabRoot = ({ style, ...props }) => {
    return (0, jsx_runtime_1.jsx)(react_native_1.View, { ...props, style: [{ flex: 1 }, style] });
};
exports.ReactNativeGrabRoot = ReactNativeGrabRoot;
//# sourceMappingURL=grab-root.web.js.map