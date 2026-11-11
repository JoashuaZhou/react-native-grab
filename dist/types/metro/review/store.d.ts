import type { Review } from "../../review-core/types";
export declare class ReviewStore {
    readonly dir: string;
    private review;
    private constructor();
    static create(dir: string, review: Review): ReviewStore;
    static load(dir: string): ReviewStore;
    get(): Review;
    update(mutate: (r: Review) => Review): Review;
    writeScreenshot(no: number, jpegBase64: string): string;
    screenshotPath(file: string): string;
    agentLogPath(): string;
    lockPath(): string;
}
//# sourceMappingURL=store.d.ts.map