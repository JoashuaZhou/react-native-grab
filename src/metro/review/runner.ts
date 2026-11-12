import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { ReviewError, completeReview, releaseFixing } from "../../review-core/transitions";
import type { Review } from "../../review-core/types";
import type { RunnerControl } from "./http";
import type { ReviewStore } from "./store";

export const RUN_END_RELEASE_MESSAGE = "agent 运行结束时该条仍在修复中";
export const RESTART_RELEASE_MESSAGE = "Metro 重启时该条仍在修复中";

const NO_PROGRESS_LIMIT = 2;

const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

const formatNumbers = (nos: number[]): string => {
  return nos.map((no) => `#${no}`).join("、");
};

export type AgentWork = { kind: "fix"; items: number[]; reverted: number[] } | { kind: "finish" };

export const nextWork = (review: Review): AgentWork | null => {
  if (review.status === "active") {
    const items = review.items
      .filter((item) => item.status === "queued" || item.status === "fixing")
      .map((item) => item.no);
    if (items.length === 0) {
      return null;
    }
    return { kind: "fix", items, reverted: review.revertedSinceLastRun };
  }
  if (review.status === "finishing") {
    return { kind: "finish" };
  }
  return null;
};

export const buildAgentMessage = (work: AgentWork, review: Review): string => {
  if (work.kind === "fix") {
    const lines = [`请使用 design-review skill 处理走查条目：${formatNumbers(work.items)}。`];
    if (work.reverted.length > 0) {
      lines.push(`设计师已撤销 ${formatNumbers(work.reverted)}，不要恢复这些条目的改动。`);
    }
    return lines.join("\n");
  }
  return [
    "所有走查条目均已处理，请收尾。",
    `当前分支：${review.branch}，基准分支：${review.base}。`,
    "请推送分支并创建 MR，然后运行 npx rn-grab-review complete --mr <MR链接> 提交完成。",
  ].join("\n");
};

export type AgentLock = {
  write(pid: number): void;
  clear(): void;
  livePid(): number | null;
};

const isPidAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
};

export const createAgentLock = (lockFile: string): AgentLock => ({
  write(pid: number): void {
    writeFileSync(lockFile, String(pid), "utf8");
  },
  clear(): void {
    rmSync(lockFile, { force: true });
  },
  livePid(): number | null {
    let text: string;
    try {
      text = readFileSync(lockFile, "utf8");
    } catch {
      return null;
    }
    const pid = Number.parseInt(text.trim(), 10);
    if (!Number.isInteger(pid) || pid <= 0) {
      return null;
    }
    return isPidAlive(pid) ? pid : null;
  },
});

export type AgentRunnerDeps = {
  store: Pick<ReviewStore, "get" | "update">;
  git: { hasNetDiff(cwd: string, base: string): Promise<boolean> };
  run: (message: string) => Promise<{ exitCode: number }>;
  lock: AgentLock;
  log: (line: string) => void;
  orphanPollMs?: number;
};

const repliedRoundCount = (review: Review, no: number): number => {
  const item = review.items.find((candidate) => candidate.no === no);
  if (item === undefined) return 0;
  return item.rounds.filter((round) => round.reply !== null).length;
};

export class AgentRunner implements RunnerControl {
  private readonly store: AgentRunnerDeps["store"];
  private readonly git: AgentRunnerDeps["git"];
  private readonly run: AgentRunnerDeps["run"];
  private readonly lock: AgentLock;
  private readonly log: (line: string) => void;
  private readonly orphanPollMs: number;

  private running = false;
  private waitingOrphan = false;
  private exclusive = false;
  private stopped = false;
  private blockedState = false;
  private noProgressStreak = 0;
  private pendingKick = false;
  private draining = false;
  private idleWaiters: Array<() => void> = [];

  constructor(deps: AgentRunnerDeps) {
    this.store = deps.store;
    this.git = deps.git;
    this.run = deps.run;
    this.lock = deps.lock;
    this.log = deps.log;
    this.orphanPollMs = deps.orphanPollMs ?? 5000;
  }

  get busy(): boolean {
    return this.running || this.waitingOrphan || this.exclusive;
  }

  get blocked(): boolean {
    return this.blockedState;
  }

  kick(): void {
    this.pendingKick = true;
    void this.drain();
  }

  unblock(): void {
    this.blockedState = false;
    this.noProgressStreak = 0;
    this.kick();
  }

