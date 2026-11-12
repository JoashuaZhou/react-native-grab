"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const view_model_1 = require("../view-model");
const REVERT_BUSY_HINT = "agent 修复中，暂不能撤销";
const round = (overrides = {}) => ({
    description: "标题字号应为 16",
    createdAt: "2026-11-11T08:00:00.000Z",
    submittedAt: null,
    reply: null,
    repliedAt: null,
    commits: [],
    ...overrides,
});
const itemView = (overrides = {}) => ({
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
    actions: [],
    ...overrides,
});
const reviewView = (overrides = {}) => ({
    id: "20261111-080000",
    base: "feature/liquidGlass",
    branch: "fix/design-review-20261111-0800",
    status: "active",
    mrUrl: null,
    ...overrides,
});
(0, vitest_1.describe)("toWindowRect", () => {
    (0, vitest_1.it)("converts an absolute rect into window coordinates", () => {
        (0, vitest_1.expect)((0, view_model_1.toWindowRect)([10, 120, 50, 20], [0, 47])).toEqual({
            x: 10,
            y: 73,
            width: 50,
            height: 20,
        });
    });
});
(0, vitest_1.describe)("groupItemsByStatus", () => {
    (0, vitest_1.it)("groups items in the fixed status order with the Chinese labels", () => {
        const items = [
            itemView({ no: 5, status: "passed" }),
            itemView({ no: 1, status: "reverted" }),
            itemView({ no: 2, status: "fixing" }),
            itemView({ no: 3, status: "draft" }),
            itemView({ no: 4, status: "awaiting_review" }),
            itemView({ no: 6, status: "queued" }),
        ];
        const groups = (0, view_model_1.groupItemsByStatus)(items);
        (0, vitest_1.expect)(groups.map((group) => [group.status, group.label])).toEqual([
            ["draft", "草稿"],
            ["queued", "待修复"],
            ["fixing", "修复中"],
            ["awaiting_review", "待复验"],
            ["passed", "已通过"],
            ["reverted", "已撤销"],
        ]);
        (0, vitest_1.expect)(groups.map((group) => group.items.map((item) => item.no))).toEqual([
            [3],
            [6],
            [2],
            [4],
            [5],
            [1],
        ]);
    });
    (0, vitest_1.it)("omits empty groups and keeps the within-group order", () => {
        const items = [
            itemView({ no: 3, status: "awaiting_review", actions: ["pass", "reject", "revert"] }),
            itemView({ no: 1, status: "draft", actions: ["edit", "delete"] }),
            itemView({ no: 2, status: "reverted" }),
            itemView({ no: 4, status: "draft", actions: ["edit", "delete"] }),
        ];
        (0, vitest_1.expect)((0, view_model_1.groupItemsByStatus)(items)).toEqual([
            { status: "draft", label: "草稿", items: [items[1], items[3]] },
            { status: "awaiting_review", label: "待复验", items: [items[0]] },
            { status: "reverted", label: "已撤销", items: [items[2]] },
        ]);
    });
    (0, vitest_1.it)("returns no groups without items", () => {
        (0, vitest_1.expect)((0, view_model_1.groupItemsByStatus)([])).toEqual([]);
    });
});
(0, vitest_1.describe)("footerState", () => {
    (0, vitest_1.it)("counts drafts and blocks finishing while items are open", () => {
        const state = (0, view_model_1.footerState)(reviewView(), [
            itemView({ status: "draft" }),
            itemView({ no: 2, status: "draft" }),
            itemView({ no: 3, status: "awaiting_review" }),
        ]);
        (0, vitest_1.expect)(state).toEqual({ submitCount: 2, canFinish: false, mrUrl: null });
    });
    (0, vitest_1.it)("allows finishing only when every item is passed or reverted", () => {
        const passed = itemView({ status: "passed" });
        const reverted = itemView({ no: 2, status: "reverted" });
        (0, vitest_1.expect)((0, view_model_1.footerState)(reviewView(), [passed, reverted]).canFinish).toBe(true);
        const queued = itemView({ no: 2, status: "queued" });
        (0, vitest_1.expect)((0, view_model_1.footerState)(reviewView(), [passed, queued]).canFinish).toBe(false);
        const awaiting = itemView({ no: 2, status: "awaiting_review" });
        (0, vitest_1.expect)((0, view_model_1.footerState)(reviewView(), [passed, awaiting]).canFinish).toBe(false);
    });
    (0, vitest_1.it)("allows finishing an empty review, like the store does", () => {
        (0, vitest_1.expect)((0, view_model_1.footerState)(reviewView(), []).canFinish).toBe(true);
    });
    (0, vitest_1.it)("never allows finishing a review that is no longer active", () => {
        const passed = itemView({ status: "passed" });
        const done = reviewView({ status: "done", mrUrl: "https://gitlab.example/mr/1" });
        (0, vitest_1.expect)((0, view_model_1.footerState)(done, [passed]).canFinish).toBe(false);
    });
    (0, vitest_1.it)("exposes the MR link and tolerates a missing review", () => {
        const withMr = reviewView({ mrUrl: "https://gitlab.example/mr/1" });
        (0, vitest_1.expect)((0, view_model_1.footerState)(withMr, []).mrUrl).toBe("https://gitlab.example/mr/1");
        (0, vitest_1.expect)((0, view_model_1.footerState)(null, [itemView({ status: "passed" })]).canFinish).toBe(false);
        (0, vitest_1.expect)((0, view_model_1.footerState)(null, []).mrUrl).toBe(null);
    });
});
(0, vitest_1.describe)("awaitingCount", () => {
    (0, vitest_1.it)("counts awaiting-review items", () => {
        const items = [
            itemView({ status: "awaiting_review" }),
            itemView({ no: 2, status: "awaiting_review" }),
            itemView({ no: 3, status: "draft" }),
        ];
        (0, vitest_1.expect)((0, view_model_1.awaitingCount)(items)).toBe(2);
    });
});
(0, vitest_1.describe)("canSaveComposer", () => {
    (0, vitest_1.it)("requires a non-blank description", () => {
        (0, vitest_1.expect)((0, view_model_1.canSaveComposer)({ description: "标题字号应为 16" })).toBe(true);
        (0, vitest_1.expect)((0, view_model_1.canSaveComposer)({ description: " 标题 " })).toBe(true);
        (0, vitest_1.expect)((0, view_model_1.canSaveComposer)({ description: "  " })).toBe(false);
        (0, vitest_1.expect)((0, view_model_1.canSaveComposer)({ description: "" })).toBe(false);
    });
});
(0, vitest_1.describe)("revertHint", () => {
    (0, vitest_1.it)("hints only while the runner is busy and revert would otherwise be available", () => {
        const committedDraft = itemView({
            status: "draft",
            rounds: [round({ commits: ["abc"] })],
            actions: ["edit"],
        });
        (0, vitest_1.expect)((0, view_model_1.revertHint)(committedDraft, true)).toBe(REVERT_BUSY_HINT);
        (0, vitest_1.expect)((0, view_model_1.revertHint)(committedDraft, false)).toBe(null);
        const cleanDraft = itemView({ status: "draft", actions: ["edit", "delete"] });
        (0, vitest_1.expect)((0, view_model_1.revertHint)(cleanDraft, true)).toBe(null);
        const awaitingWhileBusy = itemView({ status: "awaiting_review", actions: ["pass", "reject"] });
        (0, vitest_1.expect)((0, view_model_1.revertHint)(awaitingWhileBusy, true)).toBe(REVERT_BUSY_HINT);
    });
    (0, vitest_1.it)("never hints when the revert action is already offered", () => {
        const awaitingWithRevert = itemView({
            status: "awaiting_review",
            actions: ["pass", "reject", "revert"],
        });
        (0, vitest_1.expect)((0, view_model_1.revertHint)(awaitingWithRevert, true)).toBe(null);
        (0, vitest_1.expect)((0, view_model_1.revertHint)(awaitingWithRevert, false)).toBe(null);
    });
});
(0, vitest_1.describe)("thumbnailMetrics", () => {
    (0, vitest_1.it)("scales a full-screen capture down to the thumbnail width", () => {
        (0, vitest_1.expect)((0, view_model_1.thumbnailMetrics)({ width: 402, height: 874 }, 64)).toEqual({
            width: 64,
            height: 139,
            scale: 64 / 402,
        });
    });
});
//# sourceMappingURL=view-model.test.js.map