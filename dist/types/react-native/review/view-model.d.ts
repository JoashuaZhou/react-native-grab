import type { DeviceItemView, DeviceReviewView, ItemStatus, WindowRect } from "../../review-core/types";
import type { BoundingClientRect } from "../types";
export declare const STATUS_ORDER: ItemStatus[];
export declare const REVERT_BUSY_HINT = "agent \u4FEE\u590D\u4E2D\uFF0C\u6682\u4E0D\u80FD\u64A4\u9500";
export declare const toWindowRect: (abs: BoundingClientRect, windowOffset: [number, number]) => WindowRect;
export declare const canSaveComposer: (fields: {
    description: string;
}) => boolean;
export type DeviceItemGroup = {
    status: ItemStatus;
    label: string;
    items: DeviceItemView[];
};
export declare const groupItemsByStatus: (items: DeviceItemView[]) => DeviceItemGroup[];
export type ReviewFooterState = {
    submitCount: number;
    canFinish: boolean;
    mrUrl: string | null;
};
export declare const footerState: (review: DeviceReviewView | null, items: DeviceItemView[]) => ReviewFooterState;
export declare const awaitingCount: (items: DeviceItemView[]) => number;
export declare const thumbnailMetrics: (image: {
    width: number;
    height: number;
}, thumbWidth: number) => {
    width: number;
    height: number;
    scale: number;
};
export declare const revertHint: (item: DeviceItemView, runnerBusy: boolean) => string | null;
//# sourceMappingURL=view-model.d.ts.map