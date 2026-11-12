export type Command =
  | { name: "start"; base: string; repo: string | undefined }
  | { name: "serve" }
  | { name: "status" }
  | { name: "item"; no: number; json: boolean }
  | { name: "claim"; no: number }
  | { name: "reply"; no: number; message: string; commits: string[] }
  | { name: "complete"; mr: string | null }
  | { name: "retry" }
  | { name: "stop" }
  | { name: "check-json"; files: string[] };

const USAGE = `用法：
  rn-grab-review start --base <branch> [--repo <path>]
  rn-grab-review serve
  rn-grab-review status
  rn-grab-review item <no> [--json]
  rn-grab-review claim <no>
  rn-grab-review reply <no> --message <text> [--commit <sha>]...
  rn-grab-review complete [--mr <url>]
  rn-grab-review retry
  rn-grab-review stop
  rn-grab-review check-json <file>...`;

const NUMBER_RE = /^\d+$/;

function usageThrow(message: string): never {
  throw new Error(`${message}\n${USAGE}`);
}

type OptionState = {
  values: Map<string, string[]>;
  flags: Set<string>;
  positionals: string[];
};

const parseOptions = (
  argv: string[],
  allowed: {
    valueOptions: Set<string>;
    flagOptions: Set<string>;
  },
): OptionState => {
  const state: OptionState = { values: new Map(), flags: new Set(), positionals: [] };
  let index = 0;
  while (index < argv.length) {
    const token = argv[index];
    index += 1;
    if (token.startsWith("--")) {
      if (allowed.flagOptions.has(token)) {
        state.flags.add(token);
        continue;
      }
      if (allowed.valueOptions.has(token)) {
        const value = argv[index];
        if (value === undefined) {
          usageThrow(`${token} 需要一个值`);
        }
        index += 1;
        const list = state.values.get(token) ?? [];
        list.push(value);
        state.values.set(token, list);
        continue;
      }
      usageThrow(`未知参数：${token}`);
    }
    state.positionals.push(token);
  }
  return state;
};

const singleValue = (state: OptionState, option: string): string | undefined => {
  const value = state.values.get(option)?.[0];
  if (value === undefined || value === "") {
    return undefined;
  }
  return value;
};

const requiredValue = (state: OptionState, option: string, hint: string): string => {
  const value = singleValue(state, option);
  if (value === undefined) {
    usageThrow(hint);
  }
  return value;
};

const requiredPositional = (state: OptionState, hint: string): string => {
  const token = state.positionals[0];
  if (token === undefined) {
    usageThrow(hint);
  }
  return token;
};

const parseNumber = (token: string, command: string): number => {
  if (!NUMBER_RE.test(token)) {
    usageThrow(`${command} 的条目编号必须是数字：${token}`);
  }
  return Number(token);
};

export const parseArgs = (argv: string[]): Command => {
  const [command, ...rest] = argv;
  if (command === undefined) {
    usageThrow("缺少命令");
  }

  if (command === "start") {
    const state = parseOptions(rest, {
      valueOptions: new Set(["--base", "--repo"]),
      flagOptions: new Set(),
    });
    const base = requiredValue(state, "--base", "start 需要 --base <branch>");
    return { name: "start", base, repo: singleValue(state, "--repo") };
  }

  if (command === "serve" || command === "retry" || command === "stop") {
    parseOptions(rest, { valueOptions: new Set(), flagOptions: new Set() });
    return { name: command };
  }

  if (command === "status") {
    parseOptions(rest, { valueOptions: new Set(), flagOptions: new Set() });
    return { name: "status" };
  }

  if (command === "item") {
    const state = parseOptions(rest, {
      valueOptions: new Set(),
      flagOptions: new Set(["--json"]),
    });
    const token = requiredPositional(state, "item 需要条目编号");
    return { name: "item", no: parseNumber(token, "item"), json: state.flags.has("--json") };
  }

  if (command === "claim") {
    const state = parseOptions(rest, { valueOptions: new Set(), flagOptions: new Set() });
    const token = requiredPositional(state, "claim 需要条目编号");
    return { name: "claim", no: parseNumber(token, "claim") };
  }

  if (command === "reply") {
    const state = parseOptions(rest, {
      valueOptions: new Set(["--message", "--commit"]),
      flagOptions: new Set(),
    });
    const token = requiredPositional(state, "reply 需要条目编号");
    const message = requiredValue(state, "--message", "reply 需要 --message <text>");
    return {
      name: "reply",
      no: parseNumber(token, "reply"),
      message,
      commits: state.values.get("--commit") ?? [],
    };
  }

  if (command === "complete") {
    const state = parseOptions(rest, { valueOptions: new Set(["--mr"]), flagOptions: new Set() });
    return { name: "complete", mr: singleValue(state, "--mr") ?? null };
  }

  if (command === "check-json") {
    const state = parseOptions(rest, { valueOptions: new Set(), flagOptions: new Set() });
    if (state.positionals.length === 0) {
      usageThrow("check-json 需要至少一个文件路径");
    }
    return { name: "check-json", files: state.positionals };
  }

  usageThrow(`未知命令：${command}`);
};
