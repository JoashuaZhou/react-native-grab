import { getDevServer } from "./dev-server";
export const openStackFrameInEditor = async (payload) => {
    const response = await fetch(`${getDevServer().url}open-stack-frame`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        throw new Error(`Open stack frame request failed with status ${response.status}`);
    }
};
//# sourceMappingURL=open.js.map