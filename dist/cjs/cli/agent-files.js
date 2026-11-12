"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.installAgentFiles = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const EXCLUDE_ENTRIES = [
    ".codemaker/agents/design-review.md",
    ".codemaker/skills/design-review/",
    ".rn-grab-review/",
];
const isDocsDir = (dir) => {
    return (0, node_fs_1.existsSync)((0, node_path_1.join)(dir, "design-review.md")) && (0, node_fs_1.existsSync)((0, node_path_1.join)(dir, "SKILL.md"));
};
const resolveDocsDir = () => {
    const candidates = [];
    let base;
    try {
        base = __dirname;
    }
    catch {
        base = undefined;
    }
    if (base !== undefined) {
        candidates.push((0, node_path_1.resolve)(base, "../../../review-agent"), (0, node_path_1.resolve)(base, "../../review-agent"));
    }
    candidates.push((0, node_path_1.resolve)(process.cwd(), "review-agent"));
    const docsDir = candidates.find(isDocsDir);
    if (docsDir === undefined) {
        throw new Error(`review-agent documents not found; searched: ${candidates.join(", ")}`);
    }
    return docsDir;
};
const appendExcludeEntries = (commonDir) => {
    const infoDir = (0, node_path_1.join)(commonDir, "info");
    (0, node_fs_1.mkdirSync)(infoDir, { recursive: true });
    const excludeFile = (0, node_path_1.join)(infoDir, "exclude");
    let current = "";
    try {
        current = (0, node_fs_1.readFileSync)(excludeFile, "utf8");
    }
    catch {
        current = "";
    }
    const existing = new Set(current.split("\n").map((line) => line.trim()));
    const missing = EXCLUDE_ENTRIES.filter((entry) => !existing.has(entry));
    if (missing.length === 0) {
        return;
    }
    const prefix = current === "" || current.endsWith("\n") ? "" : "\n";
    (0, node_fs_1.appendFileSync)(excludeFile, `${prefix}${missing.join("\n")}\n`, "utf8");
};
const installAgentFiles = async (worktree, commonDir) => {
    const docsDir = resolveDocsDir();
    const agentDest = (0, node_path_1.join)(worktree, ".codemaker", "agents", "design-review.md");
    const skillDest = (0, node_path_1.join)(worktree, ".codemaker", "skills", "design-review", "SKILL.md");
    (0, node_fs_1.mkdirSync)((0, node_path_1.dirname)(agentDest), { recursive: true });
    (0, node_fs_1.mkdirSync)((0, node_path_1.dirname)(skillDest), { recursive: true });
    (0, node_fs_1.copyFileSync)((0, node_path_1.join)(docsDir, "design-review.md"), agentDest);
    (0, node_fs_1.copyFileSync)((0, node_path_1.join)(docsDir, "SKILL.md"), skillDest);
    appendExcludeEntries(commonDir);
};
exports.installAgentFiles = installAgentFiles;
//# sourceMappingURL=agent-files.js.map