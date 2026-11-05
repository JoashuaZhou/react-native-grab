import { jsx as _jsx } from "react/jsx-runtime";
import { Fragment } from "react";
import { Platform } from "react-native";
const getRoot = () => {
    if (Platform.OS !== "ios") {
        return Fragment;
    }
    try {
        return require("react-native-screens").FullWindowOverlay;
    }
    catch {
        // Nothing we can do about it, it's not installed in the project.
    }
    return Fragment;
};
const Root = getRoot();
export const FullScreenOverlay = ({ children }) => {
    return _jsx(Root, { children: children });
};
//# sourceMappingURL=full-screen-overlay.js.map