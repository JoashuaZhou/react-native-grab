"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_os_1 = require("node:os");
const node_path_1 = require("node:path");
const vitest_1 = require("vitest");
const fixtures_1 = require("../../../review-core/__tests__/fixtures");
const transitions_1 = require("../../../review-core/transitions");
const paths_1 = require("../paths");
const store_1 = require("../store");
let root;
const makeDir = () => {
    return (0, node_fs_1.mkdtempSync)((0, node_path_1.join)(root, "review-"));
};
(0, vitest_1.beforeEach)(() => {
    root = (0, node_fs_1.mkdtempSync)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "rn-grab-review-"));
});
(0, vitest_1.afterEach)(() => {
    (0, node_fs_1.rmSync)(root, { recursive: true, force: true });
});
(0, vitest_1.describe)("getReviewPaths", () => {
    (0, vitest_1.it)("derives the review layout under <homeDir>/.react-native-grab", () => {
        const paths = (0, paths_1.getReviewPaths)((0, node_path_1.join)(root, "home"));
        (0, vitest_1.expect)(paths.home).toBe((0, node_path_1.join)(root, "home", ".react-native-grab"));
        (0, vitest_1.expect)(paths.reviewsDir).toBe((0, node_path_1.join)(paths.home, "reviews"));
        (0, vitest_1.expect)(paths.worktreesDir).toBe((0, node_path_1.join)(paths.home, "worktrees"));
        (0, vitest_1.expect)(paths.activeFile).toBe((0, node_path_1.join)(paths.home, "active.json"));
    });
});
(0, vitest_1.describe)("active review file", () => {
    (0, vitest_1.it)("reads null when active.json is missing", () => {
        const paths = (0, paths_1.getReviewPaths)((0, node_path_1.join)(root, "home"));
        (0, vitest_1.expect)((0, paths_1.readActive)(paths)).toBeNull();
    });
    (0, vitest_1.it)("round-trips the active review and clearing removes it", () => {
        const paths = (0, paths_1.getReviewPaths)((0, node_path_1.join)(root, "home"));
        const review = (0, fixtures_1.makeReview)();
        const active = { reviewId: review.id, dir: (0, node_path_1.join)(root, "reviews", review.id) };
        (0, paths_1.writeActive)(paths, active);
        (0, vitest_1.expect)((0, paths_1.readActive)(paths)).toEqual(active);
        (0, paths_1.clearActive)(paths);
        (0, vitest_1.expect)((0, paths_1.readActive)(paths)).toBeNull();
        (0, vitest_1.expect)((0, node_fs_1.existsSync)(paths.activeFile)).toBe(false);
    });
});
(0, vitest_1.describe)("ReviewStore", () => {
    (0, vitest_1.it)("persists a created review and loads it back", () => {
        const dir = makeDir();
        const review = (0, fixtures_1.makeReview)();
        const created = store_1.ReviewStore.create(dir, review);
        (0, vitest_1.expect)(created.dir).toBe(dir);
        (0, vitest_1.expect)(created.get()).toEqual(review);
        (0, vitest_1.expect)(store_1.ReviewStore.load(dir).get()).toEqual(review);
    });
    (0, vitest_1.it)("keeps updates visible to a store loaded after a reload", () => {
        const dir = makeDir();
        const store = store_1.ReviewStore.create(dir, (0, fixtures_1.makeReview)());
        const updated = store.update((review) => (0, transitions_1.createItem)(review, { ...(0, fixtures_1.makeItemInput)() }, fixtures_1.LATER).review);
        (0, vitest_1.expect)(updated.items).toHaveLength(1);
        (0, vitest_1.expect)(store.get().items).toHaveLength(1);
        const reloaded = store_1.ReviewStore.load(dir);
        (0, vitest_1.expect)(reloaded.get().items[0]).toMatchObject({
            no: 1,
            kind: "element",
            status: "draft",
        });
        (0, vitest_1.expect)(reloaded.get().items[0].rounds[0].description).toBe("标题字号应为 16");
    });
    (0, vitest_1.it)("leaves no .tmp file behind after an update", () => {
        const dir = makeDir();
        const store = store_1.ReviewStore.create(dir, (0, fixtures_1.makeReview)());
        store.update((review) => ({ ...review, status: "finishing" }));
        (0, vitest_1.expect)((0, node_fs_1.readdirSync)(dir).filter((name) => name.endsWith(".tmp"))).toEqual([]);
        (0, vitest_1.expect)(JSON.parse((0, node_fs_1.readFileSync)((0, node_path_1.join)(dir, "review.json"), "utf8"))).toMatchObject({
            status: "finishing",
        });
    });
    (0, vitest_1.it)("fails load with the file path when review.json is corrupted", () => {
        const dir = makeDir();
        (0, node_fs_1.mkdirSync)(dir, { recursive: true });
        const file = (0, node_path_1.join)(dir, "review.json");
        (0, node_fs_1.writeFileSync)(file, "{ not json", "utf8");
        (0, vitest_1.expect)(() => store_1.ReviewStore.load(dir)).toThrow(file);
    });
    (0, vitest_1.it)("writes decoded screenshot bytes and returns the file name", () => {
        const dir = makeDir();
        const store = store_1.ReviewStore.create(dir, (0, fixtures_1.makeReview)());
        const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
        const file = store.writeScreenshot(2, jpeg.toString("base64"));
        (0, vitest_1.expect)(file).toBe("2.jpg");
        (0, vitest_1.expect)((0, node_fs_1.readFileSync)(store.screenshotPath(file))).toEqual(jpeg);
    });
    (0, vitest_1.it)("rejects empty or non-base64 screenshot payloads", () => {
        const dir = makeDir();
        const store = store_1.ReviewStore.create(dir, (0, fixtures_1.makeReview)());
        (0, vitest_1.expect)(() => store.writeScreenshot(1, "")).toThrow();
        (0, vitest_1.expect)(() => store.writeScreenshot(1, "not base64!")).toThrow(/base64/);
        (0, vitest_1.expect)((0, node_fs_1.readdirSync)((0, node_path_1.join)(dir, "screenshots"))).toEqual([]);
    });
    (0, vitest_1.it)("rejects screenshot names outside the screenshots directory", () => {
        const dir = makeDir();
        const store = store_1.ReviewStore.create(dir, (0, fixtures_1.makeReview)());
        (0, vitest_1.expect)(store.screenshotPath("12.jpg")).toBe((0, node_path_1.join)(dir, "screenshots", "12.jpg"));
        (0, vitest_1.expect)(() => store.screenshotPath("../x")).toThrow();
    });
    (0, vitest_1.it)("exposes agent log and lock paths inside the review directory", () => {
        const dir = makeDir();
        const store = store_1.ReviewStore.create(dir, (0, fixtures_1.makeReview)());
        (0, vitest_1.expect)(store.agentLogPath()).toBe((0, node_path_1.join)(dir, "agent.log"));
        (0, vitest_1.expect)(store.lockPath()).toBe((0, node_path_1.join)(dir, "agent.lock"));
    });
});
//# sourceMappingURL=store.test.js.map