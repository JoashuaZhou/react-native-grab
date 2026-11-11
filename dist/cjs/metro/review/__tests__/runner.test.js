"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_child_process_1 = require("node:child_process");
const node_fs_1 = require("node:fs");
const node_os_1 = require("node:os");
const node_path_1 = require("node:path");
const vitest_1 = require("vitest");
const fixtures_1 = require("../../../review-core/__tests__/fixtures");
const transitions_1 = require("../../../review-core/transitions");
const withReactNativeGrab_1 = require("../../withReactNativeGrab");
const http_1 = require("../http");
const module_1 = require("../module");
const runner_1 = require("../runner");
const store_1 = require("../store");
let root;
(0, vitest_1.beforeEach)(() => {
    root = (0, node_fs_1.mkdtempSync)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "rn-grab-runner-"));
});
(0, vitest_1.afterEach)(() => {
    delete process.env.RN_GRAB_REVIEW_DIR;
    (0, node_fs_1.rmSync)(root, { recursive: true, force: true });
});
const setupRunner = (review, makeRun, options) => {
    const store = store_1.ReviewStore.create((0, node_fs_1.mkdtempSync)((0, node_path_1.join)(root, "review-")), review);
    let runner;
    const run = makeRun({ store, runner: () => runner });
    const created = new runner_1.AgentRunner({
        store,
        git: { hasNetDiff: options?.hasNetDiff ?? (async () => false) },
        run,
        lock: {
            write: vitest_1.vi.fn(),
            clear: vitest_1.vi.fn(),
            livePid: options?.livePid ?? (() => null),
        },
        log: vitest_1.vi.fn(),
    });
    runner = created;
    return { store, runner: created };
};
const fixItems = (store, ...nos) => {
    for (const no of nos) {
        store.update((review) => (0, transitions_1.replyItem)((0, transitions_1.claimItem)(review, no), no, "已修复", [`sha${no}`], fixtures_1.LATER));
    }
};
const submitNewItem = (store) => {
    const created = store.update((review) => (0, transitions_1.createItem)(review, { ...(0, fixtures_1.makeItemInput)() }, fixtures_1.NOW).review);
    store.update((review) => (0, transitions_1.submitDrafts)(review, fixtures_1.LATER).review);
    return created.items[created.items.length - 1].no;
};
const expectRunnerBusy = async (promise) => {
    const error = await promise.then(() => {
        throw new Error("expected the call to reject with runner_busy");
    }, (rejection) => rejection);
    (0, vitest_1.expect)(error).toBeInstanceOf(transitions_1.ReviewError);
    (0, vitest_1.expect)(error.code).toBe("runner_busy");
};
const readStoredReview = (dir) => JSON.parse((0, node_fs_1.readFileSync)((0, node_path_1.join)(dir, "review.json"), "utf8"));
(0, vitest_1.describe)("nextWork", () => {
    (0, vitest_1.it)("collects queued and fixing items as fix work with the reverted numbers", () => {
        const first = (0, transitions_1.submitDrafts)((0, transitions_1.createItem)((0, fixtures_1.makeReview)(), { ...(0, fixtures_1.makeItemInput)() }, fixtures_1.NOW).review, fixtures_1.LATER).review;
        const second = (0, transitions_1.submitDrafts)((0, transitions_1.createItem)(first, { ...(0, fixtures_1.makeItemInput)() }, fixtures_1.NOW).review, fixtures_1.LATER).review;
        const review = { ...(0, transitions_1.claimItem)(second, 1), revertedSinceLastRun: [4] };
        (0, vitest_1.expect)((0, runner_1.nextWork)(review)).toEqual({ kind: "fix", items: [1, 2], reverted: [4] });
    });
    (0, vitest_1.it)("returns null for an active review without queued or fixing items", () => {
        (0, vitest_1.expect)((0, runner_1.nextWork)((0, fixtures_1.makeReview)())).toBeNull();
        (0, vitest_1.expect)((0, runner_1.nextWork)((0, fixtures_1.awaiting)())).toBeNull();
        (0, vitest_1.expect)((0, runner_1.nextWork)((0, fixtures_1.passed)())).toBeNull();
    });
    (0, vitest_1.it)("returns finish work while finishing and null once the review is closed", () => {
        (0, vitest_1.expect)((0, runner_1.nextWork)((0, transitions_1.beginFinish)((0, fixtures_1.passed)()))).toEqual({ kind: "finish" });
        (0, vitest_1.expect)((0, runner_1.nextWork)((0, transitions_1.completeReview)((0, transitions_1.beginFinish)((0, fixtures_1.passed)()), null))).toBeNull();
        (0, vitest_1.expect)((0, runner_1.nextWork)((0, transitions_1.abandonReview)((0, fixtures_1.makeReview)()))).toBeNull();
    });
});
(0, vitest_1.describe)("buildAgentMessage", () => {
    (0, vitest_1.it)("lists fix items, reverted items with 不要恢复 and the design-review skill", () => {
        const message = (0, runner_1.buildAgentMessage)({ kind: "fix", items: [1, 2], reverted: [3] }, (0, fixtures_1.makeReview)());
        (0, vitest_1.expect)(message).toContain("#1");
        (0, vitest_1.expect)(message).toContain("#2");
        (0, vitest_1.expect)(message).toContain("#3");
        (0, vitest_1.expect)(message).toContain("不要恢复");
        (0, vitest_1.expect)(message).toContain("design-review skill");
    });
    (0, vitest_1.it)("names the branch, the base and the complete command for finish work", () => {
        const review = (0, fixtures_1.makeReview)();
        const message = (0, runner_1.buildAgentMessage)({ kind: "finish" }, review);
        (0, vitest_1.expect)(message).toContain(review.branch);
        (0, vitest_1.expect)(message).toContain(review.base);
        (0, vitest_1.expect)(message).toContain("npx rn-grab-review complete --mr");
    });
});
(0, vitest_1.describe)("createAgentLock", () => {
    (0, vitest_1.it)("round-trips a live pid and clears the lock", () => {
        const lock = (0, runner_1.createAgentLock)((0, node_path_1.join)(root, "agent.lock"));
        (0, vitest_1.expect)(lock.livePid()).toBeNull();
        lock.write(process.pid);
        (0, vitest_1.expect)(lock.livePid()).toBe(process.pid);
        lock.clear();
        (0, vitest_1.expect)(lock.livePid()).toBeNull();
        (0, vitest_1.expect)((0, node_fs_1.existsSync)((0, node_path_1.join)(root, "agent.lock"))).toBe(false);
    });
    (0, vitest_1.it)("treats junk and dead pids as absent", async () => {
        const lockFile = (0, node_path_1.join)(root, "agent.lock");
        const lock = (0, runner_1.createAgentLock)(lockFile);
        (0, node_fs_1.writeFileSync)(lockFile, "junk", "utf8");
        (0, vitest_1.expect)(lock.livePid()).toBeNull();
        const child = (0, node_child_process_1.spawn)(process.execPath, ["-e", "process.exit(0)"]);
        const pid = child.pid;
        await new Promise((resolve) => {
            child.on("exit", () => resolve());
        });
        lock.write(pid);
        (0, vitest_1.expect)(lock.livePid()).toBeNull();
    });
});
(0, vitest_1.describe)("AgentRunner", () => {
    (0, vitest_1.it)("spawns exactly one follow-up run for a submit during a run", async () => {
        const messages = [];
        const { store, runner } = setupRunner((0, fixtures_1.queued)(), ({ store, runner }) => async (message) => {
            messages.push(message);
            if (messages.length === 1) {
                fixItems(store, 1);
                submitNewItem(store);
                runner().kick();
                await new Promise((resolve) => setTimeout(resolve, 10));
                (0, vitest_1.expect)(messages).toHaveLength(1);
            }
            else {
                fixItems(store, 2);
            }
            return { exitCode: 0 };
        });
        runner.kick();
        await runner.whenIdle();
        (0, vitest_1.expect)(messages).toHaveLength(2);
        (0, vitest_1.expect)(messages[0]).toContain("#1");
        (0, vitest_1.expect)(messages[1]).toContain("#2");
        (0, vitest_1.expect)(messages[1]).not.toContain("#1");
        (0, vitest_1.expect)(store.get().items.map((item) => item.status)).toEqual([
            "awaiting_review",
            "awaiting_review",
        ]);
    });
    (0, vitest_1.it)("returns unreplied items to queued with lastError and blocks after two runs", async () => {
        const messages = [];
        const { store, runner } = setupRunner((0, fixtures_1.queued)(), ({ store }) => async (message) => {
            messages.push(message);
            if (messages.length <= 2) {
                store.update((review) => (0, transitions_1.claimItem)(review, 1));
            }
            else {
                fixItems(store, 1);
            }
            return { exitCode: 0 };
        });
        runner.kick();
        await runner.whenIdle();
        (0, vitest_1.expect)(messages).toHaveLength(2);
        (0, vitest_1.expect)(runner.blocked).toBe(true);
        (0, vitest_1.expect)(store.get().items[0].status).toBe("queued");
        (0, vitest_1.expect)(store.get().items[0].lastError).toBe("agent 运行结束时该条仍在修复中");
        runner.unblock();
        await runner.whenIdle();
        (0, vitest_1.expect)(messages).toHaveLength(3);
        (0, vitest_1.expect)(runner.blocked).toBe(false);
    });
    (0, vitest_1.it)("waits for a live orphan pid before spawning and reports busy", async () => {
        vitest_1.vi.useFakeTimers();
        try {
            let livePid = 4242;
            const messages = [];
            const { store, runner } = setupRunner((0, fixtures_1.queued)(), ({ store }) => async (message) => {
                messages.push(message);
                fixItems(store, 1);
                return { exitCode: 0 };
            }, { livePid: () => livePid });
            runner.kick();
            (0, vitest_1.expect)(messages).toHaveLength(0);
            (0, vitest_1.expect)(runner.busy).toBe(true);
            const exclusive = vitest_1.vi.fn(async () => "ran");
            await expectRunnerBusy(runner.runExclusive(exclusive));
            (0, vitest_1.expect)(exclusive).not.toHaveBeenCalled();
            livePid = null;
            await vitest_1.vi.advanceTimersByTimeAsync(5000);
            await runner.whenIdle();
            (0, vitest_1.expect)(messages).toHaveLength(1);
            (0, vitest_1.expect)(runner.busy).toBe(false);
            (0, vitest_1.expect)(store.get().items[0].status).toBe("awaiting_review");
        }
        finally {
            vitest_1.vi.useRealTimers();
        }
    });
    (0, vitest_1.it)("completes a finishing review without net diff and without spawning", async () => {
        const messages = [];
        const { store, runner } = setupRunner((0, transitions_1.beginFinish)((0, fixtures_1.passed)()), () => async (message) => {
            messages.push(message);
            return { exitCode: 0 };
        }, { hasNetDiff: async () => false });
        runner.kick();
        await runner.whenIdle();
        (0, vitest_1.expect)(messages).toHaveLength(0);
        (0, vitest_1.expect)(store.get().status).toBe("done");
        (0, vitest_1.expect)(store.get().mrUrl).toBeNull();
        (0, vitest_1.expect)(runner.busy).toBe(false);
    });
    (0, vitest_1.it)("spawns a finish run when there is a net diff", async () => {
        const messages = [];
        const { store, runner } = setupRunner((0, transitions_1.beginFinish)((0, fixtures_1.passed)()), ({ store }) => async (message) => {
            messages.push(message);
            store.update((review) => (0, transitions_1.completeReview)(review, "https://gitlab/mr/9"));
            return { exitCode: 0 };
        }, { hasNetDiff: async () => true });
        runner.kick();
        await runner.whenIdle();
        (0, vitest_1.expect)(messages).toHaveLength(1);
        (0, vitest_1.expect)(messages[0]).toContain("npx rn-grab-review complete --mr");
        (0, vitest_1.expect)(store.get().status).toBe("done");
        (0, vitest_1.expect)(store.get().mrUrl).toBe("https://gitlab/mr/9");
    });
    (0, vitest_1.it)("rejects runExclusive during an agent run without executing the callback", async () => {
        const messages = [];
        const { runner } = setupRunner((0, fixtures_1.queued)(), ({ store, runner }) => async (message) => {
            messages.push(message);
            const exclusive = vitest_1.vi.fn(async () => "ran");
            await expectRunnerBusy(runner().runExclusive(exclusive));
            (0, vitest_1.expect)(exclusive).not.toHaveBeenCalled();
            fixItems(store, 1);
            return { exitCode: 0 };
        });
        runner.kick();
        await runner.whenIdle();
        (0, vitest_1.expect)(messages).toHaveLength(1);
    });
    (0, vitest_1.it)("defers spawns during an exclusive section and announces reverted items", async () => {
        const messages = [];
        const { store, runner } = setupRunner((0, transitions_1.markReverted)((0, fixtures_1.awaiting)(), 1, null), ({ store }) => async (message) => {
            messages.push(message);
            fixItems(store, 2);
            return { exitCode: 0 };
        });
        let release;
        const exclusive = runner.runExclusive(async () => {
            await new Promise((resolve) => {
                release = resolve;
            });
            return "ok";
        });
        (0, vitest_1.expect)(runner.busy).toBe(true);
        submitNewItem(store);
        runner.kick();
        await new Promise((resolve) => setTimeout(resolve, 10));
        (0, vitest_1.expect)(messages).toHaveLength(0);
        release();
        await (0, vitest_1.expect)(exclusive).resolves.toBe("ok");
        await runner.whenIdle();
        (0, vitest_1.expect)(messages).toHaveLength(1);
        (0, vitest_1.expect)(messages[0]).toContain("#2");
        (0, vitest_1.expect)(messages[0]).toContain("#1");
        (0, vitest_1.expect)(messages[0]).toContain("不要恢复");
        (0, vitest_1.expect)(store.get().revertedSinceLastRun).toEqual([]);
    });
    (0, vitest_1.it)("rejects nested exclusive sections without executing the inner callback", async () => {
        const { runner } = setupRunner((0, fixtures_1.makeReview)(), () => async () => ({ exitCode: 0 }));
        const inner = vitest_1.vi.fn(async () => "inner");
        const result = await runner.runExclusive(async () => {
            await expectRunnerBusy(runner.runExclusive(inner));
            (0, vitest_1.expect)(inner).not.toHaveBeenCalled();
            return 42;
        });
        (0, vitest_1.expect)(result).toBe(42);
        await runner.whenIdle();
    });
    (0, vitest_1.it)("releases after a throwing exclusive callback and keeps spawning on later kicks", async () => {
        const messages = [];
        const { store, runner } = setupRunner((0, fixtures_1.queued)(), ({ store }) => async (message) => {
            messages.push(message);
            const open = store
                .get()
                .items.filter((item) => item.status === "queued" || item.status === "fixing")
                .map((item) => item.no);
            fixItems(store, ...open);
            return { exitCode: 0 };
        });
        const exclusive = runner.runExclusive(async () => {
            throw new Error("boom");
        });
        await (0, vitest_1.expect)(exclusive).rejects.toThrow("boom");
        await runner.whenIdle();
        (0, vitest_1.expect)(messages).toHaveLength(1);
        submitNewItem(store);
        runner.kick();
        await runner.whenIdle();
        (0, vitest_1.expect)(messages).toHaveLength(2);
        (0, vitest_1.expect)(runner.busy).toBe(false);
    });
    (0, vitest_1.it)("stops spawning after stop() even with pending work", async () => {
        const messages = [];
        let releaseRun;
        const { store, runner } = setupRunner((0, fixtures_1.queued)(), ({ store }) => async (message) => {
            messages.push(message);
            fixItems(store, 1);
            await new Promise((resolve) => {
                releaseRun = resolve;
            });
            return { exitCode: 0 };
        });
        runner.kick();
        await new Promise((resolve) => setTimeout(resolve, 10));
        (0, vitest_1.expect)(messages).toHaveLength(1);
        runner.stop();
        submitNewItem(store);
        runner.kick();
        releaseRun();
        await runner.whenIdle();
        (0, vitest_1.expect)(messages).toHaveLength(1);
    });
});
(0, vitest_1.describe)("createReviewModule", () => {
    (0, vitest_1.it)("releases fixing items on load when no live pid holds the lock and kicks", async () => {
        const dir = (0, node_fs_1.mkdtempSync)((0, node_path_1.join)(root, "module-"));
        store_1.ReviewStore.create(dir, { ...(0, fixtures_1.fixing)(), codemakerBin: process.execPath });
        const reviewModule = (0, module_1.createReviewModule)(dir);
        await reviewModule.runner.whenIdle();
        (0, vitest_1.expect)(reviewModule.runner.blocked).toBe(true);
        const stored = readStoredReview(dir);
        (0, vitest_1.expect)(stored.items[0].status).toBe("queued");
        (0, vitest_1.expect)(stored.items[0].lastError).toBe("Metro 重启时该条仍在修复中");
        (0, vitest_1.expect)((0, node_fs_1.readFileSync)((0, node_path_1.join)(dir, "agent.log"), "utf8").length).toBeGreaterThan(0);
        (0, vitest_1.expect)((0, node_fs_1.existsSync)((0, node_path_1.join)(dir, "agent.lock"))).toBe(false);
    });
    (0, vitest_1.it)("keeps fixing items and waits while a live pid holds the lock", async () => {
        vitest_1.vi.useFakeTimers();
        try {
            const dir = (0, node_fs_1.mkdtempSync)((0, node_path_1.join)(root, "module-"));
            store_1.ReviewStore.create(dir, { ...(0, fixtures_1.fixing)(), codemakerBin: process.execPath });
            (0, node_fs_1.writeFileSync)((0, node_path_1.join)(dir, "agent.lock"), String(process.pid), "utf8");
            const reviewModule = (0, module_1.createReviewModule)(dir);
            (0, vitest_1.expect)(reviewModule.runner.busy).toBe(true);
            const stored = readStoredReview(dir);
            (0, vitest_1.expect)(stored.items[0].status).toBe("fixing");
            (0, vitest_1.expect)(stored.items[0].lastError).toBeNull();
            reviewModule.runner.stop();
            await vitest_1.vi.advanceTimersByTimeAsync(5000);
            await reviewModule.runner.whenIdle();
            (0, vitest_1.expect)(reviewModule.runner.busy).toBe(false);
        }
        finally {
            vitest_1.vi.useRealTimers();
        }
    });
});
(0, vitest_1.describe)("withReactNativeGrab review routing", () => {
    const makeMiddleware = () => {
        const base = vitest_1.vi.fn();
        const transformed = (0, withReactNativeGrab_1.withReactNativeGrab)({});
        const enhance = transformed.server?.enhanceMiddleware;
        (0, vitest_1.expect)(enhance).toBeTypeOf("function");
        const wrapped = enhance(base, {});
        return { call: wrapped, base };
    };
    const makeReq = (url, headers = {}) => ({
        url,
        method: "GET",
        headers,
        socket: { remoteAddress: "127.0.0.1" },
    });
    const makeRes = () => {
        let statusCode = 0;
        let body = "";
        const res = {
            writeHead(code) {
                statusCode = code;
            },
            end(data) {
                body = data ?? "";
            },
        };
        return { res, status: () => statusCode, body: () => body };
    };
    (0, vitest_1.it)("answers 404 no_active_review for review routes without RN_GRAB_REVIEW_DIR", () => {
        delete process.env.RN_GRAB_REVIEW_DIR;
        const { call } = makeMiddleware();
        const response = makeRes();
        call(makeReq(`${http_1.REVIEW_ROUTE_PREFIX}state`, { [http_1.REVIEW_CODE_HEADER]: "012345" }), response.res, () => { });
        (0, vitest_1.expect)(response.status()).toBe(404);
        (0, vitest_1.expect)(JSON.parse(response.body())).toEqual({ ok: false, error: "no_active_review" });
    });
    (0, vitest_1.it)("routes review requests to the module created from RN_GRAB_REVIEW_DIR", () => {
        const dir = (0, node_fs_1.mkdtempSync)((0, node_path_1.join)(root, "routed-"));
        store_1.ReviewStore.create(dir, { ...(0, fixtures_1.passed)(), codemakerBin: process.execPath });
        process.env.RN_GRAB_REVIEW_DIR = dir;
        const { call, base } = makeMiddleware();
        const response = makeRes();
        call(makeReq(`${http_1.REVIEW_ROUTE_PREFIX}state`, { [http_1.REVIEW_CODE_HEADER]: "012345" }), response.res, () => { });
        (0, vitest_1.expect)(response.status()).toBe(200);
        const payload = JSON.parse(response.body());
        (0, vitest_1.expect)(payload.ok).toBe(true);
        (0, vitest_1.expect)(payload.runner).toEqual({ busy: false, blocked: false });
        (0, vitest_1.expect)(base).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)("answers 500 internal when the review dir cannot be loaded", () => {
        process.env.RN_GRAB_REVIEW_DIR = (0, node_path_1.join)(root, "missing-");
        const { call } = makeMiddleware();
        const response = makeRes();
        call(makeReq(`${http_1.REVIEW_ROUTE_PREFIX}state`), response.res, () => { });
        (0, vitest_1.expect)(response.status()).toBe(500);
        (0, vitest_1.expect)(JSON.parse(response.body())).toEqual({ ok: false, error: "internal" });
    });
    (0, vitest_1.it)("passes non-review routes through to the base middleware", () => {
        const { call, base } = makeMiddleware();
        const response = makeRes();
        const next = vitest_1.vi.fn();
        call(makeReq("/some/metro/route"), response.res, next);
        (0, vitest_1.expect)(base).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(next).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=runner.test.js.map