import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DeviceItemView } from "../../../review-core/types";
import type { ComposerState, ReviewStoreState } from "../store";

type ElementLike = {
  type: unknown;
  props: Record<string, unknown>;
};

const runtime = vi.hoisted(() => ({
  reviewState: null as unknown as ReviewStoreState,
  closeComposerCalls: 0,
  activeSurfaceOwnerId: null as string | null,
  resolvedOwnerId: null as string | null,
  grabState: {
    isMenuVisible: true,
    isCapturing: false,
    selectionSessionOwnerId: null,
    selectedOwnerId: null,
  },
  useStateImpl: null as null | ((initial: unknown) => [unknown, (update: unknown) => void]),
}));

vi.mock("react", () => ({
  useEffect: () => {},
  useCallback: (callback: unknown) => callback,
  useMemo: (factory: () => unknown) => factory(),
  useRef: (value: unknown) => ({ current: value }),
  useState: (initial: unknown) => {
    const impl = runtime.useStateImpl;
    if (impl === null) {
      const resolved = typeof initial === "function" ? (initial as () => unknown)() : initial;
      return [resolved, () => {}];
    }
    return impl(initial);
  },
  useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown) => getSnapshot(),
}));

vi.mock("react-native", () => ({
  Alert: { alert: () => {} },
  Animated: {
    ValueXY: class {
      setOffset() {}
      setValue() {}
      stopAnimation(callback?: (value: { x: number; y: number }) => void) {
        callback?.({ x: 0, y: 0 });
      }
      flattenOffset() {}
      getTranslateTransform() {
        return [{ translateX: 0 }, { translateY: 0 }];
      }
    },
    event: () => () => {},
  },
  Dimensions: { get: () => ({ width: 402, height: 874 }) },
  Image: "Image",
  KeyboardAvoidingView: "KeyboardAvoidingView",
  Linking: { openURL: async () => {} },
  Modal: "Modal",
  NativeModules: {
    SourceCode: { getConstants: () => ({ scriptURL: "http://localhost:8081/index.bundle" }) },
  },
  PanResponder: { create: () => ({ panHandlers: {} }) },
  PixelRatio: { get: () => 2 },
  Platform: { OS: "ios" },
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  StyleSheet: {
    absoluteFill: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
    hairlineWidth: 1,
    create: (styles: unknown) => styles,
  },
  Text: "Text",
  TextInput: "TextInput",
  View: "View",
}));

vi.mock("react-native-safe-area-context", () => ({
  initialWindowMetrics: null,
}));

vi.mock("../../containers", () => ({
  getFocusedScreenName: () => null,
  useIsActiveGrabSurfaceOwner: (id: string) => runtime.activeSurfaceOwnerId === id,
  useHasActiveGrabSurface: () => runtime.activeSurfaceOwnerId !== null,
  useIsResolvedGrabSelectionOwner: (id: string) => runtime.resolvedOwnerId === id,
}));

vi.mock("../../grab-controller", () => ({
  enableGrabbing: () => {},
  toggleGrabMenu: () => {},
  useGrabControllerState: () => runtime.grabState,
}));

vi.mock("../../grab-control-bar", () => ({
  BAR_WIDTH: 180,
  GrabControlBar: "GrabControlBar",
}));

vi.mock("../../grab-overlay", () => ({
  ReactNativeGrabOverlay: "Overlay",
}));

vi.mock("../../full-screen-overlay", () => ({
  FullScreenOverlay: "FullScreenOverlay",
}));

vi.mock("../capture", () => ({
  captureForReview: async () => null,
}));

vi.mock("../store", () => ({
  PAIRING_CODE_STORAGE_KEY: "rnGrabReview.pairingCode",
  reviewActions: {
    closeComposer: () => {
      runtime.closeComposerCalls += 1;
    },
    openComposer: () => {},
    openList: () => {},
    saveComposer: async () => false,
  },
  useReviewState: () => runtime.reviewState,
}));

