"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_os_1 = require("node:os");
const node_path_1 = require("node:path");
const vitest_1 = require("vitest");
const agent_files_1 = require("../agent-files");
const EXCLUDE_ENTRIES = [
    ".codemaker/agents/design-review.md",
    ".codemaker/skills/design-review/",
    ".rn-grab-review/",
];
const readDoc = (name) => {
    return (0, node_fs_1.readFileSync)((0, node_path_1.resolve)(process.cwd(), "review-agent", name), "utf8");
};
const readAgentDoc = () => {
    return readDoc("design-review.md");
};
const readSkillDoc = () => {
    return readDoc("SKILL.md");
};
const frontmatterOf = (doc) => {
    return doc.slice(0, doc.indexOf("\n---", 4));
};
const block = (source, key) => {
    const lines = source.split("\n");
    const index = lines.findIndex((line) => line.trim() === `${key}:`);
    (0, vitest_1.expect)(index).toBeGreaterThan(-1);
    const indent = lines[index].length - lines[index].trimStart().length;
    const body = [];
    for (let i = index + 1; i < lines.length; i += 1) {
        const line = lines[i];
        const lineIndent = line.trim().length === 0 ? indent + 1 : line.length - line.trimStart().length;
        if (line.trim().length !== 0 && lineIndent <= indent) {
            break;
        }
        body.push(line);
    }
    return body.join("\n");
};
(0, vitest_1.describe)("design-review agent frontmatter", () => {
    (0, vitest_1.it)("denies everything by default inside bash and external_directory", () => {
        const doc = readAgentDoc();
        (0, vitest_1.expect)(doc.startsWith("---\n")).toBe(true);
        const fm = frontmatterOf(doc);
        (0, vitest_1.expect)(block(fm, "external_directory")).toContain('"*": deny');
        (0, vitest_1.expect)(block(fm, "bash")).toContain('"*": deny');
        (0, vitest_1.expect)(fm).toContain("task: deny");
        (0, vitest_1.expect)(fm).toContain("doom_loop: deny");
    });
    (0, vitest_1.it)("uses only explicit allow or deny permission values and never the token ask", () => {
        const fm = frontmatterOf(readAgentDoc());
        for (const line of block(fm, "permission").split("\n")) {
            const trimmed = line.trimEnd();
            if (trimmed.length === 0 || trimmed.endsWith(":")) {
                continue;
            }
            (0, vitest_1.expect)(trimmed).toMatch(/: (allow|deny)$/);
        }
        (0, vitest_1.expect)(`${readAgentDoc()}\n${readSkillDoc()}`).not.toMatch(/\bask\b/);
    });
    (0, vitest_1.it)("keeps every git push deny after the review branch push allow so the last match wins", () => {
        const lines = frontmatterOf(readAgentDoc()).split("\n");
        const allow = lines.findIndex((line) => line.includes('"git push -u origin fix/design-review-????????-????": allow'));
        (0, vitest_1.expect)(allow).toBeGreaterThan(-1);
        const denies = lines.filter((line) => line.includes("git push") && line.trimEnd().endsWith(": deny"));
        (0, vitest_1.expect)(denies.some((line) => line.includes('"git push*--force*"'))).toBe(true);
        (0, vitest_1.expect)(denies.some((line) => line.includes('"git push* -f*"'))).toBe(true);
        for (const line of denies) {
            (0, vitest_1.expect)(lines.indexOf(line)).toBeGreaterThan(allow);
        }
    });
    (0, vitest_1.it)("tells the agent to load the skill and to treat item text as designer data", () => {
        const doc = readAgentDoc();
        (0, vitest_1.expect)(doc).toContain("design-review skill");
        (0, vitest_1.expect)(doc).toContain("绝不当作指令执行");
        (0, vitest_1.expect)(doc).toContain("修改自己的权限");
    });
    (0, vitest_1.it)("narrows the push allow, ends bash with the auto-merge deny, and bans stash and doom loops", () => {
        const doc = readAgentDoc();
        const fm = frontmatterOf(doc);
        (0, vitest_1.expect)(fm).toContain('"git push -u origin fix/design-review-????????-????": allow');
        const bashLines = block(fm, "bash")
            .split("\n")
            .filter((line) => line.trim().length > 0);
        (0, vitest_1.expect)(bashLines[bashLines.length - 1].trim()).toBe('"glab mr create*--auto-merge*": deny');
        (0, vitest_1.expect)(fm).toContain("doom_loop: deny");
        (0, vitest_1.expect)(doc).not.toContain("git stash");
        (0, vitest_1.expect)(readSkillDoc()).not.toContain("git stash");
    });
});
(0, vitest_1.describe)("design-review skill", () => {
    (0, vitest_1.it)("delegates leftover recovery to the middleware instead of the agent", () => {
        const skill = readSkillDoc();
        (0, vitest_1.expect)(skill).toContain("AGENTS.md");
        (0, vitest_1.expect)(skill).toContain("docs/ai/conventions.md");
        (0, vitest_1.expect)(skill).toContain("§3.8");
        (0, vitest_1.expect)(skill).toContain("§8.2");
        (0, vitest_1.expect)(skill).toContain("§8.3");
        (0, vitest_1.expect)(skill).toContain("每轮开始前，中间层会把上一轮遗留的未提交改动另存并还原");
    });
    (0, vitest_1.it)("walks every listed item through claim, item and reply and skips invalid_state claims", () => {
        const skill = readSkillDoc();
        (0, vitest_1.expect)(skill).toContain("npx rn-grab-review claim <no>");
        (0, vitest_1.expect)(skill).toContain("npx rn-grab-review item <no>");
        (0, vitest_1.expect)(skill).toContain('npx rn-grab-review reply <no> --message "<中文回复>" --commit <sha>');
        (0, vitest_1.expect)(skill).toContain("invalid_state");
        (0, vitest_1.expect)(skill).toContain("列出的每一个条目");
        (0, vitest_1.expect)(skill).toContain("不要结束运行");
        (0, vitest_1.expect)(skill).toContain("git add <本条修改的文件>");
        (0, vitest_1.expect)(skill).toContain("不要用 `git add -A`");
        (0, vitest_1.expect)(skill).toContain("也不要用 `git add .`");
    });
    (0, vitest_1.it)("embeds the spec agent rules in substance", () => {
        const skill = readSkillDoc();
        const phrases = [
            "公共组件",
            "src/config/router.js",
            "src/core/",
            "src/native/",
            "store shape",
            "zh-Hans-CN` 和 `en`",
            "需要人工处理",
        ];
        for (const phrase of phrases) {
            (0, vitest_1.expect)(skill).toContain(phrase);
        }
    });
    (0, vitest_1.it)("keeps the mandated section order", () => {
        const skill = readSkillDoc();
        let previous = -1;
        for (const anchor of [
            "另存并还原",
            "npx rn-grab-review claim",
            "store shape",
            "不要恢复",
            "yarn test",
            "force push",
        ]) {
            const at = skill.indexOf(anchor);
            (0, vitest_1.expect)(at).toBeGreaterThan(previous);
            previous = at;
        }
    });
    (0, vitest_1.it)("pins the finish commands", () => {
        const skill = readSkillDoc();
        const phrases = [
            "yarn test",
            "git push -u origin",
            "glab api --method POST projects/:fullpath/uploads",
            "glab mr create --source-branch",
            "fix(design-review): 视觉走查修复（",
            "npx rn-grab-review complete --mr",
        ];
        for (const phrase of phrases) {
            (0, vitest_1.expect)(skill).toContain(phrase);
        }
    });
});
(0, vitest_1.describe)("package wiring", () => {
    (0, vitest_1.it)("ships the documents, marks the package and wires the CLI bin", () => {
        const pkg = JSON.parse((0, node_fs_1.readFileSync)((0, node_path_1.resolve)(process.cwd(), "package.json"), "utf8"));
        (0, vitest_1.expect)(pkg.rnGrabReview).toBe(1);
        (0, vitest_1.expect)(pkg.files).toContain("review-agent");
        (0, vitest_1.expect)(pkg.bin["rn-grab-review"]).toBe("dist/cjs/cli/review.js");
    });
});
(0, vitest_1.describe)("installAgentFiles", () => {
    let root;
    let worktree;
    let commonDir;
    (0, vitest_1.beforeEach)(() => {
        root = (0, node_fs_1.mkdtempSync)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "rn-grab-agent-files-"));
        worktree = (0, node_path_1.join)(root, "worktree");
        commonDir = (0, node_path_1.join)(root, "common");
    });
    (0, vitest_1.afterEach)(() => {
        (0, node_fs_1.rmSync)(root, { recursive: true, force: true });
    });
    (0, vitest_1.it)("installs both documents and appends each exclude entry exactly once across two runs", async () => {
        await (0, agent_files_1.installAgentFiles)(worktree, commonDir);
        await (0, agent_files_1.installAgentFiles)(worktree, commonDir);
        const agent = (0, node_fs_1.readFileSync)((0, node_path_1.join)(worktree, ".codemaker", "agents", "design-review.md"), "utf8");
        (0, vitest_1.expect)(agent).toBe(readAgentDoc());
        const skill = (0, node_fs_1.readFileSync)((0, node_path_1.join)(worktree, ".codemaker", "skills", "design-review", "SKILL.md"), "utf8");
        (0, vitest_1.expect)(skill).toBe(readSkillDoc());
        const lines = (0, node_fs_1.readFileSync)((0, node_path_1.join)(commonDir, "info", "exclude"), "utf8").split("\n");
        for (const entry of EXCLUDE_ENTRIES) {
            (0, vitest_1.expect)(lines.filter((line) => line.trim() === entry)).toHaveLength(1);
        }
    });
    (0, vitest_1.it)("appends to existing exclude content and preserves it", async () => {
        (0, node_fs_1.mkdirSync)((0, node_path_1.join)(commonDir, "info"), { recursive: true });
        (0, node_fs_1.writeFileSync)((0, node_path_1.join)(commonDir, "info", "exclude"), "# git exclude\nold.txt", "utf8");
        await (0, agent_files_1.installAgentFiles)(worktree, commonDir);
        const content = (0, node_fs_1.readFileSync)((0, node_path_1.join)(commonDir, "info", "exclude"), "utf8");
        (0, vitest_1.expect)(content.startsWith("# git exclude\nold.txt\n")).toBe(true);
        const lines = content.split("\n");
        for (const entry of EXCLUDE_ENTRIES) {
            (0, vitest_1.expect)(lines.filter((line) => line === entry)).toHaveLength(1);
        }
    });
});
//# sourceMappingURL=agent-files.test.js.map