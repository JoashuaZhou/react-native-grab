import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Review } from "../../review-core/types";

const REVIEW_FILE = "review.json";
const SCREENSHOTS_DIR = "screenshots";
const TMP_SUFFIX = ".tmp";
const SCREENSHOT_NAME_RE = /^\d+\.jpg$/;
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;

const reviewFile = (dir: string): string => {
  return join(dir, REVIEW_FILE);
};

const screenshotsDir = (dir: string): string => {
  return join(dir, SCREENSHOTS_DIR);
};

const writeAtomic = (file: string, data: string): void => {
  const tmpFile = `${file}${TMP_SUFFIX}`;
  writeFileSync(tmpFile, data, "utf8");
  renameSync(tmpFile, file);
};

const serialize = (review: Review): string => {
  return JSON.stringify(review, null, 2);
};

export class ReviewStore {
  readonly dir: string;
  private review: Review;

  private constructor(dir: string, review: Review) {
    this.dir = dir;
    this.review = review;
  }

  static create(dir: string, review: Review): ReviewStore {
    mkdirSync(screenshotsDir(dir), { recursive: true });
    writeAtomic(reviewFile(dir), serialize(review));
    return new ReviewStore(dir, review);
  }

  static load(dir: string): ReviewStore {
    const file = reviewFile(dir);
    const text = readFileSync(file, "utf8");
    try {
      return new ReviewStore(dir, JSON.parse(text) as Review);
    } catch (error) {
      throw new Error(`Corrupted review file: ${file} (${(error as Error).message})`);
    }
  }

  get(): Review {
    return this.review;
  }

  update(mutate: (r: Review) => Review): Review {
    const next = mutate(this.review);
    writeAtomic(reviewFile(this.dir), serialize(next));
    this.review = next;
    return next;
  }

  writeScreenshot(no: number, jpegBase64: string): string {
    if (!BASE64_RE.test(jpegBase64)) {
      throw new Error("Invalid base64 screenshot payload");
    }
    const file = `${no}.jpg`;
    mkdirSync(screenshotsDir(this.dir), { recursive: true });
    writeFileSync(this.screenshotPath(file), Buffer.from(jpegBase64, "base64"));
    return file;
  }

  screenshotPath(file: string): string {
    if (!SCREENSHOT_NAME_RE.test(file)) {
      throw new Error(`Invalid screenshot file name: ${file}`);
    }
    return join(this.dir, SCREENSHOTS_DIR, file);
  }

  agentLogPath(): string {
    return join(this.dir, "agent.log");
  }

  lockPath(): string {
    return join(this.dir, "agent.lock");
  }
}
