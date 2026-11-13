import { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageSourcePropType,
} from "react-native";
import { initialWindowMetrics } from "react-native-safe-area-context";
import { SCOPE_LABELS, type ItemScope } from "../../review-core/types";
import { useHasActiveGrabSurface } from "../containers";
import { type ReviewApiError } from "./api";
import { type ReviewScreenshot } from "./host";
import { reviewActions, useReviewState, type ComposerState } from "./store";
import { ReviewThumbnail, storedScreenshotSource } from "./thumbnail";
import { canSaveComposer } from "./view-model";

const NO_SCREENSHOT_HINT = "未截图：请安装包含走查截图功能的测试包";

const captureSource = (screenshot: ReviewScreenshot): ImageSourcePropType => ({
  uri: `data:image/jpeg;base64,${screenshot.jpegBase64}`,
});

type FormState = {
  description: string;
  scope: ItemScope;
  figmaUrl: string;
  supplement: string;
};

// The sheet keeps its typed form while it moves between hosts (surface
// overlay -> list -> root Modal): the committed form is stashed against the
// store's composer object, so an identical composer restores it but a new
// composer starts fresh, matching the render-time reset below.
type SheetFormCache = { composer: ComposerState; form: FormState } | null;

let sheetFormCache: SheetFormCache = null;

const restoreSheetForm = (composer: ComposerState): FormState => {
  if (sheetFormCache?.composer === composer) {
    return sheetFormCache.form;
  }

  const form = toFormState(composer);
  sheetFormCache = { composer, form };
  return form;
};

const toFormState = (composer: ComposerState): FormState => {
  if (composer.mode === "create") {
    const draft = composer.draft;
    return {
      description: draft.description,
      scope: draft.scope ?? "local",
      figmaUrl: draft.figmaUrl ?? "",
      supplement: "",
    };
  }

  const rounds = composer.item.rounds;
  return {
    description: rounds[rounds.length - 1]?.description ?? "",
    scope: composer.item.scope,
    figmaUrl: composer.item.figmaUrl ?? "",
    supplement: "",
  };
};

const toTitle = (composer: ComposerState): string => {
  if (composer.mode === "create") {
    return composer.draft.kind === "page" ? "走查整页" : "走查控件";
  }
  return composer.mode === "edit" ? "修改草稿" : "打回并补充";
};

const toSaveLabel = (composer: ComposerState): string =>
  composer.mode === "reject" ? "打回" : "保存";

const toErrorText = (error: ReviewApiError | null): string | null => {
  if (error === null) {
    return null;
  }
  return `保存失败（${error.code}），请重试`;
};

