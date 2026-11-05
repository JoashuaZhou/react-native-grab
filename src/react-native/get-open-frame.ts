import type { RenderedByFrame } from "./get-rendered-by";

// Match directory segments, including relative paths and Windows separators.
const DEPENDENCY_PATH = /(?:^|[/\\])node_modules[/\\]/;

export const getOpenFrame = (frames: readonly RenderedByFrame[]): RenderedByFrame | null => {
  let fallback: RenderedByFrame | null = null;

  for (const frame of frames) {
    if (!frame.file || frame.line == null || !Number.isInteger(frame.line) || frame.line <= 0) {
      continue;
    }

    fallback ??= frame;
    if (!DEPENDENCY_PATH.test(frame.file)) {
      return frame;
    }
  }

  return fallback;
};
