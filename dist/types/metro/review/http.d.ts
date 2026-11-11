import type { IncomingMessage, ServerResponse } from "node:http";
import type { Git } from "./git";
import type { ReviewStore } from "./store";
export declare const REVIEW_ROUTE_PREFIX = "/__react-native-grab/review/";
export declare const REVIEW_CODE_HEADER = "x-rn-grab-review-code";
export type RunnerControl = {
    readonly busy: boolean;
    readonly blocked: boolean;
    kick(): void;
    unblock(): void;
    stop(): void;
};
export type ReviewHandlerDeps = {
    store: ReviewStore;
    git: Pick<Git, "verifyItemCommits" | "revertCommits">;
    runner: RunnerControl;
    now: () => Date;
    isLoopback?: (req: IncomingMessage) => boolean;
};
type NextFn = () => void;
export declare const createReviewHandler: (deps: ReviewHandlerDeps) => (req: IncomingMessage, res: ServerResponse, next: NextFn) => void;
export {};
//# sourceMappingURL=http.d.ts.map