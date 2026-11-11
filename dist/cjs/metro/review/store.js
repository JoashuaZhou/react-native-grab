"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewStore = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const REVIEW_FILE = "review.json";
const SCREENSHOTS_DIR = "screenshots";
const TMP_SUFFIX = ".tmp";
const SCREENSHOT_NAME_RE = /^\d+\.jpg$/;
const BASE64_RE = /^[A-Za-z0-9+/]+={0,2}$/;
const reviewFile = (dir) => {
    return (0, node_path_1.join)(dir, REVIEW_FILE);
};
const screenshotsDir = (dir) => {
    return (0, node_path_1.join)(dir, SCREENSHOTS_DIR);
};
const writeAtomic = (file, data) => {
    const tmpFile = `${file}${TMP_SUFFIX}`;
    (0, node_fs_1.writeFileSync)(tmpFile, data, "utf8");
    (0, node_fs_1.renameSync)(tmpFile, file);
};
const serialize = (review) => {
    return JSON.stringify(review, null, 2);
};
class ReviewStore {
    constructor(dir, review) {
        this.dir = dir;
        this.review = review;
    }
    static create(dir, review) {
        (0, node_fs_1.mkdirSync)(screenshotsDir(dir), { recursive: true });
        writeAtomic(reviewFile(dir), serialize(review));
        return new ReviewStore(dir, review);
    }
    static load(dir) {
        const file = reviewFile(dir);
        const text = (0, node_fs_1.readFileSync)(file, "utf8");
        try {
            return new ReviewStore(dir, JSON.parse(text));
        }
        catch (error) {
            throw new Error(`Corrupted review file: ${file} (${error.message})`);
        }
    }
    get() {
        return this.review;
    }
    update(mutate) {
        const next = mutate(this.review);
        writeAtomic(reviewFile(this.dir), serialize(next));
        this.review = next;
        return next;
    }
    writeScreenshot(no, jpegBase64) {
        if (!BASE64_RE.test(jpegBase64)) {
            throw new Error("Invalid base64 screenshot payload");
        }
        const file = `${no}.jpg`;
        (0, node_fs_1.mkdirSync)(screenshotsDir(this.dir), { recursive: true });
        (0, node_fs_1.writeFileSync)(this.screenshotPath(file), Buffer.from(jpegBase64, "base64"));
        return file;
    }
    screenshotPath(file) {
        if (!SCREENSHOT_NAME_RE.test(file)) {
            throw new Error(`Invalid screenshot file name: ${file}`);
        }
        return (0, node_path_1.join)(this.dir, SCREENSHOTS_DIR, file);
    }
    agentLogPath() {
        return (0, node_path_1.join)(this.dir, "agent.log");
    }
    lockPath() {
        return (0, node_path_1.join)(this.dir, "agent.lock");
    }
}
exports.ReviewStore = ReviewStore;
//# sourceMappingURL=store.js.map