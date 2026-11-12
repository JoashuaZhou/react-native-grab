import type { DeviceItemView, DeviceReviewView, ItemScope, NewItemInput } from "../../review-core/types";
import { ReviewApiError, type ReviewRunnerInfo } from "./api";
import { type ReviewScreenshot } from "./host";
export declare const PAIRING_CODE_STORAGE_KEY = "rnGrabReview.pairingCode";
export declare const REVIEW_POLL_INTERVAL_MS = 3000;
export type ComposerState = {
    mode: "create";
    draft: NewItemInput;
    screenshot: ReviewScreenshot | null;
} | {
    mode: "edit";
    item: DeviceItemView;
} | {
    mode: "reject";
    item: DeviceItemView;
};
export type ComposerFields = {
    description?: string;
    scope?: ItemScope;
    figmaUrl?: string | null;
    supplement?: string;
};
export type ReviewStoreState = {
    paired: boolean;
    review: DeviceReviewView | null;
    items: DeviceItemView[];
    runner: ReviewRunnerInfo;
    listVisible: boolean;
    composer: ComposerState | null;
    error: ReviewApiError | null;
};
export declare const getStoredPairingCode: () => string | null;
export declare const isReviewPaired: () => boolean;
export declare const useReviewState: () => ReviewStoreState;
export declare const reviewActions: {
    pair: (code: string) => Promise<boolean>;
    refresh: () => Promise<void>;
    openList: () => void;
    closeList: () => void;
    openComposer: (composer: ComposerState) => void;
    closeComposer: () => void;
    saveComposer: (fields: ComposerFields) => Promise<boolean>;
    submit: () => Promise<boolean>;
    pass: (no: number) => Promise<boolean>;
    reject: (no: number, supplement: string) => Promise<boolean>;
    revert: (no: number) => Promise<boolean>;
    remove: (no: number) => Promise<boolean>;
    finish: () => Promise<boolean>;
};
//# sourceMappingURL=store.d.ts.map