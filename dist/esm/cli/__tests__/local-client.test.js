import { createServer } from "node:http";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getReviewPaths, writeActive } from "../../metro/review/paths";
import { claim, complete, printStatus, reply, retry, showItem, stopReview } from "../local-client";
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
beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "rn-grab-cli-"));
    paths = getReviewPaths(root);
    worktree = join(root, "worktree");
    storeScreenshot = join(root, "screenshots", "3.jpg");
    printed.length = 0;
    requests.length = 0;
});
afterEach(async () => {
    await Promise.all(servers.map((server) => new Promise((resolve) => server.close(() => resolve()))));
    servers.length = 0;
    rmSync(root, { recursive: true, force: true });
});
const startFakeMetro = async (handler) => {
    const server = createServer((req, res) => {
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
describe("showItem", () => {
    it("copies the screenshot into the worktree and prints the item details", async () => {
        mkdirSync(join(root, "screenshots"), { recursive: true });
        const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
        writeFileSync(storeScreenshot, bytes);
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
        await showItem(3, false, { origin, print: (line) => printed.push(line) });
        const copied = join(worktree, ".rn-grab-review", "item-3.jpg");
        expect(existsSync(copied)).toBe(true);
        expect(readFileSync(copied)).toEqual(bytes);
        const output = printed.join("\n");
        expect(output).toContain("#3");
        expect(output).toContain("待复验");
        expect(output).toContain("只改这里");
        expect(output).toContain("/page/home");
        expect(output).toContain("https://www.figma.com/file/x?node-id=1");
        expect(output).toContain("200");
        expect(output).toContain("矩形（pt，相对屏幕左上角）：x 0，y 100，宽 200，高 80");
        expect(output).toContain("屏幕：1170×2532 pt（截图与屏幕等比缩放）");
        expect(output).not.toContain("（3x）");
        expect(output).toContain(copied);
        expect(output).toContain("标题字号应为 16");
        expect(output).toContain("间距仍不对");
        expect(output).toContain("已改为 16");
        expect(output).toContain("abc123");
        expect(output).toContain("Home 标题 Text");
    });
    it("prints the raw item JSON with --json and still copies the screenshot", async () => {
        mkdirSync(join(root, "screenshots"), { recursive: true });
        const bytes = Buffer.from([0xff, 0xd8]);
        writeFileSync(storeScreenshot, bytes);
        const review = { worktree };
        const item = makeItem(3, "awaiting_review");
        const origin = await startFakeMetro((_req, res, pathname) => {
            if (pathname === "/__react-native-grab/review/local/items/3") {
                sendJson(res, 200, { ok: true, item, screenshotPath: storeScreenshot });
                return;
            }
            sendJson(res, 200, { ok: true, review });
        });
        await showItem(3, true, { origin, print: (line) => printed.push(line) });
        expect(readFileSync(join(worktree, ".rn-grab-review", "item-3.jpg"))).toEqual(bytes);
        expect(printed).toHaveLength(1);
        expect(JSON.parse(printed[0] ?? "")).toEqual(item);
    });
});
describe("status and mutating commands", () => {
    it("prints the review summary", async () => {
        const full = startStandardReview();
        const origin = await startFakeMetro((_req, res, pathname) => {
            if (pathname === "/__react-native-grab/review/local/status") {
                sendJson(res, 200, { ok: true, review: full });
                return;
            }
            sendJson(res, 404, { ok: false, error: "not_found" });
        });
        await printStatus({ origin, print: (line) => printed.push(line) });
        const output = printed.join("\n");
        expect(output).toContain("20261112-090506");
        expect(output).toContain("fix/design-review-20261112-0905");
        expect(output).toContain("#1");
        expect(output).toContain("待复验");
        expect(output).toContain("#2");
        expect(output).toContain("待修复");
    });
    it("claims an item and prints its new status", async () => {
        const origin = await startFakeMetro((_req, res, pathname) => {
            if (pathname === "/__react-native-grab/review/local/items/2/claim") {
                sendJson(res, 200, { ok: true, item: makeItem(2, "fixing"), screenshotPath: null });
                return;
            }
            sendJson(res, 404, { ok: false, error: "not_found" });
        });
        await claim(2, { origin, print: (line) => printed.push(line) });
        expect(requests).toContainEqual({
            method: "POST",
            pathname: "/__react-native-grab/review/local/items/2/claim",
            body: "",
        });
        expect(printed.join("\n")).toContain("#2");
        expect(printed.join("\n")).toContain("修复中");
    });
    it("replies with the message and repeated commits", async () => {
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
        await reply(1, "已修复", ["aaaa", "bbbb"], { origin, print: (line) => printed.push(line) });
        expect(requests).toContainEqual({
            method: "POST",
            pathname: "/__react-native-grab/review/local/items/1/reply",
            body: JSON.stringify({ reply: "已修复", commits: ["aaaa", "bbbb"] }),
        });
    });
    it("completes with and without an MR url", async () => {
        const origin = await startFakeMetro((_req, res) => {
            sendJson(res, 200, { ok: true });
        });
        await complete("https://gitlab/mr/1", { origin, print: (line) => printed.push(line) });
        await complete(null, { origin, print: (line) => printed.push(line) });
        expect(requests.filter((request) => request.pathname.endsWith("/local/complete"))).toEqual([
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
    it("retries the runner", async () => {
        const origin = await startFakeMetro((_req, res) => {
            sendJson(res, 200, { ok: true });
        });
        await retry({ origin, print: (line) => printed.push(line) });
        expect(requests.some((request) => request.pathname.endsWith("/local/retry"))).toBe(true);
    });
    it("surfaces local API error codes", async () => {
        const origin = await startFakeMetro((_req, res) => {
            sendJson(res, 409, { ok: false, error: "invalid_state" });
        });
        await expect(claim("9", { origin, print: () => { } })).rejects.toThrow("invalid_state");
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
    const dir = join(paths.reviewsDir, "20261112-090506");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "review.json"), JSON.stringify({
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
    writeActive(paths, { reviewId: "20261112-090506", dir });
    return dir;
};
describe("stopReview", () => {
    it("uses local/stop when Metro answers and then clears the active file", async () => {
        const dir = writeReviewFiles("active");
        const origin = await startFakeMetro((_req, res) => {
            sendJson(res, 200, { ok: true });
        });
        await stopReview(paths, { origin, print: (line) => printed.push(line) });
        expect(requests.some((request) => request.pathname.endsWith("/local/stop"))).toBe(true);
        expect(existsSync(paths.activeFile)).toBe(false);
        expect(JSON.parse(readFileSync(join(dir, "review.json"), "utf8")).status).toBe("active");
        expect(printed.join("\n")).toContain("已结束");
    });
    it("abandons the review on disk when Metro is offline", async () => {
        const dir = writeReviewFiles("active");
        await stopReview(paths, {
            origin: "http://127.0.0.1:1",
            print: (line) => printed.push(line),
        });
        expect(JSON.parse(readFileSync(join(dir, "review.json"), "utf8")).status).toBe("abandoned");
        expect(existsSync(paths.activeFile)).toBe(false);
    });
    it("reports when there is no active review", async () => {
        await stopReview(paths, {
            origin: "http://127.0.0.1:1",
            print: (line) => printed.push(line),
        });
        expect(printed.join("\n")).toContain("没有进行中的走查");
    });
});
//# sourceMappingURL=local-client.test.js.map