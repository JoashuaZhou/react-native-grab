"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReactNativeGrabSurface = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_native_1 = require("react-native");
// React Native Grab doesn't support web yet, so the surface only preserves layout.
const ReactNativeGrabSurface = ({ active, ...props }) => {
    return (0, jsx_runtime_1.jsx)(react_native_1.View, { ...props });
};
exports.ReactNativeGrabSurface = ReactNativeGrabSurface;
//# sourceMappingURL=grab-surface.web.js.map