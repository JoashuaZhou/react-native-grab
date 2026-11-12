import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const EXCLUDE_ENTRIES = [
  ".codemaker/agents/design-review.md",
  ".codemaker/skills/design-review/",
  ".rn-grab-review/",
];

const isDocsDir = (dir: string): boolean => {
  return existsSync(join(dir, "design-review.md")) && existsSync(join(dir, "SKILL.md"));
};

const resolveDocsDir = (): string => {
  const candidates: string[] = [];
  let base: string | undefined;
  try {
    base = __dirname;
  } catch {
    base = undefined;
  }
  if (base !== undefined) {
    candidates.push(resolve(base, "../../../review-agent"), resolve(base, "../../review-agent"));
  }
  candidates.push(resolve(process.cwd(), "review-agent"));
  const docsDir = candidates.find(isDocsDir);
  if (docsDir === undefined) {
    throw new Error(`review-agent documents not found; searched: ${candidates.join(", ")}`);
  }
  return docsDir;
};

const appendExcludeEntries = (commonDir: string): void => {
  const infoDir = join(commonDir, "info");
  mkdirSync(infoDir, { recursive: true });
  const excludeFile = join(infoDir, "exclude");
  let current = "";
  try {
    current = readFileSync(excludeFile, "utf8");
  } catch {
    current = "";
  }
  const existing = new Set(current.split("\n").map((line) => line.trim()));
  const missing = EXCLUDE_ENTRIES.filter((entry) => !existing.has(entry));
  if (missing.length === 0) {
    return;
  }
  const prefix = current === "" || current.endsWith("\n") ? "" : "\n";
  appendFileSync(excludeFile, `${prefix}${missing.join("\n")}\n`, "utf8");
};

export const installAgentFiles = async (worktree: string, commonDir: string): Promise<void> => {
  const docsDir = resolveDocsDir();
  const agentDest = join(worktree, ".codemaker", "agents", "design-review.md");
  const skillDest = join(worktree, ".codemaker", "skills", "design-review", "SKILL.md");
  mkdirSync(dirname(agentDest), { recursive: true });
  mkdirSync(dirname(skillDest), { recursive: true });
  copyFileSync(join(docsDir, "design-review.md"), agentDest);
  copyFileSync(join(docsDir, "SKILL.md"), skillDest);
  appendExcludeEntries(commonDir);
};
