export declare const AGENT_NAME = "design-review";
export type CodemakerArgsOptions = {
    worktree: string;
    message: string;
} & ({
    sessionId: string;
} | {
    title: string;
});
export declare const codemakerArgs: (options: CodemakerArgsOptions) => string[];
export declare const parseSessionId: (jsonLines: string) => string | null;
export declare const spawnCodemaker: (bin: string, args: string[], logFile: string, onPid: (pid: number) => void) => Promise<{
    exitCode: number;
    stdout: string;
}>;
//# sourceMappingURL=codemaker.d.ts.map