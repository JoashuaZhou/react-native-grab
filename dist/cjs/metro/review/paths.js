"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearActive = exports.writeActive = exports.readActive = exports.getReviewPaths = void 0;
const node_fs_1 = require("node:fs");
const node_os_1 = require("node:os");
const node_path_1 = require("node:path");
const REVIEW_HOME = ".react-native-grab";
const ACTIVE_FILE = "active.json";
const getReviewPaths = (homeDir = (0, node_os_1.homedir)()) => {
    const home = (0, node_path_1.join)(homeDir, REVIEW_HOME);
    return {
        home,
        reviewsDir: (0, node_path_1.join)(home, "reviews"),
        worktreesDir: (0, node_path_1.join)(home, "worktrees"),
        activeFile: (0, node_path_1.join)(home, ACTIVE_FILE),
    };
};
exports.getReviewPaths = getReviewPaths;
const readActive = (paths) => {
    try {
        return JSON.parse((0, node_fs_1.readFileSync)(paths.activeFile, "utf8"));
    }
    catch {
        return null;
    }
};
exports.readActive = readActive;
const writeActive = (paths, active) => {
    (0, node_fs_1.mkdirSync)((0, node_path_1.dirname)(paths.activeFile), { recursive: true });
    (0, node_fs_1.writeFileSync)(paths.activeFile, JSON.stringify(active, null, 2), "utf8");
};
exports.writeActive = writeActive;
const clearActive = (paths) => {
    (0, node_fs_1.rmSync)(paths.activeFile, { force: true });
};
exports.clearActive = clearActive;
//# sourceMappingURL=paths.js.map