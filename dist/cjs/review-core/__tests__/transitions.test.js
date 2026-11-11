"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const transitions_1 = require("../transitions");
const types_1 = require("../types");
const fixtures_1 = require("./fixtures");
const now = new Date("2026-11-11T08:00:00Z");
(0, vitest_1.describe)("design-review state machine", () => {
    (0, vitest_1.it)("walks an item draft → queued → fixing → awaiting_review → passed", () => {
        let r = (0, transitions_1.createItem)((0, fixtures_1.makeReview)(), { kind: "element", description: "标题字号应为 16" }, now).review;
        (0, vitest_1.expect)(r.items[0]).toMatchObject({ no: 1, status: "draft", scope: "local" });
        r = (0, transitions_1.submitDrafts)(r, now).review;
        (0, vitest_1.expect)(r.items[0].status).toBe("queued");
        r = (0, transitions_1.claimItem)(r, 1);
        r = (0, transitions_1.replyItem)(r, 1, "已改为 16", ["abc"], now);
        (0, vitest_1.expect)(r.items[0].rounds[0]).toMatchObject({ reply: "已改为 16", commits: ["abc"] });
        (0, vitest_1.expect)((0, transitions_1.passItem)(r, 1).items[0].status).toBe("passed");
    });
    (0, vitest_1.it)("reject appends a round and returns the item to draft", () => {
        const r = (0, transitions_1.rejectItem)((0, fixtures_1.awaiting)(), 1, "间距还是不对", now);
        const item = r.items[0];
        (0, vitest_1.expect)(item.status).toBe("draft");
        (0, vitest_1.expect)(item.rounds.length).toBe(2);
        (0, vitest_1.expect)(item.rounds[0].description).toBe("标题字号应为 16");
        (0, vitest_1.expect)(item.rounds[1]).toMatchObject({
            description: "间距还是不对",
            createdAt: now.toISOString(),
            submittedAt: null,
            reply: null,
            repliedAt: null,
            commits: [],
        });
    });
    (0, vitest_1.it)("refuses to delete a draft that has commits", () => {
        (0, vitest_1.expect)(() => (0, transitions_1.deleteDraft)((0, fixtures_1.rejectedWithCommits)(), 1)).toThrow(vitest_1.expect.objectContaining({ code: "has_commits" }));
    });
    (0, vitest_1.it)("reverts from awaiting_review and from a draft with commits, never from passed", () => {
        let r = (0, transitions_1.markReverted)((0, fixtures_1.awaiting)(), 1, "rev-abc");
        (0, vitest_1.expect)(r.items[0]).toMatchObject({ status: "reverted", revertCommit: "rev-abc" });
        (0, vitest_1.expect)(r.revertedSinceLastRun).toContain(1);
        r = (0, transitions_1.markReverted)((0, fixtures_1.draftWithCommits)(), 1, "rev-def");
        (0, vitest_1.expect)(r.items[0]).toMatchObject({ status: "reverted", revertCommit: "rev-def" });
        (0, vitest_1.expect)(r.revertedSinceLastRun).toContain(1);
        (0, vitest_1.expect)(() => (0, transitions_1.markReverted)((0, fixtures_1.passed)(), 1, "rev-ghi")).toThrow(vitest_1.expect.objectContaining({ code: "invalid_state" }));
    });
    (0, vitest_1.it)("derives actions", () => {
        (0, vitest_1.expect)((0, transitions_1.getItemActions)((0, fixtures_1.freshDraft)().items[0], false)).toEqual(["edit", "delete"]);
        (0, vitest_1.expect)((0, transitions_1.getItemActions)((0, fixtures_1.draftWithCommits)().items[0], false)).toEqual(["edit", "revert"]);
        (0, vitest_1.expect)((0, transitions_1.getItemActions)((0, fixtures_1.draftWithCommits)().items[0], true)).toEqual(["edit"]);
        (0, vitest_1.expect)((0, transitions_1.getItemActions)((0, fixtures_1.awaiting)().items[0], false)).toEqual(["pass", "reject", "revert"]);
        (0, vitest_1.expect)((0, transitions_1.getItemActions)((0, fixtures_1.awaiting)().items[0], true)).toEqual(["pass", "reject"]);
        (0, vitest_1.expect)((0, transitions_1.getItemActions)((0, fixtures_1.passed)().items[0], false)).toEqual([]);
        (0, vitest_1.expect)((0, transitions_1.getItemActions)((0, fixtures_1.queued)().items[0], false)).toEqual([]);
        (0, vitest_1.expect)((0, transitions_1.getItemActions)((0, fixtures_1.fixing)().items[0], false)).toEqual([]);
    });
    (0, vitest_1.it)("beginFinish requires every item passed or reverted", () => {
        (0, vitest_1.expect)((0, transitions_1.beginFinish)((0, fixtures_1.passed)()).status).toBe("finishing");
        (0, vitest_1.expect)(() => (0, transitions_1.beginFinish)((0, fixtures_1.awaiting)())).toThrow(vitest_1.expect.objectContaining({ code: "not_finishable" }));
        const reverted = (0, transitions_1.markReverted)((0, fixtures_1.awaiting)(), 1, "rev-abc");
        (0, vitest_1.expect)((0, transitions_1.beginFinish)(reverted).status).toBe("finishing");
    });
    (0, vitest_1.it)("releaseFixing returns fixing items to queued with lastError", () => {
        const released = (0, transitions_1.releaseFixing)((0, fixtures_1.fixing)(), "agent 进程退出");
        (0, vitest_1.expect)(released.items[0]).toMatchObject({ status: "queued", lastError: "agent 进程退出" });
        const reclaimed = (0, transitions_1.claimItem)(released, 1);
        (0, vitest_1.expect)(reclaimed.items[0]).toMatchObject({ status: "fixing", lastError: null });
    });
    (0, vitest_1.it)("rejects blank description or supplement with empty_text", () => {
        (0, vitest_1.expect)(() => (0, transitions_1.createItem)((0, fixtures_1.makeReview)(), { kind: "element", description: "   " }, now)).toThrow(vitest_1.expect.objectContaining({ code: "empty_text" }));
        (0, vitest_1.expect)(() => (0, transitions_1.rejectItem)((0, fixtures_1.awaiting)(), 1, "", now)).toThrow(vitest_1.expect.objectContaining({ code: "empty_text" }));
        (0, vitest_1.expect)(() => (0, transitions_1.updateDraft)((0, fixtures_1.freshDraft)(), 1, { description: "" })).toThrow(vitest_1.expect.objectContaining({ code: "empty_text" }));
        (0, vitest_1.expect)(() => (0, transitions_1.replyItem)((0, fixtures_1.fixing)(), 1, "  ", ["abc"], now)).toThrow(vitest_1.expect.objectContaining({ code: "empty_text" }));
    });
    (0, vitest_1.it)("device mutations throw review_closed when status is not active", () => {
        const closed = (0, transitions_1.beginFinish)((0, fixtures_1.passed)());
        (0, vitest_1.expect)(() => (0, transitions_1.createItem)(closed, { ...(0, fixtures_1.makeItemInput)() }, now)).toThrow(vitest_1.expect.objectContaining({ code: "review_closed" }));
        (0, vitest_1.expect)(() => (0, transitions_1.attachScreenshot)(closed, 1, "1.jpg")).toThrow(vitest_1.expect.objectContaining({ code: "review_closed" }));
        (0, vitest_1.expect)(() => (0, transitions_1.updateDraft)(closed, 1, { description: "再改一句" })).toThrow(vitest_1.expect.objectContaining({ code: "review_closed" }));
        (0, vitest_1.expect)(() => (0, transitions_1.deleteDraft)(closed, 1)).toThrow(vitest_1.expect.objectContaining({ code: "review_closed" }));
        (0, vitest_1.expect)(() => (0, transitions_1.submitDrafts)(closed, now)).toThrow(vitest_1.expect.objectContaining({ code: "review_closed" }));
        (0, vitest_1.expect)(() => (0, transitions_1.passItem)(closed, 1)).toThrow(vitest_1.expect.objectContaining({ code: "review_closed" }));
        (0, vitest_1.expect)(() => (0, transitions_1.rejectItem)(closed, 1, "间距还是不对", now)).toThrow(vitest_1.expect.objectContaining({ code: "review_closed" }));
        (0, vitest_1.expect)(() => (0, transitions_1.markReverted)(closed, 1, "rev-abc")).toThrow(vitest_1.expect.objectContaining({ code: "review_closed" }));
        (0, vitest_1.expect)(() => (0, transitions_1.beginFinish)(closed)).toThrow(vitest_1.expect.objectContaining({ code: "review_closed" }));
    });
    (0, vitest_1.it)("assigns sequential numbers and stores captured context", () => {
        const grab = {
            description: "AppText",
            frames: [{ name: "AppText", file: "AppText.tsx", line: 10, column: 3 }],
        };
        const { review: first, item } = (0, transitions_1.createItem)((0, fixtures_1.makeReview)(), {
            ...(0, fixtures_1.makeItemInput)(),
            kind: "page",
            scope: "shared",
            figmaUrl: "https://figma.com/design/file?node=1",
            rect: { x: 1, y: 2, width: 30, height: 40 },
            screen: { width: 393, height: 852, scale: 3 },
            route: "home",
            grab,
            device: { model: "iPhone 17", os: "iOS 26.0", appVersion: "2.0.0" },
        }, now);
        (0, vitest_1.expect)(item).toMatchObject({
            no: 1,
            kind: "page",
            status: "draft",
            scope: "shared",
            figmaUrl: "https://figma.com/design/file?node=1",
            screenshot: null,
            route: "home",
            revertCommit: null,
            lastError: null,
            createdAt: now.toISOString(),
        });
        (0, vitest_1.expect)(item.grab).toEqual(grab);
        (0, vitest_1.expect)(item.grab).not.toBe(grab);
        const second = (0, transitions_1.createItem)(first, { ...(0, fixtures_1.makeItemInput)() }, now);
        (0, vitest_1.expect)(second.item.no).toBe(2);
        (0, vitest_1.expect)(second.review.nextItemNo).toBe(3);
    });
    (0, vitest_1.it)("attaches a screenshot only to a draft", () => {
        const withShot = (0, transitions_1.attachScreenshot)((0, fixtures_1.freshDraft)(), 1, "screenshots/1.jpg");
        (0, vitest_1.expect)(withShot.items[0].screenshot).toBe("screenshots/1.jpg");
        (0, vitest_1.expect)(() => (0, transitions_1.attachScreenshot)((0, fixtures_1.queued)(), 1, "screenshots/1.jpg")).toThrow(vitest_1.expect.objectContaining({ code: "invalid_state" }));
    });
    (0, vitest_1.it)("updateDraft edits the last unsubmitted round and keeps history", () => {
        let r = (0, transitions_1.updateDraft)((0, fixtures_1.freshDraft)(), 1, { description: "标题字号应为 17", figmaUrl: null });
        (0, vitest_1.expect)(r.items[0].rounds[0].description).toBe("标题字号应为 17");
        r = (0, transitions_1.updateDraft)(r, 1, { scope: "shared" });
        (0, vitest_1.expect)(r.items[0].scope).toBe("shared");
        const cleared = (0, transitions_1.updateDraft)(r, 1, { figmaUrl: "" });
        (0, vitest_1.expect)(cleared.items[0].figmaUrl).toBe(null);
        (0, vitest_1.expect)(() => (0, transitions_1.updateDraft)(r, 1, { scope: "everywhere" })).toThrow(vitest_1.expect.objectContaining({ code: "invalid_input" }));
        (0, vitest_1.expect)(() => (0, transitions_1.createItem)((0, fixtures_1.makeReview)(), { ...(0, fixtures_1.makeItemInput)(), kind: "block" }, now)).toThrow(vitest_1.expect.objectContaining({ code: "invalid_input" }));
        const rejected = (0, fixtures_1.rejectedWithCommits)();
        const historyKept = (0, transitions_1.updateDraft)(rejected, 1, { description: "间距应为 8" });
        (0, vitest_1.expect)(historyKept.items[0].rounds[0].description).toBe("标题字号应为 16");
        (0, vitest_1.expect)(historyKept.items[0].rounds[1].description).toBe("间距应为 8");
        (0, vitest_1.expect)(() => (0, transitions_1.updateDraft)((0, fixtures_1.queued)(), 1, { description: "已提交" })).toThrow(vitest_1.expect.objectContaining({ code: "invalid_state" }));
    });
    (0, vitest_1.it)("deletes a fresh draft without commits", () => {
        const r = (0, transitions_1.deleteDraft)((0, fixtures_1.freshDraft)(), 1);
        (0, vitest_1.expect)(r.items).toHaveLength(0);
        (0, vitest_1.expect)(() => (0, transitions_1.deleteDraft)((0, fixtures_1.awaiting)(), 1)).toThrow(vitest_1.expect.objectContaining({ code: "invalid_state" }));
    });
    (0, vitest_1.it)("submitDrafts submits only drafts and reports their numbers", () => {
        let r = (0, transitions_1.createItem)((0, fixtures_1.makeReview)(), { ...(0, fixtures_1.makeItemInput)() }, now).review;
        r = (0, transitions_1.createItem)(r, { kind: "page", description: "整页留白过大" }, now).review;
        const submitted = (0, transitions_1.submitDrafts)(r, now);
        (0, vitest_1.expect)(submitted.submitted).toEqual([1, 2]);
        (0, vitest_1.expect)(submitted.review.items.map((item) => item.status)).toEqual(["queued", "queued"]);
        const again = (0, transitions_1.submitDrafts)(submitted.review, now);
        (0, vitest_1.expect)(again.submitted).toEqual([]);
        (0, vitest_1.expect)(again.review.items.map((item) => item.status)).toEqual(["queued", "queued"]);
    });
    (0, vitest_1.it)("claims only queued items", () => {
        (0, vitest_1.expect)(() => (0, transitions_1.claimItem)((0, fixtures_1.freshDraft)(), 1)).toThrow(vitest_1.expect.objectContaining({ code: "invalid_state" }));
        (0, vitest_1.expect)(() => (0, transitions_1.claimItem)((0, fixtures_1.fixing)(), 1)).toThrow(vitest_1.expect.objectContaining({ code: "invalid_state" }));
    });
    (0, vitest_1.it)("replies only to fixing items and records the round", () => {
        const expected = vitest_1.expect.objectContaining({ code: "invalid_state" });
        (0, vitest_1.expect)(() => (0, transitions_1.replyItem)((0, fixtures_1.queued)(), 1, "提前回复", ["abc"], now)).toThrow(expected);
        (0, vitest_1.expect)(() => (0, transitions_1.replyItem)((0, fixtures_1.awaiting)(), 1, "重复回复", ["def"], now)).toThrow(expected);
        const r = (0, transitions_1.replyItem)((0, fixtures_1.fixing)(), 1, "需要切图，请设计师提供", [], now);
        (0, vitest_1.expect)(r.items[0]).toMatchObject({ status: "awaiting_review", lastError: null });
        (0, vitest_1.expect)(r.items[0].rounds[0]).toMatchObject({
            reply: "需要切图，请设计师提供",
            repliedAt: now.toISOString(),
            commits: [],
        });
    });
    (0, vitest_1.it)("refuses commits already claimed by an item, including an earlier round", () => {
        const resubmitted = (0, transitions_1.claimItem)((0, transitions_1.submitDrafts)((0, fixtures_1.rejectedWithCommits)(), fixtures_1.LATER).review, 1);
        (0, vitest_1.expect)(resubmitted.items[0].status).toBe("fixing");
        (0, vitest_1.expect)(() => (0, transitions_1.replyItem)(resubmitted, 1, "再次修复", ["abc"], fixtures_1.LATER)).toThrow(vitest_1.expect.objectContaining({ code: "invalid_commits" }));
        (0, vitest_1.expect)(() => (0, transitions_1.replyItem)((0, fixtures_1.fixing)(), 1, "空 commit", ["  "], fixtures_1.LATER)).toThrow(vitest_1.expect.objectContaining({ code: "invalid_commits" }));
        (0, vitest_1.expect)(() => (0, transitions_1.replyItem)((0, fixtures_1.fixing)(), 1, "复用", ["abc", "abc"], fixtures_1.LATER)).toThrow(vitest_1.expect.objectContaining({ code: "invalid_commits" }));
    });
    (0, vitest_1.it)("passes only items awaiting review", () => {
        (0, vitest_1.expect)(() => (0, transitions_1.passItem)((0, fixtures_1.freshDraft)(), 1)).toThrow(vitest_1.expect.objectContaining({ code: "invalid_state" }));
        (0, vitest_1.expect)(() => (0, transitions_1.passItem)((0, fixtures_1.passed)(), 1)).toThrow(vitest_1.expect.objectContaining({ code: "invalid_state" }));
    });
    (0, vitest_1.it)("collects commits across rounds, oldest first", () => {
        const resubmitted = (0, transitions_1.claimItem)((0, transitions_1.submitDrafts)((0, fixtures_1.rejectedWithCommits)(), fixtures_1.LATER).review, 1);
        const r = (0, transitions_1.replyItem)(resubmitted, 1, "已改为 17", ["abc2"], fixtures_1.LATER);
        (0, vitest_1.expect)((0, transitions_1.itemCommits)(r.items[0])).toEqual(["abc", "abc2"]);
        (0, vitest_1.expect)((0, transitions_1.itemCommits)((0, fixtures_1.freshDraft)().items[0])).toEqual([]);
    });
    (0, vitest_1.it)("completes a review and abandons it", () => {
        const finishing = (0, transitions_1.beginFinish)((0, fixtures_1.passed)());
        const done = (0, transitions_1.completeReview)(finishing, "https://git-pt.nie.netease.com/Example/-/merge_requests/1");
        (0, vitest_1.expect)(done).toMatchObject({
            status: "done",
            mrUrl: "https://git-pt.nie.netease.com/Example/-/merge_requests/1",
        });
        const closed = (0, transitions_1.completeReview)(finishing, null);
        (0, vitest_1.expect)(closed).toMatchObject({ status: "done", mrUrl: null });
        (0, vitest_1.expect)(() => (0, transitions_1.completeReview)((0, fixtures_1.passed)(), "mr")).toThrow(vitest_1.expect.objectContaining({ code: "invalid_state" }));
        (0, vitest_1.expect)((0, transitions_1.abandonReview)((0, fixtures_1.passed)()).status).toBe("abandoned");
        (0, vitest_1.expect)((0, transitions_1.abandonReview)(finishing).status).toBe("abandoned");
        (0, vitest_1.expect)(() => (0, transitions_1.abandonReview)(done)).toThrow(vitest_1.expect.objectContaining({ code: "invalid_state" }));
    });
    (0, vitest_1.it)("throws not_found for unknown items", () => {
        const expected = vitest_1.expect.objectContaining({ code: "not_found" });
        (0, vitest_1.expect)(() => (0, transitions_1.attachScreenshot)((0, fixtures_1.freshDraft)(), 9, "9.jpg")).toThrow(expected);
        (0, vitest_1.expect)(() => (0, transitions_1.updateDraft)((0, fixtures_1.freshDraft)(), 9, { description: "x" })).toThrow(expected);
        (0, vitest_1.expect)(() => (0, transitions_1.deleteDraft)((0, fixtures_1.freshDraft)(), 9)).toThrow(expected);
        (0, vitest_1.expect)(() => (0, transitions_1.claimItem)((0, fixtures_1.freshDraft)(), 9)).toThrow(expected);
        (0, vitest_1.expect)(() => (0, transitions_1.replyItem)((0, fixtures_1.freshDraft)(), 9, "x", [], now)).toThrow(expected);
        (0, vitest_1.expect)(() => (0, transitions_1.passItem)((0, fixtures_1.freshDraft)(), 9)).toThrow(expected);
        (0, vitest_1.expect)(() => (0, transitions_1.rejectItem)((0, fixtures_1.freshDraft)(), 9, "x", now)).toThrow(expected);
        (0, vitest_1.expect)(() => (0, transitions_1.markReverted)((0, fixtures_1.freshDraft)(), 9, null)).toThrow(expected);
    });
    (0, vitest_1.it)("returns a new review and never mutates the input", () => {
        const before = (0, fixtures_1.fixing)();
        const snapshot = JSON.stringify(before);
        const awaitingReview = (0, transitions_1.replyItem)(before, 1, "已改为 16", ["abc"], fixtures_1.LATER);
        (0, vitest_1.expect)(awaitingReview).not.toBe(before);
        const passedReview = (0, transitions_1.passItem)(awaitingReview, 1);
        (0, vitest_1.expect)(passedReview).not.toBe(awaitingReview);
        const reverted = (0, transitions_1.markReverted)(awaitingReview, 1, "rev-abc");
        (0, vitest_1.expect)(reverted.items[0].status).toBe("reverted");
        (0, vitest_1.expect)(awaitingReview.items[0].status).toBe("awaiting_review");
        const rejected = (0, transitions_1.rejectItem)(awaitingReview, 1, "间距还是不对", fixtures_1.LATER);
        const updated = (0, transitions_1.updateDraft)(rejected, 1, { description: "间距应为 8" });
        (0, vitest_1.expect)(updated.items[0].rounds[0].description).toBe("标题字号应为 16");
        (0, vitest_1.expect)(updated.items[0].rounds[1].description).toBe("间距应为 8");
        (0, vitest_1.expect)(rejected.items[0].rounds[1].description).toBe("间距还是不对");
        const figmaUpdated = (0, transitions_1.updateDraft)((0, fixtures_1.freshDraft)(), 1, {
            figmaUrl: "https://figma.com/design/file?node=2",
        });
        (0, vitest_1.expect)(figmaUpdated.items[0].figmaUrl).toBe("https://figma.com/design/file?node=2");
        const finished = (0, transitions_1.beginFinish)(passedReview);
        (0, vitest_1.expect)(finished.status).toBe("finishing");
        (0, transitions_1.releaseFixing)((0, fixtures_1.fixing)(), "agent 进程退出");
        (0, vitest_1.expect)(JSON.stringify(before)).toBe(snapshot);
    });
    (0, vitest_1.it)("labels statuses and scopes in Chinese", () => {
        (0, vitest_1.expect)(types_1.STATUS_LABELS).toEqual({
            draft: "草稿",
            queued: "待修复",
            fixing: "修复中",
            awaiting_review: "待复验",
            passed: "已通过",
            reverted: "已撤销",
        });
        (0, vitest_1.expect)(types_1.SCOPE_LABELS).toEqual({ local: "只改这里", shared: "改公共组件" });
    });
});
//# sourceMappingURL=transitions.test.js.map