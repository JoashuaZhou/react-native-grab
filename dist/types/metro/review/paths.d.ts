export type ReviewPaths = {
    home: string;
    reviewsDir: string;
    worktreesDir: string;
    activeFile: string;
};
export type ActiveReview = {
    reviewId: string;
    dir: string;
};
export declare const getReviewPaths: (homeDir?: string) => ReviewPaths;
export declare const readActive: (paths: ReviewPaths) => ActiveReview | null;
export declare const writeActive: (paths: ReviewPaths, active: ActiveReview) => void;
export declare const clearActive: (paths: ReviewPaths) => void;
//# sourceMappingURL=paths.d.ts.map