export const ComposerSheet = ({
  composer,
  error,
}: {
  composer: ComposerState;
  error: ReviewApiError | null;
}) => {
  const [form, setForm] = useState<FormState>(() => restoreSheetForm(composer));
  const [lastComposer, setLastComposer] = useState<ComposerState | null>(composer);
  const [isSaving, setIsSaving] = useState(false);

  // A fresh composer object means a new sheet; the form resets during render
  // so no stale draft ever flashes.
  if (lastComposer !== composer) {
    setLastComposer(composer);
    setForm(restoreSheetForm(composer));
    setIsSaving(false);
  }

  const updateForm = (patch: (previous: FormState) => FormState) => {
    setForm((previous) => {
      const form = patch(previous);
      // Stash the typed form against this composer so the sheet can move to
      // another host (surface deactivation/unmount) without losing the draft.
      sheetFormCache = { composer, form };
      return form;
    });
  };

  const canSave =
    composer.mode === "reject"
      ? form.supplement.trim().length > 0
      : canSaveComposer({ description: form.description });

  const handleSave = async () => {
    if (isSaving || !canSave) {
      return;
    }
    setIsSaving(true);
    const saved = await reviewActions.saveComposer(
      composer.mode === "reject"
        ? { supplement: form.supplement.trim() }
        : {
            description: form.description.trim(),
            scope: form.scope,
            figmaUrl: form.figmaUrl.trim().length > 0 ? form.figmaUrl.trim() : null,
          },
    );
    // Failed saves keep the sheet open; the error renders inline below.
    if (saved) {
      return;
    }
    setIsSaving(false);
  };

  const source: ImageSourcePropType | null =
    composer.mode === "create"
      ? composer.screenshot !== null
        ? captureSource(composer.screenshot)
        : null
      : storedScreenshotSource(composer.item.screenshotUrl);
  const screen =
    composer.mode === "create" ? (composer.draft.screen ?? null) : composer.item.screen;
  const rect = composer.mode === "create" ? (composer.draft.rect ?? null) : composer.item.rect;

  return (
    // The same source of the status-bar inset as `grab-controls.tsx`; while the
    // keyboard pushes the sheet up, its content stays below the status bar.
    <KeyboardAvoidingView
      behavior="padding"
      style={[styles.backdrop, { paddingTop: initialWindowMetrics?.insets.top ?? 0 }]}
    >
      <Pressable
        onPress={() => {
          if (!isSaving) {
            reviewActions.closeComposer();
          }
        }}
        style={styles.backdropPress}
      />
      <ScrollView
        bounces={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.sheetContent}
      >
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>{toTitle(composer)}</Text>

          {composer.mode === "create" && source === null ? (
            <Text style={styles.hintText}>{NO_SCREENSHOT_HINT}</Text>
          ) : (
            <ReviewThumbnail source={source} screen={screen} rect={rect} />
          )}

          {composer.mode !== "reject" ? (
            <>
              <Text style={styles.fieldLabel}>描述</Text>
              <TextInput
                multiline
                onChangeText={(text) => updateForm((prev) => ({ ...prev, description: text }))}
                placeholder="描述（必填）"
                style={styles.textInput}
                textAlignVertical="top"
                value={form.description}
              />

              <Text style={styles.fieldLabel}>修改范围</Text>
              <View style={styles.scopeRow}>
                {(["local", "shared"] as const).map((scope) => (
                  <Pressable
                    key={scope}
                    onPress={() => updateForm((prev) => ({ ...prev, scope }))}
                    style={[styles.scopeChip, form.scope === scope && styles.scopeChipActive]}
                  >
                    <Text
                      style={[
                        styles.scopeChipText,
                        form.scope === scope && styles.scopeChipTextActive,
                      ]}
                    >
                      {SCOPE_LABELS[scope]}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Figma 链接</Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={(text) => updateForm((prev) => ({ ...prev, figmaUrl: text }))}
                keyboardType="url"
                placeholder="Figma 链接（选填）"
                style={styles.textInput}
                value={form.figmaUrl}
              />
            </>
          ) : (
            <>
              <Text style={styles.fieldLabel}>补充说明</Text>
              <TextInput
                multiline
                onChangeText={(text) => updateForm((prev) => ({ ...prev, supplement: text }))}
                placeholder="补充说明（必填）"
                style={[styles.textInput, styles.supplementInput]}
                textAlignVertical="top"
                value={form.supplement}
              />
            </>
          )}

          {toErrorText(error) !== null && (
            <Text style={styles.errorText}>{toErrorText(error)}</Text>
          )}

          <View style={styles.actionRow}>
            <Pressable
              disabled={isSaving}
              onPress={reviewActions.closeComposer}
              style={({ pressed }) => [
                styles.actionButton,
                styles.actionButtonSecondary,
                pressed && styles.actionButtonPressed,
              ]}
            >
              <Text style={styles.actionTextSecondary}>取消</Text>
            </Pressable>
            <Pressable
              disabled={isSaving || !canSave}
              onPress={() => void handleSave()}
              style={({ pressed }) => [
                styles.actionButton,
                styles.actionButtonPrimary,
                (isSaving || !canSave) && styles.actionButtonDisabled,
                pressed && !isSaving && canSave && styles.actionButtonPressed,
              ]}
            >
              <Text
                style={[
                  styles.actionTextPrimary,
                  (isSaving || !canSave) && styles.actionTextDisabled,
                ]}
              >
                {toSaveLabel(composer)}
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

/**
 * Hosts the sheet inside the ACTIVE grab surface's owner tree - an app-owned
 * RN Modal subtree - as an overlay sibling of the surface view, so picking
 * inside a presented app dialog never presents a second native Modal.
 */
export const SurfaceComposerSlot = () => {
  const { composer, error, listVisible } = useReviewState();

  if (listVisible || composer === null) {
    return null;
  }

  return (
    <View style={styles.surfaceOverlay}>
      <ComposerSheet composer={composer} error={error} />
    </View>
  );
};

export const ReviewComposer = () => {
  const { composer, error, listVisible } = useReviewState();
  const hasActiveGrabSurface = useHasActiveGrabSurface();

  // iOS drops a second RN Modal presented over an already presented one and
  // keeps an invisible full-screen host as a touch sink. The sheet therefore
  // mounts in exactly one host at a time - the list Modal tree while the list
  // is visible, the active grab surface's overlay otherwise, and this root
  // Modal only when it is the single host left.
  if (listVisible || hasActiveGrabSurface) {
    return null;
  }

  return (
    <Modal
      animationType="slide"
      onRequestClose={reviewActions.closeComposer}
      transparent
      visible={composer !== null}
    >
      {composer !== null && <ComposerSheet composer={composer} error={error} />}
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  backdropPress: {
    flex: 1,
  },
  surfaceOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 9999,
  },
  sheetContent: {
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
    gap: 8,
  },
  sheetTitle: {
    color: "#111111",
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center",
  },
  hintText: {
    color: "#8A8A8A",
    fontSize: 13,
    paddingVertical: 12,
    textAlign: "center",
  },
  fieldLabel: {
    color: "#666666",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },
  textInput: {
    borderWidth: 1,
    borderColor: "rgba(17, 17, 17, 0.14)",
    borderRadius: 8,
    color: "#111111",
    fontSize: 15,
    minHeight: 44,
    padding: 10,
  },
  supplementInput: {
    minHeight: 88,
  },
  scopeRow: {
    flexDirection: "row",
    gap: 8,
  },
  scopeChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(17, 17, 17, 0.14)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  scopeChipActive: {
    backgroundColor: "#111111",
    borderColor: "#111111",
  },
  scopeChipText: {
    color: "#111111",
    fontSize: 13,
    fontWeight: "500",
  },
  scopeChipTextActive: {
    color: "#FFFFFF",
  },
  errorText: {
    color: "#D93025",
    fontSize: 13,
    paddingTop: 4,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  actionButtonPrimary: {
    backgroundColor: "#111111",
  },
  actionButtonSecondary: {
    backgroundColor: "rgba(17, 17, 17, 0.06)",
  },
  actionButtonDisabled: {
    opacity: 0.4,
  },
  actionButtonPressed: {
    opacity: 0.72,
  },
  actionTextPrimary: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  actionTextSecondary: {
    color: "#111111",
    fontSize: 15,
    fontWeight: "600",
  },
  actionTextDisabled: {
    color: "rgba(255, 255, 255, 0.8)",
  },
});
