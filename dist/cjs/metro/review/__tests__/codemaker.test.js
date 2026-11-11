"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_os_1 = require("node:os");
const node_path_1 = require("node:path");
const vitest_1 = require("vitest");
const codemaker_1 = require("../codemaker");
let root;
(0, vitest_1.beforeEach)(() => {
    root = (0, node_fs_1.mkdtempSync)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "rn-grab-codemaker-"));
});
(0, vitest_1.afterEach)(() => {
    (0, node_fs_1.rmSync)(root, { recursive: true, force: true });
});
(0, vitest_1.describe)("codemakerArgs", () => {
    (0, vitest_1.it)("uses the pinned agent name", () => {
        (0, vitest_1.expect)(codemaker_1.AGENT_NAME).toBe("design-review");
    });
    (0, vitest_1.it)("builds the exact argv for continuing a session", () => {
        (0, vitest_1.expect)((0, codemaker_1.codemakerArgs)({ worktree: "/wt", message: "修复 #1", sessionId: "ses_x" })).toEqual([
            "run",
            "--dir",
            "/wt",
            "--agent",
            "design-review",
            "--format",
            "json",
            "--session",
            "ses_x",
            "修复 #1",
        ]);
    });
    (0, vitest_1.it)("builds the exact argv for starting a titled session", () => {
        (0, vitest_1.expect)((0, codemaker_1.codemakerArgs)({ worktree: "/wt", message: "修复 #1", title: "设计走查" })).toEqual([
            "run",
            "--dir",
            "/wt",
            "--agent",
            "design-review",
            "--format",
            "json",
            "--title",
            "设计走查",
            "修复 #1",
        ]);
    });
});
(0, vitest_1.describe)("parseSessionId", () => {
    (0, vitest_1.it)("reads ses_x from the first step_start line", () => {
        const lines = '{"type":"step_start","timestamp":1,"sessionID":"ses_x","part":{}}';
        (0, vitest_1.expect)((0, codemaker_1.parseSessionId)(lines)).toBe("ses_x");
    });
    (0, vitest_1.it)("skips lines that carry no session id", () => {
        const lines = ['{"type":"other","part":{}}', '{"sessionID":"ses_y"}', "not json"].join("\n");
        (0, vitest_1.expect)((0, codemaker_1.parseSessionId)(lines)).toBe("ses_y");
    });
    (0, vitest_1.it)("returns null when no line carries a session id", () => {
        (0, vitest_1.expect)((0, codemaker_1.parseSessionId)('plain text\n{"type":"step_start"}')).toBeNull();
        (0, vitest_1.expect)((0, codemaker_1.parseSessionId)("")).toBeNull();
    });
});
(0, vitest_1.describe)("spawnCodemaker", () => {
    (0, vitest_1.it)("appends stdout and stderr to the log, reports the pid and resolves the result", async () => {
        const logFile = (0, node_path_1.join)(root, "agent.log");
        (0, node_fs_1.writeFileSync)(logFile, "existing\n", "utf8");
        const pids = [];
        const script = "console.log('out-line'); console.error('err-line');";
        const result = await (0, codemaker_1.spawnCodemaker)(process.execPath, ["-e", script], logFile, (pid) => {
            pids.push(pid);
        });
        (0, vitest_1.expect)(result.exitCode).toBe(0);
        (0, vitest_1.expect)(result.stdout).toContain("out-line");
        (0, vitest_1.expect)(pids).toHaveLength(1);
        (0, vitest_1.expect)(pids[0]).toBeGreaterThan(0);
        const log = (0, node_fs_1.readFileSync)(logFile, "utf8");
        (0, vitest_1.expect)(log).toContain("existing\n");
        (0, vitest_1.expect)(log).toContain("out-line");
        (0, vitest_1.expect)(log).toContain("err-line");
    });
    (0, vitest_1.it)("reports non-zero exit codes", async () => {
        const result = await (0, codemaker_1.spawnCodemaker)(process.execPath, ["-e", "process.exit(3)"], (0, node_path_1.join)(root, "agent.log"), () => { });
        (0, vitest_1.expect)(result.exitCode).toBe(3);
    });
    (0, vitest_1.it)("resolves with exit code -1 when the bin cannot be spawned", async () => {
        const logFile = (0, node_path_1.join)(root, "agent.log");
        const pids = [];
        const result = await (0, codemaker_1.spawnCodemaker)((0, node_path_1.join)(root, "missing-bin"), ["--version"], logFile, (pid) => {
            pids.push(pid);
        });
        (0, vitest_1.expect)(result.exitCode).toBe(-1);
        (0, vitest_1.expect)(result.stdout).toBe("");
        (0, vitest_1.expect)(pids).toHaveLength(0);
        (0, vitest_1.expect)((0, node_fs_1.readFileSync)(logFile, "utf8").length).toBeGreaterThan(0);
    });
});
//# sourceMappingURL=codemaker.test.js.map