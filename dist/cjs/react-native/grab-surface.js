"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReactNativeGrabSurface = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const containers_1 = require("./containers");
const grab_selection_owner_1 = require("./grab-selection-owner");
const ReactNativeGrabSurface = ({ active, children, style, ...props }) => {
    const { ownerId, ownerRef } = (0, grab_selection_owner_1.useGrabSelectionOwner)("surface");
    (0, react_1.useEffect)(() => {
        if (!active) {
            return;
        }
        (0, containers_1.setGrabSelectionOwnerActive)(ownerId, true);
        return () => {
            (0, containers_1.setGrabSelectionOwnerActive)(ownerId, false);
        };
    }, [active, ownerId]);
    return ((0, jsx_runtime_1.jsx)(grab_selection_owner_1.GrabSelectionOwnerView, { ...props, ownerId: ownerId, ownerRef: ownerRef, style: style, children: children }));
};
exports.ReactNativeGrabSurface = ReactNativeGrabSurface;
//# sourceMappingURL=grab-surface.js.map