import type { Review } from "../types";
export declare const NOW: Date;
export declare const LATER: Date;
export declare function makeReview(): Review;
export declare function makeItemInput(): {
    readonly kind: "element";
    readonly description: "标题字号应为 16";
};
export declare function freshDraft(): Review;
export declare function queued(): Review;
export declare function fixing(): Review;
export declare function awaiting(): Review;
export declare function passed(): Review;
export declare function rejectedWithCommits(): Review;
export declare const draftWithCommits: typeof rejectedWithCommits;
//# sourceMappingURL=fixtures.d.ts.map