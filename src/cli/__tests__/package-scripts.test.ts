import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type PackageJson = {
  scripts: Record<string, string>;
};

const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as PackageJson;

describe("package scripts", () => {
  it("installs husky on demand via setup-hooks instead of the prepare lifecycle", () => {
    // Yarn 1 runs `prepare` for git dependencies, which triggered a nested
    // full devDependency install in CI; hooks must be opt-in now.
    expect(pkg.scripts["setup-hooks"]).toBe("husky");
    expect(pkg.scripts.prepare).toBeUndefined();
  });
});
