import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const runtime = vi.hoisted(() => ({
    state: null,
    grant: null,
    release: null,
    fiber: null,
    frames: [],
    absRect: [10, 120, 50, 20],
    windowOffset: [0, 47],
    dimensions: { width: 402, height: 874 },
    scale: 2,
    route: null,
    paired: false,
    screenshot: {
        jpegBase64: "aGk=",
        width: 804,
        height: 1748,
        scale: 2,
    },
    controllerState: {
        isMenuVisible: true,
        isCapturing: false,
        selectedOwnerId: null,
        selectionSessionOwnerId: null,
    },
    reviewState: {
        paired: false,
        review: null,
        items: [],
        runner: { busy: false, blocked: false },
        listVisible: false,
        composer: null,
        error: null,
    },
    sequence: [],
    captureCalls: [],
    openComposerCalls: [],
    openListCalls: 0,
    showMenuCalls: [],
}));
vi.mock("react", async (importOriginal) => ({
    ...(await importOriginal()),
    useCallback: (callback) => callback,
    useEffect: () => { },
    useMemo: (factory) => factory(),
    useRef: (value) => ({ current: value }),
    useState: (initial) => {
        const resolved = typeof initial === "function" ? initial() : initial;
        if (typeof resolved === "object" && resolved !== null && "isSessionEnabled" in resolved) {
            runtime.state ?? (runtime.state = { ...resolved, isSessionEnabled: true });
            return [
                runtime.state,
                (update) => {
                    runtime.state = update(runtime.state);
                },
            ];
        }
        return [resolved, () => { }];
    },
}));
vi.mock("react-native", () => ({
    Alert: { alert: () => { } },
    Animated: {
        Value: class {
            constructor(value) {
                this.value = value;
            }
            interpolate() {
                return 0;
            }
            setValue(value) {
                this.value = value;
            }
        },
        ValueXY: class {
            constructor(value) {
                this.value = value;
            }
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
        View: "Animated.View",
        timing: () => ({
            start: (callback) => callback?.({ finished: true }),
        }),
        event: () => () => { },
    },
    Dimensions: { get: () => runtime.dimensions },
    Easing: { out: (value) => value, cubic: (value) => value },
    Image: "Image",
    KeyboardAvoidingView: "KeyboardAvoidingView",
    Linking: { openURL: async () => { } },
    Modal: "Modal",
    NativeModules: {
        SourceCode: { getConstants: () => ({ scriptURL: "http://localhost:8081/index.bundle" }) },
    },
    PanResponder: {
        create: (handlers) => {
            runtime.grant = handlers.onPanResponderGrant;
            runtime.release = handlers.onPanResponderRelease;
            return { panHandlers: {} };
        },
    },
    PixelRatio: { get: () => runtime.scale },
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
vi.mock("react-native-safe-area-context", () => ({
    initialWindowMetrics: null,
}));
vi.mock("../containers", () => ({
    getGrabSelectionOwner: () => ({ shadowNode: {} }),
    getFocusedScreenName: () => runtime.route,
    useIsResolvedGrabSelectionOwner: () => true,
}));
vi.mock("../measure", () => ({
    findNodeAtPoint: () => runtime.fiber,
    getFabricWindowOffset: () => runtime.windowOffset,
    measureInWindow: () => [0, 0, 402, 874],
}));
vi.mock("../get-rendered-by", () => ({
    getRenderedBy: async () => runtime.frames,
}));
vi.mock("../grab-controller", () => ({
    clearGrabOwnerPresentation: () => { },
    enableGrabbing: () => { },
    hideGrabSelectionMenu: () => { },
    registerLocalGrabSelectionController: () => { },
    setGrabSelectionSessionOwner: () => { },
    showGrabSelectionMenu: (...args) => {
        runtime.showMenuCalls.push(args);
    },
    toggleGrabMenu: () => { },
    unregisterLocalGrabSelectionController: () => { },
    useGrabControllerState: () => runtime.controllerState,
}));
vi.mock("../review/capture", () => ({
    captureForReview: async (...args) => {
        runtime.sequence.push("capture");
        runtime.captureCalls.push(args);
        return runtime.screenshot;
    },
}));
vi.mock("../review/store", () => ({
    isReviewPaired: () => runtime.paired,
    useReviewState: () => runtime.reviewState,
    PAIRING_CODE_STORAGE_KEY: "rnGrabReview.pairingCode",
    reviewActions: {
        openComposer: (composer) => {
            runtime.sequence.push("openComposer");
            runtime.openComposerCalls.push(composer);
        },
        openList: () => {
            runtime.openListCalls += 1;
        },
        closeComposer: () => { },
        saveComposer: async () => false,
    },
}));
import { GrabOwnerControls } from "../grab-controls";
import { BAR_WIDTH, GrabControlBar } from "../grab-control-bar";
import { ReactNativeGrabOverlay } from "../grab-overlay";
import { ReviewComposer } from "../review/composer";
const frame = (file, line, column, name = "Owner") => ({
    name,
    file,
    line,
    column,
    collapse: false,
});
const deviceItem = (overrides = {}) => ({
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
const asElement = (value) => value;
const controlBarOf = (controls) => asElement(asElement(asElement(controls).props.children).props.children).props
    .children;
const barSlots = (bar) => asElement(asElement(asElement(bar.props.children).props.children).props.children).props
    .children;
beforeEach(() => {
    runtime.state = null;
    runtime.grant = null;
    runtime.release = null;
    runtime.frames = [];
    runtime.absRect = [10, 120, 50, 20];
    runtime.windowOffset = [0, 47];
    runtime.dimensions = { width: 402, height: 874 };
    runtime.scale = 2;
    runtime.route = null;
    runtime.paired = false;
    runtime.screenshot = { jpegBase64: "aGk=", width: 804, height: 1748, scale: 2 };
    runtime.controllerState = {
        isMenuVisible: true,
        isCapturing: false,
        selectedOwnerId: null,
        selectionSessionOwnerId: null,
    };
    runtime.reviewState = {
        paired: false,
        review: null,
        items: [],
        runner: { busy: false, blocked: false },
        listVisible: false,
        composer: null,
        error: null,
    };
    runtime.sequence = [];
    runtime.captureCalls = [];
    runtime.openComposerCalls = [];
    runtime.openListCalls = 0;
    runtime.showMenuCalls = [];
    runtime.fiber = {
        type: "Text",
        memoizedProps: { children: "Boost with HYPEREV" },
        stateNode: { node: {} },
        _debugStack: new Error(),
        _debugOwner: null,
    };
    vi.stubGlobal("nativeFabricUIManager", {
        getBoundingClientRect: () => runtime.absRect,
    });
});
afterEach(() => {
    vi.unstubAllGlobals();
});
const pick = async () => {
    ReactNativeGrabOverlay({ ownerId: "root" });
    runtime.grant({ nativeEvent: { pageX: 20, pageY: 30 } });
    runtime.release({ nativeEvent: { pageX: 20, pageY: 30 } });
};
describe("Review-mode grab", () => {
    it("captures and opens the composer with the window rect for a paired pick", async () => {
        runtime.paired = true;
        runtime.route = "Home";
        runtime.frames = [frame("/app/src/page/Plugin/HyperEntry.js", 250, 10, "ForwardRef")];
        await pick();
        await vi.waitFor(() => expect(runtime.openComposerCalls).toHaveLength(1));
        expect(runtime.showMenuCalls).toEqual([]);
        expect(runtime.sequence).toEqual(["capture", "openComposer"]);
        expect(runtime.openComposerCalls[0]).toEqual({
            mode: "create",
            draft: {
                kind: "element",
                description: "",
                rect: { x: 10, y: 73, width: 50, height: 20 },
                screen: { width: 402, height: 874, scale: 2 },
                route: "Home",
                grab: {
                    description: "<ForwardRef>\n  Boost with HYPEREV\n</ForwardRef>\n  in ForwardRef (at /app/src/page/Plugin/HyperEntry.js:250:10)",
                    frames: [
                        {
                            name: "ForwardRef",
                            file: "/app/src/page/Plugin/HyperEntry.js",
                            line: 250,
                            column: 10,
                        },
                    ],
                },
            },
            screenshot: runtime.screenshot,
        });
    });
    it("keeps the copy/open selection menu for an unpaired pick", async () => {
        runtime.paired = false;
        runtime.frames = [frame("/app/src/page/Plugin/HyperEntry.js", 250, 10, "ForwardRef")];
        await pick();
        await vi.waitFor(() => expect(runtime.showMenuCalls).toEqual([["root"]]));
        expect(runtime.openComposerCalls).toEqual([]);
        expect(runtime.captureCalls).toEqual([]);
    });
    it("hides the highlight and badges while capturing", () => {
        ReactNativeGrabOverlay({ ownerId: "root" });
        runtime.state = {
            isSessionEnabled: true,
            grabbedElement: { fiberNode: runtime.fiber, rect: [10, 120, 50, 20] },
            isCopyBadgeVisible: false,
            selectedElement: null,
        };
        const idle = asElement(ReactNativeGrabOverlay({ ownerId: "root" }));
        const idleChildren = idle.props.children;
        expect(idleChildren[0]).toBeTruthy();
        expect(idleChildren[2]).toBeTruthy();
        runtime.controllerState = { ...runtime.controllerState, isCapturing: true };
        const capturing = asElement(ReactNativeGrabOverlay({ ownerId: "root" }));
        const capturingChildren = capturing.props.children;
        expect(capturingChildren[0]).toBeFalsy();
        expect(capturingChildren[2]).toBeFalsy();
    });
});
describe("Toolbar", () => {
    it("exports a five-slot 180pt bar", () => {
        expect(BAR_WIDTH).toBe(180);
        const bar = asElement(GrabControlBar({
            isSessionEnabled: false,
            isVisible: true,
            onPressHide: () => { },
            onPressSelect: () => { },
            onPressPage: async () => { },
            onPressList: () => { },
            listBadgeText: "!",
        }));
        const slots = barSlots(bar);
        expect(slots).toHaveLength(9);
        const labels = slots
            .map((slot) => asElement(slot).props.accessibilityLabel)
            .filter((label) => label !== undefined);
        expect(labels).toEqual([
            "Move controls",
            "Select element",
            "截取整页",
            "走查列表",
            "Hide controls",
        ]);
        const listSlot = asElement(slots[6]);
        const listSlotChildren = listSlot.props.children;
        const badge = asElement(listSlotChildren[1]);
        expect(asElement(badge.props.children).props.children).toBe("!");
    });
    it("omits the list badge without a badge text", () => {
        const bar = asElement(GrabControlBar({
            isSessionEnabled: false,
            isVisible: true,
            onPressHide: () => { },
            onPressSelect: () => { },
            onPressPage: async () => { },
            onPressList: () => { },
            listBadgeText: null,
        }));
        const listSlot = asElement(barSlots(bar)[6]);
        expect(listSlot.props.children[1]).toBeFalsy();
    });
    it("renders nothing while capturing, or while the composer or list is open", () => {
        expect(GrabOwnerControls()).not.toBeNull();
        runtime.controllerState = { ...runtime.controllerState, isCapturing: true };
        expect(GrabOwnerControls()).toBeNull();
        runtime.controllerState = { ...runtime.controllerState, isCapturing: false };
        runtime.reviewState = { ...runtime.reviewState, composer: { mode: "create" } };
        expect(GrabOwnerControls()).toBeNull();
        runtime.reviewState = { ...runtime.reviewState, composer: null, listVisible: true };
        expect(GrabOwnerControls()).toBeNull();
    });
    it("shows the awaiting count when paired, and ! when unpaired", () => {
        const unpairedBar = controlBarOf(GrabOwnerControls());
        expect(asElement(unpairedBar).props.listBadgeText).toBe("!");
        runtime.reviewState = {
            ...runtime.reviewState,
            paired: true,
            items: [
                deviceItem({ status: "awaiting_review" }),
                deviceItem({ no: 2, status: "awaiting_review" }),
                deviceItem({ no: 3, status: "draft" }),
            ],
        };
        const pairedBar = controlBarOf(GrabOwnerControls());
        expect(asElement(pairedBar).props.listBadgeText).toBe("2");
        runtime.reviewState = {
            ...runtime.reviewState,
            items: [deviceItem({ status: "draft" })],
        };
        const zeroBar = controlBarOf(GrabOwnerControls());
        expect(asElement(zeroBar).props.listBadgeText).toBe(null);
    });
    it("captures and opens a page draft from the page slot", async () => {
        runtime.route = "Home";
        const bar = controlBarOf(GrabOwnerControls());
        await asElement(bar).props.onPressPage();
        expect(runtime.sequence).toEqual(["capture", "openComposer"]);
        expect(runtime.openComposerCalls).toEqual([
            {
                mode: "create",
                draft: {
                    kind: "page",
                    description: "",
                    rect: null,
                    screen: { width: 402, height: 874, scale: 2 },
                    route: "Home",
                    grab: null,
                },
                screenshot: runtime.screenshot,
            },
        ]);
    });
    it("opens the review list from the list slot", () => {
        const bar = controlBarOf(GrabOwnerControls());
        asElement(bar).props.onPressList();
        expect(runtime.openListCalls).toBe(1);
    });
});
describe("Review composer", () => {
    it("sizes the create thumbnail from the draft screen, not the screenshot pixels", () => {
        runtime.reviewState = {
            ...runtime.reviewState,
            composer: {
                mode: "create",
                draft: {
                    kind: "element",
                    description: "",
                    rect: { x: 100, y: 200, width: 80, height: 40 },
                    screen: { width: 402, height: 874, scale: 2 },
                    route: "Home",
                },
                screenshot: runtime.screenshot,
            },
        };
        const modal = asElement(ReviewComposer());
        const sheetElement = asElement(modal.props.children);
        const sheet = asElement(sheetElement.type(sheetElement.props));
        const children = sheet.props.children;
        const scrollView = asElement(children[1]);
        const sheetView = asElement(scrollView.props.children);
        const thumbElement = asElement(sheetView.props.children[1]);
        const thumb = asElement(thumbElement.type(thumbElement.props));
        const boxStyle = thumb.props.style[1];
        expect(boxStyle).toEqual({ width: 64, height: 139 });
        const overlay = asElement(thumb.props.children[1]);
        const overlayStyle = overlay.props.style[1];
        expect(overlayStyle.left).toBeCloseTo(15.9204, 3);
        expect(overlayStyle.top).toBeCloseTo(31.8408, 3);
        expect(overlayStyle.width).toBeCloseTo(12.7363, 3);
        expect(overlayStyle.height).toBeCloseTo(6.3682, 3);
    });
});
//# sourceMappingURL=review-grab.test.js.map