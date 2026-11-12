import { jsx as _jsx } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Dimensions, PanResponder, PixelRatio, Platform, StyleSheet, View, } from "react-native";
import { initialWindowMetrics } from "react-native-safe-area-context";
import { getFocusedScreenName } from "./containers";
import { FullScreenOverlay } from "./full-screen-overlay";
import { enableGrabbing, toggleGrabMenu, useGrabControllerState } from "./grab-controller";
import { BAR_WIDTH, GrabControlBar } from "./grab-control-bar";
import { captureForReview } from "./review/capture";
import { reviewActions, useReviewState } from "./review/store";
import { awaitingCount } from "./review/view-model";
const BAR_HEIGHT = 36;
const BAR_TOP_INSET = 72 + (Platform.OS === "ios" ? (initialWindowMetrics?.insets.top ?? 0) : 0);
const clamp = (value, min, max) => {
    return Math.min(Math.max(value, min), max);
};
const getScreenInfo = () => ({
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height,
    scale: PixelRatio.get(),
});
const getInitialBarPosition = (bounds) => {
    return {
        x: clamp((bounds.width - BAR_WIDTH) / 2, 0, Math.max(0, bounds.width - BAR_WIDTH)),
        y: clamp(BAR_TOP_INSET, 0, Math.max(0, bounds.height - BAR_HEIGHT)),
    };
};
/**
 * Rendered by the owner that currently resolves selection, so the controls live in
 * the same native window as the content they act on. A natively presented surface
 * gets its own window, and no z-index inside the main window can paint over it -
 * on iOS `FullScreenOverlay` lifts the bar above every window, but Android has no
 * equivalent, which left the bar stranded behind presented sheets.
 *
 * The bar is placed against the measured size of its container rather than the
 * window's, since that container is a sheet rather than the whole screen whenever
 * a surface owns selection.
 */
export const GrabOwnerControls = () => {
    const state = useGrabControllerState();
    const reviewState = useReviewState();
    const controlBarPosition = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
    const boundsRef = useRef(null);
    const [hasBounds, setHasBounds] = useState(false);
    const shouldResetControlBarPositionRef = useRef(false);
    const isControlBarVisible = hasBounds &&
        state.isMenuVisible &&
        state.selectionSessionOwnerId === null &&
        state.selectedOwnerId === null;
    // Hiding the controls returns them to their initial spot the next time they are
    // shown; pausing them for a selection session deliberately does not.
    useEffect(() => {
        if (!state.isMenuVisible) {
            shouldResetControlBarPositionRef.current = true;
        }
    }, [state.isMenuVisible]);
    const clampControlBarToBounds = useCallback(() => {
        controlBarPosition.flattenOffset();
        controlBarPosition.stopAnimation((value) => {
            const bounds = boundsRef.current;
            if (!bounds) {
                return;
            }
            controlBarPosition.setValue({
                x: clamp(value.x, 0, Math.max(0, bounds.width - BAR_WIDTH)),
                y: clamp(value.y, 0, Math.max(0, bounds.height - BAR_HEIGHT)),
            });
        });
    }, [controlBarPosition]);
    const handleLayout = useCallback((event) => {
        const { width, height } = event.nativeEvent.layout;
        if (width <= 0 || height <= 0) {
            return;
        }
        const previousBounds = boundsRef.current;
        if (previousBounds?.width === width && previousBounds.height === height) {
            return;
        }
        boundsRef.current = { width, height };
        if (!previousBounds) {
            controlBarPosition.setValue(getInitialBarPosition(boundsRef.current));
            setHasBounds(true);
            return;
        }
        clampControlBarToBounds();
    }, [clampControlBarToBounds, controlBarPosition]);
    const resetControlBarPosition = useCallback(() => {
        const bounds = boundsRef.current;
        if (!shouldResetControlBarPositionRef.current || !bounds) {
            return;
        }
        shouldResetControlBarPositionRef.current = false;
        controlBarPosition.setValue(getInitialBarPosition(bounds));
    }, [controlBarPosition]);
    const dragHandlePanResponder = useRef(PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2,
        onPanResponderGrant: () => {
            controlBarPosition.stopAnimation((value) => {
                controlBarPosition.setOffset(value);
                controlBarPosition.setValue({ x: 0, y: 0 });
            });
        },
        onPanResponderMove: Animated.event([null, { dx: controlBarPosition.x, dy: controlBarPosition.y }], { useNativeDriver: false }),
        onPanResponderRelease: () => clampControlBarToBounds(),
        onPanResponderTerminate: () => clampControlBarToBounds(),
    })).current;
    const containerStyle = useMemo(() => [
        styles.controlBar,
        {
            transform: controlBarPosition.getTranslateTransform(),
        },
    ], [controlBarPosition]);
    const startPageReview = useCallback(async () => {
        const screenshot = await captureForReview();
        reviewActions.openComposer({
            mode: "create",
            draft: {
                kind: "page",
                description: "",
                rect: null,
                screen: getScreenInfo(),
                route: getFocusedScreenName(),
                grab: null,
            },
            screenshot,
        });
    }, []);
    const awaiting = awaitingCount(reviewState.items);
    const listBadgeText = !reviewState.paired ? "!" : awaiting > 0 ? String(awaiting) : null;
    // The bar leaves the output completely while a screenshot is being taken, or
    // while a review surface covers the screen, so captures stay clean.
    if (state.isCapturing || reviewState.listVisible || reviewState.composer !== null) {
        return null;
    }
    return (
    // The anchor is absolutely positioned so that mounting the controls alongside
    // an owner cannot disturb the surrounding layout: that parent is free to be a
    // `gap`-spaced flex container, and absolutely positioned children are not flex
    // items.
    _jsx(View, { pointerEvents: "box-none", style: styles.overlayAnchor, children: _jsx(FullScreenOverlay, { children: _jsx(View, { pointerEvents: "box-none", style: styles.overlayRoot, onLayout: handleLayout, children: _jsx(GrabControlBar, { containerStyle: containerStyle, dragHandlePanHandlers: dragHandlePanResponder.panHandlers, isSessionEnabled: state.selectionSessionOwnerId !== null, isVisible: isControlBarVisible, listBadgeText: listBadgeText, onHidden: resetControlBarPosition, onPressHide: toggleGrabMenu, onPressList: reviewActions.openList, onPressPage: startPageReview, onPressSelect: enableGrabbing }) }) }) }));
};
const styles = StyleSheet.create({
    overlayAnchor: {
        ...StyleSheet.absoluteFill,
        zIndex: 9999,
    },
    overlayRoot: {
        ...StyleSheet.absoluteFill,
        zIndex: 9999,
    },
    controlBar: {
        position: "absolute",
        top: 0,
        left: 0,
        zIndex: 2,
    },
});
//# sourceMappingURL=grab-controls.js.map