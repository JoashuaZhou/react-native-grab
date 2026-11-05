"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOpenFrame = void 0;
// Match directory segments, including relative paths and Windows separators.
const DEPENDENCY_PATH = /(?:^|[/\\])node_modules[/\\]/;
const getOpenFrame = (frames) => {
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
exports.getOpenFrame = getOpenFrame;
//# sourceMappingURL=get-open-frame.js.map