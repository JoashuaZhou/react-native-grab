"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FullScreenOverlay = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const react_native_1 = require("react-native");
const getRoot = () => {
    if (react_native_1.Platform.OS !== "ios") {
        return react_1.Fragment;
    }
    try {
        return require("react-native-screens").FullWindowOverlay;
    }
    catch {
        // Nothing we can do about it, it's not installed in the project.
    }
    return react_1.Fragment;
};
const Root = getRoot();
const FullScreenOverlay = ({ children }) => {
    return (0, jsx_runtime_1.jsx)(Root, { children: children });
};
exports.FullScreenOverlay = FullScreenOverlay;
//# sourceMappingURL=full-screen-overlay.js.map