import { readFileSync, realpathSync } from "node:fs";
import { resolve, sep } from "node:path";
export const OUTSIDE_CWD_MESSAGE = "路径在当前目录之外，已拒绝";
const isInside = (dir, target) => target === dir || target.startsWith(`${dir}${sep}`);
// V8 reports some JSON.parse failures with `... at position N (line L column C)`
// and others as `Unexpected token 'x', "<snippet>" is not valid JSON`. Every
// failure still gets a position: the reported one when present, otherwise the
// offending token's first index, otherwise (notably `Unexpected end of JSON
// input`) the end of the input where the parse stopped.
const parseErrorPosition = (message, content) => {
    const reported = /position (\d+)/.exec(message);
    if (reported !== null) {
        return Number(reported[1]);
    }
    const token = /Unexpected token '([^']+)'/.exec(message);
    if (token !== null) {
        const at = content.indexOf(token[1]);
        if (at >= 0) {
            return at;
        }
    }
    return content.length;
};
const stripReportedPosition = (message) => message.replace(/\s*at position \d+( \(line \d+ column \d+\))?/, "");
// Validates every file with JSON.parse, one result line per filename, and returns
// true only when all files are readable, inside cwd and valid. Files outside cwd
// (including symlink escapes) are rejected without being read.
export const runCheckJson = (files, options = {}) => {
    const cwd = options.cwd ?? process.cwd();
    const print = options.print ?? ((line) => {
        console.log(line);
    });
    const cwdReal = realpathSync(cwd);
    let allValid = true;
    for (const file of files) {
        const target = resolve(cwd, file);
        let targetReal;
        try {
            targetReal = realpathSync(target);
        }
        catch {
            // A missing or broken path keeps its lexical location for the containment
            // check; reading it below reports the failure.
            targetReal = target;
        }
        if (!isInside(cwdReal, targetReal)) {
            print(`${file}：${OUTSIDE_CWD_MESSAGE}`);
            allValid = false;
            continue;
        }
        let content;
        try {
            content = readFileSync(target, "utf8");
        }
        catch (error) {
            print(`${file}：无法读取：${error instanceof Error ? error.message : String(error)}`);
            allValid = false;
            continue;
        }
        try {
            JSON.parse(content);
        }
        catch (error) {
            const reason = error instanceof SyntaxError ? error.message : String(error);
            const position = parseErrorPosition(reason, content);
            print(`${file}：JSON 无效：${stripReportedPosition(reason)}（位置 ${position}）`);
            allValid = false;
            continue;
        }
        print(`${file}：JSON 有效`);
    }
    return allValid;
};
//# sourceMappingURL=check-json.js.map