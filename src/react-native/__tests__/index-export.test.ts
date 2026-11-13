import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

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
const ESM_ENTRY = join(__dirname, "../../../dist/esm/react-native/index.js");
const CJS_ENTRY = join(__dirname, "../../../dist/cjs/react-native/index.js");

const readIfExists = (path: string): string | null =>
  existsSync(path) ? readFileSync(path, "utf8") : null;

describe("shipped index entry exposes the review-flow gate", () => {
  it("exports isReviewFlowActive from the review store with a production stub", () => {
    for (const entry of [readIfExists(ESM_ENTRY), readIfExists(CJS_ENTRY)]) {
      if (entry === null) {
        continue;
      }

      expect(entry).toContain("isReviewFlowActive");
      expect(entry).toContain("isReviewPaired");
      expect(entry).toContain('require("./review/store")');
      expect(entry).toMatch(/return false;*|false;\s*$/m);
    }
  });
});
