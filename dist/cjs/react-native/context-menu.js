"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextMenu = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const react_native_1 = require("react-native");
const SCREEN_EDGE_MARGIN = 8;
const ContextMenuContext = (0, react_1.createContext)(null);
const getAlignedLeft = (anchorX, menuWidth, horizontalAlignment) => {
    switch (horizontalAlignment) {
        case "left":
            return anchorX;
        case "right":
            return anchorX - menuWidth;
        case "center":
        default:
            return anchorX - menuWidth / 2;
    }
};
const getAlignedTop = (anchorY, menuHeight, verticalAlignment) => {
    switch (verticalAlignment) {
        case "center":
            return anchorY - menuHeight / 2;
        case "bottom":
            return anchorY - menuHeight;
        case "top":
        default:
            return anchorY;
    }
};
const getMenuPosition = (anchor, menuWidth, menuHeight, horizontalAlignment, verticalAlignment, offset, bounds) => {
    const { width: screenWidth, height: screenHeight } = bounds ?? react_native_1.Dimensions.get("window");
    const preferredLeft = getAlignedLeft(anchor.x, menuWidth, horizontalAlignment) + offset.x;
    const preferredTop = getAlignedTop(anchor.y, menuHeight, verticalAlignment) + offset.y;
    return {
        left: Math.min(Math.max(SCREEN_EDGE_MARGIN, preferredLeft), screenWidth - menuWidth - SCREEN_EDGE_MARGIN),
        top: Math.min(Math.max(SCREEN_EDGE_MARGIN, preferredTop), screenHeight - menuHeight - SCREEN_EDGE_MARGIN),
    };
};
const ContextMenuItem = ({ children, destructive = false, disabled = false, onPress, }) => {
    const context = (0, react_1.useContext)(ContextMenuContext);
    if (!context) {
        throw new Error("ContextMenu.Item must be rendered inside ContextMenu.");
    }
    return ((0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityRole: "menuitem", disabled: disabled, onPress: () => {
            context.onClose();
            onPress();
        }, style: ({ pressed }) => [
            styles.item,
            pressed && !disabled && styles.itemPressed,
            disabled && styles.itemDisabled,
        ], children: (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [styles.itemText, destructive && styles.destructiveText], children: children }) }));
};
const ContextMenu = ({ anchor, bounds = null, children, cutout = null, horizontalAlignment = "center", offset = { x: 0, y: 10 }, onClose, verticalAlignment = "top", visible, }) => {
    const [isRendered, setIsRendered] = (0, react_1.useState)(visible);
    const [menuSize, setMenuSize] = (0, react_1.useState)({ width: 0, height: 0 });
    const [renderedAnchor, setRenderedAnchor] = (0, react_1.useState)(anchor);
    const animation = (0, react_1.useRef)(new react_native_1.Animated.Value(visible ? 1 : 0)).current;
    (0, react_1.useEffect)(() => {
        if (visible) {
            setIsRendered(true);
        }
        if (anchor) {
            setRenderedAnchor(anchor);
        }
        react_native_1.Animated.timing(animation, {
            toValue: visible ? 1 : 0,
            duration: visible ? 180 : 140,
            easing: visible ? react_native_1.Easing.out(react_native_1.Easing.cubic) : react_native_1.Easing.in(react_native_1.Easing.cubic),
            useNativeDriver: true,
        }).start(({ finished }) => {
            if (finished && !visible) {
                setIsRendered(false);
                setRenderedAnchor(null);
            }
        });
    }, [anchor, animation, visible]);
    const handleLayout = (event) => {
        const { width, height } = event.nativeEvent.layout;
        if (width === menuSize.width && height === menuSize.height) {
            return;
        }
        setMenuSize({ width, height });
    };
    const position = (0, react_1.useMemo)(() => {
        if (!renderedAnchor) {
            return { left: SCREEN_EDGE_MARGIN, top: SCREEN_EDGE_MARGIN };
        }
        return getMenuPosition(renderedAnchor, menuSize.width, menuSize.height, horizontalAlignment, verticalAlignment, offset, bounds);
    }, [
        bounds,
        horizontalAlignment,
        menuSize.height,
        menuSize.width,
        offset,
        renderedAnchor,
        verticalAlignment,
    ]);
    const renderedItems = (0, react_1.useMemo)(() => react_1.Children.toArray(children).filter((child) => (0, react_1.isValidElement)(child)), [children]);
    const dismissalRegions = (0, react_1.useMemo)(() => {
        const { width: screenWidth, height: screenHeight } = bounds ?? react_native_1.Dimensions.get("window");
        if (!cutout) {
            return [
                {
                    key: "full",
                    style: react_native_1.StyleSheet.absoluteFill,
                },
            ];
        }
        const left = Math.max(0, cutout.x);
        const top = Math.max(0, cutout.y);
        const right = Math.min(screenWidth, cutout.x + cutout.width);
        const bottom = Math.min(screenHeight, cutout.y + cutout.height);
        return [
            {
                key: "top",
                style: {
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: top,
                },
            },
            {
                key: "left",
                style: {
                    position: "absolute",
                    top,
                    left: 0,
                    width: left,
                    height: Math.max(0, bottom - top),
                },
            },
            {
                key: "right",
                style: {
                    position: "absolute",
                    top,
                    left: right,
                    right: 0,
                    height: Math.max(0, bottom - top),
                },
            },
            {
                key: "bottom",
                style: {
                    position: "absolute",
                    top: bottom,
                    left: 0,
                    right: 0,
                    bottom: 0,
                },
            },
        ];
    }, [bounds, cutout]);
    if (!isRendered || !renderedAnchor || renderedItems.length === 0) {
        return null;
    }
    return ((0, jsx_runtime_1.jsxs)(react_native_1.View, { pointerEvents: "box-none", style: styles.overlay, children: [dismissalRegions.map((region) => ((0, jsx_runtime_1.jsx)(react_native_1.Pressable, { accessibilityLabel: "Close context menu", onPress: onClose, style: region.style }, `pressable-${region.key}`))), (0, jsx_runtime_1.jsx)(ContextMenuContext.Provider, { value: { onClose }, children: (0, jsx_runtime_1.jsx)(react_native_1.Animated.View, { onLayout: handleLayout, style: [
                        styles.menu,
                        position,
                        {
                            opacity: animation,
                            transform: [
                                {
                                    translateY: animation.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [-10, 0],
                                    }),
                                },
                                {
                                    scale: animation.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [0.94, 1],
                                    }),
                                },
                            ],
                        },
                    ], children: (0, jsx_runtime_1.jsx)(react_native_1.View, { style: styles.menuContent, children: renderedItems.map((child, index) => ((0, jsx_runtime_1.jsx)(react_native_1.View, { style: index > 0 ? styles.itemBorder : undefined, children: child }, index))) }) }) })] }));
};
exports.ContextMenu = ContextMenu;
exports.ContextMenu.Item = ContextMenuItem;
const styles = react_native_1.StyleSheet.create({
    overlay: {
        ...react_native_1.StyleSheet.absoluteFill,
        zIndex: 10,
        elevation: 10,
    },
    menu: {
        position: "absolute",
        zIndex: 11,
        minWidth: 176,
        borderRadius: 14,
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.16,
        shadowRadius: 24,
        elevation: 10,
    },
    menuContent: {
        borderRadius: 14,
        backgroundColor: "#FFFFFF",
        overflow: "hidden",
    },
    item: {
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    itemBorder: {
        borderTopWidth: react_native_1.StyleSheet.hairlineWidth,
        borderTopColor: "rgba(17, 17, 17, 0.12)",
    },
    itemPressed: {
        backgroundColor: "rgba(17, 17, 17, 0.06)",
    },
    itemDisabled: {
        opacity: 0.5,
    },
    itemText: {
        color: "#111111",
        fontSize: 14,
        fontWeight: "500",
    },
    destructiveText: {
        color: "#C43D2F",
    },
});
//# sourceMappingURL=context-menu.js.map