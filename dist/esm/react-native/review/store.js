import { useSyncExternalStore } from "react";
import { getDevServer } from "../dev-server";
import { createReviewApi, ReviewApiError } from "./api";
import { getReviewHost } from "./host";
export const PAIRING_CODE_STORAGE_KEY = "rnGrabReview.pairingCode";
export const REVIEW_POLL_INTERVAL_MS = 3000;
const listeners = new Set();
let pollTimer = null;
let state = {
    paired: false,
    stalePairing: false,
    review: null,
    items: [],
    runner: { busy: false, blocked: false },
    listVisible: false,
    composer: null,
    error: null,
};
const notify = () => {
    for (const listener of listeners) {
        listener();
    }
};
const subscribe = (listener) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};
const getSnapshot = () => state;
export const getStoredPairingCode = () => {
    const storage = getReviewHost()?.storage;
    if (!storage)
        return null;
    try {
        const stored = storage.get(PAIRING_CODE_STORAGE_KEY);
        // Host storage is not trusted: only a real 6-digit string counts as
        // paired, so cleared ("") or malformed values read as unpaired.
        if (typeof stored !== "string" || !/^\d{6}$/.test(stored))
            return null;
        return stored;
    }
    catch {
        return null;
    }
};
export const isReviewPaired = () => getStoredPairingCode() !== null;
const toReviewApiError = (error) => error instanceof ReviewApiError ? error : new ReviewApiError("network", 0);
// A code the server rejects with `bad_code` belongs to a previous review, so it is
// cleared from storage and the loaded review state goes with it; the error and the
// stalePairing flag stay for the pairing view to explain, until a successful pair.
const clearStalePairing = (error) => {
    try {
        getReviewHost()?.storage?.set(PAIRING_CODE_STORAGE_KEY, "");
    }
    catch {
        // Nothing else can be done when the host storage fails.
    }
    setState((prevState) => ({
        ...prevState,
        paired: false,
        stalePairing: true,
        review: null,
        items: [],
        runner: { busy: false, blocked: false },
        error,
    }));
};
const createApiForCode = (code) => createReviewApi({ baseUrl: getDevServer().url, code });
const shouldPoll = (current) => current.paired &&
    (current.listVisible ||
        current.items.some((item) => item.status === "queued" || item.status === "fixing"));
const syncPolling = () => {
    if (shouldPoll(state)) {
        if (pollTimer === null) {
            pollTimer = setInterval(() => {
                void reviewActions.refresh();
            }, REVIEW_POLL_INTERVAL_MS);
        }
        return;
    }
    if (pollTimer !== null) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
};
const setState = (updater) => {
    state = typeof updater === "function" ? updater(state) : updater;
    state = { ...state, paired: isReviewPaired() };
    syncPolling();
    notify();
};
export const useReviewState = () => useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
const fetchDeviceInfo = async () => {
    const getDeviceInfo = getReviewHost()?.getDeviceInfo;
    if (!getDeviceInfo)
        return null;
    try {
        return await getDeviceInfo();
    }
    catch {
        return null;
    }
};
const runAction = async (perform) => {
    const code = getStoredPairingCode();
    if (code === null)
        return false;
    setState((prevState) => ({ ...prevState, error: null }));
    try {
        await perform(createApiForCode(code));
    }
    catch (error) {
        const apiError = toReviewApiError(error);
        if (apiError.code === "bad_code") {
            clearStalePairing(apiError);
        }
        else {
            setState((prevState) => ({ ...prevState, error: apiError }));
        }
        return false;
    }
    await reviewActions.refresh();
    return true;
};
export const reviewActions = {
    pair: async (code) => {
        setState((prevState) => ({ ...prevState, error: null }));
        try {
            await createApiForCode(code).pair(code);
            getReviewHost()?.storage?.set(PAIRING_CODE_STORAGE_KEY, code);
            // Pairing with the current review's code ends any stale-code message.
            setState((prevState) => ({ ...prevState, stalePairing: false }));
        }
        catch (error) {
            setState((prevState) => ({ ...prevState, error: toReviewApiError(error) }));
            return false;
        }
        await reviewActions.refresh();
        return true;
    },
    refresh: async () => {
        const code = getStoredPairingCode();
        if (code === null) {
            setState((prevState) => ({ ...prevState, paired: false }));
            return;
        }
        try {
            const payload = await createApiForCode(code).state();
            setState((prevState) => ({
                ...prevState,
                review: payload.review,
                items: payload.items,
                runner: payload.runner,
                error: null,
            }));
        }
        catch (error) {
            const apiError = toReviewApiError(error);
            if (apiError.code === "bad_code") {
                clearStalePairing(apiError);
            }
            else {
                setState((prevState) => ({ ...prevState, error: apiError }));
            }
        }
    },
    openList: () => {
        setState((prevState) => ({ ...prevState, error: null, listVisible: true }));
        // The panel always reloads from the dev server when it opens.
        if (isReviewPaired()) {
            void reviewActions.refresh();
        }
    },
    closeList: () => {
        setState((prevState) => ({ ...prevState, listVisible: false }));
    },
    openComposer: (composer) => {
        setState((prevState) => ({ ...prevState, error: null, composer }));
    },
    closeComposer: () => {
        setState((prevState) => ({ ...prevState, composer: null }));
    },
    saveComposer: async (fields) => {
        const composer = state.composer;
        if (composer === null)
            return false;
        let perform;
        if (composer.mode === "create") {
            const device = await fetchDeviceInfo();
            const draft = {
                ...composer.draft,
                description: fields.description ?? composer.draft.description,
                scope: fields.scope ?? composer.draft.scope,
                figmaUrl: fields.figmaUrl ?? composer.draft.figmaUrl,
                device,
            };
            const screenshotJpegBase64 = composer.screenshot?.jpegBase64 ?? null;
            perform = async (api) => {
                await api.createItem(draft, screenshotJpegBase64);
            };
        }
        else if (composer.mode === "edit") {
            const patch = {
                ...(fields.description !== undefined ? { description: fields.description } : {}),
                ...(fields.scope !== undefined ? { scope: fields.scope } : {}),
                ...(fields.figmaUrl !== undefined ? { figmaUrl: fields.figmaUrl } : {}),
            };
            perform = async (api) => {
                await api.updateItem(composer.item.no, patch);
            };
        }
        else {
            const supplement = fields.supplement ?? "";
            perform = async (api) => {
                await api.reject(composer.item.no, supplement);
            };
        }
        const saved = await runAction(perform);
        // Errors stay visible inline while the sheet remains open.
        if (saved) {
            setState((prevState) => ({ ...prevState, composer: null }));
        }
        return saved;
    },
    submit: () => runAction((api) => api.submit()),
    pass: (no) => runAction((api) => api.pass(no)),
    reject: (no, supplement) => runAction((api) => api.reject(no, supplement)),
    revert: (no) => runAction((api) => api.revert(no)),
    remove: (no) => runAction((api) => api.deleteItem(no)),
    finish: () => runAction((api) => api.finish()),
};
//# sourceMappingURL=store.js.map