import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { REVIEW_ROUTE_PREFIX } from "../api";
import type { DeviceItemView, DeviceReviewView } from "../../../review-core/types";
import type { ReviewHost } from "../host";

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown) => getSnapshot(),
}));

vi.mock("react-native", () => ({
  NativeModules: {
    SourceCode: { getConstants: () => ({ scriptURL: "http://localhost:8081/index.bundle" }) },
  },
}));

const test = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  requests: [] as { method: string; path: string; body?: unknown }[],
}));

const fetchMock = vi.fn(
  async (input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
    throw new Error(`unexpected fetch ${String(input)}`);
  },
);

const SERVER_URL = "http://localhost:8081";
const PAIRING_CODE_KEY = "rnGrabReview.pairingCode";

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status });

const reviewView = (): DeviceReviewView => ({
  id: "20261111-080000",
  base: "feature/liquidGlass",
  branch: "fix/design-review-20261111-0800",
  status: "active",
  mrUrl: null,
});

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
  route: "Home",
  device: null,
  revertCommit: null,
  lastError: null,
  createdAt: "2026-11-11T08:00:00.000Z",
  actions: ["edit", "delete"],
  ...overrides,
});

const statePayload = (items: DeviceItemView[]) => ({
  ok: true,
  review: reviewView(),
  items,
  runner: { busy: false, blocked: false },
});

type RouteHandler = () => { body: unknown; status?: number };

const routeFetch = (routes: Record<string, RouteHandler>): void => {
  fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input).slice(`${SERVER_URL}${REVIEW_ROUTE_PREFIX}`.length);
    const method = init?.method ?? "GET";
    test.requests.push({
      method,
      path,
      body: typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : undefined,
    });
    const route = routes[`${method} ${path}`];
    if (route === undefined) {
      throw new Error(`unexpected review request ${method} ${path}`);
    }
    const { body, status } = route();
    return jsonResponse(body, status);
  });
};

const stateRequestCount = (): number => test.requests.filter((r) => r.path === "state").length;

const findRequest = (method: string, path: string) =>
  test.requests.find((r) => r.method === method && r.path === path);

const memoryStorage = (): ReviewHost["storage"] => ({
  get: (key: string) => test.storage.get(key) ?? null,
  set: (key: string, value: string) => {
    test.storage.set(key, value);
  },
});

const loadStore = async (host: ReviewHost = { storage: memoryStorage() }) => {
  const hostModule = await vi.importActual<typeof import("../host")>("../host");
  hostModule.configureReview(host);
  return vi.importActual<typeof import("../store")>("../store");
};

const seedPairingCode = (): void => {
  test.storage.set(PAIRING_CODE_KEY, "012345");
};

