import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LATER,
  NOW,
  awaiting,
  fixing as fixingReview,
  makeItemInput,
  makeReview,
  passed,
  queued as queuedReview,
} from "../../../review-core/__tests__/fixtures";
import {
  ReviewError,
  abandonReview,
  beginFinish,
  claimItem,
  completeReview,
  createItem,
  markReverted,
  replyItem,
  submitDrafts,
} from "../../../review-core/transitions";
import type { Review } from "../../../review-core/types";
import { withReactNativeGrab } from "../../withReactNativeGrab";
import { REVIEW_CODE_HEADER, REVIEW_ROUTE_PREFIX } from "../http";
import { createReviewModule } from "../module";
import { AgentRunner, buildAgentMessage, createAgentLock, nextWork } from "../runner";
import { ReviewStore } from "../store";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "rn-grab-runner-"));
});

afterEach(() => {
  delete process.env.RN_GRAB_REVIEW_DIR;
  rmSync(root, { recursive: true, force: true });
});

type RunFn = (message: string) => Promise<{ exitCode: number }>;
type RunnerOptions = { livePid?: () => number | null; hasNetDiff?: () => Promise<boolean> };

const setupRunner = (
  review: Review,
  makeRun: (context: { store: ReviewStore; runner: () => AgentRunner }) => RunFn,
  options?: RunnerOptions,
) => {
  const store = ReviewStore.create(mkdtempSync(join(root, "review-")), review);
  let runner: AgentRunner | undefined;
  const run = makeRun({ store, runner: () => runner as AgentRunner });
  const created = new AgentRunner({
    store,
    git: { hasNetDiff: options?.hasNetDiff ?? (async (): Promise<boolean> => false) },
    run,
    lock: {
      write: vi.fn(),
      clear: vi.fn(),
      livePid: options?.livePid ?? ((): number | null => null),
    },
    log: vi.fn(),
  });
  runner = created;
  return { store, runner: created };
};

const fixItems = (store: ReviewStore, ...nos: number[]): void => {
  for (const no of nos) {
    store.update((review) => replyItem(claimItem(review, no), no, "已修复", [`sha${no}`], LATER));
  }
};

const submitNewItem = (store: ReviewStore): number => {
  const created = store.update((review) => createItem(review, { ...makeItemInput() }, NOW).review);
  store.update((review) => submitDrafts(review, LATER).review);
  return created.items[created.items.length - 1].no;
};

const expectRunnerBusy = async (promise: Promise<unknown>): Promise<void> => {
  const error = await promise.then(
    () => {
      throw new Error("expected the call to reject with runner_busy");
    },
    (rejection: unknown) => rejection,
  );
  expect(error).toBeInstanceOf(ReviewError);
  expect((error as ReviewError).code).toBe("runner_busy");
};

const readStoredReview = (dir: string): Review =>
  JSON.parse(readFileSync(join(dir, "review.json"), "utf8")) as Review;

describe("nextWork", () => {
  it("collects queued and fixing items as fix work with the reverted numbers", () => {
    const first = submitDrafts(
      createItem(makeReview(), { ...makeItemInput() }, NOW).review,
      LATER,
    ).review;
    const second = submitDrafts(
      createItem(first, { ...makeItemInput() }, NOW).review,
      LATER,
    ).review;
    const review = { ...claimItem(second, 1), revertedSinceLastRun: [4] };

    expect(nextWork(review)).toEqual({ kind: "fix", items: [1, 2], reverted: [4] });
  });

  it("returns null for an active review without queued or fixing items", () => {
    expect(nextWork(makeReview())).toBeNull();
    expect(nextWork(awaiting())).toBeNull();
    expect(nextWork(passed())).toBeNull();
  });

  it("returns finish work while finishing and null once the review is closed", () => {
    expect(nextWork(beginFinish(passed()))).toEqual({ kind: "finish" });
    expect(nextWork(completeReview(beginFinish(passed()), null))).toBeNull();
    expect(nextWork(abandonReview(makeReview()))).toBeNull();
  });
});

describe("buildAgentMessage", () => {
  it("lists fix items, reverted items with 不要恢复 and the design-review skill", () => {
    const message = buildAgentMessage({ kind: "fix", items: [1, 2], reverted: [3] }, makeReview());

    expect(message).toContain("#1");
    expect(message).toContain("#2");
    expect(message).toContain("#3");
    expect(message).toContain("不要恢复");
    expect(message).toContain("design-review skill");
  });

  it("names the branch, the base and the complete command for finish work", () => {
    const review = makeReview();
    const message = buildAgentMessage({ kind: "finish" }, review);

    expect(message).toContain(review.branch);
    expect(message).toContain(review.base);
    expect(message).toContain("npx rn-grab-review complete --mr");
  });
});

