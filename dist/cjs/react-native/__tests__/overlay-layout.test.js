"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const react_1 = require("react");
const runtime = vitest_1.vi.hoisted(() => ({
    platform: "ios",
    metrics: { insets: { top: 62 } },
    selecting: false,
}));
// Exercise the real layout callbacks without a native renderer or animation driver.
vitest_1.vi.mock("react", async (importOriginal) => ({
    ...(await importOriginal()),
    useCallback: (callback) => callback,
    useEffect: () => { },
    useMemo: (factory) => factory(),
    useRef: (value) => ({ current: value }),
    useState: (value) => [
        runtime.selecting && value && typeof value === "object" && "isSessionEnabled" in value
            ? { ...value, isSessionEnabled: true }
            : value,
        () => { },
    ],
    useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
}));
vitest_1.vi.mock("react-native", () => ({
    Animated: {
        Value: class {
            interpolate() {
                return 0;
            }
        },
        ValueXY: class {
            constructor(value) {
                this.value = value;
            }
            setValue(value) {
                this.value = value;
            }
            flattenOffset() { }
            stopAnimation(callback) {
                callback(this.value);
            }
            getTranslateTransform() {
                return [{ translateX: this }, { translateY: this }];
            }
            toJSON() {
                return this.value;
            }
        },
        event: () => { },
        View: "AnimatedView",
    },
    Dimensions: { get: () => ({ width: 402, height: 874 }) },
    NativeModules: {},
    PanResponder: { create: () => ({ panHandlers: {} }) },
    Platform: {
        get OS() {
            return runtime.platform;
        },
    },
    Pressable: "Pressable",
    StyleSheet: {
        // RN 0.88 removed absoluteFillObject; only model the supported API.
        absoluteFill: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
        hairlineWidth: 1,
        create: (styles) => styles,
    },
    Text: "Text",
    View: "View",
}));
vitest_1.vi.mock("react-native-safe-area-context", () => ({
    get initialWindowMetrics() {
        return runtime.metrics;
    },
}));
vitest_1.vi.mock("../full-screen-overlay", () => ({ FullScreenOverlay: "Overlay" }));
(0, vitest_1.beforeEach)(() => {
    vitest_1.vi.resetModules();
    runtime.platform = "ios";
    runtime.metrics = { insets: { top: 62 } };
    runtime.selecting = false;
});
const controls = async () => {
    const { GrabOwnerControls } = await vitest_1.vi.importActual("../grab-controls");
    const anchor = GrabOwnerControls();
    const measuringView = anchor.props.children.props.children;
    const bar = measuringView.props.children;
    const position = bar.props.containerStyle[1].transform[0].translateX;
    return {
        anchor,
        measuringView,
        layout(width, height) {
            measuringView.props.onLayout({ nativeEvent: { layout: { width, height } } });
        },
        position: () => JSON.parse(JSON.stringify(position)),
    };
};
const fillsParent = {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
};
(0, vitest_1.describe)("development overlay layout", () => {
    (0, vitest_1.it)("keeps the toolbar anchor and measuring view full size on RN 0.88", async () => {
        const bar = await controls();
        (0, vitest_1.expect)(bar.anchor.props.style).toMatchObject(fillsParent);
        (0, vitest_1.expect)(bar.measuringView.props.style).toMatchObject(fillsParent);
    });
    (0, vitest_1.it)("places the iOS toolbar below the initial window safe area", async () => {
        const bar = await controls();
        bar.layout(402, 874);
        (0, vitest_1.expect)(bar.position()).toEqual({ x: 147, y: 134 });
    });
    vitest_1.it.each([
        [0, 0],
        [0, 874],
        [402, 0],
    ])("ignores initial bounds of %i by %i before placing the toolbar", async (width, height) => {
        const bar = await controls();
        bar.layout(width, height);
        bar.layout(402, 874);
        (0, vitest_1.expect)(bar.position()).toEqual({ x: 147, y: 134 });
    });
    (0, vitest_1.it)("keeps the Android toolbar at the existing margin", async () => {
        runtime.platform = "android";
        const bar = await controls();
        bar.layout(402, 874);
        (0, vitest_1.expect)(bar.position()).toEqual({ x: 147, y: 72 });
    });
    (0, vitest_1.it)("keeps the toolbar inside a short presented surface", async () => {
        const bar = await controls();
        bar.layout(402, 100);
        (0, vitest_1.expect)(bar.position()).toEqual({ x: 147, y: 64 });
    });
    (0, vitest_1.it)("uses the existing margin when initial metrics are unavailable", async () => {
        runtime.metrics = null;
        const bar = await controls();
        bar.layout(402, 874);
        (0, vitest_1.expect)(bar.position()).toEqual({ x: 147, y: 72 });
    });
    (0, vitest_1.it)("keeps the selection layer full size on RN 0.88", async () => {
        runtime.selecting = true;
        const { ReactNativeGrabOverlay } = await vitest_1.vi.importActual("../grab-overlay");
        const overlay = ReactNativeGrabOverlay({ ownerId: "root" });
        (0, vitest_1.expect)(overlay?.props.style).toMatchObject(fillsParent);
    });
    (0, vitest_1.it)("keeps the context menu and its dismissal region full size on RN 0.88", async () => {
        const { ContextMenu } = await vitest_1.vi.importActual("../context-menu");
        const menu = ContextMenu({
            anchor: { x: 100, y: 200 },
            children: (0, react_1.createElement)("View"),
            onClose: () => { },
            visible: true,
        });
        (0, vitest_1.expect)(menu?.props.style).toMatchObject(fillsParent);
        (0, vitest_1.expect)(menu?.props.children[0][0].props.style).toMatchObject(fillsParent);
    });
});
//# sourceMappingURL=overlay-layout.test.js.map