export type ItemStatus = "draft" | "queued" | "fixing" | "awaiting_review" | "passed" | "reverted";
export type ItemScope = "local" | "shared";
export type ItemKind = "element" | "page";

export type WindowRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ScreenInfo = {
  width: number;
  height: number;
  scale: number;
};

export type GrabFrame = {
  name: string;
  file: string | null;
  line: number | null;
  column: number | null;
};

export type GrabInfo = {
  description: string;
  frames: GrabFrame[];
};

export type DeviceInfo = {
  model: string;
  os: string;
  appVersion: string;
};

export type ReviewRound = {
  description: string;
  createdAt: string;
  submittedAt: string | null;
  reply: string | null;
  repliedAt: string | null;
  commits: string[];
};

export type ReviewItem = {
  no: number;
  kind: ItemKind;
  status: ItemStatus;
  scope: ItemScope;
  figmaUrl: string | null;
  rounds: ReviewRound[];
  screenshot: string | null;
  rect: WindowRect | null;
  screen: ScreenInfo | null;
  route: string | null;
  grab: GrabInfo | null;
  device: DeviceInfo | null;
  revertCommit: string | null;
  lastError: string | null;
  createdAt: string;
};

export type ReviewStatus = "active" | "finishing" | "done" | "abandoned";

export type Review = {
  id: string;
  repo: string;
  base: string;
  branch: string;
  worktree: string;
  sessionId: string | null;
  codemakerBin: string;
  pairingCode: string;
  status: ReviewStatus;
  mrUrl: string | null;
  nextItemNo: number;
  items: ReviewItem[];
  revertedSinceLastRun: number[];
  createdAt: string;
};

export type NewItemInput = {
  kind: ItemKind;
  description: string;
  scope?: ItemScope;
  figmaUrl?: string | null;
  rect?: WindowRect | null;
  screen?: ScreenInfo | null;
  route?: string | null;
  grab?: GrabInfo | null;
  device?: DeviceInfo | null;
};

export type DraftPatch = {
  description?: string;
  scope?: ItemScope;
  figmaUrl?: string | null;
};

export type ItemAction = "edit" | "delete" | "pass" | "reject" | "revert";

export type DeviceItemView = Omit<ReviewItem, "screenshot" | "grab"> & {
  screenshotUrl: string | null;
  actions: ItemAction[];
};

export type DeviceReviewView = {
  id: string;
  base: string;
  branch: string;
  status: ReviewStatus;
  mrUrl: string | null;
};

export const STATUS_LABELS: Record<ItemStatus, string> = {
  draft: "草稿",
  queued: "待修复",
  fixing: "修复中",
  awaiting_review: "待复验",
  passed: "已通过",
  reverted: "已撤销",
};

export const SCOPE_LABELS: Record<ItemScope, string> = {
  local: "只改这里",
  shared: "改公共组件",
};
