"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const api_1 = require("../api");
vitest_1.vi.mock("react", async (importOriginal) => ({
    ...(await importOriginal()),
    useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
}));
vitest_1.vi.mock("react-native", () => ({
    NativeModules: {
        SourceCode: { getConstants: () => ({ scriptURL: "http://localhost:8081/index.bundle" }) },
    },
}));
const test = vitest_1.vi.hoisted(() => ({
    storage: new Map(),
    requests: [],
}));
const fetchMock = vitest_1.vi.fn(async (input, _init) => {
    throw new Error(`unexpected fetch ${String(input)}`);
});
const SERVER_URL = "http://localhost:8081";
const PAIRING_CODE_KEY = "rnGrabReview.pairingCode";
const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), { status });
const reviewView = () => ({
    id: "20261111-080000",
    base: "feature/liquidGlass",
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
    route: "Home",
    device: null,
    revertCommit: null,
    lastError: null,
    createdAt: "2026-11-11T08:00:00.000Z",
    actions: ["edit", "delete"],
    ...overrides,
});
const statePayload = (items) => ({
    ok: true,
    review: reviewView(),
    items,
    runner: { busy: false, blocked: false },
});
const routeFetch = (routes) => {
    fetchMock.mockImplementation(async (input, init) => {
        const path = String(input).slice(`${SERVER_URL}${api_1.REVIEW_ROUTE_PREFIX}`.length);
        const method = init?.method ?? "GET";
        test.requests.push({
            method,
            path,
            body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
        });
        const route = routes[`${method} ${path}`];
        if (route === undefined) {
            throw new Error(`unexpected review request ${method} ${path}`);
        }
        const { body, status } = route();
        return jsonResponse(body, status);
    });
};
const stateRequestCount = () => test.requests.filter((r) => r.path === "state").length;
const findRequest = (method, path) => test.requests.find((r) => r.method === method && r.path === path);
const memoryStorage = () => ({
    get: (key) => test.storage.get(key) ?? null,
    set: (key, value) => {
        test.storage.set(key, value);
    },
});
const loadStore = async (host = { storage: memoryStorage() }) => {
    const hostModule = await vitest_1.vi.importActual("../host");
    hostModule.configureReview(host);
    return vitest_1.vi.importActual("../store");
};
const seedPairingCode = () => {
    test.storage.set(PAIRING_CODE_KEY, "012345");
};
const flushMicrotasks = async () => {
    for (let i = 0; i < 10; i += 1) {
        await Promise.resolve();
    }
};
(0, vitest_1.beforeEach)(() => {
    vitest_1.vi.resetModules();
    vitest_1.vi.useFakeTimers();
    test.storage.clear();
    test.requests.length = 0;
    fetchMock.mockReset();
    vitest_1.vi.stubGlobal("fetch", fetchMock);
});
(0, vitest_1.afterEach)(() => {
    vitest_1.vi.clearAllTimers();
    vitest_1.vi.useRealTimers();
    vitest_1.vi.unstubAllGlobals();
});
(0, vitest_1.describe)("review store", () => {
    (0, vitest_1.it)("pairs by storing the code in host storage and loading the state", async () => {
        routeFetch({
            "POST pair": () => ({ body: { ok: true, review: reviewView() } }),
            "GET state": () => ({ body: statePayload([itemView()]) }),
        });
        const store = await loadStore();
        (0, vitest_1.expect)(store.isReviewPaired()).toBe(false);
        const paired = await store.reviewActions.pair("012345");
        (0, vitest_1.expect)(paired).toBe(true);
        (0, vitest_1.expect)(test.storage.get(PAIRING_CODE_KEY)).toBe("012345");
        (0, vitest_1.expect)(store.isReviewPaired()).toBe(true);
        const state = store.useReviewState();
        (0, vitest_1.expect)(state.paired).toBe(true);
        (0, vitest_1.expect)(state.review).toEqual(reviewView());
        (0, vitest_1.expect)(state.items).toEqual([itemView()]);
        (0, vitest_1.expect)(state.runner).toEqual({ busy: false, blocked: false });
    });
    (0, vitest_1.it)("refresh loads items for an already stored pairing code", async () => {
        routeFetch({
            "GET state": () => ({ body: statePayload([itemView({ status: "queued", actions: [] })]) }),
        });
        seedPairingCode();
        const store = await loadStore();
        await store.reviewActions.refresh();
        const state = store.useReviewState();
        (0, vitest_1.expect)(state.paired).toBe(true);
        (0, vitest_1.expect)(state.review).toEqual(reviewView());
        (0, vitest_1.expect)(state.items).toHaveLength(1);
        (0, vitest_1.expect)(state.items[0].status).toBe("queued");
    });
    (0, vitest_1.it)("keeps the device unpaired with an error when pairing is rejected", async () => {
        routeFetch({ "POST pair": () => ({ body: { ok: false, error: "bad_code" }, status: 401 }) });
        const store = await loadStore();
        const paired = await store.reviewActions.pair("000000");
        (0, vitest_1.expect)(paired).toBe(false);
        (0, vitest_1.expect)(test.storage.has(PAIRING_CODE_KEY)).toBe(false);
        const state = store.useReviewState();
        (0, vitest_1.expect)(state.paired).toBe(false);
        (0, vitest_1.expect)(state.review).toBeNull();
        (0, vitest_1.expect)(state.error).toMatchObject({ code: "bad_code", status: 401 });
    });
    (0, vitest_1.it)("normalizes transport failures into a network error", async () => {
        fetchMock.mockImplementation(async () => {
            throw new TypeError("network down");
        });
        seedPairingCode();
        const store = await loadStore();
        await store.reviewActions.refresh();
        (0, vitest_1.expect)(store.useReviewState().error).toMatchObject({ code: "network", status: 0 });
    });
    (0, vitest_1.it)("saveComposer in create mode posts the item without screenshotJpegBase64 when there is no screenshot", async () => {
        routeFetch({
            "GET state": () => ({ body: statePayload([]) }),
            "POST items": () => ({ body: { ok: true, item: itemView() }, status: 201 }),
        });
        seedPairingCode();
        const store = await loadStore();
        store.reviewActions.openComposer({
            mode: "create",
            draft: {
                kind: "element",
                description: "",
                rect: { x: 10, y: 73, width: 50, height: 20 },
            },
            screenshot: null,
        });
        const saved = await store.reviewActions.saveComposer({
            description: "标题字号应为 16",
            scope: "local",
            figmaUrl: null,
        });
        (0, vitest_1.expect)(saved).toBe(true);
        const post = findRequest("POST", "items");
        (0, vitest_1.expect)(post?.body).not.toHaveProperty("screenshotJpegBase64");
        (0, vitest_1.expect)(post?.body).toMatchObject({
            kind: "element",
            description: "标题字号应为 16",
            scope: "local",
            rect: { x: 10, y: 73, width: 50, height: 20 },
        });
        (0, vitest_1.expect)(store.useReviewState().composer).toBeNull();
    });
    (0, vitest_1.it)("saveComposer attaches host device info to created items", async () => {
        routeFetch({
            "GET state": () => ({ body: statePayload([]) }),
            "POST items": () => ({ body: { ok: true, item: itemView() }, status: 201 }),
        });
        seedPairingCode();
        const store = await loadStore({
            storage: memoryStorage(),
            getDeviceInfo: async () => ({ model: "iPhone 17 Pro", os: "iOS 26.0", appVersion: "5.4.0" }),
        });
        store.reviewActions.openComposer({
            mode: "create",
            draft: { kind: "page", description: "" },
            screenshot: null,
        });
        await store.reviewActions.saveComposer({ description: "整页留白过大" });
        (0, vitest_1.expect)(findRequest("POST", "items")?.body).toMatchObject({
            device: { model: "iPhone 17 Pro", os: "iOS 26.0", appVersion: "5.4.0" },
        });
    });
    (0, vitest_1.it)("saveComposer edits the item held by the composer", async () => {
        routeFetch({
            "GET state": () => ({ body: statePayload([itemView()]) }),
            "PATCH items/1": () => ({ body: { ok: true, item: itemView() } }),
        });
        seedPairingCode();
        const store = await loadStore();
        store.reviewActions.openComposer({ mode: "edit", item: itemView() });
        const saved = await store.reviewActions.saveComposer({
            description: "改为 18",
            scope: "shared",
        });
        (0, vitest_1.expect)(saved).toBe(true);
        (0, vitest_1.expect)(findRequest("PATCH", "items/1")?.body).toEqual({
            description: "改为 18",
            scope: "shared",
        });
        (0, vitest_1.expect)(store.useReviewState().composer).toBeNull();
    });
    (0, vitest_1.it)("saveComposer rejects an item with the supplement", async () => {
        routeFetch({
            "GET state": () => ({ body: statePayload([itemView()]) }),
            "POST items/1/reject": () => ({ body: { ok: true, item: itemView() } }),
        });
        seedPairingCode();
        const store = await loadStore();
        store.reviewActions.openComposer({
            mode: "reject",
            item: itemView({ status: "awaiting_review" }),
        });
        const saved = await store.reviewActions.saveComposer({ supplement: "间距还是不对" });
        (0, vitest_1.expect)(saved).toBe(true);
        (0, vitest_1.expect)(findRequest("POST", "items/1/reject")?.body).toEqual({ supplement: "间距还是不对" });
        (0, vitest_1.expect)(store.useReviewState().composer).toBeNull();
    });
    (0, vitest_1.it)("keeps the composer open with the error when saving fails", async () => {
        routeFetch({
            "GET state": () => ({ body: statePayload([]) }),
            "POST items": () => ({ body: { ok: false, error: "empty_text" }, status: 400 }),
        });
        seedPairingCode();
        const store = await loadStore();
        const composer = {
            mode: "create",
            draft: { kind: "element", description: "" },
            screenshot: null,
        };
        store.reviewActions.openComposer(composer);
        const saved = await store.reviewActions.saveComposer({ description: "   " });
        (0, vitest_1.expect)(saved).toBe(false);
        const state = store.useReviewState();
        (0, vitest_1.expect)(state.composer).toEqual(composer);
        (0, vitest_1.expect)(state.error).toMatchObject({ code: "empty_text", status: 400 });
    });
    (0, vitest_1.it)("submits, passes, rejects, reverts, removes and finishes through the API", async () => {
        routeFetch({
            "GET state": () => ({ body: statePayload([itemView()]) }),
            "POST submit": () => ({ body: { ok: true, submitted: [1] } }),
            "POST items/1/pass": () => ({
                body: { ok: true, item: itemView({ status: "passed", actions: [] }) },
            }),
            "POST items/1/reject": () => ({ body: { ok: true, item: itemView() } }),
            "POST items/1/revert": () => ({
                body: { ok: true, item: itemView({ status: "reverted", actions: [] }) },
            }),
            "DELETE items/1": () => ({ body: { ok: true } }),
            "POST finish": () => ({ body: { ok: true } }),
        });
        seedPairingCode();
        const store = await loadStore();
        (0, vitest_1.expect)(await store.reviewActions.submit()).toBe(true);
        (0, vitest_1.expect)(await store.reviewActions.pass(1)).toBe(true);
        (0, vitest_1.expect)(await store.reviewActions.reject(1, "还是不对")).toBe(true);
        (0, vitest_1.expect)(await store.reviewActions.revert(1)).toBe(true);
        (0, vitest_1.expect)(await store.reviewActions.remove(1)).toBe(true);
        (0, vitest_1.expect)(await store.reviewActions.finish()).toBe(true);
        const requested = test.requests.map((r) => `${r.method} ${r.path}`);
        (0, vitest_1.expect)(requested).toContain("POST submit");
        (0, vitest_1.expect)(requested).toContain("POST items/1/pass");
        (0, vitest_1.expect)(requested).toContain("POST items/1/reject");
        (0, vitest_1.expect)(requested).toContain("POST items/1/revert");
        (0, vitest_1.expect)(requested).toContain("DELETE items/1");
        (0, vitest_1.expect)(requested).toContain("POST finish");
        (0, vitest_1.expect)(stateRequestCount()).toBeGreaterThanOrEqual(6);
    });
    (0, vitest_1.it)("refreshes the state when the list opens", async () => {
        routeFetch({ "GET state": () => ({ body: statePayload([]) }) });
        seedPairingCode();
        const store = await loadStore();
        store.reviewActions.openList();
        await flushMicrotasks();
        (0, vitest_1.expect)(store.useReviewState().listVisible).toBe(true);
        (0, vitest_1.expect)(stateRequestCount()).toBe(1);
        store.reviewActions.closeList();
        (0, vitest_1.expect)(store.useReviewState().listVisible).toBe(false);
    });
    (0, vitest_1.it)("does not fetch state while unpaired when the list opens", async () => {
        const store = await loadStore();
        store.reviewActions.openList();
        await flushMicrotasks();
        (0, vitest_1.expect)(store.useReviewState().listVisible).toBe(true);
        (0, vitest_1.expect)(fetchMock).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)("polls state every 3000 ms while the list is visible", async () => {
        routeFetch({ "GET state": () => ({ body: statePayload([]) }) });
        seedPairingCode();
        const store = await loadStore();
        store.reviewActions.openList();
        await flushMicrotasks();
        (0, vitest_1.expect)(stateRequestCount()).toBe(1);
        await vitest_1.vi.advanceTimersByTimeAsync(2999);
        (0, vitest_1.expect)(stateRequestCount()).toBe(1);
        await vitest_1.vi.advanceTimersByTimeAsync(1);
        await flushMicrotasks();
        (0, vitest_1.expect)(stateRequestCount()).toBe(2);
        await vitest_1.vi.advanceTimersByTimeAsync(3000);
        await flushMicrotasks();
        (0, vitest_1.expect)(stateRequestCount()).toBe(3);
        store.reviewActions.closeList();
        await vitest_1.vi.advanceTimersByTimeAsync(6000);
        await flushMicrotasks();
        (0, vitest_1.expect)(stateRequestCount()).toBe(3);
    });
    (0, vitest_1.it)("keeps polling while any item is queued even with the list closed", async () => {
        routeFetch({
            "GET state": () => ({ body: statePayload([itemView({ status: "queued", actions: [] })]) }),
        });
        seedPairingCode();
        const store = await loadStore();
        store.reviewActions.openList();
        await flushMicrotasks();
        store.reviewActions.closeList();
        await vitest_1.vi.advanceTimersByTimeAsync(3000);
        await flushMicrotasks();
        (0, vitest_1.expect)(stateRequestCount()).toBe(2);
        await vitest_1.vi.advanceTimersByTimeAsync(3000);
        await flushMicrotasks();
        (0, vitest_1.expect)(stateRequestCount()).toBe(3);
    });
});
(0, vitest_1.describe)("stored pairing code", () => {
    (0, vitest_1.it)("accepts only six-digit codes", async () => {
        const store = await loadStore();
        for (const value of ["", "01234", "0123456", "abc123", "01234a", "12 456"]) {
            test.storage.set(PAIRING_CODE_KEY, value);
            (0, vitest_1.expect)(store.getStoredPairingCode()).toBe(null);
            (0, vitest_1.expect)(store.isReviewPaired()).toBe(false);
        }
        test.storage.set(PAIRING_CODE_KEY, "012345");
        (0, vitest_1.expect)(store.getStoredPairingCode()).toBe("012345");
        (0, vitest_1.expect)(store.isReviewPaired()).toBe(true);
    });
    (0, vitest_1.it)("treats an undefined storage value as absent", async () => {
        const store = await loadStore({
            storage: {
                get: () => undefined,
                set: (key, value) => {
                    test.storage.set(key, value);
                },
            },
        });
        (0, vitest_1.expect)(store.getStoredPairingCode()).toBe(null);
        (0, vitest_1.expect)(store.isReviewPaired()).toBe(false);
    });
    (0, vitest_1.it)("keeps the loaded state and code on other refresh failures", async () => {
        routeFetch({ "GET state": () => ({ body: statePayload([itemView()]) }) });
        seedPairingCode();
        const store = await loadStore();
        await store.reviewActions.refresh();
        (0, vitest_1.expect)(store.useReviewState().items).toHaveLength(1);
        fetchMock.mockReset();
        fetchMock.mockImplementation(async () => {
            throw new TypeError("network down");
        });
        await store.reviewActions.refresh();
        (0, vitest_1.expect)(test.storage.get(PAIRING_CODE_KEY)).toBe("012345");
        const state = store.useReviewState();
        (0, vitest_1.expect)(state.paired).toBe(true);
        (0, vitest_1.expect)(state.review).not.toBeNull();
        (0, vitest_1.expect)(state.items).toHaveLength(1);
        (0, vitest_1.expect)(state.error).toMatchObject({ code: "network", status: 0 });
    });
    (0, vitest_1.it)("clears a stale code with its state on a bad_code refresh", async () => {
        routeFetch({ "GET state": () => ({ body: { ok: false, error: "bad_code" }, status: 401 }) });
        seedPairingCode();
        const store = await loadStore();
        await store.reviewActions.refresh();
        (0, vitest_1.expect)(test.storage.get(PAIRING_CODE_KEY)).toBe("");
        const state = store.useReviewState();
        (0, vitest_1.expect)(state.paired).toBe(false);
        (0, vitest_1.expect)(state.review).toBeNull();
        (0, vitest_1.expect)(state.items).toEqual([]);
        (0, vitest_1.expect)(state.error).toMatchObject({ code: "bad_code", status: 401 });
    });
    (0, vitest_1.it)("clears a stale code with its state on a bad_code action", async () => {
        routeFetch({
            "POST items/1/pass": () => ({ body: { ok: false, error: "bad_code" }, status: 401 }),
        });
        seedPairingCode();
        const store = await loadStore();
        const passed = await store.reviewActions.pass(1);
        (0, vitest_1.expect)(passed).toBe(false);
        (0, vitest_1.expect)(test.storage.get(PAIRING_CODE_KEY)).toBe("");
        const state = store.useReviewState();
        (0, vitest_1.expect)(state.paired).toBe(false);
        (0, vitest_1.expect)(state.review).toBeNull();
        (0, vitest_1.expect)(state.items).toEqual([]);
        (0, vitest_1.expect)(state.error).toMatchObject({ code: "bad_code", status: 401 });
    });
    (0, vitest_1.it)("clears the error when a review surface opens", async () => {
        routeFetch({ "POST pair": () => ({ body: { ok: false, error: "bad_code" }, status: 401 }) });
        const store = await loadStore();
        await store.reviewActions.pair("000000");
        (0, vitest_1.expect)(store.useReviewState().error).toMatchObject({ code: "bad_code", status: 401 });
        store.reviewActions.openList();
        (0, vitest_1.expect)(store.useReviewState().listVisible).toBe(true);
        (0, vitest_1.expect)(store.useReviewState().error).toBeNull();
        await store.reviewActions.pair("000000");
        (0, vitest_1.expect)(store.useReviewState().error).toMatchObject({ code: "bad_code", status: 401 });
        store.reviewActions.openComposer({
            mode: "create",
            draft: { kind: "page", description: "" },
            screenshot: null,
        });
        (0, vitest_1.expect)(store.useReviewState().composer).not.toBeNull();
        (0, vitest_1.expect)(store.useReviewState().error).toBeNull();
    });
});
(0, vitest_1.describe)("stale pairing flag", () => {
    (0, vitest_1.it)("sets the flag when a stored code goes stale on a refresh", async () => {
        routeFetch({ "GET state": () => ({ body: { ok: false, error: "bad_code" }, status: 401 }) });
        seedPairingCode();
        const store = await loadStore();
        await store.reviewActions.refresh();
        (0, vitest_1.expect)(store.useReviewState().stalePairing).toBe(true);
        (0, vitest_1.expect)(store.useReviewState().error).toMatchObject({ code: "bad_code", status: 401 });
    });
    (0, vitest_1.it)("keeps the flag through openList while the error is cleared", async () => {
        routeFetch({ "GET state": () => ({ body: { ok: false, error: "bad_code" }, status: 401 }) });
        seedPairingCode();
        const store = await loadStore();
        // Mount-time refresh detects the stale code, then the panel opens.
        await store.reviewActions.refresh();
        store.reviewActions.openList();
        const state = store.useReviewState();
        (0, vitest_1.expect)(state.listVisible).toBe(true);
        (0, vitest_1.expect)(state.error).toBeNull();
        (0, vitest_1.expect)(state.stalePairing).toBe(true);
    });
    (0, vitest_1.it)("clears the flag after a successful pair", async () => {
        routeFetch({
            "POST pair": () => ({ body: { ok: true, review: reviewView() } }),
            "GET state": () => ({ body: { ok: false, error: "bad_code" }, status: 401 }),
        });
        seedPairingCode();
        const store = await loadStore();
        await store.reviewActions.refresh();
        (0, vitest_1.expect)(store.useReviewState().stalePairing).toBe(true);
        routeFetch({
            "POST pair": () => ({ body: { ok: true, review: reviewView() } }),
            "GET state": () => ({ body: statePayload([itemView()]) }),
        });
        const paired = await store.reviewActions.pair("543210");
        (0, vitest_1.expect)(paired).toBe(true);
        (0, vitest_1.expect)(store.useReviewState().stalePairing).toBe(false);
        (0, vitest_1.expect)(store.useReviewState().paired).toBe(true);
    });
    (0, vitest_1.it)("does not set the flag when a manual pairing attempt fails", async () => {
        routeFetch({ "POST pair": () => ({ body: { ok: false, error: "bad_code" }, status: 401 }) });
        const store = await loadStore();
        await store.reviewActions.pair("000000");
        (0, vitest_1.expect)(store.useReviewState().stalePairing).toBe(false);
        (0, vitest_1.expect)(store.useReviewState().error).toMatchObject({ code: "bad_code", status: 401 });
    });
});
//# sourceMappingURL=store.test.js.map