import { ComposerSheet, ReviewComposer, SurfaceComposerSlot } from "../composer";
import { ReviewListPanel } from "../list-panel";
import { GrabOwnerControls } from "../../grab-controls";
import { GrabSelectionOwnerView } from "../../grab-selection-owner";

const asElement = (value: unknown): ElementLike => value as ElementLike;

const firstMatch = (
  value: unknown,
  predicate: (element: ElementLike) => boolean,
): ElementLike | null => {
  if (Array.isArray(value)) {
    for (const child of value) {
      const found = firstMatch(child, predicate);
      if (found !== null) {
        return found;
      }
    }
    return null;
  }
  if (value === null || typeof value !== "object") {
    return null;
  }
  const element = asElement(value);
  if (element.props === undefined) {
    return null;
  }
  if (predicate(element)) {
    return element;
  }
  return element.props.children === undefined
    ? null
    : firstMatch(element.props.children, predicate);
};

const childrenOf = (element: ElementLike): unknown[] => {
  const children = element.props.children;
  if (children === undefined) {
    return [];
  }
  return Array.isArray(children) ? children : [children];
};

const countSheetMounts = (value: unknown): number => {
  if (Array.isArray(value)) {
    return value.reduce((total, child) => total + countSheetMounts(child), 0);
  }
  if (value === null || typeof value !== "object") {
    return 0;
  }
  const element = asElement(value);
  if (element.props === undefined) {
    return 0;
  }
  if (element.type === ComposerSheet) {
    return 1;
  }
  // Mounting a host renders it; the sheet counts once its host rendered it.
  if (element.type === SurfaceComposerSlot) {
    return countSheetMounts(renderElement(element));
  }
  return countSheetMounts(element.props.children);
};

const totalMountedSheets = (sites: unknown[]): number =>
  sites.reduce((total: number, site) => total + countSheetMounts(site), 0);

/**
 * Calls a function component whose hooks run on a tiny in-file useState
 * harness: state persists across re-renders, a setter during render triggers
 * one more pass, mirroring React's "reset state during render" semantics.
 */
const renderElement = (element: ElementLike): ElementLike | null => {
  const store: unknown[] = [];
  let slotCursor = 0;
  let dirty = false;

  runtime.useStateImpl = (initial: unknown) => {
    const index = slotCursor;
    slotCursor += 1;
    if (index === store.length) {
      store.push(typeof initial === "function" ? (initial as () => unknown)() : initial);
    }
    const setState = (update: unknown) => {
      const nextState =
        typeof update === "function"
          ? (update as (previous: unknown) => unknown)(store[index])
          : update;
      if (!Object.is(nextState, store[index])) {
        store[index] = nextState;
        dirty = true;
      }
    };
    return [store[index], setState];
  };

  try {
    let output: ElementLike | null = null;
    for (let pass = 0; pass < 8; pass += 1) {
      dirty = false;
      slotCursor = 0;
      output = asElement((element.type as (props: unknown) => unknown)(element.props));
      if (!dirty) {
        return output;
      }
    }
    throw new Error("test render did not stabilize");
  } finally {
    runtime.useStateImpl = null;
  }
};

const composeElement = (type: unknown, props: Record<string, unknown> = {}): ElementLike =>
  asElement({ type, props });

const rootOutput = (): ElementLike | null => renderElement(composeElement(ReviewComposer));

const listOutput = (): ElementLike | null => renderElement(composeElement(ReviewListPanel));

const ownerOutput = (ownerId: string): ElementLike | null =>
  renderElement(composeElement(GrabSelectionOwnerView, { ownerId, ownerRef: { current: null } }));

const slotOutput = (): ElementLike | null => renderElement(composeElement(SurfaceComposerSlot));

const requiredSheet = (element: ElementLike | null): ElementLike => {
  expect(element).not.toBeNull();
  const sheet = firstMatch(element, (candidate) => candidate.type === ComposerSheet);
  expect(sheet).not.toBeNull();
  return renderElement(sheet as ElementLike) as ElementLike;
};

