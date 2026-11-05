import { jsx as _jsx } from "react/jsx-runtime";
import { View } from "react-native";
// React Native Grab doesn't support web yet, so the root only preserves layout.
export const ReactNativeGrabRoot = ({ style, ...props }) => {
    return _jsx(View, { ...props, style: [{ flex: 1 }, style] });
};
//# sourceMappingURL=grab-root.web.js.map