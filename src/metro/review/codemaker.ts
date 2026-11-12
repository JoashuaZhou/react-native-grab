import { spawn } from "node:child_process";
import { appendFileSync } from "node:fs";

export const AGENT_NAME = "design-review";

export type CodemakerArgsOptions = { worktree: string; message: string } & (
  | { sessionId: string }
  | { title: string }
);

export const codemakerArgs = (options: CodemakerArgsOptions): string[] => {
  const session =
    "sessionId" in options ? ["--session", options.sessionId] : ["--title", options.title];
  return [
    "run",
    "--dir",
    options.worktree,
    "--agent",
    AGENT_NAME,
    "--format",
    "json",
    ...session,
    options.message,
  ];
};

export const parseSessionId = (jsonLines: string): string | null => {
  for (const line of jsonLines.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) continue;
    const sessionId = (parsed as Record<string, unknown>).sessionID;
    if (typeof sessionId === "string" && sessionId !== "") {
      return sessionId;
    }
  }
  return null;
};

export const spawnCodemaker = (
  bin: string,
  args: string[],
  logFile: string,
  onPid: (pid: number) => void,
): Promise<{ exitCode: number; stdout: string }> => {
  return new Promise((resolve) => {
    const child = spawn(bin, args);
    const stdoutChunks: Buffer[] = [];
    let settled = false;

    const settle = (exitCode: number): void => {
      if (settled) return;
      settled = true;
      resolve({ exitCode, stdout: Buffer.concat(stdoutChunks).toString("utf8") });
    };

    if (typeof child.pid === "number") {
      onPid(child.pid);
    }

    child.stdout?.on("data", (chunk: Buffer) => {
      stdoutChunks.push(chunk);
      try {
        appendFileSync(logFile, chunk);
      } catch {
        return;
      }
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      try {
        appendFileSync(logFile, chunk);
      } catch {
        return;
      }
    });

    child.on("error", (error: Error) => {
      settle(-1);
      try {
        appendFileSync(logFile, `${String(error)}\n`, "utf8");
      } catch {
        return;
      }
    });
    child.on("close", (code: number | null) => {
      settle(code ?? -1);
    });
  });
};
