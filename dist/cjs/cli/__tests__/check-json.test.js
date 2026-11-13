"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_child_process_1 = require("node:child_process");
const node_fs_1 = require("node:fs");
const node_os_1 = require("node:os");
const node_path_1 = require("node:path");
const vitest_1 = require("vitest");
const check_json_1 = require("../check-json");
(0, vitest_1.describe)("runCheckJson", () => {
    let root;
    let outside;
    let lines;
    (0, vitest_1.beforeEach)(() => {
        root = (0, node_fs_1.mkdtempSync)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "rn-grab-check-json-"));
        outside = (0, node_fs_1.mkdtempSync)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "rn-grab-check-json-out-"));
        lines = [];
    });
    (0, vitest_1.afterEach)(() => {
        (0, node_fs_1.rmSync)(root, { recursive: true, force: true });
        (0, node_fs_1.rmSync)(outside, { recursive: true, force: true });
    });
    const print = (line) => {
        lines.push(line);
    };
    const writeIn = (name, content) => {
        const file = (0, node_path_1.join)(root, name);
        (0, node_fs_1.writeFileSync)(file, content, "utf8");
        return file;
    };
    const writeOutside = (name, content) => {
        const file = (0, node_path_1.join)(outside, name);
        (0, node_fs_1.writeFileSync)(file, content, "utf8");
        return file;
    };
    (0, vitest_1.it)("accepts a valid JSON file and reports it by the given filename", () => {
        writeIn("good.json", '{"a":1}');
        const ok = (0, check_json_1.runCheckJson)(["good.json"], { cwd: root, print });
        (0, vitest_1.expect)(ok).toBe(true);
        (0, vitest_1.expect)(lines).toEqual(["good.json：JSON 有效"]);
    });
    (0, vitest_1.it)("reports an invalid JSON file with the error position and fails", () => {
        writeIn("bad.json", '{"a":1,}');
        const ok = (0, check_json_1.runCheckJson)(["bad.json"], { cwd: root, print });
        (0, vitest_1.expect)(ok).toBe(false);
        (0, vitest_1.expect)(lines).toHaveLength(1);
        (0, vitest_1.expect)(lines[0]).toMatch(/^bad\.json：JSON 无效：.+（位置 7）$/);
    });
    (0, vitest_1.it)("reports a position for inputs whose parse error has no position message", () => {
        writeIn("words.json", "not json");
        const ok = (0, check_json_1.runCheckJson)(["words.json"], { cwd: root, print });
        (0, vitest_1.expect)(ok).toBe(false);
        (0, vitest_1.expect)(lines[0]).toMatch(/^words\.json：JSON 无效：.+（位置 1）$/);
    });
    (0, vitest_1.it)("reports the end-of-input position for truncated JSON", () => {
        writeIn("truncated.json", '{"a":');
        const ok = (0, check_json_1.runCheckJson)(["truncated.json"], { cwd: root, print });
        (0, vitest_1.expect)(ok).toBe(false);
        (0, vitest_1.expect)(lines).toEqual(["truncated.json：JSON 无效：Unexpected end of JSON input（位置 5）"]);
    });
    (0, vitest_1.it)("reports the end-of-input position for a truncated literal", () => {
        writeIn("nullish.json", "nul");
        const ok = (0, check_json_1.runCheckJson)(["nullish.json"], { cwd: root, print });
        (0, vitest_1.expect)(ok).toBe(false);
        (0, vitest_1.expect)(lines).toEqual(["nullish.json：JSON 无效：Unexpected end of JSON input（位置 3）"]);
    });
    (0, vitest_1.it)("reports position zero for an empty JSON file", () => {
        writeIn("empty.json", "");
        const ok = (0, check_json_1.runCheckJson)(["empty.json"], { cwd: root, print });
        (0, vitest_1.expect)(ok).toBe(false);
        (0, vitest_1.expect)(lines).toEqual(["empty.json：JSON 无效：Unexpected end of JSON input（位置 0）"]);
    });
    (0, vitest_1.it)("rejects an absolute path outside cwd without reading the file", () => {
        const secret = writeOutside("secret.json", '{"a":1}');
        const ok = (0, check_json_1.runCheckJson)([secret], { cwd: root, print });
        (0, vitest_1.expect)(ok).toBe(false);
        (0, vitest_1.expect)(lines).toEqual([`${secret}：路径在当前目录之外，已拒绝`]);
    });
    (0, vitest_1.it)("rejects a relative path that escapes cwd", () => {
        writeOutside("secret.json", '{"a":1}');
        const outsideName = outside.split("/").pop() ?? "";
        const relative = (0, node_path_1.join)("..", outsideName, "secret.json");
        const ok = (0, check_json_1.runCheckJson)([relative], { cwd: root, print });
        (0, vitest_1.expect)(ok).toBe(false);
        (0, vitest_1.expect)(lines).toEqual([`${relative}：路径在当前目录之外，已拒绝`]);
    });
    (0, vitest_1.it)("rejects a symlink inside cwd that escapes to an outside file", () => {
        writeOutside("secret.json", '{"a":1}');
        (0, node_fs_1.symlinkSync)((0, node_path_1.join)(outside, "secret.json"), (0, node_path_1.join)(root, "escape.json"));
        const ok = (0, check_json_1.runCheckJson)(["escape.json"], { cwd: root, print });
        (0, vitest_1.expect)(ok).toBe(false);
        (0, vitest_1.expect)(lines).toEqual(["escape.json：路径在当前目录之外，已拒绝"]);
    });
    (0, vitest_1.it)("accepts a symlink that stays inside cwd", () => {
        writeIn("target.json", '{"a":1}');
        (0, node_fs_1.symlinkSync)((0, node_path_1.join)(root, "target.json"), (0, node_path_1.join)(root, "link.json"));
        const ok = (0, check_json_1.runCheckJson)(["link.json"], { cwd: root, print });
        (0, vitest_1.expect)(ok).toBe(true);
        (0, vitest_1.expect)(lines).toEqual(["link.json：JSON 有效"]);
    });
    (0, vitest_1.it)("processes every file and fails when any is invalid", () => {
        writeIn("good.json", '{"a":1}');
        writeIn("bad.json", '{"a":1,}');
        writeIn("bad2.json", "{");
        const ok = (0, check_json_1.runCheckJson)(["good.json", "bad.json", "bad2.json"], { cwd: root, print });
        (0, vitest_1.expect)(ok).toBe(false);
        (0, vitest_1.expect)(lines).toHaveLength(3);
        (0, vitest_1.expect)(lines[0]).toBe("good.json：JSON 有效");
        (0, vitest_1.expect)(lines[1]).toMatch(/^bad\.json：JSON 无效：.+（位置 7）$/);
        (0, vitest_1.expect)(lines[2]).toMatch(/^bad2\.json：JSON 无效：.+（位置 \d+）$/);
    });
    (0, vitest_1.it)("reports an unreadable path as a failure", () => {
        (0, node_fs_1.mkdirSync)((0, node_path_1.join)(root, "subdir"), { recursive: true });
        const ok = (0, check_json_1.runCheckJson)(["subdir"], { cwd: root, print });
        (0, vitest_1.expect)(ok).toBe(false);
        (0, vitest_1.expect)(lines).toHaveLength(1);
        (0, vitest_1.expect)(lines[0]).toMatch(/^subdir：无法读取：/);
    });
});
(0, vitest_1.describe)("accurate positions for positionless parse failures (review F1/F2)", () => {
    let root;
    let lines;
    (0, vitest_1.beforeEach)(() => {
        root = (0, node_fs_1.mkdtempSync)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "rn-grab-check-json-f1f2-"));
        lines = [];
    });
    (0, vitest_1.afterEach)(() => {
        (0, node_fs_1.rmSync)(root, { recursive: true, force: true });
    });
    const print = (line) => {
        lines.push(line);
    };
    const writeIn = (name, content) => {
        const file = (0, node_path_1.join)(root, name);
        (0, node_fs_1.writeFileSync)(file, content, "utf8");
        return file;
    };
    (0, vitest_1.it)("reports the offending comma when an earlier comma exists (F1)", () => {
        // The parse stops at the comma after "b": (index 14), not the first
        // comma (index 8) that a first-occurrence lookup would report.
        writeIn("f1.json", '{"a":"x", "b":,}');
        const ok = (0, check_json_1.runCheckJson)(["f1.json"], { cwd: root, print });
        (0, vitest_1.expect)(ok).toBe(false);
        (0, vitest_1.expect)(lines[0]).toMatch(/^f1\.json：JSON 无效：.+（位置 14）$/);
    });
    (0, vitest_1.it)("reports the second comma of an empty array element, not the first", () => {
        // [1,2,,3]: the grammar fails at the comma starting the empty element
        // (index 5); the earlier element separators sit at 2 and 4.
        writeIn("repeated.json", "[1,2,,3]");
        const ok = (0, check_json_1.runCheckJson)(["repeated.json"], { cwd: root, print });
        (0, vitest_1.expect)(ok).toBe(false);
        (0, vitest_1.expect)(lines[0]).toMatch(/^repeated\.json：JSON 无效：.+（位置 5）$/);
    });
    (0, vitest_1.it)("reports position zero when the input echoes position-like text (F2)", () => {
        // The V8 message embeds the document "position 5 not json"; its text
        // must not be mistaken for a diagnostic position. The offending token
        // is 'p' at index 0.
        writeIn("f2.json", "position 5 not json");
        const ok = (0, check_json_1.runCheckJson)(["f2.json"], { cwd: root, print });
        (0, vitest_1.expect)(ok).toBe(false);
        (0, vitest_1.expect)(lines[0]).toMatch(/^f2\.json：JSON 无效：.+（位置 0）$/);
    });
    (0, vitest_1.it)("reports position zero when the input echoes at-position-like text", () => {
        // "at position 99" is echoed document text; the offending token is
        // 'a' at index 0.
        writeIn("f2b.json", "at position 99");
        const ok = (0, check_json_1.runCheckJson)(["f2b.json"], { cwd: root, print });
        (0, vitest_1.expect)(ok).toBe(false);
        (0, vitest_1.expect)(lines[0]).toMatch(/^f2b\.json：JSON 无效：.+（位置 0）$/);
    });
    (0, vitest_1.it)("keeps the real failure position when a property name contains position-like text", () => {
        // The echoed document contains "position 5"; the parse actually stops
        // at the '}' that should have been a value (index 15).
        writeIn("f2c.json", '{"position 5": }');
        const ok = (0, check_json_1.runCheckJson)(["f2c.json"], { cwd: root, print });
        (0, vitest_1.expect)(ok).toBe(false);
        (0, vitest_1.expect)(lines[0]).toMatch(/^f2c\.json：JSON 无效：.+（位置 15）$/);
    });
    (0, vitest_1.it)("keeps the end-of-input position for EOF failures", () => {
        writeIn("eof.json", '{"a":');
        const ok = (0, check_json_1.runCheckJson)(["eof.json"], { cwd: root, print });
        (0, vitest_1.expect)(ok).toBe(false);
        (0, vitest_1.expect)(lines[0]).toMatch(/^eof\.json：JSON 无效：Unexpected end of JSON input（位置 5）$/);
    });
});
(0, vitest_1.describe)("rn-grab-review check-json (CLI integration)", () => {
    const cli = (0, node_path_1.resolve)(process.cwd(), "dist", "cjs", "cli", "review.js");
    let root;
    let outside;
    (0, vitest_1.beforeEach)(() => {
        root = (0, node_fs_1.mkdtempSync)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "rn-grab-check-cli-"));
        outside = (0, node_fs_1.mkdtempSync)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "rn-grab-check-cli-out-"));
    });
    (0, vitest_1.afterEach)(() => {
        (0, node_fs_1.rmSync)(root, { recursive: true, force: true });
        (0, node_fs_1.rmSync)(outside, { recursive: true, force: true });
    });
    const writeIn = (name, content) => {
        const file = (0, node_path_1.join)(root, name);
        (0, node_fs_1.writeFileSync)(file, content, "utf8");
        return file;
    };
    const runCli = (args) => (0, node_child_process_1.spawnSync)(process.execPath, [cli, "check-json", ...args], {
        cwd: root,
        encoding: "utf8",
    });
    (0, vitest_1.it)("exits 0 and prints one success line per valid file", () => {
        writeIn("good.json", '{"a":1}');
        writeIn("good2.json", "[]");
        const result = runCli(["good.json", "good2.json"]);
        (0, vitest_1.expect)(result.status).toBe(0);
        (0, vitest_1.expect)(result.stdout.split("\n")).toEqual([
            "good.json：JSON 有效",
            "good2.json：JSON 有效",
            "",
        ]);
    });
    (0, vitest_1.it)("exits 1 and prints the filename and error position for an invalid file", () => {
        writeIn("bad.json", '{"a":1,}');
        const result = runCli(["bad.json"]);
        (0, vitest_1.expect)(result.status).toBe(1);
        (0, vitest_1.expect)(result.stdout).toMatch(/^bad\.json：JSON 无效：.+（位置 7）$/m);
    });
    (0, vitest_1.it)("exits 1 and reports the end-of-input position for a truncated file", () => {
        writeIn("truncated.json", '{"a":');
        const result = runCli(["truncated.json"]);
        (0, vitest_1.expect)(result.status).toBe(1);
        (0, vitest_1.expect)(result.stdout).toMatch(/^truncated\.json：JSON 无效：Unexpected end of JSON input（位置 5）$/m);
    });
    (0, vitest_1.it)("exits 1 with the exact offending position when the token recurs earlier (F1)", () => {
        writeIn("f1.json", '{"a":"x", "b":,}');
        const result = runCli(["f1.json"]);
        (0, vitest_1.expect)(result.status).toBe(1);
        (0, vitest_1.expect)(result.stdout).toMatch(/^f1\.json：JSON 无效：.+（位置 14）$/m);
    });
    (0, vitest_1.it)("exits 1 with position zero when the input echoes position-like text (F2)", () => {
        writeIn("f2.json", "position 5 not json");
        const result = runCli(["f2.json"]);
        (0, vitest_1.expect)(result.status).toBe(1);
        (0, vitest_1.expect)(result.stdout).toMatch(/^f2\.json：JSON 无效：.+（位置 0）$/m);
    });
    (0, vitest_1.it)("exits 1 and rejects a path outside the working directory", () => {
        const secret = (0, node_path_1.join)(outside, "secret.json");
        (0, node_fs_1.writeFileSync)(secret, '{"a":1}', "utf8");
        const result = runCli([secret]);
        (0, vitest_1.expect)(result.status).toBe(1);
        (0, vitest_1.expect)(result.stdout).toMatch(/：路径在当前目录之外，已拒绝/);
    });
    (0, vitest_1.it)("exits 1 when one of several files is invalid and still processes all of them", () => {
        writeIn("good.json", '{"a":1}');
        writeIn("bad.json", '{"a":1,}');
        const result = runCli(["good.json", "bad.json"]);
        (0, vitest_1.expect)(result.status).toBe(1);
        (0, vitest_1.expect)(result.stdout).toContain("good.json：JSON 有效");
        (0, vitest_1.expect)(result.stdout).toMatch(/^bad\.json：JSON 无效：.+（位置 7）$/m);
    });
    (0, vitest_1.it)("exits 1 and rejects a symlink that escapes the working directory", () => {
        (0, node_fs_1.writeFileSync)((0, node_path_1.join)(outside, "secret.json"), '{"a":1}', "utf8");
        (0, node_fs_1.symlinkSync)((0, node_path_1.join)(outside, "secret.json"), (0, node_path_1.join)(root, "escape.json"));
        const result = runCli(["escape.json"]);
        (0, vitest_1.expect)(result.status).toBe(1);
        (0, vitest_1.expect)(result.stdout).toMatch(/^escape\.json：路径在当前目录之外，已拒绝$/m);
    });
});
//# sourceMappingURL=check-json.test.js.map