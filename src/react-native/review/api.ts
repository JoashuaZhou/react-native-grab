import type {
  DeviceItemView,
  DeviceReviewView,
  DraftPatch,
  NewItemInput,
} from "../../review-core/types";

// Mirrors REVIEW_ROUTE_PREFIX/REVIEW_CODE_HEADER from src/metro/review/http.ts.
// The Metro module imports Node built-ins, so the device client keeps its own
// copy of these constants instead of importing them across the boundary.
export const REVIEW_ROUTE_PREFIX = "/__react-native-grab/review/";
export const REVIEW_CODE_HEADER = "x-rn-grab-review-code";

export class ReviewApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number) {
    super(`Review API error ${status} ${code}`);
    this.name = "ReviewApiError";
    this.code = code;
    this.status = status;
  }
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
  createItem: (
    input: NewItemInput,
    screenshotJpegBase64?: string | null,
  ) => Promise<DeviceItemView>;
  updateItem: (no: number, patch: DraftPatch) => Promise<DeviceItemView>;
  deleteItem: (no: number) => Promise<void>;
  submit: () => Promise<number[]>;
  pass: (no: number) => Promise<DeviceItemView>;
  reject: (no: number, supplement: string) => Promise<DeviceItemView>;
  revert: (no: number) => Promise<DeviceItemView>;
  finish: () => Promise<void>;
};

type ApiEnvelope = {
  ok?: boolean;
  error?: unknown;
};

export const createReviewApi = ({
  baseUrl,
  code,
  fetchImpl,
}: CreateReviewApiOptions): ReviewApi => {
  const root = baseUrl.replace(/\/+$/, "");
  const doFetch: FetchLike = fetchImpl ?? ((url, init) => fetch(url, init));

  const url = (route: string): string => `${root}${REVIEW_ROUTE_PREFIX}${route}`;

  const request = async <T>(route: string, init?: RequestInit): Promise<T> => {
    const response = await doFetch(url(route), {
      ...init,
      method: init?.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        [REVIEW_CODE_HEADER]: code,
      },
    });
    const payload = (await response.json()) as T & ApiEnvelope;
    if (!response.ok || payload.ok === false) {
      const error = payload.error;
      throw new ReviewApiError(typeof error === "string" ? error : "unknown", response.status);
    }
    return payload;
  };

  return {
    pair: async (pairCode: string): Promise<DeviceReviewView> => {
      const payload = await request<{ review: DeviceReviewView }>("pair", {
        method: "POST",
        body: JSON.stringify({ code: pairCode }),
      });
      return payload.review;
    },
    state: async (): Promise<ReviewStatePayload> => {
      const payload = await request<ReviewStatePayload>("state");
      return { review: payload.review, items: payload.items, runner: payload.runner };
    },
    createItem: async (
      input: NewItemInput,
      screenshotJpegBase64?: string | null,
    ): Promise<DeviceItemView> => {
      const payload = await request<{ item: DeviceItemView }>("items", {
        method: "POST",
        body: JSON.stringify({
          ...input,
          ...(screenshotJpegBase64 ? { screenshotJpegBase64 } : {}),
        }),
      });
      return payload.item;
    },
    updateItem: async (no: number, patch: DraftPatch): Promise<DeviceItemView> => {
      const payload = await request<{ item: DeviceItemView }>(`items/${no}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      return payload.item;
    },
    deleteItem: async (no: number): Promise<void> => {
      await request<{ ok: boolean }>(`items/${no}`, { method: "DELETE" });
    },
    submit: async (): Promise<number[]> => {
      const payload = await request<{ submitted: number[] }>("submit", { method: "POST" });
      return payload.submitted;
    },
    pass: async (no: number): Promise<DeviceItemView> => {
      const payload = await request<{ item: DeviceItemView }>(`items/${no}/pass`, {
        method: "POST",
      });
      return payload.item;
    },
    reject: async (no: number, supplement: string): Promise<DeviceItemView> => {
      const payload = await request<{ item: DeviceItemView }>(`items/${no}/reject`, {
        method: "POST",
        body: JSON.stringify({ supplement }),
      });
      return payload.item;
    },
    revert: async (no: number): Promise<DeviceItemView> => {
      const payload = await request<{ item: DeviceItemView }>(`items/${no}/revert`, {
        method: "POST",
      });
      return payload.item;
    },
    finish: async (): Promise<void> => {
      await request<{ ok: boolean }>("finish", { method: "POST" });
    },
  };
};
