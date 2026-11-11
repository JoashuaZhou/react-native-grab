import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LATER, makeItemInput, makeReview } from "../../../review-core/__tests__/fixtures";
import { createItem } from "../../../review-core/transitions";
import { clearActive, getReviewPaths, readActive, writeActive } from "../paths";
import { ReviewStore } from "../store";

let root: string;

const makeDir = (): string => {
  return mkdtempSync(join(root, "review-"));
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "rn-grab-review-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("getReviewPaths", () => {
  it("derives the review layout under <homeDir>/.react-native-grab", () => {
    const paths = getReviewPaths(join(root, "home"));

    expect(paths.home).toBe(join(root, "home", ".react-native-grab"));
    expect(paths.reviewsDir).toBe(join(paths.home, "reviews"));
    expect(paths.worktreesDir).toBe(join(paths.home, "worktrees"));
    expect(paths.activeFile).toBe(join(paths.home, "active.json"));
  });
});

describe("active review file", () => {
  it("reads null when active.json is missing", () => {
    const paths = getReviewPaths(join(root, "home"));

    expect(readActive(paths)).toBeNull();
  });

  it("round-trips the active review and clearing removes it", () => {
    const paths = getReviewPaths(join(root, "home"));
    const review = makeReview();
    const active = { reviewId: review.id, dir: join(root, "reviews", review.id) };

    writeActive(paths, active);
    expect(readActive(paths)).toEqual(active);

    clearActive(paths);
    expect(readActive(paths)).toBeNull();
    expect(existsSync(paths.activeFile)).toBe(false);
  });
});

describe("ReviewStore", () => {
  it("persists a created review and loads it back", () => {
    const dir = makeDir();
    const review = makeReview();

    const created = ReviewStore.create(dir, review);
    expect(created.dir).toBe(dir);
    expect(created.get()).toEqual(review);
    expect(ReviewStore.load(dir).get()).toEqual(review);
  });

  it("keeps updates visible to a store loaded after a reload", () => {
    const dir = makeDir();
    const store = ReviewStore.create(dir, makeReview());

    const updated = store.update(
      (review) => createItem(review, { ...makeItemInput() }, LATER).review,
    );
    expect(updated.items).toHaveLength(1);
    expect(store.get().items).toHaveLength(1);

    const reloaded = ReviewStore.load(dir);
    expect(reloaded.get().items[0]).toMatchObject({
      no: 1,
      kind: "element",
      status: "draft",
    });
    expect(reloaded.get().items[0].rounds[0].description).toBe("标题字号应为 16");
  });

  it("leaves no .tmp file behind after an update", () => {
    const dir = makeDir();
    const store = ReviewStore.create(dir, makeReview());

    store.update((review) => ({ ...review, status: "finishing" }));

    expect(readdirSync(dir).filter((name) => name.endsWith(".tmp"))).toEqual([]);
    expect(JSON.parse(readFileSync(join(dir, "review.json"), "utf8"))).toMatchObject({
      status: "finishing",
    });
  });

  it("fails load with the file path when review.json is corrupted", () => {
    const dir = makeDir();
    mkdirSync(dir, { recursive: true });
    const file = join(dir, "review.json");
    writeFileSync(file, "{ not json", "utf8");

    expect(() => ReviewStore.load(dir)).toThrow(file);
  });

  it("writes decoded screenshot bytes and returns the file name", () => {
    const dir = makeDir();
    const store = ReviewStore.create(dir, makeReview());
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

    const file = store.writeScreenshot(2, jpeg.toString("base64"));

    expect(file).toBe("2.jpg");
    expect(readFileSync(store.screenshotPath(file))).toEqual(jpeg);
  });

  it("rejects empty or non-base64 screenshot payloads", () => {
    const dir = makeDir();
    const store = ReviewStore.create(dir, makeReview());

    expect(() => store.writeScreenshot(1, "")).toThrow();
    expect(() => store.writeScreenshot(1, "not base64!")).toThrow(/base64/);
    expect(readdirSync(join(dir, "screenshots"))).toEqual([]);
  });

  it("rejects screenshot names outside the screenshots directory", () => {
    const dir = makeDir();
    const store = ReviewStore.create(dir, makeReview());

    expect(store.screenshotPath("12.jpg")).toBe(join(dir, "screenshots", "12.jpg"));
    expect(() => store.screenshotPath("../x")).toThrow();
  });

  it("exposes agent log and lock paths inside the review directory", () => {
    const dir = makeDir();
    const store = ReviewStore.create(dir, makeReview());

    expect(store.agentLogPath()).toBe(join(dir, "agent.log"));
    expect(store.lockPath()).toBe(join(dir, "agent.lock"));
  });
});
