"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createReviewApi = exports.ReviewApiError = exports.REVIEW_CODE_HEADER = exports.REVIEW_ROUTE_PREFIX = void 0;
// Mirrors REVIEW_ROUTE_PREFIX/REVIEW_CODE_HEADER from src/metro/review/http.ts.
// The Metro module imports Node built-ins, so the device client keeps its own
// copy of these constants instead of importing them across the boundary.
exports.REVIEW_ROUTE_PREFIX = "/__react-native-grab/review/";
exports.REVIEW_CODE_HEADER = "x-rn-grab-review-code";
class ReviewApiError extends Error {
    constructor(code, status) {
        super(`Review API error ${status} ${code}`);
        this.name = "ReviewApiError";
        this.code = code;
        this.status = status;
    }
}
exports.ReviewApiError = ReviewApiError;
const createReviewApi = ({ baseUrl, code, fetchImpl, }) => {
    const root = baseUrl.replace(/\/+$/, "");
    const doFetch = fetchImpl ?? ((url, init) => fetch(url, init));
    const url = (route) => `${root}${exports.REVIEW_ROUTE_PREFIX}${route}`;
    const request = async (route, init) => {
        const response = await doFetch(url(route), {
            ...init,
            method: init?.method ?? "GET",
            headers: {
                "Content-Type": "application/json",
                [exports.REVIEW_CODE_HEADER]: code,
            },
        });
        const payload = (await response.json());
        if (!response.ok || payload.ok === false) {
            const error = payload.error;
            throw new ReviewApiError(typeof error === "string" ? error : "unknown", response.status);
        }
        return payload;
    };
    return {
        pair: async (pairCode) => {
            const payload = await request("pair", {
                method: "POST",
                body: JSON.stringify({ code: pairCode }),
            });
            return payload.review;
        },
        state: async () => {
            const payload = await request("state");
            return { review: payload.review, items: payload.items, runner: payload.runner };
        },
        createItem: async (input, screenshotJpegBase64) => {
            const payload = await request("items", {
                method: "POST",
                body: JSON.stringify({
                    ...input,
                    ...(screenshotJpegBase64 ? { screenshotJpegBase64 } : {}),
                }),
            });
            return payload.item;
        },
        updateItem: async (no, patch) => {
            const payload = await request(`items/${no}`, {
                method: "PATCH",
                body: JSON.stringify(patch),
            });
            return payload.item;
        },
        deleteItem: async (no) => {
            await request(`items/${no}`, { method: "DELETE" });
        },
        submit: async () => {
            const payload = await request("submit", { method: "POST" });
            return payload.submitted;
        },
        pass: async (no) => {
            const payload = await request(`items/${no}/pass`, {
                method: "POST",
            });
            return payload.item;
        },
        reject: async (no, supplement) => {
            const payload = await request(`items/${no}/reject`, {
                method: "POST",
                body: JSON.stringify({ supplement }),
            });
            return payload.item;
        },
        revert: async (no) => {
            const payload = await request(`items/${no}/revert`, {
                method: "POST",
            });
            return payload.item;
        },
        finish: async () => {
            await request("finish", { method: "POST" });
        },
    };
};
exports.createReviewApi = createReviewApi;
//# sourceMappingURL=api.js.map