import { describe, expect, it } from "vitest";
import { parseArgs } from "../args";

describe("parseArgs", () => {
  it("parses start with base and repo", () => {
    expect(parseArgs(["start", "--base", "main", "--repo", "/repo/app"])).toEqual({
      name: "start",
      base: "main",
      repo: "/repo/app",
    });
  });

  it("keeps start repo undefined when only base is given", () => {
    expect(parseArgs(["start", "--base", "master"])).toEqual({
      name: "start",
      base: "master",
      repo: undefined,
    });
  });

  it("parses the flag-less commands", () => {
    expect(parseArgs(["serve"])).toEqual({ name: "serve" });
    expect(parseArgs(["status"])).toEqual({ name: "status" });
    expect(parseArgs(["retry"])).toEqual({ name: "retry" });
    expect(parseArgs(["stop"])).toEqual({ name: "stop" });
  });

  it("parses item with and without --json", () => {
    expect(parseArgs(["item", "3", "--json"])).toEqual({ name: "item", no: 3, json: true });
    expect(parseArgs(["item", "3"])).toEqual({ name: "item", no: 3, json: false });
  });

  it("parses claim", () => {
    expect(parseArgs(["claim", "5"])).toEqual({ name: "claim", no: 5 });
  });

  it("collects repeated --commit values in order", () => {
    const command = parseArgs([
      "reply",
      "3",
      "--message",
      "已修复",
      "--commit",
      "aaaa",
      "--commit",
      "bbbb",
    ]);
    expect(command).toEqual({
      name: "reply",
      no: 3,
      message: "已修复",
      commits: ["aaaa", "bbbb"],
    });
  });

  it("parses reply without commits as an empty list", () => {
    expect(parseArgs(["reply", "3", "--message", "已修复"])).toEqual({
      name: "reply",
      no: 3,
      message: "已修复",
      commits: [],
    });
  });

  it("parses complete with and without an MR url", () => {
    expect(parseArgs(["complete", "--mr", "https://gitlab/mr/1"])).toEqual({
      name: "complete",
      mr: "https://gitlab/mr/1",
    });
    expect(parseArgs(["complete"])).toEqual({ name: "complete", mr: null });
  });

  it("rejects a non-numeric item, claim or reply number", () => {
    expect(() => parseArgs(["item", "abc"])).toThrow();
    expect(() => parseArgs(["claim", "12x"])).toThrow();
    expect(() => parseArgs(["reply", "x1", "--message", "m"])).toThrow();
  });

  it("rejects a reply without a message", () => {
    expect(() => parseArgs(["reply", "1"])).toThrow();
  });

  it("rejects start without a base", () => {
    expect(() => parseArgs(["start"])).toThrow();
  });

  it("rejects unknown commands and unexpected flags", () => {
    expect(() => parseArgs(["fly"])).toThrow();
    expect(() => parseArgs(["status", "--json"])).toThrow();
    expect(() => parseArgs([])).toThrow();
  });
});