const rootSheet = (): ElementLike => {
  const root = rootOutput();
  expect(root).not.toBeNull();
  const modal = asElement(root);
  expect(modal.type).toBe("Modal");
  expect(modal.props.visible).toBe(true);
  return requiredSheet(modal);
};

const surfaceSheet = (): ElementLike => {
  const slot = slotOutput();
  expect(slot).not.toBeNull();
  const overlay = asElement(slot);
  const overlayStyle = overlay.props.style as Record<string, unknown>;
  expect(overlayStyle.position).toBe("absolute");
  expect(overlayStyle.zIndex).toBe(9999);
  return requiredSheet(overlay);
};

const sheetTitle = (sheet: ElementLike): string => {
  const sheetView = firstMatch(sheet, (element) =>
    Array.isArray(element.props.children) && element.props.children.length > 0
      ? Object.is(element.type, "View") &&
        (element.props.children as unknown[]).some((child) => asElement(child).type === "Text")
      : false,
  );
  expect(sheetView).not.toBeNull();
  const title = firstMatch(
    sheetView,
    (element) => element.type === "Text" && typeof element.props.children === "string",
  );
  expect(title).not.toBeNull();
  return title!.props.children as string;
};

const typeInto = (sheet: ElementLike, placeholder: string, text: string): void => {
  const input = firstMatch(
    sheet,
    (element) => element.type === "TextInput" && element.props.placeholder === placeholder,
  );
  expect(input).not.toBeNull();
  (input!.props.onChangeText as (text: string) => void)(text);
};

const inputValue = (sheet: ElementLike, placeholder: string): unknown => {
  const input = firstMatch(
    sheet,
    (element) => element.type === "TextInput" && element.props.placeholder === placeholder,
  );
  expect(input).not.toBeNull();
  return input!.props.value;
};

const itemView = (overrides: Partial<DeviceItemView> = {}): DeviceItemView => ({
  no: 1,
  kind: "element",
  status: "draft",
  scope: "local",
  figmaUrl: null,
  rounds: [],
  screenshotUrl: null,
  rect: null,
  screen: null,
  route: null,
  device: null,
  revertCommit: null,
  lastError: null,
  createdAt: "2026-11-11T08:00:00.000Z",
  actions: [],
  ...overrides,
});

const createComposer = (kind: "element" | "page"): ComposerState => ({
  mode: "create",
  draft: {
    kind,
    description: "",
    rect: null,
    screen: { width: 402, height: 874, scale: 2 },
    route: "Home",
    grab: null,
  },
  screenshot: null,
});

const baseState = (): ReviewStoreState => ({
  paired: true,
  stalePairing: false,
  review: {
    id: "20261111-080000",
    base: "main",
    branch: "fix/design-review-20261111-0800",
    status: "active",
    mrUrl: null,
  },
  items: [],
  runner: { busy: false, blocked: false },
  listVisible: false,
  composer: null,
  error: null,
});

beforeEach(() => {
  runtime.closeComposerCalls = 0;
  runtime.activeSurfaceOwnerId = null;
  runtime.resolvedOwnerId = null;
  runtime.grabState = {
    isMenuVisible: true,
    isCapturing: false,
    selectionSessionOwnerId: null,
    selectedOwnerId: null,
  };
  runtime.reviewState = baseState();
});

