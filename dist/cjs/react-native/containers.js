"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useIsResolvedGrabSelectionOwner = exports.getResolvedGrabSelectionOwnerId = exports.getResolvedGrabSelectionOwner = exports.getGrabSelectionOwner = exports.setGrabSelectionOwnerActive = exports.clearGrabSelectionOwnerFocus = exports.getFocusedScreenName = exports.setGrabSelectionOwnerName = exports.setGrabSelectionOwnerFocused = exports.unregisterGrabSelectionOwner = exports.registerGrabSelectionOwner = exports.createGrabSelectionOwnerId = void 0;
const react_1 = require("react");
const react_native_1 = require("react-native");
const fabric_1 = require("./fabric");
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
    const nativeTag = (0, react_native_1.findNodeHandle)(ref);
    if (!nativeTag) {
        throw new Error(errorMessage);
    }
    return (0, fabric_1.getFabricUIManager)().findShadowNodeByTag_DEPRECATED(nativeTag);
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
const createGrabSelectionOwnerId = (kind) => {
    ownerIdCounter += 1;
    return `react-native-grab-${kind}-${ownerIdCounter}`;
};
exports.createGrabSelectionOwnerId = createGrabSelectionOwnerId;
const registerGrabSelectionOwner = (id, kind, ref) => {
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
exports.registerGrabSelectionOwner = registerGrabSelectionOwner;
const unregisterGrabSelectionOwner = (id) => {
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
exports.unregisterGrabSelectionOwner = unregisterGrabSelectionOwner;
const setGrabSelectionOwnerFocused = (id, isFocused) => {
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
exports.setGrabSelectionOwnerFocused = setGrabSelectionOwnerFocused;
const setGrabSelectionOwnerName = (id, name) => {
    const owner = owners.get(id);
    if (!owner || owner.name === name) {
        return;
    }
    owners.set(id, { ...owner, name });
    notify();
};
exports.setGrabSelectionOwnerName = setGrabSelectionOwnerName;
const getFocusedScreenName = () => {
    if (focusedScreenOwnerId === null) {
        return null;
    }
    return owners.get(focusedScreenOwnerId)?.name ?? null;
};
exports.getFocusedScreenName = getFocusedScreenName;
const clearGrabSelectionOwnerFocus = (id) => {
    if (focusedScreenOwnerId !== id) {
        return;
    }
    focusedScreenOwnerId = null;
    notify();
};
exports.clearGrabSelectionOwnerFocus = clearGrabSelectionOwnerFocus;
const setGrabSelectionOwnerActive = (id, isActive) => {
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
exports.setGrabSelectionOwnerActive = setGrabSelectionOwnerActive;
const getGrabSelectionOwner = (id) => {
    return owners.get(id) ?? null;
};
exports.getGrabSelectionOwner = getGrabSelectionOwner;
const getResolvedGrabSelectionOwner = () => {
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
exports.getResolvedGrabSelectionOwner = getResolvedGrabSelectionOwner;
const getResolvedGrabSelectionOwnerId = () => {
    return (0, exports.getResolvedGrabSelectionOwner)()?.id ?? null;
};
exports.getResolvedGrabSelectionOwnerId = getResolvedGrabSelectionOwnerId;
const useIsResolvedGrabSelectionOwner = (id) => {
    return (0, react_1.useSyncExternalStore)(subscribe, () => (0, exports.getResolvedGrabSelectionOwnerId)() === id, () => false);
};
exports.useIsResolvedGrabSelectionOwner = useIsResolvedGrabSelectionOwner;
//# sourceMappingURL=containers.js.map