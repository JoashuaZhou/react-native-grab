import { appendFileSync } from "node:fs";
import { releaseFixing } from "../../review-core/transitions";
import { codemakerArgs, parseSessionId, spawnCodemaker } from "./codemaker";
import { createGit } from "./git";
import { createReviewHandler } from "./http";
import { AgentRunner, RESTART_RELEASE_MESSAGE, createAgentLock } from "./runner";
import { ReviewStore } from "./store";

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
