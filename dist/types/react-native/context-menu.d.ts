import { type ReactNode } from "react";
export type ContextMenuAnchor = {
    x: number;
    y: number;
};
export type ContextMenuCutout = {
    x: number;
    y: number;
    width: number;
    height: number;
};
export type ContextMenuBounds = {
    width: number;
    height: number;
};
export type ContextMenuHorizontalAlignment = "left" | "center" | "right";
export type ContextMenuVerticalAlignment = "top" | "center" | "bottom";
export type ContextMenuOffset = {
    x: number;
    y: number;
};
export type ContextMenuProps = {
    anchor: ContextMenuAnchor | null;
    bounds?: ContextMenuBounds | null;
    children?: ReactNode;
    cutout?: ContextMenuCutout | null;
    horizontalAlignment?: ContextMenuHorizontalAlignment;
    offset?: ContextMenuOffset;
    onClose: () => void;
    verticalAlignment?: ContextMenuVerticalAlignment;
    visible: boolean;
};
export type ContextMenuItemProps = {
    children: ReactNode;
    destructive?: boolean;
    disabled?: boolean;
    onPress: () => void;
};
export declare const ContextMenu: {
    ({ anchor, bounds, children, cutout, horizontalAlignment, offset, onClose, verticalAlignment, visible, }: ContextMenuProps): import("react/jsx-runtime").JSX.Element | null;
    Item: ({ children, destructive, disabled, onPress, }: ContextMenuItemProps) => import("react/jsx-runtime").JSX.Element;
};
//# sourceMappingURL=context-menu.d.ts.map