import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
const REVIEW_HOME = ".react-native-grab";
const ACTIVE_FILE = "active.json";
export const getReviewPaths = (homeDir = homedir()) => {
    const home = join(homeDir, REVIEW_HOME);
    return {
        home,
        reviewsDir: join(home, "reviews"),
        worktreesDir: join(home, "worktrees"),
        activeFile: join(home, ACTIVE_FILE),
    };
};
export const readActive = (paths) => {
    try {
        return JSON.parse(readFileSync(paths.activeFile, "utf8"));
    }
    catch {
        return null;
    }
};
export const writeActive = (paths, active) => {
    mkdirSync(dirname(paths.activeFile), { recursive: true });
    writeFileSync(paths.activeFile, JSON.stringify(active, null, 2), "utf8");
};
export const clearActive = (paths) => {
    rmSync(paths.activeFile, { force: true });
};
//# sourceMappingURL=paths.js.map