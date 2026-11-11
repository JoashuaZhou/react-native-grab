import { readFileSync } from "node:fs";
import { ReviewError, abandonReview, attachScreenshot, beginFinish, claimItem, completeReview, createItem, deleteDraft, getItemActions, itemCommits, markReverted, passItem, rejectItem, replyItem, submitDrafts, updateDraft, } from "../../review-core/transitions";
import { revertCommitMessage } from "./git";
export const REVIEW_ROUTE_PREFIX = "/__react-native-grab/review/";
export const REVIEW_CODE_HEADER = "x-rn-grab-review-code";
const ITEMS_BODY_LIMIT = 12 * 1024 * 1024;
const DEFAULT_BODY_LIMIT = 64 * 1024;
const MAX_PAIR_FAILURES = 5;
const DRAIN_TIMEOUT_MS = 2000;
const JSON_HEADERS = { "Content-Type": "application/json" };
const LOOPBACK_ADDRESSES = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
const ITEM_NO_RE = /^\d+$/;
const STATUS_BY_CODE = {
    invalid_input: 400,
    empty_text: 400,
    invalid_commits: 400,
    not_found: 404,
    invalid_state: 409,
    has_commits: 409,
    runner_busy: 409,
    conflict: 409,
    not_finishable: 409,
    review_closed: 409,
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
const sendJson = (res, statusCode, payload) => {
    res.writeHead(statusCode, JSON_HEADERS);
    res.end(JSON.stringify(payload));
};
const sendError = (res, code, statusCode) => {
    sendJson(res, statusCode ?? STATUS_BY_CODE[code] ?? 500, { ok: false, error: code });
};
const sendReviewError = (res, error) => {
    if (error instanceof ReviewError) {
        sendError(res, error.code);
        return;
    }
    sendJson(res, 500, { ok: false, error: "internal" });
};
const runGuarded = (res, action) => {
    try {
        action();
    }
    catch (error) {
        sendReviewError(res, error);
    }
};
const parseJsonObject = (value) => {
    if (!value)
        return {};
    let parsed;
    try {
        parsed = JSON.parse(value);
    }
    catch {
        return null;
    }
    if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
        return null;
    }
    return parsed;
};
const readJsonBody = (req, res, limit, onSuccess) => {
    const chunks = [];
    let byteLength = 0;
    let resolved = false;
    req.on("data", (chunk) => {
        if (resolved)
            return;
        const asBuffer = typeof chunk === "string" ? Buffer.from(chunk, "utf8") : chunk;
        byteLength += asBuffer.length;
        if (byteLength > limit) {
            resolved = true;
            sendJson(res, 413, { ok: false, error: "payload_too_large" });
            const timer = setTimeout(() => {
                req.destroy();
            }, DRAIN_TIMEOUT_MS);
            const clearTimer = () => {
                clearTimeout(timer);
            };
            req.once("end", clearTimer);
            req.once("close", clearTimer);
            return;
        }
        chunks.push(asBuffer);
    });
    req.on("end", () => {
        if (resolved)
            return;
        resolved = true;
        const payload = parseJsonObject(Buffer.concat(chunks).toString("utf8"));
        if (payload === null) {
            sendError(res, "invalid_input");
            return;
        }
        onSuccess(payload);
    });
};
const defaultIsLoopback = (req) => {
    const address = req.socket.remoteAddress;
    return address !== undefined && LOOPBACK_ADDRESSES.has(address);
};
const isRecord = (value) => {
    return typeof value === "object" && value !== null && !Array.isArray(value);
};
const requireRecord = (value, field) => {
    if (!isRecord(value)) {
        throw new ReviewError("invalid_input", `${field} 必须是对象`);
    }
    return value;
};
const stringField = (record, key, field) => {
    const value = record[key];
    if (typeof value === "string") {
        return value;
    }
    throw new ReviewError("invalid_input", `${field}.${key} 必须是字符串`);
};
const numberField = (record, key, field) => {
    const value = record[key];
    if (typeof value === "number") {
        return value;
    }
    throw new ReviewError("invalid_input", `${field}.${key} 必须是数字`);
};
const optionalNumber = (value, field) => {
    if (value === undefined || value === null)
        return null;
    if (typeof value === "number") {
        return value;
    }
    throw new ReviewError("invalid_input", `${field} 必须是数字或 null`);
};
const optionalString = (value, field) => {
    if (value === undefined || value === null)
        return null;
    if (typeof value === "string") {
        return value;
    }
    throw new ReviewError("invalid_input", `${field} 必须是字符串或 null`);
};
const windowRect = (value, field) => {
    if (value === undefined || value === null)
        return null;
    const record = requireRecord(value, field);
    return {
        x: numberField(record, "x", field),
        y: numberField(record, "y", field),
        width: numberField(record, "width", field),
        height: numberField(record, "height", field),
    };
};
const screenInfo = (value, field) => {
    if (value === undefined || value === null)
        return null;
    const record = requireRecord(value, field);
    return {
        width: numberField(record, "width", field),
        height: numberField(record, "height", field),
        scale: numberField(record, "scale", field),
    };
};
const grabFrame = (value) => {
    const record = requireRecord(value, "grab.frames");
    return {
        name: stringField(record, "name", "grab.frames"),
        file: optionalString(record.file, "grab.frames.file"),
        line: optionalNumber(record.line, "grab.frames.line"),
        column: optionalNumber(record.column, "grab.frames.column"),
    };
};
const grabInfo = (value) => {
    if (value === undefined || value === null)
        return null;
    const record = requireRecord(value, "grab");
    const frames = record.frames;
    if (!Array.isArray(frames)) {
        throw new ReviewError("invalid_input", "grab.frames 必须是数组");
    }
    return {
        description: stringField(record, "description", "grab"),
        frames: frames.map((frame) => grabFrame(frame)),
    };
};
const deviceInfo = (value) => {
    if (value === undefined || value === null)
        return null;
    const record = requireRecord(value, "device");
    return {
        model: stringField(record, "model", "device"),
        os: stringField(record, "os", "device"),
        appVersion: stringField(record, "appVersion", "device"),
    };
};
const parseNewItemInput = (payload) => {
    const kind = payload.kind;
    if (kind !== "element" && kind !== "page") {
        throw new ReviewError("invalid_input", "无效的条目类型");
    }
    const description = payload.description;
    if (typeof description !== "string") {
        throw new ReviewError("invalid_input", "描述必须是字符串");
    }
    const scope = payload.scope;
    if (scope !== undefined && scope !== "local" && scope !== "shared") {
        throw new ReviewError("invalid_input", "无效的改动范围");
    }
    const figmaUrl = payload.figmaUrl === undefined ? undefined : optionalString(payload.figmaUrl, "figmaUrl");
    return {
        kind,
        description,
        scope: scope,
        figmaUrl,
        rect: windowRect(payload.rect, "rect"),
        screen: screenInfo(payload.screen, "screen"),
        route: optionalString(payload.route, "route"),
        grab: grabInfo(payload.grab),
        device: deviceInfo(payload.device),
    };
};
const parseDraftPatch = (payload) => {
    const patch = {};
    if (payload.description !== undefined) {
        if (typeof payload.description !== "string") {
            throw new ReviewError("invalid_input", "description 必须是字符串");
        }
        patch.description = payload.description;
    }
    if (payload.scope !== undefined) {
        if (payload.scope !== "local" && payload.scope !== "shared") {
            throw new ReviewError("invalid_input", "无效的改动范围");
        }
        patch.scope = payload.scope;
    }
    if (payload.figmaUrl !== undefined) {
        patch.figmaUrl = optionalString(payload.figmaUrl, "figmaUrl");
    }
    return patch;
};
const parseMrUrl = (payload) => {
    const value = payload.mrUrl;
    if (value === undefined || value === null)
        return null;
    if (typeof value !== "string") {
        throw new ReviewError("invalid_input", "mrUrl 必须是字符串");
    }
    const trimmed = value.trim();
    if (trimmed.length > 1024) {
        throw new ReviewError("invalid_input", "mrUrl 过长");
    }
    return trimmed === "" ? null : trimmed;
};
const parseItemNo = (segment) => {
    if (!ITEM_NO_RE.test(segment)) {
        throw new ReviewError("invalid_input", "无效的条目编号");
    }
    return Number(segment);
};
const deviceReviewView = (review) => ({
    id: review.id,
    base: review.base,
    branch: review.branch,
    status: review.status,
    mrUrl: review.mrUrl,
});
const deviceItemView = (item, busy) => ({
    no: item.no,
    kind: item.kind,
    status: item.status,
    scope: item.scope,
    figmaUrl: item.figmaUrl,
    rounds: item.rounds,
    screenshotUrl: item.screenshot === null ? null : `${REVIEW_ROUTE_PREFIX}screenshots/${item.screenshot}`,
    rect: item.rect,
    screen: item.screen,
    route: item.route,
    device: item.device,
    revertCommit: item.revertCommit,
    lastError: item.lastError,
    createdAt: item.createdAt,
    actions: getItemActions(item, busy),
});
const findItem = (review, no) => {
    return review.items.find((item) => item.no === no) ?? null;
};
export const createReviewHandler = (deps) => {
    const { store, git, runner, now } = deps;
    const isLoopback = deps.isLoopback ?? defaultIsLoopback;
    const pairFailures = new Map();
    const localItemBody = (item) => ({
        ok: true,
        item,
        screenshotPath: item.screenshot === null ? null : store.screenshotPath(item.screenshot),
    });
    const recordFailure = (address) => {
        pairFailures.set(address, (pairFailures.get(address) ?? 0) + 1);
    };
    const isLocked = (address) => {
        return (pairFailures.get(address) ?? 0) >= MAX_PAIR_FAILURES;
    };
    const handlePair = (req, res, address) => {
        readJsonBody(req, res, DEFAULT_BODY_LIMIT, (payload) => {
            const code = payload.code;
            if (typeof code !== "string") {
                sendError(res, "invalid_input");
                return;
            }
            if (code.trim() !== store.get().pairingCode) {
                recordFailure(address);
                sendError(res, "bad_code", 401);
                return;
            }
            pairFailures.delete(address);
            sendJson(res, 200, { ok: true, review: deviceReviewView(store.get()) });
        });
    };
    const handleState = (res) => {
        const review = store.get();
        sendJson(res, 200, {
            ok: true,
            review: deviceReviewView(review),
            items: review.items.map((item) => deviceItemView(item, runner.busy)),
            runner: { busy: runner.busy, blocked: runner.blocked },
        });
    };
    const handleCreateItem = (req, res) => {
        readJsonBody(req, res, ITEMS_BODY_LIMIT, (payload) => {
            runGuarded(res, () => {
                const input = parseNewItemInput(payload);
                const screenshot = payload.screenshotJpegBase64;
                if (screenshot !== undefined && screenshot !== null && typeof screenshot !== "string") {
                    sendError(res, "invalid_input");
                    return;
                }
                const created = createItem(store.get(), input, now());
                let file = null;
                if (typeof screenshot === "string" && screenshot.length > 0) {
                    try {
                        file = store.writeScreenshot(created.item.no, screenshot);
                    }
                    catch {
                        sendError(res, "invalid_input");
                        return;
                    }
                }
                const finalReview = file === null ? created.review : attachScreenshot(created.review, created.item.no, file);
                store.update(() => finalReview);
                const item = file === null ? created.item : { ...created.item, screenshot: file };
                sendJson(res, 201, { ok: true, item: deviceItemView(item, runner.busy) });
            });
        });
    };
    const handlePatchItem = (req, res, no) => {
        readJsonBody(req, res, DEFAULT_BODY_LIMIT, (payload) => {
            runGuarded(res, () => {
                const patch = parseDraftPatch(payload);
                const updated = store.update((review) => updateDraft(review, no, patch));
                const item = findItem(updated, no);
                if (item === null) {
                    sendError(res, "not_found");
                    return;
                }
                sendJson(res, 200, { ok: true, item: deviceItemView(item, runner.busy) });
            });
        });
    };
    const handleDeleteItem = (res, no) => {
        store.update((review) => deleteDraft(review, no));
        sendJson(res, 200, { ok: true });
    };
    const handleSubmit = (res) => {
        let submitted = [];
        store.update((review) => {
            const result = submitDrafts(review, now());
            submitted = result.submitted;
            return result.review;
        });
        runner.kick();
        sendJson(res, 200, { ok: true, submitted });
    };
    const handlePass = (res, no) => {
        const updated = store.update((review) => passItem(review, no));
        const item = findItem(updated, no);
        if (item === null) {
            sendError(res, "not_found");
            return;
        }
        sendJson(res, 200, { ok: true, item: deviceItemView(item, runner.busy) });
    };
    const handleReject = (req, res, no) => {
        readJsonBody(req, res, DEFAULT_BODY_LIMIT, (payload) => {
            runGuarded(res, () => {
                const supplement = payload.supplement;
                if (typeof supplement !== "string") {
                    sendError(res, "invalid_input");
                    return;
                }
                const updated = store.update((review) => rejectItem(review, no, supplement, now()));
                const item = findItem(updated, no);
                if (item === null) {
                    sendError(res, "not_found");
                    return;
                }
                sendJson(res, 200, { ok: true, item: deviceItemView(item, runner.busy) });
            });
        });
    };
    const handleRevert = (res, no) => {
        const review = store.get();
        const item = findItem(review, no);
        if (item === null) {
            sendError(res, "not_found");
            return;
        }
        markReverted(review, no, null);
        const shas = itemCommits(item);
        void runner
            .runExclusive(async () => {
            const result = await git.revertCommits(review.worktree, shas, revertCommitMessage(no));
            if (!result.ok) {
                throw new ReviewError("conflict", "撤销走查修改失败");
            }
            const commit = result.commit;
            const updated = store.update((current) => markReverted(current, no, commit));
            return updated.items.find((candidate) => candidate.no === no) ?? item;
        })
            .then((finishedItem) => {
            sendJson(res, 200, { ok: true, item: deviceItemView(finishedItem, runner.busy) });
        })
            .catch((error) => {
            sendReviewError(res, error);
        });
    };
    const handleFinish = (res) => {
        store.update((review) => beginFinish(review));
        runner.kick();
        sendJson(res, 200, { ok: true });
    };
    const handleScreenshot = (res, rawFile) => {
        let file;
        try {
            file = decodeURIComponent(rawFile);
        }
        catch {
            sendError(res, "invalid_input");
            return;
        }
        let path;
        try {
            path = store.screenshotPath(file);
        }
        catch {
            sendError(res, "invalid_input");
            return;
        }
        let data;
        try {
            data = readFileSync(path);
        }
        catch {
            sendError(res, "not_found");
            return;
        }
        res.writeHead(200, { "Content-Type": "image/jpeg", "Content-Length": data.length });
        res.end(data);
    };
    const handleLocalStatus = (res) => {
        sendJson(res, 200, { ok: true, review: store.get() });
    };
    const handleLocalItem = (res, no) => {
        const item = findItem(store.get(), no);
        if (item === null) {
            sendError(res, "not_found");
            return;
        }
        sendJson(res, 200, localItemBody(item));
    };
    const handleClaim = (res, no) => {
        const updated = store.update((review) => claimItem(review, no));
        const item = findItem(updated, no);
        if (item === null) {
            sendError(res, "not_found");
            return;
        }
        sendJson(res, 200, localItemBody(item));
    };
    const handleReply = (req, res, no) => {
        readJsonBody(req, res, DEFAULT_BODY_LIMIT, (payload) => {
            runGuarded(res, () => {
                const reply = payload.reply;
                if (typeof reply !== "string") {
                    sendError(res, "invalid_input");
                    return;
                }
                const commits = payload.commits;
                if (!Array.isArray(commits) || commits.some((commit) => typeof commit !== "string")) {
                    sendError(res, "invalid_input");
                    return;
                }
                const review = store.get();
                const item = findItem(review, no);
                if (item === null) {
                    sendError(res, "not_found");
                    return;
                }
                replyItem(review, no, reply, commits, now());
                const claimed = new Set();
                for (const candidate of review.items) {
                    for (const sha of itemCommits(candidate)) {
                        claimed.add(sha);
                    }
                    if (candidate.revertCommit !== null) {
                        claimed.add(candidate.revertCommit);
                    }
                }
                void git
                    .verifyItemCommits(review.worktree, review.base, commits, claimed)
                    .then((verification) => {
                    if (!verification.ok) {
                        sendError(res, "invalid_commits");
                        return;
                    }
                    const shas = verification.shas;
                    runGuarded(res, () => {
                        const updated = store.update((current) => replyItem(current, no, reply, shas, now()));
                        const updatedItem = findItem(updated, no);
                        if (updatedItem === null) {
                            sendError(res, "not_found");
                            return;
                        }
                        sendJson(res, 200, localItemBody(updatedItem));
                    });
                })
                    .catch(() => {
                    sendJson(res, 500, { ok: false, error: "internal" });
                });
            });
        });
    };
    const handleComplete = (req, res) => {
        readJsonBody(req, res, DEFAULT_BODY_LIMIT, (payload) => {
            runGuarded(res, () => {
                const mrUrl = parseMrUrl(payload);
                const status = store.get().status;
                if (status === "done" || status === "abandoned") {
                    sendError(res, "review_closed");
                    return;
                }
                store.update((review) => completeReview(review, mrUrl));
                sendJson(res, 200, { ok: true });
            });
        });
    };
    const handleRetry = (res) => {
        const status = store.get().status;
        if (status === "done" || status === "abandoned") {
            sendError(res, "review_closed");
            return;
        }
        runner.unblock();
        runner.kick();
        sendJson(res, 200, { ok: true });
    };
    const handleStop = (res) => {
        store.update((review) => abandonReview(review));
        runner.stop();
        sendJson(res, 200, { ok: true });
    };
    const dispatchLocal = (req, res, method, segments) => {
        const rest = segments.slice(1);
        if (method === "GET" && rest.length === 1 && rest[0] === "status") {
            handleLocalStatus(res);
            return;
        }
        if (rest[0] === "items" && (rest.length === 2 || rest.length === 3)) {
            const no = parseItemNo(rest[1]);
            if (method === "GET" && rest.length === 2) {
                handleLocalItem(res, no);
                return;
            }
            if (method === "POST" && rest.length === 3 && rest[2] === "claim") {
                handleClaim(res, no);
                return;
            }
            if (method === "POST" && rest.length === 3 && rest[2] === "reply") {
                handleReply(req, res, no);
                return;
            }
        }
        if (method === "POST" && rest.length === 1) {
            if (rest[0] === "complete") {
                handleComplete(req, res);
                return;
            }
            if (rest[0] === "retry") {
                handleRetry(res);
                return;
            }
            if (rest[0] === "stop") {
                handleStop(res);
                return;
            }
        }
        sendError(res, "not_found", 404);
    };
    const dispatchDevice = (req, res, method, segments) => {
        if (segments.length === 1) {
            if (method === "GET" && segments[0] === "state") {
                handleState(res);
                return;
            }
            if (method === "POST" && segments[0] === "items") {
                handleCreateItem(req, res);
                return;
            }
            if (method === "POST" && segments[0] === "submit") {
                handleSubmit(res);
                return;
            }
            if (method === "POST" && segments[0] === "finish") {
                handleFinish(res);
                return;
            }
        }
        if (segments[0] === "items" && segments.length === 2) {
            const no = parseItemNo(segments[1]);
            if (method === "PATCH") {
                handlePatchItem(req, res, no);
                return;
            }
            if (method === "DELETE") {
                handleDeleteItem(res, no);
                return;
            }
        }
        if (segments[0] === "items" && segments.length === 3 && method === "POST") {
            const no = parseItemNo(segments[1]);
            if (segments[2] === "pass") {
                handlePass(res, no);
                return;
            }
            if (segments[2] === "reject") {
                handleReject(req, res, no);
                return;
            }
            if (segments[2] === "revert") {
                handleRevert(res, no);
                return;
            }
        }
        if (segments[0] === "screenshots" && segments.length === 2 && method === "GET") {
            handleScreenshot(res, segments[1]);
            return;
        }
        sendError(res, "not_found", 404);
    };
    const dispatch = (req, res, pathname) => {
        const method = req.method ?? "GET";
        const segments = pathname
            .slice(REVIEW_ROUTE_PREFIX.length)
            .split("/")
            .filter((segment) => segment.length > 0);
        if (segments[0] === "local") {
            if (!isLoopback(req)) {
                sendError(res, "forbidden", 403);
                return;
            }
            dispatchLocal(req, res, method, segments);
            return;
        }
        const address = req.socket.remoteAddress ?? "unknown";
        if (isLocked(address)) {
            sendError(res, "locked", 403);
            return;
        }
        if (method === "POST" && segments.length === 1 && segments[0] === "pair") {
            handlePair(req, res, address);
            return;
        }
        const code = req.headers[REVIEW_CODE_HEADER];
        if (typeof code !== "string" || code !== store.get().pairingCode) {
            recordFailure(address);
            sendError(res, "bad_code", 401);
            return;
        }
        pairFailures.delete(address);
        dispatchDevice(req, res, method, segments);
    };
    return (req, res, next) => {
        const pathname = getPathname(req);
        if (!pathname.startsWith(REVIEW_ROUTE_PREFIX)) {
            next();
            return;
        }
        try {
            dispatch(req, res, pathname);
        }
        catch (error) {
            sendReviewError(res, error);
        }
    };
};
//# sourceMappingURL=http.js.map