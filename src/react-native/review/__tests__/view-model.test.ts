import { describe, expect, it } from "vitest";
import type { DeviceItemView, DeviceReviewView, ReviewRound } from "../../../review-core/types";
import {
  awaitingCount,
  canSaveComposer,
  footerState,
  groupItemsByStatus,
  revertHint,
  thumbnailMetrics,
  toWindowRect,
} from "../view-model";

const REVERT_BUSY_HINT = "agent 修复中，暂不能撤销";

const round = (overrides: Partial<ReviewRound> = {}): ReviewRound => ({
  description: "标题字号应为 16",
  createdAt: "2026-11-11T08:00:00.000Z",
  submittedAt: null,
  reply: null,
  repliedAt: null,
  commits: [],
  ...overrides,
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
  route: null,
  device: null,
  revertCommit: null,
  lastError: null,
  createdAt: "2026-11-11T08:00:00.000Z",
  actions: [],
  ...overrides,
});

const reviewView = (overrides: Partial<DeviceReviewView> = {}): DeviceReviewView => ({
  id: "20261111-080000",
  base: "feature/liquidGlass",
  branch: "fix/design-review-20261111-0800",
  status: "active",
  mrUrl: null,
  ...overrides,
});

describe("toWindowRect", () => {
  it("converts an absolute rect into window coordinates", () => {
    expect(toWindowRect([10, 120, 50, 20], [0, 47])).toEqual({
      x: 10,
      y: 73,
      width: 50,
      height: 20,
    });
  });
});

describe("groupItemsByStatus", () => {
  it("groups items in the fixed status order with the Chinese labels", () => {
    const items = [
      itemView({ no: 5, status: "passed" }),
      itemView({ no: 1, status: "reverted" }),
      itemView({ no: 2, status: "fixing" }),
      itemView({ no: 3, status: "draft" }),
      itemView({ no: 4, status: "awaiting_review" }),
      itemView({ no: 6, status: "queued" }),
    ];

    const groups = groupItemsByStatus(items);

    expect(groups.map((group) => [group.status, group.label])).toEqual([
      ["draft", "草稿"],
      ["queued", "待修复"],
      ["fixing", "修复中"],
      ["awaiting_review", "待复验"],
      ["passed", "已通过"],
      ["reverted", "已撤销"],
    ]);
    expect(groups.map((group) => group.items.map((item) => item.no))).toEqual([
      [3],
      [6],
      [2],
      [4],
      [5],
      [1],
    ]);
  });

  it("omits empty groups and keeps the within-group order", () => {
    const items = [
      itemView({ no: 3, status: "awaiting_review", actions: ["pass", "reject", "revert"] }),
      itemView({ no: 1, status: "draft", actions: ["edit", "delete"] }),
      itemView({ no: 2, status: "reverted" }),
      itemView({ no: 4, status: "draft", actions: ["edit", "delete"] }),
    ];

    expect(groupItemsByStatus(items)).toEqual([
      { status: "draft", label: "草稿", items: [items[1], items[3]] },
      { status: "awaiting_review", label: "待复验", items: [items[0]] },
      { status: "reverted", label: "已撤销", items: [items[2]] },
    ]);
  });

  it("returns no groups without items", () => {
    expect(groupItemsByStatus([])).toEqual([]);
  });
});

describe("footerState", () => {
  it("counts drafts and blocks finishing while items are open", () => {
    const state = footerState(reviewView(), [
      itemView({ status: "draft" }),
      itemView({ no: 2, status: "draft" }),
      itemView({ no: 3, status: "awaiting_review" }),
    ]);

    expect(state).toEqual({ submitCount: 2, canFinish: false, mrUrl: null });
  });

  it("allows finishing only when every item is passed or reverted", () => {
    const passed = itemView({ status: "passed" });
    const reverted = itemView({ no: 2, status: "reverted" });
    expect(footerState(reviewView(), [passed, reverted]).canFinish).toBe(true);

    const queued = itemView({ no: 2, status: "queued" });
    expect(footerState(reviewView(), [passed, queued]).canFinish).toBe(false);

    const awaiting = itemView({ no: 2, status: "awaiting_review" });
    expect(footerState(reviewView(), [passed, awaiting]).canFinish).toBe(false);
  });

  it("blocks finishing an empty review even though the store allows it", () => {
    expect(footerState(reviewView(), []).canFinish).toBe(false);
  });

  it("blocks finishing when every item was reverted and none passed", () => {
    const reverted = itemView({ no: 1, status: "reverted" });
    const revertedToo = itemView({ no: 2, status: "reverted" });
    expect(footerState(reviewView(), [reverted, revertedToo]).canFinish).toBe(false);
  });

  it("never allows finishing a review that is no longer active", () => {
    const passed = itemView({ status: "passed" });
    const done = reviewView({ status: "done", mrUrl: "https://gitlab.example/mr/1" });
    expect(footerState(done, [passed]).canFinish).toBe(false);
  });

  it("exposes the MR link and tolerates a missing review", () => {
    const withMr = reviewView({ mrUrl: "https://gitlab.example/mr/1" });
    expect(footerState(withMr, []).mrUrl).toBe("https://gitlab.example/mr/1");
    expect(footerState(null, [itemView({ status: "passed" })]).canFinish).toBe(false);
    expect(footerState(null, []).mrUrl).toBe(null);
  });
});

describe("awaitingCount", () => {
  it("counts awaiting-review items", () => {
    const items = [
      itemView({ status: "awaiting_review" }),
      itemView({ no: 2, status: "awaiting_review" }),
      itemView({ no: 3, status: "draft" }),
    ];

    expect(awaitingCount(items)).toBe(2);
  });
});

describe("canSaveComposer", () => {
  it("requires a non-blank description", () => {
    expect(canSaveComposer({ description: "标题字号应为 16" })).toBe(true);
    expect(canSaveComposer({ description: " 标题 " })).toBe(true);
    expect(canSaveComposer({ description: "  " })).toBe(false);
    expect(canSaveComposer({ description: "" })).toBe(false);
  });
});

describe("revertHint", () => {
  it("hints only while the runner is busy and revert would otherwise be available", () => {
    const committedDraft = itemView({
      status: "draft",
      rounds: [round({ commits: ["abc"] })],
      actions: ["edit"],
    });
    expect(revertHint(committedDraft, true)).toBe(REVERT_BUSY_HINT);
    expect(revertHint(committedDraft, false)).toBe(null);

    const cleanDraft = itemView({ status: "draft", actions: ["edit", "delete"] });
    expect(revertHint(cleanDraft, true)).toBe(null);

    const awaitingWhileBusy = itemView({ status: "awaiting_review", actions: ["pass", "reject"] });
    expect(revertHint(awaitingWhileBusy, true)).toBe(REVERT_BUSY_HINT);
  });

  it("never hints when the revert action is already offered", () => {
    const awaitingWithRevert = itemView({
      status: "awaiting_review",
      actions: ["pass", "reject", "revert"],
    });
    expect(revertHint(awaitingWithRevert, true)).toBe(null);
    expect(revertHint(awaitingWithRevert, false)).toBe(null);
  });
});

describe("thumbnailMetrics", () => {
  it("scales a full-screen capture down to the thumbnail width", () => {
    expect(thumbnailMetrics({ width: 402, height: 874 }, 64)).toEqual({
      width: 64,
      height: 139,
      scale: 64 / 402,
    });
  });
});
