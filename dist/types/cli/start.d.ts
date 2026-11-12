import { type ReviewPaths } from "../metro/review/paths";
import { type Git } from "../metro/review/git";
export type StartDeps = {
    git: Pick<Git, "isBasePushed" | "prepareWorktree" | "commonDir">;
    paths: ReviewPaths;
    now: () => Date;
    portFree: (port: number) => Promise<boolean>;
    which: (bin: string) => string | null;
    installDeps: (worktree: string) => Promise<void>;
    installAgentFiles: (worktree: string, commonDir: string) => Promise<void>;
    createSession: (o: {
        bin: string;
        worktree: string;
        title: string;
        message: string;
    }) => Promise<string>;
    spawnMetro: (worktree: string, env: {
        RN_GRAB_REVIEW_DIR: string;
    }) => Promise<number>;
    randomCode: () => string;
    lanAddress: () => string | null;
    log: (line: string) => void;
};
export type ServeDeps = {
    spawnMetro: (worktree: string, env: {
        RN_GRAB_REVIEW_DIR: string;
    }) => Promise<number>;
    log: (line: string) => void;
};
export declare const startReview: (opts: {
    repo: string;
    base: string;
}, deps: StartDeps) => Promise<void>;
export declare const serveReview: (paths: ReviewPaths, deps: ServeDeps) => Promise<void>;
export declare const createInstallDeps: (runInstall: (worktree: string) => Promise<void>) => ((worktree: string) => Promise<void>);
//# sourceMappingURL=start.d.ts.map