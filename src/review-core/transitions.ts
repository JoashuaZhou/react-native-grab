import type {
  DraftPatch,
  ItemAction,
  ItemScope,
  NewItemInput,
  Review,
  ReviewItem,
  ReviewRound,
} from "./types";

export type ReviewErrorCode =
  | "not_found"
  | "invalid_state"
  | "has_commits"
  | "runner_busy"
  | "empty_text"
  | "not_finishable"
  | "review_closed"
  | "invalid_commits"
  | "conflict"
  | "invalid_input";

export class ReviewError extends Error {
  code: ReviewErrorCode;

  constructor(code: ReviewErrorCode, message: string) {
    super(message);
    this.name = "ReviewError";
    this.code = code;
  }
}

function fail(code: ReviewErrorCode, message: string): never {
  throw new ReviewError(code, message);
}

function isBlank(value: string | null | undefined): boolean {
  return typeof value !== "string" || value.trim() === "";
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function figmaOrNull(figmaUrl: string | null | undefined): string | null {
  if (typeof figmaUrl !== "string" || figmaUrl.trim() === "") {
    return null;
  }
  return figmaUrl.trim();
}

function requireActive(review: Review): void {
  if (review.status !== "active") {
    fail("review_closed", "走查已不在进行中");
  }
}

function requireScope(scope: string): asserts scope is ItemScope {
  if (scope !== "local" && scope !== "shared") {
    fail("invalid_input", "无效的改动范围");
  }
}

function requireItem(review: Review, no: number): ReviewItem {
  const item = review.items.find((candidate) => candidate.no === no);
  if (!item) {
    fail("not_found", `条目 #${no} 不存在`);
  }
  return item;
}

function replaceItem(review: Review, no: number, update: (item: ReviewItem) => ReviewItem): Review {
  return {
    ...review,
    items: review.items.map((item) => (item.no === no ? update(item) : item)),
  };
}

export function itemCommits(item: ReviewItem): string[] {
  return item.rounds.flatMap((round) => round.commits);
}

export function getItemActions(item: ReviewItem, runnerBusy: boolean): ItemAction[] {
  if (item.status === "draft") {
    if (itemCommits(item).length > 0) {
      return runnerBusy ? ["edit"] : ["edit", "revert"];
    }
    return ["edit", "delete"];
  }
  if (item.status === "awaiting_review") {
    return runnerBusy ? ["pass", "reject"] : ["pass", "reject", "revert"];
  }
  return [];
}

export function createItem(
  review: Review,
  input: NewItemInput,
  now: Date,
): { review: Review; item: ReviewItem } {
  requireActive(review);
  if (input.kind !== "element" && input.kind !== "page") {
    fail("invalid_input", "无效的条目类型");
  }
  if (isBlank(input.description)) {
    fail("empty_text", "描述不能为空");
  }
  const scope = input.scope ?? "local";
  requireScope(scope);
  const item: ReviewItem = {
    no: review.nextItemNo,
    kind: input.kind,
    status: "draft",
    scope,
    figmaUrl: figmaOrNull(input.figmaUrl),
    rounds: [
      {
        description: input.description.trim(),
        createdAt: now.toISOString(),
        submittedAt: null,
        reply: null,
        repliedAt: null,
        commits: [],
      },
    ],
    screenshot: null,
    rect: deepClone(input.rect ?? null),
    screen: deepClone(input.screen ?? null),
    route: input.route ?? null,
    grab: deepClone(input.grab ?? null),
    device: deepClone(input.device ?? null),
    revertCommit: null,
    lastError: null,
    createdAt: now.toISOString(),
  };
  const next: Review = {
    ...review,
    nextItemNo: review.nextItemNo + 1,
    items: [...review.items, item],
  };
  return { review: next, item };
}

export function attachScreenshot(review: Review, no: number, file: string): Review {
  requireActive(review);
  const item = requireItem(review, no);
  if (item.status !== "draft") {
    fail("invalid_state", "仅草稿可以补充截图");
  }
  return replaceItem(review, no, (current) => ({ ...current, screenshot: file }));
}

export function updateDraft(review: Review, no: number, patch: DraftPatch): Review {
  requireActive(review);
  const item = requireItem(review, no);
  if (item.status !== "draft") {
    fail("invalid_state", "仅草稿可以修改");
  }
  if (patch.description !== undefined && isBlank(patch.description)) {
    fail("empty_text", "描述不能为空");
  }
  if (patch.scope !== undefined) {
    requireScope(patch.scope);
  }
  return replaceItem(review, no, (current) => {
    const rounds = current.rounds.map((round, index) =>
      index === current.rounds.length - 1
        ? { ...round, description: patch.description?.trim() ?? round.description }
        : round,
    );
    return {
      ...current,
      rounds,
      scope: patch.scope ?? current.scope,
      figmaUrl: patch.figmaUrl !== undefined ? figmaOrNull(patch.figmaUrl) : current.figmaUrl,
    };
  });
}

export function deleteDraft(review: Review, no: number): Review {
  requireActive(review);
  const item = requireItem(review, no);
  if (item.status !== "draft") {
    fail("invalid_state", "仅草稿可以删除");
  }
  if (itemCommits(item).length > 0) {
    fail("has_commits", "有代码改动的条目只能撤销");
  }
  return { ...review, items: review.items.filter((candidate) => candidate.no !== no) };
}

export function submitDrafts(review: Review, now: Date): { review: Review; submitted: number[] } {
  requireActive(review);
  const submitted: number[] = [];
  const items = review.items.map((item) => {
    if (item.status !== "draft") {
      return item;
    }
    submitted.push(item.no);
    const rounds = item.rounds.map((round, index) =>
      index === item.rounds.length - 1 ? { ...round, submittedAt: now.toISOString() } : round,
    );
    return { ...item, status: "queued" as const, rounds };
  });
  return { review: { ...review, items }, submitted };
}

export function claimItem(review: Review, no: number): Review {
  requireActive(review);
  const item = requireItem(review, no);
  if (item.status !== "queued") {
    fail("invalid_state", "仅待修复的条目可以认领");
  }
  return replaceItem(review, no, (current) => ({ ...current, status: "fixing", lastError: null }));
}

export function replyItem(
  review: Review,
  no: number,
  reply: string,
  commits: string[],
  now: Date,
): Review {
  requireActive(review);
  const item = requireItem(review, no);
  if (item.status !== "fixing") {
    fail("invalid_state", "仅修复中的条目可以回复");
  }
  if (isBlank(reply)) {
    fail("empty_text", "回复不能为空");
  }
  const normalized = commits.map((commit) => commit.trim());
  if (normalized.some((commit) => commit === "")) {
    fail("invalid_commits", "commit 不能为空");
  }
  if (new Set(normalized).size !== normalized.length) {
    fail("invalid_commits", "commit 重复");
  }
  const claimed = new Set<string>();
  for (const candidate of review.items) {
    for (const commit of itemCommits(candidate)) {
      claimed.add(commit);
    }
    if (candidate.revertCommit) {
      claimed.add(candidate.revertCommit);
    }
  }
  if (normalized.some((commit) => claimed.has(commit))) {
    fail("invalid_commits", "commit 已被其他条目使用");
  }
  const timestamp = now.toISOString();
  return replaceItem(review, no, (current) => {
    const rounds = current.rounds.map((round, index) =>
      index === current.rounds.length - 1
        ? { ...round, reply: reply.trim(), repliedAt: timestamp, commits: normalized }
        : round,
    );
    return { ...current, status: "awaiting_review" as const, rounds, lastError: null };
  });
}

export function passItem(review: Review, no: number): Review {
  requireActive(review);
  const item = requireItem(review, no);
  if (item.status !== "awaiting_review") {
    fail("invalid_state", "仅待复验的条目可以通过");
  }
  return replaceItem(review, no, (current) => ({ ...current, status: "passed" }));
}

export function rejectItem(review: Review, no: number, supplement: string, now: Date): Review {
  requireActive(review);
  const item = requireItem(review, no);
  if (item.status !== "awaiting_review") {
    fail("invalid_state", "仅待复验的条目可以打回");
  }
  if (isBlank(supplement)) {
    fail("empty_text", "补充说明不能为空");
  }
  const round: ReviewRound = {
    description: supplement.trim(),
    createdAt: now.toISOString(),
    submittedAt: null,
    reply: null,
    repliedAt: null,
    commits: [],
  };
  return replaceItem(review, no, (current) => ({
    ...current,
    status: "draft",
    rounds: [...current.rounds, round],
  }));
}

export function markReverted(review: Review, no: number, revertCommit: string | null): Review {
  requireActive(review);
  const item = requireItem(review, no);
  const revertible =
    item.status === "awaiting_review" || (item.status === "draft" && itemCommits(item).length > 0);
  if (!revertible) {
    fail("invalid_state", "该条目当前不能撤销");
  }
  return {
    ...replaceItem(review, no, (current) => ({
      ...current,
      status: "reverted",
      revertCommit,
    })),
    revertedSinceLastRun: [...review.revertedSinceLastRun, no],
  };
}

export function releaseFixing(review: Review, error: string): Review {
  return {
    ...review,
    items: review.items.map((item) =>
      item.status === "fixing" ? { ...item, status: "queued", lastError: error } : item,
    ),
  };
}

export function beginFinish(review: Review): Review {
  requireActive(review);
  const open = review.items.some((item) => item.status !== "passed" && item.status !== "reverted");
  if (open) {
    fail("not_finishable", "还有条目未通过或未撤销");
  }
  return { ...review, status: "finishing" };
}

export function completeReview(review: Review, mrUrl: string | null): Review {
  if (review.status !== "finishing") {
    fail("invalid_state", "走查不在收尾中");
  }
  return { ...review, status: "done", mrUrl };
}

export function abandonReview(review: Review): Review {
  if (review.status !== "active" && review.status !== "finishing") {
    fail("invalid_state", "走查已经结束");
  }
  return { ...review, status: "abandoned" };
}
