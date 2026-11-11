import { claimItem, createItem, passItem, rejectItem, replyItem, submitDrafts, } from "../transitions";
export const NOW = new Date("2026-11-11T08:00:00Z");
export const LATER = new Date("2026-11-11T09:00:00Z");
export function makeReview() {
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
        createdAt: NOW.toISOString(),
    };
}
export function makeItemInput() {
    return { kind: "element", description: "标题字号应为 16" };
}
export function freshDraft() {
    return createItem(makeReview(), { ...makeItemInput() }, NOW).review;
}
export function queued() {
    return submitDrafts(freshDraft(), LATER).review;
}
export function fixing() {
    return claimItem(queued(), 1);
}
export function awaiting() {
    return replyItem(fixing(), 1, "已改为 16", ["abc"], LATER);
}
export function passed() {
    return passItem(awaiting(), 1);
}
export function rejectedWithCommits() {
    return rejectItem(awaiting(), 1, "间距还是不对", LATER);
}
export const draftWithCommits = rejectedWithCommits;
//# sourceMappingURL=fixtures.js.map