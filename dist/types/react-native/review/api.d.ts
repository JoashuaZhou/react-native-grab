import type { DeviceItemView, DeviceReviewView, DraftPatch, NewItemInput } from "../../review-core/types";
export declare const REVIEW_ROUTE_PREFIX = "/__react-native-grab/review/";
export declare const REVIEW_CODE_HEADER = "x-rn-grab-review-code";
export declare class ReviewApiError extends Error {
    readonly code: string;
    readonly status: number;
    constructor(code: string, status: number);
}
export type ReviewRunnerInfo = {
    busy: boolean;
    blocked: boolean;
};
export type ReviewStatePayload = {
    review: DeviceReviewView;
    items: DeviceItemView[];
    runner: ReviewRunnerInfo;
};
type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;
export type CreateReviewApiOptions = {
    baseUrl: string;
    code: string;
    fetchImpl?: FetchLike;
};
export type ReviewApi = {
    pair: (code: string) => Promise<DeviceReviewView>;
    state: () => Promise<ReviewStatePayload>;
    createItem: (input: NewItemInput, screenshotJpegBase64?: string | null) => Promise<DeviceItemView>;
    updateItem: (no: number, patch: DraftPatch) => Promise<DeviceItemView>;
    deleteItem: (no: number) => Promise<void>;
    submit: () => Promise<number[]>;
    pass: (no: number) => Promise<DeviceItemView>;
    reject: (no: number, supplement: string) => Promise<DeviceItemView>;
    revert: (no: number) => Promise<DeviceItemView>;
    finish: () => Promise<void>;
};
export declare const createReviewApi: ({ baseUrl, code, fetchImpl, }: CreateReviewApiOptions) => ReviewApi;
export {};
//# sourceMappingURL=api.d.ts.map