const flushMicrotasks = async (): Promise<void> => {
  for (let i = 0; i < 10; i += 1) {
    await Promise.resolve();
  }
};

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  test.storage.clear();
  test.requests.length = 0;
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("review store", () => {
  it("pairs by storing the code in host storage and loading the state", async () => {
    routeFetch({
      "POST pair": () => ({ body: { ok: true, review: reviewView() } }),
      "GET state": () => ({ body: statePayload([itemView()]) }),
    });
    const store = await loadStore();

    expect(store.isReviewPaired()).toBe(false);

    const paired = await store.reviewActions.pair("012345");

    expect(paired).toBe(true);
    expect(test.storage.get(PAIRING_CODE_KEY)).toBe("012345");
    expect(store.isReviewPaired()).toBe(true);

    const state = store.useReviewState();
    expect(state.paired).toBe(true);
    expect(state.review).toEqual(reviewView());
    expect(state.items).toEqual([itemView()]);
    expect(state.runner).toEqual({ busy: false, blocked: false });
  });

  it("refresh loads items for an already stored pairing code", async () => {
    routeFetch({
      "GET state": () => ({ body: statePayload([itemView({ status: "queued", actions: [] })]) }),
    });
    seedPairingCode();
    const store = await loadStore();

    await store.reviewActions.refresh();

    const state = store.useReviewState();
    expect(state.paired).toBe(true);
    expect(state.review).toEqual(reviewView());
    expect(state.items).toHaveLength(1);
    expect(state.items[0].status).toBe("queued");
  });

  it("keeps the device unpaired with an error when pairing is rejected", async () => {
    routeFetch({ "POST pair": () => ({ body: { ok: false, error: "bad_code" }, status: 401 }) });
    const store = await loadStore();

    const paired = await store.reviewActions.pair("000000");

    expect(paired).toBe(false);
    expect(test.storage.has(PAIRING_CODE_KEY)).toBe(false);
    const state = store.useReviewState();
    expect(state.paired).toBe(false);
    expect(state.review).toBeNull();
    expect(state.error).toMatchObject({ code: "bad_code", status: 401 });
  });

  it("normalizes transport failures into a network error", async () => {
    fetchMock.mockImplementation(async () => {
      throw new TypeError("network down");
    });
    seedPairingCode();
    const store = await loadStore();

    await store.reviewActions.refresh();

    expect(store.useReviewState().error).toMatchObject({ code: "network", status: 0 });
  });

  it("saveComposer in create mode posts the item without screenshotJpegBase64 when there is no screenshot", async () => {
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

    expect(saved).toBe(true);
    const post = findRequest("POST", "items");
    expect(post?.body).not.toHaveProperty("screenshotJpegBase64");
    expect(post?.body).toMatchObject({
      kind: "element",
      description: "标题字号应为 16",
      scope: "local",
      rect: { x: 10, y: 73, width: 50, height: 20 },
    });
    expect(store.useReviewState().composer).toBeNull();
  });

  it("saveComposer attaches host device info to created items", async () => {
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

    expect(findRequest("POST", "items")?.body).toMatchObject({
      device: { model: "iPhone 17 Pro", os: "iOS 26.0", appVersion: "5.4.0" },
    });
  });

  it("saveComposer edits the item held by the composer", async () => {
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

    expect(saved).toBe(true);
    expect(findRequest("PATCH", "items/1")?.body).toEqual({
      description: "改为 18",
      scope: "shared",
    });
    expect(store.useReviewState().composer).toBeNull();
  });

  it("saveComposer rejects an item with the supplement", async () => {
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

    expect(saved).toBe(true);
    expect(findRequest("POST", "items/1/reject")?.body).toEqual({ supplement: "间距还是不对" });
    expect(store.useReviewState().composer).toBeNull();
  });

  it("keeps the composer open with the error when saving fails", async () => {
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
    } as const;
    store.reviewActions.openComposer(composer);

    const saved = await store.reviewActions.saveComposer({ description: "   " });

    expect(saved).toBe(false);
    const state = store.useReviewState();
    expect(state.composer).toEqual(composer);
    expect(state.error).toMatchObject({ code: "empty_text", status: 400 });
  });

  it("submits, passes, rejects, reverts, removes and finishes through the API", async () => {
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

    expect(await store.reviewActions.submit()).toBe(true);
    expect(await store.reviewActions.pass(1)).toBe(true);
    expect(await store.reviewActions.reject(1, "还是不对")).toBe(true);
    expect(await store.reviewActions.revert(1)).toBe(true);
    expect(await store.reviewActions.remove(1)).toBe(true);
    expect(await store.reviewActions.finish()).toBe(true);

    const requested = test.requests.map((r) => `${r.method} ${r.path}`);
    expect(requested).toContain("POST submit");
    expect(requested).toContain("POST items/1/pass");
    expect(requested).toContain("POST items/1/reject");
    expect(requested).toContain("POST items/1/revert");
    expect(requested).toContain("DELETE items/1");
    expect(requested).toContain("POST finish");
    expect(stateRequestCount()).toBeGreaterThanOrEqual(6);
  });

  it("refreshes the state when the list opens", async () => {
    routeFetch({ "GET state": () => ({ body: statePayload([]) }) });
    seedPairingCode();
    const store = await loadStore();

    store.reviewActions.openList();
    await flushMicrotasks();

    expect(store.useReviewState().listVisible).toBe(true);
    expect(stateRequestCount()).toBe(1);

    store.reviewActions.closeList();
    expect(store.useReviewState().listVisible).toBe(false);
  });

  it("does not fetch state while unpaired when the list opens", async () => {
    const store = await loadStore();

    store.reviewActions.openList();
    await flushMicrotasks();

    expect(store.useReviewState().listVisible).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("polls state every 3000 ms while the list is visible", async () => {
    routeFetch({ "GET state": () => ({ body: statePayload([]) }) });
    seedPairingCode();
    const store = await loadStore();

    store.reviewActions.openList();
    await flushMicrotasks();
    expect(stateRequestCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(2999);
    expect(stateRequestCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(1);
    await flushMicrotasks();
    expect(stateRequestCount()).toBe(2);

    await vi.advanceTimersByTimeAsync(3000);
    await flushMicrotasks();
    expect(stateRequestCount()).toBe(3);

    store.reviewActions.closeList();
    await vi.advanceTimersByTimeAsync(6000);
    await flushMicrotasks();
    expect(stateRequestCount()).toBe(3);
  });

  it("keeps polling while any item is queued even with the list closed", async () => {
    routeFetch({
      "GET state": () => ({ body: statePayload([itemView({ status: "queued", actions: [] })]) }),
    });
    seedPairingCode();
    const store = await loadStore();

    store.reviewActions.openList();
    await flushMicrotasks();
    store.reviewActions.closeList();

    await vi.advanceTimersByTimeAsync(3000);
    await flushMicrotasks();
    expect(stateRequestCount()).toBe(2);

    await vi.advanceTimersByTimeAsync(3000);
    await flushMicrotasks();
    expect(stateRequestCount()).toBe(3);
  });
});
