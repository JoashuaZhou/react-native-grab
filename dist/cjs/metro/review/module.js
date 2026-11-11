"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createReviewModule = void 0;
const node_fs_1 = require("node:fs");
const transitions_1 = require("../../review-core/transitions");
const codemaker_1 = require("./codemaker");
const git_1 = require("./git");
const http_1 = require("./http");
const runner_1 = require("./runner");
const store_1 = require("./store");
const createReviewModule = (dir) => {
    const store = store_1.ReviewStore.load(dir);
    const lock = (0, runner_1.createAgentLock)(store.lockPath());
    const logFile = store.agentLogPath();
    const log = (line) => {
        (0, node_fs_1.appendFileSync)(logFile, `${line}\n`, "utf8");
    };
    const git = (0, git_1.createGit)();
    const run = async (message) => {
        const review = store.get();
        const args = review.sessionId === null
            ? (0, codemaker_1.codemakerArgs)({ worktree: review.worktree, message, title: `设计走查 ${review.id}` })
            : (0, codemaker_1.codemakerArgs)({ worktree: review.worktree, message, sessionId: review.sessionId });
        const result = await (0, codemaker_1.spawnCodemaker)(review.codemakerBin, args, logFile, (pid) => {
            lock.write(pid);
        });
        const sessionId = (0, codemaker_1.parseSessionId)(result.stdout);
        if (sessionId !== null && store.get().sessionId === null) {
            store.update((current) => ({ ...current, sessionId }));
        }
        return { exitCode: result.exitCode };
    };
    const runner = new runner_1.AgentRunner({ store, git: { hasNetDiff: git.hasNetDiff }, run, lock, log });
    if (lock.livePid() === null) {
        store.update((review) => (0, transitions_1.releaseFixing)(review, runner_1.RESTART_RELEASE_MESSAGE));
    }
    runner.kick();
    const handler = (0, http_1.createReviewHandler)({ store, git, runner, now: () => new Date() });
    return { handler, runner };
};
exports.createReviewModule = createReviewModule;
//# sourceMappingURL=module.js.map