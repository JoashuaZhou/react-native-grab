export type StackFrame = {
    methodName: string;
    file: string | null | undefined;
    lineNumber: number | null | undefined;
    column: number | null | undefined;
    collapse?: boolean;
};
export type CodeFrame = {
    content: string;
    location: {
        row: number;
        column: number;
    } | null;
    fileName: string;
};
export type SymbolicatedStackTrace = {
    stack: StackFrame[];
    codeFrame: CodeFrame | null;
};
/**
 * Posts a stack to Metro's `symbolicate` endpoint, replacing the deep import of
 * `react-native/Libraries/Core/Devtools/symbolicateStackTrace`. That module has
 * no public replacement, but it is a thin wrapper over this request.
 */
export declare const symbolicateStackTrace: (stack: StackFrame[], extraData?: unknown) => Promise<SymbolicatedStackTrace>;
//# sourceMappingURL=symbolicate.d.ts.map