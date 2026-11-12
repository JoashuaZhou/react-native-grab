import { type ReviewPaths } from "../metro/review/paths";
import { type Review, type ReviewItem } from "../review-core/types";
export declare const METRO_PORT = 8081;
export declare const LOCAL_ORIGIN = "http://127.0.0.1:8081";
export type LocalOptions = {
    origin?: string;
    print?: (line: string) => void;
};
export declare const localStatus: (options?: LocalOptions) => Promise<Review>;
export declare const printStatus: (options?: LocalOptions) => Promise<Review>;
export declare const showItem: (no: number, json: boolean, options?: LocalOptions) => Promise<ReviewItem>;
export declare const claim: (no: number, options?: LocalOptions) => Promise<ReviewItem>;
export declare const reply: (no: number, message: string, commits: string[], options?: LocalOptions) => Promise<ReviewItem>;
export declare const complete: (mr: string | null, options?: LocalOptions) => Promise<void>;
export declare const retry: (options?: LocalOptions) => Promise<void>;
export declare const stopReview: (paths: ReviewPaths, options?: LocalOptions) => Promise<void>;
//# sourceMappingURL=local-client.d.ts.map