"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentRunner = exports.createAgentLock = exports.buildAgentMessage = exports.nextWork = exports.RESTART_RELEASE_MESSAGE = exports.RUN_END_RELEASE_MESSAGE = void 0;
const node_fs_1 = require("node:fs");
const transitions_1 = require("../../review-core/transitions");
exports.RUN_END_RELEASE_MESSAGE = "agent 运行结束时该条仍在修复中";
exports.RESTART_RELEASE_MESSAGE = "Metro 重启时该条仍在修复中";
const NO_PROGRESS_LIMIT = 2;
const sleep = (ms) => {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
};
const formatNumbers = (nos) => {
    return nos.map((no) => `#${no}`).join("、");
};
const nextWork = (review) => {
    if (review.status === "active") {
        const items = review.items
            .filter((item) => item.status === "queued" || item.status === "fixing")
            .map((item) => item.no);
        if (items.length === 0) {
            return null;
        }
        return { kind: "fix", items, reverted: review.revertedSinceLastRun };
    }
    if (review.status === "finishing") {
        return { kind: "finish" };
    }
    return null;
};
exports.nextWork = nextWork;
const buildAgentMessage = (work, review) => {
    if (work.kind === "fix") {
        const lines = [`请使用 design-review skill 处理走查条目：${formatNumbers(work.items)}。`];
        if (work.reverted.length > 0) {
            lines.push(`设计师已撤销 ${formatNumbers(work.reverted)}，不要恢复这些条目的改动。`);
        }
        return lines.join("\n");
    }
    return [
        "所有走查条目均已处理，请收尾。",
        `当前分支：${review.branch}，基准分支：${review.base}。`,
        "请推送分支并创建 MR，然后运行 npx rn-grab-review complete --mr <MR链接> 提交完成。",
    ].join("\n");
};
exports.buildAgentMessage = buildAgentMessage;
const isPidAlive = (pid) => {
    try {
        process.kill(pid, 0);
        return true;
    }
    catch (error) {
        return error.code === "EPERM";
    }
};
const createAgentLock = (lockFile) => ({
    write(pid) {
        (0, node_fs_1.writeFileSync)(lockFile, String(pid), "utf8");
    },
    clear() {
        (0, node_fs_1.rmSync)(lockFile, { force: true });
    },
    livePid() {
        let text;
        try {
            text = (0, node_fs_1.readFileSync)(lockFile, "utf8");
        }
        catch {
            return null;
        }
        const pid = Number.parseInt(text.trim(), 10);
        if (!Number.isInteger(pid) || pid <= 0) {
            return null;
        }
        return isPidAlive(pid) ? pid : null;
    },
});
exports.createAgentLock = createAgentLock;
const itemStatus = (review, no) => {
    return review.items.find((item) => item.no === no)?.status ?? null;
};
class AgentRunner {
    constructor(deps) {
        this.running = false;
        this.waitingOrphan = false;
        this.exclusive = false;
        this.stopped = false;
        this.blockedState = false;
        this.noProgressStreak = 0;
        this.pendingKick = false;
        this.draining = false;
        this.idleWaiters = [];
        this.store = deps.store;
        this.git = deps.git;
        this.run = deps.run;
        this.lock = deps.lock;
        this.log = deps.log;
        this.orphanPollMs = deps.orphanPollMs ?? 5000;
    }
    get busy() {
        return this.running || this.waitingOrphan || this.exclusive;
    }
    get blocked() {
        return this.blockedState;
    }
    kick() {
        this.pendingKick = true;
        void this.drain();
    }
    unblock() {
        this.blockedState = false;
        this.noProgressStreak = 0;
        this.kick();
    }
    stop() {
        this.stopped = true;
        this.pendingKick = false;
        this.notifyIdle();
    }
    async runExclusive(fn) {
        if (this.busy) {
            throw new transitions_1.ReviewError("runner_busy", "走查执行器忙");
        }
        this.exclusive = true;
        try {
            return await fn();
        }
        finally {
            this.exclusive = false;
            this.kick();
        }
    }
    async whenIdle() {
        while (this.busy || this.draining || this.pendingKick) {
            await new Promise((resolve) => {
                this.idleWaiters.push(resolve);
            });
        }
    }
    notifyIdle() {
        const waiters = this.idleWaiters;
        this.idleWaiters = [];
        for (const resolve of waiters) {
            resolve();
        }
    }
    async drain() {
        if (this.draining)
            return;
        this.draining = true;
        try {
            while (this.pendingKick) {
                this.pendingKick = false;
                await this.tryRun();
                this.notifyIdle();
            }
        }
        catch (error) {
            this.log(`agent 调度异常：${String(error)}`);
        }
        finally {
            this.draining = false;
            this.notifyIdle();
        }
    }
    async tryRun() {
        if (this.stopped || this.blockedState || this.busy) {
            return;
        }
        const work = (0, exports.nextWork)(this.store.get());
        if (work === null) {
            return;
        }
        this.running = true;
        try {
            let waitedForOrphan = false;
            while (!this.stopped) {
                const live = this.lock.livePid();
                if (live === null)
                    break;
                waitedForOrphan = true;
                this.waitingOrphan = true;
                this.log(`等待上一次 agent 进程 ${live} 退出`);
                await sleep(this.orphanPollMs);
            }
            this.waitingOrphan = false;
            if (this.stopped) {
                return;
            }
            this.lock.clear();
            if (waitedForOrphan) {
                this.store.update((review) => (0, transitions_1.releaseFixing)(review, exports.RESTART_RELEASE_MESSAGE));
            }
            if (work.kind === "finish") {
                const review = this.store.get();
                const netDiff = await this.git.hasNetDiff(review.worktree, review.base);
                if (this.stopped) {
                    return;
                }
                if (!netDiff) {
                    if (this.store.get().status === "finishing") {
                        this.store.update((current) => (0, transitions_1.completeReview)(current, null));
                    }
                    return;
                }
            }
            const message = (0, exports.buildAgentMessage)(work, this.store.get());
            this.log(work.kind === "fix"
                ? `启动 agent 处理条目 ${formatNumbers(work.items)}`
                : "启动 agent 收尾");
            let exitCode;
            try {
                const result = await this.run(message);
                exitCode = result.exitCode;
            }
            catch (error) {
                this.log(`agent 运行异常退出：${String(error)}`);
                exitCode = -1;
            }
            finally {
                this.lock.clear();
            }
            const after = this.store.update((review) => ({
                ...(0, transitions_1.releaseFixing)(review, exports.RUN_END_RELEASE_MESSAGE),
                revertedSinceLastRun: [],
            }));
            const progressed = work.kind === "fix"
                ? exitCode === 0 &&
                    work.items.every((no) => {
                        const status = itemStatus(after, no);
                        return status !== "queued" && status !== "fixing";
                    })
                : exitCode === 0 && after.status === "done";
            if (progressed) {
                this.noProgressStreak = 0;
                return;
            }
            this.noProgressStreak += 1;
            if (this.noProgressStreak >= NO_PROGRESS_LIMIT) {
                this.blockedState = true;
                this.log("agent 连续两次运行没有进展，已暂停，等待手动重试");
                return;
            }
            this.kick();
        }
        finally {
            this.running = false;
            this.notifyIdle();
        }
    }
}
exports.AgentRunner = AgentRunner;
//# sourceMappingURL=runner.js.map