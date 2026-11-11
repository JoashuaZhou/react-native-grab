"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_http_1 = require("node:http");
const node_fs_1 = require("node:fs");
const node_os_1 = require("node:os");
const node_path_1 = require("node:path");
const vitest_1 = require("vitest");
const fixtures_1 = require("../../../review-core/__tests__/fixtures");
const transitions_1 = require("../../../review-core/transitions");
const http_1 = require("../http");
const store_1 = require("../store");
const PAIRING_CODE = "012345";
const WORKTREE = "/Users/dev/.react-native-grab/worktrees/Example";
const REVERT_MESSAGE = "fix(design-review): #1 撤销走查修改";
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const makeGit = () => ({
    verifyItemCommits: vitest_1.vi.fn(async (_cwd, _base, shas, _claimedByOthers) => ({ ok: true, shas })),
    revertCommits: vitest_1.vi.fn(async (_cwd, _shas, _message) => ({
        ok: true,
        commit: "dead00",
    })),
});
const makeRunner = (options) => {
    const runner = {
        busy: false,
        blocked: false,
        kick: vitest_1.vi.fn(() => { }),
        unblock: vitest_1.vi.fn(() => { }),
        stop: vitest_1.vi.fn(() => { }),
        exclusiveRuns: 0,
        async runExclusive(fn) {
            if (runner.busy) {
                throw new transitions_1.ReviewError("runner_busy", "走查执行器忙");
            }
            runner.busy = true;
            try {
                runner.exclusiveRuns += 1;
                return await fn();
            }
            finally {
                runner.busy = false;
                options?.beforeKick?.();
                runner.kick();
            }
        },
    };
    return runner;
};
let root;
const servers = [];
(0, vitest_1.beforeEach)(() => {
    root = (0, node_fs_1.mkdtempSync)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "rn-grab-http-"));
});
(0, vitest_1.afterEach)(async () => {
    await Promise.all(servers.map((server) => new Promise((resolve) => server.close(() => resolve()))));
    servers.length = 0;
    (0, node_fs_1.rmSync)(root, { recursive: true, force: true });
});
const setup = async (review, options) => {
    const store = store_1.ReviewStore.create((0, node_fs_1.mkdtempSync)((0, node_path_1.join)(root, "review-")), review);
    const git = makeGit();
    const runner = makeRunner({ beforeKick: options?.beforeKick });
    const handler = (0, http_1.createReviewHandler)({
        store,
        git,
        runner,
        now: () => fixtures_1.NOW,
        isLoopback: options?.isLoopback,
    });
    const server = (0, node_http_1.createServer)((req, res) => {
        handler(req, res, () => {
            res.writeHead(404, { "content-type": "application/json" });
            res.end(JSON.stringify({ ok: false, error: "next" }));
        });
    });
    await new Promise((resolve) => {
        server.listen(0, "127.0.0.1", resolve);
    });
    servers.push(server);
    const { port } = server.address();
    return { baseUrl: `http://127.0.0.1:${port}`, store, git, runner };
};
const auth = { [http_1.REVIEW_CODE_HEADER]: PAIRING_CODE };
const json = async (res) => (await res.json());
const request = (base, path, init = {}) => fetch(`${base}${path}`, init);
const get = (base, path, headers) => request(base, path, { headers: { ...headers } });
const send = (base, method, path, body, headers) => request(base, path, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
});
const post = (base, path, body, headers) => send(base, "POST", path, body, headers);
const patch = (base, path, body, headers) => send(base, "PATCH", path, body, headers);
const del = (base, path, headers) => request(base, path, { method: "DELETE", headers: { ...headers } });
const postSplitBody = (base, path, headers, chunks, delayMs) => new Promise((resolve, reject) => {
    const req = (0, node_http_1.request)(`${base}${path}`, { method: "POST", headers }, (message) => {
        const parts = [];
        message.on("data", (chunk) => {
            parts.push(chunk);
        });
        message.on("end", () => {
            resolve({
                status: message.statusCode ?? 0,
                body: Buffer.concat(parts).toString("utf8"),
            });
        });
        message.on("error", reject);
    });
    req.on("error", reject);
    req.write(chunks[0]);
    setTimeout(() => {
        for (const chunk of chunks.slice(1)) {
            req.write(chunk);
        }
        req.end();
    }, delayMs);
});
(0, vitest_1.describe)("pairing and gatekeeping", () => {
    (0, vitest_1.it)("pairs with the correct code and returns the device review view", async () => {
        const s = await setup((0, fixtures_1.freshDraft)());
        const res = await post(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}pair`, { code: PAIRING_CODE });
        (0, vitest_1.expect)(res.status).toBe(200);
        const body = await json(res);
        (0, vitest_1.expect)(body.ok).toBe(true);
        (0, vitest_1.expect)(body.review).toMatchObject({
            id: "20261111-080000",
            base: "feature/liquidGlass",
            branch: "fix/design-review-20261111-0800",
            status: "active",
            mrUrl: null,
        });
    });
    (0, vitest_1.it)("rejects a wrong pairing code with 401", async () => {
        const s = await setup((0, fixtures_1.freshDraft)());
        const res = await post(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}pair`, { code: "111111" });
        (0, vitest_1.expect)(res.status).toBe(401);
        (0, vitest_1.expect)((await json(res)).error).toBe("bad_code");
    });
    (0, vitest_1.it)("locks the remote address after five consecutive wrong codes", async () => {
        const s = await setup((0, fixtures_1.freshDraft)());
        for (let i = 0; i < 5; i++) {
            const wrong = await post(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}pair`, { code: "999999" });
            (0, vitest_1.expect)(wrong.status).toBe(401);
        }
        const locked = await post(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}pair`, { code: PAIRING_CODE });
        (0, vitest_1.expect)(locked.status).toBe(403);
        (0, vitest_1.expect)((await json(locked)).error).toBe("locked");
    });
    (0, vitest_1.it)("resets consecutive failures after a successful pair", async () => {
        const s = await setup((0, fixtures_1.freshDraft)());
        await post(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}pair`, { code: "000000" });
        await post(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}pair`, { code: "000000" });
        const recovered = await post(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}pair`, { code: PAIRING_CODE });
        (0, vitest_1.expect)(recovered.status).toBe(200);
        for (let i = 0; i < 4; i++) {
            await post(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}pair`, { code: "000000" });
        }
        const stillOpen = await post(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}pair`, { code: PAIRING_CODE });
        (0, vitest_1.expect)(stillOpen.status).toBe(200);
    });
    (0, vitest_1.it)("rejects device routes without a valid code header", async () => {
        const s = await setup((0, fixtures_1.makeReview)());
        const res = await post(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}items`, {
            kind: "element",
            description: "x",
        });
        (0, vitest_1.expect)(res.status).toBe(401);
        (0, vitest_1.expect)((await json(res)).error).toBe("bad_code");
        (0, vitest_1.expect)(s.store.get().items).toHaveLength(0);
    });
    (0, vitest_1.it)("counts header failures toward the address lock", async () => {
        const s = await setup((0, fixtures_1.freshDraft)());
        for (let i = 0; i < 5; i++) {
            const wrong = await get(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}state`, {
                [http_1.REVIEW_CODE_HEADER]: "999999",
            });
            (0, vitest_1.expect)(wrong.status).toBe(401);
        }
        const locked = await get(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}state`, auth);
        (0, vitest_1.expect)(locked.status).toBe(403);
        (0, vitest_1.expect)((await json(locked)).error).toBe("locked");
    });
    (0, vitest_1.it)("rejects non-loopback callers on local routes with 403", async () => {
        const s = await setup((0, fixtures_1.makeReview)(), { isLoopback: () => false });
        const res = await get(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}local/status`);
        (0, vitest_1.expect)(res.status).toBe(403);
        (0, vitest_1.expect)((await json(res)).error).toBe("forbidden");
    });
    (0, vitest_1.it)("passes non-review routes through next", async () => {
        const s = await setup((0, fixtures_1.makeReview)());
        const res = await get(s.baseUrl, "/not-a-review-route");
        (0, vitest_1.expect)(res.status).toBe(404);
        (0, vitest_1.expect)((await json(res)).error).toBe("next");
    });
    (0, vitest_1.it)("rejects non-string pairing codes with 400", async () => {
        const s = await setup((0, fixtures_1.freshDraft)());
        const res = await post(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}pair`, { code: 123 });
        (0, vitest_1.expect)(res.status).toBe(400);
        (0, vitest_1.expect)((await json(res)).error).toBe("invalid_input");
    });
});
(0, vitest_1.describe)("device item routes", () => {
    (0, vitest_1.it)("creates an item without a screenshot", async () => {
        const s = await setup((0, fixtures_1.makeReview)());
        const res = await post(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}items`, {
            kind: "element",
            description: "标题字号应为 16",
        }, auth);
        (0, vitest_1.expect)(res.status).toBe(201);
        const body = await json(res);
        (0, vitest_1.expect)(body.ok).toBe(true);
        (0, vitest_1.expect)(body.item.screenshotUrl).toBe(null);
        (0, vitest_1.expect)(body.item).toMatchObject({ no: 1, status: "draft", actions: ["edit", "delete"] });
        (0, vitest_1.expect)(s.store.get().items).toHaveLength(1);
    });
    (0, vitest_1.it)("creates an item with a 1 MiB screenshot and writes the file", async () => {
        const s = await setup((0, fixtures_1.makeReview)());
        const jpeg = Buffer.alloc(1024 * 1024, 0x41);
        const res = await post(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}items`, {
            kind: "page",
            description: "页面间距",
            screenshotJpegBase64: jpeg.toString("base64"),
        }, auth);
        (0, vitest_1.expect)(res.status).toBe(201);
        const body = await json(res);
        (0, vitest_1.expect)(body.item.screenshotUrl).toBe(`${http_1.REVIEW_ROUTE_PREFIX}screenshots/1.jpg`);
        const path = s.store.screenshotPath("1.jpg");
        (0, vitest_1.expect)((0, node_fs_1.existsSync)(path)).toBe(true);
        (0, vitest_1.expect)((0, node_fs_1.statSync)(path).size).toBe(1024 * 1024);
    });
    (0, vitest_1.it)("creates an item with optional metadata and stores it for local readers", async () => {
        const s = await setup((0, fixtures_1.makeReview)());
        const res = await post(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}items`, {
            kind: "element",
            description: "按钮文案",
            scope: "shared",
            figmaUrl: "https://figma.com/file/x",
            rect: { x: 1, y: 2, width: 3, height: 4 },
            screen: { width: 390, height: 844, scale: 3 },
            route: "Home",
            grab: {
                description: "抓取",
                frames: [{ name: "Text", file: "App.tsx", line: 3, column: 5 }],
            },
            device: { model: "iPhone 17", os: "iOS 26", appVersion: "1.2.0" },
        }, auth);
        (0, vitest_1.expect)(res.status).toBe(201);
        const status = await get(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}local/status`);
        const body = await json(status);
        const review = body.review;
        const item = review.items[0];
        (0, vitest_1.expect)(item.scope).toBe("shared");
        (0, vitest_1.expect)(item.figmaUrl).toBe("https://figma.com/file/x");
        (0, vitest_1.expect)(item.rect).toEqual({ x: 1, y: 2, width: 3, height: 4 });
        (0, vitest_1.expect)(item.screen).toEqual({ width: 390, height: 844, scale: 3 });
        (0, vitest_1.expect)(item.route).toBe("Home");
        (0, vitest_1.expect)(item.grab).toMatchObject({ description: "抓取", frames: [{ name: "Text" }] });
        (0, vitest_1.expect)(item.device).toEqual({ model: "iPhone 17", os: "iOS 26", appVersion: "1.2.0" });
    });
    (0, vitest_1.it)("rejects invalid item payloads with 400", async () => {
        const s = await setup((0, fixtures_1.makeReview)());
        const badKind = await post(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}items`, {
            kind: "x",
            description: "d",
        }, auth);
        (0, vitest_1.expect)(badKind.status).toBe(400);
        (0, vitest_1.expect)((await json(badKind)).error).toBe("invalid_input");
        const badScreen = await post(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}items`, {
            kind: "element",
            description: "d",
            screen: { width: "a" },
        }, auth);
        (0, vitest_1.expect)(badScreen.status).toBe(400);
        const badGrab = await post(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}items`, {
            kind: "element",
            description: "d",
            grab: { description: "g", frames: {} },
        }, auth);
        (0, vitest_1.expect)(badGrab.status).toBe(400);
        (0, vitest_1.expect)(s.store.get().items).toHaveLength(0);
    });
    (0, vitest_1.it)("rejects a blank description with empty_text", async () => {
        const s = await setup((0, fixtures_1.makeReview)());
        const res = await post(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}items`, {
            kind: "element",
            description: "   ",
        }, auth);
        (0, vitest_1.expect)(res.status).toBe(400);
        (0, vitest_1.expect)((await json(res)).error).toBe("empty_text");
    });
    (0, vitest_1.it)("rejects malformed screenshot payloads with 400", async () => {
        const s = await setup((0, fixtures_1.makeReview)());
        const res = await post(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}items`, {
            kind: "element",
            description: "d",
            screenshotJpegBase64: "not base64!!",
        }, auth);
        (0, vitest_1.expect)(res.status).toBe(400);
        (0, vitest_1.expect)((await json(res)).error).toBe("invalid_input");
        (0, vitest_1.expect)(s.store.get().items).toHaveLength(0);
        (0, vitest_1.expect)((0, node_fs_1.existsSync)((0, node_path_1.join)(s.store.dir, "screenshots", "1.jpg"))).toBe(false);
    });
    (0, vitest_1.it)("patches a draft", async () => {
        const s = await setup((0, fixtures_1.freshDraft)());
        const res = await patch(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}items/1`, {
            description: "新文案",
            scope: "shared",
        }, auth);
        (0, vitest_1.expect)(res.status).toBe(200);
        const body = await json(res);
        (0, vitest_1.expect)(body.item).toMatchObject({ no: 1, status: "draft", scope: "shared" });
        (0, vitest_1.expect)(s.store.get().items[0].rounds[0].description).toBe("新文案");
    });
    (0, vitest_1.it)("deletes a draft without commits", async () => {
        const s = await setup((0, fixtures_1.freshDraft)());
        const res = await del(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}items/1`, auth);
        (0, vitest_1.expect)(res.status).toBe(200);
        const body = await json(res);
        (0, vitest_1.expect)(body.ok).toBe(true);
        (0, vitest_1.expect)(s.store.get().items).toHaveLength(0);
    });
    (0, vitest_1.it)("refuses to delete an item with commits", async () => {
        const s = await setup((0, fixtures_1.draftWithCommits)());
        const res = await del(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}items/1`, auth);
        (0, vitest_1.expect)(res.status).toBe(409);
        (0, vitest_1.expect)((await json(res)).error).toBe("has_commits");
        (0, vitest_1.expect)(s.store.get().items).toHaveLength(1);
    });
    (0, vitest_1.it)("creates an item when a Chinese character is split across body chunks", async () => {
        const s = await setup((0, fixtures_1.makeReview)());
        const description = "标题字号应为 16";
        const payload = JSON.stringify({ kind: "element", description });
        const bytes = Buffer.from(payload, "utf8");
        const charStart = Buffer.byteLength(payload.slice(0, payload.indexOf(description)), "utf8");
        const split = charStart + 1;
        const res = await postSplitBody(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}items`, { "content-type": "application/json", ...auth }, [bytes.subarray(0, split), bytes.subarray(split)], 50);
        (0, vitest_1.expect)(res.status).toBe(201);
        const body = JSON.parse(res.body);
        const item = body.item.rounds;
        (0, vitest_1.expect)(item[0].description).toBe(description);
        (0, vitest_1.expect)(s.store.get().items[0].rounds[0].description).toBe(description);
    });
    (0, vitest_1.it)("rejects malformed item numbers with 400", async () => {
        const s = await setup((0, fixtures_1.freshDraft)());
        const device = await patch(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}items/abc`, { description: "x" }, auth);
        (0, vitest_1.expect)(device.status).toBe(400);
        (0, vitest_1.expect)((await json(device)).error).toBe("invalid_input");
        const local = await get(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}local/items/abc`);
        (0, vitest_1.expect)(local.status).toBe(400);
        (0, vitest_1.expect)((await json(local)).error).toBe("invalid_input");
    });
});
(0, vitest_1.describe)("device review flow", () => {
    (0, vitest_1.it)("returns state with runner-gated actions", async () => {
        const s = await setup((0, fixtures_1.awaiting)());
        const first = await get(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}state`, auth);
        (0, vitest_1.expect)(first.status).toBe(200);
        const body = await json(first);
        (0, vitest_1.expect)(body.runner).toEqual({ busy: false, blocked: false });
        (0, vitest_1.expect)(body.items[0].actions).toEqual([
            "pass",
            "reject",
            "revert",
        ]);
        s.runner.busy = true;
        const second = await get(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}state`, auth);
        const busyBody = await json(second);
        (0, vitest_1.expect)(busyBody.items[0].actions).toEqual([
            "pass",
            "reject",
        ]);
        (0, vitest_1.expect)(busyBody.runner.busy).toBe(true);
    });
    (0, vitest_1.it)("submits drafts and kicks the runner exactly once", async () => {
        const s = await setup((0, fixtures_1.freshDraft)());
        const res = await post(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}submit`, {}, auth);
        (0, vitest_1.expect)(res.status).toBe(200);
        const body = await json(res);
        (0, vitest_1.expect)(body.submitted).toEqual([1]);
        (0, vitest_1.expect)(s.runner.kick).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(s.store.get().items[0].status).toBe("queued");
        (0, vitest_1.expect)(s.store.get().items[0].rounds[0].submittedAt).toBe(fixtures_1.NOW.toISOString());
    });
    (0, vitest_1.it)("passes an awaiting item", async () => {
        const s = await setup((0, fixtures_1.awaiting)());
        const res = await post(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}items/1/pass`, {}, auth);
        (0, vitest_1.expect)(res.status).toBe(200);
        const body = await json(res);
        (0, vitest_1.expect)(body.item.status).toBe("passed");
        (0, vitest_1.expect)(s.store.get().items[0].status).toBe("passed");
    });
    (0, vitest_1.it)("rejects an awaiting item with a supplement", async () => {
        const s = await setup((0, fixtures_1.awaiting)());
        const res = await post(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}items/1/reject`, {
            supplement: "间距仍不对",
        }, auth);
        (0, vitest_1.expect)(res.status).toBe(200);
        const body = await json(res);
        (0, vitest_1.expect)(body.item.status).toBe("draft");
        const item = s.store.get().items[0];
        (0, vitest_1.expect)(item.rounds).toHaveLength(2);
        (0, vitest_1.expect)(item.rounds[1].description).toBe("间距仍不对");
    });
    (0, vitest_1.it)("rejects a blank supplement with empty_text", async () => {
        const s = await setup((0, fixtures_1.awaiting)());
        const res = await post(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}items/1/reject`, { supplement: " " }, auth);
        (0, vitest_1.expect)(res.status).toBe(400);
        (0, vitest_1.expect)((await json(res)).error).toBe("empty_text");
    });
    (0, vitest_1.it)("refuses to finish while items are open", async () => {
        const s = await setup((0, fixtures_1.freshDraft)());
        const res = await post(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}finish`, {}, auth);
        (0, vitest_1.expect)(res.status).toBe(409);
        (0, vitest_1.expect)((await json(res)).error).toBe("not_finishable");
        (0, vitest_1.expect)(s.store.get().status).toBe("active");
    });
    (0, vitest_1.it)("finishes a fully passed review and kicks the runner", async () => {
        const s = await setup((0, fixtures_1.passed)());
        const res = await post(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}finish`, {}, auth);
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(await json(res)).toEqual({ ok: true });
        (0, vitest_1.expect)(s.store.get().status).toBe("finishing");
        (0, vitest_1.expect)(s.runner.kick).toHaveBeenCalledTimes(1);
    });
});
(0, vitest_1.describe)("screenshots", () => {
    (0, vitest_1.it)("serves a stored screenshot as image/jpeg", async () => {
        const s = await setup((0, transitions_1.attachScreenshot)((0, fixtures_1.freshDraft)(), 1, "1.jpg"));
        (0, node_fs_1.writeFileSync)((0, node_path_1.join)(s.store.dir, "screenshots", "1.jpg"), JPEG_BYTES);
        const res = await get(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}screenshots/1.jpg`, auth);
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(res.headers.get("content-type")).toBe("image/jpeg");
        (0, vitest_1.expect)(Buffer.from(await res.arrayBuffer())).toEqual(JPEG_BYTES);
    });
    (0, vitest_1.it)("rejects path traversal in screenshot names with 400", async () => {
        const s = await setup((0, fixtures_1.freshDraft)());
        const res = await get(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}screenshots/..%2F..%2Fetc`, auth);
        (0, vitest_1.expect)(res.status).toBe(400);
        (0, vitest_1.expect)((await json(res)).error).toBe("invalid_input");
    });
    (0, vitest_1.it)("responds 404 for a missing screenshot file", async () => {
        const s = await setup((0, fixtures_1.freshDraft)());
        const res = await get(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}screenshots/9.jpg`, auth);
        (0, vitest_1.expect)(res.status).toBe(404);
        (0, vitest_1.expect)((await json(res)).error).toBe("not_found");
    });
});
(0, vitest_1.describe)("revert", () => {
    (0, vitest_1.it)("rejects the exclusive section while the runner is busy without running it", async () => {
        const s = await setup((0, fixtures_1.awaiting)());
        s.runner.busy = true;
        const res = await post(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}items/1/revert`, {}, auth);
        (0, vitest_1.expect)(res.status).toBe(409);
        (0, vitest_1.expect)((await json(res)).error).toBe("runner_busy");
        (0, vitest_1.expect)(s.runner.exclusiveRuns).toBe(0);
        (0, vitest_1.expect)(s.git.revertCommits).not.toHaveBeenCalled();
        (0, vitest_1.expect)(s.store.get().items[0].status).toBe("awaiting_review");
        (0, vitest_1.expect)(s.runner.kick).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)("maps git conflicts to 409 and keeps the item awaiting review", async () => {
        const s = await setup((0, fixtures_1.awaiting)());
        s.git.revertCommits.mockResolvedValueOnce({ ok: false, reason: "conflict" });
        const res = await post(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}items/1/revert`, {}, auth);
        (0, vitest_1.expect)(res.status).toBe(409);
        (0, vitest_1.expect)((await json(res)).error).toBe("conflict");
        (0, vitest_1.expect)(s.store.get().items[0].status).toBe("awaiting_review");
        (0, vitest_1.expect)(s.runner.kick).toHaveBeenCalledTimes(1);
    });
    (0, vitest_1.it)("reverts inside the exclusive section and persists before the release kick", async () => {
        let s;
        const snapshot = { captured: null };
        let busyDuringGit = false;
        s = await setup((0, fixtures_1.awaiting)(), {
            beforeKick: () => {
                snapshot.captured = s.store.get();
            },
        });
        s.git.revertCommits.mockImplementationOnce(async () => {
            busyDuringGit = s.runner.busy;
            return { ok: true, commit: "dead00" };
        });
        const res = await post(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}items/1/revert`, {}, auth);
        (0, vitest_1.expect)(res.status).toBe(200);
        const body = await json(res);
        (0, vitest_1.expect)(body.item).toMatchObject({ no: 1, status: "reverted", revertCommit: "dead00" });
        (0, vitest_1.expect)(s.git.revertCommits).toHaveBeenCalledWith(WORKTREE, ["abc"], REVERT_MESSAGE);
        (0, vitest_1.expect)(busyDuringGit).toBe(true);
        (0, vitest_1.expect)(s.runner.exclusiveRuns).toBe(1);
        const captured = snapshot.captured;
        (0, vitest_1.expect)(captured).not.toBeNull();
        (0, vitest_1.expect)(captured.items[0].status).toBe("reverted");
        (0, vitest_1.expect)(captured.revertedSinceLastRun).toEqual([1]);
        (0, vitest_1.expect)(s.store.get().revertedSinceLastRun).toEqual([1]);
        (0, vitest_1.expect)(s.runner.kick).toHaveBeenCalledTimes(1);
    });
    (0, vitest_1.it)("refuses to revert a fresh draft without commits", async () => {
        const s = await setup((0, fixtures_1.freshDraft)());
        const res = await post(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}items/1/revert`, {}, auth);
        (0, vitest_1.expect)(res.status).toBe(409);
        (0, vitest_1.expect)((await json(res)).error).toBe("invalid_state");
        (0, vitest_1.expect)(s.runner.exclusiveRuns).toBe(0);
        (0, vitest_1.expect)(s.git.revertCommits).not.toHaveBeenCalled();
    });
});
(0, vitest_1.describe)("local agent routes", () => {
    (0, vitest_1.it)("status returns the full stored review", async () => {
        const review = (0, transitions_1.createItem)((0, fixtures_1.makeReview)(), {
            kind: "element",
            description: "标题",
            grab: {
                description: "按钮",
                frames: [{ name: "Button", file: "App.tsx", line: 1, column: 2 }],
            },
        }, fixtures_1.NOW).review;
        const s = await setup(review);
        const res = await get(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}local/status`);
        (0, vitest_1.expect)(res.status).toBe(200);
        const body = await json(res);
        (0, vitest_1.expect)(body.ok).toBe(true);
        (0, vitest_1.expect)(body.review).toMatchObject({
            id: "20261111-080000",
            worktree: WORKTREE,
            status: "active",
            nextItemNo: 2,
        });
        const items = body.review.items;
        (0, vitest_1.expect)(items[0]).toMatchObject({
            no: 1,
            status: "draft",
            screenshot: null,
            revertCommit: null,
            grab: { description: "按钮" },
        });
    });
    (0, vitest_1.it)("returns a full item with an absolute screenshot path", async () => {
        const s = await setup((0, transitions_1.attachScreenshot)((0, fixtures_1.freshDraft)(), 1, "1.jpg"));
        (0, node_fs_1.writeFileSync)((0, node_path_1.join)(s.store.dir, "screenshots", "1.jpg"), JPEG_BYTES);
        const res = await get(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}local/items/1`);
        (0, vitest_1.expect)(res.status).toBe(200);
        const body = await json(res);
        (0, vitest_1.expect)(body.item).toMatchObject({ no: 1, status: "draft", screenshot: "1.jpg" });
        (0, vitest_1.expect)(body.screenshotPath).toBe(s.store.screenshotPath("1.jpg"));
    });
    (0, vitest_1.it)("claims a queued item", async () => {
        const s = await setup((0, fixtures_1.queued)());
        const res = await post(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}local/items/1/claim`, {});
        (0, vitest_1.expect)(res.status).toBe(200);
        const body = await json(res);
        (0, vitest_1.expect)(body.item).toMatchObject({ no: 1, status: "fixing", lastError: null });
        (0, vitest_1.expect)(s.store.get().items[0].status).toBe("fixing");
    });
    (0, vitest_1.it)("reply verifies commits in the worktree and 400s unknown SHAs", async () => {
        const s = await setup((0, fixtures_1.fixing)());
        s.git.verifyItemCommits.mockResolvedValueOnce({ ok: false, reason: "missing", sha: "0bad" });
        const res = await post(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}local/items/1/reply`, {
            reply: "已修复",
            commits: ["0bad"],
        });
        (0, vitest_1.expect)(res.status).toBe(400);
        (0, vitest_1.expect)((await json(res)).error).toBe("invalid_commits");
        (0, vitest_1.expect)(s.store.get().items[0].status).toBe("fixing");
        (0, vitest_1.expect)(s.git.verifyItemCommits).toHaveBeenCalledTimes(1);
        const call = vitest_1.vi.mocked(s.git.verifyItemCommits).mock.calls[0];
        (0, vitest_1.expect)(call[0]).toBe(WORKTREE);
        (0, vitest_1.expect)(call[1]).toBe("feature/liquidGlass");
        (0, vitest_1.expect)(call[2]).toEqual(["0bad"]);
    });
    (0, vitest_1.it)("reply stores normalized shas and moves the item to awaiting review", async () => {
        const s = await setup((0, fixtures_1.fixing)());
        s.git.verifyItemCommits.mockResolvedValueOnce({ ok: true, shas: ["full123"] });
        const res = await post(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}local/items/1/reply`, {
            reply: "已修复",
            commits: ["full"],
        });
        (0, vitest_1.expect)(res.status).toBe(200);
        const body = await json(res);
        (0, vitest_1.expect)(body.item).toMatchObject({ no: 1, status: "awaiting_review" });
        const item = s.store.get().items[0];
        (0, vitest_1.expect)(item.rounds[0].commits).toEqual(["full123"]);
        (0, vitest_1.expect)(item.rounds[0].reply).toBe("已修复");
        (0, vitest_1.expect)(item.rounds[0].repliedAt).toBe(fixtures_1.NOW.toISOString());
    });
    (0, vitest_1.it)("reply rejects malformed bodies without touching the store", async () => {
        const s = await setup((0, fixtures_1.fixing)());
        const badReply = await post(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}local/items/1/reply`, {
            reply: 5,
            commits: [],
        });
        (0, vitest_1.expect)(badReply.status).toBe(400);
        const badCommits = await post(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}local/items/1/reply`, {
            reply: "ok",
            commits: "x",
        });
        (0, vitest_1.expect)(badCommits.status).toBe(400);
        (0, vitest_1.expect)((await json(badCommits)).error).toBe("invalid_input");
        (0, vitest_1.expect)(s.git.verifyItemCommits).not.toHaveBeenCalled();
        (0, vitest_1.expect)(s.store.get().items[0].status).toBe("fixing");
    });
    (0, vitest_1.it)("reply refuses non-fixing items before touching git", async () => {
        const s = await setup((0, fixtures_1.awaiting)());
        const res = await post(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}local/items/1/reply`, {
            reply: "ok",
            commits: ["a"],
        });
        (0, vitest_1.expect)(res.status).toBe(409);
        (0, vitest_1.expect)((await json(res)).error).toBe("invalid_state");
        (0, vitest_1.expect)(s.git.verifyItemCommits).not.toHaveBeenCalled();
    });
    (0, vitest_1.it)("complete requires the finishing state on open reviews", async () => {
        const s = await setup((0, fixtures_1.freshDraft)());
        const res = await post(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}local/complete`, {
            mrUrl: "https://gitlab/mr/1",
        });
        (0, vitest_1.expect)(res.status).toBe(409);
        (0, vitest_1.expect)((await json(res)).error).toBe("invalid_state");
    });
    (0, vitest_1.it)("completes a finishing review with the mr URL", async () => {
        const s = await setup((0, transitions_1.beginFinish)((0, fixtures_1.passed)()));
        const res = await post(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}local/complete`, {
            mrUrl: "https://gitlab/mr/1",
        });
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(await json(res)).toEqual({ ok: true });
        (0, vitest_1.expect)(s.store.get()).toMatchObject({ status: "done", mrUrl: "https://gitlab/mr/1" });
    });
    (0, vitest_1.it)("stop closes the review, stops the runner and blocks complete and retry", async () => {
        const s = await setup((0, fixtures_1.fixing)());
        const res = await post(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}local/stop`, {});
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(s.store.get().status).toBe("abandoned");
        (0, vitest_1.expect)(s.runner.stop).toHaveBeenCalledTimes(1);
        const complete = await post(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}local/complete`, {
            mrUrl: "https://gitlab/mr/1",
        });
        (0, vitest_1.expect)(complete.status).toBe(409);
        (0, vitest_1.expect)((await json(complete)).error).toBe("review_closed");
        const retry = await post(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}local/retry`, {});
        (0, vitest_1.expect)(retry.status).toBe(409);
        (0, vitest_1.expect)((await json(retry)).error).toBe("review_closed");
    });
    (0, vitest_1.it)("retry unblocks and kicks an open review", async () => {
        const s = await setup((0, fixtures_1.fixing)());
        const res = await post(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}local/retry`, {});
        (0, vitest_1.expect)(res.status).toBe(200);
        (0, vitest_1.expect)(await json(res)).toEqual({ ok: true });
        (0, vitest_1.expect)(s.runner.unblock).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(s.runner.kick).toHaveBeenCalledTimes(1);
    });
    (0, vitest_1.it)("responds 404 for unknown routes", async () => {
        const s = await setup((0, fixtures_1.makeReview)());
        const device = await get(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}unknown`, auth);
        (0, vitest_1.expect)(device.status).toBe(404);
        (0, vitest_1.expect)((await json(device)).error).toBe("not_found");
        const local = await get(s.baseUrl, `${http_1.REVIEW_ROUTE_PREFIX}local/unknown`);
        (0, vitest_1.expect)(local.status).toBe(404);
    });
});
(0, vitest_1.describe)("body limits and payload errors", () => {
    (0, vitest_1.it)("rejects malformed JSON bodies with 400", async () => {
        const s = await setup((0, fixtures_1.makeReview)());
        const res = await send(s.baseUrl, "POST", `${http_1.REVIEW_ROUTE_PREFIX}pair`, "{not json");
        (0, vitest_1.expect)(res.status).toBe(400);
        (0, vitest_1.expect)((await json(res)).error).toBe("invalid_input");
    });
    (0, vitest_1.it)("rejects non-item payloads above 64 KiB with 413", async () => {
        const s = await setup((0, fixtures_1.makeReview)());
        const res = await send(s.baseUrl, "POST", `${http_1.REVIEW_ROUTE_PREFIX}pair`, "x".repeat(80 * 1024));
        (0, vitest_1.expect)(res.status).toBe(413);
        (0, vitest_1.expect)((await json(res)).error).toBe("payload_too_large");
    });
    (0, vitest_1.it)("rejects item payloads above 12 MiB with 413", async () => {
        const s = await setup((0, fixtures_1.makeReview)());
        const res = await send(s.baseUrl, "POST", `${http_1.REVIEW_ROUTE_PREFIX}items`, {
            kind: "element",
            description: "y".repeat(13 * 1024 * 1024),
        }, auth);
        (0, vitest_1.expect)(res.status).toBe(413);
        (0, vitest_1.expect)((await json(res)).error).toBe("payload_too_large");
        (0, vitest_1.expect)(s.store.get().items).toHaveLength(0);
    });
});
//# sourceMappingURL=http.test.js.map