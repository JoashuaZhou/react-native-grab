"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
vitest_1.vi.mock("react-native", () => ({
    findNodeHandle: (ref) => ref.nativeTag,
}));
vitest_1.vi.mock("../fabric", () => ({
    getFabricUIManager: () => ({
        findShadowNodeByTag_DEPRECATED: (nativeTag) => ({ nativeTag }),
    }),
}));
const containers_1 = require("../containers");
const registeredOwnerIds = [];
const registerOwner = (id, kind, nativeTag) => {
    registeredOwnerIds.push(id);
    (0, containers_1.registerGrabSelectionOwner)(id, kind, { nativeTag });
};
(0, vitest_1.afterEach)(() => {
    for (const id of registeredOwnerIds.splice(0)) {
        (0, containers_1.unregisterGrabSelectionOwner)(id);
    }
});
(0, vitest_1.describe)("grab selection owner resolution", () => {
    (0, vitest_1.it)("prefers the most recently activated surface and restores previous owners", () => {
        registerOwner("root", "root", 1);
        registerOwner("screen", "screen", 2);
        (0, containers_1.setGrabSelectionOwnerFocused)("screen", true);
        registerOwner("first-sheet", "surface", 3);
        registerOwner("second-sheet", "surface", 4);
        (0, vitest_1.expect)((0, containers_1.getResolvedGrabSelectionOwnerId)()).toBe("screen");
        (0, containers_1.setGrabSelectionOwnerActive)("first-sheet", true);
        (0, vitest_1.expect)((0, containers_1.getResolvedGrabSelectionOwnerId)()).toBe("first-sheet");
        (0, containers_1.setGrabSelectionOwnerActive)("second-sheet", true);
        (0, vitest_1.expect)((0, containers_1.getResolvedGrabSelectionOwnerId)()).toBe("second-sheet");
        (0, containers_1.setGrabSelectionOwnerActive)("second-sheet", false);
        (0, vitest_1.expect)((0, containers_1.getResolvedGrabSelectionOwnerId)()).toBe("first-sheet");
        (0, containers_1.setGrabSelectionOwnerActive)("second-sheet", true);
        (0, vitest_1.expect)((0, containers_1.getResolvedGrabSelectionOwnerId)()).toBe("second-sheet");
        (0, containers_1.unregisterGrabSelectionOwner)("second-sheet");
        (0, vitest_1.expect)((0, containers_1.getResolvedGrabSelectionOwnerId)()).toBe("first-sheet");
        (0, containers_1.setGrabSelectionOwnerActive)("first-sheet", false);
        (0, vitest_1.expect)((0, containers_1.getResolvedGrabSelectionOwnerId)()).toBe("screen");
        (0, containers_1.clearGrabSelectionOwnerFocus)("screen");
        (0, vitest_1.expect)((0, containers_1.getResolvedGrabSelectionOwnerId)()).toBe("root");
    });
    (0, vitest_1.it)("ignores activation for owners that are not surfaces", () => {
        registerOwner("root", "root", 1);
        registerOwner("screen", "screen", 2);
        (0, containers_1.setGrabSelectionOwnerActive)("screen", true);
        (0, containers_1.setGrabSelectionOwnerActive)("root", true);
        (0, vitest_1.expect)((0, containers_1.getResolvedGrabSelectionOwnerId)()).toBe("root");
    });
    (0, vitest_1.it)("falls back to the focused screen when the only active surface unmounts", () => {
        registerOwner("root", "root", 1);
        registerOwner("screen", "screen", 2);
        (0, containers_1.setGrabSelectionOwnerFocused)("screen", true);
        registerOwner("sheet", "surface", 3);
        (0, containers_1.setGrabSelectionOwnerActive)("sheet", true);
        (0, vitest_1.expect)((0, containers_1.getResolvedGrabSelectionOwnerId)()).toBe("sheet");
        (0, containers_1.unregisterGrabSelectionOwner)("sheet");
        (0, vitest_1.expect)((0, containers_1.getResolvedGrabSelectionOwnerId)()).toBe("screen");
        // A stale activation for the unmounted surface must not resurrect it.
        (0, containers_1.setGrabSelectionOwnerActive)("sheet", true);
        (0, vitest_1.expect)((0, containers_1.getResolvedGrabSelectionOwnerId)()).toBe("screen");
    });
});
(0, vitest_1.describe)("active grab surface host", () => {
    (0, vitest_1.it)("tracks the topmost activated surface for shared sheet hosting", () => {
        registerOwner("root", "root", 1);
        registerOwner("bottom-sheet", "surface", 2);
        registerOwner("top-sheet", "surface", 3);
        (0, vitest_1.expect)((0, containers_1.getActiveGrabSurfaceOwnerId)()).toBeNull();
        (0, containers_1.setGrabSelectionOwnerActive)("bottom-sheet", true);
        (0, vitest_1.expect)((0, containers_1.getActiveGrabSurfaceOwnerId)()).toBe("bottom-sheet");
        (0, containers_1.setGrabSelectionOwnerActive)("top-sheet", true);
        (0, vitest_1.expect)((0, containers_1.getActiveGrabSurfaceOwnerId)()).toBe("top-sheet");
        // Deactivating the top surface hands hosting back to the one beneath.
        (0, containers_1.setGrabSelectionOwnerActive)("top-sheet", false);
        (0, vitest_1.expect)((0, containers_1.getActiveGrabSurfaceOwnerId)()).toBe("bottom-sheet");
        (0, containers_1.unregisterGrabSelectionOwner)("bottom-sheet");
        (0, vitest_1.expect)((0, containers_1.getActiveGrabSurfaceOwnerId)()).toBeNull();
    });
    (0, vitest_1.it)("never lets a stale activation resurrect an unmounted surface as host", () => {
        registerOwner("root", "root", 1);
        registerOwner("sheet", "surface", 2);
        (0, containers_1.setGrabSelectionOwnerActive)("sheet", true);
        (0, vitest_1.expect)((0, containers_1.getActiveGrabSurfaceOwnerId)()).toBe("sheet");
        (0, containers_1.unregisterGrabSelectionOwner)("sheet");
        (0, containers_1.setGrabSelectionOwnerActive)("sheet", true);
        (0, vitest_1.expect)((0, containers_1.getActiveGrabSurfaceOwnerId)()).toBeNull();
    });
    (0, vitest_1.it)("ignores activation attempts for owners that are not surfaces", () => {
        registerOwner("root", "root", 1);
        registerOwner("screen", "screen", 2);
        (0, containers_1.setGrabSelectionOwnerActive)("screen", true);
        (0, containers_1.setGrabSelectionOwnerActive)("root", true);
        (0, vitest_1.expect)((0, containers_1.getActiveGrabSurfaceOwnerId)()).toBeNull();
    });
});
(0, vitest_1.describe)("getFocusedScreenName", () => {
    (0, vitest_1.it)("follows focus changes between two named screens", () => {
        registerOwner("root", "root", 1);
        registerOwner("home", "screen", 2);
        registerOwner("settings", "screen", 3);
        (0, containers_1.setGrabSelectionOwnerName)("home", "Home");
        (0, containers_1.setGrabSelectionOwnerName)("settings", "Settings");
        (0, vitest_1.expect)((0, containers_1.getFocusedScreenName)()).toBeNull();
        (0, containers_1.setGrabSelectionOwnerFocused)("home", true);
        (0, vitest_1.expect)((0, containers_1.getFocusedScreenName)()).toBe("Home");
        (0, containers_1.setGrabSelectionOwnerFocused)("settings", true);
        (0, vitest_1.expect)((0, containers_1.getFocusedScreenName)()).toBe("Settings");
        (0, containers_1.setGrabSelectionOwnerFocused)("settings", false);
        (0, vitest_1.expect)((0, containers_1.getFocusedScreenName)()).toBeNull();
        (0, containers_1.setGrabSelectionOwnerFocused)("home", true);
        (0, containers_1.unregisterGrabSelectionOwner)("home");
        (0, vitest_1.expect)((0, containers_1.getFocusedScreenName)()).toBeNull();
    });
    (0, vitest_1.it)("returns null for a focused screen without a name", () => {
        registerOwner("root", "root", 1);
        registerOwner("anonymous", "screen", 2);
        (0, containers_1.setGrabSelectionOwnerFocused)("anonymous", true);
        (0, vitest_1.expect)((0, containers_1.getFocusedScreenName)()).toBeNull();
    });
});
//# sourceMappingURL=selection-owners.test.js.map