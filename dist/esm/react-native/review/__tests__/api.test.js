import { beforeEach, describe, expect, it, vi } from "vitest";
import { createReviewApi, ReviewApiError } from "../api";
const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), { status });
const fetchImpl = vi.fn(async (_url, _init) => jsonResponse({ ok: true }));
const makeApi = (options) => createReviewApi({
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
describe("createReviewApi", () => {
    beforeEach(() => {
        fetchImpl.mockClear();
    });
    it("sends the pairing code header on device requests", async () => {
        fetchImpl.mockImplementation(async () => jsonResponse({
            ok: true,
            review: REVIEW,
            items: [makeItem()],
            runner: { busy: false, blocked: false },
        }));
        await makeApi().state();
        expect(fetchImpl).toHaveBeenCalledTimes(1);
        const [url, init] = fetchImpl.mock.calls[0];
        expect(url).toBe("http://localhost:8081/__react-native-grab/review/state");
        expect(init?.method).toBe("GET");
        expect(init?.headers).toMatchObject({ "x-rn-grab-review-code": "012345" });
    });
    it("accepts base URLs without a trailing slash", async () => {
        fetchImpl.mockImplementation(async () => jsonResponse({
            ok: true,
            review: REVIEW,
            items: [],
            runner: { busy: false, blocked: false },
        }));
        await makeApi({ baseUrl: "http://192.168.0.10:8081" }).state();
        expect(fetchImpl.mock.calls[0][0]).toBe("http://192.168.0.10:8081/__react-native-grab/review/state");
    });
    it("maps {ok:false,error} responses to ReviewApiError", async () => {
        fetchImpl.mockImplementation(async () => jsonResponse({ ok: false, error: "bad_code" }, 401));
        const error = await captureError(() => makeApi().state());
        expect(error).toBeInstanceOf(ReviewApiError);
        expect(error).toMatchObject({ code: "bad_code", status: 401 });
    });
    it("pairs by posting the code and returns the review view", async () => {
        fetchImpl.mockImplementation(async () => jsonResponse({ ok: true, review: REVIEW }));
        const review = await makeApi().pair("012345");
        const [url, init] = fetchImpl.mock.calls[0];
        expect(url).toBe("http://localhost:8081/__react-native-grab/review/pair");
        expect(init?.method).toBe("POST");
        expect(JSON.parse(String(init?.body))).toEqual({ code: "012345" });
        expect(review).toEqual(REVIEW);
    });
    it("returns review, items and runner from state", async () => {
        const item = makeItem();
        fetchImpl.mockImplementation(async () => jsonResponse({
            ok: true,
            review: REVIEW,
            items: [item],
            runner: { busy: true, blocked: false },
        }));
        const payload = await makeApi().state();
        expect(payload).toEqual({
            review: REVIEW,
            items: [item],
            runner: { busy: true, blocked: false },
        });
    });
    it("creates items without screenshotJpegBase64 when no screenshot is given", async () => {
        fetchImpl.mockImplementation(async () => jsonResponse({ ok: true, item: makeItem() }, 201));
        await makeApi().createItem({ kind: "element", description: "标题字号应为 16" }, null);
        const [, init] = fetchImpl.mock.calls[0];
        expect(init?.method).toBe("POST");
        expect(JSON.parse(String(init?.body))).toEqual({
            kind: "element",
            description: "标题字号应为 16",
        });
    });
    it("creates items with the screenshot payload when provided", async () => {
        fetchImpl.mockImplementation(async () => jsonResponse({ ok: true, item: makeItem() }, 201));
        await makeApi().createItem({ kind: "page", description: "整页问题" }, "aGVsbG8=");
        const [url, init] = fetchImpl.mock.calls[0];
        expect(url).toBe("http://localhost:8081/__react-native-grab/review/items");
        expect(JSON.parse(String(init?.body))).toEqual({
            kind: "page",
            description: "整页问题",
            screenshotJpegBase64: "aGVsbG8=",
        });
    });
    it("updates a draft with PATCH", async () => {
        fetchImpl.mockImplementation(async () => jsonResponse({ ok: true, item: makeItem() }));
        await makeApi().updateItem(1, { description: "改为 18", scope: "shared", figmaUrl: null });
        const [url, init] = fetchImpl.mock.calls[0];
        expect(url).toBe("http://localhost:8081/__react-native-grab/review/items/1");
        expect(init?.method).toBe("PATCH");
        expect(JSON.parse(String(init?.body))).toEqual({
            description: "改为 18",
            scope: "shared",
            figmaUrl: null,
        });
    });
    it("deletes a draft", async () => {
        fetchImpl.mockImplementation(async () => jsonResponse({ ok: true }));
        await makeApi().deleteItem(1);
        const [url, init] = fetchImpl.mock.calls[0];
        expect(url).toBe("http://localhost:8081/__react-native-grab/review/items/1");
        expect(init?.method).toBe("DELETE");
    });
    it("submits drafts and returns the submitted numbers", async () => {
        fetchImpl.mockImplementation(async () => jsonResponse({ ok: true, submitted: [1, 2] }));
        const submitted = await makeApi().submit();
        const [url, init] = fetchImpl.mock.calls[0];
        expect(url).toBe("http://localhost:8081/__react-native-grab/review/submit");
        expect(init?.method).toBe("POST");
        expect(submitted).toEqual([1, 2]);
    });
    it("passes, rejects and reverts items on their sub-routes", async () => {
        fetchImpl.mockImplementation(async () => jsonResponse({ ok: true, item: makeItem() }));
        const api = makeApi();
        await api.pass(1);
        expect(fetchImpl.mock.calls[0][0]).toBe("http://localhost:8081/__react-native-grab/review/items/1/pass");
        expect(fetchImpl.mock.calls[0][1]?.method).toBe("POST");
        await api.reject(1, "间距还是不对");
        expect(fetchImpl.mock.calls[1][0]).toBe("http://localhost:8081/__react-native-grab/review/items/1/reject");
        expect(JSON.parse(String(fetchImpl.mock.calls[1][1]?.body))).toEqual({
            supplement: "间距还是不对",
        });
        await api.revert(1);
        expect(fetchImpl.mock.calls[2][0]).toBe("http://localhost:8081/__react-native-grab/review/items/1/revert");
    });
    it("finishes the review", async () => {
        fetchImpl.mockImplementation(async () => jsonResponse({ ok: true }));
        await makeApi().finish();
        const [url, init] = fetchImpl.mock.calls[0];
        expect(url).toBe("http://localhost:8081/__react-native-grab/review/finish");
        expect(init?.method).toBe("POST");
    });
});
//# sourceMappingURL=api.test.js.map