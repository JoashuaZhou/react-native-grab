import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReviewApiError } from "../api";
import type { ReviewStoreState } from "../store";

type ElementLike = {
  type: unknown;
  props: Record<string, unknown>;
};

const hooks = vi.hoisted(() => ({
  order: 0,
  values: [] as unknown[],
}));

const runtime = vi.hoisted(() => ({
  reviewState: null as unknown as ReviewStoreState,
  pairCalls: [] as unknown[],
}));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useState: (initial: unknown) => {
    const index = hooks.order++;
    const current = hooks.values[index] ?? initial;
    return [
      current,
      (value: unknown) => {
        hooks.values[index] =
          typeof value === "function"
            ? (value as (previous: unknown) => unknown)(hooks.values[index] ?? initial)
            : value;
      },
    ];
  },
}));

vi.mock("react-native", () => ({
  Alert: { alert: () => {} },
  Image: "Image",
  Linking: { openURL: async () => {} },
  Modal: "Modal",
  NativeModules: {
    SourceCode: { getConstants: () => ({ scriptURL: "http://localhost:8081/index.bundle" }) },
  },
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  StyleSheet: {
    absoluteFill: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
    hairlineWidth: 1,
    create: (styles: unknown) => styles,
  },
  Text: "Text",
  TextInput: "TextInput",
  View: "View",
}));

vi.mock("../store", () => ({
  PAIRING_CODE_STORAGE_KEY: "rnGrabReview.pairingCode",
  reviewActions: {
    pair: async (...args: unknown[]) => {
      runtime.pairCalls.push(args);
      runtime.reviewState.error = { code: "bad_code", status: 401 } as ReviewApiError;
      return false;
    },
    closeList: () => {},
    openComposer: () => {},
  },
  useReviewState: () => runtime.reviewState,
}));

import { ReviewListPanel } from "../list-panel";

const asElement = (value: unknown): ElementLike => value as ElementLike;

const baseState = (): ReviewStoreState => ({
  paired: false,
  review: null,
  items: [],
  runner: { busy: false, blocked: false },
  listVisible: true,
  composer: null,
  error: null,
});

const renderPanel = (): ElementLike => {
  hooks.order = 0;
  const panel = asElement(ReviewListPanel());
  const content = asElement(panel.props.children as unknown);
  const pairing = asElement((content.props.children as unknown[])[1]);
  return asElement((pairing.type as (props: unknown) => unknown)(pairing.props));
};

afterEach(() => {
  hooks.values.length = 0;
});

describe("pairing view errors", () => {
  beforeEach(() => {
    runtime.reviewState = baseState();
    runtime.pairCalls.length = 0;
  });

  it("tells the designer the review was replaced when a stored code goes stale", () => {
    runtime.reviewState.error = { code: "bad_code", status: 401 } as ReviewApiError;

    const pairing = renderPanel();
    const errorText = asElement((pairing.props.children as unknown[])[2]);

    expect(errorText.props.children).toBe("走查已更换，请输入新的配对码");
  });

  it("tells the designer the code was wrong after a failed pairing attempt", async () => {
    const pairing = renderPanel();

    const input = asElement((pairing.props.children as unknown[])[1]);
    (input.props.onChangeText as (text: string) => void)("012345");
    expect(hooks.values).toContain("012345");

    const reRendered = renderPanel();
    const button = asElement((reRendered.props.children as unknown[])[3]);
    const pressable = asElement((button.type as (props: unknown) => unknown)(button.props));

    await (pressable.props.onPress as () => void)();

    const pairingAfter = renderPanel();
    const errorText = asElement((pairingAfter.props.children as unknown[])[2]);

    expect(runtime.pairCalls).toEqual([["012345"]]);
    expect(errorText.props.children).toBe("配对码不正确，请重试");
  });
});
