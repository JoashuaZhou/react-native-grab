"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.draftWithCommits = exports.LATER = exports.NOW = void 0;
exports.makeReview = makeReview;
exports.makeItemInput = makeItemInput;
exports.freshDraft = freshDraft;
exports.queued = queued;
exports.fixing = fixing;
exports.awaiting = awaiting;
exports.passed = passed;
exports.rejectedWithCommits = rejectedWithCommits;
const transitions_1 = require("../transitions");
exports.NOW = new Date("2026-11-11T08:00:00Z");
exports.LATER = new Date("2026-11-11T09:00:00Z");
function makeReview() {
    return {
        id: "20261111-080000",
        repo: "/Users/dev/Example",
        base: "feature/liquidGlass",
        branch: "fix/design-review-20261111-0800",
        worktree: "/Users/dev/.react-native-grab/worktrees/Example",
        sessionId: null,
        codemakerBin: "codemaker",
        pairingCode: "012345",
        status: "active",
        mrUrl: null,
        nextItemNo: 1,
        items: [],
        revertedSinceLastRun: [],
        createdAt: exports.NOW.toISOString(),
    };
}
function makeItemInput() {
    return { kind: "element", description: "标题字号应为 16" };
}
function freshDraft() {
    return (0, transitions_1.createItem)(makeReview(), { ...makeItemInput() }, exports.NOW).review;
}
function queued() {
    return (0, transitions_1.submitDrafts)(freshDraft(), exports.LATER).review;
}
function fixing() {
    return (0, transitions_1.claimItem)(queued(), 1);
}
function awaiting() {
    return (0, transitions_1.replyItem)(fixing(), 1, "已改为 16", ["abc"], exports.LATER);
}
function passed() {
    return (0, transitions_1.passItem)(awaiting(), 1);
}
function rejectedWithCommits() {
    return (0, transitions_1.rejectItem)(awaiting(), 1, "间距还是不对", exports.LATER);
}
exports.draftWithCommits = rejectedWithCommits;
//# sourceMappingURL=fixtures.js.map