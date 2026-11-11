export declare const REVIEW_BRANCH_PREFIX = "fix/design-review-";
export type GitRunResult = {
    code: number;
    stdout: string;
    stderr: string;
};
export type GitRunner = (args: string[], cwd: string) => Promise<GitRunResult>;
export declare const reviewBranchName: (now: Date) => string;
export declare const revertCommitMessage: (no: number) => string;
export declare const createGit: (run?: GitRunner) => {
    isClean: (cwd: string) => Promise<boolean>;
    isBasePushed: (repo: string, base: string) => Promise<boolean>;
    prepareWorktree: (repo: string, path: string, base: string, branch: string) => Promise<void>;
    commonDir: (cwd: string) => Promise<string>;
    verifyItemCommits: (cwd: string, base: string, shas: string[], claimedByOthers: Set<string>) => Promise<{
        ok: true;
        shas: string[];
    } | {
        ok: false;
        reason: "missing" | "not_on_branch" | "in_base" | "claimed_by_other";
        sha: string;
    }>;
    revertCommits: (cwd: string, shas: string[], message: string) => Promise<{
        ok: true;
        commit: string | null;
    } | {
        ok: false;
        reason: "dirty" | "conflict";
    }>;
    hasNetDiff: (cwd: string, base: string) => Promise<boolean>;
};
export type Git = ReturnType<typeof createGit>;
//# sourceMappingURL=git.d.ts.map