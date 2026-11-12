#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { networkInterfaces } from "node:os";
import { randomInt } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "./args";
import { claim, complete, printStatus, reply, retry, showItem, stopReview } from "./local-client";
import { createInstallDeps, serveReview, startReview, type StartDeps } from "./start";
import { installAgentFiles } from "./agent-files";
import { getReviewPaths } from "../metro/review/paths";
import { createGit } from "../metro/review/git";
import { codemakerArgs, parseSessionId, spawnCodemaker } from "../metro/review/codemaker";
import { METRO_PORT } from "./local-client";

const paths = getReviewPaths();

const portFree = (port: number): Promise<boolean> => {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => {
      resolve(false);
    });
    server.listen(port, "127.0.0.1", () => {
      server.close(() => {
        resolve(true);
      });
    });
  });
};

const which = (bin: string): string | null => {
  const result = spawnSync("which", [bin]);
  if (result.error !== undefined || result.status !== 0) {
    return null;
  }
  return result.stdout.toString().trim() || null;
};

const randomCode = (): string => {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
};

const lanAddress = (): string | null => {
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === "IPv4" && !address.internal) {
        return address.address;
      }
    }
  }
  return null;
};

const runCommand = (command: string, args: string[], cwd: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit" });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} 在 ${cwd} 失败（退出码 ${code ?? "null"}）`));
    });
  });
};

const spawnMetro = (worktree: string, env: { RN_GRAB_REVIEW_DIR: string }): Promise<number> => {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["react-native", "start"], {
      cwd: worktree,
      env: { ...process.env, ...env },
      stdio: "inherit",
    });
    if (typeof child.pid === "number") {
      resolve(child.pid);
      return;
    }
    child.once("error", reject);
  });
};

const createSession = (o: {
  bin: string;
  worktree: string;
  title: string;
  message: string;
}): Promise<string> => {
  const introLog = join(o.worktree, ".rn-grab-review", "intro.log");
  mkdirSync(dirname(introLog), { recursive: true });
  return spawnCodemaker(o.bin, codemakerArgs(o), introLog, () => {}).then((result) => {
    if (result.exitCode !== 0) {
      throw new Error(`codemaker 会话创建失败（退出码 ${result.exitCode}）`);
    }
    const sessionId = parseSessionId(result.stdout);
    if (sessionId === null) {
      throw new Error("无法从 codemaker 输出解析会话 id");
    }
    return sessionId;
  });
};

const makeDeps = (): StartDeps => ({
  git: createGit(),
  paths,
  now: () => new Date(),
  portFree,
  which,
  installDeps: createInstallDeps((worktree) =>
    runCommand("yarn", ["install", "--frozen-lockfile"], worktree),
  ),
  installAgentFiles,
  createSession,
  spawnMetro,
  randomCode,
  lanAddress,
  log: (line) => {
    console.log(line);
  },
});

const main = async (argv: string[]): Promise<void> => {
  const command = parseArgs(argv);
  switch (command.name) {
    case "start":
      await startReview(
        { repo: command.repo === undefined ? process.cwd() : command.repo, base: command.base },
        makeDeps(),
      );
      return;
    case "serve":
      await serveReview(paths, {
        spawnMetro,
        log: (line) => {
          console.log(line);
        },
      });
      return;
    case "status":
      await printStatus();
      return;
    case "item":
      await showItem(command.no, command.json);
      return;
    case "claim":
      await claim(command.no);
      return;
    case "reply":
      await reply(command.no, command.message, command.commits);
      return;
    case "complete":
      await complete(command.mr);
      return;
    case "retry":
      await retry();
      return;
    case "stop":
      await stopReview(paths);
      return;
  }
};

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
