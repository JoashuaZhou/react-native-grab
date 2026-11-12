"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const api_1 = require("../api");
const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), { status });
const fetchImpl = vitest_1.vi.fn(async (_url, _init) => jsonResponse({ ok: true }));
const makeApi = (options) => (0, api_1.createReviewApi)({
    baseUrl: options?.baseUrl ?? "http://localhost:8081/",
    code: options?.code ?? "012345",
    fetchImpl,
});
const captureError = async (run) => {
    try {
        await run();
    }
    catch (error) {
        return error;
    }
    throw new Error("expected the request to reject");
};
const REVIEW = {
    id: "20261111-080000",
    base: "feature/liquidGlass",
    branch: "fix/design-review-20261111-0800",
    status: "active",
    mrUrl: null,
};
const makeItem = () => ({
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
    actions: ["edit", "delete"],
});
(0, vitest_1.describe)("createReviewApi", () => {
    (0, vitest_1.beforeEach)(() => {
        fetchImpl.mockClear();
    });
    (0, vitest_1.it)("sends the pairing code header on device requests", async () => {
        fetchImpl.mockImplementation(async () => jsonResponse({
            ok: true,
            review: REVIEW,
            items: [makeItem()],
            runner: { busy: false, blocked: false },
        }));
        await makeApi().state();
        (0, vitest_1.expect)(fetchImpl).toHaveBeenCalledTimes(1);
        const [url, init] = fetchImpl.mock.calls[0];
        (0, vitest_1.expect)(url).toBe("http://localhost:8081/__react-native-grab/review/state");
        (0, vitest_1.expect)(init?.method).toBe("GET");
        (0, vitest_1.expect)(init?.headers).toMatchObject({ "x-rn-grab-review-code": "012345" });
    });
    (0, vitest_1.it)("accepts base URLs without a trailing slash", async () => {
        fetchImpl.mockImplementation(async () => jsonResponse({
            ok: true,
            review: REVIEW,
            items: [],
            runner: { busy: false, blocked: false },
        }));
        await makeApi({ baseUrl: "http://192.168.0.10:8081" }).state();
        (0, vitest_1.expect)(fetchImpl.mock.calls[0][0]).toBe("http://192.168.0.10:8081/__react-native-grab/review/state");
    });
    (0, vitest_1.it)("maps {ok:false,error} responses to ReviewApiError", async () => {
        fetchImpl.mockImplementation(async () => jsonResponse({ ok: false, error: "bad_code" }, 401));
        const error = await captureError(() => makeApi().state());
        (0, vitest_1.expect)(error).toBeInstanceOf(api_1.ReviewApiError);
        (0, vitest_1.expect)(error).toMatchObject({ code: "bad_code", status: 401 });
    });
    (0, vitest_1.it)("pairs by posting the code and returns the review view", async () => {
        fetchImpl.mockImplementation(async () => jsonResponse({ ok: true, review: REVIEW }));
        const review = await makeApi().pair("012345");
        const [url, init] = fetchImpl.mock.calls[0];
        (0, vitest_1.expect)(url).toBe("http://localhost:8081/__react-native-grab/review/pair");
        (0, vitest_1.expect)(init?.method).toBe("POST");
        (0, vitest_1.expect)(JSON.parse(String(init?.body))).toEqual({ code: "012345" });
        (0, vitest_1.expect)(review).toEqual(REVIEW);
    });
    (0, vitest_1.it)("returns review, items and runner from state", async () => {
        const item = makeItem();
        fetchImpl.mockImplementation(async () => jsonResponse({
            ok: true,
            review: REVIEW,
            items: [item],
            runner: { busy: true, blocked: false },
        }));
        const payload = await makeApi().state();
        (0, vitest_1.expect)(payload).toEqual({
            review: REVIEW,
            items: [item],
            runner: { busy: true, blocked: false },
        });
    });
    (0, vitest_1.it)("creates items without screenshotJpegBase64 when no screenshot is given", async () => {
        fetchImpl.mockImplementation(async () => jsonResponse({ ok: true, item: makeItem() }, 201));
        await makeApi().createItem({ kind: "element", description: "标题字号应为 16" }, null);
        const [, init] = fetchImpl.mock.calls[0];
        (0, vitest_1.expect)(init?.method).toBe("POST");
        (0, vitest_1.expect)(JSON.parse(String(init?.body))).toEqual({
            kind: "element",
            description: "标题字号应为 16",
        });
    });
    (0, vitest_1.it)("creates items with the screenshot payload when provided", async () => {
        fetchImpl.mockImplementation(async () => jsonResponse({ ok: true, item: makeItem() }, 201));
        await makeApi().createItem({ kind: "page", description: "整页问题" }, "aGVsbG8=");
        const [url, init] = fetchImpl.mock.calls[0];
        (0, vitest_1.expect)(url).toBe("http://localhost:8081/__react-native-grab/review/items");
        (0, vitest_1.expect)(JSON.parse(String(init?.body))).toEqual({
            kind: "page",
            description: "整页问题",
            screenshotJpegBase64: "aGVsbG8=",
        });
    });
    (0, vitest_1.it)("updates a draft with PATCH", async () => {
        fetchImpl.mockImplementation(async () => jsonResponse({ ok: true, item: makeItem() }));
        await makeApi().updateItem(1, { description: "改为 18", scope: "shared", figmaUrl: null });
        const [url, init] = fetchImpl.mock.calls[0];
        (0, vitest_1.expect)(url).toBe("http://localhost:8081/__react-native-grab/review/items/1");
        (0, vitest_1.expect)(init?.method).toBe("PATCH");
        (0, vitest_1.expect)(JSON.parse(String(init?.body))).toEqual({
            description: "改为 18",
            scope: "shared",
            figmaUrl: null,
        });
    });
    (0, vitest_1.it)("deletes a draft", async () => {
        fetchImpl.mockImplementation(async () => jsonResponse({ ok: true }));
        await makeApi().deleteItem(1);
        const [url, init] = fetchImpl.mock.calls[0];
        (0, vitest_1.expect)(url).toBe("http://localhost:8081/__react-native-grab/review/items/1");
        (0, vitest_1.expect)(init?.method).toBe("DELETE");
    });
    (0, vitest_1.it)("submits drafts and returns the submitted numbers", async () => {
        fetchImpl.mockImplementation(async () => jsonResponse({ ok: true, submitted: [1, 2] }));
        const submitted = await makeApi().submit();
        const [url, init] = fetchImpl.mock.calls[0];
        (0, vitest_1.expect)(url).toBe("http://localhost:8081/__react-native-grab/review/submit");
        (0, vitest_1.expect)(init?.method).toBe("POST");
        (0, vitest_1.expect)(submitted).toEqual([1, 2]);
    });
    (0, vitest_1.it)("passes, rejects and reverts items on their sub-routes", async () => {
        fetchImpl.mockImplementation(async () => jsonResponse({ ok: true, item: makeItem() }));
        const api = makeApi();
        await api.pass(1);
        (0, vitest_1.expect)(fetchImpl.mock.calls[0][0]).toBe("http://localhost:8081/__react-native-grab/review/items/1/pass");
        (0, vitest_1.expect)(fetchImpl.mock.calls[0][1]?.method).toBe("POST");
        await api.reject(1, "间距还是不对");
        (0, vitest_1.expect)(fetchImpl.mock.calls[1][0]).toBe("http://localhost:8081/__react-native-grab/review/items/1/reject");
        (0, vitest_1.expect)(JSON.parse(String(fetchImpl.mock.calls[1][1]?.body))).toEqual({
            supplement: "间距还是不对",
        });
        await api.revert(1);
        (0, vitest_1.expect)(fetchImpl.mock.calls[2][0]).toBe("http://localhost:8081/__react-native-grab/review/items/1/revert");
    });
    (0, vitest_1.it)("finishes the review", async () => {
        fetchImpl.mockImplementation(async () => jsonResponse({ ok: true }));
        await makeApi().finish();
        const [url, init] = fetchImpl.mock.calls[0];
        (0, vitest_1.expect)(url).toBe("http://localhost:8081/__react-native-grab/review/finish");
        (0, vitest_1.expect)(init?.method).toBe("POST");
    });
});
//# sourceMappingURL=api.test.js.map