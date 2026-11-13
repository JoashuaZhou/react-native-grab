import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { createGrabSelectionOwnerId, registerGrabSelectionOwner, unregisterGrabSelectionOwner, useIsActiveGrabSurfaceOwner, useIsResolvedGrabSelectionOwner, } from "./containers";
import { GrabOwnerControls } from "./grab-controls";
import { ReactNativeGrabOverlay } from "./grab-overlay";
import { SurfaceComposerSlot } from "./review/composer";
/** Root and screen owners always fill their parent; surfaces are sized by their host. */
export const grabSelectionOwnerFillStyle = { flex: 1 };
export const useGrabSelectionOwner = (kind, id) => {
    const ownerRef = useRef(null);
    const ownerIdRef = useRef(id ?? createGrabSelectionOwnerId(kind));
    useEffect(() => {
        const ownerId = ownerIdRef.current;
        if (!ownerRef.current) {
            console.error(`[react-native-grab] Failed to register ${kind} selection owner: the view ref was never attached. Elements inside it cannot be grabbed.`);
            return;
        }
        registerGrabSelectionOwner(ownerId, kind, ownerRef.current);
        return () => {
            unregisterGrabSelectionOwner(ownerId);
        };
    }, [kind]);
    return { ownerId: ownerIdRef.current, ownerRef };
};
export const GrabSelectionOwnerView = ({ children, ownerId, ownerRef, ...props }) => {
    const [panHandlers, setPanHandlers] = useState(null);
    // The controls belong to whichever owner resolves selection, so that they are
    // rendered in the same native window as the content they act on.
    const isResolvedSelectionOwner = useIsResolvedGrabSelectionOwner(ownerId);
    // Only the ACTIVE surface hosts the shared composer sheet; when several
    // surfaces exist the registry hands it to the topmost activated one, the
    // same resolution that owns selection.
    const isActiveSurface = useIsActiveGrabSurfaceOwner(ownerId);
    return (_jsxs(_Fragment, { children: [_jsxs(View, { ...props, ...(panHandlers ?? {}), collapsable: false, ref: ownerRef, children: [children, _jsx(ReactNativeGrabOverlay, { ownerId: ownerId, onPanHandlersChange: setPanHandlers })] }), isResolvedSelectionOwner && _jsx(GrabOwnerControls, {}), isActiveSurface && _jsx(SurfaceComposerSlot, {})] }));
};
//# sourceMappingURL=grab-selection-owner.js.map