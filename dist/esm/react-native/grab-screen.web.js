import { jsx as _jsx } from "react/jsx-runtime";
import { View } from "react-native";
// React Native Grab doesn't support web yet, so the screen only preserves layout.
// `id` identifies a selection owner, not a DOM node, so it is not forwarded.
export const ReactNativeGrabScreen = ({ id, style, ...props }) => {
    return _jsx(View, { ...props, style: [{ flex: 1 }, style] });
};
//# sourceMappingURL=grab-screen.web.js.map