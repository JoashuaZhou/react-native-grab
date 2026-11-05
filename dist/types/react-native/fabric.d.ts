import type { ReactNativeFiberNode, ReactNativeShadowNode } from "./types.js";
export type FabricUIManager = {
    findShadowNodeByTag_DEPRECATED: (tag: number) => ReactNativeShadowNode;
    findNodeAtPoint: (node: ReactNativeShadowNode, locationX: number, locationY: number, callback: (instanceHandle: ReactNativeFiberNode) => void) => void;
    getBoundingClientRect: (node: ReactNativeShadowNode, includeTransform?: boolean) => [number, number, number, number];
    measureInWindow: (node: ReactNativeShadowNode, callback: (x: number, y: number, width: number, height: number) => void) => void;
};
declare global {
    var nativeFabricUIManager: FabricUIManager;
}
export declare const getFabricUIManager: () => FabricUIManager;
//# sourceMappingURL=fabric.d.ts.map