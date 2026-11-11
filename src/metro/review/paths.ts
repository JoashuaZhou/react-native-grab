import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const REVIEW_HOME = ".react-native-grab";
const ACTIVE_FILE = "active.json";

export type ReviewPaths = {
  home: string;
  reviewsDir: string;
  worktreesDir: string;
  activeFile: string;
};

export type ActiveReview = {
  reviewId: string;
  dir: string;
};

export const getReviewPaths = (homeDir: string = homedir()): ReviewPaths => {
  const home = join(homeDir, REVIEW_HOME);
  return {
    home,
    reviewsDir: join(home, "reviews"),
    worktreesDir: join(home, "worktrees"),
    activeFile: join(home, ACTIVE_FILE),
  };
};

export const readActive = (paths: ReviewPaths): ActiveReview | null => {
  try {
    return JSON.parse(readFileSync(paths.activeFile, "utf8")) as ActiveReview;
  } catch {
    return null;
  }
};

export const writeActive = (paths: ReviewPaths, active: ActiveReview): void => {
  mkdirSync(dirname(paths.activeFile), { recursive: true });
  writeFileSync(paths.activeFile, JSON.stringify(active, null, 2), "utf8");
};

export const clearActive = (paths: ReviewPaths): void => {
  rmSync(paths.activeFile, { force: true });
};
