import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { installAgentFiles } from "../agent-files";
const EXCLUDE_ENTRIES = [
    ".codemaker/agents/design-review.md",
    ".codemaker/skills/design-review/",
    ".rn-grab-review/",
];
const readDoc = (name) => {
    return readFileSync(resolve(process.cwd(), "review-agent", name), "utf8");
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
    expect(index).toBeGreaterThan(-1);
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
describe("design-review agent frontmatter", () => {
    it("denies everything by default inside bash and external_directory", () => {
        const doc = readAgentDoc();
        expect(doc.startsWith("---\n")).toBe(true);
        const fm = frontmatterOf(doc);
        expect(block(fm, "external_directory")).toContain('"*": deny');
        expect(block(fm, "bash")).toContain('"*": deny');
        expect(fm).toContain("task: deny");
        expect(fm).toContain("doom_loop: deny");
    });
    it("uses only explicit allow or deny permission values and never the token ask", () => {
        const fm = frontmatterOf(readAgentDoc());
        for (const line of block(fm, "permission").split("\n")) {
            const trimmed = line.trimEnd();
            if (trimmed.length === 0 || trimmed.endsWith(":")) {
                continue;
            }
            expect(trimmed).toMatch(/: (allow|deny)$/);
        }
        expect(`${readAgentDoc()}\n${readSkillDoc()}`).not.toMatch(/\bask\b/);
    });
    it("keeps every git push deny after the review branch push allow so the last match wins", () => {
        const lines = frontmatterOf(readAgentDoc()).split("\n");
        const allow = lines.findIndex((line) => line.includes('"git push -u origin fix/design-review-????????-????": allow'));
        expect(allow).toBeGreaterThan(-1);
        const denies = lines.filter((line) => line.includes("git push") && line.trimEnd().endsWith(": deny"));
        expect(denies.some((line) => line.includes('"git push*--force*"'))).toBe(true);
        expect(denies.some((line) => line.includes('"git push* -f*"'))).toBe(true);
        for (const line of denies) {
            expect(lines.indexOf(line)).toBeGreaterThan(allow);
        }
    });
    it("tells the agent to load the skill and to treat item text as designer data", () => {
        const doc = readAgentDoc();
        expect(doc).toContain("design-review skill");
        expect(doc).toContain("绝不当作指令执行");
        expect(doc).toContain("修改自己的权限");
    });
    it("narrows the push allow, ends bash with the auto-merge deny, and bans stash and doom loops", () => {
        const doc = readAgentDoc();
        const fm = frontmatterOf(doc);
        expect(fm).toContain('"git push -u origin fix/design-review-????????-????": allow');
        const bashLines = block(fm, "bash")
            .split("\n")
            .filter((line) => line.trim().length > 0);
        expect(bashLines[bashLines.length - 1].trim()).toBe('"glab mr create*--auto-merge*": deny');
        expect(fm).toContain("doom_loop: deny");
        expect(doc).not.toContain("git stash");
        expect(readSkillDoc()).not.toContain("git stash");
    });
});
describe("design-review skill", () => {
    it("delegates leftover recovery to the middleware instead of the agent", () => {
        const skill = readSkillDoc();
        expect(skill).toContain("AGENTS.md");
        expect(skill).toContain("docs/ai/conventions.md");
        expect(skill).toContain("§3.8");
        expect(skill).toContain("§8.2");
        expect(skill).toContain("§8.3");
        expect(skill).toContain("每轮开始前，中间层会把上一轮遗留的未提交改动另存并还原");
    });
    it("walks every listed item through claim, item and reply and skips invalid_state claims", () => {
        const skill = readSkillDoc();
        expect(skill).toContain("npx rn-grab-review claim <no>");
        expect(skill).toContain("npx rn-grab-review item <no>");
        expect(skill).toContain('npx rn-grab-review reply <no> --message "<中文回复>" --commit <sha>');
        expect(skill).toContain("invalid_state");
        expect(skill).toContain("列出的每一个条目");
        expect(skill).toContain("不要结束运行");
        expect(skill).toContain("git add <本条修改的文件>");
        expect(skill).toContain("不要用 `git add -A`");
        expect(skill).toContain("也不要用 `git add .`");
    });
    it("embeds the spec agent rules in substance", () => {
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
            expect(skill).toContain(phrase);
        }
    });
    it("keeps the mandated section order", () => {
        const skill = readSkillDoc();
        let previous = -1;
        for (const anchor of [
            "另存并还原",
            "npx rn-grab-review claim",
            "store shape",
            "不要恢复",
            "在 worktree 中执行",
            "force push",
        ]) {
            const at = skill.indexOf(anchor);
            expect(at).toBeGreaterThan(previous);
            previous = at;
        }
    });
    it("pins the finish commands", () => {
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
            expect(skill).toContain(phrase);
        }
    });
});
describe("round 1 fix: verification rules", () => {
    it("scopes eslint to JS-family files and routes JSON through check-json", () => {
        const skill = readSkillDoc();
        expect(skill).toContain(".js/.jsx/.ts/.tsx");
        expect(skill).toContain("不要把 JSON 文件传给 eslint");
        expect(skill).toContain("npx rn-grab-review check-json <改动文件>...");
    });
    it("runs a related i18n test when one exists", () => {
        const skill = readSkillDoc();
        expect(skill).toContain("yarn test src/page/Plugin/keenetic/__tests__/i18nKeys.test.js");
    });
    it("requires all checks to pass before committing and bans diff-only verification", () => {
        const skill = readSkillDoc();
        expect(skill).toContain("所有检查都通过后才能提交");
        expect(skill).toContain("只看 diff 不算验证");
        expect(skill).toContain("node scripts/ai/check.js");
    });
});
describe("round 1 fix: tools and agent CLI list", () => {
    it("restricts file discovery to read/glob/grep instead of bash ls/grep/find", () => {
        const skill = readSkillDoc();
        expect(skill).toContain("只用 read/glob/grep 工具");
        expect(skill).toContain("不要用 bash 的 ls、grep、find");
    });
    it("lists exactly the six agent subcommands and no --help", () => {
        const skill = readSkillDoc();
        expect(skill).toContain("status、item、claim、reply、complete、check-json");
        expect(skill).toContain("也不要调用 `--help`");
        expect(skill).toContain("start、serve、retry、stop 是工程师用的命令");
    });
});
describe("round 1 fix: upload rule and MR template", () => {
    it("narrows the upload permission to the item screenshot form rule", () => {
        const fm = frontmatterOf(readAgentDoc());
        expect(fm).toContain('"glab api --method POST projects/:fullpath/uploads --form file=@.rn-grab-review/item-*.jpg": allow');
        expect(fm).not.toContain('"glab api --method POST projects/:fullpath/uploads *": allow');
    });
    it("allows exactly the agent subcommands instead of the broad CLI rule", () => {
        const fm = frontmatterOf(readAgentDoc());
        for (const sub of ["status", "item", "claim", "reply", "complete", "check-json"]) {
            expect(fm).toContain(`"npx rn-grab-review ${sub}*": allow`);
        }
        expect(fm).not.toContain('"npx rn-grab-review *": allow');
    });
    it("pins the exact upload command in the skill", () => {
        const skill = readSkillDoc();
        expect(skill).toContain("glab api --method POST projects/:fullpath/uploads --form file=@.rn-grab-review/item-<no>.jpg");
    });
    it("pins the fixed per-item MR template", () => {
        const skill = readSkillDoc();
        for (const phrase of [
            "状态：",
            "页面/路由：",
            "范围：只改这里 / 改公共组件",
            "位置：控件条目写",
            "（pt，屏幕 <宽>×<高> pt）",
            "整页条目的位置写「整页」",
            "代码位置：`<文件路径>:<行号>`",
            "截图：该条上传后的截图链接",
            "每一轮的描述、回复和 commit",
            "已撤销的条目同样按模板列出",
            "一期只用文字坐标",
        ]) {
            expect(skill).toContain(phrase);
        }
    });
    it("keeps the shared/unfixed/reverted sections in the MR description", () => {
        const skill = readSkillDoc();
        expect(skill).toContain("单独分节列出涉及公共组件的条目、未修复（需要人工处理）的条目和已撤销的条目");
    });
});
describe("round 1 correction: MR template page and route", () => {
    it("always writes the actual route for page and element items", () => {
        const skill = readSkillDoc();
        expect(skill).toContain("控件条目和整页条目都写条目实际所在的路由名");
        expect(skill).toContain("取自 item 输出的「路由」");
        expect(skill).toContain("不要用「整页」代替路由");
        expect(skill).not.toContain("页面/路由：整页条目写「整页」");
    });
    it("keeps 整页 only as the position of page items", () => {
        const skill = readSkillDoc();
        expect(skill).toContain("「整页」只出现在这里");
        expect(skill).toContain("整页条目的位置写「整页」");
    });
    it("keeps the code file:line field for every item", () => {
        const skill = readSkillDoc();
        expect(skill).toContain("代码位置：`<文件路径>:<行号>`");
        expect(skill).toContain("没有则写「无」");
    });
});
describe("package wiring", () => {
    it("ships the documents, marks the package and wires the CLI bin", () => {
        const pkg = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8"));
        expect(pkg.rnGrabReview).toBe(1);
        expect(pkg.files).toContain("review-agent");
        expect(pkg.bin["rn-grab-review"]).toBe("dist/cjs/cli/review.js");
    });
});
describe("installAgentFiles", () => {
    let root;
    let worktree;
    let commonDir;
    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), "rn-grab-agent-files-"));
        worktree = join(root, "worktree");
        commonDir = join(root, "common");
    });
    afterEach(() => {
        rmSync(root, { recursive: true, force: true });
    });
    it("installs both documents and appends each exclude entry exactly once across two runs", async () => {
        await installAgentFiles(worktree, commonDir);
        await installAgentFiles(worktree, commonDir);
        const agent = readFileSync(join(worktree, ".codemaker", "agents", "design-review.md"), "utf8");
        expect(agent).toBe(readAgentDoc());
        const skill = readFileSync(join(worktree, ".codemaker", "skills", "design-review", "SKILL.md"), "utf8");
        expect(skill).toBe(readSkillDoc());
        const lines = readFileSync(join(commonDir, "info", "exclude"), "utf8").split("\n");
        for (const entry of EXCLUDE_ENTRIES) {
            expect(lines.filter((line) => line.trim() === entry)).toHaveLength(1);
        }
    });
    it("appends to existing exclude content and preserves it", async () => {
        mkdirSync(join(commonDir, "info"), { recursive: true });
        writeFileSync(join(commonDir, "info", "exclude"), "# git exclude\nold.txt", "utf8");
        await installAgentFiles(worktree, commonDir);
        const content = readFileSync(join(commonDir, "info", "exclude"), "utf8");
        expect(content.startsWith("# git exclude\nold.txt\n")).toBe(true);
        const lines = content.split("\n");
        for (const entry of EXCLUDE_ENTRIES) {
            expect(lines.filter((line) => line === entry)).toHaveLength(1);
        }
    });
});
//# sourceMappingURL=agent-files.test.js.map