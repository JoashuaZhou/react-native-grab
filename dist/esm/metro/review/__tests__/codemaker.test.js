import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AGENT_NAME, codemakerArgs, parseSessionId, spawnCodemaker } from "../codemaker";
let root;
beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "rn-grab-codemaker-"));
});
afterEach(() => {
    rmSync(root, { recursive: true, force: true });
});
describe("codemakerArgs", () => {
    it("uses the pinned agent name", () => {
        expect(AGENT_NAME).toBe("design-review");
    });
    it("builds the exact argv for continuing a session", () => {
        expect(codemakerArgs({ worktree: "/wt", message: "修复 #1", sessionId: "ses_x" })).toEqual([
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
    it("builds the exact argv for starting a titled session", () => {
        expect(codemakerArgs({ worktree: "/wt", message: "修复 #1", title: "设计走查" })).toEqual([
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
describe("parseSessionId", () => {
    it("reads ses_x from the first step_start line", () => {
        const lines = '{"type":"step_start","timestamp":1,"sessionID":"ses_x","part":{}}';
        expect(parseSessionId(lines)).toBe("ses_x");
    });
    it("skips lines that carry no session id", () => {
        const lines = ['{"type":"other","part":{}}', '{"sessionID":"ses_y"}', "not json"].join("\n");
        expect(parseSessionId(lines)).toBe("ses_y");
    });
    it("returns null when no line carries a session id", () => {
        expect(parseSessionId('plain text\n{"type":"step_start"}')).toBeNull();
        expect(parseSessionId("")).toBeNull();
    });
});
describe("spawnCodemaker", () => {
    it("appends stdout and stderr to the log, reports the pid and resolves the result", async () => {
        const logFile = join(root, "agent.log");
        writeFileSync(logFile, "existing\n", "utf8");
        const pids = [];
        const script = "console.log('out-line'); console.error('err-line');";
        const result = await spawnCodemaker(process.execPath, ["-e", script], logFile, (pid) => {
            pids.push(pid);
        });
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain("out-line");
        expect(pids).toHaveLength(1);
        expect(pids[0]).toBeGreaterThan(0);
        const log = readFileSync(logFile, "utf8");
        expect(log).toContain("existing\n");
        expect(log).toContain("out-line");
        expect(log).toContain("err-line");
    });
    it("reports non-zero exit codes", async () => {
        const result = await spawnCodemaker(process.execPath, ["-e", "process.exit(3)"], join(root, "agent.log"), () => { });
        expect(result.exitCode).toBe(3);
    });
    it("resolves with exit code -1 when the bin cannot be spawned", async () => {
        const logFile = join(root, "agent.log");
        const pids = [];
        const result = await spawnCodemaker(join(root, "missing-bin"), ["--version"], logFile, (pid) => {
            pids.push(pid);
        });
        expect(result.exitCode).toBe(-1);
        expect(result.stdout).toBe("");
        expect(pids).toHaveLength(0);
        expect(readFileSync(logFile, "utf8").length).toBeGreaterThan(0);
    });
});
//# sourceMappingURL=codemaker.test.js.map