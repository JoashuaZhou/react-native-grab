import { getItemActions } from "../../review-core/transitions";
import type {
  DeviceItemView,
  DeviceReviewView,
  ItemStatus,
  WindowRect,
} from "../../review-core/types";
import { STATUS_LABELS } from "../../review-core/types";
import type { BoundingClientRect } from "../types";

export const STATUS_ORDER: ItemStatus[] = [
  "draft",
  "queued",
  "fixing",
  "awaiting_review",
  "passed",
  "reverted",
];

export const REVERT_BUSY_HINT = "agent 修复中，暂不能撤销";

export const toWindowRect = (
  abs: BoundingClientRect,
  windowOffset: [number, number],
): WindowRect => ({
  x: abs[0] - windowOffset[0],
  y: abs[1] - windowOffset[1],
  width: abs[2],
  height: abs[3],
});

export const canSaveComposer = (fields: { description: string }): boolean =>
  fields.description.trim().length > 0;

export type DeviceItemGroup = {
  status: ItemStatus;
  label: string;
  items: DeviceItemView[];
};

export const groupItemsByStatus = (items: DeviceItemView[]): DeviceItemGroup[] =>
  STATUS_ORDER.map((status) => ({
    status,
    label: STATUS_LABELS[status],
    items: items.filter((item) => item.status === status),
  })).filter((group) => group.items.length > 0);

export type ReviewFooterState = {
  submitCount: number;
  canFinish: boolean;
  mrUrl: string | null;
};

export const footerState = (
  review: DeviceReviewView | null,
  items: DeviceItemView[],
): ReviewFooterState => ({
  submitCount: items.filter((item) => item.status === "draft").length,
  canFinish:
    review?.status === "active" &&
    // At least one item must have passed: an empty or all-reverted review has
    // no verified result to finish with.
    items.some((item) => item.status === "passed") &&
    items.every((item) => item.status === "passed" || item.status === "reverted"),
  mrUrl: review?.mrUrl ?? null,
});

export const awaitingCount = (items: DeviceItemView[]): number =>
  items.filter((item) => item.status === "awaiting_review").length;

export const thumbnailMetrics = (
  image: { width: number; height: number },
  thumbWidth: number,
): { width: number; height: number; scale: number } => {
  const scale = thumbWidth / image.width;
  return { width: thumbWidth, height: Math.round(image.height * scale), scale };
};

const wouldAllowRevert = (item: DeviceItemView): boolean =>
  // The view strips `screenshot`/`grab` for transport; `getItemActions` reads
  // only `status`/`rounds`, so the missing fields are filled in as null.
  getItemActions({ ...item, screenshot: null, grab: null }, false).includes("revert");

export const revertHint = (item: DeviceItemView, runnerBusy: boolean): string | null => {
  if (!runnerBusy || !wouldAllowRevert(item)) {
    return null;
  }
  if (item.actions.includes("revert")) {
    return null;
  }
  return REVERT_BUSY_HINT;
};
