"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDescription = exports.getGrabSelectionTitle = exports.isHostLikeComponentName = exports.GRAB_HOST_LIKE_COMPONENT_NAMES = void 0;
const get_rendered_by_1 = require("./get-rendered-by");
const grab_context_1 = require("./grab-context");
const MAX_STACK_LINES = 6;
const MAX_TEXT_LENGTH = 120;
const MAX_ATTR_VALUE_LENGTH = 80;
const MAX_ATTRS = 6;
const PRIORITY_ATTRS = [
    "testID",
    "nativeID",
    "accessibilityLabel",
    "accessibilityRole",
    "accessibilityHint",
    "accessibilityValue",
];
/** Owner names treated as host-like when resolving `Text (in Owner)` for the grab menu. */
exports.GRAB_HOST_LIKE_COMPONENT_NAMES = ["View", "Text"];
const HOST_LIKE_NAME_SET = new Set(exports.GRAB_HOST_LIKE_COMPONENT_NAMES);
const isHostLikeComponentName = (name) => HOST_LIKE_NAME_SET.has(name.trim());
exports.isHostLikeComponentName = isHostLikeComponentName;
const firstHostLikeRenderedByName = (renderedBy) => {
    const frame = renderedBy.find((f) => (0, exports.isHostLikeComponentName)(f.name));
    const trimmed = frame?.name?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : null;
};
const firstNonHostRenderedByName = (renderedBy) => {
    const frame = renderedBy.find((f) => !(0, exports.isHostLikeComponentName)(f.name));
    const trimmed = frame?.name?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : null;
};
const truncate = (value, maxLength) => {
    if (value.length <= maxLength)
        return value;
    return `${value.slice(0, maxLength - 3)}...`;
};
const escapeAttr = (value) => {
    return value
        .replace(/\\/g, "\\\\")
        .replace(/\r?\n|\r/g, " ")
        .replace(/"/g, '\\"');
};
const stringifyAttrValue = (value) => {
    if (value == null)
        return null;
    if (typeof value === "string") {
        if (value.trim().length === 0)
            return null;
        return value;
    }
    if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }
    if (typeof value === "object") {
        try {
            return JSON.stringify(value);
        }
        catch {
            return String(value);
        }
    }
    return null;
};
const collectPrimitiveText = (value, out) => {
    if (typeof value === "string" || typeof value === "number") {
        const text = String(value).trim();
        if (text.length > 0)
            out.push(text);
        return;
    }
    if (Array.isArray(value)) {
        for (const item of value) {
            collectPrimitiveText(item, out);
        }
    }
};
const extractTextPreview = (props) => {
    if (!props || !("children" in props))
        return "";
    const parts = [];
    collectPrimitiveText(props.children, parts);
    if (parts.length === 0)
        return "";
    const normalized = parts.join(" ").replace(/\s+/g, " ").trim();
    return truncate(normalized, MAX_TEXT_LENGTH);
};
const getHostFiber = (node) => {
    let current = node;
    while (current) {
        if (typeof current.type === "string") {
            return current;
        }
        current = current.return ?? null;
    }
    return node ?? null;
};
const getHostComponentName = (fiber) => {
    const componentType = fiber?.type;
    if (typeof componentType === "string" && componentType.length > 0) {
        return componentType;
    }
    return "(unknown)";
};
const getMemoizedProps = (fiber) => {
    const props = fiber?.memoizedProps;
    if (!props || typeof props !== "object")
        return null;
    return props;
};
const extractPriorityAttrs = (props) => {
    if (!props)
        return "";
    const pairs = [];
    for (const key of PRIORITY_ATTRS) {
        if (pairs.length >= MAX_ATTRS)
            break;
        const rawValue = stringifyAttrValue(props[key]);
        if (!rawValue)
            continue;
        const value = escapeAttr(truncate(rawValue, MAX_ATTR_VALUE_LENGTH));
        pairs.push(`${key}="${value}"`);
    }
    return pairs.length > 0 ? ` ${pairs.join(" ")}` : "";
};
const getPreviewComponentName = (node, renderedBy) => {
    const fromRenderedBy = firstNonHostRenderedByName(renderedBy);
    if (fromRenderedBy)
        return fromRenderedBy;
    const hostFiber = getHostFiber(node);
    return getHostComponentName(hostFiber);
};
const buildElementPreview = (node, renderedBy) => {
    const componentName = getPreviewComponentName(node, renderedBy);
    const hostFiber = getHostFiber(node);
    const props = getMemoizedProps(hostFiber);
    const attrs = extractPriorityAttrs(props);
    const text = extractTextPreview(props);
    if (!text) {
        return `<${componentName}${attrs} />`;
    }
    return `<${componentName}${attrs}>\n  ${text}\n</${componentName}>`;
};
const formatFrameLocation = (file, line, column) => {
    if (!file)
        return null;
    if (line == null)
        return file;
    if (column == null)
        return `${file}:${line}`;
    return `${file}:${line}:${column}`;
};
const buildStackContext = (renderedBy) => {
    const lines = renderedBy
        .filter((frame) => Boolean(frame.file))
        .slice(0, MAX_STACK_LINES)
        .map((frame) => {
        const location = formatFrameLocation(frame.file, frame.line, frame.column);
        if (!location)
            return "";
        return `\n  in ${frame.name} (at ${location})`;
    })
        .filter(Boolean);
    return lines.join("");
};
const isGrabContextProviderFiber = (fiber) => {
    const providerType = fiber.type;
    return (providerType === grab_context_1.ReactNativeGrabInternalContext ||
        providerType === grab_context_1.ReactNativeGrabInternalContext.Provider);
};
const getGrabContextFromFiber = (node) => {
    let current = node;
    while (current) {
        if (isGrabContextProviderFiber(current)) {
            return current.memoizedProps?.value ?? null;
        }
        current = current.return ?? null;
    }
    return null;
};
const buildContextBlock = (contextValue) => {
    if (!contextValue || Object.keys(contextValue).length === 0) {
        return "";
    }
    return `\n\nContext:\n${JSON.stringify(contextValue, null, 2)}`;
};
const getGrabSelectionTitle = (node, renderedBy) => {
    const fromFiber = getHostComponentName(getHostFiber(node));
    const rawHostLabel = firstHostLikeRenderedByName(renderedBy) ?? (fromFiber !== "(unknown)" ? fromFiber : null);
    const hostUnknown = rawHostLabel == null;
    const hostLabel = hostUnknown ? "Selected element" : rawHostLabel;
    const ownerName = firstNonHostRenderedByName(renderedBy);
    if (ownerName && ownerName !== hostLabel) {
        return `${hostLabel} (in ${ownerName})`;
    }
    return hostLabel;
};
exports.getGrabSelectionTitle = getGrabSelectionTitle;
const getDescription = async (node) => {
    let renderedBy = await (0, get_rendered_by_1.getRenderedBy)(node);
    const preview = buildElementPreview(node, renderedBy);
    const stackContext = buildStackContext(renderedBy);
    const contextBlock = buildContextBlock(getGrabContextFromFiber(node));
    if (!stackContext)
        return `${preview}${contextBlock}`;
    return `${preview}${stackContext}${contextBlock}`;
};
exports.getDescription = getDescription;
//# sourceMappingURL=description.js.map