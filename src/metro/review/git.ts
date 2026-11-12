import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

export const REVIEW_BRANCH_PREFIX = "fix/design-review-";

export type GitRunResult = {
  code: number;
  stdout: string;
  stderr: string;
};

export type GitRunner = (args: string[], cwd: string) => Promise<GitRunResult>;

const pad2 = (value: number): string => {
  return String(value).padStart(2, "0");
};

export const reviewBranchName = (now: Date): string => {
  const stamp = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}-${pad2(
    now.getHours(),
  )}${pad2(now.getMinutes())}`;
  return `${REVIEW_BRANCH_PREFIX}${stamp}`;
};

export const revertCommitMessage = (no: number): string => {
  return `fix(design-review): #${no} 撤销走查修改`;
};

const defaultRunner: GitRunner = (args, cwd) => {
  return new Promise((resolveRun, reject) => {
    const child = spawn("git", args, { cwd });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolveRun({ code: code ?? -1, stdout, stderr });
    });
  });
};

export const createGit = (run: GitRunner = defaultRunner) => {
  const fail = (args: string[], cwd: string, result: GitRunResult): Error => {
    const output = result.stderr.trim() || result.stdout.trim();
    return new Error(`git ${args.join(" ")} failed in ${cwd}: ${output}`);
  };

  const isClean = async (cwd: string): Promise<boolean> => {
    const result = await run(["status", "--porcelain"], cwd);
    return result.code === 0 && result.stdout.trim() === "";
  };

  const isBasePushed = async (repo: string, base: string): Promise<boolean> => {
    const fetched = await run(["fetch", "origin", base], repo);
    if (fetched.code !== 0) {
      return false;
    }
    const local = await run(["rev-parse", base], repo);
    if (local.code !== 0) {
      return false;
    }
    const remote = await run(["rev-parse", `origin/${base}`], repo);
    if (remote.code !== 0) {
      return false;
    }
    return local.stdout.trim() === remote.stdout.trim();
  };

  const prepareWorktree = async (
    repo: string,
    path: string,
    base: string,
    branch: string,
  ): Promise<void> => {
    if (!existsSync(path)) {
      const addArgs = ["worktree", "add", "--detach", path, base];
      const added = await run(addArgs, repo);
      if (added.code !== 0) {
        throw fail(addArgs, repo, added);
      }
    } else {
      if (!(await isClean(path))) {
        throw new Error(`Refusing to reuse dirty worktree: ${path}`);
      }
      const detachArgs = ["checkout", "--detach", base];
      const detached = await run(detachArgs, path);
      if (detached.code !== 0) {
        throw fail(detachArgs, path, detached);
      }
    }
    const branchArgs = ["checkout", "-b", branch];
    const branched = await run(branchArgs, path);
    if (branched.code !== 0) {
      throw fail(branchArgs, path, branched);
    }
  };

  const commonDir = async (cwd: string): Promise<string> => {
    const args = ["rev-parse", "--git-common-dir"];
    const result = await run(args, cwd);
    if (result.code !== 0) {
      throw fail(args, cwd, result);
    }
    const dir = result.stdout.trim();
    return isAbsolute(dir) ? dir : resolve(cwd, dir);
  };

  const isAncestor = async (
    candidate: string,
    descendant: string,
    cwd: string,
  ): Promise<boolean> => {
    const args = ["merge-base", "--is-ancestor", candidate, descendant];
    const result = await run(args, cwd);
    return result.code === 0;
  };

  const orderNewestFirst = async (shas: string[], cwd: string): Promise<string[]> => {
    const remaining = [...shas];
    const ordered: string[] = [];
    while (remaining.length > 0) {
      let newest = 0;
      for (let i = 1; i < remaining.length; i++) {
        if (await isAncestor(remaining[newest], remaining[i], cwd)) {
          newest = i;
        }
      }
      ordered.push(remaining[newest]);
      remaining.splice(newest, 1);
    }
    return ordered;
  };

  const verifyItemCommits = async (
    cwd: string,
    base: string,
    shas: string[],
    claimedByOthers: Set<string>,
  ): Promise<
    | { ok: true; shas: string[] }
    | {
        ok: false;
        reason: "missing" | "not_on_branch" | "in_base" | "claimed_by_other";
        sha: string;
      }
  > => {
    const full: string[] = [];
    for (const sha of shas) {
      const resolved = await run(["rev-parse", "--verify", `${sha}^{commit}`], cwd);
      if (resolved.code !== 0) {
        return { ok: false, reason: "missing", sha };
      }
      full.push(resolved.stdout.trim());
    }
    for (const sha of full) {
      if (!(await isAncestor(sha, "HEAD", cwd))) {
        return { ok: false, reason: "not_on_branch", sha };
      }
      if (await isAncestor(sha, base, cwd)) {
        return { ok: false, reason: "in_base", sha };
      }
      if (claimedByOthers.has(sha)) {
        return { ok: false, reason: "claimed_by_other", sha };
      }
    }
    return { ok: true, shas: full };
  };

  const revertCommits = async (
    cwd: string,
    shas: string[],
    message: string,
  ): Promise<{ ok: true; commit: string | null } | { ok: false; reason: "dirty" | "conflict" }> => {
    if (!(await isClean(cwd))) {
      return { ok: false, reason: "dirty" };
    }
    if (shas.length === 0) {
      return { ok: true, commit: null };
    }
    const ordered = await orderNewestFirst(shas, cwd);
    const revertArgs = ["revert", "--no-commit", ...ordered];
    const reverted = await run(revertArgs, cwd);
    if (reverted.code !== 0) {
      const abortArgs = ["revert", "--abort"];
      const aborted = await run(abortArgs, cwd);
      if (aborted.code !== 0) {
        throw fail(abortArgs, cwd, aborted);
      }
      return { ok: false, reason: "conflict" };
    }
    const commitArgs = ["commit", "-m", message];
    const committed = await run(commitArgs, cwd);
    if (committed.code !== 0) {
      if (await isClean(cwd)) {
        const quitArgs = ["revert", "--quit"];
        const quit = await run(quitArgs, cwd);
        if (quit.code !== 0) {
          throw fail(quitArgs, cwd, quit);
        }
        return { ok: true, commit: null };
      }
      throw fail(commitArgs, cwd, committed);
    }
    const headArgs = ["rev-parse", "HEAD"];
    const head = await run(headArgs, cwd);
    if (head.code !== 0) {
      throw fail(headArgs, cwd, head);
    }
    return { ok: true, commit: head.stdout.trim() };
  };

  const hasNetDiff = async (cwd: string, base: string): Promise<boolean> => {
    const args = ["diff", "--quiet", `${base}...HEAD`];
    const result = await run(args, cwd);
    if (result.code === 0) {
      return false;
    }
    if (result.code === 1) {
      return true;
    }
    throw fail(args, cwd, result);
  };

  const saveLeftovers = async (cwd: string, patchFile: string): Promise<boolean> => {
    if (await isClean(cwd)) {
      return false;
    }
    const addArgs = ["add", "-A"];
    const added = await run(addArgs, cwd);
    if (added.code !== 0) {
      throw fail(addArgs, cwd, added);
    }
    const diffArgs = ["diff", "--cached", "--binary"];
    const diff = await run(diffArgs, cwd);
    if (diff.code !== 0) {
      throw fail(diffArgs, cwd, diff);
    }
    mkdirSync(dirname(patchFile), { recursive: true });
    writeFileSync(patchFile, diff.stdout, "utf8");
    const resetArgs = ["reset", "--hard"];
    const reset = await run(resetArgs, cwd);
    if (reset.code !== 0) {
      throw fail(resetArgs, cwd, reset);
    }
    return true;
  };

  return {
    isClean,
    isBasePushed,
    prepareWorktree,
    commonDir,
    verifyItemCommits,
    revertCommits,
    hasNetDiff,
    saveLeftovers,
  };
};

export type Git = ReturnType<typeof createGit>;
