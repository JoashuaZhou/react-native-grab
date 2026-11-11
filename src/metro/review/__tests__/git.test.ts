import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { REVIEW_BRANCH_PREFIX, createGit, revertCommitMessage, reviewBranchName } from "../git";

// Copied from [rn] scripts/ai/check-commit-msg.js.
const COMMIT_MSG_RE =
  /^(feat|fix|docs|style|refactor|test|chore|perf|build|ci)(\([a-zA-Z0-9._/-]+\))?!?: .{1,72}$/;

const gitSync = (cwd: string, ...args: string[]): string => {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed in ${cwd}: ${result.stderr}`);
  }
  return result.stdout;
};

let root: string;

const makeRepo = (): string => {
  const repo = mkdtempSync(join(root, "repo-"));
  gitSync(repo, "init", "-q", "-b", "base");
  gitSync(repo, "config", "user.email", "review@react-native-grab.test");
  gitSync(repo, "config", "user.name", "Review Test");
  writeFileSync(join(repo, "file.txt"), "line: base\n");
  gitSync(repo, "add", ".");
  gitSync(repo, "commit", "-qm", "base");
  gitSync(repo, "checkout", "-q", "-b", "review");
  return repo;
};

const commitLine = (repo: string, line: string, message: string): string => {
  writeFileSync(join(repo, "file.txt"), `${line}\n`);
  gitSync(repo, "commit", "-qam", message);
  return gitSync(repo, "rev-parse", "HEAD").trim();
};

const revertHeadPath = (repo: string): string => {
  return join(repo, ".git", "REVERT_HEAD");
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "rn-grab-git-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("review branch and revert message helpers", () => {
  it("derives the review branch name from a local timestamp", () => {
    expect(REVIEW_BRANCH_PREFIX).toBe("fix/design-review-");
    expect(reviewBranchName(new Date(2026, 0, 2, 3, 4, 5))).toBe("fix/design-review-20260102-0304");
  });

  it("formats revert commit messages that pass the rn commit message check", () => {
    expect(revertCommitMessage(12)).toMatch(COMMIT_MSG_RE);
    expect(revertCommitMessage(3)).toBe("fix(design-review): #3 撤销走查修改");
  });
});

describe("createGit with the default runner", () => {
  it("reverts two commits newest-first in one commit that restores the base content", async () => {
    const repo = makeRepo();
    const git = createGit();
    const oldest = commitLine(repo, "line: one", "c1");
    const newest = commitLine(repo, "line: two", "c2");
    const countBefore = Number(gitSync(repo, "rev-list", "--count", "base..HEAD").trim());

    const result = await git.revertCommits(repo, [oldest, newest], revertCommitMessage(3));

    expect(result).toEqual({ ok: true, commit: gitSync(repo, "rev-parse", "HEAD").trim() });
    expect(readFileSync(join(repo, "file.txt"), "utf8")).toBe("line: base\n");
    expect(gitSync(repo, "rev-list", "--count", "base..HEAD").trim()).toBe(String(countBefore + 1));
    expect(gitSync(repo, "log", "-1", "--format=%s").trim()).toBe(revertCommitMessage(3));
    expect(gitSync(repo, "status", "--porcelain")).toBe("");
    expect(existsSync(revertHeadPath(repo))).toBe(false);
  });

  it("reports a conflict, leaves a clean tree and no REVERT_HEAD on a colliding revert", async () => {
    const repo = makeRepo();
    const git = createGit();
    const oldest = commitLine(repo, "line: one", "c1");
    const newest = commitLine(repo, "line: two", "c2");

    const result = await git.revertCommits(repo, [oldest], revertCommitMessage(3));

    expect(result).toEqual({ ok: false, reason: "conflict" });
    expect(gitSync(repo, "status", "--porcelain")).toBe("");
    expect(existsSync(revertHeadPath(repo))).toBe(false);
    expect(gitSync(repo, "rev-parse", "HEAD").trim()).toBe(newest);
    expect(readFileSync(join(repo, "file.txt"), "utf8")).toBe("line: two\n");
  });

  it("returns a null commit when the reverted change is already undone", async () => {
    const repo = makeRepo();
    const git = createGit();
    const oldest = commitLine(repo, "line: one", "c1");
    commitLine(repo, "line: base", "c2 (manual undo)");

    const result = await git.revertCommits(repo, [oldest], revertCommitMessage(1));

    expect(result).toEqual({ ok: true, commit: null });
    expect(gitSync(repo, "rev-list", "--count", "base..HEAD").trim()).toBe("2");
    expect(gitSync(repo, "status", "--porcelain")).toBe("");
    expect(existsSync(revertHeadPath(repo))).toBe(false);
  });

  it("returns a null commit when there is nothing to revert", async () => {
    const repo = makeRepo();
    const git = createGit();

    const result = await git.revertCommits(repo, [], revertCommitMessage(1));

    expect(result).toEqual({ ok: true, commit: null });
    expect(gitSync(repo, "rev-list", "--count", "base..HEAD").trim()).toBe("0");
  });

  it("refuses to revert while the worktree is dirty", async () => {
    const repo = makeRepo();
    const git = createGit();
    const sha = commitLine(repo, "line: one", "c1");
    writeFileSync(join(repo, "file.txt"), "line: wip\n");

    const result = await git.revertCommits(repo, [sha], revertCommitMessage(1));

    expect(result).toEqual({ ok: false, reason: "dirty" });
    expect(readFileSync(join(repo, "file.txt"), "utf8")).toBe("line: wip\n");
  });

  it("reports missing, not_on_branch, in_base and claimed_by_other item commits", async () => {
    const repo = makeRepo();
    const git = createGit();
    const first = commitLine(repo, "line: one", "c1");
    const second = commitLine(repo, "line: two", "c2");
    const baseSha = gitSync(repo, "rev-parse", "base").trim();
    gitSync(repo, "branch", "other", "base");
    gitSync(repo, "checkout", "-q", "other");
    writeFileSync(join(repo, "other.txt"), "other\n");
    gitSync(repo, "add", ".");
    gitSync(repo, "commit", "-qm", "other commit");
    const other = gitSync(repo, "rev-parse", "HEAD").trim();
    gitSync(repo, "checkout", "-q", "review");

    const missing = "0123456789abcdef0123456789abcdef01234567";
    await expect(git.verifyItemCommits(repo, "base", [missing], new Set())).resolves.toEqual({
      ok: false,
      reason: "missing",
      sha: missing,
    });
    await expect(git.verifyItemCommits(repo, "base", [baseSha], new Set())).resolves.toEqual({
      ok: false,
      reason: "in_base",
      sha: baseSha,
    });
    await expect(git.verifyItemCommits(repo, "base", [other], new Set())).resolves.toEqual({
      ok: false,
      reason: "not_on_branch",
      sha: other,
    });
    await expect(git.verifyItemCommits(repo, "base", [second], new Set([second]))).resolves.toEqual(
      {
        ok: false,
        reason: "claimed_by_other",
        sha: second,
      },
    );
    await expect(
      git.verifyItemCommits(repo, "base", [first.slice(0, 7), second.slice(0, 7)], new Set()),
    ).resolves.toEqual({ ok: true, shas: [first, second] });
  });

  it("detects a net diff against the base and reports none after reverting everything", async () => {
    const repo = makeRepo();
    const git = createGit();
    const oldest = commitLine(repo, "line: one", "c1");
    const newest = commitLine(repo, "line: two", "c2");

    expect(await git.hasNetDiff(repo, "base")).toBe(true);

    const result = await git.revertCommits(repo, [oldest, newest], revertCommitMessage(2));
    expect(result).toMatchObject({ ok: true });

    expect(await git.hasNetDiff(repo, "base")).toBe(false);
  });

  it("spawns git with argument arrays so refs with shell metacharacters resolve", async () => {
    const repo = makeRepo();
    const git = createGit();
    commitLine(repo, "line: one", "c1");
    gitSync(repo, "branch", "b$HOME;x", "base");

    expect(await git.hasNetDiff(repo, "b$HOME;x")).toBe(true);
  });

  it("creates a worktree at the base when the path is missing", async () => {
    const repo = makeRepo();
    const git = createGit();
    const baseSha = gitSync(repo, "rev-parse", "base").trim();
    commitLine(repo, "line: one", "c1");
    const worktree = join(root, "wt");

    await git.prepareWorktree(repo, worktree, "base", "fix/design-review-20260101-0101");

    expect(gitSync(worktree, "rev-parse", "HEAD").trim()).toBe(baseSha);
    expect(gitSync(worktree, "rev-parse", "--abbrev-ref", "HEAD").trim()).toBe(
      "fix/design-review-20260101-0101",
    );
    expect(await git.isClean(worktree)).toBe(true);
  });

  it("reuses a clean existing worktree by attaching a new branch at the base", async () => {
    const repo = makeRepo();
    const git = createGit();
    const baseSha = gitSync(repo, "rev-parse", "base").trim();
    const worktree = join(root, "wt");
    await git.prepareWorktree(repo, worktree, "base", "fix/design-review-20260101-0101");

    await git.prepareWorktree(repo, worktree, "base", "fix/design-review-20260101-0202");

    expect(gitSync(worktree, "rev-parse", "HEAD").trim()).toBe(baseSha);
    expect(gitSync(worktree, "rev-parse", "--abbrev-ref", "HEAD").trim()).toBe(
      "fix/design-review-20260101-0202",
    );
  });

  it("refuses to reuse a dirty existing worktree", async () => {
    const repo = makeRepo();
    const git = createGit();
    const worktree = join(root, "wt");
    await git.prepareWorktree(repo, worktree, "base", "fix/design-review-20260101-0101");
    writeFileSync(join(worktree, "file.txt"), "line: wip\n");

    await expect(
      git.prepareWorktree(repo, worktree, "base", "fix/design-review-20260101-0202"),
    ).rejects.toThrow(/dirty/i);

    expect(gitSync(worktree, "rev-parse", "--abbrev-ref", "HEAD").trim()).toBe(
      "fix/design-review-20260101-0101",
    );
    expect(readFileSync(join(worktree, "file.txt"), "utf8")).toBe("line: wip\n");
  });

  it("resolves the common git dir from inside a worktree", async () => {
    const repo = makeRepo();
    const git = createGit();
    const worktree = join(root, "wt");
    await git.prepareWorktree(repo, worktree, "base", "fix/design-review-20260101-0101");

    expect(realpathSync(await git.commonDir(worktree))).toBe(realpathSync(join(repo, ".git")));
    expect(realpathSync(await git.commonDir(repo))).toBe(realpathSync(join(repo, ".git")));
  });

  it("compares the base branch with its remote counterpart after fetching", async () => {
    const repo = makeRepo();
    const git = createGit();
    const origin = join(root, "origin.git");
    gitSync(root, "init", "-q", "--bare", "origin.git");
    gitSync(origin, "fetch", "-q", repo, "base:base");
    gitSync(repo, "remote", "add", "origin", origin);

    expect(await git.isBasePushed(repo, "base")).toBe(true);

    commitLine(repo, "line: one", "c1");
    gitSync(repo, "branch", "-f", "base", "HEAD");

    expect(await git.isBasePushed(repo, "base")).toBe(false);
  });

  it("reports an unpushed base when fetching fails", async () => {
    const repo = makeRepo();
    const git = createGit();

    expect(await git.isBasePushed(repo, "base")).toBe(false);
  });
});

describe("createGit command wiring", () => {
  it("passes argument arrays to the runner and maps exit codes and output", async () => {
    const calls: Array<{ args: string[]; cwd: string }> = [];
    let statusOut = "";
    let diffCode = 1;
    let localBase = "aaaaaa";
    let remoteBase = "aaaaaa";
    const git = createGit(async (args, cwd) => {
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

    expect(await git.isClean("/repo")).toBe(true);
    expect(calls[0]).toEqual({ args: ["status", "--porcelain"], cwd: "/repo" });

    statusOut = "M  file.txt\n";
    expect(await git.isClean("/repo")).toBe(false);

    expect(await git.hasNetDiff("/repo", "base")).toBe(true);
    expect(calls[calls.length - 1]).toEqual({
      args: ["diff", "--quiet", "base...HEAD"],
      cwd: "/repo",
    });

    diffCode = 0;
    expect(await git.hasNetDiff("/repo", "base")).toBe(false);

    expect(await git.isBasePushed("/repo", "base")).toBe(true);
    expect(calls.slice(-3)).toEqual([
      { args: ["fetch", "origin", "base"], cwd: "/repo" },
      { args: ["rev-parse", "base"], cwd: "/repo" },
      { args: ["rev-parse", "origin/base"], cwd: "/repo" },
    ]);

    remoteBase = "bbbbbb";
    expect(await git.isBasePushed("/repo", "base")).toBe(false);
  });
});
