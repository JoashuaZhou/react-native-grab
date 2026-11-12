import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, PanResponder, PixelRatio, Pressable, StyleSheet, Text, View, } from "react-native";
import { getFocusedScreenName, getGrabSelectionOwner, useIsResolvedGrabSelectionOwner, } from "./containers";
import { copyViaMetro } from "./copy";
import { ContextMenu } from "./context-menu";
import { GRAB_BADGE_BACKGROUND, GRAB_HIGHLIGHT_FILL, GRAB_PRIMARY } from "./grab-colors";
import { clearGrabOwnerPresentation, hideGrabSelectionMenu, registerLocalGrabSelectionController, setGrabSelectionSessionOwner, showGrabSelectionMenu, unregisterLocalGrabSelectionController, useGrabControllerState, } from "./grab-controller";
import { getDescription, getGrabSelectionTitle } from "./description";
import { getOpenFrame } from "./get-open-frame";
import { getRenderedBy } from "./get-rendered-by";
import { findNodeAtPoint, getFabricWindowOffset, measureInWindow } from "./measure";
import { openStackFrameInEditor } from "./open";
import { captureForReview } from "./review/capture";
import { isReviewPaired, reviewActions } from "./review/store";
import { toWindowRect } from "./review/view-model";
const COPY_BADGE_DURATION_MS = 1600;
const getScreenInfo = () => ({
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height,
    scale: PixelRatio.get(),
});
export const ReactNativeGrabOverlay = ({ ownerId, onPanHandlersChange, }) => {
    const isResolvedSelectionOwner = useIsResolvedGrabSelectionOwner(ownerId);
    const { isCapturing } = useGrabControllerState();
    const copyBadgeTimeoutRef = useRef(null);
    const windowOffsetRef = useRef([0, 0]);
    const [bounds, setBounds] = useState({ width: 0, height: 0 });
    const [state, setState] = useState({
        isSessionEnabled: false,
        grabbedElement: null,
        isCopyBadgeVisible: false,
        selectedElement: null,
    });
    const startSession = useCallback(() => {
        setState((prev) => ({
            ...prev,
            grabbedElement: null,
            isSessionEnabled: true,
            selectedElement: null,
        }));
    }, []);
    const stopSession = useCallback(() => {
        setState((prev) => ({
            ...prev,
            isSessionEnabled: false,
            grabbedElement: null,
        }));
    }, []);
    const closeSelectedElementMenu = useCallback(() => {
        hideGrabSelectionMenu(ownerId);
        setState((prev) => {
            return {
                ...prev,
                selectedElement: null,
                grabbedElement: null,
            };
        });
    }, [ownerId]);
    useEffect(() => {
        return () => {
            if (copyBadgeTimeoutRef.current) {
                clearTimeout(copyBadgeTimeoutRef.current);
            }
        };
    }, []);
    const updateGrabbedElement = useCallback((grabbedElement) => {
        setState((prev) => ({
            ...prev,
            grabbedElement,
        }));
    }, []);
    const showCopiedBadge = useCallback(() => {
        if (copyBadgeTimeoutRef.current) {
            clearTimeout(copyBadgeTimeoutRef.current);
        }
        setState((prev) => ({ ...prev, isCopyBadgeVisible: true }));
        copyBadgeTimeoutRef.current = setTimeout(() => {
            setState((prev) => ({ ...prev, isCopyBadgeVisible: false }));
            copyBadgeTimeoutRef.current = null;
        }, COPY_BADGE_DURATION_MS);
    }, []);
    useEffect(() => {
        if (isResolvedSelectionOwner) {
            return;
        }
        clearGrabOwnerPresentation(ownerId);
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
        const owner = getGrabSelectionOwner(ownerId);
        if (!owner) {
            return null;
        }
        // findNodeAtPoint resolves the point against the owner, not the window, so
        // page coordinates have to be moved into Fabric's space (see
        // getFabricWindowOffset) and then rebased onto the owner's origin. They only
        // coincide for an owner sitting at the window origin, which is why a screen
        // under a native header, or a natively presented surface, missed its target.
        const ownerRect = measureInWindow(owner.shadowNode);
        const [windowOffsetX, windowOffsetY] = windowOffsetRef.current;
        const internalNode = findNodeAtPoint(owner.shadowNode, pageX + windowOffsetX - ownerRect[0], pageY + windowOffsetY - ownerRect[1]);
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
    const handleGrabbing = useCallback(async (result) => {
        const [description, renderedBy] = await Promise.all([
            getDescription(result.fiberNode),
            getRenderedBy(result.fiberNode),
        ]);
        if (isReviewPaired()) {
            const screenshot = await captureForReview();
            reviewActions.openComposer({
                mode: "create",
                draft: {
                    kind: "element",
                    description: "",
                    rect: toWindowRect(result.rect, windowOffsetRef.current),
                    screen: getScreenInfo(),
                    route: getFocusedScreenName(),
                    grab: {
                        description,
                        frames: renderedBy.map((frame) => ({
                            name: frame.name,
                            file: frame.file,
                            line: frame.line,
                            column: frame.column,
                        })),
                    },
                },
                screenshot,
            });
            return;
        }
        const openFrame = getOpenFrame(renderedBy);
        const elementName = getGrabSelectionTitle(result.fiberNode, renderedBy);
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
        showGrabSelectionMenu(ownerId);
    }, [ownerId]);
    useEffect(() => {
        registerLocalGrabSelectionController(ownerId, {
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
            unregisterLocalGrabSelectionController(ownerId);
        };
    }, [closeSelectedElementMenu, ownerId, startSession, stopSession]);
    const panResponder = useRef(PanResponder.create({
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderGrant: (evt) => {
            windowOffsetRef.current = getFabricWindowOffset(evt.nativeEvent);
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
                    setGrabSelectionSessionOwner(null);
                    stopSession();
                }
            })();
        },
    })).current;
    useEffect(() => {
        onPanHandlersChange?.(state.isSessionEnabled ? panResponder.panHandlers : null);
        return () => {
            onPanHandlersChange?.(null);
        };
    }, [onPanHandlersChange, panResponder.panHandlers, state.isSessionEnabled]);
    const handleCopySelectedElement = useCallback(async () => {
        const selectedElement = state.selectedElement;
        if (!selectedElement) {
            return;
        }
        closeSelectedElementMenu();
        try {
            await copyViaMetro(selectedElement.description);
            showCopiedBadge();
        }
        catch {
            console.error("[react-native-grab] Copying failed. Ensure your Metro config is wrapped with withReactNativeGrab(...) and Metro has been restarted.");
        }
    }, [closeSelectedElementMenu, showCopiedBadge, state.selectedElement]);
    const handleOpenSelectedElement = useCallback(async () => {
        const frame = state.selectedElement?.frame;
        if (!frame?.file || frame.line == null) {
            return;
        }
        closeSelectedElementMenu();
        try {
            await openStackFrameInEditor({
                file: frame.file,
                lineNumber: frame.line,
            });
        }
        catch {
            console.error("[react-native-grab] Opening editor failed.");
        }
    }, [closeSelectedElementMenu, state.selectedElement]);
    const selectedElementMenuAnchor = useMemo(() => {
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
    return (_jsxs(View, { pointerEvents: "box-none", style: styles.overlayRoot, onLayout: (event) => {
            const { width, height } = event.nativeEvent.layout;
            setBounds((prev) => {
                if (prev.width === width && prev.height === height) {
                    return prev;
                }
                return { width, height };
            });
        }, children: [state.isSessionEnabled && !isCapturing && (_jsx(View, { pointerEvents: "none", style: styles.topBadge, children: _jsx(Text, { style: styles.topBadgeText, children: "Touch and move around to grab" }) })), state.isCopyBadgeVisible && !isCapturing && (_jsx(View, { pointerEvents: "none", style: styles.topBadge, children: _jsx(Text, { style: styles.topBadgeText, children: "Element copied" }) })), !isCapturing && !!highlightedElement && (_jsx(View, { pointerEvents: "none", style: [
                    styles.highlight,
                    {
                        left: highlightedElement.rect[0],
                        top: highlightedElement.rect[1],
                        width: highlightedElement.rect[2],
                        height: highlightedElement.rect[3],
                    },
                ] })), _jsxs(ContextMenu, { anchor: selectedElementMenuAnchor, bounds: bounds, cutout: state.selectedElement
                    ? {
                        x: state.selectedElement.result.rect[0],
                        y: state.selectedElement.result.rect[1],
                        width: state.selectedElement.result.rect[2],
                        height: state.selectedElement.result.rect[3],
                    }
                    : null, horizontalAlignment: "center", offset: { x: 0, y: 8 }, onClose: closeSelectedElementMenu, visible: state.selectedElement !== null, children: [_jsx(View, { style: styles.selectionMenuHeader, children: _jsx(Text, { adjustsFontSizeToFit: true, minimumFontScale: 0.65, numberOfLines: 1, style: styles.selectionMenuTitle, children: state.selectedElement?.elementName }) }), _jsxs(View, { style: styles.selectionMenuActions, children: [_jsx(Pressable, { accessibilityRole: "button", onPress: () => void handleCopySelectedElement(), style: ({ pressed }) => [
                                    styles.selectionMenuActionButton,
                                    pressed && styles.selectionMenuActionButtonPressed,
                                ], children: _jsx(Text, { style: styles.selectionMenuActionText, children: "Copy" }) }), _jsx(View, { style: styles.selectionMenuActionDivider }), _jsx(Pressable, { accessibilityRole: "button", disabled: !state.selectedElement?.frame?.file, onPress: () => void handleOpenSelectedElement(), style: ({ pressed }) => [
                                    styles.selectionMenuActionButton,
                                    pressed &&
                                        state.selectedElement?.frame?.file &&
                                        styles.selectionMenuActionButtonPressed,
                                ], children: _jsx(Text, { style: [
                                        styles.selectionMenuActionText,
                                        !state.selectedElement?.frame?.file && styles.selectionMenuActionTextDisabled,
                                    ], children: "Open" }) })] })] })] }));
};
const styles = StyleSheet.create({
    overlayRoot: {
        ...StyleSheet.absoluteFill,
        zIndex: 9999,
    },
    topBadge: {
        position: "absolute",
        top: 52,
        alignSelf: "center",
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: GRAB_BADGE_BACKGROUND,
    },
    topBadgeText: {
        color: "#FFFFFF",
        fontSize: 13,
        fontWeight: "600",
    },
    highlight: {
        position: "absolute",
        backgroundColor: GRAB_HIGHLIGHT_FILL,
        borderWidth: 1,
        borderColor: GRAB_PRIMARY,
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
        width: StyleSheet.hairlineWidth,
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