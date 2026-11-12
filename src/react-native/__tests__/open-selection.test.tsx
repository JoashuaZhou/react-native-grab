import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RenderedByFrame } from "../get-rendered-by";
import type { ReactNativeFiberNode } from "../types";

const runtime = vi.hoisted(() => ({
  state: null as Record<string, unknown> | null,
  release: null as ((event: { nativeEvent: { pageX: number; pageY: number } }) => void) | null,
  fiber: null as ReactNativeFiberNode | null,
  frames: [] as RenderedByFrame[],
}));

// Run the real selection and menu handlers with native hit testing and Metro at the boundary.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useCallback: (callback: unknown) => callback,
  useEffect: () => {},
  useMemo: (factory: () => unknown) => factory(),
  useRef: (value: unknown) => ({ current: value }),
  useState: (initial: Record<string, unknown>) => {
    if (!("isSessionEnabled" in initial)) return [initial, () => {}];
    runtime.state ??= { ...initial, isSessionEnabled: true };
    return [
      runtime.state,
      (update: (previous: Record<string, unknown>) => Record<string, unknown>) => {
        runtime.state = update(runtime.state!);
      },
    ];
  },
  useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown) => getSnapshot(),
}));

vi.mock("react-native", () => ({
  NativeModules: {
    SourceCode: { getConstants: () => ({ scriptURL: "http://localhost:8081/index.bundle" }) },
  },
  PanResponder: {
    create: (handlers: { onPanResponderRelease: typeof runtime.release }) => {
      runtime.release = handlers.onPanResponderRelease;
      return { panHandlers: {} };
    },
  },
  Pressable: "Pressable",
  StyleSheet: {
    absoluteFill: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
    hairlineWidth: 1,
    create: (styles: unknown) => styles,
  },
  Text: "Text",
  View: "View",
}));

vi.mock("../containers", () => ({
  getGrabSelectionOwner: () => ({ shadowNode: {} }),
  useIsResolvedGrabSelectionOwner: () => true,
}));

vi.mock("../measure", () => ({
  findNodeAtPoint: () => runtime.fiber,
  getFabricWindowOffset: () => [0, 0],
  measureInWindow: () => [0, 0, 402, 874],
}));

vi.mock("../get-rendered-by", () => ({
  getRenderedBy: async () => runtime.frames,
}));

import { ReactNativeGrabOverlay } from "../grab-overlay";

const fetchRequest = vi.fn<typeof fetch>();
const frame = (file: string | null, line: number | null, name = "Owner"): RenderedByFrame => ({
  name,
  file,
  line,
  column: 11,
  collapse: false,
});