describe("createAgentLock", () => {
  it("round-trips a live pid and clears the lock", () => {
    const lock = createAgentLock(join(root, "agent.lock"));

    expect(lock.livePid()).toBeNull();
    lock.write(process.pid);
    expect(lock.livePid()).toBe(process.pid);
    lock.clear();
    expect(lock.livePid()).toBeNull();
    expect(existsSync(join(root, "agent.lock"))).toBe(false);
  });

  it("treats junk and dead pids as absent", async () => {
    const lockFile = join(root, "agent.lock");
    const lock = createAgentLock(lockFile);

    writeFileSync(lockFile, "junk", "utf8");
    expect(lock.livePid()).toBeNull();

    const child = spawn(process.execPath, ["-e", "process.exit(0)"]);
    const pid = child.pid as number;
    await new Promise<void>((resolve) => {
      child.on("exit", () => resolve());
    });
    lock.write(pid);
    expect(lock.livePid()).toBeNull();
  });
});

describe("AgentRunner", () => {
  it("spawns exactly one follow-up run for a submit during a run", async () => {
    const messages: string[] = [];
    const { store, runner } = setupRunner(
      queuedReview(),
      ({ store, runner }) =>
        async (message) => {
          messages.push(message);
          if (messages.length === 1) {
            fixItems(store, 1);
            submitNewItem(store);
            runner().kick();
            await new Promise((resolve) => setTimeout(resolve, 10));
            expect(messages).toHaveLength(1);
          } else {
            fixItems(store, 2);
          }
          return { exitCode: 0 };
        },
    );

    runner.kick();
    await runner.whenIdle();

    expect(messages).toHaveLength(2);
    expect(messages[0]).toContain("#1");
    expect(messages[1]).toContain("#2");
    expect(messages[1]).not.toContain("#1");
    expect(store.get().items.map((item) => item.status)).toEqual([
      "awaiting_review",
      "awaiting_review",
    ]);
  });

  it("returns unreplied items to queued with lastError and blocks after two runs", async () => {
    const messages: string[] = [];
    const { store, runner } = setupRunner(queuedReview(), ({ store }) => async (message) => {
      messages.push(message);
      if (messages.length <= 2) {
        store.update((review) => claimItem(review, 1));
      } else {
        fixItems(store, 1);
      }
      return { exitCode: 0 };
    });

    runner.kick();
    await runner.whenIdle();

    expect(messages).toHaveLength(2);
    expect(runner.blocked).toBe(true);
    expect(store.get().items[0].status).toBe("queued");
    expect(store.get().items[0].lastError).toBe("agent 运行结束时该条仍在修复中");

    runner.unblock();
    await runner.whenIdle();

    expect(messages).toHaveLength(3);
    expect(runner.blocked).toBe(false);
  });

  it("waits for a live orphan pid before spawning and reports busy", async () => {
    vi.useFakeTimers();
    try {
      let livePid: number | null = 4242;
      const messages: string[] = [];
      const { store, runner } = setupRunner(
        queuedReview(),
        ({ store }) =>
          async (message) => {
            messages.push(message);
            fixItems(store, 1);
            return { exitCode: 0 };
          },
        { livePid: () => livePid },
      );

      runner.kick();
      expect(messages).toHaveLength(0);
      expect(runner.busy).toBe(true);

      const exclusive = vi.fn(async () => "ran");
      await expectRunnerBusy(runner.runExclusive(exclusive));
      expect(exclusive).not.toHaveBeenCalled();

      livePid = null;
      await vi.advanceTimersByTimeAsync(5000);
      await runner.whenIdle();

      expect(messages).toHaveLength(1);
      expect(runner.busy).toBe(false);
      expect(store.get().items[0].status).toBe("awaiting_review");
    } finally {
      vi.useRealTimers();
    }
  });

  it("completes a finishing review without net diff and without spawning", async () => {
    const messages: string[] = [];
    const { store, runner } = setupRunner(
      beginFinish(passed()),
      () => async (message) => {
        messages.push(message);
        return { exitCode: 0 };
      },
      { hasNetDiff: async () => false },
    );

    runner.kick();
    await runner.whenIdle();

    expect(messages).toHaveLength(0);
    expect(store.get().status).toBe("done");
    expect(store.get().mrUrl).toBeNull();
    expect(runner.busy).toBe(false);
  });

  it("spawns a finish run when there is a net diff", async () => {
    const messages: string[] = [];
    const { store, runner } = setupRunner(
      beginFinish(passed()),
      ({ store }) =>
        async (message) => {
          messages.push(message);
          store.update((review) => completeReview(review, "https://gitlab/mr/9"));
          return { exitCode: 0 };
        },
      { hasNetDiff: async () => true },
    );

    runner.kick();
    await runner.whenIdle();

    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain("npx rn-grab-review complete --mr");
    expect(store.get().status).toBe("done");
    expect(store.get().mrUrl).toBe("https://gitlab/mr/9");
  });

  it("rejects runExclusive during an agent run without executing the callback", async () => {
    const messages: string[] = [];
    const { runner } = setupRunner(queuedReview(), ({ store, runner }) => async (message) => {
      messages.push(message);
      const exclusive = vi.fn(async () => "ran");
      await expectRunnerBusy(runner().runExclusive(exclusive));
      expect(exclusive).not.toHaveBeenCalled();
      fixItems(store, 1);
      return { exitCode: 0 };
    });

    runner.kick();
    await runner.whenIdle();

    expect(messages).toHaveLength(1);
  });

  it("defers spawns during an exclusive section and announces reverted items", async () => {
    const messages: string[] = [];
    const { store, runner } = setupRunner(
      markReverted(awaiting(), 1, null),
      ({ store }) =>
        async (message) => {
          messages.push(message);
          fixItems(store, 2);
          return { exitCode: 0 };
        },
    );

    let release: (() => void) | undefined;
    const exclusive = runner.runExclusive(async () => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return "ok";
    });

    expect(runner.busy).toBe(true);
    submitNewItem(store);
    runner.kick();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(messages).toHaveLength(0);

    release!();
    await expect(exclusive).resolves.toBe("ok");
    await runner.whenIdle();

    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain("#2");
    expect(messages[0]).toContain("#1");
    expect(messages[0]).toContain("不要恢复");
    expect(store.get().revertedSinceLastRun).toEqual([]);
  });

  it("rejects nested exclusive sections without executing the inner callback", async () => {
    const { runner } = setupRunner(makeReview(), () => async () => ({ exitCode: 0 }));

    const inner = vi.fn(async () => "inner");
    const result = await runner.runExclusive(async () => {
      await expectRunnerBusy(runner.runExclusive(inner));
      expect(inner).not.toHaveBeenCalled();
      return 42;
    });

    expect(result).toBe(42);
    await runner.whenIdle();
  });

  it("releases after a throwing exclusive callback and keeps spawning on later kicks", async () => {
    const messages: string[] = [];
    const { store, runner } = setupRunner(queuedReview(), ({ store }) => async (message) => {
      messages.push(message);
      const open = store
        .get()
        .items.filter((item) => item.status === "queued" || item.status === "fixing")
        .map((item) => item.no);
      fixItems(store, ...open);
      return { exitCode: 0 };
    });

    const exclusive = runner.runExclusive(async () => {
      throw new Error("boom");
    });
    await expect(exclusive).rejects.toThrow("boom");
    await runner.whenIdle();

    expect(messages).toHaveLength(1);

    submitNewItem(store);
    runner.kick();
    await runner.whenIdle();

    expect(messages).toHaveLength(2);
    expect(runner.busy).toBe(false);
  });

  it("stops spawning after stop() even with pending work", async () => {
    const messages: string[] = [];
    let releaseRun: (() => void) | undefined;
    const { store, runner } = setupRunner(queuedReview(), ({ store }) => async (message) => {
      messages.push(message);
      fixItems(store, 1);
      await new Promise<void>((resolve) => {
        releaseRun = resolve;
      });
      return { exitCode: 0 };
    });

    runner.kick();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(messages).toHaveLength(1);

    runner.stop();
    submitNewItem(store);
    runner.kick();
    releaseRun!();
    await runner.whenIdle();

    expect(messages).toHaveLength(1);
  });
});

