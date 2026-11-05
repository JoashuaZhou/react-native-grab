import { type RefObject } from "react";
import { View, type ViewProps } from "react-native";
import { type GrabSelectionOwnerKind } from "./containers";
/** Root and screen owners always fill their parent; surfaces are sized by their host. */
export declare const grabSelectionOwnerFillStyle: {
    readonly flex: 1;
};
export declare const useGrabSelectionOwner: (kind: GrabSelectionOwnerKind, id?: string) => {
    ownerId: string;
    ownerRef: RefObject<View | null>;
};
type GrabSelectionOwnerViewProps = ViewProps & {
    ownerId: string;
    ownerRef: RefObject<View | null>;
};
export declare const GrabSelectionOwnerView: ({ children, ownerId, ownerRef, ...props }: GrabSelectionOwnerViewProps) => import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=grab-selection-owner.d.ts.map