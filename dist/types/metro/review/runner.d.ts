import type { Review } from "../../review-core/types";
import type { RunnerControl } from "./http";
import type { ReviewStore } from "./store";
export declare const RUN_END_RELEASE_MESSAGE = "agent \u8FD0\u884C\u7ED3\u675F\u65F6\u8BE5\u6761\u4ECD\u5728\u4FEE\u590D\u4E2D";
export declare const RESTART_RELEASE_MESSAGE = "Metro \u91CD\u542F\u65F6\u8BE5\u6761\u4ECD\u5728\u4FEE\u590D\u4E2D";
export type AgentWork = {
    kind: "fix";
    items: number[];
    reverted: number[];
} | {
    kind: "finish";
};
export declare const nextWork: (review: Review) => AgentWork | null;
export declare const buildAgentMessage: (work: AgentWork, review: Review) => string;
export type AgentLock = {
    write(pid: number): void;
    clear(): void;
    livePid(): number | null;
};
export declare const createAgentLock: (lockFile: string) => AgentLock;
export type AgentRunnerDeps = {
    store: Pick<ReviewStore, "get" | "update">;
    git: {
        hasNetDiff(cwd: string, base: string): Promise<boolean>;
    };
    run: (message: string) => Promise<{
        exitCode: number;
    }>;
    lock: AgentLock;
    log: (line: string) => void;
    orphanPollMs?: number;
};
export declare class AgentRunner implements RunnerControl {
    private readonly store;
    private readonly git;
    private readonly run;
    private readonly lock;
    private readonly log;
    private readonly orphanPollMs;
    private running;
    private waitingOrphan;
    private exclusive;
    private stopped;
    private blockedState;
    private noProgressStreak;
    private pendingKick;
    private draining;
    private idleWaiters;
    constructor(deps: AgentRunnerDeps);
    get busy(): boolean;
    get blocked(): boolean;
    kick(): void;
    unblock(): void;
    stop(): void;
    runExclusive<T>(fn: () => Promise<T>): Promise<T>;
    whenIdle(): Promise<void>;
    private notifyIdle;
    private safeLog;
    private drain;
    private tryRun;
}
//# sourceMappingURL=runner.d.ts.map