"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_http_1 = require("node:http");
const node_fs_1 = require("node:fs");
const node_os_1 = require("node:os");
const node_path_1 = require("node:path");
const vitest_1 = require("vitest");
const paths_1 = require("../../metro/review/paths");
const local_client_1 = require("../local-client");
const ROUND_ONE = {
    description: "标题字号应为 16",
    createdAt: "2026-11-12T01:00:00.000Z",
    submittedAt: "2026-11-12T01:01:00.000Z",
    reply: null,
    repliedAt: null,
    commits: [],
};
const ROUND_TWO = {
    description: "间距仍不对",
    createdAt: "2026-11-12T02:00:00.000Z",
    submittedAt: "2026-11-12T02:01:00.000Z",
    reply: "已改为 16",
    repliedAt: "2026-11-12T02:30:00.000Z",
    commits: ["abc123", "def456"],
};
const makeItem = (no, status) => ({
    no,
    kind: "element",
    status,
    scope: "local",
    figmaUrl: "https://www.figma.com/file/x?node-id=1",
    rounds: [ROUND_ONE, ROUND_TWO],
    screenshot: `${no}.jpg`,
    rect: { x: 0, y: 100, width: 200, height: 80 },
    screen: { width: 1170, height: 2532, scale: 3 },
    route: "/page/home",
    grab: { description: "Home 标题 Text", frames: [] },
    device: { model: "iPhone 15 Pro", os: "iOS 18", appVersion: "3.2.0" },
    revertCommit: null,
    lastError: null,
    createdAt: "2026-11-12T01:00:00.000Z",
});
let root;
let worktree;
let storeScreenshot;
let paths;
const servers = [];
const printed = [];
const requests = [];
(0, vitest_1.beforeEach)(() => {
    root = (0, node_fs_1.mkdtempSync)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "rn-grab-cli-"));
    paths = (0, paths_1.getReviewPaths)(root);
    worktree = (0, node_path_1.join)(root, "worktree");
    storeScreenshot = (0, node_path_1.join)(root, "screenshots", "3.jpg");
    printed.length = 0;
    requests.length = 0;
});
(0, vitest_1.afterEach)(async () => {
    await Promise.all(servers.map((server) => new Promise((resolve) => server.close(() => resolve()))));
    servers.length = 0;
    (0, node_fs_1.rmSync)(root, { recursive: true, force: true });
});
const startFakeMetro = async (handler) => {
    const server = (0, node_http_1.createServer)((req, res) => {
        const chunks = [];
        req.on("data", (chunk) => {
            chunks.push(chunk);
        });
        req.on("end", () => {
            const pathname = req.url ?? "";
            const body = Buffer.concat(chunks).toString("utf8");
            requests.push({ method: req.method ?? "GET", pathname, body });
            handler(req, res, pathname, body);
        });
    });
    await new Promise((resolve) => {
        server.listen(0, "127.0.0.1", resolve);
    });
    servers.push(server);
    const { port } = server.address();
    return `http://127.0.0.1:${port}`;
};
const sendJson = (res, status, payload) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(payload));
};
(0, vitest_1.describe)("showItem", () => {
    (0, vitest_1.it)("copies the screenshot into the worktree and prints the item details", async () => {
        (0, node_fs_1.mkdirSync)((0, node_path_1.join)(root, "screenshots"), { recursive: true });
        const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
        (0, node_fs_1.writeFileSync)(storeScreenshot, bytes);
        const review = {
            id: "20261112-090506",
            base: "main",
            branch: "fix/design-review-20261112-0905",
            worktree,
            status: "active",
        };
        const item = makeItem(3, "awaiting_review");
        const origin = await startFakeMetro((_req, res, pathname) => {
            if (pathname === "/__react-native-grab/review/local/items/3") {
                sendJson(res, 200, { ok: true, item, screenshotPath: storeScreenshot });
                return;
            }
            if (pathname === "/__react-native-grab/review/local/status") {
                sendJson(res, 200, { ok: true, review });
                return;
            }
            sendJson(res, 404, { ok: false, error: "not_found" });
        });
        await (0, local_client_1.showItem)(3, false, { origin, print: (line) => printed.push(line) });
        const copied = (0, node_path_1.join)(worktree, ".rn-grab-review", "item-3.jpg");
        (0, vitest_1.expect)((0, node_fs_1.existsSync)(copied)).toBe(true);
        (0, vitest_1.expect)((0, node_fs_1.readFileSync)(copied)).toEqual(bytes);
        const output = printed.join("\n");
        (0, vitest_1.expect)(output).toContain("#3");
        (0, vitest_1.expect)(output).toContain("待复验");
        (0, vitest_1.expect)(output).toContain("只改这里");
        (0, vitest_1.expect)(output).toContain("/page/home");
        (0, vitest_1.expect)(output).toContain("https://www.figma.com/file/x?node-id=1");
        (0, vitest_1.expect)(output).toContain("200");
        (0, vitest_1.expect)(output).toContain("1170×2532");
        (0, vitest_1.expect)(output).toContain(copied);
        (0, vitest_1.expect)(output).toContain("标题字号应为 16");
        (0, vitest_1.expect)(output).toContain("间距仍不对");
        (0, vitest_1.expect)(output).toContain("已改为 16");
        (0, vitest_1.expect)(output).toContain("abc123");
        (0, vitest_1.expect)(output).toContain("Home 标题 Text");
    });
    (0, vitest_1.it)("prints the raw item JSON with --json and still copies the screenshot", async () => {
        (0, node_fs_1.mkdirSync)((0, node_path_1.join)(root, "screenshots"), { recursive: true });
        const bytes = Buffer.from([0xff, 0xd8]);
        (0, node_fs_1.writeFileSync)(storeScreenshot, bytes);
        const review = { worktree };
        const item = makeItem(3, "awaiting_review");
        const origin = await startFakeMetro((_req, res, pathname) => {
            if (pathname === "/__react-native-grab/review/local/items/3") {
                sendJson(res, 200, { ok: true, item, screenshotPath: storeScreenshot });
                return;
            }
            sendJson(res, 200, { ok: true, review });
        });
        await (0, local_client_1.showItem)(3, true, { origin, print: (line) => printed.push(line) });
        (0, vitest_1.expect)((0, node_fs_1.readFileSync)((0, node_path_1.join)(worktree, ".rn-grab-review", "item-3.jpg"))).toEqual(bytes);
        (0, vitest_1.expect)(printed).toHaveLength(1);
        (0, vitest_1.expect)(JSON.parse(printed[0] ?? "")).toEqual(item);
    });
});
(0, vitest_1.describe)("status and mutating commands", () => {
    (0, vitest_1.it)("prints the review summary", async () => {
        const full = startStandardReview();
        const origin = await startFakeMetro((_req, res, pathname) => {
            if (pathname === "/__react-native-grab/review/local/status") {
                sendJson(res, 200, { ok: true, review: full });
                return;
            }
            sendJson(res, 404, { ok: false, error: "not_found" });
        });
        await (0, local_client_1.printStatus)({ origin, print: (line) => printed.push(line) });
        const output = printed.join("\n");
        (0, vitest_1.expect)(output).toContain("20261112-090506");
        (0, vitest_1.expect)(output).toContain("fix/design-review-20261112-0905");
        (0, vitest_1.expect)(output).toContain("#1");
        (0, vitest_1.expect)(output).toContain("待复验");
        (0, vitest_1.expect)(output).toContain("#2");
        (0, vitest_1.expect)(output).toContain("待修复");
    });
    (0, vitest_1.it)("claims an item and prints its new status", async () => {
        const origin = await startFakeMetro((_req, res, pathname) => {
            if (pathname === "/__react-native-grab/review/local/items/2/claim") {
                sendJson(res, 200, { ok: true, item: makeItem(2, "fixing"), screenshotPath: null });
                return;
            }
            sendJson(res, 404, { ok: false, error: "not_found" });
        });
        await (0, local_client_1.claim)(2, { origin, print: (line) => printed.push(line) });
        (0, vitest_1.expect)(requests).toContainEqual({
            method: "POST",
            pathname: "/__react-native-grab/review/local/items/2/claim",
            body: "",
        });
        (0, vitest_1.expect)(printed.join("\n")).toContain("#2");
        (0, vitest_1.expect)(printed.join("\n")).toContain("修复中");
    });
    (0, vitest_1.it)("replies with the message and repeated commits", async () => {
        const origin = await startFakeMetro((_req, res, pathname) => {
            if (pathname === "/__react-native-grab/review/local/items/1/reply") {
                sendJson(res, 200, {
                    ok: true,
                    item: makeItem(1, "awaiting_review"),
                    screenshotPath: null,
                });
                return;
            }
            sendJson(res, 404, { ok: false, error: "not_found" });
        });
        await (0, local_client_1.reply)(1, "已修复", ["aaaa", "bbbb"], { origin, print: (line) => printed.push(line) });
        (0, vitest_1.expect)(requests).toContainEqual({
            method: "POST",
            pathname: "/__react-native-grab/review/local/items/1/reply",
            body: JSON.stringify({ reply: "已修复", commits: ["aaaa", "bbbb"] }),
        });
    });
    (0, vitest_1.it)("completes with and without an MR url", async () => {
        const origin = await startFakeMetro((_req, res) => {
            sendJson(res, 200, { ok: true });
        });
        await (0, local_client_1.complete)("https://gitlab/mr/1", { origin, print: (line) => printed.push(line) });
        await (0, local_client_1.complete)(null, { origin, print: (line) => printed.push(line) });
        (0, vitest_1.expect)(requests.filter((request) => request.pathname.endsWith("/local/complete"))).toEqual([
            {
                method: "POST",
                pathname: "/__react-native-grab/review/local/complete",
                body: JSON.stringify({ mrUrl: "https://gitlab/mr/1" }),
            },
            {
                method: "POST",
                pathname: "/__react-native-grab/review/local/complete",
                body: JSON.stringify({ mrUrl: null }),
            },
        ]);
    });
    (0, vitest_1.it)("retries the runner", async () => {
        const origin = await startFakeMetro((_req, res) => {
            sendJson(res, 200, { ok: true });
        });
        await (0, local_client_1.retry)({ origin, print: (line) => printed.push(line) });
        (0, vitest_1.expect)(requests.some((request) => request.pathname.endsWith("/local/retry"))).toBe(true);
    });
    (0, vitest_1.it)("surfaces local API error codes", async () => {
        const origin = await startFakeMetro((_req, res) => {
            sendJson(res, 409, { ok: false, error: "invalid_state" });
        });
        await (0, vitest_1.expect)((0, local_client_1.claim)("9", { origin, print: () => { } })).rejects.toThrow("invalid_state");
    });
});
const startStandardReview = () => ({
    id: "20261112-090506",
    repo: "/Users/dev/Example",
    base: "main",
    branch: "fix/design-review-20261112-0905",
    worktree,
    sessionId: null,
    codemakerBin: "/usr/bin/codemaker",
    pairingCode: "314159",
    status: "active",
    mrUrl: null,
    nextItemNo: 4,
    items: [makeItem(1, "awaiting_review"), makeItem(2, "queued")],
    revertedSinceLastRun: [],
    createdAt: "2026-11-12T01:09:06.000Z",
});
const writeReviewFiles = (status) => {
    const dir = (0, node_path_1.join)(paths.reviewsDir, "20261112-090506");
    (0, node_fs_1.mkdirSync)(dir, { recursive: true });
    (0, node_fs_1.writeFileSync)((0, node_path_1.join)(dir, "review.json"), JSON.stringify({
        id: "20261112-090506",
        repo: "/Users/dev/Example",
        base: "main",
        branch: "fix/design-review-20261112-0905",
        worktree,
        sessionId: null,
        codemakerBin: "/usr/bin/codemaker",
        pairingCode: "314159",
        status,
        mrUrl: null,
        nextItemNo: 1,
        items: [],
        revertedSinceLastRun: [],
        createdAt: "2026-11-12T01:09:06.000Z",
    }), "utf8");
    (0, paths_1.writeActive)(paths, { reviewId: "20261112-090506", dir });
    return dir;
};
(0, vitest_1.describe)("stopReview", () => {
    (0, vitest_1.it)("uses local/stop when Metro answers and then clears the active file", async () => {
        const dir = writeReviewFiles("active");
        const origin = await startFakeMetro((_req, res) => {
            sendJson(res, 200, { ok: true });
        });
        await (0, local_client_1.stopReview)(paths, { origin, print: (line) => printed.push(line) });
        (0, vitest_1.expect)(requests.some((request) => request.pathname.endsWith("/local/stop"))).toBe(true);
        (0, vitest_1.expect)((0, node_fs_1.existsSync)(paths.activeFile)).toBe(false);
        (0, vitest_1.expect)(JSON.parse((0, node_fs_1.readFileSync)((0, node_path_1.join)(dir, "review.json"), "utf8")).status).toBe("active");
        (0, vitest_1.expect)(printed.join("\n")).toContain("已结束");
    });
    (0, vitest_1.it)("abandons the review on disk when Metro is offline", async () => {
        const dir = writeReviewFiles("active");
        await (0, local_client_1.stopReview)(paths, {
            origin: "http://127.0.0.1:1",
            print: (line) => printed.push(line),
        });
        (0, vitest_1.expect)(JSON.parse((0, node_fs_1.readFileSync)((0, node_path_1.join)(dir, "review.json"), "utf8")).status).toBe("abandoned");
        (0, vitest_1.expect)((0, node_fs_1.existsSync)(paths.activeFile)).toBe(false);
    });
    (0, vitest_1.it)("reports when there is no active review", async () => {
        await (0, local_client_1.stopReview)(paths, {
            origin: "http://127.0.0.1:1",
            print: (line) => printed.push(line),
        });
        (0, vitest_1.expect)(printed.join("\n")).toContain("没有进行中的走查");
    });
});
//# sourceMappingURL=local-client.test.js.map