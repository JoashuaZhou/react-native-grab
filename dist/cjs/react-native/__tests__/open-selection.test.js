"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const runtime = vitest_1.vi.hoisted(() => ({
    state: null,
    release: null,
    fiber: null,
    frames: [],
}));
// Run the real selection and menu handlers with native hit testing and Metro at the boundary.
vitest_1.vi.mock("react", async (importOriginal) => ({
    ...(await importOriginal()),
    useCallback: (callback) => callback,
    useEffect: () => { },
    useMemo: (factory) => factory(),
    useRef: (value) => ({ current: value }),
    useState: (initial) => {
        if (!("isSessionEnabled" in initial))
            return [initial, () => { }];
        runtime.state ?? (runtime.state = { ...initial, isSessionEnabled: true });
        return [
            runtime.state,
            (update) => {
                runtime.state = update(runtime.state);
            },
        ];
    },
}));
vitest_1.vi.mock("react-native", () => ({
    NativeModules: {
        SourceCode: { getConstants: () => ({ scriptURL: "http://localhost:8081/index.bundle" }) },
    },
    PanResponder: {
        create: (handlers) => {
            runtime.release = handlers.onPanResponderRelease;
            return { panHandlers: {} };
        },
    },
    Pressable: "Pressable",
    StyleSheet: {
        absoluteFill: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
        hairlineWidth: 1,
        create: (styles) => styles,
    },
    Text: "Text",
    View: "View",
}));
vitest_1.vi.mock("../containers", () => ({
    getGrabSelectionOwner: () => ({ shadowNode: {} }),
    useIsResolvedGrabSelectionOwner: () => true,
}));
vitest_1.vi.mock("../measure", () => ({
    findNodeAtPoint: () => runtime.fiber,
    getFabricWindowOffset: () => [0, 0],
    measureInWindow: () => [0, 0, 402, 874],
}));
vitest_1.vi.mock("../get-rendered-by", () => ({
    getRenderedBy: async () => runtime.frames,
}));
const grab_overlay_1 = require("../grab-overlay");
const fetchRequest = vitest_1.vi.fn();
const frame = (file, line, name = "Owner") => ({
    name,
    file,
    line,
    column: 11,
    collapse: false,
});
(0, vitest_1.beforeEach)(() => {
    runtime.state = null;
    runtime.release = null;
    runtime.frames = [];
    runtime.fiber = {
        type: "Text",
        memoizedProps: { children: "Boost with HYPEREV" },
        stateNode: { node: {} },
        _debugStack: new Error(),
        _debugOwner: null,
    };
    fetchRequest.mockReset().mockImplementation(async () => new Response('{"ok":true}'));
    vitest_1.vi.stubGlobal("fetch", fetchRequest);
    vitest_1.vi.stubGlobal("nativeFabricUIManager", {
        getBoundingClientRect: () => [10, 20, 200, 40],
    });
});
(0, vitest_1.afterEach)(() => {
    vitest_1.vi.unstubAllGlobals();
    vitest_1.vi.clearAllTimers();
    vitest_1.vi.useRealTimers();
});
const selectElement = async () => {
    (0, grab_overlay_1.ReactNativeGrabOverlay)({ ownerId: "root" });
    runtime.release({ nativeEvent: { pageX: 20, pageY: 30 } });
    await vitest_1.vi.waitFor(() => (0, vitest_1.expect)(runtime.state?.selectedElement).toBeTruthy());
    const overlay = (0, grab_overlay_1.ReactNativeGrabOverlay)({ ownerId: "root" });
    const menu = overlay.props.children[3];
    const actions = menu.props.children[1].props.children;
    return { copy: actions[0].props, open: actions[2].props };
};
const expectOpenRequest = async (file, lineNumber) => {
    const { open } = await selectElement();
    (0, vitest_1.expect)(open.disabled).toBe(false);
    open.onPress();
    await vitest_1.vi.waitFor(() => (0, vitest_1.expect)(fetchRequest).toHaveBeenCalledOnce());
    const [url, options] = fetchRequest.mock.calls[0];
    (0, vitest_1.expect)(url).toBe("http://localhost:8081/open-stack-frame");
    (0, vitest_1.expect)(options?.method).toBe("POST");
    (0, vitest_1.expect)(JSON.parse(options?.body)).toEqual({ file, lineNumber });
};
(0, vitest_1.describe)("Open source location", () => {
    vitest_1.it.each(["Text", "View", "Image", "TextInput", "Switch", "Pressable", "Svg", "CustomWidget"])("opens the nearest project JSX for a selected %s", async (type) => {
        runtime.fiber.type = type;
        runtime.frames = [
            frame("/app/node_modules/react-native/Libraries/Text/Text.js", 306, "Text"),
            frame("/app/src/page/Plugin/HyperEntry.js", 250, "ForwardRef"),
            frame("/app/src/page/Plugin/HyperEntry.js", 272, "EntryCard"),
        ];
        await expectOpenRequest("/app/src/page/Plugin/HyperEntry.js", 250);
    });
    vitest_1.it.each([
        "node_modules/library/Widget.js",
        "/app/node_modules/.pnpm/library@1/node_modules/library/Widget.js",
        "C:\\app\\node_modules\\library\\Widget.js",
    ])("skips dependency path %s", async (dependency) => {
        runtime.frames = [frame(dependency, 10), frame("src/components/Card.tsx", 42)];
        await expectOpenRequest("src/components/Card.tsx", 42);
    });
    (0, vitest_1.it)("keeps a project path that only contains node_modules as part of a directory name", async () => {
        runtime.frames = [frame("/app/src/node_modules_tools/Card.tsx", 42)];
        await expectOpenRequest("/app/src/node_modules_tools/Card.tsx", 42);
    });
    vitest_1.it.each([null, 0, -1, NaN, Infinity, 1.5])("skips a source location with line %s", async (line) => {
        runtime.frames = [frame("/app/src/Unavailable.tsx", line), frame("/app/src/Card.tsx", 42)];
        await expectOpenRequest("/app/src/Card.tsx", 42);
    });
    (0, vitest_1.it)("falls back to the first valid dependency location when project locations are unavailable", async () => {
        runtime.frames = [
            frame("/app/src/Unavailable.tsx", null),
            frame(null, 10),
            frame("/app/node_modules/library/Widget.js", 18),
            frame("/app/node_modules/library/Other.js", 27),
        ];
        await expectOpenRequest("/app/node_modules/library/Widget.js", 18);
    });
    vitest_1.it.each([
        { name: "empty stack", frames: [] },
        { name: "missing file", frames: [frame(null, 10)] },
        { name: "empty file", frames: [frame("", 10)] },
        { name: "missing line", frames: [frame("/app/src/Unavailable.tsx", null)] },
        { name: "zero line", frames: [frame("/app/src/Unavailable.tsx", 0)] },
    ])("disables Open for $name", async ({ frames }) => {
        runtime.frames = frames;
        const { open } = await selectElement();
        (0, vitest_1.expect)(open.disabled).toBe(true);
        (0, vitest_1.expect)(fetchRequest).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)("keeps both dependency and project source context when Copy is pressed", async () => {
        vitest_1.vi.useFakeTimers();
        runtime.frames = [
            frame("/app/node_modules/react-native/Libraries/Text/Text.js", 306, "Text"),
            frame("/app/src/page/Plugin/HyperEntry.js", 250, "ForwardRef"),
        ];
        const { copy } = await selectElement();
        copy.onPress();
        await vitest_1.vi.waitFor(() => (0, vitest_1.expect)(fetchRequest).toHaveBeenCalledOnce());
        const [url, options] = fetchRequest.mock.calls[0];
        (0, vitest_1.expect)(url).toBe("http://localhost:8081/__react-native-grab/copy");
        (0, vitest_1.expect)(JSON.parse(options?.body)).toEqual({
            text: "<ForwardRef>\n  Boost with HYPEREV\n</ForwardRef>\n  in Text (at /app/node_modules/react-native/Libraries/Text/Text.js:306:11)\n  in ForwardRef (at /app/src/page/Plugin/HyperEntry.js:250:11)",
        });
    });
});
//# sourceMappingURL=open-selection.test.js.map