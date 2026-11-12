"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const args_1 = require("../args");
(0, vitest_1.describe)("parseArgs", () => {
    (0, vitest_1.it)("parses start with base and repo", () => {
        (0, vitest_1.expect)((0, args_1.parseArgs)(["start", "--base", "main", "--repo", "/repo/app"])).toEqual({
            name: "start",
            base: "main",
            repo: "/repo/app",
        });
    });
    (0, vitest_1.it)("keeps start repo undefined when only base is given", () => {
        (0, vitest_1.expect)((0, args_1.parseArgs)(["start", "--base", "master"])).toEqual({
            name: "start",
            base: "master",
            repo: undefined,
        });
    });
    (0, vitest_1.it)("parses the flag-less commands", () => {
        (0, vitest_1.expect)((0, args_1.parseArgs)(["serve"])).toEqual({ name: "serve" });
        (0, vitest_1.expect)((0, args_1.parseArgs)(["status"])).toEqual({ name: "status" });
        (0, vitest_1.expect)((0, args_1.parseArgs)(["retry"])).toEqual({ name: "retry" });
        (0, vitest_1.expect)((0, args_1.parseArgs)(["stop"])).toEqual({ name: "stop" });
    });
    (0, vitest_1.it)("parses check-json with one or more file paths", () => {
        (0, vitest_1.expect)((0, args_1.parseArgs)(["check-json", "a.json"])).toEqual({ name: "check-json", files: ["a.json"] });
        (0, vitest_1.expect)((0, args_1.parseArgs)(["check-json", "a.json", "b.json", "c.json"])).toEqual({
            name: "check-json",
            files: ["a.json", "b.json", "c.json"],
        });
    });
    (0, vitest_1.it)("rejects check-json without files or with flags", () => {
        (0, vitest_1.expect)(() => (0, args_1.parseArgs)(["check-json"])).toThrow();
        (0, vitest_1.expect)(() => (0, args_1.parseArgs)(["check-json", "a.json", "--json"])).toThrow();
    });
    (0, vitest_1.it)("parses item with and without --json", () => {
        (0, vitest_1.expect)((0, args_1.parseArgs)(["item", "3", "--json"])).toEqual({ name: "item", no: 3, json: true });
        (0, vitest_1.expect)((0, args_1.parseArgs)(["item", "3"])).toEqual({ name: "item", no: 3, json: false });
    });
    (0, vitest_1.it)("parses claim", () => {
        (0, vitest_1.expect)((0, args_1.parseArgs)(["claim", "5"])).toEqual({ name: "claim", no: 5 });
    });
    (0, vitest_1.it)("collects repeated --commit values in order", () => {
        const command = (0, args_1.parseArgs)([
            "reply",
            "3",
            "--message",
            "已修复",
            "--commit",
            "aaaa",
            "--commit",
            "bbbb",
        ]);
        (0, vitest_1.expect)(command).toEqual({
            name: "reply",
            no: 3,
            message: "已修复",
            commits: ["aaaa", "bbbb"],
        });
    });
    (0, vitest_1.it)("parses reply without commits as an empty list", () => {
        (0, vitest_1.expect)((0, args_1.parseArgs)(["reply", "3", "--message", "已修复"])).toEqual({
            name: "reply",
            no: 3,
            message: "已修复",
            commits: [],
        });
    });
    (0, vitest_1.it)("parses complete with and without an MR url", () => {
        (0, vitest_1.expect)((0, args_1.parseArgs)(["complete", "--mr", "https://gitlab/mr/1"])).toEqual({
            name: "complete",
            mr: "https://gitlab/mr/1",
        });
        (0, vitest_1.expect)((0, args_1.parseArgs)(["complete"])).toEqual({ name: "complete", mr: null });
    });
    (0, vitest_1.it)("rejects a non-numeric item, claim or reply number", () => {
        (0, vitest_1.expect)(() => (0, args_1.parseArgs)(["item", "abc"])).toThrow();
        (0, vitest_1.expect)(() => (0, args_1.parseArgs)(["claim", "12x"])).toThrow();
        (0, vitest_1.expect)(() => (0, args_1.parseArgs)(["reply", "x1", "--message", "m"])).toThrow();
    });
    (0, vitest_1.it)("rejects a reply without a message", () => {
        (0, vitest_1.expect)(() => (0, args_1.parseArgs)(["reply", "1"])).toThrow();
    });
    (0, vitest_1.it)("rejects start without a base", () => {
        (0, vitest_1.expect)(() => (0, args_1.parseArgs)(["start"])).toThrow();
    });
    (0, vitest_1.it)("rejects unknown commands and unexpected flags", () => {
        (0, vitest_1.expect)(() => (0, args_1.parseArgs)(["fly"])).toThrow();
        (0, vitest_1.expect)(() => (0, args_1.parseArgs)(["status", "--json"])).toThrow();
        (0, vitest_1.expect)(() => (0, args_1.parseArgs)([])).toThrow();
    });
});
//# sourceMappingURL=args.test.js.map