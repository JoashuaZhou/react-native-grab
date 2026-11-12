"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const vitest_1 = require("vitest");
const pkg = JSON.parse((0, node_fs_1.readFileSync)((0, node_path_1.join)(process.cwd(), "package.json"), "utf8"));
(0, vitest_1.describe)("package scripts", () => {
    (0, vitest_1.it)("installs husky on demand via setup-hooks instead of the prepare lifecycle", () => {
        // Yarn 1 runs `prepare` for git dependencies, which triggered a nested
        // full devDependency install in CI; hooks must be opt-in now.
        (0, vitest_1.expect)(pkg.scripts["setup-hooks"]).toBe("husky");
        (0, vitest_1.expect)(pkg.scripts.prepare).toBeUndefined();
    });
});
//# sourceMappingURL=package-scripts.test.js.map