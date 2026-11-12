import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCheckJson } from "../check-json";
describe("runCheckJson", () => {
    let root;
    let outside;
    let lines;
    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), "rn-grab-check-json-"));
        outside = mkdtempSync(join(tmpdir(), "rn-grab-check-json-out-"));
        lines = [];
    });
    afterEach(() => {
        rmSync(root, { recursive: true, force: true });
        rmSync(outside, { recursive: true, force: true });
    });
    const print = (line) => {
        lines.push(line);
    };
    const writeIn = (name, content) => {
        const file = join(root, name);
        writeFileSync(file, content, "utf8");
        return file;
    };
    const writeOutside = (name, content) => {
        const file = join(outside, name);
        writeFileSync(file, content, "utf8");
        return file;
    };
    it("accepts a valid JSON file and reports it by the given filename", () => {
        writeIn("good.json", '{"a":1}');
        const ok = runCheckJson(["good.json"], { cwd: root, print });
        expect(ok).toBe(true);
        expect(lines).toEqual(["good.json：JSON 有效"]);
    });
    it("reports an invalid JSON file with the error position and fails", () => {
        writeIn("bad.json", '{"a":1,}');
        const ok = runCheckJson(["bad.json"], { cwd: root, print });
        expect(ok).toBe(false);
        expect(lines).toHaveLength(1);
        expect(lines[0]).toMatch(/^bad\.json：JSON 无效：.+（位置 7）$/);
    });
    it("reports a position for inputs whose parse error has no position message", () => {
        writeIn("words.json", "not json");
        const ok = runCheckJson(["words.json"], { cwd: root, print });
        expect(ok).toBe(false);
        expect(lines[0]).toMatch(/^words\.json：JSON 无效：.+（位置 1）$/);
    });
    it("reports the end-of-input position for truncated JSON", () => {
        writeIn("truncated.json", '{"a":');
        const ok = runCheckJson(["truncated.json"], { cwd: root, print });
        expect(ok).toBe(false);
        expect(lines).toEqual([
            "truncated.json：JSON 无效：Unexpected end of JSON input（位置 5）",
        ]);
    });
    it("reports the end-of-input position for a truncated literal", () => {
        writeIn("nullish.json", "nul");
        const ok = runCheckJson(["nullish.json"], { cwd: root, print });
        expect(ok).toBe(false);
        expect(lines).toEqual(["nullish.json：JSON 无效：Unexpected end of JSON input（位置 3）"]);
    });
    it("reports position zero for an empty JSON file", () => {
        writeIn("empty.json", "");
        const ok = runCheckJson(["empty.json"], { cwd: root, print });
        expect(ok).toBe(false);
        expect(lines).toEqual(["empty.json：JSON 无效：Unexpected end of JSON input（位置 0）"]);
    });
    it("rejects an absolute path outside cwd without reading the file", () => {
        const secret = writeOutside("secret.json", '{"a":1}');
        const ok = runCheckJson([secret], { cwd: root, print });
        expect(ok).toBe(false);
        expect(lines).toEqual([`${secret}：路径在当前目录之外，已拒绝`]);
    });
    it("rejects a relative path that escapes cwd", () => {
        writeOutside("secret.json", '{"a":1}');
        const outsideName = outside.split("/").pop() ?? "";
        const relative = join("..", outsideName, "secret.json");
        const ok = runCheckJson([relative], { cwd: root, print });
        expect(ok).toBe(false);
        expect(lines).toEqual([`${relative}：路径在当前目录之外，已拒绝`]);
    });
    it("rejects a symlink inside cwd that escapes to an outside file", () => {
        writeOutside("secret.json", '{"a":1}');
        symlinkSync(join(outside, "secret.json"), join(root, "escape.json"));
        const ok = runCheckJson(["escape.json"], { cwd: root, print });
        expect(ok).toBe(false);
        expect(lines).toEqual(["escape.json：路径在当前目录之外，已拒绝"]);
    });
    it("accepts a symlink that stays inside cwd", () => {
        writeIn("target.json", '{"a":1}');
        symlinkSync(join(root, "target.json"), join(root, "link.json"));
        const ok = runCheckJson(["link.json"], { cwd: root, print });
        expect(ok).toBe(true);
        expect(lines).toEqual(["link.json：JSON 有效"]);
    });
    it("processes every file and fails when any is invalid", () => {
        writeIn("good.json", '{"a":1}');
        writeIn("bad.json", '{"a":1,}');
        writeIn("bad2.json", "{");
        const ok = runCheckJson(["good.json", "bad.json", "bad2.json"], { cwd: root, print });
        expect(ok).toBe(false);
        expect(lines).toHaveLength(3);
        expect(lines[0]).toBe("good.json：JSON 有效");
        expect(lines[1]).toMatch(/^bad\.json：JSON 无效：.+（位置 7）$/);
        expect(lines[2]).toMatch(/^bad2\.json：JSON 无效：.+（位置 \d+）$/);
    });
    it("reports an unreadable path as a failure", () => {
        mkdirSync(join(root, "subdir"), { recursive: true });
        const ok = runCheckJson(["subdir"], { cwd: root, print });
        expect(ok).toBe(false);
        expect(lines).toHaveLength(1);
        expect(lines[0]).toMatch(/^subdir：无法读取：/);
    });
});
describe("rn-grab-review check-json (CLI integration)", () => {
    const cli = resolve(process.cwd(), "dist", "cjs", "cli", "review.js");
    let root;
    let outside;
    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), "rn-grab-check-cli-"));
        outside = mkdtempSync(join(tmpdir(), "rn-grab-check-cli-out-"));
    });
    afterEach(() => {
        rmSync(root, { recursive: true, force: true });
        rmSync(outside, { recursive: true, force: true });
    });
    const writeIn = (name, content) => {
        const file = join(root, name);
        writeFileSync(file, content, "utf8");
        return file;
    };
    const runCli = (args) => spawnSync(process.execPath, [cli, "check-json", ...args], {
        cwd: root,
        encoding: "utf8",
    });
    it("exits 0 and prints one success line per valid file", () => {
        writeIn("good.json", '{"a":1}');
        writeIn("good2.json", "[]");
        const result = runCli(["good.json", "good2.json"]);
        expect(result.status).toBe(0);
        expect(result.stdout.split("\n")).toEqual([
            "good.json：JSON 有效",
            "good2.json：JSON 有效",
            "",
        ]);
    });
    it("exits 1 and prints the filename and error position for an invalid file", () => {
        writeIn("bad.json", '{"a":1,}');
        const result = runCli(["bad.json"]);
        expect(result.status).toBe(1);
        expect(result.stdout).toMatch(/^bad\.json：JSON 无效：.+（位置 7）$/m);
    });
    it("exits 1 and reports the end-of-input position for a truncated file", () => {
        writeIn("truncated.json", '{"a":');
        const result = runCli(["truncated.json"]);
        expect(result.status).toBe(1);
        expect(result.stdout).toMatch(/^truncated\.json：JSON 无效：Unexpected end of JSON input（位置 5）$/m);
    });
    it("exits 1 and rejects a path outside the working directory", () => {
        const secret = join(outside, "secret.json");
        writeFileSync(secret, '{"a":1}', "utf8");
        const result = runCli([secret]);
        expect(result.status).toBe(1);
        expect(result.stdout).toMatch(/：路径在当前目录之外，已拒绝/);
    });
    it("exits 1 when one of several files is invalid and still processes all of them", () => {
        writeIn("good.json", '{"a":1}');
        writeIn("bad.json", '{"a":1,}');
        const result = runCli(["good.json", "bad.json"]);
        expect(result.status).toBe(1);
        expect(result.stdout).toContain("good.json：JSON 有效");
        expect(result.stdout).toMatch(/^bad\.json：JSON 无效：.+（位置 7）$/m);
    });
    it("exits 1 and rejects a symlink that escapes the working directory", () => {
        writeFileSync(join(outside, "secret.json"), '{"a":1}', "utf8");
        symlinkSync(join(outside, "secret.json"), join(root, "escape.json"));
        const result = runCli(["escape.json"]);
        expect(result.status).toBe(1);
        expect(result.stdout).toMatch(/^escape\.json：路径在当前目录之外，已拒绝$/m);
    });
});
//# sourceMappingURL=check-json.test.js.map