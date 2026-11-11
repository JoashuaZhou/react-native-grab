"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.spawnCodemaker = exports.parseSessionId = exports.codemakerArgs = exports.AGENT_NAME = void 0;
const node_child_process_1 = require("node:child_process");
const node_fs_1 = require("node:fs");
exports.AGENT_NAME = "design-review";
const codemakerArgs = (options) => {
    const session = "sessionId" in options ? ["--session", options.sessionId] : ["--title", options.title];
    return [
        "run",
        "--dir",
        options.worktree,
        "--agent",
        exports.AGENT_NAME,
        "--format",
        "json",
        ...session,
        options.message,
    ];
};
exports.codemakerArgs = codemakerArgs;
const parseSessionId = (jsonLines) => {
    for (const line of jsonLines.split("\n")) {
        const trimmed = line.trim();
        if (trimmed === "")
            continue;
        let parsed;
        try {
            parsed = JSON.parse(trimmed);
        }
        catch {
            continue;
        }
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed))
            continue;
        const sessionId = parsed.sessionID;
        if (typeof sessionId === "string" && sessionId !== "") {
            return sessionId;
        }
    }
    return null;
};
exports.parseSessionId = parseSessionId;
const spawnCodemaker = (bin, args, logFile, onPid) => {
    return new Promise((resolve) => {
        const child = (0, node_child_process_1.spawn)(bin, args);
        const stdoutChunks = [];
        let settled = false;
        const settle = (exitCode) => {
            if (settled)
                return;
            settled = true;
            resolve({ exitCode, stdout: Buffer.concat(stdoutChunks).toString("utf8") });
        };
        if (typeof child.pid === "number") {
            onPid(child.pid);
        }
        child.stdout?.on("data", (chunk) => {
            stdoutChunks.push(chunk);
            (0, node_fs_1.appendFileSync)(logFile, chunk);
        });
        child.stderr?.on("data", (chunk) => {
            (0, node_fs_1.appendFileSync)(logFile, chunk);
        });
        child.on("error", (error) => {
            (0, node_fs_1.appendFileSync)(logFile, `${String(error)}\n`, "utf8");
            settle(-1);
        });
        child.on("close", (code) => {
            settle(code ?? -1);
        });
    });
};
exports.spawnCodemaker = spawnCodemaker;
//# sourceMappingURL=codemaker.js.map