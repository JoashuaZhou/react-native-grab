export type Command = {
    name: "start";
    base: string;
    repo: string | undefined;
} | {
    name: "serve";
} | {
    name: "status";
} | {
    name: "item";
    no: number;
    json: boolean;
} | {
    name: "claim";
    no: number;
} | {
    name: "reply";
    no: number;
    message: string;
    commits: string[];
} | {
    name: "complete";
    mr: string | null;
} | {
    name: "retry";
} | {
    name: "stop";
};
export declare const parseArgs: (argv: string[]) => Command;
//# sourceMappingURL=args.d.ts.map