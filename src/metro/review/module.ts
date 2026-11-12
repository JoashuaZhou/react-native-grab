import { appendFileSync } from "node:fs";
import { join } from "node:path";
import { releaseFixing } from "../../review-core/transitions";
import { codemakerArgs, parseSessionId, spawnCodemaker } from "./codemaker";
import { createGit } from "./git";
import { createReviewHandler } from "./http";
import { AgentRunner, RESTART_RELEASE_MESSAGE, createAgentLock } from "./runner";
import { ReviewStore } from "./store";

const pad2 = (value: number): string => {
  return String(value).padStart(2, "0");
};

const localStamp = (now: Date): string => {
  return `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}-${pad2(
    now.getHours(),
  )}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`;
};

export const createReviewModule = (
  dir: string,
): {
  handler: ReturnType<typeof createReviewHandler>;
  runner: AgentRunner;
} => {
  const store = ReviewStore.load(dir);
  const lock = createAgentLock(store.lockPath());
  const logFile = store.agentLogPath();
  const log = (line: string): void => {
    try {
      appendFileSync(logFile, `${line}\n`, "utf8");
    } catch {
      return;
    }
  };
  const git = createGit();

  const run = async (message: string): Promise<{ exitCode: number }> => {
    const review = store.get();
    const patchFile = join(dir, "leftovers", `${localStamp(new Date())}.patch`);
    if (await git.saveLeftovers(review.worktree, patchFile)) {
      log(`中间层已另存遗留改动：${patchFile}`);
    }
    const args =
      review.sessionId === null
        ? codemakerArgs({ worktree: review.worktree, message, title: `设计走查 ${review.id}` })
        : codemakerArgs({ worktree: review.worktree, message, sessionId: review.sessionId });
    const result = await spawnCodemaker(review.codemakerBin, args, logFile, (pid) => {
      lock.write(pid);
    });
    const sessionId = parseSessionId(result.stdout);
    if (sessionId !== null && store.get().sessionId === null) {
      store.update((current) => ({ ...current, sessionId }));
    }
    return { exitCode: result.exitCode };
  };

  const runner = new AgentRunner({ store, git: { hasNetDiff: git.hasNetDiff }, run, lock, log });

  if (lock.livePid() === null) {
    store.update((review) => releaseFixing(review, RESTART_RELEASE_MESSAGE));
  }
  runner.kick();

  const handler = createReviewHandler({ store, git, runner, now: () => new Date() });
  return { handler, runner };
};
