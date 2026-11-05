"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReactNativeGrabRoot = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const dev_menu_1 = require("./dev-menu");
const grab_controller_1 = require("./grab-controller");
const grab_selection_owner_1 = require("./grab-selection-owner");
const ReactNativeGrabRoot = ({ children, style, ...props }) => {
    const { ownerId, ownerRef } = (0, grab_selection_owner_1.useGrabSelectionOwner)("root");
    // Registered from the root rather than from the resolved owner: the dev menu
    // item has to outlive selection moving between owners.
    (0, dev_menu_1.useDevMenu)(grab_controller_1.toggleGrabMenu);
    return ((0, jsx_runtime_1.jsx)(grab_selection_owner_1.GrabSelectionOwnerView, { ...props, ownerId: ownerId, ownerRef: ownerRef, style: [grab_selection_owner_1.grabSelectionOwnerFillStyle, style], children: children }));
};
exports.ReactNativeGrabRoot = ReactNativeGrabRoot;
//# sourceMappingURL=grab-root.js.map