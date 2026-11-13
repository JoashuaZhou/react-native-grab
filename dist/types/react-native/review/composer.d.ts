import { type ReviewApiError } from "./api";
import { type ComposerState } from "./store";
export declare const ComposerSheet: ({ composer, error, }: {
    composer: ComposerState;
    error: ReviewApiError | null;
}) => import("react/jsx-runtime").JSX.Element;
/**
 * Hosts the sheet inside the ACTIVE grab surface's owner tree - an app-owned
 * RN Modal subtree - as an overlay sibling of the surface view, so picking
 * inside a presented app dialog never presents a second native Modal.
 */
export declare const SurfaceComposerSlot: () => import("react/jsx-runtime").JSX.Element | null;
export declare const ReviewComposer: () => import("react/jsx-runtime").JSX.Element | null;
//# sourceMappingURL=composer.d.ts.map