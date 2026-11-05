type LocalGrabSelectionController = {
    closeSelectionMenu: () => void;
    startSelection: () => void;
    stopSelection: () => void;
};
type GrabControllerState = {
    isMenuVisible: boolean;
    selectedOwnerId: string | null;
    selectionSessionOwnerId: string | null;
};
export declare const registerLocalGrabSelectionController: (ownerId: string, controller: LocalGrabSelectionController) => void;
export declare const unregisterLocalGrabSelectionController: (ownerId: string) => void;
export declare const useGrabControllerState: () => GrabControllerState;
export declare const setGrabSelectionSessionOwner: (ownerId: string | null) => void;
export declare const showGrabSelectionMenu: (ownerId: string) => void;
export declare const hideGrabSelectionMenu: (ownerId: string) => void;
export declare const clearGrabOwnerPresentation: (ownerId: string) => void;
export declare const enableGrabbing: () => void;
export declare const toggleGrabMenu: () => void;
export {};
//# sourceMappingURL=grab-controller.d.ts.map