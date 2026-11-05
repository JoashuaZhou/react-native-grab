"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GrabOwnerControls = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const react_native_1 = require("react-native");
const react_native_safe_area_context_1 = require("react-native-safe-area-context");
const full_screen_overlay_1 = require("./full-screen-overlay");
const grab_controller_1 = require("./grab-controller");
const grab_control_bar_1 = require("./grab-control-bar");
const BAR_HEIGHT = 36;
const BAR_WIDTH = 108;
const BAR_TOP_INSET = 72 + (react_native_1.Platform.OS === "ios" ? (react_native_safe_area_context_1.initialWindowMetrics?.insets.top ?? 0) : 0);
const clamp = (value, min, max) => {
    return Math.min(Math.max(value, min), max);
};
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
const GrabOwnerControls = () => {
    const state = (0, grab_controller_1.useGrabControllerState)();
    const controlBarPosition = (0, react_1.useRef)(new react_native_1.Animated.ValueXY({ x: 0, y: 0 })).current;
    const boundsRef = (0, react_1.useRef)(null);
    const [hasBounds, setHasBounds] = (0, react_1.useState)(false);
    const shouldResetControlBarPositionRef = (0, react_1.useRef)(false);
    const isControlBarVisible = hasBounds &&
        state.isMenuVisible &&
        state.selectionSessionOwnerId === null &&
        state.selectedOwnerId === null;
    // Hiding the controls returns them to their initial spot the next time they are
    // shown; pausing them for a selection session deliberately does not.
    (0, react_1.useEffect)(() => {
        if (!state.isMenuVisible) {
            shouldResetControlBarPositionRef.current = true;
        }
    }, [state.isMenuVisible]);
    const clampControlBarToBounds = (0, react_1.useCallback)(() => {
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
    const handleLayout = (0, react_1.useCallback)((event) => {
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
    const resetControlBarPosition = (0, react_1.useCallback)(() => {
        const bounds = boundsRef.current;
        if (!shouldResetControlBarPositionRef.current || !bounds) {
            return;
        }
        shouldResetControlBarPositionRef.current = false;
        controlBarPosition.setValue(getInitialBarPosition(bounds));
    }, [controlBarPosition]);
    const dragHandlePanResponder = (0, react_1.useRef)(react_native_1.PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2,
        onPanResponderGrant: () => {
            controlBarPosition.stopAnimation((value) => {
                controlBarPosition.setOffset(value);
                controlBarPosition.setValue({ x: 0, y: 0 });
            });
        },
        onPanResponderMove: react_native_1.Animated.event([null, { dx: controlBarPosition.x, dy: controlBarPosition.y }], { useNativeDriver: false }),
        onPanResponderRelease: () => clampControlBarToBounds(),
        onPanResponderTerminate: () => clampControlBarToBounds(),
    })).current;
    const containerStyle = (0, react_1.useMemo)(() => [
        styles.controlBar,
        {
            transform: controlBarPosition.getTranslateTransform(),
        },
    ], [controlBarPosition]);
    return (
    // The anchor is absolutely positioned so that mounting the controls alongside
    // an owner cannot disturb the surrounding layout: that parent is free to be a
    // `gap`-spaced flex container, and absolutely positioned children are not flex
    // items.
    (0, jsx_runtime_1.jsx)(react_native_1.View, { pointerEvents: "box-none", style: styles.overlayAnchor, children: (0, jsx_runtime_1.jsx)(full_screen_overlay_1.FullScreenOverlay, { children: (0, jsx_runtime_1.jsx)(react_native_1.View, { pointerEvents: "box-none", style: styles.overlayRoot, onLayout: handleLayout, children: (0, jsx_runtime_1.jsx)(grab_control_bar_1.GrabControlBar, { containerStyle: containerStyle, dragHandlePanHandlers: dragHandlePanResponder.panHandlers, isSessionEnabled: state.selectionSessionOwnerId !== null, isVisible: isControlBarVisible, onHidden: resetControlBarPosition, onPressHide: grab_controller_1.toggleGrabMenu, onPressSelect: grab_controller_1.enableGrabbing }) }) }) }));
};
exports.GrabOwnerControls = GrabOwnerControls;
const styles = react_native_1.StyleSheet.create({
    overlayAnchor: {
        ...react_native_1.StyleSheet.absoluteFill,
        zIndex: 9999,
    },
    overlayRoot: {
        ...react_native_1.StyleSheet.absoluteFill,
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