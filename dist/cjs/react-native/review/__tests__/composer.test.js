"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const runtime = vitest_1.vi.hoisted(() => ({
    reviewState: null,
    closeComposerCalls: 0,
    safeAreaMetrics: null,
}));
vitest_1.vi.mock("react", async (importOriginal) => ({
    ...(await importOriginal()),
    useState: (initial) => {
        const resolved = typeof initial === "function" ? initial() : initial;
        return [resolved, () => { }];
    },
}));
vitest_1.vi.mock("react-native", () => ({
    Alert: { alert: () => { } },
    Image: "Image",
    KeyboardAvoidingView: "KeyboardAvoidingView",
    Linking: { openURL: async () => { } },
    Modal: "Modal",
    NativeModules: {
        SourceCode: { getConstants: () => ({ scriptURL: "http://localhost:8081/index.bundle" }) },
    },
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
    get initialWindowMetrics() {
        return runtime.safeAreaMetrics;
    },
}));
vitest_1.vi.mock("../store", () => ({
    PAIRING_CODE_STORAGE_KEY: "rnGrabReview.pairingCode",
    reviewActions: {
        closeComposer: () => {
            runtime.closeComposerCalls += 1;
        },
        saveComposer: async () => false,
    },
    useReviewState: () => runtime.reviewState,
}));
const composer_1 = require("../composer");
const list_panel_1 = require("../list-panel");
const asElement = (value) => value;
const reviewView = () => ({
    id: "20261111-080000",
    base: "main",
    branch: "fix/design-review-20261111-0800",
    status: "active",
    mrUrl: null,
});
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
    review: reviewView(),
    items: [],
    runner: { busy: false, blocked: false },
    listVisible: false,
    composer: null,
    error: null,
});
const invoke = (element) => asElement(element.type(element.props));
const rootSheet = () => {
    const modal = asElement((0, composer_1.ReviewComposer)());
    (0, vitest_1.expect)(modal.props.visible).toBe(true);
    const sheetElement = asElement(modal.props.children);
    (0, vitest_1.expect)(sheetElement.type).toBe(composer_1.ComposerSheet);
    return invoke(sheetElement);
};
const embeddedSheetElement = () => {
    const listModal = asElement((0, list_panel_1.ReviewListPanel)());
    (0, vitest_1.expect)(listModal.props.visible).toBe(true);
    const panel = asElement(listModal.props.children);
    const overlay = asElement(panel.props.children[2]);
    (0, vitest_1.expect)(overlay.props.style.position).toBe("absolute");
    return asElement(overlay.props.children);
};
const sheetTitle = (sheet) => {
    const scrollView = asElement(sheet.props.children[1]);
    const sheetView = asElement(scrollView.props.children);
    return asElement(sheetView.props.children[0]).props.children;
};
const containsSheet = (value) => {
    if (Array.isArray(value)) {
        return value.some(containsSheet);
    }
    if (value === null || typeof value !== "object") {
        return false;
    }
    const element = value;
    if (element.type === composer_1.ComposerSheet) {
        return true;
    }
    const children = element.props?.children;
    return children === undefined ? false : containsSheet(children);
};
(0, vitest_1.beforeEach)(() => {
    runtime.closeComposerCalls = 0;
    runtime.safeAreaMetrics = null;
    runtime.reviewState = baseState();
});
(0, vitest_1.describe)("composer mount paths", () => {
    (0, vitest_1.it)("presents element and page picks at the root while the list is hidden", () => {
        runtime.reviewState = { ...baseState(), composer: createComposer("element") };
        (0, vitest_1.expect)(sheetTitle(rootSheet())).toBe("走查控件");
        runtime.reviewState = { ...baseState(), composer: createComposer("page") };
        (0, vitest_1.expect)(sheetTitle(rootSheet())).toBe("走查整页");
    });
    (0, vitest_1.it)("keeps the root modal closed without a composer", () => {
        const modal = asElement((0, composer_1.ReviewComposer)());
        (0, vitest_1.expect)(modal.props.visible).toBe(false);
    });
    (0, vitest_1.it)("renders null at the root while the list is visible, so iOS never stacks two Modals", () => {
        runtime.reviewState = {
            ...baseState(),
            listVisible: true,
            composer: { mode: "edit", item: itemView() },
        };
        (0, vitest_1.expect)((0, composer_1.ReviewComposer)()).toBeNull();
    });
    (0, vitest_1.it)("keeps the hidden list tree free of the composer while the root presents it", () => {
        runtime.reviewState = {
            ...baseState(),
            listVisible: false,
            composer: createComposer("element"),
        };
        const rootModal = asElement((0, composer_1.ReviewComposer)());
        (0, vitest_1.expect)(asElement(rootModal.props.children).type).toBe(composer_1.ComposerSheet);
        const listModal = asElement((0, list_panel_1.ReviewListPanel)());
        const panel = asElement(listModal.props.children);
        const overlayCandidate = panel.props.children[2];
        (0, vitest_1.expect)(overlayCandidate).toBeFalsy();
        (0, vitest_1.expect)(containsSheet(panel)).toBe(false);
    });
    (0, vitest_1.it)("mounts the edit sheet inside the list modal while the list is visible", () => {
        runtime.reviewState = {
            ...baseState(),
            listVisible: true,
            composer: { mode: "edit", item: itemView({ rounds: [] }) },
        };
        const sheetElement = embeddedSheetElement();
        (0, vitest_1.expect)(sheetElement.type).toBe(composer_1.ComposerSheet);
        (0, vitest_1.expect)(sheetTitle(invoke(sheetElement))).toBe("修改草稿");
    });
    (0, vitest_1.it)("mounts the reject sheet inside the list modal while the list is visible", () => {
        runtime.reviewState = {
            ...baseState(),
            listVisible: true,
            composer: { mode: "reject", item: itemView() },
        };
        const sheetElement = embeddedSheetElement();
        (0, vitest_1.expect)(sheetTitle(invoke(sheetElement))).toBe("打回并补充");
    });
    (0, vitest_1.it)("lets the backdrop tap close the embedded sheet without closing the list", () => {
        runtime.reviewState = {
            ...baseState(),
            listVisible: true,
            composer: { mode: "edit", item: itemView() },
        };
        const sheet = invoke(embeddedSheetElement());
        const backdropPress = asElement(sheet.props.children[0]);
        backdropPress.props.onPress();
        (0, vitest_1.expect)(runtime.closeComposerCalls).toBe(1);
    });
});
(0, vitest_1.describe)("composer backdrop safe area", () => {
    (0, vitest_1.it)("pads the backdrop below the status-bar inset from the initial window metrics", () => {
        runtime.safeAreaMetrics = { insets: { top: 59 } };
        runtime.reviewState = { ...baseState(), composer: createComposer("element") };
        const style = rootSheet().props.style;
        (0, vitest_1.expect)(style[1].paddingTop).toBe(59);
    });
    (0, vitest_1.it)("falls back to zero backdrop padding without safe-area metrics", () => {
        runtime.safeAreaMetrics = null;
        runtime.reviewState = { ...baseState(), composer: createComposer("element") };
        const style = rootSheet().props.style;
        (0, vitest_1.expect)(style[1].paddingTop).toBe(0);
    });
});
//# sourceMappingURL=composer.test.js.map