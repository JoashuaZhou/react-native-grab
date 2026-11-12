import { jsx as _jsx } from "react/jsx-runtime";
import { useCallback, useEffect } from "react";
import { clearGrabSelectionOwnerFocus, setGrabSelectionOwnerFocused, setGrabSelectionOwnerName, } from "./containers";
import { getFocusEffect } from "./focus-effect";
import { grabSelectionOwnerFillStyle, GrabSelectionOwnerView, useGrabSelectionOwner, } from "./grab-selection-owner";
const useFocusEffect = getFocusEffect();
export const ReactNativeGrabScreen = ({ children, style, id, name, ...props }) => {
    const { ownerId, ownerRef } = useGrabSelectionOwner("screen", id);
    useEffect(() => {
        setGrabSelectionOwnerName(ownerId, name ?? null);
    }, [ownerId, name]);
    useFocusEffect(useCallback(() => {
        setGrabSelectionOwnerFocused(ownerId, true);
        return () => {
            clearGrabSelectionOwnerFocus(ownerId);
        };
    }, [ownerId]));
    return (_jsx(GrabSelectionOwnerView, { ...props, ownerId: ownerId, ownerRef: ownerRef, style: [grabSelectionOwnerFillStyle, style], children: children }));
};
//# sourceMappingURL=grab-screen.js.map