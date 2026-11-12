import { GestureResponderHandlers, type StyleProp, type ViewStyle } from "react-native";
export declare const BAR_WIDTH = 180;
export type GrabControlBarProps = {
    dragHandlePanHandlers?: GestureResponderHandlers;
    isSessionEnabled: boolean;
    isVisible: boolean;
    listBadgeText: string | null;
    onHidden?: () => void;
    onPressHide: () => void;
    onPressList: () => void;
    onPressPage: () => void;
    onPressSelect: () => void;
    containerStyle?: StyleProp<ViewStyle>;
    style?: StyleProp<ViewStyle>;
};
export declare const GrabControlBar: ({ dragHandlePanHandlers, isSessionEnabled, isVisible, listBadgeText, onHidden, onPressHide, onPressList, onPressPage, onPressSelect, containerStyle, style, }: GrabControlBarProps) => import("react/jsx-runtime").JSX.Element | null;
//# sourceMappingURL=grab-control-bar.d.ts.map