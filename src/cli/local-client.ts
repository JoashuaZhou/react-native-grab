import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { clearActive, readActive, type ReviewPaths } from "../metro/review/paths";
import { REVIEW_ROUTE_PREFIX } from "../metro/review/http";
import { ReviewStore } from "../metro/review/store";
import { abandonReview } from "../review-core/transitions";
import { SCOPE_LABELS, STATUS_LABELS, type Review, type ReviewItem } from "../review-core/types";

export const METRO_PORT = 8081;
export const LOCAL_ORIGIN = `http://127.0.0.1:${METRO_PORT}`;

export type LocalOptions = {
  origin?: string;
  print?: (line: string) => void;
};

type LocalItemBody = { ok: true; item: ReviewItem; screenshotPath: string | null };
type LocalStatusBody = { ok: true; review: Review };
type LocalErrorBody = { ok: false; error: string };

type LocalResult<T> = { status: number; payload: T | LocalErrorBody };

const localPath = (suffix: string): string => {
  return `${REVIEW_ROUTE_PREFIX}local/${suffix}`;
};

const requestLocal = async <T>(
  suffix: string,
  init: { method?: string; body?: unknown },
  origin: string,
): Promise<LocalResult<T>> => {
  let response: Response;
  try {
    response = await fetch(`${origin}${localPath(suffix)}`, {
      method: init.method ?? "GET",
      headers: init.body === undefined ? undefined : { "content-type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new Error(`无法连接 Metro（${origin}），请先运行 rn-grab-review serve`);
  }
  const payload = (await response.json()) as T | LocalErrorBody;
  return { status: response.status, payload };
};

const expectOk = <T>(result: LocalResult<T>, fallback: string): T => {
  const payload = result.payload;
  if (payload !== null && typeof payload === "object" && "ok" in payload) {
    if (payload.ok === false) {
      const error = payload as LocalErrorBody;
      throw new Error(`操作失败（${error.error || fallback}）`);
    }
    return payload as T;
  }
  throw new Error(`Metro 返回异常（状态码 ${result.status}）`);
};

const printOpts = (options: LocalOptions): ((line: string) => void) => {
  return (
    options.print ??
    ((line: string) => {
      console.log(line);
    })
  );
};

export const localStatus = async (options: LocalOptions = {}): Promise<Review> => {
  const result = await requestLocal<LocalStatusBody>("status", {}, options.origin ?? LOCAL_ORIGIN);
  return expectOk(result, "status").review;
};

export const printStatus = async (options: LocalOptions = {}): Promise<Review> => {
  const print = printOpts(options);
  const review = await localStatus(options);
  print(`走查 ${review.id}：${review.status}`);
  print(`基准分支：${review.base}，走查分支：${review.branch}`);
  if (review.items.length === 0) {
    print("暂无条目");
    return review;
  }
  const summary = review.items
    .map((item) => `#${item.no} ${STATUS_LABELS[item.status]}`)
    .join("、");
  print(`条目 ${review.items.length} 条：${summary}`);
  return review;
};

const formatRect = (item: ReviewItem): string => {
  if (item.rect === null) {
    return "矩形：无";
  }
  return `矩形：x ${item.rect.x}，y ${item.rect.y}，宽 ${item.rect.width}，高 ${item.rect.height}`;
};

const formatScreen = (item: ReviewItem): string => {
  if (item.screen === null) {
    return "屏幕：无";
  }
  return `屏幕：${item.screen.width}×${item.screen.height}（${item.screen.scale}x）`;
};

const formatRounds = (item: ReviewItem): string[] => {
  return item.rounds.map((round, index) => {
    const lines = [`第 ${index + 1} 轮`];
    lines.push(`  描述：${round.description}`);
    lines.push(`  回复：${round.reply === null ? "无" : round.reply}`);
    lines.push(`  提交：${round.commits.length === 0 ? "无" : round.commits.join("、")}`);
    return lines.join("\n");
  });
};

export const showItem = async (
  no: number,
  json: boolean,
  options: LocalOptions = {},
): Promise<ReviewItem> => {
  const print = printOpts(options);
  const origin = options.origin ?? LOCAL_ORIGIN;
  const itemResult = await requestLocal<LocalItemBody>(`items/${no}`, {}, origin);
  const body = expectOk(itemResult, "item");
  const review = await localStatus({ ...options, origin });
  const item = body.item;

  let screenshotCopy: string | null = null;
  if (body.screenshotPath !== null) {
    const dir = join(review.worktree, ".rn-grab-review");
    mkdirSync(dir, { recursive: true });
    screenshotCopy = join(dir, `item-${no}.jpg`);
    copyFileSync(body.screenshotPath, screenshotCopy);
  }

  if (json) {
    print(JSON.stringify(item, null, 2));
    return item;
  }

  print(`#${item.no} ${STATUS_LABELS[item.status]}（${SCOPE_LABELS[item.scope]}）`);
  print(`路由：${item.route === null ? "无" : item.route}`);
  print(`Figma：${item.figmaUrl === null ? "无" : item.figmaUrl}`);
  print(formatRect(item));
  print(formatScreen(item));
  print(`截图：${screenshotCopy === null ? "无" : screenshotCopy}`);
  for (const round of formatRounds(item)) {
    print(round);
  }
  print(`抓取描述：${item.grab === null ? "无" : item.grab.description}`);
  return item;
};

const printItemLine = (item: ReviewItem, print: (line: string) => void): void => {
  print(`#${item.no} ${STATUS_LABELS[item.status]}（${SCOPE_LABELS[item.scope]}）`);
};

export const claim = async (no: number, options: LocalOptions = {}): Promise<ReviewItem> => {
  const print = printOpts(options);
  const result = await requestLocal<LocalItemBody>(
    `items/${no}/claim`,
    { method: "POST" },
    options.origin ?? LOCAL_ORIGIN,
  );
  const body = expectOk(result, "claim");
  printItemLine(body.item, print);
  return body.item;
};

export const reply = async (
  no: number,
  message: string,
  commits: string[],
  options: LocalOptions = {},
): Promise<ReviewItem> => {
  const print = printOpts(options);
  const result = await requestLocal<LocalItemBody>(
    `items/${no}/reply`,
    { method: "POST", body: { reply: message, commits } },
    options.origin ?? LOCAL_ORIGIN,
  );
  const body = expectOk(result, "reply");
  printItemLine(body.item, print);
  return body.item;
};

export const complete = async (mr: string | null, options: LocalOptions = {}): Promise<void> => {
  const print = printOpts(options);
  const result = await requestLocal<{ ok: true }>(
    "complete",
    { method: "POST", body: { mrUrl: mr } },
    options.origin ?? LOCAL_ORIGIN,
  );
  expectOk(result, "complete");
  print("走查完成");
};

export const retry = async (options: LocalOptions = {}): Promise<void> => {
  const print = printOpts(options);
  const result = await requestLocal<{ ok: true }>(
    "retry",
    { method: "POST" },
    options.origin ?? LOCAL_ORIGIN,
  );
  expectOk(result, "retry");
  print("已重试");
};

export const stopReview = async (paths: ReviewPaths, options: LocalOptions = {}): Promise<void> => {
  const print = printOpts(options);
  const origin = options.origin ?? LOCAL_ORIGIN;
  const active = readActive(paths);
  if (active === null) {
    print("没有进行中的走查");
    return;
  }

  let metroAnswered = false;
  try {
    const response = await fetch(`${origin}${localPath("stop")}`, { method: "POST" });
    await response.arrayBuffer();
    metroAnswered = true;
  } catch {
    metroAnswered = false;
  }

  if (metroAnswered) {
    print("已结束走查");
  } else {
    const store = ReviewStore.load(active.dir);
    const review = store.get();
    if (review.status === "active" || review.status === "finishing") {
      store.update((current) => abandonReview(current));
    }
    print("Metro 未运行，已直接放弃该走查");
  }
  clearActive(paths);
};
