"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GrabSelectionOwnerView = exports.useGrabSelectionOwner = exports.grabSelectionOwnerFillStyle = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const react_native_1 = require("react-native");
const containers_1 = require("./containers");
const grab_controls_1 = require("./grab-controls");
const grab_overlay_1 = require("./grab-overlay");
const composer_1 = require("./review/composer");
/** Root and screen owners always fill their parent; surfaces are sized by their host. */
exports.grabSelectionOwnerFillStyle = { flex: 1 };
const useGrabSelectionOwner = (kind, id) => {
    const ownerRef = (0, react_1.useRef)(null);
    const ownerIdRef = (0, react_1.useRef)(id ?? (0, containers_1.createGrabSelectionOwnerId)(kind));
    (0, react_1.useEffect)(() => {
        const ownerId = ownerIdRef.current;
        if (!ownerRef.current) {
            console.error(`[react-native-grab] Failed to register ${kind} selection owner: the view ref was never attached. Elements inside it cannot be grabbed.`);
            return;
        }
        (0, containers_1.registerGrabSelectionOwner)(ownerId, kind, ownerRef.current);
        return () => {
            (0, containers_1.unregisterGrabSelectionOwner)(ownerId);
        };
    }, [kind]);
    return { ownerId: ownerIdRef.current, ownerRef };
};
exports.useGrabSelectionOwner = useGrabSelectionOwner;
const GrabSelectionOwnerView = ({ children, ownerId, ownerRef, ...props }) => {
    const [panHandlers, setPanHandlers] = (0, react_1.useState)(null);
    // The controls belong to whichever owner resolves selection, so that they are
    // rendered in the same native window as the content they act on.
    const isResolvedSelectionOwner = (0, containers_1.useIsResolvedGrabSelectionOwner)(ownerId);
    // Only the ACTIVE surface hosts the shared composer sheet; when several
    // surfaces exist the registry hands it to the topmost activated one, the
    // same resolution that owns selection.
    const isActiveSurface = (0, containers_1.useIsActiveGrabSurfaceOwner)(ownerId);
    return ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsxs)(react_native_1.View, { ...props, ...(panHandlers ?? {}), collapsable: false, ref: ownerRef, children: [children, (0, jsx_runtime_1.jsx)(grab_overlay_1.ReactNativeGrabOverlay, { ownerId: ownerId, onPanHandlersChange: setPanHandlers })] }), isResolvedSelectionOwner && (0, jsx_runtime_1.jsx)(grab_controls_1.GrabOwnerControls, {}), isActiveSurface && (0, jsx_runtime_1.jsx)(composer_1.SurfaceComposerSlot, {})] }));
};
exports.GrabSelectionOwnerView = GrabSelectionOwnerView;
//# sourceMappingURL=grab-selection-owner.js.map