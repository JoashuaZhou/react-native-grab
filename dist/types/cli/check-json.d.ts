export declare const OUTSIDE_CWD_MESSAGE = "\u8DEF\u5F84\u5728\u5F53\u524D\u76EE\u5F55\u4E4B\u5916\uFF0C\u5DF2\u62D2\u7EDD";
export type CheckJsonOptions = {
    cwd?: string;
    print?: (line: string) => void;
};
export declare const runCheckJson: (files: string[], options?: CheckJsonOptions) => boolean;
//# sourceMappingURL=check-json.d.ts.map