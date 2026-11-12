import { spawn } from "node:child_process";
import { appendFileSync } from "node:fs";
export const AGENT_NAME = "design-review";
export const codemakerArgs = (options) => {
    const session = "sessionId" in options ? ["--session", options.sessionId] : ["--title", options.title];
    return [
        "run",
        "--dir",
        options.worktree,
        "--agent",
        AGENT_NAME,
        "--format",
        "json",
        ...session,
        options.message,
    ];
};
export const parseSessionId = (jsonLines) => {
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
export const spawnCodemaker = (bin, args, logFile, onPid) => {
    return new Promise((resolve) => {
        const child = spawn(bin, args);
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
            try {
                appendFileSync(logFile, chunk);
            }
            catch {
                return;
            }
        });
        child.stderr?.on("data", (chunk) => {
            try {
                appendFileSync(logFile, chunk);
            }
            catch {
                return;
            }
        });
        child.on("error", (error) => {
            settle(-1);
            try {
                appendFileSync(logFile, `${String(error)}\n`, "utf8");
            }
            catch {
                return;
            }
        });
        child.on("close", (code) => {
            settle(code ?? -1);
        });
    });
};
//# sourceMappingURL=codemaker.js.map