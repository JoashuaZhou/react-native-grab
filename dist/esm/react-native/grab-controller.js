import { useSyncExternalStore } from "react";
import { getResolvedGrabSelectionOwnerId } from "./containers";
const localControllers = new Map();
const listeners = new Set();
let state = {
    isMenuVisible: false,
    selectedOwnerId: null,
    selectionSessionOwnerId: null,
};
const notify = () => {
    for (const listener of listeners) {
        listener();
    }
};
const subscribe = (listener) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};
const setState = (updater) => {
    state = typeof updater === "function" ? updater(state) : updater;
    notify();
};
const stopAllSelections = () => {
    for (const controller of localControllers.values()) {
        controller.stopSelection();
        controller.closeSelectionMenu();
    }
};
export const registerLocalGrabSelectionController = (ownerId, controller) => {
    localControllers.set(ownerId, controller);
};
export const unregisterLocalGrabSelectionController = (ownerId) => {
    localControllers.delete(ownerId);
    setState((prevState) => ({
        ...prevState,
        selectedOwnerId: prevState.selectedOwnerId === ownerId ? null : prevState.selectedOwnerId,
        selectionSessionOwnerId: prevState.selectionSessionOwnerId === ownerId ? null : prevState.selectionSessionOwnerId,
    }));
};
export const useGrabControllerState = () => {
    return useSyncExternalStore(subscribe, () => state, () => state);
};
export const setGrabSelectionSessionOwner = (ownerId) => {
    setState((prevState) => ({
        ...prevState,
        selectionSessionOwnerId: ownerId,
    }));
};
export const showGrabSelectionMenu = (ownerId) => {
    setState((prevState) => ({
        ...prevState,
        selectedOwnerId: ownerId,
        selectionSessionOwnerId: prevState.selectionSessionOwnerId === ownerId ? null : prevState.selectionSessionOwnerId,
    }));
};
export const hideGrabSelectionMenu = (ownerId) => {
    setState((prevState) => ({
        ...prevState,
        selectedOwnerId: prevState.selectedOwnerId === ownerId ? null : prevState.selectedOwnerId,
    }));
};
export const clearGrabOwnerPresentation = (ownerId) => {
    setState((prevState) => ({
        ...prevState,
        selectedOwnerId: prevState.selectedOwnerId === ownerId ? null : prevState.selectedOwnerId,
        selectionSessionOwnerId: prevState.selectionSessionOwnerId === ownerId ? null : prevState.selectionSessionOwnerId,
    }));
};
export const enableGrabbing = () => {
    const ownerId = getResolvedGrabSelectionOwnerId();
    if (!ownerId) {
        console.error("[react-native-grab] Cannot enable grabbing. Ensure ReactNativeGrabRoot is mounted.");
        return;
    }
    const controller = localControllers.get(ownerId);
    if (!controller) {
        console.error("[react-native-grab] Cannot enable grabbing. Ensure the focused ReactNativeGrabScreen is mounted.");
        return;
    }
    stopAllSelections();
    setState((prevState) => ({
        ...prevState,
        selectedOwnerId: null,
        selectionSessionOwnerId: ownerId,
    }));
    controller.startSelection();
};
export const toggleGrabMenu = () => {
    setState((prevState) => {
        const isVisible = !prevState.isMenuVisible;
        if (!isVisible) {
            stopAllSelections();
            return {
                isMenuVisible: false,
                selectedOwnerId: null,
                selectionSessionOwnerId: null,
            };
        }
        return {
            ...prevState,
            isMenuVisible: true,
        };
    });
};
//# sourceMappingURL=grab-controller.js.map