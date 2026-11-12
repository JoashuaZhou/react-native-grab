import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getReviewPaths,
  writeActive,
  readActive,
  type ReviewPaths,
} from "../../metro/review/paths";
import { createInstallDeps, serveReview, startReview, type StartDeps } from "../start";

const NOW = new Date(2026, 10, 12, 9, 5, 6);
const REVIEW_ID = "20261112-090506";
const BRANCH = "fix/design-review-20261112-0905";

type Call = { name: string; args: unknown[] };

const makeDeps = (
  root: string,
  overrides?: {
    isBasePushed?: boolean;
    portFree?: boolean;
    which?: string | null;
    createSessionError?: Error;
    lanAddress?: string | null;
    startWorktree?: boolean;
  },
): { deps: StartDeps; calls: Call[]; lines: string[] } => {
  const calls: Call[] = [];
  const lines: string[] = [];
  const paths = getReviewPaths(root);
  const record = (name: string) => (args: unknown[]) => {
    calls.push({ name, args });
  };

  const worktreePath = join(paths.worktreesDir, "Example");

  const deps: StartDeps = {
    git: {
      isBasePushed: async (...args: unknown[]) => {
        calls.push({ name: "isBasePushed", args });
        return overrides?.isBasePushed ?? true;
      },
      prepareWorktree: async (...args: unknown[]) => {
        calls.push({ name: "prepareWorktree", args });
        return undefined;
      },
      commonDir: async (...args: unknown[]) => {
        calls.push({ name: "commonDir", args });
        return "/tmp/fake-common";
      },
    },
    paths,
    now: () => NOW,
    portFree: async (...args: unknown[]) => {
      calls.push({ name: "portFree", args });
      return overrides?.portFree ?? true;
    },
    which: (bin: string) => {
      calls.push({ name: "which", args: [bin] });
      return overrides?.which === undefined ? "/usr/bin/codemaker" : overrides.which;
    },
    installDeps: async (...args: unknown[]) => {
      calls.push({ name: "installDeps", args });
      return undefined;
    },
    installAgentFiles: async (...args: unknown[]) => {
      calls.push({ name: "installAgentFiles", args });
      return undefined;
    },
    createSession: async (o: { bin: string; worktree: string; title: string; message: string }) => {
      calls.push({ name: "createSession", args: [o] });
      if (overrides?.createSessionError !== undefined) {
        throw overrides.createSessionError;
      }
      return "sess-1";
    },
    spawnMetro: async (...args: unknown[]) => {
      calls.push({ name: "spawnMetro", args });
      return 4242;
    },
    randomCode: () => "314159",
    lanAddress: () => {
      calls.push({ name: "lanAddress", args: [] });
      return overrides?.lanAddress === undefined ? "192.168.31.4" : overrides.lanAddress;
    },
    log: (line: string) => {
      lines.push(line);
    },
  };

  if (overrides?.startWorktree !== false) {
    const packageDir = join(worktreePath, "node_modules", "react-native-grab");
    mkdirSync(packageDir, { recursive: true });
    writeFileSync(join(packageDir, "package.json"), JSON.stringify({ rnGrabReview: 1 }), "utf8");
  }

  return { deps, calls, lines };
};

