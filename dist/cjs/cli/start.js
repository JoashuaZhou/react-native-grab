"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInstallDeps = exports.serveReview = exports.startReview = void 0;
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const paths_1 = require("../metro/review/paths");
const git_1 = require("../metro/review/git");
const store_1 = require("../metro/review/store");
const local_client_1 = require("./local-client");
const pad2 = (value) => {
    return String(value).padStart(2, "0");
};
const localStamp = (now) => {
    return `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}-${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`;
};
const reviewId = (now) => {
    return localStamp(now);
};
const supportsReview = (worktree) => {
    const file = (0, node_path_1.join)(worktree, "node_modules", "react-native-grab", "package.json");
    let supported = false;
    try {
        const pkg = JSON.parse((0, node_fs_1.readFileSync)(file, "utf8"));
        supported = pkg.rnGrabReview === 1;
    }
    catch {
        supported = false;
    }
    if (!supported) {
        throw new Error("base 分支的 react-native-grab 不支持走查，请先合入接入提交");
    }
};
const INTRO_MESSAGE = "你被指派接管这次设计走查会话。请先读取 .codemaker/skills/design-review 下的 design-review skill 和仓库根目录的 AGENTS.md，读取完毕后只回复「已就绪」，不要修改任何内容。";
const startReview = async (opts, deps) => {
    if ((0, paths_1.readActive)(deps.paths) !== null) {
        deps.log("已有进行中的走查：执行 rn-grab-review serve 继续，或 rn-grab-review stop 结束");
        return;
    }
    if (!(await deps.portFree(local_client_1.METRO_PORT))) {
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
    const branch = (0, git_1.reviewBranchName)(now);
    const worktree = (0, node_path_1.join)(deps.paths.worktreesDir, (0, node_path_1.basename)(opts.repo));
    await deps.git.prepareWorktree(opts.repo, worktree, opts.base, branch);
    await deps.installDeps(worktree);
    supportsReview(worktree);
    const commonDir = await deps.git.commonDir(worktree);
    await deps.installAgentFiles(worktree, commonDir);
    const id = reviewId(now);
    const dir = (0, node_path_1.join)(deps.paths.reviewsDir, id);
    const review = {
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
    const store = store_1.ReviewStore.create(dir, review);
    let sessionId;
    try {
        sessionId = await deps.createSession({
            bin: codemakerBin,
            worktree,
            title: `走查 ${branch}`,
            message: INTRO_MESSAGE,
        });
        store.update((current) => ({ ...current, sessionId }));
    }
    catch (error) {
        (0, node_fs_1.rmSync)(dir, { recursive: true, force: true });
        throw error;
    }
    (0, paths_1.writeActive)(deps.paths, { reviewId: id, dir });
    deps.log(`配对码：${review.pairingCode}`);
    const lan = deps.lanAddress();
    if (lan !== null) {
        deps.log(`局域网 IP：${lan}`);
        deps.log(`在 App 的 Debug 设置里把 React Native 开发服务器地址设为 ${lan}，重启 App`);
    }
    deps.log("设计师步骤：确认手机与电脑连接同一 Wi-Fi，打开 App 的走查入口，输入配对码。");
    deps.log(`codemaker ${worktree} --session ${sessionId}`);
    await deps.spawnMetro(worktree, { RN_GRAB_REVIEW_DIR: dir });
};
exports.startReview = startReview;
const serveReview = async (paths, deps) => {
    const active = (0, paths_1.readActive)(paths);
    if (active === null) {
        deps.log("没有进行中的走查");
        return;
    }
    const review = store_1.ReviewStore.load(active.dir).get();
    const pid = await deps.spawnMetro(review.worktree, { RN_GRAB_REVIEW_DIR: active.dir });
    deps.log(`Metro 已启动（pid ${pid}）`);
};
exports.serveReview = serveReview;
const lockSha1 = (worktree) => {
    return (0, node_crypto_1.createHash)("sha1")
        .update((0, node_fs_1.readFileSync)((0, node_path_1.join)(worktree, "yarn.lock")))
        .digest("hex");
};
const lockMarker = (worktree) => {
    return (0, node_path_1.join)(worktree, "node_modules", ".rn-grab-review-lock");
};
const createInstallDeps = (runInstall) => {
    return async (worktree) => {
        const sha1 = lockSha1(worktree);
        const marker = lockMarker(worktree);
        if ((0, node_fs_1.existsSync)(marker) && (0, node_fs_1.readFileSync)(marker, "utf8").trim() === sha1) {
            return;
        }
        await runInstall(worktree);
        (0, node_fs_1.mkdirSync)((0, node_path_1.dirname)(marker), { recursive: true });
        (0, node_fs_1.writeFileSync)(marker, `${sha1}\n`, "utf8");
    };
};
exports.createInstallDeps = createInstallDeps;
//# sourceMappingURL=start.js.map