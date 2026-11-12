import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { readActive, writeActive, type ReviewPaths } from "../metro/review/paths";
import { reviewBranchName, type Git } from "../metro/review/git";
import { ReviewStore } from "../metro/review/store";
import type { Review } from "../review-core/types";
import { METRO_PORT } from "./local-client";

const pad2 = (value: number): string => {
  return String(value).padStart(2, "0");
};

const localStamp = (now: Date): string => {
  return `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}-${pad2(
    now.getHours(),
  )}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`;
};

const reviewId = (now: Date): string => {
  return localStamp(now);
};

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
  spawnMetro: (worktree: string, env: { RN_GRAB_REVIEW_DIR: string }) => Promise<number>;
  randomCode: () => string;
  lanAddress: () => string | null;
  log: (line: string) => void;
};

export type ServeDeps = {
  spawnMetro: (worktree: string, env: { RN_GRAB_REVIEW_DIR: string }) => Promise<number>;
  log: (line: string) => void;
};

const supportsReview = (worktree: string): void => {
  const file = join(worktree, "node_modules", "react-native-grab", "package.json");
  let supported = false;
  try {
    const pkg = JSON.parse(readFileSync(file, "utf8")) as { rnGrabReview?: unknown };
    supported = pkg.rnGrabReview === 1;
  } catch {
    supported = false;
  }
  if (!supported) {
    throw new Error("base 分支的 react-native-grab 不支持走查，请先合入接入提交");
  }
};

const INTRO_MESSAGE =
  "你被指派接管这次设计走查会话。请先读取 .codemaker/skills/design-review 下的 design-review skill 和仓库根目录的 AGENTS.md，读取完毕后只回复「已就绪」，不要修改任何内容。";

export const startReview = async (
  opts: { repo: string; base: string },
  deps: StartDeps,
): Promise<void> => {
  if (readActive(deps.paths) !== null) {
    deps.log("已有进行中的走查：执行 rn-grab-review serve 继续，或 rn-grab-review stop 结束");
    return;
  }
  if (!(await deps.portFree(METRO_PORT))) {
    deps.log("8081 端口被占用，请先停止当前的 Metro");
    return;
  }
  const codemakerBin = deps.which("codemaker");
  if (codemakerBin === null) {
    deps.log("找不到 codemaker 命令");
    return;
  }
  if (!(await deps.git.isBasePushed(opts.repo, opts.base))) {
    deps.log("base 分支有未推送的提交，请先推送");
    return;
  }

  const now = deps.now();
  const branch = reviewBranchName(now);
  const worktree = join(deps.paths.worktreesDir, basename(opts.repo));
  await deps.git.prepareWorktree(opts.repo, worktree, opts.base, branch);
  await deps.installDeps(worktree);
  supportsReview(worktree);
  const commonDir = await deps.git.commonDir(worktree);
  await deps.installAgentFiles(worktree, commonDir);

  const id = reviewId(now);
  const dir = join(deps.paths.reviewsDir, id);
  const review: Review = {
    id,
    repo: opts.repo,
    base: opts.base,
    branch,
    worktree,
    sessionId: null,
    codemakerBin,
    pairingCode: deps.randomCode(),
    status: "active",
    mrUrl: null,
    nextItemNo: 1,
    items: [],
    revertedSinceLastRun: [],
    createdAt: now.toISOString(),
  };
  const store = ReviewStore.create(dir, review);

  let sessionId: string;
  try {
    sessionId = await deps.createSession({
      bin: codemakerBin,
      worktree,
      title: `走查 ${branch}`,
      message: INTRO_MESSAGE,
    });
    store.update((current) => ({ ...current, sessionId }));
  } catch (error) {
    rmSync(dir, { recursive: true, force: true });
    throw error;
  }

  writeActive(deps.paths, { reviewId: id, dir });

  deps.log(`配对码：${review.pairingCode}`);
  const lan = deps.lanAddress();
  if (lan !== null) {
    deps.log(`局域网 IP：${lan}`);
  }
  deps.log("设计师步骤：确认手机与电脑连接同一 Wi-Fi，打开 App 的走查入口，输入配对码。");
  deps.log(`codemaker ${worktree} --session ${sessionId}`);

  await deps.spawnMetro(worktree, { RN_GRAB_REVIEW_DIR: dir });
};

export const serveReview = async (paths: ReviewPaths, deps: ServeDeps): Promise<void> => {
  const active = readActive(paths);
  if (active === null) {
    deps.log("没有进行中的走查");
    return;
  }
  const review = ReviewStore.load(active.dir).get();
  const pid = await deps.spawnMetro(review.worktree, { RN_GRAB_REVIEW_DIR: active.dir });
  deps.log(`Metro 已启动（pid ${pid}）`);
};

const lockSha1 = (worktree: string): string => {
  return createHash("sha1")
    .update(readFileSync(join(worktree, "yarn.lock")))
    .digest("hex");
};

const lockMarker = (worktree: string): string => {
  return join(worktree, "node_modules", ".rn-grab-review-lock");
};

export const createInstallDeps = (
  runInstall: (worktree: string) => Promise<void>,
): ((worktree: string) => Promise<void>) => {
  return async (worktree: string) => {
    const sha1 = lockSha1(worktree);
    const marker = lockMarker(worktree);
    if (existsSync(marker) && readFileSync(marker, "utf8").trim() === sha1) {
      return;
    }
    await runInstall(worktree);
    mkdirSync(dirname(marker), { recursive: true });
    writeFileSync(marker, `${sha1}\n`, "utf8");
  };
};
