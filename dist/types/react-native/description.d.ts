import { ReactNativeFiberNode } from "./types";
import type { RenderedByFrame } from "./get-rendered-by";
/** Owner names treated as host-like when resolving `Text (in Owner)` for the grab menu. */
export declare const GRAB_HOST_LIKE_COMPONENT_NAMES: readonly ["View", "Text"];
export declare const isHostLikeComponentName: (name: string) => boolean;
export declare const getGrabSelectionTitle: (node: ReactNativeFiberNode, renderedBy: RenderedByFrame[]) => string;
export declare const getDescription: (node: ReactNativeFiberNode) => Promise<string>;
//# sourceMappingURL=description.d.ts.map