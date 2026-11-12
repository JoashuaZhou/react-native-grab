"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReactNativeGrabScreen = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const containers_1 = require("./containers");
const focus_effect_1 = require("./focus-effect");
const grab_selection_owner_1 = require("./grab-selection-owner");
const useFocusEffect = (0, focus_effect_1.getFocusEffect)();
const ReactNativeGrabScreen = ({ children, style, id, name, ...props }) => {
    const { ownerId, ownerRef } = (0, grab_selection_owner_1.useGrabSelectionOwner)("screen", id);
    (0, react_1.useEffect)(() => {
        (0, containers_1.setGrabSelectionOwnerName)(ownerId, name ?? null);
    }, [ownerId, name]);
    useFocusEffect((0, react_1.useCallback)(() => {
        (0, containers_1.setGrabSelectionOwnerFocused)(ownerId, true);
        return () => {
            (0, containers_1.clearGrabSelectionOwnerFocus)(ownerId);
        };
    }, [ownerId]));
    return ((0, jsx_runtime_1.jsx)(grab_selection_owner_1.GrabSelectionOwnerView, { ...props, ownerId: ownerId, ownerRef: ownerRef, style: [grab_selection_owner_1.grabSelectionOwnerFillStyle, style], children: children }));
};
exports.ReactNativeGrabScreen = ReactNativeGrabScreen;
//# sourceMappingURL=grab-screen.js.map