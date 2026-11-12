"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withReactNativeGrab = void 0;
const node_child_process_1 = require("node:child_process");
const metro_config_transformers_1 = require("metro-config-transformers");
const http_1 = require("./review/http");
const module_1 = require("./review/module");
const MAX_BODY_BYTES = 1024 * 512;
const JSON_HEADERS = { "Content-Type": "application/json" };
const COPY_ROUTE = "/__react-native-grab/copy";
const REVIEW_DIR_ENV = "RN_GRAB_REVIEW_DIR";
const tryCopy = (command, args, text) => {
    try {
        (0, node_child_process_1.execFileSync)(command, args, { input: text });
        return true;
    }
    catch {
        return false;
    }
};
const copyToHostClipboard = (text) => {
    if (process.platform === "darwin") {
        return tryCopy("pbcopy", [], text);
    }
    if (process.platform === "win32") {
        return tryCopy("clip", [], text);
    }
    return (tryCopy("xclip", ["-selection", "clipboard"], text) ||
        tryCopy("xsel", ["--clipboard", "--input"], text));
};
const sendJson = (res, statusCode, payload) => {
    res.writeHead(statusCode, JSON_HEADERS);
    res.end(JSON.stringify(payload));
};
const getPathname = (req) => {
    if (typeof req.url !== "string")
        return "";
    try {
        return new URL(req.url, "http://localhost").pathname;
    }
    catch {
        return req.url.split("?")[0];
    }
};
const parseJsonObject = (value) => {
    if (!value)
        return {};
    const parsed = JSON.parse(value);
    if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
        return null;
    }
    return parsed;
};
const readJsonBody = (req, res, onSuccess) => {
    let body = "";
    let byteLength = 0;
    let resolved = false;
    req.on("data", (chunk) => {
        if (resolved)
            return;
        const asString = chunk.toString();
        byteLength += Buffer.byteLength(asString);
        if (byteLength > MAX_BODY_BYTES) {
            resolved = true;
            sendJson(res, 413, { ok: false, error: "Payload too large" });
            req.destroy();
            return;
        }
        body += asString;
    });
    req.on("end", () => {
        if (resolved)
            return;
        try {
            const payload = parseJsonObject(body);
            if (payload === null) {
                sendJson(res, 400, { ok: false, error: "Invalid JSON payload shape" });
                return;
            }
            resolved = true;
            onSuccess(payload);
        }
        catch {
            resolved = true;
            sendJson(res, 400, { ok: false, error: "Invalid JSON" });
        }
    });
};
const handleCopyRequest = (req, res) => {
    if (req.method !== "POST") {
        sendJson(res, 405, { ok: false, error: "Method not allowed" });
        return;
    }
    readJsonBody(req, res, (payload) => {
        const text = typeof payload.text === "string" ? payload.text : "";
        if (!text.trim()) {
            sendJson(res, 400, { ok: false, error: "Missing text" });
            return;
        }
        const copied = copyToHostClipboard(text);
        if (!copied) {
            sendJson(res, 500, { ok: false, error: "Clipboard write failed on host" });
            return;
        }
        sendJson(res, 200, { ok: true });
    });
};
let cachedReviewModule = null;
let cachedReviewModuleDir = null;
let reviewErrorPrintedDir = null;
const loadReviewModule = (dir) => {
    try {
        const module = (0, module_1.createReviewModule)(dir);
        cachedReviewModule = module;
        cachedReviewModuleDir = dir;
        return { module, error: null };
    }
    catch (error) {
        cachedReviewModule = null;
        cachedReviewModuleDir = null;
        return { module: null, error };
    }
};
const resolveReviewModule = (dir) => {
    if (cachedReviewModule !== null && cachedReviewModuleDir === dir) {
        return cachedReviewModule;
    }
    return loadReviewModule(dir).module;
};
const initializeReviewModule = () => {
    const dir = process.env[REVIEW_DIR_ENV];
    if (dir === undefined || dir === "") {
        return;
    }
    if (cachedReviewModule !== null && cachedReviewModuleDir === dir) {
        return;
    }
    const { module, error } = loadReviewModule(dir);
    if (module === null && reviewErrorPrintedDir !== dir) {
        reviewErrorPrintedDir = dir;
        const cause = error instanceof Error ? error.message : String(error);
        console.error(`react-native-grab: 无法加载设计走查目录 ${dir}：${cause}`);
    }
};
const handleReactNativeGrabRequest = (req, res, next) => {
    const pathname = getPathname(req);
    if (pathname === COPY_ROUTE) {
        handleCopyRequest(req, res);
        return;
    }
    if (pathname.startsWith(http_1.REVIEW_ROUTE_PREFIX)) {
        const reviewDir = process.env[REVIEW_DIR_ENV];
        if (reviewDir === undefined || reviewDir === "") {
            sendJson(res, 404, { ok: false, error: "no_active_review" });
            return;
        }
        const reviewModule = resolveReviewModule(reviewDir);
        if (reviewModule === null) {
            sendJson(res, 500, { ok: false, error: "internal" });
            return;
        }
        reviewModule.handler(req, res, next);
        return;
    }
    next();
};
exports.withReactNativeGrab = (0, metro_config_transformers_1.createMetroConfigTransformer)((config) => {
    const previousEnhanceMiddleware = config.server?.enhanceMiddleware;
    return {
        ...config,
        server: {
            ...config.server,
            enhanceMiddleware: (middleware, metroServer) => {
                const baseMiddleware = previousEnhanceMiddleware
                    ? previousEnhanceMiddleware(middleware, metroServer)
                    : middleware;
                initializeReviewModule();
                return (req, res, next) => {
                    handleReactNativeGrabRequest(req, res, () => {
                        baseMiddleware(req, res, next);
                    });
                };
            },
        },
    };
});
//# sourceMappingURL=withReactNativeGrab.js.map