describe("composer host partition", () => {
  it("keeps exactly one sheet mounted at the root while nothing else is open", () => {
    const composer = createComposer("element");
    runtime.reviewState = { ...baseState(), composer };

    const root = rootOutput();
    expect(asElement(root).props.visible).toBe(true);

    expect(
      totalMountedSheets([root, listOutput(), ownerOutput("surface-1"), ownerOutput("surface-2")]),
    ).toBe(1);
  });

  it("hosts the sheet on the active surface owner instead of the root", () => {
    const composer = createComposer("element");
    runtime.reviewState = { ...baseState(), composer };
    runtime.activeSurfaceOwnerId = "surface-1";
    runtime.resolvedOwnerId = "surface-1";

    expect(rootOutput()).toBeNull();
    expect(countSheetMounts(ownerOutput("surface-1"))).toBe(1);
    expect(countSheetMounts(ownerOutput("surface-2"))).toBe(0);
    expect(listOutput()).not.toBeNull();
    expect(countSheetMounts(listOutput())).toBe(0);

    expect(
      totalMountedSheets([
        rootOutput(),
        listOutput(),
        ownerOutput("surface-1"),
        ownerOutput("surface-2"),
      ]),
    ).toBe(1);
  });

  it("keeps the list as the only host even while a surface stays active", () => {
    const composer: ComposerState = { mode: "edit", item: itemView() };
    runtime.reviewState = { ...baseState(), listVisible: true, composer };
    runtime.activeSurfaceOwnerId = "surface-1";
    runtime.resolvedOwnerId = "surface-1";

    expect(rootOutput()).toBeNull();
    expect(countSheetMounts(ownerOutput("surface-1"))).toBe(0);
    expect(countSheetMounts(listOutput())).toBe(1);

    expect(totalMountedSheets([rootOutput(), ownerOutput("surface-1"), listOutput()])).toBe(1);
  });

  it("falls back to the root exactly once when the active surface deactivates", () => {
    const composer = createComposer("element");
    runtime.reviewState = { ...baseState(), composer };
    runtime.activeSurfaceOwnerId = "surface-1";
    runtime.resolvedOwnerId = "surface-1";
    expect(rootOutput()).toBeNull();

    runtime.activeSurfaceOwnerId = null;
    runtime.resolvedOwnerId = null;
    const root = rootOutput();
    expect(asElement(root).props.visible).toBe(true);
    expect(countSheetMounts(ownerOutput("surface-1"))).toBe(0);
    expect(totalMountedSheets([root, listOutput(), ownerOutput("surface-1")])).toBe(1);
  });

  it("keeps the root modal closed without a composer, with or without a surface", () => {
    const root = rootOutput();
    expect(asElement(root).props.visible).toBe(false);
    expect(countSheetMounts(root)).toBe(0);

    runtime.activeSurfaceOwnerId = "surface-1";
    expect(rootOutput()).toBeNull();
  });
});

describe("surface composer slot", () => {
  it("reuses the shared sheet for create, edit and reject composers", () => {
    const composer = createComposer("element");
    runtime.reviewState = { ...baseState(), composer };
    expect(sheetTitle(surfaceSheet())).toBe("走查控件");

    const pageComposer = createComposer("page");
    runtime.reviewState = { ...baseState(), composer: pageComposer };
    expect(sheetTitle(surfaceSheet())).toBe("走查整页");

    const editComposer: ComposerState = { mode: "edit", item: itemView() };
    runtime.reviewState = { ...baseState(), composer: editComposer };
    expect(sheetTitle(surfaceSheet())).toBe("修改草稿");

    const rejectComposer: ComposerState = { mode: "reject", item: itemView() };
    runtime.reviewState = { ...baseState(), composer: rejectComposer };
    expect(sheetTitle(surfaceSheet())).toBe("打回并补充");
  });

  it("mounts nothing while the list is visible or the composer is closed", () => {
    const composer = createComposer("element");
    runtime.reviewState = { ...baseState(), listVisible: true, composer };
    expect(slotOutput()).toBeNull();

    runtime.reviewState = { ...baseState(), composer: null };
    expect(slotOutput()).toBeNull();
  });
});