describe("startReview", () => {
  let root: string;
  let paths: ReviewPaths;
  const repo = "/Users/dev/Example";

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "rn-grab-start-"));
    paths = getReviewPaths(root);
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("passes preflight and then calls the deps in the listed order, persisting the review", async () => {
    const { deps, calls, lines } = makeDeps(root);
    await startReview({ repo, base: "main" }, deps);

    expect(calls.map((call) => call.name)).toEqual([
      "portFree",
      "which",
      "isBasePushed",
      "prepareWorktree",
      "installDeps",
      "commonDir",
      "installAgentFiles",
      "createSession",
      "lanAddress",
      "spawnMetro",
    ]);

    const worktree = join(paths.worktreesDir, "Example");
    expect(calls.find((call) => call.name === "portFree")?.args).toEqual([8081]);
    expect(calls.find((call) => call.name === "which")?.args).toEqual(["codemaker"]);
    expect(calls.find((call) => call.name === "isBasePushed")?.args).toEqual([repo, "main"]);
    expect(calls.find((call) => call.name === "prepareWorktree")?.args).toEqual([
      repo,
      worktree,
      "main",
      BRANCH,
    ]);
    expect(calls.find((call) => call.name === "installDeps")?.args).toEqual([worktree]);
    expect(calls.find((call) => call.name === "commonDir")?.args).toEqual([worktree]);
    expect(calls.find((call) => call.name === "installAgentFiles")?.args).toEqual([
      worktree,
      "/tmp/fake-common",
    ]);
    expect(calls.find((call) => call.name === "spawnMetro")?.args).toEqual([
      worktree,
      { RN_GRAB_REVIEW_DIR: join(paths.reviewsDir, REVIEW_ID) },
    ]);

    const session = calls.find((call) => call.name === "createSession")?.args[0] as {
      bin: string;
      worktree: string;
      title: string;
      message: string;
    };
    expect(session.bin).toBe("/usr/bin/codemaker");
    expect(session.worktree).toBe(worktree);
    expect(session.title).toBe(`走查 ${BRANCH}`);
    expect(session.message).toContain("design-review");
    expect(session.message).toContain("AGENTS.md");
    expect(session.message).toContain("已就绪");
    expect(session.message).toContain("不要修改");

    const dir = join(paths.reviewsDir, REVIEW_ID);
    const saved = JSON.parse(readFileSync(join(dir, "review.json"), "utf8")) as Record<
      string,
      unknown
    >;
    expect(saved).toMatchObject({
      id: REVIEW_ID,
      repo,
      base: "main",
      branch: BRANCH,
      worktree,
      sessionId: "sess-1",
      codemakerBin: "/usr/bin/codemaker",
      pairingCode: "314159",
      status: "active",
      mrUrl: null,
      nextItemNo: 1,
      items: [],
      revertedSinceLastRun: [],
    });
    expect(readActive(paths)).toEqual({ reviewId: REVIEW_ID, dir });

    const printed = lines.join("\n");
    expect(printed).toContain("314159");
    expect(printed).toContain("192.168.31.4");
    expect(printed).toContain("Wi-Fi");
    expect(lines).toContain(
      "在 App 的 Debug 设置里把 React Native 开发服务器地址设为 192.168.31.4，重启 App",
    );
    expect(printed).toContain(`codemaker ${worktree} --session sess-1`);
  });

  it("omits the LAN line when lanAddress is null but still starts Metro", async () => {
    const { deps, lines, calls } = makeDeps(root, { lanAddress: null });
    await startReview({ repo, base: "main" }, deps);
    expect(lines.join("\n")).not.toContain("局域网");
    expect(lines.join("\n")).not.toContain("重启 App");
    expect(calls.map((call) => call.name)).toContain("spawnMetro");
  });

  it.each([
    {
      label: "active review exists",
      message: "已有进行中的走查：执行 rn-grab-review serve 继续，或 rn-grab-review stop 结束",
      override: { prepare: () => writeActive(paths, { reviewId: "old", dir: "/old" }) },
    },
    {
      label: "port 8081 is busy",
      message: "8081 端口被占用，请先停止当前的 Metro",
      override: { portFree: false },
    },
    {
      label: "codemaker is missing",
      message: "找不到 codemaker 命令",
      override: { which: null },
    },
    {
      label: "base is not pushed",
      message: "base 分支有未推送的提交，请先推送",
      override: { isBasePushed: false },
    },
  ])("prints the pinned message and makes no side effects when $label", async (case_) => {
    case_.override.prepare?.();
    const { deps, calls, lines } = makeDeps(root, case_.override);
    await startReview({ repo, base: "main" }, deps);

    expect(lines).toContain(case_.message);
    expect(calls.map((call) => call.name)).not.toContain("prepareWorktree");
    expect(calls.map((call) => call.name)).not.toContain("installDeps");
    expect(calls.map((call) => call.name)).not.toContain("installAgentFiles");
    expect(calls.map((call) => call.name)).not.toContain("createSession");
    expect(calls.map((call) => call.name)).not.toContain("spawnMetro");
    expect(existsSync(paths.reviewsDir)).toBe(false);
    expect(readActive(paths)).toEqual(
      case_.label === "active review exists" ? { reviewId: "old", dir: "/old" } : null,
    );
  });

  it("fails with the pinned message when the worktree package lacks rnGrabReview 1", async () => {
    const { deps, calls } = makeDeps(root, { startWorktree: false });
    await expect(startReview({ repo, base: "main" }, deps)).rejects.toThrow(
      "base 分支的 react-native-grab 不支持走查，请先合入接入提交",
    );
    expect(calls.map((call) => call.name)).not.toContain("installAgentFiles");
    expect(calls.map((call) => call.name)).not.toContain("createSession");
    expect(calls.map((call) => call.name)).not.toContain("spawnMetro");
    expect(existsSync(paths.reviewsDir)).toBe(false);
  });

  it("removes the review dir and rethrows when createSession fails", async () => {
    const { deps } = makeDeps(root, { createSessionError: new Error("codemaker boom") });
    await expect(startReview({ repo, base: "main" }, deps)).rejects.toThrow("codemaker boom");
    expect(existsSync(join(paths.reviewsDir, REVIEW_ID))).toBe(false);
    expect(existsSync(paths.activeFile)).toBe(false);
  });
});

