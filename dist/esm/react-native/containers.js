import { useSyncExternalStore } from "react";
import { findNodeHandle } from "react-native";
import { getFabricUIManager } from "./fabric";
let ownerIdCounter = 0;
let registrationOrder = 0;
let activationOrder = 0;
let focusedScreenOwnerId = null;
const owners = new Map();
const listeners = new Set();
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
const getOwnerShadowNode = (ref, errorMessage) => {
    // @ts-expect-error - findNodeHandle is not typed correctly
    const nativeTag = findNodeHandle(ref);
    if (!nativeTag) {
        throw new Error(errorMessage);
    }
    return getFabricUIManager().findShadowNodeByTag_DEPRECATED(nativeTag);
};
const ownerNativeTagErrorMessages = {
    root: "Failed to find native tag for app root",
    screen: "Failed to find native tag for screen",
    surface: "Failed to find native tag for native surface",
};
const getFallbackRootOwner = () => {
    const rootOwners = Array.from(owners.values()).filter((owner) => owner.kind === "root");
    rootOwners.sort((left, right) => right.registrationOrder - left.registrationOrder);
    return rootOwners[0] ?? null;
};
const getActiveSurfaceOwner = () => {
    let activeSurfaceOwner = null;
    let highestActivationOrder = -1;
    for (const owner of owners.values()) {
        const order = owner.kind === "surface" ? owner.activationOrder : null;
        if (order !== null && order > highestActivationOrder) {
            activeSurfaceOwner = owner;
            highestActivationOrder = order;
        }
    }
    return activeSurfaceOwner;
};
export const createGrabSelectionOwnerId = (kind) => {
    ownerIdCounter += 1;
    return `react-native-grab-${kind}-${ownerIdCounter}`;
};
export const registerGrabSelectionOwner = (id, kind, ref) => {
    const shadowNode = getOwnerShadowNode(ref, ownerNativeTagErrorMessages[kind]);
    registrationOrder += 1;
    owners.set(id, {
        id,
        kind,
        name: null,
        shadowNode,
        registrationOrder,
        activationOrder: null,
    });
    notify();
};
export const unregisterGrabSelectionOwner = (id) => {
    const removedOwner = owners.get(id);
    if (!removedOwner) {
        return;
    }
    owners.delete(id);
    if (focusedScreenOwnerId === id) {
        focusedScreenOwnerId = null;
    }
    notify();
};
export const setGrabSelectionOwnerFocused = (id, isFocused) => {
    const owner = owners.get(id);
    if (!owner || owner.kind !== "screen") {
        return;
    }
    if (isFocused) {
        focusedScreenOwnerId = id;
    }
    else if (focusedScreenOwnerId === id) {
        focusedScreenOwnerId = null;
    }
    notify();
};
export const setGrabSelectionOwnerName = (id, name) => {
    const owner = owners.get(id);
    if (!owner || owner.name === name) {
        return;
    }
    owners.set(id, { ...owner, name });
    notify();
};
export const getFocusedScreenName = () => {
    if (focusedScreenOwnerId === null) {
        return null;
    }
    return owners.get(focusedScreenOwnerId)?.name ?? null;
};
export const clearGrabSelectionOwnerFocus = (id) => {
    if (focusedScreenOwnerId !== id) {
        return;
    }
    focusedScreenOwnerId = null;
    notify();
};
export const setGrabSelectionOwnerActive = (id, isActive) => {
    const owner = owners.get(id);
    // Re-activating an already active surface deliberately keeps its original
    // activation order, so a redundant render cannot promote a surface above one
    // that was presented on top of it.
    if (!owner || owner.kind !== "surface" || (owner.activationOrder !== null) === isActive) {
        return;
    }
    if (isActive) {
        activationOrder += 1;
    }
    owners.set(id, {
        ...owner,
        activationOrder: isActive ? activationOrder : null,
    });
    notify();
};
export const getGrabSelectionOwner = (id) => {
    return owners.get(id) ?? null;
};
export const getResolvedGrabSelectionOwner = () => {
    const activeSurfaceOwner = getActiveSurfaceOwner();
    if (activeSurfaceOwner) {
        return activeSurfaceOwner;
    }
    if (focusedScreenOwnerId) {
        const focusedOwner = owners.get(focusedScreenOwnerId);
        if (focusedOwner) {
            return focusedOwner;
        }
    }
    return getFallbackRootOwner();
};
export const getResolvedGrabSelectionOwnerId = () => {
    return getResolvedGrabSelectionOwner()?.id ?? null;
};
export const useIsResolvedGrabSelectionOwner = (id) => {
    return useSyncExternalStore(subscribe, () => getResolvedGrabSelectionOwnerId() === id, () => false);
};
export const getActiveGrabSurfaceOwnerId = () => {
    return getActiveSurfaceOwner()?.id ?? null;
};
/**
 * True while any grab surface (an app-owned RN Modal subtree) is activated.
 * Hosting components use it to never present a second native Modal over the
 * app's presented one.
 */
export const useHasActiveGrabSurface = () => {
    return useSyncExternalStore(subscribe, () => getActiveSurfaceOwner() !== null, () => false);
};
export const useIsActiveGrabSurfaceOwner = (id) => {
    return useSyncExternalStore(subscribe, () => getActiveSurfaceOwner()?.id === id, () => false);
};
//# sourceMappingURL=containers.js.map