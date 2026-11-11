import { createServer } from "node:http";
import { existsSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NOW, awaiting, draftWithCommits, fixing, freshDraft, makeReview, passed, queued, } from "../../../review-core/__tests__/fixtures";
import { attachScreenshot, beginFinish, createItem } from "../../../review-core/transitions";
import { REVIEW_CODE_HEADER, REVIEW_ROUTE_PREFIX, createReviewHandler } from "../http";
import { ReviewStore } from "../store";
const PAIRING_CODE = "012345";
const WORKTREE = "/Users/dev/.react-native-grab/worktrees/Example";
const REVERT_MESSAGE = "fix(design-review): #1 撤销走查修改";
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const makeGit = () => ({
    verifyItemCommits: vi.fn(async (_cwd, _base, shas, _claimedByOthers) => ({ ok: true, shas })),
    revertCommits: vi.fn(async (_cwd, _shas, _message) => ({
        ok: true,
        commit: "dead00",
    })),
});
const makeRunner = () => ({
    busy: false,
    blocked: false,
    kick: vi.fn(() => { }),
    unblock: vi.fn(() => { }),
    stop: vi.fn(() => { }),
});
let root;
const servers = [];
beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "rn-grab-http-"));
});
afterEach(async () => {
    await Promise.all(servers.map((server) => new Promise((resolve) => server.close(() => resolve()))));
    servers.length = 0;
    rmSync(root, { recursive: true, force: true });
});
const setup = async (review, options) => {
    const store = ReviewStore.create(mkdtempSync(join(root, "review-")), review);
    const git = makeGit();
    const runner = makeRunner();
    const handler = createReviewHandler({
        store,
        git,
        runner,
        now: () => NOW,
        isLoopback: options?.isLoopback,
    });
    const server = createServer((req, res) => {
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
const auth = { [REVIEW_CODE_HEADER]: PAIRING_CODE };
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
describe("pairing and gatekeeping", () => {
    it("pairs with the correct code and returns the device review view", async () => {
        const s = await setup(freshDraft());
        const res = await post(s.baseUrl, `${REVIEW_ROUTE_PREFIX}pair`, { code: PAIRING_CODE });
        expect(res.status).toBe(200);
        const body = await json(res);
        expect(body.ok).toBe(true);
        expect(body.review).toMatchObject({
            id: "20261111-080000",
            base: "feature/liquidGlass",
            branch: "fix/design-review-20261111-0800",
            status: "active",
            mrUrl: null,
        });
    });
    it("rejects a wrong pairing code with 401", async () => {
        const s = await setup(freshDraft());
        const res = await post(s.baseUrl, `${REVIEW_ROUTE_PREFIX}pair`, { code: "111111" });
        expect(res.status).toBe(401);
        expect((await json(res)).error).toBe("bad_code");
    });
    it("locks the remote address after five consecutive wrong codes", async () => {
        const s = await setup(freshDraft());
        for (let i = 0; i < 5; i++) {
            const wrong = await post(s.baseUrl, `${REVIEW_ROUTE_PREFIX}pair`, { code: "999999" });
            expect(wrong.status).toBe(401);
        }
        const locked = await post(s.baseUrl, `${REVIEW_ROUTE_PREFIX}pair`, { code: PAIRING_CODE });
        expect(locked.status).toBe(403);
        expect((await json(locked)).error).toBe("locked");
    });
    it("resets consecutive failures after a successful pair", async () => {
        const s = await setup(freshDraft());
        await post(s.baseUrl, `${REVIEW_ROUTE_PREFIX}pair`, { code: "000000" });
        await post(s.baseUrl, `${REVIEW_ROUTE_PREFIX}pair`, { code: "000000" });
        const recovered = await post(s.baseUrl, `${REVIEW_ROUTE_PREFIX}pair`, { code: PAIRING_CODE });
        expect(recovered.status).toBe(200);
        for (let i = 0; i < 4; i++) {
            await post(s.baseUrl, `${REVIEW_ROUTE_PREFIX}pair`, { code: "000000" });
        }
        const stillOpen = await post(s.baseUrl, `${REVIEW_ROUTE_PREFIX}pair`, { code: PAIRING_CODE });
        expect(stillOpen.status).toBe(200);
    });
    it("rejects device routes without a valid code header", async () => {
        const s = await setup(makeReview());
        const res = await post(s.baseUrl, `${REVIEW_ROUTE_PREFIX}items`, {
            kind: "element",
            description: "x",
        });
        expect(res.status).toBe(401);
        expect((await json(res)).error).toBe("bad_code");
        expect(s.store.get().items).toHaveLength(0);
    });
    it("counts header failures toward the address lock", async () => {
        const s = await setup(freshDraft());
        for (let i = 0; i < 5; i++) {
            const wrong = await get(s.baseUrl, `${REVIEW_ROUTE_PREFIX}state`, {
                [REVIEW_CODE_HEADER]: "999999",
            });
            expect(wrong.status).toBe(401);
        }
        const locked = await get(s.baseUrl, `${REVIEW_ROUTE_PREFIX}state`, auth);
        expect(locked.status).toBe(403);
        expect((await json(locked)).error).toBe("locked");
    });
    it("rejects non-loopback callers on local routes with 403", async () => {
        const s = await setup(makeReview(), { isLoopback: () => false });
        const res = await get(s.baseUrl, `${REVIEW_ROUTE_PREFIX}local/status`);
        expect(res.status).toBe(403);
        expect((await json(res)).error).toBe("forbidden");
    });
    it("passes non-review routes through next", async () => {
        const s = await setup(makeReview());
        const res = await get(s.baseUrl, "/not-a-review-route");
        expect(res.status).toBe(404);
        expect((await json(res)).error).toBe("next");
    });
    it("rejects non-string pairing codes with 400", async () => {
        const s = await setup(freshDraft());
        const res = await post(s.baseUrl, `${REVIEW_ROUTE_PREFIX}pair`, { code: 123 });
        expect(res.status).toBe(400);
        expect((await json(res)).error).toBe("invalid_input");
    });
});
describe("device item routes", () => {
    it("creates an item without a screenshot", async () => {
        const s = await setup(makeReview());
        const res = await post(s.baseUrl, `${REVIEW_ROUTE_PREFIX}items`, {
            kind: "element",
            description: "标题字号应为 16",
        }, auth);
        expect(res.status).toBe(201);
        const body = await json(res);
        expect(body.ok).toBe(true);
        expect(body.item.screenshotUrl).toBe(null);
        expect(body.item).toMatchObject({ no: 1, status: "draft", actions: ["edit", "delete"] });
        expect(s.store.get().items).toHaveLength(1);
    });
    it("creates an item with a 1 MiB screenshot and writes the file", async () => {
        const s = await setup(makeReview());
        const jpeg = Buffer.alloc(1024 * 1024, 0x41);
        const res = await post(s.baseUrl, `${REVIEW_ROUTE_PREFIX}items`, {
            kind: "page",
            description: "页面间距",
            screenshotJpegBase64: jpeg.toString("base64"),
        }, auth);
        expect(res.status).toBe(201);
        const body = await json(res);
        expect(body.item.screenshotUrl).toBe(`${REVIEW_ROUTE_PREFIX}screenshots/1.jpg`);
        const path = s.store.screenshotPath("1.jpg");
        expect(existsSync(path)).toBe(true);
        expect(statSync(path).size).toBe(1024 * 1024);
    });
    it("creates an item with optional metadata and stores it for local readers", async () => {
        const s = await setup(makeReview());
        const res = await post(s.baseUrl, `${REVIEW_ROUTE_PREFIX}items`, {
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
        expect(res.status).toBe(201);
        const status = await get(s.baseUrl, `${REVIEW_ROUTE_PREFIX}local/status`);
        const body = await json(status);
        const review = body.review;
        const item = review.items[0];
        expect(item.scope).toBe("shared");
        expect(item.figmaUrl).toBe("https://figma.com/file/x");
        expect(item.rect).toEqual({ x: 1, y: 2, width: 3, height: 4 });
        expect(item.screen).toEqual({ width: 390, height: 844, scale: 3 });
        expect(item.route).toBe("Home");
        expect(item.grab).toMatchObject({ description: "抓取", frames: [{ name: "Text" }] });
        expect(item.device).toEqual({ model: "iPhone 17", os: "iOS 26", appVersion: "1.2.0" });
    });
    it("rejects invalid item payloads with 400", async () => {
        const s = await setup(makeReview());
        const badKind = await post(s.baseUrl, `${REVIEW_ROUTE_PREFIX}items`, {
            kind: "x",
            description: "d",
        }, auth);
        expect(badKind.status).toBe(400);
        expect((await json(badKind)).error).toBe("invalid_input");
        const badScreen = await post(s.baseUrl, `${REVIEW_ROUTE_PREFIX}items`, {
            kind: "element",
            description: "d",
            screen: { width: "a" },
        }, auth);
        expect(badScreen.status).toBe(400);
        const badGrab = await post(s.baseUrl, `${REVIEW_ROUTE_PREFIX}items`, {
            kind: "element",
            description: "d",
            grab: { description: "g", frames: {} },
        }, auth);
        expect(badGrab.status).toBe(400);
        expect(s.store.get().items).toHaveLength(0);
    });
    it("rejects a blank description with empty_text", async () => {
        const s = await setup(makeReview());
        const res = await post(s.baseUrl, `${REVIEW_ROUTE_PREFIX}items`, {
            kind: "element",
            description: "   ",
        }, auth);
        expect(res.status).toBe(400);
        expect((await json(res)).error).toBe("empty_text");
    });
    it("rejects malformed screenshot payloads with 400", async () => {
        const s = await setup(makeReview());
        const res = await post(s.baseUrl, `${REVIEW_ROUTE_PREFIX}items`, {
            kind: "element",
            description: "d",
            screenshotJpegBase64: "not base64!!",
        }, auth);
        expect(res.status).toBe(400);
        expect((await json(res)).error).toBe("invalid_input");
        expect(s.store.get().items).toHaveLength(0);
        expect(existsSync(join(s.store.dir, "screenshots", "1.jpg"))).toBe(false);
    });
    it("patches a draft", async () => {
        const s = await setup(freshDraft());
        const res = await patch(s.baseUrl, `${REVIEW_ROUTE_PREFIX}items/1`, {
            description: "新文案",
            scope: "shared",
        }, auth);
        expect(res.status).toBe(200);
        const body = await json(res);
        expect(body.item).toMatchObject({ no: 1, status: "draft", scope: "shared" });
        expect(s.store.get().items[0].rounds[0].description).toBe("新文案");
    });
    it("deletes a draft without commits", async () => {
        const s = await setup(freshDraft());
        const res = await del(s.baseUrl, `${REVIEW_ROUTE_PREFIX}items/1`, auth);
        expect(res.status).toBe(200);
        const body = await json(res);
        expect(body.ok).toBe(true);
        expect(s.store.get().items).toHaveLength(0);
    });
    it("refuses to delete an item with commits", async () => {
        const s = await setup(draftWithCommits());
        const res = await del(s.baseUrl, `${REVIEW_ROUTE_PREFIX}items/1`, auth);
        expect(res.status).toBe(409);
        expect((await json(res)).error).toBe("has_commits");
        expect(s.store.get().items).toHaveLength(1);
    });
    it("rejects malformed item numbers with 400", async () => {
        const s = await setup(freshDraft());
        const device = await patch(s.baseUrl, `${REVIEW_ROUTE_PREFIX}items/abc`, { description: "x" }, auth);
        expect(device.status).toBe(400);
        expect((await json(device)).error).toBe("invalid_input");
        const local = await get(s.baseUrl, `${REVIEW_ROUTE_PREFIX}local/items/abc`);
        expect(local.status).toBe(400);
        expect((await json(local)).error).toBe("invalid_input");
    });
});
describe("device review flow", () => {
    it("returns state with runner-gated actions", async () => {
        const s = await setup(awaiting());
        const first = await get(s.baseUrl, `${REVIEW_ROUTE_PREFIX}state`, auth);
        expect(first.status).toBe(200);
        const body = await json(first);
        expect(body.runner).toEqual({ busy: false, blocked: false });
        expect(body.items[0].actions).toEqual([
            "pass",
            "reject",
            "revert",
        ]);
        s.runner.busy = true;
        const second = await get(s.baseUrl, `${REVIEW_ROUTE_PREFIX}state`, auth);
        const busyBody = await json(second);
        expect(busyBody.items[0].actions).toEqual([
            "pass",
            "reject",
        ]);
        expect(busyBody.runner.busy).toBe(true);
    });
    it("submits drafts and kicks the runner exactly once", async () => {
        const s = await setup(freshDraft());
        const res = await post(s.baseUrl, `${REVIEW_ROUTE_PREFIX}submit`, {}, auth);
        expect(res.status).toBe(200);
        const body = await json(res);
        expect(body.submitted).toEqual([1]);
        expect(s.runner.kick).toHaveBeenCalledTimes(1);
        expect(s.store.get().items[0].status).toBe("queued");
        expect(s.store.get().items[0].rounds[0].submittedAt).toBe(NOW.toISOString());
    });
    it("passes an awaiting item", async () => {
        const s = await setup(awaiting());
        const res = await post(s.baseUrl, `${REVIEW_ROUTE_PREFIX}items/1/pass`, {}, auth);
        expect(res.status).toBe(200);
        const body = await json(res);
        expect(body.item.status).toBe("passed");
        expect(s.store.get().items[0].status).toBe("passed");
    });
    it("rejects an awaiting item with a supplement", async () => {
        const s = await setup(awaiting());
        const res = await post(s.baseUrl, `${REVIEW_ROUTE_PREFIX}items/1/reject`, {
            supplement: "间距仍不对",
        }, auth);
        expect(res.status).toBe(200);
        const body = await json(res);
        expect(body.item.status).toBe("draft");
        const item = s.store.get().items[0];
        expect(item.rounds).toHaveLength(2);
        expect(item.rounds[1].description).toBe("间距仍不对");
    });
    it("rejects a blank supplement with empty_text", async () => {
        const s = await setup(awaiting());
        const res = await post(s.baseUrl, `${REVIEW_ROUTE_PREFIX}items/1/reject`, { supplement: " " }, auth);
        expect(res.status).toBe(400);
        expect((await json(res)).error).toBe("empty_text");
    });
    it("refuses to finish while items are open", async () => {
        const s = await setup(freshDraft());
        const res = await post(s.baseUrl, `${REVIEW_ROUTE_PREFIX}finish`, {}, auth);
        expect(res.status).toBe(409);
        expect((await json(res)).error).toBe("not_finishable");
        expect(s.store.get().status).toBe("active");
    });
    it("finishes a fully passed review and kicks the runner", async () => {
        const s = await setup(passed());
        const res = await post(s.baseUrl, `${REVIEW_ROUTE_PREFIX}finish`, {}, auth);
        expect(res.status).toBe(200);
        expect(await json(res)).toEqual({ ok: true });
        expect(s.store.get().status).toBe("finishing");
        expect(s.runner.kick).toHaveBeenCalledTimes(1);
    });
});
describe("screenshots", () => {
    it("serves a stored screenshot as image/jpeg", async () => {
        const s = await setup(attachScreenshot(freshDraft(), 1, "1.jpg"));
        writeFileSync(join(s.store.dir, "screenshots", "1.jpg"), JPEG_BYTES);
        const res = await get(s.baseUrl, `${REVIEW_ROUTE_PREFIX}screenshots/1.jpg`, auth);
        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toBe("image/jpeg");
        expect(Buffer.from(await res.arrayBuffer())).toEqual(JPEG_BYTES);
    });
    it("rejects path traversal in screenshot names with 400", async () => {
        const s = await setup(freshDraft());
        const res = await get(s.baseUrl, `${REVIEW_ROUTE_PREFIX}screenshots/..%2F..%2Fetc`, auth);
        expect(res.status).toBe(400);
        expect((await json(res)).error).toBe("invalid_input");
    });
    it("responds 404 for a missing screenshot file", async () => {
        const s = await setup(freshDraft());
        const res = await get(s.baseUrl, `${REVIEW_ROUTE_PREFIX}screenshots/9.jpg`, auth);
        expect(res.status).toBe(404);
        expect((await json(res)).error).toBe("not_found");
    });
});
describe("revert", () => {
    it("refuses to revert while the runner is busy", async () => {
        const s = await setup(awaiting());
        s.runner.busy = true;
        const res = await post(s.baseUrl, `${REVIEW_ROUTE_PREFIX}items/1/revert`, {}, auth);
        expect(res.status).toBe(409);
        expect((await json(res)).error).toBe("runner_busy");
        expect(s.git.revertCommits).not.toHaveBeenCalled();
        expect(s.store.get().items[0].status).toBe("awaiting_review");
    });
    it("maps git conflicts to 409 and keeps the item awaiting review", async () => {
        const s = await setup(awaiting());
        s.git.revertCommits.mockResolvedValueOnce({ ok: false, reason: "conflict" });
        const res = await post(s.baseUrl, `${REVIEW_ROUTE_PREFIX}items/1/revert`, {}, auth);
        expect(res.status).toBe(409);
        expect((await json(res)).error).toBe("conflict");
        expect(s.store.get().items[0].status).toBe("awaiting_review");
        expect(s.runner.kick).not.toHaveBeenCalled();
    });
    it("reverts the stored commits and marks the item reverted without kicking", async () => {
        const s = await setup(awaiting());
        const res = await post(s.baseUrl, `${REVIEW_ROUTE_PREFIX}items/1/revert`, {}, auth);
        expect(res.status).toBe(200);
        const body = await json(res);
        expect(body.item).toMatchObject({ no: 1, status: "reverted", revertCommit: "dead00" });
        expect(s.git.revertCommits).toHaveBeenCalledWith(WORKTREE, ["abc"], REVERT_MESSAGE);
        expect(s.runner.kick).not.toHaveBeenCalled();
        expect(s.store.get().revertedSinceLastRun).toEqual([1]);
    });
    it("refuses to revert a fresh draft without commits", async () => {
        const s = await setup(freshDraft());
        const res = await post(s.baseUrl, `${REVIEW_ROUTE_PREFIX}items/1/revert`, {}, auth);
        expect(res.status).toBe(409);
        expect((await json(res)).error).toBe("invalid_state");
        expect(s.git.revertCommits).not.toHaveBeenCalled();
    });
});
describe("local agent routes", () => {
    it("status returns the full stored review", async () => {
        const review = createItem(makeReview(), {
            kind: "element",
            description: "标题",
            grab: {
                description: "按钮",
                frames: [{ name: "Button", file: "App.tsx", line: 1, column: 2 }],
            },
        }, NOW).review;
        const s = await setup(review);
        const res = await get(s.baseUrl, `${REVIEW_ROUTE_PREFIX}local/status`);
        expect(res.status).toBe(200);
        const body = await json(res);
        expect(body.ok).toBe(true);
        expect(body.review).toMatchObject({
            id: "20261111-080000",
            worktree: WORKTREE,
            status: "active",
            nextItemNo: 2,
        });
        const items = body.review.items;
        expect(items[0]).toMatchObject({
            no: 1,
            status: "draft",
            screenshot: null,
            revertCommit: null,
            grab: { description: "按钮" },
        });
    });
    it("returns a full item with an absolute screenshot path", async () => {
        const s = await setup(attachScreenshot(freshDraft(), 1, "1.jpg"));
        writeFileSync(join(s.store.dir, "screenshots", "1.jpg"), JPEG_BYTES);
        const res = await get(s.baseUrl, `${REVIEW_ROUTE_PREFIX}local/items/1`);
        expect(res.status).toBe(200);
        const body = await json(res);
        expect(body.item).toMatchObject({ no: 1, status: "draft", screenshot: "1.jpg" });
        expect(body.screenshotPath).toBe(s.store.screenshotPath("1.jpg"));
    });
    it("claims a queued item", async () => {
        const s = await setup(queued());
        const res = await post(s.baseUrl, `${REVIEW_ROUTE_PREFIX}local/items/1/claim`, {});
        expect(res.status).toBe(200);
        const body = await json(res);
        expect(body.item).toMatchObject({ no: 1, status: "fixing", lastError: null });
        expect(s.store.get().items[0].status).toBe("fixing");
    });
    it("reply verifies commits in the worktree and 400s unknown SHAs", async () => {
        const s = await setup(fixing());
        s.git.verifyItemCommits.mockResolvedValueOnce({ ok: false, reason: "missing", sha: "0bad" });
        const res = await post(s.baseUrl, `${REVIEW_ROUTE_PREFIX}local/items/1/reply`, {
            reply: "已修复",
            commits: ["0bad"],
        });
        expect(res.status).toBe(400);
        expect((await json(res)).error).toBe("invalid_commits");
        expect(s.store.get().items[0].status).toBe("fixing");
        expect(s.git.verifyItemCommits).toHaveBeenCalledTimes(1);
        const call = vi.mocked(s.git.verifyItemCommits).mock.calls[0];
        expect(call[0]).toBe(WORKTREE);
        expect(call[1]).toBe("feature/liquidGlass");
        expect(call[2]).toEqual(["0bad"]);
    });
    it("reply stores normalized shas and moves the item to awaiting review", async () => {
        const s = await setup(fixing());
        s.git.verifyItemCommits.mockResolvedValueOnce({ ok: true, shas: ["full123"] });
        const res = await post(s.baseUrl, `${REVIEW_ROUTE_PREFIX}local/items/1/reply`, {
            reply: "已修复",
            commits: ["full"],
        });
        expect(res.status).toBe(200);
        const body = await json(res);
        expect(body.item).toMatchObject({ no: 1, status: "awaiting_review" });
        const item = s.store.get().items[0];
        expect(item.rounds[0].commits).toEqual(["full123"]);
        expect(item.rounds[0].reply).toBe("已修复");
        expect(item.rounds[0].repliedAt).toBe(NOW.toISOString());
    });
    it("reply rejects malformed bodies without touching the store", async () => {
        const s = await setup(fixing());
        const badReply = await post(s.baseUrl, `${REVIEW_ROUTE_PREFIX}local/items/1/reply`, {
            reply: 5,
            commits: [],
        });
        expect(badReply.status).toBe(400);
        const badCommits = await post(s.baseUrl, `${REVIEW_ROUTE_PREFIX}local/items/1/reply`, {
            reply: "ok",
            commits: "x",
        });
        expect(badCommits.status).toBe(400);
        expect((await json(badCommits)).error).toBe("invalid_input");
        expect(s.git.verifyItemCommits).not.toHaveBeenCalled();
        expect(s.store.get().items[0].status).toBe("fixing");
    });
    it("reply refuses non-fixing items before touching git", async () => {
        const s = await setup(awaiting());
        const res = await post(s.baseUrl, `${REVIEW_ROUTE_PREFIX}local/items/1/reply`, {
            reply: "ok",
            commits: ["a"],
        });
        expect(res.status).toBe(409);
        expect((await json(res)).error).toBe("invalid_state");
        expect(s.git.verifyItemCommits).not.toHaveBeenCalled();
    });
    it("complete requires the finishing state on open reviews", async () => {
        const s = await setup(freshDraft());
        const res = await post(s.baseUrl, `${REVIEW_ROUTE_PREFIX}local/complete`, {
            mrUrl: "https://gitlab/mr/1",
        });
        expect(res.status).toBe(409);
        expect((await json(res)).error).toBe("invalid_state");
    });
    it("completes a finishing review with the mr URL", async () => {
        const s = await setup(beginFinish(passed()));
        const res = await post(s.baseUrl, `${REVIEW_ROUTE_PREFIX}local/complete`, {
            mrUrl: "https://gitlab/mr/1",
        });
        expect(res.status).toBe(200);
        expect(await json(res)).toEqual({ ok: true });
        expect(s.store.get()).toMatchObject({ status: "done", mrUrl: "https://gitlab/mr/1" });
    });
    it("stop closes the review, stops the runner and blocks complete and retry", async () => {
        const s = await setup(fixing());
        const res = await post(s.baseUrl, `${REVIEW_ROUTE_PREFIX}local/stop`, {});
        expect(res.status).toBe(200);
        expect(s.store.get().status).toBe("abandoned");
        expect(s.runner.stop).toHaveBeenCalledTimes(1);
        const complete = await post(s.baseUrl, `${REVIEW_ROUTE_PREFIX}local/complete`, {
            mrUrl: "https://gitlab/mr/1",
        });
        expect(complete.status).toBe(409);
        expect((await json(complete)).error).toBe("review_closed");
        const retry = await post(s.baseUrl, `${REVIEW_ROUTE_PREFIX}local/retry`, {});
        expect(retry.status).toBe(409);
        expect((await json(retry)).error).toBe("review_closed");
    });
    it("retry unblocks and kicks an open review", async () => {
        const s = await setup(fixing());
        const res = await post(s.baseUrl, `${REVIEW_ROUTE_PREFIX}local/retry`, {});
        expect(res.status).toBe(200);
        expect(await json(res)).toEqual({ ok: true });
        expect(s.runner.unblock).toHaveBeenCalledTimes(1);
        expect(s.runner.kick).toHaveBeenCalledTimes(1);
    });
    it("responds 404 for unknown routes", async () => {
        const s = await setup(makeReview());
        const device = await get(s.baseUrl, `${REVIEW_ROUTE_PREFIX}unknown`, auth);
        expect(device.status).toBe(404);
        expect((await json(device)).error).toBe("not_found");
        const local = await get(s.baseUrl, `${REVIEW_ROUTE_PREFIX}local/unknown`);
        expect(local.status).toBe(404);
    });
});
describe("body limits and payload errors", () => {
    it("rejects malformed JSON bodies with 400", async () => {
        const s = await setup(makeReview());
        const res = await send(s.baseUrl, "POST", `${REVIEW_ROUTE_PREFIX}pair`, "{not json");
        expect(res.status).toBe(400);
        expect((await json(res)).error).toBe("invalid_input");
    });
    it("rejects non-item payloads above 64 KiB with 413", async () => {
        const s = await setup(makeReview());
        const res = await send(s.baseUrl, "POST", `${REVIEW_ROUTE_PREFIX}pair`, "x".repeat(80 * 1024));
        expect(res.status).toBe(413);
        expect((await json(res)).error).toBe("payload_too_large");
    });
    it("rejects item payloads above 12 MiB with 413", async () => {
        const s = await setup(makeReview());
        const res = await send(s.baseUrl, "POST", `${REVIEW_ROUTE_PREFIX}items`, {
            kind: "element",
            description: "y".repeat(13 * 1024 * 1024),
        }, auth);
        expect(res.status).toBe(413);
        expect((await json(res)).error).toBe("payload_too_large");
        expect(s.store.get().items).toHaveLength(0);
    });
});
//# sourceMappingURL=http.test.js.map