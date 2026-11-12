import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNativeElement } from "react-native";

vi.mock("react-native", () => ({
  findNodeHandle: (ref: { nativeTag: number }) => ref.nativeTag,
}));

vi.mock("../fabric", () => ({
  getFabricUIManager: () => ({
    findShadowNodeByTag_DEPRECATED: (nativeTag: number) => ({ nativeTag }),
  }),
}));

import {
  clearGrabSelectionOwnerFocus,
  getFocusedScreenName,
  getResolvedGrabSelectionOwnerId,
  registerGrabSelectionOwner,
  setGrabSelectionOwnerActive,
  setGrabSelectionOwnerFocused,
  setGrabSelectionOwnerName,
  unregisterGrabSelectionOwner,
} from "../containers";

const registeredOwnerIds: string[] = [];

const registerOwner = (id: string, kind: "root" | "screen" | "surface", nativeTag: number) => {
  registeredOwnerIds.push(id);
  registerGrabSelectionOwner(id, kind, { nativeTag } as unknown as ReactNativeElement);
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

describe("getFocusedScreenName", () => {
  it("follows focus changes between two named screens", () => {
    registerOwner("root", "root", 1);
    registerOwner("home", "screen", 2);
    registerOwner("settings", "screen", 3);
    setGrabSelectionOwnerName("home", "Home");
    setGrabSelectionOwnerName("settings", "Settings");

    expect(getFocusedScreenName()).toBeNull();

    setGrabSelectionOwnerFocused("home", true);
    expect(getFocusedScreenName()).toBe("Home");

    setGrabSelectionOwnerFocused("settings", true);
    expect(getFocusedScreenName()).toBe("Settings");

    setGrabSelectionOwnerFocused("settings", false);
    expect(getFocusedScreenName()).toBeNull();

    setGrabSelectionOwnerFocused("home", true);
    unregisterGrabSelectionOwner("home");
    expect(getFocusedScreenName()).toBeNull();
  });

  it("returns null for a focused screen without a name", () => {
    registerOwner("root", "root", 1);
    registerOwner("anonymous", "screen", 2);
    setGrabSelectionOwnerFocused("anonymous", true);

    expect(getFocusedScreenName()).toBeNull();
  });
});
