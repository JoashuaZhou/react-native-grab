"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const description_1 = require("../description");
const grab_context_1 = require("../grab-context");
vitest_1.vi.mock("../get-rendered-by", () => ({
    getRenderedBy: vitest_1.vi.fn(async () => []),
}));
const get_rendered_by_1 = require("../get-rendered-by");
const mockedGetRenderedBy = vitest_1.vi.mocked(get_rendered_by_1.getRenderedBy);
const createHostFiber = (props, parent = null) => ({
    type: "Text",
    memoizedProps: props,
    return: parent,
    stateNode: null,
    _debugStack: new Error(),
    _debugOwner: null,
});
const createContextProviderFiber = (value, parent = null) => ({
    type: grab_context_1.ReactNativeGrabInternalContext.Provider,
    memoizedProps: { value },
    return: parent,
    stateNode: null,
    _debugStack: new Error(),
    _debugOwner: null,
});
const frame = (name) => ({
    name,
    file: null,
    line: null,
    column: null,
    collapse: false,
});
(0, vitest_1.describe)("isHostLikeComponentName", () => {
    (0, vitest_1.it)("treats View and Text as host-like", () => {
        for (const name of description_1.GRAB_HOST_LIKE_COMPONENT_NAMES) {
            (0, vitest_1.expect)((0, description_1.isHostLikeComponentName)(name)).toBe(true);
        }
        (0, vitest_1.expect)((0, description_1.isHostLikeComponentName)("InstallTabs")).toBe(false);
    });
    (0, vitest_1.it)("trims names before matching", () => {
        (0, vitest_1.expect)((0, description_1.isHostLikeComponentName)("  Text  ")).toBe(true);
    });
});
(0, vitest_1.describe)("getGrabSelectionTitle", () => {
    (0, vitest_1.it)("skips host-like owners to show Text (in InstallTabs)", () => {
        const fiber = createHostFiber({ children: "x" });
        (0, vitest_1.expect)((0, description_1.getGrabSelectionTitle)(fiber, [frame("Text"), frame("InstallTabs")])).toBe("Text (in InstallTabs)");
    });
    (0, vitest_1.it)("skips multiple host-like owners", () => {
        const viewFiber = {
            type: "View",
            memoizedProps: {},
            return: null,
            stateNode: null,
            _debugStack: new Error(),
            _debugOwner: null,
        };
        (0, vitest_1.expect)((0, description_1.getGrabSelectionTitle)(viewFiber, [frame("View"), frame("Text"), frame("Screen")])).toBe("View (in Screen)");
    });
    (0, vitest_1.it)("returns host only when every owner is host-like", () => {
        const viewFiber = {
            type: "View",
            memoizedProps: {},
            return: null,
            stateNode: null,
            _debugStack: new Error(),
            _debugOwner: null,
        };
        (0, vitest_1.expect)((0, description_1.getGrabSelectionTitle)(viewFiber, [frame("View"), frame("Text")])).toBe("View");
    });
    (0, vitest_1.it)("returns Selected element when host is unknown", () => {
        const fiber = {
            type: () => null,
            memoizedProps: {},
            return: null,
            stateNode: null,
            _debugStack: new Error(),
            _debugOwner: null,
        };
        (0, vitest_1.expect)((0, description_1.getGrabSelectionTitle)(fiber, [])).toBe("Selected element");
    });
    (0, vitest_1.it)("uses host-like name from renderedBy when the fiber has no string host", () => {
        const fiber = {
            type: () => null,
            memoizedProps: {},
            return: null,
            stateNode: null,
            _debugStack: new Error(),
            _debugOwner: null,
        };
        (0, vitest_1.expect)((0, description_1.getGrabSelectionTitle)(fiber, [frame("Text"), frame("InstallTabs")])).toBe("Text (in InstallTabs)");
    });
});
(0, vitest_1.describe)("composeGrabContextValue", () => {
    (0, vitest_1.it)("returns shallow copy when parent context does not exist", () => {
        const result = (0, grab_context_1.composeGrabContextValue)(null, { screen: "home", attempt: 1 });
        (0, vitest_1.expect)(result).toEqual({ screen: "home", attempt: 1 });
    });
    (0, vitest_1.it)("merges parent and child with child override precedence", () => {
        const result = (0, grab_context_1.composeGrabContextValue)({ screen: "home", theme: "light", source: "parent" }, { source: "child", variant: "hero" });
        (0, vitest_1.expect)(result).toEqual({
            screen: "home",
            theme: "light",
            source: "child",
            variant: "hero",
        });
    });
});
(0, vitest_1.describe)("getDescription with grab context", () => {
    (0, vitest_1.beforeEach)(() => {
        mockedGetRenderedBy.mockReset();
        mockedGetRenderedBy.mockResolvedValue([]);
    });
    (0, vitest_1.it)("keeps current output format when no context provider is in ancestors", async () => {
        const selectedFiber = createHostFiber({ children: "Hello" });
        const description = await (0, description_1.getDescription)(selectedFiber);
        (0, vitest_1.expect)(description).toContain("<Text>");
        (0, vitest_1.expect)(description).toContain("Hello");
        (0, vitest_1.expect)(description).not.toContain("Context:");
    });
    (0, vitest_1.it)("uses first non-host-like renderedBy name for the preview tag", async () => {
        mockedGetRenderedBy.mockResolvedValue([frame("Text"), frame("InstallTabs")]);
        const selectedFiber = createHostFiber({ children: "Hello" });
        const description = await (0, description_1.getDescription)(selectedFiber);
        (0, vitest_1.expect)(description.startsWith("<InstallTabs")).toBe(true);
        (0, vitest_1.expect)(description).toContain("Hello");
    });
    (0, vitest_1.it)("appends Context block from nearest provider value", async () => {
        const parentProvider = createContextProviderFiber({ screen: "home", locale: "en" });
        const childProvider = createContextProviderFiber({ locale: "pl", section: "cta" }, parentProvider);
        const selectedFiber = createHostFiber({ children: "Tap me" }, childProvider);
        const description = await (0, description_1.getDescription)(selectedFiber);
        (0, vitest_1.expect)(description).toContain("<Text>");
        (0, vitest_1.expect)(description).toContain("Tap me");
        (0, vitest_1.expect)(description).toContain("Context:");
        (0, vitest_1.expect)(description).toContain('"locale": "pl"');
        (0, vitest_1.expect)(description).toContain('"section": "cta"');
        (0, vitest_1.expect)(description).not.toContain('"screen": "home"');
    });
});
//# sourceMappingURL=grab-context-description.test.js.map