  stop(): void {
    this.stopped = true;
    this.pendingKick = false;
    this.notifyIdle();
  }

  async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    if (this.busy) {
      throw new ReviewError("runner_busy", "走查执行器忙");
    }
    this.exclusive = true;
    try {
      return await fn();
    } finally {
      this.exclusive = false;
      this.kick();
    }
  }

  async whenIdle(): Promise<void> {
    while (this.busy || this.draining || this.pendingKick) {
      await new Promise<void>((resolve) => {
        this.idleWaiters.push(resolve);
      });
    }
  }

  private notifyIdle(): void {
    const waiters = this.idleWaiters;
    this.idleWaiters = [];
    for (const resolve of waiters) {
      resolve();
    }
  }

  private safeLog(line: string): void {
    try {
      this.log(line);
    } catch {
      return;
    }
  }

  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.pendingKick) {
        this.pendingKick = false;
        await this.tryRun();
        this.notifyIdle();
      }
    } catch (error) {
      this.safeLog(`agent 调度异常：${String(error)}`);
    } finally {
      this.draining = false;
      this.notifyIdle();
    }
  }

  private async tryRun(): Promise<void> {
    if (this.stopped || this.blockedState || this.busy) {
      return;
    }
    if (nextWork(this.store.get()) === null) {
      return;
    }
    this.running = true;
    try {
      let waitedForOrphan = false;
      while (!this.stopped) {
        const live = this.lock.livePid();
        if (live === null) break;
        waitedForOrphan = true;
        this.waitingOrphan = true;
        this.safeLog(`等待上一次 agent 进程 ${live} 退出`);
        await sleep(this.orphanPollMs);
      }
      this.waitingOrphan = false;
      if (this.stopped) {
        return;
      }
      this.lock.clear();
      if (waitedForOrphan) {
        this.store.update((review) => releaseFixing(review, RESTART_RELEASE_MESSAGE));
      }

      const work = nextWork(this.store.get());
      if (work === null) {
        return;
      }

      if (work.kind === "finish") {
        const review = this.store.get();
        const netDiff = await this.git.hasNetDiff(review.worktree, review.base);
        if (this.stopped) {
          return;
        }
        if (!netDiff) {
          if (this.store.get().status === "finishing") {
            this.store.update((current) => completeReview(current, null));
          }
          return;
        }
      }

      const before = this.store.get();
      const announcedItems = work.kind === "fix" ? work.items : [];
      const repliedBefore = announcedItems.map((no) => repliedRoundCount(before, no));
      const message = buildAgentMessage(work, before);
      this.safeLog(
        work.kind === "fix"
          ? `启动 agent 处理条目 ${formatNumbers(work.items)}`
          : "启动 agent 收尾",
      );

      let exitCode: number;
      try {
        const result = await this.run(message);
        exitCode = result.exitCode;
      } catch (error) {
        this.safeLog(`agent 运行异常退出：${String(error)}`);
        exitCode = -1;
      } finally {
        this.lock.clear();
      }

      const after = this.store.get();
      let newlyRepliedCount = 0;
      for (let i = 0; i < announcedItems.length; i++) {
        if (repliedRoundCount(after, announcedItems[i]) > repliedBefore[i]) {
          newlyRepliedCount += 1;
        }
      }
      const progressed = work.kind === "fix" ? newlyRepliedCount > 0 : after.status === "done";
      this.safeLog(`agent 运行结束：exitCode=${exitCode}，新增回复条目=${newlyRepliedCount}`);

      const announcedReverted = work.kind === "fix" ? work.reverted : [];
      this.store.update((review) => {
        const released = releaseFixing(review, RUN_END_RELEASE_MESSAGE);
        const revertedSinceLastRun = progressed
          ? released.revertedSinceLastRun.filter((no) => !announcedReverted.includes(no))
          : released.revertedSinceLastRun;
        return { ...released, revertedSinceLastRun };
      });

      if (progressed) {
        this.noProgressStreak = 0;
        this.kick();
        return;
      }
      this.noProgressStreak += 1;
      if (this.noProgressStreak >= NO_PROGRESS_LIMIT) {
        this.blockedState = true;
        this.safeLog("agent 连续两次运行没有进展，已暂停，等待手动重试");
        return;
      }
      this.kick();
    } finally {
      this.running = false;
      this.notifyIdle();
    }
  }
}
