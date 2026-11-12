import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useDevMenu } from "./dev-menu";
import { toggleGrabMenu } from "./grab-controller";
import { grabSelectionOwnerFillStyle, GrabSelectionOwnerView, useGrabSelectionOwner, } from "./grab-selection-owner";
import { ReviewLayer } from "./review/review-layer";
export const ReactNativeGrabRoot = ({ children, style, ...props }) => {
    const { ownerId, ownerRef } = useGrabSelectionOwner("root");
    // Registered from the root rather than from the resolved owner: the dev menu
    // item has to outlive selection moving between owners.
    useDevMenu(toggleGrabMenu);
    return (_jsxs(GrabSelectionOwnerView, { ...props, ownerId: ownerId, ownerRef: ownerRef, style: [grabSelectionOwnerFillStyle, style], children: [children, _jsx(ReviewLayer, {})] }));
};
//# sourceMappingURL=grab-root.js.map