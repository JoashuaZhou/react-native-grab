"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_os_1 = require("node:os");
const node_path_1 = require("node:path");
const node_crypto_1 = require("node:crypto");
const vitest_1 = require("vitest");
const paths_1 = require("../../metro/review/paths");
const start_1 = require("../start");
const NOW = new Date(2026, 10, 12, 9, 5, 6);
const REVIEW_ID = "20261112-090506";
const BRANCH = "fix/design-review-20261112-0905";
const makeDeps = (root, overrides) => {
    const calls = [];
    const lines = [];
    const paths = (0, paths_1.getReviewPaths)(root);
    const record = (name) => (args) => {
        calls.push({ name, args });
    };
    const worktreePath = (0, node_path_1.join)(paths.worktreesDir, "Example");
    const deps = {
        git: {
            isBasePushed: async (...args) => {
                calls.push({ name: "isBasePushed", args });
                return overrides?.isBasePushed ?? true;
            },
            prepareWorktree: async (...args) => {
                calls.push({ name: "prepareWorktree", args });
                return undefined;
            },
            commonDir: async (...args) => {
                calls.push({ name: "commonDir", args });
                return "/tmp/fake-common";
            },
        },
        paths,
        now: () => NOW,
        portFree: async (...args) => {
            calls.push({ name: "portFree", args });
            return overrides?.portFree ?? true;
        },
        which: (bin) => {
            calls.push({ name: "which", args: [bin] });
            return overrides?.which === undefined ? "/usr/bin/codemaker" : overrides.which;
        },
        installDeps: async (...args) => {
            calls.push({ name: "installDeps", args });
            return undefined;
        },
        installAgentFiles: async (...args) => {
            calls.push({ name: "installAgentFiles", args });
            return undefined;
        },
        createSession: async (o) => {
            calls.push({ name: "createSession", args: [o] });
            if (overrides?.createSessionError !== undefined) {
                throw overrides.createSessionError;
            }
            return "sess-1";
        },
        spawnMetro: async (...args) => {
            calls.push({ name: "spawnMetro", args });
            return 4242;
        },
        randomCode: () => "314159",
        lanAddress: () => {
            calls.push({ name: "lanAddress", args: [] });
            return overrides?.lanAddress === undefined ? "192.168.31.4" : overrides.lanAddress;
        },
        log: (line) => {
            lines.push(line);
        },
    };
    if (overrides?.startWorktree !== false) {
        const packageDir = (0, node_path_1.join)(worktreePath, "node_modules", "react-native-grab");
        (0, node_fs_1.mkdirSync)(packageDir, { recursive: true });
        (0, node_fs_1.writeFileSync)((0, node_path_1.join)(packageDir, "package.json"), JSON.stringify({ rnGrabReview: 1 }), "utf8");
    }
    return { deps, calls, lines };
};
(0, vitest_1.describe)("startReview", () => {
    let root;
    let paths;
    const repo = "/Users/dev/Example";
    (0, vitest_1.beforeEach)(() => {
        root = (0, node_fs_1.mkdtempSync)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "rn-grab-start-"));
        paths = (0, paths_1.getReviewPaths)(root);
    });
    (0, vitest_1.afterEach)(() => {
        (0, node_fs_1.rmSync)(root, { recursive: true, force: true });
    });
    (0, vitest_1.it)("passes preflight and then calls the deps in the listed order, persisting the review", async () => {
        const { deps, calls, lines } = makeDeps(root);
        await (0, start_1.startReview)({ repo, base: "main" }, deps);
        (0, vitest_1.expect)(calls.map((call) => call.name)).toEqual([
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
        const worktree = (0, node_path_1.join)(paths.worktreesDir, "Example");
        (0, vitest_1.expect)(calls.find((call) => call.name === "portFree")?.args).toEqual([8081]);
        (0, vitest_1.expect)(calls.find((call) => call.name === "which")?.args).toEqual(["codemaker"]);
        (0, vitest_1.expect)(calls.find((call) => call.name === "isBasePushed")?.args).toEqual([repo, "main"]);
        (0, vitest_1.expect)(calls.find((call) => call.name === "prepareWorktree")?.args).toEqual([
            repo,
            worktree,
            "main",
            BRANCH,
        ]);
        (0, vitest_1.expect)(calls.find((call) => call.name === "installDeps")?.args).toEqual([worktree]);
        (0, vitest_1.expect)(calls.find((call) => call.name === "commonDir")?.args).toEqual([worktree]);
        (0, vitest_1.expect)(calls.find((call) => call.name === "installAgentFiles")?.args).toEqual([
            worktree,
            "/tmp/fake-common",
        ]);
        (0, vitest_1.expect)(calls.find((call) => call.name === "spawnMetro")?.args).toEqual([
            worktree,
            { RN_GRAB_REVIEW_DIR: (0, node_path_1.join)(paths.reviewsDir, REVIEW_ID) },
        ]);
        const session = calls.find((call) => call.name === "createSession")?.args[0];
        (0, vitest_1.expect)(session.bin).toBe("/usr/bin/codemaker");
        (0, vitest_1.expect)(session.worktree).toBe(worktree);
        (0, vitest_1.expect)(session.title).toBe(`走查 ${BRANCH}`);
        (0, vitest_1.expect)(session.message).toContain("design-review");
        (0, vitest_1.expect)(session.message).toContain("AGENTS.md");
        (0, vitest_1.expect)(session.message).toContain("已就绪");
        (0, vitest_1.expect)(session.message).toContain("不要修改");
        const dir = (0, node_path_1.join)(paths.reviewsDir, REVIEW_ID);
        const saved = JSON.parse((0, node_fs_1.readFileSync)((0, node_path_1.join)(dir, "review.json"), "utf8"));
        (0, vitest_1.expect)(saved).toMatchObject({
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
        (0, vitest_1.expect)((0, paths_1.readActive)(paths)).toEqual({ reviewId: REVIEW_ID, dir });
        const printed = lines.join("\n");
        (0, vitest_1.expect)(printed).toContain("314159");
        (0, vitest_1.expect)(printed).toContain("192.168.31.4");
        (0, vitest_1.expect)(printed).toContain("Wi-Fi");
        (0, vitest_1.expect)(lines).toContain("在 App 的 Debug 设置里把 React Native 开发服务器地址设为 192.168.31.4，重启 App");
        (0, vitest_1.expect)(printed).toContain(`codemaker ${worktree} --session sess-1`);
    });
    (0, vitest_1.it)("omits the LAN line when lanAddress is null but still starts Metro", async () => {
        const { deps, lines, calls } = makeDeps(root, { lanAddress: null });
        await (0, start_1.startReview)({ repo, base: "main" }, deps);
        (0, vitest_1.expect)(lines.join("\n")).not.toContain("局域网");
        (0, vitest_1.expect)(lines.join("\n")).not.toContain("重启 App");
        (0, vitest_1.expect)(calls.map((call) => call.name)).toContain("spawnMetro");
    });
    vitest_1.it.each([
        {
            label: "active review exists",
            message: "已有进行中的走查：执行 rn-grab-review serve 继续，或 rn-grab-review stop 结束",
            override: { prepare: () => (0, paths_1.writeActive)(paths, { reviewId: "old", dir: "/old" }) },
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
        await (0, start_1.startReview)({ repo, base: "main" }, deps);
        (0, vitest_1.expect)(lines).toContain(case_.message);
        (0, vitest_1.expect)(calls.map((call) => call.name)).not.toContain("prepareWorktree");
        (0, vitest_1.expect)(calls.map((call) => call.name)).not.toContain("installDeps");
        (0, vitest_1.expect)(calls.map((call) => call.name)).not.toContain("installAgentFiles");
        (0, vitest_1.expect)(calls.map((call) => call.name)).not.toContain("createSession");
        (0, vitest_1.expect)(calls.map((call) => call.name)).not.toContain("spawnMetro");
        (0, vitest_1.expect)((0, node_fs_1.existsSync)(paths.reviewsDir)).toBe(false);
        (0, vitest_1.expect)((0, paths_1.readActive)(paths)).toEqual(case_.label === "active review exists" ? { reviewId: "old", dir: "/old" } : null);
    });
    (0, vitest_1.it)("fails with the pinned message when the worktree package lacks rnGrabReview 1", async () => {
        const { deps, calls } = makeDeps(root, { startWorktree: false });
        await (0, vitest_1.expect)((0, start_1.startReview)({ repo, base: "main" }, deps)).rejects.toThrow("base 分支的 react-native-grab 不支持走查，请先合入接入提交");
        (0, vitest_1.expect)(calls.map((call) => call.name)).not.toContain("installAgentFiles");
        (0, vitest_1.expect)(calls.map((call) => call.name)).not.toContain("createSession");
        (0, vitest_1.expect)(calls.map((call) => call.name)).not.toContain("spawnMetro");
        (0, vitest_1.expect)((0, node_fs_1.existsSync)(paths.reviewsDir)).toBe(false);
    });
    (0, vitest_1.it)("removes the review dir and rethrows when createSession fails", async () => {
        const { deps } = makeDeps(root, { createSessionError: new Error("codemaker boom") });
        await (0, vitest_1.expect)((0, start_1.startReview)({ repo, base: "main" }, deps)).rejects.toThrow("codemaker boom");
        (0, vitest_1.expect)((0, node_fs_1.existsSync)((0, node_path_1.join)(paths.reviewsDir, REVIEW_ID))).toBe(false);
        (0, vitest_1.expect)((0, node_fs_1.existsSync)(paths.activeFile)).toBe(false);
    });
});
(0, vitest_1.describe)("serveReview", () => {
    let root;
    let paths;
    (0, vitest_1.beforeEach)(() => {
        root = (0, node_fs_1.mkdtempSync)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "rn-grab-serve-"));
        paths = (0, paths_1.getReviewPaths)(root);
    });
    (0, vitest_1.afterEach)(() => {
        (0, node_fs_1.rmSync)(root, { recursive: true, force: true });
    });
    (0, vitest_1.it)("respawns Metro for the active review", async () => {
        const worktree = (0, node_path_1.join)(paths.worktreesDir, "Example");
        (0, node_fs_1.mkdirSync)(worktree, { recursive: true });
        const dir = (0, node_path_1.join)(paths.reviewsDir, "20261112-090506");
        (0, node_fs_1.mkdirSync)(dir, { recursive: true });
        (0, node_fs_1.writeFileSync)((0, node_path_1.join)(dir, "review.json"), JSON.stringify({ id: "20261112-090506", worktree, status: "active" }), "utf8");
        (0, paths_1.writeActive)(paths, { reviewId: "20261112-090506", dir });
        const calls = [];
        const lines = [];
        await (0, start_1.serveReview)(paths, {
            spawnMetro: async (...args) => {
                calls.push({ name: "spawnMetro", args });
                return 4242;
            },
            log: (line) => {
                lines.push(line);
            },
        });
        (0, vitest_1.expect)(calls).toEqual([{ name: "spawnMetro", args: [worktree, { RN_GRAB_REVIEW_DIR: dir }] }]);
        (0, vitest_1.expect)(lines.join("\n")).toContain("4242");
    });
    (0, vitest_1.it)("reports when there is no active review", async () => {
        const calls = [];
        const lines = [];
        await (0, start_1.serveReview)(paths, {
            spawnMetro: async (...args) => {
                calls.push({ name: "spawnMetro", args });
                return 4242;
            },
            log: (line) => {
                lines.push(line);
            },
        });
        (0, vitest_1.expect)(calls).toEqual([]);
        (0, vitest_1.expect)(lines.join("\n")).toContain("没有进行中的走查");
    });
});
(0, vitest_1.describe)("createInstallDeps", () => {
    let root;
    let worktree;
    const runs = [];
    const sha1 = (data) => {
        return (0, node_crypto_1.createHash)("sha1").update(data).digest("hex");
    };
    (0, vitest_1.beforeEach)(() => {
        root = (0, node_fs_1.mkdtempSync)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "rn-grab-install-"));
        worktree = (0, node_path_1.join)(root, "worktree");
        (0, node_fs_1.mkdirSync)(worktree, { recursive: true });
        (0, node_fs_1.writeFileSync)((0, node_path_1.join)(worktree, "yarn.lock"), "lock v1\n", "utf8");
        runs.length = 0;
    });
    (0, vitest_1.afterEach)(() => {
        (0, node_fs_1.rmSync)(root, { recursive: true, force: true });
    });
    (0, vitest_1.it)("installs once, records the lock hash and skips the second run", async () => {
        const installDeps = (0, start_1.createInstallDeps)(async (dir) => {
            runs.push(dir);
        });
        await installDeps(worktree);
        await installDeps(worktree);
        (0, vitest_1.expect)(runs).toEqual([worktree]);
        const marker = (0, node_path_1.join)(worktree, "node_modules", ".rn-grab-review-lock");
        (0, vitest_1.expect)((0, node_fs_1.readFileSync)(marker, "utf8").trim()).toBe(sha1("lock v1\n"));
    });
    (0, vitest_1.it)("skips the install when the marker already matches", async () => {
        const marker = (0, node_path_1.join)(worktree, "node_modules", ".rn-grab-review-lock");
        (0, node_fs_1.mkdirSync)((0, node_path_1.join)(worktree, "node_modules"), { recursive: true });
        (0, node_fs_1.writeFileSync)(marker, sha1("lock v1\n"), "utf8");
        const installDeps = (0, start_1.createInstallDeps)(async (dir) => {
            runs.push(dir);
        });
        await installDeps(worktree);
        (0, vitest_1.expect)(runs).toEqual([]);
    });
    (0, vitest_1.it)("reinstalls after the lock file changes", async () => {
        const installDeps = (0, start_1.createInstallDeps)(async (dir) => {
            runs.push(dir);
        });
        await installDeps(worktree);
        (0, node_fs_1.writeFileSync)((0, node_path_1.join)(worktree, "yarn.lock"), "lock v2\n", "utf8");
        await installDeps(worktree);
        (0, vitest_1.expect)(runs).toEqual([worktree, worktree]);
        (0, vitest_1.expect)((0, node_fs_1.readFileSync)((0, node_path_1.join)(worktree, "node_modules", ".rn-grab-review-lock"), "utf8").trim()).toBe(sha1("lock v2\n"));
    });
});
//# sourceMappingURL=start.test.js.map