import { jsx as _jsx } from "react/jsx-runtime";
import { View } from "react-native";
// React Native Grab doesn't support web yet, so the surface only preserves layout.
export const ReactNativeGrabSurface = ({ active, ...props }) => {
    return _jsx(View, { ...props });
};
//# sourceMappingURL=grab-surface.web.js.map