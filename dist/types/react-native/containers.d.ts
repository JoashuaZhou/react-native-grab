import { type ReactNativeElement } from "react-native";
import type { ReactNativeShadowNode } from "./types";
export type GrabSelectionOwnerKind = "root" | "screen" | "surface";
export type GrabSelectionOwner = {
    id: string;
    kind: GrabSelectionOwnerKind;
    shadowNode: ReactNativeShadowNode;
    registrationOrder: number;
    activationOrder: number | null;
};
export declare const createGrabSelectionOwnerId: (kind: GrabSelectionOwnerKind) => string;
export declare const registerGrabSelectionOwner: (id: string, kind: GrabSelectionOwnerKind, ref: ReactNativeElement) => void;
export declare const unregisterGrabSelectionOwner: (id: string) => void;
export declare const setGrabSelectionOwnerFocused: (id: string, isFocused: boolean) => void;
export declare const clearGrabSelectionOwnerFocus: (id: string) => void;
export declare const setGrabSelectionOwnerActive: (id: string, isActive: boolean) => void;
export declare const getGrabSelectionOwner: (id: string) => GrabSelectionOwner | null;
export declare const getResolvedGrabSelectionOwner: () => GrabSelectionOwner | null;
export declare const getResolvedGrabSelectionOwnerId: () => string | null;
export declare const useIsResolvedGrabSelectionOwner: (id: string) => boolean;
//# sourceMappingURL=containers.d.ts.map