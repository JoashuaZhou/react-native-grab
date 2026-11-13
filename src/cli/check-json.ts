import { readFileSync, realpathSync } from "node:fs";
import { resolve, sep } from "node:path";

export const OUTSIDE_CWD_MESSAGE = "路径在当前目录之外，已拒绝";

export type CheckJsonOptions = {
  cwd?: string;
  print?: (line: string) => void;
};

const isInside = (dir: string, target: string): boolean =>
  target === dir || target.startsWith(`${dir}${sep}`);

// --- JSON grammar scan for exact parse-failure positions ---------------------
//
// V8 reports JSON.parse failures in two shapes:
// - `... at position N (line L column C)` — a genuine diagnostic position; these
//   messages never echo the document, so N is trusted as-is.
// - `Unexpected token 'X', "<document snippet>" is not valid JSON` and
//   `Unexpected end of JSON input` — no position, and the echoed snippet can
//   itself contain text like `position 5` that must never be mistaken for a
//   diagnostic (F2), while a token lookup hits the first of many occurrences
//   of the same character (F1). For these the position is computed by scanning
//   the document against the JSON grammar below: the scan fails exactly at the
//   offending character, or at the end of input when the grammar runs out of
//   characters — never at an invented first/last occurrence.

class JsonScanFailure {
  readonly position: number;

  constructor(position: number) {
    this.position = position;
  }
}

const fail = (position: number): never => {
  throw new JsonScanFailure(position);
};

const isDigit = (char: string): boolean => char >= "0" && char <= "9";

const isHexDigit = (char: string): boolean =>
  isDigit(char) || (char >= "a" && char <= "f") || (char >= "A" && char <= "F");

const isJsonWhitespace = (char: string): boolean =>
  char === " " || char === "\t" || char === "\n" || char === "\r";

const STRING_ESCAPES = new Set(['"', "\\", "/", "b", "f", "n", "r", "t", "u"]);

const skipWhitespace = (content: string, from: number): number => {
  let position = from;
  while (position < content.length && isJsonWhitespace(content[position])) {
    position += 1;
  }
  return position;
};

const scanLiteral = (content: string, from: number, literal: string): number => {
  let position = from;
  for (const char of literal) {
    if (position >= content.length || content[position] !== char) {
      fail(position);
    }
    position += 1;
  }
  return position;
};

// `from` points just after the opening double quote.
const scanString = (content: string, from: number): number => {
  let position = from;
  for (;;) {
    if (position >= content.length) {
      fail(position);
    }
    const char = content[position];
    if (char === '"') {
      return position + 1;
    }
    if (char === "\\") {
      position += 1;
      if (position >= content.length) {
        fail(position);
      }
      const escaped = content[position];
      if (!STRING_ESCAPES.has(escaped)) {
        fail(position);
      }
      if (escaped === "u") {
        for (let index = 0; index < 4; index += 1) {
          position += 1;
          if (position >= content.length || !isHexDigit(content[position])) {
            fail(position);
          }
        }
        position += 1;
      } else {
        position += 1;
      }
      continue;
    }
    if (char < " ") {
      fail(position);
    }
    position += 1;
  }
};

const scanNumber = (content: string, from: number): number => {
  let position = from;
  if (content[position] === "-") {
    position += 1;
  }
  if (position >= content.length) {
    fail(position);
  }
  if (content[position] === "0") {
    position += 1;
    if (position < content.length && isDigit(content[position])) {
      // A leading zero may not be followed by more digits.
      fail(position);
    }
  } else if (isDigit(content[position])) {
    while (position < content.length && isDigit(content[position])) {
      position += 1;
    }
  } else {
    fail(position);
  }
  if (position < content.length && content[position] === ".") {
    position += 1;
    if (position >= content.length || !isDigit(content[position])) {
      fail(position);
    }
    while (position < content.length && isDigit(content[position])) {
      position += 1;
    }
  }
  if (position < content.length && (content[position] === "e" || content[position] === "E")) {
    position += 1;
    if (position < content.length && (content[position] === "+" || content[position] === "-")) {
      position += 1;
    }
    if (position >= content.length || !isDigit(content[position])) {
      fail(position);
    }
    while (position < content.length && isDigit(content[position])) {
      position += 1;
    }
  }
  return position;
};

