import { ReactNativeFiberNode } from "./types";
export type RenderedByFrame = {
    name: string;
    file: string | null;
    line: number | null;
    column: number | null;
    collapse: boolean;
};
export declare const getRenderedBy: (fiber: ReactNativeFiberNode) => Promise<RenderedByFrame[]>;
//# sourceMappingURL=get-rendered-by.d.ts.map