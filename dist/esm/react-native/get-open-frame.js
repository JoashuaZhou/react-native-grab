// Match directory segments, including relative paths and Windows separators.
const DEPENDENCY_PATH = /(?:^|[/\\])node_modules[/\\]/;
export const getOpenFrame = (frames) => {
    let fallback = null;
    for (const frame of frames) {
        if (!frame.file || frame.line == null || !Number.isInteger(frame.line) || frame.line <= 0) {
            continue;
        }
        fallback ?? (fallback = frame);
        if (!DEPENDENCY_PATH.test(frame.file)) {
            return frame;
        }
    }
    return fallback;
};
//# sourceMappingURL=get-open-frame.js.map