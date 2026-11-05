import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect } from "react";
import { setGrabSelectionOwnerActive } from "./containers";
import { GrabSelectionOwnerView, useGrabSelectionOwner } from "./grab-selection-owner";
export const ReactNativeGrabSurface = ({ active, children, style, ...props }) => {
    const { ownerId, ownerRef } = useGrabSelectionOwner("surface");
    useEffect(() => {
        if (!active) {
            return;
        }
        setGrabSelectionOwnerActive(ownerId, true);
        return () => {
            setGrabSelectionOwnerActive(ownerId, false);
        };
    }, [active, ownerId]);
    return (_jsx(GrabSelectionOwnerView, { ...props, ownerId: ownerId, ownerRef: ownerRef, style: style, children: children }));
};
//# sourceMappingURL=grab-surface.js.map