describe("createReviewModule", () => {
  it("releases fixing items on load when no live pid holds the lock and kicks", async () => {
    const dir = mkdtempSync(join(root, "module-"));
    ReviewStore.create(dir, { ...fixingReview(), codemakerBin: process.execPath });

    const reviewModule = createReviewModule(dir);
    await reviewModule.runner.whenIdle();

    expect(reviewModule.runner.blocked).toBe(true);
    const stored = readStoredReview(dir);
    expect(stored.items[0].status).toBe("queued");
    expect(stored.items[0].lastError).toBe("Metro 重启时该条仍在修复中");
    expect(readFileSync(join(dir, "agent.log"), "utf8").length).toBeGreaterThan(0);
    expect(existsSync(join(dir, "agent.lock"))).toBe(false);
  });

  it("keeps fixing items and waits while a live pid holds the lock", async () => {
    vi.useFakeTimers();
    try {
      const dir = mkdtempSync(join(root, "module-"));
      ReviewStore.create(dir, { ...fixingReview(), codemakerBin: process.execPath });
      writeFileSync(join(dir, "agent.lock"), String(process.pid), "utf8");

      const reviewModule = createReviewModule(dir);

      expect(reviewModule.runner.busy).toBe(true);
      const stored = readStoredReview(dir);
      expect(stored.items[0].status).toBe("fixing");
      expect(stored.items[0].lastError).toBeNull();

      reviewModule.runner.stop();
      await vi.advanceTimersByTimeAsync(5000);
      await reviewModule.runner.whenIdle();
      expect(reviewModule.runner.busy).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("withReactNativeGrab review routing", () => {
  type FakeMiddleware = (req: unknown, res: unknown, next: () => void) => void;

  const makeMiddleware = (): { call: FakeMiddleware; base: ReturnType<typeof vi.fn> } => {
    const base = vi.fn();
    const transformed = withReactNativeGrab({}) as {
      server?: {
        enhanceMiddleware?: (middleware: FakeMiddleware, metroServer: unknown) => FakeMiddleware;
      };
    };
    const enhance = transformed.server?.enhanceMiddleware;
    expect(enhance).toBeTypeOf("function");
    const wrapped = enhance!(base, {});
    return { call: wrapped, base };
  };

  const makeReq = (url: string, headers: Record<string, string> = {}): IncomingMessage =>
    ({
      url,
      method: "GET",
      headers,
      socket: { remoteAddress: "127.0.0.1" },
    }) as unknown as IncomingMessage;

  const makeRes = (): { res: ServerResponse; status: () => number; body: () => string } => {
    let statusCode = 0;
    let body = "";
    const res = {
      writeHead(code: number) {
        statusCode = code;
      },
      end(data?: string) {
        body = data ?? "";
      },
    } as unknown as ServerResponse;
    return { res, status: () => statusCode, body: () => body };
  };

  it("answers 404 no_active_review for review routes without RN_GRAB_REVIEW_DIR", () => {
    delete process.env.RN_GRAB_REVIEW_DIR;
    const { call } = makeMiddleware();
    const response = makeRes();

    call(
      makeReq(`${REVIEW_ROUTE_PREFIX}state`, { [REVIEW_CODE_HEADER]: "012345" }),
      response.res,
      () => {},
    );

    expect(response.status()).toBe(404);
    expect(JSON.parse(response.body())).toEqual({ ok: false, error: "no_active_review" });
  });

  it("routes review requests to the module created from RN_GRAB_REVIEW_DIR", () => {
    const dir = mkdtempSync(join(root, "routed-"));
    ReviewStore.create(dir, { ...passed(), codemakerBin: process.execPath });
    process.env.RN_GRAB_REVIEW_DIR = dir;
    const { call, base } = makeMiddleware();
    const response = makeRes();

    call(
      makeReq(`${REVIEW_ROUTE_PREFIX}state`, { [REVIEW_CODE_HEADER]: "012345" }),
      response.res,
      () => {},
    );

    expect(response.status()).toBe(200);
    const payload = JSON.parse(response.body()) as Record<string, unknown>;
    expect(payload.ok).toBe(true);
    expect(payload.runner).toEqual({ busy: false, blocked: false });
    expect(base).not.toHaveBeenCalled();
  });

  it("answers 500 internal when the review dir cannot be loaded", () => {
    process.env.RN_GRAB_REVIEW_DIR = join(root, "missing-");
    const { call } = makeMiddleware();
    const response = makeRes();

    call(makeReq(`${REVIEW_ROUTE_PREFIX}state`), response.res, () => {});

    expect(response.status()).toBe(500);
    expect(JSON.parse(response.body())).toEqual({ ok: false, error: "internal" });
  });

  it("passes non-review routes through to the base middleware", () => {
    const { call, base } = makeMiddleware();
    const response = makeRes();
    const next = vi.fn();

    call(makeReq("/some/metro/route"), response.res, next);

    expect(base).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();
  });
});