const scanObject = (content: string, from: number): number => {
  let position = skipWhitespace(content, from);
  if (position < content.length && content[position] === "}") {
    return position + 1;
  }
  for (;;) {
    // A property name is required here; `}` after a comma fails.
    if (position >= content.length || content[position] !== '"') {
      fail(position);
    }
    position = scanString(content, position + 1);
    position = skipWhitespace(content, position);
    if (position >= content.length || content[position] !== ":") {
      fail(position);
    }
    position = scanValue(content, position + 1);
    position = skipWhitespace(content, position);
    if (position >= content.length) {
      fail(position);
    }
    if (content[position] === ",") {
      position = skipWhitespace(content, position + 1);
      continue;
    }
    if (content[position] === "}") {
      return position + 1;
    }
    fail(position);
  }
};

const scanArray = (content: string, from: number): number => {
  let position = skipWhitespace(content, from);
  if (position < content.length && content[position] === "]") {
    return position + 1;
  }
  for (;;) {
    // An element is required here; `]` after a comma fails.
    position = scanValue(content, position);
    position = skipWhitespace(content, position);
    if (position >= content.length) {
      fail(position);
    }
    if (content[position] === ",") {
      position = skipWhitespace(content, position + 1);
      continue;
    }
    if (content[position] === "]") {
      return position + 1;
    }
    fail(position);
  }
};

const scanValue = (content: string, from: number): number => {
  const start = skipWhitespace(content, from);
  if (start >= content.length) {
    fail(start);
  }
  const char = content[start];
  if (char === "{") {
    return scanObject(content, start + 1);
  }
  if (char === "[") {
    return scanArray(content, start + 1);
  }
  if (char === '"') {
    return scanString(content, start + 1);
  }
  if (char === "t") {
    return scanLiteral(content, start, "true");
  }
  if (char === "f") {
    return scanLiteral(content, start, "false");
  }
  if (char === "n") {
    return scanLiteral(content, start, "null");
  }
  if (char === "-" || isDigit(char)) {
    return scanNumber(content, start);
  }
  return fail(start);
};

// Returns the position where `content` stops being valid JSON: the offending
// character, or the end of input when the grammar runs out of characters. Only
// called for documents JSON.parse already rejected, so the scan fails; the
// trailing returns are non-crashing fallbacks for any divergence.
const scanJsonFailure = (content: string): number => {
  try {
    const afterValue = scanValue(content, 0);
    const end = skipWhitespace(content, afterValue);
    if (end < content.length) {
      fail(end);
    }
  } catch (error) {
    if (error instanceof JsonScanFailure) {
      return error.position;
    }
    return content.length;
  }
  return content.length;
};

// --- Message classification ---------------------------------------------------

const withoutQuotedSpans = (message: string): string => message.replace(/"[^"]*"/g, "");

const stripReportedPosition = (message: string): string =>
  message.replace(/\s*at position \d+( \(line \d+ column \d+\))?/, "");

// F2 guard: the echoed-document family is routed to the grammar scan before any
// regex runs, and the regex only ever sees text with quoted spans removed, so
// document text like `position 5` can never become the reported position.
const jsonFailureLine = (file: string, message: string, content: string): string => {
  if (!message.includes("is not valid JSON")) {
    const reported = /at position (\d+)/.exec(withoutQuotedSpans(message));
    if (reported !== null) {
      return `${file}：JSON 无效：${stripReportedPosition(message)}（位置 ${Number(reported[1])}）`;
    }
  }
  return `${file}：JSON 无效：${message}（位置 ${scanJsonFailure(content)}）`;
};

// Validates every file with JSON.parse, one result line per filename, and returns
// true only when all files are readable, inside cwd and valid. Files outside cwd
// (including symlink escapes) are rejected without being read.
export const runCheckJson = (files: string[], options: CheckJsonOptions = {}): boolean => {
  const cwd = options.cwd ?? process.cwd();
  const print =
    options.print ??
    ((line: string) => {
      console.log(line);
    });
  const cwdReal = realpathSync(cwd);

  let allValid = true;
  for (const file of files) {
    const target = resolve(cwd, file);
    let targetReal: string;
    try {
      targetReal = realpathSync(target);
    } catch {
      // A missing or broken path keeps its lexical location for the containment
      // check; reading it below reports the failure.
      targetReal = target;
    }
    if (!isInside(cwdReal, targetReal)) {
      print(`${file}：${OUTSIDE_CWD_MESSAGE}`);
      allValid = false;
      continue;
    }

    let content: string;
    try {
      content = readFileSync(target, "utf8");
    } catch (error) {
      print(`${file}：无法读取：${error instanceof Error ? error.message : String(error)}`);
      allValid = false;
      continue;
    }

    try {
      JSON.parse(content);
    } catch (error) {
      const reason = error instanceof SyntaxError ? error.message : String(error);
      print(jsonFailureLine(file, reason, content));
      allValid = false;
      continue;
    }

    print(`${file}：JSON 有效`);
  }
  return allValid;
};
