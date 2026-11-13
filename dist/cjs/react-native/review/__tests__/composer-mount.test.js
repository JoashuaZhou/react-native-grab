"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const runtime = vitest_1.vi.hoisted(() => ({
    reviewState: null,
    closeComposerCalls: 0,
    activeSurfaceOwnerId: null,
    resolvedOwnerId: null,
    grabState: {
        isMenuVisible: true,
        isCapturing: false,
        selectionSessionOwnerId: null,
        selectedOwnerId: null,
    },
    useStateImpl: null,
}));
vitest_1.vi.mock("react", () => ({
    useEffect: () => { },
    useCallback: (callback) => callback,
    useMemo: (factory) => factory(),
    useRef: (value) => ({ current: value }),
    useState: (initial) => {
        const impl = runtime.useStateImpl;
        if (impl === null) {
            const resolved = typeof initial === "function" ? initial() : initial;
            return [resolved, () => { }];
        }
        return impl(initial);
    },
    useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
}));
vitest_1.vi.mock("react-native", () => ({
    Alert: { alert: () => { } },
    Animated: {
        ValueXY: class {
            setOffset() { }
            setValue() { }
            stopAnimation(callback) {
                callback?.({ x: 0, y: 0 });
            }
            flattenOffset() { }
            getTranslateTransform() {
                return [{ translateX: 0 }, { translateY: 0 }];
            }
        },
        event: () => () => { },
    },
    Dimensions: { get: () => ({ width: 402, height: 874 }) },
    Image: "Image",
    KeyboardAvoidingView: "KeyboardAvoidingView",
    Linking: { openURL: async () => { } },
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
        create: (styles) => styles,
    },
    Text: "Text",
    TextInput: "TextInput",
    View: "View",
}));
vitest_1.vi.mock("react-native-safe-area-context", () => ({
    initialWindowMetrics: null,
}));
vitest_1.vi.mock("../../containers", () => ({
    getFocusedScreenName: () => null,
    useIsActiveGrabSurfaceOwner: (id) => runtime.activeSurfaceOwnerId === id,
    useHasActiveGrabSurface: () => runtime.activeSurfaceOwnerId !== null,
    useIsResolvedGrabSelectionOwner: (id) => runtime.resolvedOwnerId === id,
}));
vitest_1.vi.mock("../../grab-controller", () => ({
    enableGrabbing: () => { },
    toggleGrabMenu: () => { },
    useGrabControllerState: () => runtime.grabState,
}));
vitest_1.vi.mock("../../grab-control-bar", () => ({
    BAR_WIDTH: 180,
    GrabControlBar: "GrabControlBar",
}));
vitest_1.vi.mock("../../grab-overlay", () => ({
    ReactNativeGrabOverlay: "Overlay",
}));
vitest_1.vi.mock("../../full-screen-overlay", () => ({
    FullScreenOverlay: "FullScreenOverlay",
}));
vitest_1.vi.mock("../capture", () => ({
    captureForReview: async () => null,
}));
vitest_1.vi.mock("../store", () => ({
    PAIRING_CODE_STORAGE_KEY: "rnGrabReview.pairingCode",
    reviewActions: {
        closeComposer: () => {
            runtime.closeComposerCalls += 1;
        },
        openComposer: () => { },
        openList: () => { },
        saveComposer: async () => false,
    },
    useReviewState: () => runtime.reviewState,
}));
const composer_1 = require("../composer");
const list_panel_1 = require("../list-panel");
const grab_controls_1 = require("../../grab-controls");
const grab_selection_owner_1 = require("../../grab-selection-owner");
const asElement = (value) => value;
const firstMatch = (value, predicate) => {
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
const childrenOf = (element) => {
    const children = element.props.children;
    if (children === undefined) {
        return [];
    }
    return Array.isArray(children) ? children : [children];
};
const countSheetMounts = (value) => {
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
    if (element.type === composer_1.ComposerSheet) {
        return 1;
    }
    // Mounting a host renders it; the sheet counts once its host rendered it.
    if (element.type === composer_1.SurfaceComposerSlot) {
        return countSheetMounts(renderElement(element));
    }
    return countSheetMounts(element.props.children);
};
const totalMountedSheets = (sites) => sites.reduce((total, site) => total + countSheetMounts(site), 0);
/**
 * Calls a function component whose hooks run on a tiny in-file useState
 * harness: state persists across re-renders, a setter during render triggers
 * one more pass, mirroring React's "reset state during render" semantics.
 */
const renderElement = (element) => {
    const store = [];
    let slotCursor = 0;
    let dirty = false;
    runtime.useStateImpl = (initial) => {
        const index = slotCursor;
        slotCursor += 1;
        if (index === store.length) {
            store.push(typeof initial === "function" ? initial() : initial);
        }
        const setState = (update) => {
            const nextState = typeof update === "function"
                ? update(store[index])
                : update;
            if (!Object.is(nextState, store[index])) {
                store[index] = nextState;
                dirty = true;
            }
        };
        return [store[index], setState];
    };
    try {
        let output = null;
        for (let pass = 0; pass < 8; pass += 1) {
            dirty = false;
            slotCursor = 0;
            output = asElement(element.type(element.props));
            if (!dirty) {
                return output;
            }
        }
        throw new Error("test render did not stabilize");
    }
    finally {
        runtime.useStateImpl = null;
    }
};
const composeElement = (type, props = {}) => asElement({ type, props });
const rootOutput = () => renderElement(composeElement(composer_1.ReviewComposer));
const listOutput = () => renderElement(composeElement(list_panel_1.ReviewListPanel));
const ownerOutput = (ownerId) => renderElement(composeElement(grab_selection_owner_1.GrabSelectionOwnerView, { ownerId, ownerRef: { current: null } }));
const slotOutput = () => renderElement(composeElement(composer_1.SurfaceComposerSlot));
const requiredSheet = (element) => {
    (0, vitest_1.expect)(element).not.toBeNull();
    const sheet = firstMatch(element, (candidate) => candidate.type === composer_1.ComposerSheet);
    (0, vitest_1.expect)(sheet).not.toBeNull();
    return renderElement(sheet);
};
const rootSheet = () => {
    const root = rootOutput();
    (0, vitest_1.expect)(root).not.toBeNull();
    const modal = asElement(root);
    (0, vitest_1.expect)(modal.type).toBe("Modal");
    (0, vitest_1.expect)(modal.props.visible).toBe(true);
    return requiredSheet(modal);
};
const surfaceSheet = () => {
    const slot = slotOutput();
    (0, vitest_1.expect)(slot).not.toBeNull();
    const overlay = asElement(slot);
    const overlayStyle = overlay.props.style;
    (0, vitest_1.expect)(overlayStyle.position).toBe("absolute");
    (0, vitest_1.expect)(overlayStyle.zIndex).toBe(9999);
    return requiredSheet(overlay);
};
const sheetTitle = (sheet) => {
    const sheetView = firstMatch(sheet, (element) => Array.isArray(element.props.children) && element.props.children.length > 0
        ? Object.is(element.type, "View") &&
            element.props.children.some((child) => asElement(child).type === "Text")
        : false);
    (0, vitest_1.expect)(sheetView).not.toBeNull();
    const title = firstMatch(sheetView, (element) => element.type === "Text" && typeof element.props.children === "string");
    (0, vitest_1.expect)(title).not.toBeNull();
    return title.props.children;
};
const typeInto = (sheet, placeholder, text) => {
    const input = firstMatch(sheet, (element) => element.type === "TextInput" && element.props.placeholder === placeholder);
    (0, vitest_1.expect)(input).not.toBeNull();
    input.props.onChangeText(text);
};
const inputValue = (sheet, placeholder) => {
    const input = firstMatch(sheet, (element) => element.type === "TextInput" && element.props.placeholder === placeholder);
    (0, vitest_1.expect)(input).not.toBeNull();
    return input.props.value;
};
const itemView = (overrides = {}) => ({
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
const createComposer = (kind) => ({
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
const baseState = () => ({
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
(0, vitest_1.beforeEach)(() => {
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
(0, vitest_1.describe)("composer host partition", () => {
    (0, vitest_1.it)("keeps exactly one sheet mounted at the root while nothing else is open", () => {
        const composer = createComposer("element");
        runtime.reviewState = { ...baseState(), composer };
        const root = rootOutput();
        (0, vitest_1.expect)(asElement(root).props.visible).toBe(true);
        (0, vitest_1.expect)(totalMountedSheets([root, listOutput(), ownerOutput("surface-1"), ownerOutput("surface-2")])).toBe(1);
    });
    (0, vitest_1.it)("hosts the sheet on the active surface owner instead of the root", () => {
        const composer = createComposer("element");
        runtime.reviewState = { ...baseState(), composer };
        runtime.activeSurfaceOwnerId = "surface-1";
        runtime.resolvedOwnerId = "surface-1";
        (0, vitest_1.expect)(rootOutput()).toBeNull();
        (0, vitest_1.expect)(countSheetMounts(ownerOutput("surface-1"))).toBe(1);
        (0, vitest_1.expect)(countSheetMounts(ownerOutput("surface-2"))).toBe(0);
        (0, vitest_1.expect)(listOutput()).not.toBeNull();
        (0, vitest_1.expect)(countSheetMounts(listOutput())).toBe(0);
        (0, vitest_1.expect)(totalMountedSheets([
            rootOutput(),
            listOutput(),
            ownerOutput("surface-1"),
            ownerOutput("surface-2"),
        ])).toBe(1);
    });
    (0, vitest_1.it)("keeps the list as the only host even while a surface stays active", () => {
        const composer = { mode: "edit", item: itemView() };
        runtime.reviewState = { ...baseState(), listVisible: true, composer };
        runtime.activeSurfaceOwnerId = "surface-1";
        runtime.resolvedOwnerId = "surface-1";
        (0, vitest_1.expect)(rootOutput()).toBeNull();
        (0, vitest_1.expect)(countSheetMounts(ownerOutput("surface-1"))).toBe(0);
        (0, vitest_1.expect)(countSheetMounts(listOutput())).toBe(1);
        (0, vitest_1.expect)(totalMountedSheets([rootOutput(), ownerOutput("surface-1"), listOutput()])).toBe(1);
    });
    (0, vitest_1.it)("falls back to the root exactly once when the active surface deactivates", () => {
        const composer = createComposer("element");
        runtime.reviewState = { ...baseState(), composer };
        runtime.activeSurfaceOwnerId = "surface-1";
        runtime.resolvedOwnerId = "surface-1";
        (0, vitest_1.expect)(rootOutput()).toBeNull();
        runtime.activeSurfaceOwnerId = null;
        runtime.resolvedOwnerId = null;
        const root = rootOutput();
        (0, vitest_1.expect)(asElement(root).props.visible).toBe(true);
        (0, vitest_1.expect)(countSheetMounts(ownerOutput("surface-1"))).toBe(0);
        (0, vitest_1.expect)(totalMountedSheets([root, listOutput(), ownerOutput("surface-1")])).toBe(1);
    });
    (0, vitest_1.it)("keeps the root modal closed without a composer, with or without a surface", () => {
        const root = rootOutput();
        (0, vitest_1.expect)(asElement(root).props.visible).toBe(false);
        (0, vitest_1.expect)(countSheetMounts(root)).toBe(0);
        runtime.activeSurfaceOwnerId = "surface-1";
        (0, vitest_1.expect)(rootOutput()).toBeNull();
    });
});
(0, vitest_1.describe)("surface composer slot", () => {
    (0, vitest_1.it)("reuses the shared sheet for create, edit and reject composers", () => {
        const composer = createComposer("element");
        runtime.reviewState = { ...baseState(), composer };
        (0, vitest_1.expect)(sheetTitle(surfaceSheet())).toBe("走查控件");
        const pageComposer = createComposer("page");
        runtime.reviewState = { ...baseState(), composer: pageComposer };
        (0, vitest_1.expect)(sheetTitle(surfaceSheet())).toBe("走查整页");
        const editComposer = { mode: "edit", item: itemView() };
        runtime.reviewState = { ...baseState(), composer: editComposer };
        (0, vitest_1.expect)(sheetTitle(surfaceSheet())).toBe("修改草稿");
        const rejectComposer = { mode: "reject", item: itemView() };
        runtime.reviewState = { ...baseState(), composer: rejectComposer };
        (0, vitest_1.expect)(sheetTitle(surfaceSheet())).toBe("打回并补充");
    });
    (0, vitest_1.it)("mounts nothing while the list is visible or the composer is closed", () => {
        const composer = createComposer("element");
        runtime.reviewState = { ...baseState(), listVisible: true, composer };
        (0, vitest_1.expect)(slotOutput()).toBeNull();
        runtime.reviewState = { ...baseState(), composer: null };
        (0, vitest_1.expect)(slotOutput()).toBeNull();
    });
});
(0, vitest_1.describe)("draft preserved across host moves", () => {
    (0, vitest_1.it)("keeps the typed description when the active surface deactivates mid-edit", () => {
        const composer = createComposer("element");
        runtime.reviewState = { ...baseState(), composer };
        runtime.activeSurfaceOwnerId = "surface-1";
        runtime.resolvedOwnerId = "surface-1";
        typeInto(surfaceSheet(), "描述（必填）", "按钮间距过大");
        runtime.activeSurfaceOwnerId = null;
        runtime.resolvedOwnerId = null;
        (0, vitest_1.expect)(inputValue(rootSheet(), "描述（必填）")).toBe("按钮间距过大");
    });
    (0, vitest_1.it)("keeps a typed reject supplement when the sheet moves to the root", () => {
        const composer = { mode: "reject", item: itemView() };
        runtime.reviewState = { ...baseState(), composer };
        runtime.activeSurfaceOwnerId = "surface-1";
        runtime.resolvedOwnerId = "surface-1";
        typeInto(surfaceSheet(), "补充说明（必填）", "复现步骤缺失");
        runtime.activeSurfaceOwnerId = null;
        runtime.resolvedOwnerId = null;
        (0, vitest_1.expect)(inputValue(rootSheet(), "补充说明（必填）")).toBe("复现步骤缺失");
    });
    (0, vitest_1.it)("starts fresh when a later composer reuses the sheet host", () => {
        const composer = createComposer("element");
        runtime.reviewState = { ...baseState(), composer };
        runtime.activeSurfaceOwnerId = "surface-1";
        runtime.resolvedOwnerId = "surface-1";
        typeInto(surfaceSheet(), "描述（必填）", "旧文案");
        runtime.activeSurfaceOwnerId = null;
        runtime.resolvedOwnerId = null;
        const nextComposer = createComposer("page");
        runtime.reviewState = { ...baseState(), composer: nextComposer };
        (0, vitest_1.expect)(inputValue(rootSheet(), "描述（必填）")).toBe("");
    });
});
(0, vitest_1.describe)("cancel and control restoration", () => {
    (0, vitest_1.it)("closes the surface-hosted sheet from the backdrop tap", () => {
        const composer = createComposer("element");
        runtime.reviewState = { ...baseState(), composer };
        runtime.activeSurfaceOwnerId = "surface-1";
        runtime.resolvedOwnerId = "surface-1";
        const sheet = surfaceSheet();
        const backdrop = firstMatch(sheet, (element) => element.type === "Pressable" && element.props.style !== undefined);
        (0, vitest_1.expect)(backdrop).not.toBeNull();
        backdrop.props.onPress();
        (0, vitest_1.expect)(runtime.closeComposerCalls).toBe(1);
    });
    (0, vitest_1.it)("closes the surface-hosted sheet from the cancel button", () => {
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
            return (typeof first === "object" &&
                first !== null &&
                asElement(first).props !== undefined &&
                Object.is(asElement(first).type, "Text") &&
                asElement(first).props.children === "取消");
        });
        (0, vitest_1.expect)(cancelButton).not.toBeNull();
        cancelButton.props.onPress();
        (0, vitest_1.expect)(runtime.closeComposerCalls).toBe(1);
    });
    (0, vitest_1.it)("permits the controls again once the composer is cancelled", () => {
        const composer = createComposer("element");
        runtime.reviewState = { ...baseState(), composer };
        runtime.activeSurfaceOwnerId = "surface-1";
        runtime.resolvedOwnerId = "surface-1";
        (0, vitest_1.expect)((0, grab_controls_1.GrabOwnerControls)()).toBeNull();
        runtime.reviewState = { ...baseState(), composer: null };
        (0, vitest_1.expect)(countSheetMounts(slotOutput())).toBe(0);
        const controls = (0, grab_controls_1.GrabOwnerControls)();
        (0, vitest_1.expect)(controls).not.toBeNull();
        (0, vitest_1.expect)(asElement(controls).type).toBe("View");
    });
    (0, vitest_1.it)("keeps the controls hidden during a capture, exactly as before", () => {
        runtime.reviewState = { ...baseState(), composer: null };
        runtime.grabState = { ...runtime.grabState, isCapturing: true };
        (0, vitest_1.expect)((0, grab_controls_1.GrabOwnerControls)()).toBeNull();
        runtime.grabState = { ...runtime.grabState, isCapturing: false };
        (0, vitest_1.expect)((0, grab_controls_1.GrabOwnerControls)()).not.toBeNull();
    });
});
//# sourceMappingURL=composer-mount.test.js.map