import type { NativeTouchEvent } from "react-native";
import { BoundingClientRect, ReactNativeFiberNode, ReactNativeShadowNode } from "./types";
export declare const measureInWindow: (node: ReactNativeShadowNode) => BoundingClientRect;
export declare const findNodeAtPoint: (node: ReactNativeShadowNode, x: number, y: number) => ReactNativeFiberNode | null;
/**
 * Fabric measures in the coordinate space of the surface root, while touches
 * report `pageX`/`pageY` in the coordinate space of the native window hosting
 * that surface. The two only coincide when the surface root sits at the window
 * origin, which is why hit testing was accurate on iOS and a status bar too low
 * in Android's main window.
 *
 * A touch carries both spaces at once - `pageX`/`pageY` alongside `locationX`/
 * `locationY` relative to `target` - so the offset between them can be read off
 * the touch itself rather than guessed per platform. Read it once when the
 * gesture starts: the offset belongs to the window, not to the touched view, and
 * Android only guarantees that `location` matches `target` on the initial touch.
 */
export declare const getFabricWindowOffset: (nativeEvent: NativeTouchEvent) => [number, number];
//# sourceMappingURL=measure.d.ts.map