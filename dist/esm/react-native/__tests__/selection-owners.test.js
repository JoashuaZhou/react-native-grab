import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("react-native", () => ({
    findNodeHandle: (ref) => ref.nativeTag,
}));
vi.mock("../fabric", () => ({
    getFabricUIManager: () => ({
        findShadowNodeByTag_DEPRECATED: (nativeTag) => ({ nativeTag }),
    }),
}));
import { clearGrabSelectionOwnerFocus, getResolvedGrabSelectionOwnerId, registerGrabSelectionOwner, setGrabSelectionOwnerActive, setGrabSelectionOwnerFocused, unregisterGrabSelectionOwner, } from "../containers";
const registeredOwnerIds = [];
const registerOwner = (id, kind, nativeTag) => {
    registeredOwnerIds.push(id);
    registerGrabSelectionOwner(id, kind, { nativeTag });
};
afterEach(() => {
    for (const id of registeredOwnerIds.splice(0)) {
        unregisterGrabSelectionOwner(id);
    }
});
describe("grab selection owner resolution", () => {
    it("prefers the most recently activated surface and restores previous owners", () => {
        registerOwner("root", "root", 1);
        registerOwner("screen", "screen", 2);
        setGrabSelectionOwnerFocused("screen", true);
        registerOwner("first-sheet", "surface", 3);
        registerOwner("second-sheet", "surface", 4);
        expect(getResolvedGrabSelectionOwnerId()).toBe("screen");
        setGrabSelectionOwnerActive("first-sheet", true);
        expect(getResolvedGrabSelectionOwnerId()).toBe("first-sheet");
        setGrabSelectionOwnerActive("second-sheet", true);
        expect(getResolvedGrabSelectionOwnerId()).toBe("second-sheet");
        setGrabSelectionOwnerActive("second-sheet", false);
        expect(getResolvedGrabSelectionOwnerId()).toBe("first-sheet");
        setGrabSelectionOwnerActive("second-sheet", true);
        expect(getResolvedGrabSelectionOwnerId()).toBe("second-sheet");
        unregisterGrabSelectionOwner("second-sheet");
        expect(getResolvedGrabSelectionOwnerId()).toBe("first-sheet");
        setGrabSelectionOwnerActive("first-sheet", false);
        expect(getResolvedGrabSelectionOwnerId()).toBe("screen");
        clearGrabSelectionOwnerFocus("screen");
        expect(getResolvedGrabSelectionOwnerId()).toBe("root");
    });
    it("ignores activation for owners that are not surfaces", () => {
        registerOwner("root", "root", 1);
        registerOwner("screen", "screen", 2);
        setGrabSelectionOwnerActive("screen", true);
        setGrabSelectionOwnerActive("root", true);
        expect(getResolvedGrabSelectionOwnerId()).toBe("root");
    });
    it("falls back to the focused screen when the only active surface unmounts", () => {
        registerOwner("root", "root", 1);
        registerOwner("screen", "screen", 2);
        setGrabSelectionOwnerFocused("screen", true);
        registerOwner("sheet", "surface", 3);
        setGrabSelectionOwnerActive("sheet", true);
        expect(getResolvedGrabSelectionOwnerId()).toBe("sheet");
        unregisterGrabSelectionOwner("sheet");
        expect(getResolvedGrabSelectionOwnerId()).toBe("screen");
        // A stale activation for the unmounted surface must not resurrect it.
        setGrabSelectionOwnerActive("sheet", true);
        expect(getResolvedGrabSelectionOwnerId()).toBe("screen");
    });
});
//# sourceMappingURL=selection-owners.test.js.map