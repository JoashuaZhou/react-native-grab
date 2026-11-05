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
//# sourceMappingURL=selection-owners.test.js.map