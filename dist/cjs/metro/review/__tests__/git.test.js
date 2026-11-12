"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_child_process_1 = require("node:child_process");
const node_fs_1 = require("node:fs");
const node_os_1 = require("node:os");
const node_path_1 = require("node:path");
const vitest_1 = require("vitest");
const git_1 = require("../git");
// Copied from [rn] scripts/ai/check-commit-msg.js.
const COMMIT_MSG_RE = /^(feat|fix|docs|style|refactor|test|chore|perf|build|ci)(\([a-zA-Z0-9._/-]+\))?!?: .{1,72}$/;
const gitSync = (cwd, ...args) => {
    const result = (0, node_child_process_1.spawnSync)("git", args, { cwd, encoding: "utf8" });
    if (result.status !== 0) {
        throw new Error(`git ${args.join(" ")} failed in ${cwd}: ${result.stderr}`);
    }
    return result.stdout;
};
let root;
const makeRepo = () => {
    const repo = (0, node_fs_1.mkdtempSync)((0, node_path_1.join)(root, "repo-"));
    gitSync(repo, "init", "-q", "-b", "base");
    gitSync(repo, "config", "user.email", "review@react-native-grab.test");
    gitSync(repo, "config", "user.name", "Review Test");
    (0, node_fs_1.writeFileSync)((0, node_path_1.join)(repo, "file.txt"), "line: base\n");
    gitSync(repo, "add", ".");
    gitSync(repo, "commit", "-qm", "base");
    gitSync(repo, "checkout", "-q", "-b", "review");
    return repo;
};
const commitLine = (repo, line, message) => {
    (0, node_fs_1.writeFileSync)((0, node_path_1.join)(repo, "file.txt"), `${line}\n`);
    gitSync(repo, "commit", "-qam", message);
    return gitSync(repo, "rev-parse", "HEAD").trim();
};
const revertHeadPath = (repo) => {
    return (0, node_path_1.join)(repo, ".git", "REVERT_HEAD");
};
(0, vitest_1.beforeEach)(() => {
    root = (0, node_fs_1.mkdtempSync)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "rn-grab-git-"));
});
(0, vitest_1.afterEach)(() => {
    (0, node_fs_1.rmSync)(root, { recursive: true, force: true });
});
(0, vitest_1.describe)("review branch and revert message helpers", () => {
    (0, vitest_1.it)("derives the review branch name from a local timestamp", () => {
        (0, vitest_1.expect)(git_1.REVIEW_BRANCH_PREFIX).toBe("fix/design-review-");
        (0, vitest_1.expect)((0, git_1.reviewBranchName)(new Date(2026, 0, 2, 3, 4, 5))).toBe("fix/design-review-20260102-0304");
    });
    (0, vitest_1.it)("formats revert commit messages that pass the rn commit message check", () => {
        (0, vitest_1.expect)((0, git_1.revertCommitMessage)(12)).toMatch(COMMIT_MSG_RE);
        (0, vitest_1.expect)((0, git_1.revertCommitMessage)(3)).toBe("fix(design-review): #3 撤销走查修改");
    });
});
(0, vitest_1.describe)("createGit with the default runner", () => {
    (0, vitest_1.it)("reverts two commits newest-first in one commit that restores the base content", async () => {
        const repo = makeRepo();
        const git = (0, git_1.createGit)();
        const oldest = commitLine(repo, "line: one", "c1");
        const newest = commitLine(repo, "line: two", "c2");
        const countBefore = Number(gitSync(repo, "rev-list", "--count", "base..HEAD").trim());
        const result = await git.revertCommits(repo, [oldest, newest], (0, git_1.revertCommitMessage)(3));
        (0, vitest_1.expect)(result).toEqual({ ok: true, commit: gitSync(repo, "rev-parse", "HEAD").trim() });
        (0, vitest_1.expect)((0, node_fs_1.readFileSync)((0, node_path_1.join)(repo, "file.txt"), "utf8")).toBe("line: base\n");
        (0, vitest_1.expect)(gitSync(repo, "rev-list", "--count", "base..HEAD").trim()).toBe(String(countBefore + 1));
        (0, vitest_1.expect)(gitSync(repo, "log", "-1", "--format=%s").trim()).toBe((0, git_1.revertCommitMessage)(3));
        (0, vitest_1.expect)(gitSync(repo, "status", "--porcelain")).toBe("");
        (0, vitest_1.expect)((0, node_fs_1.existsSync)(revertHeadPath(repo))).toBe(false);
    });
    (0, vitest_1.it)("reports a conflict, leaves a clean tree and no REVERT_HEAD on a colliding revert", async () => {
        const repo = makeRepo();
        const git = (0, git_1.createGit)();
        const oldest = commitLine(repo, "line: one", "c1");
        const newest = commitLine(repo, "line: two", "c2");
        const result = await git.revertCommits(repo, [oldest], (0, git_1.revertCommitMessage)(3));
        (0, vitest_1.expect)(result).toEqual({ ok: false, reason: "conflict" });
        (0, vitest_1.expect)(gitSync(repo, "status", "--porcelain")).toBe("");
        (0, vitest_1.expect)((0, node_fs_1.existsSync)(revertHeadPath(repo))).toBe(false);
        (0, vitest_1.expect)(gitSync(repo, "rev-parse", "HEAD").trim()).toBe(newest);
        (0, vitest_1.expect)((0, node_fs_1.readFileSync)((0, node_path_1.join)(repo, "file.txt"), "utf8")).toBe("line: two\n");
    });
    (0, vitest_1.it)("returns a null commit when the reverted change is already undone", async () => {
        const repo = makeRepo();
        const git = (0, git_1.createGit)();
        const oldest = commitLine(repo, "line: one", "c1");
        commitLine(repo, "line: base", "c2 (manual undo)");
        const result = await git.revertCommits(repo, [oldest], (0, git_1.revertCommitMessage)(1));
        (0, vitest_1.expect)(result).toEqual({ ok: true, commit: null });
        (0, vitest_1.expect)(gitSync(repo, "rev-list", "--count", "base..HEAD").trim()).toBe("2");
        (0, vitest_1.expect)(gitSync(repo, "status", "--porcelain")).toBe("");
        (0, vitest_1.expect)((0, node_fs_1.existsSync)(revertHeadPath(repo))).toBe(false);
    });
    (0, vitest_1.it)("returns a null commit when there is nothing to revert", async () => {
        const repo = makeRepo();
        const git = (0, git_1.createGit)();
        const result = await git.revertCommits(repo, [], (0, git_1.revertCommitMessage)(1));
        (0, vitest_1.expect)(result).toEqual({ ok: true, commit: null });
        (0, vitest_1.expect)(gitSync(repo, "rev-list", "--count", "base..HEAD").trim()).toBe("0");
    });
    (0, vitest_1.it)("refuses to revert while the worktree is dirty", async () => {
        const repo = makeRepo();
        const git = (0, git_1.createGit)();
        const sha = commitLine(repo, "line: one", "c1");
        (0, node_fs_1.writeFileSync)((0, node_path_1.join)(repo, "file.txt"), "line: wip\n");
        const result = await git.revertCommits(repo, [sha], (0, git_1.revertCommitMessage)(1));
        (0, vitest_1.expect)(result).toEqual({ ok: false, reason: "dirty" });
        (0, vitest_1.expect)((0, node_fs_1.readFileSync)((0, node_path_1.join)(repo, "file.txt"), "utf8")).toBe("line: wip\n");
    });
    (0, vitest_1.it)("reports missing, not_on_branch, in_base and claimed_by_other item commits", async () => {
        const repo = makeRepo();
        const git = (0, git_1.createGit)();
        const first = commitLine(repo, "line: one", "c1");
        const second = commitLine(repo, "line: two", "c2");
        const baseSha = gitSync(repo, "rev-parse", "base").trim();
        gitSync(repo, "branch", "other", "base");
        gitSync(repo, "checkout", "-q", "other");
        (0, node_fs_1.writeFileSync)((0, node_path_1.join)(repo, "other.txt"), "other\n");
        gitSync(repo, "add", ".");
        gitSync(repo, "commit", "-qm", "other commit");
        const other = gitSync(repo, "rev-parse", "HEAD").trim();
        gitSync(repo, "checkout", "-q", "review");
        const missing = "0123456789abcdef0123456789abcdef01234567";
        await (0, vitest_1.expect)(git.verifyItemCommits(repo, "base", [missing], new Set())).resolves.toEqual({
            ok: false,
            reason: "missing",
            sha: missing,
        });
        await (0, vitest_1.expect)(git.verifyItemCommits(repo, "base", [baseSha], new Set())).resolves.toEqual({
            ok: false,
            reason: "in_base",
            sha: baseSha,
        });
        await (0, vitest_1.expect)(git.verifyItemCommits(repo, "base", [other], new Set())).resolves.toEqual({
            ok: false,
            reason: "not_on_branch",
            sha: other,
        });
        await (0, vitest_1.expect)(git.verifyItemCommits(repo, "base", [second], new Set([second]))).resolves.toEqual({
            ok: false,
            reason: "claimed_by_other",
            sha: second,
        });
        await (0, vitest_1.expect)(git.verifyItemCommits(repo, "base", [first.slice(0, 7), second.slice(0, 7)], new Set())).resolves.toEqual({ ok: true, shas: [first, second] });
    });
    (0, vitest_1.it)("detects a net diff against the base and reports none after reverting everything", async () => {
        const repo = makeRepo();
        const git = (0, git_1.createGit)();
        const oldest = commitLine(repo, "line: one", "c1");
        const newest = commitLine(repo, "line: two", "c2");
        (0, vitest_1.expect)(await git.hasNetDiff(repo, "base")).toBe(true);
        const result = await git.revertCommits(repo, [oldest, newest], (0, git_1.revertCommitMessage)(2));
        (0, vitest_1.expect)(result).toMatchObject({ ok: true });
        (0, vitest_1.expect)(await git.hasNetDiff(repo, "base")).toBe(false);
    });
    (0, vitest_1.it)("spawns git with argument arrays so refs with shell metacharacters resolve", async () => {
        const repo = makeRepo();
        const git = (0, git_1.createGit)();
        commitLine(repo, "line: one", "c1");
        gitSync(repo, "branch", "b$HOME;x", "base");
        (0, vitest_1.expect)(await git.hasNetDiff(repo, "b$HOME;x")).toBe(true);
    });
    (0, vitest_1.it)("creates a worktree at the base when the path is missing", async () => {
        const repo = makeRepo();
        const git = (0, git_1.createGit)();
        const baseSha = gitSync(repo, "rev-parse", "base").trim();
        commitLine(repo, "line: one", "c1");
        const worktree = (0, node_path_1.join)(root, "wt");
        await git.prepareWorktree(repo, worktree, "base", "fix/design-review-20260101-0101");
        (0, vitest_1.expect)(gitSync(worktree, "rev-parse", "HEAD").trim()).toBe(baseSha);
        (0, vitest_1.expect)(gitSync(worktree, "rev-parse", "--abbrev-ref", "HEAD").trim()).toBe("fix/design-review-20260101-0101");
        (0, vitest_1.expect)(await git.isClean(worktree)).toBe(true);
    });
    (0, vitest_1.it)("reuses a clean existing worktree by attaching a new branch at the base", async () => {
        const repo = makeRepo();
        const git = (0, git_1.createGit)();
        const baseSha = gitSync(repo, "rev-parse", "base").trim();
        const worktree = (0, node_path_1.join)(root, "wt");
        await git.prepareWorktree(repo, worktree, "base", "fix/design-review-20260101-0101");
        await git.prepareWorktree(repo, worktree, "base", "fix/design-review-20260101-0202");
        (0, vitest_1.expect)(gitSync(worktree, "rev-parse", "HEAD").trim()).toBe(baseSha);
        (0, vitest_1.expect)(gitSync(worktree, "rev-parse", "--abbrev-ref", "HEAD").trim()).toBe("fix/design-review-20260101-0202");
    });
    (0, vitest_1.it)("refuses to reuse a dirty existing worktree", async () => {
        const repo = makeRepo();
        const git = (0, git_1.createGit)();
        const worktree = (0, node_path_1.join)(root, "wt");
        await git.prepareWorktree(repo, worktree, "base", "fix/design-review-20260101-0101");
        (0, node_fs_1.writeFileSync)((0, node_path_1.join)(worktree, "file.txt"), "line: wip\n");
        await (0, vitest_1.expect)(git.prepareWorktree(repo, worktree, "base", "fix/design-review-20260101-0202")).rejects.toThrow(/dirty/i);
        (0, vitest_1.expect)(gitSync(worktree, "rev-parse", "--abbrev-ref", "HEAD").trim()).toBe("fix/design-review-20260101-0101");
        (0, vitest_1.expect)((0, node_fs_1.readFileSync)((0, node_path_1.join)(worktree, "file.txt"), "utf8")).toBe("line: wip\n");
    });
    (0, vitest_1.it)("resolves the common git dir from inside a worktree", async () => {
        const repo = makeRepo();
        const git = (0, git_1.createGit)();
        const worktree = (0, node_path_1.join)(root, "wt");
        await git.prepareWorktree(repo, worktree, "base", "fix/design-review-20260101-0101");
        (0, vitest_1.expect)((0, node_fs_1.realpathSync)(await git.commonDir(worktree))).toBe((0, node_fs_1.realpathSync)((0, node_path_1.join)(repo, ".git")));
        (0, vitest_1.expect)((0, node_fs_1.realpathSync)(await git.commonDir(repo))).toBe((0, node_fs_1.realpathSync)((0, node_path_1.join)(repo, ".git")));
    });
    (0, vitest_1.it)("compares the base branch with its remote counterpart after fetching", async () => {
        const repo = makeRepo();
        const git = (0, git_1.createGit)();
        const origin = (0, node_path_1.join)(root, "origin.git");
        gitSync(root, "init", "-q", "--bare", "origin.git");
        gitSync(origin, "fetch", "-q", repo, "base:base");
        gitSync(repo, "remote", "add", "origin", origin);
        (0, vitest_1.expect)(await git.isBasePushed(repo, "base")).toBe(true);
        commitLine(repo, "line: one", "c1");
        gitSync(repo, "branch", "-f", "base", "HEAD");
        (0, vitest_1.expect)(await git.isBasePushed(repo, "base")).toBe(false);
    });
    (0, vitest_1.it)("reports an unpushed base when fetching fails", async () => {
        const repo = makeRepo();
        const git = (0, git_1.createGit)();
        (0, vitest_1.expect)(await git.isBasePushed(repo, "base")).toBe(false);
    });
});
(0, vitest_1.describe)("saveLeftovers", () => {
    (0, vitest_1.it)("returns false on a clean worktree without creating a patch", async () => {
        const repo = makeRepo();
        const git = (0, git_1.createGit)();
        const patchFile = (0, node_path_1.join)(root, "leftovers", "local-20261112-090000.patch");
        (0, vitest_1.expect)(await git.saveLeftovers(repo, patchFile)).toBe(false);
        (0, vitest_1.expect)((0, node_fs_1.existsSync)(patchFile)).toBe(false);
        (0, vitest_1.expect)((0, node_fs_1.existsSync)((0, node_path_1.join)(root, "leftovers"))).toBe(false);
    });
    (0, vitest_1.it)("saves tracked, new and binary changes, preserves ignored files and restores via git apply", async () => {
        const repo = makeRepo();
        const git = (0, git_1.createGit)();
        (0, node_fs_1.mkdirSync)((0, node_path_1.join)(repo, ".git", "info"), { recursive: true });
        (0, node_fs_1.appendFileSync)((0, node_path_1.join)(repo, ".git", "info", "exclude"), "\n.rn-grab-review/\n", "utf8");
        (0, node_fs_1.writeFileSync)((0, node_path_1.join)(repo, "file.txt"), "line: dirty\n", "utf8");
        (0, node_fs_1.writeFileSync)((0, node_path_1.join)(repo, "new.txt"), "new untracked content\n", "utf8");
        const binary = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff, 0x01]);
        (0, node_fs_1.writeFileSync)((0, node_path_1.join)(repo, "image.bin"), binary);
        (0, node_fs_1.mkdirSync)((0, node_path_1.join)(repo, ".rn-grab-review"), { recursive: true });
        (0, node_fs_1.writeFileSync)((0, node_path_1.join)(repo, ".rn-grab-review", "keep.jpg"), "ignored screenshot", "utf8");
        const patchFile = (0, node_path_1.join)(root, "leftovers", "local-20261112-090012.patch");
        (0, vitest_1.expect)(await git.saveLeftovers(repo, patchFile)).toBe(true);
        (0, vitest_1.expect)(gitSync(repo, "status", "--porcelain").trim()).toBe("");
        (0, vitest_1.expect)((0, node_fs_1.readFileSync)((0, node_path_1.join)(repo, ".rn-grab-review", "keep.jpg"), "utf8")).toBe("ignored screenshot");
        const patch = (0, node_fs_1.readFileSync)(patchFile, "utf8");
        (0, vitest_1.expect)(patch).toContain("line: dirty");
        (0, vitest_1.expect)(patch).toContain("GIT binary patch");
        gitSync(repo, "apply", patchFile);
        (0, vitest_1.expect)((0, node_fs_1.readFileSync)((0, node_path_1.join)(repo, "file.txt"), "utf8")).toBe("line: dirty\n");
        (0, vitest_1.expect)((0, node_fs_1.readFileSync)((0, node_path_1.join)(repo, "new.txt"), "utf8")).toBe("new untracked content\n");
        (0, vitest_1.expect)((0, node_fs_1.readFileSync)((0, node_path_1.join)(repo, "image.bin"))).toEqual(binary);
        (0, vitest_1.expect)((0, node_fs_1.readFileSync)((0, node_path_1.join)(repo, ".rn-grab-review", "keep.jpg"), "utf8")).toBe("ignored screenshot");
    });
});
(0, vitest_1.describe)("createGit command wiring", () => {
    (0, vitest_1.it)("passes argument arrays to the runner and maps exit codes and output", async () => {
        const calls = [];
        let statusOut = "";
        let diffCode = 1;
        let localBase = "aaaaaa";
        let remoteBase = "aaaaaa";
        const git = (0, git_1.createGit)(async (args, cwd) => {
            calls.push({ args: [...args], cwd });
            if (args[0] === "status") {
                return { code: 0, stdout: statusOut, stderr: "" };
            }
            if (args[0] === "diff") {
                return { code: diffCode, stdout: "", stderr: "" };
            }
            if (args[0] === "rev-parse" && args[1] === "base") {
                return { code: 0, stdout: `${localBase}\n`, stderr: "" };
            }
            if (args[0] === "rev-parse") {
                return { code: 0, stdout: `${remoteBase}\n`, stderr: "" };
            }
            return { code: 0, stdout: "", stderr: "" };
        });
        (0, vitest_1.expect)(await git.isClean("/repo")).toBe(true);
        (0, vitest_1.expect)(calls[0]).toEqual({ args: ["status", "--porcelain"], cwd: "/repo" });
        statusOut = "M  file.txt\n";
        (0, vitest_1.expect)(await git.isClean("/repo")).toBe(false);
        (0, vitest_1.expect)(await git.hasNetDiff("/repo", "base")).toBe(true);
        (0, vitest_1.expect)(calls[calls.length - 1]).toEqual({
            args: ["diff", "--quiet", "base...HEAD"],
            cwd: "/repo",
        });
        diffCode = 0;
        (0, vitest_1.expect)(await git.hasNetDiff("/repo", "base")).toBe(false);
        (0, vitest_1.expect)(await git.isBasePushed("/repo", "base")).toBe(true);
        (0, vitest_1.expect)(calls.slice(-3)).toEqual([
            { args: ["fetch", "origin", "base"], cwd: "/repo" },
            { args: ["rev-parse", "base"], cwd: "/repo" },
            { args: ["rev-parse", "origin/base"], cwd: "/repo" },
        ]);
        remoteBase = "bbbbbb";
        (0, vitest_1.expect)(await git.isBasePushed("/repo", "base")).toBe(false);
    });
});
//# sourceMappingURL=git.test.js.map