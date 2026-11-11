import type { DraftPatch, ItemAction, NewItemInput, Review, ReviewItem } from "./types";
export type ReviewErrorCode = "not_found" | "invalid_state" | "has_commits" | "runner_busy" | "empty_text" | "not_finishable" | "review_closed" | "invalid_commits" | "conflict" | "invalid_input";
export declare class ReviewError extends Error {
    code: ReviewErrorCode;
    constructor(code: ReviewErrorCode, message: string);
}
export declare function itemCommits(item: ReviewItem): string[];
export declare function getItemActions(item: ReviewItem, runnerBusy: boolean): ItemAction[];
export declare function createItem(review: Review, input: NewItemInput, now: Date): {
    review: Review;
    item: ReviewItem;
};
export declare function attachScreenshot(review: Review, no: number, file: string): Review;
export declare function updateDraft(review: Review, no: number, patch: DraftPatch): Review;
export declare function deleteDraft(review: Review, no: number): Review;
export declare function submitDrafts(review: Review, now: Date): {
    review: Review;
    submitted: number[];
};
export declare function claimItem(review: Review, no: number): Review;
export declare function replyItem(review: Review, no: number, reply: string, commits: string[], now: Date): Review;
export declare function passItem(review: Review, no: number): Review;
export declare function rejectItem(review: Review, no: number, supplement: string, now: Date): Review;
export declare function markReverted(review: Review, no: number, revertCommit: string | null): Review;
export declare function releaseFixing(review: Review, error: string): Review;
export declare function beginFinish(review: Review): Review;
export declare function completeReview(review: Review, mrUrl: string | null): Review;
export declare function abandonReview(review: Review): Review;
//# sourceMappingURL=transitions.d.ts.map