describe("serveReview", () => {
  let root: string;
  let paths: ReviewPaths;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "rn-grab-serve-"));
    paths = getReviewPaths(root);
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("respawns Metro for the active review", async () => {
    const worktree = join(paths.worktreesDir, "Example");
    mkdirSync(worktree, { recursive: true });
    const dir = join(paths.reviewsDir, "20261112-090506");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "review.json"),
      JSON.stringify({ id: "20261112-090506", worktree, status: "active" }),
      "utf8",
    );
    writeActive(paths, { reviewId: "20261112-090506", dir });

    const calls: Call[] = [];
    const lines: string[] = [];
    await serveReview(paths, {
      spawnMetro: async (...args: unknown[]) => {
        calls.push({ name: "spawnMetro", args });
        return 4242;
      },
      log: (line: string) => {
        lines.push(line);
      },
    });

    expect(calls).toEqual([{ name: "spawnMetro", args: [worktree, { RN_GRAB_REVIEW_DIR: dir }] }]);
    expect(lines.join("\n")).toContain("4242");
  });

  it("reports when there is no active review", async () => {
    const calls: Call[] = [];
    const lines: string[] = [];
    await serveReview(paths, {
      spawnMetro: async (...args: unknown[]) => {
        calls.push({ name: "spawnMetro", args });
        return 4242;
      },
      log: (line: string) => {
        lines.push(line);
      },
    });
    expect(calls).toEqual([]);
    expect(lines.join("\n")).toContain("没有进行中的走查");
  });
});

describe("createInstallDeps", () => {
  let root: string;
  let worktree: string;
  const runs: string[] = [];

  const sha1 = (data: string): string => {
    return createHash("sha1").update(data).digest("hex");
  };

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "rn-grab-install-"));
    worktree = join(root, "worktree");
    mkdirSync(worktree, { recursive: true });
    writeFileSync(join(worktree, "yarn.lock"), "lock v1\n", "utf8");
    runs.length = 0;
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("installs once, records the lock hash and skips the second run", async () => {
    const installDeps = createInstallDeps(async (dir: string) => {
      runs.push(dir);
    });
    await installDeps(worktree);
    await installDeps(worktree);

    expect(runs).toEqual([worktree]);
    const marker = join(worktree, "node_modules", ".rn-grab-review-lock");
    expect(readFileSync(marker, "utf8").trim()).toBe(sha1("lock v1\n"));
  });

  it("skips the install when the marker already matches", async () => {
    const marker = join(worktree, "node_modules", ".rn-grab-review-lock");
    mkdirSync(join(worktree, "node_modules"), { recursive: true });
    writeFileSync(marker, sha1("lock v1\n"), "utf8");
    const installDeps = createInstallDeps(async (dir: string) => {
      runs.push(dir);
    });
    await installDeps(worktree);
    expect(runs).toEqual([]);
  });

  it("reinstalls after the lock file changes", async () => {
    const installDeps = createInstallDeps(async (dir: string) => {
      runs.push(dir);
    });
    await installDeps(worktree);
    writeFileSync(join(worktree, "yarn.lock"), "lock v2\n", "utf8");
    await installDeps(worktree);
    expect(runs).toEqual([worktree, worktree]);
    expect(
      readFileSync(join(worktree, "node_modules", ".rn-grab-review-lock"), "utf8").trim(),
    ).toBe(sha1("lock v2\n"));
  });
});
