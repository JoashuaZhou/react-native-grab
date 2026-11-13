"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const vitest_1 = require("vitest");
/**
 * `src/react-native/index.ts` re-exports its DEV-only modules through CJS
 * `require` calls over `.ts/.tsx` siblings, which cannot be imported by this
 * vitest suite (Node's require has no TypeScript extension resolution, and the
 * published `dist/` entry is the artifact the app actually consumes). The
 * exported review-flow gate is therefore pinned against the BUILT entry:
 * `isReviewFlowActive` must ship, route to the store's pairing check, and keep
 * a production stub that never touches the DEV modules. Its semantics (valid
 * 6-digit pairing code in the configured review host storage) are covered by
 * `review/__tests__/store.test.ts`.
 */
const ESM_ENTRY = (0, node_path_1.join)(__dirname, "../../../dist/esm/react-native/index.js");
const CJS_ENTRY = (0, node_path_1.join)(__dirname, "../../../dist/cjs/react-native/index.js");
const readIfExists = (path) => (0, node_fs_1.existsSync)(path) ? (0, node_fs_1.readFileSync)(path, "utf8") : null;
(0, vitest_1.describe)("shipped index entry exposes the review-flow gate", () => {
    (0, vitest_1.it)("exports isReviewFlowActive from the review store with a production stub", () => {
        for (const entry of [readIfExists(ESM_ENTRY), readIfExists(CJS_ENTRY)]) {
            if (entry === null) {
                continue;
            }
            (0, vitest_1.expect)(entry).toContain("isReviewFlowActive");
            (0, vitest_1.expect)(entry).toContain("isReviewPaired");
            (0, vitest_1.expect)(entry).toContain('require("./review/store")');
            (0, vitest_1.expect)(entry).toMatch(/return false;*|false;\s*$/m);
        }
    });
});
//# sourceMappingURL=index-export.test.js.map