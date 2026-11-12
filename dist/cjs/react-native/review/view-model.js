"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.revertHint = exports.thumbnailMetrics = exports.awaitingCount = exports.footerState = exports.groupItemsByStatus = exports.canSaveComposer = exports.toWindowRect = exports.REVERT_BUSY_HINT = exports.STATUS_ORDER = void 0;
const transitions_1 = require("../../review-core/transitions");
const types_1 = require("../../review-core/types");
exports.STATUS_ORDER = [
    "draft",
    "queued",
    "fixing",
    "awaiting_review",
    "passed",
    "reverted",
];
exports.REVERT_BUSY_HINT = "agent 修复中，暂不能撤销";
const toWindowRect = (abs, windowOffset) => ({
    x: abs[0] - windowOffset[0],
    y: abs[1] - windowOffset[1],
    width: abs[2],
    height: abs[3],
});
exports.toWindowRect = toWindowRect;
const canSaveComposer = (fields) => fields.description.trim().length > 0;
exports.canSaveComposer = canSaveComposer;
const groupItemsByStatus = (items) => exports.STATUS_ORDER.map((status) => ({
    status,
    label: types_1.STATUS_LABELS[status],
    items: items.filter((item) => item.status === status),
})).filter((group) => group.items.length > 0);
exports.groupItemsByStatus = groupItemsByStatus;
const footerState = (review, items) => ({
    submitCount: items.filter((item) => item.status === "draft").length,
    canFinish: review?.status === "active" &&
        // At least one item must have passed: an empty or all-reverted review has
        // no verified result to finish with.
        items.some((item) => item.status === "passed") &&
        items.every((item) => item.status === "passed" || item.status === "reverted"),
    mrUrl: review?.mrUrl ?? null,
});
exports.footerState = footerState;
const awaitingCount = (items) => items.filter((item) => item.status === "awaiting_review").length;
exports.awaitingCount = awaitingCount;
const thumbnailMetrics = (image, thumbWidth) => {
    const scale = thumbWidth / image.width;
    return { width: thumbWidth, height: Math.round(image.height * scale), scale };
};
exports.thumbnailMetrics = thumbnailMetrics;
const wouldAllowRevert = (item) => 
// The view strips `screenshot`/`grab` for transport; `getItemActions` reads
// only `status`/`rounds`, so the missing fields are filled in as null.
(0, transitions_1.getItemActions)({ ...item, screenshot: null, grab: null }, false).includes("revert");
const revertHint = (item, runnerBusy) => {
    if (!runnerBusy || !wouldAllowRevert(item)) {
        return null;
    }
    if (item.actions.includes("revert")) {
        return null;
    }
    return exports.REVERT_BUSY_HINT;
};
exports.revertHint = revertHint;
//# sourceMappingURL=view-model.js.map