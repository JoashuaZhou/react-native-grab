import { describe, expect, it } from "vitest";
import { abandonReview, attachScreenshot, beginFinish, claimItem, completeReview, createItem, deleteDraft, getItemActions, itemCommits, markReverted, passItem, rejectItem, releaseFixing, replyItem, submitDrafts, updateDraft, } from "../transitions";
import { SCOPE_LABELS, STATUS_LABELS } from "../types";
import { awaiting, draftWithCommits, fixing, freshDraft, LATER, makeItemInput, makeReview, passed, queued, rejectedWithCommits, } from "./fixtures";
const now = new Date("2026-11-11T08:00:00Z");
describe("design-review state machine", () => {
    it("walks an item draft → queued → fixing → awaiting_review → passed", () => {
        let r = createItem(makeReview(), { kind: "element", description: "标题字号应为 16" }, now).review;
        expect(r.items[0]).toMatchObject({ no: 1, status: "draft", scope: "local" });
        r = submitDrafts(r, now).review;
        expect(r.items[0].status).toBe("queued");
        r = claimItem(r, 1);
        r = replyItem(r, 1, "已改为 16", ["abc"], now);
        expect(r.items[0].rounds[0]).toMatchObject({ reply: "已改为 16", commits: ["abc"] });
        expect(passItem(r, 1).items[0].status).toBe("passed");
    });
    it("reject appends a round and returns the item to draft", () => {
        const r = rejectItem(awaiting(), 1, "间距还是不对", now);
        const item = r.items[0];
        expect(item.status).toBe("draft");
        expect(item.rounds.length).toBe(2);
        expect(item.rounds[0].description).toBe("标题字号应为 16");
        expect(item.rounds[1]).toMatchObject({
            description: "间距还是不对",
            createdAt: now.toISOString(),
            submittedAt: null,
            reply: null,
            repliedAt: null,
            commits: [],
        });
    });
    it("refuses to delete a draft that has commits", () => {
        expect(() => deleteDraft(rejectedWithCommits(), 1)).toThrow(expect.objectContaining({ code: "has_commits" }));
    });
    it("reverts from awaiting_review and from a draft with commits, never from passed", () => {
        let r = markReverted(awaiting(), 1, "rev-abc");
        expect(r.items[0]).toMatchObject({ status: "reverted", revertCommit: "rev-abc" });
        expect(r.revertedSinceLastRun).toContain(1);
        r = markReverted(draftWithCommits(), 1, "rev-def");
        expect(r.items[0]).toMatchObject({ status: "reverted", revertCommit: "rev-def" });
        expect(r.revertedSinceLastRun).toContain(1);
        expect(() => markReverted(passed(), 1, "rev-ghi")).toThrow(expect.objectContaining({ code: "invalid_state" }));
    });
    it("derives actions", () => {
        expect(getItemActions(freshDraft().items[0], false)).toEqual(["edit", "delete"]);
        expect(getItemActions(draftWithCommits().items[0], false)).toEqual(["edit", "revert"]);
        expect(getItemActions(draftWithCommits().items[0], true)).toEqual(["edit"]);
        expect(getItemActions(awaiting().items[0], false)).toEqual(["pass", "reject", "revert"]);
        expect(getItemActions(awaiting().items[0], true)).toEqual(["pass", "reject"]);
        expect(getItemActions(passed().items[0], false)).toEqual([]);
        expect(getItemActions(queued().items[0], false)).toEqual([]);
        expect(getItemActions(fixing().items[0], false)).toEqual([]);
    });
    it("beginFinish requires every item passed or reverted", () => {
        expect(beginFinish(passed()).status).toBe("finishing");
        expect(() => beginFinish(awaiting())).toThrow(expect.objectContaining({ code: "not_finishable" }));
        const reverted = markReverted(awaiting(), 1, "rev-abc");
        expect(beginFinish(reverted).status).toBe("finishing");
    });
    it("releaseFixing returns fixing items to queued with lastError", () => {
        const released = releaseFixing(fixing(), "agent 进程退出");
        expect(released.items[0]).toMatchObject({ status: "queued", lastError: "agent 进程退出" });
        const reclaimed = claimItem(released, 1);
        expect(reclaimed.items[0]).toMatchObject({ status: "fixing", lastError: null });
    });
    it("agent mutations throw review_closed once the review is abandoned", () => {
        const stoppedAfterQueue = abandonReview(queued());
        expect(stoppedAfterQueue.items[0].status).toBe("queued");
        expect(() => claimItem(stoppedAfterQueue, 1)).toThrow(expect.objectContaining({ code: "review_closed" }));
        const stoppedMidFix = abandonReview(fixing());
        expect(stoppedMidFix.items[0].status).toBe("fixing");
        expect(() => replyItem(stoppedMidFix, 1, "已改为 16", ["abc"], now)).toThrow(expect.objectContaining({ code: "review_closed" }));
    });
    it("rejects blank description or supplement with empty_text", () => {
        expect(() => createItem(makeReview(), { kind: "element", description: "   " }, now)).toThrow(expect.objectContaining({ code: "empty_text" }));
        expect(() => rejectItem(awaiting(), 1, "", now)).toThrow(expect.objectContaining({ code: "empty_text" }));
        expect(() => updateDraft(freshDraft(), 1, { description: "" })).toThrow(expect.objectContaining({ code: "empty_text" }));
        expect(() => replyItem(fixing(), 1, "  ", ["abc"], now)).toThrow(expect.objectContaining({ code: "empty_text" }));
    });
    it("device mutations throw review_closed when status is not active", () => {
        const closed = beginFinish(passed());
        expect(() => createItem(closed, { ...makeItemInput() }, now)).toThrow(expect.objectContaining({ code: "review_closed" }));
        expect(() => attachScreenshot(closed, 1, "1.jpg")).toThrow(expect.objectContaining({ code: "review_closed" }));
        expect(() => updateDraft(closed, 1, { description: "再改一句" })).toThrow(expect.objectContaining({ code: "review_closed" }));
        expect(() => deleteDraft(closed, 1)).toThrow(expect.objectContaining({ code: "review_closed" }));
        expect(() => submitDrafts(closed, now)).toThrow(expect.objectContaining({ code: "review_closed" }));
        expect(() => passItem(closed, 1)).toThrow(expect.objectContaining({ code: "review_closed" }));
        expect(() => rejectItem(closed, 1, "间距还是不对", now)).toThrow(expect.objectContaining({ code: "review_closed" }));
        expect(() => markReverted(closed, 1, "rev-abc")).toThrow(expect.objectContaining({ code: "review_closed" }));
        expect(() => beginFinish(closed)).toThrow(expect.objectContaining({ code: "review_closed" }));
    });
    it("assigns sequential numbers and stores captured context", () => {
        const grab = {
            description: "AppText",
            frames: [{ name: "AppText", file: "AppText.tsx", line: 10, column: 3 }],
        };
        const { review: first, item } = createItem(makeReview(), {
            ...makeItemInput(),
            kind: "page",
            scope: "shared",
            figmaUrl: "https://figma.com/design/file?node=1",
            rect: { x: 1, y: 2, width: 30, height: 40 },
            screen: { width: 393, height: 852, scale: 3 },
            route: "home",
            grab,
            device: { model: "iPhone 17", os: "iOS 26.0", appVersion: "2.0.0" },
        }, now);
        expect(item).toMatchObject({
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
        expect(item.grab).toEqual(grab);
        expect(item.grab).not.toBe(grab);
        const second = createItem(first, { ...makeItemInput() }, now);
        expect(second.item.no).toBe(2);
        expect(second.review.nextItemNo).toBe(3);
    });
    it("attaches a screenshot only to a draft", () => {
        const withShot = attachScreenshot(freshDraft(), 1, "screenshots/1.jpg");
        expect(withShot.items[0].screenshot).toBe("screenshots/1.jpg");
        expect(() => attachScreenshot(queued(), 1, "screenshots/1.jpg")).toThrow(expect.objectContaining({ code: "invalid_state" }));
    });
    it("updateDraft edits the last unsubmitted round and keeps history", () => {
        let r = updateDraft(freshDraft(), 1, { description: "标题字号应为 17", figmaUrl: null });
        expect(r.items[0].rounds[0].description).toBe("标题字号应为 17");
        r = updateDraft(r, 1, { scope: "shared" });
        expect(r.items[0].scope).toBe("shared");
        const cleared = updateDraft(r, 1, { figmaUrl: "" });
        expect(cleared.items[0].figmaUrl).toBe(null);
        expect(() => updateDraft(r, 1, { scope: "everywhere" })).toThrow(expect.objectContaining({ code: "invalid_input" }));
        expect(() => createItem(makeReview(), { ...makeItemInput(), kind: "block" }, now)).toThrow(expect.objectContaining({ code: "invalid_input" }));
        const rejected = rejectedWithCommits();
        const historyKept = updateDraft(rejected, 1, { description: "间距应为 8" });
        expect(historyKept.items[0].rounds[0].description).toBe("标题字号应为 16");
        expect(historyKept.items[0].rounds[1].description).toBe("间距应为 8");
        expect(() => updateDraft(queued(), 1, { description: "已提交" })).toThrow(expect.objectContaining({ code: "invalid_state" }));
    });
    it("deletes a fresh draft without commits", () => {
        const r = deleteDraft(freshDraft(), 1);
        expect(r.items).toHaveLength(0);
        expect(() => deleteDraft(awaiting(), 1)).toThrow(expect.objectContaining({ code: "invalid_state" }));
    });
    it("submitDrafts submits only drafts and reports their numbers", () => {
        let r = createItem(makeReview(), { ...makeItemInput() }, now).review;
        r = createItem(r, { kind: "page", description: "整页留白过大" }, now).review;
        const submitted = submitDrafts(r, now);
        expect(submitted.submitted).toEqual([1, 2]);
        expect(submitted.review.items.map((item) => item.status)).toEqual(["queued", "queued"]);
        const again = submitDrafts(submitted.review, now);
        expect(again.submitted).toEqual([]);
        expect(again.review.items.map((item) => item.status)).toEqual(["queued", "queued"]);
    });
    it("claims only queued items", () => {
        expect(() => claimItem(freshDraft(), 1)).toThrow(expect.objectContaining({ code: "invalid_state" }));
        expect(() => claimItem(fixing(), 1)).toThrow(expect.objectContaining({ code: "invalid_state" }));
    });
    it("replies only to fixing items and records the round", () => {
        const expected = expect.objectContaining({ code: "invalid_state" });
        expect(() => replyItem(queued(), 1, "提前回复", ["abc"], now)).toThrow(expected);
        expect(() => replyItem(awaiting(), 1, "重复回复", ["def"], now)).toThrow(expected);
        const r = replyItem(fixing(), 1, "需要切图，请设计师提供", [], now);
        expect(r.items[0]).toMatchObject({ status: "awaiting_review", lastError: null });
        expect(r.items[0].rounds[0]).toMatchObject({
            reply: "需要切图，请设计师提供",
            repliedAt: now.toISOString(),
            commits: [],
        });
    });
    it("refuses commits already claimed by an item, including an earlier round", () => {
        const resubmitted = claimItem(submitDrafts(rejectedWithCommits(), LATER).review, 1);
        expect(resubmitted.items[0].status).toBe("fixing");
        expect(() => replyItem(resubmitted, 1, "再次修复", ["abc"], LATER)).toThrow(expect.objectContaining({ code: "invalid_commits" }));
        expect(() => replyItem(fixing(), 1, "空 commit", ["  "], LATER)).toThrow(expect.objectContaining({ code: "invalid_commits" }));
        expect(() => replyItem(fixing(), 1, "复用", ["abc", "abc"], LATER)).toThrow(expect.objectContaining({ code: "invalid_commits" }));
    });
    it("passes only items awaiting review", () => {
        expect(() => passItem(freshDraft(), 1)).toThrow(expect.objectContaining({ code: "invalid_state" }));
        expect(() => passItem(passed(), 1)).toThrow(expect.objectContaining({ code: "invalid_state" }));
    });
    it("collects commits across rounds, oldest first", () => {
        const resubmitted = claimItem(submitDrafts(rejectedWithCommits(), LATER).review, 1);
        const r = replyItem(resubmitted, 1, "已改为 17", ["abc2"], LATER);
        expect(itemCommits(r.items[0])).toEqual(["abc", "abc2"]);
        expect(itemCommits(freshDraft().items[0])).toEqual([]);
    });
    it("completes a review and abandons it", () => {
        const finishing = beginFinish(passed());
        const done = completeReview(finishing, "https://git-pt.nie.netease.com/Example/-/merge_requests/1");
        expect(done).toMatchObject({
            status: "done",
            mrUrl: "https://git-pt.nie.netease.com/Example/-/merge_requests/1",
        });
        const closed = completeReview(finishing, null);
        expect(closed).toMatchObject({ status: "done", mrUrl: null });
        expect(() => completeReview(passed(), "mr")).toThrow(expect.objectContaining({ code: "invalid_state" }));
        expect(abandonReview(passed()).status).toBe("abandoned");
        expect(abandonReview(finishing).status).toBe("abandoned");
        expect(() => abandonReview(done)).toThrow(expect.objectContaining({ code: "invalid_state" }));
    });
    it("throws not_found for unknown items", () => {
        const expected = expect.objectContaining({ code: "not_found" });
        expect(() => attachScreenshot(freshDraft(), 9, "9.jpg")).toThrow(expected);
        expect(() => updateDraft(freshDraft(), 9, { description: "x" })).toThrow(expected);
        expect(() => deleteDraft(freshDraft(), 9)).toThrow(expected);
        expect(() => claimItem(freshDraft(), 9)).toThrow(expected);
        expect(() => replyItem(freshDraft(), 9, "x", [], now)).toThrow(expected);
        expect(() => passItem(freshDraft(), 9)).toThrow(expected);
        expect(() => rejectItem(freshDraft(), 9, "x", now)).toThrow(expected);
        expect(() => markReverted(freshDraft(), 9, null)).toThrow(expected);
    });
    it("returns a new review and never mutates the input", () => {
        const before = fixing();
        const snapshot = JSON.stringify(before);
        const awaitingReview = replyItem(before, 1, "已改为 16", ["abc"], LATER);
        expect(awaitingReview).not.toBe(before);
        const passedReview = passItem(awaitingReview, 1);
        expect(passedReview).not.toBe(awaitingReview);
        const reverted = markReverted(awaitingReview, 1, "rev-abc");
        expect(reverted.items[0].status).toBe("reverted");
        expect(awaitingReview.items[0].status).toBe("awaiting_review");
        const rejected = rejectItem(awaitingReview, 1, "间距还是不对", LATER);
        const updated = updateDraft(rejected, 1, { description: "间距应为 8" });
        expect(updated.items[0].rounds[0].description).toBe("标题字号应为 16");
        expect(updated.items[0].rounds[1].description).toBe("间距应为 8");
        expect(rejected.items[0].rounds[1].description).toBe("间距还是不对");
        const figmaUpdated = updateDraft(freshDraft(), 1, {
            figmaUrl: "https://figma.com/design/file?node=2",
        });
        expect(figmaUpdated.items[0].figmaUrl).toBe("https://figma.com/design/file?node=2");
        const finished = beginFinish(passedReview);
        expect(finished.status).toBe("finishing");
        releaseFixing(fixing(), "agent 进程退出");
        expect(JSON.stringify(before)).toBe(snapshot);
    });
    it("labels statuses and scopes in Chinese", () => {
        expect(STATUS_LABELS).toEqual({
            draft: "草稿",
            queued: "待修复",
            fixing: "修复中",
            awaiting_review: "待复验",
            passed: "已通过",
            reverted: "已撤销",
        });
        expect(SCOPE_LABELS).toEqual({ local: "只改这里", shared: "改公共组件" });
    });
});
//# sourceMappingURL=transitions.test.js.map