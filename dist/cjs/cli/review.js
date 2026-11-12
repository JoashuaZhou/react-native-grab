#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_child_process_1 = require("node:child_process");
const node_net_1 = require("node:net");
const node_os_1 = require("node:os");
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const args_1 = require("./args");
const check_json_1 = require("./check-json");
const local_client_1 = require("./local-client");
const start_1 = require("./start");
const agent_files_1 = require("./agent-files");
const paths_1 = require("../metro/review/paths");
const git_1 = require("../metro/review/git");
const codemaker_1 = require("../metro/review/codemaker");
const paths = (0, paths_1.getReviewPaths)();
const portFree = (port) => {
    return new Promise((resolve) => {
        const server = (0, node_net_1.createServer)();
        server.once("error", () => {
            resolve(false);
        });
        server.listen(port, "127.0.0.1", () => {
            server.close(() => {
                resolve(true);
            });
        });
    });
};
const which = (bin) => {
    const result = (0, node_child_process_1.spawnSync)("which", [bin]);
    if (result.error !== undefined || result.status !== 0) {
        return null;
    }
    return result.stdout.toString().trim() || null;
};
const randomCode = () => {
    return String((0, node_crypto_1.randomInt)(0, 1000000)).padStart(6, "0");
};
const lanAddress = () => {
    for (const addresses of Object.values((0, node_os_1.networkInterfaces)())) {
        for (const address of addresses ?? []) {
            if (address.family === "IPv4" && !address.internal) {
                return address.address;
            }
        }
    }
    return null;
};
const runCommand = (command, args, cwd) => {
    return new Promise((resolve, reject) => {
        const child = (0, node_child_process_1.spawn)(command, args, { cwd, stdio: "inherit" });
        child.once("error", reject);
        child.once("close", (code) => {
            if (code === 0) {
                resolve();
                return;
            }
            reject(new Error(`${command} ${args.join(" ")} 在 ${cwd} 失败（退出码 ${code ?? "null"}）`));
        });
    });
};
const spawnMetro = (worktree, env) => {
    return new Promise((resolve, reject) => {
        const child = (0, node_child_process_1.spawn)("npx", ["react-native", "start"], {
            cwd: worktree,
            env: { ...process.env, ...env },
            stdio: "inherit",
        });
        if (typeof child.pid === "number") {
            resolve(child.pid);
            return;
        }
        child.once("error", reject);
    });
};
const createSession = (o) => {
    const introLog = (0, node_path_1.join)(o.worktree, ".rn-grab-review", "intro.log");
    (0, node_fs_1.mkdirSync)((0, node_path_1.dirname)(introLog), { recursive: true });
    return (0, codemaker_1.spawnCodemaker)(o.bin, (0, codemaker_1.codemakerArgs)(o), introLog, () => { }).then((result) => {
        if (result.exitCode !== 0) {
            throw new Error(`codemaker 会话创建失败（退出码 ${result.exitCode}）`);
        }
        const sessionId = (0, codemaker_1.parseSessionId)(result.stdout);
        if (sessionId === null) {
            throw new Error("无法从 codemaker 输出解析会话 id");
        }
        return sessionId;
    });
};
const makeDeps = () => ({
    git: (0, git_1.createGit)(),
    paths,
    now: () => new Date(),
    portFree,
    which,
    installDeps: (0, start_1.createInstallDeps)((worktree) => runCommand("yarn", ["install", "--frozen-lockfile"], worktree)),
    installAgentFiles: agent_files_1.installAgentFiles,
    createSession,
    spawnMetro,
    randomCode,
    lanAddress,
    log: (line) => {
        console.log(line);
    },
});
const main = async (argv) => {
    const command = (0, args_1.parseArgs)(argv);
    switch (command.name) {
        case "start":
            await (0, start_1.startReview)({ repo: command.repo === undefined ? process.cwd() : command.repo, base: command.base }, makeDeps());
            return;
        case "serve":
            await (0, start_1.serveReview)(paths, {
                spawnMetro,
                log: (line) => {
                    console.log(line);
                },
            });
            return;
        case "status":
            await (0, local_client_1.printStatus)();
            return;
        case "item":
            await (0, local_client_1.showItem)(command.no, command.json);
            return;
        case "claim":
            await (0, local_client_1.claim)(command.no);
            return;
        case "reply":
            await (0, local_client_1.reply)(command.no, command.message, command.commits);
            return;
        case "complete":
            await (0, local_client_1.complete)(command.mr);
            return;
        case "retry":
            await (0, local_client_1.retry)();
            return;
        case "stop":
            await (0, local_client_1.stopReview)(paths);
            return;
        case "check-json": {
            const allValid = (0, check_json_1.runCheckJson)(command.files);
            if (!allValid) {
                process.exitCode = 1;
            }
            return;
        }
    }
};
main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
//# sourceMappingURL=review.js.map