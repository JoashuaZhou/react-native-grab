import { GestureResponderHandlers, type StyleProp, type ViewStyle } from "react-native";
export type GrabControlBarProps = {
    dragHandlePanHandlers?: GestureResponderHandlers;
    isSessionEnabled: boolean;
    isVisible: boolean;
    onHidden?: () => void;
    onPressHide: () => void;
    onPressSelect: () => void;
    containerStyle?: StyleProp<ViewStyle>;
    style?: StyleProp<ViewStyle>;
};
export declare const GrabControlBar: ({ dragHandlePanHandlers, isSessionEnabled, isVisible, onHidden, onPressHide, onPressSelect, containerStyle, style, }: GrabControlBarProps) => import("react/jsx-runtime").JSX.Element | null;
//# sourceMappingURL=grab-control-bar.d.ts.map