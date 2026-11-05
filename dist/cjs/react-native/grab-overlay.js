"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReactNativeGrabOverlay = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const react_native_1 = require("react-native");
const containers_1 = require("./containers");
const copy_1 = require("./copy");
const context_menu_1 = require("./context-menu");
const grab_colors_1 = require("./grab-colors");
const grab_controller_1 = require("./grab-controller");
const description_1 = require("./description");
const get_open_frame_1 = require("./get-open-frame");
const get_rendered_by_1 = require("./get-rendered-by");
const measure_1 = require("./measure");
const open_1 = require("./open");
const COPY_BADGE_DURATION_MS = 1600;
const ReactNativeGrabOverlay = ({ ownerId, onPanHandlersChange, }) => {
    const isResolvedSelectionOwner = (0, containers_1.useIsResolvedGrabSelectionOwner)(ownerId);
    const copyBadgeTimeoutRef = (0, react_1.useRef)(null);
    const windowOffsetRef = (0, react_1.useRef)([0, 0]);
    const [bounds, setBounds] = (0, react_1.useState)({ width: 0, height: 0 });
    const [state, setState] = (0, react_1.useState)({
        isSessionEnabled: false,
        grabbedElement: null,
        isCopyBadgeVisible: false,
        selectedElement: null,
    });
    const startSession = (0, react_1.useCallback)(() => {
        setState((prev) => ({
            ...prev,
            grabbedElement: null,
            isSessionEnabled: true,
            selectedElement: null,
        }));
    }, []);
    const stopSession = (0, react_1.useCallback)(() => {
        setState((prev) => ({
            ...prev,
            isSessionEnabled: false,
            grabbedElement: null,
        }));
    }, []);
    const closeSelectedElementMenu = (0, react_1.useCallback)(() => {
        (0, grab_controller_1.hideGrabSelectionMenu)(ownerId);
        setState((prev) => {
            return {
                ...prev,
                selectedElement: null,
                grabbedElement: null,
            };
        });
    }, [ownerId]);
    (0, react_1.useEffect)(() => {
        return () => {
            if (copyBadgeTimeoutRef.current) {
                clearTimeout(copyBadgeTimeoutRef.current);
            }
        };
    }, []);
    const updateGrabbedElement = (0, react_1.useCallback)((grabbedElement) => {
        setState((prev) => ({
            ...prev,
            grabbedElement,
        }));
    }, []);
    const showCopiedBadge = (0, react_1.useCallback)(() => {
        if (copyBadgeTimeoutRef.current) {
            clearTimeout(copyBadgeTimeoutRef.current);
        }
        setState((prev) => ({ ...prev, isCopyBadgeVisible: true }));
        copyBadgeTimeoutRef.current = setTimeout(() => {
            setState((prev) => ({ ...prev, isCopyBadgeVisible: false }));
            copyBadgeTimeoutRef.current = null;
        }, COPY_BADGE_DURATION_MS);
    }, []);
    (0, react_1.useEffect)(() => {
        if (isResolvedSelectionOwner) {
            return;
        }
        (0, grab_controller_1.clearGrabOwnerPresentation)(ownerId);
        setState((prev) => {
            if (!prev.isSessionEnabled && !prev.grabbedElement && !prev.selectedElement) {
                return prev;
            }
            return {
                ...prev,
                isSessionEnabled: false,
                grabbedElement: null,
                selectedElement: null,
            };
        });
    }, [isResolvedSelectionOwner, ownerId]);
    const getElementAtPoint = (pageX, pageY) => {
        const owner = (0, containers_1.getGrabSelectionOwner)(ownerId);
        if (!owner) {
            return null;
        }
        // findNodeAtPoint resolves the point against the owner, not the window, so
        // page coordinates have to be moved into Fabric's space (see
        // getFabricWindowOffset) and then rebased onto the owner's origin. They only
        // coincide for an owner sitting at the window origin, which is why a screen
        // under a native header, or a natively presented surface, missed its target.
        const ownerRect = (0, measure_1.measureInWindow)(owner.shadowNode);
        const [windowOffsetX, windowOffsetY] = windowOffsetRef.current;
        const internalNode = (0, measure_1.findNodeAtPoint)(owner.shadowNode, pageX + windowOffsetX - ownerRect[0], pageY + windowOffsetY - ownerRect[1]);
        const shadowNode = internalNode?.stateNode?.node;
        if (!shadowNode) {
            return null;
        }
        const rect = nativeFabricUIManager.getBoundingClientRect(shadowNode, true);
        return {
            fiberNode: internalNode,
            rect: [rect[0] - ownerRect[0], rect[1] - ownerRect[1], rect[2], rect[3]],
        };
    };
    const handleTouch = (nativeEvent) => {
        const result = getElementAtPoint(nativeEvent.pageX, nativeEvent.pageY);
        if (!result) {
            updateGrabbedElement(null);
            return null;
        }
        updateGrabbedElement(result);
    };
    const handleGrabbing = (0, react_1.useCallback)(async (result) => {
        const [description, renderedBy] = await Promise.all([
            (0, description_1.getDescription)(result.fiberNode),
            (0, get_rendered_by_1.getRenderedBy)(result.fiberNode),
        ]);
        const openFrame = (0, get_open_frame_1.getOpenFrame)(renderedBy);
        const elementName = (0, description_1.getGrabSelectionTitle)(result.fiberNode, renderedBy);
        setState((prev) => ({
            ...prev,
            grabbedElement: result,
            selectedElement: {
                description,
                elementName,
                frame: openFrame,
                result,
            },
        }));
        (0, grab_controller_1.showGrabSelectionMenu)(ownerId);
    }, [ownerId]);
    (0, react_1.useEffect)(() => {
        (0, grab_controller_1.registerLocalGrabSelectionController)(ownerId, {
            closeSelectionMenu: () => {
                closeSelectedElementMenu();
            },
            startSelection: startSession,
            stopSelection: () => {
                closeSelectedElementMenu();
                stopSession();
            },
        });
        return () => {
            (0, grab_controller_1.unregisterLocalGrabSelectionController)(ownerId);
        };
    }, [closeSelectedElementMenu, ownerId, startSession, stopSession]);
    const panResponder = (0, react_1.useRef)(react_native_1.PanResponder.create({
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderGrant: (evt) => {
            windowOffsetRef.current = (0, measure_1.getFabricWindowOffset)(evt.nativeEvent);
            handleTouch(evt.nativeEvent);
        },
        onPanResponderMove: (evt) => handleTouch(evt.nativeEvent),
        onPanResponderRelease: (evt) => {
            void (async () => {
                try {
                    const result = getElementAtPoint(evt.nativeEvent.pageX, evt.nativeEvent.pageY);
                    if (!result) {
                        return;
                    }
                    await handleGrabbing(result);
                }
                catch {
                    console.error("[react-native-grab] Grabbing failed.");
                }
                finally {
                    (0, grab_controller_1.setGrabSelectionSessionOwner)(null);
                    stopSession();
                }
            })();
        },
    })).current;
    (0, react_1.useEffect)(() => {
        onPanHandlersChange?.(state.isSessionEnabled ? panResponder.panHandlers : null);
        return () => {
            onPanHandlersChange?.(null);
        };
    }, [onPanHandlersChange, panResponder.panHandlers, state.isSessionEnabled]);
    const handleCopySelectedElement = (0, react_1.useCallback)(async () => {
        const selectedElement = state.selectedElement;
        if (!selectedElement) {
            return;
        }
        closeSelectedElementMenu();
        try {
            await (0, copy_1.copyViaMetro)(selectedElement.description);
            showCopiedBadge();
        }
        catch {
            console.error("[react-native-grab] Copying failed. Ensure your Metro config is wrapped with withReactNativeGrab(...) and Metro has been restarted.");
        }
    }, [closeSelectedElementMenu, showCopiedBadge, state.selectedElement]);
    const handleOpenSelectedElement = (0, react_1.useCallback)(async () => {
        const frame = state.selectedElement?.frame;
        if (!frame?.file || frame.line == null) {
            return;
        }
        closeSelectedElementMenu();
        try {
            await (0, open_1.openStackFrameInEditor)({
                file: frame.file,
                lineNumber: frame.line,
            });
        }
        catch {
            console.error("[react-native-grab] Opening editor failed.");
        }
    }, [closeSelectedElementMenu, state.selectedElement]);
    const selectedElementMenuAnchor = (0, react_1.useMemo)(() => {
        if (!state.selectedElement) {
            return null;
        }
        const rect = state.selectedElement.result.rect;
        return {
            x: rect[0] + rect[2] / 2,
            y: rect[1] + rect[3],
        };
    }, [state.selectedElement]);
    const highlightedElement = state.grabbedElement ?? state.selectedElement?.result ?? null;
    if (!state.isSessionEnabled &&
        !state.isCopyBadgeVisible &&
        !state.grabbedElement &&
        !state.selectedElement) {
        return null;
    }
    return ((0, jsx_runtime_1.jsxs)(react_native_1.View, { pointerEvents: "box-none", style: styles.overlayRoot, onLayout: (event) => {
            const { width, height } = event.nativeEvent.layout;
            setBounds((prev) => {
                if (prev.width === width && prev.height === height) {
                    return prev;
                }
                return { width, height };
            });
        }, children: [state.isSessionEnabled && ((0, jsx_runtime_1.jsx)(react_native_1.View, { pointerEvents: "none", style: styles.topBadge, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.topBadgeText, children: "Touch and move around to grab" }) })), state.isCopyBadgeVisible && ((0, jsx_runtime_1.jsx)(react_native_1.View, { pointerEvents: "none", style: styles.topBadge, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.topBadgeText, children: "Element copied" }) })), !!highlightedElement && ((0, jsx_runtime_1.jsx)(react_native_1.View, { pointerEvents: "none", style: [
                    styles.highlight,
                    {
                        left: highlightedElement.rect[0],
                        top: highlightedElement.rect[1],
                        width: highlightedElement.rect[2],
                        height: highlightedElement.rect[3],
                    },
                ] })), (0, jsx_runtime_1.jsxs)(context_menu_1.ContextMenu, { anchor: selectedElementMenuAnchor, bounds: bounds, cutout: state.selectedElement
                    ? {
                        x: state.selectedElement.result.rect[0],
                        y: state.selectedElement.result.rect[1],
                        width: state.selectedElement.result.rect[2],
                        height: state.selectedElement.result.rect[3],
                    }
                    : null, horizontalAlignment: "center", offset: { x: 0, y: 8 }, onClose: closeSelectedElementMenu, visible: state.selectedElement !== null, children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { style: styles.selectionMenuHeader, children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { adjustsFontSizeToFit: true, minimumFontScale: 0.65, numberOfLines: 1, style: styles.selectionMenuTitle, children: state.selectedElement?.elementName }) }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: styles.selectionMenuActions, children: [(0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", onPress: () => void handleCopySelectedElement(), style: ({ pressed }) => [
                                    styles.selectionMenuActionButton,
                                    pressed && styles.selectionMenuActionButtonPressed,
                                ], children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: styles.selectionMenuActionText, children: "Copy" }) }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: styles.selectionMenuActionDivider }), (0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "button", disabled: !state.selectedElement?.frame?.file, onPress: () => void handleOpenSelectedElement(), style: ({ pressed }) => [
                                    styles.selectionMenuActionButton,
                                    pressed &&
                                        state.selectedElement?.frame?.file &&
                                        styles.selectionMenuActionButtonPressed,
                                ], children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [
                                        styles.selectionMenuActionText,
                                        !state.selectedElement?.frame?.file && styles.selectionMenuActionTextDisabled,
                                    ], children: "Open" }) })] })] })] }));
};
exports.ReactNativeGrabOverlay = ReactNativeGrabOverlay;
const styles = react_native_1.StyleSheet.create({
    overlayRoot: {
        ...react_native_1.StyleSheet.absoluteFill,
        zIndex: 9999,
    },
    topBadge: {
        position: "absolute",
        top: 52,
        alignSelf: "center",
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: grab_colors_1.GRAB_BADGE_BACKGROUND,
    },
    topBadgeText: {
        color: "#FFFFFF",
        fontSize: 13,
        fontWeight: "600",
    },
    highlight: {
        position: "absolute",
        backgroundColor: grab_colors_1.GRAB_HIGHLIGHT_FILL,
        borderWidth: 1,
        borderColor: grab_colors_1.GRAB_PRIMARY,
    },
    selectionMenuHeader: {
        alignSelf: "stretch",
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    selectionMenuTitle: {
        width: "100%",
        color: "#111111",
        fontSize: 14,
        fontWeight: "600",
    },
    selectionMenuActions: {
        flexDirection: "row",
    },
    selectionMenuActionButton: {
        flex: 1,
    },
    selectionMenuActionButtonPressed: {
        backgroundColor: "rgba(17, 17, 17, 0.06)",
    },
    selectionMenuActionDivider: {
        width: react_native_1.StyleSheet.hairlineWidth,
        backgroundColor: "rgba(17, 17, 17, 0.12)",
    },
    selectionMenuActionText: {
        flex: 1,
        paddingHorizontal: 14,
        paddingVertical: 12,
        color: "#111111",
        fontSize: 14,
        fontWeight: "500",
        textAlign: "center",
    },
    selectionMenuActionTextDisabled: {
        opacity: 0.4,
    },
});
//# sourceMappingURL=grab-overlay.js.map