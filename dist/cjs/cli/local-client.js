"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stopReview = exports.retry = exports.complete = exports.reply = exports.claim = exports.showItem = exports.printStatus = exports.localStatus = exports.LOCAL_ORIGIN = exports.METRO_PORT = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const paths_1 = require("../metro/review/paths");
const http_1 = require("../metro/review/http");
const store_1 = require("../metro/review/store");
const transitions_1 = require("../review-core/transitions");
const types_1 = require("../review-core/types");
exports.METRO_PORT = 8081;
exports.LOCAL_ORIGIN = `http://127.0.0.1:${exports.METRO_PORT}`;
const localPath = (suffix) => {
    return `${http_1.REVIEW_ROUTE_PREFIX}local/${suffix}`;
};
const requestLocal = async (suffix, init, origin) => {
    let response;
    try {
        response = await fetch(`${origin}${localPath(suffix)}`, {
            method: init.method ?? "GET",
            headers: init.body === undefined ? undefined : { "content-type": "application/json" },
            body: init.body === undefined ? undefined : JSON.stringify(init.body),
        });
    }
    catch {
        throw new Error(`无法连接 Metro（${origin}），请先运行 rn-grab-review serve`);
    }
    const payload = (await response.json());
    return { status: response.status, payload };
};
const expectOk = (result, fallback) => {
    const payload = result.payload;
    if (payload !== null && typeof payload === "object" && "ok" in payload) {
        if (payload.ok === false) {
            const error = payload;
            throw new Error(`操作失败（${error.error || fallback}）`);
        }
        return payload;
    }
    throw new Error(`Metro 返回异常（状态码 ${result.status}）`);
};
const printOpts = (options) => {
    return (options.print ??
        ((line) => {
            console.log(line);
        }));
};
const localStatus = async (options = {}) => {
    const result = await requestLocal("status", {}, options.origin ?? exports.LOCAL_ORIGIN);
    return expectOk(result, "status").review;
};
exports.localStatus = localStatus;
const printStatus = async (options = {}) => {
    const print = printOpts(options);
    const review = await (0, exports.localStatus)(options);
    print(`走查 ${review.id}：${review.status}`);
    print(`基准分支：${review.base}，走查分支：${review.branch}`);
    if (review.items.length === 0) {
        print("暂无条目");
        return review;
    }
    const summary = review.items
        .map((item) => `#${item.no} ${types_1.STATUS_LABELS[item.status]}`)
        .join("、");
    print(`条目 ${review.items.length} 条：${summary}`);
    return review;
};
exports.printStatus = printStatus;
const formatRect = (item) => {
    if (item.rect === null) {
        return "矩形：无";
    }
    return `矩形：x ${item.rect.x}，y ${item.rect.y}，宽 ${item.rect.width}，高 ${item.rect.height}`;
};
const formatScreen = (item) => {
    if (item.screen === null) {
        return "屏幕：无";
    }
    return `屏幕：${item.screen.width}×${item.screen.height}（${item.screen.scale}x）`;
};
const formatRounds = (item) => {
    return item.rounds.map((round, index) => {
        const lines = [`第 ${index + 1} 轮`];
        lines.push(`  描述：${round.description}`);
        lines.push(`  回复：${round.reply === null ? "无" : round.reply}`);
        lines.push(`  提交：${round.commits.length === 0 ? "无" : round.commits.join("、")}`);
        return lines.join("\n");
    });
};
const showItem = async (no, json, options = {}) => {
    const print = printOpts(options);
    const origin = options.origin ?? exports.LOCAL_ORIGIN;
    const itemResult = await requestLocal(`items/${no}`, {}, origin);
    const body = expectOk(itemResult, "item");
    const review = await (0, exports.localStatus)({ ...options, origin });
    const item = body.item;
    let screenshotCopy = null;
    if (body.screenshotPath !== null) {
        const dir = (0, node_path_1.join)(review.worktree, ".rn-grab-review");
        (0, node_fs_1.mkdirSync)(dir, { recursive: true });
        screenshotCopy = (0, node_path_1.join)(dir, `item-${no}.jpg`);
        (0, node_fs_1.copyFileSync)(body.screenshotPath, screenshotCopy);
    }
    if (json) {
        print(JSON.stringify(item, null, 2));
        return item;
    }
    print(`#${item.no} ${types_1.STATUS_LABELS[item.status]}（${types_1.SCOPE_LABELS[item.scope]}）`);
    print(`路由：${item.route === null ? "无" : item.route}`);
    print(`Figma：${item.figmaUrl === null ? "无" : item.figmaUrl}`);
    print(formatRect(item));
    print(formatScreen(item));
    print(`截图：${screenshotCopy === null ? "无" : screenshotCopy}`);
    for (const round of formatRounds(item)) {
        print(round);
    }
    print(`抓取描述：${item.grab === null ? "无" : item.grab.description}`);
    return item;
};
exports.showItem = showItem;
const printItemLine = (item, print) => {
    print(`#${item.no} ${types_1.STATUS_LABELS[item.status]}（${types_1.SCOPE_LABELS[item.scope]}）`);
};
const claim = async (no, options = {}) => {
    const print = printOpts(options);
    const result = await requestLocal(`items/${no}/claim`, { method: "POST" }, options.origin ?? exports.LOCAL_ORIGIN);
    const body = expectOk(result, "claim");
    printItemLine(body.item, print);
    return body.item;
};
exports.claim = claim;
const reply = async (no, message, commits, options = {}) => {
    const print = printOpts(options);
    const result = await requestLocal(`items/${no}/reply`, { method: "POST", body: { reply: message, commits } }, options.origin ?? exports.LOCAL_ORIGIN);
    const body = expectOk(result, "reply");
    printItemLine(body.item, print);
    return body.item;
};
exports.reply = reply;
const complete = async (mr, options = {}) => {
    const print = printOpts(options);
    const result = await requestLocal("complete", { method: "POST", body: { mrUrl: mr } }, options.origin ?? exports.LOCAL_ORIGIN);
    expectOk(result, "complete");
    print("走查完成");
};
exports.complete = complete;
const retry = async (options = {}) => {
    const print = printOpts(options);
    const result = await requestLocal("retry", { method: "POST" }, options.origin ?? exports.LOCAL_ORIGIN);
    expectOk(result, "retry");
    print("已重试");
};
exports.retry = retry;
const stopReview = async (paths, options = {}) => {
    const print = printOpts(options);
    const origin = options.origin ?? exports.LOCAL_ORIGIN;
    const active = (0, paths_1.readActive)(paths);
    if (active === null) {
        print("没有进行中的走查");
        return;
    }
    let metroAnswered = false;
    try {
        const response = await fetch(`${origin}${localPath("stop")}`, { method: "POST" });
        await response.arrayBuffer();
        metroAnswered = true;
    }
    catch {
        metroAnswered = false;
    }
    if (metroAnswered) {
        print("已结束走查");
    }
    else {
        const store = store_1.ReviewStore.load(active.dir);
        const review = store.get();
        if (review.status === "active" || review.status === "finishing") {
            store.update((current) => (0, transitions_1.abandonReview)(current));
        }
        print("Metro 未运行，已直接放弃该走查");
    }
    (0, paths_1.clearActive)(paths);
};
exports.stopReview = stopReview;
//# sourceMappingURL=local-client.js.map