describe("draft preserved across host moves", () => {
  it("keeps the typed description when the active surface deactivates mid-edit", () => {
    const composer = createComposer("element");
    runtime.reviewState = { ...baseState(), composer };
    runtime.activeSurfaceOwnerId = "surface-1";
    runtime.resolvedOwnerId = "surface-1";
    typeInto(surfaceSheet(), "描述（必填）", "按钮间距过大");

    runtime.activeSurfaceOwnerId = null;
    runtime.resolvedOwnerId = null;
    expect(inputValue(rootSheet(), "描述（必填）")).toBe("按钮间距过大");
  });

  it("keeps a typed reject supplement when the sheet moves to the root", () => {
    const composer: ComposerState = { mode: "reject", item: itemView() };
    runtime.reviewState = { ...baseState(), composer };
    runtime.activeSurfaceOwnerId = "surface-1";
    runtime.resolvedOwnerId = "surface-1";
    typeInto(surfaceSheet(), "补充说明（必填）", "复现步骤缺失");

    runtime.activeSurfaceOwnerId = null;
    runtime.resolvedOwnerId = null;
    expect(inputValue(rootSheet(), "补充说明（必填）")).toBe("复现步骤缺失");
  });

  it("starts fresh when a later composer reuses the sheet host", () => {
    const composer = createComposer("element");
    runtime.reviewState = { ...baseState(), composer };
    runtime.activeSurfaceOwnerId = "surface-1";
    runtime.resolvedOwnerId = "surface-1";
    typeInto(surfaceSheet(), "描述（必填）", "旧文案");
    runtime.activeSurfaceOwnerId = null;
    runtime.resolvedOwnerId = null;

    const nextComposer = createComposer("page");
    runtime.reviewState = { ...baseState(), composer: nextComposer };
    expect(inputValue(rootSheet(), "描述（必填）")).toBe("");
  });
});

describe("cancel and control restoration", () => {
  it("closes the surface-hosted sheet from the backdrop tap", () => {
    const composer = createComposer("element");
    runtime.reviewState = { ...baseState(), composer };
    runtime.activeSurfaceOwnerId = "surface-1";
    runtime.resolvedOwnerId = "surface-1";
    const sheet = surfaceSheet();
    const backdrop = firstMatch(
      sheet,
      (element) => element.type === "Pressable" && element.props.style !== undefined,
    );
    expect(backdrop).not.toBeNull();
    (backdrop!.props.onPress as () => void)();

    expect(runtime.closeComposerCalls).toBe(1);
  });

  it("closes the surface-hosted sheet from the cancel button", () => {
    const composer = createComposer("element");
    runtime.reviewState = { ...baseState(), composer };
    runtime.activeSurfaceOwnerId = "surface-1";
    runtime.resolvedOwnerId = "surface-1";
    const sheet = surfaceSheet();
    const cancelButton = firstMatch(sheet, (element) => {
      if (element.type !== "Pressable") {
        return false;
      }
      const first = childrenOf(element)[0];
      return (
        typeof first === "object" &&
        first !== null &&
        asElement(first).props !== undefined &&
        Object.is(asElement(first).type, "Text") &&
        asElement(first).props.children === "取消"
      );
    });
    expect(cancelButton).not.toBeNull();
    (cancelButton!.props.onPress as () => void)();

    expect(runtime.closeComposerCalls).toBe(1);
  });

  it("permits the controls again once the composer is cancelled", () => {
    const composer = createComposer("element");
    runtime.reviewState = { ...baseState(), composer };
    runtime.activeSurfaceOwnerId = "surface-1";
    runtime.resolvedOwnerId = "surface-1";
    expect(GrabOwnerControls()).toBeNull();

    runtime.reviewState = { ...baseState(), composer: null };
    expect(countSheetMounts(slotOutput())).toBe(0);
    const controls = GrabOwnerControls();
    expect(controls).not.toBeNull();
    expect(asElement(controls).type).toBe("View");
  });

  it("keeps the controls hidden during a capture, exactly as before", () => {
    runtime.reviewState = { ...baseState(), composer: null };
    runtime.grabState = { ...runtime.grabState, isCapturing: true };
    expect(GrabOwnerControls()).toBeNull();

    runtime.grabState = { ...runtime.grabState, isCapturing: false };
    expect(GrabOwnerControls()).not.toBeNull();
  });
});