beforeEach(() => {
  runtime.state = null;
  runtime.release = null;
  runtime.frames = [];
  runtime.fiber = {
    type: "Text",
    memoizedProps: { children: "Boost with HYPEREV" },
    stateNode: { node: {} },
    _debugStack: new Error(),
    _debugOwner: null,
  };
  fetchRequest.mockReset().mockImplementation(async () => new Response('{"ok":true}'));
  vi.stubGlobal("fetch", fetchRequest);
  vi.stubGlobal("nativeFabricUIManager", {
    getBoundingClientRect: () => [10, 20, 200, 40],
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllTimers();
  vi.useRealTimers();
});

const selectElement = async () => {
  ReactNativeGrabOverlay({ ownerId: "root" });
  runtime.release!({ nativeEvent: { pageX: 20, pageY: 30 } });
  await vi.waitFor(() => expect(runtime.state?.selectedElement).toBeTruthy());
  const overlay = ReactNativeGrabOverlay({ ownerId: "root" })!;
  const menu = overlay.props.children[3];
  const actions = menu.props.children[1].props.children;
  return { copy: actions[0].props, open: actions[2].props };
};

const expectOpenRequest = async (file: string, lineNumber: number) => {
  const { open } = await selectElement();
  expect(open.disabled).toBe(false);
  open.onPress();
  await vi.waitFor(() => expect(fetchRequest).toHaveBeenCalledOnce());
  const [url, options] = fetchRequest.mock.calls[0];
  expect(url).toBe("http://localhost:8081/open-stack-frame");
  expect(options?.method).toBe("POST");
  expect(JSON.parse(options?.body as string)).toEqual({ file, lineNumber });
};

describe("Open source location", () => {
  it.each(["Text", "View", "Image", "TextInput", "Switch", "Pressable", "Svg", "CustomWidget"])(
    "opens the nearest project JSX for a selected %s",
    async (type) => {
      runtime.fiber!.type = type;
      runtime.frames = [
        frame("/app/node_modules/react-native/Libraries/Text/Text.js", 306, "Text"),
        frame("/app/src/page/Plugin/HyperEntry.js", 250, "ForwardRef"),
        frame("/app/src/page/Plugin/HyperEntry.js", 272, "EntryCard"),
      ];
      await expectOpenRequest("/app/src/page/Plugin/HyperEntry.js", 250);
    },
  );

  it.each([
    "node_modules/library/Widget.js",
    "/app/node_modules/.pnpm/library@1/node_modules/library/Widget.js",
    "C:\\app\\node_modules\\library\\Widget.js",
  ])("skips dependency path %s", async (dependency) => {
    runtime.frames = [frame(dependency, 10), frame("src/components/Card.tsx", 42)];
    await expectOpenRequest("src/components/Card.tsx", 42);
  });

  it("keeps a project path that only contains node_modules as part of a directory name", async () => {
    runtime.frames = [frame("/app/src/node_modules_tools/Card.tsx", 42)];
    await expectOpenRequest("/app/src/node_modules_tools/Card.tsx", 42);
  });

  it.each([null, 0, -1, NaN, Infinity, 1.5])(
    "skips a source location with line %s",
    async (line) => {
      runtime.frames = [frame("/app/src/Unavailable.tsx", line), frame("/app/src/Card.tsx", 42)];
      await expectOpenRequest("/app/src/Card.tsx", 42);
    },
  );

  it("falls back to the first valid dependency location when project locations are unavailable", async () => {
    runtime.frames = [
      frame("/app/src/Unavailable.tsx", null),
      frame(null, 10),
      frame("/app/node_modules/library/Widget.js", 18),
      frame("/app/node_modules/library/Other.js", 27),
    ];
    await expectOpenRequest("/app/node_modules/library/Widget.js", 18);
  });

  it.each([
    { name: "empty stack", frames: [] },
    { name: "missing file", frames: [frame(null, 10)] },
    { name: "empty file", frames: [frame("", 10)] },
    { name: "missing line", frames: [frame("/app/src/Unavailable.tsx", null)] },
    { name: "zero line", frames: [frame("/app/src/Unavailable.tsx", 0)] },
  ])("disables Open for $name", async ({ frames }) => {
    runtime.frames = frames;
    const { open } = await selectElement();
    expect(open.disabled).toBe(true);
    expect(fetchRequest).not.toHaveBeenCalled();
  });

  it("keeps both dependency and project source context when Copy is pressed", async () => {
    vi.useFakeTimers();
    runtime.frames = [
      frame("/app/node_modules/react-native/Libraries/Text/Text.js", 306, "Text"),
      frame("/app/src/page/Plugin/HyperEntry.js", 250, "ForwardRef"),
    ];
    const { copy } = await selectElement();
    copy.onPress();
    await vi.waitFor(() => expect(fetchRequest).toHaveBeenCalledOnce());
    const [url, options] = fetchRequest.mock.calls[0];
    expect(url).toBe("http://localhost:8081/__react-native-grab/copy");
    expect(JSON.parse(options?.body as string)).toEqual({
      text: "<ForwardRef>\n  Boost with HYPEREV\n</ForwardRef>\n  in Text (at /app/node_modules/react-native/Libraries/Text/Text.js:306:11)\n  in ForwardRef (at /app/src/page/Plugin/HyperEntry.js:250:11)",
    });
  });
});
