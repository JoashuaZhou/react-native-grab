import { jsx as _jsx } from "react/jsx-runtime";
import { useDevMenu } from "./dev-menu";
import { toggleGrabMenu } from "./grab-controller";
import { grabSelectionOwnerFillStyle, GrabSelectionOwnerView, useGrabSelectionOwner, } from "./grab-selection-owner";
export const ReactNativeGrabRoot = ({ children, style, ...props }) => {
    const { ownerId, ownerRef } = useGrabSelectionOwner("root");
    // Registered from the root rather than from the resolved owner: the dev menu
    // item has to outlive selection moving between owners.
    useDevMenu(toggleGrabMenu);
    return (_jsx(GrabSelectionOwnerView, { ...props, ownerId: ownerId, ownerRef: ownerRef, style: [grabSelectionOwnerFillStyle, style], children: children }));
};
//# sourceMappingURL=grab-root.js.map